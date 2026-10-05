# 真实 E2E：逐项阻塞与最小人工准备

本轮基线 Web `db8626f41eaa8314923f7b01c4cecdb96b5b0682`、Supabase `fc210bb9340d8f89eadfcd5a29e043e0fabc3cc8`。以下 57 项是原 86 个文件中未执行的文件；另列原始三个失败。没有用重跑次数增加覆盖，也没有恢复旧 39 个通过用例缺失的完整日志。

## 当前可直接执行的范围

可以读取允许的测试源码、检查导入图和数据前提、修正测试断言/持久化检查、制定性能测量方案。不能执行原始认证套件：57 个入口均会到达已拒绝的账号辅助文件；其中管理员辅助文件的数量由本轮静态审计日志核对。静态读取测试源码不等于访问实际凭据，也不等于获准执行管理员操作。

当前观察到本地 3000/3001 没有监听，54321/54322 有监听；后者只证明端口，未证明健康、数据库隔离、cron 暂停或空请求队列。浏览器已有 PT5 标签是线上地址，没有本地已登录页。本轮没有打开线上业务正文或将线上会话用于测试。

## 能力与人工准备编号

- **H：原始认证入口受限。** 所需能力是正式允许现有账号辅助入口的读取/执行，而不是再发一次相同聊天授权。当前任务停在导入前，不重试拒绝、不注入会话、不替换辅助文件。你可以先完成 M1/M2，让后续直接页面验收具备条件；这仍不自动解除原始套件限制，也不算原始用例通过。
- **A：独立管理员/数据库入口受限。** 所需能力是读取本地测试最终凭证的正式准入，以及限定在专用本地夹具上的管理员操作范围。不要把“能读源码”当成能读实际凭据。先准备 M3/M4，受限入口仍停在执行前。
- **M1：单一、安全的本地服务。** 在原 Web 仓库运行且只运行一个 Next 服务；确认应用/Auth/数据库实际指向同一专用本地 Docker 环境，后台 cron 已持久暂停、外部 HTTP 队列为空、外部同步/通知不会自动出网。已有服务则复用。给出本地 URL、仓库 SHA、服务/隔离检查结果，不提供密钥值。端口或 `disposable` 声明不能替代隔离证明。
- **M2：本地测试角色会话。** 你亲自在 Chrome 打开本地 `/login`，用专用可重置测试角色登录。先准备管理员：首页/账号页与物流；随后再准备财务、业务员及表中其他角色。不要在聊天中提供密码、cookie、访问令牌或 storageState。已有正式受限套件仍不能用这个会话替换入口执行；直接页面验收单独记账。
- **M3：本地服务端能力。** 你在本机私下配置本地 `SUPABASE_SERVICE_ROLE_KEY` 等原运行入口需要的配置；不得使用云端密钥。优先确认 `/admin/accounts` 的“账号管理”和“搜索账号”在首次打开及刷新后可用且没有错误页面。仅反馈配置存在/校验结果、角色及本地 URL。独立核对需经正式允许的本地只读入口或人工保存脱敏数据库凭证；不要给本任务导出凭据。
- **M4：归属明确的可丢弃夹具。** 准备表中指定对象、唯一运行标识、操作前快照、限定清理范围和独立最终凭证读回。涉及固定种子 ID 或全局参数时必须使用实际隔离的整套 API/Auth/数据库，不在共享实例上重置。仅准备空 SQL 数据库不满足浏览器写链路隔离。人工初始化仍按现有迁移/种子规范完成，不由本轮修改业务数据或规则。
- **M5：业务预期与真实报价。** 确认库存固定 200、终身资格、奖励档位等尚未决定的规则；资金回归提供已接受的参数版本、报价编号/发布时间及独立预期。中行完整重算必须先有真实官方报价核对凭证；不得制造核对记录。无需在聊天中提供提供商密钥。
- **M6：本地提供商边界。** 邮件/AI/OAuth/来源服务必须有明确本地边界、专用任务配置和全部写出口隔离；真实本地应用/数据库加模拟外部边界是混合集成测试，不能记为真实 Gmail/飞书/AI/来源服务 E2E。真实第三方验证单独等待授权与环境，本轮不执行。
- **M7：浏览器与可重复基线。** 使用仓库 chromium 项目/已安装 Windows Chrome，保留已批准 PNG 基线；固定语言、时间区间、视口和夹具。不能更新截图来掩盖差异。

最小优先准备只有：M1 安全本地实例和单一 Web 服务；M2 专用管理员手动登录；M3 本地管理员配置及正式允许的独立只读能力；M4 一份首页原布局和独立 55 行物流清单。财务/业务员会话随后补齐。钱财、邮件等其他准备不阻止先验收这三个优先页面流程。H/A 的限制本任务不自行解除、不反复索要同样授权。

### 最小准备的交付内容

1. 提供不含凭据的本地 URL 和实例标识、两个仓库 SHA、实际应用迁移列表；在本机确认 cron 持久暂停且外部 HTTP 队列为 0。原测试的一些直接 SQL 入口硬编码默认 Docker 容器和人员 ID，因此应用、Auth、管理员读回和直接 SQL 必须确实落在同一个专用可丢弃实例；只换 URL/容器名称不能证明隔离。
2. 你在本机私下配置本地服务参数，然后在确认无现有服务时从原 Web 仓库启动一个 `npm run dev -- --hostname localhost`；已有服务就复用。提供实际监听地址。自己登录本地测试管理员并保留 Chrome 标签，只反馈本地标签和角色；不要导出 cookie/storageState 或在聊天中提供密钥。
3. 为首页保留专用账号的原布局（安全字段 user_id、scope、updated_at、widgets），明确该账号布局允许重置。为真实写验证准备经正式允许的独立本地只读最终凭证能力；仅页面保存提示和刷新检查不足以证明数据库写入。如果该能力仍受限，就保留未验证。
4. 准备 `Local Paging Shop` 正好 55 条自有档案：稳定 UUID、唯一包裹编号、有效排序时间。日期须落在真实页面当前默认的上海最近 30 天范围内，否则原例会筛掉记录；也可以在正式允许的测试改动中显式选择已知日期范围后再跑。清单由独立准备步骤生成，保存为本地 JSON 并给出文件路径/SHA-256；设置 `PT5_E2E_LOGISTICS_PAGING_FIXTURE` 只提供路径。数据包含时间相同及微秒相邻记录，归属和观测桶完整，测试期间来源更新冻结。不要从被测分页响应制造清单。

这些是人工准备步骤，本轮没有替你启动服务、配置凭据、初始化或重置数据库。你准备好本地页面后可以先做单独的真实页面验收；原始受限套件仍需正式准入，不能用手动会话替换现有入口后把它算作原用例执行。

## 57 个未执行文件逐项对应

账号列 H 对每一行成立。管理员列 A 表示该原套件需要独立管理员/数据库能力；“无 A”仅表示该导入图没有该辅助文件，不保证没有页面写入或其他管理员行为。每一行的缺口是源码/现有台账的前提，不表示本轮已探测数据库中缺少相应记录。

| 文件 | 状态 | 账号 / 管理员能力 | 具体缺少的数据或业务前提 | 你需要准备什么 / 停在哪一步 |
| --- | --- | --- | --- | --- |
| `account-switcher.spec.ts` | unrun | H+A | 管理员和备用客户账号；服务端身份读回；无效/过期备用会话只能作用于专用浏览器数据 | M1/M2/M3，专用备用账号和浏览器测试上下文；停在账号导入前 |
| `admin-auth-sync-recovery.spec.ts` | unrun | H+A | 可修改的专用人员账号、旧 Auth 写入晚到故障、补偿运行与身份回读 | M1/M2/M3/M4；隔离账号、延迟注入和补偿审计，不能重置共享人员 |
| `admin-person-account-bundle.spec.ts` | unrun | H+A | 专用人员账号及资料/身份/审计/登录四种最终记录；会修改账号登录信息 | M1/M2/M3/M4；可重置人员、原状态备份，管理员写操作另行明确范围 |
| `ai-assistant-settlement-release.spec.ts` | unrun | H；无 A | 管理员/财务/业务员；原测试会借用 Wholesale Alpha 资金记录，需自有客户、别名及收款 | M1/M2/M4/M5/M6；独立客户/资金夹具和本地 AI 边界，停在登录前 |
| `auth-network.spec.ts` | unrun | H+A | 本地可登录账号、独立身份查询；真实错误密码不得生成会话 | M1/M2/M3；本地 Auth 健康，独立身份读能力；不提供密码值 |
| `business-parameter-order-lock.spec.ts` | unrun | H+A | 可发布全局参数的隔离实例、两版本订单、结汇与上海月份预期 | M1/M2/M3/M4/M5；整套可丢弃 API/Auth/DB 与已接受版本值，不只设置 disposable 标志 |
| `business-parameter-settings.spec.ts` | unrun | H+A | 全局参数发布/预约/取消、唯一版本和写后断连读回；不能改共享费率 | M1/M2/M3/M4/M5；隔离全局参数、恢复记录和独立版本凭证 |
| `client-business-access.spec.ts` | unrun | H+A | 可新增并核实的批发客户账号；旅游访问拒绝与客户链接身份 | M1/M2/M3/M4；专用客户身份及管理员添加/清理范围 |
| `company-expenses.spec.ts` | unrun | H；无 A | 管理员/财务/业务员；创建删除需要自有唯一费用，不能借用共享费用 | M1/M2/M4；唯一费用标识、失败后清理及最终行数证明 |
| `company-templates.spec.ts` | unrun | H+A | 内部角色与客户、七类模板、正文/版本/修订/哈希、发布回滚与受控故障 | M1/M2/M3/M4/M7；专用模板和指南文件，保留正文 GET 与独立哈希凭证 |
| `customer-inventory-orders.spec.ts` | unrun | H；无 A；另有执行拒绝 | 固定 200、终身资格、叠加三档尚未确定；专用订单/额度/延期/还款数据 | M4/M5；先确定规则并准备隔离库存夹具；库存执行拒绝保留，不重试 |
| `dashboard-numbered-pages.spec.ts` | unrun | H+A | 超 200 条自有费用及各完整列表、当天汇率；角色页码与独立顺序 | M1/M2/M3/M4；至少 205 条自有费用及各列表数据/总数清单 |
| `dashboard-table-divider.spec.ts` | unrun | H；无 A | 至少两条可见客户，桌面行/手机卡片 | M1/M2/M4/M7；两条测试客户，不需要修改钱财规则 |
| `design-system-governance.spec.ts` | unrun | H；无 A | 管理员/运营；VIP/费用/订单/线索可见数据，待办用例会创建删除 | M1/M2/M4/M7；专用待办及失败清理，其他用例按只读范围分开 |
| `design-system-visual.spec.ts` | unrun | H；无 A | Windows Chrome 截图上下文、固定时间/语言和代表页面数据；公共子集也有顶层账号导入 | M1/M2/M4/M7；保留现有基线，不拆入口规避 H 执行公共子集 |
| `exchange-rate-boc.spec.ts` | unrun | H+A | 当日真实报价、本地 Edge/提供商配置、独立报价 ID 与重算预期 | M1/M2/M3/M4/M5；私下配置提供商能力，真实报价核对先完成 |
| `exchange-rate-history.spec.ts` | unrun | H+A | 指定历史范围的真实报价及来源、运行结果；会写入历史汇率 | M1/M2/M3/M4/M5；专用报价集合和精确日期核对，不借共享汇率 |
| `finance-business-access.spec.ts` | unrun | H+A | 财务可见客户/订单/推荐佣金，独立数据库期望 | M1/M2/M3/M4/M5；财务测试身份及已接受佣金快照，不自行制定规则 |
| `forgot-password.spec.ts` | unrun | H+A | 专用账号有效恢复链接、过期令牌、普通会话对照；部分发信路径为受控边界 | M1/M2/M3/M4；本地恢复链路和账号，不发送真实邮件或改共享密码 |
| `home-role-task-counts.spec.ts` | unrun | H+A | 各启用角色任务数据、目标页及独立数量 | M1/M2/M3/M4；各角色可见记录/计数清单，后台队列冻结后核对 |
| `mail-feishu-oauth.spec.ts` | unrun | H+A | 专用邮箱绑定状态、飞书本地边界、保存失败注入与状态有效期 | M1/M2/M3/M4/M6；隔离绑定和回调，真实飞书到达另记未验证 |
| `mail-layout.spec.ts` | unrun | H+A | 会重置的专用邮箱/会话/正文和附件；1440/390/320px | M1/M2/M3/M4/M6/M7；专用邮箱夹具，即使布局用例也不能重置共享邮箱 |
| `mail-numbered-pages.spec.ts` | unrun | H+A | 邮件/隔离会话分页、末页唯一会话、自有删除对象与 SQL 顺序 | M1/M2/M3/M4/M6；至少跨两页数据及末页删除清单、独立凭证 |
| `mail-oauth.spec.ts` | unrun | H+A | 公司邮箱本地 OAuth 交换、授权保存/通知、断连注入与重放 | M1/M2/M3/M4/M6；专用绑定和本地 Google 边界，不把它当真实 Google OAuth |
| `mail-recipient-maintenance.spec.ts` | unrun | H+A | 历史发送/已知与陌生会话、删除预览令牌、部分失败最终凭证 | M1/M2/M3/M4/M6；明确自有陌生会话删除范围，不能清共享邮箱 |
| `mail-secondary-data.spec.ts` | unrun | H+A | 自有会话、可转交业务员、版本与分配审计；资料读取故障 | M1/M2/M3/M4/M6；两业务员和专用会话，独立核对负责人/版本/审计 |
| `mail.spec.ts` | unrun | H+A | 专用发收邮件、附件/AI/通知、本地任务配置与后台 SENT/收件终态 | M1/M2/M3/M4/M6；本机私下配置任务能力，所有提供商出口隔离 |
| `operator-reimbursements-sharing.spec.ts` | unrun | H；无 A | 两名运营和至少 205 条自有周期费用；直接 SQL 会写入/删除 | M1/M2/M4；专用运营、历史周期与限定清理，不能改共享报销 |
| `operator-reimbursements.spec.ts` | unrun | H；无 A | 专用运营费用周期、真实新增/确认与零行故障；本地 SQL 前置写入 | M1/M2/M4；自有周期与费用清单，提供最终新增/确认行数 |
| `profile-operation-receipts.spec.ts` | unrun | H+A | 可修改的本人资料、零行结果、写后读回故障和运行记录 | M1/M2/M3/M4；专用个人账号、原资料快照、独立最终版本 |
| `referral-tree-company-branch.spec.ts` | unrun | H；无 A | 可见公司推荐分支和手机树；不是佣金计算验证 | M1/M2/M4/M7；自有公司分支节点与显示预期，不需要裁定佣金 |
| `sales-lead-admin-claim.spec.ts` | unrun | H+A | 管理员/两名业务员空额度、可领取线索及联系/退回/转客户历史 | M1/M2/M3/M4；隔离线索与人员额度，竞态前各参与者都应有余量 |
| `sales-lead-conversion.spec.ts` | unrun | H；无 A | 固定管理员/业务员 ID 和历史 E2E-CONVERSION 清理；转客户/失效/重分派 | M1/M2/M4；完整隔离 API/Auth/DB 后才可运行 reset，不能只隔离 SQL 库 |
| `sales-lead-daily-limit.spec.ts` | unrun | H；无 A | 业务员当天领取次数、5 条成功及后续拒绝；固定人员数据重置 | M1/M2/M4；可重置整套环境、上海日期、独立五条记录；声明本地不等于隔离 |
| `sales-lead-details.spec.ts` | unrun | H；无 A | 本地大厅记录、长联系资料和双语言；部分响应是受控内容 | M1/M2/M4/M7；真实大厅条目；受控长内容与真实展示分开记账 |
| `sales-lead-views.spec.ts` | unrun | H；无 A | 管理员/业务员大厅记录、分页搜索和偏好；受控长资料/存储拒绝 | M1/M2/M4/M7；两角色自有线索集合；受控边界不能替代真实查询 |
| `sales-leads.spec.ts` | unrun | H+A | 两业务员竞领、管理员指派、完整历史与受限角色 | M1/M2/M3/M4；自有线索及双方空额度、最终持有人与事件清单 |
| `settlement-rate-repair-receipts.spec.ts` | unrun | H+A | 指定日期缺报价的自有收款/分配、真实本地 Edge 和后台终态 | M1/M2/M3/M4/M5；本地精确补齐能力及运行/报价/分配 ID，不制造报价凭证 |
| `system-health.spec.ts` | unrun | H+A | 管理员/财务、真实运行记录和终态；前置会创建/结束服务任务 | M1/M2/M3/M4；专用运行账本、任务创建范围；服务监听不等于任务正确 |
| `user-media-operation-receipts.spec.ts` | unrun | H+A | 专用运营、真实本地 Storage 对象/媒体行/操作运行 | M1/M2/M3/M4；自有媒体文件、逐对象存在/缺失与最终行数读回 |
| `wholesale-customer-management.spec.ts` | unrun | H；无 A | 自有客户可编辑删除；末项不能借用有订单的 Wholesale Alpha | M1/M2/M4；无订单与有自有订单的两客户、清理与拒删证明 |
| `wholesale-customer-other-names.spec.ts` | unrun | H；无 A | 原测试向共享 Wholesale Alpha 加别名且不恢复 | M1/M2/M4；专用客户及别名快照/恢复范围，不能写共享客户 |
| `wholesale-logistics-sync.spec.ts` | unrun | H+A | 本地来源服务、真实 Edge、限流/续跑配置、SQL 进度及账本凭证 | M1/M2/M3/M4/M6；只读本地来源和隔离后台任务，不能连第三方数据库 |
| `wholesale-logistics.spec.ts` | unrun | H；无 A | 独立 55 行 Local Paging Shop 清单；历史归属用例不能改共享 Local Shop Alpha；同步刷新被模拟 503 | M1/M2/M4；优先只验收真实分页，准备清单/冻结来源；归属写入另用自有历史 |
| `wholesale-mutation-failures.spec.ts` | unrun | H；无 A | 订单/客户/归属/推荐/收款自有数据及全部写出口故障拦截 | M1/M2/M4/M6；防止接口匹配遗漏写共享数据；这些故障注入不能当正常真实写成功 |
| `wholesale-navigation-order.spec.ts` | unrun | H；无 A | 多角色/语言导航；旧导入入口检查会 POST，需要先确认路由已不存在 | M1/M2；只读导航先做，POST 需隔离且证明路由不会创建数据 |
| `wholesale-order-attachment-receipts.spec.ts` | unrun | H+A | 自有订单/附件、真实本地 Storage、部分登记清理凭证 | M1/M2/M3/M4；唯一附件路径、独立元数据/对象查询，不能只信登记 200 |
| `wholesale-order-compact-view.spec.ts` | unrun | H；无 A | 当前月份可见合成订单、常用/完整列的完整字段 | M1/M2/M4；指定日期/订单编号/字段清单，不需要写业务规则 |
| `wholesale-order-creation-idempotency.spec.ts` | unrun | H；无 A | 原例给 Wholesale Alpha 创建订单；需自有客户和订单 | M1/M2/M4；唯一订单标识、双提交后独立仅一行及失败清理 |
| `wholesale-order-month-filter.spec.ts` | unrun | H+A | 管理员/客户、不同计入月份跨页数据和独立 SQL 总数 | M1/M2/M3/M4；固定月份订单与授权客户绑定，包含空月份与刷新 |
| `wholesale-order-pagination.spec.ts` | unrun | H+A | 跨页订单、客户绑定、Order List 附件；部分查询/核心失败为受控边界 | M1/M2/M3/M4；管理员/业务员/财务/客户的可见订单及独立顺序清单 |
| `wholesale-order-settlements.spec.ts` | unrun | H+A | 自有可结汇订单、选定日期汇率和多笔结汇最终记录 | M1/M2/M3/M4/M5；已接受金额与报价快照，不改共享订单或自行裁定钱财规则 |
| `wholesale-orders-i18n.spec.ts` | unrun | H；无 A | 英文 390px 下可见订单及完整字段 | M1/M2/M4/M7；可见合成订单，语言固定为英文 |
| `wholesale-salesman-collaboration.spec.ts` | unrun | H；无 A | 两业务员协作客户/订单，会修改转派；原用例使用固定协作订单 | M1/M2/M4；两专用业务员及自有协作订单，原归属快照和恢复 |
| `wholesale-settlement-monthly-summary.spec.ts` | unrun | H+A | 当月有效收款/分配与故意缺汇率的独立月份；会影响汇总 | M1/M2/M3/M4/M5；专用月份/客户/分配与汇率快照，不能删除共享报价 |
| `wholesale-settlement-releases.spec.ts` | unrun | H+A | 财务/业务员、自有客户多订单/收款/部分分配/整组修改 | M1/M2/M3/M4/M5；金额、剩余额度、币种和日期预期及独立分配 ID |
| `workspace-entrypoints.spec.ts` | unrun | H；无 A | 27 个角色页面的真实标题/控件、可见订单/人员；管理员账号页受服务配置影响 | M1/M2/M3/M4；管理员/业务员/财务角色和各页最少可见记录；刷新后检查正文 |

## 三个已有失败

| 文件 | 状态 | 已知失败与当前阻塞 | 你需要准备什么 | 真实成功凭证 |
| --- | --- | --- | --- | --- |
| `dashboard-home-role-tasks.spec.ts` | failed | 管理员首页到账号页缺服务器 SUPABASE_SERVICE_ROLE_KEY；重跑仍先到 H | M1/M2/M3；本机私下补本地配置，先确保账号页可渲染，不发密钥到聊天 | 页面点击入口、真实账号正文/搜索控件、无框架/权限错误、刷新后同一页面 |
| `information-hierarchy.spec.ts` | failed | 账号页同一服务配置缺口，但它是独立的一个失败用例；重跑先到 H | M1/M2/M3；账号页配置修复后再测桌面/手机信息层级 | 正确业务标题/控件、可见数据与布局，刷新后同一真实数据 |
| `dashboard-home-resize.spec.ts` | failed | 原五工具栏期望已修正为一紧凑+四完整；真实缩放/拖拽保存/刷新/截图未重跑，入口到 H | M1/M2/M4/M7；专用首页账号和原布局；独立布局读回能力另在 A 边界准入 | 同一组件 ID 的宽/高/位置和持久化布局 user_id/scope/updated_at/widgets，刷新后一致；不能以提示或请求 200 单独判成功 |

本轮会对源码和表格作一致性审计；它不能证明 M1–M7 已满足。测试源码、实际凭据访问、管理员业务写入分别评估。所有真实执行仍按入口限制停下。
