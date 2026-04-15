"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X, Loader2, CheckCircle2, Calendar, Video } from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_TR = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık",
];

const MONTH_SHORT_TR = [
  "Oca","Şub","Mar","Nis","May","Haz",
  "Tem","Ağu","Eyl","Eki","Kas","Ara",
];

// Monday-start calendar headers
const CAL_HEADERS = ["Pt","Sa","Ça","Pe","Cu","Ct","Pa"];

// Weekday short names for column headers (0=Sun..6=Sat)
const DOW_SHORT_TR: Record<number, string> = {
  0: "Paz",
  1: "Pzt",
  2: "Sal",
  3: "Çar",
  4: "Per",
  5: "Cum",
  6: "Cmt",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  vetId: string;
  vetName: string;
  offersInPerson: boolean;
  offersVideo: boolean;
  videoFee: number;
  inPersonFee: number;
  autoApprove: boolean;
}

interface Pet {
  id: string;
  name: string;
  species: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Monday-start calendar grid — returns days (1..N) or null for padding */
function buildCalGrid(year: number, month: number): (number | null)[] {
  const firstDayJS = new Date(year, month, 1).getDay(); // 0=Sun
  const padStart = (firstDayJS + 6) % 7; // 0=Mon offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < padStart; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  return grid;
}

/** Get the Monday of the week containing `d` */
function getMondayOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(d, offset);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BookingCalendar({
  vetId,
  vetName,
  offersInPerson,
  offersVideo,
  videoFee,
  inPersonFee,
  autoApprove,
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  // ── Auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Calendar nav
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  // ── Type toggle
  const defaultType: "video" | "in_person" =
    offersInPerson ? "in_person" : "video";
  const [selectedType, setSelectedType] = useState<"video" | "in_person">(defaultType);

  // ── Slots data
  const [slotsData, setSlotsData] = useState<Record<string, string[]>>({});
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // ── Date / week selection
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(today));

  // ── Modal
  const [showModal, setShowModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // ── Booking form
  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [complaint, setComplaint] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [success, setSuccess] = useState<{ show: boolean; autoApproved: boolean }>({
    show: false,
    autoApproved: false,
  });
  const [bookingError, setBookingError] = useState<string | null>(null);

  const supabase = createClient();

  // ── Check auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      setAuthLoading(false);
    });
  }, []);

  // ── Fetch availability slots (28-day window, filtered by service type)
  const fetchSlots = useCallback(async (type?: "video" | "in_person") => {
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const from = todayStr;
      const toDate = addDays(today, 27);
      const to = toDateStr(toDate);
      // Map UI type to scheduler's serviceType param
      const serviceType = type === "video" ? "video" : type === "in_person" ? "clinic" : undefined;
      const url = `/api/appointments/availability?vetId=${vetId}&from=${from}&to=${to}${serviceType ? `&serviceType=${serviceType}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json() as { slots: Record<string, string[]> };
        setSlotsData(json.slots ?? {});
      } else {
        setSlotsError("Müsait saatler yüklenemedi. Sayfayı yenileyin.");
      }
    } catch {
      setSlotsError("Bağlantı hatası. Lütfen sayfayı yenileyin.");
    } finally {
      setSlotsLoading(false);
    }
  }, [vetId, todayStr]);

  // Refetch when service type changes to show correct slots per type
  useEffect(() => {
    fetchSlots(selectedType);
  }, [fetchSlots, selectedType]);

  // ── Fetch pets when modal opens
  useEffect(() => {
    if (!showModal || !userId) return;
    setPetsLoading(true);
    supabase
      .from("pets")
      .select("id, name, species")
      .eq("owner_id", userId)
      .then(({ data }) => {
        const list = (data ?? []) as Pet[];
        setPets(list);
        if (list.length > 0) setSelectedPetId(list[0].id);
        setPetsLoading(false);
      });
  }, [showModal, userId]);

  // ── Calendar helpers
  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  };

  const calGrid = buildCalGrid(calYear, calMonth);

  // Available dates set (for calendar highlighting)
  const availableDates = new Set(Object.keys(slotsData));

  // Next available date
  const nextAvailableDate = Object.keys(slotsData)
    .filter((d) => d >= todayStr)
    .sort()[0] ?? null;

  // Week columns: Mon–Sun (7 days from weekStart)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));

  // ── Slot click handler
  const handleSlotClick = (dateStr: string, time: string) => {
    if (authLoading) return;
    setSelectedDate(dateStr);
    setSelectedTime(time);
    if (!userId) {
      setShowLoginPrompt(true);
      return;
    }
    setBookingError(null);
    setSuccess({ show: false, autoApproved: false });
    setComplaint("");
    setShowModal(true);
  };

  // ── Book appointment (with real-time conflict check)
  const handleBook = async () => {
    if (!selectedDate || !selectedTime || !selectedPetId) return;
    setBookingLoading(true);
    setBookingError(null);

    // Real-time conflict check: re-verify the slot hasn't been taken
    // in the last 60 seconds by another user before finalizing.
    try {
      const checkRes = await fetch(
        `/api/appointments/availability?vetId=${vetId}&from=${selectedDate}&to=${selectedDate}`
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json() as { slots: Record<string, string[]> };
        const freshSlots = checkData.slots[selectedDate] ?? [];
        if (!freshSlots.includes(selectedTime)) {
          setBookingError("Bu saat az önce başka biri tarafından alındı. Lütfen farklı bir saat seçin.");
          // Remove the taken slot from local state
          setSlotsData((prev) => {
            const updated = { ...prev };
            if (updated[selectedDate]) {
              updated[selectedDate] = updated[selectedDate].filter((t) => t !== selectedTime);
              if (updated[selectedDate].length === 0) delete updated[selectedDate];
            }
            return updated;
          });
          setSelectedTime(null);
          setBookingLoading(false);
          return;
        }
      }
    } catch {
      // If the conflict check fails, proceed anyway (best-effort)
    }

    // Always include explicit Istanbul offset (+03:00) so PostgreSQL stores the
    // correct UTC value. Without this, timestamptz columns interpret the input
    // as server UTC (Vercel = UTC+0), shifting every booking by 3 hours.
    const datetime = `${selectedDate}T${selectedTime}:00+03:00`;

    try {
      const res = await fetch("/api/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vetId,
          petId: selectedPetId,
          datetime,
          type: selectedType,
          complaint: complaint.trim() || undefined,
        }),
      });

      const json = await res.json() as { autoApproved?: boolean; error?: string };

      if (!res.ok) {
        setBookingError(json.error ?? "Randevu oluşturulamadı");
        return;
      }

      setSuccess({ show: true, autoApproved: json.autoApproved ?? false });
      // Remove booked slot from local state
      setSlotsData((prev) => {
        const updated = { ...prev };
        if (updated[selectedDate]) {
          updated[selectedDate] = updated[selectedDate].filter((t) => t !== selectedTime);
          if (updated[selectedDate].length === 0) delete updated[selectedDate];
        }
        return updated;
      });
    } catch {
      setBookingError("Bir hata oluştu, lütfen tekrar deneyin");
    } finally {
      setBookingLoading(false);
    }
  };

  const currentFee = selectedType === "video" ? videoFee : inPersonFee;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-[#DCFCE7] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#F0FDF4] to-white px-5 py-4 border-b border-[#DCFCE7]">
        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-[#166534]" />
          Randevu Al
        </h2>

        {/* Type toggles */}
        <div className="flex gap-2 flex-wrap">
          {offersInPerson && (
            <button
              onClick={() => setSelectedType("in_person")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                selectedType === "in_person"
                  ? "bg-[#166534] text-white border-[#166534]"
                  : "bg-white text-gray-600 border-gray-300 hover:border-[#166534] hover:text-[#166534]",
              ].join(" ")}
            >
              🏥 Yüz Yüze — ₺{inPersonFee}
            </button>
          )}
          {offersVideo && (
            <button
              onClick={() => setSelectedType("video")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                selectedType === "video"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-600 hover:text-blue-600",
              ].join(" ")}
            >
              📱 Online — ₺{videoFee}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* ── LEFT: Mini Calendar ─────────────────────────────────────────── */}
        <div className="w-full lg:w-[240px] shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100 p-4 space-y-3">

          {/* Next available */}
          {nextAvailableDate && !slotsLoading && (
            <p className="text-[10px] text-gray-500">
              En yakın müsait:{" "}
              <button
                onClick={() => {
                  const d = new Date(nextAvailableDate + "T00:00:00");
                  setCalMonth(d.getMonth());
                  setCalYear(d.getFullYear());
                  setSelectedDate(nextAvailableDate);
                  setWeekStart(getMondayOfWeek(d));
                }}
                className="font-semibold text-[#166534] hover:underline"
              >
                {(() => {
                  const d = new Date(nextAvailableDate + "T00:00:00");
                  return `${d.getDate()} ${MONTH_TR[d.getMonth()]}`;
                })()}
              </button>
            </p>
          )}
          {slotsLoading && (
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor…
            </p>
          )}
          {slotsError && !slotsLoading && (
            <div className="flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
              <span>⚠️</span>
              <span>{slotsError}</span>
              <button
                onClick={() => fetchSlots(selectedType)}
                className="ml-auto underline font-semibold hover:no-underline"
              >
                Tekrar dene
              </button>
            </div>
          )}

          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <span className="text-xs font-semibold text-gray-800 select-none">
              {MONTH_TR[calMonth]} {calYear}
            </span>
            <button
              onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 text-center">
            {CAL_HEADERS.map((h) => (
              <div key={h} className="text-[9px] font-semibold text-gray-400 py-0.5 select-none">
                {h}
              </div>
            ))}
          </div>

          {/* Date grid */}
          <div className="grid grid-cols-7 text-center gap-y-0.5">
            {calGrid.map((date, i) => {
              if (!date) return <div key={i} className="w-7 h-7" />;

              const col = i % 7;
              const jsDow = (col + 1) % 7;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
              const isAvailable = availableDates.has(dateStr);
              const isSelected = selectedDate === dateStr;
              const isToday =
                date === today.getDate() &&
                calMonth === today.getMonth() &&
                calYear === today.getFullYear();
              const isPast = dateStr < todayStr;

              return (
                <button
                  key={i}
                  disabled={isPast || (!isAvailable && !slotsLoading)}
                  onClick={() => {
                    if (!isAvailable) return;
                    setSelectedDate(dateStr);
                    setWeekStart(getMondayOfWeek(new Date(dateStr + "T00:00:00")));
                  }}
                  className={[
                    "w-7 h-7 mx-auto text-[11px] font-medium rounded-full flex items-center justify-center transition-all select-none",
                    isSelected
                      ? "bg-[#166534] text-white ring-2 ring-[#166534]/30 shadow-sm"
                      : isToday && isAvailable
                      ? "bg-orange-100 text-orange-700 font-bold hover:bg-orange-200 cursor-pointer"
                      : isToday && !isAvailable
                      ? "bg-orange-50 text-orange-400"
                      : isAvailable
                      ? "bg-[#DCFCE7] text-[#166534] font-semibold hover:bg-[#BBF7D0] cursor-pointer"
                      : isPast
                      ? "text-gray-200"
                      : "text-gray-300",
                  ].join(" ")}
                  title={DOW_SHORT_TR[jsDow]}
                >
                  {date}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="space-y-1 pt-2 border-t border-gray-100">
            {[
              { bg: "bg-[#166534]", label: "Seçili" },
              { bg: "bg-[#DCFCE7] border border-[#166534]/20", label: "Müsait" },
              { bg: "bg-orange-100", label: "Bugün" },
            ].map(({ bg, label }) => (
              <div key={label} className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className={`w-3 h-3 rounded-full shrink-0 ${bg}`} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Week columns ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 p-4">
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevWeek}
              disabled={addDays(weekStart, 6) < today}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-xs font-semibold text-gray-600 select-none">
              {(() => {
                const ws = weekStart;
                const we = addDays(weekStart, 6);
                if (ws.getMonth() === we.getMonth()) {
                  return `${ws.getDate()}–${we.getDate()} ${MONTH_TR[ws.getMonth()]} ${ws.getFullYear()}`;
                }
                return `${ws.getDate()} ${MONTH_SHORT_TR[ws.getMonth()]} – ${we.getDate()} ${MONTH_SHORT_TR[we.getMonth()]} ${we.getFullYear()}`;
              })()}
            </span>
            <button
              onClick={nextWeek}
              disabled={toDateStr(weekStart) > toDateStr(addDays(today, 21))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Day columns */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const dateStr = toDateStr(day);
              const slots = slotsData[dateStr] ?? [];
              const isSelected = selectedDate === dateStr;
              const isPast = dateStr < todayStr;
              const dow = day.getDay();

              return (
                <div key={dateStr} className="min-w-0">
                  {/* Column header */}
                  <div
                    className={[
                      "text-center mb-1.5 py-1 rounded-lg",
                      isSelected ? "bg-[#DCFCE7]" : "",
                    ].join(" ")}
                  >
                    <p className={`text-[10px] font-semibold ${isSelected ? "text-[#166534]" : "text-gray-500"}`}>
                      {DOW_SHORT_TR[dow]}
                    </p>
                    <p className={`text-sm font-bold ${isSelected ? "text-[#166534]" : "text-gray-800"}`}>
                      {day.getDate()}
                    </p>
                    <p className={`text-[9px] ${isSelected ? "text-[#166534]/70" : "text-gray-400"}`}>
                      {MONTH_SHORT_TR[day.getMonth()]}
                    </p>
                  </div>

                  {/* Slots */}
                  <div className="space-y-1">
                    {slotsLoading ? (
                      <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                    ) : isPast || slots.length === 0 ? (
                      <div className="text-center py-2">
                        <span className="text-gray-300 text-sm">—</span>
                      </div>
                    ) : (
                      slots.slice(0, 8).map((time) => {
                        const isSelectedSlot = selectedDate === dateStr && selectedTime === time;
                        return (
                          <button
                            key={time}
                            onClick={() => handleSlotClick(dateStr, time)}
                            className={[
                              "w-full text-[11px] font-semibold py-1.5 rounded-lg border transition-all",
                              isSelectedSlot
                                ? "bg-[#166534] text-white border-[#166534]"
                                : "bg-white text-[#166534] border-[#166534]/30 hover:bg-[#DCFCE7] hover:border-[#166534]",
                            ].join(" ")}
                          >
                            {time}
                          </button>
                        );
                      })
                    )}
                    {!slotsLoading && slots.length > 8 && (
                      <p className="text-[10px] text-center text-gray-400">+{slots.length - 8}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {!slotsLoading && Object.keys(slotsData).length === 0 && (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Bu veteriner için uygun randevu saati bulunamadı</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Login Prompt Overlay ─────────────────────────────────────────────── */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Giriş Gerekli</h3>
              <button onClick={() => setShowLoginPrompt(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Randevu almak için giriş yapmanız gerekmektedir.
            </p>
            {selectedDate && selectedTime && (
              <div className="bg-[#F0FDF4] rounded-xl p-3 mb-4 text-sm text-[#166534] font-medium">
                {(() => {
                  const d = new Date(selectedDate + "T00:00:00");
                  return `${d.getDate()} ${MONTH_TR[d.getMonth()]} ${d.getFullYear()}, ${selectedTime}`;
                })()}
              </div>
            )}
            <div className="flex gap-3">
              <Link
                href="/auth/login"
                className="flex-1 text-center py-2.5 bg-[#166534] text-white rounded-xl text-sm font-semibold hover:bg-[#14532D] transition-colors"
              >
                Giriş Yap
              </Link>
              <Link
                href="/auth/register"
                className="flex-1 text-center py-2.5 bg-white border border-[#166534] text-[#166534] rounded-xl text-sm font-semibold hover:bg-[#F0FDF4] transition-colors"
              >
                Kayıt Ol
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Booking Modal ────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg">Randevu Detayları</h3>
              <button
                onClick={() => { setShowModal(false); setSuccess({ show: false, autoApproved: false }); setBookingError(null); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {success.show ? (
              /* ── Success state ── */
              <div className="p-6 text-center">
                <CheckCircle2 className="w-14 h-14 text-[#166534] mx-auto mb-4" />
                <h4 className="font-bold text-gray-900 text-lg mb-2">
                  {success.autoApproved ? "Randevunuz Onaylandı!" : "Randevu İsteği Gönderildi!"}
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {success.autoApproved
                    ? `Vet. Hek. ${vetName} ile randevunuz onaylandı. İyi günler dileriz!`
                    : `Randevu isteğiniz Vet. Hek. ${vetName}'e iletildi. Veteriner onayladıktan sonra size bildirim gelecek.`}
                </p>
                {selectedDate && selectedTime && (
                  <div className="mt-4 bg-[#F0FDF4] rounded-xl p-4">
                    <p className="text-sm font-semibold text-[#166534]">
                      {(() => {
                        const d = new Date(selectedDate + "T00:00:00");
                        return `${d.getDate()} ${MONTH_TR[d.getMonth()]} ${d.getFullYear()}, saat ${selectedTime}`;
                      })()}
                    </p>
                    <p className="text-xs text-[#166534]/70 mt-0.5">
                      {selectedType === "video" ? "📱 Online Görüşme" : "🏥 Yüz Yüze Muayene"}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => { setShowModal(false); setSuccess({ show: false, autoApproved: false }); }}
                  className="mt-5 w-full py-2.5 bg-[#166534] text-white rounded-xl text-sm font-semibold hover:bg-[#14532D] transition-colors"
                >
                  Tamam
                </button>
              </div>
            ) : (
              /* ── Booking form ── */
              <div className="p-5 space-y-4">
                {/* Selected date/time */}
                {selectedDate && selectedTime && (
                  <div className="bg-[#F0FDF4] rounded-xl p-4 flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-[#166534] shrink-0" />
                    <div>
                      <p className="font-semibold text-[#166534]">
                        {(() => {
                          const d = new Date(selectedDate + "T00:00:00");
                          return `${d.getDate()} ${MONTH_TR[d.getMonth()]} ${d.getFullYear()}, saat ${selectedTime}`;
                        })()}
                      </p>
                      <p className="text-xs text-[#166534]/70">
                        Vet. Hek. {vetName}
                      </p>
                    </div>
                  </div>
                )}

                {/* Type selector */}
                {offersInPerson && offersVideo && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Randevu Türü
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSelectedType("in_person")}
                        className={[
                          "flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all",
                          selectedType === "in_person"
                            ? "bg-[#F0FDF4] border-[#166534] text-[#166534]"
                            : "bg-white border-gray-200 text-gray-600 hover:border-[#166534]/40",
                        ].join(" ")}
                      >
                        <span className="text-lg">🏥</span>
                        <span>Yüz Yüze</span>
                        <span className="text-xs font-normal">₺{inPersonFee}</span>
                      </button>
                      <button
                        onClick={() => setSelectedType("video")}
                        className={[
                          "flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all",
                          selectedType === "video"
                            ? "bg-blue-50 border-blue-600 text-blue-600"
                            : "bg-white border-gray-200 text-gray-600 hover:border-blue-400",
                        ].join(" ")}
                      >
                        <Video className="w-5 h-5" />
                        <span>Online</span>
                        <span className="text-xs font-normal">₺{videoFee}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Pet selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Evcil Hayvanınız
                  </label>
                  {petsLoading ? (
                    <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                  ) : pets.length === 0 ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-700">
                      Henüz evcil hayvan eklemediniz.{" "}
                      <Link href="/owner/pets/add" className="font-semibold underline">
                        Eklemek için tıklayın
                      </Link>
                    </div>
                  ) : (
                    <select
                      value={selectedPetId}
                      onChange={(e) => setSelectedPetId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
                    >
                      {pets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.species})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Complaint/note */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Notunuz <span className="normal-case font-normal text-gray-400">(isteğe bağlı)</span>
                  </label>
                  <textarea
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    placeholder="Veterinere iletmek istediğiniz bilgiler..."
                    rows={3}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30 resize-none"
                  />
                </div>

                {/* Price */}
                <div className="flex items-center justify-between py-3 border-t border-gray-100">
                  <span className="text-sm text-gray-500">Ücret</span>
                  <span className="text-lg font-bold text-[#166534]">₺{currentFee}</span>
                </div>

                {/* Error */}
                {bookingError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {bookingError}
                  </div>
                )}

                {/* Submit button */}
                <button
                  onClick={handleBook}
                  disabled={bookingLoading || !selectedPetId || petsLoading}
                  className="w-full py-3 bg-[#166534] text-white rounded-xl text-sm font-bold hover:bg-[#14532D] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {bookingLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gönderiliyor…
                    </>
                  ) : autoApprove ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Randevuyu Onayla
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      Randevu İsteği Gönder
                    </>
                  )}
                </button>

                {!autoApprove && (
                  <p className="text-[11px] text-center text-gray-400">
                    Veteriner isteğinizi onayladıktan sonra randevunuz kesinleşecektir.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
