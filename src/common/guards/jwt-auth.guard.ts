/* Copyright (c) 2026. All rights reserved. */
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = JwtPayload>(
    err: Error | null,
    user: TUser | false | null,
  ): TUser {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException('Authentication token is missing or invalid')
      );
    }
    return user;
  }
}
