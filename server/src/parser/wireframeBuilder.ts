/**
 * wireframeBuilder — change 디렉토리 → 와이어프레임(화면별 스켈레톤 박스).
 *
 * generate_prototype.py `wireframe_html` + `_box_kind` 포팅. screen spec만 화면이 되고,
 * 각 시나리오 THEN → 박스 종류 판정 + 화면 이동(flowTarget) 트리거.
 * graphBuilder와 같은 화면 수집/노드 id 규칙(screen-<slug>)을 써서 유저플로우 노드와 1:1 대응.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Wireframe, WireScreen, WireBox, WireBoxKind } from "@flowforge/shared";
import { parseSpecText, slug } from "./specParser.js";
import { isScreenSpec, screenAliases, flowTarget } from "./flowBinder.js";
import type { ScreenSpec } from "./flowBinder.js";

/** _box_kind 포팅: THEN 텍스트 키워드로 박스 종류 판정(순서 = 우선순위). */
function boxKind(t: string): WireBoxKind {
  if (["목록", "리스트", "list"].some((k) => t.includes(k))) return "list";
  if (["버튼", "저장", "촬영", "활성화"].some((k) => t.includes(k))) return "button";
  if (["없음", "빈", "empty", "기록 없음"].some((k) => t.includes(k))) return "empty";
  if (["제목", "title", "헤더", "표시"].some((k) => t.includes(k))) return "header";
  return "field";
}

/** change 디렉토리 → 와이어프레임. screen spec 없으면 빈 screens. */
export function buildWireframe(changeDir: string): Wireframe {
  const specsRoot = join(changeDir, "specs");
  let names: string[] = [];
  try {
    names = readdirSync(specsRoot).sort();
  } catch {
    return { screens: [] };
  }

  const screens: ScreenSpec[] = [];
  for (const name of names) {
    const specMd = join(specsRoot, name, "spec.md");
    try {
      if (!statSync(specMd).isFile()) continue;
    } catch {
      continue;
    }
    const raw = readFileSync(specMd, "utf-8");
    if (!isScreenSpec(raw)) continue;
    const parsed = parseSpecText(raw, name);
    screens.push({ ...parsed, _aliases: screenAliases(parsed) });
  }

  const wireScreens: WireScreen[] = screens.map((s) => {
    const boxes: WireBox[] = [];
    for (const req of s.requirements) {
      for (const scn of req.scenarios) {
        const tgt = flowTarget(scn.then, screens, s);
        boxes.push({
          kind: boxKind(scn.then),
          label: scn.title,
          goto: tgt ? tgt.anchor : null,
          dangling: tgt?.anchor === "__dangling__",
        });
      }
    }
    return { id: "screen-" + slug(s.name), title: s.name, boxes };
  });

  return { screens: wireScreens };
}
