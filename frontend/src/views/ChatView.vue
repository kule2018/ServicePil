<template>
  <div class="chat-view">
    <div class="page-card chat-panel">
      <div class="chat-head">
        <div>
          <h3 style="margin: 0">AI 智能客服</h3>
          <div class="sp-muted">基于知识库 RAG + Agent 工作流，为您实时解答（演示默认 Mock 模型）</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px">
          <el-tag size="small" type="danger" effect="light" round>{{ agentState ? '运行中' : '在线' }}</el-tag>
          <el-button size="small" text :icon="Delete" @click="clearChat">清空</el-button>
        </div>
      </div>

      <!-- 会话区 -->
      <div ref="chatBoxRef" class="chat-box">
        <div class="welcome" v-if="messages.length === 0">
          <el-avatar :size="52" class="sp-brand-gradient welcome-avatar">AI</el-avatar>
          <p>您好，我是 ServicePilot 智能客服助手 👋</p>
          <p class="sp-muted">可以问我退款政策、产品使用、账号问题，也可以让我处理一张工单。</p>
          <div class="chips">
            <el-tag v-for="q in quickQuestions" :key="q" class="chip" effect="plain" type="danger" @click="ask(q)">
              {{ q }}
            </el-tag>
          </div>
        </div>

        <div v-for="m in messages" :key="m.id" class="msg" :class="m.role">
          <el-avatar :size="32" class="msg-avatar" :class="m.role === 'ai' ? 'sp-brand-gradient' : 'avatar-gray'">
            {{ m.role === 'ai' ? 'AI' : (auth.user?.name ?? '我').slice(0, 1) }}
          </el-avatar>
          <div class="msg-body">
            <div class="msg-bubble">{{ m.content }}</div>
            <div v-if="m.extra && m.extra.length" class="refs">
              <div class="refs-title">📎 召回依据 ({{ m.extra.length }})</div>
              <div v-for="(r, i) in m.extra" :key="i" class="ref-item">{{ r }}</div>
            </div>
            <div v-if="m.note" class="note">{{ m.note }}</div>
          </div>
        </div>

        <div v-if="loading" class="msg ai typing">
          <el-avatar :size="32" class="msg-avatar sp-brand-gradient">AI</el-avatar>
          <div class="msg-body">
            <div class="msg-bubble typing-text">
              <span></span><span></span><span></span> Agent 思考中…
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="chat-input-bar">
        <el-input
          v-model="draft"
          type="textarea"
          :rows="2"
          resize="none"
          placeholder="输入问题，例如：如何申请退款？客户端闪退怎么办？"
          @keydown.ctrl.enter="send"
        />
        <el-button type="primary" :icon="Promotion" :loading="loading" @click="send">发送</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { Delete, Promotion } from '@element-plus/icons-vue';
import { agentApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import type { AgentChatResult } from '@/types';

const auth = useAuthStore();
const draft = ref('');
const loading = ref(false);
const agentState = ref(false);
const chatBoxRef = ref<HTMLElement>();

interface ChatMsg {
  id: number;
  role: 'user' | 'ai';
  content: string;
  extra?: string[];
  note?: string;
}
const messages = ref<ChatMsg[]>([]);
let seq = 0;

const quickQuestions = [
  '如何申请退款？多久能到账？',
  '客户端安装后闪退怎么办？',
  '忘记密码如何重置？',
  '怎么取消自动续费？',
];

function ask(q: string) {
  draft.value = q;
  send();
}

async function send() {
  const content = draft.value.trim();
  if (!content || loading.value) return;
  messages.value.push({ id: ++seq, role: 'user', content });
  draft.value = '';
  loading.value = true;
  agentState.value = true;
  scrollBottom();
  try {
    const result = (await agentApi.chat({ content })) as AgentChatResult;
    const notes: string[] = [];
    if (result.references?.length) {
      notes.push('已检索知识库');
    }
    if (result.escalated) notes.push('本次将转交人工坐席跟进');
    if (result.nodes?.length) notes.push(`工作流节点：${result.nodes.join(' → ')}`);
    messages.value.push({
      id: ++seq,
      role: 'ai',
      content:
        result.reply ??
        '抱歉，这个问题需要人工坐席协助处理。您可以提交一张工单，或稍后在「工单管理」中跟进。',
      extra: result.references ?? [],
      note: notes.join(' · '),
    });
    scrollBottom();
  } finally {
    loading.value = false;
    agentState.value = false;
  }
}

function clearChat() {
  messages.value = [];
}

function scrollBottom() {
  nextTick(() => {
    const el = chatBoxRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

onMounted(() => {
  scrollBottom();
});
</script>

<style scoped>
.chat-view {
  max-width: 880px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 92px);
}
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 18px;
}
.chat-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--sp-border);
  padding-bottom: 12px;
}
.chat-box {
  flex: 1;
  overflow-y: auto;
  padding: 16px 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.welcome {
  text-align: center;
  margin-top: 40px;
}
.welcome-avatar {
  font-weight: 800;
  font-size: 22px;
}
.welcome p {
  margin: 8px 0 2px;
}
.chips {
  margin-top: 14px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  cursor: pointer;
  padding: 4px 10px;
}
.msg {
  display: flex;
  gap: 10px;
  max-width: 86%;
}
.msg.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}
.msg.ai {
  align-self: flex-start;
}
.msg-avatar {
  flex: none;
  font-weight: 700;
}
.avatar-gray {
  background: #8a919b;
  color: #fff;
}
.msg-bubble {
  background: #f0f2f5;
  border-radius: 12px;
  padding: 9px 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg.user .msg-bubble {
  background: var(--el-color-primary-light-9);
}
.refs {
  margin-top: 6px;
  background: #fffbf2;
  border: 1px dashed #f0d9a8;
  border-radius: 8px;
  padding: 6px 10px;
}
.refs-title {
  font-size: 12px;
  color: #b98a2f;
}
.ref-item {
  font-size: 12px;
  color: var(--sp-text-secondary);
  margin-top: 3px;
  line-height: 1.5;
  word-break: break-all;
}
.note {
  margin-top: 4px;
  font-size: 12px;
  color: #9a6700;
}
.typing-text span {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 3px;
  border-radius: 50%;
  background: var(--sp-primary);
  animation: blink 1.2s infinite;
}
.typing-text span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing-text span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}
.chat-input-bar {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  border-top: 1px solid var(--sp-border);
  padding-top: 12px;
}
</style>
