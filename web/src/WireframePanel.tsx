/** 와이어프레임 패널 — 화면별 모바일 프레임에 스켈레톤 박스 스택(읽기전용 미리보기). */
import type { Wireframe, WireBoxKind } from "@flowforge/shared";

const KIND_LABEL: Record<WireBoxKind, string> = {
  header: "제목",
  list: "목록",
  button: "버튼",
  field: "입력/표시",
  empty: "빈 상태",
};

export function WireframePanel({ wireframe }: { wireframe: Wireframe }): JSX.Element {
  if (wireframe.screens.length === 0) {
    return <div className="wf-empty-note">이 변경에는 화면(screen) spec이 없어 와이어프레임이 없습니다.</div>;
  }
  return (
    <div className="wf-board">
      {wireframe.screens.map((s) => (
        <div key={s.id} className="wf-frame" data-testid={`wf-frame-${s.id}`}>
          <div className="wf-frame-title">{s.title}</div>
          <div className="wf-frame-body">
            {s.boxes.map((b, i) => (
              <div
                key={i}
                className={`wf-box wf-box--${b.kind}${b.goto ? " wf-box--go" : ""}`}
                title={b.label}
              >
                <span className="wf-box-kind">{KIND_LABEL[b.kind]}</span>
                <span className="wf-box-label">{b.label}</span>
                {b.goto && (
                  <span className={`wf-box-arrow${b.dangling ? " warn" : ""}`} aria-hidden="true">
                    {b.dangling ? "⚠" : "▶"}
                  </span>
                )}
              </div>
            ))}
            {s.boxes.length === 0 && <div className="wf-box wf-box--empty">(시나리오 없음)</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
