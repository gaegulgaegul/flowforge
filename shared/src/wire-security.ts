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
 */
export const WIRE_IFRAME_SANDBOX = 'allow-scripts' as const;

/**
 * 문서 CSP(iframe 안 와이어 HTML 문서에 주입) — 외부 리소스 로드·네트워크 유출 표면 제거.
 *
 * `default-src 'none'` 기반: 외부 script/style/img/font/connect(fetch·XHR·WebSocket)를 전부 차단한다.
 * 자족 인라인 자산만 허용(`'unsafe-inline'`은 문서가 인라인 스크립트/스타일로 자족하므로 최소 허용).
 * 외부 CDN·트래킹 픽셀·외부 fetch는 전부 차단되어 외부 네트워크로 데이터가 나가지 않는다.
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
 * 앱 CSP(flowforge 자체 응답 헤더) — clickjacking 방어(현재 서버에 CSP 전무 → 이 change에서 신설).
 *
 * `frame-ancestors 'self'`: flowforge가 신뢰되지 않은 상위 프레임에 임베드(clickjacking 대상)되지 않게.
 * `frame-src 'self'`: 심층방어용. 단 와이어 iframe은 전부 `srcdoc`(about:srcdoc)라 frame-src의 실제
 *   제약 대상(외부 src URL)이 없다 — **실질 방어는 "iframe에 외부 src URL을 절대 넣지 않는다"는 코드
 *   불변식**이지 이 지시어가 아니다(WireframeDeviceFrame은 srcDoc만 사용). frame-src는 향후 실수 방지용.
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

/**
 * 와이어 HTML 문서에 문서 CSP(WIRE_DOC_CSP)를 `<meta http-equiv>`로 주입한다(srcdoc 렌더 직전).
 *
 * ⚠️ html은 **적대적 입력**(신뢰되지 않은 AI 생성물)이라 이 주입 로직 자체가 우회 시도 대상이다.
 * 순진한 정규식은 HTML 주석 안 가짜 `<head>` 문자열(예: `<!-- <head> --><head>...`)에 먼저 매치해
 * CSP 메타를 **죽은 주석 안**에 넣고 실제 head는 CSP 없이 렌더된다(보안 리뷰 BLOCK 실측). 그래서 매치
 * 위치는 **주석을 마스킹한 스캔 사본**에서 찾고, 원본의 그 인덱스에 삽입한다(주석 속 가짜 태그 무시).
 * 여러 CSP 메타가 공존해도 CSP 스펙상 정책은 restrictively 결합되므로 우리 메타를 앞세우면 완화 불가.
 *
 * 렌더러(web)·테스트가 같은 함수를 공유해 drift를 막는다(D8 — 보안은 단일 원천).
 */
export function injectWireDocCsp(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${WIRE_DOC_CSP}">`;
  // 스캔 사본: HTML 주석을 같은 길이의 공백으로 마스킹(인덱스는 원본과 1:1 유지, 주석 속 태그 무시).
  const scan = html.replace(/<!--[\s\S]*?-->/g, (c) => " ".repeat(c.length));

  const headMatch = /<head[^>]*>/i.exec(scan);
  if (headMatch) {
    const at = headMatch.index + headMatch[0].length;
    return html.slice(0, at) + meta + html.slice(at);
  }
  const htmlMatch = /<html[^>]*>/i.exec(scan);
  if (htmlMatch) {
    const at = htmlMatch.index + htmlMatch[0].length;
    return html.slice(0, at) + `<head>${meta}</head>` + html.slice(at);
  }
  return `${meta}${html}`;
}
