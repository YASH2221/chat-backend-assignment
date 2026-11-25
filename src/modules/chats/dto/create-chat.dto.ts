import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateChatDto {
  @ApiProperty({
    description: 'First participant user ID',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  userAId!: string;

  @ApiProperty({
    description: 'Second participant user ID',
    example: '22222222-2222-4222-8222-222222222222',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  userBId!: string;
}
