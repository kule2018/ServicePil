/**
 * RAG 模块 rag.module.ts
 * 提供知识库管理 + 混合检索，导出 RagService 供 Agent / Tools / Seed 复用
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeItem } from '../../entities/knowledge-item.entity';
import { KnowledgeDocument } from '../../entities/document.entity';
import { DocumentChunk } from '../../entities/document-chunk.entity';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeItem, KnowledgeDocument, DocumentChunk])],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
