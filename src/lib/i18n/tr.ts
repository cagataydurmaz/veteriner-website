/**
 * tr.ts — Turkish translation dictionary for the vet module.
 *
 * This is the single source of truth for all user-facing Turkish strings.
 * Organized by component/domain namespace for easy lookup and maintenance.
 *
 * Usage:
 *   import { t } from '@/lib/i18n/tr';
 *   t('statusBar.chipKlinikte')          → "Klinikte"
 *   t('statusBar.l3Busy')                → "Aktif görüşme sürerken değiştirilemez."
 *
 * Interpolation:
 *   t('masterToggle.greeting', { name }) → "Merhaba, Dr. Ayşe! 👋"
 *
 * Adding new strings:
 *   1. Add the key + value to the appropriate namespace below
 *   2. Replace the hardcoded string in the component with t('namespace.key')
 *   3. TypeScript will catch typos — keys are fully typed
 *
 * Future: swap this file for a JSON loader or i18n framework (next-intl, etc.)
 *         when multi-language support is needed. The t() API stays the same.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Flat dictionary — nested keys use dot notation for type safety
// ─────────────────────────────────────────────────────────────────────────────

const dictionary = {

  // ── Common / Shared ────────────────────────────────────────────────────────
  'common.active': 'Aktif',
  'common.passive': 'Pasif',
  'common.profile': 'Profil',
  'common.save': 'Kaydet',
  'common.saving': 'Kaydediliyor…',
  'common.cancel': 'İptal',
  'common.loading': 'Yükleniyor…',
  'common.networkError': 'Bağlantı hatası — internet bağlantınızı kontrol edin.',
  'common.genericError': 'Bir hata oluştu, tekrar deneyin.',

  // ── useVetToggle (lock messages) ───────────────────────────────────────────
  'toggle.available.layer1': 'Klinikte muayene hizmetini profilinizden aktive edin.',
  'toggle.available.busy': 'Aktif görüşme sırasında müsaitlik değiştirilemez.',
  'toggle.available.buffer': '',  // buffer_lock does NOT block availability toggle

  'toggle.online.layer1': 'Online görüşme hizmetini profilinizden aktive edin.',
  'toggle.online.busy': 'Aktif görüşme sırasında online durumu değiştirilemez.',
  'toggle.online.buffer': '30 dakika içinde klinikte randevunuz var — tampon koruması aktif.',

  'toggle.oncall.layer1': 'Nöbetçi hizmetini profilinizden aktive edin.',
  'toggle.oncall.busy': 'Aktif görüşme sırasında nöbet durumu değiştirilemez.',
  'toggle.oncall.buffer': '30 dakika içinde klinikte randevunuz var — tampon koruması aktif.',

  // ── VetStatusBar ───────────────────────────────────────────────────────────
  'statusBar.chipKlinikte': 'Klinikte',
  'statusBar.chipOnline': 'Online',
  'statusBar.chipNobetci': 'Nöbetçi',
  'statusBar.busyBadge': 'Görüşmede',
  'statusBar.bufferBadge': 'Tampon',
  'statusBar.l1DefaultTip': 'Bu hizmeti aktive etmek için Profil Ayarları\'nı tamamlayın.',
  'statusBar.l1VideoFeeTip': 'Lütfen profilinizden online görüşme ücreti belirleyin.',
  'statusBar.l3Busy': 'Aktif görüşme sürerken değiştirilemez.',
  'statusBar.l3OnlineBusy': 'Aktif görüşme sürerken online çıkılamaz.',
  'statusBar.l3Buffer': 'Yakın zamanda randevu var — tampon aktif.',
  'statusBar.l3OncallBusy': 'Meşgul veya tampon aktif.',
  'statusBar.profileLink': 'Hizmetleri profil ayarlarından aktive edin',

  // ── DashboardMasterToggle ──────────────────────────────────────────────────
  'masterToggle.online': 'Çevrimiçi',
  'masterToggle.offline': 'Çevrimdışı',
  'masterToggle.greeting': 'Merhaba, {{name}}! 👋',
  'masterToggle.readyQuestion': 'Bugüne Hazır Mısın?',
  'masterToggle.onlineDesc': 'Hasta sahipleri sizi aktif görüyor ve randevu alabilir.',
  'masterToggle.offlineDesc': 'Online olduğunuzda randevu talebi almaya başlayabilirsiniz.',
  'masterToggle.feeWarning': 'Online görüşme ücreti belirlenmemiş',
  'masterToggle.feeLink': 'Profil\'de Ayarla →',
  'masterToggle.goOffline': 'Offline ol',
  'masterToggle.goOnline': 'Online ol',
  'masterToggle.stopHint': 'Çalışmayı durdurmak için basın',
  'masterToggle.startHint': 'Başlamak için basın',

  // ── OnlineToggle (standalone card) ─────────────────────────────────────────
  'onlineToggle.title': 'Online Görüşme',
  'onlineToggle.locked': 'Online görüşme profilinizde kapalı',
  'onlineToggle.busy': 'Görüşme devam ediyor — meşgul',
  'onlineToggle.bufferLocked': '30 dk. içinde randevu var — online çıkmak kısıtlandı',
  'onlineToggle.active': 'Çevrimiçisiniz — anlık görüşme alabilirsiniz',
  'onlineToggle.inactive': 'Çevrimdışısınız — video görüşme alınmıyor',
  'onlineToggle.lockTitle': 'Online görüşme hizmetini profilden aktive edin',
  'onlineToggle.ariaLabel': 'Online görüşme durumunu değiştir',
  'onlineToggle.lockBanner': 'Profilinizden "Online Görüşme" seçeneğini aktive edin.',
  'onlineToggle.heartbeatWarning': 'Sekmeyi kapatırsanız 5 dakika sonra otomatik çevrimdışı olursunuz.',
  'onlineToggle.bufferWarning': '30 dakika içinde klinikte randevunuz var. Randevu geçtikten sonra online çıkabilirsiniz.',
  'onlineToggle.scheduleWarning': 'Mesai saatiniz dışında online oluyorsunuz. Hastalar sizi görebilir ama takvimde boş slot görünmeyebilir.',
  'onlineToggle.editCalendar': 'Takvimi Düzenle',

  // ── OnCallToggle (standalone card) ─────────────────────────────────────────
  'oncallToggle.title': 'Nöbetçi Durumu',
  'oncallToggle.locked': 'Nöbetçi hizmeti profilinizde kapalı',
  'oncallToggle.busy': 'Görüşme devam ediyor — meşgul',
  'oncallToggle.bufferLocked': '30 dk. içinde randevu var — tampon koruması',
  'oncallToggle.active': 'Nöbetçisiniz — acil randevular alınabilir',
  'oncallToggle.inactive': 'Nöbet kapalı — acil randevu alınmıyor',
  'oncallToggle.lockTitle': 'Nöbetçi hizmetini profilden aktive edin',
  'oncallToggle.busyTitle': 'Aktif görüşme sırasında değiştirilemez',
  'oncallToggle.bufferTitle': 'Yaklaşan randevu — tampon koruması',
  'oncallToggle.ariaLabel': 'Nöbet durumunu değiştir',
  'oncallToggle.lockBanner': 'Profilinizden "Nöbetçi Hizmeti" seçeneğini aktive edin.',
  'oncallToggle.busyBanner': 'Görüşme bittikten sonra nöbet durumunu değiştirebilirsiniz.',
  'oncallToggle.bufferBanner': '30 dakika içinde klinikte randevunuz var — tampon koruması aktif.',

  // ── AvailabilityToggle (standalone card) ───────────────────────────────────
  'availToggle.title': 'Bugünkü Müsaitlik',
  'availToggle.locked': 'Klinikte muayene profilinizde kapalı',
  'availToggle.busy': 'Görüşme devam ediyor',
  'availToggle.active': 'Bugün müsaitsiniz — hastalar sizi bulabilir',
  'availToggle.inactive': 'Bugün kapalısınız — arama sonuçlarında gizlendiniz',
  'availToggle.lockTitle': 'Klinikte muayene hizmetini profilden aktive edin',
  'availToggle.busyTitle': 'Aktif görüşme sırasında değiştirilemez',
  'availToggle.ariaLabel': 'Müsaitlik durumunu değiştir',
  'availToggle.bufferBadgeTitle': 'Yaklaşan Muayene',
  'availToggle.bufferBadgeText': '— 30 dakika içinde klinikte randevunuz var.',
  'availToggle.lockBanner': 'Profilinizden "Klinikte Muayene" seçeneğini aktive edin.',
  'availToggle.busyBanner': 'Görüşme bittikten sonra müsaitlik durumunu değiştirebilirsiniz.',
  'availToggle.resetNotice': 'Bu durum her gece 00:01\'de otomatik sıfırlanır. Her sabah güncellemeyi unutmayın.',

  // ── Calendar / Time ────────────────────────────────────────────────────────
  'calendar.dayShort.mon': 'Pzt',
  'calendar.dayShort.tue': 'Sal',
  'calendar.dayShort.wed': 'Çar',
  'calendar.dayShort.thu': 'Per',
  'calendar.dayShort.fri': 'Cum',
  'calendar.dayShort.sat': 'Cmt',
  'calendar.dayShort.sun': 'Paz',
  'calendar.dayFull.mon': 'Pazartesi',
  'calendar.dayFull.tue': 'Salı',
  'calendar.dayFull.wed': 'Çarşamba',
  'calendar.dayFull.thu': 'Perşembe',
  'calendar.dayFull.fri': 'Cuma',
  'calendar.dayFull.sat': 'Cumartesi',
  'calendar.dayFull.sun': 'Pazar',
  'calendar.monthFull.0': 'Ocak',
  'calendar.monthFull.1': 'Şubat',
  'calendar.monthFull.2': 'Mart',
  'calendar.monthFull.3': 'Nisan',
  'calendar.monthFull.4': 'Mayıs',
  'calendar.monthFull.5': 'Haziran',
  'calendar.monthFull.6': 'Temmuz',
  'calendar.monthFull.7': 'Ağustos',
  'calendar.monthFull.8': 'Eylül',
  'calendar.monthFull.9': 'Ekim',
  'calendar.monthFull.10': 'Kasım',
  'calendar.monthFull.11': 'Aralık',
  'calendar.monthShort.0': 'Oca',
  'calendar.monthShort.1': 'Şub',
  'calendar.monthShort.2': 'Mar',
  'calendar.monthShort.3': 'Nis',
  'calendar.monthShort.4': 'May',
  'calendar.monthShort.5': 'Haz',
  'calendar.monthShort.6': 'Tem',
  'calendar.monthShort.7': 'Ağu',
  'calendar.monthShort.8': 'Eyl',
  'calendar.monthShort.9': 'Eki',
  'calendar.monthShort.10': 'Kas',
  'calendar.monthShort.11': 'Ara',

  // ── Owner Booking Flow ─────────────────────────────────────────────────────
  'booking.typeTitle': 'Nasıl randevu almak istiyorsunuz?',
  'booking.typeRequired': 'Lütfen randevu türünü seçin.',
  'booking.typeInPerson': 'Klinikte Muayene',
  'booking.typeInPersonDesc': 'Veteriner kliniğinde yüz yüze',
  'booking.typeVideo': 'Online Görüşme',
  'booking.typeVideoDesc': 'Evden video görüşme',
  'booking.typeFilterBadgeClinic': '🏥 Klinik Veterinerler',
  'booking.typeFilterBadgeOnline': '💻 Online Veterinerler',
  'booking.typeAutoFilter': 'Veterinerler randevu türüne göre otomatik filtreleniyor.',
  'booking.confirmTypeTitle': 'Randevu Türünü Onaylayın',
  'booking.changeTypeHint': 'Türü değiştirmek ister misiniz? (Veteriner seçimi sıfırlanacak)',
  'booking.typeChangedReset': 'Randevu türü değiştirildi — veteriner seçimini yenileyin.',
  'booking.vetLoadingMsg': 'Veterinerler yükleniyor…',

  // ── Vet Dashboard Realtime ─────────────────────────────────────────────────
  'dashboard.newAppointmentToast': 'Yeni randevu isteği: {{date}} saat {{time}}',
  'dashboard.viewAppointment': 'Görüntüle',
  'dashboard.appointmentCancelled': 'Randevu iptal edildi — {{date}} saat {{time}}',
  'dashboard.appointmentRescheduled': 'Randevu saati değiştirildi — yeni saat {{date}} {{time}}',
  'dashboard.appointmentDeleted': 'Randevu kaydı silindi — {{date}} saat {{time}}',
  'dashboard.visibilityRefresh': 'Bağlantı yenilendi — takvim güncelleniyor…',

} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Type-safe translation function
// ─────────────────────────────────────────────────────────────────────────────

export type TranslationKey = keyof typeof dictionary;

/**
 * Get a translated string by key, with optional interpolation.
 *
 * Interpolation uses {{key}} placeholders:
 *   t('masterToggle.greeting', { name: 'Ayşe' })
 *   → "Merhaba, Ayşe! 👋"
 *
 * Returns the key itself if not found (visible bug, easy to catch).
 */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  let value: string = dictionary[key];
  if (!value && value !== '') return key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replaceAll(`{{${k}}}`, String(v));
    }
  }

  return value;
}

/**
 * Type-safe namespace accessor for components that use many keys from one namespace.
 *
 * Usage:
 *   const ts = ns('statusBar');
 *   ts('chipKlinikte')   → "Klinikte"
 *   ts('busyBadge')      → "Görüşmede"
 */
export function ns<P extends string>(prefix: P) {
  return function <K extends string>(
    key: K,
    params?: Record<string, string | number>,
  ): string {
    const fullKey = `${prefix}.${key}` as TranslationKey;
    return t(fullKey, params);
  };
}

export default dictionary;
