/**
 * AI 核心模块（@Global）
 * 集中注册 LLM_PROVIDER / EMBEDDING_PROVIDER 两个注入 Token，
 * 业务模块无需重复 import 即可注入（provider 选择完全由 .env 决定）
 */
import { Global, Module } from '@nestjs/common';
import { llmProviderFactory } from './llm/llm.providers';
import { embeddingProviderFactory } from './embedding/embedding.providers';
import { LLM_PROVIDER } from './llm/llm.interface';
import { EMBEDDING_PROVIDER } from './embedding/embedding.interface';

@Global()
@Module({
  providers: [llmProviderFactory, embeddingProviderFactory],
  exports: [LLM_PROVIDER, EMBEDDING_PROVIDER],
})
export class AiModule {}
