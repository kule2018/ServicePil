/**
 * OpenAI 兼容网关 LLM 实现
 * 适用于 OpenAI / DeepSeek / 通义 / 智谱 / 本地 vLLM 等任意
 * 遵循 /chat/completions 协议的网关，仅需配置 baseUrl + apiKey + model
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider, LlmChatMessage, LlmChatOptions, LlmChatResult } from './llm.interface';

@Injectable()
export class OpenAICompatibleLlm implements LlmProvider {
  readonly name = 'openai-compatible';
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly logger = new Logger(OpenAICompatibleLlm.name);

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('llm.baseUrl') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.apiKey = config.get<string>('llm.apiKey') ?? '';
    this.model = config.get<string>('llm.model') ?? 'gpt-4o-mini';
  }

  async chat(messages: LlmChatMessage[], options?: LlmChatOptions): Promise<LlmChatResult> {
    if (!this.apiKey) {
      throw new Error('LLM_PROVIDER=openai 但未配置 LLM_API_KEY，请在 .env 中填写');
    }

    const startedAt = Date.now();
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 800,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      this.logger.error(`LLM 网关错误 ${resp.status}: ${text.slice(0, 300)}`);
      throw new Error(`LLM 调用失败：HTTP ${resp.status}`);
    }

    const json: any = await resp.json();
    const content: string = json?.choices?.[0]?.message?.content ?? '';
    const usage = json?.usage;

    return {
      content,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
    };
  }
}
