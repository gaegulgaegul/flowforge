/**
 * projects — 홈서버 프로젝트를 스캔해 카드 그리드용 메타를 집계한다 (읽기전용 합성).
 *
 * 스캔 모델(예광탄): PROJECTS_ROOT(기본 cwd 상위) 1단계 하위 <project>/ 가
 * openspec/changes/ 에 change를 1개 이상 가지면 프로젝트로 본다(decision show-all:
 * charter 유무 무관, change 있는 모든 프로젝트 노출).
 *   - hasCharter = <project>/docs/ 에 user-flow.md 또는 PRD.md 존재
 *   - changeCount = openspec/changes 하위 change 디렉토리 수(archive 제외)
 *   - auditStatus = 정적(예광탄은 'unknown'; 실시간 산출은 후속)
 *   - displayName = 한글맵 폴백(없으면 영문 name) — 연결 키(name)는 영문 불변
 *
 * docs.ts(심링크 방어·정렬)와 changes.ts(specs 스캔)의 패턴을 차용하되 쓰지 않는다.
 */
import { readdirSync, statSync, lstatSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ProjectCard, AuditStatus } from "@flowforge/shared";

/** 프로젝트 스캔 루트. 기본: cwd의 부모(홈서버 프로젝트들이 나란히 있는 디렉토리). */
export function projectsRoot(): string {
  return process.env.PROJECTS_ROOT ?? join(process.cwd(), "..");
}

/** <project>/docs/ 에 charter 상주 문서(user-flow.md|PRD.md)가 있으면 true. */
function hasCharter(projectDir: string): boolean {
  const docsDir = join(projectDir, "docs");
  return existsSync(join(docsDir, "user-flow.md")) || existsSync(join(docsDir, "PRD.md"));
}

/** <project>/openspec/changes 하위 change 디렉토리 수(archive 제외, specs 보유분만). */
function countChanges(projectDir: string): number {
  const changesDir = join(projectDir, "openspec", "changes");
  if (!existsSync(changesDir)) return 0;
  let n = 0;
  let names: string[];
  try {
    names = readdirSync(changesDir);
  } catch {
    return 0;
  }
  for (const name of names) {
    if (name === "archive") continue;
    const specsDir = join(changesDir, name, "specs");
    if (!existsSync(specsDir)) continue;
    try {
      const hasSpec = readdirSync(specsDir).some((c) => existsSync(join(specsDir, c, "spec.md")));
      if (hasSpec) n += 1;
    } catch {
      // 읽기 실패는 무시(해당 change만 제외).
    }
  }
  return n;
}

/**
 * 카드 그리드용 프로젝트 목록. change를 1개 이상 가진 프로젝트만, 이름순 정렬.
 * 심볼릭 링크 디렉토리는 따라가지 않는다(루트 밖 탈출 방지).
 * @param labelMap  영문 name→한글 표시명 폴백 맵(없으면 영문 name 사용)
 */
export function listProjectCards(labelMap?: Map<string, string>): ProjectCard[] {
  const root = projectsRoot();
  if (!existsSync(root)) return [];

  let names: string[];
  try {
    names = readdirSync(root).sort();
  } catch {
    return [];
  }

  const out: ProjectCard[] = [];
  for (const name of names) {
    const projDir = join(root, name);
    try {
      if (lstatSync(projDir).isSymbolicLink()) continue;
    } catch {
      continue;
    }
    let st;
    try {
      st = statSync(projDir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;

    const changeCount = countChanges(projDir);
    if (changeCount === 0) continue; // change 없으면 카드 아님(decision show-all 기준).

    const auditStatus: AuditStatus = "unknown"; // 예광탄: 정적. 실시간 산출은 후속.
    out.push({
      name,
      displayName: labelMap?.get(name) ?? name,
      hasCharter: hasCharter(projDir),
      changeCount,
      auditStatus,
    });
  }
  return out;
}
