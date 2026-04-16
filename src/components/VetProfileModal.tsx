"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  X, Star, MapPin, ShieldCheck, Video, Clock,
  GraduationCap, Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { Vet } from "@/app/veterinerler/client";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  owner: { full_name: string } | { full_name: string }[] | null;
}

interface Props {
  vet: Vet;
  onClose: () => void;
}

const DAY_LABELS: Record<string, string> = {
  pzt: "Pazartesi", sal: "Salı", car: "Çarşamba",
  per: "Perşembe", cum: "Cuma", cmt: "Cumartesi", paz: "Pazar",
};

export default function VetProfileModal({ vet, onClose }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const user = Array.isArray(vet.user) ? vet.user[0] : vet.user;
  const initials =
    user?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2) || "V";

  // Parse specialties from JSON or plain string
  const specialties: string[] = (() => {
    if (!vet.specialty) return [];
    try {
      const p = JSON.parse(vet.specialty);
      return Array.isArray(p) ? p : [vet.specialty];
    } catch {
      return [vet.specialty];
    }
  })();

  // Parse working days
  const workingDays: string[] = (() => {
    if (!vet.working_days) return [];
    if (Array.isArray(vet.working_days)) return vet.working_days as string[];
    try {
      const p = JSON.parse(vet.working_days as string);
      return Array.isArray(p) ? p : [];
    } catch {
      return (vet.working_days as string).split(",").map((d) => d.trim());
    }
  })();

  // Fetch last 3 approved reviews when modal opens
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("reviews")
          .select(
            "id, rating, comment, created_at, owner:users!reviews_owner_id_fkey(full_name)"
          )
          .eq("vet_id", vet.id)
          .eq("is_approved", true)
          .order("created_at", { ascending: false })
          .limit(3);
        if (!cancelled) setReviews((data as unknown as Review[]) || []);
      } catch {
        /* silently ignore */
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vet.id]);

  // Lock body scroll + Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          aria-label="Kapat"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Header banner */}
        <div className="bg-gradient-to-br from-[#166534] to-[#15803D] text-white p-6 rounded-t-2xl shrink-0">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-black text-white shrink-0 overflow-hidden">
              {user?.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.full_name}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  sizes="80px"
                  priority
                />
              ) : (
                initials
              )}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black leading-tight">
                  Vet. Hek. {user?.full_name}
                </h2>
                {vet.is_verified && (
                  <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3" /> Doğrulandı
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 mt-1 text-white/80">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="text-sm">{vet.city}</span>
              </div>

              {vet.average_rating && vet.average_rating > 0 ? (
                <div className="flex items-center gap-0.5 mt-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= Math.round(vet.average_rating!)
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-white/20 text-white/20"
                      }`}
                    />
                  ))}
                  <span className="text-sm text-white/90 ml-1.5">
                    {vet.average_rating.toFixed(1)}{" "}
                    <span className="text-white/70">({vet.total_reviews} yorum)</span>
                  </span>
                </div>
              ) : (
                <p className="text-sm text-white/60 mt-2">Henüz değerlendirme yok</p>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Specialties */}
          {specialties.length > 0 && (
            <section>
              <SectionLabel>Uzmanlık Alanları</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {specialties.map((s) => (
                  <span
                    key={s}
                    className="px-3 py-1 bg-green-50 text-green-800 text-sm font-medium rounded-full border border-green-200"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* About */}
          {vet.bio && (
            <section>
              <SectionLabel>Hakkında</SectionLabel>
              <p className="text-sm text-gray-700 leading-relaxed mt-2">{vet.bio}</p>
            </section>
          )}

          {/* Education & experience */}
          {vet.education && (
            <section>
              <SectionLabel>Eğitim</SectionLabel>
              <div className="mt-2 flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-sm text-gray-900">{vet.education}</p>
              </div>
            </section>
          )}

          {/* Services */}
          <section>
            <SectionLabel>Hizmetler</SectionLabel>
            <div className="flex flex-wrap gap-3 mt-2">
              {vet.offers_in_person && (
                <ServicePill
                  emoji="🏥"
                  label="Yüz Yüze"
                  sub={vet.video_consultation_fee ? undefined : undefined}
                  color="green"
                />
              )}
              {vet.offers_video && (
                <ServicePill
                  icon={<Video className="w-4 h-4 text-blue-600" />}
                  label="Online Görüşme"
                  sub={
                    vet.video_consultation_fee
                      ? `₺${vet.video_consultation_fee}`
                      : undefined
                  }
                  color="blue"
                />
              )}
              {vet.offers_nobetci && (
                <ServicePill emoji="🚨" label="Nöbetçi Veteriner" color="red" />
              )}
            </div>
          </section>

          {/* Working hours */}
          {(vet.working_hours_start || workingDays.length > 0) && (
            <section>
              <SectionLabel>Çalışma Saatleri</SectionLabel>
              <div className="mt-2 flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                <Clock className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {vet.working_hours_start && vet.working_hours_end && (
                    <p className="text-sm font-medium text-gray-900">
                      {vet.working_hours_start} – {vet.working_hours_end}
                    </p>
                  )}
                  {workingDays.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {workingDays.map((d) => (
                        <span
                          key={d}
                          className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-md text-gray-700"
                        >
                          {DAY_LABELS[d] ?? d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Reviews */}
          <section>
            <SectionLabel>Son Değerlendirmeler</SectionLabel>
            <div className="mt-2 space-y-3">
              {reviewsLoading ? (
                <>
                  <div className="animate-pulse h-20 bg-gray-100 rounded-xl" />
                  <div className="animate-pulse h-20 bg-gray-100 rounded-xl" />
                  <div className="animate-pulse h-16 bg-gray-100 rounded-xl" />
                </>
              ) : reviews.length > 0 ? (
                reviews.map((r) => {
                  const reviewer = Array.isArray(r.owner) ? r.owner[0] : r.owner;
                  return (
                    <div key={r.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {reviewer?.full_name || "Anonim"}
                        </p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${
                                s <= r.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "fill-gray-200 text-gray-200"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {r.comment && (
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {r.comment}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1.5">
                        {new Date(r.created_at).toLocaleDateString("tr-TR")}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">
                  Henüz değerlendirme bulunmuyor
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Sticky CTA footer */}
        <div className="shrink-0 bg-white border-t border-gray-100 p-4 flex gap-3">
          {vet.offers_video && (
            <Link href={`/veteriner/${vet.id}?type=video`} className="flex-1">
              <Button
                variant="outline"
                className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Video className="w-4 h-4 mr-2" />
                Online Görüşme
              </Button>
            </Link>
          )}
          <Link href={`/veteriner/${vet.id}`} className={vet.offers_video ? "flex-1" : "w-full"}>
            <Button className="w-full bg-[#166534] hover:bg-[#15803D] text-white font-bold h-11">
              <Calendar className="w-4 h-4 mr-2" />
              Randevu Al
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── tiny helpers ─────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
      {children}
    </p>
  );
}

function ServicePill({
  emoji,
  icon,
  label,
  sub,
  color,
}: {
  emoji?: string;
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  color: "green" | "blue" | "red";
}) {
  const palette = {
    green: "bg-green-50 border-green-200 text-green-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    red: "bg-red-50 border-red-200 text-red-800",
  }[color];

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${palette}`}>
      {emoji ? <span className="text-lg leading-none">{emoji}</span> : icon}
      <div>
        <p className="text-sm font-medium leading-tight">{label}</p>
        {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
