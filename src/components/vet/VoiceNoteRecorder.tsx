"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Mic, MicOff, Square, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { SOAPNotes, Medication } from "@/types";

interface VoiceNoteRecorderProps {
  appointmentId: string;
  onSaved?: () => void;
}

type RecordingState = "idle" | "recording" | "processing" | "review" | "saved";

interface SOAPResult {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  medications?: Medication[];
  follow_up_days?: number | null;
}

export default function VoiceNoteRecorder({
  appointmentId,
  onSaved,
}: VoiceNoteRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [soapNotes, setSoapNotes] = useState<SOAPResult | null>(null);
  const [editedSoap, setEditedSoap] = useState<SOAPResult | null>(null);
  const [vetNotes, setVetNotes] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = createClient();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
        await processAudio(blob);
      };

      mediaRecorder.start();
      setState("recording");
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch {
      toast.error("Mikrofon erişimi reddedildi");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setState("processing");
    }
  };

  const processAudio = async (blob: Blob) => {
    setState("processing");
    try {
      const formData = new FormData();
      formData.append("audio", blob, "voice-note.webm");
      formData.append("appointmentId", appointmentId);

      const response = await fetch("/api/voice-notes", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setTranscription(data.transcription);
      setSoapNotes(data.soap_notes);
      setEditedSoap(data.soap_notes);
      setVoiceNoteUrl(data.voice_note_url);
      setState("review");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Hata oluştu";
      toast.error("Ses notu işlenemedi: " + msg);
      setState("idle");
    }
  };

  const saveNotes = async () => {
    try {
      const { error } = await supabase
        .from("medical_records")
        .upsert({
          appointment_id: appointmentId,
          voice_note_url: voiceNoteUrl,
          transcription,
          soap_notes: editedSoap,
          medications: editedSoap?.medications || [],
          follow_up_date: editedSoap?.follow_up_days
            ? new Date(Date.now() + editedSoap.follow_up_days * 86400000)
                .toISOString()
                .split("T")[0]
            : null,
          vet_notes: vetNotes || null,
        });

      if (error) throw error;

      toast.success("Tıbbi notlar kaydedildi!");
      setState("saved");
      onSaved?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Hata oluştu";
      toast.error("Kaydedilemedi: " + msg);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (state === "saved") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check className="w-6 h-6 text-green-600" />
        </div>
        <p className="font-medium text-green-800">Tıbbi notlar kaydedildi!</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mic className="w-4 h-4 text-[#166534]" />
          Sesli Not & SOAP
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording Controls */}
        {(state === "idle" || state === "recording") && (
          <div className="flex flex-col items-center gap-4 py-4">
            {state === "recording" && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="font-mono text-red-600 font-bold text-xl">
                  {formatTime(recordingTime)}
                </span>
              </div>
            )}
            <button
              onClick={state === "idle" ? startRecording : stopRecording}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors shadow-lg ${
                state === "recording"
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-[#166534] hover:bg-[#1D4ED8]"
              }`}
            >
              {state === "recording" ? (
                <Square className="w-8 h-8 text-white fill-white" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </button>
            <p className="text-sm text-gray-500">
              {state === "idle"
                ? "Kayda başlamak için tıklayın"
                : "Durdurmak için tıklayın"}
            </p>
          </div>
        )}

        {/* Processing */}
        {state === "processing" && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 text-[#166534] animate-spin mx-auto mb-3" />
            <p className="font-medium text-gray-700">Transkripsiyon yapılıyor...</p>
            <p className="text-sm text-gray-500 mt-1">SOAP formatına dönüştürülüyor...</p>
          </div>
        )}

        {/* Review & Edit */}
        {state === "review" && editedSoap && (
          <div className="space-y-4">
            {/* Transcription */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Transkripsiyon</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{transcription}</p>
            </div>

            {/* SOAP Notes */}
            {(["subjective", "objective", "assessment", "plan"] as const).map((field) => {
              const labels = {
                subjective: "Subjektif (Şikayet)",
                objective: "Objektif (Muayene)",
                assessment: "Değerlendirme",
                plan: "Plan",
              };
              return (
                <div key={field}>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    {labels[field]}
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm resize-none focus:ring-2 focus:ring-[#166534] focus:outline-none"
                    rows={2}
                    value={editedSoap[field]}
                    onChange={(e) =>
                      setEditedSoap((s) => s ? ({ ...s, [field]: e.target.value }) : s)
                    }
                  />
                </div>
              );
            })}

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Ek Notlar
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-300 p-2.5 text-sm resize-none focus:ring-2 focus:ring-[#166534] focus:outline-none"
                rows={2}
                placeholder="Ek notlar..."
                value={vetNotes}
                onChange={(e) => setVetNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setState("idle");
                  setSoapNotes(null);
                  setEditedSoap(null);
                }}
                className="flex-1"
              >
                Yeniden Kaydet
              </Button>
              <Button onClick={saveNotes} className="flex-1">
                <Check className="w-4 h-4 mr-2" />
                Kaydet
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
