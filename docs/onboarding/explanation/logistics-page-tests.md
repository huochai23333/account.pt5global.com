# 物流页面测试怎样维护

业务链路先读[物流档案与恢复](wholesale-logistics-flow.md)。原页面测试负责查询、店铺归属、分页和岗位范围；来源同步的断点恢复由独立用例负责，不在档案查询测试中发起真实同步。

| 修改任务 | 代码入口 |
| --- | --- |
| 筛选、归属弹窗、分页和岗位页面 | [原八场景](../../../tests/e2e/wholesale-logistics.spec.ts) |
| 单worker独占店铺、请求排空、额外角色页面与证据 | [命名夹具](../../../tests/e2e/helpers/logistics-assignment-case.ts) |
| 同步拦截、响应式及实际渲染的分页核对 | [页面辅助](../../../tests/e2e/helpers/logistics-page-assertions.ts) |
| 两表事务准备、归属版本凭证和限定回收 | [独占数据核心](../../../tests/test-support/logistics-assignment-case.ts) |
| 离线失败与未知回执 | [12项风险专项](../../../scripts/learning/logistics-assignment-case.test.mjs) |
| 角色页面中途失败后的真实收尾 | [四项浏览器生命周期检查](../../../tests/e2e/wholesale-logistics-lifecycle.spec.ts) |

## 一次归属维护的数据流

`storeCase`只供请求它的写入场景使用。既有执行器先核对完整专属项目的DB/Kong/端口网络和off/0/0。随后只读查找唯一活跃的协作业务员，不能有重名歧义；不导入账号辅助模块、不更改种子账号或权限。夹具在同一事务建立本次UUID店铺、一个合成包裹和一个无限起止区间，初始归属仍是原业务员/Wholesale Beta。

原管理员从页面把它改给协作业务员/Wholesale Alpha，再恢复为原设置。每次保存后独立读取归属和档案完整行及`xmin`：编号、店铺、区间和包裹都不变，只允许业务员、客户、更新人、更新时间和行版本改变。刷新后重新打开弹窗，界面与独立记录一致才算确认。这里调整整个原区间，不新增区间，也不修改固定的Local Shop Alpha。

`xmin`能识别同值更新；只比较名字和金额会漏掉并发改写。两张表的查询同时按本次编号、店铺和包裹查找，记录被改名或多出区间/包裹也不能躲过核对。返回的快照和证据是副本，调用方改返回对象不会改变清理基准。

## 为什么失败时会保留数据

命名夹具在正文成功或失败后先排空页面请求、关闭页面，再按最后已确认的完整记录回收。两表加锁后再次比对完整行/xmin，出现陌生外键或记录变更便停止；两表必须各实际删除1行，第二表0行时第一表删除也回滚。新连接查两表均为0才确认回收。提交回包丢失仍是未知，不能按店铺名批删或盲目重试；证据作为本次testInfo附件保留。

业务员/财务测试另外创建的页面不属于默认page。每次创建立即登记到`trackLogisticsPage`，即使第二页面尚未建立或断言失败，夹具也会尝试关闭每个已登记页面；某一个失败不会阻止收尾其他页面。

## 页面与外部边界怎样验证

档案测试在浏览器上下文拦截同步端点，OPTIONS返回200，实际刷新明确返回503；查询参数和末尾斜杠均覆盖。上下文拦截不受页面unrouteAll影响，保留到上下文关闭，其他接口仍可访问。此模拟只代表本地档案查询边界，不代表真实供应商或后台同步成功。

分页仍使用专门准备的55条独立JSON清单，按微秒时间和UUID核对20/20/15、完整编号集、包裹顺序和返回第二页；不从被测接口生成期望。原日期场景使用默认日期范围，日期控件实操与中英文页面验收仍需原套件恢复后核对。响应式助手检查桌面与390px的横向溢出和中文竖排挤压。

- `node --experimental-strip-types --test scripts/learning/logistics-assignment-case.test.mjs`：12项显式响应模型，不连接账号、数据库或来源。
- `wholesale-logistics-lifecycle.spec.ts`：只有浏览器资源生命周期，不登录、不请求storeCase、不进入产品页面。两项正文故意失败，两项后续独立核对必须通过；不把预期失败说成正常业务场景通过。
- 原Auth访问限制仍有效，不能运行原八页面或用替代登录冒充通过。需要在同一专属完整项目按原入口复跑，独立核对数据库并刷新；真实同步使用[本地来源夹具](logistics-source-fixture.md)。

本次专用配置、实际命令、SQL/浏览器凭证、受限文件保护与清理记录见[验证报告](../reference/verification-2026-11-11-logistics-pages.md)。夹具模式参考[Playwright官方文档](https://playwright.dev/docs/test-fixtures)，实际影响行数参考[PostgreSQL UPDATE](https://www.postgresql.org/docs/17/sql-update.html)。
