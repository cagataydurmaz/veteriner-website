"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Question {
  text: string;
  options: { label: string; tags: string[] }[];
}

const QUESTIONS: Question[] = [
  {
    text: "Hayvanınızın ana şikayeti nedir?",
    options: [
      { label: "Deri, tüy veya kaşıntı sorunları", tags: ["dermatoloji"] },
      { label: "Yürüyüş, hareket veya eklem sorunları", tags: ["ortopedi"] },
      { label: "Göz sorunları (akıntı, kızarıklık, bulanıklık)", tags: ["goz"] },
      { label: "Diş, dişeti veya ağız kokusu", tags: ["dis"] },
      { label: "Sindirim, mide, bağırsak sorunları", tags: ["gastro"] },
      { label: "Kalp, solunum veya öksürük", tags: ["kardiyoloji"] },
      { label: "Nöbet, titreme veya denge kaybı", tags: ["noroloji"] },
      { label: "Üreme, doğum veya gebelik", tags: ["ureme"] },
      { label: "Kilo kaybı, tümör şüphesi", tags: ["onkoloji"] },
      { label: "Egzotik hayvan (kuş, sürüngen vb.)", tags: ["egzotik"] },
      { label: "Acil durum (kanama, bilinç kaybı)", tags: ["acil"] },
      { label: "Genel muayene / aşı / kontrol", tags: ["genel"] },
    ],
  },
  {
    text: "Ne kadar süredir bu şikayet var?",
    options: [
      { label: "Birkaç saat / bugün başladı", tags: ["acil"] },
      { label: "1-3 gün", tags: ["genel"] },
      { label: "1-2 hafta", tags: [] },
      { label: "1 aydan fazla (kronik)", tags: ["uzman"] },
    ],
  },
  {
    text: "Daha önce benzer şikayet oldu mu?",
    options: [
      { label: "Evet, tekrarlıyor", tags: ["uzman", "kronik"] },
      { label: "Hayır, ilk kez", tags: ["genel"] },
    ],
  },
  {
    text: "Genel durumu nasıl?",
    options: [
      { label: "Aktif ve iştahlı, normal görünüyor", tags: [] },
      { label: "Biraz yorgun ama yiyor", tags: ["genel"] },
      { label: "Çok halsiz, yemiyor/içmiyor", tags: ["ic", "acil"] },
      { label: "Nefes almakta zorlanıyor / acı çekiyor", tags: ["acil", "kardiyoloji"] },
    ],
  },
  {
    text: "Hayvanınızın türü nedir?",
    options: [
      { label: "Kedi", tags: ["genel"] },
      { label: "Köpek", tags: ["genel"] },
      { label: "Kuş (papağan, muhabbet vb.)", tags: ["egzotik"] },
      { label: "Kemirgen (tavşan, hamster vb.)", tags: ["egzotik"] },
      { label: "Sürüngen / Amfibi", tags: ["egzotik"] },
      { label: "At / Büyük hayvan", tags: ["buyuk"] },
    ],
  },
  {
    text: "Hayvanınızın yaşı?",
    options: [
      { label: "0-1 yaş (yavru)", tags: ["genel"] },
      { label: "1-7 yaş (yetişkin)", tags: [] },
      { label: "7+ yaş (yaşlı / senior)", tags: ["ic", "uzman"] },
    ],
  },
];

const SPECIALIST_MAP: Record<string, { title: string; emoji: string; desc: string; specialty: string }> = {
  dermatoloji: {
    title: "Dermatoloji Uzmanı",
    emoji: "🔬",
    desc: "Deri, tüy ve kaşıntı sorunları için dermatolog veteriner uygundur.",
    specialty: "Dermatoloji",
  },
  ortopedi: {
    title: "Ortopedi ve Cerrahi Uzmanı",
    emoji: "🦴",
    desc: "Kemik, eklem, kırık ve hareket sorunları için ortopedik cerrahi uzmanı uygundur.",
    specialty: "Ortopedi ve Cerrahi",
  },
  goz: {
    title: "Göz Hastalıkları Uzmanı",
    emoji: "👁️",
    desc: "Göz sorunları (akıntı, kızarıklık, katarakt) için oftalmoloji uzmanı önerilir.",
    specialty: "Göz Hastalıkları (Oftalmoloji)",
  },
  dis: {
    title: "Veteriner Diş Hekimi",
    emoji: "🦷",
    desc: "Diş, dişeti ve ağız hastalıkları için veteriner diş hekimi uygundur.",
    specialty: "Diş Hekimliği ve Ağız Cerrahisi",
  },
  ic: {
    title: "İç Hastalıklar Uzmanı",
    emoji: "🫀",
    desc: "Organlar ve kronik hastalıklar için iç hastalıklar uzmanı uygundur.",
    specialty: "İç Hastalıklar",
  },
  gastro: {
    title: "Gastroenteroloji Uzmanı",
    emoji: "🧫",
    desc: "Mide, bağırsak ve sindirim sorunları için gastroenteroloji uzmanı uygundur.",
    specialty: "Sindirim Sistemi (Gastroenteroloji)",
  },
  kardiyoloji: {
    title: "Kardiyoloji Uzmanı",
    emoji: "❤️",
    desc: "Kalp, solunum ve dolaşım sorunları için veteriner kardiyolog uygundur.",
    specialty: "Kardiyoloji",
  },
  noroloji: {
    title: "Nöroloji Uzmanı",
    emoji: "🧠",
    desc: "Nöbet, denge kaybı ve sinir sistemi sorunları için nörolog veteriner uygundur.",
    specialty: "Nöroloji",
  },
  ureme: {
    title: "Üreme ve Doğum Uzmanı",
    emoji: "🐣",
    desc: "Gebelik, doğum ve üreme sorunları için reprodüksiyon uzmanı uygundur.",
    specialty: "Üreme, Doğum ve Jinekoloji",
  },
  onkoloji: {
    title: "Onkoloji Uzmanı",
    emoji: "🔭",
    desc: "Tümör, kitle ve kanser şüphesi için veteriner onkolog uygundur.",
    specialty: "Onkoloji",
  },
  egzotik: {
    title: "Egzotik Hayvan Uzmanı",
    emoji: "🦜",
    desc: "Kuş, sürüngen, kemirgen ve egzotik hayvanlar için uzman veteriner gereklidir.",
    specialty: "Egzotik Hayvanlar",
  },
  buyuk: {
    title: "Büyük Hayvan Uzmanı",
    emoji: "🐴",
    desc: "At, inek, koyun gibi büyük hayvanlar için büyük hayvan pratiği uzmanı uygundur.",
    specialty: "Büyük Hayvan Pratiği",
  },
  acil: {
    title: "Acil ve Yoğun Bakım",
    emoji: "🚨",
    desc: "Acil durumlarda vakit kaybetmeden en yakın acil veteriner kliniğine gidin.",
    specialty: "Acil ve Yoğun Bakım",
  },
  genel: {
    title: "Genel Pratisyen Veteriner",
    emoji: "🩺",
    desc: "Genel muayene, aşı ve rutin kontrol için genel pratisyen veteriner yeterlidir.",
    specialty: "Genel Veterinerlik",
  },
};

function calcSpecialist(answers: number[]): string {
  const tags: Record<string, number> = {
    genel: 0, dermatoloji: 0, ortopedi: 0, goz: 0, dis: 0, ic: 0,
    gastro: 0, kardiyoloji: 0, noroloji: 0, ureme: 0, onkoloji: 0,
    egzotik: 0, buyuk: 0, acil: 0,
  };

  answers.forEach((ansIdx, qIdx) => {
    const q = QUESTIONS[qIdx];
    if (q && q.options[ansIdx]) {
      q.options[ansIdx].tags.forEach((tag) => {
        if (tag in tags) tags[tag]++;
      });
    }
  });

  const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

export default function HangiUzmanClient() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [specialist, setSpecialist] = useState<string | null>(null);

  const answer = (optIdx: number) => {
    const newAnswers = [...answers, optIdx];
    if (step < QUESTIONS.length - 1) {
      setAnswers(newAnswers);
      setStep(step + 1);
    } else {
      setAnswers(newAnswers);
      setSpecialist(calcSpecialist(newAnswers));
    }
  };

  const reset = () => { setStep(0); setAnswers([]); setSpecialist(null); };
  const result = specialist ? SPECIALIST_MAP[specialist] || SPECIALIST_MAP.genel : null;

  return (
    <div className="min-h-screen bg-[#F0FDF4]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <p className="font-semibold text-sm text-gray-900">Hangi Veteriner Uzmanı?</p>
            <p className="text-xs text-gray-500">5 soruluk rehber quiz</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {!result ? (
          <div className="bg-white rounded-2xl p-6 border border-[#DCFCE7]">
            {/* Progress */}
            <div className="flex gap-1 mb-6">
              {QUESTIONS.map((_, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= step ? "bg-[#166534]" : "bg-gray-200"}`} />
              ))}
            </div>

            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Soru {step + 1} / {QUESTIONS.length}</p>
            <h2 className="text-lg font-bold text-gray-900 mb-5">{QUESTIONS[step].text}</h2>

            <div className="space-y-2">
              {QUESTIONS[step].options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-[#166534] hover:bg-[#F0FDF4] text-left transition-colors"
                >
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
                  <span className="text-sm text-gray-800">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-[#DCFCE7] text-center">
              <div className="text-5xl mb-4">{result.emoji}</div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Önerilen Uzman</p>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">{result.title}</h2>
              <div className="flex items-center justify-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-[#166534]" />
                <span className="text-sm text-[#166534] font-medium">{result.specialty}</span>
              </div>
              <p className="text-gray-600 text-sm">{result.desc}</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-[#DCFCE7]">
              <p className="text-sm text-gray-600 mb-3">Bu alanda uzman veteriner bul:</p>
              <Link href={`/auth/register?specialty=${encodeURIComponent(result.specialty)}`}>
                <Button className="w-full bg-[#166534] hover:bg-[#14532D] text-white mb-3">
                  {result.title} Bul <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <button onClick={reset} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1">
                Testi Yeniden Başlat
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
