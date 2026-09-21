/**
 * AI 处理日志实体，对应 ai_processing_log 表
 * 记录每次 AI 调用的意图、置信度、命中知识、是否转人工，用于效果分析与 Trace
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TicketIntent } from './enums';
import { Ticket } from './ticket.entity';
import { KnowledgeItem } from './knowledge-item.entity';

@Entity({ name: 'ai_processing_log' })
export class AiProcessingLog extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 外键列：关联工单 ID */
  @Column({ name: 'ticket_id', type: 'varchar', length: 36 })
  ticketId: string;

  /** 关联工单（多对一，级联删除） */
  @ManyToOne(() => Ticket, (t) => t.aiLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  /** AI 识别出的意图 */
  @Column({ type: 'enum', enum: TicketIntent })
  intent: TicketIntent;

  /** 置信度 0~1，保留两位小数 */
  @Column({ type: 'decimal', precision: 3, scale: 2, transformer: {
    to: (v: number) => v,
    from: (v: string) => Number(v),
  } })
  confidence: number;

  /** 命中的 FAQ 知识条目（多对一，可空） */
  @ManyToOne(() => KnowledgeItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'knowledge_item_id' })
  knowledgeItem?: KnowledgeItem | null;

  /** 本次是否最终转人工 */
  @Column({ name: 'escalated', type: 'boolean', default: false })
  escalated: boolean;
}
