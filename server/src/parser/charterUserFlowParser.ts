/**
 * charterUserFlowParser — charter docs/user-flow.md 문법의 읽기전용 TS 포트.
 *
 * 원본: agentic-harness/skills/openspec-charter/charter_wireframe.py(parse_user_flow) +
 * charter_status.py(RE_FLOW_GOTO_EP). 정규식은 Python re와 1:1(IGNORECASE→'i').
 * 파일을 줄 단위로 분해(splitlines)해 각 줄을 매칭한다 — Python과 동일한 스캔 모델.
 *
 * 구조: ## flow → ### 화면 → (- step | - goto). 화면은 직전 flow에, step/goto는 직전 화면에 귀속.
 * SEED는 charter가 문서 헤더에서 문서 전체를 미검증으로 표시(첫 ## 이전 줄에 'SEED' 포함).
 */

// charter_wireframe.py RE_* 그대로(줄 단위 .match이므로 ^$ 앵커는 전체 줄을 본다).
const RE_FLOW = /^##\s+flow:\s*(.+?)\s*$/i;
const RE_SCREEN = /^###\s+화면:\s*(.+?)\s*$/i;
const RE_STEP = /^\s*[-*]\s*step:\s*(.*\S)\s*$/i;
const RE_GOTO = /^\s*[-*]\s*goto:\s*(.*\S)\s*$/i;
// charter_status.py RE_FLOW_GOTO_EP: goto가 (METHOD /path) 형태면 엔드포인트.
const RE_GOTO_EP = /^\s*[-*]\s*goto:\s*\(?\s*(GET|POST|PUT|DELETE|PATCH)\s+(\/\S+?)\)?\s*$/i;

/** goto 한 건: 화면 이동(target=화면명) 또는 엔드포인트(METHOD /path). */
export type CharterGoto =
  | { kind: "screen"; target: string }
  | { kind: "endpoint"; method: string; path: string };

/** 화면 1개(### 화면: 블록). */
export interface CharterScreen {
  /** 표시 화면명 = heading에서 ' ('(컴포넌트/경로) 앞 텍스트. */
  name: string;
  /** heading 원문(### 화면: 뒤 값 전체). */
  rawHeading: string;
  /** 괄호 안 컴포넌트명(예: InviteCodeScreen). 없으면 null. */
  component: string | null;
  /** 괄호 안 경로(예: /login). 없으면 null. */
  path: string | null;
  steps: string[];
  gotos: CharterGoto[];
}

/** flow 1개(## flow: 블록). */
export interface CharterFlow {
  key: string;
  screens: CharterScreen[];
}

/** user-flow.md 파싱 결과. seed=문서 전체 미검증 마킹 여부. */
export interface CharterUserFlow {
  flows: CharterFlow[];
  seed: boolean;
}

/**
 * '### 화면:' heading 값 파싱.
 * 예) "로그인·가입 (InviteCodeScreen, /login)" → name="로그인·가입", component="InviteCodeScreen", path="/login"
 * 괄호 안은 "Component, /path" / "Component" / "/path" 모두 허용. 괄호 없으면 전체가 name.
 */
function parseScreenHeading(rawHeading: string): {
  name: string;
  component: string | null;
  path: string | null;
} {
  const parenIdx = rawHeading.indexOf(" (");
  if (parenIdx < 0) {
    return { name: rawHeading.trim(), component: null, path: null };
  }
  const name = rawHeading.slice(0, parenIdx).trim();
  const close = rawHeading.indexOf(")", parenIdx);
  const inner = (close >= 0 ? rawHeading.slice(parenIdx + 2, close) : rawHeading.slice(parenIdx + 2))
    .trim();
  let component: string | null = null;
  let path: string | null = null;
  for (const partRaw of inner.split(",")) {
    const part = partRaw.trim();
    if (!part) continue;
    if (part.startsWith("/")) path = part;
    else component = part;
  }
  return { name, component, path };
}

/**
 * 화면 goto 텍스트에서 화면명 추출. 후행 ' (Component)' 같은 괄호 꼬리는 떼어
 * 화면 정의의 name과 매칭되게 한다. 예) "홈 (HomeScreen)" → "홈", "홈" → "홈".
 */
function screenGotoName(text: string): string {
  const parenIdx = text.indexOf(" (");
  if (parenIdx < 0) return text.trim();
  return text.slice(0, parenIdx).trim();
}

/** 문서 헤더(첫 '## ' 이전)에 'SEED'를 포함한 줄이 있으면 문서 전체가 SEED. */
function detectHeaderSeed(lines: string[]): boolean {
  for (const line of lines) {
    if (/^##\s/.test(line)) break; // 첫 섹션 시작 → 헤더 끝
    if (line.includes("SEED")) return true;
  }
  return false;
}

/** user-flow.md 텍스트 → 구조화된 flows + seed. */
export function parseCharterUserFlow(raw: string): CharterUserFlow {
  const lines = raw.split("\n");
  const seed = detectHeaderSeed(lines);
  const flows: CharterFlow[] = [];
  let curFlow: CharterFlow | null = null;
  let curScreen: CharterScreen | null = null;

  for (const line of lines) {
    const mf = RE_FLOW.exec(line);
    if (mf) {
      curFlow = { key: (mf[1] ?? "").trim(), screens: [] };
      flows.push(curFlow);
      curScreen = null;
      continue;
    }
    const ms = RE_SCREEN.exec(line);
    if (ms) {
      if (curFlow === null) {
        curFlow = { key: "(unscoped)", screens: [] };
        flows.push(curFlow);
      }
      const rawHeading = (ms[1] ?? "").trim();
      const { name, component, path } = parseScreenHeading(rawHeading);
      curScreen = { name, rawHeading, component, path, steps: [], gotos: [] };
      curFlow.screens.push(curScreen);
      continue;
    }
    if (curScreen === null) continue;

    const mStep = RE_STEP.exec(line);
    if (mStep) {
      curScreen.steps.push((mStep[1] ?? "").trim());
      continue;
    }
    // endpoint goto를 먼저 본다(RE_GOTO와 둘 다 매칭되므로 더 구체적인 쪽 우선).
    const mEp = RE_GOTO_EP.exec(line);
    if (mEp) {
      curScreen.gotos.push({
        kind: "endpoint",
        method: (mEp[1] ?? "").toUpperCase(),
        path: mEp[2] ?? "",
      });
      continue;
    }
    const mGoto = RE_GOTO.exec(line);
    if (mGoto) {
      curScreen.gotos.push({ kind: "screen", target: screenGotoName((mGoto[1] ?? "").trim()) });
      continue;
    }
  }

  return { flows, seed };
}
