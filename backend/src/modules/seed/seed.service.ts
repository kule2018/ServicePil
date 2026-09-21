/**
 * 种子服务 seed.service.ts
 * 应用启动（OnApplicationBootstrap）时幂等写入演示数据：
 *  - 演示账号（管理员/坐席/终端用户）
 *  - FAQ 知识条目 + 原始文档（自动切片向量化，验证 RAG 链路）
 *  - 示例工单与时间线消息、一条待人工确认的退款任务（演示 HITL 工作台）
 *
 * 幂等策略：检测到 admin@servicepilot.dev 已存在即整体跳过。
 */
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { UserRole, TicketStatus, TicketIntent, SenderType } from '../../entities/enums';
import { PendingConfirmType } from '../../entities/pending-confirm.entity';
import { RefundKeyword } from '../../entities/refund-keyword.entity';
import { RagService } from '../rag/rag.service';
import { HitlService } from '../hitl/hitl.service';
import { TicketsService } from '../tickets/tickets.service';

const SEED_EMAIL = 'admin@servicepilot.dev';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(RefundKeyword) private readonly refundKeywordRepo: Repository<RefundKeyword>,
    private readonly ragService: RagService,
    private readonly hitlService: HitlService,
    private readonly ticketsService: TicketsService,
  ) {}

  async onApplicationBootstrap() {
    try {
      // 退款触发词为独立幂等数据：无论 admin 是否已在，都先确保默认触发词就位
      await this.seedRefundKeywords();
      const exists = await this.userRepo.findOne({ where: { email: SEED_EMAIL } });
      if (exists) return;
      this.logger.log('开始写入种子数据…');
      const users = await this.seedUsers();
      await this.seedKnowledge();
      await this.seedTickets(users);
      this.logger.log('种子数据写入完成 ✓');
    } catch (err) {
      this.logger.error(`种子数据写入失败（可忽略并手动排查）: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** 演示账号 */
  private async seedUsers() {
    const hash = (pw: string) => bcrypt.hash(pw, 10);
    const admin = await this.userRepo.save(
      this.userRepo.create({
        name: '系统管理员',
        email: 'admin@servicepilot.dev',
        password: await hash('admin123'),
        role: UserRole.ADMIN,
      }),
    );
    const agent = await this.userRepo.save(
      this.userRepo.create({
        name: '王小明',
        email: 'agent@servicepilot.dev',
        password: await hash('agent123'),
        role: UserRole.AGENT,
      }),
    );
    const alice = await this.userRepo.save(
      this.userRepo.create({
        name: '张丽',
        email: 'alice@example.com',
        password: await hash('user123'),
        role: UserRole.END_USER,
      }),
    );
    const bob = await this.userRepo.save(
      this.userRepo.create({
        name: '李强',
        email: 'bob@example.com',
        password: await hash('user123'),
        role: UserRole.END_USER,
      }),
    );
    this.logger.log('演示账号已创建: admin@servicepilot.dev/admin123, agent@servicepilot.dev/agent123, user@example.com/user123');
    return { admin, agent, alice, bob };
  }

  /** 退款 / 赔付触发词默认数据（演示 Agent 工作流如何识别退款诉求）→ 落 refund_keyword 表 */
  private async seedRefundKeywords() {
    const count = await this.refundKeywordRepo.count();
    if (count > 0) {
      this.logger.log(`退款触发词已存在（${count} 条），跳过种子`);
      return;
    }
    const defaults = ['退款', '全额退', '退钱', '赔付', '赔偿', '申请退'];
    for (const kw of defaults) {
      await this.refundKeywordRepo.save(this.refundKeywordRepo.create({ keyword: kw, enabled: true }));
    }
    this.logger.log(`退款触发词种子: ${defaults.length} 条（${defaults.join(' / ')}）`);
  }

  /** FAQ + 原始文档 */
  private async seedKnowledge() {
    const faqs: Array<{ intent: TicketIntent; question: string; answer: string }> = [
      {
        intent: TicketIntent.BILLING,
        question: '如何申请退款？多久能到账？',
        answer:
          '您可在「我的订单」中找到对应订单并点击申请退款，或直接提交工单说明退款原因。' +
          '符合退款政策的申请将在人工审核通过后 1-3 个工作日内原路退回。' +
          '年付/季度付订单按剩余有效期比例折算退款金额。',
      },
      {
        intent: TicketIntent.BILLING,
        question: '如何取消自动续费？取消后能退款吗？',
        answer:
          '自动续费可在「账户设置 → 订阅管理」中随时关闭，关闭后当期订阅仍有效至到期日。' +
          '若当期扣费后从未使用服务，可在扣费后 7 天内申请全额退款。',
      },
      {
        intent: TicketIntent.TECHNICAL,
        question: '客户端安装提示「无法启动」怎么办？',
        answer:
          '请先确认系统满足最低要求（Windows 10+ / macOS 12+），并关闭杀毒软件后重试安装。' +
          '若仍无法启动，请卸载后删除安装目录残留文件（Windows: %APPDATA%/ServicePilot）并重新安装最新版。',
      },
      {
        intent: TicketIntent.TECHNICAL,
        question: 'ServicePilot 支持哪些浏览器和系统？',
        answer:
          'Web 端支持 Chrome/Edge 90+、Firefox 88+、Safari 14+；桌面客户端支持 Windows 10/11、macOS 12+、主流 Linux 发行版。',
      },
      {
        intent: TicketIntent.ACCOUNT,
        question: '忘记密码如何重置？',
        answer:
          '在登录页点击「忘记密码」，输入注册邮箱后按邮件指引重置即可。若 5 分钟未收到邮件，请检查垃圾箱，或提交工单由坐席协助处理。',
      },
      {
        intent: TicketIntent.ACCOUNT,
        question: '账号被锁定怎么办？',
        answer:
          '连续 5 次输错密码会触发 30 分钟临时锁定，到期自动解锁。若急需使用，可通过「忘记密码」重置后立即登录，或联系人工坐席解锁。',
      },
      {
        intent: TicketIntent.COMPLAINT,
        question: '如何进行投诉？',
        answer:
          '您可以通过提交投诉工单或拨打客服热线进行投诉。所有投诉将在 24 小时内由专人受理，并在 3 个工作日内给出处理结果与回访。',
      },
    ];
    for (const f of faqs) {
      await this.ragService.createKnowledgeItem(f);
    }
    this.logger.log(`FAQ 知识条目: ${faqs.length} 条`);

    // 原始文档（RAG）：含产品手册与退款政策，入库即自动切片+向量化
    const manual =
      'ServicePilot 智能工单系统使用手册\n' +
      '第一章 快速上手\n' +
      '管理员使用预置账号登录后台后，可在「知识库」中维护 FAQ 与产品文档。系统将自动对文档进行切片与向量化，供 AI 客服检索。\n' +
      '终端用户登录后点击「提交工单」填写标题与问题描述，系统会自动分配工单编号。提交后 AI 客服将尝试自动处理，无法处理时转人工坐席。\n' +
      '坐席在「待办」工作台处理转人工工单与待确认操作。所有 AI 处理轨迹均可在「AI 监控」中查看，包括意图、命中知识片段与耗时。\n' +
      '第二章 常见操作\n' +
      '重置密码：登录页点击忘记密码，通过注册邮箱重置。账号被锁定 30 分钟后自动解锁。\n' +
      '工单流转：open → ai_handling → resolved / escalated → closed。坐席可指派、改优先级、关闭工单。\n' +
      '系统要求：Chrome/Edge 90+，Windows 10+，macOS 12+。\n';
    const refundPolicy =
      'ServicePilot 售后服务与退款政策\n' +
      '一、退款条件\n' +
      '订阅服务自扣费之日起 7 天内未使用（未发起任何 AI 处理任务）可申请全额退款；超过 7 天按剩余有效天数折算。\n' +
      '年付订单按 365 天折算剩余价值，季度付按 90 天折算。退款金额 = 实付金额 × 剩余天数 / 总天数，四舍五入保留两位小数。\n' +
      '二、退款流程\n' +
      '1. 用户提交工单说明退款原因；2. AI 识别为退款诉求后自动创建退款申请并转人工审核；3. 人工审核通过后 1-3 个工作日原路退回。\n' +
      '三、不予退款的情形\n' +
      '违反服务条款被冻结的账号、已消耗大量 AI 额度的账号、超过 30 天的历史订单，均不支持退款。\n';
    const doc1 = await this.ragService.ingestDocument({ title: 'ServicePilot 产品使用手册', content: manual });
    const doc2 = await this.ragService.ingestDocument({ title: '售后服务与退款政策', content: refundPolicy });
    this.logger.log(`RAG 文档: ${doc1.chunkCount} + ${doc2.chunkCount} 切片`);
  }

  /** 示例工单 + 消息 + 一条待人工确认的退款任务 */
  private async seedTickets(users: { admin: User; agent: User; alice: User; bob: User }) {
    // 1) 张丽：账号锁定（open，待 AI/人工处理）
    const t1 = await this.ticketsService.create(users.alice, {
      title: '账号被锁定了，无法登录',
      content: '我连续输入几次错误密码后提示账号已锁定，请问如何解锁？我现在很着急要用系统。',
    });
    await this.ticketsService.appendSystemMessage(t1.id, SenderType.USER, t1.content, users.alice.id);
    await this.ticketsService.addMessage(t1.id, users.alice, { content: '大概需要等多久才能解锁？' });

    // 2) 张丽：退款诉求 → 预置一条待人工确认（演示 HITL 工作台）
    const t2 = await this.ticketsService.create(users.alice, {
      title: '申请退款：订阅服务无法正常使用',
      content: '我上个月购买了年付订阅，但这周客户端一直闪退无法使用，我想申请全额退款 299 元。',
    });
    await this.ticketsService.appendSystemMessage(t2.id, SenderType.USER, t2.content, users.alice.id);
    await this.ragService.hybridSearch(t2.content, 1); // 预热
    await this.hitlService.create({
      ticketId: t2.id,
      targetType: PendingConfirmType.REFUND,
      payload: { ticketId: t2.id, amount: 299, reason: '客户端闪退无法使用，申请全额退款' },
      reason: '种子演示：退款申请等待坐席在「待确认」中审批',
    });
    await this.ticketsService.update(t2.id, { status: TicketStatus.ESCALATED });

    // 3) 李强：技术问题 → 已转人工并分配坐席
    const t3 = await this.ticketsService.create(users.bob, {
      title: '客户端安装后启动闪退',
      content: '安装完成后双击图标闪退，已经重装两次还是不行，系统是 Windows 11。',
    });
    await this.ticketsService.appendSystemMessage(t3.id, SenderType.USER, t3.content, users.bob.id);
    await this.ticketsService.update(t3.id, { status: TicketStatus.ESCALATED, priority: t3.priority });
    await this.ticketsService.assign(t3.id, users.agent.id);
    await this.ticketsService.appendSystemMessage(t3.id, SenderType.AGENT, '已收到您的问题，工程师正在复现，请您稍候。', users.agent.id);

    // 4) 张丽：AI 已解决的示例（open → resolved）
    const t4 = await this.ticketsService.create(users.alice, {
      title: '如何重置密码？',
      content: '我忘记登录密码了，请问在哪里重置？',
    });
    await this.ticketsService.appendSystemMessage(t4.id, SenderType.USER, t4.content, users.alice.id);
    await this.ticketsService.appendSystemMessage(
      t4.id,
      SenderType.AI,
      '您好，已收到您的账号问题。根据我们的知识库资料：在登录页点击「忘记密码」，输入注册邮箱后按邮件指引重置即可。' +
        '若 5 分钟未收到邮件，请检查垃圾箱，或提交工单由坐席协助处理。',
    );
    await this.ticketsService.update(t4.id, {
      status: TicketStatus.RESOLVED,
    });

    this.logger.log(`示例工单: ${[t1, t2, t3, t4].length} 张`);
  }
}
