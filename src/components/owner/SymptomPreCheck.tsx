"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, Upload, Lightbulb, HelpCircle } from "lucide-react";
import { AI_DISCLAIMER } from "@/lib/constants";
import type { SymptomAnalysisResult } from "@/types";

interface SymptomPreCheckProps {
  petId: string | null;
  complaint: string;
  onContinue: (urgency: string) => void;
  onSkip: () => void;
}

export default function SymptomPreCheck({
  petId,
  complaint,
  onContinue,
  onSkip,
}: SymptomPreCheckProps) {
  const [symptoms, setSymptoms] = useState(complaint);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SymptomAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const analyzeSymptoms = async () => {
    if (!symptoms.trim()) return;
    setLoading(true);
    setError(null);

    const toastId = toast.loading("Yapay zeka analiz ediyor… (bu 10-30 saniye sürebilir)");

    try {
      const formData = new FormData();
      if (petId) formData.append("petId", petId);
      formData.append("symptoms", symptoms);
      if (photoFile) formData.append("photo0", photoFile);

      const response = await fetch("/api/symptom-check", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const msg = data.error || "Analiz sırasında bir hata oluştu. Tekrar deneyin.";
        setError(msg);
        toast.error(msg, { id: toastId });
        return;
      }

      const data = await response.json();
      if (data.result) {
        // Defensive: ensure arrays exist even if AI omitted them
        setResult({
          topic_summary: data.result.topic_summary ?? "",
          general_info: data.result.general_info ?? "",
          common_causes: Array.isArray(data.result.common_causes) ? data.result.common_causes : [],
          care_notes: Array.isArray(data.result.care_notes) ? data.result.care_notes : [],
          questions_to_ask_vet: Array.isArray(data.result.questions_to_ask_vet) ? data.result.questions_to_ask_vet : [],
          disclaimer: data.result.disclaimer ?? AI_DISCLAIMER,
        });
        toast.dismiss(toastId);
      } else {
        const msg = "Yapay zeka yanıtı alınamadı. Lütfen tekrar deneyin.";
        setError(msg);
        toast.error(msg, { id: toastId });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.";
      setError(msg);
      toast.error(msg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Yapay Zeka Bilgi Asistanı</h3>
            <p className="text-xs text-gray-500">İsteğe bağlı — atlayabilirsiniz</p>
          </div>
        </div>

        {!result ? (
          <div className="space-y-3">
            <textarea
              className="w-full rounded-lg border border-gray-300 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#166534]"
              rows={4}
              placeholder="Semptomları Türkçe olarak açıklayın... (örn: 3 gündür iştahsız, halsiz, kusma var)"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            />

            <div
              className="border border-dashed border-gray-300 rounded-lg p-3 flex items-center gap-2 cursor-pointer hover:border-[#166534] transition-colors"
              onClick={() => document.getElementById("symptom-photo")?.click()}
            >
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {photoFile ? photoFile.name : "Fotoğraf ekle (opsiyonel)"}
              </span>
              <input
                id="symptom-photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              onClick={analyzeSymptoms}
              className="w-full"
              loading={loading}
              variant={loading ? "default" : "outline"}
              disabled={!symptoms.trim() || loading}
            >
              {loading ? "Yapay zeka analiz ediyor…" : "Bilgi Al"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Topic Summary */}
            {result.topic_summary && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-800 mb-1">Konu Özeti</p>
                <p className="text-sm text-blue-700">{result.topic_summary}</p>
              </div>
            )}

            {/* General Info */}
            {result.general_info && (
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm text-gray-700 leading-relaxed">{result.general_info}</p>
              </div>
            )}

            {/* Common Causes */}
            {result.common_causes.length > 0 && (
              <div className="rounded-lg bg-[#F0FDF4] p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightbulb className="w-3.5 h-3.5 text-[#166534]" />
                  <p className="text-xs font-medium text-[#166534]">Bilinebilecek Genel Nedenler:</p>
                </div>
                {result.common_causes.map((item, idx) => (
                  <p key={idx} className="text-xs text-[#15803D] ml-5">• {item}</p>
                ))}
              </div>
            )}

            {/* Care Notes */}
            {result.care_notes.length > 0 && (
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800 mb-2">📋 Genel Bakım Notları:</p>
                {result.care_notes.map((item, idx) => (
                  <p key={idx} className="text-xs text-amber-700 ml-1">• {item}</p>
                ))}
              </div>
            )}

            {/* Questions to Ask Vet */}
            {result.questions_to_ask_vet.length > 0 && (
              <div className="rounded-lg bg-purple-50 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-700" />
                  <p className="text-xs font-medium text-purple-800">Veterinere Sorulabilecek Sorular:</p>
                </div>
                {result.questions_to_ask_vet.map((item, idx) => (
                  <p key={idx} className="text-xs text-purple-700 ml-5">• {item}</p>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-xs text-gray-500 italic text-center">{AI_DISCLAIMER}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="flex-1">
          Atla
        </Button>
        <Button
          onClick={() => onContinue("")}
          className="flex-1"
        >
          Veteriner Seç <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
