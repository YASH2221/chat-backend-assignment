import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateGroupChatDto {
  @ApiProperty({ example: 'Backend Engineering' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: 'User ID of the group creator (assigned admin role)',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  creatorId!: string;

  @ApiProperty({
    description: 'Participant user IDs to include in the group',
    type: [String],
    example: ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(128, { each: true })
  memberIds!: string[];
}

