<template>
  <div>
    <!-- 概览统计卡片 -->
    <div class="stat-row">
      <div class="stat-card" v-for="s in statCards" :key="s.key" :style="{ borderTopColor: s.color }">
        <div class="stat-num" :style="{ color: s.color }">{{ (stats.byStatus && stats.byStatus[s.key]) || 0 }}</div>
        <div class="stat-label sp-muted">{{ s.label }}</div>
      </div>
      <div class="stat-card" style="border-top-color: #2f6fed">
        <div class="stat-num" style="color: #2f6fed">{{ stats.total || 0 }}</div>
        <div class="stat-label sp-muted">工单总数</div>
      </div>
    </div>

    <div class="page-card">
      <div class="page-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索标题 / 内容 / 提交人" clearable style="width: 240px" @keyup.enter="reload(1)" @clear="reload(1)">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px" @change="reload(1)">
          <el-option v-for="(txt, val) in TICKET_STATUS_TEXT" :key="val" :label="txt" :value="val" />
        </el-select>
        <el-select v-model="query.intent" placeholder="意图" clearable style="width: 140px" @change="reload(1)">
          <el-option v-for="(txt, val) in TICKET_INTENT_TEXT" :key="val" :label="txt" :value="val" />
        </el-select>
        <el-button @click="reload(1)">查询</el-button>
        <div style="flex: 1" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建工单</el-button>
      </div>

      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column label="标题" min-width="220">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/tickets/${row.id}`)">{{ row.title }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ TICKET_STATUS_TEXT[row.status as TicketStatus] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="priorityTag(row.priority)" size="small" effect="plain">{{ TICKET_PRIORITY_TEXT[row.priority as TicketPriority] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="AI 意图" width="110">
          <template #default="{ row }">
            {{ TICKET_INTENT_TEXT[row.intent as TicketIntent] }}
            <el-tooltip v-if="row.aiConfidence != null" :content="`置信度 ${(row.aiConfidence * 100).toFixed(0)}%`">
              <span class="sp-muted">·{{ (row.aiConfidence * 100).toFixed(0) }}%</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="提交人" prop="createdBy.name" width="110" />
        <el-table-column label="指派" width="110">
          <template #default="{ row }">
            <span v-if="row.assignedTo">{{ row.assignedTo.name }}</span>
            <span v-else class="sp-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="170">
          <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/tickets/${row.id}`)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          layout="total, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="reload"
        />
      </div>
    </div>

    <!-- 新建工单 -->
    <el-dialog v-model="createVisible" title="新建工单" width="520px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="80px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="createForm.title" maxlength="200" show-word-limit placeholder="一句话描述问题" />
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-select v-model="createForm.priority" style="width: 140px">
            <el-option v-for="(txt, val) in TICKET_PRIORITY_TEXT" :key="val" :label="txt" :value="val" />
          </el-select>
        </el-form-item>
        <el-form-item label="问题描述" prop="content">
          <el-input v-model="createForm.content" type="textarea" :rows="6" maxlength="2000" show-word-limit placeholder="请详细描述遇到的问题，AI 将据此进行意图识别与解答" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Plus, Search } from '@element-plus/icons-vue';
import { ticketsApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import {
  TICKET_STATUS_TEXT, TICKET_PRIORITY_TEXT, TICKET_INTENT_TEXT,
} from '@/types';
import type { Ticket, TicketStatus, TicketPriority, TicketIntent } from '@/types';

const router = useRouter();
const auth = useAuthStore();

const loading = ref(false);
const rows = ref<Ticket[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const stats = ref<{ total: number; byStatus: Record<string, number> }>({ total: 0, byStatus: {} });

const query = reactive<Record<string, string | undefined>>({
  keyword: undefined,
  status: undefined,
  intent: undefined,
});

const statCards = [
  { key: 'open', label: '待处理', color: '#7a7f87' },
  { key: 'ai_handling', label: 'AI 处理中', color: '#e6a23c' },
  { key: 'escalated', label: '已转人工', color: '#d81e06' },
  { key: 'resolved', label: '已解决', color: '#18a058' },
];

async function reload(p = 1) {
  page.value = p;
  loading.value = true;
  try {
    const res = await ticketsApi.list({
      ...query,
      page: p,
      pageSize,
    });
    rows.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  try {
    const res = await ticketsApi.stats();
    if (res && res.total !== undefined) stats.value = res;
  } catch {
    /* 统计接口失败不阻塞页面 */
  }
}

function fmt(v: string) {
  return v ? v.replace('T', ' ').slice(0, 16) : '';
}
function statusTag(s: TicketStatus): any {
  return { open: 'info', ai_handling: 'warning', escalated: 'danger', resolved: 'success', closed: 'info' }[s];
}
function priorityTag(p: TicketPriority): any {
  return { low: 'info', medium: '', high: 'warning', urgent: 'danger' }[p];
}

// ---------- 新建工单 ----------
const createVisible = ref(false);
const creating = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = reactive({ title: '', priority: 'medium', content: '' });
const createRules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  content: [
    { required: true, message: '请输入问题描述', trigger: 'blur' },
    { min: 5, message: '至少 5 个字', trigger: 'blur' },
  ],
};

function openCreate() {
  createForm.title = '';
  createForm.content = '';
  createForm.priority = 'medium';
  createVisible.value = true;
}

async function submitCreate() {
  if (!createFormRef.value) return;
  const ok = await createFormRef.value.validate().catch(() => false);
  if (!ok) return;
  creating.value = true;
  try {
    const ticket = await ticketsApi.create({ ...createForm });
    ElMessage.success('工单已创建');
    createVisible.value = false;
    router.push(`/tickets/${ticket.id}`);
  } finally {
    creating.value = false;
  }
}

onMounted(() => {
  reload(1);
  loadStats();
});
</script>

<style scoped>
.stat-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.stat-card {
  background: #fff;
  border-radius: 10px;
  border-top: 3px solid var(--el-color-primary);
  padding: 14px 16px;
  box-shadow: 0 1px 4px rgba(30, 34, 40, 0.05);
}
.stat-num {
  font-size: 26px;
  font-weight: 700;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
