import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'User ID of the message sender (must be a member of the chat)',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  senderId!: string;

  @ApiProperty({
    description: 'Plain text message content',
    example: 'Hey Bob, how is the backend coming along?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;
}
