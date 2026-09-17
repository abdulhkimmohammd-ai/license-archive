import { MINISTRY_PRINT_PAGE_SIZE } from "@/lib/ministryPrint";

export const MINISTRY_CARD_PDF_FORMAT = [MINISTRY_PRINT_PAGE_SIZE.widthMm, MINISTRY_PRINT_PAGE_SIZE.heightMm] as const;

export function getMinistryCardPdfOptions() {
  return {
    orientation: "portrait" as const,
    unit: "mm" as const,
    format: [...MINISTRY_CARD_PDF_FORMAT],
    compress: true,
  };
}

export function getMinistryCardPdfImageBounds() {
  return {
    x: 0,
    y: 0,
    widthMm: MINISTRY_PRINT_PAGE_SIZE.widthMm,
    heightMm: MINISTRY_PRINT_PAGE_SIZE.heightMm,
  };
}

export function getMinistryPdfCompatibilityCss(exportClass = "ministry-pdf-export") {
  return `
    html, body {
      background-color: #ffffff !important;
      color: #111111 !important;
      border-color: #111111 !important;
      outline-color: #111111 !important;
    }
    .${exportClass} { background-color: #ffffff !important; box-shadow: none !important; }
    .${exportClass}, .${exportClass} * {
      color: #111111 !important;
      border-color: #111111 !important;
      outline-color: #111111 !important;
      text-decoration-color: #111111 !important;
      caret-color: #111111 !important;
    }
  `;
}
