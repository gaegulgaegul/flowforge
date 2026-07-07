/**
 * 격리 검증 픽스처 — PrdApprovalWizard를 mock 데이터로 마운트해 실픽셀·인터랙션 검증.
 * VERIFY 3.1 전용(프로덕션 번들 아님). 실제 서버/프로젝트 파일 무접촉.
 * onApply는 mock: 승인/반려된 id를 큐에서 제거해 서버 반영 후 큐 축소를 흉내낸다.
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
    { key: "metrics", title: "성공지표", body: "현재 성공지표 본문.", empty: false },
    { key: "attributes", title: "속성설정", body: "현재 속성 본문.", empty: false },
  ],
};

const INITIAL: PrdSuggestion[] = [
  { id: "s1", section: "overview", op: "replace", proposedBody: "제안: 개요를 기록 자동화 중심으로 갱신.", rationale: "유저 인터뷰 반영" },
  { id: "s2", section: "value", op: "replace", proposedBody: "제안: 핵심가치를 '정리 없이 정리되는 기록'으로.", rationale: "차별화" },
  { id: "s3", section: "target", op: "replace", proposedBody: "제안: 세컨더리 타겟 조부모 추가.", rationale: "가입자 데이터" },
];

const PROJECT = "fixture-project";

function Fixture(): JSX.Element {
  const [suggestions, setSuggestions] = useState<readonly PrdSuggestion[]>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState<string>("(아직 반영 없음)");

  // App.tsx applyPrd 대역: 반영 대상 0이면 short-circuit(M-1 — 유령 성공으로 결정을 지우지 않음),
  // 성공 시에만 큐 축소 + tick++(반영 성공 신호 → 셸이 결정 맵 리셋). appliedTick 계약을 실증한다.
  const onApply = useCallback((approve: string[], reject: string[]): void => {
    if (approve.length === 0 && reject.length === 0) {
      setLog("반영할 승인/반려 결정이 없습니다 — 건너뛴 제안은 큐에 남습니다.");
      return;
    }
    setBusy(true);
    // 서버 반영을 흉내: 승인·반려된 id를 큐에서 제거(문서·큐 갱신) 후 tick++.
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
      <PrdApprovalWizard
        key={PROJECT}
        project={PROJECT}
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
