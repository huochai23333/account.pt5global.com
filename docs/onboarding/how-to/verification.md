# 怎样选择并记录验证

## 按改动选择

| 改动 | 最低验证 |
| --- | --- |
| 开发文档、地图、诊断 | `npm run check:learning`、`npm run test:learning`；实际执行文档中的命令 |
| 文案和展示 | lint、typecheck、i18n、结构检查；真实页面中英文、1440/390px |
| 筛选、读取和交互 | 上述检查加定向测试、空/错/权限状态和刷新 |
| 写入、异步、权限、金额 | 页面操作、独立权威查询、刷新与适用失败矩阵 |
| 路由、共享布局、Server/Client 或依赖 | 相关检查加生产构建 |
| 数据库逻辑 | 本地 Docker 迁移与 SQL 断言，允许/拒绝路径，再验收页面 |

修改 Web 代码后执行项目规定的 web-change-quality-gate。完整命令表见[维护参考](../../reference/maintenance-handbook.md)。

## 先理解回归准入

新增或调整关键写入时维护 [操作契约清单](../../../config/operation-contracts.json)。`sources` 填实际调用的 Web 源码路径。只有纯后台任务才用空 `sources`，并填写 `backendEntry` 指向同级仓库的 Edge 函数。没有单独配置超时时用 `null`，没有自动重试时用空数组。运行 `npm run check:operation-contracts -- --inventory` 查看静态调用位置，再沿调用链核对真实业务终态。

`npm run test:regression` 是完整流水线，会执行真实本地应用与数据库写入，不是随时可以运行的纯单元命令。先核对[真实 E2E 前提](../../real-e2e-blockers.md)、专用夹具和当前访问限制。不要替换受限 helper、注入会话或放宽断言来获得绿色结果。

`npm run test:contracts` 使用受控文档及合成预期，验证断言是否能识别错误；它不能代替真实登录后的应用流程。真实供应商、真实本地系统和模拟外部边界分别记账。

运行 `node scripts/audit-real-e2e-prerequisites.mjs`，核对原始 86 个入口及当前测试集合。先读 `cohortChanges` 查看新增、移除和显式改名，再读 `prerequisiteChanges` 查看历史准备条件和当前静态导入的差异。新增入口需要独立的运行证据，移除的入口仍保留历史结果。静态扫描只表明已找到的依赖关系，动态导入和实际执行前提须另行核实。

## 记录实际运行

```powershell
npm run test:record -- -- node --test scripts/learning/e2e-cohorts.test.mjs
```

记录工具创建独立运行目录，保留 stdout、stderr、退出码和摘要。使用输出中实际目录运行 `node scripts/verify-test-run.mjs <目录>`。不要预填通过数量。

运行 `npm run clean:artifacts -- --dry-run` 预览本地浏览器产物清理。实际归档遇到同名目标会保留两个文件，路径通过目录链接指向其他位置时会停止。带摘要的完整日志保存在 `output/test-runs/`，与浏览器产物归档分开。

页面检查需记录 URL、角色、语言、视口、实际操作、正文、控制台/遮罩、刷新结果。写操作另外记录权威查询来源、业务编号/版本/影响行数，屏蔽个人资料和密钥。

## 失败矩阵

涉及写入时评估零影响、缺数据、越权、超时、HTTP 成功但业务失败、部分完成、重复提交、后台中断和提交后断网。无关项说明原因。新增关键断言必须能在受控错误结果下失败，修复后再次通过。

夹具使用本次唯一标识，清理仅限本次数据；固定种子或全局规则测试必须使用可重建的隔离实例。清理前后都核对实际记录，不删除共享业务资料。

## 独立学习浏览器回归

`npm run test:learning:browser` 覆盖首页布局及待办、服务说明页、资料编辑与审核、邀请链接读取失败、媒体链路和注册进度。它复用唯一 Web 服务；登录用例按 Playwright 的 test-scoped fixture 创建新账号，经真实表单登录，最终在 `finally` 撤销自己的会话并清理账号，独立核对用户和布局为零。注册进度两例匿名操作且不创建账号。准备前必须任务暂停、队列为空且所有任务地址指向本地。它不恢复固定种子账号，不修改已有用户布局，也不代替受限原套件。

媒体用例运行前，按[本地启动](local-development.md)启动本项目 Edge，配置 `USER_MEDIA_IMAGE_REVIEW_PROVIDER=disabled`。测试在写入前核对运行容器的配置；缺少服务或配置不符会拒绝执行。只需验证首页或个人资料时可以指定文件，例如 `npm run test:learning:browser -- dashboard-home-todo.spec.ts profile-maintenance.spec.ts`，无需启动 Edge。

读取 `tests/learning/fixtures.ts`、`dashboard-home-layout.spec.ts` 和配置。测试从页面缩放、拖动，独立 SQL 读回，刷新后比对尺寸/位置，再检查 1440/390px。布局凭证、清理计数和截图保存在 `output/learning-browser-results`；该目录下一次测试会重新生成，需通过记录工具保存完整日志。测试目录自己的 `package.json` 明确 ESM，避免把 `.mjs` 夹具错误编译成 CommonJS；不改变应用根包的模块约定。

新增业务测试请沿用“夹具申请 → 页面操作 → 独立终态 → 刷新 → finally 清理”的结构，并根据实际风险补充失败场景；不要把整个 `learningUser` 写入日志或附件。参考 [Playwright 官方夹具说明](https://playwright.dev/docs/test-fixtures)。

服务说明页测试位于 `workspace-notice.spec.ts`：客户不能获得服务端已拒绝的资料库链接；员工桌面入口保留。每例覆盖中英文及 1440/390px、刷新、控制台错误和按钮文字换行。`learningRole` 是显式测试选项，默认管理员；每次仍创建新账号，不改共享固定账号岗位。

`register-progress.spec.ts` 在真实注册页只填写资料并切换步骤，核对圆点/连接线的实际顺序、双语双宽度、刷新重置及控制台。测试拦截最终 signup 请求并断言为零，不提交账号、不发信；它不能作为注册、OTP 或改密成功的凭证。

`dashboard-home-todo.spec.ts` 从页面新增、编辑、标记、完成和删除，独立检查同一行的值、时间与终态；模拟零影响时必须保留原行并显示错误。个人中心三组验收和媒体故障注入详见[个人中心数据流](../explanation/profile-data-flow.md)。

`assistant-chat-stream.spec.ts` 验证助手的同帧提交、断流、刷新中断和结汇权限。需按[助手请求与运行凭证](../explanation/assistant-chat-flow.md)确认本机模拟供应商，再显式启用用例。它通过真实本地应用生成运行凭证，单独查询账本、尝试和配额。

`person-private-note.spec.ts` 使用两位专属管理员，从账号页保存和清空备注，对照所有者、目标、正文、更新时间和行版本。模拟错误请求时仍交给真实 API 校验，另注入错误目标的 HTTP 200 回执验证页面拒绝。测试结束按账号对清理备注。[账号管理与私有备注](../explanation/account-and-private-note-flow.md)

`admin-account-receipts.spec.ts` 使用专属管理员调整新建测试人员的角色和城市，独立查询账号、Auth、同步记录和唯一审计行。第二个标签页提交旧快照验证冲突。只对专属账号制造 Auth 偏差，再通过页面发现并重试，最后使用人员自己的登录表单验证工作台落点。测试清理审计和补偿数据后由账号夹具清理用户。[账号调整验收](../reference/verification-2026-11-06-admin-account-receipts.md)

`exchange-rate-manual.spec.ts` 使用专属管理员和测试币种，开始前要求该日期与币种不存在记录。实际从页面新增、改价和删除，独立对照 `numeric` 数值、发布时间和同一记录编号；编辑时注入一份旧报价回执，确认页面保留草稿并报错。测试结束只清理本次币种与业务日的人工记录。[汇率报价与同步链路](../explanation/exchange-rate-flow.md)
