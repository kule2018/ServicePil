/**
 * HITL 服务 hitl.service.ts
 * Human-in-the-loop 核心：
 *  - create：AI/工具 触发高风险写操作时创建待确认任务
 *  - approve / reject：坐席/管理员 在前端确认或驳回
 *
 * 审批通过后的「执行动作」按类型分派：
 *  - REPLY：把 AI 草拟的客服回复正式发送给用户
 *  - REFUND：模拟退款单生效（无支付网关，仅落消息与状态）
 *  - STATUS_CHANGE：应用工单状态变更
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PendingConfirm, PendingConfirmType, PendingConfirmStatus } from '../../entities/pending-confirm.entity';
import { Ticket } from '../../entities/ticket.entity';
import { TicketStatus, SenderType } from '../../entities/enums';
import { TicketsService } from '../tickets/tickets.service';

export interface PendingConfirmView extends PendingConfirm {
  ticketTitle?: string | null;
  ticketStatus?: TicketStatus | null;
}

/** 创建待确认任务的入参 */
export interface CreatePendingInput {
  ticketId?: string | null;
  targetType: PendingConfirmType;
  payload: Record<string, any>;
  reason?: string;
}

@Injectable()
export class HitlService {
  constructor(
    @InjectRepository(PendingConfirm) private readonly pendingRepo: Repository<PendingConfirm>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    private readonly ticketsService: TicketsService,
  ) {}

  /** 创建待确认任务 */
  async create(input: CreatePendingInput): Promise<PendingConfirm> {
    return this.pendingRepo.save(
      this.pendingRepo.create({
        ticketId: input.ticketId ?? null,
        targetType: input.targetType,
        payload: input.payload,
        reason: input.reason ?? null,
        status: PendingConfirmStatus.PENDING,
      }),
    );
  }

  /** 待确认列表（可按状态/类型过滤，附带工单标题） */
  async list(query: { status?: PendingConfirmStatus; targetType?: PendingConfirmType; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(Number(query.pageSize ?? 20), 100);

    const qb = this.pendingRepo
      .createQueryBuilder('p')
      .leftJoin(Ticket, 't', 't.id = p.ticket_id AND t.deleted_at IS NULL')
      .addSelect(['t.title AS ticket_title', 't.status AS ticket_status'])
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status) qb.andWhere('p.status = :status', { status: query.status });
    if (query.targetType) qb.andWhere('p.target_type = :targetType', { targetType: query.targetType });

    const total = await qb.getCount();
    const rows = await qb.getRawAndEntities();
    const list: PendingConfirmView[] = rows.entities.map((e, i) => ({
      ...e,
      ticketTitle: rows.raw[i]?.ticket_title ?? null,
      ticketStatus: rows.raw[i]?.ticket_status ?? null,
    }));
    return { list, total, page, pageSize };
  }

  /** 审批通过：分派执行对应动作 */
  async approve(id: string, handlerId: string, note?: string) {
    const pending = await this.mustGetPending(id);
    if (pending.status !== PendingConfirmStatus.PENDING) {
      throw new BadRequestException('该任务已被处理');
    }

    const ticketId = pending.ticketId ?? (pending.payload?.ticketId as string | undefined) ?? null;

    switch (pending.targetType) {
      case PendingConfirmType.REPLY: {
        // 把 AI 草拟的回复正式发给用户
        const content = (pending.payload?.content as string) ?? '';
        if (!content) throw new BadRequestException('待确认回复内容为空');
        if (ticketId) {
          await this.ticketsService.appendSystemMessage(ticketId, SenderType.AI, content);
          if (pending.payload?.autoResolve !== false && ticketId) {
            await this.ticketRepo.update(ticketId, { status: TicketStatus.RESOLVED });
          }
        }
        break;
      }
      case PendingConfirmType.REFUND: {
        const amount = pending.payload?.amount;
        const noteText = note ? `（备注：${note}）` : '';
        const msg =
          `【系统·人工审核通过】您的退款申请已确认，` +
          `${amount ? `金额 ¥${amount} ` : ''}将在 1-3 个工作日内原路退回。${noteText}`;
        if (ticketId) {
          await this.ticketsService.appendSystemMessage(ticketId, SenderType.AGENT, msg, handlerId);
          await this.ticketRepo.update(ticketId, { status: TicketStatus.RESOLVED });
        }
        break;
      }
      case PendingConfirmType.STATUS_CHANGE: {
        const target = pending.payload?.status as TicketStatus | undefined;
        if (ticketId && target && Object.values(TicketStatus).includes(target)) {
          await this.ticketRepo.update(ticketId, { status: target });
        }
        break;
      }
      default:
        throw new BadRequestException(`未知的待确认类型: ${pending.targetType}`);
    }

    pending.status = PendingConfirmStatus.APPROVED;
    pending.handlerId = handlerId;
    pending.handlerNote = note ?? null;
    pending.decidedAt = new Date();
    return this.pendingRepo.save(pending);
  }

  /** 驳回 */
  async reject(id: string, handlerId: string, note?: string) {
    const pending = await this.mustGetPending(id);
    if (pending.status !== PendingConfirmStatus.PENDING) {
      throw new BadRequestException('该任务已被处理');
    }
    const ticketId = pending.ticketId ?? (pending.payload?.ticketId as string | undefined) ?? null;
    const noteText = note ? `原因：${note}` : '未填写驳回原因';
    if (ticketId && pending.targetType === PendingConfirmType.REFUND) {
      await this.ticketsService.appendSystemMessage(
        ticketId,
        SenderType.AGENT,
        `【系统·人工驳回】您的退款申请未通过审核（${noteText}），如有疑问请联系坐席。`,
        handlerId,
      );
    }
    pending.status = PendingConfirmStatus.REJECTED;
    pending.handlerId = handlerId;
    pending.handlerNote = note ?? null;
    pending.decidedAt = new Date();
    return this.pendingRepo.save(pending);
  }

  async countPending(): Promise<number> {
    return this.pendingRepo.count({ where: { status: PendingConfirmStatus.PENDING } });
  }

  private async mustGetPending(id: string): Promise<PendingConfirm> {
    const pending = await this.pendingRepo.findOne({ where: { id } });
    if (!pending) throw new NotFoundException('待确认任务不存在');
    return pending;
  }
}
