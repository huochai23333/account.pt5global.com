# 资料库的上传、批量操作与权限

后台清理的首次领取与重试使用同一任务清单，避免文件领取时间更新后，60秒重试把残留文件漏成零项成功。入口为后端`document-library-cleanup/index.ts`：内部令牌 → 运行尝试 → `document_library_claim_cleanup_run`固定清单 → Storage删除与不存在核对 → `document_library_finish_cleanup_target` → 原目录权限及实际影响行数。已完成目标重试时还要核对原凭证、路径和对象不存在。实现、零影响反例与真实重试见[后台入口验证](../reference/verification-2026-11-11-cleanup-workers.md)。

资料库让员工管理本人文件，并按当前权限访问客户资料。员工从工作台的「我的文档」进入。客户档案详情的「查看资料」按档案编号打开相应目录。客户登录账号没有资料库入口。

数据库初版曾使用 personal/shared 等区域，个人模板文档也曾只允许创建者读取。这些是历史规则，当前正式文档按实时目录权限管理。读迁移时结合[资料库与个人文档历史](../../../../PT5-dropshipping-supabase/docs/onboarding/template-parameter-history.md#资料库与个人文档怎样接上模板)和当前定义，避免把旧区域名称或 owner_id 判断写回现行入口。

| 要理解或修改什么 | 从哪里开始 |
| --- | --- |
| 页面打开哪个文件夹 | [入口页](../../../app/%28document-library%29/%5Bworkspace%5D/documents/page.tsx)读取网址中的位置，再用当前身份查询资料。[读取 Hook](../../../components/dashboard/document-library/use-document-explorer.ts)处理导航、刷新和旧请求取消。 |
| 页面怎样上传和恢复 | [动作 Hook](../../../components/dashboard/document-library/use-document-actions.ts)保存每份文件的操作编号和页面状态。[请求模块](../../../lib/document-library/operation-client.ts)负责提交、读取回执和识别可展示的错误。 |
| 文件在哪些位置写入 | [上传入口](../../../app/api/document-library/upload/route.ts)核对登录和来源。[存储服务](../../../lib/document-library/storage-mutations.ts)预登记文件，写入私有 Storage，再独立下载并核对实际大小和 SHA-256。 |
| 继续核对会做什么 | [核对入口](../../../app/api/document-library/reconcile/route.ts)用原操作编号读取当前用户的凭证。已存在的上传对象仍需通过内容核对，才会显示成功。 |
| 哪些记录能证明结果 | `document_files` 的文件编号、版本、目录和内容指纹，`document_operations` 的原操作及终态，以及可独立下载的实际 Storage 对象。 |

## 批量上传中有一份断线

同一次选择中的每份文件各有操作编号。第一份已确认、第二份断线时，页面仍显示已确认的文件，断线项保留原操作供核对。成功恢复第二份时，只更新与该操作编号一致的行。只要还有失败项，整批继续显示部分完成。

刷新后，页面重新读取文件及可见的待核对操作。当前批次的结果明细属于页面状态，本机只保留尚未确认的原操作编号和输入描述。浏览器不保留文件字节。需要重新选择文件时，由用户明确发起新的上传。

## 权限改变后如何核对

原操作编号用于找回同一条操作。当前会话、数据库行策略和对象策略仍检查用户能否访问这份资料。权限撤回时，页面显示访问限制，刷新清除旧目录内容。资料记录和对象仍由拥有权限的人维护。

模板文档同样按实际目录授权，创建者字段只作追溯。旧文档入目录、共享确认和混合列表的演进见[后端目录历史](../../../../PT5-dropshipping-supabase/docs/onboarding/template-parameter-history.md#模板文档进入资料目录)。该历史曾允许客户只读共享区，不能据此扩大当前客户入口。

## 批量移动、复制和删除的完成凭证

页面先读取并确认清单，再提交固定批次编号。移动改变目录和版本，保留原 Storage 路径。数据库在每项移动的事务中按文件路径和登记大小检查 Storage 元数据。文件或目录子项缺失时，该项的目录、版本和操作回执一并回滚。其他已确认的项目保留。补回对象后，从批次明细继续核对，只重办失败项。

网址中的user/customer可定位档案，folder可定位具体目录。早期208—211版要求目录与所选档案匹配，后续Windows文档迁移改为根据folder查找真实档案，再检查当前权限；当前不能继续套用早期“必须同时传customer”的前提。同名目录迁移、可信父目录复制映射、未完成批次保护和共享参数移除的阅读顺序见[目录浏览与统一目录历史](../../../../PT5-dropshipping-supabase/docs/onboarding/template-parameter-history.md#目录浏览批次与统一目录)。历史211版SQL通过与当前页面/实际对象验收分别记录。

在成功批次的读取阶段，[批次核对](../../../lib/document-library/batch-verification.ts)再次查验移动后的目录、版本、路径、大小和对象存在性。复制需要独立读取新路径及实际字节，删除要确认原记录和对象都已消失。浏览器丢失回执时，刷新会读取之前保存的批次编号。

删除中SDK的`false`或普通400错误不能证明对象已经消失。[对象列表核对](../../../lib/storage-operation-object-presence.ts)必须成功读完所有候选页，按精确名称和真实对象编号排除仍存在的文件；旧成功回执也需复核。递归删除每轮最多10项，页面关闭或请求间断开时保持原批次、已完成条目和目录保护，用户从原批次继续核对。清理测试夹具时也遵守同一对象缺失标准。

## 复制为什么要读取来源，再登记副本

[复制调度](../../../lib/document-library/copy-batches.ts)先建立父目录，再处理文件和模板。文件复制按固定顺序办理：数据库检查来源与目标位置，读取来源字节并核对大小和指纹，预登记新的文件编号和路径，写入实际对象，再确认登记。来源记录保留；新记录和新路径都必须能独立核对。模板副本保留原填写内容与固定模板版本，使用新的文档编号。

清单记录的是本次范围和版本，不是长期授权。准备和完成之间发生转岗或撤权时，完成函数仍检查原操作者当前权限。已经发生的对象写入要保留原操作供核对，后续项目应停止；恢复测试账号权限只是故障测试的明确准备步骤，应用不会自行授予权限。

单项来源读取失败时，其他已完成项目保留，批次显示部分完成。继续核对使用同一批次，只办理未成功项目。浏览器原有的 90 秒等待期限到了，也只表示没有收到完整结果；先读取原批次的权威状态，再决定是否继续，不能重新创建批次来代替核对。成功副本由[复制结果核对](../../../lib/document-library/copy-verification.ts)逐项检查新的父链、记录版本、实际路径和下载字节。

移动则保留原文件编号和 Storage 路径，改变的是目录关系和版本。多项移动中撤回权限，已经提交的一项保留自己的凭证，其余项仍由当前权限决定是否能继续；后续重试不得再次增加已完成项的版本。

## 单文件和打包下载

[单文件入口](../../../app/api/document-library/files/%5Bid%5D/content/route.ts)使用当前会话查询已就绪的文件。[内容核对服务](../../../lib/document-library/verified-file-content.ts)从私有 Storage 读取实际对象，检查文件类型、字节长度和 SHA-256。仅符合预览规则的图片和 PDF 可以在资料库内打开。

[打包服务](../../../lib/document-library/download-archive.ts)按当前权限读取选中资料及子目录，逐项通过同一内容检查。读取结束后再次核对清单指纹，避免打包期间位置、权限或内容变化后仍交付。浏览器在[下载交付](../../../lib/document-library/download-client.ts)中检查响应类型和 ZIP 首尾记录，成功后才触发保存。找不到对象、字节不符或收到错误格式时，弹窗保留原选择供再次核对。

[预览窗](../../../components/dashboard/document-library/explorer-preview-dialog.tsx)通过受保护的内容地址打开原生图片或 PDF。页面在加载时显示等待提示，接口错误会切换为中英文重试提示。点击重试重新请求原文件编号，仍由服务端检查当前会话、可见记录及对象内容。

## 文件区、快捷键和确认窗

从[资料库页面控制器](../../../components/dashboard/document-library/use-explorer-controller.ts)看键盘和拖放事件。工具栏、右键菜单、F2 等都交给[命令模块](../../../components/dashboard/document-library/use-explorer-commands.ts)，确定要导航、进入行内编辑还是打开确认窗。当前目录、返回历史和面包屑集中在[位置栏](../../../components/dashboard/document-library/explorer-location-bar.tsx)。改名由[行内名称模块](../../../components/dashboard/document-library/use-inline-naming.ts)保留原操作编号，只有独立核对成功后才退出未知状态。

批次及打包确认窗通过[清单模块](../../../components/dashboard/document-library/use-explorer-manifest.ts)读取当前选择。重新读取时清掉旧清单，最新请求成功后才能再次确认。关闭窗口会取消正在加载的清单。

## 删除进行到一半时，先看哪一层

删除文件会跨过数据库和 Storage 两个系统，不能用一个数据库事务把文件字节一起回滚。维护时按下面的顺序找代码和凭证：

| 阶段 | 维护入口与凭证 |
| --- | --- |
| 确认本次范围 | 批次保存固定清单，并保护待删除目录。原批次编号代表这次操作，断线后继续使用它。 |
| 准备一份文件 | 数据库 `document_batch_step` 为该条目生成固定操作编号，文件登记进入 `deleting`。这时仍不能显示删除完成。 |
| 删除实际文件 | [存储服务](../../../lib/document-library/storage-mutations.ts)调用 Storage API，随后完整读取原路径确认对象已消失。直接删 Storage 元数据不能代替这一步。 |
| 完成文件登记 | `document_library_finish` 重新检查原操作者当前目录权限，再删除文件登记并核对实际影响行数。撤权后，已经拿到的旧操作编号也不能跳过这次检查。 |
| 完成整批 | [批次服务](../../../lib/document-library/batches.ts)每次最多办理十项；文件先于目录，叶目录先于父目录。页面使用原批次接着办理，成功条目保持原凭证。 |
| 向页面展示结果 | [最终核对](../../../lib/document-library/batch-verification.ts)检查清单、结果、实际记录和对象；[页面批次调度](../../../components/dashboard/document-library/use-explorer-batches.ts)再独立读取同一批次，不把一次请求返回当作整批成功。 |

因此，进程中断时可能出现“实际对象已经消失，文件登记仍在，批次尚未完成”。先核对原操作和原路径，再从页面继续核对；不要手工删登记来消除待办。权限已撤回时，剩余项目应停止，由当前有权的人决定后续处理。故障测试恢复本次合成账号权限，只是为了验证原批次可续办，不代表应用会自动恢复权限。

## 定向验证

下列命令验证各自注明的范围。真实进程终止和运行中撤权的专项凭证单独记录，不能把请求之间断开当成进程已经退出。

- `npm run test:document-upload-recovery` 检查服务端回执丢失、同一操作并发读取失败、对象缺失及清理边界。
- `npm run test:learning:browser -- document-library-batch-upload-recovery document-library-upload-recovery` 在中文桌面和英文手机验证真实页面、批量部分完成、权限撤回、重送和刷新。
- `npm run test:learning:browser -- document-library-batch-move document-library-batch-interruption` 验证移动遇到对象缺失时的部分完成与续办，以及复制、删除回执丢失后的刷新核对。
- `npm run test:learning:browser -- document-library-batch-interruption --grep 多层目录复制` 只跑四种语言/宽度的三层复制：从页面上传和复制，核对目录父链、固定模板版本、六份实际对象及响应丢失后的刷新。单项复制默认名称带(2)，测试明确填写目标名；来源资料与副本分别核对，记录、内容和对象都要限定清理。
- `npm run test:learning:browser -- document-library-batch-interruption --grep 递归删除` 验证11项清单在第10项后断开或收到伪成功，刷新后从页面续办原批次；独立核对原10项回执保持、最终11项成功和7个Storage路径确已消失。完整证据与尚未覆盖的失败矩阵见[批量验收记录](../reference/verification-2026-11-05-document-batches.md#2026-11-09-递归删除与对象缺失凭证)。
- `npm run test:learning:browser -- document-library-archive-download` 验证单文件下载、错误格式、私有对象缺失或字节不符、真实 ZIP 条目内容及刷新。
- `npm run test:learning:browser -- document-library-preview` 验证原生预览、对象缺失后重试、F2 改名、刷新和角色访问。
- `npm run test:learning:browser -- wholesale-customer-document-upload-race` 验证上传登记与客户删除的并发顺序，独立核对 Storage 字节和最终行数。

运行前先看[本地验证手册](../how-to/verification.md)，复用现有 Web 服务。用例创建专属账号和目录，仅清理本次文件、原操作和档案。后端角色、外键和清理规则见[数据库指南](../../../../PT5-dropshipping-supabase/docs/onboarding/database.md)。
