/**
 * 격리 검증 픽스처 — UserFlowApprovalWizard를 mock 데이터로 마운트해 실픽셀·인터랙션 검증.
 * VERIFY 3.1 전용(프로덕션 번들 아님). 실제 서버/프로젝트 파일 무접촉.
 *
 * App.tsx의 userflow 배선(stem 전환 포함)을 충실히 재현한다 — stem 격리가 핵심 경로:
 *   - stem state(2개: "main"/"v2") + 전환 select
 *   - <UserFlowApprovalWizard key={`${project}:${stem}`} stem={stem} appliedTick={tick}>
 *   - switchPlanningFlow 대역: stem 전환 시 tick을 0으로 리셋(cross-stem 소실 방지)
 *   - applyUserFlow 대역: 반영 대상 0이면 short-circuit(M-1), 성공 시 그 stem 큐에서 id 제거 + tick++
 *   - stem별 제안 큐(Record<stem, UserFlowSuggestion[]>) — 전환 시 다른 카드가 뜬다.
 *     이것으로 체크포인트 키 `uflow-wizard:<project>:<stem>`가 stem별 결정을 격리함을 실증한다
 *     (stem 전환 → 다른 큐 → 결정이 stem 간 새지 않음).
 * 검증 대상: userflow 위저드 전체 경로 + stem 격리.
 */
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import type { UserFlowSuggestion } from "@flowforge/shared";
import { UserFlowApprovalWizard } from "../src/UserFlowApprovalWizard.js";
import "../src/styles.css";

const PROJECT = "fixture-project";

type Stem = "main" | "v2";

// stem별 제안 큐 — 전환 시 다른 카드가 뜨는지로 stem 격리를 검증한다.
// happy(실선)·edgecase(점선) 혼합, newNode(신규 화면 badge) 하나, to 하나, label/rationale 섞음.
const INITIAL: Record<Stem, readonly UserFlowSuggestion[]> = {
  main: [
    {
      id: "m1",
      op: "add-edge",
      from: "landing",
      to: "signup",
      edgeKind: "happy",
      label: "가입하기 클릭",
      rationale: "메인 전환 경로 — 랜딩에서 바로 가입으로",
    },
    {
      id: "m2",
      op: "add-edge",
      from: "signup",
      newNode: { id: "verify", label: "이메일 인증" },
      edgeKind: "happy",
      rationale: "가입 직후 신규 인증 화면 필요",
    },
    {
      id: "m3",
      op: "add-edge",
      from: "signup",
      to: "landing",
      edgeKind: "edgecase",
      label: "인증 실패 → 되돌아감",
    },
  ],
  v2: [
    {
      id: "v1",
      op: "add-edge",
      from: "home",
      to: "onboarding",
      edgeKind: "happy",
      label: "첫 방문 온보딩",
    },
    {
      id: "v2",
      op: "add-edge",
      from: "onboarding",
      to: "home",
      edgeKind: "edgecase",
      label: "온보딩 건너뛰기",
      rationale: "재방문 유저는 온보딩 스킵",
    },
  ],
};

function Fixture(): JSX.Element {
  const [stem, setStem] = useState<Stem>("main");
  const [queues, setQueues] = useState<Record<Stem, readonly UserFlowSuggestion[]>>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState<string>("(아직 반영 없음)");

  const suggestions = queues[stem];

  const onApply = useCallback(
    (approve: string[], reject: string[]): void => {
      // 반영 대상 0 = 서버 무접촉(M-1) — tick 안 올려 결정 보존. 안내만.
      if (approve.length === 0 && reject.length === 0) {
        setLog("반영할 승인/반려 결정이 없습니다 — 건너뛴 제안은 큐에 남습니다.");
        return;
      }
      setBusy(true);
      setTimeout(() => {
        const removed = new Set([...approve, ...reject]);
        // 제출 시점의 stem 큐에서만 제거(다른 stem 큐 불변 = 격리).
        setQueues((prev) => ({
          ...prev,
          [stem]: prev[stem].filter((s) => !removed.has(s.id)),
        }));
        setLog(`[${stem}] 반영됨 — approve=[${approve.join(",")}] reject=[${reject.join(",")}]`);
        setTick((t) => t + 1);
        setBusy(false);
      }, 50);
    },
    [stem],
  );

  // switchPlanningFlow 대역 — stem 전환 시 tick 0 리셋(key 리마운트와 별개, cross-stem tick 소실 방지).
  const switchStem = useCallback((next: Stem) => {
    setStem(next);
    setTick(0);
    setLog("(아직 반영 없음)");
  }, []);

  return (
    <div style={{ padding: 20, background: "#0d1117", minHeight: "100vh", color: "#c9d1d9" }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontFamily: "monospace", marginRight: 8 }}>stem:</label>
        <select
          data-testid="stem-switch"
          value={stem}
          onChange={(e) => switchStem(e.target.value as Stem)}
        >
          <option value="main">main</option>
          <option value="v2">v2</option>
        </select>
        <span data-testid="cur-stem" style={{ marginLeft: 12, fontFamily: "monospace" }}>
          현재: {stem}
        </span>
        <span data-testid="cur-tick" style={{ marginLeft: 12, fontFamily: "monospace" }}>
          tick: {tick}
        </span>
      </div>
      <div data-testid="apply-log" style={{ color: "#9ecb3c", marginBottom: 12, fontFamily: "monospace" }}>
        {log}
      </div>
      <UserFlowApprovalWizard
        key={`${PROJECT}:${stem}`}
        project={PROJECT}
        stem={stem}
        suggestions={suggestions}
        busy={busy}
        onApply={onApply}
        appliedTick={tick}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
