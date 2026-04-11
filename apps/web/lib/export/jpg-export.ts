import type { CanvasSection } from "@/lib/types/editor";

export async function exportSectionsAsJpg(
  containerRef: HTMLElement,
  projectName: string,
  language?: string
): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;
  const JSZip = (await import("jszip")).default;

  const sectionElements = containerRef.querySelectorAll<HTMLElement>(
    "[data-section-id]"
  );

  if (sectionElements.length === 0) {
    throw new Error("내보낼 섹션을 찾을 수 없습니다.");
  }

  const zip = new JSZip();
  const lang = language ?? "ko";

  for (let i = 0; i < sectionElements.length; i++) {
    const el = sectionElements[i];
    const canvas = await html2canvas(el, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      scale: 2,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("이미지 변환 실패"));
        },
        "image/jpeg",
        0.92
      );
    });

    const fileName = `${projectName}_${lang}_${i + 1}.jpg`;
    zip.file(fileName, blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${projectName}_${lang}_export.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
