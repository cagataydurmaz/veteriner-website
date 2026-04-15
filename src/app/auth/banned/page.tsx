import Link from "next/link";
import { XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function BannedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let banReason: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("banned_reason")
      .eq("id", user.id)
      .maybeSingle();
    banReason = data?.banned_reason ?? null;

    // Also sign out
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <XCircle className="w-10 h-10 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hesabınız Kapatıldı</h1>
          <p className="text-gray-600 mt-2">Hesabınız kalıcı olarak kapatılmıştır.</p>
          {banReason && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-left">
              <p className="text-sm font-medium text-red-800">Sebep:</p>
              <p className="text-sm text-red-700 mt-1">{banReason}</p>
            </div>
          )}
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
          <p>Bu karara itiraz etmek için bizimle iletişime geçin:</p>
          <a href="mailto:destek@veterineribul.com" className="text-[#166534] font-medium hover:underline mt-1 block">
            destek@veterineribul.com
          </a>
        </div>
        <Link href="/auth/login" className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
          Farklı bir hesapla giriş yap
        </Link>
      </div>
    </div>
  );
}
