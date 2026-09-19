"use client";

import { useMemo } from "react";

import { useTranslations } from "next-intl";

import { useLocale } from "@/components/i18n/locale-provider";
import type { DashboardHomePageData } from "@/lib/dashboard-home";

import { DashboardHomeCustomizer } from "./dashboard-home-customizer";
import { createHomeTodoCopy } from "./dashboard-home-todo-display";

type DashboardHomeClientProps = {
  initialData: DashboardHomePageData;
};

export function DashboardHomeClient({ initialData }: DashboardHomeClientProps) {
  const t = useTranslations("DashboardHome");
  const { locale } = useLocale();
  const greetingCopy = useMemo(
    () => ({
      greeting: {
        afternoon: t("greeting.afternoon"),
        evening: t("greeting.evening"),
        morning: t("greeting.morning"),
        noon: t("greeting.noon"),
      },
      subtitle: t("subtitle"),
      title: (name: string) => t("title", { name }),
      unnamedUser: t("unnamedUser"),
    }),
    [t],
  );
  const announcementsCopy = useMemo(
    () => ({
      emptyDescription: t("announcements.emptyDescription"),
      emptyTitle: t("announcements.emptyTitle"),
      sectionDescription: t("announcements.description"),
      sectionTitle: t("announcements.title"),
    }),
    [t],
  );
  const clockCopy = useMemo(
    () => ({
      description: t("clock.description"),
      miniTitle: t("clock.miniTitle"),
      timezoneLabel: t("clock.timezoneLabel"),
      title: t("clock.title"),
    }),
    [t],
  );
  const inviteCopy = useMemo(
    () => ({
      businessBoards: {
        tourism: t("invite.businessBoards.tourism"),
        wholesale: t("invite.businessBoards.wholesale"),
      },
      codeLabel: t("invite.codeLabel"),
      copiedBoardLink: (board: string) =>
        t("invite.copiedBoardLink", { board }),
      copiedCode: t("invite.copiedCode"),
      copiedLink: t("invite.copiedLink"),
      copyBoardLink: (board: string) => t("invite.copyBoardLink", { board }),
      copyCode: t("invite.copyCode"),
      copyFailed: t("invite.copyFailed"),
      copyLink: t("invite.copyLink"),
      description: t("invite.description"),
      noCodeDescription: t("invite.noCodeDescription"),
      noCodeTitle: t("invite.noCodeTitle"),
      noLinkAccess: t("invite.noLinkAccess"),
      title: t("invite.title"),
    }),
    [t],
  );
  const widgetCopy = useMemo(
    () => ({
      announcements: announcementsCopy,
      clock: clockCopy,
      greeting: greetingCopy,
      invite: inviteCopy,
      widgets: {
        announcementCount: (count: number) =>
          t("customizer.summary.announcementCount", { count }),
        todoCount: (count: number) =>
          t("customizer.summary.todoCount", { count }),
      },
    }),
    [announcementsCopy, clockCopy, greetingCopy, inviteCopy, t],
  );
  const customizerCopy = useMemo(
    () => ({
      addWidget: t("customizer.addWidget"),
      addWidgetsTitle: t("customizer.addWidgetsTitle"),
      adjustWidget: t("customizer.adjustWidget"),
      currentWidgetsTitle: t("customizer.currentWidgetsTitle"),
      done: t("customizer.done"),
      edit: t("customizer.edit"),
      emptyDescription: t("customizer.emptyDescription"),
      emptyTitle: t("customizer.emptyTitle"),
      instanceLabel: (title: string, index: number) =>
        t("customizer.instanceLabel", { index, title }),
      makeNarrower: t("customizer.makeNarrower"),
      makeShorter: t("customizer.makeShorter"),
      makeTaller: t("customizer.makeTaller"),
      makeWider: t("customizer.makeWider"),
      manage: t("customizer.manage"),
      manageDescription: t("customizer.manageDescription"),
      moveDown: t("customizer.moveDown"),
      moveEarlier: t("customizer.moveEarlier"),
      moveLater: t("customizer.moveLater"),
      moveLeft: t("customizer.moveLeft"),
      moveRight: t("customizer.moveRight"),
      moveUp: t("customizer.moveUp"),
      positionTitle: t("customizer.positionTitle"),
      removeWidget: t("customizer.removeWidget"),
      reset: t("customizer.reset"),
      resizeDiagonal: t("customizer.resizeDiagonal"),
      resizeHorizontal: t("customizer.resizeHorizontal"),
      resizeVertical: t("customizer.resizeVertical"),
      retrySave: t("customizer.retrySave"),
      saveError: t("customizer.saveError"),
      savePending: t("customizer.savePending"),
      saveSuccess: t("customizer.saveSuccess"),
      sidebarDescription: t("customizer.sidebarDescription"),
      sidebarTitle: t("customizer.sidebarTitle"),
      sizeLabel: (width: number, height: number) =>
        t("customizer.sizeLabel", { height, width }),
      sizeTitle: t("customizer.sizeTitle"),
      widgets: {
        announcements: {
          description: t("customizer.widgets.announcements.description"),
          title: t("customizer.widgets.announcements.title"),
        },
        clock: {
          description: t("customizer.widgets.clock.description"),
          title: t("customizer.widgets.clock.title"),
        },
        invite: {
          description: t("customizer.widgets.invite.description"),
          title: t("customizer.widgets.invite.title"),
        },
        greeting: {
          description: t("customizer.widgets.greeting.description"),
          title: t("customizer.widgets.greeting.title"),
        },
        todos: {
          description: t("customizer.widgets.todos.description"),
          title: t("customizer.widgets.todos.title"),
        },
      },
    }),
    [t],
  );
  const todoCopy = useMemo(() => createHomeTodoCopy(t), [t]);

  return (
    <DashboardHomeCustomizer
      copy={widgetCopy}
      customizerCopy={customizerCopy}
      initialData={initialData}
      locale={locale}
      todoCopy={todoCopy}
    />
  );
}
