import type { LandingPageBlueprint, SectionBlueprint } from "@/lib/types/pdp";
import type { CanvasSection, TextSlotInstance } from "@/lib/types/editor";

/**
 * Maps AI-generated blueprint content onto canvas text slots.
 *
 * Matching strategy: blueprint sections are matched to canvas sections by
 * order (S1 → first canvas section sorted by `order`, S2 → second, etc.).
 * Returns a new array — input is not mutated.
 */
export function placeContentOnCanvas(
  blueprint: LandingPageBlueprint,
  sections: CanvasSection[]
): CanvasSection[] {
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  return sortedSections.map((canvasSection, index) => {
    const blueprintSection: SectionBlueprint | undefined =
      blueprint.sections[index];

    if (!blueprintSection) {
      return canvasSection;
    }

    const updatedTextSlots = canvasSection.textSlots.map(
      (slot: TextSlotInstance) => {
        const content = resolveContentForRole(slot.role, blueprintSection);

        if (content === null) {
          return slot;
        }

        const truncated =
          slot.maxLength && content.length > slot.maxLength
            ? content.slice(0, slot.maxLength)
            : content;

        return { ...slot, content: truncated };
      }
    );

    return { ...canvasSection, textSlots: updatedTextSlots };
  });
}

function resolveContentForRole(
  role: TextSlotInstance["role"],
  section: SectionBlueprint
): string | null {
  switch (role) {
    case "headline":
      return section.headline || null;
    case "subheadline":
      return section.subheadline || null;
    case "body":
      return section.bullets.length > 0
        ? section.bullets.join("\n")
        : section.trust_or_objection_line || null;
    case "caption":
      return section.trust_or_objection_line || null;
    case "cta":
      return section.CTA || null;
    default:
      return null;
  }
}
