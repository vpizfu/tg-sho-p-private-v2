function renderProfileSkeleton() {
  root.innerHTML =
    '<div class="p-6 space-y-6 pb-[65px] max-w-md mx-auto bg-gray-50">' +
      '<div class="flex items-center gap-4">' +
        '<div class="w-16 h-16 bg-gray-200 rounded-2xl placeholder-shimmer"></div>' +
        '<div class="flex-1 space-y-2">' +
          '<div class="h-4 w-24 bg-gray-200 rounded placeholder-shimmer"></div>' +
          '<div class="h-3 w-40 bg-gray-200 rounded placeholder-shimmer"></div>' +
        '</div>' +
      '</div>' +
      '<div class="space-y-3">' +
        '<div class="h-4 w-32 bg-gray-200 rounded placeholder-shimmer"></div>' +
        '<div class="space-y-2">' +
          Array.from({ length: 3 }).map(() =>
            '<div class="h-10 w-full bg-white border border-gray-200 rounded-2xl flex items-center px-3">' +
              '<div class="h-3 w-3/4 bg-gray-200 rounded placeholder-shimmer"></div>' +
            '</div>'
          ).join('') +
        '</div>' +
      '</div>' +
      '<div class="space-y-3">' +
        '<div class="h-4 w-40 bg-gray-200 rounded placeholder-shimmer"></div>' +
        Array.from({ length: 3 }).map(() =>
          '<div class="bg-white border border-gray-200 rounded-2xl p-3 space-y-2">' +
            '<div class="h-3 w-1/2 bg-gray-200 rounded placeholder-shimmer"></div>' +
            '<div class="h-3 w-1/3 bg-gray-200 rounded placeholder-shimmer"></div>' +
            '<div class="h-3 w-1/4 bg-gray-200 rounded placeholder-shimmer"></div>' +
          '</div>'
        ).join('') +
      '</div>' +
    '</div>';
}

window.toggleOrderDetails = function (index) {
  const block = document.getElementById('orderDetails_' + index);
  if (!block) return;
  block.classList.toggle('hidden');
};

// --- НОВАЯ ФУНКЦИЯ ДЛЯ СЕКЦИИ ЗАКАЗОВ ---

function renderOrdersSection() {
  const container = document.getElementById('ordersSectionContent');
  if (!container) return;

  if (isOrdersLoading && previousOrders.length === 0) {
    container.innerHTML =
      '<p class="text-xs text-gray-400">Загружаем историю заказов...</p>';
    return;
  }

  if (!previousOrders.length) {
    container.innerHTML =
      '<p class="text-sm text-gray-500">Заказов пока нет</p>';
    return;
  }

  const ordersHtml = previousOrders
    .map(
      (o, idx) =>
        '<div class="mb-3 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">' +
          '<button type="button" class="w-full text-left px-3 py-2 flex items-center justify-between" onclick="toggleOrderDetails(' +
            idx +
          ')">' +
            '<div class="flex flex-col min-w-0 mr-2">' +
              '<span class="text-sm font-semibold text-gray-800 truncate">Заказ #' +
                o.id +
              '</span>' +
              '<span class="text-[11px] text-gray-500">' +
                new Date(o.date).toLocaleString() +
              '</span>' +
            '</div>' +
            '<span class="text-sm font-bold text-blue-600 whitespace-nowrap">RUB ' +
              formatPrice(o.total) +
            '</span>' +
          '</button>' +
          '<div class="px-3 pb-2 border-t border-gray-100 text-xs text-gray-600">' +
            '<div class="mt-1 break-words">Адрес: ' +
              escapeHtml(o.address) +
            '</div>' +
            (o.comment
              ? '<div class="mt-1 break-words text-gray-500">Комментарий: ' +
                  escapeHtml(o.comment) +
                '</div>'
              : '') +
            (o.contact && (o.contact.name || o.contact.phone)
              ? '<div class="mt-1 break-words">Контакт: ' +
                  (o.contact.name ? escapeHtml(o.contact.name) : '') +
                  (o.contact.name && o.contact.phone ? ', ' : '') +
                  (o.contact.phone ? escapeHtml(o.contact.phone) : '') +
                '</div>'
              : '') +
            '<div class="mt-1 text-gray-500">Товаров: ' +
              o.items.reduce((sum, item) => sum + (item.quantity || 0), 0) +
            '</div>' +
            '<div id="orderDetails_' +
              idx +
            '" class="hidden mt-2 pt-2 border-t border-dashed border-gray-200">' +
            o.items
            .map(
              item =>
                '<div class="flex items-center justify-between mb-1 gap-2">' +
                  '<div class="flex-1 min-w-0">' +
                    '<div class="font-semibold text-[11px] break-words">' +
                      escapeHtml(item.name) +
                    '</div>' +
                    '<div class="text-[10px] text-gray-500 break-words">' +
                      escapeHtml(getCartItemSubtitle(item)) +
                    '</div>' +
                  '</div>' +
                  '<div class="text-right text-[10px] whitespace-nowrap">' +
                    '<div>' + item.quantity + ' шт.</div>' +
                    '<div>RUB ' + formatPrice(item.price * item.quantity) + '</div>' +
                  '</div>' +
                '</div>'
            )
            .join('') +          
            '</div>' +
          '</div>' +
        '</div>'
    )
    .join('');

  container.innerHTML = ordersHtml;
}

// --- ОБНОВЛЁННЫЙ showProfileTab ---

function showProfileTab() {
  console.log('isOrdersLoading on renderProfile', isOrdersLoading);

  const user = tg?.initDataUnsafe?.user;
  const username = user?.username || 'неизвестно';
  const displayId = '@' + username;

  const addressesHtml = savedAddresses.length
    ? savedAddresses
        .map(
          (addr, idx) =>
            '<div class="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-2xl mb-1">' +
              '<span class="flex-1 text-xs text-gray-700 break-words">' +
                escapeHtml(addr) +
              '</span>' +
              '<button class="text-xs text-red-500 shrink-0" onclick="removeAddress(\'' + escapeHtml(addr) + '\')">Удалить</button>' +
            '</div>'
        )
        .join('')
    : '<p class="text-sm text-gray-500">Сохранённых адресов нет</p>';

  root.innerHTML =
    '<div class="p-6 space-y-6 pb-[65px] max-w-md mx-auto bg-gray-50">' +
      // хедер профиля + хинт про заказы
      '<div class="flex items-start gap-4">' +
        '<div class="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shrink-0">' +
          '<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
            ' d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>' +
          '</svg>' +
        '</div>' +
        '<div class="flex flex-col min-w-0 flex-1">' +
          '<div class="flex items-start justify-between gap-2">' +
            '<div class="min-w-0">' +
              '<h2 class="text-xl font-bold leading-tight text-gray-900">Профиль</h2>' +
              '<p class="text-gray-500 text-sm mt-1 break-all">ID: ' +
                escapeHtml(displayId) +
              '</p>' +
            '</div>' +
            '<button type="button"' +
              ' class="text-[11px] font-semibold text-blue-600 px-2 py-1 rounded-full bg-blue-50 border border-blue-100 shrink-0"' +
              ' onclick="scrollToOrdersSection()">' +
              'Заказы' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // контакты по умолчанию
      '<div class="space-y-3">' +
        '<h3 class="text-lg font-semibold text-gray-800">Контактые данные</h3>' +
        '<div class="space-y-2 bg-white border border-gray-200 rounded-2xl p-3">' +
          '<input id="profileName" type="text"' +
            ' class="w-full bg-white border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:outline-none"' +
            ' placeholder="Имя для заказа">' +
          '<input id="profilePhone" type="tel"' +
            ' class="w-full bg-white border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:outline-none mt-2"' +
            ' placeholder="Телефон для связи">' +
          '<button class="w-full mt-3 bg-gray-900 hover:bg-black text-white font-semibold py-2.5 px-4 rounded-2xl shadow-lg text-sm"' +
            ' onclick="saveProfileContacts()">' +
            'Сохранить контакты' +
          '</button>' +
        '</div>' +
      '</div>' +

      // сохранённые адреса
      '<div class="space-y-3">' +
        '<h3 class="text-lg font-semibold text-gray-800">Сохранённые адреса</h3>' +
        '<div id="addressesList">' +
          addressesHtml +
        '</div>' +
        '<div class="space-y-2 bg-white border border-gray-200 rounded-2xl p-3">' +
          '<textarea id="newAddress" class="w-full bg-white border border-gray-300 rounded-2xl px-3 py-2 text-sm resize-none"' +
            ' rows="2" placeholder="Новый адрес..."></textarea>' +
          '<button class="w-full bg-gray-900 hover:bg-black text-white font-semibold py-2.5 px-4 rounded-2xl shadow-lg  text-sm"' +
            ' onclick="addAddress()">' +
            'Сохранить адрес' +
          '</button>' +
        '</div>' +
      '</div>' +

      // заказы
      '<div class="space-y-3" id="ordersSection">' +
        '<h3 class="text-lg font-semibold text-gray-800">История заказов</h3>' +
        '<div id="ordersSectionContent"></div>' +
      '</div>' +
    '</div>';

  // сразу отрисуем секцию заказов (либо "грузим", либо список/пусто)
  renderOrdersSection();

  // заполнение полей контактов из savedProfile
  const profileNameEl = document.getElementById('profileName');
  const profilePhoneEl = document.getElementById('profilePhone');

  if (profileNameEl) profileNameEl.value = savedProfile.name || '';
  if (profilePhoneEl) profilePhoneEl.value = savedProfile.phone || '';

  if (profileNameEl) {
    profileNameEl.addEventListener('focus', hideTabBar);
    profileNameEl.addEventListener('blur', showTabBar);
  }
  if (profilePhoneEl) {
    profilePhoneEl.addEventListener('focus', () => {
      hideTabBar();
      if (!profilePhoneEl.value.trim()) {
        profilePhoneEl.value = '+7 ';
      }
    });
    profilePhoneEl.addEventListener('blur', showTabBar);
  }  

  const newAddressEl = document.getElementById('newAddress');
  if (newAddressEl) {
    newAddressEl.addEventListener('focus', hideTabBar);
    newAddressEl.addEventListener('blur', showTabBar);
  }
}

window.addAddress = function () {
  const ta = document.getElementById('newAddress');
  if (!ta) return;
  const val = ta.value.trim();
  if (!val) {
    tg?.showAlert?.('Введите адрес');
    return;
  }
  if (savedAddresses.includes(val)) {
    tg?.showAlert?.('Этот адрес уже сохранён');
    return;
  }
  savedAddresses.push(val);
  saveAddressesToStorage();
  ta.value = '';
  if (currentTab === 'profile') {
    showProfileTab();
  }
};

window.removeAddress = function (addr) {
  const addrStr = String(addr);
  savedAddresses = savedAddresses.filter(a => a !== addrStr);
  saveAddressesToStorage();

  // 🔥 Если выбранный адрес совпадает с удалённым — сбрасываем
  if (deliveryPrefs && deliveryPrefs.savedAddressValue === addrStr) {
    deliveryPrefs.savedAddressValue = '';
  }
  if (cartFormState && cartFormState.savedAddressValue === addrStr) {
    cartFormState.savedAddressValue = '';
  }
  saveDeliveryPrefs();

  if (currentTab === 'profile') showProfileTab();
};

window.saveProfileContacts = function () {
  const nameEl = document.getElementById('profileName');
  const phoneEl = document.getElementById('profilePhone');
  if (!nameEl || !phoneEl) return;

  const rawName = nameEl.value || '';
  const rawPhone = phoneEl.value || '';

  if (!isValidName(rawName)) {
    tg?.showAlert?.('Введите корректное имя (только буквы, 1–50 символов)');
    return;
  }

  const normalizedPhone = normalizePhone(rawPhone);
  if (!normalizedPhone) {
    tg?.showAlert?.('Введите корректный номер телефона в формате +7XXXXXXXXXX');
    return;
  }

  const name = rawName.trim();

  savedProfile = { name, phone: normalizedPhone, confirmed: true };
  saveProfileToStorage();

  // сразу показать нормализованный телефон
  phoneEl.value = normalizedPhone;

  tg?.showAlert?.('Контакты сохранены');
};

window.scrollToOrdersSection = function () {
  try {
    const section = document.getElementById('ordersSection');
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    console.error('[profile] scrollToOrdersSection error', e);
  }
};
