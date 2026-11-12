"use client";

import * as FormControls from "@/components/ui/form-controls";

import { useId, type ChangeEvent, type Ref, type ReactNode } from "react";

import { FileUp, LoaderCircle, PencilLine, Save, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { Button } from "../ui/button";

/** 规则表和设置卡共用的编辑、保存、取消按钮。 */
export function DashboardInlineEditActions({
  cancelLabel,
  editLabel,
  editing,
  onCancel,
  onEdit,
  onSave,
  pending,
  saveLabel,
  saving = pending,
}: {
  cancelLabel: string;
  editLabel: string;
  editing: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onSave: () => void;
  pending: boolean;
  saveLabel: string;
  saving?: boolean;
}) {
  return editing ? (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={onCancel} type="button" variant="outline">
        <X className="size-4" />
        {cancelLabel}
      </Button>
      <Button disabled={pending} onClick={onSave} type="button">
        {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
        {saveLabel}
      </Button>
    </div>
  ) : (
    <Button disabled={pending} onClick={onEdit} type="button" variant="outline">
      <PencilLine className="size-4" />
      {editLabel}
    </Button>
  );
}

export function DashboardFilePicker({
  accept,
  disabled,
  files,
  label,
  multiple = false,
  onFiles,
  inputRef,
  triggerHidden = false,
}: {
  accept?: string;
  disabled?: boolean;
  files?: readonly File[];
  label?: ReactNode;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  inputRef?: Ref<HTMLInputElement>;
  triggerHidden?: boolean;
}) {
  const id = useId();
  const t = useTranslations("DashboardFramework.files");
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.currentTarget.files ?? []));
    // 清空原生值后，用户可以再次选择同一个文件并触发 change。
    event.currentTarget.value = "";
  };

  return (
    <div className={cn("grid min-w-0 gap-3", triggerHidden && "hidden")}>
      <FormControls.Input
        accept={accept}
        className="sr-only"
        disabled={disabled}
        id={id}
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
      {!triggerHidden ? (
        <label
          aria-disabled={disabled}
          className={cn(
            "inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-surface-interactive px-4 text-sm font-medium text-primary transition hover:bg-surface-inset sm:w-fit",
            disabled && "pointer-events-none opacity-60",
          )}
          htmlFor={id}
        >
          <FileUp className="size-4" />
          {label ?? t("select")}
        </label>
      ) : null}
      {files?.length ? (
        <ul className="grid gap-1.5 text-sm text-content-muted">
          {files.map((file, index) => (
            <li className="break-all" key={`${file.name}:${file.size}:${index}`}>
              {file.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
