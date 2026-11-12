# 中英文文案

当前范围：共享。

## 业务与阅读顺序

维护用户可见的中英文消息及按页面下发的命名空间。

数据流：i18n/config → lib/locale 解析 Cookie/浏览器偏好 → i18n/request 服务端字典 → getScopedMessages → ScopedIntlProvider → useTranslations/UiMessage。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

文案不决定权限；只向页面下发其需要的消息。

完成依据：两种语言键结构一致，实际页面不存在缺失消息和布局溢出。

## 常见维护

按消息键的顶层命名空间定位 zh/en 字典，同时修改两种语言；新增键核对页面 ScopedIntlProvider。locale-provider 只封装读取 locale 的 Hook，实际 Provider 在 scoped-intl-provider。

验证入口：npm run check:i18n；受影响页面的中英文浏览器检查。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：本模块未发现字面量函数调用，沿服务导入继续追踪。

源码中直接引用的数据表/存储桶：本模块未发现字面量 from 调用。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。


## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/i18n/language-toggle.tsx](../../../components/i18n/language-toggle.tsx) | 已审保留：语言切换调度；移动菜单状态与展示；浏览器语言偏好持久化 |
| [components/i18n/locale-provider.tsx](../../../components/i18n/locale-provider.tsx) | 已审保留：包装当前 next-intl 语言读取 |
| [components/i18n/scoped-intl-provider.tsx](../../../components/i18n/scoped-intl-provider.tsx) | 已审保留：按服务端语言和所需命名空间下发文案 |
| [components/i18n/ui-message.tsx](../../../components/i18n/ui-message.tsx) | 已审保留：渲染统一 UiText 短文案 |
| [i18n/config.ts](../../../i18n/config.ts) | 已审保留：支持语言与偏好键合同 |
| [i18n/request.ts](../../../i18n/request.ts) | 已审保留：每请求国际化配置 |
| [lib/i18n-messages.ts](../../../lib/i18n-messages.ts) | 已审保留：消息命名空间选择；复制与合并消息树 |
| [lib/locale.ts](../../../lib/locale.ts) | 已审保留：语言输入规范化；请求语言优先级选择；文档语言标记 |
| [messages/en.json](../../../messages/en.json) | 已审拆分：提供当前语言的业务命名空间与页面文案 |
| [messages/zh.json](../../../messages/zh.json) | 已审拆分：提供当前语言的业务命名空间与页面文案 |
