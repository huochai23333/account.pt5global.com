/** 旅游订单与服务费用：组合或展示本模块已准备的数据；交互回调沿上层状态与服务处理，不在展示中重新实现业务规则。 */
"use client";

import type { ReactNode } from "react";

import { Field } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

export function OrderField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Field label={label} required={required}>
      {children}
    </Field>
  );
}

export function OrderSupplementaryFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-surface-panel border border-border-subtle bg-surface-inset p-5 shadow-surface-interactive sm:p-6">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-content-strong">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-content-muted">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function OrderFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-surface-panel border border-border-subtle bg-surface-inset p-5 shadow-surface-interactive sm:p-6">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-content-strong">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-content-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function OrderDetailCard({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-control-large border border-border-subtle bg-surface-interactive px-5 py-4 shadow-surface-interactive">
      <p className="font-label text-[11px] font-semibold tracking-[0.18em] text-content-muted uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 text-sm leading-7 text-content-strong",
          multiline ? "whitespace-pre-wrap break-words" : "truncate",
        )}
        title={multiline ? undefined : value}
      >
        {value}
      </p>
    </div>
  );
}

export const fieldInputClassName =
  "h-12 w-full rounded-record-card border border-border-subtle bg-surface-interactive px-4 text-[15px] text-content-strong shadow-surface-interactive outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-70";
