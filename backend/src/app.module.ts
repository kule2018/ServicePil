/**
 * 根模块 app.module.ts
 * 聚合全局配置、数据库连接、AI Provider 与各业务模块
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AiModule } from './ai/ai.module';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { RagModule } from './modules/rag/rag.module';
import { ToolsModule } from './modules/tools/tools.module';
import { AgentModule } from './modules/agent/agent.module';
import { HitlModule } from './modules/hitl/hitl.module';
import { RefundKeywordModule } from './modules/hitl/refund-keyword.module';
import { TraceModule } from './modules/trace/trace.module';
import { SeedModule } from './modules/seed/seed.module';

@Module({
  imports: [
    // 全局配置：读取 .env 并由 configuration() 集中解析
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
    }),
    DatabaseModule,
    AiModule,
    UsersModule,
    AuthModule,
    TicketsModule,
    RagModule,
    ToolsModule,
    HitlModule,
    RefundKeywordModule,
    TraceModule,
    AgentModule,
    SeedModule,
  ],
})
export class AppModule {}
