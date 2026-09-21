/**
 * 工单控制器 tickets.controller.ts
 * 终端用户：创建工单 / 查看本人工单 / 在工单下发消息
 * 坐席管理员：查看全部 / 指派 / 更新状态优先级
 */
import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, QueryTicketDto, SendMessageDto, UpdateTicketDto, AssignTicketDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../entities/enums';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
  ) {}

  /** 创建工单（登录用户即可，角色决定可见范围） */
  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create({ id: actor.userId } as any, dto);
  }

  @Get()
  list(@CurrentUser() actor: AuthUser, @Query() query: QueryTicketDto) {
    return this.ticketsService.list(query, { id: actor.userId, role: actor.role } as any);
  }

  @Get('stats')
  stats() {
    return this.ticketsService.countByStatus();
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.ticketsService.getDetail(id, { id: actor.userId, role: actor.role } as any);
  }

  /** 工单时间线消息 */
  @Get(':id/messages')
  messages(@Param('id') id: string) {
    return this.ticketsService.getMessages(id);
  }

  /** 在工单下发消息（本人工单的提交者可补充，坐席/管理员可回复） */
  @Post(':id/messages')
  sendMessage(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: SendMessageDto,
  ) {
    const user = { id: actor.userId, role: actor.role } as any;
    return this.ticketsService.addMessage(id, user, dto);
  }

  /** 更新工单（标题/内容/优先级/状态） */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.update(id, dto);
  }

  /** 指派坐席（空字符串取消指派） */
  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  assign(@Param('id') id: string, @Body() dto: AssignTicketDto) {
    return this.ticketsService.assign(id, dto.assignedToId || null);
  }
}
