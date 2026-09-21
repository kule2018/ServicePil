/**
 * 退款触发词配置服务 refund-keyword.service.ts
 * 维护 refund_keyword 表（可配置数据），对外提供：
 *  - list：列出全部触发词（含启用/禁用），供「人工确认」页面展示
 *  - getEnabledKeywords：取启用中的触发词文本，供 Agent 工作流匹配退款诉求
 *  - create / toggle / remove：坐席 / 管理员 动态维护
 *
 * 为避免 Agent 工作流每条消息都查库，getEnabledKeywords 带 30s 内存缓存；
 * 任何写操作后立即失效，保证配置改动实时生效。
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefundKeyword } from '../../entities/refund-keyword.entity';

@Injectable()
export class RefundKeywordService {
  constructor(
    @InjectRepository(RefundKeyword) private readonly repo: Repository<RefundKeyword>,
  ) {}

  /** 全部触发词（按创建时间升序），供管理面板展示 */
  async list(): Promise<RefundKeyword[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  /**
   * 启用中的触发词文本数组，供 Agent 工作流匹配退款诉求使用。
   * 带 30s 内存缓存，降低高频查询对 DB 的压力。
   */
  private cache: { words: string[]; at: number } | null = null;
  async getEnabledKeywords(): Promise<string[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < 30_000) return this.cache.words;
    const rows = await this.repo.find({ where: { enabled: true } });
    const words = rows.map((r) => r.keyword);
    this.cache = { words, at: now };
    return words;
  }

  /** 新增触发词（默认启用，重复词报错） */
  async create(keyword: string): Promise<RefundKeyword> {
    const kw = (keyword ?? '').trim();
    if (!kw) throw new BadRequestException('触发词不能为空');
    if (kw.length > 50) throw new BadRequestException('触发词过长（≤50 字）');
    const existed = await this.repo.findOne({ where: { keyword: kw } });
    if (existed) throw new BadRequestException(`触发词「${kw}」已存在`);
    const saved = await this.repo.save(this.repo.create({ keyword: kw, enabled: true }));
    this.invalidateCache();
    return saved;
  }

  /** 切换启用 / 禁用 */
  async toggle(id: string): Promise<RefundKeyword> {
    const row = await this.mustGet(id);
    row.enabled = !row.enabled;
    const saved = await this.repo.save(row);
    this.invalidateCache();
    return saved;
  }

  /** 删除触发词 */
  async remove(id: string): Promise<void> {
    const row = await this.mustGet(id);
    await this.repo.remove(row);
    this.invalidateCache();
  }

  private invalidateCache() {
    this.cache = null;
  }

  private async mustGet(id: string): Promise<RefundKeyword> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('触发词不存在');
    return row;
  }
}
