/**
 * 待人工确认实体，对应 pending_confirm 表
 * Human-in-the-loop：AI 触发的写操作（回复/改状态/退款等）先落此表挂起，
 * 由坐席/管理员在前端确认或驳回后才真正执行
 */
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

/** 待确认对象类型 */
export enum PendingConfirmType {
  REPLY = 'reply',                 // AI 生成的客服回复待确认
  REFUND = 'refund',               // 退款/赔付（高风险写操作）
  STATUS_CHANGE = 'status_change', // 工单状态变更
}

/** 待确认状态 */
export enum PendingConfirmStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity({ name: 'pending_confirm' })
export class PendingConfirm extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 关联工单 ID */
  @Column({ name: 'ticket_id', type: 'varchar', length: 36, nullable: true })
  ticketId?: string | null;

  /** 确认对象类型 */
  @Column({ name: 'target_type', type: 'enum', enum: PendingConfirmType })
  targetType: PendingConfirmType;

  /** 载荷：JSON 快照，包含待执行动作的全部参数（草稿回复/退款金额等） */
  @Column({ type: 'json' })
  payload: Record<string, any>;

  /** 风险原因（触发人工确认的原因） */
  @Column({ type: 'varchar', length: 500, nullable: true })
  reason?: string | null;

  /** 状态：pending / approved / rejected */
  @Column({ type: 'enum', enum: PendingConfirmStatus, default: PendingConfirmStatus.PENDING })
  status: PendingConfirmStatus;

  /** 处理人 ID（确认/驳回的坐席或管理员） */
  @Column({ name: 'handler_id', type: 'varchar', length: 36, nullable: true })
  handlerId?: string | null;

  /** 处理备注 */
  @Column({ name: 'handler_note', type: 'varchar', length: 500, nullable: true })
  handlerNote?: string | null;

  /** 处理时间 */
  @Column({ name: 'decided_at', type: 'datetime', nullable: true })
  decidedAt?: Date | null;
}
