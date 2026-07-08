#!/usr/bin/env bash
# planning-audit-trigger 착수 조건 확인.
# 도로로 wireframe 계열 change가 활성에 하나도 없으면 READY, 있으면 BLOCKED.
# 사용자 결정(2026-07-08): ⑦은 wireframe 후속 2단계 종료 후 착수(App.tsx·docs.ts 충돌 회피).
set -euo pipefail
cd "$(dirname "$0")/../../.." # flowforge repo 루트

CHANGES_DIR="openspec/changes"
# 활성(archive 제외) change 중 wireframe 계열 탐지.
active_wire=$(ls -d "$CHANGES_DIR"/*/ 2>/dev/null | grep -v '/archive/' | xargs -n1 basename 2>/dev/null | grep -i 'wireframe' || true)

if [ -z "$active_wire" ]; then
  echo "✅ READY — 활성 wireframe 계열 change 0개. ⑦ Phase 2·3 착수 가능."
  echo "   (착수 전: worker.py=RCE 코어 승인 게이트, .env 토큰 주입 확인 — .blocked-on.md 참조)"
  exit 0
else
  echo "⛔ BLOCKED — 아래 wireframe 계열 change가 아직 활성(archive 전):"
  echo "$active_wire" | sed 's/^/   - /'
  echo "   이들이 전부 archive되면 READY. 도로로 3단계(렌더러→AI생성→위저드승인) 완료 대기."
  exit 1
fi
