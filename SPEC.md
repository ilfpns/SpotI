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
| Settings | 860×560 | 일반/테마/케이스/기록/Spotify 5개 탭 |
| Context Menu | 168×122, 직각 모서리 | 우클릭 시 지연 생성(lazy), 블러 시 자동 숨김, 설정/Spotify 바로가기/종료 |

각 창은 `contextIsolation: true`, `nodeIntegration: false`로 통일. Preload
스크립트(`src/preload/preload.ts`)가 `window.petAPI`로 타입이 지정된 IPC
표면만 노출.

### 2.1.1 앱 인스턴스 & 위치 기억

- `app.requestSingleInstanceLock()`으로 중복 실행 방지 — 이미 실행 중일 때
  다시 실행하면 기존 펫 창을 보여주고 새 인스턴스는 즉시 종료.
- 펫을 드래그해 옮긴 위치는 `appSettingsStore`(`settings.json`)에 저장되고
  다음 실행 시 복원됨. 저장된 위치가 현재 연결된 모니터의 작업 영역
  밖이면(모니터 구성이 바뀐 경우 등) 기본 우하단 위치로 폴백.

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
  포인터 이동량이 임계값(4px) 이하면 드래그가 아닌 클릭으로 판정.
- 우클릭 → 커스텀 컨텍스트 메뉴(설정 열기 / Spotify 바로가기 / 종료).
- **클릭 시 케이스가 슬라이드되어 LP가 전부 드러남**(다시 클릭하면
  원위치). 케이스가 벗겨져 있는 동안에만 LP가 회전 — 회전은 CSS
  애니메이션이 아니라 `requestAnimationFrame`으로 각도를 직접 누적시켜,
  케이스를 다시 씌우면 그 자리에서 즉시 정지하고 다음에 벗길 때 같은
  각도부터 이어서 회전(0도로 되돌아가지 않음).
- LP 표면은 동심원 그루브(여러 개의 얇은 원) + 여러 개의 얇은 대각선
  스트로크로 만든 은은한 빛 반사 효과로 실제 바이닐처럼 보이게 처리.
- **케이스 모양**: 두 가지 중 선택 가능(`pet-case`가 `<rect>`가 아니라
  `<path>`) — 케이스 탭에서 바꿀 수 있음(4.3절 참고).
- 케이스에 사용자가 지정한 이름을 새길 수 있음(케이스 탭, 4.3절 참고).
- SVG 하나(`src/shared/petSvg.ts`)가 펫 렌더러, 트레이 아이콘, 설정창
  브랜드 아이콘에 모두 재사용됨 — 트레이 아이콘은 Chromium으로 오프스크린
  렌더링 후 rasterize.

### 3.2 팝업 (재생 컨트롤)

- 앨범 아트, 곡명(마퀴 스크롤), 아티스트(말줄임), 셔플/이전곡/재생·일시
  정지/다음곡/반복(반복은 꺼짐→전체반복→한곡반복 순환) 5버튼, 탐색
  가능한 진행 바, 상태 낙관적 갱신(optimistic update) 후 즉시 재폴링으로
  실제 상태와 동기화.
- 앨범 아트 디스크 회전도 펫의 LP와 같은 방식(`requestAnimationFrame`
  으로 각도 직접 누적)으로 처리 — 일시정지하면 그 각도에서 바로 멈추고
  다시 재생하면 그 각도부터 이어서 회전. DOM 엘리먼트도 재생/일시정지
  때마다 새로 만들지 않고 그대로 재사용해 회전 상태가 끊기지 않음.
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
| 화면 모드 (다크/라이트/**시스템 설정**) | `themeStore` (`theme.json`) | dark |
| 폰트 컬러 (팝업 텍스트/아이콘) | `themeStore` | `#ffffff` |
| LP 컬러 (라벨 원) | `themeStore` | `#22c55e` |
| 재생 중인 곡 컬러 따라가기 | `themeStore`의 `followNowPlayingColor` | false |
| 테두리 표시 여부 | `themeStore` | true |
| 테두리 색 | `themeStore` | `#2e2e2e` |

**재생 중인 곡 컬러 따라가기**: 켜면 LP 컬러 프리셋/휠 대신, 현재
재생 중인 곡의 앨범 아트에서 뽑은 색이 LP 컬러로 자동 적용됨. 색 추출은
팝업 렌더러(`renderer/popup/dominantColor.ts`)에서 이미 로드된 앨범 아트
`<img>`를 작은 오프스크린 캔버스(24×24)에 그려 픽셀을 평균 내되, 채도가
높고 너무 밝거나 어둡지 않은 픽셀에 가중치를 줘서 큰 배경보다 실제
색감이 있는 부분이 우세하도록 함(별도 이미지 처리 라이브러리 없이 순수
Canvas API만 사용). 트랙이 바뀔 때마다(재생 중 상태 변화가 아니라
`albumArtUrl` 자체가 바뀔 때만) 추출해 `setLabelColor()`를 호출 —
팝업이 화면에 보이지 않아도 항상 로드되어 있으므로 백그라운드에서도
동작함. CORS로 인해 캔버스 읽기가 막히면(taint) 조용히 실패하고 이전
색을 유지함. 팝업 창도 펫 창과 마찬가지로 `backgroundThrottling: false`로
생성됨 — 팝업은 평소 숨겨져 있다가 호버할 때만 보이는데, Chromium
기본값대로면 숨겨진 동안 색 추출이 실제 트랙 변경보다 눈에 띄게 느리게
반영될 수 있음.

켜는 순간의 LP 컬러를 `themeStore`의 `preFollowLabelColor`에 저장해뒀다가,
끄면 그 색으로 되돌림(메인 프로세스의 `setFollowNowPlayingColor` IPC
핸들러가 처리) — 꺼도 마지막으로 추출된 색에 그대로 머물러 있지 않음.

색상은 무지개 프리셋 7개 + 커스텀 컬러 휠로 선택. 변경 시 모든 열린 창에
브로드캐스트되고, 트레이/설정창 아이콘도 재생성됨.

화면 모드를 "시스템 설정"으로 두면 저장되는 값은 `"system"`이고, 각 창에
실제로 적용되는 다크/라이트는 메인 프로세스가 Electron `nativeTheme`으로
매번 해석(`getEffectiveUiTheme`)해서 별도 채널로 방송함 — OS 테마가
바뀌면 `nativeTheme`의 `updated` 이벤트를 받아 열려 있는 모든 창에 다시
방송. 설정 화면에는 사용자가 고른 원래 값(다크/라이트/시스템)이 그대로
표시되고, 나머지 창들은 해석된 값만 받음.

### 4.3 케이스

| 항목 | 저장 위치 | 기본값 |
|---|---|---|
| 케이스 모양 | `themeStore`의 `caseShape` | `cut` |
| 케이스 컬러 | `themeStore` | `#595d64` |
| LP 이름 | `themeStore`의 `discName` | `""` (비어있으면 표시 안 함) |

- **케이스 모양**: 두 가지 중 선택.
  - `classic`: 케이스 자신의 높이와 같은 42×42 정사각형(원래는 세로보다
    좁은 직사각형이었음). 오른쪽 끝은 LP의 가로 중심(x=39)에 그대로
    고정돼 있어 정사각형으로 넓어져도 LP가 정확히 절반만 드러나는 원래
    비율은 그대로 유지되고, 넓어진 만큼은 왼쪽으로만 늘어남(아이콘의
    왼쪽 경계를 살짝 넘어감).
  - `cut`(기본값): LP의 바운딩 박스와 정확히 같은 42×42 정사각형 —
    케이스와 LP가 완전히 포개어져 있고, 그 정사각형의 대각선 두 개가
    만나는 중심(O)을 꼭짓점으로, 오른쪽 위 모서리(D)와 오른쪽 아래
    모서리(C)를 잇는 삼각형(D-O-C) 하나만 잘라낸 모양 — 그 삼각형
    자리로만 LP가 보임(케이스를 슬라이드해서 벗기기 전에도).
  - 두 모양 모두 `shared/petSvg.ts`의 `casePathFor()` 하나가 만들어내는
    `<path>` `d` 값만 다를 뿐, 설정 저장·트레이 아이콘 재생성 로직은
    모양과 무관하게 동일하게 동작함. 케이스를 슬라이드해서 벗기는
    애니메이션의 이동 거리(-66px)는 두 모양 중 더 넓은 쪽(`cut`, 오른쪽
    끝 x=60)을 기준으로 잡혀 있어 어느 모양이든 화면 밖으로 완전히
    빠져나감.
- 케이스 컬러 선택기는 원래 테마 탭에 있었으나 별도 탭으로 분리됨.
- LP 이름은 영문·숫자·공백·일부 기호(``!?.,'"&#@_-``)만 허용, 최대
  7자로 서버(메인 프로세스)와 입력창 양쪽에서 동일한 sanitize 함수
  (`shared/theme.ts`의 `sanitizeDiscName`)로 검증. 케이스 위에 새겨져
  케이스와 한 몸으로 움직임 — 케이스가 벗겨질 때 이름도 함께 슬라이드되어
  나가고, 케이스 색과 자동으로 대비되는 글자색이 선택됨(밝은 케이스엔
  어두운 글자, 어두운 케이스엔 밝은 글자).

### 4.4 기록 (Listening History)

- `src/main/listeningHistoryStore.ts`가 재생 중(polling tick마다) 실제
  경과 시간을 트랙별/일자별로 누적 기록 (`history.json`).
- 보관 기간: 5년 + 30일 여유. 연도별 히트맵 전환 기능이 실제로 넘겨볼
  과거 연도를 가지려면 364일치만 보관하는 걸로는 부족해서, 이번에
  기존의 롤링 윈도우(364일) 대신 연 단위 보관으로 확장됨. 그 이전
  데이터는 자동 정리(prune)되어 메모리/디스크가 무한정 커지지 않음.
- 설정 화면: 총 청취 시간/이번 주/베스트 데이/일 평균/최장·현재 연속
  기록, **GitHub 잔디 스타일 연도 선택 드롭다운**(기록이 있는 연도 +
  현재 연도, 기본값은 현재 연도)으로 전환되는 2D 캘린더 히트맵(선택한
  연도의 1월 1일~12월 31일, 스크롤 없이 한 화면에 표시), 클릭한 날짜의
  베스트 트랙(가장 오래 들은 곡) 표시.

### 4.5 Spotify

- **Client ID 설정**: 앱 내에서 직접 입력·저장 (`userData/
  spotify.config.json`, 패키징된 앱에서도 쓰기 가능한 위치). 개발자
  대시보드 바로가기 버튼, Redirect URI 값 표시.
  - `SPOTIFY_CLIENT_ID` 환경 변수가 있으면 이 값이 우선 적용(개발자용).
- 연결 상태 표시, 연결 해제 버튼.
- 버전/런타임 정보(Electron·Chromium·플랫폼), **업데이트 확인** 버튼
  (`src/main/updateChecker.ts` — GitHub Releases API로 최신 릴리즈를
  조회해 semver 비교, 배포된 릴리즈가 아직 없으면 "확인할 수 없음"으로
  처리되는 게 정상 동작).

### 4.6 설정 초기화

"초기화" 버튼은 다음 값들로 되돌림(주의: 앱 최초 설치 시 기본값과 다른
경우가 있을 수 있음 — 사용자가 이 버튼에 명시적으로 요청한 값):
언어=영어, LP/케이스/폰트/테두리 컬러=앱 기본값(위 4.2·4.3표 참고),
화면 모드=다크, 테두리 표시=켜짐, LP 이름=빈 값,
재생 중인 곡 컬러 따라가기=꺼짐, 케이스 모양=`cut`, 크기=medium,
자동실행=꺼짐, 알림=켜짐, 연동속도=fast, 팝업반응=normal,
애니메이션=켜짐, 미디어키=켜짐, 알림소리=켜짐, 시작시숨기기=꺼짐,
불투명도=100. Spotify 연결 상태는 그대로 유지됨.

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
- **창 보안**: 모든 창(펫/팝업/설정/컨텍스트메뉴 + 트레이 아이콘 렌더링용
  오프스크린 창) `contextIsolation: true` / `nodeIntegration: false`,
  `sandbox`는 Electron 33 기본값(true) 그대로 예외 없음. `src/main/
  windowSecurity.ts`의 `hardenWindow()`를 모든 창 생성 직후 호출해
  `will-navigate`와 새 창 열기를 전부 거부 — 이 앱은 자기 자신의 번들
  HTML만 로드하고 외부 페이지로 이동할 일이 전혀 없으므로, 뭔가가
  탐색을 시도하더라도(버그든 뭐든) 조용히 막힘.
- **외부 URL 열기**: Spotify 대시보드/릴리즈 페이지 링크는 렌더러가 URL을
  넘기는 게 아니라, 메인 프로세스에 고정된 주소만 여는 전용 IPC 채널
  사용(렌더러가 임의 URL을 열게 할 수 없음).
- **XSS**: Spotify API에서 온 곡명/아티스트/앨범아트 URL은 모두
  `escapeHtml()`을 거쳐서만 `innerHTML`에 들어감 — 텍스트 콘텐츠뿐
  아니라 `<img src="...">` 같은 속성 위치에 들어가는 URL도 마찬가지
  (속성값 안에서 따옴표로 깨져나가는 걸 막기 위해). 팝업의 앨범 아트
  `<img>`는 `.src` 프로퍼티로 직접 대입(HTML 문자열 조립이 아님)해서
  애초에 이 문제가 없음. LP 이름은 허용 문자 집합 자체가 `<`/`>`를
  빼놓고 있고, SVG 텍스트 콘텐츠로만 삽입되며(속성 값 아님) `&`만
  이스케이프하면 충분.
- **비밀정보**: 저장소에 시크릿 없음(소스 스캔으로 확인). 개발용
  `spotify.config.json`은 `.gitignore` 처리.

## 7. 성능/최적화

- **폴링**: 팝업이 열려있을 때만 빠른 간격(fast=200ms/normal=1000ms),
  닫혀있으면 유휴 간격(3000ms). 429 레이트리밋 응답 시 로컬에서
  일정 시간 요청을 멈추는 회로차단기(circuit breaker) 적용.
- **창 생성**: 컨텍스트 메뉴 창은 지연 생성(첫 사용 시에만).
- **아이콘**: 트레이/윈도우 아이콘은 캐시 후 테마 변경 시에만 재생성.
- **기록 저장소**: 쓰기는 5초 배치(디바운스), 앱 종료 시 즉시 flush.
  오래된 기록은 자동 정리(위 4.4 참고).
- **디스크 회전**: `requestAnimationFrame`은 케이스가 벗겨져 있을 때만
  실행되고, 다시 씌우면 즉시 정지 — 유휴 상태에서 불필요한 리페인트가
  계속 발생하지 않음.
- **볼륨 조회 / 미디어 키 재생·일시정지**: 둘 다 별도로 `/me/player`를
  다시 호출하지 않고, 폴링 루프가 이미 받아온 최신 상태를 재사용
  (`pollingService.getLastKnownState()`) — 설정 화면에서 볼륨을 읽을 때,
  그리고 하드웨어 미디어 키로 재생/일시정지를 누를 때 현재 재생 상태를
  판단하려고 매번 새 네트워크 왕복을 만들지 않음.
- **펫 창의 backgroundThrottling**: 펫 창은 `webPreferences.
  backgroundThrottling: false`로 생성됨 — 항상 위(always-on-top) 창이라도
  OS/Chromium이 다른 창에 가려졌다고(occluded) 판단하면 기본적으로
  `requestAnimationFrame`이 통째로 멈추는데, 이러면 케이스를 벗겨도
  디스크가 회전하지 않거나 호버 감지가 끊기는 문제가 생김. 백그라운드
  스로틀링을 꺼서 항상 정상 동작하도록 한 대신, 완전히 가려져 있을 때도
  약간의 CPU를 계속 씀 — 펫 창 하나에 한정된 트레이드오프.

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
