# 原汇率CLI：本地全链路与限定清理

本批关闭原`scripts/test-exchange-rate-sync-local.mjs`的职责待审，新增environment/cases/fixture三份后端模块与一份Web专项均同批审完。总量2080→2084、已审2063→2068，原待审15→14，受限仍2，新增待审0。这里的总量是源码清单，不是剩余工作；当前以[职责覆盖表](manual-review-coverage.md)为准。整体继续`partial_failed`。

## 维护入口与真实边界

原脚本195→259有效行，负责专属准入/CLI状态、保留原登录和请求端口、资源调度与最终报告。`signIn`和`invoke`仅增加30/90秒signal，原请求结构及两个状态解析助手AST保持，四组原非法输入完整保留。密钥只保存在内存，原生CLI状态失败不带出子进程缓冲区，也不再用npx隐式下载工具。

同层`exchange-rate-sync-environment.mjs`196行：核对项目/端口/网络、暂停调度及队列归属，检查真实Edge挂载和外部边界。`exchange-rate-sync-fixture.mjs`185行：写前声明请求、完整版本快照、原派发与限定清理。`exchange-rate-sync-cases.mjs`238行：日期/案例、按真实到期时间重试、业务结果核对。五项专项位于Web`scripts/learning/exchange-rate-sync-cli.test.mjs`，368行。行数均不计末尾空行；所有文件不超过400行，分别保持三项以内职责。

默认`PT5_E2E_PROVIDER_MODE=mock`。准备和运行步骤见[后端环境](../../../../PT5-dropshipping-supabase/docs/onboarding/environment.md#汇率同步cli的准备与终态)。本次新建`pt5-e2e-rate-0646e890`的DB、Auth、Kong、REST和Edge五核心服务，实际执行原认证、SDK、数据库函数和pg_net派发，只有供应商HTTP响应模拟。恢复当前public/private/document_private业务结构，Auth使用新实例自己的结构和迁移记录，不复制共享账号、业务行、任务令牌；17份实际挂载函数源码与仓库逐字核对。Storage、Realtime和Web页面不在本批运行范围，不能称为整个应用验收。

Web两个受限助手没有读取、导入或执行。后端CLI自带的原signIn直接走真实本地Auth，不将它替换为其他认证入口，也不将本批计为原Web认证套件通过。实际会话独立查询为0→3→0，退出响应不能单独算清理完成。

## 完整业务证据

完整原CLI日志为Web `output/test-runs/2026-11-10T16-11-41-325Z-de3a9fc7-df26-4353-acde-bc06ffb4dce4/`，约7分28秒。7次运行、17条尝试、3条报价及10条内部传输回执全部核对。管理员实际发起，客户/招聘拒绝；四个非法请求和USD/ZZZ部分失败均按原60/300秒间隔完成三次尝试，5个needs_attention；重复USD与当前USD/CNY两个运行succeeded。没有调整定义、提前next_attempt_at或手造尝试记录，cron始终off。预期负例终态仍按失败事实记录，不标成业务成功。

本地来源共5次请求：USD历史1次、ZZZ历史3次、USD当前1次，CNY不请求供应商。报价独立Data API与SQL完整记录一致；另以只读SQL保存三条完整记录，结束报告的编号和xmin逐条一致，证明重试没有改写已保存报价。

| 报价 | 日期 | 原始汇率 | 实际编号 | xmin |
| --- | --- | ---: | --- | --- |
| USD历史日末 | 2026-11-10 | 6.6993 | 8f4c8bef-4aae-4bb8-8518-0f1a94c7f0fb | 1337 |
| USD当前 | 2026-11-11 | 6.6993 | d475c2c7-6411-4fe2-a6ba-74b1b0a0dfed | 1347 |
| CNY固定基准 | 2026-11-11 | 1 | d4b1a510-3dbe-4d08-825e-9a1ea894c2c0 | 1346 |

USD报价为本地669.93/100样本，元数据由原保存函数生成nowapi/BOC/spot_buy；不代表真实银行。CNY由原函数保存为system/fixed、bank_quote100、bank_code NULL，不能套用美元的银行字段。完整记录、版本、运行编号、终态、尝试数和10个请求编号见`output/learning-rate-cli-fullstack-20261110/business-proof.json`。

清理按私有备份锁内比较完整内容/xmin，逆序回收HTTP回执、告警、尝试、运行和报价，每表核对影响数，再独立查零；没有按日期或前缀批量删除。临近上海午夜先只读等待新业务日，避免“今日非法”跨日变成可查询历史，原日期规则不改。

## 失败保护与纠正记录

独立真实SQL故障检查创建自有报价后只做同值更新，完整字段保持，但xmin1418→1421。采集和清理均拒绝，报价`d3fdd9cd-7dbe-4062-a338-8e0b943e0792`保留至整个专属实例回收。按备份与实际主键独立重新计算，132张外来保护表未变；两次拒绝事务前后本实例159张普通表完整内容/版本摘要相同。业务函数、所有者和权限摘要与主项目一致。

整轮后另收紧错误输出：凭据或源码不匹配仅输出固定错误，AssertionError也不包含误配置值。5项专项含14组原前置拒绝、清单/日期输入、午夜等待，以及6组凭据/URL/源码不回显；这些是合成端口，不算额外业务场景。当前真实Edge又只读核对17份挂载源码和项目接线。原整轮使用的上下文版本另存`runtime-environment.mjs.used`和`static-proof.runtime.json`，与后续错误脱敏检查分开留证；没有为仅改变错误文本再次运行整轮业务。

此前失败均留证：新实例postgres不能设置调度参数，改用专属实例管理员；schema-only已包含public，移除重复CREATE；空搜索路径下触发器需完整限定；账号已提交后发现pg_cron未创建，按三条完整内容/版本条件恢复并补只读核对；同一时刻的Z/+00:00格式比较改为时间值；CNY误套BOC断言按现有函数修正。两轮失败分别等真实终态后精确回收，没有覆盖历史数据来重跑。VM专项曾缺少模块互操作和原解析声明，已修复并增加精确错误名，避免普通TypeError被误当成正确拒绝。上述是环境/夹具/测试整改，没有修改业务函数、权限或金额算法。

## 验证和清理

按web-change-quality-gate Non-rendered：5项专项、359项学习测试通过，4份后端语法检查和5文件lint零错误/告警，原Auth/请求AST和原非法输入保持。未修改页面或Next边界，本批不增加浏览器检查；完整Web回归/构建仍受原入口限制，未计通过。日志与摘要索引为`output/learning-rate-cli-fullstack-20261110/final-verification.json`，其中保存失败日志和最终检查，不以数量替代证据。

本次五容器、数据和Deno缓存卷、网络均已回收，专属工作目录及其中合成口令文件已删除。其他项目容器ID保持，主项目仍off/活动0/队列0；没有启动第二个Web服务。保留最终证据、失败诊断与批前回滚备份。真实中行核对、原Web认证/产品页面、完整回归和生产构建、GitHub/Cloud/网站部署均未执行或未完成，整体仍`partial_failed`。
