/**
 * 工单服务 tickets.service.ts
 * 创建 / 列表（角色感知）/ 详情 / 消息与会话管理 / 指派与状态流转
 *
 * 说明：工单下的「对话」采用一张 conversation 表（每单一条，懒创建），
 *      消息统一挂在 conversation 下，AI 与坐席的消息也走同一通道，
 *      前端按 createdAt 升序渲染即可得到完整时间线。
 */
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { User } from '../../entities/user.entity';
import { Conversation } from '../../entities/conversation.entity';
import { Message } from '../../entities/message.entity';
import { SenderType, UserRole, TicketStatus } from '../../entities/enums';
import {
  CreateTicketDto, QueryTicketDto, SendMessageDto, UpdateTicketDto,
} from './dto';

/** 每条消息额外附带的展示信息 */
export interface MessageView extends Message {
  senderName?: string | null;
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
  ) {}

  /** 创建工单（终端用户） */
  async create(user: User, dto: CreateTicketDto): Promise<Ticket> {
    const ticket = this.ticketRepo.create({
      title: dto.title,
      content: dto.content,
      priority: dto.priority,
      createdBy: user,
    });
    const saved = await this.ticketRepo.save(ticket);
    // 懒创建一条空会话，后续所有消息挂到其下
    await this.conversationRepo.save(this.conversationRepo.create({ ticketId: saved.id }));
    return saved;
  }

  /**
   * 工单列表（分页）
   * end_user 只看自己提交的；agent/admin 看全部
   */
  async list(query: QueryTicketDto, actor: User) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(Number(query.pageSize ?? 10), 100);

    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.createdBy', 'creator')
      .leftJoinAndSelect('t.assignedTo', 'assignee')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    // 角色过滤
    if (actor.role === UserRole.END_USER) {
      qb.andWhere('t.created_by = :uid', { uid: actor.id });
    }

    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.intent) qb.andWhere('t.intent = :intent', { intent: query.intent });
    if (query.priority) qb.andWhere('t.priority = :priority', { priority: query.priority });

    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('t.title LIKE :kw', { kw })
            .orWhere('t.content LIKE :kw', { kw })
            .orWhere('creator.name LIKE :kw', { kw });
        }),
      );
    }

    const [list, total] = await qb.getManyAndCount();
    return { list, total, page, pageSize };
  }

  /** 工单详情：含提交人、指派人、AI 处理日志 */
  async getDetail(id: string, actor: User): Promise<Ticket> {
    const ticket = await this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.createdBy', 'creator')
      .leftJoinAndSelect('t.assignedTo', 'assignee')
      .leftJoinAndSelect('t.aiLogs', 'logs')
      .leftJoinAndSelect('logs.knowledgeItem', 'knowledge')
      .where('t.id = :id', { id })
      .orderBy('logs.createdAt', 'DESC')
      .getOne();
    if (!ticket) throw new NotFoundException('工单不存在');
    this.assertVisible(ticket, actor);
    return ticket;
  }

  /** 更新工单字段（标题/内容/优先级/状态），坐席或管理员 */
  async update(id: string, dto: UpdateTicketDto): Promise<Ticket> {
    const ticket = await this.mustGet(id);
    if (dto.title) ticket.title = dto.title;
    if (dto.content) ticket.content = dto.content;
    if (dto.priority) ticket.priority = dto.priority;
    if (dto.status) ticket.status = dto.status;
    return this.ticketRepo.save(ticket);
  }

  /** 指派/取消指派 */
  async assign(id: string, assignedToId: string | null): Promise<Ticket> {
    const ticket = await this.mustGet(id);
    if (!assignedToId) {
      ticket.assignedTo = null as any;
    } else {
      const assignee = await this.userRepo.findOne({ where: { id: assignedToId } });
      if (!assignee) throw new NotFoundException('被指派人不存在');
      if (assignee.role === UserRole.END_USER) {
        throw new ForbiddenException('只能指派给坐席或管理员');
      }
      ticket.assignedTo = assignee;
    }
    return this.ticketRepo.save(ticket);
  }

  /** 获取工单时间线消息（按时间升序） */
  async getMessages(ticketId: string): Promise<MessageView[]> {
    await this.mustGet(ticketId);
    const conversation = await this.getOrCreateConversation(ticketId);
    const messages = await this.messageRepo.find({
      where: { conversationId: conversation.id },
      order: { createdAt: 'ASC' },
    });
    return this.attachSenderNames(messages);
  }

  /** 追加一条消息（由工单模块 API 调用，用户或坐席主动发言） */
  async addMessage(ticketId: string, actor: User, dto: SendMessageDto): Promise<Message> {
    const conversation = await this.getOrCreateConversation(ticketId);
    const message = this.messageRepo.create({
      conversationId: conversation.id,
      senderType: actor.role === UserRole.END_USER ? SenderType.USER : SenderType.AGENT,
      senderId: actor.id,
      content: dto.content,
    });
    const saved = await this.messageRepo.save(message);

    // 用户补充消息时：若工单已关闭则重新打开为 ai_handling
    if (actor.role === UserRole.END_USER) {
      const ticket = await this.mustGet(ticketId);
      if (ticket.status === TicketStatus.CLOSED) {
        await this.ticketRepo.update(ticketId, { status: TicketStatus.AI_HANDLING });
      }
    }
    return saved;
  }

  /** 供 Agent/HITL 内部直接写入系统/AI 消息 */
  async appendSystemMessage(ticketId: string, senderType: SenderType, content: string, senderId?: string): Promise<Message> {
    const conversation = await this.getOrCreateConversation(ticketId);
    const message = this.messageRepo.create({
      conversationId: conversation.id,
      senderType,
      senderId: senderId ?? null,
      content,
    });
    return this.messageRepo.save(message);
  }

  /** 简单状态计数（仪表盘用） */
  async countByStatus() {
    const rows: Array<{ status: TicketStatus; cnt: string }> = await this.ticketRepo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('t.status')
      .getRawMany();
    const total = rows.reduce((acc, r) => acc + Number(r.cnt), 0);
    const map = Object.fromEntries(rows.map((r) => [r.status, Number(r.cnt)]));
    return { total, byStatus: map };
  }

  // ---------------- internal ----------------

  private async mustGet(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('工单不存在');
    return ticket;
  }

  private async getOrCreateConversation(ticketId: string): Promise<Conversation> {
    const existing = await this.conversationRepo.findOne({ where: { ticketId } });
    if (existing) return existing;
    return this.conversationRepo.save(this.conversationRepo.create({ ticketId }));
  }

  private assertVisible(ticket: Ticket, actor: User): void {
    if (actor.role === UserRole.END_USER && ticket.createdBy?.id !== actor.id) {
      throw new ForbiddenException('无权查看他人工单');
    }
  }

  /** 为消息补全发送方展示名 */
  private async attachSenderNames(messages: Message[]): Promise<MessageView[]> {
    const senderIds = [...new Set(messages.map((m) => m.senderId).filter(Boolean))] as string[];
    if (senderIds.length === 0) return messages as MessageView[];
    const users = await this.userRepo
      .createQueryBuilder('user')
      .select(['user.id', 'user.name'])
      .where('user.id IN (:...ids)', { ids: senderIds })
      .getMany();
    const nameMap = new Map(users.map((u) => [u.id, u.name]));
    return messages.map((m) => ({ ...m, senderName: m.senderId ? (nameMap.get(m.senderId) ?? null) : null }));
  }
}
