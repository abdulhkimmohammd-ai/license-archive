import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabaseLicense } from "@/lib/licenseApi";
import { supabaseDevelopment, supabaseDevelopmentEnabled } from "@/lib/supabaseDevelopment";
import { buildSupabaseQrPayload } from "@/lib/supabaseQr";
import QRCode from "qrcode";
import { ArrowRight, Camera, CheckCircle2, Loader2, QrCode, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function SupabaseOperationalQr() {
  const [, params] = useRoute("/supabase-development/licenses/:id/qr");
  const [, setLocation] = useLocation();
  const id = params?.id ?? "";
  const [session, setSession] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const license = useQuery({ queryKey: ["supabase-development", "license", id], enabled: Boolean(session && id), retry: false, queryFn: () => getSupabaseLicense(id) });
  useEffect(() => {
    if (!supabaseDevelopment) return;
    void supabaseDevelopment.auth.getSession().then(({ data }) => setSession(Boolean(data.session)));
    const { data: listener } = supabaseDevelopment.auth.onAuthStateChange((_event, nextSession) => setSession(Boolean(nextSession)));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!license.data) return;
    const payload = buildSupabaseQrPayload({ id: String(license.data.id), licenseNo: String(license.data.license_no), archiveNumber: String(license.data.archive_number) });
    void QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: 320, color: { dark: "#0f3d35", light: "#ffffff" } }).then(setQrDataUrl).catch(() => toast.error("تعذر إنشاء رمز QR"));
  }, [license.data]);
  useEffect(() => () => { controlsRef.current?.stop(); }, []);
  const startScan = async () => {
    if (!videoRef.current || scanning) return;
    setScanResult("");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      setScanning(true);
      controlsRef.current = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, videoRef.current, (result) => {
        if (!result) return;
        setScanResult(result.getText());
        controlsRef.current?.stop();
        controlsRef.current = null;
        setScanning(false);
        toast.success("تمت قراءة رمز QR");
      });
    } catch (error) { setScanning(false); toast.error(error instanceof Error ? error.message : "تعذر تشغيل الكاميرا"); }
  };
  const stopScan = () => { controlsRef.current?.stop(); controlsRef.current = null; setScanning(false); };
  if (!supabaseDevelopmentEnabled || !supabaseDevelopment) return <Shell><Notice title="إعداد Supabase Development غير متاح" detail="لم تُضبط متغيرات العميل العامة." /></Shell>;
  if (!session) return <Shell><Notice title="يلزم حساب اختبار Supabase" detail="سجل الدخول بحساب اصطناعي معتمد قبل استخدام QR." action={() => setLocation("/migration-lab/supabase")} /></Shell>;
  if (license.isLoading) return <Shell><div className="grid min-h-96 place-items-center"><Loader2 className="animate-spin text-emerald-700" /></div></Shell>;
  if (license.error || !license.data) return <Shell><Notice title="تعذر تحميل الترخيص" detail={license.error?.message ?? "لم يتم العثور على السجل."} /></Shell>;
  return <Shell><div dir="rtl" className="mx-auto max-w-5xl space-y-6"><header><Button variant="ghost" onClick={() => setLocation(`/supabase-development/licenses/${id}`)} className="-mr-3 text-slate-600"><ArrowRight className="ml-1 h-4 w-4" />العودة إلى التفاصيل</Button><p className="mt-4 text-sm font-bold text-emerald-700">Supabase Development · QR محلي</p><h1 className="mt-1 text-3xl font-extrabold text-emerald-950">رمز الترخيص والتحقق بالكاميرا</h1><p className="mt-2 text-slate-500">يحتوي الرمز على معرف السجل ورقم الترخيص ورقم الأرشفة فقط، ولا يتضمن بيانات شخصية أو مفاتيح وصول.</p></header><div className="grid gap-5 lg:grid-cols-2"><Card className="border-0 bg-white shadow-sm"><CardContent className="flex flex-col items-center p-7"><QrCode className="h-6 w-6 text-emerald-700" /><h2 className="mt-3 font-extrabold text-emerald-950">رمز السجل</h2>{qrDataUrl ? <img src={qrDataUrl} alt={`رمز QR للترخيص ${license.data.license_no}`} className="mt-5 h-80 w-80 max-w-full rounded-2xl border border-slate-200 p-3" /> : <Loader2 className="mt-5 h-8 w-8 animate-spin text-emerald-700" />}<p className="mt-4 text-center text-sm text-slate-600">رقم الترخيص: <strong>{String(license.data.license_no)}</strong><br />رقم الأرشفة: <strong>{String(license.data.archive_number)}</strong></p></CardContent></Card><Card className="border-0 bg-white shadow-sm"><CardContent className="p-7"><div className="flex items-center gap-3"><Camera className="h-6 w-6 text-emerald-700" /><h2 className="font-extrabold text-emerald-950">قارئ الكاميرا</h2></div><p className="mt-3 text-sm leading-7 text-slate-600">اسمح للمتصفح باستخدام الكاميرا ثم وجّهها إلى رمز QR. القراءة تتم محلياً داخل المتصفح ولا تُرسل صورة الكاميرا إلى الخادم.</p><video ref={videoRef} className="mt-5 aspect-video w-full rounded-2xl bg-slate-950 object-cover" muted playsInline /> <div className="mt-4 flex flex-wrap gap-2">{scanning ? <Button variant="outline" onClick={stopScan}><Square className="ml-2 h-4 w-4" />إيقاف الكاميرا</Button> : <Button onClick={() => void startScan()} className="bg-emerald-900 text-white hover:bg-emerald-800"><Camera className="ml-2 h-4 w-4" />بدء المسح</Button>}</div>{scanResult && <div className="mt-4 rounded-2xl bg-emerald-50 p-4"><p className="flex items-center gap-2 font-bold text-emerald-900"><CheckCircle2 className="h-4 w-4" />نتيجة المسح</p><pre dir="ltr" className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-emerald-950">{scanResult}</pre></div>}</CardContent></Card></div></div></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#f5f7f4] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">{children}</main>; }
function Notice({ title, detail, action }: { title: string; detail: string; action?: () => void }) { return <div dir="rtl" className="mx-auto mt-16 max-w-xl rounded-3xl bg-amber-50 p-8 text-right text-amber-950"><h1 className="text-xl font-extrabold">{title}</h1><p className="mt-3 leading-7">{detail}</p>{action && <Button className="mt-5 bg-emerald-900 text-white hover:bg-emerald-800" onClick={action}>فتح مختبر Supabase</Button>}</div>; }
