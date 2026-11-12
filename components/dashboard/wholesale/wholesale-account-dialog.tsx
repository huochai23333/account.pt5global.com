"use client";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import type { WholesaleProfile } from "@/lib/wholesale";

import { useTranslations } from "next-intl";
import { WholesaleDetailGrid } from "./wholesale-detail-grid";

type WholesaleAccountDialogProps = {
  onSelectedProfileChange: (profile: WholesaleProfile | null) => void;
  selectedProfile: WholesaleProfile | null;
};

export function WholesaleAccountDialog({
  onSelectedProfileChange,
  selectedProfile,
}: WholesaleAccountDialogProps) {
  return (
    <DashboardDialog
      onOpenChange={(open) => {
        if (!open) onSelectedProfileChange(null);
      }}
      open={Boolean(selectedProfile)}
      title={selectedProfile?.name || selectedProfile?.email || "账号详情"}
    >
      {selectedProfile ? (
        <WholesaleAccountDetails profile={selectedProfile} />
      ) : null}
    </DashboardDialog>
  );
}

// 详情只读，沿用目录已授权返回的同一份账号资料。
function WholesaleAccountDetails({
  profile,
}: {
  profile: WholesaleProfile;
}) {
  const t = useTranslations("WholesaleBusiness.directoryUi");
  const rows = [
    {
      label: t("details.name"),
      value: profile.name ?? t("fallbacks.notProvided"),
    },
    {
      label: t("details.email"),
      value: profile.email ?? t("fallbacks.notProvided"),
    },
    {
      label: t("details.phone"),
      value: profile.phone ?? t("fallbacks.notProvided"),
    },
    {
      label: t("details.city"),
      value: profile.city ?? t("fallbacks.notProvided"),
    },
    {
      label: t("details.role"),
      value:
        profile.role === "promoter" ? t("roles.promoter") : t("roles.salesman"),
    },
    {
      label: t("details.status"),
      value:
        profile.status === "active"
          ? t("statuses.active")
          : t("statuses.inactive"),
    },
  ];
  return <WholesaleDetailGrid rows={rows} />;
}
