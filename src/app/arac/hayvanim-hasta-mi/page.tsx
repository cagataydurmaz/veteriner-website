import type { Metadata } from "next";
import HayvanımHastaMıClient from "./client";

export const metadata: Metadata = {
  title: "Hayvanım Hasta mı? Semptom Kontrolü | Veterineri Bul",
  description: "Köpek, kedi ve diğer evcil hayvanların semptomlarını kontrol edin. Ücretsiz semptom değerlendirme aracı.",
};

export default function HayvanımHastaMıPage() {
  return <HayvanımHastaMıClient />;
}
