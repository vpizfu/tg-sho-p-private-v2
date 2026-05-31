function showAboutTab() {
  const initialValue = aboutLastProductsMetaText || 'Загрузка...';

  root.innerHTML =
    '<div class="p-6 space-y-6 pb-[65px] max-w-md mx-auto">' +
      '<h2 class="text-2xl font-bold text-gray-800 mb-4">О нас</h2>' +
      '<div class="space-y-4 text-gray-700">' +
        '<p>Магазин премиальной техники Apple с гарантией качества и лучшими ценами.</p>' +

        '<div class="grid grid-cols-2 gap-4 mt-8">' +
          '<div class="text-center p-4 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm ring-1 ring-blue-100/60">' +
            '<div class="text-2xl font-bold text-blue-600">100+</div>' +
            '<div class="text-sm text-gray-600 mt-1">товаров</div>' +
          '</div>' +
          '<div class="text-center p-4 bg-green-50 rounded-2xl border border-green-100 shadow-sm ring-1 ring-green-100/60">' +
            '<div class="text-2xl font-bold text-green-600">24/7</div>' +
            '<div class="text-sm text-gray-600 mt-1">поддержка</div>' +
          '</div>' +
        '</div>' +

        '<div id="pricesUpdatedCard" class="mt-2 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">' +
          '<div class="text-sm text-gray-500">Цены обновлены</div>' +
          '<div id="pricesUpdatedValue" class="text-base font-semibold text-gray-800 mt-1">' + initialValue + '</div>' +
          '<div class="text-xs text-gray-400 mt-1">Время по МСК</div>' +
        '</div>' +

        '<div class="mt-2 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">' +
          '<div class="text-sm text-gray-500">Время работы</div>' +
          '<div class="text-base font-semibold text-gray-800 mt-1">10:00 – 20:00</div>' +
          '<div class="text-xs text-gray-400 mt-1">По МСК</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}