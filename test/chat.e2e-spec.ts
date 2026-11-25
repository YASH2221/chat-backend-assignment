import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { ChatsController } from '@/modules/chats/chats.controller';
import { ChatsService } from '@/modules/chats/chats.service';
import { MessagesController } from '@/modules/messages/messages.controller';
import { MessagesService } from '@/modules/messages/messages.service';

describe('Chat API Routes (e2e)', () => {
  let app: INestApplication;

  const mockChatsService = {
    createOrGetDirectChat: jest.fn(),
    createGroupChat: jest.fn(),
    getChatDetails: jest.fn(),
    renameGroup: jest.fn(),
    addGroupMembers: jest.fn(),
    removeGroupMember: jest.fn(),
    listUserChats: jest.fn(),
  };

  const mockMessagesService = {
    sendMessage: jest.fn(),
    getMessages: jest.fn(),
    editMessage: jest.fn(),
    deleteMessage: jest.fn(),
    markMessageRead: jest.fn(),
    updateLastSeen: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ChatsController, MessagesController],
      providers: [
        { provide: ChatsService, useValue: mockChatsService },
        { provide: MessagesService, useValue: mockMessagesService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /chat/create creates or returns a 1:1 chat', async () => {
    mockChatsService.createOrGetDirectChat.mockResolvedValue({
      chatId: 'chat-123',
      type: 'direct',
      isNew: true,
      memberIds: ['user-a', 'user-b'],
      createdAt: '2026-11-25T00:00:00.000Z',
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server)
      .post('/chat/create')
      .send({ userAId: 'user-a', userBId: 'user-b' })
      .expect(200);

    expect(res.body).toMatchObject({
      chatId: 'chat-123',
      type: 'direct',
      isNew: true,
    });
  });

  it('POST /chat/create rejects missing userBId with 400', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).post('/chat/create').send({ userAId: 'user-a' }).expect(400);
  });

  it('POST /chat/group creates a group chat', async () => {
    mockChatsService.createGroupChat.mockResolvedValue({
      chatId: 'group-1',
      type: 'group',
      name: 'Backend Team',
      memberIds: ['user-a', 'user-b'],
      members: [
        { userId: 'user-a', role: 'admin' },
        { userId: 'user-b', role: 'member' },
      ],
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server)
      .post('/chat/group')
      .send({ name: 'Backend Team', creatorId: 'user-a', memberIds: ['user-b'] })
      .expect(201);

    expect(res.body).toMatchObject({ chatId: 'group-1', type: 'group', name: 'Backend Team' });
  });

  it('GET /chat/:chatId returns chat details', async () => {
    mockChatsService.getChatDetails.mockResolvedValue({
      chatId: 'group-1',
      type: 'group',
      name: 'Backend Team',
      memberIds: ['user-a', 'user-b'],
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server).get('/chat/group-1').expect(200);
    expect(res.body).toMatchObject({ chatId: 'group-1' });
  });

  it('PATCH /chat/:chatId/group renames group chat', async () => {
    mockChatsService.renameGroup.mockResolvedValue({
      chatId: 'group-1',
      type: 'group',
      name: 'Platform Team',
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server)
      .patch('/chat/group-1/group')
      .send({ actorId: 'user-a', name: 'Platform Team' })
      .expect(200);

    expect(res.body).toMatchObject({ name: 'Platform Team' });
  });

  it('POST /chat/:chatId/members adds members to group', async () => {
    mockChatsService.addGroupMembers.mockResolvedValue({
      chatId: 'group-1',
      memberIds: ['user-a', 'user-b', 'user-c'],
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server)
      .post('/chat/group-1/members')
      .send({ actorId: 'user-a', userIds: ['user-c'] })
      .expect(200);

    expect(res.body).toMatchObject({ memberIds: ['user-a', 'user-b', 'user-c'] });
  });

  it('DELETE /chat/:chatId/members/:userId removes a member from group', async () => {
    mockChatsService.removeGroupMember.mockResolvedValue({
      chatId: 'group-1',
      memberIds: ['user-a', 'user-b'],
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .delete('/chat/group-1/members/user-c')
      .send({ actorId: 'user-a' })
      .expect(200);
  });

  it('POST /chat/:chatId/message/send stores message', async () => {
    mockMessagesService.sendMessage.mockResolvedValue({
      id: 'msg-1',
      chatId: 'chat-123',
      senderId: 'user-a',
      text: 'Hello',
      timestamp: '2026-11-25T00:01:00.000Z',
      readBy: { 'user-a': '2026-11-25T00:01:00.000Z' },
      isEdited: false,
      isDeleted: false,
      updatedAt: null,
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server)
      .post('/chat/chat-123/message/send')
      .send({ senderId: 'user-a', text: 'Hello' })
      .expect(201);

    expect(res.body).toMatchObject({ id: 'msg-1', text: 'Hello' });
  });

  it('GET /chat/:chatId/messages?limit=50 returns ordered messages', async () => {
    mockMessagesService.getMessages.mockResolvedValue({
      chatId: 'chat-123',
      count: 1,
      messages: [{ id: 'msg-1', text: 'Hello' }],
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/chat/chat-123/messages?limit=25').expect(200);

    expect(mockMessagesService.getMessages).toHaveBeenCalledWith('chat-123', 25);
  });

  it('PATCH /chat/:chatId/message/:messageId edits message', async () => {
    mockMessagesService.editMessage.mockResolvedValue({
      id: 'msg-1',
      text: 'Edited text',
      isEdited: true,
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server)
      .patch('/chat/chat-123/message/msg-1')
      .send({ senderId: 'user-a', text: 'Edited text' })
      .expect(200);

    expect(res.body).toMatchObject({ isEdited: true, text: 'Edited text' });
  });

  it('DELETE /chat/:chatId/message/:messageId soft-deletes message', async () => {
    mockMessagesService.deleteMessage.mockResolvedValue({
      id: 'msg-1',
      text: 'This message was deleted',
      isDeleted: true,
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server)
      .delete('/chat/chat-123/message/msg-1')
      .send({ senderId: 'user-a' })
      .expect(200);

    expect(res.body).toMatchObject({ isDeleted: true });
  });

  it('POST /chat/:chatId/message/:messageId/read records read receipt', async () => {
    mockMessagesService.markMessageRead.mockResolvedValue({
      chatId: 'chat-123',
      messageId: 'msg-1',
      userId: 'user-b',
      readAt: '2026-11-25T00:02:00.000Z',
      alreadyRead: false,
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .post('/chat/chat-123/message/msg-1/read')
      .send({ userId: 'user-b' })
      .expect(200);
  });

  it('POST /chat/:chatId/lastseen updates last seen message', async () => {
    mockMessagesService.updateLastSeen.mockResolvedValue({
      chatId: 'chat-123',
      userId: 'user-b',
      messageId: 'msg-1',
      updatedAt: '2026-11-25T00:03:00.000Z',
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .post('/chat/chat-123/lastseen')
      .send({ userId: 'user-b', messageId: 'msg-1' })
      .expect(200);
  });

  it('GET /user/:userId/chats returns user chats with memberIds', async () => {
    mockChatsService.listUserChats.mockResolvedValue({
      userId: 'user-a',
      chats: [
        {
          chatId: 'chat-123',
          type: 'direct',
          name: null,
          memberIds: ['user-a', 'user-b'],
        },
      ],
    });

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server).get('/user/user-a/chats').expect(200);
    expect(res.body).toMatchObject({ userId: 'user-a' });
  });
});
