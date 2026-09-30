"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

/** 已绑定标记只读取服务端摘要，网址参数与第三方跳转不能替代真实绑定记录。 */
export function MailFeishuStatus(props: { bound: boolean | undefined; busyKey: string | null; onConnect: () => void }) {
  const t = useTranslations("MailWorkspace");
  if (props.bound === undefined) return null;
  return props.bound
    ? <span className="inline-flex items-center" data-testid="mail-feishu-bound"><StatusBadge tone="success">{t("feishuBound")}</StatusBadge></span>
    : <Button disabled={props.busyKey !== null} loading={props.busyKey === "feishu"} onClick={props.onConnect} type="button">{t("bindFeishu")}</Button>;
}
