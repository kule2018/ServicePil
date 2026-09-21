/**
 * 当前用户装饰器：从 request 上取 JwtAuthGuard 注入的 req.user
 * 用法：@CurrentUser() user: AuthUser
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
