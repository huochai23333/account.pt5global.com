"use client";

import { useMemo, useState } from "react";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ClientBusinessCandidate } from "@/lib/client-business-access";
import { normalizeSearchText } from "@/lib/value-normalizers";

import { Button } from "../ui/button";
import { DashboardDialog } from "./dashboard-dialog";
import {
  DashboardFilterField,
  DashboardSearchInput,
} from "./dashboard-section-panel";
import { FeedbackNotice } from "@/components/ui/feedback-notice";

type ClientBusinessAddDialogProps = {
  business: "tourism" | "wholesale";
  candidates: ClientBusinessCandidate[];
  error: string | null;
  onAdd: (userId: string) => Promise<boolean>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingUserId: string | null;
};

export function ClientBusinessAddDialog({
  business,
  candidates,
  error,
  onAdd,
  onOpenChange,
  open,
  pendingUserId,
}: ClientBusinessAddDialogProps) {
  const t = useTranslations("ClientBusinessAccess");
  const [searchText, setSearchText] = useState("");
  const filteredCandidates = useMemo(() => {
    const searchValue = normalizeSearchText(searchText);

    if (!searchValue) {
      return candidates;
    }

    return candidates.filter((candidate) =>
      [candidate.name, candidate.email, candidate.phone].some((value) =>
        normalizeSearchText(value ?? "").includes(searchValue),
      ),
    );
  }, [candidates, searchText]);

  return (
    <DashboardDialog
      description={t("description", { business: t(`businesses.${business}`) })}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSearchText("");
        }
        onOpenChange(nextOpen);
      }}
      open={open}
      title={t("title", { business: t(`businesses.${business}`) })}
    >
      <div className="min-w-0 space-y-5">
        {error ? <FeedbackNotice tone="error">{error}</FeedbackNotice> : null}

        <DashboardFilterField label={t("searchLabel")}>
          <DashboardSearchInput
            onChange={setSearchText}
            placeholder={t("searchPlaceholder")}
            value={searchText}
          />
        </DashboardFilterField>

        <div className="max-h-[min(55vh,430px)] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {filteredCandidates.length === 0 ? (
            <p className="rounded-record-card border border-dashed border-border-subtle px-4 py-8 text-center text-sm leading-6 text-content-muted">
              {t("empty")}
            </p>
          ) : (
            filteredCandidates.map((candidate) => {
              const pending = pendingUserId === candidate.userId;

              return (
                <div
                  className="flex min-w-0 flex-col gap-3 rounded-record-card border border-border-subtle bg-surface-panel p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={candidate.userId}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-content-muted">
                      {candidate.name?.trim() ||
                        candidate.email ||
                        t("unnamed")}
                    </p>
                    <p className="mt-1 break-words text-sm leading-6 text-content-muted">
                      {[candidate.email, candidate.phone]
                        .filter(Boolean)
                        .join(" / ") || t("noContact")}
                    </p>
                  </div>
                  <Button
                    className="shrink-0"
                    disabled={Boolean(pendingUserId)}
                    loading={pending}
                    onClick={async () => {
                      const succeeded = await onAdd(candidate.userId);
                      if (succeeded) onOpenChange(false);
                    }}
                    size="compact"
                    type="button"
                    variant="primary"
                  >
                    <Plus className="size-4" />
                    {pending ? t("adding") : t("add")}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardDialog>
  );
}
