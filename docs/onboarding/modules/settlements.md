# 结汇收款发布与分配

当前范围：启用。

## 业务与阅读顺序

发布、确认和分配结汇收款，并保留撤回或冲销历史。

数据流：批发 settlement-releases → 收款、订单与分配查询 → 发布/分配弹窗 → 带版本的数据库写入 → 历史与余额。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

管理员和财务可发布及取消待分配收款。管理员、业务员和财务可分配及清空；已发放提成的关联订单受数据库保护。

完成依据：核对收款编号、下一修订号、有效分配和关联结汇；清空后保留原冲销行，活动分配与关联结汇均归零。

## 常见维护

见[结汇收款数据流](../explanation/wholesale-settlement-release-flow.md)。分别维护订单分配、清空核对、月度已分配与未分配口径。

验证入口：npm run test:settlement-unallocated；npm run test:learning:browser -- wholesale-settlement-release-publication-recovery wholesale-settlement-release-clear-recovery；后端结汇 SQL 隔离执行；原浏览器套件按准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`cancel_wholesale_settlement_release`、`clear_wholesale_settlement_release_allocations`、`create_wholesale_settlement_release`、`find_wholesale_settlement_customer_matches`、`get_monthly_settlement_allocated_usd`、`replace_wholesale_settlement_release_allocations`、`request_settlement_exchange_rate_repair`。

源码中直接引用的数据表/存储桶：`user_profiles`、`user_roles`、`user_roles_data`、`wholesale_customers`、`wholesale_order_settlements`、`wholesale_orders`、`wholesale_settlement_release_allocations`、`wholesale_settlement_releases`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/e2e/ai-assistant-settlement-release.spec.ts](../../../tests/e2e/ai-assistant-settlement-release.spec.ts)
- [web: tests/e2e/wholesale-settlement-releases.spec.ts](../../../tests/e2e/wholesale-settlement-releases.spec.ts)
- [web: tests/learning/wholesale-settlement-release-clear-recovery.spec.ts](../../../tests/learning/wholesale-settlement-release-clear-recovery.spec.ts)
- [web: tests/learning/wholesale-settlement-release-publication-recovery.spec.ts](../../../tests/learning/wholesale-settlement-release-publication-recovery.spec.ts)
- [supabase: supabase/tests/wholesale_settlement_releases.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_settlement_releases.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/dashboard/ai-assistant/ai-assistant-settlement-release-card.tsx](../../../components/dashboard/ai-assistant/ai-assistant-settlement-release-card.tsx) | 已审保留：展示待确认收款、状态和错误；将确认或取消交给回调 |
| [components/dashboard/ai-assistant/use-ai-assistant-settlement-release.ts](../../../components/dashboard/ai-assistant/use-ai-assistant-settlement-release.ts) | 已审保留：管理助手卡片的确认、取消和重试状态；提交原确认数据并读取发布编号 |
| [components/dashboard/wholesale/use-wholesale-settlement-release-actions.ts](../../../components/dashboard/wholesale/use-wholesale-settlement-release-actions.ts) | 已审拆分：调度取消、分配及清空；处理缺汇率补齐与分配重试 |
| [components/dashboard/wholesale/use-wholesale-settlement-release-allocation-form.ts](../../../components/dashboard/wholesale/use-wholesale-settlement-release-allocation-form.ts) | 已审保留：维护客户、金额草稿和订单过滤；派生余额、建议及提交条件 |
| [components/dashboard/wholesale/use-wholesale-settlement-release-publication.ts](../../../components/dashboard/wholesale/use-wholesale-settlement-release-publication.ts) | 已审拆分：按账号和标签页管理待确认编号；调度发布、只读核对与双语失败反馈 |
| [components/dashboard/wholesale/wholesale-settlement-release-allocation-dialog.tsx](../../../components/dashboard/wholesale/wholesale-settlement-release-allocation-dialog.tsx) | 已审保留：呈现分配表单及回执状态；调度保存或确认清空 |
| [components/dashboard/wholesale/wholesale-settlement-release-allocation-order-list.tsx](../../../components/dashboard/wholesale/wholesale-settlement-release-allocation-order-list.tsx) | 已审保留：展示订单分配金额和错误；转发检索、金额修改和清除 |
| [components/dashboard/wholesale/wholesale-settlement-release-client.tsx](../../../components/dashboard/wholesale/wholesale-settlement-release-client.tsx) | 已审保留：组装收款页面并传递岗位能力 |
| [components/dashboard/wholesale/wholesale-settlement-release-dialogs.tsx](../../../components/dashboard/wholesale/wholesale-settlement-release-dialogs.tsx) | 已审保留：呈现发布表单和正式/临时客户切换；提交输入并保留失败草稿 |
| [components/dashboard/wholesale/wholesale-settlement-release-display.ts](../../../components/dashboard/wholesale/wholesale-settlement-release-display.ts) | 已审保留：派生分配余额、展示状态和最近处理；构造搜索文本及简要描述 |
| [components/dashboard/wholesale/wholesale-settlement-release-section.tsx](../../../components/dashboard/wholesale/wholesale-settlement-release-section.tsx) | 已审保留：组装收款筛选、分页和汇总；调度发布与分配弹窗 |
| [components/dashboard/wholesale/wholesale-settlement-release-summary.tsx](../../../components/dashboard/wholesale/wholesale-settlement-release-summary.tsx) | 已审保留：展示收款统计及按币种余额 |
| [components/dashboard/wholesale/wholesale-settlement-release-table.tsx](../../../components/dashboard/wholesale/wholesale-settlement-release-table.tsx) | 已审保留：渲染收款、金额及最近操作；转发分配和取消动作 |
| [lib/ai-assistant/settlement-release-command.ts](../../../lib/ai-assistant/settlement-release-command.ts) | 已审保留：识别单笔可验证的结汇指令；解析客户、金额、日期和备注 |
| [lib/ai-assistant/settlement-release-server.ts](../../../lib/ai-assistant/settlement-release-server.ts) | 已审保留：查找客户并生成确认数据；复核确认输入并发布 |
| [lib/wholesale-settlement-release-clear.ts](../../../lib/wholesale-settlement-release-clear.ts) | 已审保留：提交带原版本的清空请求；独立核对原冲销记录及零关联结汇 |
| [lib/wholesale-settlement-release-publication.ts](../../../lib/wholesale-settlement-release-publication.ts) | 已审拆分：对规范化表单和数据库收款使用相同摘要；调用发布函数并读取权威记录核对 |
| [lib/wholesale-settlement-release-summary.ts](../../../lib/wholesale-settlement-release-summary.ts) | 已审保留：按上海月界和收款日统计未分配金额；读取并校验已分配美元统计 |
| [lib/wholesale-settlement-releases.ts](../../../lib/wholesale-settlement-releases.ts) | 已审保留：定义收款、分配和页面数据形状；加载当前会话的收款页数据 |
