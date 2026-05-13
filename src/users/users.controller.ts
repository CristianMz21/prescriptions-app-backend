import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('Users')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('patients')
  @Roles(Role.ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'List all patients (Admin/Doctor Only)' })
  @ApiResponse({ status: 200, description: 'Returns a list of all patients.' })
  findAllPatients() {
    return this.usersService.findAllByRole(Role.PATIENT);
  }

  @Get('doctors')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all doctors (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Returns a list of all doctors.' })
  findAllDoctors() {
    return this.usersService.findAllByRole(Role.DOCTOR);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Get user detail by ID' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'User ID (UUID v4).',
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
