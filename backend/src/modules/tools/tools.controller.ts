/**
 * 工具控制器 tools.controller.ts
 * GET  /tools          工具清单（含参数 Schema，前端渲染能力面板）
 * POST /tools/execute  执行工具（坐席/管理员；供手动调试或前端调用）
 */
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../entities/enums';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

class ExecuteToolDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsObject()
  arguments?: Record<string, any>;
}

@Controller('tools')
@UseGuards(JwtAuthGuard)
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  /** 工具清单对登录用户可见（能力展示） */
  @Get()
  list() {
    return this.toolsService.listTools();
  }

  @Post('execute')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  execute(@Body() dto: ExecuteToolDto, @CurrentUser() actor: AuthUser) {
    return this.toolsService.executeTool(dto.name, dto.arguments ?? {}, {
      actorUserId: actor.userId,
      actorRole: actor.role,
    });
  }
}
