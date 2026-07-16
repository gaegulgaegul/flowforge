/**
 * planningWireframeFixture — 승인분 원천이 아직 없을 때의 폴백 와이어(flowforge-wireframe-iframe, BREAKING).
 *
 * Phase 5에서 좌표 없는 요소 박스(폐기된 `WireScreen2`)를 **화면별 자족 HTML 문서(`WireDoc`)**로 교체했다.
 * 각 문서는 인라인 스타일·스크립트만 쓰는 자족 HTML이며(외부 호스트 참조 없음 — CSP가 차단), flowforge는
 * 이를 sandbox iframe(allow-same-origin 미부여) 안에서만 렌더한다. 진짜 HTML이라 입력/버튼이 실제로 동작한다.
 *
 * 사람이 와이어를 손으로 쓰는 경로는 없다 — AI 생성물(openspec-plan 계열 스킬)이 나중에 이 자리에 들어온다.
 * 화면 id는 화면목록 `<!-- screen: id -->`와 공유: grid·skeleton·features(데스크탑) + grid-m·skeleton-m(모바일).
 */
import type { WireDoc } from "@flowforge/shared";
import { WIRE_NAV_SCRIPT } from "@flowforge/shared";

/** 자족 HTML 문서 공통 스타일(인라인 — 외부 참조 없음, CSP `style-src 'unsafe-inline'` 안에서 동작). */
const BASE_STYLE = `
  * { box-sizing: border-box; }
  /* 프레임이 전체 화면(뷰포트 비례)이라 문서도 높이를 다 쓴다 — 안 그러면 사이드바가 중간에 끊기고
     아래가 빈 공백으로 남아 "실제 화면과 다르다"는 괴리가 그대로 남는다. */
  html, body { margin: 0; padding: 0; height: 100%; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2328; background: #fff; display: flex; flex-direction: column; }
  .bar { background: #f6f8fa; border-bottom: 1px solid #d0d7de; padding: 10px 14px; display: flex; gap: 10px; align-items: center; font-size: 13px; }
  .brand { font-weight: 700; }
  .layout { display: flex; flex: 1; min-height: 0; }
  .side { width: 160px; border-right: 1px solid #d0d7de; padding: 12px; background: #fafbfc; }
  .side a { display: block; padding: 6px 8px; border-radius: 6px; color: #1f2328; text-decoration: none; font-size: 13px; }
  .side a:hover { background: #eaeef2; }
  .main { flex: 1; padding: 16px; overflow: auto; min-height: 0; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .card { border: 1px solid #d0d7de; border-radius: 8px; padding: 16px; background: #fff; cursor: pointer; }
  .card:hover { box-shadow: 0 0 0 2px #0969da33; }
  .tabs { display: flex; gap: 8px; border-bottom: 1px solid #d0d7de; margin-bottom: 12px; }
  .tab { padding: 6px 10px; border: 0; background: none; cursor: pointer; font-size: 13px; }
  .tab.on { border-bottom: 2px solid #0969da; color: #0969da; }
  .field { border: 1px solid #d0d7de; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; font-size: 13px; }
  input, textarea { width: 100%; border: 1px solid #d0d7de; border-radius: 6px; padding: 8px; font-size: 13px; font-family: inherit; }
  button.act { background: #1f2328; color: #fff; border: 0; border-radius: 6px; padding: 8px 14px; cursor: pointer; font-size: 13px; }
  .tree { font-size: 13px; }
  .tree li { margin: 2px 0; }
  .bottombar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; border-top: 1px solid #d0d7de; background: #fafbfc; }
  .bottombar a { flex: 1; text-align: center; padding: 10px; font-size: 12px; text-decoration: none; color: #1f2328; }
  .out { margin-top: 8px; font-size: 12px; color: #57606a; }
  /* 화면 전환 가능한 요소(data-nav) — 실제 앱처럼 눌리는 자리임을 시각적으로 알린다. */
  [data-nav] { cursor: pointer; }
  .side a.on { background: #eaeef2; font-weight: 600; }
  .crumb { color: #0969da; }
  .crumb:hover { text-decoration: underline; }
  .bottombar a.on { color: #0969da; font-weight: 600; }
`;

/**
 * 자족 HTML 문서를 감싸는 최소 셸(doctype·meta·인라인 스타일). CSP는 서빙 라우트의 응답 헤더로 강제된다.
 *
 * 모든 화면에 `WIRE_NAV_SCRIPT`를 붙여 `data-nav="<screenId>"` 요소 클릭이 부모에 전달되게 한다 —
 * 화면 전환 수단이 바깥 툴바가 아니라 와이어 안의 요소이기 때문(실제 앱처럼 순환). 이벤트 위임이라
 * 화면마다 스크립트를 반복 작성할 필요가 없다.
 */
function doc(bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>${bodyHtml}${WIRE_NAV_SCRIPT}</body></html>`;
}

/** 화면 1: 프로젝트 카드 그리드(데스크탑). 카드 클릭 → 기획 뷰(실제 앱의 드릴다운과 동형). */
const SCREEN_GRID: WireDoc = {
  id: "grid",
  title: "프로젝트 목록",
  device: "desktop",
  html: doc(`
    <div class="bar"><span class="brand" data-nav="grid">flowforge</span><span>워크스페이스 / 프로젝트</span><button class="act" style="margin-left:auto">+ 새 프로젝트</button></div>
    <div class="layout">
      <nav class="side"><a data-nav="grid" class="on">프로젝트</a><a>템플릿</a><a>팀</a><a>설정</a></nav>
      <main class="main"><div class="grid">
        <div class="card" data-nav="skeleton">쏙쏙 육아 앱</div>
        <div class="card" data-nav="skeleton">wowa 크로스핏</div>
        <div class="card" data-nav="skeleton">stock-brief</div>
        <div class="card" data-nav="skeleton">agent-reach</div>
      </div></main>
    </div>`),
};

/** 화면 2: 기획 뷰(데스크탑) — 탭 + PRD 섹션. 탭 클릭 시 실제로 활성 표시가 바뀐다(동작 검증용). */
const SCREEN_SKELETON: WireDoc = {
  id: "skeleton",
  title: "기획 뷰",
  device: "desktop",
  html: doc(`
    <div class="bar"><span class="brand" data-nav="grid">flowforge</span><span data-nav="grid" class="crumb">프로젝트</span><span>쏙쏙 육아 앱</span></div>
    <div class="layout">
      <nav class="side"><a class="on">PRD</a><a data-nav="features">기능명세</a><a>유저플로우</a><a>와이어</a></nav>
      <main class="main">
        <div class="tabs"><button class="tab on" data-tab>PRD</button><button class="tab" data-tab>기능명세</button><button class="tab" data-tab>유저플로우</button></div>
        <div class="field">1. 개요</div><div class="field">2. 핵심가치</div><div class="field">3. 타겟 · 시나리오</div>
        <div class="field">4. 성공지표</div><div class="field">5. 속성설정</div>
      </main>
    </div>
    <script>
      document.querySelectorAll('[data-tab]').forEach(function(t){
        t.addEventListener('click', function(){
          document.querySelectorAll('[data-tab]').forEach(function(x){ x.classList.remove('on'); });
          t.classList.add('on');
        });
      });
    </script>`),
};

/** 화면 3: 기능명세(데스크탑) — 트리 + 검색 입력(타이핑이 실제 반영되는지 검증용). */
const SCREEN_FEATURES: WireDoc = {
  id: "features",
  title: "기능명세",
  device: "desktop",
  html: doc(`
    <div class="bar"><span class="brand" data-nav="grid">flowforge</span><span data-nav="skeleton" class="crumb">쏙쏙 육아 앱</span><span>기능명세</span></div>
    <div class="layout">
      <nav class="side"><a data-nav="skeleton">PRD</a><a class="on">기능명세</a><a>유저플로우</a><a>와이어</a></nav>
      <main class="main">
        <input id="q" placeholder="🔍 기능 검색" />
        <ul class="tree">
          <li>회원관리<ul><li>회원가입</li><li>로그인</li></ul></li>
          <li>기록관리<ul><li>사진 기록</li><li>타임라인</li></ul></li>
        </ul>
        <div class="out" id="out">입력 없음</div>
      </main>
    </div>
    <script>
      var q = document.getElementById('q'); var out = document.getElementById('out');
      q.addEventListener('input', function(){ out.textContent = q.value ? ('검색: ' + q.value) : '입력 없음'; });
    </script>`),
};

/** 화면 4: 프로젝트 목록(모바일) — 세로 카드 + 하단 메뉴바. */
const SCREEN_GRID_MOBILE: WireDoc = {
  id: "grid-m",
  title: "프로젝트 목록",
  device: "mobile",
  html: doc(`
    <div class="bar"><span class="brand">프로젝트</span></div>
    <main class="main" style="padding-bottom:56px">
      <input placeholder="🔍 프로젝트 검색" style="margin-bottom:12px" />
      <div class="card" data-nav="skeleton-m" style="margin-bottom:10px">쏙쏙 육아 앱</div>
      <div class="card" data-nav="skeleton-m" style="margin-bottom:10px">wowa 크로스핏</div>
      <div class="card" data-nav="skeleton-m" style="margin-bottom:10px">stock-brief</div>
    </main>
    <nav class="bottombar"><a data-nav="grid-m" class="on">프로젝트</a><a>템플릿</a><a>팀</a><a>설정</a></nav>`),
};

/** 화면 5: 기획 뷰(모바일) — 탭 + PRD + 하단 메뉴바. */
const SCREEN_SKELETON_MOBILE: WireDoc = {
  id: "skeleton-m",
  title: "기획 뷰",
  device: "mobile",
  html: doc(`
    <div class="bar"><span class="brand">쏙쏙 육아 앱 — 기획</span></div>
    <main class="main" style="padding-bottom:56px">
      <div class="tabs"><button class="tab on" data-tab>PRD</button><button class="tab" data-tab>기능명세</button><button class="tab" data-tab>유저플로우</button></div>
      <div class="field">1. 개요</div><div class="field">2. 핵심가치</div>
      <button class="act" data-nav="grid-m">← 프로젝트 목록</button>
    </main>
    <nav class="bottombar"><a data-nav="grid-m">프로젝트</a><a>템플릿</a><a>팀</a><a>설정</a></nav>
    <script>
      document.querySelectorAll('[data-tab]').forEach(function(t){
        t.addEventListener('click', function(){
          document.querySelectorAll('[data-tab]').forEach(function(x){ x.classList.remove('on'); });
          t.classList.add('on');
        });
      });
    </script>`),
};

/**
 * 폴백 화면 5개(데스크탑 3 + 모바일 2) — 화면 id 순서 유지.
 * 승인분 원천(`<WIREFRAME_FEEDBACK_ROOT>/<project>.wireframe.json`)이 없을 때의 폴백이다.
 */
export const PLANNING_WIREFRAME_FIXTURE: readonly WireDoc[] = [
  SCREEN_GRID,
  SCREEN_SKELETON,
  SCREEN_FEATURES,
  SCREEN_GRID_MOBILE,
  SCREEN_SKELETON_MOBILE,
];
