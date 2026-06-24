/** decision 타임라인 패널 — charter 상주 docs(PRD.md)의 decision 이력을 시간순 읽기전용으로 렌더. */
import type { DecisionTimeline as DecisionTimelineT, DocsDecision } from "@flowforge/shared";

/** 라벨이 붙은 한 줄(why/what/success/...). 텍스트는 React가 자동 이스케이프(dangerouslySetInnerHTML 미사용). */
function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="dt-row">
      <span className="dt-row-label">{label}</span>
      <span className="dt-row-value">{value}</span>
    </div>
  );
}

function DecisionItem({ decision }: { decision: DocsDecision }): JSX.Element {
  const className = `dt-item${decision.superseded ? " dt-item--superseded" : ""}`;
  return (
    <li
      className={className}
      data-testid={`decision-${decision.id}`}
      style={decision.superseded ? { opacity: 0.5 } : undefined}
    >
      <div className="dt-item-header">
        <span className="dt-item-id">{decision.id}</span>
        <span className="dt-item-date">{decision.date || "(날짜 없음)"}</span>
        {decision.seed && (
          <span className="dt-seed" data-testid="seed-badge" title="미검증(SEED) — 사람 검토 전">
            🟡 SEED
          </span>
        )}
        {decision.superseded && (
          <span className="dt-superseded-tag">
            superseded{decision.supersededBy ? ` → ${decision.supersededBy}` : ""}
          </span>
        )}
      </div>
      <div className="dt-item-body">
        <Row label="why" value={decision.why} />
        <Row label="what" value={decision.what} />
        <Row label="success" value={decision.success} />
        <Row label="capability" value={decision.capability} />
        <Row label="status" value={decision.status} />
      </div>
    </li>
  );
}

export function DecisionTimeline({ timeline }: { timeline: DecisionTimelineT }): JSX.Element {
  if (timeline.decisions.length === 0) {
    return (
      <div className="dt-doc" data-testid="decision-timeline">
        <p className="dt-empty-note">decision 이력이 없습니다.</p>
      </div>
    );
  }
  return (
    <ol className="dt-doc" data-testid="decision-timeline">
      {timeline.decisions.map((d) => (
        <DecisionItem key={d.id} decision={d} />
      ))}
    </ol>
  );
}
