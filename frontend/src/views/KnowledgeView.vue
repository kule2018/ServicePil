<template>
  <div>
    <el-tabs v-model="tab">
      <!-- FAQ 知识条目 -->
      <el-tab-pane label="FAQ 知识条目" name="faq">
        <div class="page-card">
          <div class="page-toolbar">
            <el-input v-model="faqQuery.keyword" placeholder="搜索问题关键词" clearable style="width: 220px" @keyup.enter="loadFaq(1)" @clear="loadFaq(1)" />
            <el-select v-model="faqQuery.intent" placeholder="意图" clearable style="width: 140px" @change="loadFaq(1)">
              <el-option v-for="(txt, val) in TICKET_INTENT_TEXT" :key="val" :label="txt" :value="val" />
            </el-select>
            <el-button @click="loadFaq(1)">查询</el-button>
            <div style="flex: 1" />
            <el-button type="primary" :icon="Plus" @click="openFaq()">新增条目</el-button>
          </div>
          <el-table v-loading="faqLoading" :data="faqRows" stripe>
            <el-table-column label="意图" width="110">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ TICKET_INTENT_TEXT[row.intent as TicketIntent] }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="问题" min-width="220" prop="question" />
            <el-table-column label="答案" min-width="260">
              <template #default="{ row }">
                <div class="ellipsis">{{ row.answer }}</div>
              </template>
            </el-table-column>
            <el-table-column label="更新时间" width="160">
              <template #default="{ row }">{{ fmt(row.updatedAt || row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="130" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openFaq(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="removeFaq(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pager">
            <el-pagination layout="total, prev, pager, next" :total="faqTotal" :page-size="faqPageSize" :current-page="faqPage" @current-change="loadFaq" />
          </div>
        </div>
      </el-tab-pane>

      <!-- RAG 文档 -->
      <el-tab-pane label="RAG 文档库" name="doc">
        <div class="page-card">
          <div class="page-toolbar">
            <span class="sp-muted">文档导入后自动切片 + 向量化，供混合检索召回（当前 Mock Embedding，无需外部服务）</span>
            <div style="flex: 1" />
            <el-button type="primary" :icon="Upload" @click="docDialog = true">导入文档</el-button>
          </div>
          <el-table v-loading="docLoading" :data="docRows" stripe>
            <el-table-column label="文档标题" min-width="200" prop="title" />
            <el-table-column label="切片数" width="110">
              <template #default="{ row }">
                <el-tag size="small" type="danger" effect="plain">{{ row.chunkCount }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="来源" width="200" prop="source">
              <template #default="{ row }">{{ row.source || '—' }}</template>
            </el-table-column>
            <el-table-column label="导入时间" width="160">
              <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="130" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="viewDoc(row)">详情</el-button>
                <el-button link type="danger" size="small" @click="removeDoc(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- FAQ 编辑 -->
    <el-dialog v-model="faqDialog" :title="faqForm.id ? '编辑条目' : '新增条目'" width="540px">
      <el-form ref="faqFormRef" :model="faqForm" :rules="faqRules" label-width="70px">
        <el-form-item label="意图" prop="intent">
          <el-select v-model="faqForm.intent" style="width: 180px">
            <el-option v-for="(txt, val) in TICKET_INTENT_TEXT" :key="val" :label="txt" :value="val" />
          </el-select>
        </el-form-item>
        <el-form-item label="问题" prop="question">
          <el-input v-model="faqForm.question" maxlength="300" show-word-limit />
        </el-form-item>
        <el-form-item label="答案" prop="answer">
          <el-input v-model="faqForm.answer" type="textarea" :rows="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="faqDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveFaq">保存</el-button>
      </template>
    </el-dialog>

    <!-- 文档导入 -->
    <el-dialog v-model="docDialog" title="导入 RAG 文档" width="560px">
      <el-form ref="docFormRef" :model="docForm" :rules="docRules" label-width="70px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="docForm.title" maxlength="200" />
        </el-form-item>
        <el-form-item label="来源" prop="source">
          <el-input v-model="docForm.source" maxlength="300" placeholder="如：产品手册 / 政策文档（选填）" />
        </el-form-item>
        <el-form-item label="正文" prop="content">
          <el-input v-model="docForm.content" type="textarea" :rows="10" placeholder="粘贴文档全文，系统自动切片（窗口 300 字 / 重叠 60 字）并向量化" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="docDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDoc">导入并向量化</el-button>
      </template>
    </el-dialog>

    <!-- 文档切片详情 -->
    <el-drawer v-model="docViewer" title="文档切片" size="480px">
      <template v-if="docDetail">
        <h4 style="margin-top: 0">{{ docDetail.title }}</h4>
        <el-timeline v-if="docDetail.chunks?.length">
          <el-timeline-item v-for="c in docDetail.chunks" :key="c.id" :timestamp="`#${c.chunkIndex + 1} 切片`">
            {{ c.text }}
          </el-timeline-item>
        </el-timeline>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Plus, Upload } from '@element-plus/icons-vue';
import { ragApi } from '@/api';
import { TICKET_INTENT_TEXT } from '@/types';
import type { TicketIntent, KnowledgeItem, KnowledgeDocument } from '@/types';

const tab = ref('faq');

// ---------- FAQ ----------
const faqLoading = ref(false);
const faqRows = ref<KnowledgeItem[]>([]);
const faqTotal = ref(0);
const faqPage = ref(1);
const faqPageSize = 10;
const faqQuery = reactive<{ keyword?: string; intent?: string }>({});
const faqDialog = ref(false);
const saving = ref(false);
const faqFormRef = ref<FormInstance>();
const faqForm = reactive<{ id?: string; intent: TicketIntent; question: string; answer: string }>({
  intent: 'technical',
  question: '',
  answer: '',
});
const faqRules: FormRules = {
  intent: [{ required: true, message: '请选择意图' }],
  question: [{ required: true, message: '请输入问题', trigger: 'blur' }],
  answer: [{ required: true, message: '请输入答案', trigger: 'blur' }],
};

async function loadFaq(p = 1) {
  faqPage.value = p;
  faqLoading.value = true;
  try {
    const res = await ragApi.knowledgeItems({ ...faqQuery, page: p, pageSize: faqPageSize });
    faqRows.value = res.list;
    faqTotal.value = res.total;
  } finally {
    faqLoading.value = false;
  }
}

function openFaq(row?: KnowledgeItem) {
  if (row) {
    Object.assign(faqForm, { id: row.id, intent: row.intent, question: row.question, answer: row.answer });
  } else {
    Object.assign(faqForm, { id: undefined, intent: 'technical', question: '', answer: '' });
  }
  faqDialog.value = true;
}

async function saveFaq() {
  if (!faqFormRef.value) return;
  const ok = await faqFormRef.value.validate().catch(() => false);
  if (!ok) return;
  saving.value = true;
  try {
    if (faqForm.id) {
      await ragApi.updateKnowledge(faqForm.id, { intent: faqForm.intent, question: faqForm.question, answer: faqForm.answer });
      ElMessage.success('条目已更新');
    } else {
      await ragApi.createKnowledge({ intent: faqForm.intent, question: faqForm.question, answer: faqForm.answer });
      ElMessage.success('条目已新增');
    }
    faqDialog.value = false;
    loadFaq(faqPage.value);
  } finally {
    saving.value = false;
  }
}

async function removeFaq(row: KnowledgeItem) {
  await ElMessageBox.confirm(`确定删除条目「${row.question}」？`, '删除确认', { type: 'warning' });
  await ragApi.deleteKnowledge(row.id);
  ElMessage.success('已删除');
  loadFaq(faqPage.value);
}

// ---------- RAG 文档 ----------
const docLoading = ref(false);
const docRows = ref<KnowledgeDocument[]>([]);
const docDialog = ref(false);
const docFormRef = ref<FormInstance>();
const docForm = reactive({ title: '', source: '', content: '' });
const docRules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入文档正文', trigger: 'blur' }],
};
const docViewer = ref(false);
const docDetail = ref<KnowledgeDocument & { chunks?: any[] } | null>(null);

async function loadDocs() {
  docLoading.value = true;
  try {
    const res = await ragApi.documents();
    docRows.value = res.list ?? [];
  } finally {
    docLoading.value = false;
  }
}

async function saveDoc() {
  if (!docFormRef.value) return;
  const ok = await docFormRef.value.validate().catch(() => false);
  if (!ok) return;
  saving.value = true;
  try {
    const res = await ragApi.ingest({ ...docForm });
    ElMessage.success(`导入成功，共生成 ${res.chunkCount} 个切片`);
    docDialog.value = false;
    docForm.title = '';
    docForm.source = '';
    docForm.content = '';
    loadDocs();
  } finally {
    saving.value = false;
  }
}

async function viewDoc(row: KnowledgeDocument) {
  docDetail.value = await ragApi.documentDetail(row.id);
  docViewer.value = true;
}

async function removeDoc(row: KnowledgeDocument) {
  await ElMessageBox.confirm(`确定删除文档「${row.title}」及其全部切片？`, '删除确认', { type: 'warning' });
  await ragApi.deleteDocument(row.id);
  ElMessage.success('已删除');
  loadDocs();
}

function fmt(v?: string) {
  return v ? v.replace('T', ' ').slice(0, 16) : '';
}

onMounted(() => {
  loadFaq(1);
  loadDocs();
});
</script>

<style scoped>
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.ellipsis {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
