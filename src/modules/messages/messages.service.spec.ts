import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ChatsService } from '@/modules/chats/chats.service';
import type { ChatWithMembers } from '@/modules/chats/entities/chat.entity';
import type { MessageView } from './interfaces/message-document.interface';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  let service: MessagesService;
  let messagesRepository: jest.Mocked<MessagesRepository>;
  let chatsService: jest.Mocked<ChatsService>;

  const sampleChat: ChatWithMembers = {
    id: 'chat-1',
    type: 'direct',
    name: null,
    memberIds: ['user-a', 'user-b'],
    createdAt: new Date('2026-11-25T00:00:00.000Z'),
    updatedAt: new Date('2026-11-25T00:00:00.000Z'),
  };

  const sampleMessage: MessageView = {
    id: 'msg-1',
    chatId: 'chat-1',
    senderId: 'user-a',
    text: 'Hello!',
    timestamp: '2026-11-25T00:01:00.000Z',
    readBy: { 'user-a': '2026-11-25T00:01:00.000Z' },
    isEdited: false,
    isDeleted: false,
    updatedAt: null,
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: MessagesRepository,
          useValue: {
            createMessage: jest.fn(),
            getMessages: jest.fn(),
            editMessage: jest.fn(),
            deleteMessage: jest.fn(),
            markMessageRead: jest.fn(),
            updateLastSeen: jest.fn(),
          },
        },
        {
          provide: ChatsService,
          useValue: {
            ensureChatExists: jest.fn(),
            ensureChatMember: jest.fn(),
            touchChatActivity: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);
    messagesRepository = moduleRef.get(MessagesRepository);
    chatsService = moduleRef.get(ChatsService);
  });

  describe('sendMessage', () => {
    it('rejects whitespace-only text', async () => {
      await expect(
        service.sendMessage('chat-1', { senderId: 'user-a', text: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-member sender', async () => {
      chatsService.ensureChatMember.mockRejectedValue(new ForbiddenException('Not a member'));
      await expect(
        service.sendMessage('chat-1', { senderId: 'outsider', text: 'Hi' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('stores message in Firestore and touches chat activity', async () => {
      chatsService.ensureChatMember.mockResolvedValue(sampleChat);
      messagesRepository.createMessage.mockResolvedValue(sampleMessage);
      chatsService.touchChatActivity.mockResolvedValue(undefined);

      const res = await service.sendMessage('chat-1', {
        senderId: 'user-a',
        text: ' Hello! ',
      });

      expect(messagesRepository.createMessage).toHaveBeenCalledWith('chat-1', 'user-a', 'Hello!');
      expect(chatsService.touchChatActivity).toHaveBeenCalledWith('chat-1');
      expect(res).toEqual(sampleMessage);
    });
  });

  describe('getMessages', () => {
    it('verifies chat exists and returns ordered messages', async () => {
      chatsService.ensureChatExists.mockResolvedValue(sampleChat);
      messagesRepository.getMessages.mockResolvedValue([sampleMessage]);

      const res = await service.getMessages('chat-1', 50);

      expect(chatsService.ensureChatExists).toHaveBeenCalledWith('chat-1');
      expect(messagesRepository.getMessages).toHaveBeenCalledWith('chat-1', 50);
      expect(res).toEqual({
        chatId: 'chat-1',
        count: 1,
        messages: [sampleMessage],
      });
    });
  });

  describe('editMessage', () => {
    it('rejects empty updated text', async () => {
      await expect(
        service.editMessage('chat-1', 'msg-1', { senderId: 'user-a', text: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('verifies membership and edits message in Firestore', async () => {
      chatsService.ensureChatMember.mockResolvedValue(sampleChat);
      messagesRepository.editMessage.mockResolvedValue({
        ...sampleMessage,
        text: 'Updated!',
        isEdited: true,
        updatedAt: '2026-11-25T00:05:00.000Z',
      });

      const res = await service.editMessage('chat-1', 'msg-1', {
        senderId: 'user-a',
        text: ' Updated! ',
      });

      expect(chatsService.ensureChatMember).toHaveBeenCalledWith('chat-1', 'user-a');
      expect(messagesRepository.editMessage).toHaveBeenCalledWith(
        'chat-1',
        'msg-1',
        'user-a',
        'Updated!',
      );
      expect(res.isEdited).toBe(true);
    });
  });

  describe('deleteMessage', () => {
    it('verifies membership and soft-deletes message in Firestore', async () => {
      chatsService.ensureChatMember.mockResolvedValue(sampleChat);
      messagesRepository.deleteMessage.mockResolvedValue({
        ...sampleMessage,
        text: 'This message was deleted',
        isDeleted: true,
        updatedAt: '2026-11-25T00:06:00.000Z',
      });

      const res = await service.deleteMessage('chat-1', 'msg-1', { senderId: 'user-a' });

      expect(chatsService.ensureChatMember).toHaveBeenCalledWith('chat-1', 'user-a');
      expect(messagesRepository.deleteMessage).toHaveBeenCalledWith('chat-1', 'msg-1', 'user-a');
      expect(res.isDeleted).toBe(true);
    });
  });

  describe('markMessageRead', () => {
    it('verifies membership and records read receipt in Firestore', async () => {
      chatsService.ensureChatMember.mockResolvedValue(sampleChat);
      messagesRepository.markMessageRead.mockResolvedValue({
        chatId: 'chat-1',
        messageId: 'msg-1',
        userId: 'user-b',
        readAt: '2026-11-25T00:02:00.000Z',
        alreadyRead: false,
      });

      const res = await service.markMessageRead('chat-1', 'msg-1', { userId: 'user-b' });

      expect(chatsService.ensureChatMember).toHaveBeenCalledWith('chat-1', 'user-b');
      expect(messagesRepository.markMessageRead).toHaveBeenCalledWith('chat-1', 'msg-1', 'user-b');
      expect(res.alreadyRead).toBe(false);
    });
  });

  describe('updateLastSeen', () => {
    it('verifies membership and updates last seen message in Firestore', async () => {
      chatsService.ensureChatMember.mockResolvedValue(sampleChat);
      messagesRepository.updateLastSeen.mockResolvedValue({
        chatId: 'chat-1',
        userId: 'user-b',
        messageId: 'msg-1',
        updatedAt: '2026-11-25T00:03:00.000Z',
      });

      const res = await service.updateLastSeen('chat-1', {
        userId: 'user-b',
        messageId: 'msg-1',
      });

      expect(chatsService.ensureChatMember).toHaveBeenCalledWith('chat-1', 'user-b');
      expect(messagesRepository.updateLastSeen).toHaveBeenCalledWith('chat-1', 'user-b', 'msg-1');
      expect(res.messageId).toBe('msg-1');
    });
  });
});
