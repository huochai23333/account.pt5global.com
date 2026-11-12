"use client";

import { useMemo, useRef, useState } from "react";
import { readAssistantEventStream } from "@/lib/ai-assistant/assistant-event-stream";
import type { WholesaleOrderAssessmentFilters } from "@/lib/wholesale-order-assessment-types";

export function useWholesaleOrderAssessment(
  filters: WholesaleOrderAssessmentFilters,
) {
  const [rawAssessment, setRawAssessment] = useState("");
  const [assessmentFilterKey, setAssessmentFilterKey] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const assessment = useMemo(
    () => sanitizeWholesaleAssessmentText(rawAssessment),
    [rawAssessment],
  );
  const hasStaleAssessment =
    Boolean(assessment) && assessmentFilterKey !== filterKey;

  const generateAssessment = async () => {
    // 连续点击可能先于按钮重新渲染，同步锁保证同一页面只发一次请求。
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailed(false);
    setRawAssessment("");
    setAssessmentFilterKey(filterKey);

    try {
      const response = await fetch("/api/wholesale/order-assessment", {
        body: JSON.stringify({ filters, requestId: crypto.randomUUID() }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok || !response.body) throw new Error("assessment_failed");
      await readAssistantEventStream(response.body, (chunk) => {
        setRawAssessment((current) => `${current}${chunk}`);
      });
    } catch {
      // 只收到部分文字时，清除草稿，避免把没有完成凭证的输出留在结果区。
      setRawAssessment("");
      setFailed(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return {
    assessment,
    failed,
    generateAssessment,
    hasStaleAssessment,
    pending,
  };
}
function sanitizeWholesaleAssessmentText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      let nextLine = line.trimEnd();

      nextLine = nextLine
        .replace(/^\s*#{1,6}\s*/, "")
        .replace(/^\s*[-*+]\s+/, "· ")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/\*([^*\n]+)\*/g, "$1")
        .replace(/_([^_\n]+)_/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*/g, "");

      return nextLine.trimEnd();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
