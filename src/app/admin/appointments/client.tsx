"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, MapPin, Calendar, Search } from "lucide-react";
import { formatDateTime, getSpeciesEmoji } from "@/lib/utils";

type Apt = {
  id: string;
  datetime: string;
  type: string;
  status: string;
  complaint: string | null;
  pet: { name: string; species: string } | null;
  owner: { full_name: string; phone: string | null } | null;
  vet: { user: { full_name: string } | null; city: string | null } | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Beklemede",
  confirmed: "Onaylandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

function getName(obj: { full_name: string } | { full_name: string }[] | null | undefined): string {
  if (!obj) return "—";
  return Array.isArray(obj) ? (obj[0]?.full_name || "—") : obj.full_name;
}

interface Props {
  apts: Apt[];
  todayCount: number;
  pendingCount: number;
  upcomingCount: number;
  completedCount: number;
  cancelledCount: number;
}

export default function AppointmentsClient({
  apts,
  todayCount,
  pendingCount,
  upcomingCount,
  completedCount,
  cancelledCount,
}: Props) {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  const filtered = useMemo(() => {
    return apts.filter(a => {
      // Search filter
      if (search) {
        const s = search.toLowerCase();
        const ownerName = getName(a.owner).toLowerCase();
        const vetName = getName(a.vet?.user).toLowerCase();
        if (!ownerName.includes(s) && !vetName.includes(s)) return false;
      }
      // Date range filter
      if (startDate) {
        if (a.datetime < `${startDate}T00:00:00`) return false;
      }
      if (endDate) {
        if (a.datetime > `${endDate}T23:59:59`) return false;
      }
      return true;
    });
  }, [apts, search, startDate, endDate]);

  const todayApts = filtered.filter(a => a.datetime.startsWith(today));
  const pending = filtered.filter(a => a.status === "pending");
  const upcoming = filtered.filter(
    a => ["pending", "confirmed"].includes(a.status) && a.datetime >= now
  );
  const completed = filtered.filter(a => a.status === "completed");
  const cancelled = filtered.filter(a => a.status === "cancelled");

  const AptRow = ({ apt }: { apt: Apt }) => (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
      <div className="text-xl shrink-0 mt-0.5">{getSpeciesEmoji(apt.pet?.species || "")}</div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-gray-900">{apt.pet?.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[apt.status]}`}>
            {STATUS_LABELS[apt.status]}
          </span>
          {apt.type === "video" ? (
            <Badge variant="default" className="text-xs">
              <Video className="w-3 h-3 mr-1" />Video
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              <MapPin className="w-3 h-3 mr-1" />Yüz Yüze
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Vet. Hek. {getName(apt.vet?.user)} · {getName(apt.owner)}
          {apt.vet?.city && ` · ${apt.vet.city}`}
        </p>
        <p className="text-xs font-medium text-[#166534] mt-0.5">
          {formatDateTime(apt.datetime)}
        </p>
      </div>
    </div>
  );

  const Section = ({ list }: { list: Apt[] }) => (
    <Card>
      <CardContent className="p-0">
        {list.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-500">
            <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            Randevu bulunamadı
          </div>
        ) : (
          list.map(a => <AptRow key={a.id} apt={a} />)
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white border border-gray-200 rounded-2xl p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sahip adı veya veteriner adı..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
          />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="text-xs text-gray-500 whitespace-nowrap">Başlangıç:</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-xl text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
          />
          <label className="text-xs text-gray-500 whitespace-nowrap">Bitiş:</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-xl text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
          />
          {(search || startDate || endDate) && (
            <button
              onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
            >
              Temizle
            </button>
          )}
        </div>
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Bugün ({todayApts.length}/{todayCount})</TabsTrigger>
          <TabsTrigger value="pending">Bekleyen ({pending.length}/{pendingCount})</TabsTrigger>
          <TabsTrigger value="upcoming">Yaklaşan ({upcoming.length}/{upcomingCount})</TabsTrigger>
          <TabsTrigger value="completed">Tamamlanan ({completed.length}/{completedCount})</TabsTrigger>
          <TabsTrigger value="cancelled">İptal ({cancelled.length}/{cancelledCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4"><Section list={todayApts} /></TabsContent>
        <TabsContent value="pending" className="mt-4"><Section list={pending} /></TabsContent>
        <TabsContent value="upcoming" className="mt-4"><Section list={upcoming} /></TabsContent>
        <TabsContent value="completed" className="mt-4"><Section list={completed} /></TabsContent>
        <TabsContent value="cancelled" className="mt-4"><Section list={cancelled} /></TabsContent>
      </Tabs>
    </>
  );
}
