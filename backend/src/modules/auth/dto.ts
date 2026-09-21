/**
 * 认证模块 DTO：注册 / 登录
 */
import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';

/** 注册请求体 */
export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: '姓名不能为空' })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(50)
  @Matches(/^\S+$/, { message: '密码不能包含空白字符' })
  password: string;
}

/** 登录请求体 */
export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}
