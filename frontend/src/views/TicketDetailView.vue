<template>
  <div v-loading="loading" class="detail-wrap">
    <div class="back-bar">
      <el-button link :icon="ArrowLeft" @click="$router.back()">返回</el-button>
    </div>

    <template v-if="ticket">
      <div class="detail-top">
        <div class="page-card detail-info">
          <div class="info-head">
            <h2 class="ticket-title">{{ ticket.title }}</h2>
            <el-tag :type="statusTag(ticket.status)" size="small">{{ TICKET_STATUS_TEXT[ticket.status] }}</el-tag>
            <el-tag v-if="ticket.aiConfidence != null" type="danger" size="small" effect="plain">
              AI 置信度 {{ (ticket.aiConfidence * 100).toFixed(0) }}%
            </el-tag>
          </div>
          <p class="ticket-content">{{ ticket.content }}</p>
          <el-descriptions :column="3" size="small" border class="ticket-desc">
            <el-descriptions-item label="优先级">{{ TICKET_PRIORITY_TEXT[ticket.priority] }}</el-descriptions-item>
            <el-descriptions-item label="意图">{{ TICKET_INTENT_TEXT[ticket.intent] }}</el-descriptions-item>
            <el-descriptions-item label="提交人">{{ ticket.createdBy?.name ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="指派">{{ ticket.assignedTo?.name ?? '未指派' }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ fmt(ticket.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="AI 处理次数">{{ ticket.aiLogs?.length ?? 0 }}</el-descriptions-item>
          </el-descriptions>

          <!-- 坐席/管理员操作区 -->
          <div v-if="auth.isAgent" class="agent-ops">
            <el-button type="primary" :icon="MagicStick" :loading="processing" @click="runAgent">
              AI 智能处理
            </el-button>
            <el-select
              :model-value="ticket.status"
              style="width: 150px"
              size="small"
              placeholder="状态"
              @change="changeStatus"
            >
              <el-option v-for="(txt, val) in TICKET_STATUS_TEXT" :key="val" :label="txt" :value="val" />
            </el-select>
            <el-select
              :model-value="ticket.assignedTo?.id ?? ''"
              style="width: 150px"
              size="small"
              clearable
              placeholder="指派坐席"
              @change="changeAssign"
            >
              <el-option v-for="u in agentUsers" :key="u.id" :label="u.name" :value="u.id" />
            </el-select>
          </div>
        </div>

        <div class="page-card ai-logs" v-if="ticket.aiLogs?.length">
          <h4>AI 处理记录</h4>
          <el-timeline v-if="ticket.aiLogs">
            <el-timeline-item
              v-for="log in ticket.aiLogs"
              :key="log.id"
              :type="log.escalated ? 'danger' : 'success'"
              :timestamp="fmt(log.createdAt)"
            >
              <div>
                意图 <b>{{ TICKET_INTENT_TEXT[log.intent] }}</b>
                · 置信度 {{ (log.confidence * 100).toFixed(0) }}%
              </div>
              <div class="sp-muted">
                {{ log.escalated ? '该轮转人工处理' : 'AI 已尝试处理' }}
                <span v-if="log.knowledgeItem">· 命中 FAQ：{{ log.knowledgeItem.question }}</span>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>

      <!-- 会话时间线 -->
      <div class="page-card chat-card">
        <h4>沟通记录</h4>
        <div ref="timelineRef" class="chat-list">
          <div v-if="messages.length === 0" class="empty sp-muted">暂无消息，发送第一条消息开始沟通，或点击「AI 智能处理」。</div>
          <div v-for="m in messages" :key="m.id" class="chat-item" :class="m.senderType">
            <el-avatar :size="30" class="chat-avatar" :class="avatarClass(m.senderType)">
              {{ avatarText(m.senderType, m) }}
            </el-avatar>
            <div class="chat-body">
              <div class="chat-meta">
                <b>{{ senderName(m) }}</b>
                <span class="sp-muted" style="margin-left: 8px">{{ fmt(m.createdAt) }}</span>
              </div>
              <div class="chat-bubble">{{ m.content }}</div>
            </div>
          </div>
        </div>

        <div class="chat-input">
          <el-input
            v-model="draft"
            type="textarea"
            :rows="2"
            placeholder="输入消息（终端用户补充说明 / 坐席人工回复）"
            @keydown.ctrl.enter="send"
          />
          <el-button type="primary" :loading="sending" @click="send">发送</el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, MagicStick } from '@element-plus/icons-vue';
import { agentApi, ticketsApi, usersApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import {
  TICKET_STATUS_TEXT, TICKET_PRIORITY_TEXT, TICKET_INTENT_TEXT,
} from '@/types';
import type { Ticket, MessageItem, TicketStatus, User } from '@/types';

const route = useRoute();
const auth = useAuthStore();
const ticketId = route.params.id as string;

const loading = ref(false);
const processing = ref(false);
const sending = ref(false);
const ticket = ref<Ticket | null>(null);
const messages = ref<MessageItem[]>([]);
const draft = ref('');
const agentUsers = ref<User[]>([]);
const timelineRef = ref<HTMLElement>();

async function load() {
  loading.value = true;
  try {
    const [detail, msgs] = await Promise.all([ticketsApi.detail(ticketId), ticketsApi.messages(ticketId)]);
    ticket.value = detail;
    messages.value = msgs;
    if (auth.isAgent) loadAgents();
    scrollBottom();
  } finally {
    loading.value = false;
  }
}

async function loadAgents() {
  if (auth.isAdmin) {
    const res = await usersApi.list({ page: 1, pageSize: 100 });
    agentUsers.value = (res.list as User[]).filter((u) => u.role !== 'end_user');
  } else {
    // 坐席视图：从工单指派人可见（简化：加载全部用户列表需 admin，此处仅保留当前指派展示）
    agentUsers.value = [];
  }
}

async function runAgent() {
  processing.value = true;
  try {
    const result = await agentApi.processTicket(ticketId);
    if (result.pending) {
      ElMessage.info('AI 已提交退款审核申请，请在「人工确认」中处理');
    } else if (result.escalated) {
      ElMessage.warning('AI 无法完全处理，已转人工坐席');
    } else {
      ElMessage.success('AI 已完成处理');
    }
    await load();
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    processing.value = false;
  }
}

async function send() {
  const content = draft.value.trim();
  if (!content) return;
  sending.value = true;
  try {
    await ticketsApi.sendMessage(ticketId, content);
    draft.value = '';
    const msgs = await ticketsApi.messages(ticketId);
    messages.value = msgs;
    scrollBottom();
  } finally {
    sending.value = false;
  }
}

async function changeStatus(status: TicketStatus) {
  try {
    await ticketsApi.update(ticketId, { status });
    ElMessage.success('状态已更新');
    await load();
  } catch {
    /* ignore */
  }
}

async function changeAssign(id: string | undefined) {
  try {
    await ticketsApi.assign(ticketId, id || null);
    ElMessage.success(id ? '已指派坐席' : '已取消指派');
    await load();
  } catch {
    /* ignore */
  }
}

function scrollBottom() {
  nextTick(() => {
    const el = timelineRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function fmt(v?: string) {
  return v ? v.replace('T', ' ').slice(0, 16) : '';
}
function statusTag(s: TicketStatus): any {
  return { open: 'info', ai_handling: 'warning', escalated: 'danger', resolved: 'success', closed: 'info' }[s];
}
function senderName(m: MessageItem) {
  if (m.senderType === 'ai') return 'AI 智能助手';
  if (m.senderType === 'agent') return m.senderName ? `坐席 · ${m.senderName}` : '人工坐席';
  return m.senderName ?? '用户';
}
function avatarText(type: MessageItem['senderType'], raw: MessageItem) {
  if (type === 'ai') return 'AI';
  return (raw.senderName ?? '用').slice(0, 1);
}
function avatarClass(t: MessageItem['senderType']) {
  return { ai: 'sp-brand-gradient', user: 'avatar-gray', agent: 'avatar-blue' }[t];
}

onMounted(() => {
  load();
});
</script>

<style scoped>
.detail-wrap {
  max-width: 1080px;
  margin: 0 auto;
}
.back-bar {
  margin-bottom: 8px;
}
.detail-top {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 14px;
  align-items: start;
  margin-bottom: 14px;
}
.ticket-title {
  margin: 0;
  font-size: 19px;
}
.info-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.ticket-content {
  color: var(--sp-text-secondary);
  background: #fafbfc;
  border-radius: 8px;
  padding: 10px 12px;
  line-height: 1.7;
}
.ticket-desc {
  margin-top: 12px;
}
.agent-ops {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.ai-logs h4,
.chat-card h4 {
  margin: 0 0 12px;
}
.chat-card {
  display: flex;
  flex-direction: column;
}
.chat-list {
  max-height: 420px;
  overflow: auto;
  padding: 6px 2px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty {
  text-align: center;
  padding: 30px 0;
}
.chat-item {
  display: flex;
  gap: 10px;
  max-width: 78%;
}
.chat-item.ai {
  align-self: flex-start;
}
.chat-item.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}
.chat-item.agent {
  align-self: flex-start;
}
.chat-avatar {
  flex: none;
}
.avatar-gray {
  background: #8a919b;
  color: #fff;
}
.avatar-blue {
  background: #2f6fed;
  color: #fff;
}
.chat-meta {
  font-size: 12px;
  margin-bottom: 3px;
}
.chat-bubble {
  background: #f0f2f5;
  border-radius: 10px;
  padding: 8px 12px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-item.user .chat-bubble {
  background: var(--el-color-primary-light-9);
}
.chat-input {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  margin-top: 14px;
}
</style>
