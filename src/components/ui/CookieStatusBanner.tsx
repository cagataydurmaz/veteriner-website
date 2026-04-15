"use client";
import { useEffect, useState } from "react";
import { Clock, Search } from "lucide-react";

export default function CookieStatusBanner() {
  const [suspensionData, setSuspensionData] = useState<{ until: string; reason: string } | null>(null);
  const [underReview, setUnderReview] = useState(false);

  useEffect(() => {
    const cookies = document.cookie.split(";").reduce((acc, c) => {
      const [k, v] = c.trim().split("=");
      acc[k] = v;
      return acc;
    }, {} as Record<string, string>);

    if (cookies["show_suspension_banner"]) {
      try {
        setSuspensionData(JSON.parse(decodeURIComponent(cookies["show_suspension_banner"])));
      } catch {
        // ignore parse errors
      }
    }
    if (cookies["show_review_banner"] === "true") {
      setUnderReview(true);
    }
  }, []);

  if (suspensionData) {
    const until = new Date(suspensionData.until).toLocaleDateString("tr-TR", {
      day: "numeric", month: "long", year: "numeric"
    });
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3 mb-6">
        <Clock className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-orange-800">Hesabınız {until} tarihine kadar askıya alındı</p>
          {suspensionData.reason && <p className="text-sm text-orange-700 mt-0.5">Sebep: {suspensionData.reason}</p>}
        </div>
      </div>
    );
  }

  if (underReview) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3 mb-6">
        <Search className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-yellow-800">⚠️ Hesabınız inceleniyor</p>
          <p className="text-sm text-yellow-700 mt-0.5">En kısa sürede bilgilendirileceksiniz.</p>
        </div>
      </div>
    );
  }

  return null;
}
