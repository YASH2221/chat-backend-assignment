import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UsersService } from '@/modules/users/users.service';
import { ChatsRepository } from './chats.repository';
import { ChatsService } from './chats.service';
import type { ChatDetails, ChatWithMembers } from './entities/chat.entity';

describe('ChatsService', () => {
  let service: ChatsService;
  let chatsRepository: jest.Mocked<ChatsRepository>;
  let usersService: jest.Mocked<UsersService>;

  const now = new Date('2026-11-25T00:00:00.000Z');

  const sampleChat: ChatWithMembers = {
    id: 'chat-1',
    type: 'direct',
    name: null,
    memberIds: ['user-a', 'user-b'],
    createdAt: now,
    updatedAt: now,
  };

  const sampleGroup: ChatDetails = {
    id: 'group-1',
    type: 'group',
    name: 'Engineering',
    memberIds: ['user-a', 'user-b'],
    members: [
      { userId: 'user-a', role: 'admin', joinedAt: now },
      { userId: 'user-b', role: 'member', joinedAt: now },
    ],
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatsService,
        {
          provide: ChatsRepository,
          useValue: {
            createOrGetDirectChat: jest.fn(),
            createGroupChat: jest.fn(),
            findDetailsById: jest.fn(),
            updateGroupName: jest.fn(),
            addMembers: jest.fn(),
            removeMember: jest.fn(),
            findById: jest.fn(),
            findChatsByUserId: jest.fn(),
            touchUpdatedAt: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            ensureUsersExist: jest.fn(),
            getUserById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ChatsService);
    chatsRepository = moduleRef.get(ChatsRepository);
    usersService = moduleRef.get(UsersService);
  });

  describe('createOrGetDirectChat', () => {
    it('throws BadRequestException when userAId equals userBId', async () => {
      await expect(
        service.createOrGetDirectChat({ userAId: 'user-a', userBId: 'user-a' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates or returns an existing 1:1 chat after verifying both users exist', async () => {
      usersService.ensureUsersExist.mockResolvedValue(undefined);
      chatsRepository.createOrGetDirectChat.mockResolvedValue({
        chat: sampleChat,
        isNew: true,
      });

      const result = await service.createOrGetDirectChat({
        userAId: ' user-a ',
        userBId: 'user-b',
      });

      expect(usersService.ensureUsersExist).toHaveBeenCalledWith(['user-a', 'user-b']);
      expect(chatsRepository.createOrGetDirectChat).toHaveBeenCalledWith('user-a', 'user-b');
      expect(result).toEqual({
        chatId: 'chat-1',
        type: 'direct',
        isNew: true,
        memberIds: ['user-a', 'user-b'],
        createdAt: sampleChat.createdAt,
      });
    });
  });

  describe('createGroupChat', () => {
    it('throws BadRequestException if fewer than 2 distinct members', async () => {
      await expect(
        service.createGroupChat({
          name: 'Solo',
          creatorId: 'user-a',
          memberIds: ['user-a'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates group chat with deduplicated members and creator as admin', async () => {
      usersService.ensureUsersExist.mockResolvedValue(undefined);
      chatsRepository.createGroupChat.mockResolvedValue(sampleGroup);

      const res = await service.createGroupChat({
        name: ' Engineering ',
        creatorId: 'user-a',
        memberIds: ['user-a', 'user-b', 'user-b'],
      });

      expect(usersService.ensureUsersExist).toHaveBeenCalledWith(['user-a', 'user-b']);
      expect(chatsRepository.createGroupChat).toHaveBeenCalledWith('Engineering', 'user-a', [
        'user-b',
      ]);
      expect(res.chatId).toBe('group-1');
      expect(res.members[0]?.role).toBe('admin');
    });
  });

  describe('group management', () => {
    it('rejects renameGroup when actor is not an admin', async () => {
      chatsRepository.findDetailsById.mockResolvedValue(sampleGroup);
      await expect(
        service.renameGroup('group-1', { actorId: 'user-b', name: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('renames group when actor is admin', async () => {
      chatsRepository.findDetailsById.mockResolvedValue(sampleGroup);
      chatsRepository.updateGroupName.mockResolvedValue({ ...sampleGroup, name: 'Platform' });

      const res = await service.renameGroup('group-1', { actorId: 'user-a', name: 'Platform' });
      expect(res.name).toBe('Platform');
    });

    it('adds group members when actor is admin', async () => {
      chatsRepository.findDetailsById.mockResolvedValue(sampleGroup);
      usersService.ensureUsersExist.mockResolvedValue(undefined);
      chatsRepository.addMembers.mockResolvedValue({
        ...sampleGroup,
        memberIds: ['user-a', 'user-b', 'user-c'],
      });

      const res = await service.addGroupMembers('group-1', {
        actorId: 'user-a',
        userIds: ['user-c'],
      });
      expect(usersService.ensureUsersExist).toHaveBeenCalledWith(['user-c']);
      expect(res.memberIds).toContain('user-c');
    });

    it('rejects removing the only admin while other members remain', async () => {
      chatsRepository.findDetailsById.mockResolvedValue(sampleGroup);
      await expect(
        service.removeGroupMember('group-1', 'user-a', { actorId: 'user-a' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows non-admin member to leave group themselves', async () => {
      chatsRepository.findDetailsById.mockResolvedValue(sampleGroup);
      chatsRepository.removeMember.mockResolvedValue({
        ...sampleGroup,
        memberIds: ['user-a'],
        members: [sampleGroup.members[0]!],
      });

      const res = await service.removeGroupMember('group-1', 'user-b', { actorId: 'user-b' });
      expect(res.memberIds).toEqual(['user-a']);
    });
  });

  describe('ensureChatMember', () => {
    it('throws NotFoundException when chat does not exist', async () => {
      chatsRepository.findById.mockResolvedValue(null);
      await expect(service.ensureChatMember('missing', 'user-a')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user is not a member of the chat', async () => {
      chatsRepository.findById.mockResolvedValue(sampleChat);
      await expect(service.ensureChatMember('chat-1', 'outsider')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns chat when user is a member', async () => {
      chatsRepository.findById.mockResolvedValue(sampleChat);
      await expect(service.ensureChatMember('chat-1', 'user-b')).resolves.toEqual(sampleChat);
    });
  });

  describe('listUserChats', () => {
    it('returns user chats with memberIds', async () => {
      usersService.getUserById.mockResolvedValue({
        id: 'user-a',
        name: 'Alice',
        email: 'alice@example.com',
        createdAt: sampleChat.createdAt,
        updatedAt: sampleChat.updatedAt,
      });
      chatsRepository.findChatsByUserId.mockResolvedValue([sampleChat]);

      const result = await service.listUserChats('user-a');
      expect(result).toEqual({
        userId: 'user-a',
        chats: [
          {
            chatId: 'chat-1',
            type: 'direct',
            name: null,
            memberIds: ['user-a', 'user-b'],
            createdAt: sampleChat.createdAt,
            updatedAt: sampleChat.updatedAt,
          },
        ],
      });
    });
  });
});
