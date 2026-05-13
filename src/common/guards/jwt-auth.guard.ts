import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que enforcing autenticación JWT.
 *
 * Flujo:
 * 1. El request llega con el cookie 'accessToken' (o sin él)
 * 2. JwtAuthGuard usa Passport con la estrategia 'jwt' (JwtStrategy)
 * 3. JwtStrategy extrae y valida el JWT del cookie
 * 4. Si válido → req.user = { id, email, role }
 * 5. Si inválido/expirado → handleRequest lanza UnauthorizedException
 *
 * @security
 * - Si no hay token o está corrupto → 401 (no autenticado)
 * - No es necesario verificar roles aquí (RolesGuard lo hace después si aplica)
 *
 * @note Extiende AuthGuard('jwt') que internamente:
 *       - Extrae el JWT via jwtFromRequest configurado en JwtStrategy
 *       - Verifica firma con secretOrKey
 *       - Verifica expiración (ignoreExpiration: false)
 *       - Llama validate() y adjunta resultado a req.user
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Hook llamado antes de delegar a Passport.
   * Se puede agregar lógica custom antes de validar el token.
   *
   * @param context - Contexto de ejecución de NestJS
   * @returns true si se permite continuar, o delegar a super (que valida JWT)
   */
  canActivate(context: ExecutionContext) {
    // Lógica custom adicional podría ir aquí (e.g., verificar IP, device fingerprint)
    return super.canActivate(context);
  }

  /**
   * Maneja el resultado de la validación JWT.
   *
   * @param err - Error de Passport (null si todo bien)
   * @param user - Usuario devuelto por JwtStrategy.validate() (null si falló)
   * @param info - Información adicional de Passport (e.g., "jwt expired")
   *
   * @throws UnauthorizedException si:
   *       - err no es null (error técnico)
   *       - user es null/falsy (JWT inválido, expirado, o malformado)
   *
   * @note El mensaje unificado "Authentication token is missing or invalid" evita
   *       filtrar información sobre si el error fue por token faltante vs expirado.
   */
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication token is missing or invalid');
    }
    return user;
  }
}