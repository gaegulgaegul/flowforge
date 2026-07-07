/**
 * C-2 크로스프로젝트 격리 검증 픽스처 — 이전 verify(단일 fixture-project)가 놓친 경로.
 * App.tsx의 C-2 배선을 충실히 재현한다:
 *   - prdAppliedTick 전역 state, 프로젝트 전환 시 setPrdAppliedTick(0) (openProject 대역)
 *   - <PrdApprovalWizard key={project} appliedTick={tick}> (재마운트 + tick 전달)
 *   - applyPrd: 반영 대상 0이면 short-circuit(M-1), 성공 시에만 tick++
 * 목적: 프로젝트 X에서 [결정 반영하기] 성공 후 프로젝트 Y로 전환했을 때,
 *       Y의 미반영 체크포인트가 파괴되지 않고 그대로 복원되는지 실증.
 * VERIFY 전용(프로덕션 번들 아님).
 */
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Prd, PrdSuggestion } from "@flowforge/shared";
import { PrdApprovalWizard } from "../src/PrdApprovalWizard.js";
import "../src/styles.css";

const PRD: Prd = {
  sections: [
    { key: "overview", title: "개요", body: "현재 개요 본문입니다.", empty: false },
    { key: "value", title: "핵심가치", body: "현재 핵심가치 본문.", empty: false },
    { key: "target", title: "타겟·시나리오", body: "현재 타겟 본문.", empty: false },
  ],
};

const QUEUE_X: PrdSuggestion[] = [
  { id: "x1", section: "overview", op: "replace", proposedBody: "X 개요 제안.", rationale: "rx1" },
  { id: "x2", section: "value", op: "replace", proposedBody: "X 핵심가치 제안.", rationale: "rx2" },
  { id: "x3", section: "target", op: "replace", proposedBody: "X 타겟 제안.", rationale: "rx3" },
];

const QUEUE_Y: PrdSuggestion[] = [
  { id: "y1", section: "overview", op: "replace", proposedBody: "Y 개요 제안.", rationale: "ry1" },
  { id: "y2", section: "value", op: "replace", proposedBody: "Y 핵심가치 제안.", rationale: "ry2" },
  { id: "y3", section: "target", op: "replace", proposedBody: "Y 타겟 제안.", rationale: "ry3" },
];

function Fixture(): JSX.Element {
  const [project, setProject] = useState<"proj-X" | "proj-Y">("proj-X");
  const [queueX, setQueueX] = useState<readonly PrdSuggestion[]>(QUEUE_X);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState<string>("(아직 반영 없음)");

  const suggestions = project === "proj-X" ? queueX : QUEUE_Y;

  const onApply = useCallback(
    (approve: string[], reject: string[]): void => {
      if (approve.length === 0 && reject.length === 0) {
        setLog("반영할 승인/반려 결정이 없습니다 — 건너뛴 제안은 큐에 남습니다.");
        return;
      }
      setBusy(true);
      setTimeout(() => {
        const removed = new Set([...approve, ...reject]);
        if (project === "proj-X") setQueueX((prev) => prev.filter((s) => !removed.has(s.id)));
        setLog(`[${project}] 반영됨 — approve=[${approve.join(",")}] reject=[${reject.join(",")}]`);
        setTick((t) => t + 1);
        setBusy(false);
      }, 50);
    },
    [project],
  );

  const switchTo = useCallback((p: "proj-X" | "proj-Y") => {
    setProject(p);
    setTick(0);
  }, []);

  return (
    <div style={{ padding: 20, background: "#0d1117", minHeight: "100vh", color: "#c9d1d9" }}>
      <div style={{ marginBottom: 12 }}>
        <button data-testid="to-X" onClick={() => switchTo("proj-X")} style={{ marginRight: 8 }}>프로젝트 X 열기</button>
        <button data-testid="to-Y" onClick={() => switchTo("proj-Y")}>프로젝트 Y 열기</button>
        <span data-testid="cur-project" style={{ marginLeft: 12, fontFamily: "monospace" }}>현재: {project}</span>
        <span data-testid="cur-tick" style={{ marginLeft: 12, fontFamily: "monospace" }}>tick: {tick}</span>
      </div>
      <div data-testid="apply-log" style={{ color: "#9ecb3c", marginBottom: 12, fontFamily: "monospace" }}>{log}</div>
      <PrdApprovalWizard
        key={project}
        project={project}
        prd={PRD}
        suggestions={suggestions}
        busy={busy}
        onApply={onApply}
        appliedTick={tick}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
