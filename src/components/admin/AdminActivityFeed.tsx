"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, Clock, RefreshCw, CheckCircle, MessageSquare, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FeedData {
  pendingVets: number;
  lastHourApts: number;
  todayApts: number;
  pendingReports: number;
  recentErrors: number;
  lastRefresh: Date;
}

export default function AdminActivityFeed() {
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const todayStart = new Date().toISOString().split("T")[0] + "T00:00:00";

      const [
        { count: pendingVets },
        { count: lastHourApts },
        { count: todayApts },
        { count: pendingReports },
        { count: recentErrors },
      ] = await Promise.all([
        supabase.from("veterinarians").select("*", { count: "exact", head: true }).eq("is_verified", false),
        supabase.from("appointments").select("*", { count: "exact", head: true }).gte("created_at", oneHourAgo),
        supabase.from("appointments").select("*", { count: "exact", head: true }).gte("datetime", todayStart),
        supabase.from("violation_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("system_errors").select("*", { count: "exact", head: true }).gte("created_at", oneHourAgo).in("severity", ["high", "critical"]),
      ]);

      setData({
        pendingVets: pendingVets || 0,
        lastHourApts: lastHourApts || 0,
        todayApts: todayApts || 0,
        pendingReports: pendingReports || 0,
        recentErrors: recentErrors || 0,
        lastRefresh: new Date(),
      });
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => {
    fetchData();

    // Replace 30s polling with Supabase Realtime — sub-100ms push on every relevant DB event
    const channel = supabase
      .channel("admin-activity-feed-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments" }, fetchData)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "appointments" }, fetchData)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "veterinarians" }, fetchData)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "veterinarians" }, fetchData)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "violation_reports" }, fetchData)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "violation_reports" }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase]);

  if (loading) {
    return (
      <Card className="lg:w-64 shrink-0">
        <CardContent className="pt-4">
          <div className="space-y-3 animate-pulse">
            {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-gray-100 rounded-lg" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:w-64 shrink-0 border-[#166534]/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Canlı Aktivite
          </span>
          <button onClick={fetchData} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <div className={`flex items-center justify-between p-2.5 rounded-lg ${(data?.pendingVets || 0) > 3 ? "bg-orange-50 border border-orange-200" : "bg-gray-50"}`}>
          <div className="flex items-center gap-2">
            <Stethoscope className={`w-4 h-4 ${(data?.pendingVets || 0) > 3 ? "text-orange-600" : "text-gray-500"}`} />
            <span className="text-xs text-gray-700">Onay Bekleyen Vet.</span>
          </div>
          <span className={`text-sm font-bold ${(data?.pendingVets || 0) > 3 ? "text-orange-700" : "text-gray-900"}`}>
            {data?.pendingVets || 0}
            {(data?.pendingVets || 0) > 3 && " ⚠️"}
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-700">Son 1 saat randevu</span>
          </div>
          <span className="text-sm font-bold text-blue-700">{data?.lastHourApts || 0}</span>
        </div>

        <div className="flex items-center justify-between p-2.5 bg-[#F0FDF4] rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#166534]" />
            <span className="text-xs text-gray-700">Bugün toplam randevu</span>
          </div>
          <span className="text-sm font-bold text-[#166534]">{data?.todayApts || 0}</span>
        </div>

        <div className={`flex items-center justify-between p-2.5 rounded-lg ${(data?.pendingReports || 0) > 0 ? "bg-amber-50 border border-amber-200" : "bg-gray-50"}`}>
          <div className="flex items-center gap-2">
            <MessageSquare className={`w-4 h-4 ${(data?.pendingReports || 0) > 0 ? "text-amber-600" : "text-gray-400"}`} />
            <span className="text-xs text-gray-700">Bekleyen Şikayet</span>
          </div>
          <span className={`text-sm font-bold ${(data?.pendingReports || 0) > 0 ? "text-amber-700" : "text-gray-500"}`}>
            {data?.pendingReports || 0}
          </span>
        </div>

        <div className={`flex items-center justify-between p-2.5 rounded-lg ${(data?.recentErrors || 0) > 0 ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}>
          <div className="flex items-center gap-2">
            <AlertCircle className={`w-4 h-4 ${(data?.recentErrors || 0) > 0 ? "text-red-600" : "text-gray-400"}`} />
            <span className="text-xs text-gray-700">Son 1 saat hata</span>
          </div>
          <span className={`text-sm font-bold ${(data?.recentErrors || 0) > 0 ? "text-red-700" : "text-gray-500"}`}>
            {data?.recentErrors || 0}
          </span>
        </div>

        <p className="text-[10px] text-gray-400 text-center pt-1">
          Güncellendi: {data?.lastRefresh.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          {" · "}Canlı
        </p>
      </CardContent>
    </Card>
  );
}
