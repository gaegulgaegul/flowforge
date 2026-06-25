/**
 * dashboard-types 형태 계약 테스트 (task 1.1 RED → 1.2 GREEN).
 *
 * `@flowforge/shared`가 export하는 대시보드 타입 — `ProjectCard`/`CapabilityNode`/
 * `CapabilityChangeLink`/`AuditStatus` — 의 형태가 명세대로인지, 그리고
 * korean-display-labels 결정(연결 키는 영문 `key`/`name` 유지, 표시명만 한글
 * `displayName`/`koreanLabel`)이 타입에 박혀 있는지 런타임 객체로 단언한다.
 * 타입은 컴파일 타임 산물이라, 명세대로 객체를 구성할 수 있으면(=tsc 통과)
 * 형태 계약이 충족된 것이다. shared 워크스페이스엔 러너가 없어 server jest가
 * 패키지를 import해 단언한다(기존 server 테스트 컨벤션 재사용).
 */
import type {
  AuditStatus,
  ProjectCard,
  CapabilityNode,
  CapabilityChangeLink,
} from "@flowforge/shared";

describe("dashboard-types 형태 계약", () => {
  it("ProjectCard는 name·displayName·hasCharter·changeCount·auditStatus를 가진다", () => {
    const card: ProjectCard = {
      name: "flowforge",
      displayName: "플로우포지",
      hasCharter: true,
      changeCount: 3,
      auditStatus: "clean",
    };
    expect(card.name).toBe("flowforge");
    expect(card.displayName).toBe("플로우포지");
    expect(card.hasCharter).toBe(true);
    expect(card.changeCount).toBe(3);
    expect(card.auditStatus).toBe("clean");
  });

  it("AuditStatus는 unknown·clean·warn·fail 네 값만 허용한다", () => {
    const all: AuditStatus[] = ["unknown", "clean", "warn", "fail"];
    expect(all).toHaveLength(4);
  });

  it("CapabilityNode는 영문 key와 한글 koreanLabel을 분리하고 changeKeys[]를 가진다", () => {
    const node: CapabilityNode = {
      key: "project-card-grid",
      koreanLabel: "프로젝트 카드 그리드",
      changeKeys: ["hierarchical-project-dashboard"],
    };
    // 연결 키는 영문 슬러그(라우팅·디렉토리명 매칭용) — 한글로 치환 금지.
    expect(node.key).toBe("project-card-grid");
    expect(node.koreanLabel).toBe("프로젝트 카드 그리드");
    expect(node.changeKeys).toContain("hierarchical-project-dashboard");
  });

  it("CapabilityChangeLink는 capabilityKey·changeKey·linked를 가진다(미연결은 linked=false로 표면화)", () => {
    const linked: CapabilityChangeLink = {
      capabilityKey: "project-card-grid",
      changeKey: "hierarchical-project-dashboard",
      linked: true,
    };
    const unlinked: CapabilityChangeLink = {
      capabilityKey: "project-card-grid",
      changeKey: "some-orphan-change",
      linked: false,
    };
    expect(linked.linked).toBe(true);
    // 거짓연결 0 정책: 매칭 안 되면 drop이 아니라 linked=false로 분류.
    expect(unlinked.linked).toBe(false);
  });
});
