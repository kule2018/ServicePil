/**
 * 退款触发词配置控制器 refund-keyword.controller.ts
 * 路由前缀 hitl/refund-keywords（逻辑上归属「人工确认」工作台）
 *   GET    /hitl/refund-keywords            列出全部触发词
 *   POST   /hitl/refund-keywords            新增触发词
 *   PATCH  /hitl/refund-keywords/:id/toggle 启用 / 禁用切换
 *   DELETE /hitl/refund-keywords/:id        删除触发词
 * 仅坐席 / 管理员可访问与维护。
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { RefundKeywordService } from './refund-keyword.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/enums';

class CreateKeywordDto {
  @IsString()
  @MaxLength(50)
  keyword: string;
}

@Controller('hitl/refund-keywords')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENT, UserRole.ADMIN)
export class RefundKeywordController {
  constructor(private readonly svc: RefundKeywordService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() dto: CreateKeywordDto) {
    return this.svc.create(dto.keyword);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.svc.toggle(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
