/** 기획 문서가 없는 프로젝트의 skeleton 단계에서 활성 change 목록을 노출하는 경량 컴포넌트
 * (uncharted-project-change-list). change 항목 클릭 시 부모가 openChangeViews를 호출하도록
 * onOpenChange(name)만 알려준다 — 조인/서버 왕복 없음(FlowDetailPanel과 동일 원칙).
 * hasCharter 게이팅을 컴포넌트 내부로 가져와 회귀 가드를 이 파일 하나로 테스트 가능하게 한다
 * (기획 있는 프로젝트는 기존 기능명세 노드 경유 진입이 유일해야 하므로 여기선 렌더 안 함). */
export interface UnchartedChangeListProps {
  readonly hasCharter: boolean;
  readonly changeNames: readonly string[];
  readonly onOpenChange: (name: string) => void;
}

export function UnchartedChangeList({
  hasCharter,
  changeNames,
  onOpenChange,
}: UnchartedChangeListProps): JSX.Element | null {
  if (hasCharter) {
    return null;
  }

  if (changeNames.length === 0) {
    return (
      <p className="dash-uncharted-empty" data-testid="uncharted-change-list-empty">
        활성 change 없음
      </p>
    );
  }

  return (
    <section className="dash-uncharted-changes" data-testid="uncharted-change-list">
      <h3 className="dash-h">이 프로젝트의 change</h3>
      <ul className="dash-uncharted-change-items">
        {changeNames.map((name) => (
          <li key={name}>
            <button
              type="button"
              className="dash-uncharted-change-item"
              data-testid={`uncharted-change-item-${name}`}
              onClick={() => onOpenChange(name)}
            >
              {name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
