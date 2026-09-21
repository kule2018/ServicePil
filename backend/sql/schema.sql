-- ============================================================
-- ServicePilot 智能工单处理 Agent · 数据库 DDL（参考实现）
-- MySQL 8.0+ / utf8mb4
-- 说明：开发环境默认由 TypeORM synchronize=true 自动建表；
--       本文件用于「手动建库」或生产环境人工校对，与实体保持一致。
-- ============================================================

CREATE DATABASE IF NOT EXISTS servicepilot DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE servicepilot;

-- ---------- 用户表 ----------
CREATE TABLE IF NOT EXISTS `user` (
  `id`          VARCHAR(36)  NOT NULL COMMENT 'UUID',
  `name`        VARCHAR(100) NOT NULL COMMENT '姓名',
  `email`       VARCHAR(180) NOT NULL COMMENT '邮箱(登录标识)',
  `password`    VARCHAR(100) NOT NULL COMMENT 'bcrypt 哈希',
  `role`        ENUM('end_user','agent','admin') NOT NULL DEFAULT 'end_user',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`  DATETIME     NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户';

-- ---------- 工单表 ----------
CREATE TABLE IF NOT EXISTS `ticket` (
  `id`            VARCHAR(36)  NOT NULL,
  `title`         VARCHAR(200) NOT NULL COMMENT '工单标题',
  `content`       TEXT         NOT NULL COMMENT '问题描述',
  `priority`      ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  `status`        ENUM('open','ai_handling','escalated','resolved','closed') NOT NULL DEFAULT 'open',
  `intent`        ENUM('billing','technical','complaint','account','other') NOT NULL DEFAULT 'other',
  `aiConfidence`  DECIMAL(3,2) NULL COMMENT 'AI 置信度 0~1',
  `created_by`    VARCHAR(36)  NOT NULL COMMENT '提交人',
  `assigned_to`   VARCHAR(36)  NULL COMMENT '指派的坐席/管理员',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME     NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ticket_created_by` (`created_by`),
  KEY `idx_ticket_assigned` (`assigned_to`),
  KEY `idx_ticket_status` (`status`),
  CONSTRAINT `fk_ticket_creator` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_ticket_assignee` FOREIGN KEY (`assigned_to`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工单';

-- ---------- 会话表（每工单一条时间线） ----------
CREATE TABLE IF NOT EXISTS `conversation` (
  `id`          VARCHAR(36) NOT NULL,
  `ticket_id`   VARCHAR(36) NOT NULL,
  `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`  DATETIME    NULL,
  PRIMARY KEY (`id`),
  KEY `idx_conversation_ticket` (`ticket_id`),
  CONSTRAINT `fk_conversation_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话时间线';

-- ---------- 消息表 ----------
CREATE TABLE IF NOT EXISTS `message` (
  `id`              VARCHAR(36) NOT NULL,
  `conversation_id` VARCHAR(36) NOT NULL,
  -- 注意：TypeORM 默认命名策略不对列名做 snake_case 转换，未显式指定 name 的列沿用属性名（驼峰）
  `senderType`      ENUM('user','ai','agent') NOT NULL COMMENT '发送方类型',
  `sender_id`       VARCHAR(36) NULL COMMENT 'user/agent 的用户 ID；AI 消息为空',
  `content`         TEXT        NOT NULL,
  `created_at`      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`      DATETIME    NULL,
  PRIMARY KEY (`id`),
  KEY `idx_message_conversation` (`conversation_id`),
  CONSTRAINT `fk_message_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversation` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话消息';

-- ---------- FAQ 知识条目 ----------
CREATE TABLE IF NOT EXISTS `knowledge_item` (
  `id`          VARCHAR(36) NOT NULL,
  `intent`      ENUM('billing','technical','complaint','account','other') NOT NULL,
  `question`    VARCHAR(300) NOT NULL,
  `answer`      TEXT         NOT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`  DATETIME     NULL,
  PRIMARY KEY (`id`),
  KEY `idx_knowledge_intent` (`intent`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='FAQ知识条目';

-- ---------- RAG 原始文档 ----------
CREATE TABLE IF NOT EXISTS `document` (
  `id`          VARCHAR(36) NOT NULL,
  `title`       VARCHAR(200) NOT NULL,
  `content`     MEDIUMTEXT   NOT NULL,
  `source`      VARCHAR(300) NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`  DATETIME     NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='RAG文档';

-- ---------- 文档切片（含向量 JSON） ----------
CREATE TABLE IF NOT EXISTS `document_chunk` (
  `id`           VARCHAR(36) NOT NULL,
  `document_id`  VARCHAR(36) NOT NULL,
  `chunk_index`  INT         NOT NULL,
  `text`         TEXT        NOT NULL,
  `embedding`    JSON        NULL COMMENT '向量数组 JSON',
  `created_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`   DATETIME    NULL,
  PRIMARY KEY (`id`),
  KEY `idx_chunk_document` (`document_id`),
  CONSTRAINT `fk_chunk_document` FOREIGN KEY (`document_id`) REFERENCES `document` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文档切片';

-- ---------- AI 处理日志 ----------
CREATE TABLE IF NOT EXISTS `ai_processing_log` (
  `id`                VARCHAR(36) NOT NULL,
  `ticket_id`         VARCHAR(36) NOT NULL,
  `intent`            ENUM('billing','technical','complaint','account','other') NOT NULL,
  `confidence`        DECIMAL(3,2) NOT NULL,
  `knowledge_item_id` VARCHAR(36) NULL COMMENT '命中的 FAQ',
  `escalated`         TINYINT(1)  NOT NULL DEFAULT 0,
  `created_at`        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`        DATETIME    NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ailog_ticket` (`ticket_id`),
  KEY `idx_ailog_knowledge` (`knowledge_item_id`),
  CONSTRAINT `fk_ailog_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ailog_knowledge` FOREIGN KEY (`knowledge_item_id`) REFERENCES `knowledge_item` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI处理日志';

-- ---------- HITL 待人工确认 ----------
CREATE TABLE IF NOT EXISTS `pending_confirm` (
  `id`           VARCHAR(36) NOT NULL,
  `ticket_id`    VARCHAR(36) NULL,
  `target_type`  ENUM('reply','refund','status_change') NOT NULL,
  `payload`      JSON        NOT NULL COMMENT '待执行动作参数快照',
  `reason`       VARCHAR(500) NULL,
  `status`       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `handler_id`   VARCHAR(36) NULL,
  `handler_note` VARCHAR(500) NULL,
  `decided_at`   DATETIME    NULL,
  `created_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`   DATETIME    NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pending_ticket` (`ticket_id`),
  KEY `idx_pending_status` (`status`),
  CONSTRAINT `fk_pending_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='待人工确认';

-- ---------- 退款 / 赔付触发词配置 ----------
CREATE TABLE IF NOT EXISTS `refund_keyword` (
  `id`          VARCHAR(36)  NOT NULL COMMENT 'UUID',
  `keyword`     VARCHAR(50)  NOT NULL COMMENT '触发词（如 退款/全额退/退钱/赔付/赔偿）',
  `enabled`     TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '1=启用 0=禁用',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`  DATETIME     NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_keyword` (`keyword`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='退款触发词配置';

-- ---------- Agent Trace ----------
CREATE TABLE IF NOT EXISTS `agent_trace` (
  `id`           VARCHAR(36) NOT NULL,
  `ticket_id`    VARCHAR(36) NULL,
  `thread_id`    VARCHAR(64) NULL,
  `query`        TEXT        NOT NULL,
  `intent`       VARCHAR(30) NULL,
  `nodes`        JSON        NULL COMMENT '节点链',
  `references`   JSON        NULL COMMENT '召回片段',
  `toolCalls`    JSON        NULL COMMENT '工具调用记录',
  `escalated`    TINYINT(1)  NOT NULL DEFAULT 0,
  `llm_model`    VARCHAR(100) NULL,
  `token_usage`  INT         NULL,
  `latency_ms`   INT         NULL,
  `success`      TINYINT(1)  NOT NULL DEFAULT 1,
  `error`        TEXT        NULL,
  `created_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`   DATETIME    NULL,
  PRIMARY KEY (`id`),
  KEY `idx_trace_ticket` (`ticket_id`),
  KEY `idx_trace_thread` (`thread_id`),
  KEY `idx_trace_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Agent执行轨迹';
