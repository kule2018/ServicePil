/**
 * 工单模块 DTO
 */
import {
  IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { TicketPriority, TicketStatus, TicketIntent } from '../../entities/enums';

/** 创建工单 */
export class CreateTicketDto {
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty({ message: '问题描述不能为空' })
  @MinLength(5, { message: '问题描述至少 5 个字' })
  content: string;

  @IsOptional()
  @IsEnum(TicketPriority, { message: '优先级不合法' })
  priority?: TicketPriority;
}

/** 工单列表查询 */
export class QueryTicketDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketIntent)
  intent?: TicketIntent;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}

/** 发送消息 */
export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: '消息内容不能为空' })
  @MaxLength(2000)
  content: string;
}

/** 更新工单（坐席/管理员操作） */
export class UpdateTicketDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;
}

/** 指派工单 */
export class AssignTicketDto {
  /** 传空字符串或 null 表示取消指派 */
  @IsOptional()
  @IsString()
  assignedToId?: string | null;
}
