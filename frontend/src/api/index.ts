/**
 * API 聚合：按后端模块组织
 * 全部返回值标注为后端真实响应类型，字段不匹配会在编译期暴露，而不是运行时白屏。
 */
import { request } from './http';
import type {
  AgentChatResult,
  AgentTrace,
  AuthResult,
  DocumentChunk,
  KnowledgeDocument,
  KnowledgeItem,
  MessageItem,
  PageResult,
  PendingConfirm,
  RefundKeyword,
  RagSearchResult,
  Ticket,
  TicketStats,
  ToolDefinition,
  TraceStats,
  User,
  UserRole,
} from '@/types';

export * from './http';

// ---------- auth ----------
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    request<AuthResult>({ url: '/auth/register', method: 'post', data }),
  login: (data: { email: string; password: string }) =>
    request<AuthResult>({ url: '/auth/login', method: 'post', data }),
  me: () => request<User>({ url: '/auth/me', method: 'get' }),
};

// ---------- users ----------
export const usersApi = {
  me: () => request<User>({ url: '/users/me', method: 'get' }),
  list: (params: { keyword?: string; role?: UserRole; page?: number; pageSize?: number }) =>
    request<PageResult<User>>({ url: '/users', method: 'get', params }),
  updateRole: (id: string, role: UserRole) =>
    request<User>({ url: `/users/${id}/role`, method: 'patch', data: { role } }),
};

// ---------- tickets ----------
export const ticketsApi = {
  create: (data: { title: string; content: string; priority?: string }) =>
    request<Ticket>({ url: '/tickets', method: 'post', data }),
  list: (params: Record<string, any>) =>
    request<PageResult<Ticket>>({ url: '/tickets', method: 'get', params }),
  stats: () => request<TicketStats>({ url: '/tickets/stats', method: 'get' }),
  detail: (id: string) => request<Ticket>({ url: `/tickets/${id}`, method: 'get' }),
  messages: (id: string) => request<MessageItem[]>({ url: `/tickets/${id}/messages`, method: 'get' }),
  sendMessage: (id: string, content: string) =>
    request<MessageItem>({ url: `/tickets/${id}/messages`, method: 'post', data: { content } }),
  update: (id: string, data: Record<string, any>) =>
    request<Ticket>({ url: `/tickets/${id}`, method: 'patch', data }),
  assign: (id: string, assignedToId: string | null) =>
    request<Ticket>({ url: `/tickets/${id}/assign`, method: 'patch', data: { assignedToId } }),
};

// ---------- rag ----------
export const ragApi = {
  search: (data: { query: string; topK?: number }) =>
    request<RagSearchResult>({ url: '/rag/search', method: 'post', data }),
  ingest: (data: { title: string; content: string; source?: string }) =>
    request<{ document: KnowledgeDocument; chunkCount: number }>({
      url: '/rag/documents',
      method: 'post',
      data,
    }),
  documents: () => request<PageResult<KnowledgeDocument>>({ url: '/rag/documents', method: 'get' }),
  documentDetail: (id: string) =>
    request<KnowledgeDocument & { chunks: DocumentChunk[] }>({ url: `/rag/documents/${id}`, method: 'get' }),
  deleteDocument: (id: string) => request<null>({ url: `/rag/documents/${id}`, method: 'delete' }),
  knowledgeItems: (params: { intent?: string; keyword?: string; page?: number; pageSize?: number }) =>
    request<PageResult<KnowledgeItem>>({ url: '/rag/knowledge-items', method: 'get', params }),
  createKnowledge: (data: { intent: string; question: string; answer: string }) =>
    request<KnowledgeItem>({ url: '/rag/knowledge-items', method: 'post', data }),
  updateKnowledge: (id: string, data: Partial<Pick<KnowledgeItem, 'intent' | 'question' | 'answer'>>) =>
    request<KnowledgeItem>({ url: `/rag/knowledge-items/${id}`, method: 'patch', data }),
  deleteKnowledge: (id: string) => request<null>({ url: `/rag/knowledge-items/${id}`, method: 'delete' }),
};

// ---------- agent ----------
export const agentApi = {
  chat: (data: { ticketId?: string; content: string }) =>
    request<AgentChatResult>({ url: '/agent/chat', method: 'post', data }),
  processTicket: (id: string) =>
    request<AgentChatResult>({ url: `/agent/tickets/${id}/process`, method: 'post' }),
};

// ---------- hitl ----------
export const hitlApi = {
  list: (params: { status?: string; targetType?: string; page?: number; pageSize?: number }) =>
    request<PageResult<PendingConfirm>>({ url: '/hitl/pending', method: 'get', params }),
  approve: (id: string, note?: string) =>
    request<PendingConfirm>({ url: `/hitl/pending/${id}/approve`, method: 'post', data: { note } }),
  reject: (id: string, note?: string) =>
    request<PendingConfirm>({ url: `/hitl/pending/${id}/reject`, method: 'post', data: { note } }),
};

// ---------- refund keyword（退款触发词配置，归属人工确认工作台） ----------
export const refundKeywordApi = {
  list: () => request<RefundKeyword[]>({ url: '/hitl/refund-keywords', method: 'get' }),
  create: (keyword: string) =>
    request<RefundKeyword>({ url: '/hitl/refund-keywords', method: 'post', data: { keyword } }),
  toggle: (id: string) =>
    request<RefundKeyword>({ url: `/hitl/refund-keywords/${id}/toggle`, method: 'patch' }),
  remove: (id: string) => request<null>({ url: `/hitl/refund-keywords/${id}`, method: 'delete' }),
};

// ---------- trace ----------
export const traceApi = {
  list: (params: Record<string, any>) =>
    request<PageResult<AgentTrace>>({ url: '/trace', method: 'get', params }),
  stats: () => request<TraceStats>({ url: '/trace/stats', method: 'get' }),
  detail: (id: string) => request<AgentTrace>({ url: `/trace/${id}`, method: 'get' }),
};

// ---------- tools ----------
export const toolsApi = {
  list: () => request<ToolDefinition[]>({ url: '/tools', method: 'get' }),
  execute: (name: string, args: Record<string, any>) =>
    request<{ ok: boolean; name: string; message: string; data?: Record<string, any> }>({
      url: '/tools/execute',
      method: 'post',
      data: { name, arguments: args },
    }),
};
