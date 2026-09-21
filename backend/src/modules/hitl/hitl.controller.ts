/**
 * HITL 控制器 hitl.controller.ts
 * GET  /hitl/pending                 待确认任务列表（坐席工作台）
 * POST /hitl/pending/:id/approve     审批通过
 * POST /hitl/pending/:id/reject      驳回
 */
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { HitlService } from './hitl.service';
import { DecidePendingDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole, TicketStatus } from '../../entities/enums';
import { PendingConfirmStatus, PendingConfirmType } from '../../entities/pending-confirm.entity';
import { IsOptional, IsEnum, IsString } from 'class-validator';

/** 列表查询参数 */
class QueryPendingDto {
  @IsOptional()
  @IsEnum(PendingConfirmStatus)
  status?: PendingConfirmStatus;

  @IsOptional()
  @IsEnum(PendingConfirmType)
  targetType?: PendingConfirmType;

  @IsOptional()
  @IsString()
  page?: number;

  @IsOptional()
  @IsString()
  pageSize?: number;
}

@Controller('hitl/pending')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENT, UserRole.ADMIN)
export class HitlController {
  constructor(private readonly hitlService: HitlService) {}

  @Get()
  list(@Query() query: QueryPendingDto) {
    const status = (query.status ?? PendingConfirmStatus.PENDING) as PendingConfirmStatus;
    return this.hitlService.list({ ...query, status });
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() actor: AuthUser, @Body() dto: DecidePendingDto) {
    return this.hitlService.approve(id, actor.userId, dto.note);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() actor: AuthUser, @Body() dto: DecidePendingDto) {
    return this.hitlService.reject(id, actor.userId, dto.note);
  }
}
