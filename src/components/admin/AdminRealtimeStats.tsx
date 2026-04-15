"use client";

/**
 * AdminRealtimeStats — subscribes to Supabase Realtime on /admin/dashboard only.
 * Shows a live "new appointment" badge that ticks up in real-time.
 * Unsubscribes automatically on component unmount.
 */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Activity } from "lucide-react";

export default function AdminRealtimeStats() {
  const [newAppointments, setNewAppointments] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments" },
        () => setNewAppointments((n) => n + 1)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments" },
        () => setNewAppointments((n) => n + 1)
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    // Unsubscribe on unmount — critical to prevent memory/connection leaks
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!connected && newAppointments === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Live indicator dot */}
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          connected ? "bg-green-500 animate-pulse" : "bg-gray-300"
        }`}
      />
      <span className="text-gray-500">
        {connected ? "Canlı" : "Bağlanıyor…"}
      </span>
      {newAppointments > 0 && (
        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
          <Activity className="w-3 h-3" />
          +{newAppointments} yeni
        </span>
      )}
    </div>
  );
}
