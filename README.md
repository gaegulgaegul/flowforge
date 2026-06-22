# manyfast-local

openspec의 `spec.md`(WHEN/THEN 시나리오)를 **유저플로우 그래프**로 시각화하고 웹에서 직접 드래그·편집하는 개인용 도구.

manyfast.io(AI 기획 SaaS)의 핵심 가치인 "기획을 시각화 산출물로 만들고 웹에서 편집"을 openspec 위에 자체 구축한다. 인증·결제·멀티테넌시·크레딧·챗 UI는 제외(개인 단일 사용자용).

## 구조 (npm workspaces 모노레포)

```
manyfast-local/
├─ shared/   공용 타입 (@manyfast/shared) — GraphNode/GraphEdge/SpecGraph 등
├─ server/   Node + Express (TS strict, ESM) — spec.md 파싱 → 그래프 JSON 서빙
├─ web/      Vite + React + ReactFlow (예정) — 그래프 캔버스 드래그·편집
└─ openspec/ 도그푸딩 — 이 프로젝트 자체를 openspec change로 관리
```

데이터는 **파일 기반**: `spec.md`(SSOT, 읽기) + `<change>/viz/graph-overlay.json`(레이아웃 오버레이, 쓰기). Postgres 안 씀.

## 설계 결정

| 항목 | 결정 |
|---|---|
| 편집 범위 | manyfast식 SSOT — spec.md=진실, 그래프는 파생 + 레이아웃 오버레이만 영속 |
| 파싱 | `generate_prototype.py`의 parse/flow 로직을 TS로 포팅 (골든 테스트로 동치 박제) |
| 동기화 | spec → 그래프 단방향 + 레이아웃 머지 (충돌 원천 차단) |
| 시각화 | ReactFlow 단일 (드래그 편집 필요, Mermaid 미채택) |

## 개발

```bash
npm install              # 워크스페이스 전체 설치
npm run build            # shared → server → web 순 빌드
npm test                 # server 테스트 (jest ESM)
npm run dev:server       # server 개발 모드
```

요구: Node >= 22. TS strict + `noUncheckedIndexedAccess` + ESM(NodeNext).

## 로드맵

- **Phase 0** — 스캐폴딩 + openspec init ✅
- **Phase 1** — 파싱 포팅(`specParser.ts`/`flowBinder.ts`) + 골든 테스트
- **Phase 2** — Express API + ReactFlow 캔버스
- **Phase 3** — 배포 + 도메인 (비가역, 확인 게이트)
- **Phase 4** — IA 트리 / 와이어프레임 / PRD (후속 change)

상세 계획: `~/.claude/plans/temporal-swimming-dahl.md`
