/**
 * JWT 认证守卫
 * 复用 passport-jwt 策略；未带有效 Token 时自动返回 401
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
