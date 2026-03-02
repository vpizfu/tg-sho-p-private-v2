// ---------- Корзина и бейдж ----------
let currentOrderId = null;
let hasCheckoutResultForCurrent = false;
let lastOrderTotal = 0;

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

// Поля исключённые из ключа корзины — нестабильные или служебные
const CART_KEY_EXCLUDE = new Set([
  'id', 'Артикул', 'Цена', 'Входная цена', 'Наценка',
  'inStock', 'Статус', 'Общая картинка', 'Изображения', 'images',
  'cat', 'Категория'
]);

function buildCartKey(product) {
  const entries = Object.keys(product)
    .filter(k => !CART_KEY_EXCLUDE.has(k))
    .sort()
    .map(k => k + '=' + String(product[k] ?? '').trim().toLowerCase());

  const raw = entries.join('||');

  // djb2 хэш — работает без crypto API
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash = hash >>> 0;
  }
  return 'ck_' + hash.toString(36);
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
    tg?.showAlert?.('Товары ещё не загружены, попробуйте позже.\nДля заказа через менеджера напишите @TechBex.');
    return;
  }

  const freshVariant = productsData.find(p => p.id === variant.id) || variant;
  const cartKey = buildCartKey(freshVariant);

  const existing = cartItems.find(item => item.cartKey === cartKey);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, 100);
  } else {
    cartItems.push({
      cartKey,
      name:     freshVariant['Название'],
      price:    freshVariant['Цена'],
      cat:      freshVariant.cat || '',
      quantity,
      available: true,
      options: Object.fromEntries(
        Object.keys(freshVariant)
          .filter(k => !CART_KEY_EXCLUDE.has(k))
          .map(k => [k, freshVariant[k]])
      )
    });
  }

  saveCartToStorage();
  updateCartBadge();

  try {
    if (typeof trackAddToCart === 'function') {
      const cartItem = cartItems.find(i => i.cartKey === cartKey);
      if (cartItem) {
        trackAddToCart(cartItem);
      }
    }
  } catch (e2) {}

  tg?.HapticFeedback?.notificationOccurred('success');
}

window.changeCartItemQuantity = function (cartKey, delta) {
  const item = cartItems.find(i => i.cartKey === cartKey);
  if (!item) return;
  const oldQuantity = item.quantity;
  let q = item.quantity + delta;
  if (q < 1) q = 1;
  if (q > 100) q = 100;
  item.quantity = q;
  console.log('[cart] changeCartItemQuantity cartKey=', cartKey, 'quantity=', q);

  try {
    if (typeof trackCartQuantityChange === 'function') {
      trackCartQuantityChange(item, q);
    }
  } catch (e2) {}

  saveCartToStorage();
  updateCartBadge();
  if (currentTab === 'cart') {
    showCartTab();
  }
};

window.removeCartItem = function (cartKey) {
  console.log('[cart] removeCartItem cartKey=', cartKey);
  const item = cartItems.find(i => i.cartKey === cartKey);
  try {
    if (item && typeof trackRemoveFromCart === 'function') {
      trackRemoveFromCart(item);
    }
  } catch (e2) {}
  cartItems = cartItems.filter(i => i.cartKey !== cartKey);
  saveCartToStorage();
  updateCartBadge();
  if (currentTab === 'cart') {
    showCartTab();
  }
};

// обновление цены одной позиции
window.updateCartItemPrice = function (cartKey) {
  const item = cartItems.find(i => i.cartKey === cartKey);
  if (!item || !item.newPrice) return;
  console.log('[cart] updateCartItemPrice cartKey=', cartKey, 'old=', item.price, 'new=', item.newPrice);
  try {
    if (typeof trackEvent === 'function') {
      trackEvent('cart_item_price_updated', {
        product_name: item.name || '',
        cart_key: item.cartKey || ''
      });
    }
  } catch (e) {}
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
  try {
    if (typeof trackEvent === 'function') {
      trackEvent('cart_refresh_clicked', {
        items_count: cartItems.length
      });
    }
  } catch (e) {}
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
      tg?.showAlert?.('Товары ещё не загружены, попробуйте позже.\nДля заказа через менеджера напишите @TechBex.');
      return;
    }

    let removedCount = 0;
    let changedCount = 0;
    const removedItems = [];
    const changedItems = [];

    const productByKey = new Map(
      productsData.filter(p => p.inStock).map(p => [buildCartKey(p), p])
    );
    
    cartItems = cartItems.map(item => {
      const fresh = productByKey.get(item.cartKey);
    
      if (!fresh) {
        removedCount++;
        removedItems.push({ ...item });
        return { ...item, available: false, deleted: true };
      }
    
      const freshPrice = Number(fresh['Цена']);
      const oldPrice   = Number(item.price);
    
      if (!Number.isFinite(freshPrice) || freshPrice <= 0) {
        removedCount++;
        removedItems.push({ ...item });
        return { ...item, available: false, deleted: true };
      }
    
      if (freshPrice !== oldPrice) {
        changedCount++;
        changedItems.push({ ...item, newPrice: freshPrice });
        return { ...item, available: false, newPrice: freshPrice, deleted: false };
      }
    
      return { ...item, available: true, newPrice: undefined, deleted: false };
    });    

    cartItems = cartItems.filter(i => !i.deleted);

    console.log('[cart] refreshCartPricesAndCleanup removed=', removedCount, 'changed=', changedCount);
    saveCartToStorage();
    updateCartBadge();

    if (!removedCount && !changedCount) {
      // если прямо сейчас идёт оформление заказа — не спамим
      if (!isPlacingOrder) {
        tg?.showAlert?.('Все товары актуальны');
      }
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
            formatPrice(i.price)
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
            formatPrice(i.price) + // старая
            ' → RUB ' +
            formatPrice(i.newPrice) // старая
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

  if (deliveryAddress) {
    deliveryAddress.value = cartFormState.addressText || '';
  }
  if (deliveryComment) {
    deliveryComment.value = cartFormState.comment || '';
  }
  if (contactNameEl) {
    contactNameEl.value = cartFormState.contactName || '';
  }
  if (contactPhoneEl) {
    contactPhoneEl.value = cartFormState.contactPhone || '';
  }
  if (savedAddress) {
    const opts = Array.from(savedAddress.options).map(o => o.value);
    const candidate = cartFormState.savedAddressValue || '';
    savedAddress.value = opts.includes(candidate) ? candidate : '';
  }
  if (pickupLocationEl) {
    pickupLocationEl.value = cartFormState.pickupLocationValue || '';
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
  try {
    if (typeof trackEvent === 'function') {
      trackEvent('setPaymentType', {});
    }
  } catch (e) {}
  saveDeliveryPrefs();
  if (currentTab === 'cart') {
    showCartTab();
  }
};

window.setPickupMode = function (mode) {
  pickupMode = !!mode;
  console.log('[cart] setPickupMode', pickupMode);
  try {
    if (typeof trackEvent === 'function') {
      trackEvent('setPickupMode', {});
    }
  } catch (e) {}
  saveDeliveryPrefs();
  if (currentTab === 'cart') {
    showCartTab();
  }
};

window.setPickupLocation = function (addr) {
  pickupLocation = addr;
  console.log('[cart] setPickupLocation', pickupLocation);
  try {
    if (typeof trackEvent === 'function') {
      trackEvent('setPickupLocation', {});
    }
  } catch (e) {}
  saveDeliveryPrefs();
};

window.onSavedAddressChange = function () {
  const select = document.getElementById('savedAddress');
  const wrapper = document.getElementById('deliveryAddressWrapper');
  if (!select || !wrapper) return;
  if (select.value) {
    wrapper.style.display = 'block';
    const ta = document.getElementById('deliveryAddress');
    if (ta) {
      ta.value = select.value;
      ta.readOnly = true;
    }
  } else {
    wrapper.style.display = 'block';
    const ta = document.getElementById('deliveryAddress');
    if (ta) {
      ta.readOnly = false;
      ta.value = cartFormState.addressText || '';
    }
  }  

  cartFormState.savedAddressValue = select.value || '';
  saveDeliveryPrefs();

  console.log('[cart] onSavedAddressChange value=', select.value);
};

function getCartItemSubtitle(item) {
  if (!item.options || typeof item.options !== 'object') return '';
  return Object.values(item.options)
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
    .join(' | ');
}

function showCartTab() {
  console.log('[cart] showCartTab, items=', cartItems.length, 'isPlacingOrder=', isPlacingOrder);
  saveCartFormState();

  if (!cartItems.length) {
    root.innerHTML =
      '<div class="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 pb-[65px] max-w-md mx-auto">' +
        '<div class="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mb-6">' +
          '<svg class="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
              ' d="M3 4h2l1.5 11h10.5L20 7H7" />' +
            '<circle cx="8" cy="19" r="1.5" stroke-width="2" />' +
            '<circle cx="16" cy="19" r="1.5" stroke-width="2" />' +
          '</svg>' +
        '</div>' +
        '<h2 class="text-2xl font-bold text-gray-800 mb-4">Корзина пуста</h2>' +
        '<p class="text-lg text-gray-600 mb-8 max-w-xs">' +
          'Добавьте устройство в корзину, чтобы оформить заказ.' +
        '</p>' +
        '<button onclick="switchTab(\'shop\')"' +
          ' class="empty-cta-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg">' +
          'В магазин' +
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
            'bg-purple-500 hover:bg-purple-600 text-white shadow-md active:scale-[0.97] max-w-[180px] whitespace-nowrap"' +
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
                      ? 'Цена обновилась: старая RUB ' + formatPrice(item.price) +
                      ', новая RUB ' + formatPrice(item.newPrice)                    
                      : 'Товар недоступен, удалите из корзины') +
                  '</div>' +
                '</div>' +
                '<div class="text-right flex flex-col items-end gap-1">' +
                  '<div class="flex items-center justify-end gap-2">' +
  '<button class="px-2 py-1 rounded-full bg-gray-200 text-sm font-bold"' +
    ' onclick="changeCartItemQuantity(\'' + item.cartKey + '\', -1)">-</button>' +
  '<span class="min-w-[24px] text-center text-sm font-semibold">' +
    item.quantity +
  '</span>' +
  '<button class="px-2 py-1 rounded-full bg-gray-200 text-sm font-bold"' +
    ' onclick="changeCartItemQuantity(\'' + item.cartKey + '\', 1)">+</button>' +
'</div>' +
'<div class="text-sm font-bold text-blue-600">RUB ' +
  formatPrice(item.price * item.quantity) +
'</div>' +
(item.newPrice
  ? '<button class="text-xs text-blue-500" onclick="updateCartItemPrice(\'' +
      item.cartKey +
    '\')">Обновить цену</button>'
  : '') +
'<button class="text-xs text-red-500" onclick="removeCartItem(\'' +
  item.cartKey +
'\')">Удалить</button>' +
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
                  ' rows="3" placeholder="Например: г. Москва, проспект Ленинский n, подъезд 1, этаж 1, кв 2"></textarea>' +
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
                  ' rows="2" placeholder="Например: приеду к 19:00"></textarea>' +
              '</div>') +
        '</div>' +
        '<div class="space-y-2">' +
          '<label class="text-sm font-semibold text-gray-700 block">Контактные данные*</label>' +
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
            '<span>RUB ' + formatPrice(subtotal) + '</span>' +
          '</div>' +
          (paymentType === 'card'
            ? '<div class="flex items-center justify-between">' +
                '<span>Сервисный сбор (карта)</span>' +
                '<span>+RUB ' + formatPrice(commission) + '</span>' +
              '</div>'
            : '') +
          '<div class="flex items-center justify-between font-semibold mt-1">' +
            '<span>Итого к оплате</span>' +
            '<span>RUB ' + formatPrice(total) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="pt-3">' +
          '<button onclick="placeOrder()"' +
            ' id="placeOrderButton"' +
            ' class="w-full flex items-center justify-center gap-2 ' +
              (!cartItems.some(i => !i.available) && !isPlacingOrder
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-gray-400 cursor-not-allowed') +
              ' text-white font-semibold py-2.5 px-6 rounded-2xl shadow-lg text-sm"' +
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
  
    // ОДИН общий блок для pickupSelect: и фокус, и предзаполнение
    const pickupSelect = document.getElementById('pickupLocation');
    if (pickupSelect) {
      // предзаполнение по состоянию
      if (pickupLocation && PICKUP_LOCATIONS.includes(pickupLocation)) {
        pickupSelect.value = pickupLocation;
      } else {
        pickupSelect.value = '';
        pickupLocation = '';
      }
  
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

function getPickupModeForAnalytics() {
  // pickupMode у тебя уже есть: false = доставка, true = самовывоз
  return pickupMode ? 'pickup' : 'delivery';
}

window.placeOrder = async function () {
  if (isPlacingOrder) return;

  const orderClickTs = Date.now();
  console.log('[placeOrder] start at', orderClickTs, 'items=', cartItems.length);

  try {
    if (cartItems.length && typeof trackCheckoutStart === 'function') {
      trackCheckoutStart(cartItems, {
        payment_type: paymentType,
        pickup_mode: pickupMode
      });
    }
  } catch (e2) {}


  if (cartItems.length === 0) {
    tg?.showAlert?.('Корзина пуста.\nДля заказа через менеджера напишите @TechBex.');
    return;
  }

  let address = '';
  if (pickupMode) {
    if (!pickupLocation) {
      trackEvent('need_fill_pickup', {}, {});
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
      trackEvent('need_fill_address', {}, {});
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


  const hasBadName = !isValidName(rawName);
const hasBadPhone = !normalizePhone(rawPhone); // без сохранения
const hasNoConfirm = !contactConfirmed;

// 1) Все три не ок: имя, телефон, подтверждение
if (hasBadName && hasBadPhone && hasNoConfirm) {
  tg?.showAlert?.('Заполните имя и телефон и подтвердите данные');
  trackEvent('need_fill_all_fields', {}, {});
  return;
}

// 2) Имя и телефон не ок, подтверждение неважно (всё равно данные кривые)
if (hasBadName && hasBadPhone) {
  tg?.showAlert?.('Заполните корректные имя и телефон');
  trackEvent('need_fill_name_and_phone', {}, {});
  return;
}

// 3) Только имя не ок
if (hasBadName) {
  tg?.showAlert?.('Введите корректное имя (только буквы, 1–50 символов)');
  trackEvent('need_type_name', {}, {});
  return;
}

// 4) Только телефон не ок
const normalizedPhone = normalizePhone(rawPhone);
if (!normalizedPhone) {
  tg?.showAlert?.('Введите корректный номер телефона в формате +7XXXXXXXXXX');
  trackEvent('need_type_phone', {}, {});
  return;
}

// 5) Имя и телефон ок, но не подтвердил
if (!contactConfirmed) {
  tg?.showAlert?.('Подтвердите правильность введенных данных');
  trackEvent('need_confirm_data', {}, {});
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
    trackEvent('timeout_checkout_error', {}, {});
    tg?.showAlert?.(
      'Превышено время ожидания ответа сервера.\nДля заказа через менеджера напишите @TechBex.\nВозможно большая нагрузка и заказ появится в профиле в течении 3 минут. Если не появился проверьте интернет и попробуйте ещё раз (либо сразу можете попробовать повторно оформить заказ)'
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
      tg?.showAlert?.('Товары ещё не загружены, попробуйте позже.\nДля заказа через менеджера напишите @TechBex.');
      isPlacingOrder = false;
      setPlaceOrderLoading(false);
      return;
    }

    let hasUnavailable = false;
    let hasPriceChanged = false;

    const productByKeyForOrder = new Map(
      productsData.filter(p => p.inStock).map(p => [buildCartKey(p), p])
    );
    
    cartItems = cartItems.map(item => {
      const fresh = productByKeyForOrder.get(item.cartKey);

      if (!fresh) {
        hasUnavailable = true;
        return { ...item, available: false };
      }

      const freshPrice = Number(fresh['Цена']);
      const oldPrice = Number(item.price);

      // цена исчезла или стала 0 → считаем недоступным
      if (!Number.isFinite(freshPrice) || freshPrice <= 0) {
        hasUnavailable = true;
        return { ...item, available: false };
      }

      if (freshPrice !== oldPrice) {
        hasPriceChanged = true;
        return { ...item, available: false, newPrice: freshPrice };
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

        // сохраняем итоговую сумму для аналитики checkout_result
        lastOrderTotal = total;


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

    currentOrderId = order.id;
    hasCheckoutResultForCurrent = false;

    // фактическое совпадение с сохранённым профилем на момент клика
    const profileMatchesSaved =
      !!savedProfile &&
      !!savedProfile.confirmed &&
      (savedProfile.name || '').trim() === contactName &&
      normalizePhone(savedProfile.phone || '') === contactPhone;

    const usedSavedProfile = profileMatchesSaved;

    const usedSavedAddress =
      !pickupMode &&                       // только для доставки
      !!deliveryPrefs &&                   // prefs есть
      !!deliveryPrefs.savedAddressValue && // вообще есть сохранённый адрес
      deliveryPrefs.savedAddressValue === (cartFormState.savedAddressValue || '');

    try {
      if (typeof trackCheckoutFormFilled === 'function') {
        trackCheckoutFormFilled({
          used_saved_profile: usedSavedProfile,
          used_saved_address: usedSavedAddress,
          pickup_mode: pickupMode,
          payment_type: paymentType
        });
      }
      if (typeof trackCheckoutSubmit === 'function') {
        trackCheckoutSubmit(order);
      }
    } catch (e2) {}

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
      tg?.showAlert?.('Ошибка сети. Заказ не сохранён, попробуйте ещё раз.\nДля заказа через менеджера напишите @TechBex.');

      try {
        if (typeof trackCheckoutResult === 'function') {
          trackCheckoutResult(order.id, false, {
            reason: 'network_error'
          });
        }
        hasCheckoutResultForCurrent = true;
      } catch (e2) {}

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
      tg?.showAlert?.('Заказ не сохранён, ошибка сервера, попробуйте ещё раз.\nДля заказа через менеджера напишите @TechBex.');

      try {
        if (typeof trackCheckoutResult === 'function') {
          trackCheckoutResult(order.id, false, {
            reason: 'server_error',
            status: resp.status
          });
        }
        hasCheckoutResultForCurrent = true;
      } catch (e2) {}

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

    try {
      if (typeof trackEvent === 'function') {
        trackEvent('perf_checkout_total', {
          duration_ms: durationMs
        });
      }
      if (typeof trackCheckoutResult === 'function') {
        trackCheckoutResult(order.id, true);
      }
      hasCheckoutResultForCurrent = true;
    } catch (e2) {}

    tg?.showAlert?.(
      '✅ Заказ оформлен!\nМенеджер свяжется для подтверждение заказа в ближайшее время.'
    );
    
    resetCartStateAfterOrder();
    
    isPlacingOrder = false;
    
    if (currentTab === 'cart') {
      resetUiAfterOrderSuccessIfCart();
      showCartTab();
    }    
  } finally {
    clearTimeout(placeOrderTimeoutId);
    placeOrderTimeoutId = null;
  }
};
