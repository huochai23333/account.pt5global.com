# 公司模板与云端草稿

当前范围：共享。

## 业务与阅读顺序

发布互动 HTML 模板，填写草稿并保存为正式资料。

数据流：模板列表 → 沙箱编辑器/桥接协议 → 草稿与另存为 → 资料文件夹 → 内容核对。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

模板管理、员工填写和资料夹写入权限分别核验；沙箱正文不获得服务密钥。

完成依据：模板固定版本、草稿修订、正式文档编号和填写内容独立读回。

## 常见维护

沿[公司模板与文档生命周期](../explanation/template-document-lifecycle.md)定位发布、草稿、正式文档和另存为。适配器变更需检查恢复及另存为。

验证入口：npm run test:learning:browser -- company-template-publication company-template-draft-promotion。npm run test:template-content-sandbox。原套件按测试准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`activate_company_template_version`、`mutate_company_template_document`、`mutate_template_document_draft`、`publish_company_template_version`、`set_company_template_status`、`template_document_destinations`、`template_document_location`。

源码中直接引用的数据表/存储桶：`company_template_document_drafts`、`company_template_documents`、`company_template_draft_operations`、`company_template_versions`、`company_templates`、`document_archives`、`document_folders`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/learning/company-template-hash-fault.test.mjs](../../../scripts/learning/company-template-hash-fault.test.mjs)
- [web: scripts/learning/company-template-records.test.mjs](../../../scripts/learning/company-template-records.test.mjs)
- [web: tests/e2e/company-template-document-evidence.spec.ts](../../../tests/e2e/company-template-document-evidence.spec.ts)
- [web: tests/e2e/company-template-document-failures.spec.ts](../../../tests/e2e/company-template-document-failures.spec.ts)
- [web: tests/e2e/company-template-document-printing.spec.ts](../../../tests/e2e/company-template-document-printing.spec.ts)
- [web: tests/e2e/company-template-document-restoration.spec.ts](../../../tests/e2e/company-template-document-restoration.spec.ts)
- [web: tests/e2e/company-template-document-size-limit.spec.ts](../../../tests/e2e/company-template-document-size-limit.spec.ts)
- [web: tests/e2e/company-template-documents.spec.ts](../../../tests/e2e/company-template-documents.spec.ts)
- [web: tests/e2e/company-template-folder-permissions.spec.ts](../../../tests/e2e/company-template-folder-permissions.spec.ts)
- [web: tests/e2e/company-template-folder-recovery.spec.ts](../../../tests/e2e/company-template-folder-recovery.spec.ts)
- [web: tests/e2e/company-template-folders.spec.ts](../../../tests/e2e/company-template-folders.spec.ts)
- [web: tests/e2e/company-template-generic-saving.spec.ts](../../../tests/e2e/company-template-generic-saving.spec.ts)
- [web: tests/e2e/company-template-isolation.spec.ts](../../../tests/e2e/company-template-isolation.spec.ts)
- [web: tests/e2e/company-template-navigation.spec.ts](../../../tests/e2e/company-template-navigation.spec.ts)
- [web: tests/e2e/company-template-original-html.spec.ts](../../../tests/e2e/company-template-original-html.spec.ts)
- [web: tests/e2e/company-template-production-protocol.spec.ts](../../../tests/e2e/company-template-production-protocol.spec.ts)
- [web: tests/e2e/company-template-raw-quotation.spec.ts](../../../tests/e2e/company-template-raw-quotation.spec.ts)
- [web: tests/e2e/company-templates.spec.ts](../../../tests/e2e/company-templates.spec.ts)
- [web: tests/e2e/helpers/company-template-access-cases.ts](../../../tests/e2e/helpers/company-template-access-cases.ts)
- [web: tests/e2e/helpers/company-template-actions.ts](../../../tests/e2e/helpers/company-template-actions.ts)
- [web: tests/e2e/helpers/company-template-case-lifecycle.ts](../../../tests/e2e/helpers/company-template-case-lifecycle.ts)
- [web: tests/e2e/helpers/company-template-documents.ts](../../../tests/e2e/helpers/company-template-documents.ts)
- [web: tests/e2e/helpers/company-template-page-actions.ts](../../../tests/e2e/helpers/company-template-page-actions.ts)
- [web: tests/e2e/helpers/company-template-payloads.ts](../../../tests/e2e/helpers/company-template-payloads.ts)
- [web: tests/e2e/helpers/company-template-preview-cases.ts](../../../tests/e2e/helpers/company-template-preview-cases.ts)
- [web: tests/e2e/helpers/company-template-publication-cases.ts](../../../tests/e2e/helpers/company-template-publication-cases.ts)
- [web: tests/e2e/helpers/company-template-records.ts](../../../tests/e2e/helpers/company-template-records.ts)
- [web: tests/e2e/helpers/company-template-security-cases.ts](../../../tests/e2e/helpers/company-template-security-cases.ts)
- [web: tests/learning/company-template-draft-promotion.spec.ts](../../../tests/learning/company-template-draft-promotion.spec.ts)
- [web: tests/learning/company-template-publication.spec.ts](../../../tests/learning/company-template-publication.spec.ts)
- [web: tests/test-support/company-template-hash-fault.ts](../../../tests/test-support/company-template-hash-fault.ts)
- [supabase: supabase/tests/company_template_documents.sql](../../../../PT5-dropshipping-supabase/supabase/tests/company_template_documents.sql)
- [supabase: supabase/tests/company_template_usage_capability.sql](../../../../PT5-dropshipping-supabase/supabase/tests/company_template_usage_capability.sql)
- [supabase: supabase/tests/company_templates.sql](../../../../PT5-dropshipping-supabase/supabase/tests/company_templates.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(company-templates)/[workspace]/company-templates/[templateId]/guide/page.tsx](../../../app/%28company-templates%29/%5Bworkspace%5D/company-templates/%5BtemplateId%5D/guide/page.tsx) | 已审保留：指南路由组装 |
| [app/(company-templates)/[workspace]/company-templates/[templateId]/loading.tsx](../../../app/%28company-templates%29/%5Bworkspace%5D/company-templates/%5BtemplateId%5D/loading.tsx) | 已审保留：详情路由等待提示 |
| [app/(company-templates)/[workspace]/company-templates/[templateId]/page.tsx](../../../app/%28company-templates%29/%5Bworkspace%5D/company-templates/%5BtemplateId%5D/page.tsx) | 已审保留：模板详情组装 |
| [app/(company-templates)/[workspace]/company-templates/layout.tsx](../../../app/%28company-templates%29/%5Bworkspace%5D/company-templates/layout.tsx) | 已审保留：独立模板工作区外壳 |
| [app/(company-templates)/[workspace]/company-templates/page.tsx](../../../app/%28company-templates%29/%5Bworkspace%5D/company-templates/page.tsx) | 已审保留：核对工作区后读取模板与本人草稿；组装模板入口并传递预选目录 |
| [app/api/company-template-document-drafts/[draftId]/content/route.ts](../../../app/api/company-template-document-drafts/%5BdraftId%5D/content/route.ts) | 已审保留：读取本人的草稿和固定模板正文；返回沙箱正文及安全响应头 |
| [app/api/company-template-document-drafts/[draftId]/route.ts](../../../app/api/company-template-document-drafts/%5BdraftId%5D/route.ts) | 已审保留：返回本人草稿或已确认转正的正式文档 |
| [app/api/company-template-document-drafts/route.ts](../../../app/api/company-template-document-drafts/route.ts) | 已审拆分：分页读取本人草稿摘要；调度授权草稿写入 |
| [app/api/company-template-documents/[documentId]/content/route.ts](../../../app/api/company-template-documents/%5BdocumentId%5D/content/route.ts) | 已审保留：按当前权限读取固定模板正文或指南；组装受保护的 HTML 响应 |
| [app/api/company-template-documents/destinations/route.ts](../../../app/api/company-template-documents/destinations/route.ts) | 已审保留：列出当前账号可管理的目标目录 |
| [app/api/company-template-documents/route.ts](../../../app/api/company-template-documents/route.ts) | 已审保留：读取可见的正式文档摘要；调度受限正式文档命令 |
| [app/api/company-template-documents/save-as/route.ts](../../../app/api/company-template-documents/save-as/route.ts) | 已审保留：推导目录所属档案；查询可写目录中的显示条目 |
| [app/api/company-templates/[templateId]/content/route.ts](../../../app/api/company-templates/%5BtemplateId%5D/content/route.ts) | 已审保留：沙箱正文传输；安全响应头 |
| [app/api/company-templates/manage/route.ts](../../../app/api/company-templates/manage/route.ts) | 已审拆分：管理员请求分流 |
| [app/api/company-templates/publish/route.ts](../../../app/api/company-templates/publish/route.ts) | 已审拆分：发布请求校验；回执返回 |
| [components/dashboard/company-templates/company-template-card.tsx](../../../components/dashboard/company-templates/company-template-card.tsx) | 已审保留：模板摘要展示；使用和管理按钮；版本历史 |
| [components/dashboard/company-templates/company-template-desktop-frame.tsx](../../../components/dashboard/company-templates/company-template-desktop-frame.tsx) | 已审保留：宽屏窗口展示；等待及重试显示 |
| [components/dashboard/company-templates/company-template-open-link.tsx](../../../components/dashboard/company-templates/company-template-open-link.tsx) | 已审保留：模板链接等待态 |
| [components/dashboard/company-templates/company-template-publish-dialog.tsx](../../../components/dashboard/company-templates/company-template-publish-dialog.tsx) | 已审拆分：模板输入收集；发布反馈展示 |
| [components/dashboard/company-templates/company-template-viewer.tsx](../../../components/dashboard/company-templates/company-template-viewer.tsx) | 已审保留：查看器组装；文档和指南入口 |
| [components/dashboard/company-templates/company-templates-client.tsx](../../../components/dashboard/company-templates/company-templates-client.tsx) | 已审拆分：模板页组装；发布弹窗入口 |
| [components/dashboard/company-templates/documents/document-actions.tsx](../../../components/dashboard/company-templates/documents/document-actions.tsx) | 已审保留：呈现正式文档动作及对应弹窗；在写入完成后导航或刷新 |
| [components/dashboard/company-templates/documents/document-create-button.tsx](../../../components/dashboard/company-templates/documents/document-create-button.tsx) | 已审保留：在桌面创建本人的云端草稿；保留未知结果的原创建编号 |
| [components/dashboard/company-templates/documents/document-destination-fields.tsx](../../../components/dashboard/company-templates/documents/document-destination-fields.tsx) | 已审拆分：位置字段与状态展示 |
| [components/dashboard/company-templates/documents/document-editor.tsx](../../../components/dashboard/company-templates/documents/document-editor.tsx) | 已审拆分：组装正式编辑窗、状态与工具栏；连接位置和名称更新及离开确认 |
| [components/dashboard/company-templates/documents/document-folder-browser.tsx](../../../components/dashboard/company-templates/documents/document-folder-browser.tsx) | 已审保留：可写目录树与路径浏览；全档案路径搜索 |
| [components/dashboard/company-templates/documents/document-folder-dialog.tsx](../../../components/dashboard/company-templates/documents/document-folder-dialog.tsx) | 已审保留：通用位置表单组装 |
| [components/dashboard/company-templates/documents/document-save-as-dialog.tsx](../../../components/dashboard/company-templates/documents/document-save-as-dialog.tsx) | 已审拆分：组装位置导航、文件区和名称表单；统一提交条件与恢复提示 |
| [components/dashboard/company-templates/documents/draft-editor.tsx](../../../components/dashboard/company-templates/documents/draft-editor.tsx) | 已审保留：组装草稿工具栏和沙箱；连接草稿保存、转正和离开确认 |
| [components/dashboard/company-templates/documents/draft-list.tsx](../../../components/dashboard/company-templates/documents/draft-list.tsx) | 已审保留：呈现本人草稿摘要及分页；把继续和删除意图交给服务 |
| [components/dashboard/company-templates/documents/save-as-files.tsx](../../../components/dashboard/company-templates/documents/save-as-files.tsx) | 已审拆分：另存为内容区和分页展示 |
| [components/dashboard/company-templates/documents/save-as-name-form.tsx](../../../components/dashboard/company-templates/documents/save-as-name-form.tsx) | 已审保留：另存为名称输入 |
| [components/dashboard/company-templates/documents/save-as-navigation.tsx](../../../components/dashboard/company-templates/documents/save-as-navigation.tsx) | 已审保留：目录路径与导航展示 |
| [components/dashboard/company-templates/documents/save-as-new-folder.tsx](../../../components/dashboard/company-templates/documents/save-as-new-folder.tsx) | 已审拆分：子目录名称与反馈 |
| [components/dashboard/company-templates/documents/save-as-tree.tsx](../../../components/dashboard/company-templates/documents/save-as-tree.tsx) | 已审保留：另存为授权目录树 |
| [components/dashboard/company-templates/documents/use-document-actions.ts](../../../components/dashboard/company-templates/documents/use-document-actions.ts) | 已审保留：管理正式文档动作与对话框状态；固定原写入意图并反馈结果 |
| [components/dashboard/company-templates/documents/use-document-destinations.ts](../../../components/dashboard/company-templates/documents/use-document-destinations.ts) | 已审保留：位置查询和选择状态 |
| [components/dashboard/company-templates/documents/use-document-frame.ts](../../../components/dashboard/company-templates/documents/use-document-frame.ts) | 已审保留：管理桌面窗口加载与重试；核对沙箱握手及填写状态；关联原快照请求与响应 |
| [components/dashboard/company-templates/documents/use-document-keyboard.ts](../../../components/dashboard/company-templates/documents/use-document-keyboard.ts) | 已审保留：把父页保存快捷键交给当前命令 |
| [components/dashboard/company-templates/documents/use-document-save-command.ts](../../../components/dashboard/company-templates/documents/use-document-save-command.ts) | 已审拆分：统一按钮、父页和 iframe 保存命令；在采集快照前同步拦截重复保存 |
| [components/dashboard/company-templates/documents/use-document-save.ts](../../../components/dashboard/company-templates/documents/use-document-save.ts) | 已审拆分：串行处理自动与手动正式保存；维护修订、位置及未知结果重试；管理离线恢复和离开保护 |
| [components/dashboard/company-templates/documents/use-draft-list.ts](../../../components/dashboard/company-templates/documents/use-draft-list.ts) | 已审保留：控制本人草稿查询与分页；提交并重新核对删除结果 |
| [components/dashboard/company-templates/documents/use-draft-promotion.ts](../../../components/dashboard/company-templates/documents/use-draft-promotion.ts) | 已审拆分：暂停草稿保存并生成原转正意图；处理提交、关闭时的核对与恢复 |
| [components/dashboard/company-templates/documents/use-draft-save.ts](../../../components/dashboard/company-templates/documents/use-draft-save.ts) | 已审拆分：串行维护本人草稿快照和修订；管理离线、暂停和显式重试 |
| [components/dashboard/company-templates/documents/use-save-as-browser.ts](../../../components/dashboard/company-templates/documents/use-save-as-browser.ts) | 已审拆分：可写目录读取；导航历史；搜索和选择状态 |
| [components/dashboard/company-templates/documents/use-save-as-folder-create.ts](../../../components/dashboard/company-templates/documents/use-save-as-folder-create.ts) | 已审拆分：新目录操作和终态核对 |
| [components/dashboard/company-templates/documents/use-save-as-listing.ts](../../../components/dashboard/company-templates/documents/use-save-as-listing.ts) | 已审拆分：另存为内容请求及查询状态 |
| [components/dashboard/company-templates/documents/use-unsaved-navigation.ts](../../../components/dashboard/company-templates/documents/use-unsaved-navigation.ts) | 已审保留：提醒未保存的同站链接跳转；拦截支持取消的历史导航 |
| [components/dashboard/company-templates/use-company-template-management.ts](../../../components/dashboard/company-templates/use-company-template-management.ts) | 已审拆分：管理请求与回执；页面刷新反馈；宽屏状态 |
| [components/dashboard/company-templates/use-company-template-publication.ts](../../../components/dashboard/company-templates/use-company-template-publication.ts) | 已审拆分：提交快照及同步锁；发布回执核对 |
| [components/dashboard/company-templates/use-template-frame.ts](../../../components/dashboard/company-templates/use-template-frame.ts) | 已审保留：窗口加载与重试；就绪消息核对 |
| [examples/company-template-personal-document.html](../../../examples/company-template-personal-document.html) | 已审保留：个人文档协议示例 |
| [lib/company-templates/access.ts](../../../lib/company-templates/access.ts) | 已审保留：核对公司模板工作台入口权限；按 API 需求校验内部成员或管理员 |
| [lib/company-templates/content-security.ts](../../../lib/company-templates/content-security.ts) | 已审保留：定义模板正文的共享安全响应策略 |
| [lib/company-templates/display-error.ts](../../../lib/company-templates/display-error.ts) | 已审保留：错误码读取与展示白名单 |
| [lib/company-templates/documents/api.ts](../../../lib/company-templates/documents/api.ts) | 已审保留：取得有权访问正式文档的当前客户端；有界解析写入请求；把数据库错误映射到可展示的错误键 |
| [lib/company-templates/documents/client.ts](../../../lib/company-templates/documents/client.ts) | 已审保留：提交正式文档意图并检查回执；映射前端可展示的错误键 |
| [lib/company-templates/documents/draft-api.ts](../../../lib/company-templates/documents/draft-api.ts) | 已审保留：有界读取并验证草稿写入请求 |
| [lib/company-templates/documents/draft-client.ts](../../../lib/company-templates/documents/draft-client.ts) | 已审拆分：提交原草稿意图并核对返回内容；读取转正恢复结果并比对原意图 |
| [lib/company-templates/documents/draft-model.ts](../../../lib/company-templates/documents/draft-model.ts) | 已审保留：定义 TemplateDraft、DraftSummary 等4项同模块类型合同 |
| [lib/company-templates/documents/draft-mutations.ts](../../../lib/company-templates/documents/draft-mutations.ts) | 已审拆分：提交原草稿写入意图；独立核对原操作与当前修订、内容 |
| [lib/company-templates/documents/draft-repository.ts](../../../lib/company-templates/documents/draft-repository.ts) | 已审拆分：查询本人草稿摘要及正文；通过同编号转正凭证定位正式结果 |
| [lib/company-templates/documents/frame-bridge.ts](../../../lib/company-templates/documents/frame-bridge.ts) | 已审保留：向已授权正文注入运行期适配器；接收父页握手并采集或恢复填写快照 |
| [lib/company-templates/documents/generic-adapter.ts](../../../lib/company-templates/documents/generic-adapter.ts) | 已审保留：填写快照采集；操作回放与数据恢复；变更订阅 |
| [lib/company-templates/documents/model.ts](../../../lib/company-templates/documents/model.ts) | 已审保留：声明正式文档和写入回执结构；规范化快照以比较 JSONB 内容 |
| [lib/company-templates/documents/navigation.ts](../../../lib/company-templates/documents/navigation.ts) | 已审保留：构造正式编辑器和所在文件夹的相对链接 |
| [lib/company-templates/documents/publish-preflight.ts](../../../lib/company-templates/documents/publish-preflight.ts) | 已审保留：隔离预检；窗口清理 |
| [lib/company-templates/documents/repository.ts](../../../lib/company-templates/documents/repository.ts) | 已审保留：文档摘要与位置读取；正式写入与确认；固定版本正文读取 |
| [lib/company-templates/documents/restore-budget.ts](../../../lib/company-templates/documents/restore-budget.ts) | 已审保留：按动态行操作数量计算恢复等待预算 |
| [lib/company-templates/frame-document.ts](../../../lib/company-templates/frame-document.ts) | 已审保留：给校验后 HTML 加载就绪标记 |
| [lib/company-templates/frame-protocol.ts](../../../lib/company-templates/frame-protocol.ts) | 已审保留：预览窗口协议 |
| [lib/company-templates/model.ts](../../../lib/company-templates/model.ts) | 已审保留：定义 CompanyTemplateVersion、CompanyTemplateSummary 等4项同模块类型合同 |
| [lib/company-templates/mutations.ts](../../../lib/company-templates/mutations.ts) | 已审拆分：发布写入；启停及版本切换；独立终态核对 |
| [lib/company-templates/repository.ts](../../../lib/company-templates/repository.ts) | 已审拆分：读取模板摘要；读取及核对正文 |
| [lib/company-templates/validation.ts](../../../lib/company-templates/validation.ts) | 已审保留：HTML 文件校验；模板标识规范化 |

### Supabase

| 文件 | 阅读重点 |
| --- | --- |
| [templates/invoice-document-adapter.js](../../../../PT5-dropshipping-supabase/templates/invoice-document-adapter.js) | 已审保留：发票快照；原控件工厂恢复；变化通知 |
| [templates/quotation-document-adapter.js](../../../../PT5-dropshipping-supabase/templates/quotation-document-adapter.js) | 已审保留：报价单快照；分页运线和图片恢复；变化通知 |
