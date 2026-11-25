import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '@/config/env.validation';
import { FirebaseModule } from '@/infrastructure/firebase/firebase.module';
import { PostgresModule } from '@/infrastructure/postgres/postgres.module';
import { ChatsModule } from '@/modules/chats/chats.module';
import { HealthModule } from '@/modules/health/health.module';
import { MessagesModule } from '@/modules/messages/messages.module';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    PostgresModule,
    FirebaseModule,
    HealthModule,
    UsersModule,
    ChatsModule,
    MessagesModule,
  ],
})
export class AppModule {}
