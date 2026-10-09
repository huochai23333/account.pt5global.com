# 资料库文件资源管理器本地验收

本次范围为批发 Web、相邻 Supabase 仓库，以及 PT5 China 两个仓库的品牌清理。资料库涉及上传、移动、共享和永久删除，按 `web-change-quality-gate` 的关键写入路线验收：页面操作、数据库与 Storage 独立核对、终态与刷新一致性缺一不可。本报告记录本地实现与验证；用户随后要求上传，GitHub、Supabase Cloud 与网站部署的结果在下方分别记录。

## 页面与最终结果

| 页面或入口 | 页面操作 | 核对结果 |
| --- | --- | --- |
| `/<workspace>/documents` 首页 | 我的资料、人员资料、客户资料；名称搜索 | 入口按当前权限显示，隐藏区域先过滤再计数分页 |
| 档案与目录 | 目录树、双击、路径、返回/前进/上一级、刷新 | 直属文件夹、上传文件、模板同时显示；网址恢复位置和搜索 |
| 列表与图标 | 复选框、Ctrl/Shift、当前页全选、排序与翻页 | 文件夹优先，切换位置/搜索/分页清空选择 |
| 整理资料 | 菜单、拖放、剪切粘贴、Enter/F2/Delete/Ctrl+X/V | 移动保留编号、对象和模板内容，后代归属与版本更新 |
| 共享资料 | 选择客户共享位置并明确确认 | 显示接收档案、完整路径和内容数量；客户仅查看下载，撤回后旧内容地址失效 |
| 删除 | 确认完整路径与三类数量，永久删除勾选 | 对象、资料记录、叶子目录、父目录依序核对；失败保留目录及 `partial_failed` |
| 下载与预览 | 图片/PDF 双击预览，普通文件下载，批量 ZIP | 实际阅读器/图片加载；ZIP 路径及字节核对，缺失对象拒绝交付 |
| 模板文档 | 继续编辑、重命名、另存一份、移动、删除 | 不可变模板版本及填写状态保持；共享只读仍可打开打印 |

持久化批次保存清单、条目版本、操作编号和逐项凭证；断线续办读取原编号，已完成项不重复执行。整树移动在事务内完成。删除中的目录树保护上传、模板保存及移动；每次续办与删除完成都重新检查当前权限。默认目录、循环目录和同名目的地不允许绕过限制。

## 自动化证据

最终结果按独立用例去重。真实 E2E、受控约定检查和纯单元测试分别计数，不相加作为真实页面覆盖。

| 验证 | 结果 |
| --- | --- |
| 新增资源管理器真实页面（3 个文件） | 14 通过，0 失败，0 跳过 |
| 原资料库及目录归档页面（8 个文件） | 14 通过，0 未解决失败，0 跳过 |
| 原模板内容/故障/恢复页面（3 个文件） | 10 通过，0 未解决失败，0 跳过 |
| PT5 China 品牌页面 | 1 通过，0 失败，0 跳过 |
| `npm run test:contracts`（受控浏览器文档） | 90 通过，0 失败，0 跳过 |
| 清理、来源与 ZIP 路径/字节纯测试（3 个文件） | 17 通过，0 失败，0 跳过 |
| 模板 sandbox 检查 | 内容校验、存储隔离、响应 sandbox 三项均通过 |
| 本地 SQL | 3 个测试脚本及完整迁移重放通过，夹具回滚 |
| 主 Web 类型、全量 ESLint、双语、UI 结构、操作约定 | 均通过；42 项操作约定 |
| 主 Web 生产 Webpack 构建 | 通过，生成 56 个静态页面 |
| PT5 China 类型、全量 ESLint、双语、UI 结构、生产构建 | 均通过；生成 21 个静态页面 |
| 官网本地测试脚本 | PowerShell AST 语法检查通过 |

改版期间原测试的首页位置、行按钮、确认勾选和公告处理已同步；清理子进程显式读取本项目本地环境。恢复操作按本次文件定位，清理按原凭证中的随机前缀删除测试操作，防止其他未完成资料干扰用例。上述通过数是修正后的最终结果，重跑同一用例不累计新增覆盖。

主 Web 合计 38 项真实页面用例通过；加上 PT5 China 品牌用例为 39 项。新增资料库最后一次完整重跑为 14/14，耗时约 4.2 分钟，包含真实下载与特殊文件名，不用纯测试代替 ZIP 交付验证。

主 Web 检查命令为 `npm run lint`、`npm run typecheck`、`npm run check:i18n`、`npm run check:dashboard-ui`、`npm run check:operation-contracts`、`npm run test:contracts`、`npm run test:template-content-sandbox` 和 `npm run build`。纯测试使用 `node --experimental-strip-types --test scripts/document-cleanup.test.mjs scripts/document-library-origin.test.mjs scripts/document-archive-paths.test.mjs`。

页面回归按以下文件执行；原有回归也分批或按用例重跑，表中只计每个最终通过的用例一次。

```powershell
$env:PLAYWRIGHT_SKIP_WEB_SERVER = "1"
$env:E2E_DOCUMENT_CHROME = "1"
npx playwright test tests/e2e/document-explorer.spec.ts tests/e2e/document-explorer-recovery.spec.ts tests/e2e/document-explorer-preview.spec.ts --workers=1
npx playwright test tests/e2e/document-library.spec.ts tests/e2e/document-library-boundaries.spec.ts tests/e2e/document-library-cleanup.spec.ts tests/e2e/document-library-faults.spec.ts tests/e2e/document-library-permissions.spec.ts tests/e2e/document-library-linking.spec.ts tests/e2e/company-template-folders.spec.ts tests/e2e/company-template-documents.spec.ts --workers=1
npx playwright test tests/e2e/company-template-document-evidence.spec.ts tests/e2e/company-template-document-failures.spec.ts tests/e2e/company-template-document-restoration.spec.ts --workers=1
```

真实页面命令复用正在运行的 `localhost:3000`，设置 `PLAYWRIGHT_SKIP_WEB_SERVER=1`，浏览器使用已安装 Chrome，固定单 worker。新增资料库用例为 `document-explorer.spec.ts`、`document-explorer-recovery.spec.ts`、`document-explorer-preview.spec.ts`。原有 `document-library*.spec.ts`、`company-template-folders.spec.ts`、`company-template-documents.spec.ts` 已同步分类首页、更多菜单、永久删除清单和跨档案移动规则，保留原有独立数据库断言。

原有模板的 `company-template-document-evidence.spec.ts`、`company-template-document-failures.spec.ts`、`company-template-document-restoration.spec.ts` 检查协议、离线、响应丢失、多窗口冲突、版本固定、图片大小、恢复计算与保存串行。超时故障使用本地数据库真实锁等待，避免网络拦截器本身阻止请求取消；故障结束释放连接后仍重试原操作。

SQL 使用本地 Docker `supabase_db_pt5-dropshipping`。`document_explorer.sql`、`template_document_folder_boundaries.sql`、`document_library_grants.sql` 均在事务内回滚测试夹具。完整迁移重放先在同一回滚事务内移除新增对象，再重新执行完整迁移及断言，检查首次建表、触发器、授权和函数创建。测试包含整树和跨档案移动、旧版本、共享确认、权限撤回、递归删除保护、重复编号与直接表写入拒绝。

安全凭证例：文件 `01b50f54-296b-4b21-83a4-a53a73410b48` 重命名前后版本为 2→3，对象路径始终为同编号 `.txt`；批次 `43e1fde8-16f9-4185-a523-17ea5da62824` 保存文件编号和原版本。这些均为隔离测试资料，验收后按随机前缀清理；凭证日志位于忽略目录 `output/document-library-business-receipts.jsonl` 和 `output/document-explorer-batches.jsonl`，不包含密钥或登录会话。

最终独立查库：测试前缀目录、上传文件、模板文档和批次均为 0；残留删除保护、测试故障触发器及资料库孤立 Storage 对象均为 0。撤权测试账号已恢复管理员角色。临时 SQL 重放文件已移除，仅交付正式迁移和测试脚本。已打开本机 Chrome 的管理员资料库入口，保留本地服务供检查。

负例包括请求中断、重复提交、旧版本、权限撤回、删除清单变化、真实数据库删除影响 0 行、Storage 对象缺失和同名目录。部分失败核对保留记录及目录，恢复后继续同一批次并核对最终消失。ZIP 实际下载并解压核对路径与字节；同名上传、大小写碰撞及不同档案同名目录分配独立路径。模板不进入 ZIP，需单独打开打印或导出 PDF；打包上限为 100 个上传文件、200 MiB。

## 布局和模块边界

资料库检查 1440、1024、390、320px，覆盖约 150 字长名称、三级长路径、23 条目录内容和分页。长路径在自身区域横向滚动，名字省略后保留完整标题；不压成竖列，也不产生整页横向溢出。输入框保留编辑快捷键。正常路径检查浏览器页面异常、框架覆盖层、英文文案和刷新；故障注入产生的预期网络拒绝单独判定。

| 修改核心文件 | 原行数→现行数 | 职责 |
| --- | --- | --- |
| documents Page | 15→16 | 参数、授权读取与页面组装 |
| document-library-client | 42→42 | 组合专用模块与调度 |
| model | 21→32 | 明确条目、清单与批次类型 |
| http | 39→40 | 来源检查与日常语言错误映射 |
| use-document-destinations | 36→36 | 可管理目的地；只读预览不触发管理查询 |
| use-document-actions | 109→109 | 原单项操作及权威凭证核对 |

目录树、工具栏、列表、选择、键盘/拖放、清单弹窗、批次执行与结果各在同层独立模块；六个旧界面模块已移除。新增 UI 模块最多 53 行，数据库迁移 469 行；关键授权、确认清单、重试及路径分配补有中文注释。README 更新资源管理器操作、权限、接口、迁移、ZIP 限制和验证命令。

## PT5 China 品牌清理

`account.pt5china.com` 的英文文案、产品配置、会话/账号切换命名、测试辅助、脚本、Supabase 项目标识及设计目录统一为 PT5；`pt5china.com` 的本地测试脚本同步 Docker 名称。两仓库源码与配置不区分大小写扫描，旧品牌命中为 0。Git 历史与本地恢复卷保留。

本地旅游实例停止后保留原卷，复制数据库、Storage、Edge 卷到 `PT5-tourism` 后启动。改名前后人员记录为 7，Storage 对象及资料文件均为 0，Storage 卷内容一致；这是原有空 Storage 的保留证明。没有重建空数据库替代原数据。账号夹具脚本只重设本项目专用本地管理员临时密码，凭据不输出到报告。

品牌用例从真实登录、注册及管理员工作台检查英文 PT5，覆盖 1440、768、390px，复用 `localhost:3001`。管理员登录后等待订单中心的实际订单内容，再刷新检查与截图，最终 1/1 通过。README 补充品牌命名、本地卷迁移和 `node scripts/test-pt5-brand-local.mjs` 命令。PT5 China 本次范围仅为品牌清理与对应验证；官网本次只修改测试脚本，PowerShell 语法检查适用，不涉及其页面构建。

## 上传与 Cloud 核验

按 `baisheng-upload` 发布本次确认的文件。Global 使用当前远端仓库 `huochai23333/account.pt5global.com` 及相邻 `PT5-dropshipping-supabase`；China 使用 `account.pt5china.com` 和 `pt5china.com`。官网远端原有 25 个新提交先保留，本次仅将独立测试脚本提交重放到最新 `main`，没有覆盖远端工作。源码/配置再次扫描，两个 China 仓库旧品牌命中仍为 0。暂存清单检查没有环境文件、密钥、登录会话或生成的大型产物。

资料库迁移先在本地 Docker 验证，再上传到已核实的 `PT5-dropshipping` Cloud 项目 `ehzveltsktfusrhtgzqt`。预演仅包含 `20261009091636_document_explorer.sql`，正式执行使用 `npx supabase db push --include-all --yes --skip-vault`；不上传种子、角色或 secrets。上传后 208 个 Local/Remote 迁移版本完全一致。12 个创建或修改函数，以及已有公开模板包装函数，定义指纹和授权与本地一致；匿名执行全部为 false，完成文件登记接口仅供服务身份使用。批次表 RLS 已开启，当前权限策略存在，登录身份仅 SELECT，匿名身份没有访问权限。

| 原有资料 | 发布前后数量 | 原字段完整指纹（前后相同） |
| --- | --- | --- |
| 目录 | 260 | `72e7ffb2d1869340eecddef89eab0c37` |
| 上传文件 | 13 | `9f66811cf70e36e95447bbbdae964db3` |
| 模板文档 | 15 | `2a4909712f69e12ac2e02a3bb83ca772` |

目录指纹排除本次新增的空删除保护字段；文件和模板核对全部字段。Cloud 批次及删除保护均为 0。本次 Cloud 核验为授权、结构及原资料完整性的只读核对；没有在生产创建测试资料，也不将本地页面写入验收描述为生产页面验收。

上传前 lint 指出了空数组初值的隐式类型转换，已补明确类型，三份 SQL 回归再次通过；本次资料库函数的 lint 提示已清除，既有汇率函数的未使用变量提示保持原状。Cloud security advisors 对 8 个公开受控入口提示[登录身份可执行 SECURITY DEFINER 函数](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)，这是需要审查的权限边界：入口均固定空 search_path、撤销匿名执行，并在函数内核对账号、目录管理权限及版本；已通过本地直接写表拒绝与权限撤回回归。该提示没有被隐藏，也没有将全库 advisors 宣称为零提示；其他提示涉及现有系统范围。

Supabase GitHub 提交为 `c1d360d`；China 后台为 `b056b01`，官网为 `c92def2`，均已核对远端 `main` 与本地提交一致。Global Web 在上述 Cloud 核验后发布；其准确提交编号以本次 GitHub `main` 为准。China 本次 `supabase/config.toml` 只改本地 `project_id`，没有 Cloud 数据库或配置变更，故无需发布 China Cloud；没有新增 China 资料库板块。

## 交付边界

本地页面、数据库与对象核对、Cloud 迁移和 GitHub 推送分别记录。整个网站的无关 E2E 未全量执行，新的资料库范围不推导为全站验收。Edge 函数/调度、邮件及第三方供应商本次没有改动或另行发布。`main` 推送可能触发 Hostinger 自动构建；GitHub 查询没有相应部署记录或构建状态，不能判定网站已部署成功，Hostinger 后台、生产页面与公开网站完整验收仍待单独确认。两个 Web 项目分别只运行一个开发服务器，保留验收服务方便继续检查。
