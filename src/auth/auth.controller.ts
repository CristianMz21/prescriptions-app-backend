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
  UseInterceptors,
  ClassSerializerInterceptor,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { UserEntity } from '../users/entities/user.entity';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string; user: Omit<JwtPayload, 'passwordHash'> }> {
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
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    response.cookie('refreshToken', authResult.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      message: 'Login successful',
      user: authResult.user,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
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
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
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
  logout(@Res({ passthrough: true }) response: Response): { message: string } {
    response.clearCookie('accessToken');
    response.clearCookie('refreshToken', { path: '/auth/refresh' });
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  @Get('profile')
  async getProfile(@CurrentUser() user: JwtPayload): Promise<UserEntity> {
    return this.usersService.findById(user.id);
  }
}
