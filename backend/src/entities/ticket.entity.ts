/**
 * 工单实体，对应 ticket 表（项目核心业务对象）
 * 关系：提交用户(多对一)、分配坐席(多对一)、对话(一对多)、AI 日志(一对多)
 */
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { TicketPriority, TicketStatus, TicketIntent } from './enums';
import { User } from './user.entity';
import { Conversation } from './conversation.entity';
import { AiProcessingLog } from './ai-processing-log.entity';

@Entity({ name: 'ticket' })
export class Ticket extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 标题 */
  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** 正文（用户原始描述） */
  @Column({ type: 'text' })
  content: string;

  /** 优先级，默认 medium */
  @Column({ type: 'enum', enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority: TicketPriority;

  /** 当前状态，默认 open */
  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.OPEN })
  status: TicketStatus;

  /** AI 识别意图，默认 other */
  @Column({ type: 'enum', enum: TicketIntent, default: TicketIntent.OTHER })
  intent: TicketIntent;

  /** AI 置信度 0~1，未经过 AI 处理时为空 */
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, transformer: {
    to: (v?: number | null) => (v == null ? v : Number(v)),
    from: (v?: string | null) => (v == null ? v : Number(v)),
  } })
  aiConfidence?: number | null;

  /** 提交用户（多对一） */
  @ManyToOne(() => User, (user) => user.tickets, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  /** 分配坐席（多对一，可空） */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo?: User | null;

  /** 该工单下的对话 */
  @OneToMany(() => Conversation, (c) => c.ticket)
  conversations: Conversation[];

  /** 该工单的 AI 处理日志 */
  @OneToMany(() => AiProcessingLog, (log) => log.ticket)
  aiLogs: AiProcessingLog[];
}
