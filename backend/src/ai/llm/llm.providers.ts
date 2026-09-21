/**
 * LLM Provider 工厂
 * 依据环境变量 LLM_PROVIDER 注入具体实现：
 *   - mock   → MockLlm（默认，无 Key 可跑通全流程）
 *   - openai → OpenAICompatibleLlm（兼容 OpenAI/DeepSeek/通义/智谱 等网关）
 */
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDER } from './llm.interface';
import { MockLlm } from './mock.llm';
import { OpenAICompatibleLlm } from './openai-compatible.llm';

export const llmProviderFactory: Provider = {
  provide: LLM_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const provider = config.get<string>('llm.provider') ?? 'mock';
    return provider === 'openai'
      ? new OpenAICompatibleLlm(config)
      : new MockLlm();
  },
};
