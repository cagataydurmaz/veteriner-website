"use client";

interface Props {
  password: string;
}

type Level = { label: string; color: string; bg: string; width: string };

function getLevel(pw: string): { score: number; level: Level; hints: string[] } {
  const hints: string[] = [];
  let score = 0;

  if (pw.length >= 8)        score++; else hints.push("En az 8 karakter");
  if (pw.length >= 12)       score++;
  if (/[A-Z]/.test(pw))      score++; else hints.push("Büyük harf");
  if (/[0-9]/.test(pw))      score++; else hints.push("Rakam");
  if (/[^A-Za-z0-9]/.test(pw)) score++; else hints.push("Özel karakter (!@#…)");

  const levels: Level[] = [
    { label: "Çok Zayıf",  color: "text-red-500",    bg: "bg-red-500",    width: "w-1/5" },
    { label: "Zayıf",      color: "text-orange-500",  bg: "bg-orange-500", width: "w-2/5" },
    { label: "Orta",       color: "text-yellow-500",  bg: "bg-yellow-500", width: "w-3/5" },
    { label: "Güçlü",      color: "text-emerald-500", bg: "bg-emerald-500",width: "w-4/5" },
    { label: "Çok Güçlü",  color: "text-green-500",   bg: "bg-green-500",  width: "w-full" },
  ];

  return { score, level: levels[Math.min(score, 4)], hints };
}

export default function PasswordStrength({ password }: Props) {
  if (!password) return null;
  const { score, level, hints } = getLevel(password);

  return (
    <div className="mt-1.5 space-y-1">
      {/* Bar */}
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${level.bg} ${level.width}`} />
      </div>
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${level.color}`}>{level.label}</span>
        {hints.length > 0 && score < 3 && (
          <span className="text-xs text-gray-400">{hints[0]} ekleyin</span>
        )}
      </div>
    </div>
  );
}
