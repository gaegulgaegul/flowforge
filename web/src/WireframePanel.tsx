/** 와이어프레임 패널 — 화면별 모바일 프레임에 스켈레톤 박스 스택(읽기전용 미리보기). */
import type { Wireframe, WireBoxKind } from "@flowforge/shared";

const KIND_LABEL: Record<WireBoxKind, string> = {
  header: "제목",
  list: "목록",
  button: "버튼",
  field: "입력/표시",
  empty: "빈 상태",
};

/** SEED(미검증) 배지 — 화면/박스에 공통으로 붙인다. */
function SeedBadge(): JSX.Element {
  return (
    <span className="wf-seed" data-testid="seed-badge" title="미검증(SEED) — 사람 검토 전">
      🟡 SEED
    </span>
  );
}

export function WireframePanel({
  wireframe,
  originalHtmlHref,
}: {
  wireframe: Wireframe;
  originalHtmlHref?: string;
}): JSX.Element {
  if (wireframe.screens.length === 0) {
    return <div className="wf-empty-note">이 변경에는 화면(screen) spec이 없어 와이어프레임이 없습니다.</div>;
  }
  return (
    <div className="wf-board">
      {wireframe.originalHtml &&
        (originalHtmlHref ? (
          <a
            className="wf-original-link"
            href={originalHtmlHref}
            target="_blank"
            rel="noreferrer"
            data-testid="original-html-link"
          >
            charter 원본 wireframe.html 보기
          </a>
        ) : (
          // 서버가 원본 파일을 아직 서빙하지 않으므로 죽은 링크 대신 안내 텍스트로 노출(정직).
          <div className="wf-original-note" data-testid="original-html-note">
            charter 원본 wireframe.html 존재 (docs/wireframe.html)
          </div>
        ))}
      {wireframe.screens.map((s) => (
        <div key={s.id} className="wf-frame" data-testid={`wf-frame-${s.id}`}>
          <div className="wf-frame-title">
            {s.title}
            {s.seed && <SeedBadge />}
          </div>
          <div className="wf-frame-body">
            {s.boxes.map((b, i) => (
              <div
                key={i}
                className={`wf-box wf-box--${b.kind}${b.goto ? " wf-box--go" : ""}`}
                title={b.label}
              >
                <span className="wf-box-kind">{KIND_LABEL[b.kind]}</span>
                <span className="wf-box-label">{b.label}</span>
                {b.seed && <SeedBadge />}
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
