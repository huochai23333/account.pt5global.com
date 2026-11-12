# PT5 Dropshipping Web

本轮两仓库上传与Supabase迁移／函数发布的范围见[2026-11-12云端记录](docs/onboarding/reference/cloud-upload-2026-11-12.md)，GitHub、Cloud、网站部署和平台重扫分别核对。

后台清理与来源导出的实际接线、资料库重试遗漏修复及验证边界见[后台入口验证](docs/onboarding/reference/verification-2026-11-11-cleanup-workers.md)。资料库清理使用固定任务清单续办原目标；数据库迁移和Edge代码需在同一本地项目配套使用，主项目计划任务继续暂停。

PT5 工作台的网页、交互与服务端接口。基于 Next.js 16.4.3、React 19、TypeScript、Tailwind CSS 4、Supabase 与 next-intl。当前业务启用范围由公司配置与数据库权限决定。

## 新人从这里开始

- [学习路线](docs/onboarding/README.md)：从本地启动到完成一次维护。
- [功能与源码地图](docs/onboarding/module-index.md)：页面、业务、权限、后端与测试的位置。
- [贡献指南](CONTRIBUTING.md)：改动、注释、验证与交付约定。
- [架构与数据流](docs/onboarding/explanation/architecture.md)、[术语表](docs/onboarding/reference/glossary.md)。
- [共享控件维护入口](docs/onboarding/explanation/shared-ui-flow.md)，包含日期输入、弹窗焦点和响应式列表。
- [共享读取与请求边界](docs/onboarding/explanation/shared-read-and-request-flow.md)，包含分页、恢复和服务端输入检查。
- [线索数据流](docs/onboarding/explanation/sales-lead-flow.md)，从页面认领、联系、退回到后台导入。
- [线索每日上限测试](docs/onboarding/explanation/sales-lead-flow.md#怎样维护每日认领上限测试)，要求专属身份当天零认领，使用六个随机编号，按完整记录和行版本核对第5次成功/第6次拒绝，原页面验收另列。
- [线索数据库阅读路线](../PT5-dropshipping-supabase/docs/onboarding/sales-lead-hall-history.md)，区分来源、领取周期、联系记录及历史状态。
- [线索练习数据与清理](../PT5-dropshipping-supabase/docs/onboarding/learning-lead-fixture.md)，用专属随机编号准备教程，核对实际影响数、锁后归属及提交后的独立记录。
- [报销与后台凭证阅读路线](../PT5-dropshipping-supabase/docs/onboarding/operation-reimbursement-history.md)，区分共享查看、本人写入、运行终态与最终业务记录。
- [运营报销SQL实操](../PT5-dropshipping-supabase/docs/onboarding/reimbursement-sharing-sql.md)，在九身份专属副本核对分页、周期金额、重复确认不重写及完整恢复；真实Auth、页面与并发另验。
- [业务参数SQL实操](../PT5-dropshipping-supabase/docs/onboarding/business-parameter-sql.md)，在四身份专属副本追踪版本发布/取消、恢复原基准和订单锁定，核对3000元已结汇与110元推荐佣金。
- [结汇发布SQL实操](../PT5-dropshipping-supabase/docs/onboarding/settlement-release-sql.md)，按五身份/六订单追踪发布、分配修订、冲销历史和108元合成提成保护，实际付款及真实中行凭证另验。
- [结汇测试夹具与收尾](docs/onboarding/explanation/settlement-test-fixtures.md)，说明原子清理、空正文拒绝、页面回收及专项与原页面套件的不同范围。
- [订单读取测试](docs/onboarding/explanation/order-read-contract-tests.md)与[客户别名夹具](docs/onboarding/explanation/customer-alias-tests.md)，区分纯逻辑、页面准入、独立记录与限定清理。
- [线索转换测试辅助](docs/onboarding/explanation/sales-lead-conversion-tests.md)，说明页面前清单、非空负责人和完整周期凭证、原子清理及独立读回；大厅使用本次UUID和上海当日额度只读检查，33项专项覆盖大厅、管理员及原转换夹具，保护预登记编辑/故障版本，与原认证页面验收分开记录。
- [后台尝试与月度分配](../PT5-dropshipping-supabase/docs/onboarding/worker-monthly-quotation-history.md)，包含真实连接竞争、旧代拒绝和已分配归月边界。
- [订单、账号与邮件边界](../PT5-dropshipping-supabase/docs/onboarding/order-mail-boundary-history.md)，分清内部字段、列权与行权、收件原子性和历史游标页。
- [线索额度、客户转换与邮件数据库](../PT5-dropshipping-supabase/docs/onboarding/lead-mail-history.md)，包含转换凭证、固定认领期限、隔离测试入口及邮件回执。
- [公司模板、个人文档与规则版本](../PT5-dropshipping-supabase/docs/onboarding/template-parameter-history.md)，区分私有草稿、公共文档、统一目录、可恢复批次、读取策略与普通HTML保存、固定版本及客户分类提成与费用。
- [批发目录与推荐关系](docs/onboarding/explanation/wholesale-people-flow.md)，区分客户档案、登录账号和两类推荐树；原客户管理测试复用UUID清单核对字段/修订和零残留，协作矩阵区分入口可见与实际写入，并核对手动context的地址和失败收尾。
- [批发 VIP 数据流](docs/onboarding/explanation/business-vip-flow.md)，包含开通、续期及待确认时的核对方法。
- [VIP 数据库历史阅读路线](../PT5-dropshipping-supabase/docs/onboarding/business-vip-history.md)，说明审批与直接续费的期限差异、固定年费和权限。
- [批发订单数据流](docs/onboarding/explanation/wholesale-order-flow.md)，包含筛选、建单重试、费用列核对、直接结汇、附件八岗位矩阵及同页／跨页上传核对；[创建防重复测试维护](docs/onboarding/reference/verification-2026-11-05-wholesale-order-core.md#2026-11-10原创建防重复页面测试)说明原USD样本、刷新闸门、独立凭证和专属清理。
- [分页与附件测试维护](docs/onboarding/reference/verification-2026-11-05-wholesale-order-core.md#2026-11-10原分页与附件凭证测试)说明第二页响应等待、自有订单、真实工作簿、下载哈希与完整版本凭证。未知登记保留待核对对象；只有明确未转发的本次夹具可限定回收。该原套件的Auth／产品页面和物理Storage组合仍未执行，PG和受控Chrome证据单独记录；独立学习套件的附件岗位范围见上方订单数据流。
- [写入失败测试维护](docs/onboarding/reference/verification-2026-11-05-wholesale-order-core.md#2026-11-10原写入失败作用域)说明九类失败请求、明确读取白名单和逐表/xmin不变核对。旧别名PATCH已对齐当前原子接口；未声明写入直接拒绝，结束先排空再查库，不用错误提示代替“没有写入”的证据。
- [分批美元结汇测试](docs/onboarding/reference/verification-2026-11-05-wholesale-order-core.md#2026-11-10原分批美元结汇)保留原300USD/100+200场景，说明逐笔舍入、加权价、双点击/本笔响应等待，以及订单、客户、报价的版本保护清理。实际PG与受控Chrome单独留证，原Auth/产品页面及真实银行仍未验收。
- [数据库授权与订单编辑历史](../PT5-dropshipping-supabase/docs/onboarding/order-edit-privilege-history.md)，区分表、函数、行级权限及新函数默认授权。
- [媒体与文档的对象凭证](../PT5-dropshipping-supabase/docs/onboarding/storage-object-receipts.md)，解释同名目录、真实文件、分页与删除终态。
- [物流历史与当前入口](../PT5-dropshipping-supabase/docs/onboarding/logistics-link-history.md)，区分旧关联模型和当前永久归档，附隔离核对步骤。
- [永久归档的店铺区间和同步租约](../PT5-dropshipping-supabase/docs/onboarding/logistics-archive-history.md)，按原迁移分段阅读，核对真实记录及失败恢复。
- [采购认领与日期查询历史](../PT5-dropshipping-supabase/docs/onboarding/claims-and-date-history.md)，说明退出时删除的专用数据、保留业务和 AI 额度，附上海日界及权限核对。
- [编号分页与权限](../PT5-dropshipping-supabase/docs/onboarding/order-page-policy-performance-history.md)，从订单、物流、邮件到完整人员审计，区分当前页与完整统计。
- [物流观测、断点与续跑](../PT5-dropshipping-supabase/docs/onboarding/logistics-archive-history.md)，区分内容变化、成功检查、已提交页和任务失败预算。
- [物流性能模型实操](../PT5-dropshipping-supabase/docs/onboarding/logistics-performance.md)，在无网络PG17核对24次真实写入及观测夹具，分清索引成本与完整页面性能验收。
- [完整物流分页性能](../PT5-dropshipping-supabase/docs/onboarding/logistics-page-performance.md)，在历史模型核对500比较、948全页、168计时及旧/缺索引计划拒绝，真实页面与来源另外验收。
- [独立物流归属与回滚](../PT5-dropshipping-supabase/docs/onboarding/logistics-independent-rollback.md)，以原始关联验证三组分页、本人目录与批准旧函数/权限，直接构造当前模型。
- [物流Worker丢回执与续跑](../PT5-dropshipping-supabase/docs/onboarding/logistics-worker-model.md)，运行真实同步代码，在明确模拟来源的空PG17核对三页1200条、观测、检查点与事务恢复。
- [物流页面来源夹具](docs/onboarding/explanation/logistics-source-fixture.md)，说明专属API/Edge准入、数据库内私有备份、精确回收与来源服务收尾；原页面认证套件另验。
- [Docker完整结构分页](../PT5-dropshipping-supabase/docs/onboarding/logistics-docker-page.md)，使用专属副本的真实数据库权限，核对700行、完整JSON和回退指纹，原Worker仍单列。
- [历史报价、发布防重与分配](../PT5-dropshipping-supabase/docs/onboarding/rate-publication-allocation-history.md)，解释修订号、结汇凭证及撤销历史，区分旧参考价与当前银行报价。
- [库存订单、商品与信贷](../PT5-dropshipping-supabase/docs/onboarding/inventory-order-credit-history.md)，按业务分段追踪商品必填、修订号、后台启用与还款凭证。
- [业务入口与订单维护演进](../PT5-dropshipping-supabase/docs/onboarding/workspace-order-lifecycle-history.md)，分清可配置岗位、旅游停用、直接改单和新建请求防重。

线索后台维护工具的来源、三次恢复及私有备份回收见[后端环境说明](../PT5-dropshipping-supabase/docs/onboarding/environment.md#线索同步cli的来源与回收)。只运行专属可重建实例；原CLI按数据库到期主动发出HTTP，原认证页面和真实供应商分别验收。

线索的[自动调度验收](docs/onboarding/reference/verification-2026-11-11-auto-dispatch.md)另补齐原小时触发、暂停后恢复、分钟派发及真实pg_net／Docker Edge终态。最早重试间隔与实际分钟触发时间分开理解；共享项目计划任务继续暂停，原Web手动页面、真实来源和其他任务分别验收。

工作台入口矩阵与信息层级的维护见[界面测试说明](docs/onboarding/explanation/workspace-ui-tests.md#跨页面入口与信息层级)：先核验专属项目，物流自动来源使用明确失败替身，布局助手等待可见目标，原认证页面仍需独立验收。

固定资料测试的恢复应只匹配本次写入值，并核对影响行数与独立读回；原页面、SDK替身和PG字段模型的边界见[资料回执测试](docs/onboarding/explanation/profile-data-flow.md#原资料回执测试怎样维护)。[原媒体回执测试](docs/onboarding/explanation/user-media-receipt-tests.md)说明UUID文件意图、对象SHA/版本、媒体和评估完整行、local会话撤销及分阶段回收；20专项与真实SDK/Chrome协议分层记录，原Auth产品页面另验。

原响应式综合场景的头像颜色转换、卡片加载前置和8个页面场景的范围见[视觉测试维护](docs/onboarding/explanation/design-system-tests.md#原响应式综合场景)。

原测试的SQL准备/清理及费用助手现在共用专属目标检查；需要显式声明项目、API和暂停状态，原固定账号套件仍需各自验收。见[SQL辅助选择](docs/onboarding/explanation/test-controls-and-local-sql.md#准备与清理sql的专属目标)。

运营报销共享测试按场景独占209条UUID数据，批量确认核对205条完整终态，收尾按原行版本精确回收；维护入口与实际数据库/Chrome辅助验证范围见[共享报销测试](docs/onboarding/explanation/operator-reimbursement-tests.md#共享分页和历史时间场景)。原登录、产品页面和响应式验收单独记录。

公司模板原综合测试按访问、预览、发布和拒绝/故障维护，入口保留原18场景及顺序。UUID名称支持编号未读回时限定清理，固定版本哈希故障按完整行/xmin核对注入和恢复；见[发布与预览测试](docs/onboarding/explanation/company-template-publication-tests.md)，实际PG/Chrome辅助证据与原Auth产品页面未执行范围分别记录。

中行综合测试使用专属本地项目和模拟报价来源。准备、XTS 手工报价、按编号追踪后台任务、单订单核算和按版本回收见[中行测试维护](docs/onboarding/explanation/exchange-rate-boc-tests.md)。已完成该测试入口的源码审查和隔离 PostgreSQL 定向验证。原认证页面套件及真实中行核对仍待验收。

结汇缺价场景按本次收款编号追踪派发、精确日末报价和分配终态。专属环境及数据回收见[结汇补价测试维护](docs/onboarding/explanation/wholesale-settlement-release-flow.md#跟踪缺汇率后的补价)。

批发结汇综合测试使用专属客户、两张订单和本地手工汇率，逐笔核对分配、整组调整及冲销。夹具与终态预期见[多订单分配测试维护](docs/onboarding/explanation/wholesale-settlement-release-flow.md#验证两张订单的分配和冲销)。

## 本地运行

需要同级 PT5-dropshipping-supabase 仓库、Node.js 24、package.json 声明的 npm 版本和 Docker Desktop。先按[启动手册](docs/onboarding/how-to/local-development.md)准备本地后台与 .env.local，确认没有同项目已有开发服务器，再执行：

```powershell
npm ci
npm run doctor
npm run dev -- --hostname localhost
```

默认入口是 `http://localhost:3000/login`。doctor 在 Web 尚未启动时会报告该项失败，启动后重新运行。本机密钥与种子账号不写入文档或提交。

当前本机 API 为 `http://127.0.0.1:48021`，与同级后端配置一致。Windows 端口受保留范围影响时见[本地 API 排查](../PT5-dropshipping-supabase/docs/onboarding/local-api-port.md)；doctor 只读检查，不自动改端口或重置数据。

原固定账号套件的种子恢复只能在[专属隔离数据库](../PT5-dropshipping-supabase/docs/onboarding/environment.md#恢复固定测试种子)执行。

## 常用检查

```powershell
npm run lint
npm run typecheck
npm run check:i18n
npm run check:dashboard-ui
npm run check:operation-contracts
npm run check:learning
npm run check:edge
npm run test:learning
npm run build
```

新增或移动源码后运行 npm run learning:refresh，评审两仓库生成的模块归属与文档，再运行学习检查。只读检查不会自动修复或重置环境。

[本地验收清单](docs/onboarding/reference/verification-2026-11-11-current-candidate.md)记录应用生产构建、两仓库可执行回归、服务检查和仍待验收的原测试入口。

运行 `node scripts/audit-real-e2e-prerequisites.mjs` 可查看历史测试集合、当前入口增删改名及准备条件变化。该命令检查静态导入，所有测试执行结果仍以各自运行证据为准。[测试验证手册](docs/onboarding/how-to/verification.md)

整理本地浏览器产物前可运行 `npm run clean:artifacts -- --dry-run` 查看将移动或删除的路径。预演保持文件和目录原样，归档保留已有的同名证据。[验证与清理](docs/onboarding/how-to/verification.md)

浏览器截图归属当前测试和重试，整轮运行还须指定新的 `--output` 目录，避免下一轮清空旧证据。原认证套件的访问准入与独立截图路径探针分别记录，详见[界面测试的截图保留](docs/onboarding/explanation/workspace-ui-tests.md#截图怎样保留每轮证据)。

原页面测试的独立数据库查询须显式声明可重建专属实例，校验本地API与数据库属于同一项目，并在只读事务中核对记录；不会从认证环境助手读取配置或使用固定共享容器。环境变量、限制和月份筛选示例见[原测试的本地SQL说明](docs/onboarding/explanation/test-controls-and-local-sql.md#独立读取的专属目标与只读事务)。原认证入口的访问限制仍有效。

独立[认证迟到响应验证](docs/onboarding/reference/verification-2026-11-11-session-late-browser.md)覆盖中英文桌面／手机的退出和跨标签账号切换。学习登录助手读取页面实际语言的公告按钮并等待关闭；响应取消、旧权限实际送达与刷新后的身份分别核对。

本机改密可运行 `npm run test:learning:browser -- auth-password-maintenance`，只允许本项目 Mailpit 和专属账号。账号页发信、真实恢复表单、数据库行版本及全新窗口的新旧密码登录联合核对；本机模板、故障注入和验收范围见[改密维护记录](docs/onboarding/reference/verification-2026-11-11-password-maintenance.md)。页面提示结果未确认时，先用无痕窗口核对新密码。

逐文件职责审查另见[审查台账说明](docs/onboarding/how-to/source-review.md)。`npm run check:learning:complete` 要求每份源码完成有效审查；默认学习检查会显示真实待审数量。`check:edge` 使用固定 Deno 版本检查后台真实入口，首次运行需要下载工具和依赖，不启动后台服务。

新增关键写入时，在操作契约登记唯一编号、完成凭证和实际调用文件。纯后台任务登记 Edge 入口。[操作清单与验证](docs/onboarding/how-to/verification.md)

依赖安全检查执行`npm run test:security-dependencies`，当前9项包含minimatch锁文件防回退、真实调用方接口及受限模式展开；另分别运行`npm audit --json --ignore-scripts`和`npm audit --omit=dev --json --ignore-scripts`。CVE-2026-118764的现行范围排除3.x，本地11.0.1修补与托管平台重扫分开记录。[告警与验证说明](docs/onboarding/reference/verification-2026-11-06-admin-cli-and-security-tests.md#2026-11-10minimatch告警核对与防回退)

资料库的故障恢复覆盖[递归删除中断与撤权](docs/onboarding/reference/verification-2026-11-11-document-terminal.md)，以及[复制和移动的权限、部分失败与真实超时](docs/onboarding/reference/verification-2026-11-11-document-copy-boundaries.md)。关键操作从中英文桌面／手机页面发起，按原批次核对数据库与实际对象。维护入口见[分阶段调用链](docs/onboarding/explanation/document-library-flow.md)。

订单评估的[中断恢复验证](docs/onboarding/reference/verification-2026-11-11-assessment-interruption.md)包含中英文桌面／手机主动关闭、真实进程终止、原期限到期处理和重启后再次生成。后续[自然定时到期](docs/onboarding/reference/verification-2026-11-11-assessment-automatic.md)在专属实例启用原一分钟规则，实际等待原期限并核对cron、尝试、运行及告警；主项目计划任务继续暂停。

汇率专项随`npm run test:learning`执行，单独运行可使用`node --test scripts/learning/exchange-rate-local-source.test.mjs scripts/learning/exchange-rate-sync-cli.test.mjs`。原后端CLI另已核对实际本地Auth/网关/Edge/SQL、完整重试及限定清理，外部报价为本地模拟；真实银行、原Web认证页面仍待验收。[范围与维护入口](docs/onboarding/reference/verification-2026-11-11-rate-cli.md)

汇率重算的数据库学习入口见[三组SQL实操](../PT5-dropshipping-supabase/docs/onboarding/exchange-rate-sql-tests.md#在隔离副本练习汇率重算)。使用空结构专属副本、最小合成样本和显式会话标记；实际重算、岗位拒绝、最终回滚分别核对，合成核验不算真实中行凭证。

库存订单和信贷数据库测试已按原顺序拆成四组，见[库存SQL维护](../PT5-dropshipping-supabase/docs/onboarding/inventory-sql-tests.md)。新增写前样本/会话检查，父文件须由psql按文件包含；员工独立场景与暂缓的客户归属、完整套件分别记录。

库存订单浏览器测试按角色和流程拆分。维护页面用例、精确订单凭证和夹具清理时，从[库存订单数据流](docs/onboarding/explanation/customer-inventory-flow.md#维护库存浏览器用例)进入，那里也记录了可单独运行的夹具检查和原套件执行状态。

原模板草稿页面测试已按生命周期、目录、转正和恢复拆组，使用专属自动准入、限定故障/清理及测试独占证据路径。[维护与范围](docs/onboarding/explanation/template-draft-tests.md)区分11项离线风险测试、实际数据库凭证和仍未执行的原Auth/页面套件。

原运营报销测试改用单worker的本次UUID夹具：周期有旧记录就拒绝，报销和清理均核对真实编号/版本，凭证写入独占附件。[维护入口](docs/onboarding/explanation/operator-reimbursement-tests.md)区分12项专项、正式数据库函数与尚未执行的原四页面。

认证维护可从[会话读取链路](docs/onboarding/explanation/auth-read-paths.md)查找浏览器缓存、服务端权限和登录恢复。会话迟到结果用例随 `npm run test:learning` 执行。

普通订单与批发订单走不同入口。旅游的停用守卫、普通订单保留源码和独立验证入口见[普通订单与停用边界](docs/onboarding/explanation/tourism-orders-flow.md)。

保留的旅游团队、人员和客户查询见[旅游团队与人员目录](docs/onboarding/explanation/tourism-collaboration-flow.md)。
旅游任务看板的筛选、类型维护、改派、领取、提审、审核与附件清理见[旅游任务数据流](docs/onboarding/explanation/tourism-task-flow.md)。
历史订单与任务佣金的回执、原表读回和本地权限见[历史佣金怎么结算](docs/onboarding/explanation/tourism-task-flow.md#历史佣金怎么结算)。
维护历史看板时，可按[字段、筛选与团队标签](docs/onboarding/explanation/tourism-task-flow.md#修改历史看板的字段筛选或团队标签)定位数据和展示代码。

后台任务的运行编号、终态与 Storage 凭证见[操作凭证与运行账本](docs/onboarding/explanation/operation-run-flow.md)。

普通订单的终端维护使用 `npm run supabase:admin -- summary`、`table`、`order` 和 `updateStatus`，连接取自显式进程变量、.env.local、.env。状态更新须命中真实订单并独立读回，未核对时以非零状态退出并提示重新查询。[命令结构与验证](docs/onboarding/reference/verification-2026-11-06-admin-cli-and-security-tests.md)

合同测试的固定期望、边界反例和受控浏览器文档见[断言检查指南](docs/onboarding/reference/verification-2026-11-06-wholesale-scope-contracts.md)。维护辅助检查时运行对应 `npm run test:contracts -- <文件名>`，再按业务用例核对真实页面。

原账号切换用例的职责拆分、回滚资料和原套件执行前提见[原 E2E 源码审查](docs/onboarding/reference/verification-2026-11-06-classification-access-e2e-review.md)。实际角色登录和管理员操作继续按原套件准入记录执行。

原文档锁进程、日期输入与首页持久化的辅助代码见[测试辅助模块阅读入口](docs/onboarding/reference/verification-2026-11-06-finance-logistics-helpers.md#测试辅助模块阅读入口)。锁进程的有界等待、分块消息和失败收尾随 npm run test:learning 验证，真实锁与原认证套件的前提单独保留。

文档锁现在只接受完整专属项目：显式设置 `PT5_E2E_FIXTURE_MODE=disposable`、`PLAYWRIGHT_BASE_URL`、`NEXT_PUBLIC_SUPABASE_URL`、`PT5_E2E_DATABASE_PROJECT` 和 `PT5_E2E_DATABASE_CONTAINER`。项目名须以 `pt5-e2e-` 或 `pt5-learning-` 开头，容器为 `supabase_db_<项目名>`；程序核对数据库/网关标签、API端口、共同网络以及暂停调度后才取锁。当前共享项目不满足该条件；完整正向环境仍待验收。[锁与清理边界](docs/onboarding/explanation/test-controls-and-local-sql.md#文档写锁的专属项目)。

文档用例的页面步骤、文件凭证、批次身份和限定回收见[文档测试夹具](docs/onboarding/explanation/document-test-fixtures.md)。独立清理测试随 npm run test:learning 执行，失败、零影响和残留记录均不能记作回收成功。

后端物流与后台SQL维护命令使用单独的无网络tmpfs副本，显式声明项目和容器后才能执行；准备、回收及原超时校验示例见[后端SQL维护目标](../PT5-dropshipping-supabase/docs/onboarding/environment.md#sql维护命令的专属目标)。该SQL副本与需要Web/Auth/Storage的完整端到端隔离项目分别准备。

孤立附件登记的精确可见性与数据库治理检查见[专属SQL步骤](../PT5-dropshipping-supabase/docs/onboarding/attachment-visibility-sql.md)。同名其他对象不能替代本次ID/路径，SQL对象登记恢复与Storage实际文件删除分别核对。

导航偏好与模板发布的原SQL及真实指纹夹具见[后端维护指南](../PT5-dropshipping-supabase/docs/onboarding/navigation-template-sql.md)。SQL逐次读取本人记录、版本、指针和修订，实际页面、Auth、断线与并发仍按各模块验收。

物流四历史的局部重建用`node scripts/verify-logistics-migrations.mjs`在后端执行，需另备最小固定夹具；每套SQL保存点及演练结束后均核对恢复。步骤、授权/日期夹具及范围见[历史迁移事务演练](../PT5-dropshipping-supabase/docs/onboarding/logistics-archive-history.md#四份历史迁移的事务演练)。

后台运行的状态机、结汇补价和目录权限用后端`node scripts/verify-operation-regressions.mjs`分别验证；固定角色与任务配置仅放专属副本，步骤及凭证见[当前后台SQL回归](../PT5-dropshipping-supabase/docs/onboarding/operation-reimbursement-history.md#当前三套sql的专属回归入口)。

本地过期清理脚本 `scripts/document-cleanup-local.mjs` 会领取整个实例的过期项，仅用于实际可重建的专属项目。它与文档锁、故障SQL共用上述五项显式配置和真实项目/端口/网络/调度预检，服务密钥另由专属进程配置提供；不读取共享 `.env.local` 或借用共享项目端口。它不按当前测试前缀收窄领取范围，不能在共享库试跑。失败或部分失败仍输出结果JSON并非零退出，调用方应同时检查终态和退出码。[执行边界与凭证](docs/onboarding/explanation/document-test-fixtures.md#本地清理入口与原文档用例)
公司模板的页面、上传载荷、模板版本计数，以及正文/草稿/操作回执的测试清理，见同指南的[公司模板入口](docs/onboarding/explanation/document-test-fixtures.md#公司模板正文和操作回执)。打印设置、数据超限与串行保存分开维护，原套件准入条件继续适用。

普通HTML及原报价单测试的证据按文档UUID保存为`output/generic-template-saving-<文档编号>-evidence.json`或`output/raw-quotation-saving-<文档编号>-evidence.json`，同名文件不会覆盖。清理助手的17项错误/影响数/归属检查可独立运行`node --experimental-strip-types --test scripts/learning/company-template-records.test.mjs`；这不代表原认证E2E已运行。
目录旅程、岗位边界和响应丢失恢复各有独立用例；多个资源顺序清理并保留全部失败。下拉框、折叠筛选、闭包模板和本地 SQL 工具见[原测试辅助维护](docs/onboarding/explanation/test-controls-and-local-sql.md)，全局参数用例仍要求可重建的隔离完整实例。

邮件原场景按草稿、权限、发信、发件设置、隔离、收件和工作区操作拆分；阅读路线、自动夹具与模拟服务边界见[邮件测试维护](docs/onboarding/explanation/mail-test-boundaries.md)。纯模拟检查随 npm run test:learning 运行，原套件执行仍需可重建完整隔离实例及原入口准入。

[邮件工作区原SQL](../PT5-dropshipping-supabase/docs/onboarding/mail-workspace-sql.md)按规则/会话/收件职责相对包含，复制核对四文件后用psql文件模式执行。后台实际使用服务角色，规则审计、真实负责人/版本及收件领取凭证独立核对；该数据库副本不执行真实Auth或供应商发送。

公司邮箱/飞书授权及整表保存故障还要求专属数据库项目与容器声明；实际核对网关/API映射、数据库共同网络及调度/队列状态后才准备夹具。故障 SQL 使用该专属目标并事务核对装卸；查询错误、空版本和零影响不能算成功。环境变量、调用链和未执行范围见上述邮件测试维护中的授权用例说明。

固定邮件数据的连接、十九表清理、邮箱、人员和会话准备见[邮件数据夹具](docs/onboarding/explanation/mail-fixture-data.md)。直接调用同样要求显式 disposable 模式及 Web／Supabase 本地地址；插入、清理各自独立核对，纯 SDK 传输检查不计为原端到端通过。

工作台外壳、搜索、导航、日期、分页和动效的原用例阅读路线见[界面测试维护](docs/onboarding/explanation/workspace-ui-tests.md)。分页需实际完整隔离实例，动效按认证页和工作台分开；日期 data-value 不是最终表单提交凭证。

`npm run learning:refresh` 同时生成逐文件审查覆盖表，只有摘要和职责记录有效才计为已审；`npm run check:learning` 会拒绝旧覆盖表。人工批准仍需逐文件填写，刷新不会批准源码。

参数版本、费用和客户准入的原用例按[场景、数据与夹具阅读顺序](docs/onboarding/reference/verification-2026-11-06-parameter-expense-test-review.md)维护。全局参数恢复仅在可重建的隔离实例执行；上海日历边界随 npm run test:learning 检查。

批发费用的[原页面编排与收尾](docs/onboarding/reference/verification-2026-11-06-parameter-expense-test-review.md#2026-11-10原费用页面编排与收尾)说明六场景、原请求登记、专属历史/只读客户订单、截图归属与路由排空。[参数夹具版本保护](docs/onboarding/reference/verification-2026-11-06-parameter-expense-test-review.md#2026-11-10费用参数夹具的版本保护)及[客户与订单图回收](docs/onboarding/reference/verification-2026-11-06-parameter-expense-test-review.md#2026-11-10费用客户与订单图的限定回收)使用完整版本和限定清理，不回退订单编号。源码审查与专属数据库/受控浏览器已分别留证，原Auth及实际页面验收尚未执行。

[订单原请求与初始凭证](docs/onboarding/reference/verification-2026-11-06-parameter-expense-test-review.md#2026-11-10订单原请求与初始凭证)补齐创建前登记、完整父子图/参数核对和丢回执回收，区分当前新客户与专属历史客户样本；结汇/改单终态见下方状态模块。

[结汇与改单的预登记状态](docs/onboarding/reference/verification-2026-11-06-parameter-expense-test-review.md#2026-11-10结汇与改单的预登记状态)先核对完整终态再回收；[提成临时故障恢复](docs/onboarding/reference/verification-2026-11-06-parameter-expense-test-review.md#2026-11-10提成临时故障与精确恢复)保留正文/恢复全部错误，陌生字段或同值新版本拒绝覆盖。上述助手已接入原费用场景；实际Auth页面与完整回归结果单独记录。

`npm run test:learning:browser` 使用专属账号验证中英文首页布局和待办、服务说明页、个人资料保存与审核、邀请链接读取恢复，以及不提交账号的注册进度。媒体用例执行真实上传、响应丢失重试、人工审核、预览恢复和删除，并独立核对数据库、文件哈希与 Storage；它要求本地 Edge 服务运行，图片供应商设为 `disabled`。覆盖双语和响应式排版，清理自有夹具；需先按验证手册确认本地写入前提。

维护批发功能可按链路定向复跑。建单、附件、直接结汇和本地模拟订单评估的用例见[订单数据流](docs/onboarding/explanation/wholesale-order-flow.md)。人员目录、客户档案的八岗位权限、独立开通批发业务、删除保护、账号合并、并发编辑和推荐关系用例见[批发目录指南](docs/onboarding/explanation/wholesale-people-flow.md)。

VIP的栏目入口、数据库目录和开通续期权限分别定位，见[VIP数据流](docs/onboarding/explanation/business-vip-flow.md)。`npm run test:learning:browser -- wholesale-vip-access`使用专属账号核对八岗位、中英文桌面手机、真实会员／收费编号及刷新；所有收费记录仅属于本地夹具。

客户资料上传与档案删除的并发检查使用 `npm run test:learning:browser -- wholesale-customer-document-upload-race`。它通过两个页面提交真实本地请求，核对文件登记、实际 Storage 字节及删除后的结果。

工作台助手的断流、重复提交和配额释放验证见[助手请求与运行凭证](docs/onboarding/explanation/assistant-chat-flow.md)。流协议可单独运行 `npm run test:assistant-stream`，浏览器验收使用本地模拟供应商和专属账号。

助手结汇的三组用例按收款编号和原请求号独立核对，取消、权限拒绝和歧义提示须保留原任务与配额。专属项目、临时配置探针和回收见[助手结汇测试维护](docs/onboarding/explanation/assistant-chat-flow.md#结汇指令)。

账号页使用 `npm run test:learning:browser -- admin-account-receipts person-private-note` 验证账号调整、Auth 恢复及私有备注。维护入口见[账号管理与私有备注](docs/onboarding/explanation/account-and-private-note-flow.md)。

人工汇率使用 `npm run test:learning:browser -- exchange-rate-manual` 验证录入、改价、错误回执与删除。同步回执使用 `npm run test:learning:browser -- exchange-rate-sync-receipt`，模拟函数响应并独立读取本地报价。日期、权限和后台入口见[汇率报价与同步链路](docs/onboarding/explanation/exchange-rate-flow.md)。

[原历史页面与报价夹具](docs/onboarding/reference/verification-2026-11-06-exchange-rate-sync-receipts.md#2026-11-10原历史页面与报价夹具)说明专属报价、无供应商凭据的本地失败边界、完整版本/引用保护清理及原异步清理合同。七项专项随`npm run test:learning`执行；queued与单次partial_failed分开核对，原Auth/真实页面和银行验收单独记录。

资料上传恢复用 `npm run test:document-upload-recovery` 复现服务内部丢回执。上传重送、权限撤回、批量操作断线及预览与下载的浏览器命令见[资料库数据流](docs/onboarding/explanation/document-library-flow.md)。

多层复制可用 `npm run test:learning:browser -- document-library-batch-interruption --grep 多层目录复制` 定向验收中英文和桌面/手机。用例从页面上传三层文件并复制整树，独立核对模板内容、目录父链、文件哈希和刷新结果；记录见[多层复制验收](docs/onboarding/reference/verification-2026-11-05-document-batches.md#2026-11-09-多层目录复制补充)。

递归删除用 `npm run test:learning:browser -- document-library-batch-interruption --grep 递归删除` 验证11项清单请求间中断或伪成功后的原批次续办。删除终态和夹具清理以完整Storage列表确认对象消失，普通请求错误及旧成功回执均不足以证明删除；范围与结果见[删除验收](docs/onboarding/reference/verification-2026-11-05-document-batches.md#2026-11-09-递归删除与对象缺失凭证)。

公司模板发布与断线重试、草稿转正、正式保存和另存为的维护入口与本地验收命令见[公司模板与文档生命周期](docs/onboarding/explanation/template-document-lifecycle.md)。另存为时可重试目录查询并保留已输入的名称。

库存订单、商品和专属信贷见[库存订单数据流](docs/onboarding/explanation/customer-inventory-flow.md)，内有附件登记丢响应和原路径核对的本地浏览器命令。

[物流数据流](docs/onboarding/explanation/wholesale-logistics-flow.md)列出主库分页、店铺归属区间与后台断点恢复的入口和验证命令。[原页面测试维护](docs/onboarding/explanation/logistics-page-tests.md)说明独占店铺的完整版本、两表回收、额外角色页面收尾和同步隔离；原Auth产品页面另行验收。

[结汇收款数据流](docs/onboarding/explanation/wholesale-settlement-release-flow.md)区分收款发布、订单分配、清空核对和两项月度统计，也列出发布断线后按原编号核对与重试的定向测试。

[批发提成与佣金链路](docs/onboarding/explanation/wholesale-commission-flow.md)列出两个标签的权限、数据库入口、提成结算回执和缺少报价时的页面反馈。[原合并页测试维护](docs/onboarding/explanation/commission-merge-tests.md)说明专属订单、完整行版本、函数故障恢复和限定清理；12专项/真实PG证据与原Auth页面分开记录。

[批发业务参数链路](docs/onboarding/explanation/business-parameter-flow.md)说明百分数输入、发布与预约、规则版本及订单引用，并区分共享项目页面检查和隔离库写入。

[公司费用与运营报销链路](docs/onboarding/explanation/expenses-flow.md)区分两套权限、数据表和核对方式，列出新增断线恢复及运营周期确认的定向测试。

[审核中心链路](docs/onboarding/explanation/review-center-flow.md)说明三类待审记录、媒体预览权限及审核结果的核对方式。
隐私申请与媒体审核的权限修复及回归见[提交与审核权限验证](docs/onboarding/reference/verification-2026-11-06-review-submission-boundaries.md)。

后台图片认领及旅游停用时的历史读取，按后端[审核SQL维护](../PT5-dropshipping-supabase/docs/onboarding/review-sql-tests.md)准备非空专属夹具、执行真实数据库角色并逐套核对恢复。SQL通过不代表页面、Auth、Storage或真实AI通过。

[公告模块](docs/onboarding/modules/announcements.md)说明管理员维护、工作台已读回执和登录页公开公告的权限与验证入口。

[邮件会话链路](docs/onboarding/explanation/mail-thread-flow.md)列出邮箱工作台入口、负责人权限、已读位置、回复建议和转交的本地验收方法。转交后，旧负责人已打开的会话会在页面确认权限变化时收起。
同一指南也列出发件人设置、公司邮箱授权、飞书回跳、Gmail 收发和收件隔离的服务端入口。
公司邮箱授权已有当前候选的 8 个专属本地页面场景，包含独立数据库凭证、重复回调、事务失败及回程中断。[授权链验证](docs/onboarding/reference/verification-2026-11-11-mail-oauth-browser.md)
收件回补和 Watch 续订可用 `npm run test:mail-inbound-recovery` 在本机复现。
推送身份用 `npm run test:mail-google-push` 核对本机证书与真实官方验签。入站岗位边界随 `npm run test:mail-intake` 执行，路由和负责人选择器共用在职业务员目录。[推送与岗位验证](docs/onboarding/reference/verification-2026-11-11-google-push.md)
Watch 已另用真实凭据刷新、HTTP 和专属 Docker 数据库核对，包含旧收件游标保留及失败恢复。[续订接线证据](docs/onboarding/reference/verification-2026-11-11-mail-watch.md)
收件 worker 使用后端的收件事件结算迁移。两个仓库按本地启动步骤更新后，再运行邮件后台验证。

完整 npm run test:regression 包含真实本地业务写入，必须先满足[验证前提](docs/onboarding/how-to/verification.md)。历史测试结果、受控合同、真实本地与第三方验收分别记录。

## 维护参考

- [完整配置、业务规则与运行手册](docs/reference/maintenance-handbook.md)：原 README 详细内容归入可查阅参考。
- [后端学习入口](../PT5-dropshipping-supabase/docs/onboarding/README.md)。
- [物流回滚维护](../PT5-dropshipping-supabase/docs/onboarding/logistics-archive-history.md#回滚资料怎样维护)：后端的`node scripts/verify-logistics-rollback.mjs`只在自动创建的隔离副本执行原SQL，核对停工保护及失败后的完整恢复。
- [本次改造与验证记录](docs/onboarding/implementation-report.md)。

网页文案放中英文消息；页面只组装与调度，领域逻辑放独立模块。保持现有职责和行数检查。Web、Supabase Cloud、GitHub 与网站部署是独立结果，未经请求不自动上传或部署。
