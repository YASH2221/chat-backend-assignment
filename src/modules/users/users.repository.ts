import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PostgresService } from '@/infrastructure/postgres/postgres.service';
import type { User } from './entities/user.entity';

interface UserRow {
  id: string;
  name: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

function mapRowToUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class UsersRepository {
  constructor(private readonly postgres: PostgresService) {}

  async create(input: { name: string; email: string }): Promise<User> {
    const id = randomUUID();
    const result = await this.postgres.query<UserRow>(
      `
      INSERT INTO users (id, name, email)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at, updated_at;
      `,
      [id, input.name.trim(), input.email.trim().toLowerCase()],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to insert user');
    }
    return mapRowToUser(row);
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.postgres.query<UserRow>(
      `
      SELECT id, name, email, created_at, updated_at
      FROM users
      WHERE id = $1;
      `,
      [userId],
    );

    const row = result.rows[0];
    return row ? mapRowToUser(row) : null;
  }

  async findByIds(userIds: readonly string[]): Promise<User[]> {
    if (userIds.length === 0) {
      return [];
    }

    const result = await this.postgres.query<UserRow>(
      `
      SELECT id, name, email, created_at, updated_at
      FROM users
      WHERE id = ANY($1::varchar[]);
      `,
      [userIds],
    );

    return result.rows.map(mapRowToUser);
  }

  async findAll(): Promise<User[]> {
    const result = await this.postgres.query<UserRow>(
      `
      SELECT id, name, email, created_at, updated_at
      FROM users
      ORDER BY created_at DESC;
      `,
    );

    return result.rows.map(mapRowToUser);
  }
}
