import { alertCronFailure } from "@/lib/cron-alert";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { data: unsuspendedUsers } = await supabase
    .from("users")
    .update({ account_status: "active", suspended_until: null, suspension_reason: null })
    .eq("account_status", "suspended")
    .lt("suspended_until", now)
    .select("id, phone, full_name, email");

  const { data: unsuspendedVets } = await supabase
    .from("veterinarians")
    .update({ account_status: "active", suspended_until: null, suspension_reason: null })
    .eq("account_status", "suspended")
    .lt("suspended_until", now)
    .select("id, user_id");

  const { sendSMS } = await import("@/lib/sms");
  const { sendAccountStatusEmail } = await import("@/lib/email");

  for (const u of unsuspendedUsers ?? []) {
    // account_status_logs tablosu yok — loglama atlandı
    // Email (birincil)
    if ((u as Record<string, unknown>).email) {
      sendAccountStatusEmail({
        to: (u as Record<string, unknown>).email as string,
        name: ((u as Record<string, unknown>).full_name as string) || "Kullanıcı",
        status: "active",
      }).catch((err) => console.error("[cron/auto-unsuspend] email failed:", err));
    }
    // SMS yedek
    if (u.phone) {
      sendSMS(u.phone, "Hesabınızın askı süresi doldu ve yeniden aktif edildi. Veterineri Bul").catch((err) => console.error("[cron/auto-unsuspend] sms failed:", err));
    }
  }

  for (const v of unsuspendedVets ?? []) {
    // account_status_logs tablosu yok — loglama atlandı
  }

  return NextResponse.json({
    success: true,
    unsuspendedUsers: unsuspendedUsers?.length ?? 0,
    unsuspendedVets: unsuspendedVets?.length ?? 0,
  });
}
