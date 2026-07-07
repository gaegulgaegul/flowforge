/**
 * S7 실패 경로 전용 격리 픽스처 — onApply가 서버 실패를 흉내낸다(큐 축소 안 함).
 * 위저드 apply()가 decisions를 스스로 지우지 않으므로, 실패 후에도 결정·체크포인트가
 * 보존돼 재시도 가능함을 실증한다. VERIFY 3.1 S7 전용(프로덕션 번들 아님).
 */
import { useState } from "react";
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
  { id: "s1", section: "overview", op: "replace", proposedBody: "제안: 개요 갱신.", rationale: "r1" },
  { id: "s2", section: "value", op: "replace", proposedBody: "제안: 핵심가치 갱신.", rationale: "r2" },
  { id: "s3", section: "target", op: "replace", proposedBody: "제안: 타겟 갱신.", rationale: "r3" },
];

function Fixture(): JSX.Element {
  const [suggestions] = useState<readonly PrdSuggestion[]>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("(아직 반영 없음)");

  // 서버 반영 실패 흉내: 큐를 축소하지 않고 실패 고지만(App.applyPrd의 .catch 경로 대역)
  const onApply = (approve: string[], reject: string[]): void => {
    setBusy(true);
    setTimeout(() => {
      setLog(`반영 실패 — 결정 보존됨(재시도 가능). approve=[${approve.join(",")}] reject=[${reject.join(",")}]`);
      setBusy(false); // 큐 그대로 = 서버 반영 실패 → 위저드는 요약에 머물고 체크포인트 잔존
    }, 50);
  };

  return (
    <div style={{ padding: 20, background: "#0d1117", minHeight: "100vh" }}>
      <div data-testid="apply-log" style={{ color: "#e06c5c", marginBottom: 12, fontFamily: "monospace" }}>{log}</div>
      {/* appliedTick 고정 0 — 실패 경로엔 tick bump 없음(결정 보존 계약을 픽스처로 실증). */}
      <PrdApprovalWizard project="fixture-fail" prd={PRD} suggestions={suggestions} busy={busy} onApply={onApply} appliedTick={0} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
