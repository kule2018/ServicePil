/**
 * Axios 实例 + 统一拦截
 *  - 请求：自动携带 Authorization Bearer token
 *  - 响应：后端统一 { code, message, data }；code!==0 或 HTTP 非 2xx 抛错
 */
import axios, { AxiosError } from 'axios';
import { ElMessage } from 'element-plus';
import type { ApiResp } from '@/types';

export const TOKEN_KEY = 'sp_token';

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 60000, // Agent 工作流耗时可能较长
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResp;
    // 后端业务码：0 成功；否则按错误处理
    if (body && typeof body.code === 'number' && body.code !== 0) {
      ElMessage.error(body.message || '请求失败');
      return Promise.reject(new Error(body.message));
    }
    return response;
  },
  (error: AxiosError<ApiResp>) => {
    const status = error.response?.status;
    const msg = error.response?.data?.message || error.message || '网络异常';
    if (status === 401) {
      // 登录失效：清理本地状态并跳转登录页
      localStorage.removeItem(TOKEN_KEY);
      if (!location.pathname.startsWith('/login')) {
        location.href = '/login';
      }
      ElMessage.warning('登录已过期，请重新登录');
    } else {
      ElMessage.error(msg);
    }
    return Promise.reject(error);
  },
);

/** 泛型取 data 的请求帮助函数 */
export async function request<T>(config: Parameters<typeof http.request>[0]): Promise<T> {
  const resp = await http.request<ApiResp<T>>(config);
  return resp.data.data;
}

export default http;
