import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import ChatWidgetConditional from "@/components/shared/ChatWidgetConditional";
import CookieBanner from "@/components/shared/CookieBanner";
import NavigationProgress from "@/components/shared/NavigationProgress";
import OfflineBanner from "@/components/shared/OfflineBanner";
import Link from "next/link";
import "./globals.css";

// ── Google Fonts — served by Next.js edge, no external round-trip ─────────────
// font-display: swap keeps text visible while Inter loads.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  // System font fallback chain keeps LCP fast even before Inter loads
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  preload: true,
});

// ── Global title template ────────────────────────────────────────────────────
// Pages export `export const metadata = { title: "Sayfa Adı" }`
// → renders as "Sayfa Adı | Veterineri Bul"
// Pages that don't export a title get the `default` value below.
export const metadata: Metadata = {
  title: {
    template: "%s | Veterineri Bul",
    default: "Veterineri Bul | Türkiye'nin Güvenilir Veteriner Platformu",
  },
  description:
    "Güvenilir veterineri kolayca bul. Online randevu, semptom kontrolü, video görüşme ve daha fazlası.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.svg",
  },
  keywords: ["veteriner", "randevu", "evcil hayvan", "pet", "veterinary"],
  openGraph: {
    siteName: "Veterineri Bul",
    locale: "tr_TR",
    type: "website",
    title: "Veterineri Bul | Türkiye'nin Güvenilir Veteriner Platformu",
    description: "Güvenilir veterineri kolayca bul. Online randevu, semptom kontrolü, video görüşme ve daha fazlası.",
    images: [
      {
        url: "https://veterineribul.com/og-image.png",
        width: 1424,
        height: 752,
        alt: "Veterineri Bul — Güvenilir Veteriner Platformu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Veterineri Bul | Türkiye'nin Güvenilir Veteriner Platformu",
    description: "Güvenilir veterineri kolayca bul. Online randevu, semptom kontrolü, video görüşme.",
    images: ["https://veterineribul.com/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#166534",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

function DisclaimerBanner() {
  return (
    <footer className="bg-[#1C3028] text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Disclaimer */}
        <p className="text-xs text-white/80 leading-relaxed text-center mb-4">
          Veterineri Bul, veteriner hekimler ile hayvan sahiplerini buluşturan aracı bir platformdur.
          Doğrudan veterinerlik hizmeti sunmaz. Tüm tıbbi sorumluluk veteriner hekime aittir.
          Acil durumlarda en yakın veteriner kliniğine başvurun.
        </p>

        {/* Contact + Social */}
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 mb-4">
          <a
            href="mailto:destek@veterineribul.com"
            className="text-[11px] text-white/60 hover:text-white/90 transition-colors flex items-center gap-1"
          >
            ✉ destek@veterineribul.com
          </a>
          <span className="text-white/30 text-[11px]">·</span>
          <a
            href="https://www.instagram.com/veterinerbultr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-white/60 hover:text-white/90 transition-colors"
          >
            Instagram
          </a>
          <span className="text-white/30 text-[11px]">·</span>
          <a
            href="https://twitter.com/veterinerbul"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-white/60 hover:text-white/90 transition-colors"
          >
            X (Twitter)
          </a>
        </div>

        {/* Legal links */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-white/50">
          <Link href="/hakkimizda" className="hover:text-white/80 transition-colors">Hakkımızda</Link>
          <span>·</span>
          <Link href="/iletisim" className="hover:text-white/80 transition-colors">İletişim</Link>
          <span>·</span>
          <Link href="/kvkk/hayvan-sahibi" className="hover:text-white/80 transition-colors">KVKK (Pet Sahibi)</Link>
          <span>·</span>
          <Link href="/kvkk/veteriner" className="hover:text-white/80 transition-colors">KVKK (Veteriner)</Link>
          <span>·</span>
          <Link href="/kvkk/cerez-politikasi" className="hover:text-white/80 transition-colors">Çerez Politikası</Link>
          <span>·</span>
          <Link href="/kullanim-kosullari" className="hover:text-white/80 transition-colors">Kullanım Koşulları</Link>
          <span>·</span>
          <span className="text-white/40">© {new Date().getFullYear()} Veterineri Bul</span>
        </div>
      </div>
    </footer>
  );
}

const medicalOrgSchema = {
  "@context": "https://schema.org",
  "@type": "MedicalOrganization",
  name: "Veterineri Bul",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://veterineribul.com",
  description: "Türkiye'nin yapay zeka destekli veteriner platformu",
  medicalSpecialty: ["Veterinary"],
  serviceType: ["Klinikte Muayene", "Online Görüşme", "Acil Veteriner"],
  areaServed: "TR",
  sameAs: ["https://www.instagram.com/veterinerbultr"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(medicalOrgSchema) }}
        />
      </head>
      <body className={inter.className}>
        {/* Navigation progress bar — shown on every page transition */}
        <NavigationProgress />

        {children}

        {/* Offline detection banner */}
        <OfflineBanner />

        <ChatWidgetConditional />
        <DisclaimerBanner />
        <CookieBanner />
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            style: { fontFamily: "system-ui, sans-serif" },
          }}
        />
      </body>
    </html>
  );
}
