/**
 * markdown — 마크다운을 `## 헤더` 단위로 분할하는 순수 유틸.
 *
 * PRD 빌더가 proposal.md / design.md의 특정 `## 섹션` 본문을 끌어올 때 쓴다.
 * 완전한 마크다운 파서가 아니라 레벨2(`##`) 헤더 기준 본문 블록 분할만 한다.
 * 더 깊은 헤더(###+)는 섹션을 새로 가르지 않고 본문에 그대로 포함된다.
 */

/** 헤더 텍스트를 비교용 키로 정규화: 소문자 + 연속 공백을 한 칸으로 + 양끝 trim. */
function normKey(header: string): string {
  return header.toLowerCase().replace(/\s+/g, " ").trim();
}

const RE_H2 = /^##\s+(.+?)\s*$/;

/**
 * `## 헤더`를 경계로 본문 블록을 자른다.
 * 반환: 정규화된 헤더키 → 본문(trim됨). 헤더 앞 서문(preamble)은 버린다.
 * 같은 키가 두 번 나오면 마지막 것이 이긴다(실무상 드묾).
 */
export function splitSections(md: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = md.split(/\r?\n/);
  let curKey: string | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (curKey !== null) out.set(curKey, buf.join("\n").trim());
  };

  for (const line of lines) {
    const m = line.match(RE_H2);
    if (m) {
      flush();
      curKey = normKey(m[1] ?? "");
      buf = [];
    } else if (curKey !== null) {
      buf.push(line);
    }
    // curKey===null(서문)인 동안의 줄은 버림
  }
  flush();
  return out;
}

/**
 * 헤더키 후보 배열 중 맵에 존재하는 것들의 본문을 순서대로 줄바꿈 2개로 이어붙인다.
 * 하나도 없으면 빈 문자열. PRD 한 섹션이 여러 소스 헤더를 합칠 때 쓴다.
 */
export function sectionBody(sections: Map<string, string>, keys: readonly string[]): string {
  const parts: string[] = [];
  for (const k of keys) {
    const body = sections.get(normKey(k));
    if (body !== undefined && body !== "") parts.push(body);
  }
  return parts.join("\n\n");
}
