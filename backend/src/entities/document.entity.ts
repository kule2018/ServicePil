/**
 * RAG 原始文档实体，对应 documents 表
 * 存储产品手册/售后制度等非结构化资料原文；切片与向量存于 document_chunk 表
 */
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { DocumentChunk } from './document-chunk.entity';

@Entity({ name: 'document' })
export class KnowledgeDocument extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 文档标题 */
  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** 文档正文（长文本） */
  @Column({ type: 'mediumtext' })
  content: string;

  /** 来源（如手册名称、URL） */
  @Column({ type: 'varchar', length: 300, nullable: true })
  source?: string | null;

  /** 文档切片（一对多） */
  @OneToMany(() => DocumentChunk, (c) => c.document)
  chunks: DocumentChunk[];
}
