/**
 * 幂等性拦截器（轻量内存版，演示阶段四「幂等性与并发控制」）
 * 客户端在写请求头携带 X-Idempotency-Key，同一 Key 的重复请求
 * 直接返回首次执行结果，避免重复建单/重复扣款
 *
 * 生产建议：将 Map 换成 Redis（SETNX + 过期时间），保证多实例一致性
 */
import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, ConflictException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/** 内存存储：key -> { body, expiresAt }；2 小时过期 */
const store = new Map<string, { body: any; expiresAt: number }>();
const TTL = 2 * 60 * 60 * 1000;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const key = req.header('X-Idempotency-Key');

    // 未携带幂等键：直接放行
    if (!key || (req.method !== 'POST' && req.method !== 'PATCH')) {
      return next.handle();
    }

    // 清理过期条目，防止内存膨胀
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.expiresAt < now) store.delete(k);
    }

    // 命中历史结果：直接返回缓存响应
    const cached = store.get(key);
    if (cached) {
      res.setHeader('X-Idempotency-Replay', 'true');
      return of(cached.body);
    }

    // 首次执行：记录结果并缓存
    return next.handle().pipe(
      tap((body) => {
        store.set(key, { body, expiresAt: now + TTL });
      }),
    );
  }
}

/** 若要在路由上显式声明并发上限，可另行使用（示例） */
export function assertNotProcessing(key: string): void {
  if (store.has(key)) {
    throw new ConflictException('请求处理中或已处理，请勿重复提交');
  }
}
