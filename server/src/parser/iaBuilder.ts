/**
 * iaBuilder — change 디렉토리 → 정보구조도(IA) 트리.
 *
 * 계층: change(루트) → capability(specs/ 하위 디렉토리=섹션) → requirement(spec의 ### Requirement) .
 * 각 requirement의 scenarioCount = #### Scenario 개수(연결 상세기능 ≈ 받아들임 기준).
 * spec.md는 SSOT(읽기전용). graphBuilder와 같은 parseSpecText를 재사용한다.
 */
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import type { IANode, IATree } from "@flowforge/shared";
import { parseSpecText, slug } from "./specParser.js";

/** change 디렉토리 절대경로 → IA 트리. specs/ 없으면 빈 children 루트. */
export function buildIATree(changeDir: string): IATree {
  const changeName = basename(changeDir);
  const specsRoot = join(changeDir, "specs");
  const capabilities: IANode[] = [];

  if (existsSync(specsRoot)) {
    for (const capName of readdirSync(specsRoot).sort()) {
      const specPath = join(specsRoot, capName, "spec.md");
      if (!existsSync(specPath)) continue;
      const parsed = parseSpecText(readFileSync(specPath, "utf-8"), capName);

      const requirements: IANode[] = parsed.requirements.map((req) => {
        const reqSlug = slug(req.title);
        const firstThen = req.scenarios.find((s) => s.then)?.then ?? "";
        return {
          id: `cap-${slug(capName)}__req-${reqSlug}`,
          kind: "requirement" as const,
          label: req.title,
          detail: firstThen,
          scenarioCount: req.scenarios.length,
          children: [],
        };
      });

      capabilities.push({
        id: `cap-${slug(capName)}`,
        kind: "capability",
        label: capName,
        detail: "",
        // 섹션의 상세기능 합 = 하위 requirement들의 scenario 총합
        scenarioCount: requirements.reduce((n, r) => n + r.scenarioCount, 0),
        children: requirements,
      });
    }
  }

  const root: IANode = {
    id: `change-${slug(changeName)}`,
    kind: "change",
    label: changeName,
    detail: "",
    scenarioCount: capabilities.reduce((n, c) => n + c.scenarioCount, 0),
    children: capabilities,
  };
  return { root };
}
