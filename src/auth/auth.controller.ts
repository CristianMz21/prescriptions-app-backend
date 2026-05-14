/* Copyright (c) 2026. All rights reserved. */
import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  UnauthorizedException,
  Req,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { parseDurationToSeconds } from '../common/utils/duration.utils';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('Auth')
@ApiCookieAuth('accessToken')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly accessCookieMaxAge: number;
  private readonly refreshCookieMaxAge: number;

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    const accessTtl = this.configService.getOrThrow<string>('JWT_ACCESS_TTL');
    const refreshTtl = this.configService.getOrThrow<string>('JWT_REFRESH_TTL');
    this.accessCookieMaxAge = parseDurationToSeconds(accessTtl) * 1000;
    this.refreshCookieMaxAge = parseDurationToSeconds(refreshTtl) * 1000;
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate user and obtain access tokens' })
  @ApiCreatedResponse({
    type: LoginResponseDto,
    description: 'Login successful — access tokens set in cookies',
  })
  @ApiStandardErrors({
    400: 'Bad Request — validation failed or invalid credentials',
    401: 'Unauthorized — invalid email or password',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authResult = await this.authService.login(user);
    const isProduction =
      this.configService.getOrThrow<string>('NODE_ENV') === 'production';

    response.cookie('accessToken', authResult.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: this.accessCookieMaxAge,
    });

    response.cookie('refreshToken', authResult.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: this.refreshCookieMaxAge,
    });

    return {
      message: 'Login successful',
      user: authResult.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiOkResponse({
    type: RefreshResponseDto,
    description: 'Token refreshed — new access token set in cookie',
  })
  @ApiStandardErrors({
    401: 'Unauthorized — refresh token missing or invalid',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    const cookies = request.cookies as Record<string, string | undefined>;
    const refreshToken = cookies.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    try {
      const authResult = await this.authService.refresh(refreshToken);
      const isProduction =
        this.configService.getOrThrow<string>('NODE_ENV') === 'production';

      response.cookie('accessToken', authResult.accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: this.accessCookieMaxAge,
      });

      return { message: 'Token refreshed' };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Token refresh failed: ${error.message}`);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and clear access/refresh token cookies' })
  @ApiOkResponse({
    type: LogoutResponseDto,
    description: 'Logout successful — cookies cleared',
  })
  @ApiStandardErrors({ 401: true })
  logout(@Res({ passthrough: true }) response: Response): LogoutResponseDto {
    response.clearCookie('accessToken');
    response.clearCookie('refreshToken', { path: '/auth/refresh' });
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiOkResponse({
    type: UserProfileResponseDto,
    description: 'Returns the authenticated user profile',
  })
  @ApiStandardErrors({ 401: true })
  async getProfile(
    @CurrentUser() user: JwtPayload,
  ): Promise<UserProfileResponseDto> {
    const entity = await this.usersService.findById(user.id);
    return new UserProfileResponseDto(entity);
  }
}
