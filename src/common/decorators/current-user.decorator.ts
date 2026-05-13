import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator to extract the authenticated user's payload from the request object.
 * This assumes the JwtAuthGuard has already validated the token and attached the user to req.user.
 * 
 * Usage example:
 * getProfile(@CurrentUser() user: any) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
