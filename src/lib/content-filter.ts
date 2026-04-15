// Content filter for detecting external contact info sharing

const PHONE_PATTERNS = [
  /(\+90[\s\-.]?\d{3}[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2})/,
  /(0[\s\-.]?5\d{2}[\s\-.]?\d{3}[\s\-.]?\d{4})/,
  /(05\d{9})/,
  /(\b0\d{3}[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2}\b)/,
  // Number written with spaces/words like "05 12 345 67 89"
  /(\b5\d{2}[\s\-.]?\d{3}[\s\-.]?\d{4}\b)/,
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

const SOCIAL_PATTERNS = [
  /@[a-zA-Z0-9_.]{2,}/,
  /instagram\.com\/[a-zA-Z0-9_.]+/i,
  /t\.me\/[a-zA-Z0-9_]+/i,
  /wa\.me\/\d+/i,
];

const KEYWORD_PATTERNS = [
  /numaramı/i,
  /numaram[ıi]/i,
  /telefon\s*(num|no)/i,
  /whatsapp/i,
  /what\s*s\s*app/i,
  /telegram/i,
  /instagram/i,
  /direkt\s*yaz/i,
  /dışarıdan\s*(yaz|ulaş|ara)/i,
  /\bwp\b/i,
  /sizi\s*arayabilir\s*miyim/i,
  /mesaj\s*at/i,
  /mail\s*(at|gönder|yaz)/i,
];

export type FilterResult =
  | { blocked: false }
  | { blocked: true; reason: string };

export function filterMessage(content: string): FilterResult {
  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(content)) {
      return { blocked: true, reason: "phone_number" };
    }
  }

  if (EMAIL_PATTERN.test(content)) {
    return { blocked: true, reason: "email_address" };
  }

  for (const pattern of SOCIAL_PATTERNS) {
    if (pattern.test(content)) {
      return { blocked: true, reason: "social_media" };
    }
  }

  for (const pattern of KEYWORD_PATTERNS) {
    if (pattern.test(content)) {
      return { blocked: true, reason: "circumvention_keyword" };
    }
  }

  return { blocked: false };
}

export const BLOCK_REASON_LABELS: Record<string, string> = {
  phone_number: "telefon numarası",
  email_address: "e-posta adresi",
  social_media: "sosyal medya bilgisi",
  circumvention_keyword: "platform dışı iletişim girişimi",
};
