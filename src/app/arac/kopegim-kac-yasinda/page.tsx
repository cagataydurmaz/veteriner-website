import type { Metadata } from "next";
import KopegimKacYasindaClient from "./client";

export const metadata: Metadata = {
  title: "Köpeğim Kaç Yaşında? İnsan Yaşı Hesaplayıcı | Veterineri Bul",
  description: "Köpeğinizin yaşını insan yaşına çevirin. Irk ve yaşa göre gerçek köpek yaşı hesaplama.",
};

export default function KopegimKacYasindaPage() {
  return <KopegimKacYasindaClient />;
}
