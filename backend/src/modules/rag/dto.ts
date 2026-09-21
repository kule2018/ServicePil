/**
 * RAG 知识库模块 DTO
 */
import {
  IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, IsInt, Min, Max,
} from 'class-validator';
import { TicketIntent } from '../../entities/enums';

/** 导入原始文档 */
export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty({ message: '文档标题不能为空' })
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty({ message: '文档内容不能为空' })
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  source?: string;
}

/** 混合检索请求 */
export class SearchDto {
  @IsString()
  @IsNotEmpty({ message: '查询词不能为空' })
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}

/** 创建/更新 FAQ 知识条目 */
export class UpsertKnowledgeItemDto {
  @IsEnum(TicketIntent, { message: '意图分类不合法' })
  intent: TicketIntent;

  @IsString()
  @IsNotEmpty({ message: '问题不能为空' })
  @MaxLength(300)
  question: string;

  @IsString()
  @IsNotEmpty({ message: '答案不能为空' })
  answer: string;
}

/** 知识条目列表查询 */
export class QueryKnowledgeItemDto {
  @IsOptional()
  @IsEnum(TicketIntent)
  intent?: TicketIntent;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
