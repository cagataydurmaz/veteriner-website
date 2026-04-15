export default function CalendarLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-gray-200 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-9 w-9 bg-gray-100 rounded-lg" />
          <div className="h-9 w-32 bg-gray-200 rounded-lg" />
          <div className="h-9 w-9 bg-gray-100 rounded-lg" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="p-3 text-center">
              <div className="h-3 w-8 bg-gray-100 rounded mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="h-24 border-r border-b border-gray-50 p-2">
              <div className="h-4 w-4 bg-gray-100 rounded mb-1" />
              {i % 5 === 0 && <div className="h-5 w-full bg-gray-100 rounded text-xs" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
