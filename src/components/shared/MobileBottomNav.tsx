"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Activity,
  Settings,
  SlidersHorizontal,
  Users,
  Stethoscope,
  BarChart3,
  CreditCard,
  ClipboardList,
  PawPrint,
  UserCircle,
  Bell,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badgeKey?: "notification";
}

const ownerBottomNav: NavItem[] = [
  { label: "Ana Sayfa",  href: "/owner/dashboard",      icon: LayoutDashboard },
  { label: "Hayvanlarım",href: "/owner/pets",            icon: PawPrint },
  { label: "Randevu",    href: "/owner/appointments",    icon: Calendar },
  { label: "Semptom",    href: "/owner/symptom-check",   icon: Activity },
  { label: "Profilim",   href: "/owner/profile",         icon: Settings },
];

const vetBottomNav: NavItem[] = [
  { label: "Gösterge",   href: "/vet/dashboard",    icon: LayoutDashboard },
  { label: "Randevular", href: "/vet/appointments", icon: Calendar },
  { label: "Hastalar",   href: "/vet/patients",     icon: PawPrint },
  { label: "Bildirim",   href: "/vet/notifications",icon: Bell, badgeKey: "notification" },
  { label: "Profil",     href: "/vet/profile",      icon: UserCircle },
];

const adminBottomNav: NavItem[] = [
  { label: "Gösterge",       href: "/admin/dashboard",   icon: LayoutDashboard },
  { label: "Veterinerler",   href: "/admin/vets",         icon: Stethoscope },
  { label: "Hayvan Sahipleri",href: "/admin/owners",      icon: Users },
  { label: "Ödemeler",       href: "/admin/payments",     icon: CreditCard },
  { label: "İçerik",         href: "/admin/content",      icon: ClipboardList },
];

interface MobileBottomNavProps {
  role: "owner" | "vet" | "admin";
  notificationCount?: number;
}

export default function MobileBottomNav({ role, notificationCount = 0 }: MobileBottomNavProps) {
  const pathname = usePathname();
  const navItems = role === "owner" ? ownerBottomNav : role === "vet" ? vetBottomNav : adminBottomNav;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-2 pb-safe">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          const badgeCount = item.badgeKey === "notification" ? notificationCount : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center gap-1 py-3 px-3 rounded-lg transition-colors min-w-0 min-h-[56px] justify-center",
                isActive ? "text-[#166534]" : "text-gray-500"
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5 shrink-0" />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
