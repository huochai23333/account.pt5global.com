# 共享读取、恢复与格式工具

当前范围：共享。

## 业务与阅读顺序

为业务页面提供完整集合读取、两类分页、页面恢复和显示格式，并在服务端统一处理公开地址、请求体上限和 AI 请求额度。

数据流：列表选择客户端切片或服务端按页读取；WorkspaceSessionProvider 订阅浏览器恢复事件；API 在解析输入和开始外部工作前使用各自的服务端边界工具。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

读取沿用调用方登录身份及 RLS。AI 配额由数据库核定；公开回跳地址使用配置及受限本机规则。格式化和错误映射仅负责展示。

完成依据：筛选变更时回到第一页且旧读取不覆盖新结果；超限识别、公开来源和刷新恢复有对应边界证据。

## 常见维护

阅读[共享读取与请求边界](../explanation/shared-read-and-request-flow.md)。业务筛选和角色规则留在调用方，展示格式集中在 dashboard-shared-formatters。

验证入口：npm run test:server-request-body、npm run test:public-site-origin、npm run typecheck 和受影响业务页面测试。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`acquire_api_request_quota`、`release_api_request_quota`。

源码中直接引用的数据表/存储桶：本模块未发现字面量 from 调用。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/document-archive-paths.test.mjs](../../../scripts/document-archive-paths.test.mjs)
- [web: scripts/document-upload-recovery.test.mjs](../../../scripts/document-upload-recovery.test.mjs)
- [web: scripts/e2e-fixture-policy.test.mjs](../../../scripts/e2e-fixture-policy.test.mjs)
- [web: scripts/learning/assistant-settlement-fixture.test.mjs](../../../scripts/learning/assistant-settlement-fixture.test.mjs)
- [web: scripts/learning/boc-manual-rate-case.test.mjs](../../../scripts/learning/boc-manual-rate-case.test.mjs)
- [web: scripts/learning/boc-quote-job-case.test.mjs](../../../scripts/learning/boc-quote-job-case.test.mjs)
- [web: scripts/learning/boc-recalculation-cohort.test.mjs](../../../scripts/learning/boc-recalculation-cohort.test.mjs)
- [web: scripts/learning/check-learning.test.mjs](../../../scripts/learning/check-learning.test.mjs)
- [web: scripts/learning/clean-local-artifacts.test.mjs](../../../scripts/learning/clean-local-artifacts.test.mjs)
- [web: scripts/learning/commission-merge-fixtures.test.mjs](../../../scripts/learning/commission-merge-fixtures.test.mjs)
- [web: scripts/learning/customer-alias-fixture.test.mjs](../../../scripts/learning/customer-alias-fixture.test.mjs)
- [web: scripts/learning/dashboard-source-rules.test.mjs](../../../scripts/learning/dashboard-source-rules.test.mjs)
- [web: scripts/learning/doctor-checks.test.mjs](../../../scripts/learning/doctor-checks.test.mjs)
- [web: scripts/learning/document-fixture-cleanup.test.mjs](../../../scripts/learning/document-fixture-cleanup.test.mjs)
- [web: scripts/learning/document-fixture-store.test.mjs](../../../scripts/learning/document-fixture-store.test.mjs)
- [web: scripts/learning/e2e-cohorts.test.mjs](../../../scripts/learning/e2e-cohorts.test.mjs)
- [web: scripts/learning/fixture-cleanup-sequence.test.mjs](../../../scripts/learning/fixture-cleanup-sequence.test.mjs)
- [web: scripts/learning/guide-rendering.test.mjs](../../../scripts/learning/guide-rendering.test.mjs)
- [web: scripts/learning/inventory-order-fixture.test.mjs](../../../scripts/learning/inventory-order-fixture.test.mjs)
- [web: scripts/learning/local-api-config.test.mjs](../../../scripts/learning/local-api-config.test.mjs)
- [web: scripts/learning/manual-review.test.mjs](../../../scripts/learning/manual-review.test.mjs)
- [web: scripts/learning/monthly-settlement-lifecycle.test.mjs](../../../scripts/learning/monthly-settlement-lifecycle.test.mjs)
- [web: scripts/learning/owned-governance-todo.test.mjs](../../../scripts/learning/owned-governance-todo.test.mjs)
- [web: scripts/learning/postgres-document-lock.test.mjs](../../../scripts/learning/postgres-document-lock.test.mjs)
- [web: scripts/learning/recalculation-preview-response.test.mjs](../../../scripts/learning/recalculation-preview-response.test.mjs)
- [web: scripts/learning/reimbursement-sharing-case.test.mjs](../../../scripts/learning/reimbursement-sharing-case.test.mjs)
- [web: scripts/learning/review-coverage.test.mjs](../../../scripts/learning/review-coverage.test.mjs)
- [web: scripts/learning/settlement-fixture-cleanup.test.mjs](../../../scripts/learning/settlement-fixture-cleanup.test.mjs)
- [web: scripts/learning/shanghai-calendar.test.mjs](../../../scripts/learning/shanghai-calendar.test.mjs)
- [web: scripts/learning/template-document-fixture-cleanup.test.mjs](../../../scripts/learning/template-document-fixture-cleanup.test.mjs)
- [web: scripts/learning/template-draft-fixtures.test.mjs](../../../scripts/learning/template-draft-fixtures.test.mjs)
- [web: scripts/minimatch-security.test.cjs](../../../scripts/minimatch-security.test.cjs)
- [web: scripts/public-site-origin.test.mjs](../../../scripts/public-site-origin.test.mjs)
- [web: scripts/record-test-run.test.mjs](../../../scripts/record-test-run.test.mjs)
- [web: scripts/security-dependencies.test.cjs](../../../scripts/security-dependencies.test.cjs)
- [web: scripts/server-request-body.test.mjs](../../../scripts/server-request-body.test.mjs)
- [web: scripts/template-content-sandbox.test.cjs](../../../scripts/template-content-sandbox.test.cjs)
- [web: scripts/template-document-origin.test.mjs](../../../scripts/template-document-origin.test.mjs)
- [web: tests/contracts/helpers/render-home-editor.ts](../../../tests/contracts/helpers/render-home-editor.ts)
- [web: tests/contracts/home-editor-geometry.spec.ts](../../../tests/contracts/home-editor-geometry.spec.ts)
- [web: tests/contracts/retained-commission-settlement.spec.ts](../../../tests/contracts/retained-commission-settlement.spec.ts)
- [web: tests/contracts/retained-tourism-display.spec.ts](../../../tests/contracts/retained-tourism-display.spec.ts)
- [web: tests/contracts/tourism-collaboration-retained.spec.ts](../../../tests/contracts/tourism-collaboration-retained.spec.ts)
- [web: tests/e2e/admin-person-account-bundle.spec.ts](../../../tests/e2e/admin-person-account-bundle.spec.ts)
- [web: tests/e2e/api-request-limits.spec.ts](../../../tests/e2e/api-request-limits.spec.ts)
- [web: tests/e2e/dashboard-framework.spec.ts](../../../tests/e2e/dashboard-framework.spec.ts)
- [web: tests/e2e/dashboard-my-password-reset.spec.ts](../../../tests/e2e/dashboard-my-password-reset.spec.ts)
- [web: tests/e2e/dashboard-numbered-pages.spec.ts](../../../tests/e2e/dashboard-numbered-pages.spec.ts)
- [web: tests/e2e/dashboard-responsive-ui.spec.ts](../../../tests/e2e/dashboard-responsive-ui.spec.ts)
- [web: tests/e2e/dashboard-search-input.spec.ts](../../../tests/e2e/dashboard-search-input.spec.ts)
- [web: tests/e2e/dashboard-table-divider.spec.ts](../../../tests/e2e/dashboard-table-divider.spec.ts)
- [web: tests/e2e/date-picker.spec.ts](../../../tests/e2e/date-picker.spec.ts)
- [web: tests/e2e/design-system-controls.spec.ts](../../../tests/e2e/design-system-controls.spec.ts)
- [web: tests/e2e/design-system-forms.spec.ts](../../../tests/e2e/design-system-forms.spec.ts)
- [web: tests/e2e/design-system-governance.spec.ts](../../../tests/e2e/design-system-governance.spec.ts)
- [web: tests/e2e/design-system-todo-form.spec.ts](../../../tests/e2e/design-system-todo-form.spec.ts)
- [web: tests/e2e/design-system-visual.spec.ts](../../../tests/e2e/design-system-visual.spec.ts)
- [web: tests/e2e/document-profile-entrypoints.spec.ts](../../../tests/e2e/document-profile-entrypoints.spec.ts)
- [web: tests/e2e/document-unified-migration.spec.ts](../../../tests/e2e/document-unified-migration.spec.ts)
- [web: tests/e2e/document-windows-outcome.spec.ts](../../../tests/e2e/document-windows-outcome.spec.ts)
- [web: tests/e2e/document-windows-template.spec.ts](../../../tests/e2e/document-windows-template.spec.ts)
- [web: tests/e2e/document-windows-timeout.spec.ts](../../../tests/e2e/document-windows-timeout.spec.ts)
- [web: tests/e2e/document-windows.spec.ts](../../../tests/e2e/document-windows.spec.ts)
- [web: tests/e2e/finance-business-access.spec.ts](../../../tests/e2e/finance-business-access.spec.ts)
- [web: tests/e2e/helpers/accounts.ts](../../../tests/e2e/helpers/accounts.ts)
- [web: tests/e2e/helpers/assistant-settlement-environment.ts](../../../tests/e2e/helpers/assistant-settlement-environment.ts)
- [web: tests/e2e/helpers/assistant-settlement-page.ts](../../../tests/e2e/helpers/assistant-settlement-page.ts)
- [web: tests/e2e/helpers/boc-manual-rate-page.ts](../../../tests/e2e/helpers/boc-manual-rate-page.ts)
- [web: tests/e2e/helpers/boc-recalculation-lifecycle.ts](../../../tests/e2e/helpers/boc-recalculation-lifecycle.ts)
- [web: tests/e2e/helpers/boc-suite-fixture.ts](../../../tests/e2e/helpers/boc-suite-fixture.ts)
- [web: tests/e2e/helpers/boc-suite-guard.ts](../../../tests/e2e/helpers/boc-suite-guard.ts)
- [web: tests/e2e/helpers/client-business-fixture.ts](../../../tests/e2e/helpers/client-business-fixture.ts)
- [web: tests/e2e/helpers/commission-merge-fixture.ts](../../../tests/e2e/helpers/commission-merge-fixture.ts)
- [web: tests/e2e/helpers/company-expense-fixture.ts](../../../tests/e2e/helpers/company-expense-fixture.ts)
- [web: tests/e2e/helpers/customer-alias-fixture.ts](../../../tests/e2e/helpers/customer-alias-fixture.ts)
- [web: tests/e2e/helpers/date-control.ts](../../../tests/e2e/helpers/date-control.ts)
- [web: tests/e2e/helpers/design-system-controls.ts](../../../tests/e2e/helpers/design-system-controls.ts)
- [web: tests/e2e/helpers/design-system-filters.ts](../../../tests/e2e/helpers/design-system-filters.ts)
- [web: tests/e2e/helpers/design-system-governance.ts](../../../tests/e2e/helpers/design-system-governance.ts)
- [web: tests/e2e/helpers/design-system-visual.ts](../../../tests/e2e/helpers/design-system-visual.ts)
- [web: tests/e2e/helpers/document-access.ts](../../../tests/e2e/helpers/document-access.ts)
- [web: tests/e2e/helpers/document-fixture-cleanup.ts](../../../tests/e2e/helpers/document-fixture-cleanup.ts)
- [web: tests/e2e/helpers/document-write-lock.ts](../../../tests/e2e/helpers/document-write-lock.ts)
- [web: tests/e2e/helpers/generic-template-fixture.ts](../../../tests/e2e/helpers/generic-template-fixture.ts)
- [web: tests/e2e/helpers/governance-todo-database.ts](../../../tests/e2e/helpers/governance-todo-database.ts)
- [web: tests/e2e/helpers/home-editor-geometry.ts](../../../tests/e2e/helpers/home-editor-geometry.ts)
- [web: tests/e2e/helpers/home-layout-persistence.ts](../../../tests/e2e/helpers/home-layout-persistence.ts)
- [web: tests/e2e/helpers/home-manager.ts](../../../tests/e2e/helpers/home-manager.ts)
- [web: tests/e2e/helpers/home-resize-editor.ts](../../../tests/e2e/helpers/home-resize-editor.ts)
- [web: tests/e2e/helpers/home-resize-preview.ts](../../../tests/e2e/helpers/home-resize-preview.ts)
- [web: tests/e2e/helpers/home-widget-assertions.ts](../../../tests/e2e/helpers/home-widget-assertions.ts)
- [web: tests/e2e/helpers/inventory-credit-pages.ts](../../../tests/e2e/helpers/inventory-credit-pages.ts)
- [web: tests/e2e/helpers/inventory-order-pages.ts](../../../tests/e2e/helpers/inventory-order-pages.ts)
- [web: tests/e2e/helpers/inventory-order-read-pages.ts](../../../tests/e2e/helpers/inventory-order-read-pages.ts)
- [web: tests/e2e/helpers/local-postgres-query.ts](../../../tests/e2e/helpers/local-postgres-query.ts)
- [web: tests/e2e/helpers/monthly-settlement-cards.ts](../../../tests/e2e/helpers/monthly-settlement-cards.ts)
- [web: tests/e2e/helpers/monthly-settlement-fixture.ts](../../../tests/e2e/helpers/monthly-settlement-fixture.ts)
- [web: tests/e2e/helpers/order-filter-visibility.ts](../../../tests/e2e/helpers/order-filter-visibility.ts)
- [web: tests/e2e/helpers/recalculation-preview-response.ts](../../../tests/e2e/helpers/recalculation-preview-response.ts)
- [web: tests/e2e/helpers/reimbursement-sharing-fixture.ts](../../../tests/e2e/helpers/reimbursement-sharing-fixture.ts)
- [web: tests/e2e/helpers/reimbursement-sharing-pages.ts](../../../tests/e2e/helpers/reimbursement-sharing-pages.ts)
- [web: tests/e2e/helpers/select-control.ts](../../../tests/e2e/helpers/select-control.ts)
- [web: tests/e2e/helpers/settlement-repair-page.ts](../../../tests/e2e/helpers/settlement-repair-page.ts)
- [web: tests/e2e/helpers/template-draft-fixture.ts](../../../tests/e2e/helpers/template-draft-fixture.ts)
- [web: tests/e2e/helpers/template-draft-lifecycle-cases.ts](../../../tests/e2e/helpers/template-draft-lifecycle-cases.ts)
- [web: tests/e2e/helpers/template-draft-navigation-case.ts](../../../tests/e2e/helpers/template-draft-navigation-case.ts)
- [web: tests/e2e/helpers/template-draft-promotion-cases.ts](../../../tests/e2e/helpers/template-draft-promotion-cases.ts)
- [web: tests/e2e/helpers/template-draft-recovery-cases.ts](../../../tests/e2e/helpers/template-draft-recovery-cases.ts)
- [web: tests/e2e/information-hierarchy.spec.ts](../../../tests/e2e/information-hierarchy.spec.ts)
- [web: tests/e2e/legacy-tourism-disabled.spec.ts](../../../tests/e2e/legacy-tourism-disabled.spec.ts)
- [web: tests/e2e/loading-feedback.spec.ts](../../../tests/e2e/loading-feedback.spec.ts)
- [web: tests/e2e/motion.spec.ts](../../../tests/e2e/motion.spec.ts)
- [web: tests/e2e/permissions.spec.ts](../../../tests/e2e/permissions.spec.ts)
- [web: tests/e2e/public-redirects.spec.ts](../../../tests/e2e/public-redirects.spec.ts)
- [web: tests/e2e/referral-tree-company-branch.spec.ts](../../../tests/e2e/referral-tree-company-branch.spec.ts)
- [web: tests/e2e/registration-wizard.spec.ts](../../../tests/e2e/registration-wizard.spec.ts)
- [web: tests/e2e/removed-admin-panels.spec.ts](../../../tests/e2e/removed-admin-panels.spec.ts)
- [web: tests/e2e/select-control.spec.ts](../../../tests/e2e/select-control.spec.ts)
- [web: tests/e2e/stale-navigation-recovery.spec.ts](../../../tests/e2e/stale-navigation-recovery.spec.ts)
- [web: tests/e2e/template-drafts.spec.ts](../../../tests/e2e/template-drafts.spec.ts)
- [web: tests/learning/company-expense-recovery.spec.ts](../../../tests/learning/company-expense-recovery.spec.ts)
- [web: tests/learning/customer-document-upload-fixture.ts](../../../tests/learning/customer-document-upload-fixture.ts)
- [web: tests/learning/customer-document-upload-lock.ts](../../../tests/learning/customer-document-upload-lock.ts)
- [web: tests/learning/dashboard-dialog-layers.spec.ts](../../../tests/learning/dashboard-dialog-layers.spec.ts)
- [web: tests/learning/date-picker-readonly.spec.ts](../../../tests/learning/date-picker-readonly.spec.ts)
- [web: tests/learning/fixtures.ts](../../../tests/learning/fixtures.ts)
- [web: tests/learning/media-browser-diagnostics.ts](../../../tests/learning/media-browser-diagnostics.ts)
- [web: tests/learning/media-object-collision.ts](../../../tests/learning/media-object-collision.ts)
- [web: tests/learning/profile-invite-read.spec.ts](../../../tests/learning/profile-invite-read.spec.ts)
- [web: tests/learning/profile-maintenance.spec.ts](../../../tests/learning/profile-maintenance.spec.ts)
- [web: tests/learning/profile-media.spec.ts](../../../tests/learning/profile-media.spec.ts)
- [web: tests/test-support/assistant-settlement-case.ts](../../../tests/test-support/assistant-settlement-case.ts)
- [web: tests/test-support/boc-manual-rate-case.ts](../../../tests/test-support/boc-manual-rate-case.ts)
- [web: tests/test-support/boc-quote-job-case.ts](../../../tests/test-support/boc-quote-job-case.ts)
- [web: tests/test-support/boc-recalculation-cohort.ts](../../../tests/test-support/boc-recalculation-cohort.ts)
- [web: tests/test-support/commission-merge-order.ts](../../../tests/test-support/commission-merge-order.ts)
- [web: tests/test-support/commission-merge-read-fault.ts](../../../tests/test-support/commission-merge-read-fault.ts)
- [web: tests/test-support/customer-alias-records.ts](../../../tests/test-support/customer-alias-records.ts)
- [web: tests/test-support/disposable-fixture.ts](../../../tests/test-support/disposable-fixture.ts)
- [web: tests/test-support/document-fixture-cleanup.ts](../../../tests/test-support/document-fixture-cleanup.ts)
- [web: tests/test-support/document-fixture-store.ts](../../../tests/test-support/document-fixture-store.ts)
- [web: tests/test-support/fixture-cleanup-sequence.ts](../../../tests/test-support/fixture-cleanup-sequence.ts)
- [web: tests/test-support/inventory-order-fixture-sql.ts](../../../tests/test-support/inventory-order-fixture-sql.ts)
- [web: tests/test-support/inventory-order-fixture.ts](../../../tests/test-support/inventory-order-fixture.ts)
- [web: tests/test-support/loopback-http-boundary.ts](../../../tests/test-support/loopback-http-boundary.ts)
- [web: tests/test-support/monthly-settlement-lifecycle.ts](../../../tests/test-support/monthly-settlement-lifecycle.ts)
- [web: tests/test-support/owned-governance-todo.mjs](../../../tests/test-support/owned-governance-todo.mjs)
- [web: tests/test-support/postgres-document-lock.ts](../../../tests/test-support/postgres-document-lock.ts)
- [web: tests/test-support/reimbursement-sharing-case.ts](../../../tests/test-support/reimbursement-sharing-case.ts)
- [web: tests/test-support/settlement-fixture-cleanup-sql.ts](../../../tests/test-support/settlement-fixture-cleanup-sql.ts)
- [web: tests/test-support/settlement-fixture-cleanup.ts](../../../tests/test-support/settlement-fixture-cleanup.ts)
- [web: tests/test-support/settlement-repair-case.ts](../../../tests/test-support/settlement-repair-case.ts)
- [web: tests/test-support/settlement-repair-sql.ts](../../../tests/test-support/settlement-repair-sql.ts)
- [web: tests/test-support/shanghai-calendar.ts](../../../tests/test-support/shanghai-calendar.ts)
- [web: tests/test-support/template-document-fixture-cleanup.ts](../../../tests/test-support/template-document-fixture-cleanup.ts)
- [web: tests/test-support/template-draft-cleanup.ts](../../../tests/test-support/template-draft-cleanup.ts)
- [web: tests/test-support/template-draft-insert-fault.ts](../../../tests/test-support/template-draft-insert-fault.ts)
- [supabase: scripts/nowapi-quotes.test.mjs](../../../../PT5-dropshipping-supabase/scripts/nowapi-quotes.test.mjs)
- [supabase: supabase/tests/admin_person_account_bundle.sql](../../../../PT5-dropshipping-supabase/supabase/tests/admin_person_account_bundle.sql)
- [supabase: supabase/tests/api_request_quotas.sql](../../../../PT5-dropshipping-supabase/supabase/tests/api_request_quotas.sql)
- [supabase: supabase/tests/customer-inventory/client-applications-and-review.sql](../../../../PT5-dropshipping-supabase/supabase/tests/customer-inventory/client-applications-and-review.sql)
- [supabase: supabase/tests/customer-inventory/creation-and-managed-credit.sql](../../../../PT5-dropshipping-supabase/supabase/tests/customer-inventory/creation-and-managed-credit.sql)
- [supabase: supabase/tests/customer-inventory/currency-repayment-and-reuse.sql](../../../../PT5-dropshipping-supabase/supabase/tests/customer-inventory/currency-repayment-and-reuse.sql)
- [supabase: supabase/tests/customer-inventory/storage-and-staff-credit.sql](../../../../PT5-dropshipping-supabase/supabase/tests/customer-inventory/storage-and-staff-credit.sql)
- [supabase: supabase/tests/dashboard_numbered_page_permissions.sql](../../../../PT5-dropshipping-supabase/supabase/tests/dashboard_numbered_page_permissions.sql)
- [supabase: supabase/tests/database_governance.sql](../../../../PT5-dropshipping-supabase/supabase/tests/database_governance.sql)
- [supabase: supabase/tests/document_personal_copy.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_personal_copy.sql)
- [supabase: supabase/tests/document_unified_folder.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_unified_folder.sql)
- [supabase: supabase/tests/document_windows.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_windows.sql)
- [supabase: supabase/tests/learning_page_limit.sql](../../../../PT5-dropshipping-supabase/supabase/tests/learning_page_limit.sql)
- [supabase: supabase/tests/legacy_tourism_business_disabled.sql](../../../../PT5-dropshipping-supabase/supabase/tests/legacy_tourism_business_disabled.sql)
- [supabase: supabase/tests/mail-workspace/rules.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail-workspace/rules.sql)
- [supabase: supabase/tests/mail-workspace/threads.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail-workspace/threads.sql)
- [supabase: supabase/tests/monthly_settlement_allocated_usd.sql](../../../../PT5-dropshipping-supabase/supabase/tests/monthly_settlement_allocated_usd.sql)
- [supabase: supabase/tests/order_date_pages.sql](../../../../PT5-dropshipping-supabase/supabase/tests/order_date_pages.sql)
- [supabase: supabase/tests/settlement-release/allocation.sql](../../../../PT5-dropshipping-supabase/supabase/tests/settlement-release/allocation.sql)
- [supabase: supabase/tests/settlement-release/guards.sql](../../../../PT5-dropshipping-supabase/supabase/tests/settlement-release/guards.sql)
- [supabase: supabase/tests/settlement-release/publication.sql](../../../../PT5-dropshipping-supabase/supabase/tests/settlement-release/publication.sql)
- [supabase: supabase/tests/signup_business_wizard.sql](../../../../PT5-dropshipping-supabase/supabase/tests/signup_business_wizard.sql)
- [supabase: supabase/tests/template_document_drafts.sql](../../../../PT5-dropshipping-supabase/supabase/tests/template_document_drafts.sql)
- [supabase: supabase/tests/template_document_folder_boundaries.sql](../../../../PT5-dropshipping-supabase/supabase/tests/template_document_folder_boundaries.sql)
- [supabase: supabase/tests/verified_attachment_cleanup.sql](../../../../PT5-dropshipping-supabase/supabase/tests/verified_attachment_cleanup.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/dashboard/admin-section-placeholder.tsx](../../../components/dashboard/admin-section-placeholder.tsx) | 已审保留：旅游栏目占位展示 |
| [components/dashboard/dashboard-shared-copy.ts](../../../components/dashboard/dashboard-shared-copy.ts) | 已审保留：资料状态与错误文案适配 |
| [components/dashboard/dashboard-shared-display.ts](../../../components/dashboard/dashboard-shared-display.ts) | 已审拆分：媒体审核状态显示；账号状态显示 |
| [components/dashboard/dashboard-shared-errors.ts](../../../components/dashboard/dashboard-shared-errors.ts) | 已审保留：原始错误映射为页面提示 |
| [components/dashboard/dashboard-shared-formatters.ts](../../../components/dashboard/dashboard-shared-formatters.ts) | 已审保留：日期和文件大小展示 |
| [components/dashboard/dashboard-shared-ui.tsx](../../../components/dashboard/dashboard-shared-ui.tsx) | 已审拆分：共享导出入口 |
| [lib/api-request-quota.ts](../../../lib/api-request-quota.ts) | 已审保留：AI 配额租约适配 |
| [lib/async-collection.ts](../../../lib/async-collection.ts) | 已审保留：限制并发并按输入顺序组装 |
| [lib/browser-sync-recovery.ts](../../../lib/browser-sync-recovery.ts) | 已审保留：记录最近同步；清会话快取 |
| [lib/dashboard-complete-query.ts](../../../lib/dashboard-complete-query.ts) | 已审保留：分批取完可见集合 |
| [lib/dashboard-pagination.ts](../../../lib/dashboard-pagination.ts) | 已审保留：分页状态与切片；数据库范围换算 |
| [lib/page-visibility.ts](../../../lib/page-visibility.ts) | 已审保留：等待页面可见；前台累计计时 |
| [lib/public-site-origin-policy.ts](../../../lib/public-site-origin-policy.ts) | 已审保留：公开源配置校验；开发来源匹配 |
| [lib/public-site-origin.ts](../../../lib/public-site-origin.ts) | 已审保留：公开来源环境适配 |
| [lib/request-timeout.ts](../../../lib/request-timeout.ts) | 已审保留：限制前台等待并报告超时 |
| [lib/server-performance.ts](../../../lib/server-performance.ts) | 已审保留：服务端阶段计时；数据库路径分类 |
| [lib/server-request-body.ts](../../../lib/server-request-body.ts) | 已审拆分：按 UTF-8 字节限制并解析 JSON |
| [lib/use-browser-cloud-sync-recovery.ts](../../../lib/use-browser-cloud-sync-recovery.ts) | 已审保留：派发工作台同步代次 |
| [lib/use-dashboard-pagination.ts](../../../lib/use-dashboard-pagination.ts) | 已审保留：管理客户端集合页码 |
| [lib/use-dashboard-query-page.ts](../../../lib/use-dashboard-query-page.ts) | 已审保留：管理服务端按页读取及迟到结果 |
| [lib/use-resume-recovery.ts](../../../lib/use-resume-recovery.ts) | 已审保留：观察页面恢复并节流 |
| [lib/use-stale-focus-recovery.ts](../../../lib/use-stale-focus-recovery.ts) | 已审保留：给导航一次性重读信号 |
| [lib/utils.ts](../../../lib/utils.ts) | 已审保留：组合与合并样式类 |
| [lib/value-normalizers.ts](../../../lib/value-normalizers.ts) | 已审保留：文本清理；数值归一；基础文件名处理 |
