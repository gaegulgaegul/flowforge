/**
 * specParser — openspec spec.md 파싱 (Python generate_prototype.py `parse_spec` 포팅)
 *
 * spec.md → { name, raw, requirements:[{title, scenarios:[{title, when, then}]}] }
 * Python `re.split`(캡처그룹 포함) 동작을 JS String.split(캡처그룹 포함)로 1:1 재현한다.
 * 골든 테스트(__golden__/golden.json)로 Python 원본과 동치 박제.
 */

export interface Scenario {
  title: string;
  when: string;
  then: string;
}
export interface Requirement {
  title: string;
  scenarios: Scenario[];
}
export interface ParsedSpec {
  name: string;
  raw: string;
  requirements: Requirement[];
}

// Python RE_* 그대로 (re.M = JS 'm'). split에 캡처그룹 1개 → JS split도 그룹 삽입.
const RE_REQ = /^###\s+Requirement:\s*(.+?)\s*$/m;
const RE_SCN = /^####\s+Scenario:\s*(.+?)\s*$/m;
const RE_WHEN = /^\s*-\s*\*\*WHEN\*\*\s*(.+?)\s*$/m;
const RE_THEN = /^\s*-\s*\*\*THEN\*\*\s*(.+?)\s*$/m;

/** Python re.split(글로벌 아님이어도 split은 전체 분할) 재현: split은 g 없이도 전부 분할 */
function reSplit(text: string, re: RegExp): string[] {
  // JS split은 g 플래그 없이도 모든 매치에서 분할하고 캡처그룹을 결과에 삽입한다.
  return text.split(re);
}

/** spec.md 텍스트 + 스펙 이름(디렉토리명)으로 파싱 */
export function parseSpecText(raw: string, name: string): ParsedSpec {
  const reqs: Requirement[] = [];
  const parts = reSplit(raw, RE_REQ); // [before, title1, body1, title2, body2, ...]
  // Python: it=iter(parts[1:]); for title in it: body=next(it,"")
  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i] ?? "";
    const body = parts[i + 1] ?? "";
    const scns: Scenario[] = [];
    // Python: RE_SCN.split(body)[1:] → 첫 조각(전문) 버리고 [title, blk, title, blk...]
    const scnBlocks = reSplit(body, RE_SCN).slice(1);
    for (let j = 0; j < scnBlocks.length; j += 2) {
      const st = scnBlocks[j] ?? "";
      const blk = scnBlocks[j + 1] ?? "";
      const when = blk.match(RE_WHEN);
      const then = blk.match(RE_THEN);
      scns.push({
        title: st.trim(),
        when: when ? (when[1] ?? "").trim() : "",
        then: then ? (then[1] ?? "").trim() : "",
      });
    }
    reqs.push({ title: title.trim(), scenarios: scns });
  }
  return { name, raw, requirements: reqs };
}

/** Python slug(): 소문자화 후 비영숫자 → '-', 양끝 '-' 제거, 빈값은 'x' */
export function slug(s: string): string {
  const out = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return out || "x";
}
