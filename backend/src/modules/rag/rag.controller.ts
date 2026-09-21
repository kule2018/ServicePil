/**
 * RAG 控制器 rag.controller.ts
 * 文档与 FAQ 知识库管理（坐席/管理员）+ 混合检索调试接口
 */
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { RagService } from './rag.service';
import {
  CreateDocumentDto, SearchDto, UpsertKnowledgeItemDto, QueryKnowledgeItemDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/enums';

@Controller('rag')
@UseGuards(JwtAuthGuard)
export class RagController {
  constructor(private readonly ragService: RagService) {}

  /** 混合检索（调试/前端展示召回依据） */
  @Post('search')
  search(@Body() dto: SearchDto) {
    return this.ragService.hybridSearch(dto.query, dto.topK ?? 5);
  }

  // ---------- 原始文档 ----------

  @Post('documents')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  ingest(@Body() dto: CreateDocumentDto) {
    return this.ragService.ingestDocument(dto);
  }

  @Get('documents')
  listDocuments() {
    return this.ragService.listDocuments();
  }

  @Get('documents/:id')
  getDocument(@Param('id') id: string) {
    return this.ragService.getDocument(id);
  }

  @Delete('documents/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  deleteDocument(@Param('id') id: string) {
    return this.ragService.deleteDocument(id);
  }

  // ---------- FAQ 知识条目 ----------

  @Get('knowledge-items')
  listKnowledge(@Query() query: QueryKnowledgeItemDto) {
    return this.ragService.listKnowledgeItems(query);
  }

  @Post('knowledge-items')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  createKnowledge(@Body() dto: UpsertKnowledgeItemDto) {
    return this.ragService.createKnowledgeItem(dto);
  }

  @Patch('knowledge-items/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  updateKnowledge(@Param('id') id: string, @Body() dto: UpsertKnowledgeItemDto) {
    return this.ragService.updateKnowledgeItem(id, dto);
  }

  @Delete('knowledge-items/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  deleteKnowledge(@Param('id') id: string) {
    return this.ragService.deleteKnowledgeItem(id);
  }
}
