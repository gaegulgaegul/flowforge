/**
 * ProjectGrid — 홈 랜딩 카드 그리드 (project-card-grid capability).
 *
 * change 있는 모든 프로젝트를 카드로 렌더(charter 유무 무관). 카드별로
 * [한글 표시명 · charter 유무 🦴 · change 개수 · audit 배지]를 보인다.
 * 카드 클릭 시 charter 있으면 뼈대 그래프로, 없으면 change 목록으로 분기(1-a).
 * 표시는 displayName(한글), 라우팅은 name(영문 슬러그).
 */
import type { ProjectCard, AuditStatus } from "@flowforge/shared";

const AUDIT_LABEL: Record<AuditStatus, string> = {
  unknown: "audit 미확인",
  clean: "정상",
  warn: "경고",
  fail: "실패",
};

interface Props {
  projects: ProjectCard[];
  /** 카드 클릭 — hasCharter면 셸이 뼈대 그래프로, 아니면 change 목록으로 분기. */
  onOpenProject: (card: ProjectCard) => void;
}

export function ProjectGrid({ projects, onOpenProject }: Props): JSX.Element {
  if (projects.length === 0) {
    return <p className="pg-empty">표시할 프로젝트가 없습니다 (change 있는 프로젝트 0개).</p>;
  }
  return (
    <div className="pg-grid">
      {projects.map((p) => (
        <button
          key={p.name}
          type="button"
          className="pg-card"
          onClick={() => onOpenProject(p)}
          title={`${p.name} 열기`}
        >
          <span className="pg-card-name">{p.displayName}</span>
          <span className="pg-card-badges">
            <span className={`pg-badge ${p.hasCharter ? "pg-badge--charter" : "pg-badge--nocharter"}`}>
              {p.hasCharter ? "📋 기획 있음" : "기획 없음"}
            </span>
            <span className="pg-badge">change {p.changeCount}개</span>
            <span className={`pg-badge pg-audit--${p.auditStatus}`}>{AUDIT_LABEL[p.auditStatus]}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
