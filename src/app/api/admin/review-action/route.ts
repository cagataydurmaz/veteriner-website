import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendReviewActionEmail } from "@/lib/email";

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
    const reviewId = body.reviewId as string | undefined;
    const action = body.action as string | undefined;

    if (!reviewId) {
      return NextResponse.json({ error: "reviewId zorunlu" }, { status: 400 });
    }
    if (!action || !["approve", "flag", "delete"].includes(action)) {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    const serviceSupabase = createServiceClient();

    if (action === "delete") {
      // Fetch review info before deletion for email notification
      const { data: reviewForEmail } = await serviceSupabase
        .from("reviews")
        .select(`
          reviewer:users!reviews_owner_id_fkey(full_name),
          vet:veterinarians!reviews_vet_id_fkey(user:users(full_name, email))
        `)
        .eq("id", reviewId)
        .maybeSingle();

      // Delete disputes referencing this review first
      await serviceSupabase.from("disputes").delete().eq("review_id", reviewId);
      const { error } = await serviceSupabase.from("reviews").delete().eq("id", reviewId);
      if (error) throw error;

      // Notify vet of removal
      if (reviewForEmail) {
        type VetData = { user: { full_name: string; email: string } | { full_name: string; email: string }[] | null };
        const vetData = (Array.isArray(reviewForEmail.vet) ? reviewForEmail.vet[0] : reviewForEmail.vet) as VetData | null;
        const vetUser = Array.isArray(vetData?.user) ? vetData?.user[0] : vetData?.user;
        if (vetUser?.email) {
          sendReviewActionEmail({
            to: vetUser.email,
            vetName: vetUser.full_name ?? "Veteriner",
            approved: false,
          }).catch((err) => console.error("[admin/review-action] email failed:", err));
        }
      }

      return NextResponse.json({ message: "Yorum silindi" });
    }

    if (action === "approve") {
      // Fetch review info for email notification
      const { data: reviewForEmail } = await serviceSupabase
        .from("reviews")
        .select(`
          reviewer:users!reviews_owner_id_fkey(full_name),
          vet:veterinarians!reviews_vet_id_fkey(user:users(full_name, email))
        `)
        .eq("id", reviewId)
        .maybeSingle();

      const { error } = await serviceSupabase
        .from("reviews")
        .update({ is_approved: true, is_flagged: false })
        .eq("id", reviewId);
      if (error) throw error;

      // Notify vet of approval
      if (reviewForEmail) {
        type VetData = { user: { full_name: string; email: string } | { full_name: string; email: string }[] | null };
        type ReviewerData = { full_name: string };
        const vetData = (Array.isArray(reviewForEmail.vet) ? reviewForEmail.vet[0] : reviewForEmail.vet) as VetData | null;
        const vetUser = Array.isArray(vetData?.user) ? vetData?.user[0] : vetData?.user;
        const reviewerData = (Array.isArray(reviewForEmail.reviewer) ? reviewForEmail.reviewer[0] : reviewForEmail.reviewer) as ReviewerData | null;
        if (vetUser?.email) {
          sendReviewActionEmail({
            to: vetUser.email,
            vetName: vetUser.full_name ?? "Veteriner",
            approved: true,
            reviewerName: reviewerData?.full_name,
          }).catch((err) => console.error("[admin/review-action] email failed:", err));
        }
      }

      return NextResponse.json({ message: "Yorum onaylandı" });
    }

    if (action === "flag") {
      const { error } = await serviceSupabase
        .from("reviews")
        .update({ is_flagged: true, is_approved: false })
        .eq("id", reviewId);
      if (error) throw error;
      return NextResponse.json({ message: "Yorum bayraklandı" });
    }

    return NextResponse.json({ error: "Bilinmeyen işlem" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Hata oluştu";
    console.error("review-action error:", msg);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
