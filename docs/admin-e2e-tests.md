# Admin Panel — End-to-End Test Cases

**URL:** `http://localhost:3000`
**Admin Hesabı:** `durmazcagatay+admin@gmail.com`
**Ortam:** Local dev (`npm run dev`)

---

## TC-000 · Ön Koşul: Ortam Hazırlığı

- [ ] `npm run dev` çalışıyor, `localhost:3000` açılıyor
- [ ] Supabase bağlantısı aktif (`.env.local` doğru set edilmiş)
- [ ] Admin hesabı Supabase'de `role = 'admin'` olarak kayıtlı
- [ ] Tarayıcı geçmişi ve cookie'ler temizlenmiş

---

## BÖLÜM 1 · Erişim Kontrolü & Auth

### TC-001 · Admin olmayan kullanıcı admin paneline erişemez

**Ön koşul:** Owner hesabıyla giriş yapılmış
**Adımlar:**
1. `localhost:3000/admin/dashboard` adresine git

**Beklenen:** `/auth/login` veya `/owner/dashboard`'a yönlendirilir, admin paneli açılmaz

---

### TC-002 · Giriş yapmamış kullanıcı admin paneline erişemez

**Ön koşul:** Oturum kapalı
**Adımlar:**
1. `localhost:3000/admin/dashboard` adresine git

**Beklenen:** `/auth/login`'e yönlendirilir

---

### TC-003 · Admin başarılı giriş

**Adımlar:**
1. `localhost:3000/auth/login` → "Veteriner / Admin" sekmesi
2. E-posta: `durmazcagatay+admin@gmail.com` + şifre gir
3. "Giriş Yap" butonuna tıkla

**Beklenen:** `/admin/dashboard` açılır, sidebar görünür

---

### TC-004 · Admin çıkış (logout)

**Ön koşul:** TC-003 tamamlandı
**Adımlar:**
1. Navbar'daki profil/çıkış butonuna tıkla

**Beklenen:** Oturum kapanır, `/auth/login`'e tam sayfa yönlendirme yapılır, geri tuşuyla admin paneline dönülemez

---

## BÖLÜM 2 · Dashboard

### TC-005 · Dashboard istatistikleri yüklenir

**Adımlar:**
1. `/admin/dashboard` aç

**Beklenen:**
- 4 stat kartı görünür (Hayvan Sahipleri, Aktif Veterinerler, Bugünkü Randevular, Aylık Gelir)
- Bekleyen veteriner onayı varsa uyarı kartı görünür
- Türkiye haritası yüklenir
- Top 5 şehir listesi görünür

---

### TC-006 · Dashboard kritik uyarı linki çalışır

**Ön koşul:** Onay bekleyen en az 1 veteriner var
**Adımlar:**
1. Dashboard'daki "Bekleyen Onaylar" uyarı kartına tıkla

**Beklenen:** `/admin/vets` sayfasına gider

---

## BÖLÜM 3 · Veteriner Yönetimi

### TC-007 · Veteriner listesi görüntülenir

**Adımlar:**
1. Sidebar → "Veterinerler" → `/admin/vets`

**Beklenen:** Kayıtlı tüm veterinerler tablo halinde görünür (ad, email, şehir, durum, randevu sayısı)

---

### TC-008 · Veteriner onaylama

**Ön koşul:** `verified = false` olan en az 1 veteriner mevcut
**Adımlar:**
1. `/admin/vets` → onaysız veterineri bul
2. "Onayla" butonuna tıkla

**Beklenen:** Veterinerin durumu "Onaylı" olarak güncellenir, tablo yenilenir

---

### TC-009 · Veteriner askıya alma

**Adımlar:**
1. `/admin/vets` → aktif bir veterineri bul
2. "Askıya Al" butonuna tıkla

**Beklenen:** Durum güncellenir, veteriner giriş yapamaz hale gelir

---

## BÖLÜM 4 · Randevu Yönetimi

### TC-010 · Randevu sekmeleri çalışır

**Adımlar:**
1. `/admin/appointments` aç
2. Sırasıyla "Bugün", "Bekleyen", "Yaklaşan", "Tamamlanan", "İptal" sekmelerine tıkla

**Beklenen:** Her sekme doğru filtrelenmiş randevuları gösterir, sekme sayıları doğru

---

### TC-011 · Randevu detayları doğru görüntülenir

**Adımlar:**
1. `/admin/appointments` → herhangi bir randevu kartına bak

**Beklenen:** Hayvan adı, durum badge, randevu tipi (Video/Yüz yüze), veteriner adı, hasta adı, tarih/saat görünür

---

## BÖLÜM 5 · Hayvan Sahibi Yönetimi

### TC-012 · Hayvan sahibi listesi yüklenir

**Adımlar:**
1. `/admin/owners` aç

**Beklenen:** 4 stat kartı + tablo görünür (toplam sahip, bu hafta yeni, evcil hayvanı olanlar, randevusu olanlar)

---

### TC-013 · Hayvan sahibi arama çalışır

**Adımlar:**
1. `/admin/owners` → arama kutusuna bir isim yaz (örn. "Ahmet")

**Beklenen:** Tablo anlık filtrelenir, sadece eşleşen kayıtlar görünür

---

### TC-014 · Şehir filtresi çalışır

**Adımlar:**
1. `/admin/owners` → "Şehir" dropdown'ından "İstanbul" seç

**Beklenen:** Sadece İstanbul'daki sahipler listelenir

---

### TC-015 · Sıralama çalışır

**Adımlar:**
1. `/admin/owners` → "Sırala" dropdown'ından "Kayıt Tarihi", "Hayvan Sayısı", "Randevu Sayısı" seçeneklerini tek tek dene

**Beklenen:** Her seçimde tablo sırası değişir

---

## BÖLÜM 6 · Yorum Yönetimi

### TC-016 · Yorum sekmeleri ve sayıları doğru

**Adımlar:**
1. `/admin/reviews` aç
2. "Bekleyen", "Onaylı", "İşaretli" sekmelerine sırayla tıkla

**Beklenen:** Üstteki stat kartlarındaki sayılar ile sekmelerdeki liste sayıları örtüşür

---

### TC-017 · Yorum onaylama

**Ön koşul:** "Bekleyen" sekmesinde en az 1 yorum var
**Adımlar:**
1. `/admin/reviews` → "Bekleyen" sekmesi
2. Bir yorumun "Onayla" butonuna tıkla

**Beklenen:**
- Yorum "Bekleyen" listesinden kaybolur
- "Onaylı" sekmesine geçildiğinde yorum orada görünür
- Stat kartı sayıları güncellenir

---

### TC-018 · Yorum işaretleme (flag)

**Ön koşul:** "Onaylı" sekmesinde en az 1 yorum var
**Adımlar:**
1. `/admin/reviews` → "Onaylı" sekmesi
2. Bir yorumun "İşaretle" butonuna tıkla

**Beklenen:** Yorum "İşaretli" sekmesine taşınır

---

### TC-019 · Yorum silme

**Adımlar:**
1. `/admin/reviews` → herhangi bir sekmede yorum bul
2. "Sil" butonuna tıkla

**Beklenen:** Yorum listeden kaldırılır, ilişkili itiraz varsa o da silinir, sayaç güncellenir

---

## BÖLÜM 7 · İtiraz (Dispute) Yönetimi

### TC-020 · İtiraz sekmeleri çalışır

**Adımlar:**
1. `/admin/disputes` aç
2. "Bekleyen", "İnceleniyor", "Çözümlendi", "Reddedildi" sekmelerine tıkla

**Beklenen:** Her sekme doğru filtrelenmiş itirazları gösterir

---

### TC-021 · İtiraz reddetme (dismiss)

**Ön koşul:** "Bekleyen" sekmesinde en az 1 itiraz var
**Adımlar:**
1. `/admin/disputes` → "Bekleyen" sekmesi
2. Admin karar metnini yaz (örn. "İncelendi, ihlal tespit edilmedi")
3. "Reddet" butonuna tıkla

**Beklenen:**
- İtiraz "Reddedildi" sekmesine taşınır
- İlişkili yorum işaretli kalmaya devam eder
- Karar metni kayıtlı görünür

---

### TC-022 · İtirazı onaylama (uphold)

**Ön koşul:** "Bekleyen" sekmesinde en az 1 itiraz var
**Adımlar:**
1. `/admin/disputes` → "Bekleyen" sekmesi
2. Admin karar metnini yaz
3. "Kabul Et" butonuna tıkla

**Beklenen:**
- İtiraz "Çözümlendi" sekmesine taşınır
- İlişkili yorumun "flagged" işareti **kaldırılır** (review temizlenir)

---

## BÖLÜM 8 · Duyurular

### TC-023 · Taslak duyuru oluşturma

**Adımlar:**
1. `/admin/announcements` → yeni duyuru formu
2. Başlık: "Test Duyurusu", Metin: "Bu bir test", Hedef: "Tüm Kullanıcılar"
3. "Taslak Olarak Kaydet" butonuna tıkla

**Beklenen:**
- Duyuru "Taslak" sekmesinde görünür
- Stat kart "Taslak" sayısı 1 artar
- Bildirim gönderilmez

---

### TC-024 · Duyuruyu anında gönderme

**Adımlar:**
1. `/admin/announcements` → yeni duyuru formu
2. Başlık ve metin doldur, "Hemen Gönder" seçeneğini işaretle
3. "Gönder" butonuna tıkla

**Beklenen:**
- Duyuru "Gönderildi" olarak görünür
- Hedeflenen kullanıcıların bildirim panelinde bildirim görünür

---

### TC-025 · Taslağı sonradan gönderme

**Ön koşul:** TC-023 tamamlandı
**Adımlar:**
1. `/admin/announcements` → "Taslak" sekmesi
2. Oluşturulan taslağın "Gönder" butonuna tıkla

**Beklenen:** Duyuru durumu "Gönderildi" olarak güncellenir, "Taslak" sayısı azalır

---

### TC-026 · Duyuru silme

**Adımlar:**
1. `/admin/announcements` → herhangi bir duyurunun "Sil" butonuna tıkla

**Beklenen:** Duyuru listeden kaldırılır, sayaç güncellenir

---

## BÖLÜM 9 · Blog Yönetimi

### TC-027 · Yeni blog yazısı oluşturma (taslak)

**Adımlar:**
1. `/admin/blog` → "Yeni Yazı" butonuna tıkla
2. Başlık: "Test Yazısı", Slug: otomatik oluşturuldu mu kontrol et
3. Yazar, özet, içerik, etiket doldur
4. "Yayınla" checkbox'ı işaretlemeden kaydet

**Beklenen:** Yazı tabloda "Taslak" statüsüyle görünür, `/blog/test-yazisi` erişilemiyor

---

### TC-028 · Blog yazısı yayınlama

**Ön koşul:** TC-027 tamamlandı
**Adımlar:**
1. `/admin/blog` → taslak yazının "Yayınla" toggle'ına tıkla

**Beklenen:** Durum "Yayında" olarak değişir, `/blog/[slug]` artık erişilebilir

---

### TC-029 · Blog yazısı yayından kaldırma

**Adımlar:**
1. `/admin/blog` → yayındaki yazının toggle'ına tekrar tıkla

**Beklenen:** Durum "Taslak"'a döner, public URL erişilemiyor

---

### TC-030 · Slug otomatik oluşturma

**Adımlar:**
1. `/admin/blog` → "Yeni Yazı" dialogunu aç
2. Başlık alanına "Kedi Sağlığı Rehberi" yaz

**Beklenen:** Slug alanı otomatik "kedi-sagligi-rehberi" olarak dolar (Türkçe karakter dönüşümü dahil)

---

## BÖLÜM 10 · Raporlar & Güvenlik

### TC-031 · Raporlar sekmeler arası geçiş

**Adımlar:**
1. `/admin/reports` aç
2. "İhlal Raporları", "Fraud Bayrakları", "Engellenen Mesajlar" sekmelerine sırayla geç

**Beklenen:** Her sekme doğru içeriği gösterir, sayılar stat kartlarıyla uyuşur

---

### TC-032 · Veteriner uyarı & askıya alma

**Ön koşul:** "Bekleyen" ihlal raporu en az 1 adet var
**Adımlar:**
1. `/admin/reports` → "İhlal Raporları" sekmesi
2. Bir raporun "Uyar & Askıya Al" butonuna tıkla

**Beklenen:**
- Rapor çözümlendi olarak işaretlenir
- Veterinerin `suspension_until` = bugün + 7 gün olarak set edilir
- `violation_count` 1 artar

---

### TC-033 · Veteriner yasaklama (ban)

**Adımlar:**
1. `/admin/reports` → "İhlal Raporları" sekmesi
2. Bir raporun "Yasakla" butonuna tıkla

**Beklenen:**
- Rapor çözümlendi olarak işaretlenir
- Veterinerin hesabı kalıcı olarak `is_banned = true` yapılır
- Veteriner bir daha giriş yapamaz

---

### TC-034 · Raporu reddetme (dismiss)

**Adımlar:**
1. `/admin/reports` → bekleyen bir raporun "Reddet" butonuna tıkla

**Beklenen:** Rapor "dismissed" statüsüne geçer, veterinere hiçbir yaptırım uygulanmaz

---

## BÖLÜM 11 · Ödemeler

### TC-035 · Ödeme istatistikleri yüklenir

**Adımlar:**
1. `/admin/payments` aç

**Beklenen:**
- 4 stat kartı görünür (Aylık Gelir, Toplam Gelir, Aktif Abonelikler, Bu Ay İşlem)
- 6 aylık gelir bar chart görünür
- Son işlemler tablosu yüklenir

---

### TC-036 · Ödeme durumu renk kodları doğru

**Adımlar:**
1. `/admin/payments` → son işlemler tablosunu incele

**Beklenen:**
- Başarılı → yeşil
- Bekleyen → sarı
- Başarısız → kırmızı
- İade → gri/mor badge

---

## BÖLÜM 12 · Analitik

### TC-037 · Analitik grafikler yüklenir

**Adımlar:**
1. `/admin/analytics` aç

**Beklenen:**
- 4 özet kartı görünür
- Randevu trend grafiği (çizgi)
- Gelir grafiği (bar)
- Kullanıcı büyümesi grafiği (çizgi)
- Abonelik dağılımı ve Tür dağılımı pie/donut chart
- Top 5 veteriner tablosu

---

## BÖLÜM 13 · İzleme (Monitoring)

### TC-038 · Sistem izleme sekmeleri çalışır

**Adımlar:**
1. `/admin/monitoring` aç
2. "Sistem Hataları", "API Kullanım Logu", "WhatsApp Durumu" sekmelerine geç

**Beklenen:** Her sekme kendi tablosunu gösterir

---

### TC-039 · Hata listesi severity renk kodları doğru

**Adımlar:**
1. `/admin/monitoring` → "Sistem Hataları" sekmesi

**Beklenen:**
- Critical → kırmızı
- High → turuncu
- Medium → sarı
- Low → yeşil badge

---

## BÖLÜM 14 · Veri İhlali (KVKK)

### TC-040 · Yeni veri ihlali bildirimi oluşturma

**Adımlar:**
1. `/admin/data-breach` aç
2. Açıklama yaz, severity "Yüksek" seç, etkilenen kullanıcı sayısı gir
3. "Bildir" butonuna tıkla

**Beklened:**
- İhlal "Açık" statüsüyle listeye eklenir
- Kırmızı uyarı banner (72 saat bildirimi) görünür

---

### TC-041 · İhlali "İnceleniyor" statüsüne alma

**Ön koşul:** TC-040 tamamlandı
**Adımlar:**
1. Oluşturulan ihlaldeki "İncelemeye Al" butonuna tıkla

**Beklenen:** Durum "Açık" → "İnceleniyor" olur

---

### TC-042 · İhlali çözümlendi olarak işaretleme

**Ön koşul:** TC-041 tamamlandı
**Adımlar:**
1. İhlaldeki "Çözümlendi Olarak İşaretle" butonuna tıkla
2. Çözüm notunu yaz

**Beklenen:** Durum "Çözümlendi" olur, `resolved_at` timestamp set edilir

---

### TC-043 · KVK Kurulu'na bildirildi işaretleme

**Adımlar:**
1. Herhangi bir ihlaldeki "KVK Kurulu'na Bildirildi" butonuna tıkla

**Beklenen:** Durum "Bildirildi" olarak güncellenir

---

## BÖLÜM 15 · İçerik Merkezi

### TC-044 · Content hub özet kartları ve linkleri

**Adımlar:**
1. `/admin/content` aç

**Beklenen:**
- 4 stat kartı görünür (Toplam Yazı, Yayında, Taslak, Toplam Duyuru)
- "Son Blog Yazıları" ve "Son Duyurular" bölümleri dolu
- "Blog Yönetimi →" butonu `/admin/blog`'a gider
- "Duyuru Yönetimi →" butonu `/admin/announcements`'e gider

---

## BÖLÜM 16 · Sidebar & Navigasyon

### TC-045 · Sidebar aktif link doğru highlight edilir

**Adımlar:**
1. Sidebar'daki her menü öğesine sırayla tıkla

**Beklened:** Tıklanan öğe yeşil/aktif renkte görünür, diğerleri pasif

---

### TC-046 · Sidebar tüm sayfalar açılıyor

**Adımlar:**
1. Sidebar'daki her linke sırayla tıkla: Dashboard, Veterinerler, Randevular, Ödemeler, Hayvan Sahipleri, Yorumlar, İtirazlar, Duyurular, Blog, Raporlar, İzleme, Analitik, Veri İhlali, İçerik

**Beklenen:** Her sayfa hata vermeden açılır, 404 yok

---

## BÖLÜM 17 · Performans & UX

### TC-047 · Sayfa yükleme süreleri kabul edilebilir

**Adımlar:**
1. Chrome DevTools → Network tab → Slow 3G seç
2. Tüm admin sayfalarını sırasıyla aç

**Beklenen:** Her sayfa 5 saniye içinde içeriği gösterir, skeleton loader varsa önce o görünür

---

### TC-048 · API hataları kullanıcıya gösterilir

**Adımlar:**
1. `.env.local`'daki Supabase URL'yi geçici olarak boz
2. Herhangi bir admin aksiyonu dene (yorum onayla, duyuru gönder vb.)

**Beklenen:** Toast notification ile anlaşılır hata mesajı gösterilir, sayfa çökmez

---

### TC-049 · Mobil görünüm — sidebar gizlenir

**Adımlar:**
1. Chrome DevTools → 375px genişlik (iPhone)
2. `/admin/dashboard` aç

**Beklenen:** Sidebar gizlenir veya hamburger menüye dönüşür, içerik düzgün görünür

---

## Test Sonuç Tablosu

| TC | Sayfa | Durum |
|----|-------|-------|
| TC-001 | Auth - Erişim Engeli | ⬜ |
| TC-002 | Auth - Oturumsuz Engel | ⬜ |
| TC-003 | Auth - Giriş | ⬜ |
| TC-004 | Auth - Çıkış | ⬜ |
| TC-005 | Dashboard - İstatistikler | ⬜ |
| TC-006 | Dashboard - Uyarı Linki | ⬜ |
| TC-007 | Veterinerler - Liste | ⬜ |
| TC-008 | Veterinerler - Onay | ⬜ |
| TC-009 | Veterinerler - Askı | ⬜ |
| TC-010 | Randevular - Sekmeler | ⬜ |
| TC-011 | Randevular - Detay | ⬜ |
| TC-012 | Sahipler - Liste | ⬜ |
| TC-013 | Sahipler - Arama | ⬜ |
| TC-014 | Sahipler - Şehir Filtresi | ⬜ |
| TC-015 | Sahipler - Sıralama | ⬜ |
| TC-016 | Yorumlar - Sekmeler | ⬜ |
| TC-017 | Yorumlar - Onay | ⬜ |
| TC-018 | Yorumlar - İşaretle | ⬜ |
| TC-019 | Yorumlar - Sil | ⬜ |
| TC-020 | İtirazlar - Sekmeler | ⬜ |
| TC-021 | İtirazlar - Reddet | ⬜ |
| TC-022 | İtirazlar - Kabul | ⬜ |
| TC-023 | Duyurular - Taslak | ⬜ |
| TC-024 | Duyurular - Anında Gönder | ⬜ |
| TC-025 | Duyurular - Taslak Gönder | ⬜ |
| TC-026 | Duyurular - Sil | ⬜ |
| TC-027 | Blog - Taslak Oluştur | ⬜ |
| TC-028 | Blog - Yayınla | ⬜ |
| TC-029 | Blog - Yayından Kaldır | ⬜ |
| TC-030 | Blog - Slug Otomatik | ⬜ |
| TC-031 | Raporlar - Sekmeler | ⬜ |
| TC-032 | Raporlar - Uyar & Askı | ⬜ |
| TC-033 | Raporlar - Ban | ⬜ |
| TC-034 | Raporlar - Reddet | ⬜ |
| TC-035 | Ödemeler - İstatistikler | ⬜ |
| TC-036 | Ödemeler - Renk Kodları | ⬜ |
| TC-037 | Analitik - Grafikler | ⬜ |
| TC-038 | İzleme - Sekmeler | ⬜ |
| TC-039 | İzleme - Severity Renkleri | ⬜ |
| TC-040 | KVKK - İhlal Oluştur | ⬜ |
| TC-041 | KVKK - İncelemeye Al | ⬜ |
| TC-042 | KVKK - Çözümle | ⬜ |
| TC-043 | KVKK - Bildirildi | ⬜ |
| TC-044 | İçerik - Hub | ⬜ |
| TC-045 | Sidebar - Aktif Link | ⬜ |
| TC-046 | Sidebar - Tüm Sayfalar | ⬜ |
| TC-047 | Performans - Yükleme | ⬜ |
| TC-048 | API - Hata Yönetimi | ⬜ |
| TC-049 | Responsive - Mobil | ⬜ |

**Toplam:** 49 test case
**Legend:** ⬜ Yapılmadı · ✅ Geçti · ❌ Başarısız · ⚠️ Kısmen
