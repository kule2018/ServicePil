/**
 * HITL 模块 DTO：审批 / 驳回
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DecidePendingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
