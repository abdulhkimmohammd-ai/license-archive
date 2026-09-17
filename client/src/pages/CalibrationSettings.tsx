import { useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Building2, CheckCircle2, Download, Eye, Grid3X3, Minus, Plus, RotateCcw, Save, ShieldAlert, Sliders, Upload, Warehouse } from "lucide-react";
import { createCalibrationExport, getCalibrationLabel, getCalibrationStorageKey, getLegacyCalibrationStorageKey, parseCalibrationExport, type CalibrationData, type CalibrationFields, type CalibrationSide } from "@/lib/calibration";
import { getMinistryBackFieldCoordinates, getMinistryFrontLayout, MINISTRY_BACK_OFFICIAL_COORDINATES, MINISTRY_PRINT_TEMPLATES, type MinistryPrintTemplateKind } from "@/lib/ministryPrint";

type FieldMap = CalibrationFields;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function defaultFields(template: MinistryPrintTemplateKind, side: CalibrationSide): FieldMap {
  if (side === "front") return clone(getMinistryFrontLayout(template).fields);
  return clone({ ...getMinistryBackFieldCoordinates(template), ...MINISTRY_BACK_OFFICIAL_COORDINATES });
}

function loadFields(template: MinistryPrintTemplateKind, side: CalibrationSide): FieldMap {
  const defaultValue = defaultFields(template, side);
  try {
    const selected = localStorage.getItem(getCalibrationStorageKey(template, side));
    if (selected) return { ...defaultValue, ...JSON.parse(selected) };
    if (template === "warehouse") {
      const legacy = localStorage.getItem(getLegacyCalibrationStorageKey(side));
      if (legacy) return { ...defaultValue, ...JSON.parse(legacy) };
    }
  } catch {}
  return defaultValue;
}

function initialCalibrationData(): CalibrationData {
  return {
    pharmacy: { front: loadFields("pharmacy", "front"), back: loadFields("pharmacy", "back") },
    warehouse: { front: loadFields("warehouse", "front"), back: loadFields("warehouse", "back") },
  };
}

export default function CalibrationSettings() {
  const { user } = useAuth();
  const [templateKind, setTemplateKind] = useState<MinistryPrintTemplateKind>("warehouse");
  const [side, setSide] = useState<CalibrationSide>("front");
  const [calibration, setCalibration] = useState<CalibrationData>(initialCalibrationData);
  const [savedMessage, setSavedMessage] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [showCenterLines, setShowCenterLines] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);

  if (user?.role !== "admin") {
    return <DashboardLayout><div className="mx-auto max-w-xl py-12 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-700"><ShieldAlert className="h-6 w-6" /></div><h1 className="text-xl font-bold text-emerald-950">صلاحية المدير مطلوبة</h1><p className="mt-2 text-slate-600">لوحة إعدادات المعايرة والإحداثيات مخصصة لمدير النظام فقط.</p></div></DashboardLayout>;
  }

  const selectedTemplate = MINISTRY_PRINT_TEMPLATES[templateKind];
  const activeFields = calibration[templateKind][side];
  const activeLabel = templateKind === "pharmacy" ? "نموذج الصيدلية" : "نموذج مخزن الأدوية";

  const handleFieldChange = (key: string, field: "x" | "y" | "width", value: number) => {
    setCalibration((previous) => ({
      ...previous,
      [templateKind]: {
        ...previous[templateKind],
        [side]: {
          ...previous[templateKind][side],
          [key]: { ...previous[templateKind][side][key], [field]: value },
        },
      },
    }));
    setIsDirty(true);
  };

  const saveSettings = () => {
    try {
      localStorage.setItem(getCalibrationStorageKey(templateKind, "front"), JSON.stringify(calibration[templateKind].front));
      localStorage.setItem(getCalibrationStorageKey(templateKind, "back"), JSON.stringify(calibration[templateKind].back));
      setIsDirty(false);
      setSavedMessage(true);
      window.setTimeout(() => setSavedMessage(false), 3000);
    } catch (error) {
      console.error(error);
    }
  };

  const resetSettings = () => {
    if (!confirm(`هل تريد بالتأكيد استعادة الإحداثيات الافتراضية لـ ${activeLabel}؟`)) return;
    localStorage.removeItem(getCalibrationStorageKey(templateKind, "front"));
    localStorage.removeItem(getCalibrationStorageKey(templateKind, "back"));
    setCalibration((previous) => ({
      ...previous,
      [templateKind]: { front: defaultFields(templateKind, "front"), back: defaultFields(templateKind, "back") },
    }));
    setIsDirty(false);
    setSavedMessage(true);
    window.setTimeout(() => setSavedMessage(false), 3000);
  };

  const exportSettings = () => {
    const backup = createCalibrationExport(calibration);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `اعدادات-معايرة-التراخيص-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const importSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 1_000_000) {
      window.alert("ملف الإعدادات كبير جداً. اختر ملف JSON صالحاً بحجم أقل من 1 ميغابايت.");
      return;
    }
    try {
      const imported = parseCalibrationExport(JSON.parse(await file.text()));
      if (!imported) {
        window.alert("تعذر استيراد الملف: صيغة إعدادات المعايرة غير صحيحة أو غير مدعومة.");
        return;
      }
      setCalibration(imported.calibration);
      (Object.keys(imported.calibration) as MinistryPrintTemplateKind[]).forEach((template) => {
        localStorage.setItem(getCalibrationStorageKey(template, "front"), JSON.stringify(imported.calibration[template].front));
        localStorage.setItem(getCalibrationStorageKey(template, "back"), JSON.stringify(imported.calibration[template].back));
      });
      setIsDirty(false);
      setSavedMessage(true);
      window.setTimeout(() => setSavedMessage(false), 3000);
    } catch {
      window.alert("تعذر قراءة الملف. تأكد من اختيار ملف إعدادات معايرة بصيغة JSON.");
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6" dir="rtl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-900 text-amber-100"><Sliders className="h-5 w-5" /></span><h1 className="text-2xl font-bold text-emerald-950">إعدادات معايرة الطباعة</h1></div>
            <p className="mt-1 text-sm text-slate-600">اختر النموذج، وعدّل القيم بالمليمتر، ثم راجع المعاينة قبل حفظ التعديلات.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDirty && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">تعديلات غير محفوظة</span>}
            {savedMessage && <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> تم الحفظ</span>}
            <input ref={importInputRef} className="hidden" type="file" accept="application/json,.json" onChange={importSettings} />
            <Button onClick={() => importInputRef.current?.click()} variant="outline" className="border-sky-200 text-sky-800 hover:bg-sky-50"><Upload className="ml-2 h-4 w-4" /> استيراد ملف</Button>
            <Button onClick={exportSettings} variant="outline" className="border-emerald-200 text-emerald-800 hover:bg-emerald-50"><Download className="ml-2 h-4 w-4" /> تصدير الإعدادات</Button>
            <Button onClick={resetSettings} variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50"><RotateCcw className="ml-2 h-4 w-4" /> استعادة الافتراضي</Button>
            <Button onClick={saveSettings} className="bg-emerald-900 text-white hover:bg-emerald-800"><Save className="ml-2 h-4 w-4" /> حفظ للنموذج المحدد</Button>
          </div>
        </header>

        <Card className="border-emerald-950/10 shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-sm font-bold text-emerald-950">اختر نموذج المعايرة:</span>
            <Button variant={templateKind === "pharmacy" ? "default" : "outline"} onClick={() => setTemplateKind("pharmacy")} className={templateKind === "pharmacy" ? "bg-emerald-900 text-white hover:bg-emerald-800" : "border-emerald-900/20 text-emerald-900"}><Building2 className="ml-2 h-4 w-4" /> نموذج الصيدلية</Button>
            <Button variant={templateKind === "warehouse" ? "default" : "outline"} onClick={() => setTemplateKind("warehouse")} className={templateKind === "warehouse" ? "bg-emerald-900 text-white hover:bg-emerald-800" : "border-emerald-900/20 text-emerald-900"}><Warehouse className="ml-2 h-4 w-4" /> نموذج مخزن الأدوية</Button>
            <span className="mr-auto text-xs font-bold text-slate-600">المعاينة:</span>
            <Button size="sm" variant="outline" onClick={() => setPreviewZoom((value) => Math.max(50, value - 25))} aria-label="تصغير المعاينة"><Minus className="h-4 w-4" /></Button>
            <span className="min-w-12 text-center text-xs font-bold text-emerald-900">{previewZoom}%</span>
            <Button size="sm" variant="outline" onClick={() => setPreviewZoom((value) => Math.min(150, value + 25))} aria-label="تكبير المعاينة"><Plus className="h-4 w-4" /></Button>
            <Button size="sm" variant={showGrid ? "default" : "outline"} onClick={() => setShowGrid((value) => !value)} className={showGrid ? "bg-emerald-800 text-white hover:bg-emerald-700" : ""}><Grid3X3 className="ml-1 h-3.5 w-3.5" />شبكة</Button>
            <Button size="sm" variant={showCenterLines ? "default" : "outline"} onClick={() => setShowCenterLines((value) => !value)} className={showCenterLines ? "bg-emerald-800 text-white hover:bg-emerald-700" : ""}>محاور المنتصف</Button>
            <span className="mr-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">المحدد الآن: {activeLabel}</span>
          </CardContent>
        </Card>

        <Tabs value={side} onValueChange={(value) => setSide(value as CalibrationSide)} className="space-y-5">
          <TabsList className="bg-emerald-950/5 p-1">
            <TabsTrigger value="front" className="data-[state=active]:bg-emerald-900 data-[state=active]:text-white">الوجه الأمامي</TabsTrigger>
            <TabsTrigger value="back" className="data-[state=active]:bg-emerald-900 data-[state=active]:text-white">الوجه الخلفي والتوقيعات</TabsTrigger>
          </TabsList>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card className="border-emerald-950/10 shadow-sm">
              <CardHeader><CardTitle className="text-lg font-bold text-emerald-950">حقول {side === "front" ? "الوجه الأمامي" : "الوجه الخلفي"} — {activeLabel}</CardTitle><CardDescription>القيم بالمليمتر: **المسافة من اليمين**، ثم **المسافة من الأعلى**، ثم **عرض مساحة النص**.</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {Object.entries(activeFields).map(([key, coordinate]) => <CoordinateEditor key={key} label={getCalibrationLabel(side, key)} coordinate={coordinate} onChange={(field, value) => handleFieldChange(key, field, value)} />)}
              </CardContent>
            </Card>

            <Card className="h-fit border-emerald-950/10 shadow-sm xl:sticky xl:top-6">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg font-bold text-emerald-950"><Eye className="h-5 w-5" /> معاينة قبل الحفظ</CardTitle><CardDescription>تتغير العلامات فور تعديل أي قيمة. الشبكة ومحاور المنتصف للمراجعة فقط ولا تظهر في الطباعة.</CardDescription></CardHeader>
              <CardContent><CalibrationPreview templateKind={templateKind} side={side} fields={activeFields} zoom={previewZoom} showGrid={showGrid} showCenterLines={showCenterLines} /></CardContent>
            </Card>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function CoordinateEditor({ label, coordinate, onChange }: { label: string; coordinate: { x: number; y: number; width: number }; onChange: (field: "x" | "y" | "width", value: number) => void }) {
  const update = (field: "x" | "y" | "width", raw: string) => onChange(field, Number.isFinite(Number(raw)) ? Number(raw) : 0);
  const nudge = (field: "x" | "y", amount: number) => onChange(field, Math.max(0, Number((coordinate[field] + amount).toFixed(2))));
  return <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><Label className="text-sm font-bold text-slate-800">{label}</Label><div className="mt-3 grid grid-cols-3 gap-2"><FieldInput label="من اليمين" value={coordinate.x} onChange={(value) => update("x", value)} /><FieldInput label="من الأعلى" value={coordinate.y} onChange={(value) => update("y", value)} /><FieldInput label="العرض" value={coordinate.width} onChange={(value) => update("width", value)} /></div><div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-900/10 bg-white p-1.5"><span className="px-2 text-[10px] font-bold text-slate-500">تحريك دقيق: 0.25 مم</span><div className="flex gap-1"><Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => nudge("y", -0.25)} aria-label="رفع الحقل ربع مليمتر"><ArrowUp className="h-3.5 w-3.5" /></Button><Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => nudge("x", 0.25)} aria-label="تحريك الحقل يميناً ربع مليمتر"><ArrowRight className="h-3.5 w-3.5" /></Button><Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => nudge("y", 0.25)} aria-label="إنزال الحقل ربع مليمتر"><ArrowDown className="h-3.5 w-3.5" /></Button><Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => nudge("x", -0.25)} aria-label="تحريك الحقل يساراً ربع مليمتر"><ArrowLeft className="h-3.5 w-3.5" /></Button></div></div></div>;
}

function FieldInput({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <div><span className="mb-1 block text-[10px] font-semibold text-slate-500">{label} (مم)</span><Input aria-label={label} type="number" step="0.25" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 bg-white text-xs" /></div>;
}

function CalibrationPreview({ templateKind, side, fields, zoom, showGrid, showCenterLines }: { templateKind: MinistryPrintTemplateKind; side: CalibrationSide; fields: FieldMap; zoom: number; showGrid: boolean; showCenterLines: boolean }) {
  const template = MINISTRY_PRINT_TEMPLATES[templateKind];
  const source = side === "front" ? template.frontReference : template.backReference;
  return <div className="space-y-3"><div className="overflow-auto rounded-xl bg-slate-50 p-3"><div className="relative mx-auto aspect-[197/250] w-full max-w-[350px] origin-top transition-transform" style={{ transform: `scale(${zoom / 100})`, marginBottom: zoom > 100 ? `${(zoom - 100) * 2}px` : undefined }}><div className="absolute inset-0 overflow-hidden rounded-lg border-2 border-emerald-900/20 bg-white shadow-inner"><img src={source} alt={`معاينة ${template.displayName}`} className="absolute inset-0 h-full w-full object-fill opacity-50" />{showGrid && <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(to right, rgba(5, 88, 67, .22) 1px, transparent 1px), linear-gradient(to bottom, rgba(5, 88, 67, .22) 1px, transparent 1px)", backgroundSize: "5.08% 4%" }} />}{showCenterLines && <><span className="pointer-events-none absolute inset-y-0 right-1/2 border-r border-dashed border-rose-500/70" /><span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-rose-500/70" /></>}{Object.entries(fields).map(([key, coordinate]) => <span key={key} title={getCalibrationLabel(side, key)} className="group absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 ring-2 ring-emerald-950/70 shadow-sm" style={{ right: `${(coordinate.x / 197) * 100}%`, top: `${(coordinate.y / 250) * 100}%` }}><span className="pointer-events-none absolute bottom-3 right-0 hidden w-max max-w-32 rounded bg-emerald-950 px-2 py-1 text-[9px] font-bold text-white shadow-lg group-hover:block">{getCalibrationLabel(side, key)}</span></span>)}</div></div></div><div className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-950"><strong>طريقة القراءة:</strong> كل نقطة ذهبية تمثل بداية حقل قابل للتعديل. الشبكة مقسمة تقريبياً بالمليمتر للتوجيه البصري فقط، ولا تظهر في طباعة الكرت.</div></div>;
}
