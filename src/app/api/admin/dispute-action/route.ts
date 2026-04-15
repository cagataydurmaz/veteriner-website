import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Admin yetkisi gerekli" }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
    }
    const disputeId = body.disputeId as string | undefined;
    const action = body.action as string | undefined;
    const admin_decision = body.admin_decision as string | null | undefined;
    const decision = body.decision as string | undefined;

    if (!disputeId || action !== "resolve") {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    if (!decision || !["uphold", "dismiss"].includes(decision)) {
      return NextResponse.json({ error: "Geçersiz karar tipi" }, { status: 400 });
    }

    const newStatus = decision === "uphold" ? "resolved" : "dismissed";

    // Service client — admin writes must not be blocked by RLS
    const service = createServiceClient();

    const { error } = await service
      .from("disputes")
      .update({
        status: newStatus,
        admin_decision: admin_decision || null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", disputeId);

    if (error) throw error;

    // If upheld, unflag the associated review
    if (decision === "uphold") {
      const { data: dispute } = await supabase
        .from("disputes")
        .select("review_id")
        .eq("id", disputeId)
        .maybeSingle();

      if (dispute?.review_id) {
        await service
          .from("reviews")
          .update({ is_flagged: false })
          .eq("id", dispute.review_id);
      }
    }

    return NextResponse.json({
      message: decision === "uphold" ? "İtiraz kabul edildi" : "İtiraz reddedildi",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("dispute-action error:", msg);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
