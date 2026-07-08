# planning-wireframe-device-frame — design

## Context

폐기된 `planning-wireframe-elements`는 요소를 세로 박스 목록으로 렌더(WireBox 스택 재사용) — manyfast 와이어의 "디바이스 프레임 안 실제 배치"와 근본적으로 달랐다(사용자 지적). 확정 목업(https://wireframe-mockup-deploy.vercel.app, /home/gaegul/wireframe-mockup-deploy)이 단일진실원: 데스크탑=브라우저 크롬+상단 메뉴+사이드+본문 그리드, 모바일=폰 프레임+상단 타이틀+본문+하단 메뉴바, 회색조 로우피델리티, 클릭 이동.

### manyfast 대조 (상시 규칙)

manyfast 와이어(docs.manyfast.io/plan/wireframe 실물): ①디바이스(데스크탑/모바일) 선택 → 그 프레임 안에 실제 UI 배치 ②AI가 기능명세+유저플로우 참고해 생성(사람 요소 저작 X, 재생성 방식) ③클릭 프로토타입(요소→화면 이동, 빈 곳 클릭→파란 강조) ④유저플로우 1개당 와이어 1개, 페이지 노드 기준 생성. 우리 목업이 ①③은 반영, ②는 후속 change(수동 저작으로 먼저 실증), ④는 화면목록 기준(유저플로우 화면과 동일 화면 id 공유).

## Goals / Non-Goals

**Goals (이 change):**

- 디바이스 프레임(데스크탑/모바일) 안에 화면 레이아웃을 배치 렌더하는 새 데이터 모델+빌더+렌더러
- 회색조 로우피델리티, 목업과 시각 일치
- 화면목록 기준 화면 생성(유저플로우 화면 id 공유 — 뷰 정합)
- 수동 저작으로 1~2화면 실증(원천 실재)

**Non-Goals (후속 change):**

- AI 레이아웃 생성 + 위저드 승인(위저드 파이프 재사용 — 별도 change)
- 클릭 프로토타입 완성(이 change는 기본 이동만, 파란 강조 등 폴리시는 후속)
- change 경로 wireframeBuilder 통합(planning만 새 렌더러, change는 기존 유지 — 병존)

## Decisions (2026-07-08 명섭 확정)

- **D-1 데이터 모델 = 영역+요소 배치.** `WireScreen2{id, title, device, regions}`. regions = `{topbar?: WireElement[], sidebar?: WireElement[], bottombar?: WireElement[], body: WireBody}`. WireBody = `{layout: 'grid'|'stack'|'tree'|'form', elements: WireElement[]}`. WireElement = `{kind, label, goto?, span?}`(kind 확장: nav-item·card·input·button·text·tab·placeholder 등). 목업 구조를 그대로 타입화.
- **✅D-2 저작 문법 = 없음(사람 저작 0).** 명섭 확정: **사람이 레이아웃을 손으로 쓰는 경로는 어디에도 없다.** 원천은 100% AI 생성이고, 확인·피드백만 사람이 하며 그 반영도 AI가 한다(manyfast 그대로). → 이 렌더러 change의 실증은 저작 문법이 아니라 **고정 픽스처 레이아웃 데이터**(검증용 샘플 JSON — 목업 화면 3개를 데이터화)로 한다. features.md에 레이아웃 문법 추가 없음.
- **✅D-3 이 change 범위 = 렌더러+데이터 모델만.** 명섭 확정 1-가. 3단계로 분리: ①**렌더러(이 change)** — 디바이스 프레임+배치 렌더, 실증=픽스처 데이터, 목업 픽셀 대조 ②**AI 레이아웃 생성** — 기능명세+유저플로우+화면목록→레이아웃 데이터 생성 파이프(후속) ③**위저드 승인+피드백 재생성** — 생성 결과 사람 확인, 피드백→AI 재생성(위저드 파이프 재사용, 후속). 사람이 데이터를 직접 손대는 경로는 3단계 어디에도 없음.
- **D-4 새 렌더러 병존.** change 경로 와이어(WireframePanel)는 그대로, planning 와이어만 WireframeDeviceFrame. golden·change 와이어 무저촉. 나중에 통합 여부 판단.
- **D-5 화면 id 공유.** 화면목록 `<!-- screen: id -->`를 유저플로우·IA·와이어가 공유(이미 있는 규약). 와이어 화면 = 화면목록 화면(유저플로우 화면과 같은 id). 단 D-2대로 레이아웃 데이터 자체는 AI가 채운다(화면 id만 공유, 레이아웃은 생성물).
- **D-6 렌더 데이터 원천(이 change)**: planning-wireframe 라우트가 레이아웃 데이터를 어디서 읽는가 = 이 change에선 **픽스처/샘플 파일**(`docs/planning/wireframe/<screen>.json` 또는 서버 내장 샘플)에서 읽어 렌더 실증. AI 생성물이 이 자리에 들어오는 건 ②단계. 저장 형식은 WireScreen2 JSON.

## Risks / Trade-offs

- 새 렌더러는 목업 충실도가 관건 — verify에서 목업과 실픽셀 대조 필수(또 방향 틀리지 않게).
- 데이터 모델이 무거워짐(영역·배치) — 수동 저작이 번거로우니 AI 생성이 본류(D-3), 수동은 실증 최소.
- 기존 WireframePanel과 병존 = 코드 2벌 일시 — 통합은 후속(범위 관리).

## 화면 구성 / UI

- 단일진실원 = 확정 목업(wireframe-mockup-deploy) + 이 change prototype. WireframeDeviceFrame이 목업의 데스크탑/모바일 프레임을 React로 번역. 회색조 로우피델리티 유지.
