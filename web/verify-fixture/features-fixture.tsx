/**
 * 격리 검증 픽스처 — FeatureApprovalWizard를 mock 데이터로 마운트해 실픽셀·인터랙션 검증.
 * VERIFY 3.1 전용(프로덕션 번들 아님). 실제 서버/프로젝트 파일 무접촉.
 *
 * App.tsx의 features 배선을 충실히 재현한다:
 *   - featAppliedTick 전역 state, <FeatureApprovalWizard key={project} appliedTick={tick}>
 *   - applyFeature 대역: 반영 대상 0이면 short-circuit(M-1, tick 안 올림), 성공 시에만
 *     승인/반려 id를 큐에서 제거 + tick++.
 * root(features 트리)의 노드가 nodePath로 제안과 매칭돼 카드에 [현재 → 제안] 속성 화살표를 그린다.
 * 검증 대상: features 위저드 전체 경로(진입·결정·skip 재등장·탈출구·요약·반영·재진입 복원·0건 안내).
 */
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import type { FeatureSuggestion, FeatureTreeNode } from "@flowforge/shared";
import { FeatureApprovalWizard } from "../src/FeatureApprovalWizard.js";
import "../src/styles.css";

const PROJECT = "fixture-project";

// features 트리 가상 루트(children=요구사항들). 제안 nodePath가 이 노드들의 label 경로와 맞아야
// 카드가 [현재 속성 → 제안 속성]을 대비 표시한다(못 찾으면 현재값 빈 표기로 폴백).
const ROOT: FeatureTreeNode = {
  id: "__root__",
  kind: "requirement",
  label: "",
  capability: "",
  priority: "",
  status: "",
  children: [
    {
      id: "req-record",
      kind: "requirement",
      label: "기록 자동화",
      capability: "record-automation",
      priority: "중간",
      status: "진행중",
      children: [
        {
          id: "feat-capture",
          kind: "feature",
          label: "빠른 캡처",
          capability: "",
          priority: "낮음",
          status: "시작전",
          children: [],
        },
      ],
    },
    {
      id: "req-search",
      kind: "requirement",
      label: "검색",
      capability: "search",
      priority: "낮음",
      status: "시작전",
      children: [],
    },
  ],
};

// set-attrs 제안 3건 — nodePath가 ROOT의 노드와 매칭. 하나는 rationale 포함.
const INITIAL: FeatureSuggestion[] = [
  {
    id: "f1",
    nodePath: ["기록 자동화"],
    op: "set-attrs",
    priority: "높음",
    status: "진행중",
    rationale: "유저 인터뷰에서 최우선 요구로 확인됨",
  },
  {
    id: "f2",
    nodePath: ["기록 자동화", "빠른 캡처"],
    op: "set-attrs",
    status: "진행중",
  },
  {
    id: "f3",
    nodePath: ["검색"],
    op: "set-attrs",
    priority: "중간",
  },
];

function Fixture(): JSX.Element {
  const [suggestions, setSuggestions] = useState<readonly FeatureSuggestion[]>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState<string>("(아직 반영 없음)");

  const onApply = useCallback((approve: string[], reject: string[]): void => {
    // 반영 대상 0 = 서버 무접촉(M-1) — tick 안 올려 결정 보존. 안내만.
    if (approve.length === 0 && reject.length === 0) {
      setLog("반영할 승인/반려 결정이 없습니다 — 건너뛴 제안은 큐에 남습니다.");
      return;
    }
    setBusy(true);
    setTimeout(() => {
      const removed = new Set([...approve, ...reject]);
      setSuggestions((prev) => prev.filter((s) => !removed.has(s.id)));
      setLog(`반영됨 — approve=[${approve.join(",")}] reject=[${reject.join(",")}]`);
      setTick((t) => t + 1);
      setBusy(false);
    }, 50);
  }, []);

  return (
    <div style={{ padding: 20, background: "#0d1117", minHeight: "100vh" }}>
      <div data-testid="apply-log" style={{ color: "#9ecb3c", marginBottom: 12, fontFamily: "monospace" }}>
        {log}
      </div>
      <FeatureApprovalWizard
        key={PROJECT}
        project={PROJECT}
        root={ROOT}
        suggestions={suggestions}
        busy={busy}
        onApply={onApply}
        appliedTick={tick}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
