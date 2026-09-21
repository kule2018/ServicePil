/**
 * HITL 模块 hitl.module.ts
 * 依赖 TicketsModule（审批后需向工单会话追加消息 / 改状态）
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingConfirm } from '../../entities/pending-confirm.entity';
import { Ticket } from '../../entities/ticket.entity';
import { HitlService } from './hitl.service';
import { HitlController } from './hitl.controller';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PendingConfirm, Ticket]),
    TicketsModule,
  ],
  controllers: [HitlController],
  providers: [HitlService],
  exports: [HitlService],
})
export class HitlModule {}
