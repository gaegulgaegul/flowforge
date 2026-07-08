#!/usr/bin/env node
// 기획문서(docs/planning/features.md) ↔ openspec capability 연동 lint.
//
// 목적: 사용자 목표 "기획→spec→코드 연동"의 추적선이 끊긴 곳을 결정적으로 잡는다.
// audit(spec.md↔코드)과 같은 철학의 상류 게이트 — audit이 보지 못하는
// "기획 capability 키가 openspec으로 이어졌는가"를 검사한다.
//
// 규칙:
//   A(단절, error): features.md capability 상태가 완료/진행중인데 openspec(main specs/
//     또는 change specs/, archive 포함) 어디에도 같은 키가 없다 → 추적선 끊김.
//   B(상태 stale, warn): 상태가 "시작전"인데 그 키의 spec이 이미 openspec에 존재 →
//     기획문서 상태가 코드/spec 현실보다 뒤처짐(문서 갱신 필요).
//
// 사용: node scripts/lint-plan-spec-linkage.mjs [--json]
//   exit 0 = 위반 없음, exit 1 = error(A) 있음. warn(B)만이면 exit 0(로그만).
//
// features.md는 다른 세션이 편집할 수 있으므로 읽기 전용으로만 접근한다.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEATURES = join(ROOT, "docs", "planning", "features.md");
const jsonOut = process.argv.includes("--json");

/** features.md에서 {key, status} 목록 파싱. capability 주석 + 바로 다음 줄 (상태: ...). */
function parsePlanCapabilities(text) {
  const re = /<!--\s*capability:\s*([a-z0-9-]+)\s*-->\s*\n\(([^)]*)\)/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const key = m[1];
    const statusMatch = /상태:\s*([^,)]+)/.exec(m[2]);
    out.push({ key, status: statusMatch ? statusMatch[1].trim() : "미상" });
  }
  return out;
}

/** openspec에 존재하는 모든 capability 키 집합(main specs/ + 모든 change specs/, archive 포함). */
function collectOpenspecKeys() {
  const keys = new Set();
  const mainSpecs = join(ROOT, "openspec", "specs");
  if (existsSync(mainSpecs)) {
    for (const name of readdirSync(mainSpecs)) {
      if (existsSync(join(mainSpecs, name, "spec.md"))) keys.add(name);
    }
  }
  const changesDir = join(ROOT, "openspec", "changes");
  if (existsSync(changesDir)) walkChangeSpecs(changesDir, keys);
  return keys;
}

/** changes/(archive 포함) 하위에서 specs/<키>/spec.md 를 재귀 수집. */
function walkChangeSpecs(dir, keys) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const full = join(dir, e.name);
    if (e.name === "specs") {
      for (const cap of readdirSync(full, { withFileTypes: true })) {
        if (cap.isDirectory() && existsSync(join(full, cap.name, "spec.md"))) keys.add(cap.name);
      }
    } else {
      walkChangeSpecs(full, keys);
    }
  }
}

function main() {
  if (!existsSync(FEATURES)) {
    console.error(`기획문서 없음: ${FEATURES}`);
    process.exit(1);
  }
  const plan = parsePlanCapabilities(readFileSync(FEATURES, "utf-8"));
  const specKeys = collectOpenspecKeys();

  const errors = []; // A: 단절
  const warns = []; // B: 상태 stale
  const IMPLEMENTED = new Set(["완료", "진행중"]);

  for (const { key, status } of plan) {
    const inSpec = specKeys.has(key);
    if (IMPLEMENTED.has(status) && !inSpec) {
      errors.push({ key, status, rule: "A", msg: `상태=${status}인데 openspec에 capability '${key}' 없음(추적선 단절)` });
    } else if (status === "시작전" && inSpec) {
      warns.push({ key, status, rule: "B", msg: `상태=시작전인데 openspec에 '${key}' 이미 존재(기획문서 상태 stale)` });
    }
  }

  if (jsonOut) {
    console.log(JSON.stringify({ planCount: plan.length, specKeyCount: specKeys.size, errors, warns }, null, 2));
  } else {
    console.log(`기획 capability ${plan.length}개, openspec 키 ${specKeys.size}개 대조`);
    if (errors.length === 0 && warns.length === 0) {
      console.log("✅ 연동 위반 없음");
    }
    for (const e of errors) console.error(`❌ [A/단절] ${e.msg}`);
    for (const w of warns) console.warn(`⚠️  [B/stale] ${w.msg}`);
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
