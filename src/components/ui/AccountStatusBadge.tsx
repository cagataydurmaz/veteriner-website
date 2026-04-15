import React from "react";

type Status = "active" | "under_review" | "suspended" | "banned" | "deleted";

const CONFIG: Record<Status, { label: string; className: string }> = {
  active:       { label: "Aktif",       className: "bg-green-100 text-green-800" },
  under_review: { label: "İnceleniyor", className: "bg-yellow-100 text-yellow-800" },
  suspended:    { label: "Askıda",      className: "bg-orange-100 text-orange-800" },
  banned:       { label: "Banlı",       className: "bg-red-100 text-red-800" },
  deleted:      { label: "Silindi",     className: "bg-gray-100 text-gray-600" },
};

export default function AccountStatusBadge({ status }: { status?: string | null }) {
  const s = (status ?? "active") as Status;
  const cfg = CONFIG[s] ?? CONFIG.active;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
