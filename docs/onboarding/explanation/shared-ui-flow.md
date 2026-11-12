# 共享控件从哪里来

先从调用页面看传入的是数据、选项还是事件，然后沿 [共享控件源码表](../modules/design-system.md) 找到对应的渲染层。组件收到 `tone`、`pending` 或 `disabled` 时，页面负责解释业务状态，服务端负责授权与校验。

## 从布局到颜色

根布局加载 `root.css`，认证布局加载 `auth.css`，工作台及独立账号工具加载 `workspace.css`。这些入口用 `@source` 明确列出 Tailwind 扫描范围。把组件移到新目录时要核对扫描范围，否则 JSX 中的类名可能有源码却没有生成样式。常用颜色、边框和尺寸在 `theme.css`，浏览器默认交互、浮层动画和系统减少动态效果的适配在 `base.css`。`globals.css` 在当前路由导入链上没有调用点。

## 表单和日期

`Field` 生成输入的 id，把必填、错误说明和密度传给控件。`Input`、`Select` 与 `DatePicker` 从 `form-field-context.tsx` 读取这些属性。新增表单优先组合现有字段和按钮，字段旁的反馈交给 `Field`，整次操作的反馈交给 `FeedbackNotice`。

日期控件分三层。`date-picker-values.ts` 管理中英文格式、有效日期和上海时间。`use-date-picker-field.ts` 处理输入草稿、校验、原生表单重置与提交值同步。`date-picker.tsx` 组合可见输入、隐藏提交值和浮层，`date-picker-popup.tsx` 根据模式选择日、月或日期时间面板。用户还没确认的文本草稿可以暂时不同于表单值，保存时要查后端收到的规范值。只读或禁用日期的按钮与快捷键都遵循同一编辑条件。

## 弹窗和确认

`DashboardDialog` 负责标题、内容、操作栏和 Portal 渲染。`useDashboardDialogFocus` 在打开时记录触发位置，最上层处理 Tab 和 Escape，关闭后把焦点交回触发位置。页面滚动锁随第一层打开，在最后一层关闭时恢复。选择器内部的快捷键由 Base UI 处理。交互规则可对照 [WAI-ARIA 模态弹窗模式](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。

`DashboardConfirmProvider` 把确认结果交回业务调用方，决定是否写入的是调用方。调试订单草稿时可以填入测试标识，按 Escape 打开放弃确认，逐个 Tab 到按钮，再按 Escape 返回原草稿。真正放弃后应恢复外部焦点，且数据库里找不到这笔草稿。

## 列表和反馈

`DashboardPageShell` 统一页头、反馈和内容的顺序。`DashboardSectionPanel` 提供表面、筛选和列表结构，`DashboardCollectionFooter` 集中放置数量和分页。桌面表格与手机卡片通过 `ResponsiveDataView` 选择同一批记录。数据读取和统计需要去业务页或服务查找。动效从 `motion-tokens.ts` 取时长和曲线，`MotionSystemProvider` 接入用户的系统偏好。

本地验证可运行 `npm run check:dashboard-ui` 和 `npm run test:learning:browser -- dashboard-dialog-layers.spec.ts dashboard-home-todo.spec.ts date-picker-readonly.spec.ts`。双层订单弹窗、日期选择嵌套、双语闰日保存及业务参数只读路径各有独立断言。
