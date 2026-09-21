<template>
  <div class="page-card">
    <div class="page-toolbar">
      <el-input v-model="keyword" placeholder="搜索姓名 / 邮箱" clearable style="width: 240px" @keyup.enter="load(1)" @clear="load(1)" />
      <el-select v-model="roleFilter" placeholder="角色" clearable style="width: 150px" @change="load(1)">
        <el-option v-for="(txt, val) in ROLE_TEXT" :key="val" :label="txt" :value="val" />
      </el-select>
      <el-button @click="load(1)">查询</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" stripe>
      <el-table-column label="姓名" prop="name" width="140" />
      <el-table-column label="邮箱" prop="email" min-width="200" />
      <el-table-column label="角色" width="120">
        <template #default="{ row }">
          <el-select :model-value="row.role" size="small" @change="(v: UserRole) => changeRole(row, v)">
            <el-option v-for="(txt, val) in ROLE_TEXT" :key="val" :label="txt" :value="val" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" width="170">
        <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination layout="total, prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="load" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { usersApi } from '@/api';
import { ROLE_TEXT } from '@/types';
import type { User, UserRole } from '@/types';

const loading = ref(false);
const rows = ref<User[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const keyword = ref('');
const roleFilter = ref<UserRole | undefined>(undefined);

async function load(p = 1) {
  page.value = p;
  loading.value = true;
  try {
    const res = await usersApi.list({
      page: p,
      pageSize,
      keyword: keyword.value || undefined,
      role: roleFilter.value || undefined,
    });
    rows.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function changeRole(row: User, role: UserRole) {
  if (row.role === role) return;
  try {
    await usersApi.updateRole(row.id, role);
    ElMessage.success(`${row.name} 已设为 ${ROLE_TEXT[role]}`);
    load(page.value);
  } catch {
    /* ignore */
  }
}

function fmt(v?: string) {
  return v ? v.replace('T', ' ').slice(0, 16) : '';
}

onMounted(() => load(1));
</script>

<style scoped>
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
