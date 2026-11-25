import { Module } from '@nestjs/common';
import { UsersModule } from '@/modules/users/users.module';
import { ChatsController } from './chats.controller';
import { ChatsRepository } from './chats.repository';
import { ChatsService } from './chats.service';

@Module({
  imports: [UsersModule],
  controllers: [ChatsController],
  providers: [ChatsRepository, ChatsService],
  exports: [ChatsService, ChatsRepository],
})
export class ChatsModule {}
