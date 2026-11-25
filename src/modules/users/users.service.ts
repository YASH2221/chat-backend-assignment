import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateUserDto } from './dto/create-user.dto';
import type { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  createUser(dto: CreateUserDto): Promise<User> {
    return this.usersRepository.create({
      name: dto.name,
      email: dto.email,
    });
  }

  listUsers(): Promise<User[]> {
    return this.usersRepository.findAll();
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User '${userId}' not found`);
    }
    return user;
  }

  async ensureUsersExist(userIds: readonly string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds));
    const found = await this.usersRepository.findByIds(uniqueIds);
    const foundSet = new Set(found.map((u) => u.id));
    const missing = uniqueIds.filter((id) => !foundSet.has(id));

    if (missing.length > 0) {
      throw new NotFoundException(`User(s) not found: ${missing.join(', ')}`);
    }
  }
}
