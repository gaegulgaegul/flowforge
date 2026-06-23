/**
 * PRD(제품요구문서) 타입. server(파서)와 web(문서 뷰)이 공유.
 *
 * manyfast PRD(reference_manyfast_spec): 고정 5섹션(개요/핵심가치/타겟·시나리오/성공지표/속성설정).
 * openspec 매핑: spec.md가 아니라 proposal.md + design.md의 마크다운 섹션에서 파생(읽기전용).
 * 소스 헤더가 없으면 빈 섹션(empty)으로 표면화한다 — 내용을 지어내지 않는다.
 */

/** PRD 5섹션의 고정 키(순서·개수 불변). */
export type PrdSectionKey = 'overview' | 'value' | 'target' | 'metrics' | 'attributes';

/** PRD 한 섹션. body는 소스에서 추출한 마크다운, empty면 매핑 소스가 문서에 없었음. */
export interface PrdSection {
  readonly key: PrdSectionKey;
  /** 표시 제목(한국어 고정 라벨). */
  readonly title: string;
  /** 추출된 마크다운 본문. empty면 빈 문자열. */
  readonly body: string;
  /** 매핑 소스 헤더가 하나도 없어 비어 있는가. */
  readonly empty: boolean;
}

/** server가 change(proposal+design)에서 파생해 내보내는 PRD(섹션 5개 고정). */
export interface Prd {
  readonly sections: readonly PrdSection[];
}
