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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateLastSeenDto } from './dto/update-last-seen.dto';
import type {
  LastSeenResult,
  MarkReadResult,
  MessageView,
} from './interfaces/message-document.interface';
import { MessagesService } from './messages.service';

@ApiTags('Messages')
@Controller('chat/:chatId')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('message/send')
  @ApiOperation({ summary: 'Send a message to a chat (stored in Firestore)' })
  @ApiResponse({ status: 201, description: 'Message stored successfully in Firestore' })
  sendMessage(@Param('chatId') chatId: string, @Body() dto: SendMessageDto): Promise<MessageView> {
    return this.messagesService.sendMessage(chatId, dto);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Get chat messages ordered chronologically by timestamp' })
  @ApiResponse({ status: 200, description: 'List of messages ordered by timestamp' })
  getMessages(
    @Param('chatId') chatId: string,
    @Query() query: GetMessagesQueryDto,
  ): Promise<{ chatId: string; count: number; messages: MessageView[] }> {
    return this.messagesService.getMessages(chatId, query.limit);
  }

  @Patch('message/:messageId')
  @ApiOperation({ summary: 'Edit a message in Firestore (sender only)' })
  @ApiResponse({ status: 200, description: 'Message edited successfully in Firestore' })
  editMessage(
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ): Promise<MessageView> {
    return this.messagesService.editMessage(chatId, messageId, dto);
  }

  @Delete('message/:messageId')
  @ApiOperation({ summary: 'Soft-delete a message in Firestore (sender only)' })
  @ApiResponse({ status: 200, description: 'Message soft-deleted successfully in Firestore' })
  deleteMessage(
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: DeleteMessageDto,
  ): Promise<MessageView> {
    return this.messagesService.deleteMessage(chatId, messageId, dto);
  }

  @Post('message/:messageId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a message as read by a user in Firestore' })
  @ApiResponse({ status: 200, description: 'Read receipt recorded in Firestore' })
  markMessageRead(
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: MarkReadDto,
  ): Promise<MarkReadResult> {
    return this.messagesService.markMessageRead(chatId, messageId, dto);
  }

  @Post('lastseen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update last seen message pointer for a user in Firestore' })
  @ApiResponse({ status: 200, description: 'Last seen message updated in Firestore' })
  updateLastSeen(
    @Param('chatId') chatId: string,
    @Body() dto: UpdateLastSeenDto,
  ): Promise<LastSeenResult> {
    return this.messagesService.updateLastSeen(chatId, dto);
  }
}
