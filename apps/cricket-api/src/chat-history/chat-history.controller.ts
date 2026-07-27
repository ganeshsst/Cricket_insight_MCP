import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatHistoryService } from './chat-history.service.js';

@ApiTags('chat-history')
@Controller('chat-history')
export class ChatHistoryController {
  constructor(
    @Inject(ChatHistoryService)
    private readonly chatHistory: ChatHistoryService,
  ) {}

  @Put('profiles')
  @ApiOperation({ summary: 'Upsert app profile keyed by Auth0 sub' })
  upsertProfile(
    @Body()
    body: {
      userId: string;
      email?: string;
      displayName?: string;
      avatarUrl?: string;
    },
  ) {
    return this.chatHistory.upsertProfile(body);
  }

  @Get('profiles/:userId')
  @ApiOperation({ summary: 'Get app profile by Auth0 sub' })
  getProfile(@Param('userId') userId: string) {
    return this.chatHistory.getProfile(userId);
  }

  @Get('chats')
  @ApiOperation({ summary: 'List chats for a user' })
  listChats(@Query('userId') userId: string) {
    return this.chatHistory.listChats(userId);
  }

  @Post('chats')
  @ApiOperation({ summary: 'Create a chat' })
  createChat(
    @Body()
    body: { userId: string; title?: string; visibility?: 'private' | 'public' },
  ) {
    return this.chatHistory.createChat(body);
  }

  @Get('chats/:chatId')
  @ApiOperation({ summary: 'Get chat + messages' })
  getChat(
    @Param('chatId') chatId: string,
    @Query('userId') userId: string,
  ) {
    return this.chatHistory.getChat(chatId, userId);
  }

  @Post('chats/:chatId/messages')
  @ApiOperation({ summary: 'Append a message to a chat' })
  addMessage(
    @Param('chatId') chatId: string,
    @Body()
    body: {
      userId: string;
      role: 'user' | 'assistant';
      content?: string;
      pageJson?: unknown;
    },
  ) {
    return this.chatHistory.addMessage(chatId, body);
  }

  @Put('chats/:chatId')
  @ApiOperation({ summary: 'Update chat title / visibility' })
  updateChat(
    @Param('chatId') chatId: string,
    @Body()
    body: {
      userId: string;
      title?: string;
      visibility?: 'private' | 'public';
    },
  ) {
    return this.chatHistory.updateChat(chatId, body);
  }
}
