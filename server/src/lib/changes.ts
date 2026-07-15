/**
 * changes — openspec changes 디렉토리 스캔 + 레이아웃 오버레이 입출력 (파일 기반)
 *
 * 스캔 루트는 OPENSPEC_ROOT 환경변수(기본=cwd의 openspec/). 개인 도구라
 * 다른 프로젝트의 openspec도 이 루트만 바꿔 시각화할 수 있다.
 *
 * 레이아웃 오버레이 저장 위치(cross-project-layout-persistence, design D1-D3):
 * - OVERLAY_ROOT 설정 시: <OVERLAY_ROOT>/<project>/<changeId>.json 에 쓴다(project 컨텍스트 필수).
 *   PROJECTS_ROOT(RO 마운트) 하위에는 쓰지 않는다 — 홈 전체 RO 보안 경계 보존.
 * - OVERLAY_ROOT 미설정 시: 기존 <changeDir>/viz/graph-overlay.json 폴백(회귀 없음, design 0.2).
 * - 읽기는 OVERLAY_ROOT 우선 조회 + 기존 <changeDir>/viz/graph-overlay.json 폴백을 항상 겸한다
 *   (무손실 — 이미 저장된 글로벌 루트 오버레이가 새 규약 도입으로 사라지지 않게, design D3).
 */
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { LayoutOverlay } from "@flowforge/shared";

/** OVERLAY_ROOT 저장 대상 컨텍스트. project+changeId 조합이 <OVERLAY_ROOT> 하위 경로를 결정한다. */
export interface OverlayTarget {
  project: string;
  changeId: string;
}

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

/**
 * change id → 절대 디렉토리 경로 (스캔 루트 밖 탈출 방지).
 * @param rootDir  changes 루트(예: 타 프로젝트의 openspec/changes). 기본=현행 changesRoot().
 *                 호출부 무수정 하위호환 — 인자 없으면 글로벌 루트 그대로.
 */
export function resolveChangeDir(id: string, rootDir: string = changesRoot()): string | null {
  // 경로 조작 방지: '..' 금지, 영숫자/-/_/슬래시(archive/만)만
  if (id.includes("..") || !/^[A-Za-z0-9_\-/]+$/.test(id)) return null;
  const dir = join(rootDir, id);
  if (!existsSync(dir) || !hasSpecs(dir)) return null;
  return dir;
}

/** 레거시 오버레이 경로(글로벌 루트 하위, 읽기 폴백/OVERLAY_ROOT 미설정 시 쓰기 대상) */
function legacyOverlayPath(changeDir: string): string {
  return join(changeDir, "viz", "graph-overlay.json");
}

/** OVERLAY_ROOT 하위 오버레이 경로. changeId의 archive/<name> 형태는 그대로 하위 디렉토리가 된다(design 0.1). */
function overlayRootPath(overlayRoot: string, target: OverlayTarget): string {
  return join(overlayRoot, target.project, `${target.changeId}.json`);
}

/**
 * 레이아웃 오버레이 읽기 (없으면 null).
 * OVERLAY_ROOT 설정 + target 제공 시 그 경로를 우선 조회하고, 없으면 레거시 경로도 읽는다(D3 무손실).
 */
export function readOverlay(changeDir: string, target?: OverlayTarget): LayoutOverlay | null {
  const overlayRoot = process.env.OVERLAY_ROOT;
  if (overlayRoot && target) {
    const p = overlayRootPath(overlayRoot, target);
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, "utf-8")) as LayoutOverlay;
      } catch {
        return null;
      }
    }
  }
  const legacy = legacyOverlayPath(changeDir);
  if (!existsSync(legacy)) return null;
  try {
    return JSON.parse(readFileSync(legacy, "utf-8")) as LayoutOverlay;
  } catch {
    return null;
  }
}

/**
 * 레이아웃 오버레이 저장.
 * OVERLAY_ROOT 설정 + target 제공 시 <OVERLAY_ROOT>/<project>/<changeId>.json 에 쓴다
 * (changeDir 하위엔 쓰지 않는다 — PROJECTS_ROOT RO 마운트 보존, design D1).
 * OVERLAY_ROOT 미설정 시 기존 <changeDir>/viz/ 폴백(회귀 없음, design 0.2).
 */
export function writeOverlay(changeDir: string, overlay: LayoutOverlay, target?: OverlayTarget): void {
  const overlayRoot = process.env.OVERLAY_ROOT;
  if (overlayRoot && target) {
    const p = overlayRootPath(overlayRoot, target);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify(overlay, null, 2), "utf-8");
    return;
  }
  const dir = join(changeDir, "viz");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(legacyOverlayPath(changeDir), JSON.stringify(overlay, null, 2), "utf-8");
}

/**
 * 런타임 검증: LayoutOverlay = `{nodeId: {x:number, y:number}}` 형태인가.
 * PUT layout 라우트(change·docs 양쪽)가 body를 쓰기 전에 통과시켜야 한다.
 */
export function isLayoutOverlay(v: unknown): v is LayoutOverlay {
  if (typeof v !== "object" || v === null) return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (typeof val !== "object" || val === null) return false;
    const p = val as Record<string, unknown>;
    if (typeof p["x"] !== "number" || typeof p["y"] !== "number") return false;
  }
  return true;
}
