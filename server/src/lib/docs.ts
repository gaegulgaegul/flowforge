/**
 * docs — charter 상주 docs(user-flow.md / PRD.md) 디렉토리 스캔 + 경로 안전 해석 (읽기전용).
 *
 * 스캔 루트는 DOCS_ROOT 환경변수(기본=cwd). 루트 1단계 하위 <project>/docs/ 에
 * user-flow.md 또는 PRD.md가 있으면 charter 프로젝트로 본다. lib/changes.ts와 같은
 * 경로 조작 방지 규칙(.. 금지 + 화이트리스트)을 그대로 재사용한다.
 * docs는 SSOT(charter가 생성) — 여기서는 절대 쓰지 않는다(읽기전용).
 */
import { readdirSync, statSync, lstatSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** docs 스캔 루트. 기본: cwd. */
export function docsRoot(): string {
  return process.env.DOCS_ROOT ?? process.cwd();
}

/** docs/ 하위에 user-flow.md 또는 PRD.md가 있으면 charter 프로젝트. */
function hasDocs(docsDir: string): boolean {
  return existsSync(join(docsDir, "user-flow.md")) || existsSync(join(docsDir, "PRD.md"));
}

/**
 * charter 프로젝트 이름 목록. 루트 1단계만 펼침(<project>/docs/...). 정렬.
 * 심볼릭 링크 프로젝트 디렉토리는 따라가지 않는다(SEC: 루트 밖 탈출 방지).
 */
export function listDocsProjects(): string[] {
  const root = docsRoot();
  if (!existsSync(root)) return [];
  const out: string[] = [];
  let names: string[];
  try {
    names = readdirSync(root).sort();
  } catch {
    return [];
  }
  for (const name of names) {
    const projDir = join(root, name);
    // 심볼릭 링크면 건너뜀(lstatSync로 링크 자체를 본다).
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
    if (hasDocs(join(projDir, "docs"))) out.push(name);
  }
  return out;
}

/** project 이름 → 절대 docs 디렉토리 경로 (스캔 루트 밖 탈출 방지). 없거나 docs 부재면 null. */
export function resolveDocsDir(project: string): string | null {
  // 경로 조작 방지(lib/changes.ts resolveChangeDir와 동일): '..' 금지, 영숫자/-/_/슬래시만.
  if (project.includes("..") || !/^[A-Za-z0-9_\-/]+$/.test(project)) return null;
  const dir = join(docsRoot(), project, "docs");
  if (!existsSync(dir) || !hasDocs(dir)) return null;
  return dir;
}

/** docs 디렉토리에서 파일 1개 읽기. 없거나 못 읽으면 null. */
export function readDocsFile(docsDir: string, name: string): string | null {
  const p = join(docsDir, name);
  if (!existsSync(p)) return null;
  try {
    return readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}
