# Flowforge — openspec spec.md → 유저플로우 그래프 웹 편집 (단일 컨테이너: server + web/dist 정적 서빙)
# 모노레포(npm workspaces: shared + server + web) 전체 빌드

# --- Build ---
FROM node:22-alpine AS builder
WORKDIR /app
# 워크스페이스 매니페스트 먼저 복사(레이어 캐시 최대화)
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci
# 소스 복사 후 shared → server → web 순 빌드(루트 build 스크립트가 순서 보장)
COPY shared/ ./shared/
COPY server/ ./server/
COPY web/ ./web/
RUN npm run build

# --- Production ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# 매니페스트 + 프로덕션 의존만 설치(devDeps 제외 → 이미지 경량)
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci --omit=dev
# 빌드 산출물 복사: server/dist(실행) + shared/dist(런타임 import) + web/dist(정적 서빙)
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/web/dist ./web/dist

EXPOSE 8812
# server/src/index.ts는 web/dist를 ../../web/dist 상대경로로 찾음 → WORKDIR/server 기준 실행
WORKDIR /app/server
CMD ["node", "dist/index.js"]
