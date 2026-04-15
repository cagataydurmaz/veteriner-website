"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Menu, X, LogOut, User, ChevronDown, Home, PawPrint,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import type { User as UserType } from "@/types";

interface NavbarProps {
  user: UserType;
  unreadCount?: number;
}

export default function Navbar({ user, unreadCount = 0 }: NavbarProps) {
  const [menuOpen, setMenuOpen]       = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const profileRef = useRef<HTMLDivElement>(null);

  // 30 dakika hareketsizlikte otomatik çıkış
  useInactivityLogout();

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap">
            <PawPrint size={28} color="#1A6B4A" />
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-gray-900 text-base tracking-tight">Veterineri Bul</span>
              </div>
            </div>
          </Link>

          {/* Desktop Right */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Ana Sayfa */}
            <Link href="/">
              <button className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-600 hover:text-[#166534] hover:bg-[#F0FDF4] rounded-lg transition-colors font-medium min-h-[44px]">
                <Home className="w-4 h-4" />
                <span className="hidden md:inline">Ana Sayfa</span>
              </button>
            </Link>

            {/* Notifications */}
            <Link href={`/${user.role === 'owner' ? 'owner' : user.role}/notifications`}>
              <button className="relative p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Bildirimler">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px]"
                aria-expanded={profileOpen}
                aria-haspopup="true"
              >
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-[#166534] text-white text-sm font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden md:block">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{user.full_name}</p>
                  <p className="text-[11px] text-gray-500 leading-tight">
                    {user.role === "owner" ? "Pet Sahibi" : user.role === "vet" ? "Veteriner" : "Yönetici"}
                  </p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
                  <div className="px-4 py-2 border-b border-gray-100 mb-1">
                    <p className="text-xs text-gray-400">Oturum açık</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</p>
                  </div>
                  <Link href="/"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F0FDF4] hover:text-[#166534] min-h-[44px]"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Home className="w-4 h-4" /> Ana Sayfa
                  </Link>
                  <Link
                    href={`/${user.role === 'owner' ? 'owner' : user.role}/profile`}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]"
                    onClick={() => setProfileOpen(false)}
                  >
                    <User className="w-4 h-4" /> Profilim
                  </Link>
                  <hr className="my-1 border-gray-100" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 min-h-[44px]"
                  >
                    <LogOut className="w-4 h-4" /> Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: Ana Sayfa + Hamburger */}
          <div className="sm:hidden flex items-center gap-1">
            <Link href="/" className="p-2.5 text-gray-500 hover:text-[#166534] min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Ana Sayfa">
              <Home className="w-5 h-5" />
            </Link>
            <button
              className="p-2.5 text-gray-500 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu — full-screen overlay */}
      {menuOpen && (
        <>
          {/* Backdrop — tap outside to close */}
          <div
            className="fixed inset-0 bg-black/40 z-40 sm:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="fixed top-16 left-0 right-0 bottom-0 bg-white z-50 sm:hidden overflow-y-auto">
            <div className="px-4 py-2">
              {/* User info */}
              <div className="flex items-center gap-3 py-4 border-b border-gray-100">
                <Avatar className="w-11 h-11">
                  <AvatarFallback className="bg-[#166534] text-white font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-gray-900">{user.full_name}</p>
                  <p className="text-sm text-gray-500">
                    {user.role === "owner" ? "Pet Sahibi" : user.role === "vet" ? "Veteriner" : "Yönetici"}
                  </p>
                </div>
              </div>

              {/* Menu items — all 44px+ touch targets */}
              <Link href="/"
                className="flex items-center gap-3 py-3.5 text-base text-[#166534] font-medium border-b border-gray-50 min-h-[44px]"
                onClick={() => setMenuOpen(false)}
              >
                <Home className="w-5 h-5" /> Ana Sayfa
              </Link>
              <Link
                href={`/${user.role === 'owner' ? 'owner' : user.role}/notifications`}
                className="flex items-center justify-between py-3.5 text-base text-gray-700 border-b border-gray-50 min-h-[44px]"
                onClick={() => setMenuOpen(false)}
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5" /> Bildirimler
                </div>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
                )}
              </Link>
              <Link
                href={`/${user.role === 'owner' ? 'owner' : user.role}/profile`}
                className="flex items-center gap-3 py-3.5 text-base text-gray-700 border-b border-gray-50 min-h-[44px]"
                onClick={() => setMenuOpen(false)}
              >
                <User className="w-5 h-5" /> Profilim
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 py-3.5 text-base text-red-600 w-full min-h-[44px]"
              >
                <LogOut className="w-5 h-5" /> Çıkış Yap
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
