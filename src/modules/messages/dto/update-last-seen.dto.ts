import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateLastSeenDto {
  @ApiProperty({
    description: 'User ID updating last seen pointer',
    example: '22222222-2222-4222-8222-222222222222',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  userId!: string;

  @ApiProperty({
    description: 'Firestore message ID last seen by the user',
    example: 'msg_01J...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  messageId!: string;
}
