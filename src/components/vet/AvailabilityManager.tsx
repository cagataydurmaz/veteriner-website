"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, X, Loader2, CheckCircle2, Clock,
} from "lucide-react";
import { generateSlots } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────────
// day_of_week matches JS getDay(): 0=Sun, 1=Mon, … 6=Sat
const DAYS = [
  { dow: 1, short: "Pzt", label: "Pazartesi" },
  { dow: 2, short: "Sal", label: "Salı" },
  { dow: 3, short: "Çar", label: "Çarşamba" },
  { dow: 4, short: "Per", label: "Perşembe" },
  { dow: 5, short: "Cum", label: "Cuma" },
  { dow: 6, short: "Cmt", label: "Cumartesi" },
  { dow: 0, short: "Paz", label: "Pazar" },
];

const MONTH_TR = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık",
];

// Calendar week starts Monday — header labels Sun–Sat but shifted
const CAL_HEADERS = ["Pt","Sa","Ça","Pe","Cu","Ct","Pa"]; // Mon..Sun

// ── Types ─────────────────────────────────────────────────────────────────────
type SlotRow  = { id: string | null; start_time: string; end_time: string };
type WeekSlots = Record<number, SlotRow[]>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function validateSlots(slots: SlotRow[]): string | null {
  for (const s of slots) {
    if (!s.start_time || !s.end_time) return "Başlangıç ve bitiş saati girilmeli.";
    if (timeToMinutes(s.start_time) >= timeToMinutes(s.end_time))
      return "Bitiş saati başlangıçtan sonra olmalı.";
  }
  const sorted = [...slots].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  for (let i = 1; i < sorted.length; i++) {
    if (timeToMinutes(sorted[i].start_time) < timeToMinutes(sorted[i - 1].end_time))
      return "Saat aralıkları çakışıyor.";
  }
  return null;
}

/**
 * Build a Monday-start calendar grid.
 * Returns an array of (date | null); null = padding cell.
 * Grid column index 0 = Monday, 6 = Sunday.
 * JS dow of a cell at index i:  (i % 7 + 1) % 7
 */
function buildCalGrid(year: number, month: number): (number | null)[] {
  const firstDayJS  = new Date(year, month, 1).getDay(); // 0=Sun
  const padStart    = (firstDayJS + 6) % 7;              // 0=Mon offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < padStart; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  return grid;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AvailabilityManager({ vetId }: { vetId: string }) {
  const todayDate  = new Date();
  const [calMonth, setCalMonth] = useState(todayDate.getMonth());
  const [calYear,  setCalYear]  = useState(todayDate.getFullYear());

  // Default selected day-of-week = today's, but Mon if it's Sun
  const [selectedDow, setSelectedDow] = useState<number>(() => {
    const d = todayDate.getDay();
    return d === 0 ? 1 : d;
  });

  const [weekSlots,   setWeekSlots]   = useState<WeekSlots>({});
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStart,    setNewStart]    = useState("09:00");
  const [newEnd,      setNewEnd]      = useState("17:00");

  const supabase = createClient();

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("availability_slots")
        .select("id, day_of_week, start_time, end_time")
        .eq("vet_id", vetId)
        .eq("is_active", true)
        .order("start_time");

      if (error) { toast.error("Müsaitlik bilgileri yüklenemedi."); setLoading(false); return; }

      const grouped: WeekSlots = {};
      for (const row of data || []) {
        const d = row.day_of_week as number;
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push({ id: row.id, start_time: row.start_time, end_time: row.end_time });
      }
      setWeekSlots(grouped);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vetId]);

  // ── Add range ─────────────────────────────────────────────────────────────
  const addSlot = () => {
    if (timeToMinutes(newStart) >= timeToMinutes(newEnd)) {
      toast.error("Bitiş saati başlangıçtan sonra olmalı."); return;
    }
    const existing  = weekSlots[selectedDow] || [];
    const tentative: SlotRow = { id: null, start_time: newStart, end_time: newEnd };
    const err = validateSlots([...existing, tentative]);
    if (err) { toast.error(err); return; }
    setWeekSlots(prev => ({
      ...prev,
      [selectedDow]: [...(prev[selectedDow] || []), tentative],
    }));
    setNewStart(newEnd);
    setShowAddForm(false);
  };

  // ── Remove range ──────────────────────────────────────────────────────────
  const removeSlot = (dow: number, idx: number) => {
    setWeekSlots(prev => {
      const updated = [...(prev[dow] || [])];
      updated.splice(idx, 1);
      return { ...prev, [dow]: updated };
    });
  };

  // ── Save (full replace) ───────────────────────────────────────────────────
  const save = async () => {
    for (const [dow, slots] of Object.entries(weekSlots)) {
      const err = validateSlots(slots);
      if (err) {
        const label = DAYS.find(d => d.dow === Number(dow))?.label || dow;
        toast.error(`${label}: ${err}`); return;
      }
    }
    setSaving(true);
    try {
      const { error: delErr } = await supabase
        .from("availability_slots").delete().eq("vet_id", vetId);
      if (delErr) throw delErr;

      const rows: { vet_id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean }[] = [];
      for (const [dow, slots] of Object.entries(weekSlots)) {
        for (const s of slots) {
          rows.push({ vet_id: vetId, day_of_week: Number(dow), start_time: s.start_time, end_time: s.end_time, is_active: true });
        }
      }
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("availability_slots").insert(rows);
        if (insErr) throw insErr;
      }
      toast.success("Müsaitlik saatleri kaydedildi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız.");
    } finally { setSaving(false); }
  };

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const calGrid   = buildCalGrid(calYear, calMonth);
  const activeDows = new Set(
    Object.entries(weekSlots)
      .filter(([, s]) => s.length > 0)
      .map(([d]) => Number(d))
  );

  const slotsForDay = weekSlots[selectedDow] || [];
  const slotCount   = (slots: SlotRow[]) =>
    slots.reduce((n, s) => n + generateSlots(s.start_time, s.end_time, 30).length, 0);

  const selectedDayLabel = DAYS.find(d => d.dow === selectedDow)?.label ?? "";

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-[#166534]" />
        <span className="ml-2 text-sm text-gray-500">Yükleniyor…</span>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Müsaitlik Takvimi</h2>
          <p className="text-xs text-gray-500 mt-0.5">Haftalık tekrar eden müsait saatlerinizi düzenleyin</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#166534] text-white rounded-xl text-sm font-medium hover:bg-[#14532D] transition-colors disabled:opacity-50"
        >
          {saving
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <CheckCircle2 className="w-3.5 h-3.5" />
          }
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">

        {/* LEFT — Mini Calendar ───────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 lg:sticky lg:top-4">

          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-sm font-semibold text-gray-800 select-none">
              {MONTH_TR[calMonth]} {calYear}
            </span>
            <button
              onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Day-of-week headers (Mon-start) */}
          <div className="grid grid-cols-7 text-center">
            {CAL_HEADERS.map(h => (
              <div key={h} className="text-[10px] font-semibold text-gray-400 py-1 select-none">{h}</div>
            ))}
          </div>

          {/* Date grid — Monday-start */}
          <div className="grid grid-cols-7 text-center gap-y-0.5">
            {calGrid.map((date, i) => {
              if (!date) return <div key={i} className="w-8 h-8" />;
              // col 0=Mon, … 6=Sun  →  JS dow = (col+1)%7
              const col    = i % 7;
              const jsDow  = (col + 1) % 7;
              const isActive   = activeDows.has(jsDow);
              const isSelected = jsDow === selectedDow;
              const isToday    =
                date === todayDate.getDate() &&
                calMonth === todayDate.getMonth() &&
                calYear  === todayDate.getFullYear();

              return (
                <button
                  key={i}
                  title={DAYS.find(d => d.dow === jsDow)?.label}
                  onClick={() => setSelectedDow(jsDow)}
                  className={[
                    "w-8 h-8 mx-auto text-xs font-medium rounded-full flex items-center justify-center transition-all select-none",
                    isSelected
                      ? "bg-[#166534] text-white ring-2 ring-[#166534]/30 shadow-sm"
                      : isToday
                      ? "bg-orange-100 text-orange-700 font-bold hover:bg-orange-200"
                      : isActive
                      ? "bg-[#DCFCE7] text-[#166534] font-semibold hover:bg-[#BBF7D0]"
                      : "text-gray-500 hover:bg-gray-100",
                  ].join(" ")}
                >
                  {date}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100">
            {[
              { bg: "bg-[#166534]",    label: "Seçili gün" },
              { bg: "bg-[#DCFCE7] border border-[#166534]/20", label: "Müsait gün" },
              { bg: "bg-orange-100",   label: "Bugün" },
            ].map(({ bg, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-500">
                <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${bg}`} />
                {label}
              </div>
            ))}
          </div>

          {/* Weekly summary */}
          {activeDows.size > 0 && (
            <div className="pt-2 border-t border-gray-100 space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Haftalık Özet</p>
              {DAYS.filter(d => activeDows.has(d.dow)).map(day => (
                <div key={day.dow} className="flex items-center gap-1.5">
                  <span className="w-6 text-[11px] font-semibold text-gray-500 shrink-0">{day.short}</span>
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                    {(weekSlots[day.dow] || []).map((s, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-[#F0FDF4] text-[#166534] rounded text-[10px] font-medium border border-[#166534]/10 whitespace-nowrap">
                        {s.start_time}–{s.end_time}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {slotCount(weekSlots[day.dow] || [])}×
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                Toplam{" "}
                <span className="font-bold text-gray-600">
                  {[...activeDows].reduce((n, d) => n + slotCount(weekSlots[d] || []), 0)}
                </span>{" "}
                slot / hafta
              </p>
            </div>
          )}
        </div>

        {/* RIGHT — Slot editor ──────────────────────────────────────────────── */}
        <div className="space-y-3">

          {/* Day-of-week tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {DAYS.map(day => {
              const hasSlots  = activeDows.has(day.dow);
              const isSelected = selectedDow === day.dow;
              const count     = slotCount(weekSlots[day.dow] || []);
              return (
                <button
                  key={day.dow}
                  onClick={() => setSelectedDow(day.dow)}
                  className={[
                    "flex flex-col items-center px-3 py-2 rounded-xl border text-xs font-semibold transition-all min-w-[52px]",
                    isSelected
                      ? "bg-[#166534] text-white border-[#166534] shadow-sm"
                      : hasSlots
                      ? "bg-[#F0FDF4] text-[#166534] border-[#166534]/30 hover:border-[#166534]/60"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300",
                  ].join(" ")}
                >
                  {day.short}
                  {hasSlots && (
                    <span className={`text-[10px] mt-0.5 font-normal ${isSelected ? "text-white/70" : "text-[#166534]/70"}`}>
                      {count} slot
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Slot panel */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">

            {/* Panel header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedDayLabel}</p>
                {slotsForDay.length > 0 && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {slotCount(slotsForDay)} × 30 dk randevu slotu
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowAddForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F0FDF4] text-[#166534] border border-[#166534]/20 rounded-lg text-xs font-medium hover:bg-[#DCFCE7] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Saat Ekle
              </button>
            </div>

            {/* Add form */}
            {showAddForm && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-[#F0FDF4] rounded-xl border border-[#166534]/20">
                <span className="text-xs text-gray-500 shrink-0">Başlangıç</span>
                <input
                  type="time" value={newStart}
                  onChange={e => setNewStart(e.target.value)}
                  className="flex-1 h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
                />
                <span className="text-gray-400 font-medium">—</span>
                <span className="text-xs text-gray-500 shrink-0">Bitiş</span>
                <input
                  type="time" value={newEnd}
                  onChange={e => setNewEnd(e.target.value)}
                  className="flex-1 h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
                />
                <button
                  onClick={addSlot}
                  className="px-3 h-9 bg-[#166534] text-white rounded-lg text-sm font-medium hover:bg-[#14532D] transition-colors shrink-0"
                >
                  Ekle
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Empty state */}
            {slotsForDay.length === 0 ? (
              <div className="py-10 text-center">
                <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">{selectedDayLabel} günü için müsaitlik yok</p>
                <p className="text-xs text-gray-300 mt-1">
                  &ldquo;Saat Ekle&rdquo; butonuna tıklayarak zaman aralığı ekleyin
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-[#166534] text-white rounded-xl text-xs font-medium hover:bg-[#14532D] transition-colors mx-auto"
                >
                  <Plus className="w-3.5 h-3.5" /> Zaman Aralığı Ekle
                </button>
              </div>
            ) : (
              <>
                {/* 30-min slot pills (Cambly-style) */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {slotsForDay.flatMap((slot, si) =>
                    generateSlots(slot.start_time, slot.end_time, 30).map((time, ti) => (
                      <div
                        key={`${si}-${ti}`}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white select-none"
                      >
                        {time}
                      </div>
                    ))
                  )}
                </div>

                {/* Time range blocks (editable) */}
                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Zaman Aralıkları</p>
                  {slotsForDay.map((slot, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 px-3 py-2.5 bg-[#F0FDF4] rounded-xl border border-[#166534]/10"
                    >
                      <span className="text-sm font-semibold text-[#166534] flex-1">
                        {slot.start_time} — {slot.end_time}
                      </span>
                      <span className="text-xs text-[#166534]/60 shrink-0">
                        {generateSlots(slot.start_time, slot.end_time, 30).length} slot
                      </span>
                      <button
                        onClick={() => removeSlot(selectedDow, idx)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Kaldır"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
