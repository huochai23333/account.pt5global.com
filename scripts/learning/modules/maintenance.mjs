/** 维护者确认的模块说明；修改后刷新学习地图并检查实际业务链路。 */
export const maintenanceModules = [
  {
    id: "operations",
    title: "业务操作凭证与共享后台运行",
    status: "共享",
    purpose: "维护共享后台运行、幂等写入和 Storage 凭证。管理员历史页保留在停用的旅游栏目。",
    flow: "操作入口 → 运行编号和尝试号 → 后台落终态 → 当前会话按原运行编号读回 → 页面反馈",
    permissions: "运行查询仅允许启用的请求人或管理员，写入尝试由有权服务执行。历史页还受旅游业务启用守卫限制。",
    evidence: "运行编号、终态、完成时间和预期计数相符；具体写入还需行版本、对象或外部凭证。",
    maintenance: "沿[操作凭证与运行账本](../explanation/operation-run-flow.md)定位读写入口；新增写入口同步登记 operation-contracts。",
    verification:
      "npm run check:operation-contracts；npm run test:operation-receipts；npm run test:learning:browser -- operation-run-receipts workspace-notice；后端 verified_operation_runs.test.sql 按隔离准入执行",
  },
  {
    id: "tooling",
    title: "开发配置与本地启动",
    status: "开发",
    purpose: "统一依赖、构建、本地诊断和两仓库运行方式。",
    flow: "依赖锁文件 → 本地服务 → doctor → 定向检查 → 构建/回归",
    permissions: "开发脚本只在明确的本地目标运行；密钥保存在本机，不写文档。",
    evidence: "版本、服务身份、配置存在性和迁移集合核对一致。",
    maintenance: "新增命令同步帮助与 README；诊断只读，重置和修复必须显式执行。",
    verification: "npm run doctor；npm run build；学习工具单元测试",
  },
  {
    id: "verification",
    title: "测试、合同与维护脚本",
    status: "开发",
    purpose: "保留可重复的测试、独立预期、运行证据和清理边界。",
    flow: "前提检查 → 自有夹具 → 页面/函数操作 → 独立读回 → 刷新与限定清理",
    permissions: "旧受限辅助入口保持限制；合成边界、真实本地和真实供应商分别记录。",
    evidence: "退出码、完整日志、最终业务凭证与未执行原因一致，不能相加重复运行次数。",
    maintenance: "修复断言时加入能检测错误结果的负例；新增测试同步模块地图。",
    verification:
      "npm run check:learning；npm run test:learning；npm run test:regression（先满足准入）",
  },
  {
    id: "database-history",
    title: "数据库迁移与回滚资料",
    status: "历史源文件",
    purpose: "保存按时间应用的数据库变更源文件及专用回滚资料。",
    flow: "按版本排序的迁移 → 本地实际数据库 → 表/函数/RLS → Web 与 Edge 调用",
    permissions: "数据库函数与 RLS 是最终业务边界；历史定义不等于当前生效定义。",
    evidence: "迁移版本集合、实际函数与授权和事务 SQL 断言一致。",
    maintenance: "不重写已发布迁移；修复通过 CLI 新建迁移，先在 Docker 验证。",
    verification: "本地迁移集合核对、db lint 和受影响 SQL 测试",
  },
];
