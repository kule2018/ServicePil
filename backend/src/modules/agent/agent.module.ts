/**
 * Agent 模块 agent.module.ts
 * 编排 LLM + RAG + Tools + HITL，实现工单智能处理与知识问答
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { AiProcessingLog } from '../../entities/ai-processing-log.entity';
import { AgentTrace } from '../../entities/agent-trace.entity';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { RagModule } from '../rag/rag.module';
import { ToolsModule } from '../tools/tools.module';
import { TicketsModule } from '../tickets/tickets.module';
import { RefundKeywordModule } from '../hitl/refund-keyword.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, AiProcessingLog, AgentTrace]),
    RagModule,
    ToolsModule,
    TicketsModule,
    RefundKeywordModule,
  ],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
