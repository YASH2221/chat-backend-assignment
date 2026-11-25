import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteMessageDto {
  @ApiProperty({
    description: 'User ID of the original message sender',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  senderId!: string;
}

