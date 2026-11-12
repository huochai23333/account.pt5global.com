# 批发客户、人员与推荐关系

当前范围：启用。

## 业务与阅读顺序

从批发工作台查找客户和业务员，维护档案、账号关联及客户推荐关系。

数据流：批发 customers、people、referrals 路由 → getWholesalePageData 与 scopeWholesaleRows → 各目录、筛选和弹窗 → 数据库。账号推荐树另有按用户编号组织的读取入口。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

批发角色能力决定入口和操作按钮，数据库授权决定可见档案、可关联账号和写入范围。

完成依据：目录详情与已授权记录一致；客户推荐边按父、子客户编号和创建人读回，刷新后路径一致。

## 常见维护

从[批发目录与两种推荐关系](../explanation/wholesale-people-flow.md)区分客户档案 ID、关联用户 ID 与业务员 ID。目录筛选仅处理已授权的数据。

验证入口：npm run test:learning:browser -- wholesale-people-directory wholesale-customer-referrals，角色矩阵和客户关联测试独立记录。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`admin_add_client_to_business`、`admin_list_client_business_candidates`、`append_wholesale_customer_other_names`、`delete_wholesale_customer`、`get_current_referral_business_boards`、`get_current_salesman_business_boards`、`get_referral_company_roots`、`get_referral_tree_edges`、`link_wholesale_customer_registered_user`、`list_wholesale_customer_link_candidates`、`update_wholesale_customer`。

源码中直接引用的数据表/存储桶：`user_profiles`、`user_roles`、`user_roles_data`、`user_workspace_business_access`、`wholesale_customers`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/e2e/client-business-access.spec.ts](../../../tests/e2e/client-business-access.spec.ts)
- [web: tests/learning/wholesale-customer-referrals.spec.ts](../../../tests/learning/wholesale-customer-referrals.spec.ts)
- [web: tests/learning/wholesale-people-directory.spec.ts](../../../tests/learning/wholesale-people-directory.spec.ts)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/dashboard/referrals/referrals-client.tsx](../../../components/dashboard/referrals/referrals-client.tsx) | 已审保留：推荐树页面组装 |
| [components/dashboard/referrals/referrals-company-root.ts](../../../components/dashboard/referrals/referrals-company-root.ts) | 已审拆分：为账号图谱补公司根节点 |
| [components/dashboard/referrals/referrals-display.ts](../../../components/dashboard/referrals/referrals-display.ts) | 已审拆分：关系树可见分支筛选；翻译适配；错误提示 |
| [components/dashboard/referrals/referrals-graph.ts](../../../components/dashboard/referrals/referrals-graph.ts) | 已审保留：按账号 ID 组织关系图谱 |
| [components/dashboard/referrals/referrals-tree-view.tsx](../../../components/dashboard/referrals/referrals-tree-view.tsx) | 已审拆分：账号树区块与搜索入口；递归节点展示 |
| [components/dashboard/referrals/use-referrals-view-model.tsx](../../../components/dashboard/referrals/use-referrals-view-model.tsx) | 已审拆分：账号树读取与恢复；业务看板地址切换；树状态投影 |
| [components/dashboard/wholesale/wholesale-account-dialog.tsx](../../../components/dashboard/wholesale/wholesale-account-dialog.tsx) | 已审拆分：查看账号只读详情 |
| [components/dashboard/wholesale/wholesale-customer-account-actions.ts](../../../components/dashboard/wholesale/wholesale-customer-account-actions.ts) | 已审拆分：将注册账号纳入业务；合并既有客户档案并核对两侧编号 |
| [components/dashboard/wholesale/wholesale-customer-account-link.tsx](../../../components/dashboard/wholesale/wholesale-customer-account-link.tsx) | 已审拆分：展示关联状态和候选账号；提交所选账号 |
| [components/dashboard/wholesale/wholesale-customer-actions.ts](../../../components/dashboard/wholesale/wholesale-customer-actions.ts) | 已审拆分：建立客户档案；调度档案编辑、删除及别名写入；选择写入结果反馈 |
| [components/dashboard/wholesale/wholesale-customer-delete-dialog.tsx](../../../components/dashboard/wholesale/wholesale-customer-delete-dialog.tsx) | 已审拆分：展示删除确认；在确认框说明失败原因或关闭已完成的操作 |
| [components/dashboard/wholesale/wholesale-customer-details.tsx](../../../components/dashboard/wholesale/wholesale-customer-details.tsx) | 已审拆分：投影和本地化客户详情；组装档案操作、别名和账号区域 |
| [components/dashboard/wholesale/wholesale-customer-dialogs.tsx](../../../components/dashboard/wholesale/wholesale-customer-dialogs.tsx) | 已审保留：编排客户档案弹窗；协调弹窗选择与关闭顺序 |
| [components/dashboard/wholesale/wholesale-customer-form.tsx](../../../components/dashboard/wholesale/wholesale-customer-form.tsx) | 已审保留：渲染新建和编辑表单；保留原负责人选项并交付提交 |
| [components/dashboard/wholesale/wholesale-customer-mutations.ts](../../../components/dashboard/wholesale/wholesale-customer-mutations.ts) | 已审拆分：提交别名追加并验证回执；提交档案编辑和确认客户编号；删除后按客户编号独立读回 |
| [components/dashboard/wholesale/wholesale-customer-other-names.tsx](../../../components/dashboard/wholesale/wholesale-customer-other-names.tsx) | 已审保留：展示已存名称；维护展开和失败后保留输入 |
| [components/dashboard/wholesale/wholesale-customers-directory.tsx](../../../components/dashboard/wholesale/wholesale-customers-directory.tsx) | 已审保留：客户目录响应式显示 |
| [components/dashboard/wholesale/wholesale-customers-section.tsx](../../../components/dashboard/wholesale/wholesale-customers-section.tsx) | 已审拆分：客户页面组装；弹窗状态；纳入业务候选投影 |
| [components/dashboard/wholesale/wholesale-people-directory.tsx](../../../components/dashboard/wholesale/wholesale-people-directory.tsx) | 已审保留：业务员目录响应式显示 |
| [components/dashboard/wholesale/wholesale-people-filters.ts](../../../components/dashboard/wholesale/wholesale-people-filters.ts) | 已审保留：筛选客户；筛选人员 |
| [components/dashboard/wholesale/wholesale-people-section.tsx](../../../components/dashboard/wholesale/wholesale-people-section.tsx) | 已审拆分：人员页面组装；筛选和选中状态 |
| [components/dashboard/wholesale/wholesale-people-tabs.tsx](../../../components/dashboard/wholesale/wholesale-people-tabs.tsx) | 已审拆分：客户筛选面板与分页；人员筛选面板与分页 |
| [components/dashboard/wholesale/wholesale-referrals-dialog.tsx](../../../components/dashboard/wholesale/wholesale-referrals-dialog.tsx) | 已审保留：客户推荐录入 |
| [components/dashboard/wholesale/wholesale-referrals-display.ts](../../../components/dashboard/wholesale/wholesale-referrals-display.ts) | 已审保留：按客户 ID 构树；按名称与别名筛选；分页路径展开 |
| [components/dashboard/wholesale/wholesale-referrals-section.tsx](../../../components/dashboard/wholesale/wholesale-referrals-section.tsx) | 已审拆分：客户推荐区块与分页；搜索状态；录入调度 |
| [lib/business-referrals.ts](../../../lib/business-referrals.ts) | 已审保留：生成注册推荐链接 |
| [lib/client-business-access.ts](../../../lib/client-business-access.ts) | 已审拆分：分批读取管理员业务候选；提交开通并核对档案和授权 |
| [lib/referrals.ts](../../../lib/referrals.ts) | 已审保留：账号推荐读取；会话和看板判定；回执归一 |
| [lib/sales-staff-roles.ts](../../../lib/sales-staff-roles.ts) | 已审保留：销售类角色谓词 |
| [lib/salesman-business-access.ts](../../../lib/salesman-business-access.ts) | 已审保留：启用板块与业务类别投影；当前业务员板块读取 |
| [lib/wholesale-people-scope.ts](../../../lib/wholesale-people-scope.ts) | 已审拆分：按客户与创建人筛选推荐关系；从可见业务对象确定所需人员资料 |
| [lib/wholesale-profiles.ts](../../../lib/wholesale-profiles.ts) | 已审保留：批发资料与身份查询；可关联账号候选 |
