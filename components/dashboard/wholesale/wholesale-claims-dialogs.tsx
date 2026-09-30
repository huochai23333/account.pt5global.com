"use client";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { DashboardFilePicker } from "@/components/dashboard/dashboard-framework-primitives";
import { DashboardFilterField } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import type { Wholesale1688IngestRow } from "@/lib/wholesale-1688-ingest";
import { parseWholesale1688Csv } from "@/lib/wholesale-1688-ingest";
import { parseWholesale1688Xlsx } from "@/lib/wholesale-1688-xlsx";
export function Wholesale1688UploadDialog({
  onImportRows,
  onOpenChange,
  open,
  pending,
}: {
  onImportRows: (
    fileName: string,
    rows: Wholesale1688IngestRow[],
  ) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
}) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_claims_dialogs",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Wholesale1688IngestRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const rowsWithRecipient = parsedRows.filter(
    (row) => row.recipient_name,
  ).length;
  return (
    <DashboardDialog
      description={uiText("attribute001")}
      onOpenChange={onOpenChange}
      open={open}
      title={uiText("attribute002")}
    >
      <div className="space-y-4">
        <DashboardFilterField label={uiText("attribute003")}>
          <DashboardFilePicker
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            files={selectedFile ? [selectedFile] : []}
            label={
              <UiMessage id="components_dashboard_wholesale_wholesale_claims_dialogs.text001" />
            }
            onFiles={(files) => {
              const file = files[0];
              if (!file) return;
              setSelectedFile(file);
              setParseError(null);
              setParsedRows([]);
              parseWholesale1688File(file)
                .then((rows) => {
                  setParsedRows(rows);
                  setParseError(
                    rows.length === 0
                      ? "没有读取到采购订单，请确认选择的是从 1688 导出的订单表格。"
                      : null,
                  );
                })
                .catch(() => {
                  setParsedRows([]);
                  setParseError("订单表格没有读取成功，请重新选择。");
                });
            }}
          />
        </DashboardFilterField>
        {parseError ? (
          <p className="text-sm text-status-danger">{parseError}</p>
        ) : parsedRows.length > 0 ? (
          <p className="text-sm leading-6 text-content-muted">
            <UiMessage id="components_dashboard_wholesale_wholesale_claims_dialogs.text002" />
            {parsedRows.length}
            <UiMessage id="components_dashboard_wholesale_wholesale_claims_dialogs.text003" />
            {rowsWithRecipient}{" "}
            <UiMessage id="components_dashboard_wholesale_wholesale_claims_dialogs.text004" />
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="default"
            className="disabled:opacity-60"
            disabled={parsedRows.length === 0 || pending}
            loading={pending}
            onClick={async () => {
              const succeeded = await onImportRows(
                selectedFile?.name ?? "",
                parsedRows,
              );
              // 导入失败时继续展示已经解析好的表格，不要求用户重新选文件。
              if (!succeeded) return;
              onOpenChange(false);
            }}
            type="button"
          >
            <FileSpreadsheet className="size-4" />
            <UiMessage id="components_dashboard_wholesale_wholesale_claims_dialogs.text005" />
          </Button>
        </div>
      </div>
    </DashboardDialog>
  );
}
async function parseWholesale1688File(file: File) {
  const lowerFileName = file.name.toLowerCase();
  if (lowerFileName.endsWith(".xlsx")) {
    return parseWholesale1688Xlsx(await file.arrayBuffer());
  }
  if (lowerFileName.endsWith(".csv")) {
    return parseWholesale1688Csv(await file.text());
  }
  throw new Error("unsupported_file");
}
