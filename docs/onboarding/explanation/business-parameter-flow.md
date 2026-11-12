# 批发业务参数与订单引用

有权限的在职管理员从 `/admin/wholesale/settings` 查看业务员提成、推荐订单金额佣金和推荐运单奖励的当前、预约及历史版本。页面按工作台配置加载设置区块，服务端先查当前用户、岗位和账号状态。数据库在发布、取消和读取设置时再次执行权限判断。

| 维护任务 | 阅读入口 |
| --- | --- |
| 定位设置页 | [设置读取](../../../lib/business-settings.ts)与[页面组装](../../../components/dashboard/business-settings/business-settings-client.tsx) |
| 调整字段或校验 | [字段定义与显示](../../../components/dashboard/commission/commission-settings-display.ts)、[表单草稿与转换](../../../components/dashboard/commission/business-parameter-draft.ts) |
| 修改发布或取消流程 | [表单及发布调度](../../../components/dashboard/commission/use-business-parameter-settings-view-model.ts)、[数据库回执](../../../lib/commission-settings.ts) |
| 核对旧版本或恢复旧值 | [历史弹窗](../../../components/dashboard/commission/business-parameter-history-dialog.tsx)及[后端版本规则](../../../../PT5-dropshipping-supabase/docs/onboarding/database.md) |

比例表单统一填写百分数。输入 `1` 显示为 `1%`，传给数据库的是 `0.01`。输入 `0.5` 对应 `0.005`。预览和提交共用转换。页面支持的最小百分数为 `0.01`，对应四位小数的数据库比例。

发布带上编辑时看到的修订号和当前草稿的请求编号。数据库检查业务规则与修订，创建带发布人和生效时间的版本。同一请求编号的原内容重试返回原版本。页面先按版本编号独立读取，再核对最新列表中的版本号与生效时间。取消预约必须读到原版本已取消。恢复历史值会发布新版本，旧订单保留创建时锁定的参数版本。运单奖励只允许预约下个上海自然月。

原SQL的准备与运行见[业务参数实操](../../../../PT5-dropshipping-supabase/docs/onboarding/business-parameter-sql.md)。发布九字段和取消六字段分别与真实行核对，重试检查完整内容及行是否重写。老客户12%、新客户服务费10%才是当前迁移基准，恢复它须生成第四版，不能把10%/12%称为原基准。两笔1000/2000元结汇用各自3%/4%，佣金为110元；这是专属合成订单，不是实际客户账目或银行验收。SQL角色、页面和双连接竞争分别记录。

- `npm run test:learning:browser -- business-parameter-percent` 验证真实页面的中英文输入、预览、错误提示和请求内容。共享本地环境会拦截请求，检查参数版本摘要在前后保持一致。
- [参数版本 SQL 用例](../../../../PT5-dropshipping-supabase/supabase/tests/business_parameter_versions.sql)覆盖发布、重试、预约、权限和旧订单锁定，仅在可重建隔离实例运行。
