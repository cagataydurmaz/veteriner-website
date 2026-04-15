import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getUserById, getVetByUserId, getUnreadNotificationCount, getAuthUser } from "@/lib/supabase/queries";
import Navbar from "@/components/shared/Navbar";
import Sidebar from "@/components/shared/Sidebar";
import MobileBottomNav from "@/components/shared/MobileBottomNav";
import VetStatusBar from "@/components/vet/VetStatusBar";
import type { User } from "@/types";
import VetSupportWidgetLoader from "@/components/support/VetSupportWidgetLoader";

export default async function VetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: { user } } = await getAuthUser();

  if (!user) redirect("/auth/vet-login");

  // Parallel fetch — cached helpers deduplicate if page also calls them
  const [{ data: userData }, { data: vetData }, { count: unreadCount }] = await Promise.all([
    getUserById(user.id),
    getVetByUserId(user.id),
    getUnreadNotificationCount(user.id),
  ]);

  if (!userData) redirect("/auth/vet-login");

  // Owner/admin trying to access vet panel → send them to their own panel
  if (userData.role === "owner") redirect("/owner/dashboard?wrong_panel=vet");
  if (userData.role === "admin") redirect("/admin/dashboard?wrong_panel=vet");
  if (userData.role !== "vet") redirect("/auth/vet-login");

  // Check account status using new account_status system
  if (vetData?.account_status === "banned" || vetData?.account_status === "deleted") {
    redirect("/auth/banned");
  }

  if (
    vetData?.account_status === "suspended" &&
    vetData?.suspended_until &&
    new Date(vetData.suspended_until) > new Date()
  ) {
    redirect(`/hesap-askiya-alindi?reason=suspension&until=${encodeURIComponent(vetData.suspended_until)}`);
  }

  // Unverified vet redirect is handled by middleware (proxy.ts → middleware.ts)
  // which redirects to /vet/pending-approval, allowing /vet/profile as an exception.

  // Update last_active_at for online-status tracking (fire-and-forget)
  const service = createServiceClient();
  void Promise.resolve(
    service
      .from("veterinarians")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", user.id)
  ).catch(() => {});

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={userData as User} unreadCount={unreadCount || 0} />
      {vetData?.id && vetData.is_verified && (
        <VetStatusBar
          vetId={vetData.id}
          initialState={{
            // Layer 1 — service permissions (now reactive via realtime)
            offers_nobetci:    vetData.offers_nobetci    ?? false,
            offers_in_person:  vetData.offers_in_person  ?? false,
            offers_video:      vetData.offers_video      ?? false,
            // Layer 2 — intent toggles
            is_available_today: vetData.is_available_today ?? false,
            is_online_now:      vetData.is_online_now      ?? false,
            is_on_call:         vetData.is_on_call         ?? false,
            // Layer 3 — reality checks
            is_busy:       vetData.is_busy       ?? false,
            buffer_lock:   vetData.buffer_lock   ?? false,
          }}
          offersInPerson={vetData.offers_in_person ?? false}
          offersVideo={vetData.offers_video ?? false}
          offersNobetci={vetData.offers_nobetci ?? false}
          videoConsultationFee={vetData.video_consultation_fee ?? null}
        />
      )}
      <div className="flex">
        <Sidebar role="vet" notificationCount={unreadCount || 0} vetUnverified={!vetData?.is_verified} />
        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 max-w-6xl">
          {children}
        </main>
      </div>
      <MobileBottomNav role="vet" notificationCount={unreadCount || 0} />
      <VetSupportWidgetLoader vetName={userData.full_name ?? "Hocam"} />
    </div>
  );
}
