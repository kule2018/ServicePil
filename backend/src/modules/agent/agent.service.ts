/**
 * Agent 编排服务 agent.service.ts
 * 核心工作流（对应教程「07-AI-Agent 工作流设计」）：
 *
 *   classify(意图识别) → retrieve(知识召回) → decide(工具决策)
 *     ├─ 退款诉求 + 有关联工单 → 工具 create_refund_request → HITL 挂起
 *     ├─ 无知识命中 / 投诉 / 低置信 / 草稿低分 → 工具 escalate_ticket 转人工
 *     └─ 其余 → draft(生成草稿) → review(质量评审) → 通过则直接回复
 *
 * 每次执行写入 agent_trace（含节点链 / 工具调用 / Token / 耗时），
 * 工单级执行额外写 ai_processing_log 供效果分析。
 */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Ticket } from '../../entities/ticket.entity';
import { AiProcessingLog } from '../../entities/ai-processing-log.entity';
import { AgentTrace } from '../../entities/agent-trace.entity';
import { KnowledgeItem } from '../../entities/knowledge-item.entity';
import { TicketIntent, TicketStatus, SenderType } from '../../entities/enums';
import { LLM_PROVIDER } from '../../ai/llm/llm.interface';
import type { LlmProvider } from '../../ai/llm/llm.interface';
import { RagService, RagSnippet } from '../rag/rag.service';
import { ToolsService } from '../tools/tools.service';
import { TicketsService } from '../tickets/tickets.service';
import { RefundKeywordService } from '../hitl/refund-keyword.service';

/** 工作流状态（LangGraph State 风格的轻量实现） */
interface WorkflowState {
  query: string;
  ticketId?: string | null;
  threadId: string;
  actor: { userId: string; role: string };
  nodes: string[];
  toolCalls: Array<{ name: string; args: Record<string, any>; result?: string }>;
  references: string[];
  tokenUsage: number;
  escalated: boolean;
  intent?: TicketIntent;
  confidence?: number;
  reply?: string | null;
  pending?: { id: string; targetType: string; status: string } | null;
  hitFaq?: KnowledgeItem | null;
}

/** 对外响应结构 */
export interface AgentChatResult {
  reply: string | null;
  escalated: boolean;
  pending?: WorkflowState['pending'];
  references: string[];
  intent?: string;
  confidence?: number;
  traceId: string;
  nodes: string[];
  toolCalls: WorkflowState['toolCalls'];
}

/** 退款/赔付等高风险的触发词已从硬编码抽离为数据库可配置数据（refund_keyword 表），
 *  由 RefundKeywordService.getEnabledKeywords() 在运行时读取，并在「人工确认」页面维护。 */
/** 质量评审通过阈值 */
const REVIEW_PASS_SCORE = 70;
/** 意图识别低置信阈值：低于该值直接转人工，避免误答 */
const CONFIDENCE_ESCALATE = 0.55;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(AiProcessingLog) private readonly logRepo: Repository<AiProcessingLog>,
    @InjectRepository(AgentTrace) private readonly traceRepo: Repository<AgentTrace>,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly ragService: RagService,
    private readonly toolsService: ToolsService,
    private readonly ticketsService: TicketsService,
    private readonly config: ConfigService,
    private readonly refundKeywordService: RefundKeywordService,
  ) {}

  // ============ 对外入口 ============

  /**
   * 知识库独立问答（不落库，无工单上下文）
   */
  async standaloneChat(content: string, actor: AuthActor): Promise<AgentChatResult> {
    return this.runWorkflow(content, null, actor);
  }

  /**
   * 工单上下文问答：先把用户消息追加到时间线，再让 AI 处理
   */
  async chatOnTicket(ticketId: string, content: string, actor: AuthActor): Promise<AgentChatResult> {
    await this.ticketsService.addMessage(ticketId, actor as any, { content });
    return this.runWorkflow(content, ticketId, actor);
  }

  /**
   * 对存量工单执行「AI 一次处理」（列表页 / 详情页按钮触发）
   */
  async processTicket(ticketId: string, actor: AuthActor): Promise<AgentChatResult> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: { createdBy: true } });
    if (!ticket) throw new Error('工单不存在');
    if ([TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status)) {
      return {
        reply: null,
        escalated: false,
        references: [],
        intent: ticket.intent,
        traceId: '',
        nodes: ['skip'],
        toolCalls: [],
        pending: null,
      };
    }
    const query = `${ticket.title}\n${ticket.content}`;
    return this.runWorkflow(query, ticketId, actor);
  }

  // ============ 工作流核心 ============

  private async runWorkflow(query: string, ticketId: string | null, actor: AuthActor): Promise<AgentChatResult> {
    const startedAt = Date.now();
    const state: WorkflowState = {
      query,
      ticketId,
      threadId: ticketId ?? `chat_${randomUUID().slice(0, 8)}`,
      actor,
      nodes: [],
      toolCalls: [],
      references: [],
      tokenUsage: 0,
      escalated: false,
      pending: null,
    };

    try {
      // ---- 节点 1：意图识别 ----
      await this.stepClassify(state);

      // ---- 节点 2：知识检索（FAQ + 文档混合） ----
      const retrieval = await this.ragService.hybridSearch(query, 5);
      state.nodes.push('retrieve');
      state.hitFaq = retrieval.hitFaq ?? null;
      state.references = retrieval.snippets.map((s) => this.shorten(s));
      state.tokenUsage += Math.ceil(query.length / 2);

      // ---- 节点 3：决策 ----
      const refundRequested = await this.isRefundRequest(query);
      if (refundRequested && ticketId) {
        // 高风险写操作 → 工具 → HITL 挂起人工确认
        await this.stepRefundTool(state);
      } else if (this.shouldEscalate(state, retrieval.snippets)) {
        // 低置信 / 无知识 / 投诉 / 高优先级 → 转人工
        await this.stepEscalate(state);
      } else {
        // 草稿 + 评审
        const passed = await this.stepDraftAndReview(state);
        if (!passed) await this.stepEscalate(state);
      }

      // 工单级：记录 AI 处理日志
      if (ticketId) await this.writeAiLog(ticketId, state);

      // ---- 节点 X：落 Trace ----
      const trace = await this.writeTrace(state, startedAt);
      return this.toResult(state, trace.id);
    } catch (err: any) {
      this.logger.error(`Agent 工作流异常: ${err?.stack ?? err}`);
      // 异常也转人工兜底，保证工单不被 AI 卡死
      state.escalated = true;
      if (ticketId) {
        await this.ticketRepo.update(ticketId, { status: TicketStatus.ESCALATED });
      }
      const trace = await this.writeTrace(state, startedAt, false, err?.message ?? 'unknown');
      return this.toResult(state, trace.id);
    }
  }

  // ---------- 各步骤实现 ----------

  private async stepClassify(state: WorkflowState) {
    const result = await this.llm.chat(
      [
        {
          role: 'system',
          content:
            '(intent 意图识别) 你是工单意图分类器。' +
            '请判断用户诉求属于哪类：billing(费用/退款)、technical(产品技术)、account(账号)、complaint(投诉)、other(其他)。' +
            '只输出 JSON，格式：{"intent":"technical","confidence":0.90}',
        },
        { role: 'user', content: state.query },
      ],
      { temperature: 0 },
    );
    state.tokenUsage += this.totalTokens(result.usage);
    const parsed = this.parseJson<{ intent?: string; confidence?: number }>(result.content);
    const intent = (parsed?.intent ?? 'other') as TicketIntent;
    state.intent = Object.values(TicketIntent).includes(intent) ? intent : TicketIntent.OTHER;
    state.confidence = Math.max(0, Math.min(1, Number(parsed?.confidence ?? 0.6)));
    state.nodes.push('classify');

    // 工单已进入 AI 处理状态
    if (state.ticketId) {
      await this.ticketRepo.update(state.ticketId, {
        intent: state.intent,
        aiConfidence: state.confidence,
        status: TicketStatus.AI_HANDLING,
      });
    }
  }

  private async stepRefundTool(state: WorkflowState) {
    state.nodes.push('tool_call');
    const toolResult = await this.toolsService.executeTool(
      'create_refund_request',
      { ticketId: state.ticketId, reason: state.query.slice(0, 200) },
      { actorUserId: state.actor.userId, actorRole: state.actor.role },
    );
    state.toolCalls.push({
      name: 'create_refund_request',
      args: { ticketId: state.ticketId },
      result: toolResult.message,
    });

    if (toolResult.ok && toolResult.data?.pendingId) {
      state.escalated = true; // 需要人工确认资金动作
      state.pending = {
        id: String(toolResult.data.pendingId),
        targetType: 'refund',
        status: 'pending',
      };
      // 告知用户已提交、等待人工审核
      state.reply =
        '您好，您的问题涉及退款/赔付。根据规则，资金类操作需由人工审核确认后执行。' +
        '我已为您提交退款审核申请，坐席确认后会在 1-3 个工作日内原路退回，请您耐心等待。';
      await this.postAiMessage(state, state.reply);
    } else {
      // 工具失败降级为转人工
      await this.stepEscalate(state);
    }
  }

  private async stepEscalate(state: WorkflowState) {
    state.escalated = true;

    // 独立问答（无工单上下文）：没有可升级的工单，只给出引导建议，绝不调用工具
    if (!state.ticketId) {
      state.reply =
        '抱歉，关于这个问题我暂时无法给出可靠的答复。' +
        '建议您补充更具体的描述，或提交一张工单，由人工坐席为您跟进处理。';
      if (state.references.length > 0) {
        state.reply +=
          '\n\n我检索到以下可能相关的资料，供您参考：\n' +
          state.references.map((r, i) => `${i + 1}. ${r}`).join('\n');
      }
      return;
    }

    state.nodes.push('tool_call');
    const toolResult = await this.toolsService.executeTool(
      'escalate_ticket',
      { ticketId: state.ticketId, reason: this.escalateReason(state) },
      { actorUserId: state.actor.userId, actorRole: state.actor.role },
    );
    state.toolCalls.push({ name: 'escalate_ticket', args: { ticketId: state.ticketId }, result: toolResult.message });

    // 转人工也要给出明确回复，保证调用方（前端对话/工单详情）有内容可展示
    state.reply =
      '您好，为了给您更准确的帮助，我已将您的工单转交人工坐席处理。' +
      '坐席会尽快联系您，请留意工单进展通知。';
    await this.postAiMessage(state, state.reply);
  }

  /** 生成草稿并评审；通过返回 true 并发送回复 */
  private async stepDraftAndReview(state: WorkflowState): Promise<boolean> {
    const context = state.references.map((r, i) => `[${i + 1}] ${r}`).join('\n');

    // 生成草稿（system 携带检索资料 → 接地气的回复）
    const draftRes = await this.llm.chat(
      [
        {
          role: 'system',
          content:
            '你是 ServicePilot 智能客服（knowledge grounded answer）。' +
            '请基于以下从知识库检索到的资料片段作答，语气礼貌简洁。' +
            '若资料不覆盖问题，请明确说明需要转人工，不要编造政策。\n\n资料片段：\n' + context,
        },
        { role: 'user', content: state.query },
      ],
      { temperature: 0.3 },
    );
    state.tokenUsage += this.totalTokens(draftRes.usage);
    const draft = draftRes.content.trim();
    state.nodes.push('draft');

    // 质量评审
    const reviewRes = await this.llm.chat(
      [
        { role: 'system', content: `待评审的客服回复草稿：\n${draft}` },
        { role: 'user', content: '请对以上草稿进行质量评分（0-100），只输出 JSON：{"score":80}' },
      ],
      { temperature: 0 },
    );
    state.tokenUsage += this.totalTokens(reviewRes.usage);
    const score = Number(this.parseJson<{ score?: number }>(reviewRes.content)?.score ?? 0);
    state.nodes.push('review');

    if (score < REVIEW_PASS_SCORE || !draft) {
      this.logger.log(`草稿评审未通过(score=${score})，转人工`);
      return false;
    }

    state.reply = draft;
    await this.postAiMessage(state, draft);
    // AI 已成功解决：工单完结（若命中 FAQ 属于可自动答复场景）
    if (state.ticketId) {
      await this.ticketRepo.update(state.ticketId, { status: TicketStatus.RESOLVED });
    }
    return true;
  }

  // ---------- 落库辅助 ----------

  private async postAiMessage(state: WorkflowState, content: string) {
    if (!state.ticketId) return;
    await this.ticketsService.appendSystemMessage(state.ticketId, SenderType.AI, content);
  }

  /** 写 ai_processing_log（工单级） */
  private async writeAiLog(ticketId: string, state: WorkflowState) {
    const entry = this.logRepo.create({
      ticketId,
      intent: state.intent ?? TicketIntent.OTHER,
      confidence: state.confidence ?? 0,
      escalated: state.escalated,
    });
    if (state.hitFaq) entry.knowledgeItem = state.hitFaq;
    await this.logRepo.save(entry);
  }

  /** 写 agent_trace */
  private async writeTrace(state: WorkflowState, startedAt: number, success = true, error?: string): Promise<AgentTrace> {
    const trace = this.traceRepo.create({
      ticketId: state.ticketId ?? null,
      threadId: state.threadId,
      query: state.query.slice(0, 2000),
      intent: state.intent ?? null,
      nodes: state.nodes,
      references: state.references,
      toolCalls: state.toolCalls,
      escalated: state.escalated,
      llmModel: this.llm.model,
      tokenUsage: Math.round(state.tokenUsage) || null,
      latencyMs: Date.now() - startedAt,
      success,
      error: error ?? null,
    });
    return this.traceRepo.save(trace);
  }

  private toResult(state: WorkflowState, traceId: string): AgentChatResult {
    return {
      reply: state.reply,
      escalated: state.escalated,
      pending: state.pending,
      references: state.references,
      intent: state.intent,
      confidence: state.confidence,
      traceId,
      nodes: state.nodes,
      toolCalls: state.toolCalls,
    };
  }

  // ---------- 规则辅助 ----------

  private async isRefundRequest(query: string): Promise<boolean> {
    const keywords = await this.refundKeywordService.getEnabledKeywords();
    if (keywords.length === 0) return false;
    return keywords.some((k) => query.includes(k));
  }

  private shouldEscalate(state: WorkflowState, snippets: RagSnippet[]): boolean {
    if (!state.ticketId) return false; // 独立问答不转人工，只回答不确定信息
    // 低置信 → 转人工
    if ((state.confidence ?? 0) < CONFIDENCE_ESCALATE) return true;
    // 投诉类 → 转人工
    if (state.intent === TicketIntent.COMPLAINT) return true;
    // 无任何知识命中 → 转人工
    if (snippets.length === 0 && !state.hitFaq) return true;
    return false;
  }

  private escalateReason(state: WorkflowState): string {
    if ((state.confidence ?? 0) < CONFIDENCE_ESCALATE) {
      return `AI 置信度过低(${state.confidence})，需人工介入`;
    }
    if (state.intent === TicketIntent.COMPLAINT) return '投诉类工单，按规则转人工坐席';
    if (state.references.length === 0) return '知识库未命中，AI 无法给出可靠答复';
    return 'AI 草稿未通过质量评审';
  }

  private shorten(s: RagSnippet): string {
    const head = s.text.length > 200 ? `${s.text.slice(0, 200)}…` : s.text;
    return s.docTitle ? `【${s.docTitle}】${head}` : head;
  }

  /** 安全解析 LLM 返回 JSON（容忍 ```json 围栏与前后缀文本） */
  private parseJson<T>(content: string): T | null {
    if (!content) return null;
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }

  private totalTokens(usage?: { totalTokens?: number }): number {
    return usage?.totalTokens ?? 0;
  }
}

/** Agent 场景的轻量 actor 描述 */
export interface AuthActor {
  userId: string;
  role: string;
}
