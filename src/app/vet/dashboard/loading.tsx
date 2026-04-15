/**
 * Dashboard skeleton — matches the current page structure exactly so
 * there's no layout shift between the skeleton and the real content:
 *   1. Header (greeting + date)
 *   2. Stats grid (2×4)
 *   3. Bekleyen Gelir card (optional — shown as placeholder)
 *   4. Finansal özet card
 *   5. Primary Action Cards (1×3)
 *   6. Today's Appointments list
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* ── Greeting header ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="h-7 w-72 bg-gray-200 rounded-lg" />
        <div className="h-4 w-44 bg-gray-100 rounded" />
      </div>

      {/* ── Stats grid 2×4 ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[100px] bg-gray-100 rounded-xl" />
        ))}
      </div>

      {/* ── Escrow / financial cards ──────────────────────────────────────── */}
      <div className="h-[68px] bg-orange-50 rounded-2xl border border-orange-100" />
      <div className="h-[110px] bg-gray-100 rounded-2xl" />

      {/* ── Primary Action Cards ──────────────────────────────────────────── */}
      <div>
        <div className="h-4 w-28 bg-gray-200 rounded mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-[72px] bg-gray-100 rounded-2xl" />
          ))}
        </div>
      </div>

      {/* ── Appointments card ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* card header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div className="h-7 w-16 bg-gray-100 rounded-lg" />
        </div>
        {/* appointment rows */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="px-5 py-3 flex items-center gap-3 border-t border-gray-50">
            <div className="w-14 h-8 bg-gray-100 rounded" />
            <div className="w-10 h-10 bg-gray-100 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 bg-gray-100 rounded" />
              <div className="h-3 w-24 bg-gray-50 rounded" />
            </div>
            <div className="h-6 w-16 bg-gray-100 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
