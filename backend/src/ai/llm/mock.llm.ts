/**
 * Mock LLM 实现（无 API Key 时的降级方案）
 * 目标：让 ServicePilot 全流程无需外部模型也能跑通，演示 Agent 编排、RAG、HITL 逻辑
 *
 * 能力说明：
 *  1. 意图识别：按关键词规则返回 JSON（billing/technical/account/complaint/other）
 *  2. 客服回复：基于检索到的资料片段做「摘录式」回答，能演示 RAG 检索增强的效果
 *  3. 评审打分：按规则给出质量分（命中资料 + 非空 + 无风险词 => 高分）
 *
 * ⚠️ 生产环境请将 LLM_PROVIDER 设为 openai 并填写网关配置
 */
import { Injectable } from '@nestjs/common';
import { LlmProvider, LlmChatMessage, LlmChatOptions, LlmChatResult } from './llm.interface';

/** 意图关键词规则表 */
const INTENT_KEYWORDS: Array<{ intent: string; words: string[] }> = [
  { intent: 'billing', words: ['账单', '扣费', '收费', '退款', '价格', '费用', '发票', '优惠', '充值'] },
  { intent: 'technical', words: ['安装', '报错', '崩溃', '闪退', '下载', '死机', '黑屏', '无法启动', '卡顿', '升级', '兼容'] },
  { intent: 'account', words: ['登录', '密码', '验证码', '账号', '注册', '无法登录', '锁定', '手机号'] },
  { intent: 'complaint', words: ['投诉', '差评', '态度', '不满意', '赔偿', '道歉', '欺诈'] },
];

/** 抽取「资料片段」里最相关的一句作为事实依据 */
function pickFact(question: string, context: string): string | null {
  const qWords = question.replace(/[，。？！,.?!\s]/g, '');
  const segments = context
    .split(/[\n。；]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let best: string | null = null;
  let bestScore = 0;
  for (const seg of segments) {
    let score = 0;
    // 字符级公共子串粗匹配（对中文短句足够直观）
    for (const c of qWords) {
      if (seg.includes(c)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = seg;
    }
  }
  return bestScore >= 2 ? best : null;
}

@Injectable()
export class MockLlm implements LlmProvider {
  readonly name = 'mock';
  readonly model = 'mock-rule-v1';

  async chat(messages: LlmChatMessage[], options?: LlmChatOptions): Promise<LlmChatResult> {
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    const user = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const full = `${system}\n${user}`;

    // ---------- 场景一：意图识别（要求输出 JSON） ----------
    if (full.includes('意图') || system.includes('intent')) {
      return this.classify(user);
    }

    // ---------- 场景二：质量评审 ----------
    // 注意：必须先于「客服回复生成」判断。评审请求携带的草稿原文常含「资料/客服」等词，
    // 若顺序颠倒会被误判为回复生成，导致评分解不出而恒为 0 —— 所有工单都会被误转人工。
    if (full.includes('评分') || full.includes('质量') || system.includes('待评审')) {
      return this.review(system);
    }

    // ---------- 场景三：客服回复生成 ----------
    if (full.includes('资料') || full.includes('客服') || full.includes('回答')) {
      return this.answer(user, system);
    }

    // 兜底
    return { content: `（Mock）已收到：${user.slice(0, 50)}` };
  }

  /** 意图识别（规则版） */
  private async classify(question: string): Promise<LlmChatResult> {
    let best: { intent: string; confidence: number } | null = null;
    for (const rule of INTENT_KEYWORDS) {
      const hits = rule.words.filter((w) => question.includes(w)).length;
      if (hits === 0) continue;
      const confidence = Math.min(0.95, 0.6 + hits * 0.12);
      if (!best || confidence > best.confidence) {
        best = { intent: rule.intent, confidence: Math.round(confidence * 100) / 100 };
      }
    }
    const result = best ?? { intent: 'other', confidence: 0.4 };
    return { content: JSON.stringify(result), usage: { totalTokens: question.length / 2 } };
  }

  /** 客服回复（基于检索片段做事实摘录） */
  private async answer(question: string, context: string): Promise<LlmChatResult> {
    // 识别用户想要的意图，便于语气
    const classified = await this.classify(question);
    let intent = 'other';
    try {
      const parsed = JSON.parse(classified.content);
      if (parsed && typeof parsed.intent === 'string') intent = parsed.intent;
    } catch {
      /* mock 输出固定为合法 JSON，此处兜底 */
    }
    const intentLabel: Record<string, string> = {
      billing: '费用/退款相关',
      technical: '产品技术',
      account: '账号安全',
      complaint: '投诉建议',
      other: '一般咨询',
    };
    const fact = pickFact(question, context);

    let content: string;
    if (fact) {
      content =
        `您好，已收到您的${intentLabel[intent] ?? '咨询'}问题。` +
        `根据我们的知识库资料：${fact}。` +
        (question.includes('退款') || question.includes('赔付')
          ? '如您的情况符合上述政策，退款申请需由人工审核后执行，请耐心等待。'
          : '如问题仍未解决，我们会转交人工坐席继续跟进。');
    } else {
      content =
        `您好，感谢您的反馈。关于您提到的「${question.slice(0, 40)}」，` +
        `当前资料库暂未检索到完全匹配的处理方案，为保障服务质量，已为您转人工处理。`;
    }
    return { content, usage: { totalTokens: Math.ceil((question.length + content.length) / 2) } };
  }

  /** 质量评审：草稿质量分 */
  private async review(content: string): Promise<LlmChatResult> {
    let score = 60;
    if (content.includes('抱歉') || content.includes('资料')) score += 15;
    if (content.length >= 20) score += 15;
    if (/退款|赔付/.test(content) && !content.includes('人工审核')) score -= 30;
    const finalScore = Math.max(0, Math.min(100, score));
    return { content: JSON.stringify({ score: finalScore }), usage: { totalTokens: content.length / 2 } };
  }
}
