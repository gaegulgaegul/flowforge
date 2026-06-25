/**
 * koreanLabels — 화면 표시명만 한글로 해석하는 라벨 레이어 (읽기전용·순수 함수).
 *
 * 핵심 원칙(decision korean-display-labels): 연결·라우팅 키는 영문 슬러그 그대로,
 * 표시명만 한글. 여기서 키를 절대 변형하지 않는다(specs/<key>/ 디렉토리명 매칭이
 * 글자단위로 유지돼야 거짓연결 0이 성립).
 *
 * - capability 한글명: 출처1(spec.md `## capability: 키 — 한글` 병기) → 출처2(키맵) → 영문키
 * - change 한글명: 출처3(proposal.md 사람이 쓴 한글 제목) → 영문키
 *
 * 정규식은 agentic-harness `audit_match.py`의 RE_CAP / RE_CAP_LABEL 동치 포팅
 * (charter 산출물 스키마는 agentic-harness 소유 → 읽기전용 소비만).
 */

/** `## capability: <name>` 추출 (대소문자 무시). audit_match.RE_CAP 동치. */
const RE_CAP = /^##\s+capability:\s*(.+?)\s*$/i;

/**
 * `<key> — <label>` 분리 — 공백 둘러싼 em-dash(U+2014) 또는 ASCII 하이픈.
 * audit_match.RE_CAP_LABEL 동치. 구분자가 공백을 양옆에 요구하므로
 * 슬러그 내부 하이픈('project-card-grid')은 오분리되지 않는다.
 */
const RE_CAP_LABEL = /^(.*?\S)\s+(?:—|-)\s+(\S.*)$/;

/** capability 토큰을 (key, label)로 분리. 병기 없으면 label=undefined, key는 trim만. */
export function splitCapabilityLabel(name: string): { key: string; label?: string } {
  const m = RE_CAP_LABEL.exec(name);
  if (m && m[1] && m[2]) return { key: m[1].trim(), label: m[2].trim() };
  return { key: name.trim() };
}

/**
 * spec.md 본문에서 `## capability: 키 — 한글` 병기를 파싱해 key→label 맵을 만든다.
 * 병기 없는 capability(`## capability: 키`)는 맵에 안 들어간다(라벨 부재 = 폴백 신호).
 */
export function parseCapabilityLabels(specMd: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of specMd.split(/\r?\n/)) {
    const mc = RE_CAP.exec(raw);
    if (!mc || !mc[1]) continue;
    const { key, label } = splitCapabilityLabel(mc[1]);
    if (label) out.set(key, label);
  }
  return out;
}

/**
 * capability 표시명 해석 — 출처1(spec 병기 맵) → 출처2(키맵) → 영문키 폴백.
 * @param key       영문 capability 슬러그(불변)
 * @param fromSpec  parseCapabilityLabels 결과(출처1)
 * @param keyMap    flowforge 내 키→한글 폴백 맵(출처2)
 */
export function capabilityLabel(
  key: string,
  fromSpec: Map<string, string>,
  keyMap: Map<string, string>,
): string {
  return fromSpec.get(key) ?? keyMap.get(key) ?? key;
}

/**
 * change 표시명 해석 — 출처3(proposal 한글 제목) → 영문 change 키 폴백.
 * @param changeKey    영문 change 디렉토리명(불변)
 * @param koreanTitle  proposal.md에서 추출한 사람이 쓴 한글 제목(없으면 undefined/'')
 */
export function changeLabel(changeKey: string, koreanTitle?: string): string {
  const t = koreanTitle?.trim();
  return t ? t : changeKey;
}
