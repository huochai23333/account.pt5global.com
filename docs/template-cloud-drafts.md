# 云端草稿与 Windows 式另存为验收

本次修改选择 `web-change-quality-gate` 的关键写入路线：草稿保存、删除、首次另存为和正式副本均改变业务记录，需要真实页面操作、终态凭证、独立数据库读取与刷新确认。

## 使用流程

- 公司模板 → 新建文档 → 直接制作云端草稿；停止输入约一秒自动保存，仅本人可见。“我的草稿”提供搜索、继续制作和确认删除。
- 草稿 → 保存或另存为 → Windows 式位置弹窗 → 当前目录内正式文档沿用草稿编号，固定模板版本和最新填写内容同时写入；草稿移除。
- 正式文档 → 保存／Ctrl+S → 更新当前位置，保持窗口；另存为／Ctrl+Shift+S → 创建独立副本。草稿和正式模板窗口内部也支持快捷键。
- 我的文档 → 单条模板另存一份 → 同一个另存为弹窗；整夹复制、移动、文件上传和 ZIP 下载沿用原权限及内容保护。

路径左侧只显示当前有管理权限的目录；单击选中、双击进入，位置是当前打开的目录，底部显示完整路径。树与文件名不随右侧请求卸载；右侧独立加载、失败可重试。默认位置使用发起制作的文件夹或本人资料文件夹，服务端重新确认。同目录内模板名称忽略大小写冲突时提示改名。

## 数据与权限

迁移 `20261012094032_template_document_drafts.sql` 新增 `company_template_document_drafts`、`company_template_draft_operations` 与受控写入函数。草稿、正文和操作凭证均仅本人读取，管理员不扩权；客户拒绝。普通账号不能直接写表。草稿的模板版本固定，停用或更新模板不影响原草稿正文读取。

首次另存为在事务内锁定草稿修订和目标，插入含内容的正式记录后移除草稿，两步分别要求实际影响一行；任一步失败回滚。不存在先建空文档的步骤。原操作编号、请求指纹及持久凭证支持重试；未确认结果时文件名和位置固定，防止显示的目的地与原请求不一致。服务端独立读回操作凭证和记录，客户端再次核对编号、修订、指纹和内容。转正凭证在每次读取／重试时还检查当前正式目录管理权。草稿不参与正式目录计数或搜索。

## 本地验证

复用唯一的 Global 开发服务器 `http://localhost:3000`，使用已安装 Chrome 和本地 Docker Supabase。未重置现有数据库；新增迁移从前置结构重新完整执行并回滚验证，函数定义指纹与实际本地定义核对。七组 SQL 断言全部通过：`template_document_drafts`、`template_document_folder_boundaries`、`document_unified_folder`、`document_personal_copy`、`document_library_grants`、`document_explorer`、`company_template_documents`。

草稿断言包含直接写表拒绝、管理员／客户隔离、固定版本、同名冲突、原子转正、重复操作、旧修订、目标管理权撤回以及权限撤回后原转正请求和凭证读取拒绝。所有故障夹具仅在本地且事务回滚或按本次编号清理。

累计 37 个不同 Playwright 用例全部通过，覆盖四个目录／草稿文件和七个原模板回归文件。最终原模板与草稿组合运行 25 通过、0 失败、0 跳过；最终新草稿／响应丢失／冲突复验 9 通过、0 失败、0 跳过；之后针对响应丢失与新窗口修订的组合边界再次验证，2 通过、0 失败、0 跳过，结果见下方凭证。真实页面包含普通保存不弹窗、首次保存、父页及模板内 Ctrl+S／Ctrl+Shift+S、跨浏览器恢复、新建目录、深层长路径、单击／双击、历史与搜索、取消、只加载右侧、503 后可见重试、草稿删除、客户拒绝、旧窗口冲突、断网、数据库行锁超时和零行写入。

保留原有报价／发票 HTML，动态产品行、图片、打印设置、闭包行、选择、对话框回答及计算的保存与刷新均通过。整夹复制／移动、搜索、右键、选择、分页清空选择、实际 ZIP 的路径和字节及递归删除也已回归。

生产构建、全项目 ESLint（0 错误／0 警告）及后续修改模块的 ESLint、类型、双语键、工作台结构、43 项操作契约、内容沙箱和 16 项本地夹具准入测试均通过。桌面 1440px 与窄屏 390／320px 实际截图已检查；深层长路径独立滚动，文件名及操作按钮保持可见，根页面无横向溢出。草稿完整流程 `pageErrors=[]`，关键页面无框架错误覆盖层。

开发过程的失败已保留记录并修正：跨档案列表错误地使用本人档案，草稿错误键被转为通用提示，旧弹窗选择器，以及保存未结束就比较源内容的时序断言。一次独立读取连接重置使用至多两次 GET 网络重试，写入不重开操作；热更新期间一次请求序列断言失败，固定代码后局部复跑通过。故意改变本次副本的真实归档位置能使独立断言失败，恢复原位置后刷新通过；零行插入故障同样被识别并回滚。


## 本地业务凭证

以下是实际页面操作后独立读取的测试记录；本次夹具在核对和刷新完成后清理。

- 草稿／首次正式文档同编号 `ddabc467-9697-4ef6-9c42-877e04a70bc6`；正式修订 `1`，固定版本 `a3200000-0000-4000-8000-000000000003`，目标目录 `efd88a42-5e8d-422d-b932-bb0a1e614628`。草稿移除、跨浏览器恢复及刷新后的内容均一致。
- 内容 SHA-256 `39405de050ced913d3911edf41aaed8fa8349cbf16dc9720c3f344d4c5ff27ab`，另存副本 `b9e21d08-afcc-4044-a11a-2ce489a555de`，源记录编号、内容和位置保持不变。
- 行锁超时／真实断网的草稿 `a0a7f197-cd8c-4d1b-b37f-f2159fceee2c`，最终修订 `4`；人工重试和联网续办分别使用原操作 `a650e7c9-ee1a-46b5-a894-8f135043adfe`、`7491fa7b-aa07-47cf-a7cb-21415c16b9bb`，每项持久凭证恰好一条，刷新后仍是同一草稿。

故障覆盖包括：实际插入触发器返回 0 行，事务回滚并保留草稿；修改副本的归档位置后独立断言失败，再恢复并刷新；正式和草稿另存响应丢失重试同一个请求，结果不明确时禁止改文件名或目的地。旧请求已成功但另一窗口随后更新时，服务器将旧回执识别为修订冲突，停止自动提交并保留当前填写内容。

## Cloud 核对及上传

Supabase 代码提交 `fbf92e1a76a00f140fe8c7ca8a48d157157d83d7` 和验收说明提交 `81b6c0c1ebdbea1c3de513775f08591ef77afa76` 已推送 `origin/main` 并核对远端 SHA。唯一待发布的迁移为 `20261012094032_template_document_drafts.sql`，已通过 CLI 应用到 `ehzveltsktfusrhtgzqt`（PT5-dropshipping / ap-south-1），文件与 Cloud 212 个版本逐项一致。Web 依赖代码在此契约核对之后上传，最终提交编号由交付消息独立报告。

六个相关函数定义与本地完整迁移指纹逐项一致。两张新表均启用 RLS；普通账号只能读授权记录，直接插入／修改／删除及匿名读取均不可用。Cloud 草稿和操作凭证当前各为零，此结果只证明本次结构交付，不代替非空草稿的公网页面验收。

| 原资料 | 发布前／后数量 | 全字段有序指纹（前后相同） |
| --- | --- | --- |
| archives | 125 / 125 | `f69bee826a28f8f9877082f5cf016e1d` |
| folders | 126 / 126 | `5e2807479a0cd45a3aff27fcc943e01b` |
| documents | 7 / 7 | `34ae093b271aaa9ea20623782501b36e` |
| files | 0 / 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| storage | 0 / 0 | `d41d8cd98f00b204e9800998ecf8427e` |

Cloud 顾问针对本次对象有一个可由登录账号调用 `SECURITY DEFINER` 的警告：[0029 检查说明](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)。这是受控草稿写入入口，内部草稿函数执行权不授予普通账号，固定空搜索路径，并核对本人、当前角色／状态、修订和目标管理权；本地负例已证明越权与直接写表被拒绝，未将该告警当作“零警告”交付。六个新索引为首次发布的“尚未使用”提示：[0005 检查说明](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)，保留用于本人分页、固定版本、外键整理和同名查询。没有发现本次对象缺少 RLS、策略、外键索引或无固定搜索路径的问题。

## 模块边界与行数

新行为位于同层独立模块：草稿模型／请求／数据库读回；草稿列表；串行保存调度；转正；目录与历史；目录树；右侧列表；新建目录写入；文件名表单；路径工具栏和弹窗。Page 与 Client 只组装及调度。关键数据流、权限、去重和取消处理补充中文注释。没有新增超过 500 行的文件。

| 核心文件 | 修改前 → 后行数 |
| --- | --- |
| `app/(company-templates)/[workspace]/company-templates/page.tsx` | 26 → 28 |
| `app/(document-library)/[workspace]/documents/drafts/[draftId]/page.tsx` | 0 → 9 |
| `app/api/company-template-document-drafts/[draftId]/content/route.ts` | 0 → 14 |
| `app/api/company-template-document-drafts/[draftId]/route.ts` | 0 → 4 |
| `app/api/company-template-document-drafts/route.ts` | 0 → 7 |
| `app/api/company-template-documents/destinations/route.ts` | 11 → 12 |
| `app/api/company-template-documents/save-as/route.ts` | 0 → 16 |
| `components/dashboard/company-templates/company-templates-client.tsx` | 58 → 62 |
| `components/dashboard/company-templates/documents/document-actions.tsx` | 27 → 32 |
| `components/dashboard/company-templates/documents/document-create-button.tsx` | 26 → 17 |
| `components/dashboard/company-templates/documents/document-editor.tsx` | 50 → 49 |
| `components/dashboard/company-templates/documents/document-save-as-dialog.tsx` | 0 → 30 |
| `components/dashboard/company-templates/documents/draft-editor.tsx` | 0 → 28 |
| `components/dashboard/company-templates/documents/draft-list.tsx` | 0 → 11 |
| `components/dashboard/company-templates/documents/save-as-files.tsx` | 0 → 15 |
| `components/dashboard/company-templates/documents/save-as-name-form.tsx` | 0 → 10 |
| `components/dashboard/company-templates/documents/save-as-navigation.tsx` | 0 → 18 |
| `components/dashboard/company-templates/documents/save-as-new-folder.tsx` | 0 → 13 |
| `components/dashboard/company-templates/documents/save-as-tree.tsx` | 0 → 18 |
| `components/dashboard/company-templates/documents/use-document-actions.ts` | 26 → 27 |
| `components/dashboard/company-templates/documents/use-document-folder-save.ts` | 18 → 0 |
| `components/dashboard/company-templates/documents/use-document-frame.ts` | 39 → 44 |
| `components/dashboard/company-templates/documents/use-document-keyboard.ts` | 0 → 7 |
| `components/dashboard/company-templates/documents/use-document-save.ts` | 87 → 78 |
| `components/dashboard/company-templates/documents/use-draft-list.ts` | 0 → 12 |
| `components/dashboard/company-templates/documents/use-draft-promotion.ts` | 0 → 19 |
| `components/dashboard/company-templates/documents/use-draft-save.ts` | 0 → 86 |
| `components/dashboard/company-templates/documents/use-save-as-browser.ts` | 0 → 22 |
| `components/dashboard/company-templates/documents/use-save-as-folder-create.ts` | 0 → 16 |
| `components/dashboard/dashboard-dialog.tsx` | 0 → 285 |
| `components/dashboard/document-library/document-library-client.tsx` | 44 → 45 |
| `components/dashboard/document-library/explorer-template-save-as.tsx` | 0 → 13 |
| `lib/company-templates/documents/api.ts` | 35 → 36 |
| `lib/company-templates/documents/client.ts` | 13 → 13 |
| `lib/company-templates/documents/draft-api.ts` | 0 → 20 |
| `lib/company-templates/documents/draft-client.ts` | 0 → 15 |
| `lib/company-templates/documents/draft-model.ts` | 0 → 8 |
| `lib/company-templates/documents/draft-repository.ts` | 0 → 32 |
| `lib/company-templates/documents/frame-bridge.ts` | 33 → 35 |
| `lib/company-templates/documents/repository.ts` | 47 → 47 |

## 交付边界

本地浏览器、Docker 数据库、GitHub 上传、Cloud 迁移及网站部署分别记录。Cloud 本次只应用迁移并只读核对契约和原资料；不以本地页面结果宣称公网写入验收。网站部署和公网页面操作本次未执行，需单独交付。异步外部消息、AI 与付款不在本次范围；草稿操作是单条原子事务，失败回滚，整夹部分失败仍使用现有 `partial_failed` 路径。
