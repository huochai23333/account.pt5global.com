/** 共享读取、恢复与格式工具：组合或展示本模块已准备的数据；交互回调沿上层状态与服务处理，不在展示中重新实现业务规则。 */
"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import * as FormControls from "@/components/ui/form-controls";

import { useState } from "react";
import type { ReactNode } from "react";

import { Building2, ChevronDown, Folder, FolderOpen, Search, UserRound } from "lucide-react";

import {
  EmptyState,
  formatDateTime,
  mapUserStatus,
  type DashboardSharedCopy,
} from "@/components/dashboard/dashboard-shared-ui";
import { DashboardListSection } from "@/components/dashboard/dashboard-section-panel";
import { MotionCollapse, MotionList, MotionListItem } from "@/components/motion/motion-primitives";
import type { ReferralTreeEdge } from "@/lib/referrals";

import { getPersonDisplayName, type ReferralGraph } from "./referrals-graph";
import {
  getRoleLabel,
  type ReferralTreeDisplayData,
  type ReferralsCopy,
} from "./referrals-display";

type ReferralTreePanelProps = {
  copy: ReferralsCopy;
  currentViewerId: string | null;
  graph: ReferralGraph;
  locale: "zh" | "en";
  noMatchDescription: string;
  noMatchTitle: string;
  onSearchTextChange: (value: string) => void;
  searchPlaceholder: string;
  searchText: string;
  sharedCopy: DashboardSharedCopy;
  title: string;
  treeDisplay: ReferralTreeDisplayData;
};

export function ReferralTreePanel({
  copy,
  currentViewerId,
  graph,
  locale,
  noMatchDescription,
  noMatchTitle,
  onSearchTextChange,
  searchPlaceholder,
  searchText,
  sharedCopy,
  title,
  treeDisplay,
}: ReferralTreePanelProps) {
  return (
    <DashboardListSection
      actions={
        <FormControls.Field className="w-full max-w-sm" label={searchPlaceholder} labelHidden>
          <div className="flex items-center gap-3 rounded-full border border-border bg-surface-interactive px-4">
            <Search className="size-4 text-content-muted" />
            <FormControls.Input
              className="border-0 bg-transparent px-0 focus:ring-0"
              onChange={(event) => onSearchTextChange(event.target.value)}
              placeholder={searchPlaceholder}
              type="text"
              value={searchText}
            />
          </div>
        </FormControls.Field>
      }
      ariaLabel={title}
    >
      <div className="overflow-x-auto rounded-surface-inset border border-border-subtle bg-surface-inset p-3 sm:p-5">
        {treeDisplay.rootIds.length === 0 ? (
          <EmptyState
            description={noMatchDescription}
            icon={<Search className="size-6" />}
            title={noMatchTitle}
          />
        ) : (
          <div className="min-w-0 sm:min-w-[640px]">
            <MotionList className="grid gap-4 sm:gap-6">
              {treeDisplay.rootIds.map((rootId, index) => (
                <MotionListItem index={index} key={rootId}>
                  <ReferralTreeNode
                    copy={copy}
                    currentViewerId={currentViewerId}
                    forceExpanded={searchText.trim().length > 0}
                    graph={graph}
                    incomingEdge={null}
                    isRoot
                    locale={locale}
                    matchingNodeIds={treeDisplay.matchingNodeIds}
                    nodeId={rootId}
                    sharedCopy={sharedCopy}
                    visibleNodeIds={treeDisplay.visibleNodeIds}
                  />
                </MotionListItem>
              ))}
            </MotionList>
          </div>
        )}
      </div>
    </DashboardListSection>
  );
}

function ReferralTreeNode({
  nodeId,
  graph,
  visibleNodeIds,
  matchingNodeIds,
  currentViewerId,
  incomingEdge,
  isRoot = false,
  forceExpanded,
  locale,
  copy,
  sharedCopy,
}: {
  nodeId: string;
  graph: ReferralGraph;
  visibleNodeIds: Set<string>;
  matchingNodeIds: Set<string>;
  currentViewerId: string | null;
  incomingEdge: ReferralTreeEdge | null;
  isRoot?: boolean;
  forceExpanded: boolean;
  locale: "zh" | "en";
  copy: ReferralsCopy;
  sharedCopy: DashboardSharedCopy;
}) {
  const person = graph.nodes.get(nodeId);
  const childEdges = (graph.childEdgesByParent.get(nodeId) ?? []).filter((edge) =>
    visibleNodeIds.has(edge.new_user_id),
  );
  const hasChildren = childEdges.length > 0;
  const isCompanyNode = person?.kind === "company";
  const isCurrentViewer = !isCompanyNode && nodeId === currentViewerId;
  const isMatchingNode = matchingNodeIds.has(nodeId);
  const [expanded, setExpanded] = useState<boolean>(true);

  if (!person) {
    return null;
  }

  const isOpen = forceExpanded || expanded;

  return (
    <div
      className={[
        isRoot
          ? ""
          : "relative pl-4 before:absolute before:left-0 before:top-9 before:w-3 before:border-t before:border-dashed before:border-border-subtle sm:pl-6 sm:before:top-10 sm:before:w-4",
      ].join(" ")}
    >
      {incomingEdge && !incomingEdge.is_company_root_edge ? (
        <div className="mb-2 ml-4 flex flex-wrap items-center gap-2 text-[10px] leading-6 text-content-muted sm:ml-6 sm:text-[11px]">
          <span className="rounded-full bg-status-info-soft px-2.5 py-0.5 font-medium text-primary">
            {copy.tree.referredOn(formatDateTime(incomingEdge.created_at, locale))}
          </span>
        </div>
      ) : null}

      <div
        className={[
          "rounded-record-card border bg-surface-interactive p-3 transition-colors sm:rounded-control-large sm:p-4",
          isCurrentViewer ? "border-border-subtle bg-surface-inset" : "border-border-subtle",
          isMatchingNode ? "ring-4 ring-ring/70" : "",
        ].join(" ")}
      >
        <DesignButton
          className="flex w-full items-start gap-2 text-left sm:gap-3"
          disabled={!hasChildren}
          onClick={() => {
            if (hasChildren && !forceExpanded) {
              setExpanded((current) => !current);
            }
          }}
          type="button"
        >
          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-status-info-soft text-primary">
            {hasChildren ? (
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${
                  isOpen ? "rotate-0" : "-rotate-90"
                }`}
              />
            ) : isCompanyNode ? (
              <Building2 className="size-4" />
            ) : (
              <UserRound className="size-4" />
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-control-compact bg-surface-inset text-primary sm:h-10 sm:w-10 sm:rounded-2xl">
              {isCompanyNode ? (
                <Building2 className="size-5" />
              ) : hasChildren && isOpen ? (
                <FolderOpen className="size-5" />
              ) : hasChildren ? (
                <Folder className="size-5" />
              ) : (
                <UserRound className="size-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-semibold tracking-tight text-content-strong sm:text-lg">
                  {getPersonDisplayName(person)}
                </p>
                {isCurrentViewer ? (
                  <NodeTag accent="blue">{copy.tree.currentAccount}</NodeTag>
                ) : null}
                {isCompanyNode ? <NodeTag accent="gold">{copy.tree.mainBranch}</NodeTag> : null}
                {person.isTeamSalesman ? (
                  <NodeTag accent="green">{copy.tree.teamSales}</NodeTag>
                ) : null}
                {hasChildren ? (
                  <NodeTag accent="gold">{copy.tree.downstreamCount(childEdges.length)}</NodeTag>
                ) : null}
              </div>

              {isCompanyNode ? (
                <p className="mt-2 break-words text-sm leading-7 text-content-muted">
                  {copy.tree.companyBranchDescription}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm leading-7 text-content-muted">
                  <span>{person.email ?? copy.tree.noEmail}</span>
                  <span className="text-content-muted">/</span>
                  <span>{getRoleLabel(person.role, copy)}</span>
                  <span className="text-content-muted">/</span>
                  <span>{mapUserStatus(person.status, sharedCopy).label}</span>
                </div>
              )}
            </div>
          </div>
        </DesignButton>
      </div>

      <MotionCollapse open={hasChildren && isOpen}>
        <div className="relative ml-4 mt-3 border-l border-dashed border-border-subtle pl-4 sm:ml-6 sm:mt-4 sm:pl-6">
          <MotionList className="grid gap-3 sm:gap-4">
            {childEdges.map((childEdge, index) => (
              <MotionListItem
                index={index}
                key={`${childEdge.referrer_user_id}-${childEdge.new_user_id}`}
              >
                <ReferralTreeNode
                  copy={copy}
                  currentViewerId={currentViewerId}
                  forceExpanded={forceExpanded}
                  graph={graph}
                  incomingEdge={childEdge}
                  locale={locale}
                  matchingNodeIds={matchingNodeIds}
                  nodeId={childEdge.new_user_id}
                  sharedCopy={sharedCopy}
                  visibleNodeIds={visibleNodeIds}
                />
              </MotionListItem>
            ))}
          </MotionList>
        </div>
      </MotionCollapse>
    </div>
  );
}

function NodeTag({ children, accent }: { children: ReactNode; accent: "blue" | "green" | "gold" }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
        accent === "blue" ? "bg-surface-inset text-primary" : "",
        accent === "green" ? "bg-status-success-soft text-status-success" : "",
        accent === "gold" ? "bg-status-warning-soft text-status-warning" : "",
      ].join(" ")}
    >
      {children}
    </span>
  );
}
