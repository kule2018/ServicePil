/**
 * OpenAI 兼容 Embedding 实现
 * 请求 {baseUrl}/embeddings，返回归一化向量
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from './embedding.interface';

@Injectable()
export class OpenAIEmbedding implements EmbeddingProvider {
  readonly name = 'openai-compatible';
  readonly dimension = 1536;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly logger = new Logger(OpenAIEmbedding.name);

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('llm.baseUrl') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.apiKey = config.get<string>('llm.apiKey') ?? '';
    this.model = config.get<string>('embedding.model') ?? 'text-embedding-3-small';
  }

  async embed(text: string): Promise<number[]> {
    const [first] = await this.embedBatch([text]);
    return first;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('EMBEDDING_PROVIDER=openai 但未配置 LLM_API_KEY');
    }
    const resp = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      this.logger.error(`Embedding 网关错误 ${resp.status}: ${text.slice(0, 300)}`);
      throw new Error(`Embedding 调用失败：HTTP ${resp.status}`);
    }
    const json: any = await resp.json();
    return (json.data as Array<{ index: number; embedding: number[] }>)
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }
}
