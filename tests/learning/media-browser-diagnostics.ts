import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";

type ConsoleIssue = { type: string; path: string; category: string; textSha256: string };

/** 只接受本用例明确制造的断线和签名 503；其余错误/警告保留为失败，正文不写入证据。 */
export function observeMediaConsole(page: Page) {
  const issues: ConsoleIssue[] = [];
  page.on("console", message => {
    if (!["error", "warning"].includes(message.type())) return;
    let path = "";
    try { path = new URL(message.location().url).pathname; } catch { /* 没有来源仍按未预期处理。 */ }
    const text = message.text();
    const uploadDisconnect = path.endsWith("/functions/v1/user-media-mutate") && text.includes("net::ERR_CONNECTION_RESET");
    const unavailablePreview = path.includes("/storage/v1/object/sign/user-media/") && /503/.test(text);
    issues.push({
      type: message.type(), path,
      category: uploadDisconnect || unavailablePreview ? "controlled_transport_failure" : "unexpected_console_issue",
      textSha256: createHash("sha256").update(text).digest("hex"),
    });
  });
  return { issues, unexpected: () => issues.filter(issue => issue.category === "unexpected_console_issue") };
}
