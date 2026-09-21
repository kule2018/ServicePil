<template>
  <div>
    <!-- 运行指标 -->
    <div class="kpi-row">
      <div class="kpi-card" v-for="k in kpiList" :key="k.label">
        <div class="kpi-num" :style="{ color: k.color }">{{ k.value }}</div>
        <div class="kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <div class="page-card">
      <div class="page-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索用户输入" clearable style="width: 220px" @keyup.enter="load(1)" @clear="load(1)" />
        <el-select v-model="query.escalated" placeholder="转人工" clearable style="width: 130px" @change="load(1)">
          <el-option label="仅看转人工" value="1" />
        </el-select>
        <el-button @click="load(1)">查询</el-button>
        <el-button @click="load(page)">刷新</el-button>
      </div>

      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column label="用户输入" min-width="240">
          <template #default="{ row }">
            <el-link type="primary" @click="openDetail(row)">{{ truncate(row.query, 50) }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="意图" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.intent" size="small" effect="plain">{{ intentText(row.intent) }}</el-tag>
            <span v-else class="sp-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="节点链" min-width="200">
          <template #default="{ row }">
            <span v-for="(n, i) in row.nodes || []" :key="i">
              <el-tag v-if="n === 'tool_call'" type="warning" size="small">⚙ {{ n }}</el-tag>
              <el-tag v-else size="small" effect="plain">{{ n }}</el-tag>
              <span v-if="i < (row.nodes?.length || 0) - 1" class="sp-muted"> → </span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.escalated" type="danger" size="small">转人工</el-tag>
            <el-tag v-else-if="row.success" type="success" size="small">已处理</el-tag>
            <el-tag v-else type="info" size="small">异常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="模型" width="130" prop="llmModel" />
        <el-table-column label="Token" width="90">
          <template #default="{ row }">{{ row.tokenUsage ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="耗时(ms)" width="100">
          <template #default="{ row }">{{ row.latencyMs ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination layout="total, prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="load" />
      </div>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="Agent 执行轨迹" size="520px">
      <template v-if="detail">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="用户输入">{{ detail.query }}</el-descriptions-item>
          <el-descriptions-item label="关联工单">{{ detail.ticketId || '独立问答' }}</el-descriptions-item>
          <el-descriptions-item label="线程 ID">{{ detail.threadId || '—' }}</el-descriptions-item>
          <el-descriptions-item label="LLM 模型">{{ detail.llmModel || '—' }}</el-descriptions-item>
          <el-descriptions-item label="Token / 耗时">
            {{ detail.tokenUsage ?? '-' }} tokens / {{ detail.latencyMs ?? '-' }} ms
          </el-descriptions-item>
        </el-descriptions>

        <h4>工具调用</h4>
        <template v-if="detail.toolCalls?.length">
          <div v-for="(t, i) in detail.toolCalls" :key="i" class="tool-call">
            <el-tag size="small" type="warning">⚙ {{ t.name }}</el-tag>
            <div class="sp-muted">{{ t.result }}</div>
          </div>
        </template>
        <div v-else class="sp-muted">无</div>

        <h4>召回依据</h4>
        <template v-if="detail.references?.length">
          <div v-for="(r, i) in detail.references" :key="i" class="ref-line">{{ r }}</div>
        </template>
        <div v-else class="sp-muted">无</div>

        <h4 v-if="detail.error">错误信息</h4>
        <pre v-if="detail.error" class="err">{{ detail.error }}</pre>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { traceApi } from '@/api';
import { TICKET_INTENT_TEXT } from '@/types';
import type { AgentTrace } from '@/types';

const loading = ref(false);
const rows = ref<AgentTrace[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const query = reactive<{ keyword?: string; escalated?: string }>({});
const stats = ref<any>({});

const kpiList = computed(() => [
  { label: '累计执行', value: stats.value.total ?? 0, color: '#2f6fed' },
  { label: '转人工率', value: `${stats.value.escalateRate ?? 0}%`, color: '#d81e06' },
  { label: '平均耗时', value: `${stats.value.avgLatencyMs ?? 0}ms`, color: '#e6a23c' },
  { label: 'Token 消耗', value: stats.value.totalTokens ?? 0, color: '#18a058' },
]);

const detailVisible = ref(false);
const detail = ref<AgentTrace | null>(null);

async function load(p = 1) {
  page.value = p;
  loading.value = true;
  try {
    const res = await traceApi.list({ ...query, page: p, pageSize });
    rows.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  try {
    stats.value = await traceApi.stats();
  } catch { /* ignore */ }
}

async function openDetail(row: AgentTrace) {
  detail.value = await traceApi.detail(row.id);
  detailVisible.value = true;
}

function intentText(v: string) {
  return (TICKET_INTENT_TEXT as Record<string, string>)[v] ?? v;
}
function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
function fmt(v?: string) {
  return v ? v.replace('T', ' ').slice(0, 16) : '';
}

onMounted(() => {
  load(1);
  loadStats();
});
</script>

<style scoped>
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.kpi-card {
  background: #fff;
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: 0 1px 4px rgba(30, 34, 40, 0.05);
}
.kpi-num {
  font-size: 24px;
  font-weight: 800;
}
.kpi-label {
  font-size: 13px;
  color: var(--sp-text-secondary);
  margin-top: 4px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.tool-call {
  border: 1px solid var(--sp-border);
  border-radius: 8px;
  padding: 6px 10px;
  margin-bottom: 6px;
}
.ref-line {
  background: #f6f7f9;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--sp-text-secondary);
}
.err {
  background: #fef0f0;
  color: #c0392b;
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
