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
      type: 'actual',
      text: 'Цены актуальны',
      classes: 'text-xs mt-2 font-medium text-green-600'
    };
  }

  if (!isTodayMsk && isBefore20) {
    return {
      type: 'pending',
      text: 'Ожидается обновление цен сегодня',
      classes: 'text-xs mt-2 font-medium text-amber-600'
    };
  }

  return {
    type: 'tomorrow',
    text: 'Ожидается обновление цен завтра',
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

function openAboutPhone() {
  const phoneHref = 'tel:+79160171261';

  if (window.Telegram && window.Telegram.WebApp) {
    try {
      window.open(phoneHref, '_blank');
      return;
    } catch (error) {
      copyAboutPhone();
      return;
    }
  }

  window.location.href = phoneHref;
}

function copyAboutPhone() {
  const phone = '+79160171261';

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(phone).then(function () {
      showAboutPhoneCopyState('Номер скопирован');
    }).catch(function () {
      fallbackCopyAboutPhone(phone);
    });
    return;
  }

  fallbackCopyAboutPhone(phone);
}

function fallbackCopyAboutPhone(phone) {
  const textarea = document.createElement('textarea');
  textarea.value = phone;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.left = '-1000px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand('copy');
    showAboutPhoneCopyState('Номер скопирован');
  } catch (error) {
    showAboutPhoneCopyState('Скопируйте номер вручную');
  }

  document.body.removeChild(textarea);
}

function showAboutPhoneCopyState(text) {
  const copyStateEl = document.getElementById('aboutPhoneCopyState');
  if (!copyStateEl) return;

  copyStateEl.textContent = text;
  copyStateEl.className = 'text-xs mt-2 font-medium text-green-600';

  clearTimeout(showAboutPhoneCopyState._timer);

  showAboutPhoneCopyState._timer = setTimeout(function () {
    const el = document.getElementById('aboutPhoneCopyState');
    if (!el) return;
    el.textContent = '';
    el.className = 'hidden';
  }, 2500);
}

function openAboutTelegram() {
  const telegramUrl = 'https://t.me/TechBex';

  if (
    window.Telegram &&
    window.Telegram.WebApp &&
    typeof window.Telegram.WebApp.openTelegramLink === 'function'
  ) {
    try {
      window.Telegram.WebApp.openTelegramLink(telegramUrl);
      return;
    } catch (error) {}
  }

  window.open(telegramUrl, '_blank', 'noopener,noreferrer');
}

function bindAboutActions() {
  const phoneLink = document.getElementById('aboutPhoneLink');
  const phoneCopyBtn = document.getElementById('aboutPhoneCopyBtn');
  const telegramLink = document.getElementById('aboutTelegramLink');

  if (phoneLink) {
    phoneLink.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      openAboutPhone();
      return false;
    };
  }

  if (phoneCopyBtn) {
    phoneCopyBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      copyAboutPhone();
      return false;
    };
  }

  if (telegramLink) {
    telegramLink.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      openAboutTelegram();
      return false;
    };
  }
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
          '<div class="text-sm text-gray-500">Контакты</div>' +

          '<div class="mt-3">' +
            '<div class="text-xs text-gray-400">Телефон</div>' +
            '<a href="tel:+79160171261" id="aboutPhoneLink" class="block text-base font-semibold text-gray-800 hover:text-blue-600 transition-colors">+7 916 017-12-61</a>' +
            '<button id="aboutPhoneCopyBtn" type="button" class="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">Скопировать номер</button>' +
            '<div id="aboutPhoneCopyState" class="hidden"></div>' +
          '</div>' +

          '<div class="mt-3">' +
            '<div class="text-xs text-gray-400">Telegram</div>' +
            '<a href="https://t.me/TechBex" id="aboutTelegramLink" target="_blank" rel="noopener noreferrer" class="block text-base font-semibold text-gray-800 hover:text-blue-600 transition-colors">@TechBex</a>' +
          '</div>' +

          '<div class="mt-3">' +
            '<div class="text-xs text-gray-400">ИП</div>' +
            '<div class="block text-base font-semibold text-gray-800">Руль Елизавета Николаевна</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  updateAboutPricesMeta();
  bindAboutActions();
}