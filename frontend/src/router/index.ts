/**
 * 路由：登录页与主布局下的业务页面
 */
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import MainLayout from '@/layouts/MainLayout.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, title: '登录' },
    },
    {
      path: '/',
      component: MainLayout,
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '工作台' } },
        { path: 'tickets', name: 'tickets', component: () => import('@/views/TicketListView.vue'), meta: { title: '工单管理' } },
        { path: 'tickets/:id', name: 'ticket-detail', component: () => import('@/views/TicketDetailView.vue'), meta: { title: '工单详情' } },
        { path: 'chat', name: 'chat', component: () => import('@/views/ChatView.vue'), meta: { title: 'AI 智能客服' } },
        { path: 'hitl', name: 'hitl', component: () => import('@/views/HitlView.vue'), meta: { title: '人工确认', roles: ['agent', 'admin'] } },
        { path: 'knowledge', name: 'knowledge', component: () => import('@/views/KnowledgeView.vue'), meta: { title: '知识库', roles: ['agent', 'admin'] } },
        { path: 'trace', name: 'trace', component: () => import('@/views/TraceView.vue'), meta: { title: 'AI 监控', roles: ['agent', 'admin'] } },
        { path: 'users', name: 'users', component: () => import('@/views/UserView.vue'), meta: { title: '用户管理', roles: ['admin'] } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    // 已登录访问登录页 → 回首页
    if (auth.isLoggedIn) return '/dashboard';
    return true;
  }
  if (!auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  // 已登录但本地无用户信息时拉取一次
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      auth.logout();
      return '/login';
    }
  }
  const roles = to.meta.roles as string[] | undefined;
  if (roles && auth.user && !roles.includes(auth.user.role)) {
    return '/dashboard';
  }
  return true;
});

export default router;
