function showAboutTab() {
  const initialValue = aboutLastProductsMetaText || 'Загрузка...';

  function getMoscowParts(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });

    const parts = formatter.formatToParts(date);
    const map = {};

    for (const part of parts) {
      if (part.type !== 'literal') map[part.type] = part.value;
    }

    return {
      year: map.year,
      month: map.month,
      day: map.day,
      hour: Number(map.hour),
      minute: Number(map.minute),
      second: Number(map.second),
      dateKey: `${map.year}-${map.month}-${map.day}`,
      timeLabel: `${map.hour}:${map.minute}`
    };
  }

  function parseMetaDateToDate(metaText) {
    if (!metaText) return null;

    const str = String(metaText).trim();

    const isoDate = new Date(str);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate;
    }

    const m = str.match(
      /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:\D+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
    );

    if (!m) return null;

    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    const hh = String(m[4] || '00').padStart(2, '0');
    const min = String(m[5] || '00').padStart(2, '0');
    const ss = String(m[6] || '00').padStart(2, '0');

    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+03:00`);
  }

  function getPriceStatusText(metaText) {
    const updatedDate = parseMetaDateToDate(metaText);
    if (!updatedDate) {
      return 'Ожидается сегодняшнее обновление';
    }

    const nowMsk = getMoscowParts(new Date());
    const updatedMsk = getMoscowParts(updatedDate);

    const isTodayMsk = updatedMsk.dateKey === nowMsk.dateKey;
    const isBefore20 = nowMsk.hour < 20;

    if (!isTodayMsk) {
      return 'Цены неактуальны — нужно ждать сегодняшнего обновления';
    }

    if (isBefore20) {
      return 'Цены актуальны';
    }

    return 'Цены неактуальны — ожидается следующее обновление';
  }

  const priceStatusText = getPriceStatusText(aboutLastProductsMetaText);
  const priceStatusIsActual = priceStatusText === 'Цены актуальны';

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

        '<div class="mt-2 p-4 rounded-2xl border shadow-sm ' + (priceStatusIsActual ? 'bg-green-50 border-green-100 ring-1 ring-green-100/60' : 'bg-amber-50 border-amber-100 ring-1 ring-amber-100/60') + '">' +
          '<div class="text-sm ' + (priceStatusIsActual ? 'text-green-700' : 'text-amber-700') + '">Статус цен</div>' +
          '<div class="text-base font-semibold mt-1 ' + (priceStatusIsActual ? 'text-green-800' : 'text-amber-800') + '">' + priceStatusText + '</div>' +
          '<div class="text-xs mt-1 ' + (priceStatusIsActual ? 'text-green-600' : 'text-amber-600') + '">Статус рассчитывается по времени МСК</div>' +
        '</div>' +

        '<div class="mt-2 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">' +
          '<div class="text-sm text-gray-500">Время работы</div>' +
          '<div class="text-base font-semibold text-gray-800 mt-1">10:00 – 20:00</div>' +
          '<div class="text-xs text-gray-400 mt-1">По МСК</div>' +
        '</div>' +

        '<div class="mt-2 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">' +
          '<div class="text-sm text-gray-500">Номер телефона для связи</div>' +
          '<a href="tel:+79160171261" class="block text-base font-semibold text-gray-800 mt-1 hover:text-blue-600 transition-colors">+7 916 017-12-61</a>' +
        '</div>' +
      '</div>' +
    '</div>';
}