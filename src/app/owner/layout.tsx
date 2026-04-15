import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/shared/Navbar";
import Sidebar from "@/components/shared/Sidebar";
import MobileBottomNav from "@/components/shared/MobileBottomNav";
import type { User } from "@/types";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [{ data: userData }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, role, avatar_url, city")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
  ]);

  if (!userData) redirect("/auth/login");

  // Vet/admin trying to access owner panel → send them to their own panel
  if (userData.role === "vet") redirect("/vet/dashboard?wrong_panel=owner");
  if (userData.role === "admin") redirect("/admin/dashboard?wrong_panel=owner");
  if (userData.role !== "owner") redirect("/auth/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={userData as unknown as User} unreadCount={unreadCount || 0} />
      <div className="flex">
        <Sidebar role="owner" notificationCount={unreadCount || 0} />
        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 max-w-6xl">
          {children}
        </main>
      </div>
      <MobileBottomNav role="owner" />
    </div>
  );
}
