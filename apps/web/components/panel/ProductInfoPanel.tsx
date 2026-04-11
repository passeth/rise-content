"use client";

import { useCallback, useRef } from "react";
import { useProjectStore } from "@/lib/store/project-store";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

interface ProductInfoPanelProps {
  projectId: string;
}

export function ProductInfoPanel({ projectId }: ProductInfoPanelProps) {
  const { currentProject, updateProductInfo } = useProjectStore();
  const productInfo = currentProject?.productInfo ?? {};
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (field: string, value: string) => {
      updateProductInfo({ [field]: value });
    },
    [updateProductInfo]
  );

  const handleBlur = useCallback(
    async (field: string, value: string) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(async () => {
        const supabase = createClient();
        await supabase
          .from("projects")
          .update({
            product_info: {
              ...productInfo,
              [field]: value,
            },
          })
          .eq("id", projectId);
      }, 300);
    },
    [projectId, productInfo]
  );

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">제품명</label>
        <Input
          value={(productInfo.productName as string) ?? ""}
          onChange={(e) => handleChange("productName", e.target.value)}
          onBlur={(e) => handleBlur("productName", e.target.value)}
          placeholder="제품명을 입력하세요"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          영문 제품명
        </label>
        <Input
          value={(productInfo.productNameEn as string) ?? ""}
          onChange={(e) => handleChange("productNameEn", e.target.value)}
          onBlur={(e) => handleBlur("productNameEn", e.target.value)}
          placeholder="Product name in English"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">메인 컨셉</label>
        <Textarea
          rows={2}
          value={(productInfo.mainConcept as string) ?? ""}
          onChange={(e) => handleChange("mainConcept", e.target.value)}
          onBlur={(e) => handleBlur("mainConcept", e.target.value)}
          placeholder="제품의 핵심 컨셉을 입력하세요"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">전성분</label>
        <Textarea
          rows={4}
          value={(productInfo.ingredients as string) ?? ""}
          onChange={(e) => handleChange("ingredients", e.target.value)}
          onBlur={(e) => handleBlur("ingredients", e.target.value)}
          placeholder="INCI 이름 형식으로 입력"
        />
      </div>
    </div>
  );
}
