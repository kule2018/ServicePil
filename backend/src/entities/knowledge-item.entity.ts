/**
 * 知识库条目实体，对应 knowledge_item 表
 * FAQ 场景的「问题-答案」结构，AI 自动回复时检索的答案来源
 */
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TicketIntent } from './enums';

@Entity({ name: 'knowledge_item' })
export class KnowledgeItem extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 适用意图分类，用于检索路由 */
  @Column({ type: 'enum', enum: TicketIntent })
  intent: TicketIntent;

  /** 问题 / 标题，便于模糊匹配 */
  @Column({ type: 'varchar', length: 300 })
  question: string;

  /** 标准答案文本 */
  @Column({ type: 'text' })
  answer: string;
}
