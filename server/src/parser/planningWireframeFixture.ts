/**
 * planningWireframeFixture — 확정 목업(wireframe-mockup-deploy)을 WireScreen2 데이터로 옮긴 픽스처.
 *
 * 이 change(렌더러)의 실증 원천이다. 사람이 레이아웃을 손으로 쓰는 경로는 없다(D-2) — AI 생성물이
 * 나중에 이 자리에 들어온다(후속 change). 화면 id는 화면목록 `<!-- screen: id -->`와 공유(D-5):
 * grid(프로젝트 그리드)·skeleton(기획 뷰)·features(기능명세)는 유저플로우·IA와 같은 id, grid-m은 모바일 변형.
 *
 * 목업 대조: index.html의 데스크탑 3화면(카드 그리드/탭+PRD/트리+상세) + 모바일 1화면(세로+하단바)을
 * 영역(topbar/sidebar/bottombar/body)·배치(grid/stack/tree/form)로 구조화.
 */
import type { WireScreen2 } from "@flowforge/shared";

/** 데스크탑 상단바 공통(로고 + 브레드크럼 자리 + 아바타). goto는 화면별로 다르므로 여기선 라벨만. */
const DESKTOP_SIDEBAR_PLANNING: WireScreen2["regions"]["sidebar"] = [
  { kind: "nav-item", label: "PRD", goto: "skeleton" },
  { kind: "nav-item", label: "기능명세", goto: "features" },
  { kind: "nav-item", label: "유저플로우" },
  { kind: "nav-item", label: "IA" },
  { kind: "nav-item", label: "와이어" },
];

/** 화면 1: 프로젝트 카드 그리드(데스크탑) — 상단 메뉴 + 사이드 + 본문 그리드. */
const SCREEN_GRID: WireScreen2 = {
  id: "grid",
  title: "프로젝트 목록",
  device: "desktop",
  regions: {
    topbar: [
      { kind: "text", label: "flowforge" },
      { kind: "text", label: "워크스페이스 / 프로젝트" },
      { kind: "button", label: "+ 새 프로젝트", goto: "skeleton" },
    ],
    sidebar: [
      { kind: "nav-item", label: "프로젝트" },
      { kind: "nav-item", label: "템플릿" },
      { kind: "nav-item", label: "팀" },
      { kind: "nav-item", label: "설정" },
    ],
    body: {
      layout: "grid",
      elements: [
        { kind: "card", label: "쏙쏙 육아 앱", goto: "skeleton" },
        { kind: "card", label: "wowa 크로스핏", goto: "skeleton" },
        { kind: "card", label: "stock-brief", goto: "skeleton" },
        { kind: "card", label: "agent-reach", goto: "skeleton" },
      ],
    },
  },
};

/** 화면 2: 기획 뷰(데스크탑) — 상단 메뉴 + 사이드 + 본문(탭 바 + PRD 섹션 스택). */
const SCREEN_SKELETON: WireScreen2 = {
  id: "skeleton",
  title: "기획 뷰",
  device: "desktop",
  regions: {
    topbar: [
      { kind: "text", label: "flowforge" },
      { kind: "text", label: "프로젝트", goto: "grid" },
      { kind: "text", label: "쏙쏙 육아 앱" },
    ],
    sidebar: DESKTOP_SIDEBAR_PLANNING,
    body: {
      layout: "stack",
      elements: [
        { kind: "tab", label: "PRD" },
        { kind: "tab", label: "기능명세", goto: "features" },
        { kind: "tab", label: "유저플로우", goto: "features" },
        { kind: "tab", label: "IA", goto: "features" },
        { kind: "tab", label: "와이어", goto: "features" },
        { kind: "placeholder", label: "1. 개요", span: 2 },
        { kind: "placeholder", label: "2. 핵심가치", span: 2 },
        { kind: "placeholder", label: "3. 타겟 · 시나리오", span: 2 },
        { kind: "placeholder", label: "4. 성공지표", span: 2 },
        { kind: "placeholder", label: "5. 속성설정", span: 2 },
      ],
    },
  },
};

/** 화면 3: 기능명세(데스크탑) — 상단 메뉴 + 사이드 + 본문 트리(3단 노드). */
const SCREEN_FEATURES: WireScreen2 = {
  id: "features",
  title: "기능명세",
  device: "desktop",
  regions: {
    topbar: [
      { kind: "text", label: "flowforge" },
      { kind: "text", label: "프로젝트", goto: "grid" },
      { kind: "text", label: "쏙쏙 육아 앱", goto: "skeleton" },
      { kind: "text", label: "기능명세" },
    ],
    sidebar: [
      { kind: "nav-item", label: "PRD", goto: "skeleton" },
      { kind: "nav-item", label: "기능명세" },
      { kind: "nav-item", label: "유저플로우" },
      { kind: "nav-item", label: "IA" },
      { kind: "nav-item", label: "와이어" },
    ],
    body: {
      layout: "tree",
      elements: [
        { kind: "tree-node", label: "회원관리" },
        { kind: "tree-node", label: "기록관리" },
        { kind: "tree-node", label: "회원가입" },
        { kind: "tree-node", label: "로그인" },
        { kind: "tree-node", label: "사진 기록" },
        { kind: "tree-node", label: "타임라인" },
        { kind: "tree-node", label: "이메일 가입" },
        { kind: "tree-node", label: "비밀번호 재설정" },
        { kind: "tree-node", label: "EXIF 날짜 보정" },
        { kind: "button", label: "← 기획 뷰로", goto: "skeleton", span: 2 },
      ],
    },
  },
};

/** 화면 4: 프로젝트 목록(모바일) — 상단 타이틀 + 본문 카드 + 하단 메뉴바. */
const SCREEN_GRID_MOBILE: WireScreen2 = {
  id: "grid-m",
  title: "프로젝트 목록",
  device: "mobile",
  regions: {
    topbar: [{ kind: "text", label: "프로젝트" }],
    body: {
      layout: "stack",
      elements: [
        // 모바일 요소는 모바일 대상 화면으로 이동해야 프레임이 데스크탑으로 튀지 않는다(review M-1).
        { kind: "input", label: "🔍 프로젝트 검색", goto: "skeleton-m" },
        { kind: "card", label: "쏙쏙 육아 앱", goto: "skeleton-m" },
        { kind: "card", label: "wowa 크로스핏", goto: "skeleton-m" },
        { kind: "card", label: "stock-brief", goto: "skeleton-m" },
      ],
    },
    bottombar: [
      { kind: "nav-item", label: "프로젝트" },
      { kind: "nav-item", label: "템플릿" },
      { kind: "nav-item", label: "팀" },
      { kind: "nav-item", label: "설정" },
    ],
  },
};

/** 화면 5: 기획 뷰(모바일) — 상단 타이틀 + 탭 스택 + PRD 본문 + 하단 메뉴바. grid-m의 이동 대상(M-1 해소). */
const SCREEN_SKELETON_MOBILE: WireScreen2 = {
  id: "skeleton-m",
  title: "기획 뷰",
  device: "mobile",
  regions: {
    topbar: [{ kind: "text", label: "쏙쏙 육아 앱 — 기획" }],
    body: {
      layout: "stack",
      elements: [
        { kind: "tab", label: "PRD" },
        { kind: "tab", label: "기능명세" },
        { kind: "tab", label: "유저플로우" },
        { kind: "text", label: "1. 개요" },
        { kind: "placeholder", label: "" },
        { kind: "text", label: "2. 핵심가치" },
        { kind: "placeholder", label: "" },
        { kind: "card", label: "← 프로젝트 목록", goto: "grid-m" },
      ],
    },
    bottombar: [
      { kind: "nav-item", label: "프로젝트" },
      { kind: "nav-item", label: "템플릿" },
      { kind: "nav-item", label: "팀" },
      { kind: "nav-item", label: "설정" },
    ],
  },
};

/** 픽스처 화면 5개(데스크탑 3 + 모바일 2) — 목업 대조 순서 유지. */
export const PLANNING_WIREFRAME_FIXTURE: readonly WireScreen2[] = [
  SCREEN_GRID,
  SCREEN_SKELETON,
  SCREEN_FEATURES,
  SCREEN_GRID_MOBILE,
  SCREEN_SKELETON_MOBILE,
];

/**
 * planning 와이어 레이아웃(WireScreen2[]) 제공.
 *
 * 이 change에선 픽스처를 그대로 반환한다(원천 = 픽스처, D-6). docsDir는 라우트 정합(존재하는
 * 프로젝트만 응답)을 위해 받되, 레이아웃 데이터 자체는 프로젝트 무관 고정 픽스처다. AI 생성물이
 * 나중에 이 함수를 대체한다(후속 change).
 */
export function buildDocsPlanningWireframe2(docsDir: string): readonly WireScreen2[] {
  void docsDir;
  return PLANNING_WIREFRAME_FIXTURE;
}
