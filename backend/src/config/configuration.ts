/**
 * 集中式配置工厂
 * 从环境变量读取，提供带类型安全的默认值
 * 由 ConfigModule.forRoot({ load: [configuration] }) 加载
 */
export default () => ({
  /** HTTP 服务端口 */
  port: parseInt(process.env.PORT ?? '3000', 10),

  /** API 全局前缀 */
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',

  /** JWT 配置 */
  jwt: {
    secret: process.env.JWT_SECRET ?? 'servicepilot-dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
  },

  /** MySQL 配置 */
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '123456',
    name: process.env.DB_NAME ?? 'servicepilot',
    synchronize: (process.env.DB_SYNCHRONIZE ?? 'true') === 'true',
  },

  /** LLM 接入点：mock | openai（兼容任意 OpenAI 协议网关） */
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'mock',
    baseUrl: process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
  },

  /** Embedding 接入点：mock | openai */
  embedding: {
    provider: process.env.EMBEDDING_PROVIDER ?? 'mock',
    model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  },

  /** Human-in-the-loop 开关 */
  hitlEnabled: (process.env.HITL_ENABLED ?? 'true') === 'true',

  /** 种子数据开关 */
  seedEnabled: (process.env.SEED_ENABLED ?? 'true') === 'true',
});
