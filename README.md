# Pylon Server

Raspberry Pi Connect 스타일의 원격 접속 서버. 브라우저와 [Pylon Agent](https://github.com/sm-kim1/pylon-agent) 사이에서 SSH/RDP 세션을 중계합니다.

```
Browser (React) ──WebSocket──▶ Pylon Server (Fastify) ◀──WebSocket── Agent (Go)
```

## 요구 사항

- Node.js 20+
- pnpm 9+ (없으면 설치 스크립트가 자동 설치)

## 설치

```bash
./install.sh
```

shared → server → web 순서로 의존성 설치 및 빌드를 자동 수행합니다.

## 실행

```bash
# 프로덕션
cd server && npm run start

# 개발 모드 (server + web 동시 hot-reload)
pnpm dev
```

| 포트 | 서비스 |
|------|--------|
| 3000 | API + WebSocket 서버 |
| 5173 | Web 개발 서버 (Vite) |

### 환경 변수

```bash
PORT=3000              # 서버 포트 (기본: 3000)
NODE_ENV=production    # development | production | test
LOG_LEVEL=info         # trace | debug | info | warn | error | fatal
```

## 패키지 구조

```
server/     — Fastify WebSocket 중계 서버 (TypeScript, ESM)
web/        — React SPA: SSH 터미널 (xterm.js), RDP 뷰어 (React 18, Vite, Tailwind, Zustand)
shared/     — server/web 공유 TypeScript 메시지 타입
```

### 개별 빌드

```bash
pnpm --filter @pylon/shared build     # 공유 타입
pnpm --filter pylon-server build      # 서버
pnpm --filter @pylon/web build        # 웹 프론트엔드
```

프로덕션 배포 시 웹 정적 파일은 `web/dist/`에 생성됩니다.

## 주요 서비스

- **DeviceRegistry** — 연결된 에이전트 추적, 비활성 디바이스 제거 (90초 타임아웃)
- **SessionManager** — 브라우저 ↔ 에이전트 간 SSH/RDP 세션 매핑
