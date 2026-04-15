import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import DataBreachClient from "./client";

// Feature flag: set DATA_BREACH_UI_ENABLED=true in env to show this UI
const DATA_BREACH_UI_ENABLED = process.env.DATA_BREACH_UI_ENABLED === "true";

export default async function DataBreachPage() {
  if (!DATA_BREACH_UI_ENABLED) {
    redirect("/admin/dashboard");
  }

  const supabase = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: userData } = await supabase
    .from("users").select("role").eq("id", user.id).maybeSingle();
  if (userData?.role !== "admin") redirect("/auth/login");

  const { data: breaches } = await supabase
    .from("data_breach_notifications")
    .select("*")
    .order("created_at", { ascending: false });

  return <DataBreachClient initialBreaches={breaches || []} />;
}
