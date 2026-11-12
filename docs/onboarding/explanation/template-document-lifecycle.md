# 公司模板发布、草稿与正式文档

模板主行、内容版本和修订号的来源见[后端版本历史指南](../../../../PT5-dropshipping-supabase/docs/onboarding/template-parameter-history.md)。启停或切换旧版只调整当前指针；历史内容仍保留，发布后须独立核对当前版本及指纹。

个人文档初版采用本人所有权，后续才进入资料文件夹并引入草稿。当前列表按实时文件夹权限读取，不能用初版 owner_id 规则替代目录授权。原保存协议的版本追加、修订防冲突、删除后旧请求防复活及检查范围见[个人文档历史](../../../../PT5-dropshipping-supabase/docs/onboarding/template-parameter-history.md#资料库与个人文档怎样接上模板)。

`supports_personal_documents`记录原HTML是否声明自带保存方法。后续普通HTML由网站采集填写状态，这个历史标识不再决定能否新建文档。发布预检和打开后的恢复仍验证实际行为，不能仅凭几个声明文字认定恢复可用。演进过程见[保存能力历史](../../../../PT5-dropshipping-supabase/docs/onboarding/template-parameter-history.md#发票能力声明与普通html保存)。

## 发布共享模板

先用[模板SQL维护](../../../../PT5-dropshipping-supabase/docs/onboarding/navigation-template-sql.md)理解发布7字段、切换5字段、启停4字段的现行回执及数据库读回。内置模板从原批准内容准备，历史指纹不改；SQL内顺序重送与页面断网/跨进程并发分别记录。

管理员从工作台的「公司模板」新建模板、上传新版本、启停模板或切换历史版本。普通内部岗位只能使用已启用的当前版本。手机保留入口说明，正文查看与编辑需要宽屏。

1. [上传弹窗](../../../components/dashboard/company-templates/company-template-publish-dialog.tsx)收集模板资料和 HTML 文件。[发布逻辑](../../../components/dashboard/company-templates/use-company-template-publication.ts)先在沙箱检查填写状态能否恢复，再生成模板编号和版本编号。
2. [发布接口](../../../app/api/company-templates/publish/route.ts)核对管理员身份和文件格式。[写入服务](../../../lib/company-templates/mutations.ts)执行数据库事务，再独立读取模板的当前版本、状态、修订号与文件指纹。更新版本未传新指南时，数据库沿用当前指南。
3. 收不到结果时，弹窗保留表单及原提交。再次点击「上传并启用」使用同一份文件、同一组编号和同一个预期修订号。原发布已完成时，数据库返回原版本。历史版本切换和启停由[管理接口](../../../app/api/company-templates/manage/route.ts)处理，原修订号与目标状态相符时也可以找回原结果。

运行 `npm run test:learning:browser -- company-template-publication`。检查重试前后只有一个发布版本、修订号只增加一次、历史切换保留原文件指纹，随后刷新并打开模板。模板清单使用[读取服务](../../../lib/company-templates/repository.ts)，正文由[内容接口](../../../app/api/company-templates/%5BtemplateId%5D/content/route.ts)按需提供。

## 从模板创建个人文档

员工在工作台的「公司模板」选择新建文档，页面为当前账号创建云端草稿。草稿列表在模板页，只有创建者可以读取。首次另存为时选择有写入权限的文件夹，数据库在同一事务内把草稿转为正式文档并移除草稿。正式文档在「我的文档」按目录权限管理。

| 要维护的环节 | 从哪里开始 |
| --- | --- |
| 模板页怎样创建草稿 | [新建按钮](../../../components/dashboard/company-templates/documents/document-create-button.tsx)为这次意图生成草稿编号与操作编号。预选目录只是提示。 |
| 内容怎样进入父页 | [窗口桥](../../../lib/company-templates/documents/frame-bridge.ts)把模板填写快照传到[父页窗口控制器](../../../components/dashboard/company-templates/documents/use-document-frame.ts)。父页核对窗口身份、沙箱来源和本次随机标识。 |
| 草稿如何自动保存 | [草稿保存](../../../components/dashboard/company-templates/documents/use-draft-save.ts)串行提交最新快照和预期修订号。[草稿写入服务](../../../lib/company-templates/documents/draft-mutations.ts)独立读取原操作凭证和当前行。 |
| 首次另存为后如何继续 | [草稿转正](../../../components/dashboard/company-templates/documents/use-draft-promotion.ts)暂停自动保存并等待原请求，再提交最后一份快照。确认后使用原草稿编号进入正式文档。 |
| 关闭弹窗时结果仍未知 | [转正读回](../../../lib/company-templates/documents/draft-client.ts)检查原文档编号、固定模板版本、目的地、名称及提交内容。只有确认同一结果才跳转。错误结果保持原意图供重试。 |
| 正式保存与另存为的区别 | [保存命令](../../../components/dashboard/company-templates/documents/use-document-save-command.ts)统一按钮和快捷键。[正式保存](../../../components/dashboard/company-templates/documents/use-document-save.ts)更新同一文档的修订号，待确认时只重试原操作。另存为由[操作表单](../../../components/dashboard/company-templates/documents/document-actions.tsx)生成新编号。 |
| 另存为怎样选择目录 | [目录浏览](../../../components/dashboard/company-templates/documents/use-save-as-browser.ts)只接收获准的位置，维护返回、前进及选择。[文件列表](../../../components/dashboard/company-templates/documents/use-save-as-listing.ts)分别跟踪目录、搜索和分页，当前列表未确认时先保留名称，待查询可用再保存。 |
| 另存为里怎样新建目录 | [新建目录 Hook](../../../components/dashboard/company-templates/documents/use-save-as-folder-create.ts)保存操作编号，独立核对父目录、名称、版本和影响行数。等新目录出现在当前可写列表，才切换到该位置。 |

查 `company_template_document_drafts` 或 `company_template_documents` 的编号、版本、修订号和填写指纹。草稿转正要同时核对原草稿消失、同编号正式文档存在、目标文件夹正确以及操作凭证唯一。正式保存断线后，确认重试沿同一操作编号，旧请求已完成时修订号不能再增一次。另存为要核对两个不同的文档编号，以及原文档内容和修订号保持原值。

草稿所有权和正式目录权限是两条链路：管理员也不能读取他人的草稿；转正的原编号和旧回执仍要检查当前目标目录权限。固定版本、名称冲突、模板停用和策略合并的阅读顺序见[草稿与读取优化历史](../../../../PT5-dropshipping-supabase/docs/onboarding/template-parameter-history.md#草稿公共文档与读取优化)。历史SQL验证和当前真实页面验收分别记录。

使用 `npm run test:learning:browser -- company-template-draft-promotion` 走专属本地夹具。用例同时核对中断、错误回执、数据库、刷新与手机页面。窗口安全边界可运行 `npm run test:template-content-sandbox`。数据库定义见[后端数据库手册](../../../../PT5-dropshipping-supabase/docs/onboarding/database.md)。
