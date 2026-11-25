import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MarkReadDto {
  @ApiProperty({
    description: 'User ID marking the message as read',
    example: '22222222-2222-4222-8222-222222222222',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  userId!: string;
}
