import { execFileSync } from "node:child_process";

/** netsh 的数字列不随界面语言变化；仅识别完整合法范围，忽略标题和说明中的数字。 */
export function parseExcludedTcpRanges(text) {
  return [...text.matchAll(/^\s*(\d+)\s+(\d+)(?:\s+\*)?[ \t]*$/gm)].flatMap(match => {
    const start = Number(match[1]); const end = Number(match[2]);
    return start >= 1 && end <= 65535 && start <= end ? [{ start, end }] : [];
  });
}

export function describeWindowsApiPort(port, ranges) {
  const reserved = ranges.find(range => Number(port) >= range.start && Number(port) <= range.end);
  return reserved
    ? { status: "error", message: `API 端口 ${port} 位于 Windows 保留范围 ${reserved.start}–${reserved.end}；先确认可用端口并同步本机配置，不要反复重建容器或修改系统全局规则。` }
    : { status: "ok", message: `API 端口 ${port} 未落入已读取的 Windows 保留范围；仍需核对服务实际响应。` };
}

/** 只读系统保留表，不绑定端口、不停服务、不删除保留范围。 */
export function inspectWindowsApiPort(port) {
  if (process.platform !== "win32") return { status: "ok", message: "非 Windows 系统，无需检查 Windows 端口保留表。" };
  if (!port) return { status: "warning", message: "API 端口尚未确认，未读取端口保留表。" };
  try {
    const ranges = ["ipv4", "ipv6"].flatMap(family => parseExcludedTcpRanges(execFileSync("netsh",
      ["interface", family, "show", "excludedportrange", "protocol=tcp"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000 })));
    return describeWindowsApiPort(port, ranges);
  } catch { return { status: "warning", message: "无法读取 Windows 端口保留表；请按环境手册只读核对。" }; }
}
