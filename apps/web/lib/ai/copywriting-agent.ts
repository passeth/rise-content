export const BRAND_EXPERT_SYSTEM_PROMPT = `당신은 EVAS Cosmetics의 브랜드 전문가입니다. 화장품 상세페이지 제작을 위한 카피라이팅과 컨셉 개발을 도와줍니다.

역할:
- 제품의 USP(Unique Selling Proposition)를 발견하고 정리
- 타겟 고객의 피부 고민과 니즈를 분석
- 컨버전을 극대화하는 메인 카피, 태그라인 제안
- 디자인 무드와 톤앤매너 방향 제시
- 화장품 광고법/표시법 규제를 고려한 안전한 표현 사용

대화 원칙:
- 한 번에 1-2개 질문만 (질문 폭탄 금지)
- 구체적인 예시와 함께 제안
- 사용자의 답변을 바탕으로 점진적으로 컨셉 구체화
- 최종적으로 메인 카피, 태그라인, USP, 디자인 무드, 톤앤매너를 정리`;

export interface AgentContext {
  mainCopy: string;
  tagline: string;
  usp: string[];
  designMood: string;
  toneAndManner: string;
}

export const SUMMARIZE_PROMPT = `지금까지의 대화를 바탕으로 다음 항목을 JSON으로 정리해주세요:
{
  "mainCopy": "메인 카피 (한 줄)",
  "tagline": "태그라인 (한 줄)",
  "usp": ["USP 1", "USP 2", "USP 3"],
  "designMood": "디자인 무드 설명",
  "toneAndManner": "톤앤매너 설명"
}
JSON만 반환하세요.`;

export function buildChatMessages(
  history: { role: string; content: string }[],
  productInfo: Record<string, string>,
  newMessage: string
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  // System prompt as first user message (Gemini doesn't have a system role in history)
  const hasProductInfo =
    productInfo &&
    Object.values(productInfo).some((v) => v && v.trim() !== "");

  if (hasProductInfo) {
    const productContext = Object.entries(productInfo)
      .filter(([, v]) => v && v.trim() !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    messages.push({
      role: "user",
      content: `[제품 정보]\n${productContext}\n\n위 제품에 대한 상세페이지 제작을 도와주세요.`,
    });
    messages.push({
      role: "model",
      content:
        "제품 정보를 확인했습니다. 상세페이지 제작을 위한 컨셉 개발을 시작하겠습니다. 어떤 부분부터 시작할까요?",
    });
  }

  // Add conversation history
  for (const msg of history) {
    messages.push({
      role: msg.role === "assistant" ? "model" : msg.role,
      content: msg.content,
    });
  }

  // Add new user message
  messages.push({ role: "user", content: newMessage });

  return messages;
}
