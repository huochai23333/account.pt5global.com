# 统一资料文件夹验收

人员和客户档案各有一个默认“资料文件夹”，下面可自行建立子目录。管理员管理全部目录；员工管理本人目录，兼有客户关联也不扩大员工目录权限；客户档案沿用内部业务授权，客户账号没有资料库权限。新建、手动保存、另存和移动均选择目标目录后直接提交，自动保存保留当前位置。

迁移 `20261012090101_unified_document_folder.sql` 优先保留已有人员根目录，否则保留原客户内部根目录；其他分区的资料和直属子目录搬入该根目录后移除空容器。文件、模板和自建子目录编号保留，对象地址、固定模板版本和填写内容保留，受影响资料版本递增。重名子目录增加序号，仍保留独立编号。未完成文件操作、整理批次或删除保护存在时迁移拒绝执行。

## 本地验证

采用 `web-change-quality-gate` 的关键写入路线：资料库／模板页面操作 → 有界终态 → 独立 Database、Storage 查询 → 刷新一致。复用唯一的 localhost:3000 开发服务，未重置原 Docker 数据。先回滚演练 SQL，再由迁移专用页面用例准备真实资料并应用迁移；本地登记该迁移版本，未修复或重放其他模块的历史缺口。

29 个不同页面用例最终通过，0 个未解决失败，执行范围没有跳过。首次 23 项回归有 22 通过、1 个测试时序失败：错误提示早于上传控件恢复，测试向禁用控件注入下一份文件；增加可交互等待后，该用例和另外 5 项针对性回归全部通过。一次性迁移用例单独通过；已迁移数据库再次运行会明确跳过，不得把跳过算成重验迁移。

| 执行范围 | 最终证据 |
| --- | --- |
| `document-unified-migration.spec.ts`：1 项 | 原两分区的同名子目录保留 2 个编号；4 份真实上传文件逐字节相同；模板编号、状态指纹和固定版本相同，修订 +1；旧窗口覆盖被拒绝，刷新回到原内容 |
| `company-template-folders.spec.ts`：3 项 | 新建选位置、自动保存、手动换目录、另存、其他员工编辑客户文档、响应丢失沿原编号重试、错误归档断言及取消后旧修订保护 |
| `document-explorer.spec.ts`：7 项 | 导航历史、搜索、整树跨人员移动、多选、键盘、真实 ZIP 路径与字节、模板编辑及递归删除 |
| `document-explorer-recovery.spec.ts`：6 项 | 文件拖入、条目拖动、断线续办、重复提交、删除 0 行为 partial_failed、清单变化重新确认、跨客户移动、权限撤回及缺失对象拒绝 ZIP |
| `document-library.spec.ts`：2 项 | 建目录、同名文件、改名、移动、预览、删除、本人及管理员权限、无业务员工访问 |
| `document-library-permissions.spec.ts`：2 项 | 客户目录唯一、财务／业务员管理、运营只读；客户目录、搜索、正文及 Storage 拒绝；格式、大小、伪回执和重复上传负路径 |
| `document-library-workspace.spec.ts`：3 项 | 首页新建、空白处右键、整夹复制、深层任意目录保存、本人继续编辑、客户页面与接口拒绝 |
| `document-library-copy-failures.spec.ts`：3 项 | 同名目录改名重试、Ctrl+C 与输入框快捷键、缺失对象部分失败后续办 |
| `document-explorer-loading.spec.ts`：2 项 | 仅文件区加载、目录树保留、失败重试、26 项通知折叠、整夹删除终态 |

独立迁移凭证：保留根目录 `6c41db35-473f-421c-83c5-e56149a4c79c`；保留自建目录 `1c817792-5ee2-46f2-af5e-2c67441a7fb8`、`7c69884d-5220-4158-9eee-67c4322be3d9`；模板 `a0584950-6f4f-4263-8d05-0ee87b5c6fc5`，迁移后修订 4，状态 SHA-256 `86cf8e262bb5c18d4e5de17fc88f46c19fdb738cb5f3d5da03e1d7d528e593b6`。夹具已按本次编号和前缀清理，凭证保存在忽略的 output 目录，不上传真实文件内容。

Docker 的 7 份回滚断言：`company_template_documents.sql`、`template_document_folder_boundaries.sql`、`document_explorer.sql`、`document_personal_copy.sql`、`document_unified_folder.sql`、`document_library_grants.sql`、`company_template_usage_capability.sql`。验证整树归属和版本、循环目的地、旧版本、当前授权、客户拒绝、直接表写拒绝、重复初始化以及第二根目录／旧分区插入拒绝。

`npm run lint`、`npm run typecheck`、`npm run check:i18n`、`npm run check:dashboard-ui`、`npm run check:operation-contracts` 和 `npm run build` 全部通过；修正测试后另执行相应 ESLint 与类型检查。Playwright 检查了页面身份、可见最终结果、刷新、框架错误覆盖层、相关页面错误；工作区用例也断言 console 无错误／警告。桌面 1280／1440、窄屏 375／390／320 已检查，长名称、长路径、右键菜单及保存弹窗有截图，页面无横向溢出。模板编辑仍沿用电脑端边界。

README 的模板权限、保存位置、资料库入口及权限表已同步；Supabase README 的初始化、合并和接口说明同步。Page／Client 页面组装未改，查询、保存、选择、弹窗和批次仍在原独立模块，本次只删去分区选择状态，无需新增拆分。

| 修改模块 | 行数（前 → 后） |
| --- | --- |
| 模板 `document-create-button` / `document-destination-fields` / `document-folder-dialog` | 26→26 / 32→31 / 26→26 |
| 模板 `use-document-actions` / `use-document-destinations` / `use-document-save` | 26→26 / 38→35 / 87→87 |
| 资料库 `explorer-batch-results` / `explorer-dialog` / `use-document-actions` | 16→16 / 46→46 / 109→109 |
| 资料库 `use-explorer-batches` / `use-explorer-operations` | 34→34 / 36→36 |
| 模板服务 `api` / `client` / `model` | 36→35 / 13→13 / 21→21 |
| 资料库服务 `http` / `model` | 40→39 / 32→33 |

## 上传边界

通过 `baisheng-upload` 分别核对 Supabase GitHub、Cloud 迁移和 Web GitHub；发布预演仅包含本次迁移，Cloud 先于依赖 Web 上传。网站部署与公开页面写入验收是独立结果，本地测试和 GitHub 推送不能证明线上页面已经更新。本次没有通知外部消息、支付或其他供应商操作，这些负路径不适用。

Supabase 实现提交 `1bc53c34ed4fecf28c01962cc66e972f3d38a477` 已推送 `huochai23333/PT5-dropshipping-supabase` 的 `origin/main`，远端 SHA 独立核对一致。Cloud `ehzveltsktfusrhtgzqt` 已应用本迁移，211 个仓库／远端迁移版本一致；12 个相关函数定义指纹及匿名／登录执行权与本地一致。

Cloud 125 个档案各保留一个默认根目录，总目录由 242 变为 126（125 个默认目录及 1 个自建目录）；旧分区为 0。保留目录的编号、父子位置、名称及预期版本全量指纹为 `60727764fbf87e697ea05b7835df8b7d`，与迁移前计算的结果一致。7 份原模板编号、内容、固定模板版本、预期位置及修订均独立核对一致；内容指纹 `13cd17f679c4029643c1ba9cd819a2aa`。发布时上传文件和对应 Storage 对象均为 0，因此云端空集合核对只证明无新增／遗失，不当作非空云端字节验收；非空保留证据来自本地真实上传。

云端只读事务使用真实 active 身份：管理员能读取、管理及选择全部 126 个目录，看到 7 份模板；客户的目录、文件、模板、目的地、整理批次及两类操作凭证均为 0。Security Advisors 对 7 个当前登录用户可执行的受控入口保留 [SECURITY DEFINER 审查提示](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)，已核对空 search_path、匿名拒绝、当前权限和版本保护，未宣称零提示。

Web 实现及本报告随同一个 `origin/main` 提交上传；提交与远端 SHA 在交付时独立核对。网站部署和公开页面写入验收尚未验证，本次没有触发 Hostinger 手动部署，阻断原因是该独立目标不在本次上传范围。
