# EVAS PDP Maker — Session Handover

**작성일:** 2026-04-14
**프로젝트:** rise-content (EVAS Cosmetics 상세페이지 제작 도구)
**레포:** https://github.com/passeth/rise-content

---

## 1. 프로젝트 개요

Figma 기반 컴포넌트 라이브러리를 활용해 EVAS Cosmetics(CERACLINIC, FRAIJOUR, BAERE, ORYZA)의 화장품 상세페이지를 드래그&드롭으로 제작하는 비주얼 에디터.

### 핵심 워크플로우
```
브랜드 선택 → 좌측 컴포넌트 팔레트 → 캔버스에 드래그&드롭 → 우측 패널(제품정보+AI 에이전트+이미지생성+번역)
  → PDP 블루프린트 생성 → 컨텐츠 자동 배치 → 이미지 생성/선택 → 다국어 번역 → JPG/Figma Export
```

### 레퍼런스
- `pdp-maker-201/` (한이룸 PDP Maker 2.0) — 프롬프트 시스템, 이미지 생성 파이프라인 계승

---

## 2. 기술 스택 & 아키텍처

| 레이어 | 선택 |
|--------|------|
| 프레임워크 | Next.js 14 (App Router), TypeScript strict |
| 스타일링 | Tailwind CSS + shadcn/ui |
| 상태관리 | Zustand (immer) + 수동 undo/redo |
| 캔버스 | DOM 기반 (커스텀 드래그/리사이즈 + react-dnd 컴포넌트 드롭) |
| AI | Gemini (gemini-2.0-flash, 3.1-pro, 3-pro-image) |
| DB | Supabase (`content` 프로젝트, 신규) |
| 이미지 저장 | Supabase Storage |
| Figma | REST API(임포트) + Plugin(익스포트, 별도 앱) |
| 패키지 매니저 | pnpm workspace |

### 디렉토리 구조
```
rise-content/
├── apps/
│   ├── web/                          # Next.js 메인 앱
│   │   ├── app/
│   │   │   ├── (admin)/admin/        # 관리자 (사용자/브랜드/컴포넌트)
│   │   │   ├── (auth)/login/
│   │   │   ├── editor/[projectId]/   # 프로젝트 에디터
│   │   │   ├── projects/             # 프로젝트 목록
│   │   │   └── api/
│   │   │       ├── admin/{users,brands,components}/
│   │   │       ├── ai/chat/          # 카피라이팅 챗
│   │   │       ├── pdp/{analyze,images}/
│   │   │       ├── figma/import/
│   │   │       └── translate/
│   │   ├── components/
│   │   │   ├── editor/{Canvas,Section,TextEditor,Toolbar,ContentGenerateButton}
│   │   │   ├── panel/{ComponentPalette,ProductInfoPanel,AgentChatPanel,AgentSummaryCard,ImageGenPanel,TranslationPanel}
│   │   │   ├── gallery/SectionGallery
│   │   │   └── ui/{button,input,textarea,tabs,error-boundary}
│   │   └── lib/
│   │       ├── ai/{pdp-service,image-service,copywriting-agent,translation-service,content-placer}
│   │       ├── figma/{import,text-framing}
│   │       ├── store/{editor-store,project-store}
│   │       ├── supabase/{client,server,admin,storage}
│   │       ├── hooks/{use-auto-save,use-canvas-loader}
│   │       ├── export/{jpg-export,figma-export}
│   │       └── types/{editor,pdp,brand,figma}
│   └── figma-plugin/                 # Figma Plugin (Export용, 별도 빌드)
├── supabase/migrations/              # DB 마이그레이션
├── docs/HANDOVER.md                  # 본 문서
├── .omc/{prd.json,progress.txt}      # Ralph PRD 추적
└── CLAUDE.md
```

---

## 3. Supabase 정보

### 프로젝트
- **Ref:** `ketyyrhkhfqecucsidfv`
- **URL:** https://ketyyrhkhfqecucsidfv.supabase.co
- **DB password:** `9dFJfpXrEXu6VEmW`

### 환경변수 (apps/web/.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://ketyyrhkhfqecucsidfv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...  # 설정 완료
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...     # 설정 완료
GEMINI_API_KEY=                                       # 사용자별로 관리자가 배정
FIGMA_ACCESS_TOKEN=                                   # 미설정 (필요 시 추가)
```

### 테이블 (8개, RLS 전체 적용 — RBAC 기반)
- `profiles` — auth.users 확장, role(admin/editor/viewer), gemini_api_key
- `role_permissions` — RBAC 권한 매트릭스 (시드 22행)
- `brands` — name, slug, color_palette, protected_terms (시드: CERACLINIC/FRAIJOUR/BAERE/ORYZA)
- `components` — Figma 블록, text_slots/image_slots/template_data jsonb, layout_type
- `projects` — user_id/brand_id, product_info/agent_context/canvas_state/blueprint jsonb
- `generated_images` — project_id/section_id, prompt, image_url, is_selected
- `translations` — project_id/language(en/zh/ja/vi/ru), content jsonb
- `chat_histories` — project_id, role, content

### Storage 버킷 (3개)
- `product-images` (public)
- `generated-images` (public)
- `reference-images` (private)

### 테스트 계정
- 이메일: `admin@evas.co.kr`
- 비밀번호: `evas2026!`
- 역할: admin

---

## 4. 핵심 결정사항 (Memory)

### 4.1 컴포넌트 구조
- **블록 단위 임포트** — Figma 페이지의 자식 프레임을 개별 블록으로 임포트 (전체 페이지 일괄 X)
- **레이아웃 타입** — 1단/2단/3단 자동 감지 (자식 노드의 가로 정렬 분석)
- 사용자가 블록을 골라 조합하여 PDP 구성 (레고 방식)

### 4.2 텍스트 프레이밍 (B+C 방식)
- **B**: 같은 프레임 안에서 fontSize 순위로 headline/sub/body/caption 자동 분류
- **C**: 관리자 UI에서 잘못 분류된 항목을 드롭다운으로 보정
- **이유**: EVAS 브랜드별 폰트/크기 다양성 → 고정 px 구간은 오분류 위험

### 4.3 캔버스 에디터
- **세로 스택 + 순서 변경** (절대위치 X, 좌측 화살표 버튼으로 위/아래 이동)
- **하이브리드 오토레이아웃**:
  - 기본: auto 모드 — 텍스트 슬롯이 세로 flow + gap:20px (내용 길어지면 아래 박스 자동 이동)
  - 핸들 드래그 시 → free 모드 (절대 위치)
  - free 모드에서 `auto` 버튼 클릭 → auto 모드 복귀
- **섹션 높이 조절** — 하단 핸들 드래그, 내부 슬롯 비례 이동/리사이즈
- **샘플 텍스트 자동 채움** — 드롭 시 `text_slots[].sampleText`가 초기 content로 들어감
- **인라인 텍스트 편집** — contentEditable + Enter 키 줄바꿈
- **이미지 슬롯** — 빈 영역 클릭으로 파일 업로드 (FileReader → base64 → updateImageSlot)
- **슬롯별 삭제 버튼** — 텍스트/이미지 슬롯 hover 시 빨간 X 버튼

### 4.4 Figma 연동
- **임포트**: REST API + 자동 썸네일 생성 (`/v1/images/{fileKey}?ids=...&format=png`)
- **익스포트**: Figma Plugin 별도 개발 (apps/figma-plugin/), JSON 데이터 → 클립보드 → 플러그인 붙여넣기

### 4.5 AI 모델
- 카피라이팅 챗: gemini-2.0-flash (스트리밍)
- PDP 블루프린트: gemini-3.1-pro-preview
- 이미지 생성: gemini-3-pro-image-preview (레퍼런스 모델 아이덴티티 락 + 검증 재시도 루프)
- 번역: gemini-2.0-flash

### 4.6 권한 (RBAC)
- 역할: admin, editor, viewer
- API 키 관리: 관리자가 사용자별로 Gemini API 키 배정 (`profiles.gemini_api_key`)
- RLS: 모든 테이블에 `get_user_role()` 헬퍼 기반 정책 적용

---

## 5. 완료된 작업 (PRD 14/14)

| Phase | Story | 상태 | 핵심 파일 |
|-------|-------|------|----------|
| 1 | Foundation | ✅ | Next.js 셋업, Supabase 마이그레이션, RBAC RLS |
| 2 | Canvas Editor | ✅ | Canvas, Section, TextEditor, Toolbar |
| 2 | Save/Load + Auto-save | ✅ | use-auto-save, use-canvas-loader |
| 2 | Figma Import + Text Framing | ✅ | lib/figma/{import,text-framing} |
| 3 | Product Info + Agent Chat | ✅ | ProductInfoPanel, AgentChatPanel, /api/ai/chat |
| 3 | Agent Output Summary | ✅ | AgentSummaryCard, copywriting-agent.ts |
| 4 | PDP Blueprint | ✅ | pdp-service.ts, /api/pdp/analyze |
| 4 | Content Placement | ✅ | content-placer.ts, ContentGenerateButton |
| 5 | Image Generation | ✅ | image-service.ts, ImageGenPanel, /api/pdp/images |
| 5 | Image Gallery | ✅ | SectionGallery, prompt improvement |
| 6 | Multi-Language Translation | ✅ | translation-service, TranslationPanel, /api/translate |
| 6 | Export (JPG + Figma) | ✅ | jpg-export, figma-export, apps/figma-plugin/ |
| 7 | Admin Dashboard | ✅ | /admin/{users,brands,components} + API routes |
| 7 | Component Management | ✅ | components-client + Figma 임포트 + 역할 보정 |
| 8 | Polish & Deploy | ✅ | error-boundary, CLAUDE.md |

### 추가 작업 (PRD 외)
- 컴포넌트 에디터 비주얼 WYSIWYG 통합 (`/admin/components/[id]`)
  - 좌측: 인터랙티브 캔버스 (드래그/인라인 편집/이미지 업로드/높이 리사이즈)
  - 우측: 속성 패널 (양방향 동기화)

### 시드 데이터 (CERACLINIC, 4개 블록)
DB에 직접 등록된 샘플 컴포넌트:
- 히어로 인트로 (1단): 6개 텍스트 슬롯, 1개 이미지 슬롯, sampleText 포함
- 제품 컨셉 (1단): 3개 텍스트 슬롯, 1개 이미지 슬롯
- 리얼 리뷰 (1단): 7개 텍스트 슬롯
- 베네핏 리스트 (1단): 7개 텍스트 슬롯, 1개 이미지 슬롯

---

## 6. 알려진 이슈 / 미완성 부분

### 6.1 기능 검증 필요
- [ ] 카피라이팅 에이전트 챗 — Gemini API 키 배정 후 실제 동작 검증 미실시
- [ ] PDP 블루프린트 생성 — `/api/pdp/analyze` 호출 검증 미실시
- [ ] 이미지 생성 파이프라인 — 레퍼런스 모델 아이덴티티 락 검증 미실시
- [ ] 다국어 번역 — 5개 언어 번역 품질 검증 미실시
- [ ] JPG Export — html2canvas + jszip 실제 동작 검증 미실시
- [ ] Figma Plugin — 개발 환경 빌드 / Figma 등록 / 동작 검증 미실시

### 6.2 텍스트 프레이밍 (B+C)
- 기본 분류 로직만 구현, 관리자 UI에서 보정 기능 미완성
- 관리자 컴포넌트 편집기에서 role 변경은 가능하지만 임포트 후 자동 분류 결과를 보고 보정하는 워크플로우 명시 부족

### 6.3 컴포넌트 임포트 — Figma Token
- `.env.local`에 `FIGMA_ACCESS_TOKEN` 미설정
- 현재 시드 데이터는 Figma MCP로 가져온 정보를 SQL로 직접 등록
- 실제 Figma REST API 임포트는 토큰 설정 후 동작

### 6.4 Vercel 배포
- 배포 미진행
- 이미지 익스포트가 클라이언트 사이드 (html2canvas) — Vercel Serverless 호환 OK
- Puppeteer 기반 익스포트는 향후 검토 (CJK 폰트 안정성)

### 6.5 미완성 / 계획 외
- 텍스트 슬롯 스타일(backgroundColor, padding 등) — 타입 정의는 있으나 시드 데이터에 미적용
- 컴포넌트 썸네일 자동 생성 — Figma Images API 호출 코드 추가됨, 검증 미실시
- 다국어 텍스트 → 캔버스 미리보기 — 번역 결과 표시 UI 단순함

### 6.6 LSP 진단 경고 (빌드는 통과)
- `Canvas.tsx:20` brandId 미사용
- `Section.tsx:18,23` isResizing/selectSlot 미사용
- 일부 다른 미사용 import 경고

---

## 7. 다음 세션 우선순위 제안

### 즉시 가능 (코드 변경 없이)
1. Figma Personal Access Token 발급 → `.env.local`에 추가 → 컴포넌트 실제 임포트 테스트
2. 관리자에서 admin 계정에 Gemini API 키 배정 → 카피라이팅 챗 동작 검증
3. 새 프로젝트 만들어서 전체 워크플로우 (블록 조합 → AI 챗 → 컨텐츠 생성 → 이미지 생성 → 번역 → 익스포트) 시연

### 단기 (1-2 세션)
1. 카피라이팅 챗에 product_info 자동 주입 검증
2. PDP 블루프린트 → 캔버스 자동 배치 검증 + 버그 수정
3. 이미지 생성 흐름 검증 + UI 개선 (현재 ImageGenPanel 사용성)
4. 다국어 번역 결과 → 캔버스 미리보기 통합
5. JPG 익스포트 동작 확인 (한글 폰트 렌더링)

### 중기 (3-5 세션)
1. Figma Plugin 빌드 + Figma에 등록 + 익스포트 동작 검증
2. 텍스트 슬롯 스타일(배경, 패딩, 라운드) 시각 편집기 추가
3. 추가 브랜드/컴포넌트 임포트 (FRAIJOUR, BAERE, ORYZA)
4. 컴포넌트 텍스트 프레이밍 자동 분류 결과 보정 워크플로우 강화
5. Vercel 배포 + 사내 테스트

### 장기
1. 멀티 사용자 협업 (동시 편집)
2. 버전 히스토리
3. 외부 사용자 배포 (멀티테넌시)

---

## 8. 주요 명령어

```bash
# 개발
pnpm dev                                    # 웹 앱 실행 (포트 3000)
pnpm --filter @evas/web typecheck           # 타입 체크
pnpm --filter @evas/web build               # 프로덕션 빌드

# Supabase 마이그레이션 (Supabase MCP 사용 권장)
# supabase/migrations/ 폴더 참고

# Git
git push origin main                        # GitHub 푸시
```

---

## 9. 주요 파일 위치 빠른 참조

### 에디터 핵심
- 캔버스: `apps/web/components/editor/Canvas.tsx`
- 섹션 (드래그/리사이즈/오토레이아웃): `apps/web/components/editor/Section.tsx`
- 인라인 텍스트: `apps/web/components/editor/TextEditor.tsx`
- 컴포넌트 팔레트: `apps/web/components/panel/ComponentPalette.tsx`

### 상태 관리
- 에디터 스토어: `apps/web/lib/store/editor-store.ts`
- 프로젝트 스토어: `apps/web/lib/store/project-store.ts`
- 자동 저장 훅: `apps/web/lib/hooks/use-auto-save.ts`

### AI 서비스
- PDP 블루프린트: `apps/web/lib/ai/pdp-service.ts`
- 이미지 생성: `apps/web/lib/ai/image-service.ts`
- 카피라이팅 에이전트: `apps/web/lib/ai/copywriting-agent.ts`
- 번역: `apps/web/lib/ai/translation-service.ts`

### Figma
- 임포트: `apps/web/lib/figma/import.ts`
- 텍스트 프레이밍: `apps/web/lib/figma/text-framing.ts`

### 관리자
- 컴포넌트 비주얼 에디터: `apps/web/app/(admin)/admin/components/[id]/component-editor.tsx`
- 사용자 관리: `apps/web/app/(admin)/admin/users/users-client.tsx`

### 타입
- 에디터: `apps/web/lib/types/editor.ts`
- 브랜드: `apps/web/lib/types/brand.ts`
- PDP: `apps/web/lib/types/pdp.ts`

---

## 10. 커밋 히스토리

```
4f8047f feat: 컴포넌트 편집기에 비주얼 WYSIWYG 에디터 통합
367cc63 feat: EVAS PDP Maker 전체 구현 (Phase 1-8)
```

---

## 11. 참조 문서

- 계획 파일: `~/.claude/plans/2026-04-11_rise-content_pdp-maker.md`
- 메모리: `~/.claude/projects/-Users-seulkiji-projects-rise-content/memory/`
  - `MEMORY.md` — 인덱스
  - `project_pdp_maker_decisions.md` — 핵심 결정사항
- PRD: `.omc/prd.json` (14개 스토리 모두 passes: true)
- 진행 로그: `.omc/progress.txt`
- 레퍼런스 코드: `pdp-maker-201/` (한이룸 PDP Maker 2.0)
