# 교사업무자동화플랫폼 V3.1 서버 배포판

원본 V3.0 화면과 기능을 유지하고 Node.js 서버 및 Supabase 자동 저장을 추가했습니다. 비밀번호·회원가입·로그인 화면이 없습니다. GitHub는 소스 보관, Render는 웹 서버 실행, Supabase는 주요 자료 보관에 사용합니다.

**로그인이 없으므로 배포 주소에 접속하는 누구나 자료를 조회·변경·삭제할 수 있습니다. 개인용으로 사용하더라도 주소만으로 사용자 구분은 되지 않습니다.** 검색 제외 설정은 접근 제한 기능이 아닙니다.

## 1. Supabase 준비

1. Supabase에서 프로젝트를 만듭니다. Supabase 자체의 데이터베이스 비밀번호 요청은 이 앱의 로그인 비밀번호와 별개입니다.
2. 프로젝트의 SQL Editor에서 `supabase/schema.sql` 전체를 붙여넣고 실행합니다.
3. 프로젝트 URL(`https://...supabase.co`)과 API Keys의 **Secret key**(`sb_secret_...`)를 복사합니다. 기존 프로젝트의 `service_role` 키도 지원합니다. `anon` / publishable 키는 사용할 수 없습니다.
4. 키는 다음 단계에서 Render의 환경 변수에만 입력합니다. HTML이나 GitHub 소스에 넣지 마세요.

## 2. GitHub 업로드

1. ZIP을 압축 해제합니다.
2. GitHub에 새 저장소를 만듭니다. 비공개 저장소를 권장합니다.
3. `teacher-workspace` 폴더 **안의 파일과 폴더**를 저장소 최상위에 올리고 커밋합니다. 최상위에서 `package.json`, `server.mjs`, `render.yaml`이 보여야 합니다.
4. 실제 `.env` 파일과 학생 백업 JSON은 업로드하지 않습니다. `.env.example`은 빈 설정 예시입니다.

## 3. Render 배포

1. Render에서 **New → Blueprint**를 선택하고 GitHub 저장소를 연결합니다.
2. `render.yaml`이 인식되면 다음 두 환경 변수 값을 입력합니다.

| 변수 | 값 |
|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SECRET_KEY` | Supabase Secret key 또는 service_role 키 |

3. 배포를 실행하고 완료 후 `https://서비스이름.onrender.com` 주소를 엽니다.
4. 화면 위에 **Supabase 연결됨** 또는 **Supabase 저장 완료**가 표시되는지 확인합니다.
5. 시험 학생 한 명을 추가한 뒤 **Supabase 저장 완료**를 기다리고 새로고침하여 유지되는지 확인합니다. 다른 브라우저에서도 확인하면 서버 저장을 검증할 수 있습니다.

Blueprint 대신 Web Service를 직접 만들 경우 Runtime은 Node, Build Command는 `npm ci`, Start Command는 `npm start`, Health Check Path는 `/healthz`입니다. 같은 환경 변수를 설정합니다. 무료 플랜은 가동 정책에 따라 첫 접속이 느릴 수 있으며, 플랜 이용 가능 여부와 비용은 Render에서 확인하세요.

## 기존 자료 옮기기

HTML 파일 자체에는 브라우저에 입력한 자료가 들어 있지 않습니다. 기존 HTML을 사용하던 브라우저에서 **데이터 관리 → 전체 백업**으로 JSON을 다운로드한 다음, 배포한 앱의 데이터 관리에서 가져오세요. 서버 저장 완료 표시를 확인합니다. 새 서버는 예시 학생 없이 빈 자료로 시작합니다.

## 저장 범위와 복구

- 학생, 학교, 학년도, 상담, 연락, 누가기록, 평가·성적, 일정, 생기부 초안 등 `db`의 전체 자료는 Supabase에 자동 저장됩니다.
- API 키, 글꼴 파일, 글꼴·화면 설정, 삭제 복구함, 공휴일 표시 설정, 기본 프롬프트 선택 등 브라우저 설정은 해당 브라우저에 남습니다. 글꼴과 설정 이동에는 기존 전체 백업 기능을 사용하세요. 브라우저 간 자동 동기화 대상은 주요 자료입니다.
- 변경 직후에는 브라우저 임시 저장이며, 상단 **Supabase 저장 완료**가 실제 서버 저장 기준입니다. 완료되기 전에는 창을 닫지 마세요.
- 서버 장애 시 입력 자료를 현재 탭의 세션 저장소에 보관하며, 상단에서 JSON 다운로드 및 저장 재시도가 가능합니다. 브라우저 저장 용량을 초과하면 보관이 실패할 수 있으므로 기존 데이터 관리 백업도 사용하세요.
- 다른 창이나 기기가 먼저 저장하면 후속 저장을 거부하여 덮어쓰기를 막습니다. 미전송 JSON을 다운로드하고 서버 자료를 다시 불러온 뒤 필요한 내용을 수동 반영하세요. JSON 가져오기는 병합이 아니라 전체 교체입니다.
- 열려 있는 다른 기기 화면을 실시간 갱신하지는 않습니다. 편집 시작 전에 새로고침하세요.
- 서버는 Render 디스크에 자료를 저장하지 않습니다. 재배포해도 Supabase 자료는 유지됩니다. 별도로 JSON 백업을 보관하세요.

## AI 및 맞춤법

원본의 **API 설정** 기능을 유지했습니다. OpenAI / 바른 키와 모델은 앱 화면에서 설정하며 브라우저가 해당 API를 직접 호출합니다. 이 키는 Supabase 키와 다릅니다. API 호출 비용과 브라우저 CORS 제한은 제공 서비스 정책에 따릅니다. 이 ZIP은 유료 API 계정이나 키를 포함하지 않으며 실제 외부 AI 호출은 검증하지 않았습니다.

## 로컬 실행 및 확인

Node.js 22.16 이상을 설치합니다. `.env.example`을 `.env`로 복사해 실제 Supabase 값을 넣고 실행합니다.

```sh
npm ci
npm test
npm start
```

`http://localhost:3000`에 접속합니다. HTML 파일 더블클릭 방식은 서버 배포판에서 지원하지 않습니다. `/healthz`는 서버 프로세스 확인용이며 Supabase 연결 성공을 보장하지 않습니다.

## 파일 구성

- `public/index.html`, `public/app.js`: 원본 화면과 업무 기능
- `public/cloud.js`: 서버 자료 로드, 자동 저장, 충돌·장애 안내
- `server.mjs`: 정적 파일 제공 및 Supabase 서버 전용 연동
- `supabase/schema.sql`: 자료 테이블 및 브라우저 직접 접근 차단
- `render.yaml`: Render 배포 설정
- `test/server.test.mjs`: 모의 저장소를 이용한 서버 API 검증

실제 GitHub 업로드, Render 배포, Supabase 연결은 본인 계정 설정 후 진행합니다. ZIP 제작 시에는 실제 클라우드 계정에 접속하지 않았습니다.

공식 참고: [Render Blueprint](https://render.com/docs/blueprint-spec), [Supabase API 키](https://supabase.com/docs/guides/api/api-keys), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
