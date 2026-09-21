/**
 * 全局异常过滤器
 * 将所有异常统一为 { code: HttpStatus, message, data: null }，
 * 与 ResponseInterceptor 成功格式对应，保证前端解析逻辑一致
 */
import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 已知 HTTP 异常：使用其自带状态码与提示
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as any).message ?? exception.message);
      return response.status(status).json({
        code: status,
        message: Array.isArray(message) ? message.join('；') : message,
        data: null,
      });
    }

    // 未知异常：500，避免把堆栈细节暴露给前端
    this.logger.error('未捕获异常', exception instanceof Error ? exception.stack : String(exception));
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '服务内部错误，请稍后重试',
      data: null,
    });
  }
}
