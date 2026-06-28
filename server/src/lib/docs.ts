/**
 * docs — charter 상주 docs(user-flow.md / PRD.md) 디렉토리 스캔 + 경로 안전 해석.
 *
 * 스캔 루트는 DOCS_ROOT 환경변수(기본=cwd). 루트 1단계 하위 <project>/docs/ 에
 * user-flow.md / PRD.md(charter 산출물) 또는 planning/prd.md(기획 단계 산출물)가
 * 하나라도 있으면 docs 프로젝트로 본다. lib/changes.ts와 같은
 * 경로 조작 방지 규칙(.. 금지 + 화이트리스트)을 그대로 재사용한다.
 *
 * 명세 문서(user-flow.md/PRD.md/planning/*.md)는 SSOT(charter·plan이 생성) — 읽기전용.
 * 단 기획 유저플로우의 **드래그 좌표 overlay**(planning/user-flow/<group>-vN.overlay.json)만
 * 예외로 여기서 쓴다(명세 .md는 절대 안 건드림 — changes.ts viz/graph-overlay.json 패턴).
 */
import { readdirSync, statSync, lstatSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { LayoutOverlay } from "@flowforge/shared";

/** docs 스캔 루트. 기본: cwd. */
export function docsRoot(): string {
  return process.env.DOCS_ROOT ?? process.cwd();
}

/**
 * docs/ 하위에 charter 산출물(user-flow.md / PRD.md) 또는 기획 산출물(planning/prd.md)이
 * 하나라도 있으면 docs 프로젝트로 본다. planning-only 프로젝트(charter 없이 기획 단계
 * 산출물만 있는 경우)도 인식하기 위해 planning/prd.md를 OR로 포함한다 — 인식 경로는
 * planning-prd 라우트/빌더가 읽는 경로와 동일하게 맞춘다.
 */
function hasDocs(docsDir: string): boolean {
  return (
    existsSync(join(docsDir, "user-flow.md")) ||
    existsSync(join(docsDir, "PRD.md")) ||
    existsSync(join(docsDir, "planning", "prd.md"))
  );
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
  // 경로 조작 방지: '..' 금지 + 단일 세그먼트만(영숫자/-/_). 슬래시 불허 →
  // changes(archive/<name> 때문에 '/' 허용)와 달리 docs project는 1단계 디렉토리명이라
  // '/'를 막아 a/b/c 같은 추가 깊이 접근(:project(*) 와일드카드 경유)을 원천 차단한다.
  if (project.includes("..") || !/^[A-Za-z0-9_-]+$/.test(project)) return null;
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

// ── 기획 유저플로우 (planning/user-flow/) ──────────────────────────────
// 명세는 <group>-vN.md(Mermaid, 읽기전용), 좌표는 <group>-vN.overlay.json(읽기+쓰기).

/** user-flow 파일명 토큰(group/version) 화이트리스트: 영숫자/-/_ 만. '..'·슬래시 차단. */
function isSafeFlowToken(s: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(s);
}

/** planning/user-flow 디렉토리 절대경로(없을 수도 있음 — 호출부에서 존재 확인). */
function userFlowDir(docsDir: string): string {
  return join(docsDir, "planning", "user-flow");
}

/** `<group>-vN.md` 목록(확장자 뗀 stem). user-flow 디렉토리 없으면 빈 배열. 정렬. */
export function listDocsUserFlows(docsDir: string): string[] {
  const dir = userFlowDir(docsDir);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.slice(0, -3))
      .sort();
  } catch {
    return [];
  }
}

/** `<group>-vN.md`(Mermaid 명세) 읽기. 토큰 부정·파일 부재면 null. */
export function readDocsUserFlowSpec(docsDir: string, stem: string): string | null {
  if (!isSafeFlowToken(stem)) return null;
  return readDocsFile(userFlowDir(docsDir), `${stem}.md`);
}

/** `<group>-vN.overlay.json`(드래그 좌표) 읽기. 없거나 못 읽으면 null. */
export function readDocsUserFlowOverlay(docsDir: string, stem: string): LayoutOverlay | null {
  if (!isSafeFlowToken(stem)) return null;
  const p = join(userFlowDir(docsDir), `${stem}.overlay.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as LayoutOverlay;
  } catch {
    return null;
  }
}

/**
 * `<group>-vN.overlay.json`에 드래그 좌표 저장(docs 첫 쓰기 — 명세 .md는 안 건드림).
 * 토큰 부정이면 쓰지 않고 false. user-flow 디렉토리 자동 생성. 성공 시 true.
 */
export function writeDocsUserFlowOverlay(docsDir: string, stem: string, overlay: LayoutOverlay): boolean {
  if (!isSafeFlowToken(stem)) return false;
  const dir = userFlowDir(docsDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${stem}.overlay.json`), JSON.stringify(overlay, null, 2), "utf-8");
  return true;
}
