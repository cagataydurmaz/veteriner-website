"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  PawPrint,
  Stethoscope,
  Activity,
  Calendar,
  Video,
  MapPin,
  Star,
  Clock,
  CreditCard,
  Lock,
} from "lucide-react";
import type { Pet, Veterinarian } from "@/types";
import { TURKISH_CITIES, VETERINARY_SPECIALTIES } from "@/lib/constants";
import { formatCurrency, getDayName, formatDate, generateSlots } from "@/lib/utils";
import SymptomPreCheck from "@/components/owner/SymptomPreCheck";
import { t } from "@/lib/i18n/tr";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ── Step ↔ URL slug mapping ──────────────────────────────────────────────────
const STEP_SLUGS: Record<Step, string> = {
  1: "hayvan-sec",
  2: "sikayet",
  3: "ai-kontrol",
  4: "veteriner-sec",
  5: "tarih-sec",
  6: "tur-sec",
  7: "onay",
};
const SLUG_TO_STEP: Record<string, Step> = Object.fromEntries(
  (Object.entries(STEP_SLUGS) as [string, string][]).map(([k, v]) => [v, Number(k) as Step])
) as Record<string, Step>;

// Persist booking state so browser back/forward + page refresh work correctly
const BOOKING_STORAGE_KEY = "_booking_draft";

interface BookingState {
  petId: string | null;
  complaint: string;
  /** null = not yet chosen in Step 2 (blocks advancing to Step 4) */
  appointmentType: "in_person" | "video" | null;
  selectedVetId: string | null;
  selectedDate: string | null;
  selectedTime: string | null;
  urgencyFromAI: string | null;
}

interface CardForm {
  cardHolderName: string;
  cardNumber: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
}

const STEP_LABELS = [
  "Hayvan",
  "Şikayet",
  "AI Kontrol",
  "Veteriner",
  "Tarih",
  "Tür",
  "Onay",
];

// ── Default booking state — used as SSR-safe initial value (no sessionStorage) ──
const BOOKING_DEFAULTS: BookingState = {
  petId: null, complaint: "", appointmentType: null,
  selectedVetId: null, selectedDate: null, selectedTime: null, urgencyFromAI: null,
};

const PAYMENT_ENABLED = process.env.NEXT_PUBLIC_PAYMENT_ENABLED !== "false";

export default function BookAppointmentPage() {
  const searchParams = useSearchParams();

  // ── Restore step from URL (?adim=veteriner-sec etc.) ─────────────────────
  const urlStep = SLUG_TO_STEP[searchParams.get("adim") ?? "hayvan-sec"] ?? 1;
  const [step, setStep] = useState<Step>(urlStep);

  // ── Booking state — two-phase init to prevent SSR hydration mismatch ────────
  // Phase 1 (SSR + first client render): use safe defaults so server-rendered
  //   HTML and client's initial React tree are identical.
  // Phase 2 (useEffect, client-only): restore from sessionStorage.
  // Reading sessionStorage in a useState lazy initializer causes a hydration
  // mismatch (server has no sessionStorage), which prevents React from
  // attaching synthetic event listeners to the re-rendered subtree.
  const [booking, setBooking] = useState<BookingState>(BOOKING_DEFAULTS);

  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [vets, setVets] = useState<(Veterinarian & { user: { full_name: string }; average_rating: number })[]>([]);
  const [vetsLoaded, setVetsLoaded] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vetFilter, setVetFilter] = useState({ city: "", specialty: "" });
  const [cardForm, setCardForm] = useState<CardForm>({ cardHolderName: "", cardNumber: "", expireMonth: "", expireYear: "", cvc: "" });
  // ── Pagination for vet list ────────────────────────────────────────────────
  const [vetPage, setVetPage] = useState(1);
  const VET_PAGE_SIZE = 12;
  // Duplicate appointment warning modal state
  const [dupWarning, setDupWarning] = useState<{
    show: boolean;
    nearApt: { datetime: string; vetName: string } | null;
  }>({ show: false, nearApt: null });
  const [dupConfirmed, setDupConfirmed] = useState(false);
  // Flag set by Step 6's type-change handler; a useEffect does the actual
  // router.push so the navigation fires after React commits the state update.
  const [pendingStep6Reset, setPendingStep6Reset] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadPets();
  }, []);

  // ── Phase 2: restore booking from sessionStorage (client-only, post-hydration) ──
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(BOOKING_STORAGE_KEY);
      if (saved) {
        setBooking((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch { /* ignore */ }
  // Run once after mount — intentionally empty deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist booking state to sessionStorage on every change ──────────────
  useEffect(() => {
    try { sessionStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(booking)); } catch { /* ignore */ }
  }, [booking]);

  // ── Sync step when user navigates with browser back/forward ──────────────
  useEffect(() => {
    const urlStep2 = SLUG_TO_STEP[searchParams.get("adim") ?? "hayvan-sec"] ?? 1;
    setStep(urlStep2);
  }, [searchParams]);

  // ── Real-time slot blocking ───────────────────────────────────────────────
  // Subscribe to appointment inserts for the selected vet/date so slots
  // disappear in real-time when another user books them.
  useEffect(() => {
    if (!booking.selectedVetId || !booking.selectedDate || step !== 5) return;

    const channel = supabase
      .channel(`slots-${booking.selectedVetId}-${booking.selectedDate}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `vet_id=eq.${booking.selectedVetId}`,
        },
        (payload) => {
          const newApt = payload.new as { datetime: string; status: string };
          if (!newApt?.datetime) return;

          // Only react to pending/confirmed on the selected date
          if (!["pending", "confirmed"].includes(newApt.status)) return;
          const aptDate = newApt.datetime.split("T")[0];
          if (aptDate !== booking.selectedDate) return;

          const bookedTime = newApt.datetime.split("T")[1]?.slice(0, 5);
          if (!bookedTime) return;

          setAvailableSlots((prev) => {
            const updated = prev.filter((s) => s !== bookedTime);
            // If user had selected this slot, deselect + notify
            if (booking.selectedTime === bookedTime) {
              toast.warning("Seçtiğiniz saat az önce başka biri tarafından alındı. Lütfen başka bir saat seçin.");
              setBooking((b) => ({ ...b, selectedTime: null }));
            }
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `vet_id=eq.${booking.selectedVetId}`,
        },
        (payload) => {
          const updated = payload.new as { datetime: string; status: string };
          // If a slot got cancelled/freed, refresh the slots list
          if (updated?.status === "cancelled") {
            loadSlots(booking.selectedVetId!, booking.selectedDate!);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.selectedVetId, booking.selectedDate, step]);

  const loadPets = async () => {
    setPetsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("pets").select("*").eq("owner_id", user.id);
      setPets(data || []);

      // Auto-select pet from URL param (?petId=xxx) if not already chosen
      const urlPetId = searchParams.get("petId");
      if (urlPetId && !booking.petId && data?.some((p) => p.id === urlPetId)) {
        setBooking((b) => ({ ...b, petId: urlPetId }));
      }
    } finally {
      setPetsLoading(false);
    }
  };

  const loadVets = async () => {
    setVetsLoaded(false);
    let query = supabase
      .from("veterinarians")
      .select(`*, user:users(full_name, phone), last_active_at`)
      .eq("is_verified", true);

    // Filter by service type so only vets offering the selected appointment type appear
    if (booking.appointmentType === "video") {
      query = query.eq("offers_video", true);
    } else {
      query = query.eq("offers_in_person", true);
    }

    if (vetFilter.city) query = query.eq("city", vetFilter.city);
    if (vetFilter.specialty) query = query.eq("specialty", vetFilter.specialty);

    const { data } = await query.order("average_rating", { ascending: false });
    setVets(data || []);
    setVetsLoaded(true);
    setVetPage(1); // reset pagination on new search
  };

  const loadSlots = async (vetId: string, date: string) => {
    setSlotsLoading(true);
    const dayOfWeek = new Date(date).getDay();

    const [slotsRes, bookedRes] = await Promise.all([
      supabase
        .from("availability_slots")
        .select("*")
        .eq("vet_id", vetId)
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true),
      supabase
        .from("appointments")
        .select("datetime")
        .eq("vet_id", vetId)
        .gte("datetime", `${date}T00:00:00`)
        .lt("datetime", `${date}T23:59:59`)
        .in("status", ["pending", "confirmed"]),
    ]);

    const bookedTimes = (bookedRes.data || []).map((a: { datetime: string }) =>
      a.datetime.split("T")[1].slice(0, 5)
    );

    const allSlots: string[] = [];
    for (const slot of slotsRes.data || []) {
      const slots = generateSlots(slot.start_time, slot.end_time, 30);
      allSlots.push(...slots.filter((s) => !bookedTimes.includes(s)));
    }

    setAvailableSlots(allSlots);
    setSlotsLoading(false);
  };

  const handleConfirm = async (skipDupCheck = false) => {
    setLoading(true);
    try {
      // ── Pre-flight: all required fields must be present before any computation ──
      // These can be null if the user navigates directly via URL (URL manipulation
      // or browser back/forward bypassing step guards).
      if (!booking.appointmentType) {
        toast.error(t("booking.typeRequired"));
        setLoading(false);
        router.push(`?adim=${STEP_SLUGS[2]}`, { scroll: false });
        return;
      }
      if (!booking.selectedVetId) {
        setLoading(false);
        router.push(`?adim=${STEP_SLUGS[4]}`, { scroll: false });
        return;
      }
      if (!booking.selectedDate || !booking.selectedTime) {
        setLoading(false);
        router.push(`?adim=${STEP_SLUGS[5]}`, { scroll: false });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      // Block past date booking
      const now = new Date();
      const selectedDT = new Date(`${booking.selectedDate}T${booking.selectedTime}:00`);
      if (selectedDT <= now) {
        toast.error("Geçmiş bir tarih ve saat için randevu alınamaz. Lütfen başka bir saat seçin.");
        setLoading(false);
        return;
      }

      const datetime = `${booking.selectedDate}T${booking.selectedTime}:00`;

      // ── Duplicate appointment warning (same pet within 24h) ──────────────────
      if (!skipDupCheck && !dupConfirmed) {
        const window24hStart = new Date(selectedDT.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const window24hEnd   = new Date(selectedDT.getTime() + 24 * 60 * 60 * 1000).toISOString();

        // Select only the columns needed — avoid a 3-table join so the query
        // stays fast even when the appointments table is large (test environments).
        const { data: nearApt } = await supabase
          .from("appointments")
          .select("datetime")
          .eq("pet_id", booking.petId)
          .in("status", ["pending", "confirmed"])
          .gte("datetime", window24hStart)
          .lte("datetime", window24hEnd)
          .limit(1)
          .maybeSingle();

        if (nearApt) {
          setDupWarning({
            show: true,
            nearApt: {
              datetime: nearApt.datetime as string,
              vetName: "Veteriner",
            },
          });
          setLoading(false);
          return; // wait for user confirmation
        }
      }

      // ── Rate limit check (10 attempts/hour) ─────────────────────────────────
      const rateRes = await fetch("/api/appointments/rate-check", { method: "POST" });
      if (!rateRes.ok) {
        const rateData = await rateRes.json();
        toast.error(rateData.error || "İstek limitine ulaştınız. Lütfen daha sonra tekrar deneyin.");
        setLoading(false);
        return;
      }

      // ── Final double-booking guard (race-condition safe) ──────────────────────
      const { data: conflict } = await supabase
        .from("appointments")
        .select("id")
        .eq("vet_id", booking.selectedVetId)
        .eq("datetime", datetime)
        .in("status", ["pending", "confirmed"])
        .maybeSingle();

      if (conflict) {
        toast.error("Bu saat dolu. Lütfen başka bir saat seçin.", { duration: 4000 });
        // Refresh slots so the occupied slot disappears from UI
        loadSlots(booking.selectedVetId!, booking.selectedDate!);
        setBooking((b) => ({ ...b, selectedTime: null }));
        setLoading(false);
        return;
      }

      // appointmentType is guaranteed non-null by the pre-flight guard above
      const effectiveType = booking.appointmentType;

      // For video appointments validate card fields (only when payment is enabled)
      if (effectiveType === "video" && PAYMENT_ENABLED) {
        const { cardHolderName, cardNumber, expireMonth, expireYear, cvc } = cardForm;
        if (!cardHolderName.trim() || !cardNumber || !expireMonth || !expireYear || !cvc) {
          toast.error("Lütfen kart bilgilerini eksiksiz doldurun");
          setLoading(false);
          return;
        }
        const cleanCard = cardNumber.replace(/\s/g, "");
        if (!/^\d{16}$/.test(cleanCard)) {
          toast.error("Kart numarası 16 haneli olmalıdır");
          setLoading(false);
          return;
        }
        const month = parseInt(expireMonth, 10);
        const year  = parseInt(expireYear, 10);
        const now   = new Date();
        if (isNaN(month) || month < 1 || month > 12) {
          toast.error("Geçerli bir son kullanma ayı girin (01-12)");
          setLoading(false);
          return;
        }
        const expDate = new Date(2000 + year, month - 1, 1);
        if (expDate < new Date(now.getFullYear(), now.getMonth(), 1)) {
          toast.error("Kartınızın son kullanma tarihi geçmiş");
          setLoading(false);
          return;
        }
        if (!/^\d{3,4}$/.test(cvc)) {
          toast.error("CVV 3 veya 4 haneli olmalıdır");
          setLoading(false);
          return;
        }
      }

      // Create appointment first (pending / no payment yet)
      const currentSelectedVet = vets.find((v) => v.id === booking.selectedVetId);
      const { data: insertedAppointment, error } = await supabase
        .from("appointments")
        .insert({
          pet_id: booking.petId,
          vet_id: booking.selectedVetId,
          owner_id: user.id,
          datetime,
          type: effectiveType,
          // appointment_type mirrors the API route's canonical column
          // ("clinic" for in_person, "online" for video)
          appointment_type: effectiveType === "video" ? "online" : "clinic",
          status: "pending",
          complaint: booking.complaint,
          // Lock price at booking time to prevent post-booking fee changes from affecting this appointment
          ...(effectiveType === "video" && currentSelectedVet?.video_consultation_fee
            ? { payment_amount: currentSelectedVet.video_consultation_fee }
            : {}),
        })
        .select("id")
        .maybeSingle();

      if (error) {
        // 23505 = unique_violation → the slot was taken between our check and insert
        if ((error as { code?: string }).code === "23505") {
          toast.error("Bu saat başka biri tarafından az önce alındı. Lütfen farklı bir saat seçin.", { duration: 5000 });
          loadSlots(booking.selectedVetId!, booking.selectedDate!);
          setBooking((b) => ({ ...b, selectedTime: null }));
          setLoading(false);
          return;
        }
        throw error;
      }

      // Fallback: if return=representation wasn't honored by PostgREST, fetch the ID explicitly
      let appointment: { id: string } | null = insertedAppointment;
      if (!appointment?.id) {
        const { data: fetched } = await supabase
          .from("appointments")
          .select("id")
          .eq("owner_id", user.id)
          .eq("vet_id", booking.selectedVetId!)
          .eq("datetime", datetime)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        appointment = fetched;
      }

      if (!appointment?.id) {
        throw new Error("Randevu kaydedilemedi — lütfen tekrar deneyin");
      }

      // For video: process payment via iyzico (only when payment is enabled)
      if (effectiveType === "video" && PAYMENT_ENABLED) {
        const payRes = await fetch("/api/payments/video-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId: appointment.id, ...cardForm }),
        });
        const payData = await payRes.json();
        if (!payRes.ok) {
          // Cancel appointment synchronously — we must not leave an orphan "pending" row
          try {
            await fetch("/api/owner/cancel-appointment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ appointmentId: appointment.id, reason: "Ödeme başarısız — otomatik iptal" }),
            });
          } catch {
            // Cancel call failed — appointment remains pending; a cron job will clean it up.
            console.warn("[book] cancel-after-payment-failure failed for", appointment.id);
          }
          toast.error(payData.error || "Ödeme başarısız — kart bilgilerini kontrol edin.");
          // Send user back to date/time selection so they can retry a different slot
          setBooking((b) => ({ ...b, selectedTime: null }));
          setLoading(false);
          return;
        }
        toast.success(`Ödeme alındı (₺${payData.amount}). Randevunuz onaylandı!`);
      } else {
        // In-person: send email confirmation (fire-and-forget)
        fetch("/api/reminders/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "appointment_confirmation", appointmentId: appointment.id, userId: user.id }),
        }).catch(() => {});
        toast.success("Randevunuz alındı! E-posta onayı gönderildi.");
      }

      // Schedule smart reminders (fire-and-forget — non-blocking)
      fetch("/api/appointments/schedule-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointment.id }),
      }).catch((e) => console.warn("schedule-reminders failed:", e));

      // Notify vet of new booking (fire-and-forget)
      fetch("/api/appointments/notify-vet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointment.id }),
      }).catch((e) => console.warn("notify-vet failed:", e));

      // Clear draft — booking complete
      try { sessionStorage.removeItem(BOOKING_STORAGE_KEY); } catch { /* ignore */ }
      // replace() so pressing Back goes to the page before booking, not the card step
      // Hard navigation to bypass Next.js router cache — the appointment was
      // just created so a soft/cached navigation would return a 404 RSC payload.
      window.location.href = `/owner/appointments/${appointment.id}`;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Hata oluştu";
      toast.error("Randevu alınamadı: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedPet = pets.find((p) => p.id === booking.petId);
  const selectedVet = vets.find((v) => v.id === booking.selectedVetId);
  const progress = (step / 7) * 100;

  // Navigate forward: push to history so browser back works
  // ── Step 6 type-change navigation (deferred via effect) ──────────────────
  // We set this flag in the onClick so that setBooking() is fully committed
  // before router.push fires. Calling router.push directly in an event
  // handler alongside setState can be dropped by React 18's batching in
  // Next.js 16 App Router.
  useEffect(() => {
    if (!pendingStep6Reset) return;
    setPendingStep6Reset(false);
    router.push(`?adim=${STEP_SLUGS[4]}`, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStep6Reset]);

  // ── Reactive vet loader ───────────────────────────────────────────────────
  // Auto-reload the vet list whenever:
  //   a) we arrive at step 4 for the first time
  //   b) the user changes appointmentType while already on step 4
  //   c) city/specialty filter dropdowns change while on step 4
  useEffect(() => {
    if (step === 4 && booking.appointmentType) loadVets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.appointmentType, vetFilter.city, vetFilter.specialty, step]);

  const nextStep = useCallback(() => {
    if (step < 7) {
      const next = (step + 1) as Step;
      router.push(`?adim=${STEP_SLUGS[next]}`, { scroll: false });
      // setStep is handled by the searchParams useEffect
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, router]);

  // Navigate backward: use browser history so URL stays correct
  const prevStep = useCallback(() => {
    if (step > 1) router.back();
  }, [step, router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Duplicate Appointment Warning Modal ─────────────────────────── */}
      {dupWarning.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-xl">⚠️</span>
              </div>
              <h2 className="text-base font-bold text-gray-900">Yakın Tarihte Randevu Var</h2>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              <strong>{pets.find(p => p.id === booking.petId)?.name}</strong> için yakın tarihte
              zaten bir randevunuz bulunuyor:
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
              <p className="font-medium text-amber-900">
                Dr. {dupWarning.nearApt?.vetName}
              </p>
              <p className="text-amber-700">
                {dupWarning.nearApt?.datetime
                  ? new Date(dupWarning.nearApt.datetime).toLocaleString("tr-TR", {
                      day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
                    })
                  : ""}
              </p>
            </div>

            <p className="text-sm text-gray-500">
              Bu hayvan için yakın tarihte randevunuz var. Devam etmek istiyor musunuz?
            </p>

            <div className="flex gap-3 pt-1">
              <button
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setDupWarning({ show: false, nearApt: null })}
              >
                Geri Dön
              </button>
              <button
                className="flex-1 px-4 py-2.5 bg-[#166534] text-white rounded-xl text-sm font-medium hover:bg-[#14532d] transition-colors"
                onClick={() => {
                  setDupWarning({ show: false, nearApt: null });
                  setDupConfirmed(true);
                  // Pass skipDupCheck=true to avoid stale-closure issue with useState
                  handleConfirm(true);
                }}
              >
                Evet, Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={prevStep} disabled={step === 1} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Randevu Al</h1>
          <p className="text-sm text-gray-500">
            Adım {step}/7 — {STEP_LABELS[step - 1]}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between mt-2">
          {STEP_LABELS.map((label, idx) => (
            <div
              key={label}
              className={`text-xs ${idx + 1 <= step ? "text-[#166534] font-medium" : "text-gray-400"}`}
            >
              {idx + 1 <= step ? "✓" : idx + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Select Pet */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PawPrint className="w-5 h-5 text-[#166534]" />
              Hangi hayvanınız için randevu alıyorsunuz?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {petsLoading ? (
              <div className="grid grid-cols-2 gap-3 animate-pulse">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-20 bg-gray-200 rounded" />
                      <div className="h-3 w-14 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pets.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {pets.map((pet) => (
                  <button
                    key={pet.id}
                    data-testid={`pet-btn-${pet.id}`}
                    data-pet-name={pet.name}
                    onClick={() => {
                      setBooking((b) => ({ ...b, petId: pet.id }));
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                      booking.petId === pet.id
                        ? "border-[#166534] bg-[#F0FDF4]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl overflow-hidden">
                      {pet.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
                      ) : (
                        "🐾"
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm text-gray-900">{pet.name}</p>
                      <p className="text-xs text-gray-500">{pet.species}</p>
                    </div>
                    {booking.petId === pet.id && (
                      <Check className="w-4 h-4 text-[#166534] ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">
                Önce hayvan eklemelisiniz.
              </p>
            )}
            <Button
              data-testid="step1-continue"
              className="w-full mt-4"
              disabled={!booking.petId || petsLoading}
              onClick={nextStep}
            >
              Devam Et <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Complaint */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-[#166534]" />
              Ziyaret nedeninizi açıklayın
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                "Rutin Kontrol",
                "Aşı",
                "Hasta / Hastalık",
                "Kaza / Yaralanma",
                "Diş Bakımı",
                "Diğer",
              ].map((reason) => (
                <button
                  key={reason}
                  onClick={() => setBooking((b) => ({ ...b, complaint: reason }))}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    booking.complaint === reason
                      ? "border-[#166534] bg-[#F0FDF4] text-[#166534]"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <textarea
              className="w-full rounded-md border border-gray-300 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#166534]"
              rows={3}
              placeholder="Daha fazla detay ekleyin (opsiyonel)..."
              value={booking.complaint.match(/^(Rutin|Aşı|Hasta|Kaza|Diş|Diğer)/) ? "" : booking.complaint}
              onChange={(e) => setBooking((b) => ({ ...b, complaint: e.target.value }))}
            />

            {/* ── Appointment Type Selection (mandatory before Step 4) ── */}
            <div className="space-y-2 pt-1">
              <p className="text-sm font-semibold text-gray-700">{t("booking.typeTitle")}</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  data-testid="type-btn-clinic"
                  onClick={() => setBooking((b) => ({ ...b, appointmentType: "in_person" }))}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    booking.appointmentType === "in_person"
                      ? "border-[#166534] bg-[#F0FDF4]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <MapPin className="w-5 h-5 text-[#166534] shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{t("booking.typeInPerson")}</p>
                    <p className="text-xs text-gray-500">{t("booking.typeInPersonDesc")}</p>
                  </div>
                  {booking.appointmentType === "in_person" && (
                    <Check className="w-4 h-4 text-[#166534] ml-auto shrink-0" />
                  )}
                </button>
                <button
                  type="button"
                  data-testid="type-btn-online"
                  onClick={() => setBooking((b) => ({ ...b, appointmentType: "video" }))}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    booking.appointmentType === "video"
                      ? "border-[#166534] bg-[#F0FDF4]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Video className="w-5 h-5 text-[#166534] shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{t("booking.typeVideo")}</p>
                    <p className="text-xs text-gray-500">{t("booking.typeVideoDesc")}</p>
                  </div>
                  {booking.appointmentType === "video" && (
                    <Check className="w-4 h-4 text-[#166534] ml-auto shrink-0" />
                  )}
                </button>
              </div>
              {!booking.appointmentType && (
                <p className="text-xs text-amber-600">{t("booking.typeRequired")}</p>
              )}
            </div>

            <Button
              data-testid="step2-continue"
              className="w-full"
              disabled={!booking.complaint || !booking.appointmentType}
              onClick={nextStep}
            >
              Devam Et <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: AI Symptom Check */}
      {step === 3 && (
        <SymptomPreCheck
          petId={booking.petId}
          complaint={booking.complaint}
          onContinue={(urgency) => {
            setBooking((b) => ({ ...b, urgencyFromAI: urgency }));
            nextStep();
          }}
          onSkip={nextStep}
        />
      )}

      {/* Step 4: Filter & Select Vet */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-[#166534]" />
              Veteriner Seçin
              {/* Active type badge — reflects the choice made in Step 2 */}
              {booking.appointmentType && (
                <Badge variant="secondary" className="ml-auto text-xs font-medium">
                  {booking.appointmentType === "video"
                    ? t("booking.typeFilterBadgeOnline")
                    : t("booking.typeFilterBadgeClinic")}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters — changes auto-trigger loadVets via useEffect */}
            <div className="grid grid-cols-2 gap-3">
              <select
                className="h-9 rounded-md border border-gray-300 text-sm px-3 focus:ring-2 focus:ring-[#166534]"
                value={vetFilter.city}
                onChange={(e) => setVetFilter((f) => ({ ...f, city: e.target.value }))}
              >
                <option value="">Tüm Şehirler</option>
                {TURKISH_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border border-gray-300 text-sm px-3 focus:ring-2 focus:ring-[#166534]"
                value={vetFilter.specialty}
                onChange={(e) => setVetFilter((f) => ({ ...f, specialty: e.target.value }))}
              >
                <option value="">Tüm Uzmanlıklar</option>
                {VETERINARY_SPECIALTIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-400 text-center">{t("booking.typeAutoFilter")}</p>

            {/* Vet List — paginated 12 per page */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {!vetsLoaded ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-[#166534] border-t-transparent rounded-full" />
                </div>
              ) : vets.length > 0 ? vets.slice(0, vetPage * VET_PAGE_SIZE).map((vet) => (
                <button
                  key={vet.id}
                  data-testid={`vet-card-${vet.id}`}
                  onClick={() => setBooking((b) => ({ ...b, selectedVetId: vet.id }))}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                    booking.selectedVetId === vet.id
                      ? "border-[#166534] bg-[#F0FDF4]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-10 h-10 bg-[#DCFCE7] rounded-full flex items-center justify-center text-sm font-bold text-[#166534] shrink-0">
                    {vet.user?.full_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">Vet. Hek. {vet.user?.full_name}</p>
                      {/* Pasif badge: last active > 7 days ago */}
                      {(vet as unknown as { last_active_at?: string }).last_active_at &&
                        new Date((vet as unknown as { last_active_at: string }).last_active_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">Pasif</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{vet.specialty}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-gray-600">
                          {vet.average_rating?.toFixed(1) || "Yeni"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{vet.city}</span>
                      </div>
                      <span className="text-xs font-medium text-[#F97316]">
                        {booking.appointmentType === "video" && vet.video_consultation_fee
                          ? `₺${vet.video_consultation_fee} video`
                          : formatCurrency(vet.consultation_fee)}
                      </span>
                    </div>
                  </div>
                  {booking.selectedVetId === vet.id && (
                    <Check className="w-5 h-5 text-[#166534] shrink-0" />
                  )}
                </button>
              )) : (
                <p className="text-center text-gray-500 text-sm py-8">
                  Veteriner bulunamadı. Filtrelerinizi değiştirin.
                </p>
              )}

              {/* Load more — show only when there are more pages */}
              {vets.length > vetPage * VET_PAGE_SIZE && (
                <button
                  onClick={() => setVetPage((p) => p + 1)}
                  className="w-full py-2.5 text-sm text-[#166534] font-medium border border-[#166534]/30 rounded-xl hover:bg-[#F0FDF4] transition-colors"
                >
                  Daha Fazla Yükle ({vets.length - vetPage * VET_PAGE_SIZE} kaldı)
                </button>
              )}
            </div>

            <Button
              data-testid="step4-continue"
              className="w-full"
              disabled={!booking.selectedVetId}
              onClick={nextStep}
            >
              Devam Et <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Select Date & Time */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#166534]" />
              Tarih ve Saat Seçin
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Picker — next 14 days */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Tarih</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Array.from({ length: 14 }, (_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + i + 1);
                  const dateStr = date.toISOString().split("T")[0];
                  const dayName = getDayName(date.getDay());
                  return (
                    <button
                      key={dateStr}
                      data-testid={`date-btn-${dateStr}`}
                      onClick={() => {
                        setBooking((b) => ({ ...b, selectedDate: dateStr, selectedTime: null }));
                        loadSlots(booking.selectedVetId!, dateStr);
                      }}
                      className={`flex flex-col items-center p-3 rounded-xl min-w-[60px] border-2 transition-colors ${
                        booking.selectedDate === dateStr
                          ? "border-[#166534] bg-[#F0FDF4]"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-xs text-gray-500">{dayName.slice(0, 3)}</span>
                      <span className="text-lg font-bold text-gray-900">{date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots */}
            {booking.selectedDate && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Saat</p>
                {slotsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin w-5 h-5 border-2 border-[#166534] border-t-transparent rounded-full slots-loading-spinner" />
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        data-testid={`time-slot-${slot}`}
                        onClick={() => setBooking((b) => ({ ...b, selectedTime: slot }))}
                        className={`py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                          booking.selectedTime === slot
                            ? "border-[#166534] bg-[#F0FDF4] text-[#166534]"
                            : "border-gray-200 text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 text-sm py-4">
                    Bu tarihte müsait saat yok
                  </p>
                )}
              </div>
            )}

            <Button
              data-testid="step5-continue"
              className="w-full"
              disabled={!booking.selectedDate || !booking.selectedTime}
              onClick={nextStep}
            >
              Devam Et <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Appointment Type Confirmation — pre-filled from Step 2, change resets downstream */}
      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {booking.appointmentType === "video"
                ? <Video className="w-5 h-5 text-[#166534]" />
                : <MapPin className="w-5 h-5 text-[#166534]" />}
              {t("booking.confirmTypeTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Confirmed type display */}
            <div className="bg-[#F0FDF4] border-2 border-[#166534]/30 rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-[#166534]/10 rounded-xl flex items-center justify-center shrink-0">
                {booking.appointmentType === "video"
                  ? <Video className="w-6 h-6 text-[#166534]" />
                  : <MapPin className="w-6 h-6 text-[#166534]" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-[#166534]">
                  {booking.appointmentType === "video"
                    ? t("booking.typeVideo")
                    : t("booking.typeInPerson")}
                </p>
                <p className="text-xs text-gray-500">
                  {booking.appointmentType === "video"
                    ? t("booking.typeVideoDesc")
                    : t("booking.typeInPersonDesc")}
                </p>
                {booking.appointmentType === "video" && selectedVet?.video_consultation_fee && (
                  <p className="text-sm font-bold text-[#F97316] mt-1">₺{selectedVet.video_consultation_fee}</p>
                )}
              </div>
              <Check className="w-6 h-6 text-[#166534] shrink-0" />
            </div>

            {/* Optional type change — resets vet + date + time + returns to step 4 */}
            <div className="rounded-xl border border-gray-200 p-3 space-y-2">
              <p className="text-xs text-gray-500">{t("booking.changeTypeHint")}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["in_person", "video"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    data-testid={type === "video" ? "step6-type-online" : "step6-type-clinic"}
                    onClick={() => {
                      if (booking.appointmentType === type) return; // no-op
                      setBooking((b) => ({
                        ...b,
                        appointmentType: type,
                        selectedVetId: null,
                        selectedDate: null,
                        selectedTime: null,
                      }));
                      toast.info(t("booking.typeChangedReset"));
                      // Trigger deferred navigation via useEffect so the
                      // state update is committed first (React 18 / Next.js 16).
                      setPendingStep6Reset(true);
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      booking.appointmentType === type
                        ? "border-[#166534] bg-[#F0FDF4] text-[#166534]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {type === "video"
                      ? <><Video className="w-4 h-4" /> Online</>
                      : <><MapPin className="w-4 h-4" /> Klinik</>}
                  </button>
                ))}
              </div>
            </div>

            <Button data-testid="step6-continue" className="w-full" onClick={nextStep}>
              Devam Et <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 7: Confirm / Payment */}
      {step === 7 && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="w-5 h-5 text-[#F97316]" />
                Randevu Özeti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {selectedPet && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Hayvan</span>
                    <span className="font-medium">{selectedPet.name} ({selectedPet.species})</span>
                  </div>
                )}
                {selectedVet && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Veteriner</span>
                    <span className="font-medium">Vet. Hek. {selectedVet.user?.full_name}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tarih & Saat</span>
                  <span className="font-medium">
                    {booking.selectedDate && formatDate(booking.selectedDate)} {booking.selectedTime}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tür</span>
                  <Badge variant={(booking.appointmentType ?? "in_person") === "video" ? "default" : "secondary"}>
                    {(booking.appointmentType ?? "in_person") === "video" ? (
                      <><Video className="w-3 h-3 mr-1" /> Video Görüşme</>
                    ) : (
                      <><MapPin className="w-3 h-3 mr-1" /> Yüz Yüze</>
                    )}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Şikayet</span>
                  <span className="font-medium text-right max-w-[200px]">{booking.complaint}</span>
                </div>
                {booking.appointmentType === "video" && selectedVet?.video_consultation_fee && (
                  <>
                    <div className="border-t border-gray-200 pt-3 flex justify-between text-sm font-bold">
                      <span className="text-gray-900">Ödenecek Tutar</span>
                      <span className="text-[#F97316] text-lg">₺{selectedVet.video_consultation_fee}</span>
                    </div>
                  </>
                )}
              </div>

              {(booking.appointmentType ?? "in_person") === "in_person" && (
                <div className="bg-[#F0FDF4] rounded-lg p-3">
                  <p className="text-xs text-[#166534]">
                    📱 Onay mesajı WhatsApp&apos;a gönderilecektir. Ödeme klinikte yapılır.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card payment form — only for video when payment is active */}
          {(booking.appointmentType ?? "in_person") === "video" && PAYMENT_ENABLED && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#166534]" />
                  Kart Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Kart Üzerindeki İsim</label>
                  <input
                    type="text"
                    placeholder="AD SOYAD"
                    value={cardForm.cardHolderName}
                    onChange={e => setCardForm(f => ({ ...f, cardHolderName: e.target.value.toUpperCase() }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Kart Numarası</label>
                  <input
                    type="text"
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                    value={cardForm.cardNumber}
                    onChange={e => setCardForm(f => ({ ...f, cardNumber: e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim() }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] font-mono"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Ay</label>
                    <select
                      value={cardForm.expireMonth}
                      onChange={e => setCardForm(f => ({ ...f, expireMonth: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    >
                      <option value="">Ay</option>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = String(i + 1).padStart(2, "0");
                        return <option key={m} value={m}>{m}</option>;
                      })}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Yıl</label>
                    <select
                      value={cardForm.expireYear}
                      onChange={e => setCardForm(f => ({ ...f, expireYear: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    >
                      <option value="">Yıl</option>
                      {Array.from({ length: 10 }, (_, i) => {
                        const y = String(new Date().getFullYear() + i);
                        return <option key={y} value={y}>{y}</option>;
                      })}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">CVV</label>
                    <input
                      type="text"
                      placeholder="000"
                      maxLength={4}
                      value={cardForm.cvc}
                      onChange={e => setCardForm(f => ({ ...f, cvc: e.target.value.replace(/\D/g, "") }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] font-mono"
                    />
                  </div>
                </div>

                {/* Refund policy */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-800">İade Politikası</p>
                  <p className="text-xs text-amber-700">• Veteriner iptal ederse: <strong>tam iade</strong></p>
                  <p className="text-xs text-amber-700">• 24 saat önceden iptal: <strong>tam iade</strong></p>
                  <p className="text-xs text-amber-700">• 24 saatten az kala iptal: <strong>%50 iade</strong></p>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Lock className="w-3 h-3" />
                  <span>Ödeme iyzico güvencesiyle korunmaktadır. Kart bilgileriniz saklanmaz.</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            data-testid="confirm-booking-btn"
            className="w-full"
            size="lg"
            loading={loading}
            disabled={loading}
            onClick={() => handleConfirm()}
          >
            {loading ? "Lütfen bekleyin..." : booking.appointmentType === "video" ? (
              <><CreditCard className="w-5 h-5 mr-2" /> Öde ve Randevuyu Onayla</>
            ) : (
              <><Check className="w-5 h-5 mr-2" /> Randevuyu Onayla</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
