/**
 * Agent Trace 实体，对应 agent_trace 表
 * 记录一次 Agent 执行的完整轨迹：Query、意图、节点链、工具调用、
 * Token、Latency、是否命中/转人工，用于效果分析与问题定位
 */
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'agent_trace' })
export class AgentTrace extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 关联工单 ID（可为空，独立问答时为空） */
  @Column({ name: 'ticket_id', type: 'varchar', length: 36, nullable: true })
  ticketId?: string | null;

  /** 会话线程 ID（同一对话的多轮执行共享） */
  @Column({ name: 'thread_id', type: 'varchar', length: 64, nullable: true })
  threadId?: string | null;

  /** 用户输入 */
  @Column({ type: 'text' })
  query: string;

  /** AI 识别意图 */
  @Column({ type: 'varchar', length: 30, nullable: true })
  intent?: string | null;

  /** 执行节点链 JSON，如 ["classify","retrieve","tool_call","draft","review"] */
  @Column({ type: 'json', nullable: true })
  nodes?: string[] | null;

  /** 检索命中的知识片段（前几条摘要） */
  @Column({ type: 'json', nullable: true })
  references?: string[] | null;

  /** 是否发生工具调用及结果摘要 */
  @Column({ type: 'json', nullable: true })
  toolCalls?: Record<string, any>[] | null;

  /** 是否转人工 */
  @Column({ type: 'boolean', default: false })
  escalated: boolean;

  /** 使用的 LLM 模型名 */
  @Column({ name: 'llm_model', type: 'varchar', length: 100, nullable: true })
  llmModel?: string | null;

  /** Token 消耗 */
  @Column({ name: 'token_usage', type: 'int', nullable: true })
  tokenUsage?: number | null;

  /** 执行耗时(ms) */
  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs?: number | null;

  /** 是否成功 */
  @Column({ type: 'boolean', default: true })
  success: boolean;

  /** 失败/异常信息 */
  @Column({ type: 'text', nullable: true })
  error?: string | null;
}
