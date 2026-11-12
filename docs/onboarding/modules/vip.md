# 批发 VIP

当前范围：启用。

## 业务与阅读顺序

从批发工作台查看资格和开通、续期记录，为获授权客户办理 VIP。

数据流：批发 vip 路由 → 查询函数和显示投影 → 页面操作 Hook → POST /api/business-vip → 批发会员与收费记录。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

管理员、财务、业务员可进入并开通续期。已开通批发的经理、操作员、招聘员可由数据库读取目录但无VIP页面和写入；客户仅能读取本人关联，推广的批发未启用。旅游请求先拒绝。

完成依据：同一客户的会员编号、状态、期限、收费编号和处理人独立读回；响应不明时刷新并核对记录。

## 常见维护

从[批发 VIP 数据流](../explanation/business-vip-flow.md)定位提交确认、显示格式、记录映射和数据库期限规则。

验证入口：npm run test:learning:browser -- business-vip-receipts wholesale-vip-access；固定角色或历史数据库测试在隔离实例执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`list_wholesale_vip_management`、`manage_wholesale_vip_membership`。

源码中直接引用的数据表/存储桶：本模块未发现字面量 from 调用。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/learning/business-vip-receipts.spec.ts](../../../tests/learning/business-vip-receipts.spec.ts)
- [web: tests/learning/wholesale-vip-access-fixture.ts](../../../tests/learning/wholesale-vip-access-fixture.ts)
- [web: tests/learning/wholesale-vip-access.spec.ts](../../../tests/learning/wholesale-vip-access.spec.ts)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/api/business-vip/route.ts](../../../app/api/business-vip/route.ts) | 已审保留：请求字段解析；操作调度；安全响应映射 |
| [components/dashboard/business-vip/business-vip-adjustment-dialog.tsx](../../../components/dashboard/business-vip/business-vip-adjustment-dialog.tsx) | 已审保留：旅游资格调整草稿与表单 |
| [components/dashboard/business-vip/business-vip-client.tsx](../../../components/dashboard/business-vip/business-vip-client.tsx) | 已审拆分：组装 VIP 页面 |
| [components/dashboard/business-vip/business-vip-dialog-fields.tsx](../../../components/dashboard/business-vip/business-vip-dialog-fields.tsx) | 已审保留：标准 VIP 备注与表单操作按钮 |
| [components/dashboard/business-vip/business-vip-dialogs.tsx](../../../components/dashboard/business-vip/business-vip-dialogs.tsx) | 已审拆分：旅游申请表单；旅游审核表单；标准弹窗分派 |
| [components/dashboard/business-vip/business-vip-display.ts](../../../components/dashboard/business-vip/business-vip-display.ts) | 已审拆分：筛选及统计；金额时间格式；状态语气 |
| [components/dashboard/business-vip/business-vip-record-projection.ts](../../../components/dashboard/business-vip/business-vip-record-projection.ts) | 已审保留：总记录和单客户开通续期投影 |
| [components/dashboard/business-vip/business-vip-row-list.tsx](../../../components/dashboard/business-vip/business-vip-row-list.tsx) | 已审保留：旅游会员表格与手机卡片 |
| [components/dashboard/business-vip/business-vip-row-shared.tsx](../../../components/dashboard/business-vip/business-vip-row-shared.tsx) | 已审拆分：客户与联系方式展示；会员状态展示 |
| [components/dashboard/business-vip/business-vip-sections.tsx](../../../components/dashboard/business-vip/business-vip-sections.tsx) | 已审保留：页头及统计；筛选界面；目录与分页组合 |
| [components/dashboard/business-vip/business-vip-tourism-row-parts.tsx](../../../components/dashboard/business-vip/business-vip-tourism-row-parts.tsx) | 已审保留：旅游申请列表；旅游历史摘要；旅游操作按钮 |
| [components/dashboard/business-vip/business-vip-wholesale-dialogs.tsx](../../../components/dashboard/business-vip/business-vip-wholesale-dialogs.tsx) | 已审拆分：开通续期确认；客户开通续期历史 |
| [components/dashboard/business-vip/business-vip-wholesale-list.tsx](../../../components/dashboard/business-vip/business-vip-wholesale-list.tsx) | 已审保留：批发客户桌面与手机列表；会员操作入口 |
| [components/dashboard/business-vip/business-vip-wholesale-records.tsx](../../../components/dashboard/business-vip/business-vip-wholesale-records.tsx) | 已审拆分：操作历史分页；表格卡片显示 |
| [components/dashboard/business-vip/use-business-vip-mutation.ts](../../../components/dashboard/business-vip/use-business-vip-mutation.ts) | 已审保留：请求互斥和提交；确认及刷新状态 |
| [components/dashboard/business-vip/use-business-vip-view-model.ts](../../../components/dashboard/business-vip/use-business-vip-view-model.ts) | 已审拆分：筛选和统计；弹窗生命周期；操作入参组装 |
| [lib/business-vip-management.errors.ts](../../../lib/business-vip-management.errors.ts) | 已审保留：将服务端错误映射为固定结果码 |
| [lib/business-vip-management.mutations.ts](../../../lib/business-vip-management.mutations.ts) | 已审保留：VIP 写入与回执 |
| [lib/business-vip-management.normalizers.ts](../../../lib/business-vip-management.normalizers.ts) | 已审拆分：VIP 客户投影；历史子记录投影；写入字段归一 |
| [lib/business-vip-management.queries.ts](../../../lib/business-vip-management.queries.ts) | 已审保留：按会话读取批发 VIP 页 |
| [lib/business-vip-management.ts](../../../lib/business-vip-management.ts) | 已审保留：VIP 公共导入入口 |
| [lib/business-vip-management.types.ts](../../../lib/business-vip-management.types.ts) | 已审保留：VIP 页面、动作和凭证数据类型 |
| [lib/vip-memberships.ts](../../../lib/vip-memberships.ts) | 已审保留：零售服务 VIP 术语与数据形状 |
