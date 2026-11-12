"use client";

import { useTranslations } from "next-intl";
import type { AdminOperationRecord } from "@/lib/admin-operation-records-contract";
import type { Locale } from "@/lib/locale";
import {
  formatOperationDate,
  getOperationUserContact,
  getOperationUserLabel,
  getRoleChangeLabel,
  getStatusChangeLabel,
} from "./admin-operation-records-display";
import type { useAdminOperationRecordsViewModel } from "./use-admin-operation-records-view-model";

type OperationRecordsViewModel = ReturnType<
  typeof useAdminOperationRecordsViewModel
>;

// 同一行使用已翻译的分类、岗位和状态，保持筛选与详情一致。
export function OperationRecordRow({
  actionLabels,
  categoryLabels,
  locale,
  record,
  roleLabels,
  statusLabels,
}: {
  actionLabels: OperationRecordsViewModel["actionLabels"];
  categoryLabels: OperationRecordsViewModel["categoryLabels"];
  locale: Locale;
  record: AdminOperationRecord;
  roleLabels: OperationRecordsViewModel["roleLabels"];
  statusLabels: OperationRecordsViewModel["statusLabels"];
}) {
  const t = useTranslations("OperationRecords");
  const fallback = t("fallback.notProvided");

  return (
    <tr className="align-top text-content-muted">
      <td className="px-4 py-4 text-xs leading-6 text-content-muted">
        {formatOperationDate(record.occurredAt, locale, fallback)}
      </td>
      <td className="px-4 py-4">
        <span className="inline-flex rounded-full bg-status-info-soft px-3 py-1 text-xs font-semibold text-primary">
          {categoryLabels[record.category]}
        </span>
      </td>
      <td className="px-4 py-4 font-semibold text-content-strong">
        {actionLabels[record.action]}
      </td>
      <td className="px-4 py-4">
        <p className="font-semibold text-content-strong">
          {getOperationUserLabel(record.subject, fallback)}
        </p>
        <p className="mt-1 text-xs text-content-muted">
          {getOperationUserContact(record.subject, fallback)}
        </p>
      </td>
      <td className="px-4 py-4">
        <p className="font-semibold text-content-strong">
          {getOperationUserLabel(record.actor, fallback)}
        </p>
        <p className="mt-1 text-xs text-content-muted">
          {getOperationUserContact(record.actor, fallback)}
        </p>
      </td>
      <td className="max-w-[340px] px-4 py-4 text-content-muted">
        <OperationRecordDetail
          record={record}
          roleLabels={roleLabels}
          statusLabels={statusLabels}
        />
      </td>
    </tr>
  );
}

function OperationRecordDetail({
  record,
  roleLabels,
  statusLabels,
}: {
  record: AdminOperationRecord;
  roleLabels: OperationRecordsViewModel["roleLabels"];
  statusLabels: OperationRecordsViewModel["statusLabels"];
}) {
  const t = useTranslations("OperationRecords");
  const fallback = t("fallback.notProvided");

  return (
    <div className="space-y-1.5 text-sm leading-6">
      {record.roleChange ? (
        <p>
          {t("detail.roleChange", {
            from: getRoleChangeLabel(
              record.roleChange.from,
              roleLabels,
              fallback,
            ),
            to: getRoleChangeLabel(record.roleChange.to, roleLabels, fallback),
          })}
        </p>
      ) : null}
      {record.statusChange ? (
        <p>
          {t("detail.statusChange", {
            from: getStatusChangeLabel(
              record.statusChange.from,
              statusLabels,
              fallback,
            ),
            to: getStatusChangeLabel(
              record.statusChange.to,
              statusLabels,
              fallback,
            ),
          })}
        </p>
      ) : null}
      {record.nameChange ? (
        <p>
          {t("detail.nameChange", {
            from: record.nameChange.from ?? fallback,
            to: record.nameChange.to ?? fallback,
          })}
        </p>
      ) : null}
      {record.cityChange ? (
        <p>
          {t("detail.cityChange", {
            from: record.cityChange.from ?? fallback,
            to: record.cityChange.to ?? fallback,
          })}
        </p>
      ) : null}
      {record.note ? (
        <p>{t("detail.note", { note: record.note })}</p>
      ) : record.category === "account" ? (
        <p>{t("detail.noNote")}</p>
      ) : null}
    </div>
  );
}
