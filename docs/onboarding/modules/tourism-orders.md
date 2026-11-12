# 旅游订单与服务费用

当前范围：当前业务停用。

## 业务与阅读顺序

维护停用旅游工作区保留的普通订单、服务费及服务单价格资料。

数据流：已注册旅游地址 → 动态路由检查启用清单 → 服务说明页；保留的订单渲染器及读取链路见原理说明。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

旅游地址受启用清单限制，普通订单读取还受数据库行策略限制。批发有独立的订单页面和权限。

完成依据：真实账号访问旅游地址只看到说明页；同一身份直接查询无可见普通订单，批发订单仍可访问。

## 常见维护

沿[普通订单与停用边界](../explanation/tourism-orders-flow.md)定位表单字典、分页读取、服务费和停用守卫。

验证入口：npm run test:learning:browser -- workspace-notice；npm run test:contracts -- admin-orders-retained；固定种子的原 SQL 和浏览器套件按隔离准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`delete_order`、`get_order_user_options`、`preview_order_service_fee_type`、`save_order`。

源码中直接引用的数据表/存储桶：`business_category`、`order_discount_type`、`order_internal_cost`、`order_overview`、`purchase_order`、`purchase_order_type`、`service_fee_type`、`service_order`、`service_order_price_option`、`service_order_type`、`vip_recharge_order`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/contracts/admin-orders-retained.spec.ts](../../../tests/contracts/admin-orders-retained.spec.ts)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/dashboard/admin-orders/admin-orders-client-config.ts](../../../components/dashboard/admin-orders/admin-orders-client-config.ts) | 已审保留：配置角色展示模式；生成和比较筛选默认值；派生表单联动字段 |
| [components/dashboard/admin-orders/admin-orders-client.tsx](../../../components/dashboard/admin-orders/admin-orders-client.tsx) | 已审保留：组装订单标题和列表；组装创建编辑及详情弹窗 |
| [components/dashboard/admin-orders/admin-orders-copy.ts](../../../components/dashboard/admin-orders/admin-orders-copy.ts) | 已审保留：集中订单文案键与回退文案 |
| [components/dashboard/admin-orders/admin-orders-currency-fields.tsx](../../../components/dashboard/admin-orders/admin-orders-currency-fields.tsx) | 已审保留：展示币种、买入价与成交价控件 |
| [components/dashboard/admin-orders/admin-orders-currency.ts](../../../components/dashboard/admin-orders/admin-orders-currency.ts) | 已审拆分：生成报价选项；把对应报价应用到表单；计算成交率与人民币额 |
| [components/dashboard/admin-orders/admin-orders-detail-pairs-input.tsx](../../../components/dashboard/admin-orders/admin-orders-detail-pairs-input.tsx) | 已审保留：拆解文本与 JSON 为可编辑行；管理输入行增删；序列化草稿 |
| [components/dashboard/admin-orders/admin-orders-details-dialog.tsx](../../../components/dashboard/admin-orders/admin-orders-details-dialog.tsx) | 已审拆分：组装订单摘要；展示补充详情与加载反馈；展示可用编辑删除入口 |
| [components/dashboard/admin-orders/admin-orders-details.ts](../../../components/dashboard/admin-orders/admin-orders-details.ts) | 已审保留：把订单扩展 JSON 展开为标签和值 |
| [components/dashboard/admin-orders/admin-orders-dialog-ui.tsx](../../../components/dashboard/admin-orders/admin-orders-dialog-ui.tsx) | 已审保留：提供表单字段与分区容器；提供详情卡片 |
| [components/dashboard/admin-orders/admin-orders-display.ts](../../../components/dashboard/admin-orders/admin-orders-display.ts) | 已审保留：格式化数值与币种；生成用户显示标签；映射分类、子类型和状态文案 |
| [components/dashboard/admin-orders/admin-orders-errors.ts](../../../components/dashboard/admin-orders/admin-orders-errors.ts) | 已审保留：映射普通订单错误提示 |
| [components/dashboard/admin-orders/admin-orders-filters.tsx](../../../components/dashboard/admin-orders/admin-orders-filters.tsx) | 已审保留：展示日期、订单号和人员筛选；展示精确搜索与清除入口 |
| [components/dashboard/admin-orders/admin-orders-form-dialog-types.ts](../../../components/dashboard/admin-orders/admin-orders-form-dialog-types.ts) | 已审保留：定义 OrderFormDialogProps 等1项同模块类型合同 |
| [components/dashboard/admin-orders/admin-orders-form-dialog.tsx](../../../components/dashboard/admin-orders/admin-orders-form-dialog.tsx) | 已审保留：组装基本字段与锁定状态；组装类别补充字段与费用预览；展示提交取消与反馈 |
| [components/dashboard/admin-orders/admin-orders-form-parsing.ts](../../../components/dashboard/admin-orders/admin-orders-form-parsing.ts) | 已审保留：解析和序列化扩展表单文本；解析必填和可选数字 |
| [components/dashboard/admin-orders/admin-orders-form-validation.ts](../../../components/dashboard/admin-orders/admin-orders-form-validation.ts) | 已审拆分：校验订单共有字段；按采购、服务、会员组装补充提交结构 |
| [components/dashboard/admin-orders/admin-orders-form.ts](../../../components/dashboard/admin-orders/admin-orders-form.ts) | 已审拆分：创建空表单；按已保存订单还原编辑草稿；补齐默认录入人和订单类型 |
| [components/dashboard/admin-orders/admin-orders-permissions.ts](../../../components/dashboard/admin-orders/admin-orders-permissions.ts) | 已审保留：提供界面操作可用性判断 |
| [components/dashboard/admin-orders/admin-orders-sections.tsx](../../../components/dashboard/admin-orders/admin-orders-sections.tsx) | 已审保留：组装订单标题和创建入口；展示筛选及分页汇总；展示订单表格和选中事件 |
| [components/dashboard/admin-orders/admin-orders-service-fee-display.ts](../../../components/dashboard/admin-orders/admin-orders-service-fee-display.ts) | 已审保留：按范围筛选和排序费用选项；显示费用名称和比例 |
| [components/dashboard/admin-orders/admin-orders-service-fee-preview.tsx](../../../components/dashboard/admin-orders/admin-orders-service-fee-preview.tsx) | 已审保留：展示费用预览各状态；展示已保存费用摘要 |
| [components/dashboard/admin-orders/admin-orders-service-fee-settings-utils.ts](../../../components/dashboard/admin-orders/admin-orders-service-fee-settings-utils.ts) | 已审保留：解析与格式化费率输入；把失败映射为用户提示 |
| [components/dashboard/admin-orders/admin-orders-service-fee-settings.tsx](../../../components/dashboard/admin-orders/admin-orders-service-fee-settings.tsx) | 已审拆分：展示零售费率配置与编辑反馈 |
| [components/dashboard/admin-orders/admin-orders-service-fee-tier-section.tsx](../../../components/dashboard/admin-orders/admin-orders-service-fee-tier-section.tsx) | 已审保留：展示桌面费率表与手机费率卡；展示行操作、规则与草稿 |
| [components/dashboard/admin-orders/admin-orders-service-order-discounts-table.tsx](../../../components/dashboard/admin-orders/admin-orders-service-order-discounts-table.tsx) | 已审保留：展示桌面和移动折扣列表；按当前编辑目标展示草稿与按钮 |
| [components/dashboard/admin-orders/admin-orders-service-order-settings-shared.tsx](../../../components/dashboard/admin-orders/admin-orders-service-order-settings-shared.tsx) | 已审保留：提供设置页标题和表格容器；提供行操作及草稿类型 |
| [components/dashboard/admin-orders/admin-orders-service-order-settings-tables.tsx](../../../components/dashboard/admin-orders/admin-orders-service-order-settings-tables.tsx) | 已审保留：展示桌面价格表与移动卡片；展示价格和成本草稿及操作 |
| [components/dashboard/admin-orders/admin-orders-service-order-settings.tsx](../../../components/dashboard/admin-orders/admin-orders-service-order-settings.tsx) | 已审拆分：组装价格表；组装折扣表及反馈 |
| [components/dashboard/admin-orders/admin-orders-service-pricing.ts](../../../components/dashboard/admin-orders/admin-orders-service-pricing.ts) | 已审拆分：选择服务价格与折扣；计算服务金额及展示标价；将价格写入待提交表单 |
| [components/dashboard/admin-orders/admin-orders-status-options.ts](../../../components/dashboard/admin-orders/admin-orders-status-options.ts) | 已审保留：构建普通订单双语状态选项 |
| [components/dashboard/admin-orders/admin-orders-supplementary-details.tsx](../../../components/dashboard/admin-orders/admin-orders-supplementary-details.tsx) | 已审保留：按订单类别展示补充数据；过滤展示中的内部会员字段；展示服务价格折扣与费用 |
| [components/dashboard/admin-orders/admin-orders-supplementary-form-sections.tsx](../../../components/dashboard/admin-orders/admin-orders-supplementary-form-sections.tsx) | 已审拆分：展示采购补充表单；展示服务补充表单；展示会员充值补充表单 |
| [components/dashboard/admin-orders/admin-orders-ui.tsx](../../../components/dashboard/admin-orders/admin-orders-ui.tsx) | 已审保留：展示表格单元与加载状态；展示订单类型和状态徽标；统一导出订单弹窗入口 |
| [components/dashboard/admin-orders/admin-orders-utils.ts](../../../components/dashboard/admin-orders/admin-orders-utils.ts) | 已审保留：公开订单客户端工具入口 |
| [components/dashboard/admin-orders/admin-orders-view-model-shared.ts](../../../components/dashboard/admin-orders/admin-orders-view-model-shared.ts) | 已审保留：定义 PageFeedback、PageFeedbackSetter 等3项同模块类型合同 |
| [components/dashboard/admin-orders/use-admin-order-create-dialog.ts](../../../components/dashboard/admin-orders/use-admin-order-create-dialog.ts) | 已审拆分：管理创建弹窗和草稿；计算表单联动字段；校验和提交创建并更新页面 |
| [components/dashboard/admin-orders/use-admin-order-delete-actions.ts](../../../components/dashboard/admin-orders/use-admin-order-delete-actions.ts) | 已审保留：确认普通删除；确认永久删除；发布反馈并刷新列表 |
| [components/dashboard/admin-orders/use-admin-order-edit-dialog.ts](../../../components/dashboard/admin-orders/use-admin-order-edit-dialog.ts) | 已审拆分：按选中订单加载编辑草稿；管理表单联动；验证提交并更新页面 |
| [components/dashboard/admin-orders/use-admin-order-selection.ts](../../../components/dashboard/admin-orders/use-admin-order-selection.ts) | 已审保留：根据最新订单页管理详情选中项 |
| [components/dashboard/admin-orders/use-admin-order-service-fee-preview.ts](../../../components/dashboard/admin-orders/use-admin-order-service-fee-preview.ts) | 已审拆分：读取采购费率预览；丢弃失效请求与发布状态 |
| [components/dashboard/admin-orders/use-admin-order-service-fee-settings.ts](../../../components/dashboard/admin-orders/use-admin-order-service-fee-settings.ts) | 已审拆分：管理费率草稿与分组；校验、保存与反馈 |
| [components/dashboard/admin-orders/use-admin-order-service-settings.ts](../../../components/dashboard/admin-orders/use-admin-order-service-settings.ts) | 已审拆分：管理价格与折扣编辑目标；校验并保存对应字典；回写更新结果与反馈 |
| [components/dashboard/admin-orders/use-admin-order-supplementary-detail.ts](../../../components/dashboard/admin-orders/use-admin-order-supplementary-detail.ts) | 已审拆分：按当前订单读取补充资料；隔离旧请求并发布加载或错误 |
| [components/dashboard/admin-orders/use-admin-orders-route-state.ts](../../../components/dashboard/admin-orders/use-admin-orders-route-state.ts) | 已审保留：管理筛选和日期预设；保持 URL 查询和刷新同步；连接列表分页 |
| [components/dashboard/admin-orders/use-admin-orders-view-model.ts](../../../components/dashboard/admin-orders/use-admin-orders-view-model.ts) | 已审保留：组装订单页面权限与字典；衔接筛选分页和选中状态；协调创建编辑删除 Hook |
| [lib/admin-orders-business-scope.ts](../../../lib/admin-orders-business-scope.ts) | 已审保留：获取销售岗位的业务板块；筛选订单类型与查询范围 |
| [lib/admin-orders-costs.ts](../../../lib/admin-orders-costs.ts) | 已审保留：读取指定订单内部成本；按总单 ID 合并成本 |
| [lib/admin-orders-list-data.ts](../../../lib/admin-orders-list-data.ts) | 已审拆分：读取按日期计算的订单汇总；按筛选分页读取列表；补充服务费与授权成本 |
| [lib/admin-orders-mutations.ts](../../../lib/admin-orders-mutations.ts) | 已审保留：创建与更新总单；调用两种删除方式；保存后读回业务行 |
| [lib/admin-orders-options.ts](../../../lib/admin-orders-options.ts) | 已审拆分：读取人员及订单分类；读取费用与价格字典；并行组装表单与汇率选项 |
| [lib/admin-orders-page-data.ts](../../../lib/admin-orders-page-data.ts) | 已审拆分：读取会话并判定访问范围；组装授权后的表单和列表；生成拒绝访问的空数据 |
| [lib/admin-orders-page-filters.ts](../../../lib/admin-orders-page-filters.ts) | 已审保留：规范化筛选和页码；把人员搜索词转换为用户 ID |
| [lib/admin-orders-query.ts](../../../lib/admin-orders-query.ts) | 已审保留：分页读取订单；获取匹配行数；共用列表和计数筛选 |
| [lib/admin-orders-service-detail.ts](../../../lib/admin-orders-service-detail.ts) | 已审拆分：读取已存服务子类型、折扣和价格；组装服务单及费用详情 |
| [lib/admin-orders-service-fees.ts](../../../lib/admin-orders-service-fees.ts) | 已审拆分：读取订单费用类型；按总单合并费用；共用服务费计算 |
| [lib/admin-orders-supplementary.ts](../../../lib/admin-orders-supplementary.ts) | 已审拆分：定位订单主记录；判断补充单类型；读取采购或会员资料并分派服务单 |
| [lib/admin-orders-types.ts](../../../lib/admin-orders-types.ts) | 已审保留：定义 AdminOrderRow、OrderUserOption 等18项同模块类型合同 |
| [lib/admin-orders-viewer.ts](../../../lib/admin-orders-viewer.ts) | 已审保留：获取当前会话身份；判断读取订单和成本角色 |
| [lib/admin-orders.ts](../../../lib/admin-orders.ts) | 已审保留：公开普通订单领域入口 |
| [lib/service-fee-types.ts](../../../lib/service-fee-types.ts) | 已审保留：读取服务费配置；保存单项费率；按订单参数预览费用类型 |
| [lib/service-order-settings.ts](../../../lib/service-order-settings.ts) | 已审保留：写入单项服务价格和成本；写入折扣比例 |
