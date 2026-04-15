import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/shared/Navbar";
import Sidebar from "@/components/shared/Sidebar";
import MobileBottomNav from "@/components/shared/MobileBottomNav";
import type { User } from "@/types";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/admin-login");

  const [{ data: userData }, { count: pendingVetCount }] = await Promise.all([
    supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("veterinarians")
      .select("*", { count: "exact", head: true })
      .eq("is_verified", false)
      .is("rejection_reason", null),
  ]);

  if (!userData) redirect("/auth/admin-login");
  if (userData.role === "owner") redirect("/owner/dashboard?wrong_panel=admin");
  if (userData.role === "vet") redirect("/vet/dashboard?wrong_panel=admin");
  if (userData.role !== "admin") redirect("/auth/admin-login");

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={userData as User} />
      <div className="flex">
        <Sidebar role="admin" pendingVetCount={pendingVetCount ?? 0} />
        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 max-w-7xl">
          {children}
        </main>
      </div>
      <MobileBottomNav role="admin" />
    </div>
  );
}
