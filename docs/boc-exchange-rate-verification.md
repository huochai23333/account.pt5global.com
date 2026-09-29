# 中行买入价修复验证凭证

本地和 Supabase 云端已统一 NowAPI 中国银行现汇买入价。原汇率服务运行实现、配置引用、专属数据库函数、索引和云端旧凭据已清理；旧汇率数据及归档表已删除。云端已重新获取第一笔订单日期至今的汇率。历史订单金额重新核算与线上页面验收尚未执行。

## 规则与范围

质量门禁采用 **Critical write**：获取报价、人工维护、结汇分配和历史重算会修改金额或权威记录。银行牌价 ÷ 100 保存为原始买入价；成交价为买入价 × 0.99，保留 6 位；人民币金额乘成交价并保留 2 位。人民币自身固定为 1。原始查询和成交查询分开，佣金不再次扣减。

- `/admin/settings` → 页面获取/人工录入/修改/删除 → 独立数据库确认编号、价格、时间或删除行数，刷新后保持一致。
- `/admin/settings` → 按日期补充 → 只保存完整、指定北京时间日期的日末报价，部分失败保留成功编号与未完成明细。
- `/admin/wholesale/orders` → 登记部分及多次结汇 → 保存原始价、成交价、报价编号/时间，人民币金额和订单汇总独立核对。
- `/admin/wholesale/settlement-releases` → 保存缺报价的分配 → 等真实补价任务终态后再保存分配；部分失败不能继续分配。
- `/admin/settings` → 历史预览/执行 → 每笔订单、关联结汇、分配和佣金原子更新；令牌、版本、过期、回滚及重复执行检查。
- 内部只读账号 → 查看汇率 → 不获得维护、获取或历史重算权限。客户独立汇率页面继续受限。

## 实际验证结果

| 验证 | 结果 |
| --- | --- |
| Web lint | 0 错误；1 个既有无关警告：company-templates.spec.ts 的 FrameLocator 未使用 |
| TypeScript、双语、工作台结构 | 全部通过 |
| 操作凭证契约 | 39 项通过，扫描 879 个源码文件 |
| 生产构建 | next build --webpack 通过，49/49 静态页生成 |
| 前端成交价与金额单元测试 | 9 通过、0 失败、0 跳过 |
| NowAPI 报价解析单元测试 | 15 通过、0 失败、0 跳过 |
| Playwright 相关回归 | 18 通过、0 失败、0 跳过；Chromium，1 worker，2.3 分钟 |
| Docker SQL 回归 | 4 个脚本通过、0 错误、0 跳过；测试夹具全部回滚 |
| 本地 Edge Functions 真实服务脚本 | test-exchange-rate-sync-local.mjs 通过；真实 NowAPI、权限、部分失败及独立报价回读 |
| Supabase db lint --local --level error | 无错误 |
| 种子完整执行 | 完整本地 Docker reset 后恢复种子；100 笔批发、6 笔普通订单、124 条报价 |
| 浏览器凭据检查 | 124 个生产浏览器 JS 文件，NowAPI 凭据命中 0；Web 环境不含 NowAPI 凭据 |

本次没有运行整个仓库的全部浏览器套件。普通旅游订单页面处于项目既有停用状态，普通订单历史金额与已支付佣金通过 Docker SQL 验证。

SQL 脚本：`exchange_rate_historical_backfill.sql`、`exchange_rate_visibility.sql`、`verified_operation_runs.test.sql`、`boc_exchange_rate_recalculation.sql`。已再次完成本地完整 reset 的 189 个迁移及相关 SQL 回归。CLI 此次忽略指定数据库参数而重置了主本地测试库，现已恢复种子数据与四类已核对凭证；下面此前浏览器运行的记录编号属于 reset 前的验证记录，截图和测试报告仍保留。

Playwright 文件：`exchange-rate-boc.spec.ts`（3）、`exchange-rate-history.spec.ts`（2）、`exchange-rate-visibility.spec.ts`（9）、`settlement-rate-repair-receipts.spec.ts`（2）、`wholesale-order-settlements.spec.ts`（2）。页面关键操作均由真实按钮发起，金额、编号、分配修订和任务终态由独立管理员数据库连接确认，并刷新后核对。中行流程测试监听控制台 error/pageerror，未发现相关错误或框架错误浮层。测试的“减少动态效果”会产生 Motion 提示，属于预期设备设置提示。

1440px 桌面与 390px 手机均通过溢出检查；人工查看了以下截图，桌面历史表全部列及操作区可见，手机以完整卡片呈现。截图是本地测试数据，位于忽略目录：

- [汇率桌面](C:/code/system/PT5-dropshipping-web/output/verification/boc-exchange-desktop.png)
- [历史表桌面](C:/code/system/PT5-dropshipping-web/output/verification/boc-history-desktop.png)
- [汇率手机](C:/code/system/PT5-dropshipping-web/output/verification/boc-exchange-mobile.png)
- [历史卡片手机](C:/code/system/PT5-dropshipping-web/output/verification/boc-history-mobile.png)

## 外部报价核对

供应商使用 [NowAPI 当日接口](https://www.nowapi.com/api/finance.rate_cnyquot) 与 [历史接口](https://www.nowapi.com/api/finance.rate_cnyquot_history)，固定 BOC、se_buy。报价单位为每 100 外币。

| 北京时间发布时间 | 币种 | NowAPI 与中行牌价 | 核对方式 | 历史完整条数 |
| --- | --- | --- | --- | --- |
| 2026-09-29 13:46:01 | USD | 669.79 | 中行官网同时间页面核对 | 当日单条 |
| 2026-09-29 13:46:01 | EUR | 759.32 | 中行官网同时间页面核对 | 当日单条 |
| 2026-09-28 23:55:58 | USD | 669.93 | 用户在中行历史页手动查询并明确确认 | 240/240 |
| 2026-09-28 23:55:58 | EUR | 760.10 | 用户在中行历史页手动查询并明确确认 | 240/240 |

四类核对凭证已保存于本地及云端 `boc_quote_verifications`。中行历史页自动查询没有返回结果，因此历史官网核对证据来自用户确认；供应商列表完整性由解析器独立检查。后续报价会变化，这些值只证明上述相同发布时间的核对。其他补齐日期已检查供应商完整结果，未逐日人工核对中行官网。

## 本地业务凭证（完整 reset 前）

- 最近页面执行的重算编号：`744d196c-39fe-44be-bff6-fb289b225646`，北京时间 2026-09-29 15:05:06 执行。
- 当时实际范围：6 笔普通订单、129 笔批发订单、28 条结汇、129 条批发佣金。无结汇的批发订单没有人民币结算金额，因此不进入金额修复明细。
- 实际完成 22 笔、未完成 4 笔、更新 70 行，终态 `partial_failed`。凭证中保存逐笔编号、快照、差额及影响行数。
- 4 笔未完成普通订单为本地种子 `b1000000-0000-4000-8000-000000000001/002/005/006`，原佣金参数快照缺失；该笔事务未修改业务数据。不能猜测原参数后强行核算。
- 页面创建的核验订单 `42ef5d4e-7d46-4e78-a0ac-7a035526f04b`（订单号 `002020260929`）。结汇编号 `0e0c364a-ce02-40ea-8ad2-73481d8ec7eb`，引用报价 `5a211b9e-21f9-41cb-b613-0eceea726e10`：原始价 6.6962，成交价 6.629238，100 USD = 662.92 CNY，报价北京时间 2026-09-29 15:01:01。实际业务表与预览/执行快照一致。
- 当时原参考价 5 条存入过修复快照；此归档表现已在本地和云端删除。业务可用表中原服务来源为 0 条，当前 public/private 函数中原供应商引用为 0，原供应商专属索引为 0。
- 原每日任务保持 UTC `30 1 * * *`，即北京时间 09:30；新实现同时补齐昨日完整日末报价。云端任务已部署同一实现。

## 失败与中断边界

已验证买入列选择、÷100、×0.99 仅一次、CNY、十进制舍入、历史日末排序、缺日期/空价/不完整列表、冲突报价、重复获取、旧价不覆盖新价；部分结汇、多订单分配、原佣金跨档、已支付佣金保留状态/成本/人员/参数版本、预览数据变化、错误令牌、过期令牌、单笔失败回滚和重复执行。

HTTP 200 但没有执行落库的历史重算回包被页面拒绝；补价任务 `partial_failed` 时不再次分配。刷新和重复执行验证恢复到数据库保存凭证。没有触发付款、外部消息或文件上传，因此付款到达、消息投递、附件清理不适用。

## 模块与 README

Web 的历史重算页面、明细渲染、状态 hook、数据库读写/凭证核验、失败文案映射分别放入同层独立模块。页面 Client 仅组装；金额共用十进制工具。后端拆出报价解析、当日同步、历史范围与重算缺口模块；原服务实现已替换。所有变化核心文件均低于 500 行；关键数据流、只扣一次、缺价、权限与事务意图均附中文注释。

两个 README 已维护汇率规则、服务端凭据、人工录入、历史重算、原服务清理、回归命令和云端发布边界。

| 仓库 | 核心文件 | 原行数 | 现行数 |
| --- | --- | ---: | ---: |
| Web | components/dashboard/admin-orders/admin-orders-client-config.ts | 174 | 174 |
| Web | components/dashboard/admin-orders/admin-orders-currency.ts | 127 | 136 |
| Web | components/dashboard/admin-orders/admin-orders-form.ts | 370 | 370 |
| Web | components/dashboard/admin-orders/admin-orders-service-pricing.ts | 120 | 120 |
| Web | components/dashboard/admin-orders/use-admin-order-create-dialog.ts | 347 | 347 |
| Web | components/dashboard/exchange-rates/exchange-rate-history-fetch-dialog.tsx | 177 | 189 |
| Web | components/dashboard/exchange-rates/exchange-rate-sync-section.tsx | 309 | 315 |
| Web | components/dashboard/exchange-rates/exchange-rates-client.tsx | 214 | 216 |
| Web | components/dashboard/exchange-rates/exchange-rates-form-dialog.tsx | 114 | 131 |
| Web | components/dashboard/exchange-rates/exchange-rates-history-section.tsx | 362 | 368 |
| Web | components/dashboard/exchange-rates/exchange-rates-latest-card.tsx | 58 | 59 |
| Web | components/dashboard/exchange-rates/exchange-rates-utils.ts | 272 | 294 |
| Web | components/dashboard/exchange-rates/use-exchange-rate-sync-settings.ts | 267 | 267 |
| Web | components/dashboard/wholesale/wholesale-order-edit-dialog.tsx | 340 | 331 |
| Web | components/dashboard/wholesale/wholesale-order-form-dialog.tsx | 247 | 239 |
| Web | components/dashboard/wholesale/wholesale-order-rate-dialogs.tsx | 226 | 227 |
| Web | lib/exchange-rate-display.ts | 193 | 198 |
| Web | lib/exchange-rate-mutations.ts | 219 | 241 |
| Web | lib/exchange-rate-queries.ts | 147 | 148 |
| Web | lib/exchange-rate-types.ts | 111 | 123 |
| Web | components/dashboard/exchange-rates/exchange-rate-recalculation-items.tsx | 0 | 37 |
| Web | components/dashboard/exchange-rates/exchange-rate-recalculation-section.tsx | 0 | 30 |
| Web | components/dashboard/exchange-rates/use-exchange-rate-recalculation.ts | 0 | 35 |
| Web | lib/company-exchange-rate.ts | 0 | 25 |
| Web | lib/exchange-rate-recalculation-failures.ts | 0 | 8 |
| Web | lib/exchange-rate-recalculation.ts | 0 | 72 |
| Web | lib/exchange-rate-receipts.ts | 0 | 25 |
| Supabase | supabase/functions/exchange-rate-sync/historical-sync.ts | 94 | 31 |
| Supabase | supabase/functions/exchange-rate-sync/index.ts | 379 | 369 |
| Supabase | supabase/functions/exchange-rate-sync/providers.ts | 110 | 25 |
| Supabase | supabase/functions/exchange-rate-sync/required-rate-gaps.ts | 79 | 82 |
| Supabase | supabase/functions/exchange-rate-sync/shared.ts | 145 | 143 |
| Supabase | supabase/functions/exchange-rate-sync/storage.ts | 99 | 23 |
| Supabase | supabase/functions/exchange-rate-sync/types.ts | 49 | 59 |
| Supabase | supabase/functions/exchange-rate-sync/current-sync.ts | 0 | 35 |
| Supabase | supabase/functions/exchange-rate-sync/nowapi-quotes.ts | 0 | 52 |
| Supabase | supabase/functions/exchange-rate-sync/recalculation-rate-sync.ts | 0 | 28 |

## 云端发布与重新获取凭证（2026-09-29）

- 目标为 `ehzveltsktfusrhtgzqt`（PT5-dropshipping）。本地 189 个迁移完整执行及四项 SQL 通过后，云端先 dry-run 再应用 `20260929052545`、`20260929052547`、`20260929052549`，之后确认全部迁移 Local/Remote 一致。
- `exchange-rate-sync` 已部署为 ACTIVE 第 20 版。NowAPI 两项凭据已在服务端配置并核对摘要一致；原 `EXCHANGE_RATE_API_KEY` 已删除并独立检查不存在。没有改动其他函数或秘密配置。
- 240 条原参考汇率及其归档表已直接删除，业务可用表中原服务报价为 0 条；public/private 当前函数中的原供应商引用为 0，原供应商索引为 0。已发布历史迁移继续保留变更审计。
- 执行前重新确认：103 笔批发订单、0 笔普通订单、106 条结汇、103 条待结算佣金。第一笔订单北京时间日期为 **2026-06-22**。
- 从 **2026-06-22 至 2026-09-29** 共 100 个日期，美元和欧元 **200 条报价**完整覆盖。历史 99 天共 198 条均为指定日期完整日末报价，今天 2 条为获取时最新报价；另保存人民币固定值 1。缺失日期 0，异常记录 0。
- 20 批历史获取与 1 批当日获取全部到达 `succeeded`，201 条获取结果对应 201 条实际报价（人民币 1 条）。首批编号 `c81022af-ed3b-4023-9a67-3273a1559fdf`；末批历史编号 `d265455a-d570-4fb6-bbcc-f4b2706b588d`；当日编号 `fb2eb659-5673-487d-9a87-5e5d2298c647`。
- 独立数据库查询逐日检查覆盖、NowAPI/BOC/现汇买入来源、报价北京时间日期、历史日末标记、银行牌价 ÷ 100、原始查询及公司成交查询；全部通过。报价编号及完整任务结果另保存在忽略目录 `output/verification/boc-cloud-release.json`。
- 今天报价北京时间 **15:41:01**：美元牌价 669.53、买入汇率 6.6953、公司成交汇率 6.628347，编号 `db05d3b5-a711-4613-b1c7-2646494363f9`；欧元牌价 758.62、买入汇率 7.5862、公司成交汇率 7.510338，编号 `9e537bdf-2dea-49ff-ba75-84d97f502876`。
- 云端每日任务仍启用，北京时间 09:30。四类真实外部核对凭证已转入云端；历史重新核算运行数为 0，尚未修改旧订单、结汇、分配或佣金金额。
- 完整 reset 后再次执行历史页面与缺汇率分配的 4 项 Playwright，全部通过；重新执行 Web lint 和 TypeScript，通过（仍只有上述既有警告）。发现并修正了人工历史夹具被复用为真实历史报价的问题：历史缓存只接受 NowAPI 来源；SQL 用例自行创建结算夹具，不再依赖此前浏览器留下的记录。

本次发布完成 Supabase 数据库、服务端凭据、获取函数与云端汇率补齐。GitHub 提交分别见两个仓库远端记录；Hostinger 构建及线上页面尚未独立验收。云端历史金额重新核算需先生成逐笔预览并执行，本次用户要求的清理及重新获取没有执行金额修复或付款。

## 旧汇率直接删除的补充验证

用户明确要求删除旧汇率，新增迁移 `20260929080458_drop_old_exchange_rate_archive.sql`（3 行，独立负责移除旧归档表），不修改已发布迁移。删除前云端确认归档 240 条、业务外键依赖 0、当前函数引用 0。迁移已先在本地 Docker 应用，四项现有汇率及历史核算 SQL 回归全部通过；测试夹具回滚，本地报价仍为 124 条。

云端 dry-run 只包含这一项迁移，应用后归档表不存在，190 项迁移 Local/Remote 一致。201 条中行/人民币报价的数量及内容摘要与删除前完全一致，摘要为 `099afd598fbf3e923772d940e4f787a7`。两个 README 已更新为直接删除。此次 Web 仅修改说明文档，未改变页面、组件或交互，不新增页面及响应式测试；沿用前述已完成的桌面、390px 和业务流程验证。
