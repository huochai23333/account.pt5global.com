# 文档测试的数据从哪里来，怎样回收

这份资料面向维护文档用例的新人。业务写入仍由页面触发；读取辅助负责独立核对，清理辅助只回收本次运行的数据。[原套件准入限制](../../real-e2e-blockers.md)继续适用，下面的模块整理不表示原套件已运行。

## 按职责找到代码

目录选择使用 `chooseDocumentFolder(page, folderId)`，传入当前授权响应中的目录编号。数据库默认根名、桌面树的账户标题和窄屏账户入口不是同一文案；根目录也不会作为普通目录行再次出现。助手先确认目标属于当前档案，检查父链缺失、跨档案和循环，再从真实账户路径进入根，逐层双击编号对应的目录，最后独立读取实际 folderId。不要改回按名称查找：不同父目录允许有同名子目录。

五处原调用已传编号，关联测试保留关联前取得的根编号。独立学习用例实走中英文 × 1440/390px，在两个同名子目录之间切换、刷新并返回根；目录版本保持，文档接口写入为零。这证明该助手的实际导航，不代表原认证/关联套件通过。

| 入口 | 维护内容 |
| --- | --- |
| [document-library](../../../tests/e2e/helpers/document-library.ts) | 统一导出；无需在这里继续堆积实现。 |
| [document-access](../../../tests/e2e/helpers/document-access.ts) | 原有本地客户端、岗位登录、账号编号读取。原认证入口的限制保持有效。 |
| [document-library-page](../../../tests/e2e/helpers/document-library-page.ts) | 文件夹导航、上传交互和视口检查。上传提示只是中间结果。 |
| [document-file-receipts](../../../tests/e2e/helpers/document-file-receipts.ts) | 权威文件编号、版本、状态、大小与 Storage 下载核对，以及最小 PDF 夹具。 |
| [document-explorer](../../../tests/e2e/helpers/document-explorer.ts) | 创建、选择、进入、删除的页面步骤，复用同一清理入口。 |
| [清理入口](../../../tests/e2e/helpers/document-fixture-cleanup.ts) | 按批次真实发起人取得原测试会话，将能力传给清理核心，保存安全凭证。 |
| [清理核心](../../../tests/test-support/document-fixture-cleanup.ts) | 圈定数据、检查归属、排定删除顺序、最终检查残留。 |
| [清理存储](../../../tests/test-support/document-fixture-store.ts) | 分页、实际删除、批次释放以及独立零行和对象核对。自身不寻找认证或读取环境。 |

`页面操作 → 文件与批次记录 → 独立读取和刷新 → finally 中按运行前缀回收`。页面验收还需检查真实操作终态，不能只调用清理函数证明业务成功。

## 页面用例的资源依赖和清理次序

[批量移动与目录导航学习用例](../../../tests/learning/document-library-batch-move.spec.ts)的 documentFixture 依赖 page 和 learningUser。收尾先关闭页面，再清本次文档、操作回执、批次与客户，独立核对零残留，最后才由账号夹具删除用户。文档准备/收尾有独立 60 秒期限，正文仍为 60 秒；不把整套测试时间扩大来掩盖收尾竞争。此依赖关系遵循 [Playwright 夹具生命周期](https://playwright.dev/docs/test-fixtures)。

首轮两个移动场景正文后的清理超时，账号删除先遇到 document_batches 外键；原业务终态和文档清理凭证已存在，不能据此诊断成 Storage 版本或生产 SQL 缺陷。保留失败记录，核对依赖归零后精确回收一个本次账号。调整夹具依赖后，两个移动场景与四个导航场景共六项通过、零重试；每项文档清理先于账号清理，另一次独立查询核对本批七个账号相关十类记录均为零。

原权限、完整文档旅程、资源管理器和 Windows 目录四份测试保留 20 个原声明；248 个原断言中的变化逐项登记，最终 259 个。修改覆盖成功完整 LIST、未登记的拒绝上传对象、草稿编号提前登记、当前行内改名、准确目录/版本及清理错误传播。拒绝上传对象只允许本次 13 位前缀下的路径，清理后完整 LIST 必须确认不存在；六种 SDK/内存 HTTP 边界检查通过。原四份测试仍未导入或运行，源码审查和边界检查不扩充为原页面验收。

## 清理范围和成功凭证

独立学习套件的[客户目录夹具](../../../tests/learning/customer-document-upload-fixture.ts)另以专属账号和随机 UUID 文件名前缀归属。递归删除后，目录和文件登记可能已经消失，但上传凭证仍存在；查找这些凭证不能再要求原目录仍在。批次回收也要包括文件删除和目录删除的操作，先按原批次结果清凭证，再清批次。

删除合成账号后，正常审计外键会把文档操作的 `actor_id` 置空。因此，专属测试应在删账号前直接按账号核对全部文档操作为零，不能只复用夹具自己的目录筛选。目录筛选出错时，读取和清理可能同时返回空，看似全部完成却仍有遗留。该全账号检查只适用于本次独占的合成身份；共享真实账号仍需按已确认的清单逐项归属。

每次运行使用带毫秒时间戳或 UUID 的专属前缀，例如 `explorer-nav-${Date.now()}-`。只传入该完整前缀。`explorer-` 等共享前缀会在读取前拒绝；资源管理器用例也已移除启动时的全局清理。

默认名称的子目录和文件通过本次根目录编号归属，不再为了清理而改名。系统目录、混合批次、被其他记录引用的同一对象路径和目录环都会报错。前置读取全部成功后才开始修改，叶子目录先于父目录删除。前缀采用普通字符串比较，百分号与下划线不作为 SQL 通配符。

批次的权限属于 `actor_id`。数据库 `document_private.can_batch` 同时检查实际登录人和目录权限，管理员岗位不能替代另一位发起人。入口只使用原套件已有岗位，先匹配档案邮箱，再通过真实会话的用户编号核对身份；无法匹配就失败，不扩大底层权限。

清理成功需要这些独立凭证：

- 批次释放后重新读取 `request.released = true`，且相关目录锁记录数为零。
- 每批删除返回的编号与预期集合完全一致，随后独立查询剩余记录数为零；零影响不是成功。
- Storage 删除后复用[对象存在性读取](../../../lib/storage-operation-object-presence.ts)，成功读完整个相关目录后才能确认不存在；目录读取失败仍然失败。
- 最后重新读取目录、文件、公司文档、操作和批次，确认没有本次运行的残留。

已有 SDK 的 `exists` 不适合作为这里的零错误凭证：本机安装实现会为部分 HTTP 错误返回 `false` 并携带错误。官方当前接口说明也要求区分缺失对象与其他失败，版本行为须以实际安装源码为准。[官方 exists 文档](https://supabase.com/docs/reference/javascript/storage-from-exists)

## 怎样验证修改

[失败恢复](../../../tests/e2e/company-template-document-failures.spec.ts)、[原HTML](../../../tests/e2e/company-template-original-html.spec.ts)和[原模板协议](../../../tests/e2e/company-template-production-protocol.spec.ts)现在在草稿URL出现时立即登记UUID，finally复用四表清理，覆盖草稿、正式正文和不会级联删除的操作回执。模板发布可能已提交但编号读取失败时，`deleteTemplateFixture`只按带本次UUID的精确名称恢复，再逐文档核对归属/影响编号及父模板、版本零行；公共名称不能用于批量回收。多个资源按顺序尝试，错误汇总保留。

这三份场景的原页面步骤仍未执行；已完成源码对照、纯模块反例和真实SDK/隔离PostgreSQL混合集成。另单独执行两处实际文件写入表达式，以四个来源各两个合成模板验证不同路径及重复写拒绝，原固定证据只读保留。结果文件采用模板UUID与`wx`排他创建，截图采用同一编号；没有把合成文件当作真实截图或业务结果。[本批范围与凭证](../reference/verification-2026-11-06-template-helper-release-review-quota.md#2026-11-09模板失败场景与隔离锁)。

模板原场景中，[普通HTML保存](../../../tests/e2e/company-template-generic-saving.spec.ts)侧重闭包事件、原生对话框、动态行和刷新后继续计算；[原报价单保存](../../../tests/e2e/company-template-raw-quotation.spec.ts)侧重固定输入指纹、多目的地、图片及手动字段。二者通过`company-template-documents`读取权威状态，目录确认仍从页面完成。图片data URL匹配只证明状态包含图片引用，完整字节一致需要额外验证。[记录与清理助手](../../../tests/e2e/helpers/company-template-records.ts)按文档/模板绑定、影响编号和独立计数回收，证据以文档UUID命名且只创建一次；17项边界测试、隔离SQL及文件排他写入已独立验证，原认证场景仍未执行。[清理与证据验证](../reference/verification-2026-11-06-template-helper-release-review-quota.md#2026-11-09模板夹具清理与证据保护)。

```powershell
node --test scripts/learning/document-fixture-cleanup.test.mjs scripts/learning/document-fixture-store.test.mjs
npm run typecheck
npm run check:learning
```

这 24 个场景使用明确提供的内存数据和 SDK 响应，验证归属、失败传播、分页、影响行数、对象与目录残留。它们不读取账号和管理员辅助入口，不创建真实业务数据，不代表原 Playwright 套件、真实批次会话或 Storage 集成通过。原套件满足既有准入条件后，仍需按原入口完成页面操作、独立读回、刷新和限定回收。

当天汇率夹具位于 [current-exchange-rate-fixture](../../../tests/e2e/helpers/current-exchange-rate-fixture.ts)。它只补当天缺失的 USD/CNY 固定测试报价，不覆盖已有值，不作为中行真实报价凭证。现行数据库已强制目标币种为 CNY，补写查询条件是阅读性澄清；当前没有复现“误用其他目标币种”的产品缺陷。原夹具运行仍受原套件前提约束。

[local-postgres-query](../../../tests/e2e/helpers/local-postgres-query.ts)通过显式环境声明核验专属DB/Kong/网络/API及off/0/0，使用只读事务独立查询权威记录，不按固定共享容器或54321选择项目。语句12秒、锁等待10秒、客户端15秒，禁用psql启动脚本并设置ON_ERROR_STOP；字符串使用localSqlValue转义。它只接受可信测试SQL，不是用户SQL沙箱，维护角色读回也不代表普通岗位权限。

## 公司模板、正文和操作回执

公司模板辅助按下面的入口维护，原用例继续从 company-template-actions 取得能力：

原综合测试的访问、预览、发布和拒绝/故障已分到同层场景模块；原11处声明、18个场景及顺序保持。UUID意图、未知结果和恢复边界见[发布与预览测试](company-template-publication-tests.md)。原认证与产品页面执行状态单列。

| 代码 | 职责 |
| --- | --- |
| [company-template-actions](../../../tests/e2e/helpers/company-template-actions.ts) | 原本地管理员准入与统一导出，不寻找替代认证入口。 |
| [company-template-page-actions](../../../tests/e2e/helpers/company-template-page-actions.ts) | 表单、稳定点击和布局检查。 |
| [company-template-payloads](../../../tests/e2e/helpers/company-template-payloads.ts) | 合成 HTML、上传载荷、测试协议及正文摘要。 |
| [company-template-records](../../../tests/e2e/helpers/company-template-records.ts) | 模板/版本读取、精确计数、限定模板清理。 |
| [template-document-fixture-cleanup](../../../tests/test-support/template-document-fixture-cleanup.ts) | 按用例收集的 UUID 清理正文、草稿和两类操作回执。 |

模板版本的 HTML 保存在数据库文本列中。删除模板前先断开当前版本外键，已有行的更新和删除都须精确命中该编号，随后独立读取模板与版本均为零。未取得计数时明确失败，不能用 `count ?? 0` 当作清理凭证。若夹具在创建前就失败，可以没有行，但仍核对两个集合为空，不声称完成一次写入。

正式业务删除文档时保留操作回执，以防断线重试重建已删除正文。只有专属测试结束后，才能按它记录的 UUID 回收这些夹具回执：草稿回执按 draft_id，文档回执按 receipt.document_id。清理工具不扫描他人数据，每 50 个编号一批，比较精确影响数与删除前数量，并重新查询四类集合；发现异步新增或读取失败就让原用例失败。编号为空不访问数据库，无效编号在任何访问前拒绝。

当前入口覆盖证据、打印、超限、串行保存，以及目录旅程、岗位边界、响应丢失恢复和个人文档完整旅程八个场景。其他原用例继续逐项审查。新用例在取得草稿/正式编号时立即加入本次 ids，结束时在 finally 中调用同一清理入口，并保留原套件的隔离和准入前提。

按场景阅读原文档用例：

- [独立凭证](../../../tests/e2e/company-template-document-evidence.spec.ts)：故意改错专属正文，证明权威对比会失败，再从页面保存恢复。
- [打印与设置](../../../tests/e2e/company-template-document-printing.spec.ts)：校验必填、删行、设置和刷新恢复；打印凭证仅为浏览器调用标志，不是实际 PDF。
- [数据超限](../../../tests/e2e/company-template-document-size-limit.spec.ts)：超限不提交正文，移除图片后从页面保存并读回。
- [串行保存](../../../tests/e2e/company-template-document-restoration.spec.ts)：拦截计数持续到真实上游响应回传，核对最新修改保存和刷新；仅放行请求前的延迟计数不足以证明响应期间无重叠。
- [卡片独立展开](../../../tests/e2e/company-template-isolation.spec.ts)、[预览等待与手机入口](../../../tests/e2e/company-template-navigation.spec.ts)：页面行为与刷新，不把它们当模板发布业务验收。
- [目录完整旅程](../../../tests/e2e/company-template-folders.spec.ts)：草稿转正、另存副本、混合列表、移动和删除；草稿编号在选择位置前记录。
- [目录岗位边界](../../../tests/e2e/company-template-folder-permissions.spec.ts)：管理员创建、业务员维护、客户拒绝；临时上下文和数据独立回收。
- [另存响应丢失恢复](../../../tests/e2e/company-template-folder-recovery.spec.ts)：从真实页面重试同一操作编号，独立位置断言先识别错误、再恢复。
- [个人文档完整旅程](../../../tests/e2e/company-template-documents.spec.ts)：使用共享创建/读取/保存辅助，保留内容、管理、管理员读取及布局断言。

多种资源使用 [cleanupFixtureResources](../../../tests/test-support/fixture-cleanup-sequence.ts) 顺序尝试；某一步失败仍回收后续资源，最后以 AggregateError 保留全部错误。顺序执行可避免两个清理器同时修改同一批行。4 个独立单元场景随 npm run test:learning 检查，不启动原认证或数据库入口。

位置选择对应两个当前组件：另存为使用 DocumentSaveAsDialog 的目录树，移动使用 DocumentFolderDialog 的人员/目录组合框。维护时分别沿组件和授权目录读取链路追踪；目录读取只定位允许的位置，提交仍从弹窗发起。

```powershell
node --test scripts/learning/company-template-records.test.mjs scripts/learning/template-document-fixture-cleanup.test.mjs
```

这 18 个场景只验证纯模块和显式模拟响应，其中一个使用真实 Supabase SDK 解析模拟 HTTP 的精确影响数，fetch 完全被本地函数接管，不连接网络或登录。原文档用例仍按既有 H/A、专属 API/Auth 实例和固定夹具准入条件执行，不能用这些单元场景替代。[Playwright 夹具生命周期](https://playwright.dev/docs/test-fixtures)

## 本地清理入口与原文档用例

[本地过期清理命令](../../../scripts/document-cleanup-local.mjs)会领取整个实例的过期项，因此只用于实际可重建的专属完整项目。必须显式设置 PT5_E2E_FIXTURE_MODE=disposable、PLAYWRIGHT_BASE_URL、NEXT_PUBLIC_SUPABASE_URL、PT5_E2E_DATABASE_PROJECT 和 PT5_E2E_DATABASE_CONTAINER，服务密钥另由专属进程配置提供，不写入记录。命令实际核对数据库/网关标签、运行状态、API端口绑定、共同网络及暂停调度；共享项目即使声明disposable也在客户端创建/认领前拒绝，不借用共享配置的48021或共享.env.local。原受限套件其他独立SQL辅助仍固定54321，前文限制不变。它不是按测试前缀清理当前共享库的工具。

命令通过[本地适配](../../../scripts/document-cleanup-local-port.mjs)运行后台同一清理引擎。Storage 状态采用 Web 已有的完整目录读取：逐项检查名称和对象编号、跳过目录、完整分页，错误不能变成不存在。引擎在真实对象消失后才核对数据库完成编号和影响数。failed/partial_failed 均以非零退出，输出只含安全编号和终态。

[六项边界回归](../../../scripts/learning/document-cleanup-local-port.test.mjs)使用实际 SDK 2.100.1、真实引擎与内存 HTTP 传输；复现旧 HEAD 400 回调导致清理失败，检查目录错误、删除未生效和数据库零影响。实际子进程只验证缺少专属声明时在连接前拒绝，没有运行全实例领取。这不算真实 Storage/数据库集成，也不解除原账号/管理员入口限制。[官方目录读取说明](https://supabase.com/docs/reference/javascript/storage-from-list)要求区分目录与文件，并提供分页参数。

原入口现在按下面位置阅读：

- [个人资料与人员详情](../../../tests/e2e/document-profile-entrypoints.spec.ts)保留原整个场景，单独核对档案授权；[边界写入](../../../tests/e2e/document-library-boundaries.spec.ts)处理确认清单、同版本竞争与跨档案移动/删除。
- [预览和下载](../../../tests/e2e/document-explorer-preview.spec.ts)展开 PDF、图片、普通文件和 ZIP 字节核对，F2 改名对准当前行内输入；英文刷新不代表全部英文状态通过。
- [模板改名](../../../tests/e2e/document-windows-template.spec.ts)保留版本/正文摘要及同操作恢复，按已收集 UUID 回收正文、草稿和操作回执，并独立核对影响数/残留。
- [90 秒未确认](../../../tests/e2e/document-windows-timeout.spec.ts)保持原等待时限和权威无写入检查，没有缩短等待让它容易通过。
- [名称故障注入](../../../tests/e2e/document-windows-outcome.spec.ts)只在显式故障模式使用本次 UUID SQL 名称，函数/触发器同事务安装；普通模式不会再删除固定名称的触发器。故障模式本来就应使权威名称断言失败，不能将其算为正常套件通过。
- [过期回收场景](../../../tests/e2e/document-library-cleanup.spec.ts)在完整隔离实例中准备中断上传/删除，再运行实际命令；后台夹具准备不算页面发起业务操作。两个旧缺失断言均改为成功目录读取。

这些原用例本批均未执行；故障 SQL、全实例领取、真实对象与刷新链仍需受准入约束的独立验收。后台“同名目录在文件之前”的分支已另行修复，经过四项前后回归、真实 Storage 受控次序及媒体页面验证，详见[对象凭证报告](../reference/verification-2026-11-06-storage-presence.md)；这不替代原文档整库清理验收。

## 加载、恢复与故障场景

[局部加载与通知](../../../tests/e2e/document-explorer-loading.spec.ts)核对旧树/工具栏保留、浏览器返回的迟到响应、错误重试，以及26项上传和整夹删除通知。它保留原四档宽度断言，截图改为本次前缀，JSON按批次编号排他创建；加载场景只展开语句，没有用模拟界面替代真实查询。

[资源管理器恢复](../../../tests/e2e/document-explorer-recovery.spec.ts)负责拖放/快捷键、响应丢失续办、零行删除、跨客户边界、缺失ZIP和运行中撤权；[复制故障](../../../tests/e2e/document-library-copy-failures.spec.ts)负责同名改名、输入框快捷键与来源对象恢复；[登记和删除故障](../../../tests/e2e/document-library-faults.spec.ts)负责触发器制造的真实失败、过期清理及零影响凭证。对象消失统一通过生产同一完整LIST函数核对；故障条件的对象删除/恢复也独立读取。

恢复及故障文件在登录/页面写入前核对完整专属项目；固定SQL触发器、种子岗位和全实例领取不能在共享库执行。故障SQL走同一目标的标准输入，服务端12s/10s、客户端15s兜底。多个资源顺序回收，某项失败仍尝试后续回收并汇总错误。清理子进程用spawnSync保留预期失败的JSON，再核对非零退出；不加载共享.env.local覆盖目标。

本轮只执行纯边界/接线、实际CLI拒绝、静态主体对照和合成文件写入，四份原场景均未导入或运行。源码中的原视口、完整下载、批次最终行数、真实故障与撤权结果仍是待执行的验收要求。[本批证据与限制](../reference/verification-2026-11-06-document-entry-review.md#2026-11-09故障测试与清理准入)。

## 账号关联、工作区和历史迁移

默认目录命名与同号防重另有[后端并发入口](../../../../PT5-dropshipping-supabase/scripts/test-document-windows-concurrency.mjs)。它先核验无网络/tmpfs专属目标和显式员工/公共根，在真实锁等待后提交两组请求，再独立核对目录、操作和清理终态。准备及局限见[目录并发维护](../../../../PT5-dropshipping-supabase/docs/onboarding/environment.md#目录并发维护)；SQL并发不是原页面、Auth或实际Storage结果。

[客户资料关联](../../../tests/e2e/document-library-linking.spec.ts)从本次专属账号和未注册客户出发，检查文件阻止删除、关联后档案合并、原对象路径保留和刷新。当前默认区域已统一为一个`personal`根“资料文件夹”，所以测试不再选择旧“共享资料”或期待两个默认区域。该规则来自原统一迁移和现行函数，不为测试新增旧名称兼容。

客户测试清理只能使用本次完整`docs-link-<13位时间戳>-`前缀，先查询预计编号，再比较DELETE返回编号并独立核对零行。固定目标SQL已改用专属项目准入和有界执行；账号删除还须独立读取Auth剩余行数。资料、客户和账号顺序尝试回收，失败汇总。原页面/Auth链未执行；实际清理函数和默认根已在无网络隔离SQL验证，包括零影响拒绝及另一组记录不变。

[工作区入口、整树复制和深层移动](../../../tests/e2e/document-library-workspace.spec.ts)保留三项原场景。响应丢失后从批次收集复制的文档编号，读取出错不能用空集合掩盖；草稿、正文和两类回执复用四表清理。结果JSON按目录/批次/文档真实编号排他创建，截图按本次前缀；额外浏览器页面和登录也在上下文的finally范围内。

[人员目录历史迁移](../../../tests/e2e/document-library-personal-migration.spec.ts)与[客户目录统一历史迁移](../../../tests/e2e/document-unified-migration.spec.ts)保留非空旧目录、对象字节、模板固定版本及旧窗口冲突要求，只能在匹配迁移前版本的可重建完整项目执行。它们读取原SQL文件并通过已核验的专属库执行，不改原迁移。缺少旧根目录仍skip，不计通过；不能在当前共享233版恢复旧结构来让历史测试运行。草稿编号在位置确认前登记，清理覆盖操作回执，结果按文档UUID只创建一次。

本轮没有导入或运行上述原套件，也没有重跑两份历史迁移或生成页面截图。静态主体对照、五处实际JSON写入表达式及隔离客户清理的范围见[关联与迁移场景证据](../reference/verification-2026-11-06-document-folders-pagination-rls.md#2026-11-09关联与迁移场景)。
