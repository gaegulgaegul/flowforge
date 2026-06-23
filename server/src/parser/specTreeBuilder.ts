/**
 * specTreeBuilder — change 디렉토리 → 기능명세서 3단 트리.
 *
 * 계층: change(루트) → 요구사항(specs/ 하위 디렉토리=capability) → 기능(spec의 ### Requirement)
 *        → 상세기능(#### Scenario). iaBuilder와 같은 capability 순회 패턴을 쓰되,
 *        Scenario를 scenarioCount(숫자)로 접지 않고 detail 노드로 펼쳐 WHEN/THEN을 노출한다.
 * spec.md는 SSOT(읽기전용). graphBuilder/iaBuilder와 같은 parseSpecText를 재사용한다.
 */
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import type { SpecTree, SpecTreeNode } from "@flowforge/shared";
import { parseSpecText, slug } from "./specParser.js";

/** change 디렉토리 절대경로 → 기능명세서 3단 트리. specs/ 없으면 빈 children 루트. */
export function buildSpecTree(changeDir: string): SpecTree {
  const changeName = basename(changeDir);
  const specsRoot = join(changeDir, "specs");
  const requirements: SpecTreeNode[] = [];

  if (existsSync(specsRoot)) {
    for (const capName of readdirSync(specsRoot).sort()) {
      const specPath = join(specsRoot, capName, "spec.md");
      if (!existsSync(specPath)) continue;
      const parsed = parseSpecText(readFileSync(specPath, "utf-8"), capName);
      const capId = `cap-${slug(capName)}`;

      // 2단(기능=Requirement): 각 ### Requirement.
      const features: SpecTreeNode[] = parsed.requirements.map((req) => {
        const featureId = `${capId}__req-${slug(req.title)}`;

        // 3단(상세기능=Scenario): 각 #### Scenario를 detail 노드로 펼친다(count 아님).
        // 같은 title 중복 방지를 위해 index를 id 접미로 붙인다.
        const details: SpecTreeNode[] = req.scenarios.map((scn, index) => ({
          id: `${featureId}__scn-${slug(scn.title)}#${index}`,
          kind: "detail" as const,
          label: scn.title,
          detail: scn.then,
          when: scn.when,
          then: scn.then,
          children: [],
        }));

        return {
          id: featureId,
          kind: "feature" as const,
          label: req.title,
          detail: "",
          when: "",
          then: "",
          children: details,
        };
      });

      // 1단(요구사항=capability): specs/ 하위 각 디렉토리.
      requirements.push({
        id: capId,
        kind: "requirement",
        label: capName,
        detail: "",
        when: "",
        then: "",
        children: features,
      });
    }
  }

  const root: SpecTreeNode = {
    id: `change-${slug(changeName)}`,
    kind: "change",
    label: changeName,
    detail: "",
    when: "",
    then: "",
    children: requirements,
  };
  return { root };
}
