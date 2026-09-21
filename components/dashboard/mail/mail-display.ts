import type { MailThreadState } from "@/lib/mail/mail-types";

export const MAIL_STATE_LABELS: Record<MailThreadState, string> = {
  waiting_pt5: "待我们回复",
  waiting_customer: "等待客户",
  closed: "已结束",
};

export function formatMailTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function splitAddresses(value: string) {
  return value.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean);
}

export async function readNdjsonText(response: Response) {
  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(error?.error ?? "内容暂时无法生成。");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";
  let completed = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as { type?: string; text?: string; code?: string };
      if (event.type === "delta" && event.text) result += event.text;
      if (event.type === "completed") completed = true;
      if (event.type === "error") throw new Error("生成没有完成，请重试。");
    }
  }
  if (!completed || !result.trim()) throw new Error("生成没有取得完整结果，请重试。");
  return result.trim();
}
