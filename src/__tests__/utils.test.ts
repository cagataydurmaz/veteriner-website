import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cn,
  formatIstanbulDate,
  formatIstanbulDateTime,
  formatIstanbulTime,
  formatDate,
  formatDateTime,
  formatRelative,
  isUpcoming,
  isPast,
  getAgeFromBirthDate,
  getSpeciesEmoji,
  formatCurrency,
  getUrgencyColor,
  getUrgencyLabel,
  getAppointmentStatusLabel,
  getAppointmentStatusColor,
  getDayName,
  truncate,
  generateSlots,
} from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('handles conditional classes', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('deduplicates conflicting tailwind classes', () => {
    const result = cn('p-2', 'p-4');
    expect(result).toBe('p-4');
  });
});

describe('formatIstanbulDate', () => {
  it('formats a date string in Istanbul timezone', () => {
    const result = formatIstanbulDate('2026-04-15T10:00:00Z');
    expect(typeof result).toBe('string');
    expect(result).toContain('2026');
  });

  it('accepts a Date object', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const result = formatIstanbulDate(date);
    expect(typeof result).toBe('string');
    expect(result).toContain('2026');
  });
});

describe('formatIstanbulDateTime', () => {
  it('includes time portion', () => {
    const result = formatIstanbulDateTime('2026-04-15T10:30:00Z');
    expect(typeof result).toBe('string');
    // Should contain hour and minute digits
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe('formatIstanbulTime', () => {
  it('returns only time in HH:MM format', () => {
    const result = formatIstanbulTime('2026-04-15T09:00:00Z');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate('2026-04-15');
    expect(typeof result).toBe('string');
    expect(result).toContain('2026');
  });

  it('accepts a Date object', () => {
    const result = formatDate(new Date('2026-04-15'));
    expect(typeof result).toBe('string');
  });

  it('accepts a custom format string', () => {
    const result = formatDate('2026-04-15', 'yyyy');
    expect(result).toBe('2026');
  });
});

describe('formatDateTime', () => {
  it('formats date and time', () => {
    const result = formatDateTime('2026-04-15T14:30:00');
    expect(typeof result).toBe('string');
    expect(result).toContain('2026');
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe('formatRelative', () => {
  it('returns a relative time string', () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = formatRelative(pastDate);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('isUpcoming', () => {
  it('returns true for a future date', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isUpcoming(future)).toBe(true);
  });

  it('returns false for a past date', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isUpcoming(past)).toBe(false);
  });
});

describe('isPast', () => {
  it('returns true for a past date', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isPast(past)).toBe(true);
  });

  it('returns false for a future date', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isPast(future)).toBe(false);
  });
});

describe('getAgeFromBirthDate', () => {
  it('returns "Bilinmiyor" for null input', () => {
    expect(getAgeFromBirthDate(null)).toBe('Bilinmiyor');
  });

  it('returns month count for a baby less than 1 year old', () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const result = getAgeFromBirthDate(threeMonthsAgo.toISOString().split('T')[0]);
    expect(result).toMatch(/ay/);
  });

  it('returns age in years for an older pet', () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const result = getAgeFromBirthDate(fiveYearsAgo.toISOString().split('T')[0]);
    expect(result).toMatch(/yaş/);
  });
});

describe('getSpeciesEmoji', () => {
  it('returns correct emoji for known species', () => {
    expect(getSpeciesEmoji('köpek')).toBe('🐕');
    expect(getSpeciesEmoji('kedi')).toBe('🐈');
    expect(getSpeciesEmoji('kuş')).toBe('🦜');
    expect(getSpeciesEmoji('tavşan')).toBe('🐰');
    expect(getSpeciesEmoji('hamster')).toBe('🐹');
    expect(getSpeciesEmoji('balık')).toBe('🐟');
    expect(getSpeciesEmoji('kaplumbağa')).toBe('🐢');
    expect(getSpeciesEmoji('diğer')).toBe('🐾');
  });

  it('is case-insensitive for ASCII characters', () => {
    // Note: JavaScript's toLowerCase() is not Turkish-locale-aware,
    // so 'İ'.toLowerCase() produces 'i\u0307' not 'i' in some environments.
    // We test with ASCII-safe mixed-case inputs.
    expect(getSpeciesEmoji('Köpek')).toBe('🐕');
    expect(getSpeciesEmoji('Kedi')).toBe('🐈');
  });

  it('returns default emoji for unknown species', () => {
    expect(getSpeciesEmoji('timsah')).toBe('🐾');
  });
});

describe('formatCurrency', () => {
  it('formats a number as Turkish lira', () => {
    const result = formatCurrency(100);
    expect(typeof result).toBe('string');
    // Should contain the number 100
    expect(result).toContain('100');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(typeof result).toBe('string');
  });

  it('formats large numbers', () => {
    const result = formatCurrency(1500.50);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getUrgencyColor', () => {
  it('returns correct color for each urgency level', () => {
    expect(getUrgencyColor('low')).toContain('green');
    expect(getUrgencyColor('medium')).toContain('yellow');
    expect(getUrgencyColor('high')).toContain('orange');
    expect(getUrgencyColor('emergency')).toContain('red');
  });

  it('falls back to low for unknown level', () => {
    expect(getUrgencyColor('unknown')).toBe(getUrgencyColor('low'));
  });
});

describe('getUrgencyLabel', () => {
  it('returns Turkish labels', () => {
    expect(getUrgencyLabel('low')).toBe('Bekleyebilir');
    expect(getUrgencyLabel('medium')).toBe('Yakında Git');
    expect(getUrgencyLabel('high')).toBe('Bugün Git');
    expect(getUrgencyLabel('emergency')).toBe('ACİL');
  });

  it('returns the input for unknown level', () => {
    expect(getUrgencyLabel('custom')).toBe('custom');
  });
});

describe('getAppointmentStatusLabel', () => {
  it('returns Turkish labels for known statuses', () => {
    expect(getAppointmentStatusLabel('pending')).toBe('Beklemede');
    expect(getAppointmentStatusLabel('confirmed')).toBe('Onaylandı');
    expect(getAppointmentStatusLabel('completed')).toBe('Tamamlandı');
    expect(getAppointmentStatusLabel('cancelled')).toBe('İptal Edildi');
    expect(getAppointmentStatusLabel('no_show')).toBe('Gelmedi');
  });

  it('returns the raw status for unknown values', () => {
    expect(getAppointmentStatusLabel('unknown_status')).toBe('unknown_status');
  });
});

describe('getAppointmentStatusColor', () => {
  it('returns color classes for known statuses', () => {
    expect(getAppointmentStatusColor('pending')).toContain('yellow');
    // confirmed uses hex color (#166534) rather than a named color class
    const confirmed = getAppointmentStatusColor('confirmed');
    expect(confirmed).toBeTruthy();
    expect(confirmed).not.toBe('text-gray-700 bg-gray-50');
    expect(getAppointmentStatusColor('completed')).toContain('green');
    expect(getAppointmentStatusColor('cancelled')).toContain('red');
    expect(getAppointmentStatusColor('no_show')).toContain('gray');
  });

  it('falls back to gray for unknown status', () => {
    expect(getAppointmentStatusColor('mystery')).toContain('gray');
  });
});

describe('getDayName', () => {
  it('returns correct Turkish day names', () => {
    expect(getDayName(0)).toBe('Pazar');
    expect(getDayName(1)).toBe('Pazartesi');
    expect(getDayName(2)).toBe('Salı');
    expect(getDayName(3)).toBe('Çarşamba');
    expect(getDayName(4)).toBe('Perşembe');
    expect(getDayName(5)).toBe('Cuma');
    expect(getDayName(6)).toBe('Cumartesi');
  });
});

describe('truncate', () => {
  it('returns the string unchanged when short enough', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and appends ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });
});

describe('generateSlots', () => {
  it('generates 30-minute slots by default', () => {
    const slots = generateSlots('09:00', '11:00');
    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });

  it('generates slots with custom interval', () => {
    const slots = generateSlots('09:00', '10:00', 15);
    expect(slots).toEqual(['09:00', '09:15', '09:30', '09:45']);
  });

  it('returns empty array when start equals end', () => {
    const slots = generateSlots('09:00', '09:00');
    expect(slots).toEqual([]);
  });

  it('pads hours and minutes with leading zeros', () => {
    const slots = generateSlots('08:00', '09:00', 60);
    expect(slots).toEqual(['08:00']);
  });
});
