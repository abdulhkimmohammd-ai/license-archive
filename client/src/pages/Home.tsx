import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { facilityTypeMap, formatDate, statusMap } from "@/lib/licenses";
import { trpc } from "@/lib/trpc";
import { Archive, ArrowLeft, BarChart3, CalendarDays, CircleAlert, FileCheck2, FilePlus2, Loader2, Search, Settings2, Store, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const [analyticsYear, setAnalyticsYear] = useState(() => new Date().getFullYear());
  const [analyticsMonth, setAnalyticsMonth] = useState(0);
  const analyticsFilter = useMemo(() => ({ year: analyticsYear, ...(analyticsMonth ? { month: analyticsMonth } : {}) }), [analyticsMonth, analyticsYear]);
  const { data, isLoading, error } = trpc.licenses.dashboard.useQuery(analyticsFilter);
  const { data: notifications } = trpc.licenses.notifications.useQuery();
  const markNotificationRead = trpc.licenses.markNotificationRead.useMutation();
  const overviewMetrics = [
    { title: "إجمالي التراخيص", value: data?.total ?? 0, icon: Archive, tone: "bg-slate-100 text-slate-700" },
    { title: "التراخيص السارية", value: data?.active ?? 0, icon: FileCheck2, tone: "bg-emerald-100 text-emerald-800" },
    { title: "تنتهي خلال 30 يوماً", value: data?.analytics?.expiryWindows.days30 ?? 0, icon: CircleAlert, tone: "bg-amber-100 text-amber-800" },
    { title: "التراخيص المنتهية", value: data?.expired ?? 0, icon: CircleAlert, tone: "bg-rose-100 text-rose-800" },
    { title: "الصيدليات", value: data?.analytics?.facilities.pharmacy.total ?? 0, icon: Store, tone: "bg-violet-100 text-violet-800" },
    { title: "المخازن", value: data?.analytics?.facilities.warehouse.total ?? 0, icon: Warehouse, tone: "bg-sky-100 text-sky-800" },
  ];

  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-7xl space-y-7">
        <section className="relative overflow-hidden rounded-3xl bg-[#0f3d35] px-6 py-7 text-white shadow-xl shadow-emerald-950/15 sm:px-8 sm:py-9">
          <div className="absolute -left-10 -top-14 h-44 w-44 rounded-full border-[24px] border-amber-300/10" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold text-amber-200">نظام إدارة التراخيص</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">أرشيف المنشآت الصيدلانية</h1>
              <p className="mt-3 max-w-xl leading-7 text-emerald-50/75">متابعة مركزية للتراخيص والمستندات الخاصة للمخازن والصيدليات.</p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-50"><CalendarDays className="h-3.5 w-3.5 text-amber-200" />{formatDate(new Date())}</p>
            </div>
            <Button onClick={() => setLocation("/licenses/new")} className="h-11 bg-amber-300 px-5 font-bold text-emerald-950 hover:bg-amber-200"><FilePlus2 className="ml-2 h-4 w-4" />إضافة ترخيص</Button>
          </div>
        </section>

        {error ? <ErrorPanel text={error.message} /> : <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {overviewMetrics.map(metric => {
              const Icon = metric.icon;
              return <Card key={metric.title} className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-slate-500">{metric.title}</p><p className="mt-2 text-3xl font-extrabold text-emerald-950">{isLoading ? "—" : metric.value}</p></div><div className={`grid h-11 w-11 place-items-center rounded-2xl ${metric.tone}`}><Icon className="h-5 w-5" /></div></CardContent></Card>;
            })}
          </section>

          <section className="rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm shadow-emerald-950/5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-extrabold text-emerald-950">إجراءات سريعة</h2><p className="mt-1 text-sm text-slate-500">انتقل مباشرة إلى أكثر المهام استخداماً.</p></div><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><Button variant="outline" onClick={() => setLocation("/licenses/new")}><FilePlus2 className="ml-2 h-4 w-4" />إضافة ترخيص</Button><Button variant="outline" onClick={() => setLocation("/licenses")}><Search className="ml-2 h-4 w-4" />بحث في السجل</Button><Button variant="outline" onClick={() => setLocation("/archive")}><Archive className="ml-2 h-4 w-4" />فتح الأرشيف</Button><Button variant="outline" onClick={() => setLocation("/settings/calibration")}><Settings2 className="ml-2 h-4 w-4" />المعايرة</Button></div></div></section>

          <AnalyticsCenter
            analytics={data?.analytics}
            loading={isLoading}
            year={analyticsYear}
            month={analyticsMonth}
            onYearChange={setAnalyticsYear}
            onMonthChange={setAnalyticsMonth}
          />

          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-0 bg-white shadow-sm shadow-emerald-950/5">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-emerald-950/7 px-5 py-5"><div><h2 className="font-extrabold text-emerald-950">تنبيهات انتهاء الصلاحية</h2><p className="mt-1 text-sm text-slate-500">تحتاج هذه السجلات إلى متابعة.</p></div><Button variant="ghost" onClick={() => setLocation("/licenses")} className="text-emerald-800 hover:text-emerald-950">عرض السجل<ArrowLeft className="mr-1 h-4 w-4" /></Button></div>
                <div className="divide-y divide-emerald-950/7">
                  {isLoading ? <div className="grid min-h-48 place-items-center"><Loader2 className="animate-spin text-emerald-700" /></div> : data?.alerts?.length ? data.alerts.map(item => {
                    const status = statusMap[item.effectiveStatus as keyof typeof statusMap];
                    return <button key={item.id} onClick={() => setLocation(`/licenses/${item.id}`)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-right transition-colors hover:bg-emerald-50/70"><div className="min-w-0"><p className="truncate font-bold text-emerald-950">{item.facilityName}</p><p className="mt-1 text-sm text-slate-500">{item.licenseNo} · {facilityTypeMap[item.facilityType]}</p></div><div className="shrink-0 text-left"><Badge className={status.className}>{item.daysRemaining < 0 ? `منتهٍ منذ ${Math.abs(item.daysRemaining)} يوم` : `${item.daysRemaining} يوم متبقٍ`}</Badge><p className="mt-1 text-xs text-slate-400">{formatDate(item.expiryDate)}</p></div></button>;
                  }) : <EmptyNotice text="لا توجد تراخيص قريبة من الانتهاء حالياً." />}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-[#fdfaf2] shadow-sm shadow-emerald-950/5"><CardContent className="p-6"><p className="text-sm font-bold text-amber-800">ملخص الحالات</p><div className="mt-6 space-y-5"><SummaryLine label="ساري" value={data?.active ?? 0} color="bg-emerald-600" total={data?.total ?? 0} /><SummaryLine label="منتهٍ" value={data?.expired ?? 0} color="bg-rose-500" total={data?.total ?? 0} /></div><div className="mt-8 rounded-2xl border border-amber-800/10 bg-white/70 p-4"><p className="text-sm font-bold text-emerald-950">إدارة آمنة للوثائق</p><p className="mt-1 text-sm leading-6 text-slate-600">يتم الوصول إلى الملفات المرفوعة عبر روابط مؤقتة من داخل النظام فقط.</p></div></CardContent></Card>
          </section>
          {notifications?.length ? <section className="rounded-3xl border border-amber-200/70 bg-amber-50/60 p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-extrabold text-amber-900">تنبيهات النظام الداخلية</p><p className="mt-1 text-sm text-amber-800/75">يتم إنشاؤها تلقائياً قبل انتهاء الترخيص.</p></div><Badge className="bg-amber-200 text-amber-900">{notifications.filter(item => !item.isRead).length} غير مقروء</Badge></div><div className="mt-4 grid gap-3 lg:grid-cols-3">{notifications.slice(0, 6).map(item => <button key={item.id} onClick={() => { markNotificationRead.mutate({ id: item.id }); setLocation(`/licenses/${item.licenseId}`); }} className={`rounded-2xl border p-4 text-right transition-colors hover:bg-white ${item.isRead ? "border-amber-200/60 bg-white/40" : "border-amber-300 bg-white shadow-sm"}`}><p className="font-bold text-emerald-950">{item.facilityName}</p><p className="mt-1 text-sm text-slate-600">ترخيص {item.licenseNo}</p><p className="mt-2 text-xs font-bold text-amber-800">ينتهي في {formatDate(item.expiryDate)}</p></button>)}</div></section> : null}
        </>}
      </div>
    </DashboardLayout>
  );
}

type DashboardAnalytics = {
  period: { year: number; month: number | null; label: string };
  availableYears: number[];
  total: { total: number; active: number; expired: number };
  facilities: {
    pharmacy: { total: number; active: number; expired: number };
    warehouse: { total: number; active: number; expired: number };
  };
  monthlySeries: Array<{ month: number; label: string; total: number; active: number; expired: number }>;
  activity: { addedThisMonth: number; addedPreviousMonth: number; addedThisYear: number; monthlyChange: number };
  expiryWindows: { days30: number; days60: number; days90: number };
  governorates: Array<{ name: string; total: number }>;
};

function AnalyticsCenter({ analytics, loading, year, month, onYearChange, onMonthChange }: {
  analytics?: DashboardAnalytics;
  loading: boolean;
  year: number;
  month: number;
  onYearChange: (value: number) => void;
  onMonthChange: (value: number) => void;
}) {
  const maxMonthlyTotal = Math.max(...(analytics?.monthlySeries.map(item => item.total) ?? [0]), 1);
  return <section className="rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm shadow-emerald-950/5 sm:p-6">
    <div className="flex flex-col gap-4 border-b border-emerald-950/7 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-emerald-900"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100"><BarChart3 className="h-5 w-5" /></span><div><h2 className="font-extrabold">مركز الإحصاءات</h2><p className="mt-0.5 text-sm font-normal text-slate-500">تُحتسب الفترة وفق تاريخ إصدار الترخيص.</p></div></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-slate-600"><span>السنة</span><select value={year} onChange={event => onYearChange(Number(event.target.value))} className="h-10 min-w-32 rounded-xl border border-emerald-950/15 bg-white px-3 text-sm text-emerald-950 outline-none transition focus:border-emerald-600">{(analytics?.availableYears?.length ? analytics.availableYears : [year]).map(option => <option key={option} value={option}>{option}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-bold text-slate-600"><span>الشهر</span><select value={month} onChange={event => onMonthChange(Number(event.target.value))} className="h-10 min-w-36 rounded-xl border border-emerald-950/15 bg-white px-3 text-sm text-emerald-950 outline-none transition focus:border-emerald-600"><option value={0}>السنة كاملة</option>{analytics?.monthlySeries.map(item => <option key={item.month} value={item.month}>{item.label}</option>)}</select></label>
      </div>
    </div>
    {loading || !analytics ? <div className="grid min-h-72 place-items-center"><Loader2 className="animate-spin text-emerald-700" /></div> : <>
      <div className="mt-5 flex items-center gap-2 text-sm text-slate-600"><CalendarDays className="h-4 w-4 text-amber-700" /><span>الفترة المحددة: <strong className="text-emerald-950">{analytics.period.label}</strong></span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AnalyticsMetric title="تراخيص صادرة" value={analytics.total.total} icon={Archive} tone="bg-slate-100 text-slate-700" />
        <AnalyticsMetric title="صيدليات" value={analytics.facilities.pharmacy.total} icon={Store} tone="bg-violet-100 text-violet-800" />
        <AnalyticsMetric title="مخازن" value={analytics.facilities.warehouse.total} icon={Warehouse} tone="bg-amber-100 text-amber-800" />
        <AnalyticsMetric title="سارية" value={analytics.total.active} icon={FileCheck2} tone="bg-emerald-100 text-emerald-800" />
        <AnalyticsMetric title="منتهية" value={analytics.total.expired} icon={CircleAlert} tone="bg-rose-100 text-rose-800" />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4"><div className="flex items-center justify-between"><div><p className="font-extrabold text-emerald-950">يحتاج إلى انتباه</p><p className="mt-1 text-xs text-slate-600">تنبيهات انتهاء الصلاحية بحسب المدة المتبقية.</p></div><CircleAlert className="h-5 w-5 text-amber-700" /></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><AttentionMetric label="30 يوماً" value={analytics.expiryWindows.days30} tone="text-rose-700" /><AttentionMetric label="60 يوماً" value={analytics.expiryWindows.days60} tone="text-amber-700" /><AttentionMetric label="90 يوماً" value={analytics.expiryWindows.days90} tone="text-emerald-700" /></div></div>
        <div className="rounded-2xl border border-emerald-950/7 bg-[#f8faf8] p-4"><p className="font-extrabold text-emerald-950">نشاط الإدخال</p><div className="mt-4 grid grid-cols-3 gap-3 text-center"><MiniActivity label="هذا الشهر" value={analytics.activity.addedThisMonth} /><MiniActivity label="هذا العام" value={analytics.activity.addedThisYear} /><MiniActivity label="مقارنة بالشهر السابق" value={`${analytics.activity.monthlyChange > 0 ? "+" : ""}${analytics.activity.monthlyChange}`} /></div></div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <FacilityAnalyticsCard title="الصيدليات" label="صيدلية" data={analytics.facilities.pharmacy} icon={Store} accent="emerald" />
        <FacilityAnalyticsCard title="المخازن" label="مخزن" data={analytics.facilities.warehouse} icon={Warehouse} accent="amber" />
      </div>
      <div className="mt-5 rounded-2xl bg-[#f8faf8] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><p className="font-bold text-emerald-950">حركة التراخيص خلال {year}</p><p className="mt-1 text-xs text-slate-500">عدد التراخيص الصادرة في كل شهر.</p></div><Badge className="bg-white text-emerald-800 shadow-sm">{analytics.total.total} ضمن الفترة</Badge></div>
        <div className="mt-5 grid h-44 grid-cols-12 items-end gap-1.5 sm:gap-2" aria-label={`مخطط التراخيص الصادرة خلال ${year}`}>
          {analytics.monthlySeries.map(item => <div key={item.month} className="flex h-full min-w-0 flex-col items-center justify-end gap-2"><span className="text-[10px] font-bold text-emerald-950">{item.total || ""}</span><div title={`${item.label}: ${item.total} ترخيص`} className="w-full min-h-1 rounded-t-md bg-emerald-600 transition-all" style={{ height: `${Math.max(item.total ? (item.total / maxMonthlyTotal) * 100 : 2, 2)}%` }} /><span className="text-[9px] text-slate-500 sm:text-[10px]">{item.label.slice(0, 3)}</span></div>)}
        </div>
      </div>
      {analytics.governorates.length > 0 && <div className="mt-5 rounded-2xl border border-emerald-950/7 p-4"><p className="font-bold text-emerald-950">التراخيص حسب المحافظة</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{analytics.governorates.map(item => <div key={item.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-600">{item.name}</span><strong className="text-emerald-950">{item.total}</strong></div>)}</div></div>}
    </>}
  </section>;
}

function AnalyticsMetric({ title, value, icon: Icon, tone }: { title: string; value: number; icon: typeof Archive; tone: string }) {
  return <div className="rounded-2xl border border-emerald-950/7 bg-[#fcfdfb] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-600">{title}</p><span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-2xl font-extrabold text-emerald-950">{value}</p></div>;
}

function AttentionMetric({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="rounded-xl bg-white p-3"><p className={`text-xl font-extrabold ${tone}`}>{value}</p><p className="mt-1 text-xs text-slate-600">خلال {label}</p></div>; }
function MiniActivity({ label, value }: { label: string; value: number | string }) { return <div><p className="text-xl font-extrabold text-emerald-950">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>; }

function FacilityAnalyticsCard({ title, label, data, icon: Icon, accent }: { title: string; label: string; data: { total: number; active: number; expired: number }; icon: typeof Archive; accent: "emerald" | "amber" }) {
  const activeRate = data.total ? Math.round((data.active / data.total) * 100) : 0;
  const barColor = accent === "emerald" ? "bg-emerald-600" : "bg-amber-500";
  const iconTone = accent === "emerald" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";
  return <div className="rounded-2xl border border-emerald-950/7 p-4"><div className="flex items-center justify-between"><div><p className="font-bold text-emerald-950">{title}</p><p className="mt-1 text-xs text-slate-500">ضمن الفترة المحددة</p></div><span className={`grid h-9 w-9 place-items-center rounded-xl ${iconTone}`}><Icon className="h-4 w-4" /></span></div><div className="mt-5 grid grid-cols-3 gap-3 text-center"><div><p className="text-xl font-extrabold text-emerald-950">{data.total}</p><p className="mt-1 text-xs text-slate-500">الإجمالي</p></div><div><p className="text-xl font-extrabold text-emerald-700">{data.active}</p><p className="mt-1 text-xs text-slate-500">ساري</p></div><div><p className="text-xl font-extrabold text-rose-700">{data.expired}</p><p className="mt-1 text-xs text-slate-500">منتهٍ</p></div></div><div className="mt-5"><div className="mb-2 flex justify-between text-xs text-slate-600"><span>نسبة التراخيص السارية</span><span className="font-bold text-emerald-950">{activeRate}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${activeRate}%` }} /></div></div><p className="sr-only">{label}: {data.total} إجمالي، {data.active} ساري، {data.expired} منتهٍ</p></div>;
}

function SummaryLine({ label, value, color, total }: { label: string; value: number; color: string; total: number }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return <div><div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-700">{label}</span><span className="font-bold text-emerald-950">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-amber-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div></div>;
}

function EmptyNotice({ text }: { text: string }) { return <div className="grid min-h-48 place-items-center px-5 text-center text-sm text-slate-500">{text}</div>; }
function ErrorPanel({ text }: { text: string }) { return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">تعذر تحميل بيانات اللوحة: {text}</div>; }
