"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity, Upload, Calendar, Clock,
  ChevronDown, ChevronUp, X, Lightbulb, HelpCircle,
  Camera, CheckCircle,
} from "lucide-react";
import { AI_DISCLAIMER } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Pet, SymptomCheck, SymptomAnalysisResult } from "@/types";

type Step = "input" | "result";

const MAX_PHOTOS = 3;

export default function SymptomCheckPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [symptoms, setSymptoms] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [result, setResult] = useState<SymptomAnalysisResult | null>(null);
  const [history, setHistory] = useState<SymptomCheck[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadPets();
    loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("pets").select("*").eq("owner_id", user.id);
    setPets(data || []);
  };

  const loadHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("symptom_checks")
      .select("*, pet:pets(name)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setHistory(data || []);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_PHOTOS - photoFiles.length;
    const toAdd = files.slice(0, remaining);
    setPhotoFiles(prev => [...prev, ...toAdd]);
    setPhotoPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAnalyze = async () => {
    if (!symptoms.trim()) {
      toast.error("Lütfen semptomları açıklayın");
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      if (selectedPetId) formData.append("petId", selectedPetId);
      formData.append("symptoms", symptoms);
      photoFiles.forEach((f, i) => formData.append(`photo${i}`, f));

      if (photoFiles.length > 0) setPhotoAnalyzing(true);

      const response = await fetch("/api/symptom-check", {
        method: "POST",
        body: formData,
      });
      setPhotoAnalyzing(false);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Analiz sırasında bir hata oluştu");
      }

      const data = await response.json();
      if (!data.result) throw new Error("Yapay zeka yanıtı alınamadı");

      // Defensive: ensure arrays exist even if AI omitted them
      setResult({
        topic_summary: data.result.topic_summary ?? "",
        general_info: data.result.general_info ?? "",
        common_causes: Array.isArray(data.result.common_causes) ? data.result.common_causes : [],
        care_notes: Array.isArray(data.result.care_notes) ? data.result.care_notes : [],
        questions_to_ask_vet: Array.isArray(data.result.questions_to_ask_vet) ? data.result.questions_to_ask_vet : [],
        disclaimer: data.result.disclaimer ?? AI_DISCLAIMER,
      });
      setStep("result");
      loadHistory();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
      setPhotoAnalyzing(false);
    }
  };

  const resetForm = () => {
    setStep("input");
    setResult(null);
    setSymptoms("");
    setPhotoFiles([]);
    setPhotoPreviews([]);
  };

  /**
   * History items may have old (triage) or new (educational) format.
   * Extract a safe summary from whichever shape we find.
   */
  const getHistorySummary = (aiResponse: unknown): { title: string; detail: string } | null => {
    if (!aiResponse || typeof aiResponse !== "object") return null;
    const r = aiResponse as Record<string, unknown>;
    // New educational format
    if (typeof r.topic_summary === "string" && r.topic_summary) {
      return { title: r.topic_summary, detail: (r.general_info as string) ?? "" };
    }
    // Legacy triage format (old records in DB)
    if (typeof r.urgency_label_tr === "string") {
      return { title: r.urgency_label_tr, detail: (r.general_guidance as string) ?? "" };
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Semptom Kontrol</h1>
        <p className="text-sm text-gray-500 mt-1">Yapay zeka destekli genel bilgi asistanı</p>
      </div>

      {/* ── STEP: INPUT ─────────────────────────────────────────────────────── */}
      {step === "input" && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-5 h-5 text-orange-500" />
              Semptomları Açıklayın
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pet Selection */}
            {pets.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Hangi hayvan için? (opsiyonel)</label>
                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]"
                  value={selectedPetId}
                  onChange={(e) => setSelectedPetId(e.target.value)}
                >
                  <option value="">Seçin (opsiyonel)</option>
                  {pets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.species})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Symptoms */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Semptomlar *</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#166534] min-h-[120px]"
                placeholder={`Semptomları Türkçe olarak açıklayın...\n\nÖrnek: 'Kedim 2 gündür iştahsız, sürekli uyuyor ve ara sıra kusuyor.'`}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Multi-photo upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-gray-400" />
                Fotoğraf Ekle (opsiyonel, maks. 3)
              </label>
              <div className="flex gap-2 flex-wrap">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative w-20 h-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Fotoğraf ${idx + 1}`} className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photoFiles.length < MAX_PHOTOS && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-[#166534] hover:text-[#166534] transition-colors"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-[10px]">Ekle</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoSelect}
              />
              {photoFiles.length > 0 && (
                <p className="text-xs text-[#166534]">
                  {photoFiles.length} fotoğraf seçildi — AI görsel analiz yapacak
                </p>
              )}
            </div>

            <Button
              className="w-full bg-[#166534] hover:bg-[#14532D] text-white"
              onClick={handleAnalyze}
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {photoAnalyzing ? "Fotoğraf analiz ediliyor…" : "Yapay zeka analiz ediyor…"}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Bilgi Al
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── STEP: RESULT ────────────────────────────────────────────────────── */}
      {step === "result" && result && (
        <div className="space-y-4">
          {/* Topic Summary */}
          {result.topic_summary && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-800 mb-1">Konu Özeti</p>
              <p className="text-sm text-blue-700 leading-relaxed">{result.topic_summary}</p>
            </div>
          )}

          {/* General Info */}
          {result.general_info && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-700 leading-relaxed">{result.general_info}</p>
              </CardContent>
            </Card>
          )}

          {/* Common Causes */}
          {result.common_causes.length > 0 && (
            <Card className="border-green-200 bg-[#F0FDF4]/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Lightbulb className="w-4 h-4 text-[#166534]" />
                  <p className="text-sm font-semibold text-[#166534]">Bilinebilecek Genel Nedenler</p>
                </div>
                <ul className="space-y-1.5">
                  {result.common_causes.map((item, idx) => (
                    <li key={idx} className="text-sm text-[#15803D] flex items-start gap-2">
                      <span className="shrink-0 mt-0.5">•</span>{item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Care Notes */}
          {result.care_notes.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Genel Bakım Notları
                </p>
                <ul className="space-y-1.5">
                  {result.care_notes.map((item, idx) => (
                    <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                      <span className="shrink-0 mt-0.5">•</span>{item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Questions to Ask Vet */}
          {result.questions_to_ask_vet.length > 0 && (
            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <HelpCircle className="w-4 h-4 text-purple-700" />
                  <p className="text-sm font-semibold text-purple-800">Veterinere Sorulabilecek Sorular</p>
                </div>
                <ul className="space-y-1.5">
                  {result.questions_to_ask_vet.map((item, idx) => (
                    <li key={idx} className="text-sm text-purple-700 flex items-start gap-2">
                      <span className="shrink-0 mt-0.5">•</span>{item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Book Appointment CTA */}
          <Card className="border-[#166534]/20 bg-[#F0FDF4]/50">
            <CardContent className="pt-4">
              <p className="text-sm font-semibold text-[#166534] mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Veteriner Randevusu Alın
              </p>
              <Link href={`/owner/appointments/book${selectedPetId ? `?petId=${selectedPetId}` : ""}`}>
                <Button className="w-full bg-[#166534] hover:bg-[#14532D] text-white" size="lg">
                  <Calendar className="w-5 h-5 mr-2" />
                  Hemen Randevu Al
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* New analysis button */}
          <Button variant="outline" className="w-full" onClick={resetForm}>
            Yeni Semptom Analizi
          </Button>

          {/* Disclaimer */}
          <p className="text-xs text-gray-500 text-center italic border border-gray-200 rounded-lg p-3">
            {AI_DISCLAIMER}
          </p>
        </div>
      )}

      {/* ── HISTORY ─────────────────────────────────────────────────────────── */}
      {history.length > 0 && step === "input" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Geçmiş Sorgular
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((check) => {
                const isExpanded = expandedHistory === check.id;
                const summary = getHistorySummary(check.ai_response);
                return (
                  <div key={check.id} className="border border-gray-100 rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedHistory(isExpanded ? null : check.id)}
                    >
                      <div className="flex items-center gap-3 text-left">
                        <Activity className="w-4 h-4 text-orange-400 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[250px]">
                            {check.symptoms_text}
                          </p>
                          <p className="text-xs text-gray-400">{formatDate(check.created_at)}</p>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                    </button>
                    {isExpanded && summary && (
                      <div className="p-3 border-t border-gray-100 bg-gray-50">
                        <p className="text-sm font-semibold text-gray-800">{summary.title}</p>
                        {summary.detail && (
                          <p className="text-xs mt-1 text-gray-600 leading-relaxed">{summary.detail}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
