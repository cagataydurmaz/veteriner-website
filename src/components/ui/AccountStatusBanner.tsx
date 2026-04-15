"use client";
import { AlertTriangle, Clock, Search, XCircle } from "lucide-react";

type Status = "active" | "under_review" | "suspended" | "banned" | "deleted";

interface Props {
  status: Status;
  suspendedUntil?: string | null;
  reason?: string | null;
}

export default function AccountStatusBanner({ status, suspendedUntil, reason }: Props) {
  if (status === "active") return null;

  if (status === "under_review") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3 mb-6">
        <Search className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-yellow-800">Hesabınız inceleniyor</p>
          <p className="text-sm text-yellow-700 mt-0.5">En kısa sürede bilgilendirileceksiniz.</p>
        </div>
      </div>
    );
  }

  if (status === "suspended") {
    const until = suspendedUntil
      ? new Date(suspendedUntil).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3 mb-6">
        <Clock className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-orange-800">
            Hesabınız {until ? `${until} tarihine kadar` : "geçici olarak"} askıya alındı
          </p>
          {reason && <p className="text-sm text-orange-700 mt-0.5">Sebep: {reason}</p>}
        </div>
      </div>
    );
  }

  if (status === "banned") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-6">
        <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-800">Hesabınız kalıcı olarak kapatıldı</p>
          <p className="text-sm text-red-700 mt-0.5">
            İtiraz için:{" "}
            <a href="mailto:destek@veterineribul.com" className="underline">
              destek@veterineribul.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (status === "deleted") {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3 mb-6">
        <AlertTriangle className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-gray-800">Bu hesap silinmiştir</p>
        </div>
      </div>
    );
  }

  return null;
}
