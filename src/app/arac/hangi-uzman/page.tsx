import type { Metadata } from "next";
import HangiUzmanClient from "./client";

export const metadata: Metadata = {
  title: "Hangi Veteriner Uzmanına Gitmeliyim? | Veterineri Bul",
  description: "5 soruluk quiz ile evcil hayvanınız için doğru veteriner uzmanını bulun.",
};

export default function HangiUzmanPage() {
  return <HangiUzmanClient />;
}
