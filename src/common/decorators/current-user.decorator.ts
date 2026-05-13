import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorador para extraer el usuario autenticado del request.
 *
 * Uso:
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: any) {
 *   // user = { id, email, role }
 * }
 * ```
 *
 * @note
 * - Depende de que JwtAuthGuard haya validado el JWT y adjuntado el usuario a req.user
 * - El tipo de retorno es `any` porque varies según cómo se configure JwtStrategy.validate()
 * - Para tipado fuerte, crear una interfaz UserPayload y usar esa
 *
 * @example
 * // Con destructuring (más limpio para endpoints que solo necesitan el ID)
 * @Patch(':id/consume')
 * markAsConsumed(@CurrentUser() user: { id: string }, @Param('id') prescriptionId: string) {
 *   return this.prescriptionsService.markAsConsumed(user.id, prescriptionId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);