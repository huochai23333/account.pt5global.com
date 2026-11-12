# 账号、人员档案与私有备注

当前范围：共享。

## 业务与阅读顺序

管理员从 `/admin/accounts` 查看和维护账号、身份、状态、城市及自己的人员备注。

数据流：页面账号目录 → 账号变更事务与审计 → Auth 同步；备注另走 `/api/people/note` → 当前所有者与目标的备注行。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

账号维护仅限启用的管理员。销售岗位的备注目标须由数据库确认业务范围和推荐关系。备注只有写入人能读取。

完成依据：账号变更核对事务回执、人员读回和 Auth 同步；备注核对目标、正文或清空结果、数据库更新时间。

## 常见维护

沿[账号与私有备注](../explanation/account-and-private-note-flow.md)定位服务端目录、共享字段合同、账号编辑器、同步和备注入口。历史销售人员界面受启用业务范围限制。

验证入口：npm run test:learning:browser -- admin-account-receipts person-private-note；npm run test:admin-auth-sync；后端 admin_person_account_bundle.sql 仅在隔离实例执行，原端到端套件按准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`admin_set_customer_type_mark`、`admin_update_person_account_bundle`、`get_admin_people_change_log_directory`、`get_admin_people_change_logs`、`get_admin_people_directory`、`get_salesman_customer_directory`、`reconcile_admin_auth_metadata_sync`、`save_person_private_note`、`set_salesman_customer_type`。

源码中直接引用的数据表/存储桶：`admin_auth_metadata_sync`、`user_profiles`、`user_roles_data`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/learning/admin-account-receipts.spec.ts](../../../tests/learning/admin-account-receipts.spec.ts)
- [web: tests/learning/person-private-note.spec.ts](../../../tests/learning/person-private-note.spec.ts)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(workspace)/[workspace]/accounts/page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/accounts/page.tsx) | 已审保留：导出账号页面和元数据入口 |
| [app/api/admin/people/account/retry/route.ts](../../../app/api/admin/people/account/retry/route.ts) | 已审保留：校验重试人和目标编号；调度 Auth 待同步重试 |
| [app/api/admin/people/account/route.ts](../../../app/api/admin/people/account/route.ts) | 已审保留：校验账号变更请求；调度变更及近期审计读取；映射业务错误 |
| [app/api/admin/people/customer-type/route.ts](../../../app/api/admin/people/customer-type/route.ts) | 已审保留：校验客户标记请求；调度写入并返回读回结果 |
| [app/api/people/note/route.ts](../../../app/api/people/note/route.ts) | 已审拆分：读取 JSON 并调度备注服务；映射业务错误与回执 |
| [app/api/salesman/people/customer-type/route.ts](../../../app/api/salesman/people/customer-type/route.ts) | 已审保留：校验销售客户标记输入；调度写入和映射响应 |
| [components/dashboard/admin-people/admin-people-account-details.tsx](../../../components/dashboard/admin-people/admin-people-account-details.tsx) | 已审保留：展示账号与推荐详情；连接默认资料夹入口；展示当前查看者的备注 |
| [components/dashboard/admin-people/admin-people-account-dialog.tsx](../../../components/dashboard/admin-people/admin-people-account-dialog.tsx) | 已审保留：展示账号详情；呈现待同步重试；编辑账号表单及保存控件 |
| [components/dashboard/admin-people/admin-people-client.tsx](../../../components/dashboard/admin-people/admin-people-client.tsx) | 已审保留：组装账号目录和编辑器；挂载账号变更记录 |
| [components/dashboard/admin-people/admin-people-display.ts](../../../components/dashboard/admin-people/admin-people-display.ts) | 已审保留：人员显示和标签；本地目录搜索；格式化时间 |
| [components/dashboard/admin-people/admin-people-recent-changes.tsx](../../../components/dashboard/admin-people/admin-people-recent-changes.tsx) | 已审拆分：渲染最近账号变更；格式化同一条变更的摘要 |
| [components/dashboard/admin-people/admin-people-sections.tsx](../../../components/dashboard/admin-people/admin-people-sections.tsx) | 已审拆分：展示目录汇总；展示无权状态；筛选与分页目录 |
| [components/dashboard/admin-people/admin-people-table.tsx](../../../components/dashboard/admin-people/admin-people-table.tsx) | 已审保留：桌面和手机呈现同一目录；打开详情或备注 |
| [components/dashboard/admin-people/admin-people-view-model-utils.ts](../../../components/dashboard/admin-people/admin-people-view-model-utils.ts) | 已审保留：解析账号写入响应；归一用户错误码 |
| [components/dashboard/admin-people/use-admin-account-editor.ts](../../../components/dashboard/admin-people/use-admin-account-editor.ts) | 已审拆分：管理账号草稿与原始快照；提交并校验目标与字段；管理 Auth 待同步与重试 |
| [components/dashboard/admin-people/use-admin-customer-type-mark.ts](../../../components/dashboard/admin-people/use-admin-customer-type-mark.ts) | 已审保留：维护历史客户标记草稿；提交标记并回填人员行 |
| [components/dashboard/admin-people/use-admin-people-view-model.ts](../../../components/dashboard/admin-people/use-admin-people-view-model.ts) | 已审拆分：维护目录及最近变更；计算搜索筛选和汇总；协调两个编辑器回填 |
| [components/dashboard/client-business-add-dialog.tsx](../../../components/dashboard/client-business-add-dialog.tsx) | 已审拆分：搜索授权候选；发起选定账号的操作；显示提交进度与失败原因 |
| [components/dashboard/person-notes/person-private-note-dialog.tsx](../../../components/dashboard/person-notes/person-private-note-dialog.tsx) | 已审保留：显示备注归属说明；渲染草稿、字符数与操作 |
| [components/dashboard/person-notes/use-person-private-note-editor.ts](../../../components/dashboard/person-notes/use-person-private-note-editor.ts) | 已审拆分：维护选中人员与草稿；锁住保存并核对回执；成功后按原目标回填 |
| [components/dashboard/salesman-people/salesman-customer-type-dialog.tsx](../../../components/dashboard/salesman-people/salesman-customer-type-dialog.tsx) | 已审保留：展示客户摘要；呈现客户类型编辑控件 |
| [components/dashboard/salesman-people/salesman-people-client.tsx](../../../components/dashboard/salesman-people/salesman-people-client.tsx) | 已审保留：组装销售人员页面与弹窗 |
| [components/dashboard/salesman-people/salesman-people-display.ts](../../../components/dashboard/salesman-people/salesman-people-display.ts) | 已审保留：格式化客户标签和日期；本地目录搜索 |
| [components/dashboard/salesman-people/salesman-people-sections.tsx](../../../components/dashboard/salesman-people/salesman-people-sections.tsx) | 已审保留：显示客户汇总；显示无权状态；渲染筛选和客户列表 |
| [components/dashboard/salesman-people/use-salesman-customer-type-editor.ts](../../../components/dashboard/salesman-people/use-salesman-customer-type-editor.ts) | 已审拆分：管理客户标记草稿；提交并核对客户标记回执 |
| [components/dashboard/salesman-people/use-salesman-people-view-model.ts](../../../components/dashboard/salesman-people/use-salesman-people-view-model.ts) | 已审拆分：维护销售客户目录；计算搜索和汇总；组装标记和备注编辑器 |
| [lib/admin-people-auth-metadata.ts](../../../lib/admin-people-auth-metadata.ts) | 已审保留：读取和重新核对 Auth 补偿待办；串行处理同一账号的同步；核对数据库版本与实际 Auth 后结算 |
| [lib/admin-people-contract.ts](../../../lib/admin-people-contract.ts) | 已审拆分：维护页面行和写入合同；提供账号字段选项及验证 |
| [lib/admin-people-customer-type-mutations.ts](../../../lib/admin-people-customer-type-mutations.ts) | 已审保留：校验管理员与目标输入；写客户标记并读回目标和类型 |
| [lib/admin-people-mutation-database.ts](../../../lib/admin-people-mutation-database.ts) | 已审保留：适配账号修改事务参数和回执 |
| [lib/admin-people-mutation-errors.ts](../../../lib/admin-people-mutation-errors.ts) | 已审保留：归一账号变更业务错误 |
| [lib/admin-people-mutation-input.ts](../../../lib/admin-people-mutation-input.ts) | 已审保留：整理账号和城市输入；根据岗位计算业务板块 |
| [lib/admin-people-mutations.ts](../../../lib/admin-people-mutations.ts) | 已审保留：校验管理员和账号快照；提交事务并读回核对；协同 Auth 补偿结果 |
| [lib/admin-people-rows.ts](../../../lib/admin-people-rows.ts) | 已审拆分：归一账号目录行；归一账号变更日志 |
| [lib/admin-people.ts](../../../lib/admin-people.ts) | 已审拆分：核对账号页管理员身份；读取人员目录；读取近期和完整账号审计 |
| [lib/person-private-note-constants.ts](../../../lib/person-private-note-constants.ts) | 已审保留：定义备注长度上限 |
| [lib/person-private-note-contract.ts](../../../lib/person-private-note-contract.ts) | 已审拆分：校验并归一请求；确认原目标、正文与数据库时间 |
| [lib/person-private-notes.ts](../../../lib/person-private-notes.ts) | 已审拆分：核验当前操作者；调用并核对数据库备注回执；归类服务错误 |
| [lib/salesman-people-contract.ts](../../../lib/salesman-people-contract.ts) | 已审拆分：定义历史客户标记合同；根据业务板块提供选项 |
| [lib/salesman-people-mutations.ts](../../../lib/salesman-people-mutations.ts) | 已审拆分：核验销售身份与输入；写入并复查标记；归类错误 |
| [lib/salesman-people.ts](../../../lib/salesman-people.ts) | 已审拆分：核对角色与业务板块；读取客户目录和目标行；归一客户记录 |
