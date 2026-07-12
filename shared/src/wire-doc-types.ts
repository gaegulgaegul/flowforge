/**
 * WireDoc — 화면별 HTML 문서 와이어 데이터 모델(flowforge-wireframe-iframe, Phase 5, BREAKING).
 *
 * 좌표 없는 요소 박스(폐기된 `WireScreen2` regions/elements)를 대체한다. 각 화면은 **자족적인 실 HTML/JS
 * 문서**(html 문자열)이며, flowforge는 이를 sandbox iframe 안에서만 렌더한다(부모 오리진 격리). 진짜
 * HTML이라 실화면에 근접(피드백4)하고 입력/버튼/폼이 실제로 동작한다(피드백5).
 *
 * 생성 주체는 flowforge 밖(openspec-plan 계열 스킬)이다 — flowforge 서버는 LLM을 호출하지 않고 산출
 * HTML만 소비·격리·렌더한다(읽기 거울 원칙). id는 화면목록 `<!-- screen: id -->`·유저플로우·IA와 정합.
 *
 * ⚠️ html은 신뢰되지 않은 AI 생성물이다 — 반드시 sandbox iframe(allow-same-origin 미부여) + 문서 CSP
 * 안에서만 렌더한다. 상위 문서 innerHTML/dangerouslySetInnerHTML 삽입은 금지(격리 불변식).
 */

/** 디바이스 종류 — 프레임 형태(브라우저 크롬 vs 폰 프레임)를 결정한다. */
export type WireDocDevice = 'desktop' | 'mobile';

/** 화면 1개 = 자족 HTML 문서 + 디바이스. */
export interface WireDoc {
  /** 안정 식별자(화면목록 <!-- screen: id -->와 공유 — 유저플로우·IA와 정합). */
  readonly id: string;
  /** 표시 이름(화면 헤더/탭 텍스트, 한글 가능). */
  readonly title: string;
  /** 프레임 형태 결정(desktop=브라우저 크롬 / mobile=폰 프레임). */
  readonly device: WireDocDevice;
  /**
   * 화면의 실 HTML 문서(자족적 — 자산은 인라인/data URI, 외부 호스트 참조 금지: CSP가 외부 로드 차단).
   * 신뢰되지 않은 AI 생성물 → sandbox iframe + 문서 CSP 안에서만 렌더한다.
   */
  readonly html: string;
}
