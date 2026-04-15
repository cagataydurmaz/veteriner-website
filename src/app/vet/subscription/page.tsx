"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CreditCard, Zap, Crown, Info, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUBSCRIPTION_TIERS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

const SUBSCRIPTIONS_ENABLED = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED !== "false";

type CommitmentPeriod = "monthly" | "6month" | "12month";

const COMMITMENT_OPTIONS: { value: CommitmentPeriod; label: string; discount: number; months: number }[] = [
  { value: "monthly", label: "Aylık", discount: 0, months: 1 },
  { value: "6month", label: "6 Aylık", discount: 15, months: 6 },
  { value: "12month", label: "Yıllık", discount: 25, months: 12 },
];

export default function SubscriptionPage() {
  const [currentTier, setCurrentTier] = useState<string>("basic");
  const [tierLoading, setTierLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<CommitmentPeriod>("monthly");
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cardData, setCardData] = useState({ cardHolderName: "", cardNumber: "", expireMonth: "", expireYear: "", cvc: "" });
  const router = useRouter();

  useEffect(() => { loadCurrentTier(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCurrentTier = async () => {
    setTierLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: vet, error } = await supabase.from("veterinarians").select("subscription_tier").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (vet) setCurrentTier(vet.subscription_tier);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Plan bilgisi yüklenemedi");
    } finally {
      setTierLoading(false);
    }
  };

  const getDiscountedPrice = (basePrice: number, period: CommitmentPeriod) => {
    const opt = COMMITMENT_OPTIONS.find((o) => o.value === period)!;
    return Math.round(basePrice * (1 - opt.discount / 100));
  };

  const handlePayment = async () => {
    if (!selectedTier) return;
    setLoading(true);
    try {
      const response = await fetch("/api/payments/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier, commitment, ...cardData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(data.message);
      setShowPayment(false);
      setCurrentTier(selectedTier);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const tierIcons = { basic: CreditCard, pro: Zap, premium: Crown };
  const selectedCommitment = COMMITMENT_OPTIONS.find((o) => o.value === commitment)!;

  if (tierLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#166534]" />
      </div>
    );
  }

  const FREE_PERIOD_END = process.env.NEXT_PUBLIC_FREE_PERIOD_END ?? "2026-07-08";

  if (!SUBSCRIPTIONS_ENABLED) {
    const allFeatures = [
      { label: "Takvim yönetimi", tiers: ["basic", "pro", "premium"] },
      { label: "Temel randevu sistemi", tiers: ["basic", "pro", "premium"] },
      { label: "Hasta kayıtları", tiers: ["basic", "pro", "premium"] },
      { label: "E-posta bildirimleri", tiers: ["basic", "pro", "premium"] },
      { label: "WhatsApp hatırlatıcılar", tiers: ["pro", "premium"] },
      { label: "Analitik dashboard", tiers: ["pro", "premium"] },
      { label: "Öncelikli destek", tiers: ["pro", "premium"] },
      { label: "Gelişmiş raporlama", tiers: ["pro", "premium"] },
      { label: "Video görüşme", tiers: ["premium"] },
      { label: "Sesli not & transkripsiyon", tiers: ["premium"] },
      { label: "Arama sonuçlarında öncelik", tiers: ["premium"] },
      { label: "Özel profil sayfası", tiers: ["premium"] },
    ];

    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Abonelik Planı</h1>
          <p className="text-sm text-gray-500 mt-1">Pratik yönetiminizi iyileştirin</p>
        </div>

        {/* Hero banner */}
        <div className="bg-gradient-to-br from-[#166534] to-[#15803D] rounded-2xl p-6 text-white text-center shadow-md">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <span className="inline-block bg-white/20 border border-white/30 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
            🎉 BETA — ÜCRETSİZ DÖNEM
          </span>
          <h2 className="text-xl font-bold mb-1">Tüm Premium Özellikler Ücretsiz!</h2>
          <p className="text-white/85 text-sm max-w-md mx-auto">
            Beta döneminde tüm veterinerlerimize <strong>Premium</strong> plan özellikleri tamamen ücretsiz sunulmaktadır.
          </p>
          <div className="mt-4 inline-block bg-white/15 border border-white/25 rounded-xl px-4 py-2">
            <p className="text-xs text-white/80">Ücretlendirme başlangıç tarihi</p>
            <p className="text-base font-bold">{FREE_PERIOD_END}</p>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-700">Özellik Karşılaştırması</p>
          </div>
          <div className="divide-y divide-gray-100">
            {/* Header row */}
            <div className="grid grid-cols-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div className="col-span-1">Özellik</div>
              <div className="text-center">Basic</div>
              <div className="text-center">Pro</div>
              <div className="text-center text-[#166534]">Premium</div>
            </div>
            {allFeatures.map((feature) => (
              <div key={feature.label} className="grid grid-cols-4 px-4 py-2.5 text-sm items-center">
                <div className="col-span-1 text-gray-700">{feature.label}</div>
                {["basic", "pro", "premium"].map((tier) => (
                  <div key={tier} className="text-center">
                    {feature.tiers.includes(tier) ? (
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${tier === "premium" ? "bg-[#DCFCE7]" : "bg-gray-100"}`}>
                        <Check className={`w-3 h-3 ${tier === "premium" ? "text-[#166534]" : "text-gray-500"}`} />
                      </span>
                    ) : (
                      <span className="text-gray-300 text-base">—</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Active plan badge */}
          <div className="px-4 py-3 bg-[#F0FDF4] border-t border-[#166534]/20 flex items-center justify-between">
            <span className="text-sm text-gray-700">Beta döneminde aktif planınız:</span>
            <span className="text-sm font-bold text-[#166534] flex items-center gap-1.5">
              <Crown className="w-4 h-4" /> Premium ✓
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Ücretlendirme başlamadan önce WhatsApp ve e-posta ile bildirim yapılacaktır.
            Herhangi bir plan seçme işlemi yapmanıza gerek yoktur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abonelik Planı</h1>
        <p className="text-sm text-gray-500 mt-1">Pratik yönetiminizi iyileştirin, daha fazla özellik açın</p>
      </div>
      <div className="bg-[#F0FDF4] border border-[#166534]/20 rounded-xl p-4">
        <p className="text-sm text-gray-600">Mevcut Planınız: <span className="font-bold text-[#166534]">{SUBSCRIPTION_TIERS[currentTier as keyof typeof SUBSCRIPTION_TIERS]?.name || "Basic"}</span></p>
      </div>

      {/* Commitment selector */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Taahhüt Süresi</p>
        <div className="flex gap-2 flex-wrap">
          {COMMITMENT_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setCommitment(opt.value)}
              className={`relative px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${commitment === opt.value ? "border-[#166534] bg-[#166534] text-white" : "border-gray-200 bg-white text-gray-700 hover:border-[#166534]"}`}>
              {opt.label}
              {opt.discount > 0 && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${commitment === opt.value ? "bg-white/20 text-white" : "bg-green-100 text-green-700"}`}>%{opt.discount}</span>
              )}
            </button>
          ))}
        </div>
        {selectedCommitment.discount > 0 && <p className="text-xs text-[#166534] mt-2">%{selectedCommitment.discount} taahhüt indirimi!</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(SUBSCRIPTION_TIERS).map(([tier, data]) => {
          const Icon = tierIcons[tier as keyof typeof tierIcons];
          const isCurrentTier = tier === currentTier;
          const isUpgrade = ["basic","pro","premium"].indexOf(tier) > ["basic","pro","premium"].indexOf(currentTier);
          const discountedPrice = getDiscountedPrice(data.price, commitment);
          const saving = data.price - discountedPrice;
          return (
            <Card key={tier} className={`relative ${tier === "pro" ? "ring-2 ring-[#166534] border-[#166534] bg-[#F0FDF4]/30" : tier === "premium" ? "border-purple-200 bg-purple-50/30" : "border-gray-200"}`}>
              {tier === "pro" && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge className="bg-[#166534] text-white">En Popüler</Badge></div>}
              <CardHeader className="pb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${tier === "premium" ? "bg-purple-100" : tier === "pro" ? "bg-[#F0FDF4]" : "bg-gray-100"}`}>
                  <Icon className={`w-5 h-5 ${tier === "premium" ? "text-purple-600" : tier === "pro" ? "text-[#166534]" : "text-gray-600"}`} />
                </div>
                <CardTitle>{data.name}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold text-gray-900">{formatCurrency(discountedPrice)}</span>
                  <span className="text-gray-500">/ay</span>
                  {saving > 0 && <div className="mt-1"><span className="text-xs text-gray-400 line-through mr-1">{formatCurrency(data.price)}</span><span className="text-xs text-green-600 font-medium">%{selectedCommitment.discount} indirim</span></div>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {data.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700"><Check className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />{f}</li>
                  ))}
                </ul>
                {isCurrentTier ? (
                  <Button variant="secondary" className="w-full" disabled>Mevcut Planınız</Button>
                ) : isUpgrade ? (
                  <Button className="w-full bg-[#F97316] hover:bg-[#EA6A0A] text-white" onClick={() => { setSelectedTier(tier); setShowPayment(true); }}>
                    {tier === "premium" ? "Premium'a Geç" : "Pro'ya Geç"}
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>Düşürme Yapılamaz</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ödeme Bilgileri</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {selectedTier && (
              <div className="bg-[#F0FDF4] rounded-lg p-3 space-y-1">
                <p className="text-sm text-[#166534] font-medium">{SUBSCRIPTION_TIERS[selectedTier as keyof typeof SUBSCRIPTION_TIERS]?.name} — {selectedCommitment.label}</p>
                <p className="text-sm text-gray-700">Aylık: <strong>{formatCurrency(getDiscountedPrice(SUBSCRIPTION_TIERS[selectedTier as keyof typeof SUBSCRIPTION_TIERS]?.price || 0, commitment))}</strong></p>
                {selectedCommitment.discount > 0 && <p className="text-xs text-green-600">%{selectedCommitment.discount} taahhüt indirimi uygulandı</p>}
              </div>
            )}
            <div className="space-y-1.5"><Label>Kart Sahibi Adı</Label><Input placeholder="AHMET YILMAZ" value={cardData.cardHolderName} onChange={(e) => setCardData((d) => ({ ...d, cardHolderName: e.target.value.toUpperCase() }))} /></div>
            <div className="space-y-1.5"><Label>Kart Numarası</Label><Input placeholder="1234 5678 9012 3456" maxLength={19} value={cardData.cardNumber} onChange={(e) => { const v = e.target.value.replace(/\D/g,"").replace(/(.{4})/g,"$1 ").trim(); setCardData((d) => ({ ...d, cardNumber: v.replace(/\s/g,"") })); }} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Ay</Label><Input placeholder="MM" maxLength={2} value={cardData.expireMonth} onChange={(e) => setCardData((d) => ({ ...d, expireMonth: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Yıl</Label><Input placeholder="YY" maxLength={2} value={cardData.expireYear} onChange={(e) => setCardData((d) => ({ ...d, expireYear: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>CVV</Label><Input placeholder="123" maxLength={3} value={cardData.cvc} onChange={(e) => setCardData((d) => ({ ...d, cvc: e.target.value }))} /></div>
            </div>
            <p className="text-xs text-gray-500">🔒 Ödemeniz iyzico güvencesiyle korunmaktadır</p>
            <Button onClick={handlePayment} loading={loading} className="w-full bg-[#F97316] hover:bg-[#EA6A0A] text-white"><CreditCard className="w-4 h-4 mr-2" />Ödemeyi Tamamla</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
