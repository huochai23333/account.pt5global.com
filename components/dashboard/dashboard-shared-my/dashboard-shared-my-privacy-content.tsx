import { FileBadge2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputCard, StatusNotice, ValueCard } from "../dashboard-shared-ui";
import type { DashboardMyCopy } from "./dashboard-shared-my-copy";
import type { DashboardSharedMyState } from "./use-dashboard-shared-my-state";

/** 两类证件共用同一展示流程，草稿和提交由上层 Hook 管理；这里不发起隐私读取或写入。 */
export function DashboardSharedMyPrivacyContent({
  copy,
  kind,
  state,
}: {
  copy: DashboardMyCopy;
  kind: "identity" | "passport";
  state: Pick<DashboardSharedMyState, "identity" | "passport" | "ui">;
}) {
  const record = state[kind];
  const labels =
    kind === "identity"
      ? {
          submit: copy.identitySubmit,
          label: copy.identityLabel,
          placeholder: copy.identityPlaceholder,
          pending: copy.identityPendingDescription,
          approved: copy.identityApprovedDescription,
        }
      : {
          submit: copy.passportSubmit,
          label: copy.passportLabel,
          placeholder: copy.passportPlaceholder,
          pending: copy.passportPendingDescription,
          approved: copy.passportApprovedDescription,
        };

  if (record.status === "empty" || record.editing) {
    return (
      <InputCard
        actionLabel={labels.submit}
        busy={state.ui.busyKey === kind}
        icon={<FileBadge2 className="size-5" />}
        label={labels.label}
        onAction={() => void record.submit()}
        onChange={record.setDraft}
        placeholder={labels.placeholder}
        value={record.draft}
      />
    );
  }

  return (
    <div className="space-y-5">
      <StatusNotice
        description={
          record.status === "pending" ? labels.pending : labels.approved
        }
        status={record.status}
      />
      <ValueCard
        icon={<FileBadge2 className="size-5" />}
        label={labels.label}
        value={record.value}
      />
      {record.status === "approved" ? (
        <div className="flex justify-end">
          <Button
            size="default"
            onClick={() => {
              record.setEditing(true);
              record.setDraft(record.value);
            }}
            variant="outline"
          >
            {copy.retryEdit}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
