"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import type { SaveAsBrowser } from "./use-save-as-browser";
import { useSaveAsFolderCreate } from "./use-save-as-folder-create";
/** 子目录表单保留自己的名称和错误，只有确认读回后才关闭，并通知弹窗解除等待。 */
export function SaveAsNewFolder({
  browser,
  busy,
  onBusyChange,
  close,
}: {
  browser: SaveAsBrowser;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  close: () => void;
}) {
  const t = useTranslations("CompanyTemplates.documents");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const create = useSaveAsFolderCreate(browser);
  async function submit() {
    if (!name.trim() || inFlight.current || busy) return;
    // Enter 和确认按钮可能在同一次渲染前触发，先锁请求再设置显示状态。
    inFlight.current = true;
    setCreating(true);
    onBusyChange(true);
    setError("");
    try {
      await create(name);
      close();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "document_name_conflict"
          ? cause.message
          : "document_failed",
      );
    } finally {
      inFlight.current = false;
      setCreating(false);
      onBusyChange(false);
    }
  }
  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-0 flex-1" label={t("newFolderName")}>
          <Input
            autoFocus
            disabled={busy || creating}
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
          />
        </Field>
        <Button loading={creating} disabled={busy || !name.trim()} onClick={() => void submit()}>
          {t("confirm")}
        </Button>
        <Button variant="outline" disabled={busy || creating} onClick={close}>
          {t("cancel")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-status-danger">
          {t(`errors.${error}`)}
        </p>
      )}
    </>
  );
}
