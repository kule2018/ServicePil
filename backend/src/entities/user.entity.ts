/**
 * 用户实体，对应 user 表
 * 终端用户(end_user) 与 坐席(agent)/管理员(admin) 共用本表，以 role 区分
 * 登录标识使用 email；password 仅存 bcrypt 哈希
 */
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserRole } from './enums';
import { Ticket } from './ticket.entity';

@Entity({ name: 'user' })
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 姓名 */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** 邮箱，唯一约束，用于登录标识 */
  @Column({ type: 'varchar', length: 180, unique: true })
  email: string;

  /** 密码哈希（bcrypt），禁止明文 */
  @Column({ type: 'varchar', length: 100, select: false })
  password: string;

  /** 角色，默认终端用户 */
  @Column({ type: 'enum', enum: UserRole, default: UserRole.END_USER })
  role: UserRole;

  /** 该用户提交的工单 */
  @OneToMany(() => Ticket, (ticket) => ticket.createdBy)
  tickets: Ticket[];
}
