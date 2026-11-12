/** 个人资料卡片只展示字段输入和审核状态；提交回调来自个人中心状态层，不在卡片中重写权限规则。 */
"use client";

import type { ReactNode } from "react";

import { BadgeCheck, LoaderCircle, ShieldAlert, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PrivacyRequestStatus } from "@/lib/user-self-service";

import type { ReviewStatus } from "./dashboard-shared-display";

export function InputCard({
  icon,
  label,
  value,
  placeholder,
  actionLabel,
  busy,
  onChange,
  onAction,
  helperText,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  placeholder: string;
  actionLabel: string;
  busy: boolean;
  onChange: (value: string) => void;
  onAction: () => void;
  helperText?: string;
}) {
  const t = useTranslations("DashboardShared");
  return (
    <section className="motion-surface-enter rounded-surface-panel border border-border-subtle bg-surface-interactive p-6 shadow-surface-interactive">
      <div className="flex items-center gap-3 text-primary">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-status-info-soft">
          {icon}
        </div>
        <div>
          <p className="font-label text-[11px] font-semibold tracking-[0.18em] text-content-muted uppercase">
            {label}
          </p>
          <p className="mt-1 text-sm text-content-muted">{helperText ?? t("inputHint")}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        <Input
          controlSize="large"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={value}
        />
        <div className="flex justify-end">
          <Button disabled={!value.trim() || busy} onClick={onAction}>
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {actionLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function StatusNotice({
  status,
  description,
}: {
  status: ReviewStatus;
  description: string;
}) {
  const t = useTranslations("DashboardShared");
  const approved = status === "approved";
  return (
    <div
      className={`motion-surface-enter rounded-control-large border px-5 py-4 ${approved ? "border-status-success/25 bg-status-success-soft text-status-success" : "border-status-warning/25 bg-status-warning-soft text-status-warning"}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${approved ? "bg-status-success" : "bg-status-warning"}`}
        >
          {approved ? <BadgeCheck className="size-4.5" /> : <ShieldAlert className="size-4.5" />}
        </div>
        <div>
          <p className="text-sm font-semibold">
            {approved ? t("statusHeadings.approved") : t("statusHeadings.pending")}
          </p>
          <p className="mt-1 text-sm leading-6 opacity-80">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function ValueCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <section className="motion-surface-enter rounded-surface-panel border border-border-subtle bg-surface-interactive p-6 shadow-surface-interactive">
      <div className="flex items-center gap-3 text-primary">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-status-info-soft">
          {icon}
        </div>
        <p className="font-label text-[11px] font-semibold tracking-[0.18em] text-content-muted uppercase">
          {label}
        </p>
      </div>
      <div className="mt-5 rounded-surface-inset bg-surface-inset px-5 py-4 text-lg font-medium tracking-[0.12em] text-content-strong">
        {value}
      </div>
    </section>
  );
}

export function StatusChip({ status }: { status: PrivacyRequestStatus }) {
  const t = useTranslations("DashboardShared");
  const labels = {
    pass: t("assetStatus.pass"),
    pending: t("assetStatus.pending"),
    denied: t("assetStatus.denied"),
  };
  const tones = {
    pass: "success",
    pending: "warning",
    denied: "danger",
  } as const;
  return <StatusBadge tone={tones[status]}>{labels[status]}</StatusBadge>;
}
