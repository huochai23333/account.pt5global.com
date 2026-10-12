# 个人资料工作区本地验证

## 交付范围

2026-10-12，当前 Web 与相邻 Supabase 仓库的本地实现。采用 `web-change-quality-gate` 的关键写入路线：人员目录归档、文件/整夹复制、模板跨目录保存及客户访问权会改变真实数据和权限。本地阶段完成时尚未发布；2026-10-12 上传核对见文末。

人员档案默认只有一个“个人文件夹”。本人及管理员管理其中全部内容；默认根目录本身受保护。客户身份不使用资料库，工作栏、个人资料页、直接页面、接口、正文、目录、版本和操作凭证均不得开放。客户业务档案的内部/共享目录继续服务获授权内部岗位，确认文字也说明内部人员范围。

## 页面与业务凭证

| 真实操作 | 最终核对 |
| --- | --- |
| 资料库首页新建文件夹、空白处与目录树右键新建 | 独立读取父目录、新目录编号及版本；刷新仍显示同一条目 |
| 当前目录“新建文档”进入模板 | 网址携带当前目录，创建前弹窗默认选中，服务端另行授权 |
| 模板每次保存选择任意可管理文件夹 | 管理员返回目录集合与数据库全部目录编号集合一致；跨人员深层目录保存后核对文档编号、位置、修订与内容哈希；刷新重开内容一致 |
| 人员内部目录归入个人目录 | 自建目录及资料编号不变，根/子文件实际字节和对象路径不变，模板固定版本及内容哈希不变，修订递增；同名子目录改序号，编号不变；本人随后可编辑管理员创建的文档 |
| 文件复制、整夹复制及 Ctrl+C/V | 新资料编号、新对象路径和实际字节；整夹层级、新模板编号、原模板版本及内容；来源版本、位置、对象不变 |
| 复制响应丢失后刷新续办 | 原批次先完成 10 项，刷新读取同编号，只完成剩余 5 项；15 项成功含 2 个文件夹、12 个文件、1 份模板；重复提交原请求没有新增副本 |
| 缺失来源对象 | 返回部分失败，保留已完成目录/文件；恢复真实来源对象后续办原批次，没有重复目录 |
| 客户直接访问共享资料 | 页面无资料/编辑窗口；接口拒绝；真实登录客户端的目录和模板表查询为空，旧内容地址和批次也不能绕过 |

归档迁移用例在尚有人员内部目录时实际执行过，1 项通过。它建立真实根文件、子目录文件、同名目录及管理员文档，迁移后另查数据库与 Storage，再由本人在页面继续编辑。已归档数据库再次执行该用例会明确跳过，不将跳过作为新的迁移证据。

安全凭证保存在忽略的 `output/`：`personal-folder-migration-evidence.json`、`workspace-copy-evidence.json`、`workspace-save-evidence.json`、`workspace-new-evidence.json`、模板与资源管理器既有独立核对记录。复制批次示例 `568b61ce-e94f-4652-8323-122854ed26f3`，完成 15 项；新根目录 `ac9c37f5-5dc1-44bc-be73-7b78a7b518d5`，新模板 `0fd90e74-92d8-7ea5-c885-e1aae40ebe56`。保存示例文档 `a0ea652a-b6dd-42b4-800d-5eadde267153`，管理员目的地 30 个与当时权威集合一致。这些是测试时生成的凭证，夹具已按随机前缀清理，不作为生产数据。

## 验证与异常边界

- 复用唯一的 localhost:3000 开发服务器，真实 Chrome 页面登录；数据库与 Storage 独立读取，不用模拟页面或静态渲染替代。
- 资料库核心 9 项最终回归全部通过；随后新增同名目录改名重试也通过。当前核心共 10 项：工作区 3、复制异常 3、资料库读写 2、局部加载 2。最终复制相关 6 项再次全部通过，0 失败、0 跳过。
- 扩展 16 项首轮 14 通过、2 失败：原测试仍使用旧搜索标签和客户正文拒绝的旧预期。更新为当前标签及拒绝结果后，两项实际重跑通过。
- 新增首页/目录树新建及客户个人资料入口实际回归通过。首页新建测试初版点击坐标超出左栏、且使用了工具栏的旧按钮名称；修正为实际边界内的右键点击和菜单名称后通过，没有强制点击或模拟页面。菜单按实际高度限制在窗口内，随后追加 1440/390/320px 边界检查。
- 文件拖入、条目拖放、F2、Shift/Ctrl 多选、剪切粘贴、整树跨人员移动、真实 ZIP 条目/路径/字节、模板继续编辑/另存/移动/删除、排序分页清选择、长路径回归均实跑。
- 删除清单变化重新确认、删除零行部分失败及原清单续办、移动批次响应丢失/重复提交、管理权撤回后批次及内容地址拒绝、缺失 ZIP 对象拒绝交付、同名文件夹冲突均实跑。
- 同名文件夹在建立批次前拒绝，同一弹窗可直接改名，沿用同一操作编号完成；独立核对最初没有建立冲突批次，改名后同编号成功，新目录与两份原目录均完整保留。
- 新复制模块不绕过原上传完成检查：先读来源字节并核对哈希，再由数据库保留新操作编号；新对象与登记完成后持久化原凭证，完成批次再独立核对新记录及新对象。
- 输入框的编辑快捷键保留；复制清单异步载入期间名称输入禁用，避免默认名覆盖用户输入。模板窗口重建完成前保存确认禁用，防止尚未恢复正文时提交。

页面错误与框架覆盖层在工作区和模板回归中检查；工作区记录 `pageErrors: []`。控制台运行器出现已有颜色环境变量和 Node 模块格式提示，未据此改动环境配置。首页新建回归另收集浏览器的 error/warning，`consoleProblems: []`，框架覆盖层为 0，并核对刷新。桌面 1440px，目录弹窗窄屏 390/320px，模板归档弹窗 375px，另有资源管理器长名称/路径及分页检查。实际查看 `workspace-save-folder-1440.png`、`workspace-save-folder-320.png` 和 `workspace-context-menu-320.png`，路径可横向滚动，完整保存位置换行，操作按钮和文字无裁切，页面没有横向溢出。右键菜单在 1440/390/320px 均核对真实边界，窄屏底部删除按钮可见。文件区局部读取和通知收起仍通过原加载回归。

最终按不同用例计数：26 项不同页面用例通过（10 项核心、16 项扩展，旧断言修正后实际重跑），另有 1 项首次迁移通过；没有将重复运行计入不同用例数量。关键命令：

```powershell
npx playwright test tests/e2e/document-library-workspace.spec.ts tests/e2e/document-library-copy-failures.spec.ts tests/e2e/document-library.spec.ts tests/e2e/document-explorer-loading.spec.ts --workers=1
npx playwright test tests/e2e/document-explorer.spec.ts tests/e2e/document-explorer-recovery.spec.ts tests/e2e/company-template-folders.spec.ts --workers=1
# 只重跑修正过的扩展用例及当前工作区
npx playwright test tests/e2e/company-template-folders.spec.ts tests/e2e/document-library-workspace.spec.ts --grep '新建选择目录|管理员创建客户文档|首页新建|右键整夹复制|管理员浏览搜索' --workers=1
# 对新增首页用例追加浏览器控制台和菜单边界核对
npx playwright test tests/e2e/document-library-workspace.spec.ts --grep '首页新建' --workers=1
```

## 数据库本地验证

新增迁移 `20261012090000_personal_document_folders.sql` 与 `20261012090100_document_copy_batches.sql` 在本地 Docker 执行；最终源文件又在事务中完整重建并回滚，验证归档约束、函数、授权与复制批次 DDL 可执行。

6 份事务 SQL 回归均通过并回滚：`document_personal_copy.sql`、`document_explorer.sql`、`company_template_documents.sql`、`template_document_folder_boundaries.sql`、`company_template_usage_capability.sql`、`document_library_grants.sql`。覆盖单一人员根目录、管理员全部管理、伪造复制成功拒绝、循环目录、同名目录、旧版本、客户 RLS 拒绝、直接写表拒绝、共享确认、权限撤回、整树移动、递归删除保护及实际凭证检查。另用未完成批次事务夹具调用实际人员归档迁移文件，确认在改动目录前拒绝执行，连接结束后夹具数量为 0。`supabase db lint --local --level error` 返回空结果。

本地 CLI 自动应用发现 5 个原有历史空缺（20261001072039、20261002053000、20261008133725、20261008165803、20261009020109），没有重置数据库或重放无关迁移。只对本次已经实际执行的两个版本登记为已应用。后续发布必须单独核对 Cloud 历史及定义，先应用并验证这两项迁移，再发布依赖 Web。

## 静态检查、结构与说明

类型、完整 ESLint（无告警）、双语消息键、工作台共享结构、42 项操作契约通过。资料库契约 2 项、文件来源/ZIP 路径/清理单元回归 17 项通过，均无失败与跳过。最终入口改动后的生产构建完成 56 个页面。没有宣称运行整个项目的全量业务测试。

Web README 更新资料库入口、单一人员目录、管理权限、跨档案搜索保存、复制/快捷键/右键、异常续办及迁移前置。Supabase README 更新同一权限与批次模型；既有 SQL 测试的客户读取预期同步为拒绝。历史发布证据保持为相应日期的记录。

Page/Client 继续只组装与调度。目录浏览拆为 `document-folder-browser`，空白菜单拆为 `explorer-background-menu`，新文档入口独立；复制执行与核对分别是 `copy-batches`、`copy-verification`，不扩大页面查询/写入职责。表单/清单在弹窗，选择/剪贴板在专用 hook，目录树只负责导航显示及发出操作意图。关键授权、来源对象、固定编号、确认版本及归档意图均有中文注释。本次变更核心文件均少于 500 行。

| 核心文件 | 改前 → 改后行数 |
| --- | --- |
| `app/(company-templates)/[workspace]/company-templates/page.tsx` | 23 → 26 |
| `app/api/document-library/batch/route.ts` | 14 → 14 |
| `components/dashboard/company-templates/company-template-card.tsx` | 77 → 79 |
| `components/dashboard/company-templates/company-templates-client.tsx` | 56 → 58 |
| `components/dashboard/company-templates/documents/document-create-button.tsx` | 26 → 26 |
| `components/dashboard/company-templates/documents/document-destination-fields.tsx` | 30 → 32 |
| `components/dashboard/company-templates/documents/document-editor.tsx` | 49 → 50 |
| `components/dashboard/company-templates/documents/document-folder-dialog.tsx` | 25 → 26 |
| `components/dashboard/company-templates/documents/use-document-destinations.ts` | 36 → 38 |
| `components/dashboard/document-library/document-entry.tsx` | 18 → 20 |
| `components/dashboard/document-library/document-library-client.tsx` | 43 → 44 |
| `components/dashboard/document-library/explorer-content.tsx` | 15 → 15 |
| `components/dashboard/document-library/explorer-dialog.tsx` | 53 → 46 |
| `components/dashboard/document-library/explorer-items.tsx` | 45 → 45 |
| `components/dashboard/document-library/explorer-menu.tsx` | 16 → 20 |
| `components/dashboard/document-library/explorer-toolbar.tsx` | 54 → 58 |
| `components/dashboard/document-library/explorer-tree.tsx` | 32 → 37 |
| `components/dashboard/document-library/use-explorer-batches.ts` | 34 → 34 |
| `components/dashboard/document-library/use-explorer-controller.ts` | 50 → 53 |
| `components/dashboard/document-library/use-explorer-operations.ts` | 37 → 36 |
| `components/dashboard/document-library/use-explorer-selection.ts` | 21 → 24 |
| `lib/document-library/access.ts` | 22 → 24 |
| `lib/document-library/batch-verification.ts` | 39 → 41 |
| `lib/document-library/batches.ts` | 36 → 38 |
| `lib/document-library/model.ts` | 32 → 32 |
| `lib/document-library/storage-mutations.ts` | 81 → 86 |
| `lib/workspace-config.ts` | 354 → 354 |
| `components/dashboard/company-templates/documents/document-folder-browser.tsx` | 0 → 29 |
| `components/dashboard/document-library/explorer-background-menu.tsx` | 0 → 14 |
| `components/dashboard/document-library/explorer-new-document-link.tsx` | 0 → 11 |
| `lib/document-library/copy-batches.ts` | 0 → 28 |
| `lib/document-library/copy-verification.ts` | 0 → 20 |

## 2026-10-12 上传核对

通过 `baisheng-upload` 上传当前 Web 与相邻 Supabase 的已验证范围。Supabase 首次 GitHub 发布为 `eb8c1508886d7f798c23255a2f820117b9d16747`；迁移预演只含 `20261012090000`、`20261012090100`，正式执行使用 `--skip-vault`，没有发布种子、角色、密钥、Edge Function 或其他配置。210 个版本与仓库一致。后续 SQL 回归与 README 补齐双重档案核对，Supabase 最终远端编号为 `6fd2bba71b6d9ad1c218a916221659c1bbd85b76`，迁移源文件保持不可变。

Cloud 独立读回：13 个员工档案各有一个个人默认目录，人员内部目录为 0；其中 2 个档案关联客户业务，其客户内部/共享区域按原业务权限保留。最初把所有业务根目录都计为个人目录会报告多余目录，改为单独统计个人默认目录并检查关联客户的业务区域；本地 SQL 加入关联客户档案的事务夹具，实际通过后回滚。

保留的 242 个目录编号、归属字段及预期递增版本一致。7 份模板的非位置/修订字段全内容指纹为 `d5ff29dd4889bc5efbe9f84a3ced3ddb`，发布前后相同；预期修订指纹匹配。发布前后上传文件及 Storage 对象均为 0，本次不宣称非空云端文件或 ZIP 的实际字节验收。当前活动客户身份的目录、文件、模板、目的地、批次及两类凭证读取全部为 0；当前活动管理员可见、管理和选择的目录均为 242。资料表 RLS 开启，登录角色没有直接写表权限，匿名没有表或新函数访问权。

6 个函数定义（移除 CRLF 的回车差异）及匿名/登录角色执行权限、2 项约束与本地 Docker 相同。Cloud 的服务角色默认执行授权另保留，内部复制辅助函数不对登录角色开放。Security Advisors 对 3 个新受控写入口保留[登录角色可执行 SECURITY DEFINER 的提示](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)，已核对当前身份、来源及目的地管理权、版本、固定凭证、空 search_path 与匿名拒绝，不宣称整个项目零告警。

Web 的 `main` 推送包含本文及当前界面/接口实现，完成 GitHub 交付后另核对远端编号。Hostinger 部署、正式页面新建/保存/复制、公开域名及 www 跳转验收本次尚未确认；本地浏览器与云端数据库核对不能代替这些页面验收。上传核对只维护发布说明，复用本次已完成的代码验证，未启动第二个开发服务器。
