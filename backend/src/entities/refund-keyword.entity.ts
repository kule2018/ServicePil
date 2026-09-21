/**
 * 退款 / 赔付触发词配置实体，对应 refund_keyword 表
 * 从 agent.service.ts 中硬编码的 REFUND_KEYWORDS 抽离为「可配置数据」，
 * 由坐席 / 管理员在「人工确认」工作台页面动态维护。
 *
 * 命中任一「启用中」触发词的工单诉求，Agent 工作流会创建退款类待确认并挂起人工审核。
 */
import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'refund_keyword' })
@Unique('uk_refund_keyword', ['keyword'])
export class RefundKeyword extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 触发词文本（如 退款 / 全额退 / 退钱 / 赔付 / 赔偿） */
  @Column({ type: 'varchar', length: 50, comment: '触发词' })
  keyword: string;

  /** 是否启用：禁用后不参与匹配（1=启用 0=禁用） */
  @Column({ type: 'boolean', default: true, comment: '1=启用 0=禁用' })
  enabled: boolean;
}
