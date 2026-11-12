# 原测试的控件、合成模板和本地 SQL

这份资料帮助新人修改测试辅助代码。原 E2E 的账号和管理员入口限制、专属 API/Auth/数据库前提仍见[准入记录](../../real-e2e-blockers.md)。源码审查与纯模块检查不表示原套件已执行。

## 下拉框和折叠筛选

[订单日期原测试](../../../tests/e2e/order-date-range.spec.ts)是纯函数测试，不需要账号、浏览器页面或数据库。它直接导入 order-date-range 和 admin-orders-page-filters，覆盖上海跨年、非法日期、半开时间区间、快捷范围及精确搜索。仅在每项测试内冻结无参 Date 和 Date.now，afterEach 恢复；不要把机器所在时区当作订单业务日期。九个原用例在 UTC 与 America/Los_Angeles 两种进程时区下各通过一次，属于同一组九个场景。

[订单与物流列表框架](../../../tests/e2e/order-list-framework.spec.ts)仍使用原岗位登录，原四项页面用例本轮未运行。它检查日期工具条、底栏布局、日期切换和翻页，要求隔离种子在默认范围有记录；空列表不会显示本文件所查的非空范围底栏。几何辅助只比较真实边界，不负责数据库凭证。

翻到末页必须先等实际分页导航 aria-busy=false，再读“当前页/总页数”；相等时还要确认范围末值等于总条数和下一页禁用。加载也会禁用按钮，所以 isEnabled=false 不能证明末页。最多向前十次，数据超过上限应失败并重新准备更小的专属种子，不跳过剩余页。六种真实 Chrome/合成 DOM 检查复现原误判并验证等待、错误页码、非末页禁用、错误末尾计数及安全上限；它们只加载原文件中抽取的两个纯页面助手，不加载原认证入口，也不算订单/物流真实页面通过。

[select-control](../../../tests/e2e/helpers/select-control.ts) 服务于项目的 [Select](../../../components/ui/select.tsx)。选项通过 Portal 放在页面级，因此从页面定位 option，点击后同时核对可见文案和同一根控件下隐藏 input 的值。后者才会进入 FormData。退出动画的 option 卸载后再操作下一控件，避免同值选项互相干扰。[Playwright 定位器](https://playwright.dev/docs/locators)

动态选项值通过打开菜单、读取 data-value、Escape 关闭获得；不能把新标签硬编码成种子 ID。expectSelectOptions 检查传入标签存在，额外选项是否允许要在业务用例单独断言。维护这个模块时一并核对控件根节点的 data-slot 和隐藏表单值。

[order-filter-visibility](../../../tests/e2e/helpers/order-filter-visibility.ts) 等待“更多筛选条件”按钮或“日期快捷范围”就绪：订单页初始折叠，认领页可能直接展开。它只展开真实界面，不通过改 DOM 跳过交互，也不替代筛选结果或写入凭证断言。

## 合成 HTML 为什么保留闭包

[generic-template-fixture](../../../tests/e2e/helpers/generic-template-fixture.ts) 的行数组保存在脚本闭包，事件逐行绑定。恢复填写后必须继续新增、删行和计算，才能发现“只复制 DOM，事件和模型已丢失”的问题。比例提示、确认框、多选、可编辑文本和图片输入都是专用测试输入，不是正式业务模板。

本次将 HTML 和脚本展开为普通缩进，保留脚本语法结构与控件属性结构。排版会改变合成文件字节与 SHA；原用例的期望来自同一份 fixture 值，不能把格式前的哈希套到新文件。格式对照位于 output/learning-document-folder-review-20261106/generic-fixture-format.json，原值副本保留用于回滚。原发布与恢复用例仍未运行。

## 三个 SQL 辅助如何选择

结汇收款收尾走[专属原子清理](settlement-test-fixtures.md)：先锁定精确备注的收款，再同事务删除分配/结汇/收款，并另连查零；不使用原管理客户端执行这次清理，也不继承下面固定共享目标的限制。原认证入口仍按访问限制保留未执行状态。

物流历史索引成本使用另一种[空PG17性能模型](../../../../PT5-dropshipping-supabase/docs/onboarding/logistics-performance.md)。它不读取下面三个原认证辅助，也不接受共享库：目标创建/物理准入/有界执行在后端`logistics-performance-target.mjs`，索引入口负责500条实际档案与观测读回。该模型的身份函数是明确替身，不能代替原完整分页、Auth或页面验收。

[完整分页矩阵](../../../../PT5-dropshipping-supabase/docs/onboarding/logistics-page-performance.md)另用命令入口、模型和执行计划三层：四身份/25筛选必须实际存在，500比较与948全页保持；空JSON、空计划或缺角色不算通过。正常完整模式与两个只检查计划的原负例分别记录，不与当前Web/Auth验收混用。

| 辅助入口 | 用途与边界 |
| --- | --- |
| [local-postgres-query](../../../tests/e2e/helpers/local-postgres-query.ts) | 将可信测试查询包装为 JSON 数组，供页面之外的独立读取；字符串使用 localSqlValue 转义。 |
| [local-supabase](../../../tests/e2e/helpers/local-supabase.ts) | 原测试的准备、清理和凭证SQL；五项进程环境必须显式声明，每次调用重新核验真实专属目标。 |
| [wholesale-fee-database](../../../tests/e2e/helpers/wholesale-fee-database.ts) | 费用领域名称直接引用同一写入执行器，保留feeSqlValue及原订单/佣金JSON读取；不再进入受限环境辅助。 |

三个入口现在均核对显式专属项目及实际API/数据库映射；`local-postgres-query`使用只读事务，另外两个准备/清理入口仍有写能力，不能称为只读。费用订单/佣金读取保持原JSON合同，复用有写能力的连接；新独立只读查询优先使用`readLocalPostgresRows`。三者使用参数数组、标准输入或明确查询参数传给psql，不拼接shell；执行身份均高于页面岗位，不能用维护角色读取证明页面RLS。固定账号/全局规则用例只能在可重建隔离实例运行。

三个入口统一使用服务端 statement_timeout=12 秒、lock_timeout=10 秒及客户端进程 15 秒兜底。服务端先取消语句，避免只结束 Docker 客户端却留下长时间工作的数据库会话。通过 PGOPTIONS 只设置本次连接，不改角色或数据库默认值。[PostgreSQL 连接参数](https://www.postgresql.org/docs/17/libpq-envars.html)

早期配置探针确认12s/10s参数，并用缩短到50毫秒的期限取消pg_sleep(1)，当时未执行原环境入口或原用例。后续独立读取助手已在专属空PG17中验证实际12秒语句超时，接线边界见下节；两次证据的范围分别保留。

新增独立查询仍只接收受信任测试构造的 SQL；不要把页面输入直接传给这些高权限工具。页面关键操作、权威读回和刷新核对继续按[验证手册](../how-to/verification.md)执行。

## 准备与清理SQL的专属目标

`runLocalSupabaseSql(statement)`与`isLocalSupabaseTestTarget()`保留原名称和返回种类；费用的`runWholesaleFeeSql`直接引用前者。只读取进程中的`PLAYWRIGHT_BASE_URL`、`NEXT_PUBLIC_SUPABASE_URL`、`PT5_E2E_FIXTURE_MODE=disposable`、`PT5_E2E_DATABASE_PROJECT`与`PT5_E2E_DATABASE_CONTAINER`，不读取`.env.local`或原管理员模块。应先按[环境说明](../../../../PT5-dropshipping-supabase/docs/onboarding/environment.md#sql维护命令的专属目标)准备专属项目，再设置声明；不能把共享项目改名或删除数据来满足前置。

每次执行均由`readDisposablePostgresTarget`核对DB/Kong运行、项目标签、实际API端口/网络、暂停调度和空外部队列。端口来自真实映射，原54321不再作为身份判断。SQL经stdin进入核验后的容器，`-XqAtw`禁用启动脚本/密码交互，12s语句/10s锁/15s进程期限只影响本连接。子进程stdout/stderr经管道收集，SQL失败统一抛未确认，不回显可能含账号或密钥的原错误，也不自动重试。

返回SQL文本不是业务成功凭证；调用方仍须验证影响数、实际记录和刷新。事务出错可能回滚，丢回执也可能已经提交，失败后先独立读回再决定恢复。`isLocalSupabaseTestTarget()`为false只说明当前前置未通过；原套件据此skip不算通过，清理阶段也不能把false当成已回收。原线索调用方的数据生命周期见[转换夹具](sales-lead-conversion-tests.md)和[每日上限](sales-lead-flow.md#怎样维护每日认领上限测试)；报销和费用夹具仍按各自指南审查，不因共用执行器修复而算业务完成。

准备清理执行器批次的28项策略回归、两实际安全根类型/三文件lint通过。无网络空PG17执行当前助手的两次诊断，14次核对写入/参数/原子失败与真实12秒超时，17次补费用入口及原JSON字段；API/DB/Kong元数据和SQL传输到模型的重定向为明确替身，原Auth/真实网关/页面仍未执行。[范围与凭证](../reference/verification-2026-11-06-wholesale-scope-contracts.md#2026-11-10准备清理sql的专属目标)

## 独立读取的专属目标与只读事务

[local-postgres-query](../../../tests/e2e/helpers/local-postgres-query.ts)保留`readLocalPostgresRows<Row>(query)`和`localSqlValue(value)`签名，移除受限管理员环境导入和固定54321/共享容器。它只读取进程的`PLAYWRIGHT_BASE_URL`、`NEXT_PUBLIC_SUPABASE_URL`、`PT5_E2E_FIXTURE_MODE=disposable`、`PT5_E2E_DATABASE_PROJECT`及`PT5_E2E_DATABASE_CONTAINER`，不读取`.env.local`，不自动重置数据。

实际准入复用`readDisposablePostgresTarget`：专属项目以`pt5-e2e-`或`pt5-learning-`开头，数据库名匹配，DB/Kong标签与运行状态一致，网关绑定声明的HTTP API端口、网络一致，调度/活动任务/外部队列为`off|0|0`。允许的端口来自实际绑定，不按某个旧端口放行。该校验仍不能替代Web和受限Auth助手实际接线审查。

数据查询连接设置`default_transaction_read_only=on`，保留12秒语句/10秒锁/15秒进程期限，并以`-XqAtw`禁用psql启动脚本和密码提示、输出唯一JSON聚合。正常无记录返回`[]`；SQL错误、无效JSON或非记录对象数组抛错，不能算空数据成功。只读事务用于防止受信任查询误调用写函数，不是任意SQL沙箱，也不证明页面岗位权限。[PostgreSQL只读事务](https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-DEFAULT-TRANSACTION-READ-ONLY)、[psql启动选项](https://www.postgresql.org/docs/17/app-psql.html)

[月份筛选原测试](../../../tests/e2e/wholesale-order-month-filter.spec.ts)依赖专属种子`c2000000-0000-4000-8000-000000000001`，其计入月份在默认上海日期范围内须有超过20笔订单，1900年月份在同范围应无记录。三条独立查询的SQL保持原样；准备不足会明确失败，不修改共享订单来凑数。页面月份筛选经`get_wholesale_order_page`返回分页和摘要，数量须完整匹配唯一可见的「订单」卡片，不能用子串把120当20或10当0。刷新后筛选回默认，再选同月核对。客户手动上下文显式继承同一`baseURL`，创建页面失败也在`finally`关闭。

原月份场景仍未运行，不能把维护角色计数、离线DOM或空PG17模型当页面验收。原目录、邮件编号页、当前汇率夹具和订单编号测试也使用此辅助，未来运行须同步满足专属前提；它们未因此自动计通过。[本批源码与定向证据](../reference/verification-2026-11-06-wholesale-scope-contracts.md#2026-11-10月份筛选与独立读取)

维护此助手后执行`npm run test:e2e-fixture-policy`，当前36项一起运行：原28项准入与实际读/写/费用助手、4项每日上限生命周期、4项协作context资源回归。它使用明确的Docker/记录替身，不连接数据库、不会加载原认证入口；真实SQL与浏览器证据仍分开记录。

## 文档写锁的专属项目

[document-write-lock](../../../tests/e2e/helpers/document-write-lock.ts)用于制造真实等待，会影响整组文档操作。它不再使用固定54321或共享项目容器，也不读取原认证环境模块。调用签名仍为`holdDocumentWrites(draftId?)`，返回有界释放函数。

执行前必须显式提供`PT5_E2E_FIXTURE_MODE=disposable`、`PLAYWRIGHT_BASE_URL`、`NEXT_PUBLIC_SUPABASE_URL`、`PT5_E2E_DATABASE_PROJECT`和`PT5_E2E_DATABASE_CONTAINER`。Web和API必须为本机地址，API还须为带端口的HTTP原点；专属项目名以`pt5-e2e-`或`pt5-learning-`开头，数据库名为`supabase_db_<项目名>`。改环境声明不能把共享项目变成隔离实例。

[纯准入函数](../../../tests/test-support/disposable-fixture.ts)要求数据库与`supabase_kong_<项目名>`均运行、同项目标签、同网络ID，而且该网关8000端口实际映射到声明的本机API端口。只读取必要Docker字段，不输出容器环境或密钥。[Docker inspect格式说明](https://docs.docker.com/reference/cli/docker/inspect/)。之后仅在已核验的目标库读取调度、启用计划任务数和外部HTTP队列，结果须为`off|0|0`才创建锁进程；不会自动暂停任务或清空数据。

策略20项、真实接线/进程13项检查只注入明确的元数据、进程事件或SQL预检结果，均未连接原认证入口。完整专属Web/Auth/API项目和真实锁正向业务流程仍未执行；另外两个准备/清理SQL辅助仍有固定目标限制，独立读取的后续修复见上节。[专项证据](../reference/verification-2026-11-06-template-helper-release-review-quota.md#2026-11-09模板失败场景与隔离锁)。

后续故障测试把同一只读接线放到`readDisposablePostgresTarget`，锁仍保留原调用签名。`requireDocumentFixtureDatabase`供故障文件在页面操作前准入，`runDocumentFixtureSql`只接收可信测试SQL，以同一容器的标准输入执行并设12s语句/10s锁/15s进程期限；不导入原认证环境。接线/进程现14项，新增SQL目标、输入与期限核对，原13项保留。

全实例清理命令也复用该准入，因此专属API端口来自实际网关绑定，不再使用共享仓库config端口作准入依据。实际CLI只验证拒绝路径；正向完整项目和真实故障仍未验收。[后续整改与凭证](../reference/verification-2026-11-06-document-entry-review.md#2026-11-09故障测试与清理准入)。
