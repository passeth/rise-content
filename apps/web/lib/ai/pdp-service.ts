import { GoogleGenAI, Type } from "@google/genai";
import type {
  LandingPageBlueprint,
  SectionBlueprint,
} from "@/lib/types/pdp";
import type { AgentContext } from "@/lib/ai/copywriting-agent";

// ---------------------------------------------------------------------------
// Layout constraint types
// ---------------------------------------------------------------------------

export interface TextSlotConstraint {
  role: string; // headline | subheadline | body | caption | cta
  maxLength: number;
}

export interface LayoutConstraint {
  sectionId: string;
  sectionName: string;
  textSlots: TextSlotConstraint[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ANALYZE_MODEL = "gemini-2.5-pro-preview-05-06";

function sanitizeBase64Payload(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/^data:[^;]+;base64,(.+)$/);
  const normalized = (match ? match[1] : trimmed).replace(/\s/g, "");

  if (!normalized || !/^[A-Za-z0-9+/]+=*$/.test(normalized)) {
    throw new Error("이미지 데이터가 올바르지 않습니다.");
  }

  return normalized;
}

function normalizeMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized.startsWith("image/")) {
    throw new Error(`지원하지 않는 이미지 형식입니다: ${mimeType}`);
  }
  return normalized;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  return "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }
  return [];
}

function extractResponseText(response: { text?: string }): string {
  if (!response.text) {
    throw new Error("AI 응답이 비어 있습니다.");
  }

  let text = response.text.trim();
  if (text.startsWith("```json")) {
    text = text.slice(7);
  } else if (text.startsWith("```")) {
    text = text.slice(3);
  }
  if (text.endsWith("```")) {
    text = text.slice(0, -3);
  }

  const normalized = text.trim().replace(/^\uFEFF/, "");
  return extractJsonCandidate(normalized) ?? normalized;
}

function extractJsonCandidate(input: string): string | null {
  if (!input) return null;

  const objectStart = input.indexOf("{");
  const arrayStart = input.indexOf("[");
  const candidates = [objectStart, arrayStart].filter((v) => v >= 0);

  if (!candidates.length) return null;

  const startIndex = Math.min(...candidates);

  for (let endIndex = input.length; endIndex > startIndex; endIndex -= 1) {
    const candidate = input.slice(startIndex, endIndex).trim();
    if (!candidate) continue;
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core prompt builder — PRESERVED from reference pdp.service.ts
// ---------------------------------------------------------------------------

function buildAnalyzePrompt(
  additionalInfo?: string,
  desiredTone?: string
): string {
  return `
이 제품 이미지를 분석하여 4~6개의 핵심 섹션으로 구성된 상세페이지 전체 블루프린트를 설계해주세요.
${additionalInfo ? `[사용자 추가 정보]: ${additionalInfo}` : ""}
${desiredTone ? `[원하는 디자인 톤]: ${desiredTone}` : ""}

# 섹션 템플릿(필수 필드)
- section_id: S1~S6
- section_name: (예: 히어로/체크리스트/베네핏/근거/사용법/후기 등)
- goal: 이 섹션의 역할(짧은 한 문장)
- headline: 한국어 1줄(강하게)
- headline_en: headline의 자연스러운 영어 번역 1줄
- subheadline: 한국어 1줄(명확하게)
- subheadline_en: subheadline의 자연스러운 영어 번역 1줄
- bullets: 한국어 3개(스캔용, 각 1줄)
- bullets_en: bullets의 자연스러운 영어 번역 3개
- trust_or_objection_line: 한국어 불안 제거/신뢰 1문장
- trust_or_objection_line_en: trust_or_objection_line의 자연스러운 영어 번역 1문장
- CTA: (있으면) 한국어 1줄
- CTA_en: CTA의 자연스러운 영어 번역 1줄
- layout_notes: 이미지 레이아웃 지시(짧게)
- compliance_notes: 카테고리별 규제/표현 주의(짧게)

# 섹션 구성 원칙(강제)
- 베네핏은 3개 고정
- 근거 섹션은 반드시 결과→조건→해석 3단으로 작성
- 리뷰 섹션은 전/후 사진보다 사용감 문장 후기 카드 6~12개 우선
- 사용법/루틴은 선택지를 2~3개로 줄여 선택 피로를 없앨 것
- CTA는 최소 2회 이상 배치
- 각 섹션의 이미지는 단순한 제품 누끼나 그래픽이 아닌 소비자의 구매 전환을 유도할 수 있는 고품질 광고 사진 느낌으로 기획할 것
- 첫 번째 섹션은 구매 전환에 가장 중요하므로 반드시 매력적인 모델이 제품과 함께 연출된 컷으로 프롬프트를 작성할 것
- 각 섹션 이미지는 해당 헤드라인과 서브헤드라인의 메시지를 시각적으로 전달해야 함

# 섹션별 이미지 생성 프롬프트
- image_id: IMG_S1~IMG_S6
- purpose: 이 이미지가 전달해야 하는 메시지(짧은 한 문장)
- prompt_ko: 한국어 이미지 생성 프롬프트(1~2문장). 구도, 거리감, 시선 높이, 제품이 프레임에서 차지하는 비중을 함께 명시할 것.
- prompt_en: 영어 프롬프트(실제 이미지 생성용). Include composition, framing distance, camera angle, product prominence, and the key subject action. Keep it neutral enough that studio/lifestyle/outdoor priority can still be controlled at generation time.
- negative_prompt: 피해야 할 요소
- style_guide: 전체 통일 스타일. 스튜디오는 정제된 세트/조명/질감, 라이프스타일은 현실감 있는 공간/행동, 아웃도어는 위치감/공기감/활동성을 분명히 적을 것. 이 값은 디자인 가이드 우선 모드에서만 강하게 적용될 수 있도록 작성할 것.
- reference_usage: 업로드된 기존 제품 이미지를 어떻게 참고할지. 제품 형태, 라벨, 재질, 색감을 유지하는 기준을 명시할 것.
- section_name, goal, layout_notes, compliance_notes, purpose, style_guide, reference_usage는 반드시 한국어로 작성할 것
- 영어는 *_en 필드와 prompt_en에만 사용할 것

# 이미지 생성 공통 규칙
- 세로형 상세페이지용
- 이미지 내에 텍스트, 로고, 워터마크, 글자를 넣지 말 것
- 배경은 단순하게 유지하고 제품/핵심 오브젝트에 시선을 집중시킬 것
- 한 장에 메시지 하나만 전달할 것
- 규제 리스크가 있으면 안전한 표현으로 수정할 것
- JSON 외 텍스트를 붙이지 말고 모든 필드는 간결하게 작성할 것

응답은 반드시 제공된 JSON 스키마를 준수해야 합니다.
`.trim();
}

// ---------------------------------------------------------------------------
// Agent context injection
// ---------------------------------------------------------------------------

function buildAgentContextBlock(ctx: AgentContext): string {
  const lines: string[] = ["# AI 에이전트 컨텍스트 (카피라이팅 방향)"];
  if (ctx.mainCopy) lines.push(`- 메인 카피: ${ctx.mainCopy}`);
  if (ctx.tagline) lines.push(`- 태그라인: ${ctx.tagline}`);
  if (ctx.usp && ctx.usp.length > 0)
    lines.push(`- USP: ${ctx.usp.join(" / ")}`);
  if (ctx.designMood) lines.push(`- 디자인 무드: ${ctx.designMood}`);
  if (ctx.toneAndManner) lines.push(`- 톤앤매너: ${ctx.toneAndManner}`);
  lines.push(
    "위 카피 방향을 섹션 헤드라인, 서브헤드라인, CTA에 반영하세요."
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Layout-aware prompt extension (exported for testing / reuse)
// ---------------------------------------------------------------------------

export function buildLayoutAwarePrompt(
  basePrompt: string,
  layoutConstraints: LayoutConstraint[]
): string {
  if (!layoutConstraints.length) return basePrompt;

  const lines: string[] = [
    "",
    "# 레이아웃 제약 조건",
    "다음 섹션과 텍스트 슬롯에 맞게 컨텐츠를 생성하세요:",
    "",
  ];

  layoutConstraints.forEach((constraint, index) => {
    lines.push(`섹션 ${index + 1} "${constraint.sectionName}":`);
    constraint.textSlots.forEach((slot) => {
      lines.push(`- ${slot.role}: 최대 ${slot.maxLength}자`);
    });
    lines.push("");
  });

  lines.push("각 텍스트는 지정된 글자수를 초과하지 마세요.");

  return `${basePrompt}\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function normalizeSection(
  section: Partial<SectionBlueprint>,
  index: number
): SectionBlueprint {
  return {
    section_id: asString(section.section_id) || `S${index + 1}`,
    section_name: asString(section.section_name) || `섹션 ${index + 1}`,
    goal: asString(section.goal),
    headline: asString(section.headline),
    headline_en: asString(section.headline_en) || asString(section.headline),
    subheadline: asString(section.subheadline),
    subheadline_en:
      asString(section.subheadline_en) || asString(section.subheadline),
    bullets: Array.isArray(section.bullets)
      ? section.bullets.map((item) => asString(item)).filter(Boolean)
      : [],
    bullets_en: Array.isArray(section.bullets_en)
      ? section.bullets_en.map((item) => asString(item)).filter(Boolean)
      : Array.isArray(section.bullets)
      ? section.bullets.map((item) => asString(item)).filter(Boolean)
      : [],
    trust_or_objection_line: asString(section.trust_or_objection_line),
    trust_or_objection_line_en:
      asString(section.trust_or_objection_line_en) ||
      asString(section.trust_or_objection_line),
    CTA: asString(section.CTA),
    CTA_en: asString(section.CTA_en) || asString(section.CTA),
    layout_notes: asString(section.layout_notes),
    compliance_notes: asString(section.compliance_notes),
    image_id: asString(section.image_id) || `IMG_S${index + 1}`,
    purpose: asString(section.purpose),
    prompt_ko: asString(section.prompt_ko),
    prompt_en: asString(section.prompt_en),
    negative_prompt: asString(section.negative_prompt),
    style_guide: asString(section.style_guide),
    reference_usage: asString(section.reference_usage),
    generatedImage: section.generatedImage,
  };
}

function sanitizeBlueprint(input: Partial<LandingPageBlueprint>): LandingPageBlueprint {
  const sections = Array.isArray(input.sections)
    ? input.sections.map((section, index) =>
        normalizeSection(section as Partial<SectionBlueprint>, index)
      )
    : [];

  return {
    executiveSummary: asString(input.executiveSummary),
    scorecard: Array.isArray(input.scorecard)
      ? input.scorecard.map((item) => ({
          category: asString((item as unknown as Record<string, unknown>)?.category),
          score: asString((item as unknown as Record<string, unknown>)?.score),
          reason: asString((item as unknown as Record<string, unknown>)?.reason),
        }))
      : [],
    blueprintList: Array.isArray(input.blueprintList)
      ? input.blueprintList.map((item) => asString(item)).filter(Boolean)
      : sections.map((s) => s.section_name),
    sections,
  };
}

function parseBlueprintResponse(response: { text?: string }): LandingPageBlueprint {
  try {
    const parsed = JSON.parse(
      extractResponseText(response)
    ) as Partial<LandingPageBlueprint>;
    return sanitizeBlueprint(parsed);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`AI 응답을 해석하지 못했습니다: ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Gemini response schema
// ---------------------------------------------------------------------------

const BLUEPRINT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: { type: Type.STRING },
    scorecard: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          score: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
      },
    },
    blueprintList: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          section_id: { type: Type.STRING },
          section_name: { type: Type.STRING },
          goal: { type: Type.STRING },
          headline: { type: Type.STRING },
          headline_en: { type: Type.STRING },
          subheadline: { type: Type.STRING },
          subheadline_en: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
          bullets_en: { type: Type.ARRAY, items: { type: Type.STRING } },
          trust_or_objection_line: { type: Type.STRING },
          trust_or_objection_line_en: { type: Type.STRING },
          CTA: { type: Type.STRING },
          CTA_en: { type: Type.STRING },
          layout_notes: { type: Type.STRING },
          compliance_notes: { type: Type.STRING },
          image_id: { type: Type.STRING },
          purpose: { type: Type.STRING },
          prompt_ko: { type: Type.STRING },
          prompt_en: { type: Type.STRING },
          negative_prompt: { type: Type.STRING },
          style_guide: { type: Type.STRING },
          reference_usage: { type: Type.STRING },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// PdpService
// ---------------------------------------------------------------------------

export class PdpService {
  async analyzeProduct(params: {
    imageBase64: string;
    mimeType: string;
    additionalInfo?: string;
    desiredTone?: string;
    agentContext?: Record<string, unknown>;
    layoutConstraints?: LayoutConstraint[];
    geminiApiKey: string;
  }): Promise<{ blueprint: LandingPageBlueprint }> {
    const {
      imageBase64,
      mimeType,
      additionalInfo,
      desiredTone,
      agentContext,
      layoutConstraints,
      geminiApiKey,
    } = params;

    const apiKey = geminiApiKey.trim();
    if (!apiKey) {
      throw new Error(
        "설정 메뉴에서 본인 Gemini API 키를 입력해 주세요."
      );
    }

    const normalizedImage = sanitizeBase64Payload(imageBase64);
    const normalizedMime = normalizeMimeType(mimeType);

    // 1. Build base analyze prompt
    let prompt = buildAnalyzePrompt(additionalInfo, desiredTone);

    // 2. Inject agent context if provided
    if (agentContext && Object.keys(agentContext).length > 0) {
      const ctx: AgentContext = {
        mainCopy: asString(agentContext.mainCopy),
        tagline: asString(agentContext.tagline),
        usp: asStringArray(agentContext.usp),
        designMood: asString(agentContext.designMood),
        toneAndManner: asString(agentContext.toneAndManner),
      };
      const hasContent =
        ctx.mainCopy ||
        ctx.tagline ||
        (ctx.usp && ctx.usp.length > 0) ||
        ctx.designMood ||
        ctx.toneAndManner;
      if (hasContent) {
        prompt = `${prompt}\n\n${buildAgentContextBlock(ctx)}`;
      }
    }

    // 3. Append layout constraints if provided
    if (layoutConstraints && layoutConstraints.length > 0) {
      prompt = buildLayoutAwarePrompt(prompt, layoutConstraints);
    }

    // 4. Call Gemini
    const client = new GoogleGenAI({ apiKey, apiVersion: "v1alpha" });

    const response = await client.models.generateContent({
      model: ANALYZE_MODEL,
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: normalizedMime,
                data: normalizedImage,
              },
            },
            { text: prompt },
          ],
        },
      ] as Parameters<typeof client.models.generateContent>[0]["contents"],
      config: {
        responseMimeType: "application/json",
        responseSchema: BLUEPRINT_RESPONSE_SCHEMA,
      },
    });

    // 5. Parse and return
    const blueprint = parseBlueprintResponse(response);

    return { blueprint };
  }
}
