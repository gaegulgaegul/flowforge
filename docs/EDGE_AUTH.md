# flowforge 쓰기 인증 (public-surface-hardening)

flowforge의 쓰기 라우트(승인 apply 3종 + layout 저장 2종)는 2중 방어로 보호한다:

1. **엣지 (CF Zero Trust Access)** — flowforge.gaegul.house 자체를 CF Access 뒤에 둔다. 무인증 원격 접근을 CF 로그인 게이트로 봉인.
2. **origin 앱레벨 (`requireWriteAuth`)** — cloudflared가 붙이는 `Cf-Access-Jwt-Assertion`을 서버가 RS256 서명·aud·iss·exp까지 직접 검증한다. CF를 우회한 origin 직격(localhost:8812) 위조 쓰기를 차단.

> ⚠️ **env 미설정 = 현행 무인증 공개.** 아래 env를 주입하지 않으면 서버는 개발 모드로 동작하며 쓰기 게이트가 열려 있다(기동 로그에 `write auth disabled — dev mode`). **CF 대시보드 등록과 env 주입은 반드시 한 세트로** 수행한다.

## 코드가 소비하는 env (4개)

| env | 용도 | 예시 |
|-----|------|------|
| `FLOWFORGE_CF_ACCESS_AUD` | 이 앱의 Application Audience(AUD) 태그 | CF 대시보드가 발급 |
| `FLOWFORGE_CF_ACCESS_TEAM_DOMAIN` | 팀 도메인(JWKS·issuer 출처) | `gaegulzip.cloudflareaccess.com` |
| `FLOWFORGE_WRITE_TOKEN` | JWT 없이 쓰는 경로용 Bearer 토큰(로컬 직결·스크립트) | 임의 난수, 커밋 금지 |
| `FLOWFORGE_CORS_ORIGIN` | CORS 허용 오리진(콤마 구분). 미설정=CORS 헤더 없음 | `https://flowforge.gaegul.house` |

AUD·TEAM_DOMAIN 둘 다 있어야 CF Access 검증이 활성(`cfAccessConfig().enabled`). 실값은 **호스트 `.env`(git-ignored)에** 두고 `docker-compose.yml`은 `${...}` 참조만 한다(30-security).

## 등록·주입 절차

1. **CF Zero Trust → Access → Applications → Add an application** (Self-hosted)
   - Application domain: `flowforge.gaegul.house`
   - Policy: 허용할 이메일/IdP 지정(예: 본인 이메일 Allow)
   - 저장 후 **Application Audience (AUD) 태그**를 복사 → `FLOWFORGE_CF_ACCESS_AUD`
2. **팀 도메인 확인**: Zero Trust 대시보드 좌상단 팀 이름 → `<team>.cloudflareaccess.com` → `FLOWFORGE_CF_ACCESS_TEAM_DOMAIN`
3. **호스트 `.env` 작성** (flowforge 디렉토리, git-ignored):
   ```
   FLOWFORGE_CF_ACCESS_AUD=<AUD 태그>
   FLOWFORGE_CF_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com
   FLOWFORGE_CORS_ORIGIN=https://flowforge.gaegul.house
   # FLOWFORGE_WRITE_TOKEN=<로컬/스크립트 직결이 필요할 때만>
   ```
4. **재배포**: `docker compose up -d --build` (env가 컨테이너에 주입됨)
5. **cloudflared 무변경**: `/etc/cloudflared/config.yml`의 flowforge 항목은 그대로. CF Access 정책은 CF 엣지에서 적용되고 헤더를 주입한다.

## 검증 (등록 후)

```bash
# ① origin 직격(로컬) 무자격 쓰기 → 401
curl -s -o /dev/null -w "%{http_code}\n" -X PUT \
  http://localhost:8812/api/changes/<change>/layout \
  -H 'content-type: application/json' -d '{}'
# 기대: 401

# ② 토큰 경유 쓰기 → 통과(FLOWFORGE_WRITE_TOKEN 설정 시)
curl -s -o /dev/null -w "%{http_code}\n" -X PUT \
  http://localhost:8812/api/changes/<change>/layout \
  -H "authorization: Bearer $FLOWFORGE_WRITE_TOKEN" \
  -H 'content-type: application/json' -d '{"n1":{"x":0,"y":0}}'
# 기대: 200 (또는 change 부재 시 404 — 401은 아님)

# ③ 브라우저: flowforge.gaegul.house 접속 → CF 로그인 게이트 → 통과 후 SPA 정상
#    (SPA 쓰기는 CF 쿠키→cloudflared JWT 헤더 자동 주입으로 통과, 웹 코드 무변경)
```

읽기(GET) 라우트는 앱레벨 게이트 밖이다 — 전체 열람 차단은 엣지 CF Access가 담당한다(홈 전체 RO 마운트 열람 포함).
