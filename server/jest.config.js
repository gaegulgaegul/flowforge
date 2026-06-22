/** ts-jest ESM 프리셋 (NodeNext + verbatimModuleSyntax 환경) */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    // NodeNext ESM은 상대 import에 .js 확장자를 요구 → 테스트 해석 시 매핑
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true, tsconfig: "tsconfig.json" }],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
};
