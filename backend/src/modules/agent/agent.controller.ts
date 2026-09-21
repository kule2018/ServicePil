/**
 * Agent 控制器 agent.controller.ts
 * POST /agent/chat              独立问答 / 工单上下文问答（body.ticketId 可选）
 * POST /agent/tickets/:id/process  对存量工单执行一次 AI 处理
 */
import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ChatDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  chat(@Body() dto: ChatDto, @CurrentUser() actor: AuthUser) {
    if (dto.ticketId) {
      return this.agentService.chatOnTicket(dto.ticketId, dto.content, {
        userId: actor.userId,
        role: actor.role,
      });
    }
    return this.agentService.standaloneChat(dto.content, { userId: actor.userId, role: actor.role });
  }

  @Post('tickets/:id/process')
  process(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.agentService.processTicket(id, { userId: actor.userId, role: actor.role });
  }
}
