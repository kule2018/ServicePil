# ServicePilot · 智能工单处理 Agent（完整可运行工程）


> 技术栈：**Vue3 + Element Plus** 前端 · **NestJS + TypeORM + MySQL** 后端 · **LLM/Embedding 可配置接入点**（无 Key 默认 Mock，全流程可跑通）。

---

## ✨ 核心能力

| 能力 | 说明 |
| --- | --- |
| 工单全生命周期 | 创建 → AI 意图识别/置信度 → AI 自动处理 → 转人工 → 解决/关闭 |
| RAG 混合检索 | FAQ 条目 + 文档「切片 + 向量化」，**BM25 + 余弦相似度 + RRF 融合** |
| Agent 工作流 | `classify → retrieve → decide(工具) → draft → review → execute/escalate` |
| 工具调用 | 查工单 / 查 FAQ / 创建退款 / 升级转人工 / 改状态（注册表 + JSON Schema） |
| Human-in-the-loop | 退款等高风险写操作先挂起，坐席在「人工确认」工作台审批/驳回 |
| AI 可观测性 | 每次执行写 `agent_trace`：节点链、工具调用、Token、耗时、召回依据 |
| 白 + 红主题 | 品牌红主色、白色卡片布局 |

---

## 🚀 快速启动

### 方式 A：本地开发（推荐学习用）

前置：Node ≥ 20、MySQL 8（本地 3306），首次使用 `cd backend && npm i && cd ../frontend && npm i`。

```bash
# 1. 启动数据库（Docker 方式，或用本机 MySQL）
docker run -d --name sp-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=123456 \
  -e MYSQL_DATABASE=servicepilot mysql:8.0

# 2. 启动后端（首次启动自动同步表结构 + 写入种子数据）
cd backend
cp .env.example .env      # 按需调整；LLM_PROVIDER 默认 mock 无需改
npm run start:dev         # http://localhost:3000/api/v1

# 3. 启动前端（另开终端）
cd frontend
npm run dev               # http://localhost:5173（/api 已代理到 3000）
```

### 方式 B：Docker Compose 一键部署

```bash
docker compose up -d --build
# 前端 http://localhost:8080 · 后端 http://localhost:3000/api/v1
# 停止：docker compose down -v  （-v 会连同数据卷一起删除）
```

---

## 🔑 演示账号（SeedService 自动写入，幂等）

| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| 管理员 | `admin@servicepilot.dev` | `admin123` |
| 坐席 | `agent@servicepilot.dev` | `agent123` |
| 终端用户 | `alice@example.com` / `bob@example.com` | `user123` |

> 建议体验路径：
> 1. 用 **alice** 登录 → 打开种子工单「申请退款」→ 点 **AI 智能处理** → 观察生成退款待确认任务；
> 2. 切 **agent** 登录 → 「人工确认」审批通过 → 切回 alice 看工单变为已解决、时间线收到退款通知；
> 3. 用 **admin** 看「AI 监控」中的完整 Trace（节点链/召回/工具调用）。

---

## 🔌 LLM / Embedding 接入

无任何 API Key 也能跑通全部演示（内置 Mock 规则 LLM + Mock Embedding）。接入真实模型只需修改 `backend/.env`：

```env
# 可选值 mock | openai（兼容 OpenAI / DeepSeek / 通义 / 智谱 等任意 OpenAI 协议网关）
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxxx
LLM_MODEL=gpt-4o-mini

EMBEDDING_PROVIDER=openai        # mock 已够演示，追求真实语义召回时切换
EMBEDDING_MODEL=text-embedding-3-small

HITL_ENABLED=true                # false 时退款自动放行（演示开关）
SEED_ENABLED=true                # 启动写种子数据（幂等）
```

---

## 📁 工程结构

```
ServicePilot-完整工程/
├── docker-compose.yml           # MySQL + backend + frontend 一键编排
├── backend/                     # NestJS + TypeORM + MySQL
│   ├── .env.example
│   ├── sql/schema.sql           # 手动建库参考 DDL（开发默认 synchronize）
│   └── src/
│       ├── main.ts              # 全局管道/拦截器/过滤器/CORS
│       ├── app.module.ts        # 模块装配
│       ├── config/              # 集中配置工厂（读 .env）
│       ├── entities/            # 10 张表实体（用户/工单/会话/消息/FAQ/文档/切片/AI日志/待确认/Trace）
│       ├── common/              # Jwt/Roles Guard、当前用户装饰器、统一响应/异常、幂等拦截器
│       ├── ai/                  # LLM & Embedding 抽象 + Mock/OpenAI 实现 + Provider 工厂
│       │   └── rag/             # 中文切片 / BM25 / 向量 / RRF 工具
│       └── modules/             # database/auth/users/tickets/rag/tools/agent/hitl/trace/seed
└── frontend/                    # Vue3 + Vite + Element Plus + Pinia
    └── src/
        ├── api/                 # Axios 实例（Token 注入/统一拦截）+ 模块化 API
        ├── layouts/MainLayout   # 白+红侧边栏、角色化菜单、待确认角标轮询
        ├── stores/auth.ts       # 登录态
        ├── router/              # 路由 + 登录/角色守卫
        ├── styles/theme.css     # 白+红主题变量（覆盖 Element Plus 主色）
        └── views/               # 登录/工作台/工单列表/详情/AI客服/人工确认/知识库/AI监控/用户管理
```

---

## 🌐 API 速览（前缀 `/api/v1`，JWT `Authorization: Bearer <token>`）

| 模块 | 端点 | 说明 |
| --- | --- | --- |
| auth | `POST /auth/register` `POST /auth/login` `GET /auth/me` | 注册/登录/当前用户 |
| users | `GET /users` `PATCH /users/:id/role` | 用户列表/角色（admin） |
| tickets | `POST /tickets` `GET /tickets` `GET /tickets/:id` | 创建 / 列表 / 详情（角色可见） |
| tickets | `GET /tickets/:id/messages` `POST /tickets/:id/messages` | 时间线消息 |
| tickets | `PATCH /tickets/:id` `PATCH /tickets/:id/assign` | 状态/指派（agent+） |
| rag | `POST /rag/documents` `GET /rag/documents` `DELETE /rag/documents/:id` | RAG 文档（切片+向量化） |
| rag | `GET/POST/PATCH/DELETE /rag/knowledge-items` `POST /rag/search` | FAQ 管理 + 混合检索调试 |
| agent | `POST /agent/chat` | 独立问答 / 工单上下文问答 |
| agent | `POST /agent/tickets/:id/process` | 对工单执行一次 AI 处理 |
| hitl | `GET /hitl/pending` `POST /hitl/pending/:id/approve` `POST /hitl/pending/:id/reject` | 人工确认工作台 |
| trace | `GET /trace` `GET /trace/stats` `GET /trace/:id` | AI 执行轨迹/监控 |
| tools | `GET /tools` `POST /tools/execute` | 工具清单 / 手动执行 |

统一响应：`{ "code": 0, "message": "success", "data": ... }`；业务/异常错误 code 非 0。

---

## ✅ 已验证（构建 + 端到端冒烟）

| 校验项 | 结果 |
| --- | --- |
| 后端 TypeScript 编译（`tsc -p tsconfig.build.json`） | 通过，0 错误 |
| 前端 `vue-tsc --noEmit` 类型检查 | 通过，0 错误 |
| 前端 `vite build` 生产构建 | 通过，1699 模块 |
| 编译产物加载冒烟 | 68 个 JS 模块全部加载成功，Nest DI 容器完整初始化 |
| 端到端业务冒烟（SQLite 内存库替身） | **34 项断言全部通过** |

端到端冒烟覆盖：种子数据写入 → 注册/登录/鉴权 → RAG 混合检索（向量 + BM25 + RRF）→
Agent 工作流（分类 → 检索 → 草稿 → 评审 → 工具/HITL）→ 人工审批闭环 → Trace 统计 → 工单 CRUD。
冒烟中定位并修复了两个真实缺陷：

1. **Mock LLM 场景路由误判**：质量评审请求携带的草稿原文常含「资料/客服」等词，被误判为「回复生成」，
   导致评审分数解不出而恒为 0 —— 表现为**所有工单都被转人工**。已将评审分支前置判断。
2. **转人工分支缺工单上下文**：独立问答（无工单）时仍调用 `escalate_ticket` 工具，因缺少 `ticketId` 抛异常，
   整个问答返回空回复。现改为：无工单上下文时不调工具，直接返回引导建议；转人工时也返回明确文案供前端展示。

## ⚠️ 说明与后续建议

- 本工程聚焦「业务代码完整可跑」，向量检索为**内存 RRF 演示实现**；生产可平滑替换 MySQL 向量函数 / Milvus / pgvector。
- 幂等拦截器为内存 Map 版（头部 `X-Idempotency-Key`），多实例生产请换 Redis。
- 会话消息当前为**短轮询**刷新，生产可升级 SSE/WebSocket 流式。
- 教程各章更多演进（流式输出、埋点评估、多 Agent 协作、Redis 缓存等）可在原章节文档中继续对照学习。


