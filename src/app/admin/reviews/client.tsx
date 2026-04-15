"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Star, CheckCircle, Flag, Trash2, MessageSquare, XCircle } from "lucide-react";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  is_flagged: boolean;
  created_at: string;
  owner: { full_name: string } | { full_name: string }[] | null;
  vet: {
    specialty: string;
    user: { full_name: string } | { full_name: string }[] | null;
  } | null;
};

type Tab = "pending" | "approved" | "flagged";

interface Props {
  reviews: ReviewRow[];
}

function getName(obj: { full_name: string } | { full_name: string }[] | null): string {
  if (!obj) return "—";
  return Array.isArray(obj) ? obj[0]?.full_name || "—" : obj.full_name;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsClient({ reviews }: Props) {
  const [tab, setTab] = useState<Tab>("pending");
  const [localReviews, setLocalReviews] = useState<ReviewRow[]>(reviews);
  const [loading, setLoading] = useState<string | null>(null);

  const tabs: { key: Tab; label: string; count: number }[] = [
    {
      key: "pending",
      label: "Bekleyen",
      count: localReviews.filter(r => !r.is_approved && !r.is_flagged).length,
    },
    {
      key: "approved",
      label: "Onaylı",
      count: localReviews.filter(r => r.is_approved).length,
    },
    {
      key: "flagged",
      label: "Bayraklı",
      count: localReviews.filter(r => r.is_flagged).length,
    },
  ];

  const visibleReviews = localReviews.filter(r => {
    if (tab === "pending") return !r.is_approved && !r.is_flagged;
    if (tab === "approved") return r.is_approved;
    if (tab === "flagged") return r.is_flagged;
    return false;
  });

  const handleAction = async (reviewId: string, action: "approve" | "flag" | "delete") => {
    setLoading(reviewId + action);
    try {
      const res = await fetch("/api/admin/review-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız");

      if (action === "delete") {
        setLocalReviews(prev => prev.filter(r => r.id !== reviewId));
        toast.success("Yorum silindi");
      } else if (action === "approve") {
        setLocalReviews(prev =>
          prev.map(r => r.id === reviewId ? { ...r, is_approved: true, is_flagged: false } : r)
        );
        toast.success("Yorum onaylandı");
      } else if (action === "flag") {
        setLocalReviews(prev =>
          prev.map(r => r.id === reviewId ? { ...r, is_flagged: true, is_approved: false } : r)
        );
        toast.success("Yorum bayraklandı");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              tab === t.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === t.key ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Review cards */}
      <div className="space-y-3">
        {visibleReviews.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              {tab === "pending" ? "Onay bekleyen yorum yok" :
               tab === "approved" ? "Onaylı yorum yok" : "Bayraklı yorum yok"}
            </p>
          </div>
        ) : visibleReviews.map(review => (
          <div
            key={review.id}
            className={`bg-white rounded-2xl border p-4 ${
              review.is_flagged ? "border-red-200" :
              review.is_approved ? "border-green-200" :
              "border-yellow-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <StarRating rating={review.rating} />
                  <span className="text-xs text-gray-500">
                    {new Date(review.created_at).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  <span className="font-medium text-gray-700">{getName(review.owner)}</span>
                  {" → "}
                  <span className="font-medium text-gray-700">
                    Vet. Hek. {getName(review.vet?.user || null)}
                  </span>
                  {review.vet?.specialty && (
                    <span className="text-gray-400"> · {review.vet.specialty}</span>
                  )}
                </p>
                {review.comment ? (
                  <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 italic">Yorum metni yok</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap mt-3">
              {!review.is_approved && (
                <Button
                  size="sm"
                  className="bg-[#166534] hover:bg-[#14532D] text-white text-xs h-8"
                  onClick={() => handleAction(review.id, "approve")}
                  disabled={!!loading}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {loading === review.id + "approve" ? "..." : "Onayla"}
                </Button>
              )}
              {!review.is_approved && (
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white text-xs h-8"
                  onClick={() => handleAction(review.id, "delete")}
                  disabled={!!loading}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  {loading === review.id + "delete" ? "..." : "Reddet"}
                </Button>
              )}
              {!review.is_flagged && (
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-8"
                  onClick={() => handleAction(review.id, "flag")}
                  disabled={loading === review.id + "flag"}
                >
                  <Flag className="w-3 h-3 mr-1" />
                  Bayrakla
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-8"
                onClick={() => handleAction(review.id, "delete")}
                disabled={loading === review.id + "delete"}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Sil
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
