import { BadRequestException, Injectable } from '@nestjs/common';
import { ChatsService } from '@/modules/chats/chats.service';
import type { DeleteMessageDto } from './dto/delete-message.dto';
import type { EditMessageDto } from './dto/edit-message.dto';
import type { MarkReadDto } from './dto/mark-read.dto';
import type { SendMessageDto } from './dto/send-message.dto';
import type { UpdateLastSeenDto } from './dto/update-last-seen.dto';
import type {
  LastSeenResult,
  MarkReadResult,
  MessageView,
} from './interfaces/message-document.interface';
import { MessagesRepository } from './messages.repository';

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly chatsService: ChatsService,
  ) {}

  async sendMessage(chatId: string, dto: SendMessageDto): Promise<MessageView> {
    const senderId = dto.senderId.trim();
    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('Message text cannot be empty');
    }

    await this.chatsService.ensureChatMember(chatId, senderId);
    const message = await this.messagesRepository.createMessage(chatId, senderId, text);
    await this.chatsService.touchChatActivity(chatId);
    return message;
  }

  async getMessages(
    chatId: string,
    limit: number,
  ): Promise<{ chatId: string; count: number; messages: MessageView[] }> {
    await this.chatsService.ensureChatExists(chatId);
    const messages = await this.messagesRepository.getMessages(chatId, limit);

    return {
      chatId,
      count: messages.length,
      messages,
    };
  }

  async editMessage(chatId: string, messageId: string, dto: EditMessageDto): Promise<MessageView> {
    const senderId = dto.senderId.trim();
    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('Message text cannot be empty');
    }

    await this.chatsService.ensureChatMember(chatId, senderId);
    return this.messagesRepository.editMessage(chatId, messageId, senderId, text);
  }

  async deleteMessage(
    chatId: string,
    messageId: string,
    dto: DeleteMessageDto,
  ): Promise<MessageView> {
    const senderId = dto.senderId.trim();
    await this.chatsService.ensureChatMember(chatId, senderId);
    return this.messagesRepository.deleteMessage(chatId, messageId, senderId);
  }

  async markMessageRead(
    chatId: string,
    messageId: string,
    dto: MarkReadDto,
  ): Promise<MarkReadResult> {
    const userId = dto.userId.trim();
    await this.chatsService.ensureChatMember(chatId, userId);
    return this.messagesRepository.markMessageRead(chatId, messageId, userId);
  }

  async updateLastSeen(chatId: string, dto: UpdateLastSeenDto): Promise<LastSeenResult> {
    const userId = dto.userId.trim();
    const messageId = dto.messageId.trim();
    await this.chatsService.ensureChatMember(chatId, userId);
    return this.messagesRepository.updateLastSeen(chatId, userId, messageId);
  }
}
