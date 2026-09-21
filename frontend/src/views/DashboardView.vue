<template>
  <div>
    <!-- 问候横幅 -->
    <div class="hello-bar sp-brand-gradient">
      <div>
        <h2>你好，{{ auth.user?.name ?? '同学' }} 👋</h2>
        <p>这是 ServicePilot 智能工单 Agent 的运营工作台，汇总工单、AI 处理与人工介入情况。</p>
      </div>
      <el-button round class="hello-btn" @click="$router.push('/chat')">去和 AI 客服聊聊 →</el-button>
    </div>

    <!-- 指标卡 -->
    <div class="kpi-row">
      <div class="kpi-card" v-for="k in kpis" :key="k.label" @click="go(k.path)">
        <div class="kpi-num" :style="{ color: k.color }">{{ k.value }}</div>
        <div class="kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <div class="dash-grid">
      <!-- 近期工单 -->
      <div class="page-card">
        <div class="card-head">
          <h4>近期工单</h4>
          <el-link type="primary" @click="$router.push('/tickets')">查看全部</el-link>
        </div>
        <el-table :data="recent" size="small">
          <el-table-column label="标题" min-width="180">
            <template #default="{ row }">
              <el-link type="primary" @click="$router.push(`/tickets/${row.id}`)">{{ row.title }}</el-link>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="tag(row.status)" size="small">{{ TICKET_STATUS_TEXT[row.status as TicketStatus] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="提交人" prop="createdBy.name" width="90" />
          <el-table-column label="时间" width="150">
            <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 快捷入口 + Agent 运行态 -->
      <div class="right-col">
        <div class="page-card">
          <h4>快捷入口</h4>
          <div class="quick-grid">
            <div v-for="q in quickLinks" :key="q.title" class="quick-item" @click="$router.push(q.path)">
              <el-icon :size="22" color="#d81e06"><component :is="q.icon" /></el-icon>
              <div>{{ q.title }}</div>
            </div>
          </div>
        </div>

        <div class="page-card" v-if="auth.isAgent">
          <h4>AI 运行状态</h4>
          <div class="trace-mini">
            <div>累计执行 <b>{{ traceStats.total ?? 0 }}</b> 次</div>
            <div>转人工率 <b>{{ traceStats.escalateRate ?? 0 }}%</b></div>
            <div>平均耗时 <b>{{ traceStats.avgLatencyMs ?? 0 }}ms</b></div>
            <el-button type="primary" size="small" plain style="margin-top: 8px" @click="$router.push('/trace')">查看 AI 监控</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Tickets, ChatDotRound, Finished, Collection, Monitor, Plus } from '@element-plus/icons-vue';
import { ticketsApi, traceApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { TICKET_STATUS_TEXT } from '@/types';
import type { Ticket, TicketStatus } from '@/types';

const router = useRouter();
const auth = useAuthStore();
const recent = ref<Ticket[]>([]);
const traceStats = ref<any>({});
const ticketStats = ref<{ total: number; byStatus: Record<string, number> }>({ total: 0, byStatus: {} });

const kpis = computed(() => [
  { label: '全部工单', value: ticketStats.value.total ?? 0, color: '#2f6fed', path: '/tickets' },
  { label: '待处理', value: ticketStats.value.byStatus?.['open'] ?? 0, color: '#7a7f87', path: '/tickets' },
  { label: 'AI 处理中', value: ticketStats.value.byStatus?.['ai_handling'] ?? 0, color: '#e6a23c', path: '/tickets' },
  { label: '待人工介入', value: (ticketStats.value.byStatus?.['escalated'] ?? 0) + (ticketStats.value.byStatus?.['open'] ?? 0), color: '#d81e06', path: auth.isAgent ? '/hitl' : '/tickets' },
]);

const quickLinks = computed(() => {
  const base = [
    { title: '新建工单', path: '/tickets', icon: Plus },
    { title: 'AI 客服', path: '/chat', icon: ChatDotRound },
    { title: '我的工单', path: '/tickets', icon: Tickets },
  ];
  if (auth.isAgent) {
    base.push({ title: '人工确认', path: '/hitl', icon: Finished });
    base.push({ title: '知识库', path: '/knowledge', icon: Collection });
    base.push({ title: 'AI 监控', path: '/trace', icon: Monitor });
  }
  return base;
});

function tag(s: TicketStatus): any {
  return { open: 'info', ai_handling: 'warning', escalated: 'danger', resolved: 'success', closed: 'info' }[s];
}
function fmt(v: string) {
  return v ? v.replace('T', ' ').slice(0, 16) : '';
}
function go(path: string) {
  if (path) router.push(path);
}

onMounted(async () => {
  try {
    const res = await ticketsApi.list({ page: 1, pageSize: 5 });
    recent.value = res.list;
  } catch { /* ignore */ }
  try {
    const s = await ticketsApi.stats();
    if (s && s.total !== undefined) ticketStats.value = s;
  } catch { /* ignore */ }
  if (auth.isAgent) {
    try {
      traceStats.value = await traceApi.stats();
    } catch { /* ignore */ }
  }
});
</script>

<style scoped>
.hello-bar {
  border-radius: 12px;
  color: #fff;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.hello-bar h2 {
  margin: 0 0 4px;
  font-size: 20px;
}
.hello-bar p {
  margin: 0;
  opacity: 0.92;
  font-size: 13px;
}
.hello-btn {
  background: #fff;
  color: var(--sp-primary);
  border: none;
  font-weight: 600;
}
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.kpi-card {
  background: #fff;
  border-radius: 10px;
  padding: 16px 18px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(30, 34, 40, 0.05);
  transition: transform 0.15s;
}
.kpi-card:hover {
  transform: translateY(-2px);
}
.kpi-num {
  font-size: 26px;
  font-weight: 800;
}
.kpi-label {
  color: var(--sp-text-secondary);
  font-size: 13px;
  margin-top: 4px;
}
.dash-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 14px;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-head h4,
.right-col h4 {
  margin: 0 0 12px;
}
.right-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 4px;
  border: 1px solid var(--sp-border);
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.quick-item:hover {
  border-color: var(--sp-primary);
  color: var(--sp-primary);
}
.trace-mini {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--sp-text-secondary);
}
</style>
