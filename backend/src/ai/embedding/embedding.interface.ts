/**
 * Embedding 抽象接口层
 * 业务代码只依赖该接口；通过工厂按环境变量注入实现
 */
export interface EmbeddingProvider {
  readonly name: string;
  /** 向量维度 */
  readonly dimension: number;

  embed(text: string): Promise<number[]>;

  /** 批量向量化（Mock 逐个即可，OpenAI 可走批量接口优化） */
  embedBatch(texts: string[]): Promise<number[][]>;
}

export const EMBEDDING_PROVIDER = 'EMBEDDING_PROVIDER';
