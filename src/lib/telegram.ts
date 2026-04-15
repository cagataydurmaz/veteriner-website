/**
 * telegram.ts — Telegram Bot bildirim servisi
 *
 * Kullanım:
 *   Escalate olayında admin'e anlık Telegram mesajı gönderir.
 *
 * Kurulum:
 *   1. Telegram'da @BotFather'a mesaj at → /newbot → token al
 *   2. Bota bir mesaj gönder, sonra şu URL'den chat_id'ni öğren:
 *      https://api.telegram.org/bot<TOKEN>/getUpdates
 *   3. .env.local dosyasına ekle:
 *      TELEGRAM_BOT_TOKEN=123456:ABC-xyz
 *      TELEGRAM_ADMIN_CHAT_ID=987654321
 */

const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT  = process.env.TELEGRAM_ADMIN_CHAT_ID;
const TELEGRAM_API = "https://api.telegram.org";

interface SendMessageOptions {
  chatId?: string;
  text: string;
  /** "HTML" veya "MarkdownV2" — default HTML */
  parseMode?: "HTML" | "MarkdownV2" | "Markdown";
  /** Inline buton eklemek için */
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; url: string }>>;
  };
}

/**
 * Telegram bot üzerinden mesaj gönderir.
 * Token veya chat ID yoksa sessizce atlar (throw etmez).
 */
export async function sendTelegramMessage(opts: SendMessageOptions): Promise<void> {
  if (!BOT_TOKEN || !ADMIN_CHAT) {
    // Ortam değişkeni ayarlanmamışsa uyar ama uygulamayı çökertme
    console.warn("[telegram] TELEGRAM_BOT_TOKEN veya TELEGRAM_ADMIN_CHAT_ID eksik — bildirim atlandı.");
    return;
  }

  const chatId = opts.chatId ?? ADMIN_CHAT;

  const body: Record<string, unknown> = {
    chat_id:    chatId,
    text:       opts.text,
    parse_mode: opts.parseMode ?? "HTML",
  };

  if (opts.replyMarkup) {
    body.reply_markup = opts.replyMarkup;
  }

  const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "bilinmeyen hata");
    console.error(`[telegram] sendMessage başarısız (${res.status}):`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hazır Mesaj Şablonları
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Veteriner canlı destek talep ettiğinde admin'e gönderilir.
 */
export async function notifyVetEscalation(opts: {
  vetName: string;
  vetEmail: string;
  subject: string;
  threadId: string;
  threadUrl: string;
}): Promise<void> {
  const text = [
    "🚨 <b>CANLI DESTEK TALEBİ</b>",
    "",
    `🩺 <b>Dr. ${opts.vetName}</b>`,
    `📧 ${opts.vetEmail}`,
    `📌 Konu: ${opts.subject}`,
    "",
    "Veteriner canlı destek bekliyor. Lütfen hemen yanıt verin.",
  ].join("\n");

  await sendTelegramMessage({
    text,
    parseMode: "HTML",
    replyMarkup: {
      inline_keyboard: [[
        { text: "💬 Hemen Yanıtla →", url: opts.threadUrl },
      ]],
    },
  });
}

/**
 * Destek talebi çözüldüğünde admin'e özet bildirim gönderir.
 */
export async function notifyThreadResolved(opts: {
  vetName: string;
  subject: string;
}): Promise<void> {
  await sendTelegramMessage({
    text: `✅ <b>Destek talebi çözüldü</b>\n🩺 Dr. ${opts.vetName}\n📌 ${opts.subject}`,
    parseMode: "HTML",
  });
}
