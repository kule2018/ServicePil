/**
 * ServicePilot 全局枚举定义
 * 与数据库 ENUM 列、TypeORM 实体共用，保证三层一致
 */

/** 工单优先级 */
export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/** 工单状态 */
export enum TicketStatus {
  OPEN = 'open',
  AI_HANDLING = 'ai_handling',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

/** 工单意图（AI 意图识别产出） */
export enum TicketIntent {
  BILLING = 'billing',
  TECHNICAL = 'technical',
  COMPLAINT = 'complaint',
  ACCOUNT = 'account',
  OTHER = 'other',
}

/** 用户角色 */
export enum UserRole {
  END_USER = 'end_user',
  AGENT = 'agent',
  ADMIN = 'admin',
}

/** 消息发送方类型 */
export enum SenderType {
  USER = 'user',
  AI = 'ai',
  AGENT = 'agent',
}

/** 工单查询/列表筛选时使用的状态可选项 */
export const TICKET_STATUS_LIST = Object.values(TicketStatus);
export const TICKET_INTENT_LIST = Object.values(TicketIntent);
export const TICKET_PRIORITY_LIST = Object.values(TicketPriority);
