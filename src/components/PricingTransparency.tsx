export default function PricingTransparency() {
  return (
    <section className="py-16 bg-[#F9FAFB]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Şeffaf Fiyatlandırma</p>
          <h2 className="text-2xl font-bold text-gray-900">Ne Kadar Ödersiniz?</h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">

          {/* Card 1 — Pet Owners */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="text-base font-bold text-gray-900 mb-4">🐾 Hayvan Sahipleri İçin</p>
            <ul className="space-y-3 mb-5">
              {[
                "Platforma üyelik — Ücretsiz",
                "Veteriner arama — Ücretsiz",
                "Randevu alma — Ücretsiz",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <span className="text-[#166534] font-bold shrink-0">✅</span>
                  {item}
                </li>
              ))}
              <li className="flex items-start gap-2.5 text-sm text-gray-700">
                <span className="shrink-0">💳</span>
                Muayene ücreti veteriner hekime ödenir
              </li>
            </ul>
            <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
              Platform muayene ücretlerinden pay almaz.
            </p>
          </div>

          {/* Card 2 — Vets */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="text-base font-bold text-gray-900 mb-4">🏥 Veteriner Hekimler İçin</p>
            <ul className="space-y-3 mb-5">
              {[
                "Platform üyeliği — Beta'da Ücretsiz",
                "Randevu yönetimi — Ücretsiz",
                "Hasta takip sistemi — Ücretsiz",
                "Kredi kartı gerekmez",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <span className="text-[#166534] font-bold shrink-0">✅</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
              Ücretli döneme geçişte önceden bilgilendirme yapılır.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}
