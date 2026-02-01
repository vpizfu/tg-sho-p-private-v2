// ---------- Корзина и бейдж ----------

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
  console.log('[cart] updateCartBadge count =', count);
}

function resetCartStateAfterOrder() {
  cartItems = [];
  saveCartToStorage();
  updateCartBadge();

  cartFormState = {
    addressText: '',
    comment: '',
    contactName: '',
    contactPhone: '',
    savedAddressValue: deliveryPrefs.savedAddressValue || '',
    pickupLocationValue: deliveryPrefs.pickupLocation || '',
    contactConfirmed: false,
    contactEditedManually: false
  };

  if (tabScrollTops && typeof tabScrollTops === 'object') {
    tabScrollTops.cart = 0;
  }
}


function addToCart(variant, quantity) {
  console.log('[cart] addToCart', variant, quantity);
  if (!productsData) {
    tg?.showAlert?.('Товары ещё не загружены, попробуйте позже');
    return;
  }

  const freshVariant = productsData.find(p => p.id === variant.id) || variant;

  const existing = cartItems.find(item => item.id === freshVariant.id);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, 100);
  } else {
    const base = {
      id: freshVariant.id,
      name: freshVariant.name,
      price: freshVariant.price,
      cat: freshVariant.cat,
      quantity,
      available: true
    };
    
    if (freshVariant.cat === 'iPhone') {
      base.storage = freshVariant.storage;
      base.color = freshVariant.color;
      base.region = freshVariant.region;
      base.simType = freshVariant.simType;
    } else if (freshVariant.cat === 'Apple Watch') {
      base.diameter = freshVariant.diameter;
      base.caseColor = freshVariant.caseColor;
      base.bandType = freshVariant.bandType;
      base.bandColor = freshVariant.bandColor;
      base.bandSize = freshVariant.bandSize;
      base.region = freshVariant.region;
    } else if (freshVariant.cat === 'MacBook') {
      base.diagonal = freshVariant.diagonal;
      base.color = freshVariant.color;
      base.ram = freshVariant.ram;
      base.ssd = freshVariant.ssd;
    }
    
    cartItems.push(base);    
  }

  saveCartToStorage();
  updateCartBadge();
  tg?.HapticFeedback?.notificationOccurred('success');
}

window.changeCartItemQuantity = function (index, delta) {
  const item = cartItems[index];
  if (!item) return;
  let q = item.quantity + delta;
  if (q < 1) q = 1;
  if (q > 100) q = 100;
  item.quantity = q;
  console.log('[cart] changeCartItemQuantity index=', index, 'quantity=', q);
  saveCartToStorage();
  updateCartBadge();
  if (currentTab === 'cart') {
    showCartTab();
  }
};

window.removeCartItem = function (index) {
  console.log('[cart] removeCartItem index=', index);
  cartItems.splice(index, 1);
  saveCartToStorage();
  updateCartBadge();
  if (currentTab === 'cart') {
    showCartTab();
  }
};

// обновление цены одной позиции
window.updateCartItemPrice = function (index) {
  const item = cartItems[index];
  if (!item || !item.newPrice) return;
  console.log('[cart] updateCartItemPrice index=', index, 'old=', item.price, 'new=', item.newPrice);
  item.price = item.newPrice;
  item.available = true;
  delete item.newPrice;
  saveCartToStorage();
  updateCartBadge();
  if (currentTab === 'cart') {
    showCartTab();
  }
  tg?.showAlert?.('Цена обновлена для выбранного товара');
};

// обновить цены всех и удалить неактуальные
window.refreshCartPricesAndCleanup = async function () {
  console.log('[cart] refreshCartPricesAndCleanup start');
  const btn = document.getElementById('refreshCartButton');
  const loader = document.getElementById('refreshCartLoader');

  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-80', 'cursor-not-allowed');
  }
  if (loader) {
    loader.classList.remove('hidden');
  }

  try {
    try {
      await fetchAndUpdateProducts(false);
    } catch (e) {
      console.error('[cart] refreshCartPricesAndCleanup fetch error', e);
    }

    if (!productsData) {
      tg?.showAlert?.('Товары ещё не загружены, попробуйте позже');
      return;
    }

    let removedCount = 0;
    let changedCount = 0;
    const removedItems = [];
    const changedItems = [];

    cartItems = cartItems.map(item => {
      const fresh = productsData.find(p => p.id === item.id && p.inStock);
      if (!fresh) {
        removedCount++;
        removedItems.push({ ...item });
        return { ...item, available: false, deleted: true };
      }
      if (fresh.price !== item.price) {
        changedCount++;
        changedItems.push({ ...item });
        return { ...item, available: false, newPrice: fresh.price };
      }
      return { ...item, available: true, newPrice: undefined };
    });

    cartItems = cartItems.filter(i => !i.deleted);

    console.log('[cart] refreshCartPricesAndCleanup removed=', removedCount, 'changed=', changedCount);
    saveCartToStorage();
    updateCartBadge();

    if (!removedCount && !changedCount) {
      tg?.showAlert?.('Все товары актуальны');
      return;
    }

    let msgLines = [];

    if (removedItems.length) {
      msgLines.push('❌ Удалены недоступные:');
      removedItems.forEach(i => {
        const subtitle = getCartItemSubtitle(i);
        msgLines.push(
          '- ' +
            i.name +
            (subtitle ? ' (' + subtitle + ')' : '') +
            ', цена была RUB ' +
            i.price
        );
      });
    }

    if (changedItems.length) {
      if (msgLines.length) msgLines.push('');
      msgLines.push('💲 Обновилась цена:');
      changedItems.forEach(i => {
        const subtitle = getCartItemSubtitle(i);
        msgLines.push(
          '- ' +
            i.name +
            (subtitle ? ' (' + subtitle + ')' : '') +
            ': RUB ' +
            i.price + // старая
            ' → RUB ' +
            i.newPrice
        );
      });
      msgLines.push('');
      msgLines.push('У этих товаров появилась кнопка «Обновить цену» в корзине.');
    }
    
    tg?.showAlert?.(msgLines.join('\n'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-80', 'cursor-not-allowed');
    }
    if (loader) {
      loader.classList.add('hidden');
    }
  
    // рисуем корзину только если пользователь всё ещё на вкладке "cart"
    if (currentTab === 'cart') {
      showCartTab();
    }
  }  
};

// ---------- Сохранение/восстановление формы корзины ----------

function saveCartFormState() {
  const deliveryAddress = document.getElementById('deliveryAddress');
  const deliveryComment = document.getElementById('deliveryComment');
  const contactNameEl = document.getElementById('contactName');
  const contactPhoneEl = document.getElementById('contactPhone');
  const savedAddress = document.getElementById('savedAddress');
  const pickupLocationEl = document.getElementById('pickupLocation');
  const contactConfirmedEl = document.getElementById('contactConfirmed');

  cartFormState.addressText = deliveryAddress ? deliveryAddress.value : cartFormState.addressText;
  cartFormState.comment = deliveryComment ? deliveryComment.value : cartFormState.comment;
  cartFormState.contactName = contactNameEl ? contactNameEl.value : cartFormState.contactName;
  cartFormState.contactPhone = contactPhoneEl ? contactPhoneEl.value : cartFormState.contactPhone;
  cartFormState.savedAddressValue = savedAddress
    ? savedAddress.value
    : cartFormState.savedAddressValue;
  cartFormState.pickupLocationValue = pickupLocationEl
    ? pickupLocationEl.value
    : cartFormState.pickupLocationValue;
  cartFormState.contactConfirmed = contactConfirmedEl
    ? contactConfirmedEl.checked
    : cartFormState.contactConfirmed;

  console.log('[cart] saveCartFormState', cartFormState);
}

function restoreCartFormState() {
  const deliveryAddress = document.getElementById('deliveryAddress');
  const deliveryComment = document.getElementById('deliveryComment');
  const contactNameEl = document.getElementById('contactName');
  const contactPhoneEl = document.getElementById('contactPhone');
  const savedAddress = document.getElementById('savedAddress');
  const pickupLocationEl = document.getElementById('pickupLocation');
  const contactConfirmedEl = document.getElementById('contactConfirmed');

  if (deliveryAddress && cartFormState.addressText) {
    deliveryAddress.value = cartFormState.addressText;
  }
  if (deliveryComment && cartFormState.comment) {
    deliveryComment.value = cartFormState.comment;
  }
  if (contactNameEl && cartFormState.contactName) {
    contactNameEl.value = cartFormState.contactName;
  }
  if (contactPhoneEl && cartFormState.contactPhone) {
    contactPhoneEl.value = cartFormState.contactPhone;
  }
  if (savedAddress && cartFormState.savedAddressValue) {
    savedAddress.value = cartFormState.savedAddressValue;
  }
  if (pickupLocationEl && cartFormState.pickupLocationValue) {
    pickupLocationEl.value = cartFormState.pickupLocationValue;
  }
  if (contactConfirmedEl) {
    contactConfirmedEl.checked = !!cartFormState.contactConfirmed;
  }

  console.log('[cart] restoreCartFormState applied');
}

// ---------- Вкладка корзины ----------

window.setPaymentType = function (type) {
  paymentType = type;
  console.log('[cart] setPaymentType', type);
  saveDeliveryPrefs();
  if (currentTab === 'cart') {
    showCartTab();
  }
};

window.setPickupMode = function (mode) {
  pickupMode = !!mode;
  console.log('[cart] setPickupMode', pickupMode);
  saveDeliveryPrefs();
  if (currentTab === 'cart') {
    showCartTab();
  }
};

window.setPickupLocation = function (addr) {
  pickupLocation = addr;
  console.log('[cart] setPickupLocation', pickupLocation);
  saveDeliveryPrefs();
};

window.onSavedAddressChange = function () {
  const select = document.getElementById('savedAddress');
  const wrapper = document.getElementById('deliveryAddressWrapper');
  if (!select || !wrapper) return;
  wrapper.style.display = select.value ? 'none' : 'block';

  cartFormState.savedAddressValue = select.value || '';
  saveDeliveryPrefs();

  console.log('[cart] onSavedAddressChange value=', select.value);
};

function getCartItemSubtitle(item) {
  if (item.cat === 'iPhone') {
    return [item.storage, item.color, item.region].filter(Boolean).join(' | ');
  }
  if (item.cat === 'Apple Watch') {
    return [
      item.diameter,
      item.caseColor,
      item.bandType,
      item.bandColor,
      item.bandSize
    ].filter(Boolean).join(' | ');
  }
  if (item.cat === 'MacBook') {
    return [
      item.diagonal,
      item.ram,
      item.ssd,
      item.color
    ].filter(Boolean).join(' | ');
  }
  return [item.storage, item.color, item.region].filter(Boolean).join(' | ');
}

function showCartTab() {
  console.log('[cart] showCartTab, items=', cartItems.length, 'isPlacingOrder=', isPlacingOrder);
  saveCartFormState();

  if (!cartItems.length) {
    root.innerHTML =
      '<div class="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 pb-[65px]">' +
        '<div class="w-28 h-28 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mb-6">' +
          '<svg class="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
            ' d="M3 4h2l1.5 11h10.5L20 7H7" />' +
          '<circle cx="8" cy="19" r="1.5" stroke-width="2" />' +
          '<circle cx="16" cy="19" r="1.5" stroke-width="2" />' +
        '</svg>' +
        '</div>' +
        '<h2 class="text-2xl font-bold text-gray-800 mb-2">Корзина пуста</h2>' +
        '<p class="text-sm text-gray-500 mb-6 max-w-xs">' +
          'Добавьте устройство в корзину, чтобы оформить заказ.' +
        '</p>' +
        '<button onclick="switchTab(\'shop\')"' +
          ' class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-2xl shadow-lg transition-all">' +
          'Перейти в магазин' +
        '</button>' +
      '</div>';
    return;
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const commission = paymentType === 'card' ? Math.round(subtotal * 0.15) : 0;
  const total = subtotal + commission;

  root.innerHTML =
    '<div class="relative min-h-[100vh] p-6 space-y-6 pb-[80px] max-w-md mx-auto">' +
      '<div class="flex items-center justify-between mb-4">' +
        '<h2 class="text-2xl font-bold text-gray-800">Корзина</h2>' +
        '<button onclick="refreshCartPricesAndCleanup()"' +
          ' class="inline-flex items-center justify-center text-[11px] font-semibold px-2.5 h-8 rounded-full ' +
            'bg-purple-500 hover:bg-purple-600 text-white shadow-md transition-all active:scale-[0.97] max-w-[180px] whitespace-nowrap"' +
          ' id="refreshCartButton">' +
          '<span class="loader-circle hidden mr-1" id="refreshCartLoader"></span>' +
          '<span class="leading-tight">Актуализировать корзину</span>' +
        '</button>' +
      '</div>' +
      '<div class="space-y-3">' +
        cartItems
          .map(
            (item, idx) =>
              '<div class="flex items-center justify-between p-3 rounded-xl border ' +
              (item.available ? 'border-gray-200' : 'border-orange-300 bg-orange-50') +
              '">' +
                '<div class="text-left flex-1 mr-3">' +
                  '<div class="font-semibold text-sm break-words">' +
                    escapeHtml(item.name) +
                  '</div>' +
                 '<div class="text-xs text-gray-500">' +
  escapeHtml(getCartItemSubtitle(item)) +
'</div>' +
                  '<div class="text-xs mt-1 ' +
                    (item.available
                      ? 'text-green-600'
                      : item.newPrice
                      ? 'text-orange-600'
                      : 'text-red-600') +
                  '">' +
                    (item.available
                      ? 'В наличии'
                      : item.newPrice
                      ? 'Цена обновилась: старая RUB ' + item.price + ', новая RUB ' + item.newPrice
                      : 'Товар недоступен, удалите из корзины') +
                  '</div>' +
                '</div>' +
                '<div class="text-right flex flex-col items-end gap-1">' +
                  '<div class="flex items-center justify-end gap-2">' +
                    '<button class="px-2 py-1 rounded-full bg-gray-200 text-sm font-bold"' +
                      ' onclick="changeCartItemQuantity(' +
                      idx +
                      ', -1)">-</button>' +
                    '<span class="min-w-[24px] text-center text-sm font-semibold">' +
                      item.quantity +
                    '</span>' +
                    '<button class="px-2 py-1 rounded-full bg-gray-200 text-sm font-bold"' +
                      ' onclick="changeCartItemQuantity(' +
                      idx +
                      ', 1)">+</button>' +
                  '</div>' +
                  '<div class="text-sm font-bold text-blue-600">RUB ' +
                    item.price * item.quantity +
                  '</div>' +
                  (item.newPrice
                    ? '<button class="text-xs text-blue-500" onclick="updateCartItemPrice(' +
                      idx +
                      ')">Обновить цену</button>'
                    : '') +
                  '<button class="text-xs text-red-500" onclick="removeCartItem(' +
                    idx +
                    ')">Удалить</button>' +
                '</div>' +
              '</div>'
          )
          .join('') +
      '</div>' +
      '<div class="pt-4 border-t space-y-4">' +
        '<div class="space-y-2">' +
          '<h3 class="text-sm font-semibold text-gray-700">Способ оплаты</h3>' +
          '<div class="flex flex-col gap-2">' +
            '<label class="flex items-center gap-2 text-sm">' +
              '<input type="radio" name="paymentType" value="cash"' +
                (paymentType === 'cash' ? ' checked' : '') +
                ' onchange="setPaymentType(\'cash\')">' +
              '<span>Наличными (0%)</span>' +
            '</label>' +
            '<label class="flex items-center gap-2 text-sm">' +
              '<input type="radio" name="paymentType" value="card"' +
                (paymentType === 'card' ? ' checked' : '') +
                ' onchange="setPaymentType(\'card\')">' +
              '<span>Картой (+15%)</span>' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-2">' +
          '<h3 class="text-sm font-semibold text-gray-700">Способ получения</h3>' +
          '<div class="flex flex-col gap-2 mb-2">' +
            '<label class="flex items-center gap-2 text-sm">' +
              '<input type="radio" name="pickupMode" value="delivery"' +
                (!pickupMode ? ' checked' : '') +
                ' onchange="setPickupMode(false)">' +
              '<span>Доставка</span>' +
            '</label>' +
            '<label class="flex items-center gap-2 text-sm">' +
              '<input type="radio" name="pickupMode" value="pickup"' +
                (pickupMode ? ' checked' : '') +
                ' onchange="setPickupMode(true)">' +
              '<span>Самовывоз</span>' +
            '</label>' +
          '</div>' +
          (!pickupMode
            ? '<label class="text-sm font-semibold text-gray-700 block">Адрес доставки</label>' +
              '<select id="savedAddress" class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm mb-2" onchange="onSavedAddressChange()">' +
                '<option value="">Выбрать сохранённый адрес</option>' +
                (savedAddresses || [])
                  .map(
                    addr =>
                      '<option value="' +
                      escapeHtml(addr) +
                      '"' +
                      (cartFormState.savedAddressValue === addr ? ' selected' : '') +
                      '>' +
                      escapeHtml(addr) +
                      '</option>'
                  )
                  .join('') +
              '</select>' +
              '<div id="deliveryAddressWrapper" class="mb-2"' +
                (cartFormState.savedAddressValue ? ' style="display:none"' : '') +
              '>' +
                '<textarea id="deliveryAddress" class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm"' +
                  ' rows="3" placeholder="Введите адрес доставки..."></textarea>' +
              '</div>' +
              '<div class="mt-1">' +
                '<label class="text-sm font-semibold text-gray-700 block mb-1">Комментарий к доставке</label>' +
                '<textarea id="deliveryComment" class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm"' +
                  ' rows="2" placeholder="Например: позвонить за 10 минут, домофон не работает..."></textarea>' +
              '</div>'
            : '<label class="text-sm font-semibold text-gray-700 block">Адрес самовывоза</label>' +
              '<select id="pickupLocation" class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm mb-2"' +
                ' onchange="setPickupLocation(this.value)">' +
                '<option value="">Выберите пункт самовывоза</option>' +
                PICKUP_LOCATIONS.map(
                  addr =>
                    '<option value="' +
                    escapeHtml(addr) +
                    '"' +
                    (pickupLocation === addr ? ' selected' : '') +
                    '>' +
                    escapeHtml(addr) +
                    '</option>'
                ).join('') +
              '</select>' +
              '<div class="mt-1">' +
                '<label class="text-sm font-semibold text-gray-700 block mb-1">Комментарий к заказу</label>' +
                '<textarea id="deliveryComment" class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm"' +
                  ' rows="2" placeholder="Например: приеду к 19:00, позвонить заранее..."></textarea>' +
              '</div>') +
        '</div>' +
        '<div class="space-y-2">' +
          '<label class="text-sm font-semibold text-gray-700 block">Контактные данные</label>' +
          '<input id="contactName" type="text"' +
            ' class="w-full bg-white border border-gray-300 rounded-2xl px-3 py-2 text-sm mb-2 focus:outline-none"' +
            ' placeholder="Имя">' +
          '<input id="contactPhone" type="tel"' +
            ' class="w-full bg-white border border-gray-300 rounded-2xl px-3 py-2 text-sm mb-2 focus:outline-none"' +
            ' placeholder="Телефон для связи">' +
          '<label class="flex items-center gap-2 text-xs text-gray-600">' +
            '<input id="contactConfirmed" type="checkbox">' +
            '<span>Подтверждаю правильность введенных данных</span>' +
          '</label>' +
        '</div>' +
        '<div class="space-y-1 text-sm text-gray-700">' +
          '<div class="flex items-center justify-between">' +
            '<span>Сумма товаров</span>' +
            '<span>RUB ' + subtotal + '</span>' +
          '</div>' +
          (paymentType === 'card'
            ? '<div class="flex items-center justify-between">' +
                '<span>Сервисный сбор (карта)</span>' +
                '<span>+RUB ' + commission + '</span>' +
              '</div>'
            : '') +
          '<div class="flex items-center justify-between font-semibold mt-1">' +
            '<span>Итого к оплате</span>' +
            '<span>RUB ' + total + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="pt-3">' +
          '<button onclick="placeOrder()"' +
            ' id="placeOrderButton"' +
            ' class="w-full flex items-center justify-center gap-2 ' +
              (!cartItems.some(i => !i.available) && !isPlacingOrder
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-gray-400 cursor-not-allowed') +
              ' text-white font-semibold py-2.5 px-6 rounded-2xl shadow-lg transition-all text-sm"' +
            (cartItems.some(i => !i.available) || isPlacingOrder ? ' disabled' : '') +
          '>' +
            (cartItems.some(i => !i.available)
              ? 'Удалите недоступные товары или обновите цены'
              : isPlacingOrder
              ? '<span class="loader-circle"></span><span>Проверяю наличие (до 70 сек)...</span>'
              : 'Оформить заказ') +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  const contactNameEl = document.getElementById('contactName');
  const contactPhoneEl = document.getElementById('contactPhone');
  const contactConfirmedEl = document.getElementById('contactConfirmed');

  restoreCartFormState();

  if (savedProfile && savedProfile.confirmed && !cartFormState.contactEditedManually) {
    if (contactNameEl && savedProfile.name) {
      contactNameEl.value = savedProfile.name;
    }
    if (contactPhoneEl && savedProfile.phone) {
      contactPhoneEl.value = savedProfile.phone;
    }
  }

  if (contactConfirmedEl) {
    contactConfirmedEl.checked = !!cartFormState.contactConfirmed;
  }

  if (contactPhoneEl) {
    contactPhoneEl.addEventListener('focus', () => {
      hideTabBar();
      if (!contactPhoneEl.value.trim()) {
        contactPhoneEl.value = '+7 ';
      }
    });
    contactPhoneEl.addEventListener('blur', showTabBar);
    contactPhoneEl.addEventListener('input', () => {
      cartFormState.contactEditedManually = true;
    });
  }

  if (contactNameEl) {
    contactNameEl.addEventListener('focus', hideTabBar);
    contactNameEl.addEventListener('blur', showTabBar);
    contactNameEl.addEventListener('input', () => {
      cartFormState.contactEditedManually = true;
    });
  }

  ['deliveryAddress', 'deliveryComment'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('focus', hideTabBar);
    el.addEventListener('blur', showTabBar);
  });

  const pickupSelect = document.getElementById('pickupLocation');
  if (pickupSelect) {
    pickupSelect.addEventListener('focus', () => {});
    pickupSelect.addEventListener('blur', showTabBar);
  }

  const savedSelect = document.getElementById('savedAddress');
  if (savedSelect) {
    onSavedAddressChange();
  }

  if (currentTab === 'cart') {
    showTabBar();
  }
}

function setPlaceOrderLoading(loading) {
  const btn = document.getElementById('placeOrderButton');
  if (!btn) return;

  if (loading) {
    btn.disabled = true;
    btn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
    btn.classList.add('bg-gray-400', 'cursor-not-allowed');
    btn.innerHTML =
      '<span class="loader-circle"></span><span>Проверяю наличие (до 70 сек)...</span>';
  } else {
    btn.disabled = cartItems.some(i => !i.available);
    btn.classList.remove('bg-gray-400', 'cursor-not-allowed');
    if (!btn.disabled) {
      btn.classList.add('bg-blue-500', 'hover:bg-blue-600');
      btn.innerHTML = 'Оформить заказ';
    } else {
      btn.innerHTML = 'Удалите недоступные товары или обновите цены';
    }
  }
}

// ---------- Оформление заказа ----------

function scheduleDelayedOrdersSync(reason) {
  console.log('[placeOrder] scheduleDelayedOrdersSync reason=', reason);
  setTimeout(async () => {
    try { 
      console.log('[placeOrder] delayed sync 2min after', reason);
      await fetchUserOrders();
      if (currentTab === 'profile') {
        showProfileTab();
      }
    } catch (e) {
      console.error('[placeOrder] fetchUserOrders delayed error', e);
    }
  }, 120000);
}

window.placeOrder = async function () {
  if (isPlacingOrder) return;

  const orderClickTs = Date.now();
  console.log('[placeOrder] start at', orderClickTs, 'items=', cartItems.length);

  if (cartItems.length === 0) {
    tg?.showAlert?.('Корзина пуста');
    return;
  }

  let address = '';
  if (pickupMode) {
    if (!pickupLocation) {
      tg?.showAlert?.('Выберите пункт самовывоза');
      return;
    }
    address = 'Самовывоз: ' + pickupLocation;
  } else {
    const select = document.getElementById('savedAddress');
    const textarea = document.getElementById('deliveryAddress');
    address = (textarea && textarea.value.trim()) || '';
    if (!address && select && select.value) {
      address = select.value;
    }
    if (!address) {
      tg?.showAlert?.('Введите или выберите адрес доставки');
      return;
    }
  }

  const commentEl = document.getElementById('deliveryComment');
  const deliveryComment = commentEl ? commentEl.value.trim() || '' : '';

  const contactNameEl = document.getElementById('contactName');
  const contactPhoneEl = document.getElementById('contactPhone');

  const rawName = contactNameEl ? contactNameEl.value || '' : '';
  const rawPhone = contactPhoneEl ? contactPhoneEl.value || '' : '';

  const contactConfirmedEl = document.getElementById('contactConfirmed');
  const contactConfirmed = contactConfirmedEl ? contactConfirmedEl.checked : false;

  if (!isValidName(rawName)) {
    tg?.showAlert?.('Введите корректное имя (только буквы, 1–50 символов)');
    return;
  }

  const normalizedPhone = normalizePhone(rawPhone);
  if (!normalizedPhone) {
    tg?.showAlert?.('Введите корректный номер телефона в формате +7XXXXXXXXXX');
    return;
  }

  if (!contactConfirmed) {
    tg?.showAlert?.('Подтвердите правильность введенных данных');
    return;
  }

  const contactName = rawName.trim();
  const contactPhone = normalizedPhone;

  console.log('[placeOrder] address=', address, 'pickupMode=', pickupMode);
  console.log('[placeOrder] comment=', deliveryComment, 'contact=', contactName, contactPhone);

  isPlacingOrder = true;
  setPlaceOrderLoading(true);

  placeOrderTimeoutId = setTimeout(async () => {
    if (!isPlacingOrder) return;
    console.log('[placeOrder] client-side timeout 70s');
    isPlacingOrder = false;

    try {
      await fetchUserOrders();
    } catch (e) {
      console.error('[placeOrder] fetchUserOrders after timeout error', e);
    }

    if (currentTab === 'cart') {
      showCartTab();
    }
    tg?.showAlert?.(
      'Превышено время ожидания ответа сервера. Возможно большая нагрузка и заказ появится в профиле в течении 3 минут. Если не появился проверьте интернет и попробуйте ещё раз (либо сразу можете попробовать повторно оформить заказ)'
    );

    scheduleDelayedOrdersSync('timeout');
  }, 70000);

  try {
    try {
      await fetchAndUpdateProducts(false);
    } catch (e) {
      console.error('[placeOrder] refresh before order failed', e);
    }

    if (!productsData) {
      tg?.showAlert?.('Товары ещё не загружены, попробуйте позже');
      isPlacingOrder = false;
      setPlaceOrderLoading(false);
      return;
    }

    let hasUnavailable = false;
    let hasPriceChanged = false;

    cartItems = cartItems.map(item => {
      const fresh = productsData.find(p => p.id === item.id && p.inStock);
      if (!fresh) {
        hasUnavailable = true;
        return { ...item, available: false };
      }
      if (fresh.price !== item.price) {
        hasPriceChanged = true;
        return { ...item, available: false, newPrice: fresh.price };
      }
      return { ...item, available: true, newPrice: undefined };
    });

    console.log(
      '[placeOrder] after sync products: hasUnavailable=',
      hasUnavailable,
      'hasPriceChanged=',
      hasPriceChanged
    );
    saveCartToStorage();
    updateCartBadge();

    if (hasUnavailable || hasPriceChanged) {
      isPlacingOrder = false;
      setPlaceOrderLoading(false);
      if (hasUnavailable && hasPriceChanged) {
        tg?.showAlert?.(
          'Некоторые товары недоступны, а у других обновилась цена. Проверьте корзину.'
        );
      } else if (hasUnavailable) {
        tg?.showAlert?.('Некоторые товары стали недоступны. Удалите их из корзины.');
      } else {
        tg?.showAlert?.(
          'У некоторых товаров обновилась цена. Нажмите "Обновить" возле позиции.'
        );
      }
      if (currentTab === 'cart') {
        showCartTab();
      }
      return;
    }

    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const commission = paymentType === 'card' ? Math.round(subtotal * 0.15) : 0;
    const total = subtotal + commission;

    // сохраняем контакты в состояние и профиль
    cartFormState.contactName = contactName;
    cartFormState.contactPhone = contactPhone;
    cartFormState.contactConfirmed = contactConfirmed;

    savedProfile = {
      name: contactName,
      phone: contactPhone,
      confirmed: contactConfirmed
    };
    saveProfileToStorage();

    const order = {
      id: Date.now(),
      date: new Date().toISOString(),
      items: cartItems.slice(),
      subtotal,
      commission,
      total,
      address,
      paymentType,
      pickupMode,
      pickupLocation: pickupMode ? pickupLocation : '',
      user: tg?.initDataUnsafe?.user || null,
      clientClickTs: orderClickTs,
      comment: deliveryComment,
      contact: {
        name: contactName,
        phone: contactPhone
      }
    };

    console.log('[placeOrder] order payload', order);

    let resp;
    let text;
    try {
      resp = await fetch(BACKEND_ORDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });

      text = await resp.text();
      console.log('[placeOrder] BACKEND_ORDER_URL status:', resp.status);
      console.log('[placeOrder] BACKEND_ORDER_URL body:', text);
    } catch (e) {
      console.error('[placeOrder] backend order network error', e);
      tg?.showAlert?.('Ошибка сети. Заказ не сохранён, попробуйте ещё раз.');

      scheduleDelayedOrdersSync('network-error');

      isPlacingOrder = false;
      setPlaceOrderLoading(false);
      return;
    }

    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.log('[placeOrder] response is not valid JSON');
    }

    if (!resp.ok || !json || json.ok !== true) {
      console.log('[placeOrder] backend responded with error status:', resp.status, json);
      tg?.showAlert?.('Заказ не сохранён, ошибка сервера, попробуйте ещё раз.');

      scheduleDelayedOrdersSync('server-error');

      isPlacingOrder = false;
      setPlaceOrderLoading(false);
      return;
    }

    try {
      console.log('[placeOrder] fetching orders after success');
      await fetchUserOrders();
    } catch (e) {
      console.error('[placeOrder] fetchUserOrders after success error', e);
    }

    const now = Date.now();
    const durationMs = now - orderClickTs;
    console.log('[perf] placeOrder duration:', durationMs, 'ms');

    tg?.showAlert?.('✅ Заказ оформлен!');
resetCartStateAfterOrder();

isPlacingOrder = false;
if (currentTab === 'cart') {
  showCartTab();
}
  } finally {
    clearTimeout(placeOrderTimeoutId);
    placeOrderTimeoutId = null;
  }
};
