import { Module } from '@nestjs/common';
import { ChatHistoryController } from './chat-history.controller.js';
import { ChatHistoryService } from './chat-history.service.js';

@Module({
  controllers: [ChatHistoryController],
  providers: [ChatHistoryService],
  exports: [ChatHistoryService],
})
export class ChatHistoryModule {}
