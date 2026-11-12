# 批发 VIP 数据流

获授权人员从批发工作台进入 VIP。页面包含客户状态列表、该客户的开通续期记录及下方总记录表。旅游申请、审核和手动调整代码仍归本模块，当前旅游入口暂停。

## 页面入口、读取和操作权限

三个边界须分别定位：工作台栏目决定页面入口，`can_read_wholesale_vip_customer`决定数据库列表范围，`manage_wholesale_vip_membership`同时检查当前员工和目标客户管理权限。客户端显示模式不授予数据库权限。

| 当前岗位 | VIP页面 | 数据库列表范围 | 开通／续期 |
| --- | --- | --- | --- |
| 管理员、财务、业务员 | 可进入 | 全部获批发授权客户 | 可操作 |
| 已开通批发的经理、操作员、招聘员 | 无栏目入口 | 可读取批发客户目录 | 拒绝 |
| 已开通批发的客户 | 无管理入口 | 仅本人创建、分配或注册关联的客户 | 拒绝 |
| 推广 | 当前批发业务未启用 | 无结果 | 拒绝 |

经理、操作员、招聘员和客户的批发范围来自本人的业务配置；测试只为本次合成账号启用范围。推广沿用产品固定业务规则，不通过修改单账号配置强开批发。页面受限不等于数据库目录也必然为空；维护权限时应沿实际函数和调用方核对，不能从岗位名或侧栏推断。

八岗位的可复用验收入口为`npm run test:learning:browser -- wholesale-vip-access`：真实表单登录后验证页面、当前令牌的原生Data API、开通续期的最终记录和刷新。仅本地专属客户产生测试收费历史，不执行真实收付款。

| 想修改什么 | 从哪里阅读 |
| --- | --- |
| 首屏数据和权限 | [查询服务](../../../lib/business-vip-management.queries.ts) 在当前会话下分页调用 `list_wholesale_vip_management`。[数据归一](../../../lib/business-vip-management.normalizers.ts) 把返回列整理为客户、会员和历史。 |
| 筛选、统计、联系方式 | [页面调度](../../../components/dashboard/business-vip/use-business-vip-view-model.ts) 组合弹窗与列表。[展示工具](../../../components/dashboard/business-vip/business-vip-display.ts) 在已授权的记录内筛选和格式化，空联系方式交给当前语言显示。 |
| 开通、续期及结果未知 | [操作 Hook](../../../components/dashboard/business-vip/use-business-vip-mutation.ts) 调用 [VIP 路由](../../../app/api/business-vip/route.ts)。同页提交互斥。明确确认后关闭弹窗并刷新，结果待确认时保留弹窗并暂停该客户的同页提交。 |
| 操作历史 | [记录投影](../../../components/dashboard/business-vip/business-vip-record-projection.ts) 将资格记录整理为总表和客户弹窗所需结构。会员的正式数据和历史分别在 `wholesale_vip_memberships`、`wholesale_vip_recharges`。 |

`manage_wholesale_vip_membership` 在数据库核对账号与目标客户，保存收费历史、资格及期限。开通从事务时间起算一年，续期从现有结束时间追加一年。现行批发规则记录 200 USD，且不产生业务员 VIP 佣金。两仓库的历史定义见[数据库索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

维护期限规则前，按[VIP 历史阅读路线](../../../../PT5-dropshipping-supabase/docs/onboarding/business-vip-history.md)区分旧审批与直接续期。直接续期从原到期时间追加一个日历年，过期较久时续期后仍可能已过期。历史函数名中的 admin 也不能代替函数体中的实际客户权限检查。

收到待确认提示时，刷新页面并打开该客户的开通与续期记录。若已经有本次记录，按记录编号和期限核对结果。这个流程使用页面状态保护当前提交，跨窗口暂未共享提交编号。

在 Web 仓库运行 `npm run test:learning:browser -- business-vip-receipts`。本地专属客户的开通、续期从页面发起。测试分别模拟空确认和真实保存后的响应中断，独立查询会员、收费历史、期限、处理人及佣金，最后按合成客户编号清理。这里记录的是本地数据库内的测试收费历史。
