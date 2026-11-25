import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import type { User } from './entities/user.entity';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user in PostgreSQL' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  createUser(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.createUser(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all users from PostgreSQL' })
  listUsers(): Promise<User[]> {
    return this.usersService.listUsers();
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get a single user by ID' })
  getUser(@Param('userId') userId: string): Promise<User> {
    return this.usersService.getUserById(userId);
  }
}
