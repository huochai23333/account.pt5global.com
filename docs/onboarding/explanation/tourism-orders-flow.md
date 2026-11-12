# 普通订单与停用边界

当前工作台启用批发。旅游仍是已注册的业务标识，所以直接访问 `/admin/tourism/orders` 会进入 `/business-unavailable?business=tourism`。未知业务走找不到页面。动态栏目页先验证业务是否启用，再选择领域渲染器。浏览器导航和数据库权限各有自己的边界，数据库的 `is_workspace_business_enabled` 和行级策略共同限制普通订单数据。

## 阅读保留的普通订单实现

1. `tourism-section-page.tsx` 中的订单分支准备 `Orders` 文案和页面数据。`AdminOrdersClient` 组装列表、创建、编辑和详情弹窗，视图模型负责交互调度。
2. `admin-orders-page-data.ts` 获取会话身份，核对岗位和业务范围，再决定是否能查询成本。`admin-orders-options.ts` 读取人员、分类、服务子类型、折扣、费用、价格和当天汇率，销售岗位的类型选项另外按业务范围过滤。
3. `admin-orders-list-data.ts` 读取汇总及当前页。汇总按北京时间区间计算，跨日期精确查单只影响列表。空授权类型集合直接返回空页，避免数据库请求把空集合解释为无类型限制。
4. `admin-orders-supplementary.ts` 按总单 ID 匹配采购、服务或 VIP 补充表。服务单的子类型、折扣、价格与费用查询放在 `admin-orders-service-detail.ts`，列表和详情共用 `calculateOrderServiceFeeAmount`。成交汇率由已有公司汇率规则推导，服务费以人民币金额乘费率并沿用两位舍入。
5. `admin-orders-form.ts` 负责初始化草稿和从旧订单恢复字段。`admin-orders-form-validation.ts` 负责校验提交，按采购、服务和会员类型组装补充资料。创建和编辑的采购费率预览使用同一个 `use-admin-order-service-fee-preview.ts`，参数更换或弹窗关闭时，旧请求的结果失效。
6. `use-admin-order-supplementary-detail.ts` 只把当前选中订单的补充资料交给详情弹窗。旅游设置中，费率配置由 `use-admin-order-service-fee-settings.ts` 管理，服务价格与折扣由 `use-admin-order-service-settings.ts` 管理。设置面板只渲染表格和反馈。

要改普通订单筛选，先从 `admin-orders-page-filters.ts` 确认 URL 参数口径，再查 `admin-orders-list-data.ts` 的查询条件。要改服务价格展示，先区分服务标价、折扣、内部成本和额外服务费。写入入口为 `admin-orders-mutations.ts`，其中保存和删除由数据库函数完成。当前停用状态下，浏览器可验收的是拒绝访问与批发入口，普通订单写入的终态与失败恢复应单独在获准的隔离实例验证。

本地执行 `npm run test:learning:browser -- workspace-notice` 核对真实登录后的订单和设置入口、刷新和独立数据库权限。`npm run test:contracts -- admin-orders-retained` 核对空授权范围、服务费规则和三类订单提交数据。[原数据库停用回归](../../../../PT5-dropshipping-supabase/supabase/tests/legacy_tourism_business_disabled.sql)使用固定种子，按隔离测试手册执行。
