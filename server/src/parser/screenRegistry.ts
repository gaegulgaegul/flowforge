/**
 * screenRegistry — docs/planning/features.md → 화면 레지스트리(ScreenRegistry).
 *
 * 화면(페이지)을 기획 명세의 1급 노드로 뽑고, 상세기능 ↔ 화면 N:M 링크를 수집하는
 * **병렬 파서**(featureTreeBuilder와 완전히 분리 — features 트리 렌더 회귀 0).
 *
 * 문법:
 *   ## 화면목록
 *   ### <화면이름>          <!-- screen: <영문id> -->   → ScreenNode{id, label}
 *   #### <상세기능>          <!-- screens: <id>,<id> -->   → ScreenLink(상세기능 라벨 ↔ 화면 id N:M)
 *
 * 화면 노드는 `## 화면목록` 섹션 안의 `### `만 인식한다(다른 섹션의 ### 오염 방지).
 * 링크(`<!-- screens: -->`)는 파일 어디의 `#### ` 아래든 인식한다(상세기능은 여러 요구사항 산하에 흩어져 있음).
 * 링크의 detailLabel은 직전 `#### ` 헤더 라벨. 화면 id는 명시 영문(한글 slug가 x로 죽는 버그 회피).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ScreenNode, ScreenLink, ScreenRegistry } from "@flowforge/shared";

const RE_HEADER = /^(#{2,4})\s+(.+?)\s*$/; // ## / ### / #### 헤더
const RE_SCREEN = /<!--\s*screen:\s*([A-Za-z0-9_-]+)\s*-->/; // 화면 노드 선언(단수)
const RE_SCREENS = /<!--\s*screens:\s*([A-Za-z0-9_,\s-]+?)\s*-->/; // 상세기능→화면 N:M 링크(복수)

const SCREENS_SECTION = "화면목록"; // `## 화면목록` 섹션 라벨

/**
 * docs 디렉토리 절대경로 → ScreenRegistry. `docs/planning/features.md`가 없으면 null(라우트가 404).
 */
export function buildScreenRegistry(docsDir: string): ScreenRegistry | null {
  const path = join(docsDir, "planning", "features.md");
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, "utf-8").split(/\r?\n/);
  return buildScreenRegistryFromLines(lines);
}

/**
 * features.md 라인 배열 → ScreenRegistry. 파일 IO 없이 in-memory 라인만 스캔한다(테스트 용이).
 */
export function buildScreenRegistryFromLines(lines: readonly string[]): ScreenRegistry {
  const screens: ScreenNode[] = [];
  const links: ScreenLink[] = [];

  let inScreensSection = false; // 현재 라인이 `## 화면목록` 섹션 안인지
  let currentScreenLabel: string | null = null; // 화면 노드 선언을 귀속할 직전 `### ` 라벨
  let currentDetailLabel: string | null = null; // 링크를 귀속할 직전 `#### ` 라벨

  for (const line of lines) {
    const h = line.match(RE_HEADER);
    if (h) {
      const level = (h[1] ?? "").length; // 2|3|4
      const label = h[2] ?? "";
      if (level === 2) {
        // 새 `## ` 섹션 진입 → 화면목록 섹션 여부 갱신, 하위 컨텍스트 리셋.
        inScreensSection = label.trim() === SCREENS_SECTION;
        currentScreenLabel = null;
        currentDetailLabel = null;
      } else if (level === 3) {
        // `### ` — 화면목록 섹션 안이면 화면 노드 후보(주석이 뒤따라야 확정).
        currentScreenLabel = inScreensSection ? label : null;
        currentDetailLabel = null;
      } else if (level === 4) {
        // `#### ` — 상세기능. 링크 주석이 뒤따르면 이 라벨로 귀속.
        currentDetailLabel = label;
      }
      // 헤더 라인 자체에 인라인 주석이 붙어 있을 수도 있으니(같은 줄) 아래로 폴스루하지 않고
      // 다음 라인에서 처리한다 — features.md 규약은 주석을 헤더 다음 줄에 둔다.
      continue;
    }

    // 화면 노드 선언: 화면목록 섹션의 `### ` 직후 `<!-- screen: id -->`.
    const sc = line.match(RE_SCREEN);
    if (sc && inScreensSection && currentScreenLabel !== null) {
      const id = (sc[1] ?? "").trim();
      if (id) screens.push({ id, label: currentScreenLabel });
      continue;
    }

    // N:M 링크: 어느 섹션이든 `#### ` 직후 `<!-- screens: a,b -->`.
    const sl = line.match(RE_SCREENS);
    if (sl && currentDetailLabel !== null) {
      const ids = (sl[1] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (ids.length > 0) links.push({ detailLabel: currentDetailLabel, screenIds: ids });
      continue;
    }
  }

  return { screens, links };
}
