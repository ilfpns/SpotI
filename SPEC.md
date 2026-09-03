# SpotI 기능 명세서

Electron + TypeScript로 만든 데스크톱 Spotify 동반자 앱. 이 문서는 실제
구현된 코드를 기준으로 작성되었습니다 (설계 의도가 아니라 현재 동작).

## 1. 개요

- **형태**: 케이스에서 반쯤 꺼낸 LP 모양의 항상-위-표시(always-on-top),
  프레임 없는 투명 창. 자기 자신의 그림 픽셀 영역 외에는 클릭이 그대로
  아래 창으로 통과됨(click-through).
- **핵심 동작**: 드래그로 어디든 이동 가능. 마우스를 올리면(hover) 근처에
  현재 재생 정보 + 컨트롤 팝업이 나타남.
- **인증**: 사용자 자신의 Spotify 앱 Client ID로 PKCE(Authorization Code
  + PKCE) 플로우 수행. 클라이언트 시크릿을 앱에 내장하지 않음.

## 2. 아키텍처

### 2.1 프로세스/창 구성

| 창 | 크기 | 특징 |
|---|---|---|
| Pet | 48/64/88px (설정값) | 투명, 프레임 없음, 항상 위, 클릭통과+forward, 크기·불투명도 실시간 반영 |
| Popup | 360×190 | 호버 시에만 표시, 펫 위/아래 자동 배치 |
| Settings | 860×560 | 일반/테마/기록/Spotify 4개 탭 |
| Context Menu | 160×96 | 우클릭 시 지연 생성(lazy), 블러 시 자동 숨김 |

각 창은 `contextIsolation: true`, `nodeIntegration: false`로 통일. Preload
스크립트(`src/preload/preload.ts`)가 `window.petAPI`로 타입이 지정된 IPC
표면만 노출.

### 2.2 IPC

`src/shared/ipcChannels.ts`에 채널명이 단일 소스로 정의되어 있고,
`preload.ts`와 `main/ipc/registerIpcHandlers.ts` 양쪽에서 이를 참조.
설정값은 `invoke`(요청-응답), 실시간 브로드캐스트는 `send`/`on` 패턴 사용.

### 2.3 팝업 표시/숨김 상태 머신

`src/main/popupController.ts`가 `hidden → visible → grace → closing →
hidden` 상태를 명시적으로 관리(60ms 간격으로 커서 위치 폴링). 이전에는
`win.isVisible()`과 타이머 존재 여부를 섞어서 판단하다가, 사라지는
애니메이션 도중 커서가 돌아오면 팝업이 "떠 있지만 사라진 것처럼 보이는"
버그가 있었음 — 이번에 상태 머신으로 재작성해 수정. 자동화 테스트:
`src/main/popupController.test.ts` (빠른/느린/무작위 토글 6개 시나리오).

## 3. 핵심 기능

### 3.1 펫

- 드래그 이동, 드래그 중에도 크기가 틀어지지 않도록 항상 명시적
  width/height로 `setBounds()` (Windows에서 transparent 창에
  `setPosition()`만 반복 호출 시 보고되는 너비가 깨지는 문제 회피).
- 우클릭 → 커스텀 컨텍스트 메뉴(설정 열기 / 숨기기 등).
- SVG 하나(`src/shared/petSvg.ts`)가 펫 렌더러, 트레이 아이콘, 설정창
  브랜드 아이콘에 모두 재사용됨 — 트레이 아이콘은 Chromium으로 오프스크린
  렌더링 후 rasterize.

### 3.2 팝업 (재생 컨트롤)

- 앨범 아트, 곡명(마퀴 스크롤), 아티스트(말줄임), 재생/일시정지/다음곡/
  이전곡, 탐색 가능한 진행 바, 상태 낙관적 갱신(optimistic update) 후
  즉시 재폴링으로 실제 상태와 동기화.
- Spotify 미연결 시 연결 버튼 표시.

### 3.3 미디어 키

`src/main/mediaKeys.ts` — `globalShortcut`으로 `MediaPlayPause`/
`MediaNextTrack`/`MediaPreviousTrack`을 전역 등록. 설정에서 켜고 끌 수
있음(다른 앱과 충돌 시 대비).

## 4. 설정 (Settings)

### 4.1 일반

| 항목 | 저장 위치 | 기본값 |
|---|---|---|
| 언어 | `localeStore` (`locale.json`) | ko |
| 볼륨 | Spotify API 직접 반영 (로컬 저장 없음) | — |
| 불투명도 | `appSettingsStore` (`settings.json`) | 100 (최소 20으로 하한) |
| 시작 시 자동 실행 | OS 로그인 항목(`app.setLoginItemSettings`) | false |
| SpotI 크기 | `appSettingsStore` | medium(64px) |
| 트랙 변경 알림 | `appSettingsStore` | true |
| 알림 소리 | `appSettingsStore` | true |
| 연동(폴링) 속도 | `appSettingsStore` | fast(200ms 활성/3000ms 유휴) |
| 팝업 반응(소멸) 속도 | `appSettingsStore` | normal(60ms) |
| 디스크 회전 애니메이션 | `appSettingsStore` | true |
| 미디어 키 지원 | `appSettingsStore` | true |
| 시작 시 숨기기 | `appSettingsStore` | false |
| 설정 초기화 | — | 버튼 (아래 4.5 참고) |

### 4.2 테마

| 항목 | 저장 위치 | 기본값 |
|---|---|---|
| 화면 모드 (라이트/다크) | `themeStore` (`theme.json`) | dark |
| 폰트 컬러 (팝업 텍스트/아이콘) | `themeStore` | `#f5f5f7` |
| LP 컬러 (라벨 원) | `themeStore` | `#f2f0ec` |
| 케이스 컬러 | `themeStore` | `#f4f3f0` |
| 테두리 표시 여부 | `themeStore` | true |
| 테두리 색 | `themeStore` | `#d8d6d0` |

색상은 무지개 프리셋 7개 + 커스텀 컬러 휠로 선택. 변경 시 모든 열린 창에
브로드캐스트되고, 트레이/설정창 아이콘도 재생성됨.

### 4.3 기록 (Listening History)

- `src/main/listeningHistoryStore.ts`가 재생 중(polling tick마다) 실제
  경과 시간을 트랙별/일자별로 누적 기록 (`history.json`).
- 보관 기간: 히트맵 표시 기간(364일) + 30일 여유, 그 이전 데이터는 자동
  정리(prune)되어 메모리/디스크가 무한정 커지지 않음.
- 설정 화면: 총 청취 시간/이번 주/베스트 데이/일 평균/최장·현재 연속
  기록, 2D 캘린더 히트맵(최근 52주 전체가 스크롤 없이 한 화면에 표시),
  클릭한 날짜의 베스트 트랙(가장 오래 들은 곡) 표시.

### 4.4 Spotify

- **Client ID 설정**: 앱 내에서 직접 입력·저장 (`userData/
  spotify.config.json`, 패키징된 앱에서도 쓰기 가능한 위치). 개발자
  대시보드 바로가기 버튼, Redirect URI 값 표시.
  - `SPOTIFY_CLIENT_ID` 환경 변수가 있으면 이 값이 우선 적용(개발자용).
- 연결 상태 표시, 연결 해제 버튼.
- 버전/런타임 정보(Electron·Chromium·플랫폼).

### 4.5 설정 초기화

"초기화" 버튼은 다음 값들로 되돌림(주의: 앱 최초 설치 시 기본값과 다른
경우가 있음 — 사용자가 이 버튼에 명시적으로 요청한 값):
언어=영어, LP/케이스/폰트 컬러=흰색(`#ffffff`), 화면 모드=다크,
테두리 표시=켜짐, 테두리색=기본값, 크기=medium, 자동실행=꺼짐,
알림=켜짐, 연동속도=fast, 팝업반응=normal, 애니메이션=켜짐,
미디어키=켜짐, 알림소리=켜짐, 시작시숨기기=꺼짐, 불투명도=100.
Spotify 연결 상태는 그대로 유지됨.

## 5. 다국어 (i18n)

- `src/shared/i18n.ts`에 ko/en/zh/ja 4개 언어 사전이 하나의 파일에 정의.
- 렌더러: `data-i18n` 속성 스캔 방식(`renderer/i18nClient.ts`).
- 메인 프로세스: 트레이 메뉴, 트랙 변경 알림 등도 `translate()` +
  `localeStore.getLocale()`로 동일하게 로컬라이즈.
- 언어 변경 시 모든 창 + 트레이 메뉴가 즉시 갱신됨.

## 6. 보안

- **인증**: PKCE(Authorization Code + PKCE), 클라이언트 시크릿 없음.
  Refresh token은 Electron `safeStorage`로 암호화해 디스크에 저장
  (`tokenStore.ts`). Access token은 메인 프로세스 메모리에만 존재하며
  렌더러로 절대 전달되지 않음.
- **CSP**: 패키징된 빌드에서 `session.defaultSession.webRequest
  .onHeadersReceived`로 실제 Content-Security-Policy 헤더 적용
  (`default-src 'self'`, 원격 스크립트/스타일 출처 없음, 앨범 아트용
  `https:` 이미지만 허용). 개발 모드는 Vite HMR을 위해 적용 안 함.
- **창 보안**: 4개 창 모두 `contextIsolation: true` / `nodeIntegration:
  false`, `webSecurity`/`sandbox` 예외 없음.
- **외부 URL 열기**: Spotify 대시보드 링크는 렌더러가 URL을 넘기는 게
  아니라, 메인 프로세스에 고정된 주소만 여는 전용 IPC 채널 사용(렌더러가
  임의 URL을 열게 할 수 없음).
- **비밀정보**: 저장소에 시크릿 없음(소스 스캔으로 확인). 개발용
  `spotify.config.json`은 `.gitignore` 처리.

## 7. 성능/최적화

- **폴링**: 팝업이 열려있을 때만 빠른 간격(fast=200ms/normal=1000ms),
  닫혀있으면 유휴 간격(3000ms). 429 레이트리밋 응답 시 로컬에서
  일정 시간 요청을 멈추는 회로차단기(circuit breaker) 적용.
- **창 생성**: 컨텍스트 메뉴 창은 지연 생성(첫 사용 시에만).
- **아이콘**: 트레이/윈도우 아이콘은 캐시 후 테마 변경 시에만 재생성.
- **기록 저장소**: 쓰기는 5초 배치(디바운스), 앱 종료 시 즉시 flush.
  오래된 기록은 자동 정리(위 4.3 참고).

## 8. 빌드/배포

- `npm run dev` / `npm start` — 개발 모드(HMR).
- `npm run build` — electron-vite 프로덕션 빌드.
- `npm run dist` — electron-builder로 Windows용 두 가지 산출물 생성
  (`release/`):
  - NSIS 설치 프로그램
  - 포터블 단일 실행 파일(설치 불필요)
- 앱 아이디: `com.example.spoti`, 제품명: `SpotI`.

## 9. 테스트

- `npm test` (`vitest run`) — 현재 `popupController.test.ts` 1개 스위트,
  6개 테스트(정상 호버, grace 구간 복귀, fade-out 도중 복귀 — 원래
  버그 재현, 초당 다회 토글 300회, 다초 간격 토글 20회, 1ms~3s 무작위
  토글 1000회).
- 그 외 기능은 `npm run typecheck` + 개발 모드 relaunch 후 콘솔 에러
  부재 확인 방식으로 검증(자동화된 E2E 테스트는 아직 없음).
