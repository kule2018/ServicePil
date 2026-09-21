/**
 * Embedding Provider 工厂
 * EMBEDDING_PROVIDER: mock | openai
 */
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMBEDDING_PROVIDER } from './embedding.interface';
import { MockEmbedding } from './mock.embedding';
import { OpenAIEmbedding } from './openai.embedding';

export const embeddingProviderFactory: Provider = {
  provide: EMBEDDING_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const provider = config.get<string>('embedding.provider') ?? 'mock';
    return provider === 'openai'
      ? new OpenAIEmbedding(config)
      : new MockEmbedding();
  },
};
