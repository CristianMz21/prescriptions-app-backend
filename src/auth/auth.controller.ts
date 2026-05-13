import { Controller, Post, Get, Body, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
// Mock import for DTO. In reality, class-validator decorators would be used here.
import { LoginDto } from './dto/login.dto'; 

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticates a user and securely attaches tokens via HTTP-Only cookies.
   */
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    // 1. Validate user credentials
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Generate Tokens
    const authResult = await this.authService.login(user);

    // 3. Set secure cookies
    const isProduction = process.env.NODE_ENV === 'production';

    // Access Token Cookie
    response.cookie('accessToken', authResult.accessToken, {
      httpOnly: true,            // Prevents JS access (mitigates XSS)
      secure: isProduction,      // HTTPS only in production
      sameSite: 'strict',        // Mitigates CSRF
      maxAge: 15 * 60 * 1000,    // 15 minutes
    });

    // Refresh Token Cookie
    response.cookie('refreshToken', authResult.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth/refresh',     // Security: Only send this cookie to the refresh endpoint
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return successful response without the tokens in the body
    return {
      message: 'Login successful',
      user: authResult.user,
    };
  }

  /**
   * Retrieves the profile of the currently authenticated user.
   * The endpoint is protected by the JwtAuthGuard.
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    // The user object is injected directly from the request, 
    // having been validated and mapped by the JwtStrategy.
    return user;
  }
}
