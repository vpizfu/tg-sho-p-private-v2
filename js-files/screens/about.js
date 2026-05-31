async function showAboutTab() {
  root.innerHTML =
    '<div class="p-6 space-y-6 pb-[65px] max-w-md mx-auto">' +
      '<h2 class="text-2xl font-bold text-gray-800 mb-4">О нас</h2>' +
      '<div class="space-y-4 text-gray-700">' +
        '<p>Магазин премиальной техники Apple с гарантией качества и лучшими ценами.</p>' +
        '<div class="grid grid-cols-2 gap-4 mt-8">' +
          '<div class="text-center p-4 bg-blue-50 rounded-xl">' +
            '<div class="text-2xl font-bold text-blue-600">100+</div>' +
            '<div class="text-sm text-gray-600">товаров</div>' +
          '</div>' +
          '<div class="text-center p-4 bg-green-50 rounded-xl">' +
            '<div class="text-2xl font-bold text-green-600">24/7</div>' +
            '<div class="text-sm text-gray-600">поддержка</div>' +
          '</div>' +
        '</div>' +
        '<div id="pricesUpdatedCard" class="mt-2 p-4 bg-white rounded-2xl shadow">' +
          '<div class="text-sm text-gray-500">Цены обновлены</div>' +
          '<div id="pricesUpdatedValue" class="text-base font-semibold text-gray-800 mt-1">Загрузка...</div>' +
          '<div class="text-xs text-gray-400 mt-1">Время по МСК</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  const valueEl = document.getElementById('pricesUpdatedValue');
  if (!valueEl) {
    return;
  }

  try {
    const meta = await fetchProductsMeta();

    if (currentTab !== 'about') {
      return;
    }

    valueEl.textContent = formatProductsUpdatedMsk(meta);
  } catch (err) {
    console.error('[about] products meta load error', err);

    if (currentTab !== 'about') {
      return;
    }

    valueEl.textContent = 'Нет данных';
  }
}