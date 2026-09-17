import { useAuth } from "@/_core/hooks/useAuth";
import { LicenseAdminActions } from "@/components/LicenseAdminActions";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { facilityTypeMap, formatDate, statusMap } from "@/lib/licenses";
import { buildLicensesCsv } from "@/lib/licensePresentation";
import { cacheOfflineLicenseIndex, filterOfflineLicenseIndex, getOfflineLicenseIndex, type OfflineLicenseIndexItem } from "@/lib/offlineLicenses";
import { supabaseDevelopment, supabaseDevelopmentEnabled } from "@/lib/supabaseDevelopment";
import { trpc } from "@/lib/trpc";
import { ArrowDownUp, ChevronLeft, ChevronRight, CloudOff, Download, FilePlus2, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const allValue = "all";
const pageSize = 20;
type Filters = { search?: string; facilityType?: "warehouse" | "pharmacy"; status?: "active" | "expired"; governorate?: string; issueDateFrom?: string; issueDateTo?: string };

export default function Licenses() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const supabaseMode = useMemo(() => new URLSearchParams(window.location.search).get("backend") === "supabase-development", []);
  const [supabaseAccessToken, setSupabaseAccessToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [facilityType, setFacilityType] = useState(allValue);
  const [status, setStatus] = useState(allValue);
  const [governorate, setGovernorate] = useState("");
  const [issueDateFrom, setIssueDateFrom] = useState("");
  const [issueDateTo, setIssueDateTo] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"createdAt" | "licenseNo" | "facilityName" | "issueDate" | "expiryDate">("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [offlineRows, setOfflineRows] = useState<OfflineLicenseIndexItem[]>(() => user ? getOfflineLicenseIndex(user.id) : []);
  const listInput = useMemo(() => ({ ...filters, page, pageSize, sortBy, sortDirection }), [filters, page, sortBy, sortDirection]);
  const mysqlRemote = trpc.licenses.list.useQuery(listInput, { enabled: online && !supabaseMode });
  const supabaseRemote = trpc.supabaseLicenses.operationalList.useQuery({
    accessToken: supabaseAccessToken ?? "",
    search: filters.search,
    facilityType: filters.facilityType,
    status: filters.status,
    governorate: filters.governorate,
    issueDateFrom: filters.issueDateFrom ? new Date(`${filters.issueDateFrom}T00:00:00.000Z`) : undefined,
    issueDateTo: filters.issueDateTo ? new Date(`${filters.issueDateTo}T00:00:00.000Z`) : undefined,
    page,
    pageSize,
    sortBy,
    sortDirection,
  }, { enabled: online && supabaseMode && Boolean(supabaseAccessToken), retry: false });
  const remote = supabaseMode ? supabaseRemote : mysqlRemote;
  const offlineIndex = trpc.licenses.offlineIndex.useQuery(undefined, { enabled: online && !supabaseMode });
  const exportRows = trpc.licenses.exportRows.useQuery(filters, { enabled: false });

  useEffect(() => { const connected = () => setOnline(true); const disconnected = () => setOnline(false); window.addEventListener("online", connected); window.addEventListener("offline", disconnected); return () => { window.removeEventListener("online", connected); window.removeEventListener("offline", disconnected); }; }, []);
  useEffect(() => {
    if (!supabaseMode || !supabaseDevelopmentEnabled || !supabaseDevelopment) return;
    void supabaseDevelopment.auth.getSession().then(({ data }) => setSupabaseAccessToken(data.session?.access_token ?? null));
    const { data: listener } = supabaseDevelopment.auth.onAuthStateChange((_event, session) => setSupabaseAccessToken(session?.access_token ?? null));
    return () => listener.subscription.unsubscribe();
  }, [supabaseMode]);
  useEffect(() => { if (user) setOfflineRows(getOfflineLicenseIndex(user.id)); }, [user?.id]);
  useEffect(() => { if (supabaseMode || !user || !offlineIndex.data) return; cacheOfflineLicenseIndex(user.id, offlineIndex.data, true); setOfflineRows(getOfflineLicenseIndex(user.id)); }, [offlineIndex.data, supabaseMode, user?.id]);

  const offlineFilters = { ...filters, archiveDateFrom: filters.issueDateFrom, archiveDateTo: filters.issueDateTo };
  const rows = online ? remote.data?.items ?? [] : supabaseMode ? [] : filterOfflineLicenseIndex(offlineRows, offlineFilters);
  const pagination = remote.data?.pagination;
  const applySearch = () => { setFilters({ search: search.trim() || undefined, facilityType: facilityType === allValue ? undefined : facilityType as "warehouse" | "pharmacy", status: status === allValue ? undefined : status as "active" | "expired", governorate: governorate.trim() || undefined, issueDateFrom: issueDateFrom || undefined, issueDateTo: issueDateTo || undefined }); setPage(1); };
  const clearSearch = () => { setSearch(""); setFacilityType(allValue); setStatus(allValue); setGovernorate(""); setIssueDateFrom(""); setIssueDateTo(""); setFilters({}); setPage(1); };
  async function exportCsv() { if (!online || supabaseMode) return; const result = await exportRows.refetch(); if (!result.data) return; const blob = new Blob([buildLicensesCsv(result.data)], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "licenses-filtered.csv"; document.body.appendChild(link); link.click(); window.setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1000); }

  const sourceUnavailable = supabaseMode && !supabaseAccessToken;
  return <DashboardLayout><div dir="rtl" className="mx-auto max-w-7xl space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-emerald-700">سجل الإدارة</p><h1 className="mt-1 text-3xl font-extrabold text-emerald-950">أرشيف التراخيص</h1><p className="mt-2 text-slate-500">بحث خادمي سريع مع ترقيم وفلاتر وتصدير مطابق للنتائج المعروضة.</p>{supabaseMode && <p className="mt-2 text-sm font-bold text-emerald-700">وضع انتقال Development: القراءة من Supabase بحساب اختبار معتمد.</p>}{!online && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-amber-800"><CloudOff className="h-4 w-4" />بحث دون اتصال ضمن {supabaseMode ? 0 : offlineRows.length} ترخيصاً محفوظاً في هذا الجهاز.</p>}</div><div className="flex flex-wrap gap-2"><Button onClick={() => setLocation(supabaseMode ? "/licenses/new?backend=supabase-development" : "/licenses/new")} className="bg-emerald-900 text-white hover:bg-emerald-800"><FilePlus2 className="ml-2 h-4 w-4" />إضافة ترخيص</Button>{user?.role === "admin" && !supabaseMode && <Button variant="outline" disabled={!online || exportRows.isFetching} onClick={() => void exportCsv()}><Download className="ml-2 h-4 w-4" />تصدير النتائج</Button>}</div></header><Card className="border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="space-y-3 p-4"><div className="grid gap-3 lg:grid-cols-[1.7fr_0.8fr_0.8fr_1fr]"><div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => event.key === "Enter" && applySearch()} className="pr-10" placeholder="رقم الترخيص أو الأرشيف أو اسم المنشأة أو صاحب الترخيص" /></div><Select value={facilityType} onValueChange={setFacilityType}><SelectTrigger><SelectValue placeholder="نوع المنشأة" /></SelectTrigger><SelectContent><SelectItem value={allValue}>كل الأنواع</SelectItem><SelectItem value="warehouse">مخزن أدوية</SelectItem><SelectItem value="pharmacy">صيدلية</SelectItem></SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="حالة الترخيص" /></SelectTrigger><SelectContent><SelectItem value={allValue}>كل الحالات</SelectItem><SelectItem value="active">ساري</SelectItem><SelectItem value="expired">منتهٍ</SelectItem></SelectContent></Select><div className="relative"><SlidersHorizontal className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><Input value={governorate} onChange={event => setGovernorate(event.target.value)} className="pr-10" placeholder="المحافظة" /></div></div><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"><Input type="date" value={issueDateFrom} onChange={event => setIssueDateFrom(event.target.value)} aria-label="تاريخ الإصدار من" /><Input type="date" value={issueDateTo} onChange={event => setIssueDateTo(event.target.value)} aria-label="تاريخ الإصدار إلى" /><Button onClick={applySearch} className="bg-emerald-900 text-white hover:bg-emerald-800"><Search className="ml-2 h-4 w-4" />تأكيد البحث</Button><Button variant="outline" onClick={clearSearch}>مسح الفلاتر</Button></div></CardContent></Card><div className="flex flex-col gap-3 rounded-2xl border border-emerald-950/8 bg-emerald-50/40 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">{online ? `إجمالي النتائج: ${pagination?.total ?? 0}` : `نتائج محلية: ${rows.length}`}</p><div className="flex items-center gap-2"><ArrowDownUp className="h-4 w-4 text-emerald-700" /><Select value={sortBy} onValueChange={value => { setSortBy(value as typeof sortBy); setPage(1); }}><SelectTrigger className="h-9 w-40 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="createdAt">تاريخ الإضافة</SelectItem><SelectItem value="licenseNo">رقم الترخيص</SelectItem><SelectItem value="facilityName">اسم المنشأة</SelectItem><SelectItem value="issueDate">تاريخ الإصدار</SelectItem><SelectItem value="expiryDate">تاريخ الانتهاء</SelectItem></SelectContent></Select><Button size="sm" variant="outline" onClick={() => { setSortDirection(value => value === "asc" ? "desc" : "asc"); setPage(1); }}>{sortDirection === "asc" ? "تصاعدي" : "تنازلي"}</Button></div></div>{sourceUnavailable ? <div className="rounded-2xl bg-amber-50 p-5 text-amber-900">يتطلب وضع Supabase Development تسجيل دخول بحساب اختبار معتمد من مسار المختبر أولاً.</div> : online && remote.error ? <div className="rounded-2xl bg-rose-50 p-5 text-rose-800">تعذر تحميل التراخيص: {remote.error.message}</div> : <Card className="overflow-hidden border-0 bg-white shadow-sm shadow-emerald-950/5"><CardContent className="p-0"><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1020px] text-right"><thead className="bg-emerald-50/70 text-xs text-emerald-900"><tr><th className="px-5 py-4 font-bold">رقم الترخيص</th><th className="px-5 py-4 font-bold">المنشأة</th><th className="px-5 py-4 font-bold">النوع</th><th className="px-5 py-4 font-bold">المحافظة</th><th className="px-5 py-4 font-bold">الانتهاء</th><th className="px-5 py-4 font-bold">الحالة</th><th className="px-5 py-4 font-bold">إجراءات</th></tr></thead><tbody className="divide-y divide-emerald-950/7">{online && remote.isLoading ? <LoadingRows /> : rows.length ? rows.map(row => <LicenseRow key={row.id} row={row} isAdmin={!supabaseMode && user?.role === "admin" && online} offline={!online} onOpen={() => setLocation(supabaseMode ? `/supabase-development/licenses/${row.id}` : `/licenses/${row.id}`)} />) : <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-500">لا توجد نتائج مطابقة للبحث.</td></tr>}</tbody></table></div><div className="divide-y divide-emerald-950/7 md:hidden">{online && remote.isLoading ? <div className="p-6 text-center text-slate-500">جارٍ التحميل...</div> : rows.length ? rows.map(row => <LicenseCard key={row.id} row={row} isAdmin={!supabaseMode && user?.role === "admin" && online} offline={!online} onOpen={() => setLocation(supabaseMode ? `/supabase-development/licenses/${row.id}` : `/licenses/${row.id}`)} />) : <p className="p-10 text-center text-slate-500">لا توجد نتائج مطابقة للبحث.</p>}</div></CardContent></Card>}{online && pagination && pagination.totalPages > 1 && <div className="flex flex-wrap items-center justify-center gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronRight className="ml-1 h-4 w-4" />السابق</Button><span className="text-sm font-bold text-emerald-950">صفحة {pagination.page} من {pagination.totalPages}</span><Button variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(value => value + 1)}>التالي<ChevronLeft className="mr-1 h-4 w-4" /></Button></div>}</div></DashboardLayout>;
}

function LicenseRow({ row, onOpen, isAdmin, offline }: { row: any; onOpen: () => void; isAdmin: boolean; offline: boolean }) { return <tr className="transition-colors hover:bg-emerald-50/50"><td className="px-5 py-4 font-bold text-emerald-900">{row.licenseNo}</td><td className="px-5 py-4"><p className="font-bold text-emerald-950">{row.facilityName}</p><p className="mt-1 text-xs text-slate-500">{row.holderName}</p></td><td className="px-5 py-4 text-sm text-slate-600">{facilityTypeMap[row.facilityType as keyof typeof facilityTypeMap]}</td><td className="px-5 py-4 text-sm text-slate-600">{row.governorate}</td><td className="px-5 py-4 text-sm text-slate-600">{formatDate(row.expiryDate)}</td><td className="px-5 py-4"><Status status={row.effectiveStatus} /></td><td className="px-5 py-4"><div className="flex items-center gap-2"><Button onClick={onOpen} size="sm" variant="outline" disabled={offline}>{offline ? "متاح للبحث فقط" : "عرض"}</Button>{isAdmin && <LicenseAdminActions license={row} compact />}</div></td></tr>; }
function LicenseCard({ row, onOpen, isAdmin, offline }: { row: any; onOpen: () => void; isAdmin: boolean; offline: boolean }) { return <div className="px-5 py-4"><button disabled={offline} onClick={onOpen} className="w-full text-right disabled:cursor-not-allowed disabled:opacity-70"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-emerald-950">{row.facilityName}</p><p className="mt-1 text-sm text-slate-500">{row.licenseNo} · {facilityTypeMap[row.facilityType as keyof typeof facilityTypeMap]}</p></div><Status status={row.effectiveStatus} /></div><p className="mt-3 text-sm text-slate-500">{row.governorate} · ينتهي {formatDate(row.expiryDate)}</p></button>{isAdmin && <div className="mt-3 border-t border-emerald-950/7 pt-3"><LicenseAdminActions license={row} compact /></div>}</div>; }
function Status({ status }: { status: string }) { const item = statusMap[status as keyof typeof statusMap] ?? statusMap.expired; return <Badge className={item.className}>{item.label}</Badge>; }
function LoadingRows() { return <>{Array.from({ length: 5 }).map((_, index) => <tr key={index}><td colSpan={7} className="px-5 py-6"><div className="h-4 w-full animate-pulse rounded bg-slate-100" /></td></tr>)}</>; }
