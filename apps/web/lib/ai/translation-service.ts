import { GoogleGenAI } from "@google/genai";

export interface TranslationInput {
  sections: Array<{
    sectionId: string;
    texts: Array<{ role: string; content: string; contentEn?: string }>;
  }>;
  protectedTerms: string[];
}

export interface TranslationOutput {
  sections: Array<{
    sectionId: string;
    texts: Array<{ role: string; content: string }>;
  }>;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  vi: "Vietnamese",
  ru: "Russian",
};

const TRANSLATION_MODEL = "gemini-2.0-flash";

function buildTranslationPrompt(
  input: TranslationInput,
  targetLanguage: string
): string {
  const languageName = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;

  const protectedBlock =
    input.protectedTerms.length > 0
      ? `\n# Protected Terms (do NOT translate — keep exactly as-is)\n${input.protectedTerms.map((t) => `- ${t}`).join("\n")}`
      : "";

  const sectionsBlock = JSON.stringify(
    input.sections.map((section) => ({
      sectionId: section.sectionId,
      texts: section.texts.map((t) => ({
        role: t.role,
        // Prefer English source for higher-quality translation; fall back to Korean
        source: t.contentEn && t.contentEn.trim() ? t.contentEn : t.content,
      })),
    })),
    null,
    2
  );

  return `You are a professional cosmetics marketing copywriter and translator.
Translate the following product detail page (PDP) copy into ${languageName}.

# Rules
- Use proper ${languageName} cosmetics/beauty industry terminology.
- Maintain the emotional tone and marketing intent of each text.
- Keep sentence length appropriate for each role (headline: short/punchy, body: full sentences, cta: imperative).
- Do NOT translate any of the protected terms listed below — leave them exactly as provided.
- Return ONLY valid JSON matching the output schema. No extra text.
${protectedBlock}

# Input sections (source texts)
${sectionsBlock}

# Output schema
Return JSON with this exact structure:
{
  "sections": [
    {
      "sectionId": "<same sectionId as input>",
      "texts": [
        { "role": "<same role as input>", "content": "<translated text>" }
      ]
    }
  ]
}`.trim();
}

function extractJsonText(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```json")) text = text.slice(7);
  else if (text.startsWith("```")) text = text.slice(3);
  if (text.endsWith("```")) text = text.slice(0, -3);
  text = text.trim().replace(/^\uFEFF/, "");

  // Extract the first valid JSON object/array
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");
  const candidates = [objStart, arrStart].filter((v) => v >= 0);
  if (!candidates.length) return text;

  const startIndex = Math.min(...candidates);
  for (let end = text.length; end > startIndex; end--) {
    const candidate = text.slice(startIndex, end).trim();
    if (!candidate) continue;
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return text;
}

function parseTranslationResponse(responseText: string): TranslationOutput {
  const jsonText = extractJsonText(responseText);
  const parsed = JSON.parse(jsonText) as Partial<TranslationOutput>;

  if (!Array.isArray(parsed.sections)) {
    throw new Error("번역 응답 형식이 올바르지 않습니다.");
  }

  return {
    sections: parsed.sections.map((section) => ({
      sectionId: String(section.sectionId ?? ""),
      texts: Array.isArray(section.texts)
        ? section.texts.map((t) => ({
            role: String((t as { role?: unknown }).role ?? ""),
            content: String((t as { content?: unknown }).content ?? ""),
          }))
        : [],
    })),
  };
}

export class TranslationService {
  async translate(params: {
    input: TranslationInput;
    targetLanguage: string;
    geminiApiKey: string;
  }): Promise<TranslationOutput> {
    const { input, targetLanguage, geminiApiKey } = params;

    const apiKey = geminiApiKey.trim();
    if (!apiKey) {
      throw new Error("설정 메뉴에서 본인 Gemini API 키를 입력해 주세요.");
    }

    if (!LANGUAGE_NAMES[targetLanguage]) {
      throw new Error(`지원하지 않는 언어입니다: ${targetLanguage}`);
    }

    const prompt = buildTranslationPrompt(input, targetLanguage);

    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
      model: TRANSLATION_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text ?? "";
    if (!responseText) {
      throw new Error("AI 번역 응답이 비어 있습니다.");
    }

    return parseTranslationResponse(responseText);
  }
}
