/* Copyright (c) 2026. All rights reserved. */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { UserEntity } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto';
import { PaginationMetaDto } from '../common/dto/pagination-meta.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { apiPaginatedOkResponse } from '../common/swagger/api-paginated-response.decorator';
import {
  UNAUTHORIZED_DESC,
  FORBIDDEN_ADMIN_DESC,
  FORBIDDEN_ADMIN_OR_DOCTOR_DESC,
} from '../common/swagger/swagger-descriptions';

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
    description: UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: FORBIDDEN_ADMIN_DESC,
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
  @apiPaginatedOkResponse(UserEntity, 'Returns paginated list of all users')
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: FORBIDDEN_ADMIN_DESC,
  })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('patients')
  @Roles(Role.ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'List all patients (Admin/Doctor Only)' })
  @apiPaginatedOkResponse(UserEntity, 'Returns paginated list of all patients')
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: FORBIDDEN_ADMIN_OR_DOCTOR_DESC,
  })
  findAllPatients() {
    return this.usersService.findAllByRole(Role.PATIENT);
  }

  @Get('doctors')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all doctors (Admin Only)' })
  @apiPaginatedOkResponse(UserEntity, 'Returns paginated list of all doctors')
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: FORBIDDEN_ADMIN_DESC,
  })
  findAllDoctors() {
    return this.usersService.findAllByRole(Role.DOCTOR);
  }

  @Patch('me/theme')
  @ApiOperation({
    summary: 'Update the current user UI theme preference',
  })
  @ApiOkResponse({
    type: UserEntity,
    description: 'Theme preference updated; returns the refreshed user profile',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Bad Request — invalid themePreference value',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: UNAUTHORIZED_DESC,
  })
  updateMyTheme(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateThemeDto,
  ): Promise<UserEntity> {
    return this.usersService.updateTheme(user.id, dto.themePreference);
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
    description: UNAUTHORIZED_DESC,
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: FORBIDDEN_ADMIN_OR_DOCTOR_DESC,
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Not Found — user not found',
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
