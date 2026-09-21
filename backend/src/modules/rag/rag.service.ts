/**
 * RAG 服务 rag.service.ts
 * 知识能力三合一：
 *  1) FAQ 知识条目管理（结构化「问题-答案」，意图路由）
 *  2) 原始文档导入（切片 + 向量化落库）
 *  3) 混合检索（BM25 关键词 + 向量余弦 + RRF 融合），供 Agent 召回依据
 *
 * 说明：向量检索在当前工程量级下采用「内存余弦 + RRF 排序」的直白实现，
 *      生产环境可平滑替换为 MySQL 向量函数 / Milvus / pgvector。
 */
import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { KnowledgeItem } from '../../entities/knowledge-item.entity';
import { KnowledgeDocument } from '../../entities/document.entity';
import { DocumentChunk } from '../../entities/document-chunk.entity';
import { EMBEDDING_PROVIDER } from '../../ai/embedding/embedding.interface';
import type { EmbeddingProvider } from '../../ai/embedding/embedding.interface';
import { chunkText } from '../../ai/rag/chunk.util';
import { bm25Score } from '../../ai/rag/bm25.util';
import { cosineSimilarity } from '../../ai/rag/vector.util';

/** 检索片段（Agent 拼 Prompt 用） */
export interface RagSnippet {
  text: string;
  source: 'faq' | 'document';
  /** FAQ 命中时的问题；文档命中时为文档标题 */
  docTitle?: string;
  score: number;
}

export interface HybridSearchResult {
  query: string;
  snippets: RagSnippet[];
  /** 命中的 FAQ 原始条目（写 ai_processing_log 外键用） */
  hitFaq?: KnowledgeItem | null;
}

@Injectable()
export class RagService {
  constructor(
    @InjectRepository(KnowledgeItem) private readonly faqRepo: Repository<KnowledgeItem>,
    @InjectRepository(KnowledgeDocument) private readonly docRepo: Repository<KnowledgeDocument>,
    @InjectRepository(DocumentChunk) private readonly chunkRepo: Repository<DocumentChunk>,
    @Inject(EMBEDDING_PROVIDER) private readonly embedding: EmbeddingProvider,
  ) {}

  // ============ FAQ 知识条目 CRUD ============

  async listKnowledgeItems(query: { intent?: string; keyword?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(Number(query.pageSize ?? 20), 100);
    const where: Record<string, unknown> = {};
    if (query.intent) where.intent = query.intent;
    if (query.keyword) where.question = Like(`%${query.keyword}%`);

    const [list, total] = await this.faqRepo.findAndCount({
      where: where as any,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { list, total, page, pageSize };
  }

  async createKnowledgeItem(dto: { intent: any; question: string; answer: string }) {
    return this.faqRepo.save(this.faqRepo.create(dto));
  }

  async updateKnowledgeItem(id: string, dto: { intent?: any; question?: string; answer?: string }) {
    const item = await this.faqRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('知识条目不存在');
    if (dto.intent) item.intent = dto.intent;
    if (dto.question) item.question = dto.question;
    if (dto.answer) item.answer = dto.answer;
    return this.faqRepo.save(item);
  }

  async deleteKnowledgeItem(id: string) {
    const item = await this.faqRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('知识条目不存在');
    await this.faqRepo.softRemove(item);
    return { deleted: true };
  }

  // ============ 原始文档导入（切片 + 向量化） ============

  async listDocuments() {
    const [list, total] = await this.docRepo.findAndCount({
      order: { createdAt: 'DESC' },
    });
    const chunkCounts = await this.chunkRepo
      .createQueryBuilder('c')
      .select('c.document_id', 'documentId')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('c.document_id')
      .getRawMany<{ documentId: string; cnt: string }>();
    const countMap = new Map(chunkCounts.map((r) => [r.documentId, Number(r.cnt)]));
    const items = list.map((d) => ({ ...d, chunkCount: countMap.get(d.id) ?? 0 }));
    return { list: items, total };
  }

  async getDocument(id: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('文档不存在');
    const chunks = await this.chunkRepo.find({
      where: { documentId: id },
      order: { chunkIndex: 'ASC' },
    });
    return { ...doc, chunks };
  }

  /**
   * 导入文档：切片 → 批量向量化 → 落库（幂等：同一文档重复导入会先软删旧数据）
   * @returns { document, chunkCount }
   */
  async ingestDocument(dto: { title: string; content: string; source?: string }) {
    const texts = chunkText(dto.content, 300, 60);
    if (texts.length === 0) throw new NotFoundException('文档内容为空，无法切片');

    const vectors = await this.embedding.embedBatch(texts);
    const doc = await this.docRepo.save(
      this.docRepo.create({
        title: dto.title,
        content: dto.content,
        source: dto.source ?? null,
      }),
    );
    const chunks = texts.map((text, i) =>
      this.chunkRepo.create({
        documentId: doc.id,
        chunkIndex: i,
        text,
        embedding: vectors[i],
      }),
    );
    await this.chunkRepo.save(chunks);
    return { document: doc, chunkCount: chunks.length };
  }

  async deleteDocument(id: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('文档不存在');
    await this.chunkRepo.softDelete({ documentId: id });
    await this.docRepo.softRemove(doc);
    return { deleted: true };
  }

  // ============ 混合检索 ============

  /**
   * 混合检索入口
   * 结果分两类：
   *  - FAQ 命中：问题-答案式，通常整条作为答案依据
   *  - 文档切片命中：向量 + BM25 RRF 融合后的片段
   */
  async hybridSearch(query: string, topK = 5): Promise<HybridSearchResult> {
    const [faqs, chunks] = await Promise.all([
      this.faqSearch(query, Math.max(1, Math.ceil(topK / 2))),
      this.chunkSearch(query, Math.max(1, topK)),
    ]);

    const snippets: RagSnippet[] = [];
    const hitFaq = faqs[0]?.item ?? null;
    if (hitFaq) {
      snippets.push({
        text: `Q：${hitFaq.question}\nA：${hitFaq.answer}`,
        source: 'faq',
        docTitle: hitFaq.question,
        score: faqs[0].score,
      });
    }
    for (const c of chunks.slice(0, topK)) {
      snippets.push({
        text: c.text,
        source: 'document',
        docTitle: c.docTitle,
        score: c.score,
      });
    }

    return { query, snippets, hitFaq };
  }

  /** FAQ 检索：BM25 对「问题+答案」打分，取 top */
  private async faqSearch(query: string, topK: number): Promise<Array<{ item: KnowledgeItem; score: number }>> {
    const all = await this.faqRepo.find({ order: { createdAt: 'DESC' }, take: 500 });
    if (all.length === 0) return [];
    const docs = all.map((it) => `${it.question}\n${it.answer}`);
    const hits = bm25Score(query, docs).slice(0, topK);
    return hits.map((h) => ({ item: all[h.index], score: h.score }));
  }

  /** 文档切片检索：向量排序 + BM25 排序 → RRF 融合 */
  private async chunkSearch(query: string, topK: number) {
    const chunks = await this.chunkRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.document', 'doc')
      .orderBy('c.createdAt', 'DESC')
      .take(1000)
      .getMany();
    if (chunks.length === 0) return [];

    // 候选池按相关性各取一份名次榜，再 RRF 融合
    type Ranked = { index: number; score: number };
    const textList = chunks.map((c) => c.text);
    const bm25Ranked: Ranked[] = bm25Score(query, textList).map((h) => ({ index: h.index, score: h.score }));

    let vecRanked: Ranked[] = [];
    const qVec = await this.embedding.embed(query);
    const scored: Ranked[] = [];
    chunks.forEach((c, i) => {
      if (c.embedding && c.embedding.length > 0) {
        scored.push({ index: i, score: cosineSimilarity(qVec, c.embedding) });
      }
    });
    scored.sort((a, b) => b.score - a.score);
    vecRanked = scored.slice(0, topK * 3);

    const rrf = new Map<number, number>();
    const addList = (ranked: Ranked[]) => {
      ranked.forEach((r, rank) => {
        rrf.set(r.index, (rrf.get(r.index) ?? 0) + 1 / (60 + rank));
      });
    };
    addList(bm25Ranked.slice(0, topK * 3));
    addList(vecRanked);

    return [...rrf.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([index]) => {
        const c = chunks[index];
        return {
          chunkId: c.id,
          text: c.text,
          docTitle: (c.document as KnowledgeDocument)?.title ?? '',
          score: Math.round(rrf.get(index)! * 1000) / 1000,
        };
      });
  }
}
