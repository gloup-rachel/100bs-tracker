# 백년밥상 품절·재입고 트래커 — Vercel 배포 안내

브라우저에 저장하던 방식을 **서버 저장**으로 바꾼 버전입니다.
Rachel이 표시하면 팀 전원이 같은 화면을 봅니다. 팀원은 보기 전용입니다.

저장소는 **이미 쓰고 계신 Supabase 프로젝트를 그대로 씁니다.** 테이블 하나만 추가하면 됩니다.

---

## 폴더 구성

```
100bs-tracker/
├─ index.html              화면 (데이터는 전부 API에서 받음)
├─ api/
│   ├─ _lib.js             인증 + 저장소 (외부 패키지 0개, fetch만 사용)
│   ├─ bootstrap.js        GET  로그인 확인 + 상품 카탈로그 + 캘린더
│   ├─ state.js            GET  현재 상태 / POST 저장 (관리자만)
│   └─ calendar.js         GET  요약 / POST 캘린더 팩 교체
├─ data/
│   ├─ catalog.json        발주모아 상품 485건
│   └─ calendar_pack.json  최초 캘린더 (이후 서버 값이 우선)
├─ supabase_setup.sql      테이블 생성 SQL (한 번만 실행)
├─ package.json
└─ vercel.json             검색엔진 차단 헤더
```

**중요** — Vercel은 저장소 **루트의 `api/` 폴더**만 서버리스 함수로 인식합니다.
기존 100bs 저장소에 합칠 때 `index.html`은 `tracker/index.html` 같은 하위 경로로 옮겨도 되지만,
`api/` 4개 파일은 반드시 저장소 루트의 `api/` 아래에 두세요.

---

## 배포 순서 (약 15분)

### 1. Supabase에 테이블 만들기
쓰고 계신 프로젝트에 그대로 추가하면 됩니다. 기존 테이블과 섞이지 않도록 이름을 `bb_tracker_` 로 시작하게 했습니다.

1. Supabase 대시보드 → **SQL Editor**
2. `supabase_setup.sql` 내용 전체를 붙여넣고 **Run**
3. Table Editor에 `bb_tracker_kv` 가 생겼는지 확인

이 테이블은 행이 **2개만** 쌓입니다 (`bb:tracker:state`, `bb:tracker:calendar`). 용량 걱정은 없습니다.

### 2. Supabase 키 확인
Supabase 대시보드 → Settings → API 에서 두 값을 복사합니다.

- **Project URL** (`https://xxxx.supabase.co`)
- **service_role** 키 ← `anon` 키가 아닙니다. 주의하세요.

> `service_role` 키는 **절대 브라우저 쪽에 넣으면 안 됩니다.** 이 프로젝트에서는 Vercel 서버리스 함수 안에서만 쓰이고 화면으로는 나가지 않습니다. SQL에서 RLS를 켜뒀기 때문에, 혹시 `anon` 키가 유출돼도 이 테이블은 읽히지 않습니다.

### 3. 저장소에 올리고 Vercel에 연결
이 폴더를 기존 100bs 저장소에 넣고 커밋하거나, 새 저장소로 만들어 Vercel에 연결합니다.

### 4. 환경변수 5개 추가
프로젝트 → Settings → Environment Variables

| 이름 | 값 | 용도 |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | 저장소 주소 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | 저장소 접근 |
| `ADMIN_PW` | Rachel 전용 비밀번호 | 편집 권한 |
| `TEAM_PW` | 팀 공용 비밀번호 | 보기 전용 |
| `CALENDAR_PUSH_KEY` | 아무 긴 랜덤 문자열 | 매일 아침 캘린더 자동 반영용 |

> 두 비밀번호는 **서로 달라야** 합니다. 같으면 전원이 편집 권한을 갖습니다.
> 한글도 됩니다(인코딩 처리해 뒀습니다). 다만 팀에 불러주기 쉬운 영문+숫자를 권합니다.
> 테이블 이름을 바꾸고 싶으면 `SUPABASE_TABLE` 변수로 지정할 수 있습니다.

### 5. 배포 후 확인
1. 주소 접속 → 비밀번호 입력 화면
2. `ADMIN_PW`로 들어가면 편집 가능, `TEAM_PW`로 들어가면 우측 상단에 **보기 전용** 배지
3. 품절 상품 하나 등록 → 다른 브라우저(또는 시크릿 창)에서 `TEAM_PW`로 접속해 같은 항목이 보이면 성공
4. Supabase Table Editor에서 `bb_tracker_kv` 행이 생겼는지 봐도 됩니다

---

## 동작 방식

- **저장**: 편집할 때마다 0.8초 뒤 서버에 자동 반영. 헤더에 `저장 중… → 저장됨` 배지 표시
- **충돌 방지**: 내가 화면을 연 뒤 다른 곳에서 먼저 저장됐으면 **덮어쓰지 않고 경고**합니다. 새로고침 후 다시 수정하세요
- **보기 전용**: 추가·삭제·상태변경·체크가 모두 잠기고, **1분마다 자동 새로고침**됩니다
- **비밀번호 기억**: 브라우저에 저장되어 다음 접속 때 바로 들어갑니다

---

## 매일 아침 캘린더 자동 반영

지금은 캘린더 팩 파일을 받아 수동으로 끼우고 있는데, 배포 후에는 **자동 빌드 태스크가 서버로 직접 밀어넣게** 할 수 있습니다. 그러면 팀 전원이 다음 새로고침에 최신 캘린더를 봅니다.

```bash
curl -X POST https://<배포주소>/api/calendar \
  -H "Content-Type: application/json" \
  -H "x-bb-key: <CALENDAR_PUSH_KEY 값>" \
  --data-binary @calendar_pack_YYYY-MM-DD.json
```

빈 달이 섞여 있으면 서버가 400으로 거부합니다(파싱 실패 방어).

---

## 알아둘 것

- **무료 Supabase 프로젝트는 요청이 한동안 없으면 일시정지됩니다.** 지금 쓰시는 프로젝트라 당장은 문제없지만, 그 프로젝트가 멈추면 트래커도 같이 멈춥니다. 트래커만 따로 두고 싶어지면 별도 프로젝트로 분리하시면 됩니다(코드 변경 없이 환경변수만 교체).
- **비밀번호 게이트는 사내 공유용 수준입니다.** 화면과 데이터는 잠기지만 대외비 문서를 다루는 수준의 보안은 아닙니다. 더 강한 보호가 필요하면 Vercel Deployment Protection(유료 플랜)을 검토하세요.
- **상품 카탈로그는 `data/catalog.json` 고정입니다.** 발주모아에 상품이 추가되면 이 파일을 새로 만들어 다시 배포해야 합니다.
- **로컬 단독 파일 버전(v7.0)도 그대로 씁니다.** 배포에 문제가 생겼을 때의 대비책으로 남겨두세요. 단 두 버전의 상태는 서로 연결되지 않습니다.
- Supabase 대신 Upstash Redis를 쓰고 싶으면 `SUPABASE_*` 대신 Redis 환경변수만 넣으면 됩니다. 코드가 자동으로 선택합니다.
