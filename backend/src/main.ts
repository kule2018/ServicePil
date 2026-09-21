/**
 * 应用启动入口 main.ts
 * 职责：创建 Nest 应用、注册全局管道/拦截器/过滤器、开启 CORS、监听端口
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // 全局校验管道：whitelist 剔除多余字段，transform 自动类型转换
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // 统一成功响应结构 { code, message, data }
  app.useGlobalInterceptors(new ResponseInterceptor());
  // 统一异常响应结构
  app.useGlobalFilters(new HttpExceptionFilter());

  // API 前缀
  const apiPrefix = config.get<string>('apiPrefix') ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // 开发期前端(5173)跨域；生产由 Nginx/Docker 同源代理
  app.enableCors({ origin: true, credentials: true });

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  console.log(`ServicePilot API 已启动: http://localhost:${port}/${apiPrefix}`);
  console.log(`LLM Provider: ${config.get('llm.provider')} | Embedding: ${config.get('embedding.provider')}`);
}

bootstrap();
