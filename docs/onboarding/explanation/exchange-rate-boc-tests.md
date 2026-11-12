# 怎样维护中行汇率测试

[中行综合测试](../../../tests/e2e/exchange-rate-boc.spec.ts)包含当日同步、手工 XTS 和结汇核算三类场景。源码审查已完成。原认证页面套件与真实中行核对仍待验收。专项运行的证据范围见[报价与后台任务验证记录](../reference/verification-2026-11-11-boc-suite.md)。

## 准备专属项目并追踪任务

复用一个指向专属项目的 Web 服务。按[后端环境手册](../../../../PT5-dropshipping-supabase/docs/onboarding/environment.md#汇率同步cli的准备与终态)准备实际网关、Edge 挂载与 43194 本机报价来源，保持调度暂停及队列为空。综合测试要求显式设置 `PT5_E2E_WORKDIR` 和本次模拟来源的 `PT5_E2E_RATE_OWNER`，项目、API 与数据库容器须相符。原页面套件的账号来源仍按[测试手册](../how-to/verification.md)的准入执行。

[准入模块](../../../tests/e2e/helpers/boc-suite-guard.ts)先读取已核验的专属项目，再比较实际 Edge 内部地址、假凭据、启动壳和函数源码。三场景串行共享当天报价。开始时要求报价、任务、尝试、告警、HTTP 回执和核验类型六表为空。插入 USD/EUR × 当前/历史的四条合成类型行，URL 带本次标记。附件的 `realBankVerification` 固定为 `false`。

[Playwright 夹具](../../../tests/e2e/helpers/boc-suite-fixture.ts)识别该项目的汇率函数 POST，保留原请求与响应，在页面收到回包前登记运行编号。原函数先核验管理员，再使用服务身份登记，因此账本的申请人为空。关闭页面后按任务编号、请求类型、响应终态和尝试数量查数据库，报价的新版本还要匹配任务凭证中的编号、币种、日期、原始值与时间。四张截图写入该次测试的输出目录。

[回收核心](../../../tests/test-support/boc-quote-job-case.ts)锁定六表及已登记记录，比较完整记录和 xmin，核对所有外部外键，并按已登记 ID 删除。每一层都校验实际行数，提交后独立查空。版本变化、在途任务、未知回包或外部引用会停止回收，保留专属实例和最后凭证供排查。

## 手工XTS报价

[页面模块](../../../tests/e2e/helpers/boc-manual-rate-page.ts)保留原管理员来源、登录、7→8的原始买入价、700→800的每100外币报价、00:01→00:02的上海发布时间，以及刷新/390px删除的原操作。XTS是原专用测试货币，不作为供应商报价。原“先删当天XTS手工记录”已移除；发现已有报价时停止，不清历史数据。

[数据核心](../../../tests/test-support/boc-manual-rate-case.ts)只接收明确SQL能力和日期，运行时由原专属执行器核验DB/Kong/网络/API及off/0/0。页面模块还要求原SDK和声明API同源。整个固定XTS/日期范围应由单个场景独占：空范围检查不是跨进程互斥锁，并行运行必须使用不同可重建项目。

准备只读、不插入。页面创建后，独立SQL核对唯一编号、货币对、来源、BOC、spot_buy、业务日、原始价/每100单位和上海报价时间，保存完整行/xmin；修改后要求同一编号、新xmin及其余不可变字段一致。刷新再次比整行。页面删除必须独立查零，刷新后再查零；提示不是凭证。

失败收尾先排空路由、关闭页面，再核对先前已保存的完整记录。锁住目标行后重新比较整行/xmin和范围，检查所有外键引用，包括会隐式改写别的业务的SET NULL；有引用就拒绝。实际DELETE须1行且提交后独立为零。结果未知、版本变化或关闭失败时不伪报清理成功；原正文、清理和附件错误均保留。

## 核算预览编号来自哪里

页面的真实`preview_exchange_rate_recalculation`回包是UUID字符串。[关联辅助](../../../tests/e2e/helpers/recalculation-preview-response.ts)先订阅精确RPC路径的POST响应再点击，要求HTTP成功和明确UUID，随后原场景按该ID独立查数据库。读取失败或回包不符就停止，不回退到created_at最新记录。原两处预览已接入；辅助不证明后台核算已完成，原终态及独立业务表断言继续保留。

同路径 GET、其他 RPC 和页面加载产生的响应都不能成为本次编号。原页面动作与独立数据库核对继续用于后续整套运行验收。

## 只有本次订单才能进入全局核算

正式预览扫描全部普通订单和批发订单。[订单/预览核心](../../../tests/test-support/boc-recalculation-cohort.ts)因此先要求普通订单、批发订单和其五类子表、预览/明细共九表为空；有旧数据就拒绝，不清历史。空范围检查不是跨进程锁，不同运行必须使用独立可重建实例。核心仍由原专属SQL执行器核验项目，不能单凭环境变量或空表证明整个Web/Edge接线完成。

原页面继续选择Wholesale Alpha、USD300、采购10、国际运费1、小单1并登记结汇100，备注改为本次UUID。页面及原独立SDK断言完成后，核心只接纳唯一同备注订单、同一结汇编号，以及属于它的佣金/日志；附件、外部分配和普通订单均须为空。整图保存完整记录和xmin。

本次RPC编号关联后，预览只允许新增一份本管理员run和该订单的一条ready明细，原业务图和旧预览版本不变。执行后要求数据库run明确succeeded、影响数为正整数、成功1/失败0、明细同编号和新xmin，after_snapshot中的完整订单/结汇/佣金/分配与实际业务表一致。只有一个订单时partial_failed不计通过。第二份预览的HTTP假成功必须保持九表整图和版本不变。

[收尾模块](../../../tests/e2e/helpers/boc-recalculation-lifecycle.ts)先排空路由、关闭页面，保留正文、清理和附件的所有失败。锁住九表后再次比较最后确认的完整图，拒绝新增外部引用，按已登记ID先删明细、再删run、最后删订单；每类实际影响数须一致，任何一层0影响都会回滚整个事务。提交后九表独立查空。未捕获的创建、版本变化或提交回包丢失不能采为新基准，拒绝重复盲清理。

运行`node --experimental-strip-types --test scripts/learning/boc-recalculation-cohort.test.mjs`检查11项范围、终态、未知结果和收尾风险。正式数据库函数、9表版本和真实删除另外在隔离PG执行，四份门槛核验行仅为隔离类型夹具，不是真实中行核验。[本批订单/预览证据](../reference/verification-2026-11-11-boc-cohort.md)

## 定向验证

```powershell
node --experimental-strip-types --test scripts/learning/boc-manual-rate-case.test.mjs scripts/learning/recalculation-preview-response.test.mjs
node --test scripts/learning/boc-quote-job-case.test.mjs
```

13项验证明确内存端口、未知/缺失回执、完整版本和多错误收尾。真实PG另核对原前置过滤的误删风险、实际删除1行、BEFORE DELETE零影响、SET NULL引用、锁内版本变化和回包丢失；所有报价都是合成夹具。真实Chrome只通过本地协议页按钮验证预览关联，HTTP响应明确模拟，不是原后台或中行业务。证据见[本批报告](../reference/verification-2026-11-11-boc-manual.md)；完整原认证、三页面、响应式/双语、完整回归和构建仍未运行。
