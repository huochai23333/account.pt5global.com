# 批发订单与费用

当前范围：启用。

## 业务与阅读顺序

管理批发订单、商品、费用、附件及订单变更记录。

数据流：工作台批发渲染器 → getWholesalePageData → WholesaleOrdersSection → 分页和订单写入模块 → 数据库。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

工作台入口与订单操作能力分别判断；数据库分页函数返回 canViewInternalFields，关联数据按行授权读取。

完成依据：独立核对订单编号、影响行数、版本、费用和变更记录，刷新后仍一致。创建重试复用同一请求编号。

## 常见维护

从[批发订单数据流](../explanation/wholesale-order-flow.md)定位筛选、费用、客户投影和保存后的列表恢复。

验证入口：npm run test:learning:browser -- wholesale-order-full-table wholesale-order-create-recovery dashboard-dialog-layers wholesale-order-attachments wholesale-order-attachment-interruption wholesale-order-client-scope wholesale-order-settlement-recovery；npm run test:operation-receipts。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`add_wholesale_order_settlement`、`create_wholesale_order`、`get_wholesale_order_client_contacts`、`get_wholesale_order_page`、`register_wholesale_order_list_attachments`、`update_wholesale_order`。

源码中直接引用的数据表/存储桶：`wholesale_customers`、`wholesale_order_change_logs`、`wholesale_order_list_attachments`、`wholesale_order_settlements`、`wholesale_orders`、`wholesale_referrals`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/learning/wholesale-direct-usd-settlement.test.mjs](../../../scripts/learning/wholesale-direct-usd-settlement.test.mjs)
- [web: scripts/learning/wholesale-fee-customer-fixture.test.mjs](../../../scripts/learning/wholesale-fee-customer-fixture.test.mjs)
- [web: scripts/learning/wholesale-fee-order-fixture.test.mjs](../../../scripts/learning/wholesale-fee-order-fixture.test.mjs)
- [web: scripts/learning/wholesale-fee-page-route.test.mjs](../../../scripts/learning/wholesale-fee-page-route.test.mjs)
- [web: scripts/learning/wholesale-fee-parameter-fixture.test.mjs](../../../scripts/learning/wholesale-fee-parameter-fixture.test.mjs)
- [web: scripts/learning/wholesale-fee-transitions.test.mjs](../../../scripts/learning/wholesale-fee-transitions.test.mjs)
- [web: scripts/learning/wholesale-mutation-failure-scope.test.mjs](../../../scripts/learning/wholesale-mutation-failure-scope.test.mjs)
- [web: scripts/learning/wholesale-order-attachment-fixture.test.mjs](../../../scripts/learning/wholesale-order-attachment-fixture.test.mjs)
- [web: scripts/learning/wholesale-release-fixture.test.mjs](../../../scripts/learning/wholesale-release-fixture.test.mjs)
- [web: scripts/learning/wholesale-settlement-page.test.mjs](../../../scripts/learning/wholesale-settlement-page.test.mjs)
- [web: scripts/learning/wholesale-upload-journal.test.mjs](../../../scripts/learning/wholesale-upload-journal.test.mjs)
- [web: scripts/wholesale-order-fees.test.mjs](../../../scripts/wholesale-order-fees.test.mjs)
- [web: scripts/wholesale-settlement-unallocated-summary.test.mjs](../../../scripts/wholesale-settlement-unallocated-summary.test.mjs)
- [web: tests/e2e/helpers/wholesale-direct-usd-settlement.ts](../../../tests/e2e/helpers/wholesale-direct-usd-settlement.ts)
- [web: tests/e2e/helpers/wholesale-fee-customer-fixture.ts](../../../tests/e2e/helpers/wholesale-fee-customer-fixture.ts)
- [web: tests/e2e/helpers/wholesale-fee-database.ts](../../../tests/e2e/helpers/wholesale-fee-database.ts)
- [web: tests/e2e/helpers/wholesale-fee-order-fixture.ts](../../../tests/e2e/helpers/wholesale-fee-order-fixture.ts)
- [web: tests/e2e/helpers/wholesale-fee-order-page.ts](../../../tests/e2e/helpers/wholesale-fee-order-page.ts)
- [web: tests/e2e/helpers/wholesale-fee-order-transitions.ts](../../../tests/e2e/helpers/wholesale-fee-order-transitions.ts)
- [web: tests/e2e/helpers/wholesale-fee-page-route.ts](../../../tests/e2e/helpers/wholesale-fee-page-route.ts)
- [web: tests/e2e/helpers/wholesale-fee-parameter-fixture.ts](../../../tests/e2e/helpers/wholesale-fee-parameter-fixture.ts)
- [web: tests/e2e/helpers/wholesale-fee-parameter-page.ts](../../../tests/e2e/helpers/wholesale-fee-parameter-page.ts)
- [web: tests/e2e/helpers/wholesale-mutation-failure-scope.ts](../../../tests/e2e/helpers/wholesale-mutation-failure-scope.ts)
- [web: tests/e2e/helpers/wholesale-order-attachment-capability.ts](../../../tests/e2e/helpers/wholesale-order-attachment-capability.ts)
- [web: tests/e2e/helpers/wholesale-order-attachment-fixture.ts](../../../tests/e2e/helpers/wholesale-order-attachment-fixture.ts)
- [web: tests/e2e/helpers/wholesale-order-attachment-page.ts](../../../tests/e2e/helpers/wholesale-order-attachment-page.ts)
- [web: tests/e2e/helpers/wholesale-order-attachment-sharing.ts](../../../tests/e2e/helpers/wholesale-order-attachment-sharing.ts)
- [web: tests/e2e/helpers/wholesale-release-page.ts](../../../tests/e2e/helpers/wholesale-release-page.ts)
- [web: tests/e2e/helpers/wholesale-settlement-fixtures.ts](../../../tests/e2e/helpers/wholesale-settlement-fixtures.ts)
- [web: tests/e2e/order-date-range.spec.ts](../../../tests/e2e/order-date-range.spec.ts)
- [web: tests/e2e/order-list-framework.spec.ts](../../../tests/e2e/order-list-framework.spec.ts)
- [web: tests/e2e/wholesale-customer-management.spec.ts](../../../tests/e2e/wholesale-customer-management.spec.ts)
- [web: tests/e2e/wholesale-customer-other-names.spec.ts](../../../tests/e2e/wholesale-customer-other-names.spec.ts)
- [web: tests/e2e/wholesale-mutation-failures.spec.ts](../../../tests/e2e/wholesale-mutation-failures.spec.ts)
- [web: tests/e2e/wholesale-navigation-order.spec.ts](../../../tests/e2e/wholesale-navigation-order.spec.ts)
- [web: tests/e2e/wholesale-order-attachment-receipts.spec.ts](../../../tests/e2e/wholesale-order-attachment-receipts.spec.ts)
- [web: tests/e2e/wholesale-order-compact-view.spec.ts](../../../tests/e2e/wholesale-order-compact-view.spec.ts)
- [web: tests/e2e/wholesale-order-creation-idempotency.spec.ts](../../../tests/e2e/wholesale-order-creation-idempotency.spec.ts)
- [web: tests/e2e/wholesale-order-date-client.spec.ts](../../../tests/e2e/wholesale-order-date-client.spec.ts)
- [web: tests/e2e/wholesale-order-link-options.spec.ts](../../../tests/e2e/wholesale-order-link-options.spec.ts)
- [web: tests/e2e/wholesale-order-month-filter.spec.ts](../../../tests/e2e/wholesale-order-month-filter.spec.ts)
- [web: tests/e2e/wholesale-order-pagination.spec.ts](../../../tests/e2e/wholesale-order-pagination.spec.ts)
- [web: tests/e2e/wholesale-order-settlements.spec.ts](../../../tests/e2e/wholesale-order-settlements.spec.ts)
- [web: tests/e2e/wholesale-orders-i18n.spec.ts](../../../tests/e2e/wholesale-orders-i18n.spec.ts)
- [web: tests/e2e/wholesale-salesman-collaboration.spec.ts](../../../tests/e2e/wholesale-salesman-collaboration.spec.ts)
- [web: tests/e2e/wholesale-settlement-monthly-summary.spec.ts](../../../tests/e2e/wholesale-settlement-monthly-summary.spec.ts)
- [web: tests/e2e/wholesale-settlement-monthly-unallocated.spec.ts](../../../tests/e2e/wholesale-settlement-monthly-unallocated.spec.ts)
- [web: tests/learning/wholesale-attachment-access-fixture.ts](../../../tests/learning/wholesale-attachment-access-fixture.ts)
- [web: tests/learning/wholesale-attachment-interruption-page.ts](../../../tests/learning/wholesale-attachment-interruption-page.ts)
- [web: tests/learning/wholesale-client-business-add.spec.ts](../../../tests/learning/wholesale-client-business-add.spec.ts)
- [web: tests/learning/wholesale-customer-alias-concurrency.spec.ts](../../../tests/learning/wholesale-customer-alias-concurrency.spec.ts)
- [web: tests/learning/wholesale-customer-delete-fixtures.ts](../../../tests/learning/wholesale-customer-delete-fixtures.ts)
- [web: tests/learning/wholesale-customer-delete-protection.spec.ts](../../../tests/learning/wholesale-customer-delete-protection.spec.ts)
- [web: tests/learning/wholesale-customer-delete-race.ts](../../../tests/learning/wholesale-customer-delete-race.ts)
- [web: tests/learning/wholesale-customer-delete-recovery.spec.ts](../../../tests/learning/wholesale-customer-delete-recovery.spec.ts)
- [web: tests/learning/wholesale-customer-edit-conflict.spec.ts](../../../tests/learning/wholesale-customer-edit-conflict.spec.ts)
- [web: tests/learning/wholesale-customer-link-recovery.spec.ts](../../../tests/learning/wholesale-customer-link-recovery.spec.ts)
- [web: tests/learning/wholesale-customer-record.spec.ts](../../../tests/learning/wholesale-customer-record.spec.ts)
- [web: tests/learning/wholesale-customer-role-matrix.spec.ts](../../../tests/learning/wholesale-customer-role-matrix.spec.ts)
- [web: tests/learning/wholesale-order-assessment.spec.ts](../../../tests/learning/wholesale-order-assessment.spec.ts)
- [web: tests/learning/wholesale-order-attachment-interruption.spec.ts](../../../tests/learning/wholesale-order-attachment-interruption.spec.ts)
- [web: tests/learning/wholesale-order-attachments.spec.ts](../../../tests/learning/wholesale-order-attachments.spec.ts)
- [web: tests/learning/wholesale-order-client-scope.spec.ts](../../../tests/learning/wholesale-order-client-scope.spec.ts)
- [web: tests/learning/wholesale-order-create-recovery.spec.ts](../../../tests/learning/wholesale-order-create-recovery.spec.ts)
- [web: tests/learning/wholesale-order-full-table.spec.ts](../../../tests/learning/wholesale-order-full-table.spec.ts)
- [web: tests/learning/wholesale-order-settlement-recovery.spec.ts](../../../tests/learning/wholesale-order-settlement-recovery.spec.ts)
- [web: tests/test-support/fixtures/wholesale-fee-proof-samples.json](../../../tests/test-support/fixtures/wholesale-fee-proof-samples.json)
- [web: tests/test-support/fixtures/wholesale-fee-transition-samples.json](../../../tests/test-support/fixtures/wholesale-fee-transition-samples.json)
- [web: tests/test-support/wholesale-fee-model.mjs](../../../tests/test-support/wholesale-fee-model.mjs)
- [web: tests/test-support/wholesale-order-attachment-model.mjs](../../../tests/test-support/wholesale-order-attachment-model.mjs)
- [web: tests/test-support/wholesale-release-case.ts](../../../tests/test-support/wholesale-release-case.ts)
- [web: tests/test-support/wholesale-release-receipts.ts](../../../tests/test-support/wholesale-release-receipts.ts)
- [web: tests/test-support/wholesale-release-seed.ts](../../../tests/test-support/wholesale-release-seed.ts)
- [supabase: supabase/tests/finance_wholesale_permissions.sql](../../../../PT5-dropshipping-supabase/supabase/tests/finance_wholesale_permissions.sql)
- [supabase: supabase/tests/wholesale_client_access_and_order_lists.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_client_access_and_order_lists.sql)
- [supabase: supabase/tests/wholesale_financial_revision_readback.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_financial_revision_readback.sql)
- [supabase: supabase/tests/wholesale_order_client_contacts.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_client_contacts.sql)
- [supabase: supabase/tests/wholesale_order_creation_idempotency.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_creation_idempotency.sql)
- [supabase: supabase/tests/wholesale_order_direct_edit_contract.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_direct_edit_contract.sql)
- [supabase: supabase/tests/wholesale_order_direct_edits.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_direct_edits.sql)
- [supabase: supabase/tests/wholesale_order_month_filter.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_month_filter.sql)
- [supabase: supabase/tests/wholesale_order_page.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_page.sql)
- [supabase: supabase/tests/wholesale_order_settlement_idempotency.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_order_settlement_idempotency.sql)
- [supabase: supabase/tests/wholesale_salesman_collaboration.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_salesman_collaboration.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(workspace)/[workspace]/[business]/[section]/wholesale-section-page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/%5Bbusiness%5D/%5Bsection%5D/wholesale-section-page.tsx) | 已审保留：匹配已启用批发栏目；装配服务端首屏和按栏目下发文案 |
| [app/api/wholesale/order-assessment/route.ts](../../../app/api/wholesale/order-assessment/route.ts) | 已审拆分：验证会话、请求与业务入口；将服务结果转换为 HTTP 响应 |
| [components/dashboard/wholesale/client-wholesale-orders-table.tsx](../../../components/dashboard/wholesale/client-wholesale-orders-table.tsx) | 已审保留：客户订单桌面投影 |
| [components/dashboard/wholesale/use-wholesale-action-runner.ts](../../../components/dashboard/wholesale/use-wholesale-action-runner.ts) | 已审拆分：批发写入互斥；写入和重读结果提示 |
| [components/dashboard/wholesale/use-wholesale-actions.ts](../../../components/dashboard/wholesale/use-wholesale-actions.ts) | 已审拆分：组装批发操作；提供订单和客户别名的双语提示 |
| [components/dashboard/wholesale/use-wholesale-order-assessment.ts](../../../components/dashboard/wholesale/use-wholesale-order-assessment.ts) | 已审保留：管理评估请求及同页互斥；维护流式结果、失败和筛选变更状态 |
| [components/dashboard/wholesale/use-wholesale-order-create-submission.ts](../../../components/dashboard/wholesale/use-wholesale-order-create-submission.ts) | 已审保留：创建请求编号；创建提交与关闭 |
| [components/dashboard/wholesale/use-wholesale-order-draft.ts](../../../components/dashboard/wholesale/use-wholesale-order-draft.ts) | 已审拆分：创建和编辑草稿离开保护 |
| [components/dashboard/wholesale/use-wholesale-order-fees.ts](../../../components/dashboard/wholesale/use-wholesale-order-fees.ts) | 已审保留：表单费用预览 |
| [components/dashboard/wholesale/use-wholesale-order-filters.ts](../../../components/dashboard/wholesale/use-wholesale-order-filters.ts) | 已审保留：查询筛选状态；日期范围与精确查找切换 |
| [components/dashboard/wholesale/use-wholesale-order-list-handlers.ts](../../../components/dashboard/wholesale/use-wholesale-order-list-handlers.ts) | 已审保留：附件操作入口能力；组装上传；删除后局部更新 |
| [components/dashboard/wholesale/use-wholesale-order-page.ts](../../../components/dashboard/wholesale/use-wholesale-order-page.ts) | 已审拆分：接入分页读取；写入后重读和附件局部更新 |
| [components/dashboard/wholesale/use-wholesale-settlement-draft.ts](../../../components/dashboard/wholesale/use-wholesale-settlement-draft.ts) | 已审拆分：登记输入和请求编号；同标签页的草稿恢复；提交互斥 |
| [components/dashboard/wholesale/wholesale-action-feedback.tsx](../../../components/dashboard/wholesale/wholesale-action-feedback.tsx) | 已审保留：批发反馈展示 |
| [components/dashboard/wholesale/wholesale-action-utils.ts](../../../components/dashboard/wholesale/wholesale-action-utils.ts) | 已审保留：构造创建和修改订单的请求载荷；规范化共享表单字段；映射批发操作的已知错误 |
| [components/dashboard/wholesale/wholesale-business-actions.ts](../../../components/dashboard/wholesale/wholesale-business-actions.ts) | 已审拆分：调度推荐关系录入；调度批发提成结算与界面结果 |
| [components/dashboard/wholesale/wholesale-client-contact.ts](../../../components/dashboard/wholesale/wholesale-client-contact.ts) | 已审保留：客户订单负责人名称映射 |
| [components/dashboard/wholesale/wholesale-client.tsx](../../../components/dashboard/wholesale/wholesale-client.tsx) | 已审保留：批发板块组装；首屏资料索引；操作回调分发 |
| [components/dashboard/wholesale/wholesale-detail-grid.tsx](../../../components/dashboard/wholesale/wholesale-detail-grid.tsx) | 已审保留：详情字段网格 |
| [components/dashboard/wholesale/wholesale-display.ts](../../../components/dashboard/wholesale/wholesale-display.ts) | 已审拆分：批发状态显示名；金额和日期格式；目录名称显示 |
| [components/dashboard/wholesale/wholesale-order-actions.ts](../../../components/dashboard/wholesale/wholesale-order-actions.ts) | 已审拆分：订单写入调用；检查写入编号；调度局部重读 |
| [components/dashboard/wholesale/wholesale-order-assessment-panel.tsx](../../../components/dashboard/wholesale/wholesale-order-assessment-panel.tsx) | 已审保留：触发生成；展示空数据、进行中、失败和旧结果 |
| [components/dashboard/wholesale/wholesale-order-change-sections.tsx](../../../components/dashboard/wholesale/wholesale-order-change-sections.tsx) | 已审保留：订单变更历史分组展示 |
| [components/dashboard/wholesale/wholesale-order-detail-rows.ts](../../../components/dashboard/wholesale/wholesale-order-detail-rows.ts) | 已审拆分：基本信息投影；已保存费用投影 |
| [components/dashboard/wholesale/wholesale-order-details-dialog.tsx](../../../components/dashboard/wholesale/wholesale-order-details-dialog.tsx) | 已审拆分：详情弹窗与操作编排；结汇信息展示；附件区组装 |
| [components/dashboard/wholesale/wholesale-order-edit-dialog.tsx](../../../components/dashboard/wholesale/wholesale-order-edit-dialog.tsx) | 已审拆分：编辑弹窗组装；编辑字段与提交调度 |
| [components/dashboard/wholesale/wholesale-order-edit-form-utils.ts](../../../components/dashboard/wholesale/wholesale-order-edit-form-utils.ts) | 已审保留：编辑表单初始值与变化比较；编辑字段名称映射 |
| [components/dashboard/wholesale/wholesale-order-fee-fields.tsx](../../../components/dashboard/wholesale/wholesale-order-fee-fields.tsx) | 已审保留：费用预览字段展示 |
| [components/dashboard/wholesale/wholesale-order-filters.tsx](../../../components/dashboard/wholesale/wholesale-order-filters.tsx) | 已审保留：展示订单筛选控件；将控件事件交给筛选 hook |
| [components/dashboard/wholesale/wholesale-order-form-dialog.tsx](../../../components/dashboard/wholesale/wholesale-order-form-dialog.tsx) | 已审拆分：创建弹窗组装；连接草稿和预览 |
| [components/dashboard/wholesale/wholesale-order-form-options.ts](../../../components/dashboard/wholesale/wholesale-order-form-options.ts) | 已审保留：收款平台选项；币种候选去重 |
| [components/dashboard/wholesale/wholesale-order-link-options.ts](../../../components/dashboard/wholesale/wholesale-order-link-options.ts) | 已审保留：关联订单候选投影 |
| [components/dashboard/wholesale/wholesale-order-list-actions.ts](../../../components/dashboard/wholesale/wholesale-order-list-actions.ts) | 已审拆分：组装上传与删除动作；按明确拒绝和待核对选择日常反馈 |
| [components/dashboard/wholesale/wholesale-order-list-attachment-dialog.tsx](../../../components/dashboard/wholesale/wholesale-order-list-attachment-dialog.tsx) | 已审拆分：文件选择；上传状态与提示；确认删除 |
| [components/dashboard/wholesale/wholesale-order-list-attachments.tsx](../../../components/dashboard/wholesale/wholesale-order-list-attachments.tsx) | 已审拆分：附件摘要展示；私有下载；弹窗入口 |
| [components/dashboard/wholesale/wholesale-order-permissions.ts](../../../components/dashboard/wholesale/wholesale-order-permissions.ts) | 已审保留：订单行操作入口权限 |
| [components/dashboard/wholesale/wholesale-order-rate-dialogs.tsx](../../../components/dashboard/wholesale/wholesale-order-rate-dialogs.tsx) | 已审拆分：登记表单组装；当前日期的汇率预览；结汇历史展示 |
| [components/dashboard/wholesale/wholesale-order-settlement-records-cell.tsx](../../../components/dashboard/wholesale/wholesale-order-settlement-records-cell.tsx) | 已审保留：结汇记录单元格 |
| [components/dashboard/wholesale/wholesale-order-summary.tsx](../../../components/dashboard/wholesale/wholesale-order-summary.tsx) | 已审保留：当前筛选汇总展示 |
| [components/dashboard/wholesale/wholesale-order-view-data.ts](../../../components/dashboard/wholesale/wholesale-order-view-data.ts) | 已审保留：当前页数据索引 |
| [components/dashboard/wholesale/wholesale-orders-compact-table.tsx](../../../components/dashboard/wholesale/wholesale-orders-compact-table.tsx) | 已审拆分：紧凑表格；详情入口状态 |
| [components/dashboard/wholesale/wholesale-orders-list-section.tsx](../../../components/dashboard/wholesale/wholesale-orders-list-section.tsx) | 已审保留：组装分页订单列表及读取状态；选择桌面列视图与手机卡片；安放共享评估面板 |
| [components/dashboard/wholesale/wholesale-orders-mobile-list.tsx](../../../components/dashboard/wholesale/wholesale-orders-mobile-list.tsx) | 已审拆分：移动订单卡片；详情选择和操作转发 |
| [components/dashboard/wholesale/wholesale-orders-section-types.ts](../../../components/dashboard/wholesale/wholesale-orders-section-types.ts) | 已审保留：定义 WholesaleOrdersSectionProps 等1项同模块类型合同 |
| [components/dashboard/wholesale/wholesale-orders-section.tsx](../../../components/dashboard/wholesale/wholesale-orders-section.tsx) | 已审拆分：组合查询与筛选 Hook；按已授权记录调度编辑、结汇和附件入口；挂载订单列表、评估和弹窗 |
| [components/dashboard/wholesale/wholesale-orders-table.tsx](../../../components/dashboard/wholesale/wholesale-orders-table.tsx) | 已审拆分：生成完整表格的表头与订单单元格；按订单转发编辑、结汇与附件回调；展示结汇进度与费用字段 |
| [lib/order-date-range.ts](../../../lib/order-date-range.ts) | 已审保留：上海日期快捷范围；日历日期与区间边界 |
| [lib/wholesale-order-assessment-filters.ts](../../../lib/wholesale-order-assessment-filters.ts) | 已审拆分：把未知请求值规范为批发列表筛选 |
| [lib/wholesale-order-assessment-messages.ts](../../../lib/wholesale-order-assessment-messages.ts) | 已审保留：按汇总、客户样例与订单样例构造供应商输入 |
| [lib/wholesale-order-assessment-run.ts](../../../lib/wholesale-order-assessment-run.ts) | 已审拆分：管理评估额度与超时；确认订单范围及权限；协调供应商流与运行凭证 |
| [lib/wholesale-order-assessment-sample.ts](../../../lib/wholesale-order-assessment-sample.ts) | 已审保留：通过同一分页接口合并有限评估样例 |
| [lib/wholesale-order-assessment-types.ts](../../../lib/wholesale-order-assessment-types.ts) | 已审保留：共享订单评估筛选与服务返回类型 |
| [lib/wholesale-order-assessment.ts](../../../lib/wholesale-order-assessment.ts) | 已审保留：提供评估输入相关模块的单一导入点 |
| [lib/wholesale-order-fees.ts](../../../lib/wholesale-order-fees.ts) | 已审保留：批发费用预览计算 |
| [lib/wholesale-order-list-attachments.ts](../../../lib/wholesale-order-list-attachments.ts) | 已审拆分：附件数据合同；下载地址；删除附件 |
| [lib/wholesale-order-list-registration.ts](../../../lib/wholesale-order-list-registration.ts) | 已审拆分：提交登记并解析权威回执；按准确订单、桶、路径核对未确认登记 |
| [lib/wholesale-order-list-upload-journal.ts](../../../lib/wholesale-order-list-upload-journal.ts) | 已审拆分：校验并保存当前用户、订单的标签页上传记录；按摘要配对原文件，允许重选顺序变化；核对登记的订单、上传者、桶及文件元数据 |
| [lib/wholesale-order-list-upload-object.ts](../../../lib/wholesale-order-list-upload-object.ts) | 已审拆分：执行原路径的非覆盖上传；独立读回并核对实际文件正文 |
| [lib/wholesale-order-list-upload.ts](../../../lib/wholesale-order-list-upload.ts) | 已审拆分：校验文件及现有附件上限并命名安全路径；按标签页记录编排上传、恢复、登记及限定补偿 |
| [lib/wholesale-order-page-decoders.ts](../../../lib/wholesale-order-page-decoders.ts) | 已审保留：分页结果形状归一；关联查询警告归并 |
| [lib/wholesale-order-page.ts](../../../lib/wholesale-order-page.ts) | 已审保留：读取订单核心页；按页读取关联结果 |
| [lib/wholesale-related-query.ts](../../../lib/wholesale-related-query.ts) | 已审保留：跳过关联读取的同形空结果 |
| [lib/wholesale-role-permissions.ts](../../../lib/wholesale-role-permissions.ts) | 已审拆分：提供批发岗位能力；为读取和订单协作提供能力入口 |
| [lib/wholesale-row-queries.ts](../../../lib/wholesale-row-queries.ts) | 已审保留：完整分页读取；客户来源线索映射；提成页批量订单读取 |
| [lib/wholesale-scope-related.ts](../../../lib/wholesale-scope-related.ts) | 已审拆分：裁剪提成明细；裁剪订单修改历史；裁剪订单结汇记录 |
| [lib/wholesale-scope.ts](../../../lib/wholesale-scope.ts) | 已审保留：客户与订单集合裁剪；已裁剪关联集合编排 |
| [lib/wholesale-types.ts](../../../lib/wholesale-types.ts) | 已审保留：批发记录与页面数据类型；内部订单形状守卫 |
| [lib/wholesale.ts](../../../lib/wholesale.ts) | 已审保留：首屏读取调度；查询分支选择；页面数据形状初始化 |
