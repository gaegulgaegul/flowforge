/**
 * projects — 홈서버 프로젝트를 스캔해 카드 그리드용 메타를 집계한다 (읽기전용 합성).
 *
 * 스캔 모델: PROJECTS_ROOT(기본 cwd 상위) 1단계 하위 <project>/ 가
 * (a) openspec/changes/ 에 활성 change를 1개 이상 가지거나 (b) docs 인식(hasDocs:
 * charter 또는 기획 산출물) 되면 프로젝트로 본다(decision show-all: charter 유무 무관 +
 * 활성 change가 전부 archive돼도 docs 프로젝트는 카드 유지 — 기획 뷰 도달성 보장).
 *   - hasCharter = <project>/docs/ 에 user-flow.md 또는 PRD.md 존재
 *   - changeCount = openspec/changes 하위 change 디렉토리 수(archive 제외)
 *   - auditStatus = <project>/docs/audit.json 의 finalJudgment 매핑(저장본 반영; 없으면 'unknown' 폴백)
 *   - displayName = 한글맵 폴백(없으면 영문 name) — 연결 키(name)는 영문 불변
 *
 * docs.ts의 심링크 방어·정렬 패턴을 차용하고, docs 인식은 docs.ts hasDocs 단일 게이트를
 * 재사용한다(planning-only-recognition: 인식 판정은 hasDocs 한 곳으로 수렴).
 */
import { readdirSync, readFileSync, statSync, lstatSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ProjectCard, AuditStatus } from "@flowforge/shared";
import { hasDocs } from "./docs.js";

/** 프로젝트 스캔 루트. 기본: cwd의 부모(홈서버 프로젝트들이 나란히 있는 디렉토리). */
export function projectsRoot(): string {
  return process.env.PROJECTS_ROOT ?? join(process.cwd(), "..");
}

/**
 * 프로젝트 이름 → 절대 디렉토리 경로 (화이트리스트 검증, 루트 밖 탈출 방지).
 * name은 요청에서 올 수 있으므로 '..'·경로구분자·구분자 포함 이름을 거부한다
 * (listProjectCards는 readdir로 얻은 단일 세그먼트만 다뤄 이 방어가 불필요했다).
 * PROJECTS_ROOT 1단계 하위 실재 디렉토리이고 심링크가 아닐 때만 경로를 돌려주고,
 * 그 외(부재·심링크·비디렉토리·조작)는 null. 화면 뷰/카드 스캔이 공용으로 재사용한다.
 */
export function resolveProjectDir(name: string): string | null {
  // 화이트리스트 정규식(영숫자·하이픈·언더스코어) — routes 판과 동일 기준으로 통합.
  // 블록리스트만으로는 dotfile(.ssh 등)·유니코드·공백 이름이 "프로젝트"로 해석되는
  // 신뢰경계 결함이 남는다(review C-1: 프로덕션=홈 전체 RO 마운트+무인증이라 원격이
  // 프로빙 대상을 직접 지정 가능). 카드 스캔도 이 게이트를 공유해 숨김 디렉토리 제외.
  if (!name || !/^[A-Za-z0-9_-]+$/.test(name)) return null;
  const projDir = join(projectsRoot(), name);
  try {
    if (lstatSync(projDir).isSymbolicLink()) return null; // 심링크 탈출 방어
    if (!statSync(projDir).isDirectory()) return null; // 1단계 실재 디렉토리
  } catch {
    return null; // 부재·접근불가
  }
  return projDir;
}

/** <project>/docs/ 에 charter 상주 문서(user-flow.md|PRD.md)가 있으면 true. */
function hasCharter(projectDir: string): boolean {
  const docsDir = join(projectDir, "docs");
  return existsSync(join(docsDir, "user-flow.md")) || existsSync(join(docsDir, "PRD.md"));
}

/** change 스캔 결과: 활성 change 이름 목록·아카이브 수·최근 활동 mtime(ms). */
interface ChangeScan {
  active: string[];
  archivedCount: number;
  lastMtimeMs: number;
}

/**
 * <project>/openspec/changes 스캔. 활성(archive 제외, specs 보유) change 이름·mtime,
 * archive 하위 change 수를 한 번의 순회로 수집. 카드 정보 확장용(active/archived 분리·최근활동).
 */
function scanChanges(projectDir: string): ChangeScan {
  const changesDir = join(projectDir, "openspec", "changes");
  const empty: ChangeScan = { active: [], archivedCount: 0, lastMtimeMs: 0 };
  if (!existsSync(changesDir)) return empty;
  let names: string[];
  try {
    names = readdirSync(changesDir);
  } catch {
    return empty;
  }
  const active: string[] = [];
  let archivedCount = 0;
  let lastMtimeMs = 0;
  for (const name of names) {
    const cdir = join(changesDir, name);
    if (name === "archive") {
      // archive 하위 = 완료된 change들. specs 보유분만 센다.
      try {
        for (const a of readdirSync(cdir)) {
          if (existsSync(join(cdir, a, "specs"))) archivedCount += 1;
        }
      } catch {
        // archive 읽기 실패는 무시(archivedCount 0 유지).
      }
      continue;
    }
    const specsDir = join(cdir, "specs");
    if (!existsSync(specsDir)) continue;
    try {
      const hasSpec = readdirSync(specsDir).some((c) => existsSync(join(specsDir, c, "spec.md")));
      if (hasSpec) {
        active.push(name);
        try {
          lastMtimeMs = Math.max(lastMtimeMs, statSync(cdir).mtimeMs);
        } catch {
          // mtime 실패는 무시(활동일 없음).
        }
      }
    } catch {
      // 읽기 실패는 무시(해당 change만 제외).
    }
  }
  return { active, archivedCount, lastMtimeMs };
}

/** UTC epoch(ms) → KST(Asia/Seoul) YYYY-MM-DD. 시스템은 UTC이므로 +9h 후 일자 절단(15-date-timezone). */
function toKstDate(ms: number): string {
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** audit finalJudgment → AuditStatus. 미인식·비문자열(UNVERIFIABLE 포함)은 unknown. */
export function mapFinalJudgment(j: unknown): AuditStatus {
  if (j === "PASS") return "clean";
  if (j === "FAIL") return "fail";
  if (j === "조건부") return "warn";
  return "unknown";
}

/**
 * <project>/docs/audit.json 의 finalJudgment만 읽어 매핑한다.
 * 파일없음·읽기실패·JSON 파싱 실패는 전부 unknown 폴백(throw 금지).
 * scanRoot 등 다른 필드는 읽지 않는다(경로 신뢰 경계).
 */
export function readAuditStatus(projectDir: string): AuditStatus {
  const auditPath = join(projectDir, "docs", "audit.json");
  if (!existsSync(auditPath)) return "unknown";
  try {
    const parsed: unknown = JSON.parse(readFileSync(auditPath, "utf-8"));
    const judgment =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>).finalJudgment
        : undefined;
    return mapFinalJudgment(judgment);
  } catch {
    return "unknown";
  }
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
    // 심링크·비디렉토리 방어는 resolveProjectDir로 공용화(readdir 이름이라 조작 가드는 no-op).
    const projDir = resolveProjectDir(name);
    if (projDir === null) continue;

    const scan = scanChanges(projDir);
    const changeCount = scan.active.length;
    // change도 docs도 없으면 카드 아님. docs 인식 프로젝트는 활성 change가 전부
    // archive돼도 카드 유지(기획 뷰 유일 진입로 — 도달성 회귀 방지, 2026-07-04).
    if (changeCount === 0 && !hasDocs(join(projDir, "docs"))) continue;

    const auditStatus: AuditStatus = readAuditStatus(projDir); // 저장된 audit.json 반영(실시간 산출 아님).
    out.push({
      name,
      displayName: labelMap?.get(name) ?? name,
      hasCharter: hasCharter(projDir),
      changeCount,
      auditStatus,
      archivedChangeCount: scan.archivedCount,
      // 카드 칩은 2개까지만 표시(그리드 레이아웃 유지). 진입로는 잘린 목록을 쓰면
      // 3번째 이후 change 가 도달 불가가 되므로 전체 목록을 따로 싣는다.
      activeChangeNames: scan.active.slice(0, 2),
      allActiveChangeNames: scan.active,
      ...(scan.lastMtimeMs > 0 ? { lastActivityAt: toKstDate(scan.lastMtimeMs) } : {}),
    });
  }
  return out;
}
