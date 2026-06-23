/**
 * changes — openspec changes 디렉토리 스캔 + 레이아웃 오버레이 입출력 (파일 기반)
 *
 * 스캔 루트는 OPENSPEC_ROOT 환경변수(기본=cwd의 openspec/). 개인 도구라
 * 다른 프로젝트의 openspec도 이 루트만 바꿔 시각화할 수 있다.
 * 레이아웃 오버레이는 <change>/viz/graph-overlay.json 에 영속(spec.md는 SSOT, 읽기전용).
 */
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { LayoutOverlay } from "@flowforge/shared";

/** changes 스캔 루트. 기본: <cwd>/openspec/changes */
export function changesRoot(): string {
  const base = process.env.OPENSPEC_ROOT ?? join(process.cwd(), "openspec");
  return join(base, "changes");
}

/** change 디렉토리 후보 = specs/ 하위에 spec.md가 하나라도 있는 디렉토리 */
function hasSpecs(changeDir: string): boolean {
  const specsRoot = join(changeDir, "specs");
  if (!existsSync(specsRoot)) return false;
  try {
    for (const name of readdirSync(specsRoot)) {
      if (existsSync(join(specsRoot, name, "spec.md"))) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** 모든 change id 목록 (archive 하위까지 1단계 펼침). 정렬. */
export function listChanges(): string[] {
  const root = changesRoot();
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    let st;
    try {
      st = statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    if (name === "archive") {
      // archive/<dated-change>/specs/...
      for (const sub of readdirSync(dir).sort()) {
        if (hasSpecs(join(dir, sub))) out.push(`archive/${sub}`);
      }
    } else if (hasSpecs(dir)) {
      out.push(name);
    }
  }
  return out;
}

/** change id → 절대 디렉토리 경로 (스캔 루트 밖 탈출 방지) */
export function resolveChangeDir(id: string): string | null {
  // 경로 조작 방지: '..' 금지, 영숫자/-/_/슬래시(archive/만)만
  if (id.includes("..") || !/^[A-Za-z0-9_\-/]+$/.test(id)) return null;
  const dir = join(changesRoot(), id);
  if (!existsSync(dir) || !hasSpecs(dir)) return null;
  return dir;
}

/** 레이아웃 오버레이 경로 */
function overlayPath(changeDir: string): string {
  return join(changeDir, "viz", "graph-overlay.json");
}

/** 레이아웃 오버레이 읽기 (없으면 null) */
export function readOverlay(changeDir: string): LayoutOverlay | null {
  const p = overlayPath(changeDir);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as LayoutOverlay;
  } catch {
    return null;
  }
}

/** 레이아웃 오버레이 저장 (viz/ 디렉토리 자동 생성) */
export function writeOverlay(changeDir: string, overlay: LayoutOverlay): void {
  const dir = join(changeDir, "viz");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(overlayPath(changeDir), JSON.stringify(overlay, null, 2), "utf-8");
}
