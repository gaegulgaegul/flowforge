/**
 * featureTreeBuilder 단위 테스트 — docs/planning/features.md → FeatureTree(3단 트리).
 * 임시 DOCS 디렉토리에 픽스처를 만들어 파싱 결과를 검증한다(읽기전용).
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocsPlanningFeatures } from "../featureTreeBuilder.js";

/** <root>/docs/planning/features.md 픽스처를 만들고 docsDir(<root>/docs)를 반환. */
function makeFeatures(content: string): { docsDir: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "feat-"));
  const planningDir = join(root, "docs", "planning");
  mkdirSync(planningDir, { recursive: true });
  writeFileSync(join(planningDir, "features.md"), content);
  return { docsDir: join(root, "docs"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const FEATURES = [
  "# 기능명세서",
  "",
  "## 사진 업로드",
  "<!-- capability: photo-upload -->",
  "(중요도: 높음, 상태: 진행중)",
  "",
  "### 단일 업로드",
  "(중요도: 중간, 상태: 시작전)",
  "",
  "#### 파일 선택",
  "(중요도: 낮음, 상태: 시작전)",
  "",
  "#### 업로드 진행률 표시",
  "",
  "### 다중 업로드",
  "(중요도: 높음, 상태: 시작전)",
  "",
  "## 앨범 관리",
  "<!-- capability: album -->",
  "(중요도: 중간, 상태: 완료)",
  "",
  "### 앨범 생성",
].join("\n");

describe("featureTreeBuilder", () => {
  it("features.md를 3단 트리(요구사항→기능→상세기능)로 파싱한다", () => {
    const { docsDir, cleanup } = makeFeatures(FEATURES);
    try {
      const tree = buildDocsPlanningFeatures(docsDir);
      expect(tree).not.toBeNull();
      const reqs = tree!.root.children;
      // 요구사항 2개
      expect(reqs.map((r) => r.label)).toEqual(["사진 업로드", "앨범 관리"]);
      expect(reqs.every((r) => r.kind === "requirement")).toBe(true);
      // 첫 요구사항의 기능 2개
      const upload = reqs[0]!;
      expect(upload.children.map((f) => f.label)).toEqual(["단일 업로드", "다중 업로드"]);
      expect(upload.children.every((f) => f.kind === "feature")).toBe(true);
      // 첫 기능의 상세기능 2개
      const single = upload.children[0]!;
      expect(single.children.map((d) => d.label)).toEqual(["파일 선택", "업로드 진행률 표시"]);
      expect(single.children.every((d) => d.kind === "detail")).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("요구사항 노드에 capability 키를 파싱한다(기능/상세기능은 빈 문자열)", () => {
    const { docsDir, cleanup } = makeFeatures(FEATURES);
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      const reqs = tree.root.children;
      expect(reqs[0]!.capability).toBe("photo-upload");
      expect(reqs[1]!.capability).toBe("album");
      // 기능·상세기능은 capability 없음
      expect(reqs[0]!.children[0]!.capability).toBe("");
      expect(reqs[0]!.children[0]!.children[0]!.capability).toBe("");
    } finally {
      cleanup();
    }
  });

  it("노드 속성(중요도·상태)을 파싱한다", () => {
    const { docsDir, cleanup } = makeFeatures(FEATURES);
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      const upload = tree.root.children[0]!;
      expect(upload.priority).toBe("높음");
      expect(upload.status).toBe("진행중");
      const single = upload.children[0]!;
      expect(single.priority).toBe("중간");
      expect(single.status).toBe("시작전");
    } finally {
      cleanup();
    }
  });

  it("속성 표기가 없는 노드는 priority/status가 빈 문자열", () => {
    const { docsDir, cleanup } = makeFeatures(FEATURES);
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      // "업로드 진행률 표시"는 속성 줄 없음
      const detail = tree.root.children[0]!.children[0]!.children[1]!;
      expect(detail.label).toBe("업로드 진행률 표시");
      expect(detail.priority).toBe("");
      expect(detail.status).toBe("");
    } finally {
      cleanup();
    }
  });

  it("노드마다 안정적인 고유 id를 부여한다", () => {
    const { docsDir, cleanup } = makeFeatures(FEATURES);
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      const ids: string[] = [];
      const walk = (n: { id: string; children: readonly { id: string; children: readonly unknown[] }[] }) => {
        ids.push(n.id);
        n.children.forEach((c) => walk(c as never));
      };
      walk(tree.root as never);
      // 모든 id 고유
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      cleanup();
    }
  });

  it("본문 산문 중간의 (중요도:…, 상태:…) 패턴은 속성으로 오매칭하지 않는다", () => {
    const md = [
      "# 기능명세서",
      "## 결제",
      "<!-- capability: payment -->",
      "이 기능은 (중요도: 높음, 상태: 진행중) 수준의 본문 산문이다.",
    ].join("\n");
    const { docsDir, cleanup } = makeFeatures(md);
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      const req = tree.root.children[0]!;
      // 속성 줄이 아닌 본문에 들어간 패턴 → priority/status는 빈 문자열이어야 한다.
      expect(req.priority).toBe("");
      expect(req.status).toBe("");
      // capability 주석은 줄 단독이므로 정상 파싱.
      expect(req.capability).toBe("payment");
    } finally {
      cleanup();
    }
  });

  it("features.md가 없으면 null", () => {
    const root = mkdtempSync(join(tmpdir(), "feat-none-"));
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      expect(buildDocsPlanningFeatures(join(root, "docs"))).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("요구사항이 없는(빈) features.md는 빈 children 루트", () => {
    const { docsDir, cleanup } = makeFeatures("# 기능명세서\n\n초안.");
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      expect(tree.root.children).toEqual([]);
    } finally {
      cleanup();
    }
  });

  describe("경량 아이템 메모(lightweight-item-memo)", () => {
    it("`<!-- memo: ... -->` 주석을 해당 노드 memo 필드로 파싱한다(모든 kind)", () => {
      const md = [
        "# 기능명세서",
        "## 사진 업로드",
        "<!-- capability: photo-upload -->",
        "(중요도: 높음, 상태: 진행중)",
        "<!-- memo: 요구사항 레벨 메모 -->",
        "### 단일 업로드",
        "<!-- memo: 기능 레벨 TODO -->",
        "#### 파일 선택",
        "<!-- memo: 상세기능 자문 메모 -->",
      ].join("\n");
      const { docsDir, cleanup } = makeFeatures(md);
      try {
        const tree = buildDocsPlanningFeatures(docsDir)!;
        const req = tree.root.children[0]!;
        expect(req.memo).toBe("요구사항 레벨 메모");
        expect(req.children[0]!.memo).toBe("기능 레벨 TODO");
        expect(req.children[0]!.children[0]!.memo).toBe("상세기능 자문 메모");
      } finally {
        cleanup();
      }
    });

    it("메모가 없는 노드는 memo 필드가 부재한다(비파괴 옵셔널)", () => {
      const { docsDir, cleanup } = makeFeatures(FEATURES);
      try {
        const tree = buildDocsPlanningFeatures(docsDir)!;
        const req = tree.root.children[0]!;
        // 기존 픽스처에는 memo가 전혀 없으므로 필드 자체가 없어야 한다.
        expect("memo" in req).toBe(false);
        expect(req.memo).toBeUndefined();
      } finally {
        cleanup();
      }
    });

    it("memo 주석은 capability/속성 파싱과 공존하며 서로를 삼키지 않는다", () => {
      const md = [
        "# 기능명세서",
        "## 결제",
        "<!-- capability: payment -->",
        "(중요도: 높음, 상태: 진행중)",
        "<!-- memo: 결제 실패 재시도 정책 미정 -->",
      ].join("\n");
      const { docsDir, cleanup } = makeFeatures(md);
      try {
        const req = buildDocsPlanningFeatures(docsDir)!.root.children[0]!;
        expect(req.capability).toBe("payment"); // capability 온전
        expect(req.priority).toBe("높음"); // 속성 온전
        expect(req.status).toBe("진행중");
        expect(req.memo).toBe("결제 실패 재시도 정책 미정"); // memo 추가
      } finally {
        cleanup();
      }
    });

    it("빈 메모(`<!-- memo:  -->`)는 무시한다(빈 필드 노이즈 방지)", () => {
      const md = ["# 기능명세서", "## 검색", "<!-- capability: search -->", "<!-- memo:  -->"].join(
        "\n",
      );
      const { docsDir, cleanup } = makeFeatures(md);
      try {
        const req = buildDocsPlanningFeatures(docsDir)!.root.children[0]!;
        expect("memo" in req).toBe(false);
      } finally {
        cleanup();
      }
    });
  });

  describe("동작 시나리오 WHEN/THEN 저작(planning-when-then-authoring)", () => {
    it("`<!-- when: ... -->` `<!-- then: ... -->` 주석을 해당 노드 when/then 필드로 파싱한다(양쪽·모든 kind)", () => {
      const md = [
        "# 기능명세서",
        "## 사진 업로드",
        "<!-- capability: photo-upload -->",
        "(중요도: 높음, 상태: 진행중)",
        "<!-- when: 업로드 버튼 클릭 -->",
        "<!-- then: 파일 선택 다이얼로그 표시 -->",
        "### 단일 업로드",
        "<!-- when: 파일 1개 드롭 -->",
        "<!-- then: 즉시 업로드 시작 -->",
        "#### 파일 선택",
        "<!-- when: 탭 클릭 -->",
        "<!-- then: 그 프로젝트 5종 뷰 로드 -->",
      ].join("\n");
      const { docsDir, cleanup } = makeFeatures(md);
      try {
        const tree = buildDocsPlanningFeatures(docsDir)!;
        const req = tree.root.children[0]!;
        expect(req.when).toBe("업로드 버튼 클릭");
        expect(req.then).toBe("파일 선택 다이얼로그 표시");
        expect(req.children[0]!.when).toBe("파일 1개 드롭");
        expect(req.children[0]!.then).toBe("즉시 업로드 시작");
        expect(req.children[0]!.children[0]!.when).toBe("탭 클릭");
        expect(req.children[0]!.children[0]!.then).toBe("그 프로젝트 5종 뷰 로드");
      } finally {
        cleanup();
      }
    });

    it("WHEN만 있는 노드는 when만 싣고 then 필드는 부재한다", () => {
      const md = ["# 기능명세서", "## 검색", "<!-- capability: search -->", "<!-- when: 검색어 입력 -->"].join("\n");
      const { docsDir, cleanup } = makeFeatures(md);
      try {
        const req = buildDocsPlanningFeatures(docsDir)!.root.children[0]!;
        expect(req.when).toBe("검색어 입력");
        expect("then" in req).toBe(false);
        expect(req.then).toBeUndefined();
      } finally {
        cleanup();
      }
    });

    it("THEN만 있는 노드는 then만 싣고 when 필드는 부재한다", () => {
      const md = ["# 기능명세서", "## 검색", "<!-- capability: search -->", "<!-- then: 결과 목록 갱신 -->"].join("\n");
      const { docsDir, cleanup } = makeFeatures(md);
      try {
        const req = buildDocsPlanningFeatures(docsDir)!.root.children[0]!;
        expect(req.then).toBe("결과 목록 갱신");
        expect("when" in req).toBe(false);
        expect(req.when).toBeUndefined();
      } finally {
        cleanup();
      }
    });

    it("when/then이 없는 노드는 필드 자체가 부재한다(비파괴 옵셔널·기존 노드 무영향)", () => {
      const { docsDir, cleanup } = makeFeatures(FEATURES);
      try {
        const tree = buildDocsPlanningFeatures(docsDir)!;
        const req = tree.root.children[0]!;
        expect("when" in req).toBe(false);
        expect("then" in req).toBe(false);
        // 하위 노드도 동일하게 무영향.
        expect("when" in req.children[0]!).toBe(false);
        expect("then" in req.children[0]!.children[0]!).toBe(false);
      } finally {
        cleanup();
      }
    });

    it("when/then 주석은 capability/속성/memo 파싱과 공존하며 서로를 삼키지 않는다", () => {
      const md = [
        "# 기능명세서",
        "## 결제",
        "<!-- capability: payment -->",
        "(중요도: 높음, 상태: 진행중)",
        "<!-- memo: 결제 실패 재시도 정책 미정 -->",
        "<!-- when: 결제 버튼 클릭 -->",
        "<!-- then: PG 결제창 호출 -->",
      ].join("\n");
      const { docsDir, cleanup } = makeFeatures(md);
      try {
        const req = buildDocsPlanningFeatures(docsDir)!.root.children[0]!;
        expect(req.capability).toBe("payment");
        expect(req.priority).toBe("높음");
        expect(req.status).toBe("진행중");
        expect(req.memo).toBe("결제 실패 재시도 정책 미정");
        expect(req.when).toBe("결제 버튼 클릭");
        expect(req.then).toBe("PG 결제창 호출");
      } finally {
        cleanup();
      }
    });

    it("빈 when/then(`<!-- when:  -->`)은 무시한다(빈 필드 노이즈 방지)", () => {
      const md = [
        "# 기능명세서",
        "## 검색",
        "<!-- capability: search -->",
        "<!-- when:  -->",
        "<!-- then:  -->",
      ].join("\n");
      const { docsDir, cleanup } = makeFeatures(md);
      try {
        const req = buildDocsPlanningFeatures(docsDir)!.root.children[0]!;
        expect("when" in req).toBe(false);
        expect("then" in req).toBe(false);
      } finally {
        cleanup();
      }
    });
  });

  describe("생성일(created)", () => {
    it("`<!-- created: -->` 주석을 노드 createdAt으로 파싱한다(원문 그대로)", () => {
      const md = [
        "# 기능명세서",
        "",
        "## 사진 업로드",
        "<!-- capability: photo-upload -->",
        "<!-- created: 2026-07-08 -->",
        "(중요도: 높음, 상태: 진행중)",
      ].join("\n");
      const { docsDir, cleanup } = makeFeatures(md);
      try {
        const req = buildDocsPlanningFeatures(docsDir)!.root.children[0]!;
        expect(req.createdAt).toBe("2026-07-08");
      } finally {
        cleanup();
      }
    });

    it("created 주석이 없는 노드는 features.md mtime(KST 일자)으로 폴백된다", () => {
      const md = ["# 기능명세서", "", "## 사진 업로드", "(중요도: 중간, 상태: 시작전)"].join("\n");
      const { docsDir, cleanup } = makeFeatures(md);
      try {
        const req = buildDocsPlanningFeatures(docsDir)!.root.children[0]!;
        // 방금 쓴 파일이라 폴백 날짜가 채워지고 YYYY-MM-DD 형식이어야 한다(지어냄이 아니라 mtime 기반).
        expect(req.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } finally {
        cleanup();
      }
    });
  });
});
