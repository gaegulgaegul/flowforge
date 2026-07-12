import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/** web 단위/컴포넌트 테스트 설정(flowforge-screen-crosslink).
 * jsdom 환경 + jest-dom 매처. 순수 함수 테스트도 jsdom에서 그대로 동작한다. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
