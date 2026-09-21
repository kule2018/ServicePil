/**
 * 工具模块 tools.module.ts
 * 注册业务工具集，供 Agent 编排层与前端能力展示使用
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { RagModule } from '../rag/rag.module';
import { HitlModule } from '../hitl/hitl.module';
import { TicketsModule } from '../tickets/tickets.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket]),
    RagModule,
    HitlModule,
    TicketsModule,
    UsersModule,
  ],
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
