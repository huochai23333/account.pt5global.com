# 结汇收款发布、分配与冲销

发布请求号、分配版本与撤销历史的演进见[后端历史阅读指南](../../../../PT5-dropshipping-supabase/docs/onboarding/rate-publication-allocation-history.md)。历史阶段的财务限制已在后续扩展，现行权限按本文和数据库实际定义核对。

财务或管理员通过 `/[workspace]/wholesale/settlement-releases` 发布收到的款项。获授权的业务员、财务或管理员可把一笔收款分配给同一客户的多张订单。批发订单详情中的直接结汇有独立入口和凭证。

| 我要维护什么 | 从哪里开始 |
| --- | --- |
| 定位列表和首屏读取 | [页面组装](../../../components/dashboard/wholesale/wholesale-settlement-release-client.tsx)从[查询服务](../../../lib/wholesale-settlement-releases.ts)接收当前角色可见的收款、分配和订单。页面筛选不会改变月度统计。 |
| 修改发布表单 | [发布弹窗](../../../components/dashboard/wholesale/wholesale-settlement-release-dialogs.tsx)收集客户、币种、金额和收款日。[发布 Hook](../../../components/dashboard/wholesale/use-wholesale-settlement-release-publication.ts)管理请求编号和重试，[发布服务](../../../lib/wholesale-settlement-release-publication.ts)调用数据库并独立核对收款。 |
| 修改分配建议 | [分配表单 Hook](../../../components/dashboard/wholesale/use-wholesale-settlement-release-allocation-form.ts)按客户、币种及订单余额生成最早订单优先的草稿。数据库核对最终金额、汇率、订单及预期修订号。 |
| 核对清空分配 | [清空服务](../../../lib/wholesale-settlement-release-clear.ts)使用确认时的收款版本及原分配编号。分别读取收款、原冲销记录、有效分配和关联结汇。 |
| 了解助手发布 | [指令解析](../../../lib/ai-assistant/settlement-release-command.ts)提取客户、金额、币种和收款日，[助手服务](../../../lib/ai-assistant/settlement-release-server.ts)生成确认数据并在确认时复核客户。数据库沿用相同发布权限。 |
| 核对月度金额 | [汇总服务](../../../lib/wholesale-settlement-release-summary.ts)按上海月界计算未分配金额，并读取数据库的已分配折美元统计。 |

## 核对一次发布

每次发布先生成请求编号。数据库按发布人和请求编号核对旧记录。同一内容的重试返回原记录编号，改动内容的重试先被表单拦住。Web 读回同一发布人、请求编号和内容，才确认成功。响应丢失时先尝试读回，仍无法确认时可在弹窗里点「核对上次发布」或用原内容重试。

页面按当前账号在同一标签页暂存请求编号和内容摘要，刷新后仍可核对。确认后清除暂存，下一次发布会取得新编号。当前标签页的暂存受浏览器会话和存储设置约束。

## 核对一次清空

数据库根据当前版本撤销活跃分配、移除它们生成的结汇记录，将收款恢复为待分配。原分配行保留为冲销历史。页面须读到下一修订号、原分配已冲销、零有效分配和零关联结汇，才确认操作完成。提交响应丢失时按原编号查询。版本已经变化或尚无法确认时，页面提示刷新核对。

## 跟踪缺汇率后的补价

分配保存先在数据库核对实际收款日。如果缺少精确日末报价，页面用同一个收款编号申请补价，按派发回执中的运行编号查询终态。全部完成后，页面携带原分配内容和修订号再提交一次。正式分配仍会重新校验精确报价。部分失败或结果未明时保留原收款和分配草稿。

[原测试入口](../../../tests/e2e/settlement-rate-repair-receipts.spec.ts)使用专属 Web、数据库和 Edge 进程。按[本地报价环境](../../../../PT5-dropshipping-supabase/docs/onboarding/environment.md#汇率同步cli的准备与终态)准备实际挂载、模拟凭据和内部网关地址。Web 连接同一项目，保留原登录入口。测试须独占测试数据，准备一个可登录的活跃管理员、批准参数和空的相关业务范围。员工档案等与本次客户无关的目录可保留。

专属库的客户、订单、提成、订单日志、收款、分配、结汇、报价和任务相关表应为空。客户关联的档案与目录也须为空，范围定义见[夹具 SQL](../../../tests/test-support/settlement-repair-sql.ts)。已有固定种子只准备身份和批准参数。声明专属项目、Web/API 地址、工作目录与报价来源 UUID 后，由成功场景占用本机 43194 启动合成报价。其他该端口的实例需先结束各自运行。

具备[原测试准入](../../real-e2e-blockers.md)后，在 Web 仓库执行：

```powershell
$env:PLAYWRIGHT_SKIP_WEB_SERVER = "1"
npm run test:e2e -- tests/e2e/settlement-rate-repair-receipts.spec.ts --workers=1
```

成功场景选择前一个上海自然日，使用本机完整日末样本，从页面发布 10 USD 并分配到专属的 100 USD 订单。沿同一个收款编号核对发布请求、派发、尝试、报价、分配与结汇。参考样本的原价为 6.6993，公司价 6.632307，结汇金额 66.32 元，收款修订号变为 1。刷新后核对同一条收款和数据库版本。

部分失败场景的首次分配、任务派发和轮询由针对当前编号的浏览器路由模拟。确认未再次提交，且真实收款仍为待分配、修订号 0、分配与结汇均为空。两场景结束后按捕获的完整版本和外键回收本次数据，包括客户自动生成的档案和根目录。未知回包或外部引用保留最后凭证。

## 区分两个统计

「本月未分配」按实际收款日归属月份。先选出本月收款，再扣除目前有效分配，按原币种分开显示。「本月已分配」按有效分配记录的创建时间归属月份，并按收款日汇率折算美元。缺汇率时已分配汇总显示待核对。

上海月界、精确日期报价及冲销排除的原生检查见[月度分配历史指南](../../../../PT5-dropshipping-supabase/docs/onboarding/worker-monthly-quotation-history.md)。月度统计由完整授权数据计算，页面分页不能代替汇总。

## 验证两张订单的分配和冲销

[综合测试](../../../tests/e2e/wholesale-settlement-releases.spec.ts)保留财务发布、业务员分配、重分配、清空、手填客户的失败重试与刷新。准备一个独占的专属项目和指向同一网关的 Web 服务，保留原财务及业务员登录。该项目应有一个可登录的活跃财务、一个可登录的活跃业务员、批发权限和批准参数。客户、订单、相关报价与收款等测试范围应为空，完整范围见[共享夹具 SQL](../../../tests/test-support/settlement-repair-sql.ts)。

测试会创建本次业务员的客户、额度 1,600 USD 与 2,200 USD 的两张订单，以及收款日 7.2 的手工报价。财务通过原页面分别发布正式收款 3,000 USD、手填收款 500 USD 和随后取消的 88.66 USD。每次发布使用真实回包的编号以及原发布请求号，数据库独立核对发布人、金额、客户和收款日。任何补价请求会被阻止并记为用例失败。

| 原场景步骤 | 要查的凭证 |
| --- | --- |
| 初始建议和部分分配 | 按订单日期建议 1,600／1,400。实际保存 1,000／500，修订 1，两个有效分配及两个订单结汇。 |
| 整组重新分配 | 1,600／1,400，修订 2。原两条分配冲销，留下两个新的有效分配及其结汇编号。 |
| 清空分配 | 修订 3，待分配，四条冲销历史，零有效分配和零关联结汇。 |
| 手填客户故障与恢复 | 首次 HTTP 500 保留草稿及数据库版本。恢复后 500 USD 归到第一张订单，修订 1，公司价 7.128，结汇 3,564 元。 |

浏览器刷新后核对同一业务记录和月度合计。财务和业务员页面均关闭后，再按已确认的全图行版本回收客户、档案、订单、手工报价及三笔收款。未知提交、版本变化和未登记外键会停止清理。

具备[原测试准入](../../real-e2e-blockers.md)及已启动的专属 Web 服务后，在 Web 仓库设置 `PLAYWRIGHT_SKIP_WEB_SERVER=1`，运行 `npm run test:e2e -- tests/e2e/wholesale-settlement-releases.spec.ts --workers=1`。离线风险检查运行 `node --test scripts/learning/wholesale-release-fixture.test.mjs`。真实数据库与浏览器协议的验证范围见[综合测试报告](../reference/verification-2026-11-11-wholesale-release.md)。

## 定向验证

原数据库发布/分配测试的最小准备与相对包含见[结汇发布SQL实操](../../../../PT5-dropshipping-supabase/docs/onboarding/settlement-release-sql.md)。五身份和六张CNY订单分别核对修订1→5、真实分配与结汇关联、冲销历史及正金额108元提成不重写；财务和业务员的前后读回使用同一身份。原入口和三段共享一个回滚事务，SQL角色结果与页面/Auth、真实中行及并发分开记录。

- `npm run test:learning:browser -- wholesale-settlement-release-clear-recovery` 验证从页面清空、失去响应、去重和刷新后的冲销凭证。用例只操作人民币专属夹具。
- `npm run test:learning:browser -- wholesale-settlement-release-publication-recovery` 验证连击、失去响应、原内容重试、改金额被拦截和刷新后只读核对。人民币专属夹具按发布人和唯一客户标记清理。
- `npm run test:settlement-unallocated` 验证上海月界、部分分配、冲销和按币种合计。
- `node --test scripts/learning/settlement-repair-receipts.test.mjs` 核对精确报价、任务归属和实际分配凭证。实际数据库与回环传输的运行范围见[补价验证报告](../reference/verification-2026-11-11-settlement-repair.md)。
- [后端数据库指南](../../../../PT5-dropshipping-supabase/docs/onboarding/database.md)列出对应 SQL 和角色边界。
