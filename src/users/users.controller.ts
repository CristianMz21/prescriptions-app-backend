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
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiParam,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto';
import { PaginationMetaDto } from '../common/dto/pagination-meta.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

@ApiTags('Users')
@ApiCookieAuth('accessToken')
@ApiExtraModels(PaginatedResultDto, PaginationMetaDto, UserEntity)
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new user (Admin Only)' })
  @ApiCreatedResponse({
    type: UserResponseDto,
    description: 'User created successfully',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Bad Request — validation failed',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Unauthorized — valid access token required',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Forbidden — Admin role required',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Conflict — user with this email already exists',
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all users (Admin Only)' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResultDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(UserEntity) },
            },
            meta: { $ref: getSchemaPath(PaginationMetaDto) },
          },
        },
      ],
    },
    description: 'Returns paginated list of all users',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Unauthorized — valid access token required',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Forbidden — Admin role required',
  })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('patients')
  @Roles(Role.ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'List all patients (Admin/Doctor Only)' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResultDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(UserEntity) },
            },
            meta: { $ref: getSchemaPath(PaginationMetaDto) },
          },
        },
      ],
    },
    description: 'Returns paginated list of all patients',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Unauthorized — valid access token required',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Forbidden — Admin or Doctor role required',
  })
  findAllPatients() {
    return this.usersService.findAllByRole(Role.PATIENT);
  }

  @Get('doctors')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all doctors (Admin Only)' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResultDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(UserEntity) },
            },
            meta: { $ref: getSchemaPath(PaginationMetaDto) },
          },
        },
      ],
    },
    description: 'Returns paginated list of all doctors',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Unauthorized — valid access token required',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Forbidden — Admin role required',
  })
  findAllDoctors() {
    return this.usersService.findAllByRole(Role.DOCTOR);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Get user detail by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'User ID (UUID v4)' })
  @ApiOkResponse({
    type: UserResponseDto,
    description: 'Returns the user details',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Unauthorized — valid access token required',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Forbidden — Admin or Doctor role required',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Not Found — user not found',
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
