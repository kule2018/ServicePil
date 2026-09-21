/**
 * 种子模块 seed.module.ts
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { SeedService } from './seed.service';
import { RagModule } from '../rag/rag.module';
import { HitlModule } from '../hitl/hitl.module';
import { TicketsModule } from '../tickets/tickets.module';
import { RefundKeyword } from '../../entities/refund-keyword.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefundKeyword]),
    RagModule,
    HitlModule,
    TicketsModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
