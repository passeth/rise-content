# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

EVAS Cosmetics 상세페이지(PDP) 제작 도구. 제품 이미지를 업로드하면 Gemini AI가 상세페이지 구조(블루프린트)를 설계하고, 섹션별 이미지를 생성한다.

레퍼런스 구현체: `pdp-maker-201/` (한이룸 PDP Maker 2.0)

## 모노레포 구조

```
rise-content/
├── apps/web              # @evas/web — Next.js 14 App Router (포트 3000)
│   ├── app/              # App Router 페이지 및 API routes
│   ├── components/
│   │   ├── editor/       # Toolbar, Canvas 등 에디터 컴포넌트
│   │   ├── panel/        # 사이드 패널 컴포넌트
│   │   └── ui/           # shadcn/ui 공용 컴포넌트 (error-boundary 포함)
│   └── lib/
│       ├── export/       # jpg-export.ts, figma-export.ts
│       ├── store/        # Zustand stores (editor-store, project-store)
│       ├── types/        # editor.ts 등 타입 정의
│       └── hooks/        # use-auto-save, use-canvas-loader 등
├── apps/figma-plugin/    # Figma 플러그인 (manifest.json, code.ts, ui.html)
└── supabase/             # Supabase 마이그레이션
```

- 패키지 매니저: **pnpm** (workspace), `pnpm-workspace.yaml`로 `apps/*` 관리
- 경로 alias: `@/*` → `apps/web/` 내부 절대 경로

## 명령어

```bash
# 전체
pnpm install
pnpm dev              # web + api 동시 실행 (--parallel)
pnpm build            # 전체 빌드
pnpm run typecheck    # 전체 tsc --noEmit

# 개별 앱
pnpm --filter @runacademy/web dev
pnpm --filter @runacademy/api dev

# API 테스트
cd apps/api && node --import tsx --test src/**/*.test.ts

# 타입체크 (개별)
pnpm --filter @runacademy/web typecheck
pnpm --filter @runacademy/api typecheck
```

## 아키텍처

### API (`apps/api`)
- **프레임워크 없이** 순수 `http.createServer`로 라우팅 (NestJS는 devDep으로만 존재, 실제 미사용)
- 라우팅: `src/main.ts`에서 pathname 매칭으로 직접 분기
- 핵심 모듈: `src/modules/pdp/` — PdpService가 Gemini API 호출 담당
  - `analyzeProduct`: 제품 이미지 → 블루프린트(섹션 구조 + 카피) 생성 (gemini-3.1-pro-preview)
  - `generateSectionImage`: 블루프린트 섹션별 이미지 생성 (gemini-3-pro-image-preview)
  - 레퍼런스 모델 이미지 지원: 얼굴 프로필 추출 → 일관성 검증 + 재시도 루프
- 환경변수: `.env` 또는 루트 `../../.env`에서 `process.loadEnvFile`로 로드
- CORS: 전체 허용 (`*`)
- Gemini API 키: 서버 환경변수 또는 클라이언트 `X-Gemini-Api-Key` 헤더 오버라이드

### Web (`apps/web`)
- Next.js 14 App Router + Tailwind CSS + shadcn/ui 컴포넌트
- 주 진입점: `/pdp-maker` — `PdpMakerClient` (클라이언트 컴포넌트)
- API Route (`app/api/pdp/`): analyze, images, validate-key — 서버사이드 프록시
- 클라이언트 설정: localStorage에 Gemini API 키 저장 (`pdp-settings.ts`)
- Tailwind: CSS 변수 기반 테마 (`--background`, `--foreground`, `--primary` 등)

### Shared (`packages/shared`)
- PDP 타입 정의: `SectionBlueprint`, `LandingPageBlueprint`, `GeneratedResult`, Request/Response 타입
- ESM (`"type": "module"`) — import 시 `.js` 확장자 사용

## PDP 핵심 플로우

1. 사용자가 제품 이미지 업로드 (+ 선택적 모델 레퍼런스 이미지)
2. `/v1/pdp/analyze` → Gemini로 블루프린트 생성 (섹션 구조, 카피, 이미지 프롬프트)
3. 블루프린트 편집 UI에서 섹션별 `/v1/pdp/images` → Gemini로 섹션 이미지 생성
4. 결과물 ZIP 다운로드 (html2canvas + jszip)

## Git 전략

- 듀얼 리모트: `origin` (pdp-maker-202, Vercel 배포), `local201` (pdp-maker-201, 동기화)
- `pnpm run push:all` — 두 리모트에 동시 push
- 커밋 전 `pnpm run typecheck` 통과 필수

## Supabase 프로젝트

| 프로젝트 | 용도 | Ref |
|----------|------|-----|
| **content** | PDP Maker (상세페이지 제작) | ketyyrhkhfqecucsidfv |

- `.env.local`에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY 설정
- 이미지 저장: Supabase Storage (product-images, generated-images, reference-images)
- RBAC: profiles.role (admin/editor/viewer), RLS 전체 적용

## 주의사항

- API는 NestJS처럼 보이지만 실제로는 순수 HTTP 서버 — NestJS 패턴(데코레이터, 모듈 시스템) 사용하지 않음
- `apps/web`의 `@runacademy/shared`는 workspace 패키지가 아닌 `lib/shared/`로 리맵됨 (tsconfig paths)
- tennis, editorial, hanirum 라우트는 별도 실험 — PDP 작업 시 무시
