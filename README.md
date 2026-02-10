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

### 전체 (개발 모드)

```bash
pnpm dev
```

server와 web을 동시에 hot-reload로 실행합니다.

### Server 개별 실행

```bash
# 개발 모드 (tsx watch)
cd server && npm run dev

# 프로덕션 (빌드 후 실행)
cd server && npm run build && npm run start
```

| 포트 | 서비스 |
|------|--------|
| 3000 | API + WebSocket 서버 |

### Web 개별 실행

```bash
cd web && npm run dev
```

| 포트 | 서비스 |
|------|--------|
| 5173 | Vite 개발 서버 (API/WS를 서버로 프록시) |

프로덕션 배포 시:
```bash
cd web && npm run build    # web/dist/에 정적 파일 생성
```

`web/dist/`를 nginx 등 웹 서버로 서빙하고, API/WebSocket 요청을 Pylon Server로 리버스 프록시합니다.

### 환경 변수

**Server:**
```bash
PORT=3000              # 서버 포트 (기본: 3000)
NODE_ENV=production    # development | production | test
LOG_LEVEL=info         # trace | debug | info | warn | error | fatal
```

**Web (Vite):**
```bash
VITE_API_TARGET=http://localhost:8080    # API 프록시 대상 (개발 모드)
VITE_WS_URL=ws://localhost:8080/ws       # WebSocket URL 오버라이드 (선택)
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

## Web 프론트엔드

React 18 기반 SPA. 대시보드에서 연결된 디바이스 목록을 확인하고 SSH/RDP 세션을 시작합니다.

### 화면 구성

- **Dashboard** — 디바이스 카드 그리드 (온라인 상태, IP, 마지막 접속 시간 표시)
- **SSH Terminal** — xterm.js 기반 터미널 (복사, 클리어, 전체 화면, URL 클릭 지원)
- **RDP Viewer** — Guacamole 프로토콜 기반 원격 데스크톱 (인증 폼, 입력 토글, 전체 화면)

SSH/RDP 모두 드래그로 크기 조절 가능한 모달 창으로 동작합니다.

### 기술 스택

| 라이브러리 | 용도 |
|-----------|------|
| React 18 + React Router 6 | SPA 라우팅 |
| xterm.js | SSH 터미널 에뮬레이터 |
| guacamole-common-js | RDP 프로토콜 클라이언트 |
| Zustand | 디바이스 상태 관리 |
| Tailwind CSS | 다크 테마 UI |
| Vite | 빌드 + 개발 서버 |
| Lucide React | 아이콘 |

### 서버 연결

WebSocket (`/ws?type=browser`)으로 서버에 연결하며, 자동 재연결을 지원합니다 (3초 간격, 최대 10회).

REST API:
- `GET /api/devices` — 디바이스 목록 조회
- `GET /api/devices/stats` — 디바이스 통계

### Web 환경 변수

실행 섹션의 환경 변수를 참고하세요.
