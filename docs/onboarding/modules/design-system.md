# 共享控件、主题与动效

当前范围：共享。

## 业务与阅读顺序

为所有页面提供一致的表单、反馈、表格、弹窗、颜色与动效。

数据流：根布局、认证布局和工作台布局分别加载 CSS 入口 → theme.css 语义变量与 base.css 基础规则 → components/ui 交互和表面 → dashboard 页面骨架 → 业务页面。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

展示组件不承担数据库授权；可访问性语义由共享控件提供。

完成依据：桌面与手机无溢出、遮挡，键盘操作与字段错误关联可用。

## 常见维护

按 explanation/shared-ui-flow.md 查表单字段、浮层焦点、响应式列表和动效。涉及日期时先分清可见草稿、规范值和面板预览。

验证入口：npm run check:dashboard-ui。独立浏览器用例 dashboard-dialog-layers、dashboard-home-todo 和 date-picker-readonly 验证多层交互。原设计系统套件按现有准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：本模块未发现字面量函数调用，沿服务导入继续追踪。

源码中直接引用的数据表/存储桶：本模块未发现字面量 from 调用。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。


## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/auth.css](../../../app/auth.css) | 已审保留：认证页 Tailwind 入口；玻璃表面适配 |
| [app/base.css](../../../app/base.css) | 已审保留：全站基础样式；交互状态样式；浏览器动效 |
| [app/business-unavailable/business-unavailable.module.css](../../../app/business-unavailable/business-unavailable.module.css) | 已审保留：说明页操作断点 |
| [app/globals.css](../../../app/globals.css) | 已审保留：全局样式汇总入口 |
| [app/root.css](../../../app/root.css) | 已审保留：根布局 Tailwind 入口 |
| [app/theme.css](../../../app/theme.css) | 已审保留：Tailwind 语义名称；主题变量；响应式控件尺寸 |
| [app/ui-variants.css](../../../app/ui-variants.css) | 已审保留：Tailwind 控件状态变体；折叠动效与滚动条工具 |
| [app/workspace.css](../../../app/workspace.css) | 已审保留：工作台 Tailwind 入口；首页网格断点 |
| [components/brand/brand-mark.tsx](../../../components/brand/brand-mark.tsx) | 已审保留：品牌图展示 |
| [components/dashboard/dashboard-centered-loading-state.tsx](../../../components/dashboard/dashboard-centered-loading-state.tsx) | 已审保留：居中加载说明展示 |
| [components/dashboard/dashboard-collection-section.tsx](../../../components/dashboard/dashboard-collection-section.tsx) | 已审保留：列表骨架；数量底栏；页码操作 |
| [components/dashboard/dashboard-confirm-provider.tsx](../../../components/dashboard/dashboard-confirm-provider.tsx) | 已审保留：确认请求交接；确认框渲染 |
| [components/dashboard/dashboard-dialog-focus.ts](../../../components/dashboard/dashboard-dialog-focus.ts) | 已审拆分：弹窗层级与滚动锁；键盘焦点管理 |
| [components/dashboard/dashboard-dialog.tsx](../../../components/dashboard/dashboard-dialog.tsx) | 已审拆分：Portal 渲染；弹窗内容和操作区 |
| [components/dashboard/dashboard-feedback.tsx](../../../components/dashboard/dashboard-feedback.tsx) | 已审保留：加载与空状态视觉结构 |
| [components/dashboard/dashboard-form-dialog.tsx](../../../components/dashboard/dashboard-form-dialog.tsx) | 已审保留：表单弹窗与反馈；表单控件适配 |
| [components/dashboard/dashboard-framework-primitives.tsx](../../../components/dashboard/dashboard-framework-primitives.tsx) | 已审保留：行内编辑操作；文件选择与文件名展示 |
| [components/dashboard/dashboard-media-placeholders.tsx](../../../components/dashboard/dashboard-media-placeholders.tsx) | 已审保留：证件；视频占位展示 |
| [components/dashboard/dashboard-media-preview.tsx](../../../components/dashboard/dashboard-media-preview.tsx) | 已审保留：延迟媒体预览读取状态；图片与视频预览呈现 |
| [components/dashboard/dashboard-order-filter-section.tsx](../../../components/dashboard/dashboard-order-filter-section.tsx) | 已审保留：订单筛选布局；日期快捷项；精确查询状态 |
| [components/dashboard/dashboard-order-list-section.tsx](../../../components/dashboard/dashboard-order-list-section.tsx) | 已审保留：订单列表与分页框架适配 |
| [components/dashboard/dashboard-page-shell.tsx](../../../components/dashboard/dashboard-page-shell.tsx) | 已审保留：工作台页骨架；可达状态卡 |
| [components/dashboard/dashboard-paged-records.tsx](../../../components/dashboard/dashboard-paged-records.tsx) | 已审保留：列表显示分页 |
| [components/dashboard/dashboard-resource-filter-section.tsx](../../../components/dashboard/dashboard-resource-filter-section.tsx) | 已审保留：筛选排版；展开交互；筛选摘要 |
| [components/dashboard/dashboard-section-header.tsx](../../../components/dashboard/dashboard-section-header.tsx) | 已审保留：两种页面标题；概览指标呈现 |
| [components/dashboard/dashboard-section-panel.tsx](../../../components/dashboard/dashboard-section-panel.tsx) | 已审保留：共享表面；列表与表格框架；筛选控件布局 |
| [components/dashboard/dashboard-segmented-tabs.tsx](../../../components/dashboard/dashboard-segmented-tabs.tsx) | 已审保留：分段选择；选中及等待反馈 |
| [components/dashboard/wholesale/wholesale-ui.tsx](../../../components/dashboard/wholesale/wholesale-ui.tsx) | 已审保留：组装批发页头、摘要和空态；提供可滚动表格及固定表头；适配表单字段和提交按钮 |
| [components/motion/motion-primitives.tsx](../../../components/motion/motion-primitives.tsx) | 已审保留：内容切换动效；列表进出动效；展开与等待占位 |
| [components/motion/motion-system-provider.tsx](../../../components/motion/motion-system-provider.tsx) | 已审保留：Motion 全局配置 |
| [components/motion/page-reveal.tsx](../../../components/motion/page-reveal.tsx) | 已审保留：页面初次显示；浏览器滚动归位 |
| [components/ui/action-group.tsx](../../../components/ui/action-group.tsx) | 已审保留：表单操作的响应式布局 |
| [components/ui/button-variants.ts](../../../components/ui/button-variants.ts) | 已审保留：按钮样式合同 |
| [components/ui/button.tsx](../../../components/ui/button.tsx) | 已审保留：按钮交互及加载反馈；无固定尺寸点击入口 |
| [components/ui/data-display.tsx](../../../components/ui/data-display.tsx) | 已审保留：记录与元数据展示；指标卡；指标网格 |
| [components/ui/date-picker-calendar.tsx](../../../components/ui/date-picker-calendar.tsx) | 已审保留：日网格；月年导航；日期边界展示 |
| [components/ui/date-picker-panels.tsx](../../../components/ui/date-picker-panels.tsx) | 已审保留：单日底栏；月份网格；日期时间面板 |
| [components/ui/date-picker-popup.tsx](../../../components/ui/date-picker-popup.tsx) | 已审保留：日期浮层表面；模式面板分派 |
| [components/ui/date-picker-values.ts](../../../components/ui/date-picker-values.ts) | 已审保留：日期规范与本地化；无时区日历转换；上海时间与初值 |
| [components/ui/date-picker.tsx](../../../components/ui/date-picker.tsx) | 已审拆分：日期输入渲染；浮层交互；隐藏值提交 |
| [components/ui/feedback-notice.tsx](../../../components/ui/feedback-notice.tsx) | 已审保留：状态条外观与读屏反馈 |
| [components/ui/form-controls.tsx](../../../components/ui/form-controls.tsx) | 已审保留：字段标签与错误关联；文本控件；选择控件 |
| [components/ui/form-field-context.tsx](../../../components/ui/form-field-context.tsx) | 已审保留：共享字段语义与密度 |
| [components/ui/post-action-form.tsx](../../../components/ui/post-action-form.tsx) | 已审保留：主动 POST 导航按钮 |
| [components/ui/public-state-card.tsx](../../../components/ui/public-state-card.tsx) | 已审保留：公共状态页卡片 |
| [components/ui/responsive-data-view.tsx](../../../components/ui/responsive-data-view.tsx) | 已审保留：同一列表的响应式展示；空态及底栏 |
| [components/ui/select.tsx](../../../components/ui/select.tsx) | 已审保留：单选表单值；Base UI 浮层；键盘检索与焦点恢复 |
| [components/ui/status-badge.tsx](../../../components/ui/status-badge.tsx) | 已审保留：状态标签的语义样式 |
| [components/ui/surface.tsx](../../../components/ui/surface.tsx) | 已审保留：表面材质；语义元素选择 |
| [components/ui/use-date-picker-field.ts](../../../components/ui/use-date-picker-field.ts) | 已审拆分：可见草稿同步；规范值校验和提交；原生表单重置 |
| [lib/motion-tokens.ts](../../../lib/motion-tokens.ts) | 已审保留：动效令牌；列表延迟上限 |
