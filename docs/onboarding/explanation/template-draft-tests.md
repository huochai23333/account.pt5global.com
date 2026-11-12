# 怎样维护模板草稿测试

先读[模板草稿转正与保存](../reference/verification-2026-11-05-template-document-save.md)。草稿保留本人填写内容，第一次另存为转成同编号的正式文档，之后普通保存更新原文档；另存副本不覆盖原件。本轮没有修改这些业务规则或用户文案。

[原测试入口](../../../tests/e2e/template-drafts.spec.ts)只负责按原顺序注册七个场景和关闭视频。原七个标题、125处页面断言及认证调用保持，认证仍走原documentLogin；运行入口限制继续有效，没有换账号模块或另建认证入口。

| 维护位置 | 负责什么 |
| --- | --- |
| [生命周期与隐私](../../../tests/e2e/helpers/template-draft-lifecycle-cases.ts) | 双浏览器恢复、首次转正/普通保存/另存副本、本人草稿可见范围 |
| [目录浏览](../../../tests/e2e/helpers/template-draft-navigation-case.ts) | 单击/双击、前进后退、局部加载和原1440/390/320宽度断言；退出先释放本用例闸门 |
| [转正及丢失响应](../../../tests/e2e/helpers/template-draft-promotion-cases.ts) | 重名、实际零影响、原操作重试及错误回执；只影响本次草稿的故障注入 |
| [冲突及恢复](../../../tests/e2e/helpers/template-draft-recovery-cases.ts) | 旧窗口修订、真实行锁、断网和同操作重试；独立核对数据库凭证 |
| [自动准入和页面夹具](../../../tests/e2e/helpers/template-draft-fixture.ts) | 按Playwright自动夹具检查同一Web/API/DB；打开草稿捕获真实owner、读库、排空路由/关页面后交给限定清理 |
| [故障目录能力](../../../tests/test-support/template-draft-insert-fault.ts) | 本次UUID命名，仅对指定草稿返回NULL；移除前核对完整目录/xmin/所有者标记，之后新连接读零 |
| [草稿记录清理](../../../tests/test-support/template-draft-cleanup.ts) | 限定ID/owner，快照与行版本核对、锁后重新核对、每表实际影响数、提交后独立查零 |

## 改用例时怎样保持边界

新增页面步骤放在对应业务文件，通用开草稿和读库复用夹具。每次生成UUID前缀，截图和JSON写`testInfo.outputPath`，避免多个worker/重试覆盖证据。页面写入仍从按钮、表单或键盘发起；管理员数据库能力只核对凭证和管理专属故障。

自动夹具在页面操作前检查配置baseURL和显式声明是否一致，再由既有`requireDocumentFixtureDatabase`核对专属Web、API网关和数据库。故障及清理的每次真实SQL调用仍走`runDocumentFixtureSql`。不要把容器名写死，也不要把数据库-only副本伪装成完整Web/API项目。[Playwright夹具机制](https://playwright.dev/docs/test-fixtures)

故障名每次唯一，安装只接受实际存在的草稿。安装结果未知时保留目标与故障，不按名字猜测删除；目录被同值重写也会因xmin改变而拒绝移除。正常移除确认后，原转正操作才可继续重试。PostgreSQL的OID在JSON中是字符串，助手会校验其正整数形式。[触发器行为](https://www.postgresql.org/docs/17/sql-createtrigger.html)

清理顺序是释放本用例闸门/锁 → 等路由处理结束 → 关闭页面停止自动保存 → 核对创建时捕获的owner → 读完整记录/xmin → 锁后版本比较与精确删除 → 独立查零 → 现有文件夹限定清理。无owner、归属变化、同值新版本、零影响或未确认结果都停止并保留证据。正文按普通SQL字面量存入临时表，不能直接拼进DO的美元引号。

## 验证命令与实际范围

离线控制流风险使用`node --experimental-strip-types --test scripts/learning/template-draft-fixtures.test.mjs`，当前11项。实际目录版本、零影响和提交结果另外在专属PG验证，不能只靠SQL替身或HTTP成功。

本轮实际数据库验证执行正式`mutate_template_document_draft`：注入零影响时转正回滚；移除后同一操作转正成功，重复返回同一凭证。另验证其他owner拒绝、同值行更新拒绝、DELETE零影响回滚、提交后响应丢失的独立查零、目录同值重写拒绝。168张表在各拒绝前后完整记录/版本保持；正向回收后相对于专属基准也一致。初次OID误判和最后目录冲突留下的夹具均保留到专属副本整体销毁，不覆盖原快照来掩盖变化。

这里的实际角色/RPC/触发器是数据库验证，不是真实Auth或原七个页面用例。原完整认证/页面、响应式中英文、真实网关/Storage和生产构建仍未执行。不要用上述11项或原生SQL代替原页面套件通过。完整凭证和本轮清理见[验证记录](../reference/verification-2026-11-11-template-drafts.md)。
