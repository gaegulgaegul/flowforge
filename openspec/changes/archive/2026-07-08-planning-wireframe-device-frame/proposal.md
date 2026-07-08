# planning-wireframe-device-frame

## Why

앞선 시도(`planning-wireframe-elements`, 폐기)는 manyfast 와이어를 실물 확인 없이 flowforge 현행 렌더(박스 세로 스택)에 억지로 맞춰, 요소를 "세로 이름표 목록"으로 만들었다 — 세 가지가 근본적으로 틀렸다(사용자 지적·docs.manyfast.io/plan/wireframe 실물 확인). manyfast 와이어는 **디바이스 프레임 안에 실제 UI가 배치된 로우피델리티 목업**(화면 축소판)이고, **AI 생성**이며, **클릭 프로토타입**이다. 사용자가 이 방향을 목업으로 확정했다(https://wireframe-mockup-deploy.vercel.app). 목업을 단일진실원으로 재설계한다.

## What Changes

이 change는 **렌더러 재작성(구조)**에 집중한다. AI 생성·위저드 승인은 후속 change로 분리(범위 관리).

- **폐기**: `planning-wireframe-elements`의 element 세로박스 접근(screenRegistry `<!-- element: -->` 파싱·planningWireframeBuilder·ScreenElement·기존 WireframePanel 재사용). 커밋은 push 전이라 재설계가 갈아엎는다.
- **새 와이어 데이터 모델**: 화면을 "요소 박스 배열"이 아니라 **레이아웃(디바이스+영역별 배치)**으로 표현. `WireLayout{device: desktop|mobile, regions: {topbar?, sidebar?, bottombar?, body}}` 각 region이 요소를 담고, body는 배치(그리드/스택/트리) 힌트를 가짐.
- **새 렌더러 `WireframeDeviceFrame`**: 데스크탑=브라우저 크롬+상단 메뉴+사이드+본문, 모바일=폰 프레임+상단 타이틀+본문+하단 메뉴바. 회색조 로우피델리티, 요소를 화면처럼 배치. 기존 `WireframePanel`(박스 스택)은 이 change 범위에선 **병존**(change 경로 와이어는 그대로, planning 와이어만 새 렌더러) — 나중에 통합.
- **원천 = 100% AI 생성(사람 저작 0)**: 명섭 확정 — 사람이 레이아웃을 손으로 쓰는 경로는 없다. 확인·피드백만 사람, 반영도 AI. **이 렌더러 change의 실증은 고정 픽스처 레이아웃 데이터**(목업 화면 3개를 WireScreen2 JSON으로)로 렌더가 목업과 맞는지만 확인. AI 생성은 후속 change.
- **3단계 분리**: ①렌더러(이 change) ②AI 레이아웃 생성 ③위저드 승인+피드백 재생성. 각각 별도 change.
- **클릭 프로토타입**(이 change 기본): 요소 클릭 → 화면 이동(goto). 빈 곳 클릭 → 강조 등 폴리시는 후속.

## Capabilities

### New Capabilities

- `planning-wireframe-device`: 디바이스 프레임 안에 화면 레이아웃을 배치 렌더하는 와이어 능력(데이터 모델·빌더·렌더러)

### Modified Capabilities

(없음 — planning-wireframe-elements는 archive 전 폐기라 main spec 미등재, 새 capability로 대체)

## Impact

- shared: `WireLayout`·`WireRegion`·`WireElement`(배치 정보 포함) 신규 타입. 기존 `Wireframe`/`WireBox`는 change 경로용으로 유지(비파괴).
- server: 새 `planningWireframeLayoutBuilder`(레이아웃 파싱), planning-wireframe 라우트가 새 모델 반환
- web: 새 `WireframeDeviceFrame` 컴포넌트(데스크탑/모바일 프레임+배치), 기획 와이어 탭이 이걸 사용
- 픽스처: `docs/planning/wireframe/*.json`(또는 서버 내장 샘플) — 목업 화면 3개를 WireScreen2 데이터로(렌더 실증용, AI 생성물이 나중에 이 자리)
- 정리: 폐기된 planning-wireframe-elements 커밋들의 element 코드(screenRegistry element 파싱·ScreenElement·planningWireframeBuilder)를 이 change에서 제거
- Non-Goal: **사람 레이아웃 저작 문법(존재 안 함 — 원천은 AI)** / AI 레이아웃 생성(후속) / 위저드 승인·피드백 재생성(후속) / change 경로 wireframeBuilder 통합(별도)
