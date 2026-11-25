import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PostgresService } from '@/infrastructure/postgres/postgres.service';
import type {
  ChatDetails,
  ChatMember,
  ChatMemberRole,
  ChatType,
  ChatWithMembers,
} from './entities/chat.entity';

interface ChatRow {
  id: string;
  type: ChatType;
  name: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ChatWithMembersRow extends ChatRow {
  member_ids: string[] | null;
}

interface ChatMemberRow {
  user_id: string;
  role: ChatMemberRole;
  joined_at: Date;
}

function mapChatWithMembers(row: ChatWithMembersRow): ChatWithMembers {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberIds: row.member_ids ?? [],
  };
}

function mapChatMember(row: ChatMemberRow): ChatMember {
  return {
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

@Injectable()
export class ChatsRepository {
  constructor(private readonly postgres: PostgresService) {}

  buildDirectPairKey(userAId: string, userBId: string): string {
    const [first, second] = userAId <= userBId ? [userAId, userBId] : [userBId, userAId];
    return `${encodeURIComponent(first)}::${encodeURIComponent(second)}`;
  }

  async createOrGetDirectChat(
    userAId: string,
    userBId: string,
  ): Promise<{ chat: ChatWithMembers; isNew: boolean }> {
    const pairKey = this.buildDirectPairKey(userAId, userBId);
    const candidateChatId = randomUUID();

    return this.postgres.withTransaction(async (client) => {
      const inserted = await client.query<ChatRow>(
        `
        INSERT INTO chats (id, type, direct_pair_key)
        VALUES ($1, 'direct', $2)
        ON CONFLICT (direct_pair_key) DO NOTHING
        RETURNING id, type, name, created_at, updated_at;
        `,
        [candidateChatId, pairKey],
      );

      const createdRow = inserted.rows[0];
      if (createdRow) {
        await client.query(
          `
          INSERT INTO chat_members (chat_id, user_id, role)
          VALUES ($1, $2, 'member'), ($1, $3, 'member');
          `,
          [createdRow.id, userAId, userBId],
        );

        return {
          isNew: true,
          chat: {
            id: createdRow.id,
            type: createdRow.type,
            name: createdRow.name,
            createdAt: createdRow.created_at,
            updatedAt: createdRow.updated_at,
            memberIds: [userAId, userBId],
          },
        };
      }

      const existing = await client.query<ChatWithMembersRow>(
        `
        SELECT
          c.id,
          c.type,
          c.name,
          c.created_at,
          c.updated_at,
          ARRAY_AGG(cm.user_id ORDER BY cm.joined_at ASC) AS member_ids
        FROM chats c
        INNER JOIN chat_members cm ON cm.chat_id = c.id
        WHERE c.direct_pair_key = $1
        GROUP BY c.id;
        `,
        [pairKey],
      );

      const existingRow = existing.rows[0];
      if (!existingRow) {
        throw new Error(`Expected existing direct chat for pair key '${pairKey}'`);
      }

      return {
        isNew: false,
        chat: mapChatWithMembers(existingRow),
      };
    });
  }

  async createGroupChat(
    name: string,
    creatorId: string,
    otherMemberIds: readonly string[],
  ): Promise<ChatDetails> {
    const chatId = randomUUID();
    const userIds: string[] = [creatorId, ...otherMemberIds];
    const roles: ChatMemberRole[] = [
      'admin',
      ...otherMemberIds.map((): ChatMemberRole => 'member'),
    ];

    return this.postgres.withTransaction(async (client) => {
      const chatRes = await client.query<ChatRow>(
        `
        INSERT INTO chats (id, type, direct_pair_key, name)
        VALUES ($1, 'group', NULL, $2)
        RETURNING id, type, name, created_at, updated_at;
        `,
        [chatId, name],
      );

      const chatRow = chatRes.rows[0];
      if (!chatRow) {
        throw new Error('Failed to insert group chat');
      }

      const membersRes = await client.query<ChatMemberRow>(
        `
        INSERT INTO chat_members (chat_id, user_id, role)
        SELECT $1, u.user_id, u.role
        FROM UNNEST($2::varchar[], $3::varchar[]) AS u(user_id, role)
        RETURNING user_id, role, joined_at;
        `,
        [chatId, userIds, roles],
      );

      const members = membersRes.rows.map(mapChatMember);
      return {
        id: chatRow.id,
        type: chatRow.type,
        name: chatRow.name,
        createdAt: chatRow.created_at,
        updatedAt: chatRow.updated_at,
        memberIds: members.map((m) => m.userId),
        members,
      };
    });
  }

  async findDetailsById(chatId: string): Promise<ChatDetails | null> {
    const chatRes = await this.postgres.query<ChatRow>(
      `
      SELECT id, type, name, created_at, updated_at
      FROM chats
      WHERE id = $1;
      `,
      [chatId],
    );

    const chatRow = chatRes.rows[0];
    if (!chatRow) {
      return null;
    }

    const membersRes = await this.postgres.query<ChatMemberRow>(
      `
      SELECT user_id, role, joined_at
      FROM chat_members
      WHERE chat_id = $1
      ORDER BY joined_at ASC;
      `,
      [chatId],
    );

    const members = membersRes.rows.map(mapChatMember);
    return {
      id: chatRow.id,
      type: chatRow.type,
      name: chatRow.name,
      createdAt: chatRow.created_at,
      updatedAt: chatRow.updated_at,
      memberIds: members.map((m) => m.userId),
      members,
    };
  }

  async updateGroupName(chatId: string, name: string): Promise<ChatDetails | null> {
    await this.postgres.query(
      `
      UPDATE chats
      SET name = $2, updated_at = NOW()
      WHERE id = $1;
      `,
      [chatId, name],
    );

    return this.findDetailsById(chatId);
  }

  async addMembers(chatId: string, userIds: readonly string[]): Promise<ChatDetails | null> {
    if (userIds.length === 0) {
      return this.findDetailsById(chatId);
    }

    await this.postgres.withTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO chat_members (chat_id, user_id, role)
        SELECT $1, u.user_id, 'member'
        FROM UNNEST($2::varchar[]) AS u(user_id)
        ON CONFLICT (chat_id, user_id) DO NOTHING;
        `,
        [chatId, userIds],
      );

      await client.query(
        `
        UPDATE chats
        SET updated_at = NOW()
        WHERE id = $1;
        `,
        [chatId],
      );
    });

    return this.findDetailsById(chatId);
  }

  async removeMember(chatId: string, userId: string): Promise<ChatDetails | null> {
    await this.postgres.withTransaction(async (client) => {
      await client.query(
        `
        DELETE FROM chat_members
        WHERE chat_id = $1 AND user_id = $2;
        `,
        [chatId, userId],
      );

      await client.query(
        `
        UPDATE chats
        SET updated_at = NOW()
        WHERE id = $1;
        `,
        [chatId],
      );
    });

    return this.findDetailsById(chatId);
  }

  async findById(chatId: string): Promise<ChatWithMembers | null> {
    const result = await this.postgres.query<ChatWithMembersRow>(
      `
      SELECT
        c.id,
        c.type,
        c.name,
        c.created_at,
        c.updated_at,
        COALESCE(
          ARRAY_AGG(cm.user_id ORDER BY cm.joined_at ASC) FILTER (WHERE cm.user_id IS NOT NULL),
          '{}'::varchar[]
        ) AS member_ids
      FROM chats c
      LEFT JOIN chat_members cm ON cm.chat_id = c.id
      WHERE c.id = $1
      GROUP BY c.id;
      `,
      [chatId],
    );

    const row = result.rows[0];
    return row ? mapChatWithMembers(row) : null;
  }

  async findChatsByUserId(userId: string): Promise<ChatWithMembers[]> {
    const result = await this.postgres.query<ChatWithMembersRow>(
      `
      SELECT
        c.id,
        c.type,
        c.name,
        c.created_at,
        c.updated_at,
        ARRAY_AGG(cm_all.user_id ORDER BY cm_all.joined_at ASC) AS member_ids
      FROM chats c
      INNER JOIN chat_members cm_self
        ON cm_self.chat_id = c.id AND cm_self.user_id = $1
      INNER JOIN chat_members cm_all
        ON cm_all.chat_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC, c.created_at DESC;
      `,
      [userId],
    );

    return result.rows.map(mapChatWithMembers);
  }

  async touchUpdatedAt(chatId: string): Promise<void> {
    await this.postgres.query(
      `
      UPDATE chats
      SET updated_at = NOW()
      WHERE id = $1;
      `,
      [chatId],
    );
  }
}
