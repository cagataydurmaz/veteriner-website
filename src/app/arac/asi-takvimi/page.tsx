import type { Metadata } from "next";
import AsiTakvimiClient from "./client";

export const metadata: Metadata = {
  title: "Aşı Takvimi Hesaplayıcı — Köpek ve Kedi | Veterineri Bul",
  description: "Köpek ve kedi aşı takvimini hesaplayın. Doğum tarihine göre hangi aşıların ne zaman yapılacağını öğrenin.",
};

export default function AsiTakvimiPage() {
  return <AsiTakvimiClient />;
}
