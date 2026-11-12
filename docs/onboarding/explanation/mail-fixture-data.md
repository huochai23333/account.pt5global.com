# 邮件夹具怎样准备和核对数据

这些文件服务于原固定账号套件，会清空十九张邮件表、重建固定编号，并可能安装整表故障触发器。必须使用可重建的独立完整实例；本地地址和 disposable 声明不能证明实际隔离。原账号与管理员入口的访问限制仍然有效。

## 阅读顺序

| 文件 | 职责 |
| --- | --- |
| [mail-fixtures](../../../tests/e2e/helpers/mail-fixtures.ts) | 只调度连接、清理、邮箱、人员、会话；任一步缺少凭证即停止。 |
| [mail-fixture-admin](../../../tests/e2e/helpers/mail-fixture-admin.ts) | 固定数据与保存故障共用的准入，再调用原管理员连接。 |
| [mail-fixture-reset](../../../tests/e2e/helpers/mail-fixture-reset.ts) | 原十九张表按子到父清理，六张表使用非 id 字段。 |
| [mail-fixture-records](../../../tests/e2e/helpers/mail-fixture-records.ts) | 插入编号及独立查回；删除影响数及独立空表核对。 |
| [mail-fixture-identity](../../../tests/e2e/helpers/mail-fixture-identity.ts) | 原固定编号与合成加密材料，不是真实登录凭据。 |
| [mail-fixture-mailbox](../../../tests/e2e/helpers/mail-fixture-mailbox.ts) | 邮箱、密文凭据与通知游标，包含必填 topic_name。 |
| [mail-fixture-agents](../../../tests/e2e/helpers/mail-fixture-agents.ts) | 两名业务员的发件资料和飞书绑定；管理员由实际应用首次进入时建档。 |
| [mail-fixture-messages](../../../tests/e2e/helpers/mail-fixture-messages.ts) | 会话、历史出站消息、收件人白名单凭证，再建立入站消息。 |
| [mail-fixture-scenarios](../../../tests/e2e/helpers/mail-fixture-scenarios.ts) | 同时间分页、陌生会话及删除阻挡作业。 |

原文件混合多类职责，现在同级分工，调用方直接导入对应模块。十三处插入载荷、分页行构造、十项常量、清理顺序和键映射均作 AST 对照；数据含义保持，写入核对更严格。

## 运行前与完成凭证

固定邮件访问与保存故障都要求显式提供 `PT5_E2E_FIXTURE_MODE=disposable`、`PLAYWRIGHT_BASE_URL`、`NEXT_PUBLIC_SUPABASE_URL`。地址必须为允许的本地 URL、没有内嵌凭据，还要确认 Web、Auth、数据库和 Storage 是同一专属项目。布局、授权和维护用例直接调用，也不能跳过此检查。它不会创建隔离环境、重置共享项目或解除原入口限制。

插入前核对目标编号非空、唯一；返回集合必须与原目标一致，再独立读取相同集合。空回包、错编号、重复编号和独立读取缺失都拒绝继续。报告只保留编号，不输出密文或令牌。

删除必须有精确影响数，再独立读取总数为零。原本为空时允许零影响，但两份证据仍须存在；这是无目标的准备操作，不是业务成功提示。清理或核对失败就停止，不继续创建基线。

这些辅助只核对数据库表，不能据此宣称 Storage 已回收。原上传、Storage 查回、刷新、失败/重复提交和专属完整实例销毁仍需实际验收。本轮没有执行整表清理、故障触发器或真实收发邮件。

## 修改与验证

邮箱字段改 mailbox，人员资料改 agents，消息关系改 messages，不继续堆入准备入口。改固定编号同时核对外键、出站收件人凭证和断言。密文每次随机，业务字段应解密比较，不能比较密文字节。

`npm run test:learning` 新增十三项检查，使用实际安装的 SDK 验证编码、丢失/错误/重复凭证、错误 cause、影响数、残留、失败停止、密文材料与关联关系。HTTP 传输由内存存储替换，不连接数据库或 Auth；只加载纯模块白名单，不执行原页面或认证链。`npm run test:e2e-fixture-policy` 另验证模式与地址准入。

接口依据：[Supabase 插入](https://supabase.com/docs/reference/javascript/insert)、[删除](https://supabase.com/docs/reference/javascript/delete)。实际执行 SDK 为 2.100.1，没有升级依赖或修改生产权限。原场景与模拟服务见[邮件测试维护](mail-test-boundaries.md)。
