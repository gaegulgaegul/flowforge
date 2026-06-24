/**
 * charterPrdParser — charter docs/PRD.md 의 `## decision:` 이력 블록을 읽기전용 파싱.
 *
 * 원본: agentic-harness/skills/openspec-charter/charter_status.py(prd_trace 블록 수집).
 * PRD는 append 이력(과거 안 덮음)이라 문서 순서 = 시간 순서. 그대로 보존한다.
 * status가 'superseded-by:D5' → superseded=true, supersededBy='D5'. 'active' → false/null.
 * 문서 헤더(첫 ## 이전)에 'SEED' 포함 줄이 있으면 문서 전체가 SEED.
 */
import type { DocsDecision } from "@flowforge/shared";

// charter_status.py RE_PRD_DECISION + 불릿(줄 단위 .match).
const RE_DECISION = /^##\s+decision:\s*(.+?)\s*$/i;
const RE_DATE = /^\s*[-*]\s*date:\s*(.*\S)\s*$/i;
const RE_CAPABILITY = /^\s*[-*]\s*capability:\s*(.*\S)\s*$/i;
const RE_WHY = /^\s*[-*]\s*why:\s*(.*\S)\s*$/i;
const RE_WHAT = /^\s*[-*]\s*what:\s*(.*\S)\s*$/i;
const RE_SUCCESS = /^\s*[-*]\s*success:\s*(.*\S)\s*$/i;
const RE_STATUS = /^\s*[-*]\s*status:\s*(.*\S)\s*$/i;

interface DraftDecision {
  id: string;
  date: string;
  capability: string;
  why: string;
  what: string;
  success: string;
  status: string;
}

/** status 원문 → (superseded, supersededBy). 'superseded-by:D5' → (true,'D5'); 그 외 → (false,null). */
function parseStatus(status: string): { superseded: boolean; supersededBy: string | null } {
  const m = /^superseded-by:\s*(.+)$/i.exec(status.trim());
  if (m) return { superseded: true, supersededBy: (m[1] ?? "").trim() };
  return { superseded: false, supersededBy: null };
}

/** 문서 헤더(첫 '## ' 이전)에 'SEED'를 포함한 줄이 있으면 문서 전체가 SEED. */
function detectHeaderSeed(lines: string[]): boolean {
  for (const line of lines) {
    if (/^##\s/.test(line)) break;
    if (line.includes("SEED")) return true;
  }
  return false;
}

/** PRD.md 텍스트 → decision 타임라인(문서=시간 순서) + 문서 seed. */
export function parseCharterPrd(raw: string): { decisions: DocsDecision[]; seed: boolean } {
  const lines = raw.split("\n");
  const seed = detectHeaderSeed(lines);
  const drafts: DraftDecision[] = [];
  let cur: DraftDecision | null = null;

  for (const line of lines) {
    const md = RE_DECISION.exec(line);
    if (md) {
      cur = {
        id: (md[1] ?? "").trim(),
        date: "",
        capability: "",
        why: "",
        what: "",
        success: "",
        status: "",
      };
      drafts.push(cur);
      continue;
    }
    // 다른 '## ' 섹션이 나오면 현재 decision 블록 종료(다음 ## decision: 전까지만 귀속).
    if (/^##\s/.test(line)) {
      cur = null;
      continue;
    }
    if (cur === null) continue;

    const mDate = RE_DATE.exec(line);
    if (mDate) {
      cur.date = (mDate[1] ?? "").trim();
      continue;
    }
    const mCap = RE_CAPABILITY.exec(line);
    if (mCap) {
      cur.capability = (mCap[1] ?? "").trim();
      continue;
    }
    const mWhy = RE_WHY.exec(line);
    if (mWhy) {
      cur.why = (mWhy[1] ?? "").trim();
      continue;
    }
    const mWhat = RE_WHAT.exec(line);
    if (mWhat) {
      cur.what = (mWhat[1] ?? "").trim();
      continue;
    }
    const mSuccess = RE_SUCCESS.exec(line);
    if (mSuccess) {
      cur.success = (mSuccess[1] ?? "").trim();
      continue;
    }
    const mStatus = RE_STATUS.exec(line);
    if (mStatus) {
      cur.status = (mStatus[1] ?? "").trim();
      continue;
    }
  }

  const decisions: DocsDecision[] = drafts.map((d) => {
    const { superseded, supersededBy } = parseStatus(d.status);
    // exactOptionalPropertyTypes: seed는 문서가 SEED일 때만 부여(아니면 미세팅=비파괴).
    const base = {
      id: d.id,
      date: d.date,
      capability: d.capability,
      why: d.why,
      what: d.what,
      success: d.success,
      status: d.status,
      superseded,
      supersededBy,
    };
    return seed ? { ...base, seed: true } : base;
  });

  return { decisions, seed };
}
