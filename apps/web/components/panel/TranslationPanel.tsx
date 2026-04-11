"use client";

import { useCallback, useState } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

interface TranslationPanelProps {
  projectId: string;
}

type LangCode = "ko" | "en" | "zh" | "ja" | "vi" | "ru";

interface LangTab {
  code: LangCode;
  label: string;
}

const LANG_TABS: LangTab[] = [
  { code: "ko", label: "한국어(원본)" },
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "ru", label: "Русский" },
];

interface TranslatedSection {
  sectionId: string;
  texts: Array<{ role: string; content: string }>;
}

interface TranslationData {
  sections: TranslatedSection[];
}

type TranslationsMap = Partial<Record<LangCode, TranslationData>>;

// Editable text for a given language
type EditableMap = Partial<
  Record<LangCode, Record<string, Record<string, string>>>
>;

export function TranslationPanel({ projectId }: TranslationPanelProps) {
  const sections = useEditorStore((s) => s.sections);

  const [activeTab, setActiveTab] = useState<LangCode>("ko");
  const [translations, setTranslations] = useState<TranslationsMap>({});
  const [editables, setEditables] = useState<EditableMap>({});
  const [loading, setLoading] = useState<Partial<Record<LangCode, boolean>>>({});
  const [saving, setSaving] = useState<Partial<Record<LangCode, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<LangCode, string>>>({});
  const [savedLangs, setSavedLangs] = useState<Partial<Record<LangCode, boolean>>>({});

  // Build protected terms display — fetched from brand in the API; we show
  // what we know locally (brand terms come back with the translation response).
  const [protectedTerms, setProtectedTerms] = useState<string[]>([]);

  const handleTranslate = useCallback(
    async (lang: LangCode) => {
      setLoading((prev) => ({ ...prev, [lang]: true }));
      setErrors((prev) => ({ ...prev, [lang]: undefined }));

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, targetLanguage: lang }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          translation?: { sections: TranslatedSection[] };
          protectedTerms?: string[];
          error?: string;
        };

        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "번역 중 오류가 발생했습니다.");
        }

        if (data.translation) {
          setTranslations((prev) => ({ ...prev, [lang]: data.translation }));

          // Populate editable map from response
          const editable: Record<string, Record<string, string>> = {};
          for (const section of data.translation.sections) {
            editable[section.sectionId] = {};
            for (const text of section.texts) {
              editable[section.sectionId][text.role] = text.content;
            }
          }
          setEditables((prev) => ({ ...prev, [lang]: editable }));
        }

        if (data.protectedTerms && data.protectedTerms.length > 0) {
          setProtectedTerms(data.protectedTerms);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "번역 중 오류가 발생했습니다.";
        setErrors((prev) => ({ ...prev, [lang]: message }));
      } finally {
        setLoading((prev) => ({ ...prev, [lang]: false }));
      }
    },
    [projectId]
  );

  const handleSave = useCallback(
    async (lang: LangCode) => {
      const langEditables = editables[lang];
      if (!langEditables) return;

      setSaving((prev) => ({ ...prev, [lang]: true }));
      setErrors((prev) => ({ ...prev, [lang]: undefined }));

      // Build updated translation from editable state
      const updatedSections: TranslatedSection[] = Object.entries(
        langEditables
      ).map(([sectionId, roles]) => ({
        sectionId,
        texts: Object.entries(roles).map(([role, content]) => ({
          role,
          content,
        })),
      }));

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            targetLanguage: lang,
            overrideTranslation: { sections: updatedSections },
          }),
        });

        const data = (await res.json()) as { ok?: boolean; error?: string };

        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "저장 중 오류가 발생했습니다.");
        }

        setSavedLangs((prev) => ({ ...prev, [lang]: true }));
        setTimeout(
          () => setSavedLangs((prev) => ({ ...prev, [lang]: false })),
          2000
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
        setErrors((prev) => ({ ...prev, [lang]: message }));
      } finally {
        setSaving((prev) => ({ ...prev, [lang]: false }));
      }
    },
    [projectId, editables]
  );

  const handleEditChange = useCallback(
    (lang: LangCode, sectionId: string, role: string, value: string) => {
      setEditables((prev) => ({
        ...prev,
        [lang]: {
          ...prev[lang],
          [sectionId]: {
            ...(prev[lang]?.[sectionId] ?? {}),
            [role]: value,
          },
        },
      }));
    },
    []
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Protected terms */}
      {protectedTerms.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">
            보호 용어 (번역 제외)
          </p>
          <div className="flex flex-wrap gap-1">
            {protectedTerms.map((term) => (
              <span
                key={term}
                className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
              >
                {term}
              </span>
            ))}
          </div>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as LangCode)}
      >
        <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0">
          {LANG_TABS.map((tab) => (
            <TabsTrigger
              key={tab.code}
              value={tab.code}
              className="text-xs"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Korean — read-only preview from canvas */}
        <TabsContent value="ko" className="mt-3">
          <div className="flex flex-col gap-3">
            {sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                캔버스에 섹션이 없습니다.
              </p>
            ) : (
              sections.map((section) => (
                <div
                  key={section.id}
                  className="rounded-md border border-border p-3"
                >
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    섹션: {section.id}
                  </p>
                  {section.textSlots.map((slot) => (
                    <div key={slot.id} className="mb-1">
                      <span className="mr-1 text-xs text-muted-foreground">
                        [{slot.role}]
                      </span>
                      <span className="text-sm">{slot.content}</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Translation tabs */}
        {LANG_TABS.filter((t) => t.code !== "ko").map((tab) => {
          const lang = tab.code;
          const translation = translations[lang];
          const langEditables = editables[lang];
          const isLoading = loading[lang] ?? false;
          const isSaving = saving[lang] ?? false;
          const error = errors[lang];
          const wasSaved = savedLangs[lang] ?? false;

          return (
            <TabsContent key={lang} value={lang} className="mt-3">
              {error && (
                <div className="mb-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              {!translation && !isLoading && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <p className="text-sm text-muted-foreground">
                    아직 {tab.label} 번역이 없습니다.
                  </p>
                  <button
                    onClick={() => void handleTranslate(lang)}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    번역 생성
                  </button>
                </div>
              )}

              {isLoading && (
                <div className="flex flex-col items-center gap-2 py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">
                    번역 중...
                  </p>
                </div>
              )}

              {translation && langEditables && !isLoading && (
                <div className="flex flex-col gap-3">
                  {translation.sections.map((section) => (
                    <div
                      key={section.sectionId}
                      className="rounded-md border border-border p-3"
                    >
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">
                        섹션: {section.sectionId}
                      </p>
                      {section.texts.map((text) => (
                        <div key={text.role} className="mb-2">
                          <label className="mb-0.5 block text-xs text-muted-foreground">
                            [{text.role}]
                          </label>
                          <textarea
                            value={
                              langEditables[section.sectionId]?.[text.role] ??
                              text.content
                            }
                            onChange={(e) =>
                              handleEditChange(
                                lang,
                                section.sectionId,
                                text.role,
                                e.target.value
                              )
                            }
                            rows={2}
                            className="w-full resize-y rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleTranslate(lang)}
                      disabled={isLoading}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      재번역
                    </button>
                    <button
                      onClick={() => void handleSave(lang)}
                      disabled={isSaving}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isSaving ? "저장 중..." : wasSaved ? "저장됨" : "저장"}
                    </button>
                  </div>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
