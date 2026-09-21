/**
 * Agent 模块 DTO
 */
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** 对话请求：可携带 ticketId（工单上下文问答），否则为知识库独立问答 */
export class ChatDto {
  @IsOptional()
  @IsString()
  ticketId?: string;

  @IsString()
  @IsNotEmpty({ message: '消息内容不能为空' })
  @MaxLength(2000)
  content: string;
}
