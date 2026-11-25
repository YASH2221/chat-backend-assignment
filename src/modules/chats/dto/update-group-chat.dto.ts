import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateGroupChatDto {
  @ApiProperty({
    description: 'User ID of a group admin performing the rename',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  actorId!: string;

  @ApiProperty({ example: 'Platform Architecture Team' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

