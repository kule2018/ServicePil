/**
 * 数据库模块 database.module.ts
 * 负责建立 MySQL 连接并注册全部 TypeORM 实体
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../../entities/user.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Conversation } from '../../entities/conversation.entity';
import { Message } from '../../entities/message.entity';
import { KnowledgeItem } from '../../entities/knowledge-item.entity';
import { KnowledgeDocument } from '../../entities/document.entity';
import { DocumentChunk } from '../../entities/document-chunk.entity';
import { AiProcessingLog } from '../../entities/ai-processing-log.entity';
import { PendingConfirm } from '../../entities/pending-confirm.entity';
import { AgentTrace } from '../../entities/agent-trace.entity';
import { RefundKeyword } from '../../entities/refund-keyword.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: [
          User, Ticket, Conversation, Message,
          KnowledgeItem, KnowledgeDocument, DocumentChunk,
          AiProcessingLog, PendingConfirm, AgentTrace, RefundKeyword,
        ],
        // 开发环境由 TypeORM 自动同步；生产请改用 migration
        synchronize: config.get<boolean>('database.synchronize'),
        timezone: 'Z',
        charset: 'utf8mb4',
      }),
    }),
  ],
})
export class DatabaseModule {}
