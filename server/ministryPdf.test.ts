import { describe, expect, it } from "vitest";
import { getMinistryCardPdfImageBounds, getMinistryCardPdfOptions, getMinistryPdfCompatibilityCss, MINISTRY_CARD_PDF_FORMAT } from "../client/src/lib/ministryPdf";
import { getMinistryPdfAssetKey } from "../shared/ministryPdfAssets";

describe("تصدير PDF لكرت وزارة الصحة", () => {
  it("يعتمد المقاس الفعلي لكرت الوزارة 19.7 × 25 سم", () => {
    expect(MINISTRY_CARD_PDF_FORMAT).toEqual([197, 250]);
    expect(getMinistryCardPdfOptions()).toMatchObject({ orientation: "portrait", unit: "mm", format: [197, 250], compress: true });
    expect(getMinistryCardPdfImageBounds()).toEqual({ x: 0, y: 0, widthMm: 197, heightMm: 250 });
  });

  it("يحدد صور الوجهين المعتمدة لتصدير الصيدلية والمخزن", () => {
    expect(getMinistryPdfAssetKey("pharmacy", "front")).toBe("ministry-pharmacy-front_3d76d2a8.jpg");
    expect(getMinistryPdfAssetKey("pharmacy", "back")).toBe("ministry-pharmacy-back_f1bff011.jpg");
    expect(getMinistryPdfAssetKey("warehouse", "front")).toBe("ministry-warehouse-front-new_85a339f3.jpg");
    expect(getMinistryPdfAssetKey("warehouse", "back")).toBe("ministry-warehouse-back_fa9fb19f.jpg");
  });

  it("يجهز نسخة تصدير بألوان HEX متوافقة مع محول الصورة", () => {
    const css = getMinistryPdfCompatibilityCss();
    expect(css).toContain(".ministry-pdf-export");
    expect(css).toContain("#111111");
    expect(css).not.toContain("oklch");
  });
});
