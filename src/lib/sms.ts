/**
 * İleti Merkezi SMS — tek giden kanal.
 *
 * Kullanım:
 *   import { sendSMS } from "@/lib/sms";
 *   const ok = await sendSMS("+905XXXXXXXXX", "Mesaj metni");
 *
 * Dönüş: başarılıysa true, aksi hâlde false.
 * Hata hiçbir zaman dışarıya fırlatılmaz — arayan taraf çökmemeli.
 */

const API_URL = "https://api.iletimerkezi.com/v1/send-sms/json";

export async function sendSMS(
  phone: string,
  message: string
): Promise<boolean> {
  if (!phone || !message) return false;

  const key    = process.env.ILETI_MERKEZI_API_KEY;
  const hash   = process.env.ILETI_MERKEZI_HASH;
  const sender = process.env.ILETI_MERKEZI_SENDER ?? "VetBul";

  if (!key || !hash) {
    console.warn("[sms] ILETI_MERKEZI_API_KEY veya ILETI_MERKEZI_HASH eksik — SMS gönderilmedi");
    return false;
  }

  // Normalize phone: ensure +90 prefix, strip spaces/dashes
  const normalized = normalizePhone(phone);
  if (!normalized) {
    console.warn("[sms] Geçersiz telefon numarası:", phone);
    return false;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000); // 10 s timeout

    const response = await fetch(API_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      signal:  controller.signal,
      body: JSON.stringify({
        request: {
          authentication: { key, hash },
          order: {
            sender,
            sendDateTime: "",          // boş bırakılırsa hemen gönderilir
            message: {
              text: message,
              receipents: {             // sağlayıcı yazımı: receipents (tek c)
                number: [normalized],
              },
            },
          },
        },
      }),
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.error("[sms] HTTP hatası:", response.status);
      return false;
    }

    const data = await response.json();
    const code = String(data?.response?.status?.code ?? "");

    if (code !== "200") {
      console.error("[sms] API hatası — kod:", code, "| mesaj:", data?.response?.status?.message);
      return false;
    }

    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sms] Gönderim hatası:", msg);
    return false;
  }
}

/**
 * Telefonu uluslararası formata (+90XXXXXXXXXX) dönüştür.
 * Geçersizse boş string döner.
 */
function normalizePhone(raw: string): string {
  // Sadece rakamları al
  const digits = raw.replace(/\D/g, "");

  if (digits.startsWith("90") && digits.length === 12) {
    return "+" + digits; // zaten 90XX
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return "+9" + digits; // 05XX → +905XX
  }
  if (digits.length === 10) {
    return "+90" + digits; // 5XX → +905XX
  }
  if (digits.startsWith("90") && digits.length > 10) {
    return "+" + digits;
  }
  // Bilinmeyen format — olduğu gibi döndür
  return raw.trim().startsWith("+") ? raw.trim() : "+" + digits;
}
