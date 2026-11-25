import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { CreateGroupChatDto } from './dto/create-group-chat.dto';
import { AddGroupMembersDto, RemoveGroupMemberDto } from './dto/manage-group-members.dto';
import {
  ChatDetailsResponseDto,
  CreateChatResponseDto,
  ListUserChatsResponseDto,
} from './dto/chat-response.dto';
import { UpdateGroupChatDto } from './dto/update-group-chat.dto';

@ApiTags('Chats')
@Controller()
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post('chat/create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create or get an existing 1:1 chat between two users',
  })
  @ApiResponse({ status: 200, type: CreateChatResponseDto })
  createOrGetChat(@Body() dto: CreateChatDto): Promise<CreateChatResponseDto> {
    return this.chatsService.createOrGetDirectChat(dto);
  }

  @Post('chat/group')
  @ApiOperation({
    summary: 'Create a group chat with a creator (admin) and members',
  })
  @ApiResponse({ status: 201, type: ChatDetailsResponseDto })
  createGroupChat(@Body() dto: CreateGroupChatDto): Promise<ChatDetailsResponseDto> {
    return this.chatsService.createGroupChat(dto);
  }

  @Get('chat/:chatId')
  @ApiOperation({
    summary: 'Get chat details including member roles from PostgreSQL',
  })
  @ApiResponse({ status: 200, type: ChatDetailsResponseDto })
  getChatDetails(@Param('chatId') chatId: string): Promise<ChatDetailsResponseDto> {
    return this.chatsService.getChatDetails(chatId);
  }

  @Patch('chat/:chatId/group')
  @ApiOperation({
    summary: 'Rename a group chat (admin only)',
  })
  @ApiResponse({ status: 200, type: ChatDetailsResponseDto })
  renameGroup(
    @Param('chatId') chatId: string,
    @Body() dto: UpdateGroupChatDto,
  ): Promise<ChatDetailsResponseDto> {
    return this.chatsService.renameGroup(chatId, dto);
  }

  @Post('chat/:chatId/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add members to a group chat (admin only)',
  })
  @ApiResponse({ status: 200, type: ChatDetailsResponseDto })
  addGroupMembers(
    @Param('chatId') chatId: string,
    @Body() dto: AddGroupMembersDto,
  ): Promise<ChatDetailsResponseDto> {
    return this.chatsService.addGroupMembers(chatId, dto);
  }

  @Delete('chat/:chatId/members/:userId')
  @ApiOperation({
    summary: 'Remove a member from a group chat (admin) or leave group (self)',
  })
  @ApiResponse({ status: 200, type: ChatDetailsResponseDto })
  removeGroupMember(
    @Param('chatId') chatId: string,
    @Param('userId') userId: string,
    @Body() dto: RemoveGroupMemberDto,
  ): Promise<ChatDetailsResponseDto> {
    return this.chatsService.removeGroupMember(chatId, userId, dto);
  }

  @Get('user/:userId/chats')
  @ApiOperation({
    summary: 'List all chats for a user along with member IDs from PostgreSQL',
  })
  @ApiResponse({ status: 200, type: ListUserChatsResponseDto })
  listUserChats(@Param('userId') userId: string): Promise<ListUserChatsResponseDto> {
    return this.chatsService.listUserChats(userId);
  }
}
