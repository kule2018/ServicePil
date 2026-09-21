/**
 * 文档切片实体，对应 document_chunk 表
 * 每个切片保存原文与向量（JSON 字符串），由 RAG 服务写入与检索
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { KnowledgeDocument } from './document.entity';

@Entity({ name: 'document_chunk' })
export class DocumentChunk extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 外键列：所属文档 ID */
  @Column({ name: 'document_id', type: 'varchar', length: 36 })
  documentId: string;

  /** 所属文档（多对一，级联删除） */
  @ManyToOne(() => KnowledgeDocument, (d) => d.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: KnowledgeDocument;

  /** 切片序号 */
  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  /** 切片原文 */
  @Column({ type: 'text' })
  text: string;

  /** 向量 JSON 字符串 */
  @Column({ type: 'json', nullable: true })
  embedding?: number[] | null;
}
