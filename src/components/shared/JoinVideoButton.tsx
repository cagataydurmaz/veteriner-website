"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  appointmentId: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "primary" | "white";
  className?: string;
}

/**
 * Calls /api/video/create-room (idempotent) to get the stable Agora channel
 * name (video_room_id), then navigates to /video/{roomId}?appointment={appointmentId}.
 *
 * Using a plain <Link href={`/video/${apt.id}`}> is WRONG — apt.id !== video_room_id.
 * The agora-token endpoint queries `WHERE video_room_id = channelName` so passing
 * appointment.id returns 404 and no token is issued.
 */
export default function JoinVideoButton({
  appointmentId,
  label = "Görüşmeye Katıl",
  size = "default",
  variant = "primary",
  className = "",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/video/create-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });

      const data = await res.json();

      if (!res.ok || !data.roomId) {
        setError(data.error || "Oda oluşturulamadı, lütfen tekrar deneyin.");
        return;
      }

      router.push(`/video/${data.roomId}?appointment=${appointmentId}`);
    } catch {
      setError("Bağlantı hatası, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        data-testid="join-video-btn"
        onClick={handleJoin}
        disabled={loading}
        size={size}
        className={`${
          variant === "white"
            ? "bg-white text-blue-600 hover:bg-blue-50"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        } font-bold disabled:opacity-70 ${className}`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Video className="w-4 h-4 mr-2" />
        )}
        {loading ? "Oda hazırlanıyor…" : label}
      </Button>
      {error && (
        <p className="text-xs text-red-500 text-center mt-1">{error}</p>
      )}
    </div>
  );
}
