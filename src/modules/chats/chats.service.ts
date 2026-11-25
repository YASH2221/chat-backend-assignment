import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '@/modules/users/users.service';
import { ChatsRepository } from './chats.repository';
import type { CreateChatDto } from './dto/create-chat.dto';
import type { CreateGroupChatDto } from './dto/create-group-chat.dto';
import type { AddGroupMembersDto, RemoveGroupMemberDto } from './dto/manage-group-members.dto';
import type {
  ChatDetailsResponseDto,
  CreateChatResponseDto,
  ListUserChatsResponseDto,
} from './dto/chat-response.dto';
import type { UpdateGroupChatDto } from './dto/update-group-chat.dto';
import type { ChatDetails, ChatWithMembers } from './entities/chat.entity';

function toChatDetailsResponse(chat: ChatDetails): ChatDetailsResponseDto {
  return {
    chatId: chat.id,
    type: chat.type,
    name: chat.name,
    memberIds: chat.memberIds,
    members: chat.members,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
}

@Injectable()
export class ChatsService {
  constructor(
    private readonly chatsRepository: ChatsRepository,
    private readonly usersService: UsersService,
  ) {}

  async createOrGetDirectChat(dto: CreateChatDto): Promise<CreateChatResponseDto> {
    const userAId = dto.userAId.trim();
    const userBId = dto.userBId.trim();

    if (userAId === userBId) {
      throw new BadRequestException('userAId and userBId must be different users');
    }

    await this.usersService.ensureUsersExist([userAId, userBId]);

    const { chat, isNew } = await this.chatsRepository.createOrGetDirectChat(userAId, userBId);

    return {
      chatId: chat.id,
      type: chat.type,
      isNew,
      memberIds: chat.memberIds,
      createdAt: chat.createdAt,
    };
  }

  async createGroupChat(dto: CreateGroupChatDto): Promise<ChatDetailsResponseDto> {
    const name = dto.name.trim();
    const creatorId = dto.creatorId.trim();
    if (!name) {
      throw new BadRequestException('Group name cannot be empty');
    }

    const otherMembers = Array.from(
      new Set(dto.memberIds.map((id) => id.trim()).filter((id) => id && id !== creatorId)),
    );
    const allUserIds = [creatorId, ...otherMembers];
    if (allUserIds.length < 2) {
      throw new BadRequestException('Group chat must have at least 2 distinct members');
    }

    await this.usersService.ensureUsersExist(allUserIds);
    const created = await this.chatsRepository.createGroupChat(name, creatorId, otherMembers);
    return toChatDetailsResponse(created);
  }

  async getChatDetails(chatId: string): Promise<ChatDetailsResponseDto> {
    const chat = await this.ensureGroupOrDirectDetails(chatId);
    return toChatDetailsResponse(chat);
  }

  async renameGroup(chatId: string, dto: UpdateGroupChatDto): Promise<ChatDetailsResponseDto> {
    const actorId = dto.actorId.trim();
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Group name cannot be empty');
    }

    await this.ensureGroupAdmin(chatId, actorId);
    const updated = await this.chatsRepository.updateGroupName(chatId, name);
    if (!updated) {
      throw new NotFoundException(`Chat '${chatId}' not found`);
    }
    return toChatDetailsResponse(updated);
  }

  async addGroupMembers(chatId: string, dto: AddGroupMembersDto): Promise<ChatDetailsResponseDto> {
    const actorId = dto.actorId.trim();
    await this.ensureGroupAdmin(chatId, actorId);

    const uniqueUserIds = Array.from(new Set(dto.userIds.map((id) => id.trim()).filter(Boolean)));
    if (uniqueUserIds.length === 0) {
      throw new BadRequestException('At least one valid userId must be provided');
    }

    await this.usersService.ensureUsersExist(uniqueUserIds);
    const updated = await this.chatsRepository.addMembers(chatId, uniqueUserIds);
    if (!updated) {
      throw new NotFoundException(`Chat '${chatId}' not found`);
    }
    return toChatDetailsResponse(updated);
  }

  async removeGroupMember(
    chatId: string,
    targetUserId: string,
    dto: RemoveGroupMemberDto,
  ): Promise<ChatDetailsResponseDto> {
    const actorId = dto.actorId.trim();
    const targetId = targetUserId.trim();
    const chat = await this.ensureGroupChat(chatId);

    const actor = chat.members.find((m) => m.userId === actorId);
    if (!actor) {
      throw new ForbiddenException(`User '${actorId}' is not a member of chat '${chatId}'`);
    }

    if (actorId !== targetId && actor.role !== 'admin') {
      throw new ForbiddenException('Only group admins can remove other members');
    }

    const target = chat.members.find((m) => m.userId === targetId);
    if (!target) {
      throw new NotFoundException(`User '${targetId}' is not a member of group '${chatId}'`);
    }

    if (target.role === 'admin') {
      const remainingAdmins = chat.members.filter(
        (m) => m.role === 'admin' && m.userId !== targetId,
      );
      if (remainingAdmins.length === 0 && chat.members.length > 1) {
        throw new BadRequestException(
          'Cannot remove the only admin while other members remain in the group',
        );
      }
    }

    const updated = await this.chatsRepository.removeMember(chatId, targetId);
    if (!updated) {
      throw new NotFoundException(`Chat '${chatId}' not found`);
    }
    return toChatDetailsResponse(updated);
  }

  async listUserChats(userId: string): Promise<ListUserChatsResponseDto> {
    await this.usersService.getUserById(userId);
    const chats = await this.chatsRepository.findChatsByUserId(userId);

    return {
      userId,
      chats: chats.map((chat) => ({
        chatId: chat.id,
        type: chat.type,
        name: chat.name,
        memberIds: chat.memberIds,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      })),
    };
  }

  async ensureChatExists(chatId: string): Promise<ChatWithMembers> {
    const chat = await this.chatsRepository.findById(chatId);
    if (!chat) {
      throw new NotFoundException(`Chat '${chatId}' not found`);
    }
    return chat;
  }

  async ensureChatMember(chatId: string, userId: string): Promise<ChatWithMembers> {
    const chat = await this.ensureChatExists(chatId);
    if (!chat.memberIds.includes(userId)) {
      throw new ForbiddenException(`User '${userId}' is not a member of chat '${chatId}'`);
    }
    return chat;
  }

  touchChatActivity(chatId: string): Promise<void> {
    return this.chatsRepository.touchUpdatedAt(chatId);
  }

  private async ensureGroupOrDirectDetails(chatId: string): Promise<ChatDetails> {
    const chat = await this.chatsRepository.findDetailsById(chatId);
    if (!chat) {
      throw new NotFoundException(`Chat '${chatId}' not found`);
    }
    return chat;
  }

  private async ensureGroupChat(chatId: string): Promise<ChatDetails> {
    const chat = await this.ensureGroupOrDirectDetails(chatId);
    if (chat.type !== 'group') {
      throw new BadRequestException('Operation is only supported for group chats');
    }
    return chat;
  }

  private async ensureGroupAdmin(chatId: string, actorId: string): Promise<ChatDetails> {
    const chat = await this.ensureGroupChat(chatId);
    const actor = chat.members.find((m) => m.userId === actorId);
    if (!actor) {
      throw new ForbiddenException(`User '${actorId}' is not a member of chat '${chatId}'`);
    }
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Only group admins can perform this action');
    }
    return chat;
  }
}
