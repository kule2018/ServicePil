/**
 * 退款触发词配置模块 refund-keyword.module.ts
 * 提供 refund_keyword 表的读写与维护接口（控制器 + 服务）。
 * 被 AgentModule（匹配退款诉求）与 AppModule（注册控制器）共同依赖，
 * 因此导出 RefundKeywordService。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefundKeyword } from '../../entities/refund-keyword.entity';
import { RefundKeywordService } from './refund-keyword.service';
import { RefundKeywordController } from './refund-keyword.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RefundKeyword])],
  controllers: [RefundKeywordController],
  providers: [RefundKeywordService],
  exports: [RefundKeywordService],
})
export class RefundKeywordModule {}
