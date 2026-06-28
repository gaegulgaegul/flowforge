# 기능명세서: flowforge 기획 단계(openspec-plan)

> openspec-plan 2단계 도그푸딩 — flowforge가 자기 자신의 기획 단계 기능을 features.md로 기술한다.
> 각 요구사항의 capability 키는 실제 openspec capability(docs/spec.md)와 일치시킨다(매핑 출발점).

## 기획 산출물 생성
<!-- capability: planning-authoring -->
(중요도: 높음, 상태: 진행중)

openspec-plan 스킬이 docs/planning/에 manyfast식 기획 산출물을 순차 게이트로 생성한다.

### PRD 생성
(중요도: 높음, 상태: 완료)

#### 5섹션 PRD 작성
(중요도: 높음, 상태: 완료)

#### 빈 섹션 표면화
(중요도: 중간, 상태: 완료)

### 기능명세서 생성
(중요도: 높음, 상태: 진행중)

#### 3단 트리 도출
(중요도: 높음, 상태: 진행중)

#### capability 키 부여
(중요도: 높음, 상태: 진행중)

#### 중요도·상태 속성
(중요도: 중간, 상태: 진행중)

## 기획 PRD 뷰
<!-- capability: planning-prd-view -->
(중요도: 높음, 상태: 완료)

flowforge가 docs/planning/prd.md를 읽어 PrdPanel로 5섹션을 렌더한다.

### PRD 5섹션 렌더
(중요도: 높음, 상태: 완료)

#### planning-prd 라우트 조회
(중요도: 높음, 상태: 완료)

## 기획 기능명세 뷰
<!-- capability: planning-features-view -->
(중요도: 높음, 상태: 진행중)

flowforge가 docs/planning/features.md를 읽어 전용 FeatureTree로 3단 트리를 렌더한다(change spec-tree와 분리).

### 기능명세 트리 렌더
(중요도: 높음, 상태: 진행중)

#### planning-features 라우트 조회
(중요도: 높음, 상태: 완료)

#### priority·status·capability 시각화
(중요도: 중간, 상태: 진행중)

## planning-only 프로젝트 인식
<!-- capability: planning-only-recognition -->
(중요도: 중간, 상태: 완료)

charter 문서 없이 docs/planning/prd.md만 있어도 flowforge가 docs 프로젝트로 인식한다.

### hasDocs 인식 확장
(중요도: 중간, 상태: 완료)
