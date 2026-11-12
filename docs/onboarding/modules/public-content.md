# 帮助与公开内容

当前范围：共享。

## 业务与阅读顺序

从登录页页脚或个人中心打开帮助、隐私政策和服务条款。

数据流：帮助正文取自 help-center-content，隐私和条款正文取自 legal-formal-content；路由在服务端生成标题和正文，再交给 LegalPage 渲染。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

三个 URL 公开可读。正文由仓库中的双语内容和可公开的公司信息组成；无需登录，也不读取用户或业务数据。

完成依据：从登录页点入后，页面标题、正文和当前导航项一致；刷新后同一语言仍可阅读。

## 常见维护

修改帮助步骤先核对实际业务入口；修改法律正文需双语内容和生效日期一起审阅。共用版式和当前页标识在 LegalPage。

验证入口：npm run test:public-login-recovery 和 npm run check:i18n。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：本模块未发现字面量函数调用，沿服务导入继续追踪。

源码中直接引用的数据表/存储桶：本模块未发现字面量 from 调用。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/public/legal-navigation.spec.ts](../../../tests/public/legal-navigation.spec.ts)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(auth)/help/page.tsx](../../../app/%28auth%29/help/page.tsx) | 已审保留：帮助路由及元数据 |
| [app/(auth)/privacy/page.tsx](../../../app/%28auth%29/privacy/page.tsx) | 已审拆分：隐私路由及元数据 |
| [app/(auth)/terms/page.tsx](../../../app/%28auth%29/terms/page.tsx) | 已审拆分：条款路由及元数据 |
| [components/legal/legal-footer-links.tsx](../../../components/legal/legal-footer-links.tsx) | 已审保留：统一公开页链接 |
| [components/legal/legal-page.tsx](../../../components/legal/legal-page.tsx) | 已审拆分：公开版式；公开导航 |
| [lib/help-center-content.ts](../../../lib/help-center-content.ts) | 已审保留：双语帮助数据；页面和元数据适配 |
| [lib/legal-content.ts](../../../lib/legal-content.ts) | 已审保留：法律正文适配；页面和元数据组装 |
| [lib/legal-formal-content.ts](../../../lib/legal-formal-content.ts) | 已审保留：双语隐私与条款原文 |
| [lib/legal-routes.ts](../../../lib/legal-routes.ts) | 已审保留：公开路由及链接键 |
