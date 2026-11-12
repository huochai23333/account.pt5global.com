# 批发业务参数

当前范围：启用。

## 业务与阅读顺序

维护提成、佣金及奖励参数的生效版本。

数据流：参数页面 → 设置服务 → 发布/预约 → 不可变版本 → 订单引用快照。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

只有获授权管理员维护；页面不能随意新增参数种类。

完成依据：新参数版本、生效时间和操作者记录可读回，旧订单引用保持正确。

## 常见维护

见[参数版本与订单链路](../explanation/business-parameter-flow.md)。恢复旧值也建立新版本；表单百分数使用统一换算。

验证入口：npm run test:learning:browser -- business-parameter-percent；后端 business_parameter_versions.sql 隔离执行；原页面写入用例按准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`cancel_scheduled_business_parameter_version`、`get_active_business_parameters`、`list_business_parameter_settings`、`publish_business_parameter_version`。

源码中直接引用的数据表/存储桶：`business_parameter_versions`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/e2e/business-parameter-order-lock.spec.ts](../../../tests/e2e/business-parameter-order-lock.spec.ts)
- [web: tests/e2e/business-parameter-settings.spec.ts](../../../tests/e2e/business-parameter-settings.spec.ts)
- [web: tests/e2e/helpers/business-parameter-data.ts](../../../tests/e2e/helpers/business-parameter-data.ts)
- [web: tests/e2e/helpers/business-parameter-order-page.ts](../../../tests/e2e/helpers/business-parameter-order-page.ts)
- [web: tests/learning/business-parameter-percent.spec.ts](../../../tests/learning/business-parameter-percent.spec.ts)
- [supabase: supabase/tests/business_parameter_versions.sql](../../../../PT5-dropshipping-supabase/supabase/tests/business_parameter_versions.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/dashboard/business-settings/business-settings-client.tsx](../../../components/dashboard/business-settings/business-settings-client.tsx) | 已审保留：组装设置页标题、权限空态与配置区块 |
| [components/dashboard/business-settings/business-settings-panel.tsx](../../../components/dashboard/business-settings/business-settings-panel.tsx) | 已审保留：按业务配置选取区块；分发数据和更新回调 |
| [components/dashboard/business-settings/use-business-settings-view-model.ts](../../../components/dashboard/business-settings/use-business-settings-view-model.ts) | 已审保留：维护各设置区块更新后的数据快照 |
| [components/dashboard/commission/admin-commission-settings-section.tsx](../../../components/dashboard/commission/admin-commission-settings-section.tsx) | 已审拆分：组装版本列表及两个弹窗；把反馈显示在当前可操作区域 |
| [components/dashboard/commission/admin-commission-settings-ui.tsx](../../../components/dashboard/commission/admin-commission-settings-ui.tsx) | 已审保留：呈现桌面表格和移动卡片；显示版本、规则及字段值；发出编辑、历史和取消意图 |
| [components/dashboard/commission/business-parameter-draft.ts](../../../components/dashboard/commission/business-parameter-draft.ts) | 已审拆分：从已存配置构造表单草稿；统一预览、转换和发布前字段验证 |
| [components/dashboard/commission/business-parameter-edit-dialog.tsx](../../../components/dashboard/commission/business-parameter-edit-dialog.tsx) | 已审拆分：呈现参数和生效时间表单；展示修改前后与计算说明；在弹窗底栏呈现错误及发布意图 |
| [components/dashboard/commission/business-parameter-history-dialog.tsx](../../../components/dashboard/commission/business-parameter-history-dialog.tsx) | 已审保留：展示版本历史和发布人信息；发出恢复旧值的编辑意图 |
| [components/dashboard/commission/commission-settings-display.ts](../../../components/dashboard/commission/commission-settings-display.ts) | 已审保留：维护字段和显示定义；格式化规则值、表单初值与计算说明 |
| [components/dashboard/commission/use-business-parameter-settings-view-model.ts](../../../components/dashboard/commission/use-business-parameter-settings-view-model.ts) | 已审拆分：管理编辑、历史与反馈状态；调度发布、取消及两步读回；按上海时间组装预约参数 |
| [lib/business-settings.ts](../../../lib/business-settings.ts) | 已审保留：校验当前账号能否读取设置；并发装配各领域的设置页数据 |
| [lib/commission-settings.ts](../../../lib/commission-settings.ts) | 已审保留：读取并归一化规则和版本历史；调用发布和预约取消；核对可持久化的发布回执 |
