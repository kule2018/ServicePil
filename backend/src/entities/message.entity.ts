/**
 * 消息实体，对应 message 表
 * 对话中的单条消息，发送方可以是用户(user)、AI(ai) 或坐席(agent)
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { SenderType } from './enums';
import { Conversation } from './conversation.entity';

@Entity({ name: 'message' })
export class Message extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 外键列：所属对话 ID */
  @Column({ name: 'conversation_id', type: 'varchar', length: 36 })
  conversationId: string;

  /** 所属对话（多对一，级联删除） */
  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  /** 发送方类型：user / ai / agent */
  @Column({ type: 'enum', enum: SenderType })
  senderType: SenderType;

  /** 发送方 ID（用户或坐席 ID；AI 发送时为空） */
  @Column({ name: 'sender_id', type: 'varchar', length: 36, nullable: true })
  senderId?: string | null;

  /** 消息内容 */
  @Column({ type: 'text' })
  content: string;
}
