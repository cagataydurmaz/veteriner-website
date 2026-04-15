"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Save, Loader2, Trash2, Plus, X, Clock, Info } from "lucide-react";
import type { SlotTemplate, ServiceType } from "@/app/api/vet/schedule/route";

// ── Constants ─────────────────────────────────────────────────────────────────

// Time grid: 07:00 – 22:00 in 30-min steps
const GRID_START = 7 * 60;  // 420 min
const GRID_END   = 22 * 60; // 1320 min
const STEP       = 30;

const TIME_ROWS: string[] = [];
for (let m = GRID_START; m < GRID_END; m += STEP) {
  TIME_ROWS.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
}

// UI days: Mon=1 … Sun=0 in JS, but we display Mon-Sun left to right
const DAYS = [
  { dow: 1, label: "Pzt" },
  { dow: 2, label: "Sal" },
  { dow: 3, label: "Çar" },
  { dow: 4, label: "Per" },
  { dow: 5, label: "Cum" },
  { dow: 6, label: "Cmt" },
  { dow: 0, label: "Paz" },
];

type CellType = ServiceType | null;
type GridState = Record<number, Record<string, CellType>>; // dow → time → type

const SERVICE_COLORS: Record<ServiceType, string> = {
  clinic: "bg-green-500",
  video:  "bg-blue-500",
  both:   "bg-purple-500",
};

const SERVICE_LIGHT: Record<ServiceType, string> = {
  clinic: "bg-green-100 border-green-400 text-green-800",
  video:  "bg-blue-100 border-blue-400 text-blue-800",
  both:   "bg-purple-100 border-purple-400 text-purple-800",
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  clinic: "🏥 Klinik",
  video:  "📹 Online",
  both:   "⚡ Her İkisi",
};

const DURATION_OPTIONS = [
  { value: 15, label: "15 dk" },
  { value: 30, label: "30 dk" },
  { value: 45, label: "45 dk" },
  { value: 60, label: "60 dk" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlockedSlot {
  id:           string;
  blocked_date: string;
  start_time:   string | null;
  end_time:     string | null;
  reason:       string | null;
}

interface Props {
  vetId:          string;
  offersInPerson: boolean;
  offersVideo:    boolean;
  initialSlots:   SlotTemplate[];
  initialBlocked: BlockedSlot[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slotsToGrid(slots: SlotTemplate[]): GridState {
  const grid: GridState = {};
  for (const { dow } of DAYS) grid[dow] = {};

  for (const slot of slots) {
    const [sh, sm] = slot.start_time.split(":").map(Number);
    const [eh, em] = slot.end_time.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur < end) {
      const timeStr = `${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`;
      if (TIME_ROWS.includes(timeStr)) {
        grid[slot.day_of_week][timeStr] = slot.service_type as ServiceType;
      }
      cur += STEP; // expand in STEP increments (visual grid is always 30 min)
    }
  }
  return grid;
}

function gridToSlots(grid: GridState, slotDuration: number): SlotTemplate[] {
  const result: SlotTemplate[] = [];

  for (const { dow } of DAYS) {
    const dayMap = grid[dow] ?? {};
    // Group consecutive cells of same type into blocks
    let blockStart: string | null = null;
    let blockType:  ServiceType  | null = null;

    const flushBlock = (endTime: string) => {
      if (blockStart && blockType) {
        result.push({
          day_of_week:           dow,
          start_time:            blockStart,
          end_time:              endTime,
          service_type:          blockType,
          slot_duration_minutes: slotDuration,
          is_active:             true,
        });
      }
    };

    for (let i = 0; i < TIME_ROWS.length; i++) {
      const time = TIME_ROWS[i];
      const type = dayMap[time] ?? null;

      if (type !== blockType) {
        // Flush the previous block at this cell's start time
        if (blockType) flushBlock(time);
        blockStart = type ? time : null;
        blockType  = type;
      }
    }

    // Flush last block (ends at GRID_END)
    if (blockType) {
      const endTime = `${String(Math.floor(GRID_END / 60)).padStart(2, "0")}:${String(GRID_END % 60).padStart(2, "0")}`;
      flushBlock(endTime);
    }
  }

  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleGrid({
  offersInPerson,
  offersVideo,
  initialSlots,
  initialBlocked,
}: Props) {
  const [tab, setTab]       = useState<"weekly" | "blocked">("weekly");
  const [grid, setGrid]     = useState<GridState>(() => slotsToGrid(initialSlots));
  const [paintType, setPaintType] = useState<ServiceType>("both");
  const [isPainting, setIsPainting] = useState(false);
  const [paintMode, setPaintMode]   = useState<"set" | "erase">("set");
  const [duration, setDuration]     = useState(30);
  const [saving, setSaving]         = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  // Drag-count: tracks how many cells are being painted in the current drag session.
  // Shown as a floating badge so the user knows a batch operation is in progress.
  const [dragCount, setDragCount]   = useState(0);

  // Blocked slots state
  const [blocked, setBlocked]       = useState<BlockedSlot[]>(initialBlocked);
  const [newBlock, setNewBlock]      = useState({ date: "", startTime: "", endTime: "", reason: "" });
  const [addingBlock, setAddingBlock] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  // ── Grid paint handlers ───────────────────────────────────────────────────

  const paintCell = useCallback((dow: number, time: string, mode: "set" | "erase") => {
    setGrid((prev) => {
      const next = { ...prev, [dow]: { ...prev[dow] } };
      if (mode === "erase") {
        delete next[dow][time];
      } else {
        next[dow][time] = paintType;
      }
      return next;
    });
    setHasChanges(true);
  }, [paintType]);

  const handleMouseDown = (dow: number, time: string) => {
    const current = grid[dow]?.[time];
    const mode = current ? "erase" : "set";
    setPaintMode(mode);
    setIsPainting(true);
    setDragCount(1);
    paintCell(dow, time, mode);
  };

  const handleMouseEnter = (dow: number, time: string) => {
    if (!isPainting) return;
    paintCell(dow, time, paintMode);
    setDragCount((n) => n + 1);
  };

  const handleMouseUp = () => {
    setIsPainting(false);
    setDragCount(0);
  };

  // ── Touch paint support ───────────────────────────────────────────────────

  const handleTouchStart = (dow: number, time: string, e: React.TouchEvent) => {
    e.preventDefault(); // prevent scroll while painting
    const current = grid[dow]?.[time];
    const mode = current ? "erase" : "set";
    setPaintMode(mode);
    setIsPainting(true);
    setDragCount(1);
    paintCell(dow, time, mode);
  };

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isPainting) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
    if (!el) return;
    const dow = el.dataset.dow ? Number(el.dataset.dow) : null;
    const time = el.dataset.time ?? null;
    if (dow !== null && time) paintCell(dow, time, paintMode);
  }, [isPainting, paintMode, paintCell]);

  // Apply a service type to ALL cells in a column (day)
  const fillDay = (dow: number) => {
    setGrid((prev) => {
      const dayMap: Record<string, CellType> = {};
      for (const t of TIME_ROWS) dayMap[t] = paintType;
      return { ...prev, [dow]: dayMap };
    });
    setHasChanges(true);
  };

  const clearDay = (dow: number) => {
    setGrid((prev) => ({ ...prev, [dow]: {} }));
    setHasChanges(true);
  };

  const clearAll = () => {
    const empty: GridState = {};
    for (const { dow } of DAYS) empty[dow] = {};
    setGrid(empty);
    setHasChanges(true);
  };

  // Copy Monday's pattern to all weekdays (Mon-Fri)
  const copyMondayToWeekdays = () => {
    setGrid((prev) => {
      const next = { ...prev };
      const mondayPattern = { ...(prev[1] ?? {}) };
      for (const d of [2, 3, 4, 5]) next[d] = { ...mondayPattern };
      return next;
    });
    setHasChanges(true);
    toast.success("Pazartesi şablonu hafta içine kopyalandı.");
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const slots = gridToSlots(grid, duration);
      const res = await fetch("/api/vet/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, slotDurationMinutes: duration }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? "Takvim kaydedilemedi");
        return;
      }
      setHasChanges(false);
      toast.success("Takvim kaydedildi! Hastalar güncellenen saatlerinizi görecek.");
    } catch {
      toast.error("Bir hata oluştu, tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  // ── Blocked slots ─────────────────────────────────────────────────────────

  const handleAddBlock = async () => {
    if (!newBlock.date) { toast.error("Tarih seçin"); return; }
    setAddingBlock(true);
    try {
      const res = await fetch("/api/vet/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocked_date: newBlock.date,
          start_time:  newBlock.startTime || undefined,
          end_time:    newBlock.endTime   || undefined,
          reason:      newBlock.reason    || undefined,
        }),
      });
      const data = await res.json() as { blocked?: BlockedSlot; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Bloke gün eklenemedi"); return; }
      setBlocked((prev) => [...prev, data.blocked!]);
      setNewBlock({ date: "", startTime: "", endTime: "", reason: "" });
      toast.success("Bloke gün eklendi.");
    } catch {
      toast.error("Bir hata oluştu.");
    } finally {
      setAddingBlock(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    const res = await fetch(`/api/vet/blocked-slots?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setBlocked((prev) => prev.filter((b) => b.id !== id));
      toast.success("Bloke gün silindi.");
    } else {
      toast.error("Silinemedi.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Available service types based on vet profile
  const availableTypes: ServiceType[] = [];
  if (offersInPerson) availableTypes.push("clinic");
  if (offersVideo)    availableTypes.push("video");
  if (offersInPerson && offersVideo) availableTypes.push("both");
  if (availableTypes.length === 0) availableTypes.push("both");

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["weekly", "blocked"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "weekly" ? "📅 Haftalık Program" : `🚫 Bloke Günler ${blocked.length > 0 ? `(${blocked.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Weekly Schedule ─────────────────────────────────────────── */}
      {tab === "weekly" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="border-b border-gray-100 p-4 flex flex-wrap items-center gap-3">
            {/* Paint type selector */}
            <div className="flex gap-1.5 items-center">
              <span className="text-xs font-semibold text-gray-500 mr-1">Renk:</span>
              {availableTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setPaintType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                    paintType === type
                      ? `${SERVICE_LIGHT[type]} border-current shadow-sm`
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${SERVICE_COLORS[type]}`} />
                  {SERVICE_LABELS[type]}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-gray-200" />

            {/* Slot duration */}
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500">Randevu süresi:</span>
              <div className="flex gap-1">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setDuration(opt.value); setHasChanges(true); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      duration === opt.value
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-5 w-px bg-gray-200" />

            {/* Quick actions */}
            <div className="flex gap-1.5">
              <button
                onClick={copyMondayToWeekdays}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
              >
                Pzt → Hft içi kopyala
              </button>
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-all"
              >
                <Trash2 className="w-3 h-3" /> Temizle
              </button>
            </div>

            {/* Save button */}
            <div className="ml-auto">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center gap-2 px-4 py-2 bg-[#166534] text-white rounded-xl text-sm font-bold hover:bg-[#14532D] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[11px] text-gray-500">
            {availableTypes.map((type) => (
              <span key={type} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${SERVICE_COLORS[type]}`} />
                {SERVICE_LABELS[type]}
              </span>
            ))}
            <span className="flex items-center gap-1.5 ml-2 text-gray-400">
              <Info className="w-3 h-3" />
              Hücreye tıkla/sürükle ile müsaitlik ekle veya sil
            </span>
          </div>

          {/* Grid */}
          <div
            ref={gridRef}
            onMouseLeave={handleMouseUp}
            onMouseUp={handleMouseUp}
            onTouchEnd={handleMouseUp}
            onTouchMove={handleTouchMove}
            className="overflow-x-auto select-none relative"
            style={{ touchAction: "none", cursor: isPainting ? "crosshair" : "default" }}
          >
            {/* Drag-count floating badge */}
            {isPainting && dragCount > 1 && (
              <div className="pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-gray-900/80 text-white text-xs font-bold rounded-full backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {dragCount} hücre {paintMode === "erase" ? "silindi" : "seçildi"}
              </div>
            )}
            <div className="min-w-[560px]">
              {/* Column headers */}
              <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-100">
                <div className="p-2" />
                {DAYS.map(({ dow, label }) => (
                  <div key={dow} className="p-2 text-center">
                    <p className="text-xs font-bold text-gray-700">{label}</p>
                    <div className="flex justify-center gap-0.5 mt-1">
                      <button
                        onMouseDown={(e) => { e.preventDefault(); fillDay(dow); }}
                        onTouchEnd={(e) => { e.preventDefault(); fillDay(dow); }}
                        title={`${label} günü doldur`}
                        className="text-[10px] min-w-[44px] min-h-[44px] px-1.5 py-1 rounded bg-gray-100 hover:bg-green-100 active:bg-green-200 text-gray-400 hover:text-green-700 transition-colors flex items-center justify-center"
                      >
                        ✓
                      </button>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); clearDay(dow); }}
                        onTouchEnd={(e) => { e.preventDefault(); clearDay(dow); }}
                        title={`${label} günü temizle`}
                        className="text-[10px] min-w-[44px] min-h-[44px] px-1.5 py-1 rounded bg-gray-100 hover:bg-red-100 active:bg-red-200 text-gray-400 hover:text-red-700 transition-colors flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Time rows */}
              {TIME_ROWS.map((time, rowIdx) => (
                <div
                  key={time}
                  className={`grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-50 ${rowIdx % 2 === 0 ? "" : "bg-gray-50/30"}`}
                >
                  {/* Time label — show on the hour and half-hour */}
                  <div className="flex items-center justify-end pr-2 py-0.5">
                    <span className={`text-[10px] font-mono ${time.endsWith(":00") ? "text-gray-500 font-semibold" : "text-gray-300"}`}>
                      {time.endsWith(":00") ? time : ""}
                    </span>
                  </div>

                  {/* Day cells */}
                  {DAYS.map(({ dow }) => {
                    const type = grid[dow]?.[time] ?? null;
                    return (
                      <div
                        key={dow}
                        data-dow={dow}
                        data-time={time}
                        onMouseDown={() => handleMouseDown(dow, time)}
                        onMouseEnter={() => handleMouseEnter(dow, time)}
                        onTouchStart={(e) => handleTouchStart(dow, time, e)}
                        className={`mx-0.5 my-px min-h-[44px] sm:min-h-0 sm:h-5 rounded cursor-pointer border transition-all ${
                          type
                            ? `${SERVICE_COLORS[type]} border-transparent opacity-80 hover:opacity-100`
                            : "bg-white border-gray-100 hover:bg-gray-100"
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-gray-50 border-t border-gray-100">
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              {DAYS.map(({ dow, label }) => {
                const cells = Object.values((grid[dow] ?? {}) as Record<string, CellType>).filter(Boolean);
                const mins  = cells.length * 30;
                return (
                  <span key={dow}>
                    <span className="font-semibold text-gray-700">{label}</span>
                    {" "}
                    {mins > 0 ? `${Math.floor(mins / 60)}s ${mins % 60 > 0 ? `${mins % 60}dk` : ""}`.trim() : "—"}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Blocked Slots ──────────────────────────────────────────────── */}
      {tab === "blocked" && (
        <div className="space-y-4">
          {/* Add new block form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Bloke Gün / Saat Ekle
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tarih *</label>
                <input
                  type="date"
                  value={newBlock.date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setNewBlock((p) => ({ ...p, date: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Saat Aralığı <span className="font-normal text-gray-400">(boş = tüm gün)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={newBlock.startTime}
                    onChange={(e) => setNewBlock((p) => ({ ...p, startTime: e.target.value }))}
                    className="flex-1 h-10 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
                  />
                  <span className="text-gray-400 text-sm">—</span>
                  <input
                    type="time"
                    value={newBlock.endTime}
                    onChange={(e) => setNewBlock((p) => ({ ...p, endTime: e.target.value }))}
                    className="flex-1 h-10 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Sebep <span className="font-normal text-gray-400">(isteğe bağlı)</span>
                </label>
                <input
                  type="text"
                  value={newBlock.reason}
                  onChange={(e) => setNewBlock((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Örn: Öğle arası, Ameliyat, İzin..."
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
                />
              </div>
            </div>
            <button
              onClick={handleAddBlock}
              disabled={addingBlock || !newBlock.date}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-40"
            >
              {addingBlock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Bloke Et
            </button>
          </div>

          {/* Existing blocks */}
          {blocked.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              Henüz bloke gün eklenmedi.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {blocked.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-lg">
                      🚫
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(b.blocked_date + "T00:00:00").toLocaleDateString("tr-TR", {
                          weekday: "long", day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {b.start_time && b.end_time
                          ? `${b.start_time} – ${b.end_time}`
                          : "Tüm gün"}
                        {b.reason && ` · ${b.reason}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteBlock(b.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
