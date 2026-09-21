/**
 * 角色装饰器：声明接口所需角色，配合 RolesGuard 使用
 * 用法：@Roles(UserRole.ADMIN, UserRole.AGENT)
 */
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../entities/enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
