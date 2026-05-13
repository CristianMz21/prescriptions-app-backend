/* Copyright (c) 2026. All rights reserved. */
import { Controller, Post, Get, Body, Res, UseGuards, UnauthorizedException, Req, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { UserEntity } from '../users/entities/user.entity';

interface RequestUser {
  id: string;
  email: string;
  role: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response): Promise<{ message: string; user: Omit<RequestUser, 'passwordHash'> }> {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authResult = await this.authService.login(user);
    const isProduction = process.env.NODE_ENV === 'production';

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
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ message: string }> {
    const refreshToken = request.cookies['refreshToken'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    try {
      const authResult = await this.authService.refresh(refreshToken);
      const isProduction = process.env.NODE_ENV === 'production';

      response.cookie('accessToken', authResult.accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      return { message: 'Token refreshed' };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Res({ passthrough: true }) response: Response): Promise<{ message: string }> {
    response.clearCookie('accessToken');
    response.clearCookie('refreshToken', { path: '/auth/refresh' });
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  @Get('profile')
  async getProfile(@CurrentUser() user: RequestUser): Promise<UserEntity | null> {
    return this.usersService.findById(user.id);
  }
}
