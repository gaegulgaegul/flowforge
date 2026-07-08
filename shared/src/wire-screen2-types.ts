/**
 * WireScreen2 — 디바이스 프레임 안에 화면 레이아웃을 배치 렌더하는 와이어 데이터 모델.
 *
 * 폐기된 element 세로박스(WireBox 스택)와 달리 manyfast식 로우피델리티 목업을 그대로 타입화한다:
 * 디바이스(데스크탑/모바일) 프레임 안에 영역(상단/사이드/하단/본문)별로 요소를 실제 화면처럼 배치.
 * 단일진실원 = 확정 목업(wireframe-mockup-deploy). 이 change의 렌더 원천은 픽스처 JSON이고,
 * AI 생성물이 나중에 이 자리에 들어온다(후속 change). 기존 Wireframe/WireBox는 change 경로용으로 유지(비파괴).
 */

/** 디바이스 종류 — 프레임 형태(브라우저 크롬 vs 폰 프레임)를 결정한다. */
export type WireDevice = 'desktop' | 'mobile';

/** 본문 배치 힌트 — 요소를 어떤 레이아웃으로 그릴지(그리드/스택/트리/폼). */
export type WireBodyLayout = 'grid' | 'stack' | 'tree' | 'form';

/**
 * 요소 종류 — 목업이 쓰는 로우피델리티 프리미티브. 렌더러가 kind별로 회색조 박스를 그린다.
 * 미지원 값은 렌더러가 placeholder로 폴백(렌더 안전).
 */
export type WireElementKind =
  | 'nav-item' // 사이드/하단 메뉴 항목
  | 'tab' // 탭 바 항목
  | 'card' // 카드(프로젝트 카드 등)
  | 'input' // 입력칸/검색창
  | 'button' // 버튼
  | 'text' // 텍스트 라인(제목·본문 플레이스홀더)
  | 'tree-node' // 트리 노드
  | 'placeholder'; // 기타 자리표시 박스

/** 화면 요소 한 개 — 영역 안에 배치되는 로우피델리티 프리미티브. */
export interface WireElement {
  readonly kind: WireElementKind;
  /** 표시 라벨(한글 가능). 빈 문자열이면 라벨 없는 순수 플레이스홀더. */
  readonly label: string;
  /** 클릭 시 이동할 대상 화면 id(WireScreen2.id). 없으면 비클릭 요소. */
  readonly goto?: string;
  /** 그리드/폼 배치에서 차지하는 열 수(기본 1). 넓은 카드·전폭 버튼 등에 사용. */
  readonly span?: number;
}

/** 본문 영역 — 배치 힌트 + 요소들. */
export interface WireBody {
  readonly layout: WireBodyLayout;
  readonly elements: readonly WireElement[];
}

/**
 * 화면의 영역 구성. body는 필수, 나머지는 선택.
 * desktop: topbar(상단 메뉴) + sidebar(사이드 메뉴) + body(본문).
 * mobile: topbar(타이틀바) + body(본문) + bottombar(하단 메뉴바).
 */
export interface WireRegions {
  readonly topbar?: readonly WireElement[];
  readonly sidebar?: readonly WireElement[];
  readonly bottombar?: readonly WireElement[];
  readonly body: WireBody;
}

/** 화면 1개 = 디바이스 프레임 + 영역별 배치. */
export interface WireScreen2 {
  /** 안정 식별자(화면목록 <!-- screen: id -->와 공유 — 유저플로우·IA와 정합). */
  readonly id: string;
  /** 표시 이름(화면 헤더 텍스트, 한글 가능). */
  readonly title: string;
  readonly device: WireDevice;
  readonly regions: WireRegions;
}
