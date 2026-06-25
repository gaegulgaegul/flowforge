/**
 * CapabilityChangeList — 한 capability에 속한 change 목록 (capability-change-navigation).
 *
 * change를 한글 제목(displayName)으로 보여주고, 클릭하면 기존 5종 뷰(prd|spec|flow|ia|wire)로
 * 진입한다(2-a). 연결된 change가 0개면 "연결된 change 없음" 빈 상태를 명시 표시한다
 * (에러 아님, silent drop 금지). 표시는 displayName(한글), 라우팅은 key(영문).
 */
import type { ChangeSummary } from "./api";

interface Props {
  /** 현재 capability의 한글 표시명(헤더용). */
  capabilityLabel: string;
  changes: ChangeSummary[];
  /** change 클릭 — 셸이 기존 5종 뷰로 진입(영문 key로 라우팅). */
  onOpenChange: (change: ChangeSummary) => void;
}

export function CapabilityChangeList({ capabilityLabel, changes, onOpenChange }: Props): JSX.Element {
  return (
    <div className="ccl">
      <h3 className="ccl-title">{capabilityLabel} — 연결된 change</h3>
      {changes.length === 0 ? (
        <p className="ccl-empty">이 capability에 연결된 change가 없습니다.</p>
      ) : (
        <ul className="ccl-list">
          {changes.map((c) => (
            <li key={c.key} className="ccl-item">
              <button
                type="button"
                className="ccl-link"
                onClick={() => onOpenChange(c)}
                title={`${c.key} 5종 뷰 열기`}
              >
                {c.displayName}
                <span className="ccl-arrow" aria-hidden="true">▶</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
