import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddGroupMembersDto {
  @ApiProperty({
    description: 'User ID of a group admin adding new members',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  actorId!: string;

  @ApiProperty({
    description: 'User IDs to add to the group',
    type: [String],
    example: ['33333333-3333-4333-8333-333333333333'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(128, { each: true })
  userIds!: string[];
}

export class RemoveGroupMemberDto {
  @ApiProperty({
    description: 'User ID performing the action (admin removing member, or member leaving)',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  actorId!: string;
}

