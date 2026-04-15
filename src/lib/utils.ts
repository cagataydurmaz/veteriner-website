import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

/** Turkey has been permanently UTC+3 since 2016 — no DST. */
const IST_TZ = 'Europe/Istanbul';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string/object for display, always in Istanbul time (UTC+3).
 * Uses native Intl.DateTimeFormat — no extra package required.
 *
 * @param date  ISO string or Date object
 * @param opts  Intl.DateTimeFormatOptions (defaults to "15 Nis 2026")
 */
export function formatIstanbulDate(
  date: string | Date,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('tr-TR', { ...opts, timeZone: IST_TZ }).format(d);
}

/**
 * Format a datetime showing both date and time in Istanbul time.
 * Example output: "15 Nis 2026, 12:30"
 */
export function formatIstanbulDateTime(date: string | Date): string {
  return formatIstanbulDate(date, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Return only the HH:MM portion of a datetime in Istanbul time.
 * Example output: "12:30"
 */
export function formatIstanbulTime(date: string | Date): string {
  return formatIstanbulDate(date, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: string | Date, formatStr = 'dd MMM yyyy') {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: tr });
}

export function formatDateTime(date: string | Date) {
  return formatDate(date, 'dd MMM yyyy, HH:mm');
}

export function formatRelative(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: tr });
}

export function isUpcoming(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isAfter(d, new Date());
}

export function isPast(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isBefore(d, new Date());
}

export function getAgeFromBirthDate(birthDate: string | null): string {
  if (!birthDate) return 'Bilinmiyor';
  const birth = parseISO(birthDate);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();

  if (years === 0) {
    return `${months} ay`;
  } else if (years < 2) {
    return `${years} yıl ${months > 0 ? months + ' ay' : ''}`;
  }
  return `${years} yaş`;
}

export function getSpeciesEmoji(species: string): string {
  const map: Record<string, string> = {
    köpek: '🐕',
    kedi: '🐈',
    kuş: '🦜',
    tavşan: '🐰',
    hamster: '🐹',
    balık: '🐟',
    kaplumbağa: '🐢',
    diğer: '🐾',
  };
  return map[species.toLowerCase()] || '🐾';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount);
}

export function getUrgencyColor(level: string): string {
  const colors: Record<string, string> = {
    low: 'text-green-700 bg-green-50 border-green-200',
    medium: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    high: 'text-orange-700 bg-orange-50 border-orange-200',
    emergency: 'text-red-700 bg-red-50 border-red-200',
  };
  return colors[level] || colors.low;
}

export function getUrgencyLabel(level: string): string {
  const labels: Record<string, string> = {
    low: 'Bekleyebilir',
    medium: 'Yakında Git',
    high: 'Bugün Git',
    emergency: 'ACİL',
  };
  return labels[level] || level;
}

export function getAppointmentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Beklemede',
    confirmed: 'Onaylandı',
    completed: 'Tamamlandı',
    cancelled: 'İptal Edildi',
    no_show: 'Gelmedi',
  };
  return labels[status] || status;
}

export function getAppointmentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'text-yellow-700 bg-yellow-50',
    confirmed: 'text-[#166534] bg-[#F0FDF4]',
    completed: 'text-green-700 bg-green-50',
    cancelled: 'text-red-700 bg-red-50',
    no_show: 'text-gray-700 bg-gray-50',
  };
  return colors[status] || 'text-gray-700 bg-gray-50';
}

export function getDayName(dayOfWeek: number): string {
  const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  return days[dayOfWeek];
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function generateSlots(startTime: string, endTime: string, intervalMinutes = 30): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  while (currentMinutes + intervalMinutes <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    slots.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
    currentMinutes += intervalMinutes;
  }

  return slots;
}
