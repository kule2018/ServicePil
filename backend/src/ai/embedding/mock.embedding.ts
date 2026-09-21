/**
 * Mock Embedding 实现（无 Embedding API 时的降级方案）
 * 原理：字符 bigram 特征哈希 + 符号加权 + L2 归一化。
 * 对中文关键词级别的相关性有一定区分度，足以支撑混合检索演示；
 * 语义精度无法与真实模型相比，生产请切换 openai。
 */
import { Injectable } from '@nestjs/common';
import { EmbeddingProvider } from './embedding.interface';

@Injectable()
export class MockEmbedding implements EmbeddingProvider {
  readonly name = 'mock';
  readonly dimension = 256;

  async embed(text: string): Promise<number[]> {
    const vec = new Float64Array(this.dimension);
    const norm = text.replace(/\s+/g, '');

    // 字符 bigram 特征
    for (let i = 0; i < norm.length - 1; i++) {
      const gram = norm.slice(i, i + 2);
      const h = this.hash(gram);
      const idx = Math.abs(h) % this.dimension;
      vec[idx] += h > 0 ? 1 : -1;
    }
    // 单字也加入特征，避免过短文本向量全零
    if (norm.length === 1) {
      vec[Math.abs(this.hash(norm)) % this.dimension] = 1;
    }

    // L2 归一化
    let sum = 0;
    for (let i = 0; i < this.dimension; i++) sum += vec[i] * vec[i];
    const normLen = Math.sqrt(sum) || 1;
    return Array.from(vec, (v) => v / normLen);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const t of texts) out.push(await this.embed(t));
    return out;
  }

  /** FNV-1a 哈希 */
  private hash(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h | 0;
  }
}
