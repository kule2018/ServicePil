<template>
  <el-container class="layout">
    <!-- 侧边栏 -->
    <el-aside width="220px" class="layout-aside">
      <div class="brand">
        <div class="brand-logo sp-brand-gradient">S</div>
        <div class="brand-text">
          <div class="brand-title">ServicePilot</div>
          <div class="brand-sub">智能工单处理 Agent</div>
        </div>
      </div>
      <el-menu :default-active="activePath" router class="side-menu" background-color="transparent">
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon><span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/tickets">
          <el-icon><Tickets /></el-icon><span>工单管理</span>
        </el-menu-item>
        <el-menu-item index="/chat">
          <el-icon><ChatDotRound /></el-icon><span>AI 智能客服</span>
        </el-menu-item>
        <template v-if="auth.isAgent">
          <el-menu-item index="/hitl">
            <el-icon><Finished /></el-icon><span>人工确认</span>
            <el-badge v-if="pendingCount > 0" :value="pendingCount" class="menu-badge" />
          </el-menu-item>
          <el-menu-item index="/knowledge">
            <el-icon><Collection /></el-icon><span>知识库</span>
          </el-menu-item>
          <el-menu-item index="/trace">
            <el-icon><Monitor /></el-icon><span>AI 监控</span>
          </el-menu-item>
        </template>
        <el-menu-item v-if="auth.isAdmin" index="/users">
          <el-icon><User /></el-icon><span>用户管理</span>
        </el-menu-item>
      </el-menu>
      <div class="aside-footer sp-muted">AI 技术栈 · Vue3 + NestJS</div>
    </el-aside>

    <el-container>
      <!-- 顶栏 -->
      <el-header class="layout-header">
        <div class="header-title">{{ currentTitle }}</div>
        <div class="header-right">
          <el-tag v-if="auth.user" size="small" type="danger" effect="light" round>
            {{ ROLE_TEXT[auth.user.role as UserRole] }}
          </el-tag>
          <el-dropdown @command="onCommand">
            <span class="user-chip">
              <el-avatar :size="28" class="sp-brand-gradient">{{ (auth.user?.name ?? '?').slice(0, 1) }}</el-avatar>
              <span class="user-name">{{ auth.user?.name ?? '' }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>{{ auth.user?.email }}</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Odometer, Tickets, ChatDotRound, Finished, Collection, Monitor, User, ArrowDown,
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { hitlApi } from '@/api';
import { ROLE_TEXT } from '@/types';
import type { UserRole } from '@/types';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const pendingCount = ref(0);

const activePath = computed(() => route.path);
const currentTitle = computed(() => (route.meta.title as string) ?? 'ServicePilot');

function onCommand(cmd: string) {
  if (cmd === 'logout') {
    auth.logout();
    router.push('/login');
  }
}

let timer: number | undefined;
async function loadPending() {
  if (!auth.isAgent) return;
  try {
    const res = await hitlApi.list({ page: 1, pageSize: 1 });
    pendingCount.value = res.total;
  } catch {
    pendingCount.value = 0;
  }
}

onMounted(() => {
  loadPending();
  if (auth.isAgent) timer = window.setInterval(loadPending, 30000);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<style scoped>
.layout {
  height: 100vh;
}
.layout-aside {
  background: var(--sp-sidebar-bg);
  border-right: 1px solid var(--sp-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 18px 14px;
}
.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  color: #fff;
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-title {
  font-weight: 700;
  font-size: 16px;
  line-height: 1.2;
  color: var(--sp-text);
}
.brand-sub {
  font-size: 11px;
  color: var(--sp-text-secondary);
}
.side-menu {
  border-right: none;
  flex: 1;
}
.side-menu .el-menu-item {
  height: 46px;
  margin: 2px 10px;
  border-radius: 8px;
  color: #3c4148;
}
.side-menu .el-menu-item:hover {
  background: var(--el-color-primary-light-9);
}
.side-menu .el-menu-item.is-active {
  background: var(--el-color-primary-light-9);
  color: var(--sp-primary);
  font-weight: 600;
}
.menu-badge {
  margin-left: auto;
}
.aside-footer {
  padding: 12px 18px;
  border-top: 1px solid var(--sp-border);
}
.layout-header {
  background: #fff;
  border-bottom: 1px solid var(--sp-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}
.header-title {
  font-size: 16px;
  font-weight: 600;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
}
.user-name {
  font-size: 14px;
  color: var(--sp-text);
}
.layout-main {
  background: var(--sp-bg);
  padding: 18px;
  overflow: auto;
}
</style>
