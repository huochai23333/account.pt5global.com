# 物流同步页面测试的来源夹具

本页维护原[物流同步测试](../../../tests/e2e/wholesale-logistics-sync.spec.ts)。原四个场景仍保留：一次页面发起的限流/续跑/刷新分页，以及三种HTTP成功却没有最终完成的回执。原认证入口受限，四个原场景仍未执行；SQL模型和下面的专项单独计数。

## 先找到维护位置

| 文件 | 职责 |
| --- | --- |
| [夹具协调](../../../tests/e2e/helpers/logistics-source-fixture.ts) | 准备、启动、登记实际运行编号；失败时分别关闭服务和恢复配置 |
| [来源HTTP](../../../tests/test-support/logistics-source-server.ts) | 两页各25条、一次429及120秒下限、输入检查和连接收尾 |
| [数据库SQL](../../../tests/test-support/logistics-fixture-sql.ts) | 备份/准备、锁后归属与精确清理、完整控制值指纹 |
| [本地接线](../../../tests/test-support/logistics-fixture-store.ts) | 实际项目/API/Edge准入、错误脱敏、有界SQL及另一连接核对 |
| [学习专项](../../../scripts/learning/logistics-source-fixture.test.mjs) | 真实HTTP生命周期、明确合成的SQL/元数据端口、原页面网络准入内核 |

## 为什么只允许专属实例

这个场景会暂时清空两种模式的物流检查点、重置同步控制行和更换本地任务请求配置。必须使用完整、可重建的专属API/Auth/DB实例；共享本地项目不满足条件，不能只改一个端口或写上disposable就开始。

声明包括`PLAYWRIGHT_BASE_URL`、`NEXT_PUBLIC_SUPABASE_URL`、`PT5_E2E_FIXTURE_MODE=disposable`、`PT5_E2E_DATABASE_PROJECT`、`PT5_E2E_DATABASE_CONTAINER`。程序实际核对数据库/网关标签、API映射、共同网络以及调度暂停、零启用任务、零外部请求。页面请求只允许当前Web和声明API两个源，其他本机端口也会拦截。复用一个Web服务，并先确认该服务实际连接同一个专属项目。

Edge容器还须实际运行并属于同一项目/网络，以下两项必须能从其环境明确核对：

- `LOGISTICS_SOURCE_ARCHIVE_API_URL=http://host.docker.internal:43194/source`
- `LOGISTICS_SOURCE_ARCHIVE_API_TOKEN=local-fixture`

环境只在内存核对，不打印整份配置或实际令牌。无法确认时，测试在写入前拒绝；原完整运行环境仍需单独准备和验收。来源端口被占用时也会拒绝，不关闭占用者或覆盖其他项目配置。

## 顺着准备和恢复读代码

1. 准备事务先锁住同步控制行，拒绝已有同步、排队/运行中的同类任务、同类告警及碰撞包裹/观测桶。创建`private.pt5_e2e_logistics_backup`并写入随机归属、原控制值和原运行清单；私有表启用RLS，撤销公开、匿名、登录和服务角色权限。
2. 原任务密钥只保留在数据库私有备份，不写入恢复参数或日志。宿主机接收指纹和准确影响数；SQL错误仅保留白名单错误编号，避免DETAIL输出配置值。
3. 检查点清空数、控制行重置1行及本地任务配置写入1行都要实际符合，提交后另开连接核对准备状态，再启动来源。监听失败也走同一恢复路径。
4. 来源保留`LOCAL-RETRY-1..50`、订单号9000001..9000050和固定店铺。真实Worker先写25条，第二页限流后保留检查点；恢复来源后，从9000025继续到50条。任务账本、档案与刷新后的页面分别核对。
5. 清理锁住私有备份及当前记录，检查随机归属，只删除明确的50个包裹编号和对应来源/订单号/店铺。观测桶有陌生键，或出现未登记、原有、仍运行的任务，都拒绝恢复。空任务清单不能展开成`NOT IN(NULL)`，否则会漏掉新增任务。
6. 删除数必须等于锁后实际数，再恢复原检查点、控制行和任务配置。完整控制值及原任务指纹符合后才删除私有备份；另开连接确认本次档案/观测/运行均零、备份不存在、原指纹一致。

跨事务恢复控制值会产生新的控制行版本；这里只证明完整逻辑值恢复。原有任务和不属于本次的记录不得改写；Worker续跑的首25条档案另按完整内容及xmin核对。所有恢复都限定本次专属项目，不清空其他模块的历史排队任务。

## 可直接运行的专项

在Web仓库根目录执行，不需要账号、Docker或真实提供商：

```powershell
node --test scripts/learning/logistics-source-fixture.test.mjs
```

预期17项通过、0失败。其中HTTP是真实本机随机端口服务；Docker/Edge/SQL回执与页面对象是明确的诊断端口，实际准入、SQL构造器、夹具和网络限制代码参与运行。不加载原认证入口，不把专项计成原四个页面通过。

本批还在当前234版无网络结构副本执行真实SQL、当前协调器/HTTP、真实Worker和任务账本函数；DB/Kong/Edge元数据明确模拟。三种真实SQL角色均不能读取新增备份表，数据库维护角色能恢复并移除备份。[验证与限制](../reference/verification-2026-11-06-logistics-archive-history.md#2026-11-10页面来源夹具与原同步测试)
