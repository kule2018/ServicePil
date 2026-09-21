/**
 * JWT 策略 jwt.strategy.ts
 * 从 Authorization: Bearer <token> 中解析并校验令牌，
 * 成功后把 { userId, email, name, role } 挂到 request.user
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? 'servicepilot-dev-secret-change-me',
    });
  }

  /** 校验通过后返回的值会被 Nest 注入到 request.user */
  async validate(payload: JwtPayload) {
    // 每次请求回表确认用户仍存在（未被删除/禁用）
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }
    return { userId: user.id, email: user.email, name: user.name, role: user.role };
  }
}
