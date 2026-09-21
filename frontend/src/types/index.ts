/**
 * 全局类型：与后端实体 / 枚举保持一致
 */

// ---------- 枚举 ----------
export type UserRole = 'end_user' | 'agent' | 'admin';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'ai_handling' | 'escalated' | 'resolved' | 'closed';
export type TicketIntent = 'billing' | 'technical' | 'complaint' | 'account' | 'other';
export type SenderType = 'user' | 'ai' | 'agent';

export const TICKET_STATUS_TEXT: Record<TicketStatus, string> = {
  open: '待处理',
  ai_handling: 'AI 处理中',
  escalated: '已转人工',
  resolved: '已解决',
  closed: '已关闭',
};

export const TICKET_PRIORITY_TEXT: Record<TicketPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

export const TICKET_INTENT_TEXT: Record<TicketIntent, string> = {
  billing: '费用/退款',
  technical: '产品技术',
  complaint: '投诉',
  account: '账号',
  other: '其他',
};

export const ROLE_TEXT: Record<UserRole, string> = {
  end_user: '终端用户',
  agent: '坐席',
  admin: '管理员',
};

// ---------- 基础响应 ----------
export interface ApiResp<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- 实体 ----------
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export interface Ticket {
  id: string;
  title: string;
  content: string;
  priority: TicketPriority;
  status: TicketStatus;
  intent: TicketIntent;
  aiConfidence?: number | null;
  createdAt: string;
  createdBy?: User;
  assignedTo?: User | null;
  aiLogs?: AiProcessingLog[];
}

export interface MessageItem {
  id: string;
  senderType: SenderType;
  senderId?: string | null;
  senderName?: string | null;
  content: string;
  createdAt: string;
}

export interface KnowledgeItem {
  id: string;
  intent: TicketIntent;
  question: string;
  answer: string;
  createdAt?: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  source?: string | null;
  chunkCount?: number;
  createdAt?: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  embedding?: number[] | null;
}

export interface AiProcessingLog {
  id: string;
  intent: TicketIntent;
  confidence: number;
  escalated: boolean;
  createdAt: string;
  knowledgeItem?: KnowledgeItem | null;
}

export interface PendingConfirm {
  id: string;
  ticketId?: string | null;
  ticketTitle?: string | null;
  ticketStatus?: TicketStatus | null;
  targetType: 'reply' | 'refund' | 'status_change';
  payload: Record<string, any>;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  handlerId?: string | null;
  handlerNote?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface AgentTrace {
  id: string;
  ticketId?: string | null;
  threadId?: string | null;
  query: string;
  intent?: string | null;
  nodes?: string[] | null;
  references?: string[] | null;
  toolCalls?: Array<{ name: string; args: Record<string, any>; result?: string }> | null;
  escalated: boolean;
  llmModel?: string | null;
  tokenUsage?: number | null;
  latencyMs?: number | null;
  success: boolean;
  error?: string | null;
  createdAt: string;
}

export interface AgentChatResult {
  reply: string | null;
  escalated: boolean;
  pending?: { id: string; targetType: string; status: string } | null;
  references: string[];
  intent?: string;
  confidence?: number;
  traceId: string;
  nodes: string[];
  toolCalls: Array<{ name: string; args: Record<string, any>; result?: string }>;
}

export interface RefundKeyword {
  id: string;
  keyword: string;
  enabled: boolean;
  createdAt?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean; enum?: string[] }>;
}

export interface RagSnippet {
  text: string;
  source: 'faq' | 'document';
  docTitle?: string;
  score: number;
}

// ---------- 聚合响应 ----------

/** GET /tickets/stats：工单状态计数 */
export interface TicketStats {
  total: number;
  byStatus: Record<string, number>;
}

/** GET /trace/stats：Agent 运行统计 */
export interface TraceStats {
  total: number;
  escalated: number;
  escalateRate: number;
  avgLatencyMs: number;
  totalTokens: number;
}

/** POST /rag/search：混合检索结果 */
export interface RagSearchResult {
  query: string;
  snippets: RagSnippet[];
  hitFaq: KnowledgeItem | null;
}

/** 登录 / 注册返回 */
export interface AuthResult {
  token: string;
  user: User;
}
