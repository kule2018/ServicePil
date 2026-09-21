<template>
  <div class="page-card">
    <div class="card-head">
      <div>
        <h3 style="margin: 0">人工确认工作台</h3>
        <p class="sp-muted" style="margin: 4px 0 0">高风险操作（退款 / AI 回复 / 状态变更）需人工审核，属于 Human-in-the-loop 关键兜底</p>
      </div>
      <div>
        <el-select v-model="statusFilter" style="width: 140px" @change="reload(1)">
          <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" stripe>
      <el-table-column label="工单" min-width="200">
        <template #default="{ row }">
          <el-link v-if="row.ticketId" type="primary" @click="$router.push(`/tickets/${row.ticketId}`)">
            {{ row.ticketTitle || row.ticketId }}
          </el-link>
          <span v-else class="sp-muted">无关联工单</span>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="110">
        <template #default="{ row }">
          <el-tag :type="typeTag(row.targetType)" size="small">{{ typeText(row.targetType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="风险原因 / 摘要" min-width="260">
        <template #default="{ row }">
          <div>{{ row.reason || '—' }}</div>
          <div v-if="row.targetType === 'refund'" class="sp-muted">
            {{ amountText(row) }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="提交时间" width="160">
        <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'pending'">
            <el-button link type="success" size="small" @click="decide(row, 'approve')">通过</el-button>
            <el-button link type="danger" size="small" @click="decide(row, 'reject')">驳回</el-button>
          </template>
          <span v-else class="sp-muted">
            {{ row.handlerNote ? `备注：${row.handlerNote}` : '已处理' }}
          </span>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination layout="total, prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="reload" />
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" :title="`待确认 · ${typeText(current?.targetType ?? '')}`" size="420px">
      <template v-if="current">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="关联工单">{{ current.ticketTitle || current.ticketId || '—' }}</el-descriptions-item>
          <el-descriptions-item label="风险原因">{{ current.reason || '—' }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ fmt(current.createdAt) }}</el-descriptions-item>
        </el-descriptions>
        <h4>执行动作载荷</h4>
        <pre class="payload">{{ prettyPayload }}</pre>
        <div v-if="current.targetType === 'reply'" class="reply-preview">{{ current.payload?.content }}</div>
      </template>
      <template #footer>
        <el-button type="success" :loading="deciding" @click="confirmDecide('approve')">审批通过</el-button>
        <el-button type="danger" plain :loading="deciding" @click="confirmDecide('reject')">驳回</el-button>
      </template>
    </el-drawer>

    <!-- 退款触发词配置（可配置数据，命中即生成待确认任务） -->
    <div class="page-card kw-card">
      <div class="card-head">
        <div>
          <h3 style="margin: 0">退款触发词配置</h3>
          <p class="sp-muted" style="margin: 4px 0 0">
            用户在工单中命中以下任一「启用中」的触发词，Agent 工作流会自动创建退款类待确认并挂起人工审核。
            数据存于数据库（refund_keyword 表），可在此动态维护。
          </p>
        </div>
        <div class="kw-add">
          <el-input
            v-model="newKeyword"
            placeholder="输入触发词，如 退差价"
            style="width: 200px"
            maxlength="50"
            @keyup.enter="addKeyword"
          />
          <el-button type="primary" style="margin-left: 8px" :loading="kwSaving" @click="addKeyword">添加</el-button>
        </div>
      </div>

      <div v-loading="kwLoading" class="kw-list">
        <div v-if="keywords.length === 0" class="sp-muted">暂无触发词，请添加</div>
        <div v-for="kw in keywords" :key="kw.id" class="kw-chip" :class="{ off: !kw.enabled }">
          <span class="kw-text">{{ kw.keyword }}</span>
          <el-switch
            :model-value="kw.enabled"
            size="small"
            inline-prompt
            active-text="启用"
            inactive-text="停用"
            @change="toggleKeyword(kw)"
          />
          <el-button link type="danger" size="small" @click="removeKeyword(kw)">删除</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { hitlApi, refundKeywordApi } from '@/api';
import type { PendingConfirm, RefundKeyword } from '@/types';

const loading = ref(false);
const rows = ref<PendingConfirm[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const statusFilter = ref('pending');

const statusOptions = [
  { value: 'pending', label: '待处理' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
];

const drawerVisible = ref(false);
const deciding = ref(false);
const current = ref<PendingConfirm | null>(null);
const currentAction = ref<'approve' | 'reject'>('approve');

// ---------- 退款触发词配置 ----------
const keywords = ref<RefundKeyword[]>([]);
const newKeyword = ref('');
const kwLoading = ref(false);
const kwSaving = ref(false);

async function loadKeywords() {
  kwLoading.value = true;
  try {
    keywords.value = await refundKeywordApi.list();
  } finally {
    kwLoading.value = false;
  }
}

async function addKeyword() {
  const kw = newKeyword.value.trim();
  if (!kw) return;
  kwSaving.value = true;
  try {
    await refundKeywordApi.create(kw);
    newKeyword.value = '';
    await loadKeywords();
    ElMessage.success(`已添加触发词「${kw}」`);
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '添加失败');
  } finally {
    kwSaving.value = false;
  }
}

async function toggleKeyword(kw: RefundKeyword) {
  await refundKeywordApi.toggle(kw.id);
  await loadKeywords();
}

async function removeKeyword(kw: RefundKeyword) {
  try {
    await ElMessageBox.confirm(`确认删除触发词「${kw.keyword}」？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return; // 用户取消
  }
  await refundKeywordApi.remove(kw.id);
  await loadKeywords();
  ElMessage.success('已删除触发词');
}

const prettyPayload = computed(() =>
  current.value ? JSON.stringify(current.value.payload, null, 2) : '',
);

async function reload(p = 1) {
  page.value = p;
  loading.value = true;
  try {
    const res = await hitlApi.list({ status: statusFilter.value, page: p, pageSize });
    rows.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function decide(row: PendingConfirm, action: 'approve' | 'reject') {
  current.value = row;
  currentAction.value = action;
  if (action === 'reject' && row.targetType !== 'reply') {
    // 驳回走备注弹窗
    await confirmDecide('reject');
    return;
  }
  drawerVisible.value = true;
}

async function confirmDecide(action: 'approve' | 'reject') {
  if (!current.value) return;
  if (action === 'reject') {
    try {
      const { value } = await ElMessageBox.prompt('请输入驳回原因（选填）', '驳回确认', {
        confirmButtonText: '确认驳回',
        cancelButtonText: '取消',
        inputPlaceholder: '驳回原因',
        type: 'warning',
      });
      deciding.value = true;
      await hitlApi.reject(current.value.id, value ?? '');
    } catch {
      return; // 用户取消
    } finally {
      deciding.value = false;
    }
  } else {
    deciding.value = true;
    try {
      await hitlApi.approve(current.value.id);
    } finally {
      deciding.value = false;
    }
  }
  const acted = action === 'approve' ? '已通过' : '已驳回';
  ElMessage.success(`${acted}：${current.value.ticketTitle || current.value.ticketId}`);
  drawerVisible.value = false;
  current.value = null;
  reload(page.value);
}

function typeText(t: string) {
  return { reply: 'AI 回复待确认', refund: '退款申请', status_change: '状态变更' }[t] ?? t;
}
function typeTag(t: string): any {
  return { reply: 'warning', refund: 'danger', status_change: 'info' }[t];
}
function statusText(s: string) {
  return { pending: '待处理', approved: '已通过', rejected: '已驳回' }[s] ?? s;
}
function statusTag(s: string): any {
  return { pending: 'warning', approved: 'success', rejected: 'danger' }[s];
}
function amountText(row: PendingConfirm) {
  if (row.payload?.amount != null) return `金额：¥${row.payload.amount}`;
  return '';
}
function fmt(v?: string) {
  return v ? v.replace('T', ' ').slice(0, 16) : '';
}

onMounted(() => {
  reload(1);
  loadKeywords();
});
</script>

<style scoped>
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.payload {
  background: #f6f7f9;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  line-height: 1.6;
  overflow: auto;
  max-height: 220px;
}
.reply-preview {
  margin-top: 10px;
  background: var(--el-color-primary-light-9);
  padding: 10px;
  border-radius: 8px;
  line-height: 1.7;
}
.kw-card {
  margin-top: 16px;
}
.kw-add {
  display: flex;
  align-items: center;
}
.kw-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 40px;
  align-items: center;
}
.kw-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border: 1px solid var(--el-color-danger-light-5);
  border-radius: 20px;
  background: var(--el-color-danger-light-9);
  font-size: 13px;
}
.kw-chip.off {
  border-color: var(--el-border-color);
  background: var(--el-fill-color-light);
  opacity: 0.75;
}
.kw-text {
  font-weight: 600;
  color: var(--el-color-danger);
}
.kw-chip.off .kw-text {
  color: var(--el-text-color-secondary);
}
</style>
