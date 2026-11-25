import { ApiProperty } from '@nestjs/swagger';
import type { ChatMemberRole, ChatType } from '../entities/chat.entity';

export class CreateChatResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9012-34567890abcd' })
  chatId!: string;

  @ApiProperty({ example: 'direct' })
  type!: ChatType;

  @ApiProperty({ example: true })
  isNew!: boolean;

  @ApiProperty({
    type: [String],
    example: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
  })
  memberIds!: string[];

  @ApiProperty()
  createdAt!: Date;
}

export class ChatMemberDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: ['admin', 'member'] })
  role!: ChatMemberRole;

  @ApiProperty()
  joinedAt!: Date;
}

export class ChatDetailsResponseDto {
  @ApiProperty()
  chatId!: string;

  @ApiProperty({ enum: ['direct', 'group'] })
  type!: ChatType;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ type: [String] })
  memberIds!: string[];

  @ApiProperty({ type: [ChatMemberDto] })
  members!: ChatMemberDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class UserChatItemDto {
  @ApiProperty()
  chatId!: string;

  @ApiProperty({ enum: ['direct', 'group'] })
  type!: ChatType;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ type: [String] })
  memberIds!: string[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ListUserChatsResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: [UserChatItemDto] })
  chats!: UserChatItemDto[];
}
