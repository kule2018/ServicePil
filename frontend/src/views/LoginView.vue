<template>
  <div class="login-page">
    <!-- 左侧品牌区 -->
    <div class="login-brand sp-login-brand">
      <div class="brand-card">
        <div class="brand-logo-big">S</div>
        <h1>ServicePilot</h1>
        <p class="brand-desc">智能工单处理 Agent · 企业级 AI 实战项目</p>
        <ul class="brand-points">
          <li>意图识别 · 知识库 RAG 混合检索</li>
          <li>Agent 工作流编排 · 工具调用</li>
          <li>Human-in-the-loop 人工兜底</li>
          <li>全链路 Trace 可观测</li>
        </ul>
      </div>
    </div>

    <!-- 右侧表单 -->
    <div class="login-form-wrap">
      <el-card class="login-card" shadow="never">
        <h2 class="form-title">{{ isRegister ? '创建账号' : '欢迎回来' }}</h2>
        <p class="form-sub sp-muted">
          {{ isRegister ? '注册后将自动登录（默认终端用户）' : '请使用演示账号或注册新账号' }}
        </p>
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @keyup.enter="submit">
          <el-form-item v-if="isRegister" label="姓名" prop="name">
            <el-input v-model="form.name" placeholder="请输入姓名" />
          </el-form-item>
          <el-form-item label="邮箱" prop="email">
            <el-input v-model="form.email" placeholder="name@example.com" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
          </el-form-item>
          <el-button type="primary" class="submit-btn" :loading="loading" @click="submit">
            {{ isRegister ? '注册并登录' : '登 录' }}
          </el-button>
        </el-form>
        <div class="switch-line">
          <span class="sp-muted">{{ isRegister ? '已有账号？' : '还没有账号？' }}</span>
          <el-link type="primary" @click="toggleMode">{{ isRegister ? '去登录' : '去注册' }}</el-link>
        </div>
        <el-divider>演示账号</el-divider>
        <div class="demo-accounts">
          <el-button size="small" plain @click="fillDemo('admin@servicepilot.dev', 'admin123')">管理员</el-button>
          <el-button size="small" plain @click="fillDemo('agent@servicepilot.dev', 'agent123')">坐席</el-button>
          <el-button size="small" plain @click="fillDemo('alice@example.com', 'user123')">用户</el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const isRegister = ref(false);
const loading = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  name: '',
  email: '',
  password: '',
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
};

function toggleMode() {
  isRegister.value = !isRegister.value;
}

function fillDemo(email: string, password: string) {
  form.email = email;
  form.password = password;
  isRegister.value = false;
}

async function submit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    if (isRegister.value) {
      await auth.register(form.name, form.email, form.password);
      ElMessage.success('注册成功，欢迎使用 ServicePilot');
    } else {
      await auth.login(form.email, form.password);
      ElMessage.success('登录成功');
    }
    const redirect = (route.query.redirect as string) || '/dashboard';
    router.push(redirect);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  height: 100vh;
}
.login-brand {
  flex: 1.2;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-card {
  max-width: 420px;
  padding: 30px;
}
.brand-logo-big {
  width: 62px;
  height: 62px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  font-weight: 800;
  margin-bottom: 18px;
}
.brand-card h1 {
  font-size: 32px;
  margin: 0 0 6px;
}
.brand-desc {
  opacity: 0.9;
  margin: 0 0 26px;
  font-size: 14px;
}
.brand-points {
  list-style: none;
  padding: 0;
  margin: 0;
  line-height: 2.1;
  font-size: 14px;
  opacity: 0.95;
}
.brand-points li::before {
  content: '✓';
  margin-right: 8px;
  font-weight: 700;
}
.login-form-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.login-card {
  width: 380px;
  border: 1px solid var(--sp-border);
  border-radius: 14px;
}
.form-title {
  margin: 0;
  font-size: 24px;
}
.form-sub {
  margin: 6px 0 18px;
}
.submit-btn {
  width: 100%;
  margin-top: 4px;
  letter-spacing: 2px;
}
.switch-line {
  margin-top: 14px;
  text-align: center;
  font-size: 13px;
}
.demo-accounts {
  display: flex;
  justify-content: space-between;
  gap: 6px;
}
</style>
