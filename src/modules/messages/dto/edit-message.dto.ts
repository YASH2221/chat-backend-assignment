import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class EditMessageDto {
  @ApiProperty({
    description: 'User ID of the original message sender',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  senderId!: string;

  @ApiProperty({
    description: 'Updated message text',
    example: 'Hey Bob, updated message text!',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;
}

