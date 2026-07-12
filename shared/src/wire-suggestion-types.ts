/**
 * 와이어 레이아웃(WireScreen2) 제안 큐 + 화면별 피드백 아이템 타입 —
 * planning-wireframe-generation-feedback change(②AI 생성 + ③화면별 피드백 재생성).
 *
 * flowforge = "읽기 거울". features/prd/userflow와 같은 원칙: flowforge는 와이어 원천을 직접
 * 저작하지 않는다. 외부 AI(openspec-plan 계열 스킬)가 `WireScreen2[]` 레이아웃 제안을
 * `docs/planning/wireframe.suggestions.json`(사이드카 큐)에 화면 단위로 쌓고, flowforge UI에서
 * 개별/일괄 승인·반려 → 승인분만 와이어 원천에 반영(반려=원본 불변). 승인분이 이후
 * `buildDocsPlanningWireframe2`의 반환(고정 픽스처를 대체)이 된다.
 *
 * 피드백(WireFeedbackItem)은 flowforge 최초의 "사람→AI 역방향" write다(D2/D3 A안 파일 릴레이):
 * 사용자가 특정 화면에 자유 텍스트를 남기면 feedback 사이드카에 append 되고, 외부 스킬이 그걸 읽어
 * 그 화면만 재생성해 큐를 갱신한다. flowforge는 write만 하고 LLM을 부르지 않는다.
 *
 * server(큐 read/apply·feedback write)와 web(승인 UI·피드백 입력)이 공유. apply body/result는
 * 6a의 PrdApplyRequest/PrdApplyResult와 형태가 같아 여기서 신설하지 않고 그대로 재사용한다.
 */
import type { WireDoc } from './wire-doc-types.js';

/**
 * 와이어 갱신 제안 1건 — 한 화면(screenId)의 전체 HTML 문서 교체(flowforge-wireframe-iframe, BREAKING).
 * 이전 `WireScreen2` 요소배열 레이아웃 교체에서 화면별 HTML 문서 교체로 전환됐다.
 */
export interface WireSuggestion {
  /** 안정적 식별자(승인/반려 대상 지정). 스킬이 부여. flowforge는 id로만 큐를 조작. */
  readonly id: string;
  /** 대상 화면 id(WireDoc.id·화면목록 `<!-- screen: id -->`와 공유 — 유저플로우·IA와 정합). */
  readonly screenId: string;
  /** 승인 시 반영할 새 화면 HTML 문서(id·title·device·html). */
  readonly doc: WireDoc;
  /** 제안 근거(선택, UI 표시용). */
  readonly rationale?: string;
}

/** 와이어 제안 큐 — 사이드카 JSON 전체. features/userflow/prd 큐와 동형. */
export interface WireSuggestionQueue {
  readonly version: 1;
  readonly suggestions: readonly WireSuggestion[];
}

/**
 * 인플레이스 핀 피드백 1건 — 사람→AI 역방향 write(A안 파일 릴레이, D2 정정: Figma 코멘트식).
 * 화면별 입력칸 나열이 아니라, 와이어 위 클릭한 그 좌표(xPct·yPct)에 묶인 지점 단위 피드백.
 */
export interface WireFeedbackItem {
  /** 피드백 대상 화면 id(WireScreen2.id). */
  readonly screenId: string;
  /** 사용자가 남긴 자유 텍스트(비어 있으면 거부). */
  readonly text: string;
  /** ISO 타임스탬프(append 시각). */
  readonly ts: string;
  /** 클릭 위치 가로 %(0~100, 와이어 컨테이너 기준). 지점 단위 피드백의 핵심 — "여기"가 의미를 가짐. */
  readonly xPct: number;
  /** 클릭 위치 세로 %(0~100, 와이어 컨테이너 기준). */
  readonly yPct: number;
  /** 좌표에서 자동 인식된 영역(본문/상단메뉴/사이드/하단바 등). 표시용(선택). */
  readonly region?: string;
}
