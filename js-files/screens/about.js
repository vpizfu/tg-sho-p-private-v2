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
    dateKey: `${map.year}-${map.month}-${map.day}`
  };
}

function parseMetaDateToDate(metaText) {
  if (!metaText) return null;

  const str = String(metaText).trim();
  if (!str || str === 'Загрузка...') return null;

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

function getPriceStatus(metaText) {
  const updatedDate = parseMetaDateToDate(metaText);

  if (!updatedDate) {
    return null;
  }

  const nowMsk = getMoscowParts(new Date());
  const updatedMsk = getMoscowParts(updatedDate);

  const isTodayMsk = updatedMsk.dateKey === nowMsk.dateKey;
  const isBefore20 = nowMsk.hour < 20;

  if (isTodayMsk && isBefore20) {
    return {
      text: 'Цены актуальны',
      classes: 'text-xs mt-2 font-medium text-green-600'
    };
  }

  if (!isTodayMsk && isBefore20) {
    return {
      text: 'Ждут обновления сегодня',
      classes: 'text-xs mt-2 font-medium text-amber-600'
    };
  }

  return {
    text: 'Цены неактуальны',
    classes: 'text-xs mt-2 font-medium text-red-500'
  };
}

function updateAboutPricesMeta() {
  const valueEl = document.getElementById('pricesUpdatedValue');
  const statusEl = document.getElementById('pricesUpdatedStatus');

  if (!valueEl || !statusEl) return;

  const value = aboutLastProductsMetaText || 'Загрузка...';
  valueEl.textContent = value;

  const status = getPriceStatus(value);

  if (!status) {
    statusEl.className = 'hidden';
    statusEl.textContent = '';
    return;
  }

  statusEl.className = status.classes;
  statusEl.textContent = status.text;
}

function setAboutLastProductsMetaText(value) {
  aboutLastProductsMetaText = value || 'Загрузка...';
  updateAboutPricesMeta();
}

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
          '<div id="pricesUpdatedStatus" class="hidden"></div>' +
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

  updateAboutPricesMeta();
}