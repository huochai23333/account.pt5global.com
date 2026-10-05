# Test reliability follow-up

Tests-only follow-up: workspace entrypoints now require a fixed business heading and a visible business control inside `main`, the requested path, and absence of custom/framework/permission error pages. The existing 27-route matrix calls this shared assertion.

Logistics paging now validates exact IDs against an independently prepared synthetic fixture manifest, 20/20/15 page sizes, unique IDs across pages, stable timestamp/UUID ordering, displayed package order, and the unchanged second page after navigating back. It still does not establish a latency budget.

Run `npm run test:contracts` for the independent assertion checks. The recorded local run passed 61 cases: 52 synthetic browser-document checks and nine pure paging-oracle checks. No application server, account helper, Supabase endpoint or business write is involved. These checks validate rejection of controlled wrong outcomes, not the real backend E2E path. Changed test sources passed ESLint and `tsc --noEmit --incremental false`.

The real logistics paging E2E additionally requires `PT5_E2E_LOGISTICS_PAGING_FIXTURE` pointing to JSON `{ "synthetic": true, "storeName": "Local Paging Shop", "rows": [{ "id": "<lowercase UUID>", "packageNumber": "<unique package>", "sortAt": "<fixed effective order timestamp>" }] }` with exactly 55 rows. The manifest must come from independent owned-fixture preparation, not the paging RPC. `sortAt` follows the documented effective order timestamp (order-created timestamp, or the first-sync fallback), with UUID descending for ties. A synthetic declaration does not establish physical database isolation. No manifest was manufactured from existing shared data in this follow-up.

The original two edited E2E suites were not executed: their Auth import reaches the restricted `accounts.ts` helper. No prohibited helper was imported at runtime or replaced to execute them. Missing admin Auth configuration and shared writable fixtures remain additional preconditions, not successful tests.

## Original remaining 73 files

Earlier executed results are preserved separately from permission to rerun the original suite. Earlier browser subsets used the previously authorized synthetic Auth entry. The current follow-up runs no new Auth adapter. “Blocked” means not executed, not passed; “allowed” describes dependencies, not a claim of execution. Detailed chains and evidence are kept in the private `qa-remaining-classification.final.json` execution handoff.

| File | Prior/result state | Current original-suite admission | Specific blocker or scope |
| --- | --- | --- | --- |
| `account-switcher.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `admin-auth-sync-recovery.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `admin-person-account-bundle.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `ai-assistant-settlement-release.spec.ts` | blocked | Blocked: accounts.ts | First case targets existing Wholesale Alpha financial records (12-143); requires owned ledger fixture and guaranteed local AI boundary. Do not run borrowed-ledger writes. |
| `auth-network.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `business-parameter-order-lock.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `business-parameter-settings.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `client-business-access.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `company-expenses.spec.ts` | blocked | Blocked: accounts.ts | Create/delete case (38-89) needs owned unique expense and failure-safe cleanup; other cases only read permissions/layout. |
| `company-templates.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `customer-inventory-orders.spec.ts` | blocked | Blocked: accounts.ts | Resolve fixed-200/lifetime eligibility/tier credit policy and prepare owned disposable fixtures; do not treat existing examples as approved rules. |
| `dashboard-framework.spec.ts` | executed_pass | Blocked: accounts.ts | Run approved local fixture entry; record any concrete environment failure. |
| `dashboard-home-customization.spec.ts` | executed_pass | Blocked: accounts.ts | Run approved local fixture entry; record any concrete environment failure. |
| `dashboard-home-resize.spec.ts` | executed_failure | Blocked: accounts.ts | Observed 4 toolbars versus newly asserted 5; assumption versus compact-editor contract not yet resolved. Do not classify as confirmed business defect. |
| `dashboard-home-widget-minimums.spec.ts` | executed_pass | Blocked: accounts.ts | Run approved local fixture entry; record any concrete environment failure. |
| `dashboard-my-password-reset.spec.ts` | executed_pass | Blocked: accounts.ts | Run approved local fixture entry; record any concrete environment failure. |
| `dashboard-numbered-pages.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `dashboard-responsive-ui.spec.ts` | executed_pass | Blocked: accounts.ts | Run approved local fixture entry; record any concrete environment failure. |
| `dashboard-table-divider.spec.ts` | blocked | Blocked: accounts.ts | Needs at least two visible customer rows; reads CSS and mobile cards, no business write. |
| `design-system-governance.spec.ts` | blocked | Blocked: accounts.ts | Most cases read geometry or submit invalid forms; todo case (278-318) can create/delete, so requires owned identity and failure-safe cleanup. |
| `design-system-visual.spec.ts` | blocked | Blocked: accounts.ts | Tracked approved Chrome Windows PNG baselines exist; must use chromium project name and matching fixture context. Do not regenerate baseline to conceal mismatches. Public-only subset may run after dependency admission. |
| `exchange-rate-boc.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `exchange-rate-history.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `exchange-rate-visibility.spec.ts` | executed_pass | Blocked: accounts.ts | Run approved local fixture entry; record any concrete environment failure. |
| `finance-business-access.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `forgot-password.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `home-role-task-counts.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `information-hierarchy.spec.ts` | executed_failure | Blocked: accounts.ts | Admin accounts business heading unavailable; saved server log shows missing SUPABASE_SERVICE_ROLE_KEY. Environment failure, not passed. |
| `loading-feedback.spec.ts` | executed_pass | Blocked: accounts.ts | Run approved local fixture entry; record any concrete environment failure. |
| `mail-feishu-oauth.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `mail-layout.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `mail-numbered-pages.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `mail-oauth.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `mail-recipient-maintenance.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `mail-secondary-data.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `mail.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `motion.spec.ts` | executed_pass | Blocked: accounts.ts | Run approved local fixture entry; record any concrete environment failure. |
| `operator-reimbursements-sharing.spec.ts` | blocked | Blocked: accounts.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `operator-reimbursements.spec.ts` | blocked | Blocked: accounts.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `order-date-range.spec.ts` | executed_pass | Allowed (no restricted helper) | Run approved local fixture entry; record any concrete environment failure. |
| `order-list-framework.spec.ts` | executed_pass | Blocked: accounts.ts | Run approved local fixture entry; record any concrete environment failure. |
| `profile-operation-receipts.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `referral-tree-company-branch.spec.ts` | blocked | Blocked: accounts.ts | Read-only company branch and mobile tree; requires synthetic branch visibility and role context, not commission policy validation. |
| `registration-wizard.spec.ts` | executed_pass | Blocked: accounts.ts | Run approved local fixture entry; record any concrete environment failure. |
| `review-center-entrypoint.spec.ts` | executed_pass | Blocked: accounts.ts | Run approved local fixture entry; record any concrete environment failure. |
| `sales-lead-admin-claim.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `sales-lead-conversion.spec.ts` | blocked | Blocked: accounts.ts | BeforeEach native SQL uses shared fixed administrator/salesman IDs (24-31) and historical E2E-CONVERSION prefix cleanup (10-20). Requires physically isolated API/Auth fixture before resets. |
| `sales-lead-daily-limit.spec.ts` | blocked | Blocked: accounts.ts | An actual disposable API/Auth database boundary is required before reset hooks; a mode declaration or SQL-only isolated database is insufficient. |
| `sales-lead-details.spec.ts` | blocked | Blocked: accounts.ts | Read-only local public fields and controlled long-contact response; backend response comparison verifies display fidelity, not independent database truth. |
| `sales-lead-views.spec.ts` | blocked | Blocked: accounts.ts | Read-only preference/pagination/search, controlled long-profile data and blocked-storage path; needs local hall rows and two roles. |
| `sales-leads.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `settlement-rate-repair-receipts.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `system-health.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `user-media-operation-receipts.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `wholesale-customer-management.spec.ts` | blocked | Blocked: accounts.ts | Own create/edit/delete cases can use unique customer fixtures; final delete rejection targets shared Wholesale Alpha (53-69), so requires an owned customer with owned orders first. |
| `wholesale-customer-other-names.spec.ts` | blocked | Blocked: accounts.ts | First test adds alias to shared Wholesale Alpha (10-28) without restoration; requires owned customer. Mobile test opens unsaved form only. |
| `wholesale-logistics-sync.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `wholesale-logistics.spec.ts` | blocked | Blocked: accounts.ts | Paging now additionally requires independent 55-row synthetic manifest PT5_E2E_LOGISTICS_PAGING_FIXTURE. Assignment case changes shared Local Shop Alpha (82-119), so requires owned assignment history. Read refresh is mocked 503. |
| `wholesale-mutation-failures.spec.ts` | blocked | Blocked: accounts.ts | Requests are mocked failure paths; before running ensure all mutable boundaries are intercepted and owned fixtures used, so an endpoint mismatch cannot mutate shared data. |
| `wholesale-navigation-order.spec.ts` | blocked | Blocked: accounts.ts | Read-only desktop/mobile and locale navigation; removed import endpoint test requires route absence confirmed before POST. |
| `wholesale-order-attachment-receipts.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `wholesale-order-compact-view.spec.ts` | blocked | Blocked: accounts.ts | Read-only compact/full fields; requires the expected synthetic current-month order to exist. |
| `wholesale-order-creation-idempotency.spec.ts` | blocked | Blocked: accounts.ts | Creates order for shared Wholesale Alpha (107); requires owned customer/order fixture and failure-safe cleanup, no borrowed assignment or ledger writes. |
| `wholesale-order-date-client.spec.ts` | executed_pass | Allowed (no restricted helper) | Run approved local fixture entry; record any concrete environment failure. |
| `wholesale-order-link-options.spec.ts` | executed_pass | Allowed (no restricted helper) | Run approved local fixture entry; record any concrete environment failure. |
| `wholesale-order-month-filter.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `wholesale-order-pagination.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `wholesale-order-settlements.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `wholesale-orders-i18n.spec.ts` | blocked | Blocked: accounts.ts | Read-only English mobile order view; requires synthetic visible orders. |
| `wholesale-salesman-collaboration.spec.ts` | blocked | Blocked: accounts.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `wholesale-settlement-monthly-summary.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `wholesale-settlement-releases.spec.ts` | blocked | Blocked: accounts.ts, local-supabase-admin.ts | Original suite imports the listed prohibited helper(s); permission/dependency resolution required. Do not replace these helpers to execute it. |
| `workspace-entrypoints.spec.ts` | blocked | Blocked: accounts.ts | 27 routes now require fixed heading plus real business control and reject error pages. /admin/accounts previously failed with missing SUPABASE_SERVICE_ROLE_KEY; do not provision secrets or call that a business test pass. |

The subsequent [reconciled execution ledger](reconciled-execution-ledger.md) records all 29 executed original files, the late 16-file batch, the overwritten-log limitation, and the corrected compact-editor assertion. It keeps the original resize E2E failure pending a permitted real rerun; controlled component checks do not change that result.

## 2026-10-05 后续整改

已修复分页测试预期生成器的微秒截断，并将复合夹具负例拆成单条件负例。页面负例核对特定失败原因，增加隐藏正文、正文外控件、重复正文、框架遮罩及 1440/390px 受控刷新检查。运行记录增加原始日志摘要与独立核验入口。实际最终受控重跑为 88/88，日志工具为 13/13；相邻 Supabase 仓库 Storage 回调单元验证为 17/17。

早前 61/70 项记录是历史批次；本轮 88 项包含重跑，不能累加为新增真实 E2E。原始 86 个文件的 29 已执行、57 未执行及 135 通过/3 失败保持不变。未读取或执行受限辅助文件，未运行库存测试。详见 [本轮命令、证据、整改与阻塞](test-reliability-2026-10-05.md)。
