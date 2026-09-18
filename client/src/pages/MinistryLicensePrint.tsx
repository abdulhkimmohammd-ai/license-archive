import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Download, Loader2, Printer, Ruler, RotateCcw } from "lucide-react";
import { facilityTypeMap } from "@/lib/licenses";
import { getCalibrationStorageKey, getLegacyCalibrationStorageKey, type CalibrationSide } from "@/lib/calibration";
import { getMinistryBackFieldCoordinates, getMinistryFrontLayout, getMinistryPrintMessage, getMinistryPrintTemplate, MINISTRY_ARCHIVE_TEXT_SIZE, MINISTRY_BACK_FIELD_LABELS, MINISTRY_BACK_OFFICIAL_COORDINATES, MINISTRY_BACK_OFFICIAL_NAMES, MINISTRY_FRONT_LAYOUT, shouldPrintBackOfficials, shouldPrintExpiryDate } from "@/lib/ministryPrint";
import { getMinistryCardPdfImageBounds, getMinistryCardPdfOptions, getMinistryPdfCompatibilityCss } from "@/lib/ministryPdf";

function getSavedCalibration(facilityType: string | null | undefined, side: CalibrationSide) {
  const template = getMinistryPrintTemplate(facilityType);
  try {
    const selected = localStorage.getItem(getCalibrationStorageKey(template.kind, side));
    if (selected) return JSON.parse(selected);
    if (template.kind === "warehouse") {
      const legacy = localStorage.getItem(getLegacyCalibrationStorageKey(side));
      if (legacy) return JSON.parse(legacy);
    }
  } catch {}
  return null;
}

function getActiveFrontLayout(facilityType?: string | null) {
  const defaultLayout = getMinistryFrontLayout(facilityType);
  try {
    const saved = getSavedCalibration(facilityType, "front");
    if (saved) return { ...defaultLayout, fields: { ...defaultLayout.fields, ...saved } };
  } catch {}
  return defaultLayout;
}

function getActiveBackCoordinates(facilityType?: string | null) {
  const baseCoords = getMinistryBackFieldCoordinates(facilityType);
  try {
    const parsed = getSavedCalibration(facilityType, "back");
    if (parsed) {
      return { ...baseCoords, ...parsed };
    }
  } catch {}
  return baseCoords;
}

function getActiveOfficials(facilityType?: string | null) {
  try {
    const parsed = getSavedCalibration(facilityType, "back");
    if (parsed) {
      return {
        licensingHead: parsed.licensingHead || MINISTRY_BACK_OFFICIAL_COORDINATES.licensingHead,
        pharmacyDirector: parsed.pharmacyDirector || MINISTRY_BACK_OFFICIAL_COORDINATES.pharmacyDirector,
      };
    }
  } catch {}
  return MINISTRY_BACK_OFFICIAL_COORDINATES;
}
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";

type Side = "front" | "back" | "calibration";
const field = (value?: string | null) => value?.trim() || "";
const date = (value?: Date | string | null) => value ? new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).replaceAll("/", " ") : "";
const year = (value?: Date | string | null) => value ? String(new Date(value).getUTCFullYear()) : "";

export default function MinistryLicensePrint() {
  const [, params] = useRoute("/licenses/:id/ministry-print");
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const id = Number(params?.id);
  const [side, setSide] = useState<Side>("front");
  const [exporting, setExporting] = useState(false);
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.licenses.printPayload.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0 && user?.role === "admin" });
  const statusMessage = getMinistryPrintMessage({ authLoading, userRole: user?.role, queryLoading: isLoading, hasData: Boolean(data), errorCode: error?.data?.code, errorMessage: error?.message });
  useEffect(() => { document.title = "طباعة نموذج وزارة الصحة"; return () => { document.title = "أرشيف التراخيص"; }; }, []);
  if (statusMessage || !data) return <AccessMessage text={statusMessage ?? "تعذر تجهيز بيانات نموذج الطباعة. حاول تحديث الصفحة."} />;
  const { license } = data;
  const print = () => window.print();
  const downloadCardPdf = async () => {
    const source = document.querySelector<HTMLElement>(".ministry-sheet");
    if (!source || exporting || side === "calibration") return;
    setExporting(true);
    let exportClone: HTMLElement | null = null;
    try {
      const imageResult = await utils.licenses.ministryTemplateImage.fetch({ template: template.kind, side });
      exportClone = source.cloneNode(true) as HTMLElement;
      exportClone.classList.add("ministry-pdf-export");
      const templateImageElement = exportClone.querySelector<HTMLImageElement>(".template-reference");
      if (templateImageElement) templateImageElement.src = imageResult.dataUrl;
      exportClone.setAttribute("aria-hidden", "true");
      Object.assign(exportClone.style, { position: "fixed", left: "-10000px", top: "0", margin: "0", boxShadow: "none", zIndex: "-1" });
      document.body.appendChild(exportClone);
      if (templateImageElement && !templateImageElement.complete) await new Promise<void>((resolve, reject) => { templateImageElement.onload = () => resolve(); templateImageElement.onerror = () => reject(new Error("تعذر تحميل صورة نموذج الوزارة")); });
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(exportClone, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: false,
        logging: false,
        onclone: (clonedDocument) => {
          const compatibilityStyle = clonedDocument.createElement("style");
          compatibilityStyle.textContent = getMinistryPdfCompatibilityCss();
          clonedDocument.head.appendChild(compatibilityStyle);
        },
      });
      const bounds = getMinistryCardPdfImageBounds();
      const pdf = new jsPDF(getMinistryCardPdfOptions());
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", bounds.x, bounds.y, bounds.widthMm, bounds.heightMm, undefined, "FAST");
      pdf.save(`كرت-وزارة-${license.licenseNo}-${side === "front" ? "أمامي" : "خلفي"}.pdf`);
      toast.success("تم تجهيز ملف PDF بالحجم الفعلي للكرت");
    } catch (pdfError) {
      console.error("Ministry PDF export failed", pdfError);
      toast.error(pdfError instanceof Error ? `تعذر تصدير PDF: ${pdfError.message}` : "تعذر تصدير PDF. أعد المحاولة.");
    } finally {
      exportClone?.remove();
      setExporting(false);
    }
  };
  const template = getMinistryPrintTemplate(license.facilityType);
  return <div dir="rtl" className="min-h-screen bg-stone-100 text-slate-900"><header className="no-print sticky top-0 z-20 border-b border-emerald-950/10 bg-white/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-emerald-700">طباعة على النموذج الأصلي</p><h1 className="mt-1 text-lg font-extrabold text-emerald-950">{template.displayName} — {license.licenseNo}</h1></div><div className="flex flex-wrap gap-2"><Button variant={side === "front" ? "default" : "outline"} onClick={() => setSide("front")}>الوجه الأمامي</Button><Button variant={side === "back" ? "default" : "outline"} onClick={() => setSide("back")}>الوجه الخلفي</Button><Button variant={side === "calibration" ? "default" : "outline"} onClick={() => setSide("calibration")}><Ruler className="ml-2 h-4 w-4" />المعايرة</Button><Button variant="outline" onClick={() => setLocation(`/licenses/${id}`)}><ArrowRight className="ml-2 h-4 w-4" />عودة</Button>{side !== "calibration" && <Button disabled={exporting} variant="outline" onClick={downloadCardPdf}>{exporting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Download className="ml-2 h-4 w-4" />}تصدير PDF بالحجم الفعلي</Button>}<Button className="bg-emerald-900 text-white hover:bg-emerald-800" onClick={print}><Printer className="ml-2 h-4 w-4" />طباعة</Button></div></div></header><div className="no-print mx-auto max-w-6xl px-4 py-4"><div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"><strong>القالب المختار تلقائياً:</strong> {template.displayName}. <strong>زر تصدير PDF بالحجم الفعلي:</strong> ينزّل الوجه المعروض بمقاس 19.7 × 25 سم. <strong>قبل استخدام الكرت الأصلي:</strong> اطبع صفحة «المعايرة» على ورق عادي، ثم اختر في نافذة الطباعة <strong>الحجم الفعلي 100%</strong> وأوقف خيار «الملاءمة للصفحة». قِس المستطيل؛ يجب أن يكون عرضه 19.7 سم وارتفاعه 25 سم.</div></div>{side === "front" ? <Front license={license} /> : side === "back" ? <Back license={license} /> : <Calibration />}</div>;
}

function Front({ license }: { license: any }) {
  const template = getMinistryPrintTemplate(license.facilityType);
  const layout = getActiveFrontLayout(license.facilityType);
  const f = layout.fields;
  return <main className="ministry-sheet ministry-front" data-ministry-template={template.kind}><img className="template-reference no-print" src={template.frontReference} alt={`مرجع ${template.displayName}`} /><PrintText weight={layout.holderFontWeight} {...f.holderName}>{license.holderName}</PrintText><PrintText {...f.holderNationalId}>{license.holderNationalId}</PrintText><PrintText {...f.nationalIdIssuedBy}>{field(license.nationalIdIssuedBy)}</PrintText><PrintText {...f.nationalIdIssueGovernorate}>{field(license.nationalIdIssueGovernorate)}</PrintText><PrintText size={layout.dateTextSize} {...f.nationalIdIssueDate}>{date(license.nationalIdIssueDate)}</PrintText><PrintText {...f.birthPlace}>{field(license.birthPlace)}</PrintText><PrintText {...f.birthGovernorate}>{field(license.birthGovernorate)}</PrintText><PrintText size={layout.dateTextSize} {...f.birthDate}>{date(license.birthDate)}</PrintText><PrintText {...f.graduationCountry}>{field(license.graduationCountry)}</PrintText><PrintText {...f.graduationInstitute}>{field(license.graduationInstitute)}</PrintText><PrintText size={layout.dateTextSize} {...f.graduationYear}>{year(license.graduationDate)}</PrintText><PrintText {...f.professionalLicenseNo}>{field(license.professionalLicenseNo)}</PrintText><PrintText size={layout.dateTextSize} {...f.professionalLicenseIssueDate}>{date(license.professionalLicenseIssueDate)}</PrintText><PrintText {...f.facilityName}>{license.facilityName}</PrintText><PrintText {...f.street}>{field(license.street || license.address)}</PrintText><PrintText {...f.area}>{field(license.area || license.governorate)}</PrintText><PrintText {...f.district}>{field(license.district)}</PrintText><PrintText {...f.propertyOwner}>{field(license.propertyOwnerName)}</PrintText><PrintText size={layout.dateTextSize} {...f.healthOfficeIssueDate}>{date(license.healthOfficeIssueDate || license.issueDate)}</PrintText><PrintText {...f.healthOfficeDirector} align="center">{field(license.healthOfficeDirectorName) || "د. مجاهد احمد الخطري"}</PrintText><PrintText {...f.healthOfficeDirectorGovernorate} align="center">{field(license.healthOfficeDirectorGovernorate)}</PrintText></main>;
}
function Back({ license }: { license: any }) {
  const template = getMinistryPrintTemplate(license.facilityType);
  const coordinates = getActiveBackCoordinates(license.facilityType);
  const officials = getActiveOfficials(license.facilityType);
  const showExpiryDate = shouldPrintExpiryDate(license.facilityType);
  const showOfficials = shouldPrintBackOfficials(license.facilityType);
  const layout = getActiveFrontLayout(license.facilityType);
  return <main className="ministry-sheet ministry-back" data-ministry-template={template.kind}><img className="template-reference no-print" src={template.backReference} alt={`مرجع الوجه الخلفي لـ${template.displayName}`} /><PrintText size={layout.dateTextSize} {...coordinates.inspectionNumber} fieldLabel={MINISTRY_BACK_FIELD_LABELS.inspectionNumber}>{field(license.siteInspectionFormNo)}</PrintText><PrintText size={layout.dateTextSize} {...coordinates.inspectionDate} fieldLabel={MINISTRY_BACK_FIELD_LABELS.inspectionDate}>{date(license.siteInspectionFormDate)}</PrintText><PrintText size={layout.dateTextSize} {...coordinates.committeeNumber} fieldLabel={MINISTRY_BACK_FIELD_LABELS.committeeNumber}>{field(license.committeeMinutesNo)}</PrintText><PrintText size={layout.dateTextSize} {...coordinates.committeeDate} fieldLabel={MINISTRY_BACK_FIELD_LABELS.committeeDate}>{date(license.committeeMinutesDate)}</PrintText><PrintText size={layout.dateTextSize} {...coordinates.feeNumber} fieldLabel={MINISTRY_BACK_FIELD_LABELS.feeNumber}>{field(license.feeReceiptNo)}</PrintText><PrintText size={layout.dateTextSize} {...coordinates.feeDate} fieldLabel={MINISTRY_BACK_FIELD_LABELS.feeDate}>{date(license.feeReceiptDate)}</PrintText>{template.showPreviousLicenseClause && <><PrintText size={layout.dateTextSize} {...coordinates.previousLicenseNo} fieldLabel={MINISTRY_BACK_FIELD_LABELS.previousLicenseNo}>{field(license.previousLicenseNo)}</PrintText><PrintText size={layout.dateTextSize} {...coordinates.previousLicenseIssuedBy} fieldLabel={MINISTRY_BACK_FIELD_LABELS.previousLicenseIssuedBy}>{field(license.previousLicenseIssuedBy)}</PrintText><PrintText size={layout.dateTextSize} {...coordinates.previousLicenseIssueDate} fieldLabel={MINISTRY_BACK_FIELD_LABELS.previousLicenseIssueDate}>{date(license.previousLicenseIssueDate)}</PrintText></>}<PrintText size={layout.dateTextSize} {...coordinates.validityStart} fieldLabel={MINISTRY_BACK_FIELD_LABELS.validityStart}>{date(license.issueDate)}</PrintText>{showExpiryDate && <PrintText size={layout.dateTextSize} {...coordinates.validityEnd} fieldLabel={MINISTRY_BACK_FIELD_LABELS.validityEnd}>{date(license.expiryDate)}</PrintText>}<PrintText size={MINISTRY_ARCHIVE_TEXT_SIZE} {...coordinates.archiveFacilityName} fieldLabel={MINISTRY_BACK_FIELD_LABELS.archiveFacilityName}>{field(license.facilityName)}</PrintText><PrintText size={MINISTRY_ARCHIVE_TEXT_SIZE} {...coordinates.archiveOwnerName} fieldLabel={MINISTRY_BACK_FIELD_LABELS.archiveOwnerName}>{field(license.holderName)}</PrintText><PrintText size={MINISTRY_ARCHIVE_TEXT_SIZE} {...coordinates.archiveNumber} fieldLabel={MINISTRY_BACK_FIELD_LABELS.archiveNumber}>{field(license.archiveNumber)}</PrintText><PrintText size={MINISTRY_ARCHIVE_TEXT_SIZE} {...coordinates.archiveDate} fieldLabel={MINISTRY_BACK_FIELD_LABELS.archiveDate}>{date(license.archiveDate)}</PrintText><PrintText size={MINISTRY_ARCHIVE_TEXT_SIZE} {...coordinates.archiveOfficerName} fieldLabel={MINISTRY_BACK_FIELD_LABELS.archiveOfficerName}>{field(license.archiveOfficerName)}</PrintText>{showOfficials && <><PrintText size={layout.dateTextSize} {...officials.licensingHead} align="center">{MINISTRY_BACK_OFFICIAL_NAMES.licensingHead}</PrintText><PrintText size={layout.dateTextSize} {...officials.pharmacyDirector} align="center">{MINISTRY_BACK_OFFICIAL_NAMES.pharmacyDirector}</PrintText></>}</main>;
}
function Calibration() { const marks = Array.from({ length: 10 }, (_, index) => index + 1); return <main className="ministry-sheet ministry-calibration"><div className="calibration-frame"><span className="corner top-left" /><span className="corner top-right" /><span className="corner bottom-left" /><span className="corner bottom-right" /><div className="calibration-title">صفحة معايرة طباعة نموذج وزارة الصحة</div><div className="calibration-subtitle">العرض المطلوب: 19.7 سم — الارتفاع المطلوب: 25 سم</div><div className="calibration-ruler horizontal">{marks.map(n => <i key={n} style={{ left: `${n * 10}%` }}>{n * 2} سم</i>)}</div><div className="calibration-ruler vertical">{marks.map(n => <i key={n} style={{ top: `${n * 10}%` }}>{n * 2.5} سم</i>)}</div><div className="calibration-cross">+</div><div className="calibration-note">إذا اختلف المقاس، تأكد من اختيار «الحجم الفعلي 100%» وإيقاف «ملاءمة الصفحة» من إعدادات الطابعة.</div></div></main>; }
function PrintText({ x, y, width, size = MINISTRY_FRONT_LAYOUT.textSize, weight = 700, align = "right", fieldLabel, children }: { x: number; y: number; width: number; size?: number; weight?: number; align?: "right" | "center"; fieldLabel?: string; children: React.ReactNode }) { if (!children) return null; return <span className="print-field" data-field-label={fieldLabel} style={{ right: `${x}mm`, top: `${y}mm`, width: `${width}mm`, fontSize: `${size}pt`, fontWeight: weight, textAlign: align }}>{children}</span>; }
function AccessMessage({ text }: { text: string }) { return <div className="grid min-h-screen place-items-center bg-stone-100 p-6"><p dir="rtl" className="rounded-2xl bg-white p-6 font-bold text-emerald-950 shadow-sm">{text}</p></div>; }
