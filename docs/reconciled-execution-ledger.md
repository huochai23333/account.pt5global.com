# Reconciled execution ledger

This corrects the previously late handoff of the 04:16 UI batch and 04:17 pure batch. Counts below refer only to the original 86 files under `tests/e2e`; the controlled contract suites have a separate count. Repeated runs, negative controls and earlier false-green results do not add independent cases.

| Batch | Files | Distinct cases | Latest pass / fail | Evidence boundary |
| --- | --- | --- | --- | --- |
| First UI batch | 6 | 43 | 43 / 0 after four fixture corrections | Full initial log overwritten; four retest cases retained, remaining 39 earlier passes cannot be individually reverified from raw logs |
| Template isolation | 1 | 1 | 1 / 0 | Real local Auth/application; green, remove-layout-fix red, restore green; one distinct case |
| Role/navigation/search | 4 | 10 | 9 / 1 | Initial admin false green replaced by stricter failure; repeated four other-role checks not counted twice |
| Public/API | 2 | 12 | 12 / 0 | Saved 04:00 application-browser log |
| Additional pure batch | 3 | 14 | 14 / 0 | Saved 04:17 pure log; no Auth/browser/backend |
| Additional UI batch | 13 | 58 | 56 / 2 | Saved 04:16 application-browser log, real local Auth; individual cases include documented mocks |
| **Original total** | **29 / 86 executed** | **138** | **135 / 3** | **99 cases have retained raw evidence (96 / 3); 39 passes rely on earlier reported output** |

The 57 unexecuted original files remain blocked. The separate 73-file cohort means the 73 files left after the first 13: 16 were subsequently executed, leaving 57. The admission count 70 refers to original restricted dependencies within that 73-file cohort, not new executions or 70 newly discovered failures. Earlier approved synthetic-identity execution and current permission to run original restricted imports are separate.

## Additional 16 files

| File | Independent cases | Pass | Fail |
| --- | --- | --- | --- |
| `dashboard-framework.spec.ts` | 6 | 6 | 0 |
| `dashboard-home-customization.spec.ts` | 6 | 6 | 0 |
| `dashboard-home-resize.spec.ts` | 1 | 0 | 1 |
| `dashboard-home-widget-minimums.spec.ts` | 1 | 1 | 0 |
| `dashboard-my-password-reset.spec.ts` | 2 | 2 | 0 |
| `dashboard-responsive-ui.spec.ts` | 8 | 8 | 0 |
| `exchange-rate-visibility.spec.ts` | 9 | 9 | 0 |
| `information-hierarchy.spec.ts` | 7 | 6 | 1 |
| `loading-feedback.spec.ts` | 2 | 2 | 0 |
| `motion.spec.ts` | 5 | 5 | 0 |
| `order-date-range.spec.ts` | 9 | 9 | 0 |
| `order-list-framework.spec.ts` | 4 | 4 | 0 |
| `registration-wizard.spec.ts` | 5 | 5 | 0 |
| `review-center-entrypoint.spec.ts` | 2 | 2 | 0 |
| `wholesale-order-date-client.spec.ts` | 3 | 3 | 0 |
| `wholesale-order-link-options.spec.ts` | 2 | 2 | 0 |

Both additional-batch logs retain every test title and result. Full per-case records, hashes and pending-edit provenance are in the private `qa-reconciled-ledger.json` handoff.

## Earlier 13 files

| File | Independent cases | Latest pass | Latest fail | Retained evidence |
| --- | --- | --- | --- | --- |
| `auth.spec.ts` | 12 | 12 | 0 | 2 retained retest cases; 10 historical passes without full retained log |
| `legacy-tourism-disabled.spec.ts` | 14 | 14 | 0 | 2 retained retest cases; 12 historical passes without full retained log |
| `permissions.spec.ts` | 12 | 12 | 0 | 0 retained retest cases; 12 historical passes without full retained log |
| `select-control.spec.ts` | 2 | 2 | 0 | 0 retained retest cases; 2 historical passes without full retained log |
| `date-picker.spec.ts` | 2 | 2 | 0 | 0 retained retest cases; 2 historical passes without full retained log |
| `company-template-navigation.spec.ts` | 1 | 1 | 0 | 0 retained retest cases; 1 historical passes without full retained log |
| `company-template-isolation.spec.ts` | 1 | 1 | 0 | Raw log retained; reruns deduplicated |
| `dashboard-home-role-tasks.spec.ts` | 5 | 4 | 1 | Raw log retained; reruns deduplicated |
| `stale-navigation-recovery.spec.ts` | 3 | 3 | 0 | Raw log retained; reruns deduplicated |
| `dashboard-search-input.spec.ts` | 1 | 1 | 0 | Raw log retained; reruns deduplicated |
| `workspace-navigation-visible.spec.ts` | 1 | 1 | 0 | Raw log retained; reruns deduplicated |
| `public-redirects.spec.ts` | 8 | 8 | 0 | Raw log retained; reruns deduplicated |
| `api-request-limits.spec.ts` | 4 | 4 | 0 | Raw log retained; reruns deduplicated |

The first six counts are reconciled to the prior execution report and test definitions; they do not reconstruct the overwritten 39 per-case execution logs.

## Remaining failed cases

- Administrator home entry to accounts: missing server Auth configuration (`SUPABASE_SERVICE_ROLE_KEY`), not a pass.
- Information hierarchy at accounts: same environment blocker, a separate failed case.
- Home resize: this task added the wrong five-toolbar expectation. The product intentionally renders one compact editor plus four full editors, and the existing test already expected one compact editor. The assertion is corrected and checks missing/duplicate/hidden compact controls plus missing/overlapping full editor elements. The original authenticated resize/drag/screenshot test remains unrerun; do not count it as passed.

## Pending edits and verification

All five prior pending test edits match their preserved executed copies after reversing the documented test-entry/network guard changes. They belong to this task. They cover fixed independent Shanghai date expectations and RPC names, dynamic password-reset return origin, persisted widget identities after failed-save retry, and the corrected compact/full editor geometry assertion. No other author changes were discarded.

The three pure files already passed 14 cases; they were not rerun just to repair this accounting. The new nine focused checks render the actual first-party card with fixed synthetic child bodies, then inspect its browser markup and controlled missing/overlapping elements. They do not test authenticated page loading, hydration, real drag/resize, saved layout, screenshot baselines or backend correctness. The earlier 61 controlled checks plus these nine are 70 separate controlled checks, not 70 real-system E2E passes.

Commit `07c612953fc4d7ca7cadfc8d0a078e9d2fd347a4` contains only its ten documented tests/config/docs files and is on remote main. This follow-up separately uploads the verified pending tests and this corrected ledger.

## 2026-10-05 受控验证续作

在 Web `e85419db3bb3a4e1df2217bfb703967613d5f679` 和 Supabase `8103888c9f84162f50f06173e5c11c65a142e0b3` 基础上，本轮只修改测试、测试工具和验证说明。

最终运行：88/88 受控合同检查（59 页面、20 分页、9 组件几何），13/13 日志工具单元检查，相邻 Supabase 仓库 17/17 Storage 回调单元检查；均为 0 skipped。分页新增微秒用例在修复前实际失败一次；首次合同重跑为 86 通过/2 失败，修复 HTML 夹具编码后最终 88 通过。定向类型检查首次发现测试对象重复字段，修正后通过。

本轮没有执行原始认证 E2E，原 29/86 文件、138 不同用例的 135 通过/3 失败、57 文件未执行、39 历史通过缺完整日志均保持原统计。早前 70 项与本轮 88 项受控验证有重叠，不能累加或并入真实 E2E。证据目录、原始日志摘要及未执行原因见 [本轮验证记录](test-reliability-2026-10-05.md)。

## 真实流程准备续作（基线 db8626f / fc210bb）

本轮真实系统 E2E 未启动；受控页面/组件、纯单元测试均未重跑，没有新增通过数。只执行源码前提审计、监听端口预检、定向静态检查和日志完整性核验。57 个未执行文件全部静态到达 accounts.ts，34 个还到达 local-supabase-admin.ts，审计在文件读取前停止。每项角色、数据、规则及人工步骤见 [逐项阻塞与最小准备](real-e2e-blockers.md)，各项源码摘要与导入行号在本轮审计日志中。

原 138 用例统计本来就包括三份纯测试文件的 14 个纯单元通过；另外 26 个页面/API 文件共 124 用例记录为 121 通过/3 失败，包含既有受控故障/外部边界，不能统一称为 138 个完整真实系统 E2E。原 39 个历史通过缺完整日志的限制保留，不重建或追认其证据。本轮没有在当前仓库找到原三失败的完整运行日志可引用路径；既有失败状态依据已上传台账保留，新静态日志仅证明当前阻塞，不冒充原失败执行日志。

原首页 resize 用例补上尺寸变更和真实鼠标移动后的保存刷新检查，维持同一用例身份和原认证入口；该测试未执行、独立数据库布局读回未完成，不改记通过。物流性能方案独立保存在 Supabase 仓库 `docs/logistics-performance-proposal.md`，仅有依据和候选预算，未批准、未测量。详细实际命令和分层结果见 [真实流程续作验证记录](real-e2e-readiness-execution.md)。
