/**
 * 认证服务 auth.service.ts
 * 注册（默认 end_user）/ 登录签发 JWT / 解析当前用户
 */
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/enums';
import { RegisterDto, LoginDto } from './dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  /** 注册：默认注册为终端用户 */
  async register(dto: RegisterDto) {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) {
      throw new ConflictException('该邮箱已被注册');
    }
    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.save(
      this.userRepo.create({
        name: dto.name,
        email: dto.email,
        password: hash,
        role: UserRole.END_USER,
      }),
    );
    return this.buildAuthResult(user);
  }

  /** 登录：校验邮箱 + 密码，签发 JWT */
  async login(dto: LoginDto) {
    const user = await this.findByEmailWithPassword(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    return this.buildAuthResult(user);
  }

  /** 组装 { token, user }（剥掉 password） */
  private async buildAuthResult(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const token = await this.jwtService.signAsync(payload);
    const { password: _pw, ...safe } = user;
    void _pw;
    return { token, user: safe };
  }

  /** 密码列 select:false，查询时必须 addSelect 才能取回哈希 */
  private async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }
}
