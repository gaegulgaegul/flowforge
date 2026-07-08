/**
 * ProjectGrid — 홈 랜딩 카드 그리드 (project-card-grid capability).
 *
 * change 있는 모든 프로젝트를 카드로 렌더(기획 문서 유무 무관). 카드별로
 * [한글 표시명 · 기획 유무 · 진행중/완료 change · audit · 진행중 change명 · 최근활동]을 보인다.
 * 카드 클릭 시 기획 있으면 기획 그래프로, 없으면 change 목록으로 분기(1-a).
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
  /** 카드 클릭 — 기획 있으면 셸이 기획 그래프로, 아니면 change 목록으로 분기. */
  onOpenProject: (card: ProjectCard) => void;
}

export function ProjectGrid({ projects, onOpenProject }: Props): JSX.Element {
  if (projects.length === 0) {
    return <p className="pg-empty">표시할 프로젝트가 없습니다 (change 있는 프로젝트 0개).</p>;
  }
  return (
    <div className="pg-grid">
      {projects.map((p) => {
        const archived = p.archivedChangeCount ?? 0;
        const activeNames = p.activeChangeNames ?? [];
        return (
          <button
            key={p.name}
            type="button"
            className="pg-card"
            onClick={() => onOpenProject(p)}
            title={`${p.name} 열기`}
          >
            <span className="pg-card-head">
              <span className="pg-card-name">{p.displayName}</span>
              {p.lastActivityAt && <span className="pg-card-activity">최근 {p.lastActivityAt}</span>}
            </span>
            <span className="pg-card-badges">
              <span className={`pg-badge ${p.hasCharter ? "pg-badge--charter" : "pg-badge--nocharter"}`}>
                {p.hasCharter ? "📋 기획 있음" : "기획 없음"}
              </span>
              <span className="pg-badge">
                진행중 {p.changeCount}
                {archived > 0 ? ` · 완료 ${archived}` : ""}
              </span>
              <span className={`pg-badge pg-audit--${p.auditStatus}`}>{AUDIT_LABEL[p.auditStatus]}</span>
            </span>
            {activeNames.length > 0 && (
              <span className="pg-card-changes">
                {activeNames.map((n) => (
                  <span key={n} className="pg-card-change">
                    {n}
                  </span>
                ))}
                {p.changeCount > activeNames.length && (
                  <span className="pg-card-change pg-card-change--more">+{p.changeCount - activeNames.length}</span>
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
