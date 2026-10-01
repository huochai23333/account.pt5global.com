# 物流同步修复验收与发布方案

## 二次审查修复与验证（2026-10-01，本轮独立执行）

已修复正常续跑消耗失败重试预算：执行编号继续递增，新增 `private.operation_runs.logistics_failure_count` 只统计真实失败；正常让出必须有新页检查点，保持 queued 且失败计数为 0。超时仍消耗失败预算。最终审阅另外覆盖“已派发但 Worker 从未认领”的启动失败：每个派发片段只扣一次真实失败预算，三次未启动进入 needs_attention，不会无限重发；对应 SQL 回归已经通过。新增迁移 `20261001072039_logistics_continuation_budget.sql` 需在前三份之后应用。

已修复末次永久错误的运行/告警不一致：物流失败使用独立的原子终态与告警处理，明确永久错误不会先生成“重试耗尽”告警；缺少 retryable 字段的旧内部调用仍沿用可重试约定。

完整回滚脚本为相邻 Supabase 仓库 `supabase/rollbacks/logistics-sync.sql`，历史函数定义固定保存在其同名子目录。必须先暂停派发与页面同步，等待 Worker 结束，再用 `psql -v ON_ERROR_STOP=1 -f supabase/rollbacks/logistics-sync.sql` 执行。脚本同一事务合并观测时间、停止新合同的未完成运行、恢复旧 upsert integer / claim(text) / renew / finish / 分页 / checked 包装 / 调度函数与授权。保留业务档案、观测桶、检查点、失败计数和迁移历史；回滚后新 Worker 接口关闭。后续重新升级应制定补偿迁移，不能删除历史或直接重放含 CREATE TABLE 的原四份迁移。仅本地演练，未执行线上回滚。

本轮已执行的验证：

- `verify-logistics-migrations.mjs`：四份迁移从旧结构应用，通过归档、续跑与新五片段 SQL 回归；实际调度到第 5 执行片段后成功，失败计数仍 0；无进度循环拒绝，真实故障/启动超时仍受预算限制。事务全部回滚。
- `verify-logistics-rollback.mjs`：完整交付回滚脚本演练通过；service_role 按旧 Worker 合同认领、整数写入、心跳、完成与账本收尾均成功；角色权限、每行同步时间、max lastUpdatedAt、来源时间与计数一致。`--red-check` 故意漏掉同步时间回写，独立分页断言按预期失败；正常版本再次通过。事务全部回滚。
- 纯逻辑：13 通过、0 失败、0 跳过，含正常预算让出与无新页提交时不免扣预算。
- Web 操作凭证：21 通过、0 失败、0 跳过。Web lint/typecheck/i18n/dashboard-ui/39 项操作合同与 webpack build 通过。
- Playwright：12 通过、0 失败、0 跳过，含真实页面 -> 本地 Edge -> 数据库 -> 同运行恢复 -> 独立记录/版本核对 -> 刷新分页；1440px/390px 截图、无 pageerror/错误覆盖层。截图仍在 ignored output/playwright-results。
- 原账本/分页权限 SQL：直接跑账本测试最初被本地旧排队任务占满调度名额而失败；新增 `verify-operation-regressions.mjs` 在回滚事务内隔离既有队列并强制本地夹具端点，两个原回归均通过，未弱化业务断言。
- 最新隔离基准：5,000 行重复同步，归档 UPDATE 5000 -> 0，观测 UPDATE 10；WAL 9,222,952 -> 311,448 字节；同步 510.90ms -> 350.74ms；全筛选分页 63.30ms -> 86.41ms。只反映本地夹具。
- 新函数严格 TypeScript 通过。本地全库 lint 仍只因原 public.save_boc_exchange_rate 的 v_id 未使用警告退出，新函数无警告；未扩大范围修改汇率函数。

本轮执行偏差：启动 Docker Desktop 自动恢复了已存在容器，数据库先于 cron 隔离启动。已查询到启动窗口 3 次 cron 执行、4 条 HTTP 响应，均为 401；不能声称本轮从未发生线上调用。随后明确关闭 `cron.launch_active_jobs`，核实为空的 HTTP 请求队列，再执行所有测试。新增 SQL/页面夹具前置断言要求 cron 关闭、队列为空；同步页面回归只允许本机主机名，Edge 环境文件只使用本地来源夹具。此处 4 条为本轮新记录，与上轮 10 次分开记载，未伪造或删除执行证据。

代码上传：Supabase 已提交并推送到 `fix/logistics-sync-resume-20261001`，提交 [a3d85dcefa8864f5db2702d3596e1c809bfa530a](https://github.com/huochai23333/PT5-dropshipping-supabase/commit/a3d85dcefa8864f5db2702d3596e1c809bfa530a)，远端分支 SHA 已独立核对；其 main 保持 bcf6ab689c28d58efe435e6e6d75f6f58909ccb3。该提交 check-runs=0、workflow runs=0、部署记录=0，仓库没有配置 CI，不能称为 CI 测试通过。未创建 PR 或 Supabase 云开发分支（只读列表为空），未部署、未生产迁移、未切换 Compute。

Web 完整改动已提交在同名本地修复分支，暂不推送。两个仓库 Actions、webhooks、GitHub environments/deployments 均无配置/记录，但这些不能证明 Hostinger 外部集成不监听修复分支；现有工具未提供 Hostinger 绑定分支读取，GitHub App 安装查询返回 403。需要确认 `account.pt5global.com` 在 Hostinger 绑定的仓库分支，或另行明确授权可能产生部署/预览的上传；不得直接推送 main。两仓库 README 已更新，所有暂存内容已按物流修复范围与凭据模式复核。

本地恢复：本轮启动的 Web、Edge 和 Docker Desktop 已停止，相关端口无监听，恢复初始 Docker 停止状态。归档仍为原 62 行，测试夹具行 0，HTTP 队列 0；暂停之后外联响应未增加，启动窗口仍仅 4 条 401；这 4 次失败调用的用量/账单未核对。`cron.launch_active_jobs=off` 持久暂停保留，未重新启用可能打生产的任务。截图和验证产物保留在 ignored output，未上传凭据或本地配置。

职责检查：主 index.ts 275→194 行，重试模块 0→79 行，同步协调 0→93 行；第四迁移 225 行，回滚入口 62 行，历史定义最大单文件 253 行。页面组件未扩大职责。验证路线为 critical write；真实页面链路、独立数据库凭证与刷新均已覆盖，线上来源/忙时 Nano 效果仍需独立上线授权后观察。


验证日期：2026-10-01。Web 基线 `86a189957e814b70ef856ed06204b327a033eeef`，Supabase 仓库基线 `bcf6ab689c28d58efe435e6e6d75f6f58909ccb3`。

本次只修改本地代码、迁移与测试，应用迁移到本地 Docker 并登记本地迁移历史；没有部署函数、修改线上数据库、切换 Compute、推送 GitHub或购买资源。现有本地数据没有 reset，新增夹具结束后恢复配置、状态并删除其自建记录。发生过下文列出的失败线上请求，因此不能声称本次完全没有线上调用。

测试隔离例外：启动原本未运行的本地 Docker 后，已有物流 cron 的配置地址指向线上；旧页面回归产生的 10 个失败测试运行后来被本地调度器向该地址重试。可追溯请求返回均为 `401 sync_not_allowed`，已部署旧函数在鉴权阶段返回，未进入同步/归档写入。已终止这 10 个本地测试运行的重试、保留失败证据，并给旧只读回归拦截自动同步、给新夹具暂停/恢复相关本地 cron。测试完成后停止本次启动的 Docker，恢复开始时的停止状态。失败函数调用可能计入平台用量，未核对账单，不能用“没有购买资源”替代“零用量”。这是本次执行偏离用户线上调用边界的事项。

## 当前证据与修复范围

动手前只读核对了项目 `ehzveltsktfusrhtgzqt` 的已部署 upsert、同步状态、运行账本及 Edge Function：仍使用无条件 UPDATE。最近增量已经成功，不能把历史故障描述成此刻所有同步都失败；全量失败记录在处理约 15,000 条后出现 `Rate limit exceeded ... Retry after 990ms/19125ms`，三次后需处理。旧来源 HTTP 非 2xx 只报 `source_archive_<status>`，因此原始平台错误更可能来自主库 RPC，而不是已经证明来自店小秘；修复覆盖来源查询和主库提交两个边界。

适用质量门禁：Critical write。链路为 `/admin/wholesale/logistics` 打开页面 → 请求增量同步 → 每页归档与检查点提交 → 来源终页和数据库完成凭证 → 独立账本读取 → 刷新与分页。原管理员、业务员、财务物流查询及其他角色权限回归也已运行。

## 写入与时间语义

- `(source_system, package_number)` 仍是归档唯一边界；合并后的业务字段使用 `IS DISTINCT FROM` 空值安全比较。首次导入、变化、显式清空、0/负运费、币种纠正和来源订单编号纠正仍写入；缺少来源物流/运费行仍保留旧值。
- 原始记录 `last_synced_at` 只在内容归档写入时推进。页面返回 `data_changed_at` 表示这个内容写入时间；页面原字段 `last_synced_at` 与 `order_source_last_seen_at` 返回最新成功核对该包裹的时间。历史数据的真正最后变化时间无法倒推，迁移前最后同步时间作为初始基线，不声称重建了过去的变化历史。
- `wholesale_logistics_observations` 按首次订单 ID/500 固定分桶，保存每个包裹的准确成功观测、两路来源出现时间及两路来源更新时间。来源编号纠正不会移动桶；缺少某来源行不会把该来源时间伪装为最新。桶内逐包裹时间独立，不能用一个桶的最大时间冒充所有记录。
- `lastUpdatedAt` 仍取完整筛选范围，不随页码改变；现有 20 条分页、筛选、汇总和归属计算保留。相关时间桶在查询中各展开一次，避免每行反复解压同一 JSON。
- upsert 返回值由 integer 改为 `{processedCount,writtenCount,unchangedCount,observationWriteCount}`。`processedCount` 包括真实核对但内容不变的记录，`writtenCount` 只计归档实际插入/更新。没有用输入条数伪造缺失回执。观测表与检查点仍有必要写入，不能宣称重复同步完全不写数据库。

## 限流、中断与幂等

- 来源查询客户端并发上限为 1，查询间隔 100ms；单请求超时 20 秒。一旦某查询失败，本次导出已排队的查询直接返回同一失败，不继续请求上游；重试重新创建客户端并遵守等待。主库逐页提交，共享租约阻止全量与增量并发扫描。该限制不控制其他系统对上游的总调用量。
- 临时网络、429、408/425、所列 5xx 错误最多请求 4 次；指数退避最多 15 秒，额外正抖动最多 249ms。`Retry-After` 秒数/日期及正文毫秒等待是下界，较长服务端等待不被 15 秒上限缩短。
- SDK 丢弃错误响应头时，传输包装保留其等待下界；来源导出把平台包装成 5xx 的限流转换为带等待头的 429，临时依赖失败为 503，永久查询失败为 422。
- 每次 Worker 预算 100 秒，预算不足时保留已提交页并交给现有调度器，调度重试时间不早于服务端等待并加最多 5 秒抖动。调度尝试仍受原上限约束；超过三次会需处理，长时间来源停机不会无限占用 Worker。
- 归档、观测凭证、计数和游标在一页事务内提交；超过 1,000 行时分块但整页原子。HTTP 提交响应丢失可重放上一页凭证；旧/过期租约不能推进检查点。全量快照和增量分别保存进度，失败不推进完成基线。已完成页不再从头扫描，游标保留 PostgreSQL 微秒精度。
- 页面任务的后台重试即使保留 `trigger=page` 也接受有效内部任务令牌；页面请求只能新建自己的增量任务，不能接管其他运行编号。用户身份保存到运行账本，业务员和财务可核对本人凭证。
- HTTP 部分结果明确返回 `partial_failed`；尝试账本保留部分失败，运行可以排队重试。只有来源终页、`completed=true`、实际累计计数和账本成功终态形成完整业务凭证。`already_running`、排队或 HTTP 200 不能被页面当成完成。

## 修改文件

Web 仓库：

- `lib/wholesale-logistics-page.ts`：补时间字段、独立读取运行账本核对完成。
- `tests/e2e/wholesale-logistics-sync.spec.ts`、`tests/e2e/helpers/logistics-source-fixture.ts`：真实本地链路与故障注入；`tests/e2e/wholesale-logistics.spec.ts` 隔离只读回归的自动同步。
- `README.md`、本报告：更新同步语义、测试前提及交付方案。

Supabase 仓库：

- `supabase/migrations/20261001060218_optimize_logistics_writes_and_resume.sql`：内容比较、观测分桶和准确计数。
- `supabase/migrations/20261001060435_logistics_page_freshness.sql`：分页与逐来源新鲜度。
- `supabase/migrations/20261001060439_logistics_page_checkpoints.sql`：租约、原子提交、检查点、等待和物流任务重试判定。
- `supabase/functions/wholesale-logistics-sync/{index,archive-import,source-api,request-auth,retry,sync-runner}.ts`：主任务与各边界。
- `logistics-supabase/supabase/functions/logistics-archive-export/{index,source-logistics,source-logistics-queries,dependency}.ts`：串行来源查询、等待透传、微秒游标。
- `supabase/tests/{logistics_retry.test.mjs,logistics_write_resume.sql}`：重试与数据库验收。
- `scripts/{verify-logistics-migrations,check-logistics-functions,benchmark-logistics-writes}.mjs`：可重复迁移验证、类型检查、基准。
- `.gitignore`、`README.md`、`logistics-supabase/README.md`：忽略本地产物并更新操作说明。

核心文件行数与职责：

| 文件 | 修改前 → 修改后 | 职责 |
| --- | ---: | --- |
| Web `wholesale-logistics-page.ts` | 243 → 264 | 查询数据与同步回执核对，未改 Page/Client 组件 |
| 主 `index.ts` | 275 → 194 | 鉴权、运行入口与响应；循环与重试已拆出 |
| `source-api.ts` | 189 → 188 | 来源协议与读取校验 |
| `archive-import.ts` | 71 → 87 | 页提交和数据库凭证校验 |
| `request-auth.ts` | 69 → 70 | 调度/用户鉴权 |
| 新 `retry.ts` / `sync-runner.ts` | 0 → 74 / 89 | 退避传输 / 检查点同步协调 |
| 来源 `index.ts` | 100 → 105 | 来源接口与错误分类响应 |
| 来源 `source-logistics.ts` | 297 → 298 | 原分页、快照和必要字段合并 |
| 来源 `source-logistics-queries.ts` | 177 → 180 | 查询边界 |
| 新来源 `dependency.ts` | 0 → 47 | 串行传输和依赖错误 |

无新增超过 500 行的文件。新增逻辑放在同层模块，关键事务、时间、权限与失败路径有中文注释。

## 测试结果

| 检查 | 结果 |
| --- | --- |
| 三份迁移从旧结构重新应用 + 现有/新增 SQL | 通过；本地单事务，最后回滚 |
| `wholesale_logistics_archive.sql` | 通过，历史归档/来源缺失/权限/分页 |
| `logistics_write_resume.sql` | 通过，首导、重复、NULL/0/负值、来源冲突、时间、整页回滚、重放、过期租约、续跑、冷却、永久失败与耗尽 |
| `verified_operation_runs.test.sql` | 通过，共享账本边界 |
| `dashboard_numbered_page_permissions.sql` | 通过，分页权限 |
| `node --experimental-strip-types --test supabase/tests/logistics_retry.test.mjs` | 11 通过、0 失败、0 跳过 |
| `node scripts/check-logistics-functions.mjs` | 通过，主/来源函数严格 TS；复用相邻 Web 已安装 SDK 类型和 Deno 全局声明 |
| Web `npm run test:operation-receipts` | 21 通过、0 失败、0 跳过 |
| Playwright 原物流 + 新同步用例 | 开发与生产构建均 12 通过、0 失败、0 跳过，单 worker；最终生产回归已使用隔离保护 |
| 生产构建上的新同步用例 | 4 通过、0 失败、0 跳过 |
| Web lint / typecheck / i18n / dashboard-ui / operation-contracts | 均通过；操作契约 39 项 |
| `npm run build` | 通过，Webpack 生产构建 |
| 两仓库 `git diff --check` | 通过 |
| `supabase db lint --local --level warning --fail-on warning` | 未通过：原 `public.save_boc_exchange_rate` 的 `v_id` 未使用；物流函数没有告警，未扩大范围修改汇率代码 |

浏览器业务证据：页面首次请求保存 25 条后收到 120 秒限流，运行为 queued、尝试为 partial_failed，检查点为订单 9,000,025，重试下界保存到数据库；本地模拟等待到期后第二次沿原运行完成剩余 25 条，账本 succeeded/50/`completed=true`。前 25 条 xmin 版本完全相同，来源请求游标为 `[0,9000025,9000025]`，重复投递不再请求来源。刷新页面收到 already_fresh，店铺总数 50，第二页为 21–40 条，USD 500。SQL 另证明两页 `lastUpdatedAt` 一致、逐来源时间不伪造。新用例无 pageerror/错误覆盖层，1440px/390px 无整页横向溢出；原用例另检查文字挤压、手机卡片、权限和归属设置。截图保存在 `output/playwright-results`。

限流恢复夹具模拟外部来源；主 Edge、PostgREST、事务、账本和页面是真实本地执行。调度等待在数据库/纯重试测试中核对，浏览器测试只在本地提前等待时钟并补入第二次派发记录；没有把实际 120 秒等待或线上调度器声明为已验收。

## 固定数据收益

同一数据库、5,000 条固定输入、10 页各 500 条，先导入再重复同步；计数触发器直接记录实际 UPDATE。替换旧函数、夹具和计数触发器均回滚，使用 WAL 插入位置差值。

| 指标 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 归档 UPDATE | 5,000 | 0 |
| 观测桶 UPDATE | 0 | 10 |
| WAL 字节 | 9,244,264 | 311,352 |
| 重复同步耗时 | 562.92ms | 352.01ms |
| 完整 5,000 条筛选首屏查询 | 57.78ms | 78.99ms |

归档无效 UPDATE 减少 100%，归档加观测更新事件减少 99.8%；本次 WAL 约减少 96.6%，同步耗时约减少 37.5%。准确时间读取增加约 21ms。WAL 是本地实例全局差值，包含计数触发器和可能的后台活动；耗时受缓存与机器影响，均不能外推成 Nano 性能保证。初版逐行解压导致约 602ms 查询，已经修正为桶只展开一次。稀疏订单编号或跨桶随机增量会写更多桶，实际收益取决于业务分布。

## 发布顺序与兼容性

以下仅为后续授权上线方案，本次没有执行：

1. 重新核对线上迁移历史与现有函数版本，保留备份/函数基线；在维护窗口暂停物流新派发并避免页面触发，等待旧 Worker 结束。不要让旧/新 Worker 在数据库合同切换时混跑。
2. 迁移 dry-run；按文件时间顺序应用三份迁移，核对 Local/Remote 版本和授权。第一份一次性更新现有归档桶编号并复制时间凭证，会产生一次 WAL/锁开销；在约 2.75 万条真实分布上评估耗时，不能把本地 62 条迁移耗时当成线上结果。
3. 部署来源 `logistics-archive-export`，再部署主 `wholesale-logistics-sync`。无需新增真实秘密变量；核对已有两端集成令牌，禁止把测试夹具地址/令牌发布到线上。
4. 部署依赖新完成凭证的 Web，恢复物流任务派发；观察一次增量及一次全量终态并独立核对记录、计数、时间和游标。初始旧失败任务没有新检查点，只能从既有完成基线重新核对一次，之后才具备逐页续跑。
5. 在代表性的繁忙同步时段比较任务启动失败、重试/needs_attention、5xx、IOwait、Swap、Disk IO budget 与归档实际更新数。包含一次完整同步和同时在线查询；空闲时健康不能证明故障已解决。

SQL 页接口维持原字段语义并新增 `data_changed_at`；原始表时间字段语义改变，外部直接读取该表的消费者必须改读页面/观测凭证。upsert 的 integer→JSON 是调用合同变更；当前调用链已统一更新，没有旧数据 fallback。检查点与观测表保持现有物流权限边界，普通角色不能提交检查点或写归档。

## 首轮回滚建议（已由上述完整脚本与本地演练替代）

上线后出现问题时先暂停物流派发和页面触发，等待 Worker 结束，保留检查点/账本证据。回退 Web 至本报告基线；数据库必须用新的前向回滚迁移恢复旧 upsert integer 返回值、旧单参数 claim、renew、checked finish 包装和旧分页函数，定义分别取自历史 `20260714095022`、`20260916045341`、`20260930185202` 迁移。先 DROP 变更了返回类型/签名的函数，重新建立原 service_role 授权；然后回退两端 Edge 到 Supabase 仓库基线，最后恢复派发。不能仅回退 Web 或把旧 Worker 接到新合同上。

恢复旧分页/原始表读取前，先将新观测时间合并回原表，保留新表用于复查，不删业务记录。可审查的合并逻辑为：

```sql
with observations as materialized (
  select o.source_system, o.observation_bucket, e.key as package_number, e.value as times
  from public.wholesale_logistics_observations o cross join lateral jsonb_each(o.seen) e
)
update public.wholesale_logistics_records r set
  last_synced_at = greatest(r.last_synced_at,(o.times->>0)::timestamptz),
  order_source_last_seen_at = greatest(r.order_source_last_seen_at,(o.times->>0)::timestamptz),
  tracking_source_last_seen_at = greatest(r.tracking_source_last_seen_at,(o.times->>1)::timestamptz),
  shipping_source_last_seen_at = greatest(r.shipping_source_last_seen_at,(o.times->>2)::timestamptz),
  tracking_updated_at = (o.times->>3)::timestamptz,
  shipping_cost_updated_at = (o.times->>4)::timestamptz
from observations o
where o.source_system=r.source_system and o.observation_bucket=r.observation_bucket
  and o.package_number=r.package_number;
```

该回滚会一次性重写相关时间行并恢复旧无条件 UPDATE 行为，需要维护窗口；检查点进度保留为证据但旧 Worker 不使用，可能重新扫描来源窗口。新增列/表暂时保留，不通过删除迁移历史伪装回滚；停用新 commit/release 接口并收回 service_role 执行权，结构清理另行审查。上述回滚方案尚未在线执行，也不是已经完成在线回滚演练。

## 基础设施建议（单独决策）

本会话 dashboard 只读检查仍为 Nano（t4g.nano、最高 0.5GB），Micro 选择显示 Free Upgrade、$0.01344/小时、1GB；没有确认升级。官方说明付费组织中的 Nano 与 Micro 同价，Micro 约 $10/月，Compute Credits 按组织共享，实际账单还要看其他项目和计划；[计算费用](https://supabase.com/docs/guides/platform/manage-your-usage/compute)。

升级会重启并中断连接，官方通常少于 2 分钟但可能更久。Nano/Micro 保底 IO 分别为 250/500 IOPS、5/11MB/s；GP3 的 3,000 IOPS/125MB/s 预置规格不能替代 Compute 限制，[Compute 与 Disk](https://supabase.com/docs/guides/platform/compute-and-disk)。如后续决定升级，应在维护窗口重新核对当前账户报价、等待任务结束并验证恢复，不购买额外 IOPS。

代码优化和资源压力可能同时存在。目前没有证据证明所有告警必然来自换页或 IO 额度耗尽，也不能保证 Micro 消除所有 5xx/超时。真实上游/线上繁忙阶段、Nano 实例上的读取额外开销、生产迁移耗时、平台启动超时改善尚未验证。未运行全仓库 `test:regression`/全部不相关 E2E，也未运行原生 `deno check`/`deno lint`；使用明确列出的严格 TS、实际本地主 Edge、相关 SQL、浏览器、静态检查和构建作为本次验证边界。
