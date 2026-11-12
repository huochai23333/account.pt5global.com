# 我的文档与资料文件夹

当前范围：共享。

## 业务与阅读顺序

管理员工和客户档案中的文件夹、上传文件和模板文档。

数据流：文件浏览器 → 目录/批次服务 → 数据库清单与版本 → Storage 核对 → 终态。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

员工本人/管理员与内部客户档案授权分别判断；客户账号不能使用此资料库。

完成依据：文件/目录编号、批次终态、对象字节/大小与登记一致；部分完成为 partial_failed。

## 常见维护

沿[资料库的上传、批量操作与权限](../explanation/document-library-flow.md)定位请求、凭证和权限。移动、复制和删除使用固定操作编号与版本。

验证入口：npm run test:document-upload-recovery。浏览器用例包括 document-library-preview、document-library-archive-download、document-library-batch-upload-recovery、document-library-upload-recovery、document-library-batch-move、document-library-batch-interruption 和 wholesale-customer-document-upload-race。后端使用 document_* SQL 测试。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`document_batch_finish`、`document_batch_release`、`document_batch_step`、`document_copy_entry`、`document_copy_result`、`document_explorer_manifest`、`document_explorer_read`、`document_library_claim_cleanup_run`、`document_library_command`、`document_library_finish`、`document_library_finish_cleanup_target`、`document_library_read`。

源码中直接引用的数据表/存储桶：`document-library`、`document_batches`、`document_files`、`document_folders`、`document_operations`、`internal_job_request_secrets`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/document-cleanup.test.mjs](../../../scripts/document-cleanup.test.mjs)
- [web: scripts/document-library-origin.test.mjs](../../../scripts/document-library-origin.test.mjs)
- [web: scripts/learning/document-cleanup-local-port.test.mjs](../../../scripts/learning/document-cleanup-local-port.test.mjs)
- [web: tests/contracts/document-library.spec.ts](../../../tests/contracts/document-library.spec.ts)
- [web: tests/e2e/document-explorer-loading.spec.ts](../../../tests/e2e/document-explorer-loading.spec.ts)
- [web: tests/e2e/document-explorer-preview.spec.ts](../../../tests/e2e/document-explorer-preview.spec.ts)
- [web: tests/e2e/document-explorer-recovery.spec.ts](../../../tests/e2e/document-explorer-recovery.spec.ts)
- [web: tests/e2e/document-explorer.spec.ts](../../../tests/e2e/document-explorer.spec.ts)
- [web: tests/e2e/document-library-boundaries.spec.ts](../../../tests/e2e/document-library-boundaries.spec.ts)
- [web: tests/e2e/document-library-cleanup.spec.ts](../../../tests/e2e/document-library-cleanup.spec.ts)
- [web: tests/e2e/document-library-copy-failures.spec.ts](../../../tests/e2e/document-library-copy-failures.spec.ts)
- [web: tests/e2e/document-library-faults.spec.ts](../../../tests/e2e/document-library-faults.spec.ts)
- [web: tests/e2e/document-library-linking.spec.ts](../../../tests/e2e/document-library-linking.spec.ts)
- [web: tests/e2e/document-library-permissions.spec.ts](../../../tests/e2e/document-library-permissions.spec.ts)
- [web: tests/e2e/document-library-personal-migration.spec.ts](../../../tests/e2e/document-library-personal-migration.spec.ts)
- [web: tests/e2e/document-library-workspace.spec.ts](../../../tests/e2e/document-library-workspace.spec.ts)
- [web: tests/e2e/document-library.spec.ts](../../../tests/e2e/document-library.spec.ts)
- [web: tests/e2e/helpers/document-explorer.ts](../../../tests/e2e/helpers/document-explorer.ts)
- [web: tests/e2e/helpers/document-library-page.ts](../../../tests/e2e/helpers/document-library-page.ts)
- [web: tests/e2e/helpers/document-library.ts](../../../tests/e2e/helpers/document-library.ts)
- [web: tests/learning/document-library-archive-download.spec.ts](../../../tests/learning/document-library-archive-download.spec.ts)
- [web: tests/learning/document-library-batch-interruption.spec.ts](../../../tests/learning/document-library-batch-interruption.spec.ts)
- [web: tests/learning/document-library-batch-move.spec.ts](../../../tests/learning/document-library-batch-move.spec.ts)
- [web: tests/learning/document-library-batch-upload-recovery.spec.ts](../../../tests/learning/document-library-batch-upload-recovery.spec.ts)
- [web: tests/learning/document-library-preview.spec.ts](../../../tests/learning/document-library-preview.spec.ts)
- [web: tests/learning/document-library-upload-recovery.spec.ts](../../../tests/learning/document-library-upload-recovery.spec.ts)
- [web: tests/learning/wholesale-customer-document-upload-race.spec.ts](../../../tests/learning/wholesale-customer-document-upload-race.spec.ts)
- [supabase: supabase/tests/document_cleanup_retry.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_cleanup_retry.sql)
- [supabase: supabase/tests/document_explorer.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_explorer.sql)
- [supabase: supabase/tests/document_library_grants.sql](../../../../PT5-dropshipping-supabase/supabase/tests/document_library_grants.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(document-library)/[workspace]/documents/drafts/[draftId]/page.tsx](../../../app/%28document-library%29/%5Bworkspace%5D/documents/drafts/%5BdraftId%5D/page.tsx) | 已审保留：根据工作台和编号组装草稿编辑页；草稿转正后显示正式文档入口 |
| [app/(document-library)/[workspace]/documents/layout.tsx](../../../app/%28document-library%29/%5Bworkspace%5D/documents/layout.tsx) | 已审保留：校验工作台访问；装配资料库布局和文案 |
| [app/(document-library)/[workspace]/documents/page.tsx](../../../app/%28document-library%29/%5Bworkspace%5D/documents/page.tsx) | 已审保留：解析资料位置；读取首屏并组装浏览器 |
| [app/(document-library)/[workspace]/documents/templates/[documentId]/guide/page.tsx](../../../app/%28document-library%29/%5Bworkspace%5D/documents/templates/%5BdocumentId%5D/guide/page.tsx) | 已审保留：读取已授权正式文档和指南可用性；组装固定版本指南框架 |
| [app/(document-library)/[workspace]/documents/templates/[documentId]/page.tsx](../../../app/%28document-library%29/%5Bworkspace%5D/documents/templates/%5BdocumentId%5D/page.tsx) | 已审保留：读取已授权正式模板文档；按当前版本组装编辑器 |
| [app/api/document-library/batch/route.ts](../../../app/api/document-library/batch/route.ts) | 已审保留：按会话处理批次读取、提交和结束请求 |
| [app/api/document-library/download/route.ts](../../../app/api/document-library/download/route.ts) | 已审拆分：核对当前会话与请求来源；调度真实 ZIP 交付和错误转换 |
| [app/api/document-library/files/[id]/content/route.ts](../../../app/api/document-library/files/%5Bid%5D/content/route.ts) | 已审拆分：读取当前可见的已就绪文件；选择下载或安全预览响应 |
| [app/api/document-library/manifest/route.ts](../../../app/api/document-library/manifest/route.ts) | 已审拆分：校验会话与请求体并读取清单 |
| [app/api/document-library/reconcile/route.ts](../../../app/api/document-library/reconcile/route.ts) | 已审保留：读回原操作凭证；继续核对原操作并映射结果 |
| [app/api/document-library/route.ts](../../../app/api/document-library/route.ts) | 已审保留：读取资料库目录与搜索结果；调度受限命令和核对回执 |
| [app/api/document-library/upload/route.ts](../../../app/api/document-library/upload/route.ts) | 已审拆分：校验登录和请求来源；读取有大小上限的上传表单；调度上传与映射结果 |
| [components/dashboard/document-library/document-entry.tsx](../../../components/dashboard/document-library/document-entry.tsx) | 已审保留：构建客户或人员资料入口 |
| [components/dashboard/document-library/document-library-client.tsx](../../../components/dashboard/document-library/document-library-client.tsx) | 已审保留：组装资料浏览器和分页；显示操作结果与待核对记录；组装当前操作弹窗 |
| [components/dashboard/document-library/document-pending-operations.tsx](../../../components/dashboard/document-library/document-pending-operations.tsx) | 已审保留：合并原操作和本机断线意图；显示操作状态并提供核对入口 |
| [components/dashboard/document-library/document-upload-results.tsx](../../../components/dashboard/document-library/document-upload-results.tsx) | 已审保留：呈现上传汇总和逐文件结果 |
| [components/dashboard/document-library/explorer-background-menu.tsx](../../../components/dashboard/document-library/explorer-background-menu.tsx) | 已审保留：在文件区空白处打开菜单；让输入框保留自身的右键处理 |
| [components/dashboard/document-library/explorer-batch-results.tsx](../../../components/dashboard/document-library/explorer-batch-results.tsx) | 已审保留：展示每批和逐项处理状态；调度继续核对和结束操作 |
| [components/dashboard/document-library/explorer-content.tsx](../../../components/dashboard/document-library/explorer-content.tsx) | 已审保留：展示文件区加载、失败和内容；承接文件拖放事件 |
| [components/dashboard/document-library/explorer-dialog.tsx](../../../components/dashboard/document-library/explorer-dialog.tsx) | 已审拆分：组装预览和批次确认入口；展示确认表单、数量和目的地；提交原操作编号并显示错误 |
| [components/dashboard/document-library/explorer-helpers.ts](../../../components/dashboard/document-library/explorer-helpers.ts) | 已审保留：把列表实体转成编号与版本目标；解析可见目录和行的展示信息 |
| [components/dashboard/document-library/explorer-inline-name.tsx](../../../components/dashboard/document-library/explorer-inline-name.tsx) | 已审保留：管理名称输入焦点和选区；分隔输入法、Enter、Escape 和文件区事件 |
| [components/dashboard/document-library/explorer-items.tsx](../../../components/dashboard/document-library/explorer-items.tsx) | 已审保留：呈现列表或网格条目与行内编辑；把选择和打开操作交给外部；连接条目的拖放和快捷菜单 |
| [components/dashboard/document-library/explorer-location-bar.tsx](../../../components/dashboard/document-library/explorer-location-bar.tsx) | 已审拆分：显示浏览器历史、上一级与可见路径；保持长面包屑位置可滚动 |
| [components/dashboard/document-library/explorer-menu.tsx](../../../components/dashboard/document-library/explorer-menu.tsx) | 已审保留：按目标和可用能力渲染菜单项；管理位置、焦点和键盘导航 |
| [components/dashboard/document-library/explorer-new-document-link.tsx](../../../components/dashboard/document-library/explorer-new-document-link.tsx) | 已审保留：打开公司模板并预选当前文件夹 |
| [components/dashboard/document-library/explorer-preview-dialog.tsx](../../../components/dashboard/document-library/explorer-preview-dialog.tsx) | 已审拆分：控制预览加载、失败和重试；显示浏览器原生图片或 PDF |
| [components/dashboard/document-library/explorer-template-save-as.tsx](../../../components/dashboard/document-library/explorer-template-save-as.tsx) | 已审保留：复用模板另存为对话框；固定复制编号并在失败时保留同一意图 |
| [components/dashboard/document-library/explorer-toolbar.tsx](../../../components/dashboard/document-library/explorer-toolbar.tsx) | 已审拆分：提交搜索和排序条件；切换列表或网格；显示文件管理命令及上传入口 |
| [components/dashboard/document-library/explorer-tree.tsx](../../../components/dashboard/document-library/explorer-tree.tsx) | 已审保留：递归呈现当前可见目录和折叠状态；调度目录导航、右键和拖放移动 |
| [components/dashboard/document-library/folder-label.ts](../../../components/dashboard/document-library/folder-label.ts) | 已审保留：为系统目录提供本地化标签 |
| [components/dashboard/document-library/use-document-actions.ts](../../../components/dashboard/document-library/use-document-actions.ts) | 已审拆分：维护账号内的待核对操作；调度单项及上传批次；更新每份结果并刷新 |
| [components/dashboard/document-library/use-document-explorer.ts](../../../components/dashboard/document-library/use-document-explorer.ts) | 已审保留：按当前资料位置读取数据；维护请求顺序与浏览器历史 |
| [components/dashboard/document-library/use-explorer-batches.ts](../../../components/dashboard/document-library/use-explorer-batches.ts) | 已审保留：维护批次交互状态与原编号；协调分段提交和独立读回 |
| [components/dashboard/document-library/use-explorer-commands.ts](../../../components/dashboard/document-library/use-explorer-commands.ts) | 已审拆分：调度打开、导航和新建；按选中目标生成改名、剪贴板或批次意图 |
| [components/dashboard/document-library/use-explorer-controller.ts](../../../components/dashboard/document-library/use-explorer-controller.ts) | 已审拆分：组装查询、选择、编辑和操作状态；接收键盘与外部拖入事件；调度确认和恢复后的选中状态 |
| [components/dashboard/document-library/use-explorer-manifest.ts](../../../components/dashboard/document-library/use-explorer-manifest.ts) | 已审拆分：读取当前选择的确认清单；管理取消、加载失败和复制默认名称 |
| [components/dashboard/document-library/use-explorer-operations.ts](../../../components/dashboard/document-library/use-explorer-operations.ts) | 已审拆分：将单项改名交给对应服务；调度批次提交；管理下载状态与错误 |
| [components/dashboard/document-library/use-explorer-selection.ts](../../../components/dashboard/document-library/use-explorer-selection.ts) | 已审保留：维护可见项的选中与范围；按账号保存复制和剪切意图 |
| [components/dashboard/document-library/use-inline-naming.ts](../../../components/dashboard/document-library/use-inline-naming.ts) | 已审保留：管理行内名称和同步提交锁；跟踪创建或改名原操作直到确认 |
| [lib/document-library/access.ts](../../../lib/document-library/access.ts) | 已审保留：核对资料库工作台身份；为资料接口建立请求客户端 |
| [lib/document-library/archive-bytes.ts](../../../lib/document-library/archive-bytes.ts) | 已审拆分：按清单逐项生成 ZIP 二进制 |
| [lib/document-library/archive-paths.ts](../../../lib/document-library/archive-paths.ts) | 已审拆分：分配目录与文件的唯一 ZIP 路径 |
| [lib/document-library/batch-verification.ts](../../../lib/document-library/batch-verification.ts) | 已审拆分：按已授权清单核对移动和删除终态；委派复制回执核对 |
| [lib/document-library/batches.ts](../../../lib/document-library/batches.ts) | 已审保留：读取并核对授权批次；调度每批未完成条目及业务终态 |
| [lib/document-library/browser-policy.ts](../../../lib/document-library/browser-policy.ts) | 已审保留：提供文件选择器可选扩展名 |
| [lib/document-library/copy-batches.ts](../../../lib/document-library/copy-batches.ts) | 已审保留：按原批次顺序复制文件与目录；记录每项复制结果 |
| [lib/document-library/copy-verification.ts](../../../lib/document-library/copy-verification.ts) | 已审保留：独立核对副本层级、业务版本和对象 |
| [lib/document-library/download-archive.ts](../../../lib/document-library/download-archive.ts) | 已审拆分：限制打包规模并读取清单；核对各对象并生成档案 |
| [lib/document-library/download-client.ts](../../../lib/document-library/download-client.ts) | 已审拆分：检查接口返回的 ZIP 格式；交付浏览器下载并回收对象地址 |
| [lib/document-library/explorer-repository.ts](../../../lib/document-library/explorer-repository.ts) | 已审保留：按位置读取文件浏览器；读取批次清单和摘要 |
| [lib/document-library/file-policy.ts](../../../lib/document-library/file-policy.ts) | 已审保留：检查文件名称、类型和大小；按实际字节生成内容指纹 |
| [lib/document-library/http.ts](../../../lib/document-library/http.ts) | 已审保留：有界读取请求体；核验来源；转换技术错误为界面键 |
| [lib/document-library/model.ts](../../../lib/document-library/model.ts) | 已审保留：声明档案、目录和文件数据形状；声明资料浏览和批次记录；核对最小单项操作凭证 |
| [lib/document-library/operation-client.ts](../../../lib/document-library/operation-client.ts) | 已审保留：提交上传及资料命令；独立读回操作凭证；归类用户可见错误 |
| [lib/document-library/repository.ts](../../../lib/document-library/repository.ts) | 已审保留：封装 document_library_read 及返回形状检查 |
| [lib/document-library/selection.ts](../../../lib/document-library/selection.ts) | 已审保留：解析资料位置查询；将选择写回网址 |
| [lib/document-library/storage-mutations.ts](../../../lib/document-library/storage-mutations.ts) | 已审拆分：登记上传并独立核对内容；删除对象并确认终态；按原操作恢复及核对凭证 |
| [lib/document-library/verified-file-content.ts](../../../lib/document-library/verified-file-content.ts) | 已审拆分：读取并校验单个已登记对象的真实字节 |
| [lib/document-library/verify-named-document.ts](../../../lib/document-library/verify-named-document.ts) | 已审保留：核对建目录或改名的正式记录 |

### Supabase

| 文件 | 阅读重点 |
| --- | --- |
| [supabase/functions/document-library-cleanup/index.ts](../../../../PT5-dropshipping-supabase/supabase/functions/document-library-cleanup/index.ts) | 已审拆分：内部请求鉴权与运行调度；对接固定目标清单、对象凭证和原完成函数 |
