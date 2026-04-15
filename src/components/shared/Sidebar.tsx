"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  MessageSquare,
  Settings,
  SlidersHorizontal,
  Users,
  Stethoscope,
  BarChart3,
  Bell,
  CreditCard,
  Shield,
  Star,
  ClipboardList,
  Video,
  Activity,
  AlertTriangle,
  PawPrint,
  Lock,
} from "lucide-react";

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  /** If set, renders a section label above this item */
  section?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
   Owner navigation
────────────────────────────────────────────────────────────────────────── */
const ownerNav: SidebarItem[] = [
  { label: "Ana Sayfa",       href: "/owner/dashboard",       icon: LayoutDashboard },
  { label: "Hayvanlarım",     href: "/owner/pets",             icon: PawPrint },
  { label: "Randevularım",    href: "/owner/appointments",     icon: Calendar },
  { label: "Veterineri Bul",  href: "/veteriner-bul",          icon: Stethoscope },
  { label: "Semptom Kontrol", href: "/owner/symptom-check",    icon: Activity },
  { label: "Şikayetlerim",    href: "/owner/complaints",       icon: AlertTriangle },
  { label: "Bildirimler",     href: "/owner/notifications",    icon: Bell },
  { label: "Profilim",        href: "/owner/profile",          icon: Settings },
  { label: "Ayarlar",         href: "/owner/settings",         icon: SlidersHorizontal },
];

/* ──────────────────────────────────────────────────────────────────────────
   Vet navigation — functional hierarchy (Command Center blueprint)
   ┌─ KOMUTA   → Dashboard, Randevular
   ├─ KLİNİK   → Takvim (single source of truth), Hastalarım, Video Görüşme
   ├─ İÇGÖRÜ  → Analitik, Bildirimler
   └─ HESAP    → Şikayetler, Profil & Ayarlar (combined hub)
────────────────────────────────────────────────────────────────────────── */
const vetNav: SidebarItem[] = [
  // ── Command ────────────────────────────────────────────────────────────
  { section: "Komuta",        label: "Gösterge Paneli", href: "/vet/dashboard",    icon: LayoutDashboard },
  {                           label: "Randevular",       href: "/vet/appointments", icon: Calendar },

  // ── Clinical ───────────────────────────────────────────────────────────
  { section: "Klinik",        label: "Takvim",           href: "/vet/calendar",     icon: CalendarDays },
  {                           label: "Hastalarım",        href: "/vet/patients",     icon: PawPrint },
  {                           label: "Video Görüşme",     href: "/vet/video",        icon: Video },

  // ── Insight ────────────────────────────────────────────────────────────
  { section: "İçgörü",        label: "Analitik",         href: "/vet/analytics",    icon: BarChart3 },
  {                           label: "Bildirimler",       href: "/vet/notifications",icon: Bell },

  // ── Account ────────────────────────────────────────────────────────────
  { section: "Hesap",         label: "Şikayetler",       href: "/vet/complaints",   icon: Shield },
  // Profil & Ayarlar — combined hub: profile page hosts both via its tab system
  {                           label: "Profil & Ayarlar",  href: "/vet/profile",      icon: Settings },

  // ── Destek ────────────────────────────────────────────────────────────
  // Opens the floating VetSupportWidget (auto-opens via ?support=open param)
  { section: "Destek",        label: "Canlı Destek",     href: "/vet/dashboard?support=open", icon: MessageSquare },
];

/* ──────────────────────────────────────────────────────────────────────────
   Admin navigation
────────────────────────────────────────────────────────────────────────── */
const SHOW_DATA_BREACH = process.env.NEXT_PUBLIC_SHOW_DATA_BREACH === "true";

const adminNav: SidebarItem[] = [
  { label: "Gösterge Paneli",  href: "/admin/dashboard",     icon: LayoutDashboard },
  { label: "Veterinerler",     href: "/admin/vets",           icon: Stethoscope },
  { label: "Hayvan Sahipleri", href: "/admin/owners",         icon: Users },
  { label: "Randevular",       href: "/admin/appointments",   icon: Calendar },
  { label: "Ödemeler",         href: "/admin/payments",       icon: CreditCard },
  { label: "Değerlendirmeler", href: "/admin/reviews",        icon: Star },
  { label: "Şikayetler",       href: "/admin/disputes",       icon: Shield },
  { label: "İçerik",           href: "/admin/content",        icon: ClipboardList },
  { label: "Duyurular",        href: "/admin/announcements",  icon: MessageSquare },
  { label: "Destek Merkezi",   href: "/admin/support",        icon: MessageSquare },
  { label: "AI & Sistem",      href: "/admin/monitoring",     icon: Activity },
  { label: "Analitik",         href: "/admin/analytics",      icon: BarChart3 },
  ...(SHOW_DATA_BREACH ? [{ label: "Veri İhlali", href: "/admin/data-breach", icon: AlertTriangle }] : []),
];

/** Routes accessible to unverified vets — must match middleware UNVERIFIED_ALLOWED */
const VET_UNVERIFIED_ALLOWED = ["/vet/profile", "/vet/settings", "/vet/pending-approval"];

interface SidebarProps {
  role: "owner" | "vet" | "admin";
  notificationCount?: number;
  pendingVetCount?: number;
  /** When true the vet's account is pending/rejected — lock inaccessible items */
  vetUnverified?: boolean;
}

export default function Sidebar({
  role,
  notificationCount,
  pendingVetCount,
  vetUnverified,
}: SidebarProps) {
  const pathname = usePathname();

  const baseNav = role === "owner" ? ownerNav : role === "vet" ? vetNav : adminNav;

  // Inject badge counts
  const navItems = baseNav.map((item) => {
    if (
      (item.href === "/owner/notifications" || item.href === "/vet/notifications") &&
      notificationCount && notificationCount > 0
    ) return { ...item, badge: notificationCount };
    if (item.href === "/admin/vets" && pendingVetCount && pendingVetCount > 0)
      return { ...item, badge: pendingVetCount };
    return item;
  });

  const roleLabel =
    role === "owner" ? "Pet Sahibi Paneli" :
    role === "vet"   ? "Veteriner Paneli"  :
    "Yönetici Paneli";

  return (
    <aside className="hidden md:flex w-60 flex-col bg-white border-r border-gray-100 min-h-screen shrink-0">
      <div className="px-4 py-3.5 border-b border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          {roleLabel}
        </p>
      </div>

      {/* Unverified vet notice */}
      {vetUnverified && (
        <div className="mx-2 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-[11px] text-amber-700 font-medium leading-snug">
            Hesabınız onaylandıktan sonra tüm sekmelere erişebilirsiniz.
          </p>
        </div>
      )}

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          // Determine whether this item is locked for an unverified vet
          const isLocked =
            vetUnverified &&
            role === "vet" &&
            !VET_UNVERIFIED_ALLOWED.some((p) => item.href.startsWith(p));

          // Active-link detection
          const isPublicLink =
            !item.href.startsWith("/owner") &&
            !item.href.startsWith("/vet") &&
            !item.href.startsWith("/admin");
          const isDashboard =
            item.href === "/owner/dashboard" ||
            item.href === "/vet/dashboard" ||
            item.href === "/admin/dashboard";
          const isActive =
            !isLocked &&
            (pathname === item.href ||
              (!isPublicLink && !isDashboard && pathname.startsWith(item.href + "/")));

          // Also mark "Profil & Ayarlar" active when on settings page
          const isActiveSettings =
            item.href === "/vet/profile" &&
            item.label === "Profil & Ayarlar" &&
            (pathname.startsWith("/vet/profile") || pathname.startsWith("/vet/settings"));

          const Icon = item.icon;

          return (
            <div key={item.href}>
              {/* Section header */}
              {item.section && (
                <p className="mt-4 mb-1 px-3 text-[10px] font-medium text-slate-300 uppercase tracking-widest select-none first:mt-0">
                  {item.section}
                </p>
              )}

              {isLocked ? (
                <div
                  title="Hesabınız onaylanana kadar erişilemez"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                             text-gray-300 cursor-not-allowed select-none"
                >
                  <Icon className="w-4 h-4 shrink-0 text-gray-200" />
                  <span className="flex-1 truncate">{item.label}</span>
                  <Lock className="w-3 h-3 text-gray-300 shrink-0" />
                </div>
              ) : (
                <Link
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                    isActive || isActiveSettings
                      ? "bg-[#166534] text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isActive || isActiveSettings ? "text-white" : "text-gray-400"
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span
                      className={cn(
                        "text-[11px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1",
                        isActive || isActiveSettings
                          ? "bg-white/25 text-white"
                          : "bg-red-500 text-white"
                      )}
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
