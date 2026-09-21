/**
 * 基础实体：所有业务表共用的审计字段
 * 通过继承复用 created_at / updated_at / deleted_at（软删除）
 */
import { CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

export abstract class BaseEntity {
  /** 创建时间，插入时自动写入 */
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  /** 更新时间，每次更新自动刷新 */
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  /** 软删除时间，为空表示未删除；softRemove/softDelete 会写入此列 */
  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt?: Date;
}
