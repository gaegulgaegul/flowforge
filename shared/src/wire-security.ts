/**
 * wire-security — 와이어 iframe 격리·CSP 보안 상수 단일 원천(flowforge-wireframe-iframe, D8).
 *
 * 이 change의 절반은 보안이다: 렌더 대상이 검증되지 않은 AI 생성 HTML/JS이기 때문. sandbox 속성값과
 * CSP 문자열(문서용·앱용)을 **단일 상수 모듈**로 못박아 렌더러(web)·서버 헤더·테스트가 같은 값을 공유하게
 * 한다. drift = 보안 구멍이므로 값은 여기서만 정의한다.
 *
 * ⚠️ 핵심 불변식: `WIRE_IFRAME_SANDBOX`에 `allow-scripts`는 있고 `allow-same-origin`은 **없다**.
 *   둘을 함께 주면 sandbox가 무력화되어 문서가 부모 오리진(쿠키·localStorage·DOM)에 접근한다 → 절대 금지.
 *   allow-top-navigation·allow-popups·allow-modals·allow-downloads도 미부여(앱 탈취·이탈 방지).
 */

/**
 * 와이어 렌더 iframe의 sandbox 속성값.
 *
 * - `allow-scripts` 부여: 문서 동작(입력/버튼/폼) 활성(피드백5).
 * - `allow-same-origin` **미부여**: 부모 오리진 격리 유지(sandbox 무력화 방지 — 이 change 최상위 보안).
 * - top-navigation/popups/modals/downloads 미부여: 앱 탈취·외부 이탈 차단.
 *
 * ⚠️ 이 값에 `allow-same-origin`을 절대 추가하지 마라. allow-scripts와 동시 부여 시 문서가 부모
 *    오리진으로 승격되어 토큰·저장소·DOM에 접근할 수 있다(sandbox 우회의 대표 벡터).
 *
 * 참고(CSP meta→헤더 전환): iframe은 이제 `srcdoc`가 아니라 `src`(서버 라우트)로 문서를 로드한다.
 * `src` + `allow-scripts`(allow-same-origin 없음)이면 로드된 문서는 **opaque origin**이라 부모와
 * cross-origin이다 → 부모 격리 불변식은 그대로 유지된다(라이브 실측: contentDocument 접근 시 TypeError).
 */
export const WIRE_IFRAME_SANDBOX = 'allow-scripts' as const;

/**
 * 문서 CSP — iframe 안 와이어 HTML 문서에 강제되는 정책. 외부 리소스 로드·네트워크 유출 표면 제거.
 *
 * `default-src 'none'` 기반: 외부 script/style/img/font/connect(fetch·XHR·WebSocket)를 전부 차단한다.
 * 자족 인라인 자산만 허용(`'unsafe-inline'`은 문서가 인라인 스크립트/스타일로 자족하므로 최소 허용).
 * 외부 CDN·트래킹 픽셀·외부 fetch는 전부 차단되어 외부 네트워크로 데이터가 나가지 않는다.
 *
 * ⚠️ 전달 방식(중요): 이 정책은 문서 HTML을 서빙하는 **서버 라우트의 HTTP 응답 헤더**
 *    (`Content-Security-Policy`)로 강제한다 — 과거처럼 문서 안에 `<meta>`로 주입하지 않는다.
 *    meta 주입은 삽입 지점을 정규식으로 찾아야 했는데 적대적 HTML(주석 속 가짜 head·inert template·
 *    미종료 template·속성값 `</template>`)이 마스킹을 계속 뚫어 CSP를 무력화할 수 있었다(verify FAIL 실증).
 *    HTTP 헤더 CSP는 브라우저가 **문서 내용과 무관하게** 강제하므로 문서로는 절대 우회할 수 없다(근본 해결).
 */
export const WIRE_DOC_CSP =
  "default-src 'none'; " +
  "script-src 'unsafe-inline'; " +
  "style-src 'unsafe-inline'; " +
  "img-src data:; " +
  "font-src data:; " +
  "connect-src 'none'; " +
  "form-action 'none'; " +
  "base-uri 'none'";

/**
 * 화면 전환 브리지(wire-nav) — 와이어 문서 안의 클릭을 부모 렌더러에 전달하는 postMessage 계약.
 *
 * 배경: 화면 선택 툴바를 제거하고 "와이어 안의 카드·메뉴 클릭 → 화면 전환"(실제 앱처럼)으로 바꾸면서
 * 필요해졌다. 문서는 opaque origin이라 부모가 내부 DOM을 볼 수 없으므로(그리고 그 격리는 유지해야 하므로),
 * 클릭 사실은 문서가 **스스로 알려주는** 수밖에 없다 → postMessage 단방향(문서 → 부모) 통지.
 *
 * ⚠️ 보안상 이 브리지는 sandbox·CSP를 **하나도 약화시키지 않는다**:
 *   - postMessage는 어떤 CSP 디렉티브의 대상도 아니다(`connect-src 'none'`은 fetch/XHR/WS만 제약).
 *   - opaque origin 문서도 `parent.postMessage(msg, '*')` 송신은 가능하다 → `allow-same-origin` 불필요.
 *   - 방향이 문서 → 부모 단방향이라 부모의 DOM·토큰이 문서에 노출되지 않는다.
 *
 * ⚠️ 수신 측 검증 의무(부모): opaque origin이라 `event.origin`은 문자열 `"null"`로 도착해 **신뢰할 수
 *   없다**. 따라서 오리진 대신 **`event.source === iframe.contentWindow`(발신 창 동일성)**로 발신자를
 *   검증하고, 받은 screenId는 실재 화면 화이트리스트와 대조해야 한다. 메시지 본문은 신뢰 불가 입력이다.
 */
export const WIRE_NAV_MESSAGE_TYPE = 'wf-nav' as const;

/** 와이어 문서 → 부모 렌더러 화면 전환 요청 메시지. `screenId`는 신뢰 불가(부모가 화이트리스트 검증). */
export interface WireNavMessage {
  readonly type: typeof WIRE_NAV_MESSAGE_TYPE;
  readonly screenId: string;
}

/** unknown 메시지 → WireNavMessage 좁힘. 형태만 검사한다(screenId 실재 여부는 부모가 별도 검증). */
export function isWireNavMessage(data: unknown): data is WireNavMessage {
  if (typeof data !== 'object' || data === null) return false;
  const m = data as { type?: unknown; screenId?: unknown };
  return m.type === WIRE_NAV_MESSAGE_TYPE && typeof m.screenId === 'string' && m.screenId.length > 0;
}

/**
 * 와이어 문서에 심는 화면 전환 송신 스크립트(자족 인라인 — CSP `script-src 'unsafe-inline'` 안에서 동작).
 *
 * `data-nav="<screenId>"`가 달린 요소를 클릭하면 그 id를 부모에 통지한다. 이벤트 위임이라 문서가 나중에
 * DOM을 바꿔도 동작하고, `closest`로 카드 내부 자식을 눌러도 잡힌다. targetOrigin이 `'*'`인 이유는
 * opaque origin(sandbox, allow-same-origin 없음)에선 부모 오리진을 특정해 보낼 수 없기 때문이며,
 * 본문에 비밀이 없고(화면 id뿐) 부모가 발신 창을 검증하므로 안전하다.
 */
export const WIRE_NAV_SCRIPT = `
<script>
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-nav]') : null;
    if (!el) return;
    e.preventDefault();
    parent.postMessage({ type: '${WIRE_NAV_MESSAGE_TYPE}', screenId: el.getAttribute('data-nav') }, '*');
  });
</script>`;

/**
 * 앱 CSP(flowforge 자체 응답 헤더) — clickjacking 방어(현재 서버에 CSP 전무 → 이 change에서 신설).
 *
 * `frame-ancestors 'self'`: flowforge가 신뢰되지 않은 상위 프레임에 임베드(clickjacking 대상)되지 않게.
 * `frame-src 'self'`: 와이어 iframe은 이제 same-origin 서버 라우트(`/api/docs/.../doc`)를 `src`로
 *   로드한다 → `frame-src 'self'`가 iframe 원천을 same-origin으로 실제로 제약한다(외부 URL 프레임 차단).
 * 앱 자체 SPA(same-origin 인라인 번들)는 무손상이 되도록 script/style은 'self'+'unsafe-inline' 허용.
 */
export const WIRE_APP_CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "font-src 'self' data:; " +
  "connect-src 'self'; " +
  "frame-src 'self'; " +
  "frame-ancestors 'self'; " +
  "base-uri 'self'";

// 참고(CSP meta→헤더 전환): 과거엔 여기 `injectWireDocCsp(html)`가 있어 렌더 직전 문서 HTML의
// `<head>`에 `<meta http-equiv="Content-Security-Policy">`를 주입했다. 그러나 삽입 지점을 정규식으로
// 찾아야 했고, 적대적 HTML(주석 속 가짜 head·inert template·미종료 template·속성값 `</template>`)이
// 마스킹을 계속 뚫어 CSP를 죽은 노드에 가두는 우회가 반복됐다(verify FAIL 실증). 이제 CSP는 문서를
// 서빙하는 **서버 라우트의 HTTP 응답 헤더**(WIRE_DOC_CSP)로 강제한다 — 브라우저가 문서 내용과 무관하게
// 적용하므로 문서로는 절대 우회 불가(근본 해결). 문서 문자열은 무변형 서빙한다(주입 로직 자체를 제거).
