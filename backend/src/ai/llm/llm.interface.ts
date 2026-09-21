/**
 * LLM 抽象接口层
 * 业务代码只依赖该接口，不感知具体实现（OpenAI / Mock / 其他网关）
 * 通过 provider 工厂按环境变量注入
 */
export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LlmChatResult {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LlmProvider {
  /** 实现标识，用于 Trace 记录 */
  readonly name: string;
  /** 当前使用的模型名 */
  readonly model: string;

  chat(messages: LlmChatMessage[], options?: LlmChatOptions): Promise<LlmChatResult>;
}

/** 依赖注入 Token */
export const LLM_PROVIDER = 'LLM_PROVIDER';
