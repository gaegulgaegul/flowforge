/**
 * 와이어프레임(로우피델리티) 타입. server(파서)와 web(패널 렌더) 공유.
 *
 * manyfast 와이어(reference_manyfast_spec): 유저플로우 페이지를 실제 UI요소(버튼·텍스트·입력)로
 * 시각화한 로우피델리티 클릭 프로토타입. 채팅 직접수정 불가, 재생성only(읽기전용).
 * openspec 매핑: screen spec의 각 시나리오 → 스켈레톤 박스(generate_prototype.py wireframe_html 포팅).
 */

/** 박스 종류 = 시나리오 THEN 텍스트로 판정(_box_kind 포팅). */
export type WireBoxKind = 'header' | 'list' | 'button' | 'field' | 'empty';

/** 와이어프레임 한 칸(시나리오 1개). */
export interface WireBox {
  readonly kind: WireBoxKind;
  /** 박스 라벨 = 시나리오 제목. */
  readonly label: string;
  /** 이 박스가 화면 이동 트리거면 대상 화면 id. dangling이면 '__dangling__', 아니면 null. */
  readonly goto: string | null;
  readonly dangling: boolean;
}

/** 화면 1개의 와이어프레임(모바일 프레임). */
export interface WireScreen {
  /** 화면 노드 id(유저플로우 노드와 동일 키). */
  readonly id: string;
  readonly title: string;
  readonly boxes: readonly WireBox[];
}

/** change 전체의 와이어프레임(화면 여러 개). */
export interface Wireframe {
  readonly screens: readonly WireScreen[];
}
