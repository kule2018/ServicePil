/**
 * 对话实体，对应 conversation 表
 * 表示一个工单下的会话上下文，包含多条消息
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Ticket } from './ticket.entity';
import { Message } from './message.entity';

@Entity({ name: 'conversation' })
export class Conversation extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 外键列：所属工单 ID */
  @Column({ name: 'ticket_id', type: 'varchar', length: 36 })
  ticketId: string;

  /** 所属工单（多对一，级联删除） */
  @ManyToOne(() => Ticket, (t) => t.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  /** 对话内消息 */
  @OneToMany(() => Message, (m) => m.conversation)
  messages: Message[];
}
