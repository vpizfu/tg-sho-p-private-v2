const SALE_CART_KEY_EXCLUDE = new Set([
  'id', 'Артикул', 'Цена', 'Входная цена', 'Наценка',
  'inStock', 'Статус', 'Общая картинка', 'Изображения', 'images',
  'cat', 'Категория', 'sourceSheet', 'isPreview',
  'price', 'salePrice'
]);

function buildSaleCartKey(product) {
  const entries = Object.keys(product)
    .filter(k => !SALE_CART_KEY_EXCLUDE.has(k))
    .sort()
    .map(k => k + '=' + String(product[k] ?? '').trim().toLowerCase());
  const raw = entries.join('||');
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash = hash >>> 0;
  }
  return 'sck_' + hash.toString(36);
}

function renderSalePlaceholder() {
  root.innerHTML =
    '<div class="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 pb-[65px] max-w-md mx-auto">' +
    '<div class="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mb-6">' +
    '<svg class="w-16 h-16 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
    ' d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
    '</svg>' +
    '</div>' +
    '<h2 class="text-2xl font-bold text-gray-800 mb-4">Распродажа</h2>' +
    '<p class="text-lg text-gray-600 mb-8 max-w-xs">Скоро здесь будут акционные предложения.</p>' +
    '<button onclick="switchTab(\'shop\')" ' +
    'class="empty-cta-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg">' +
    'В магазин' +
    '</button>' +
    '</div>';
}

function getSaleItemSubtitle(item) {
  if (!item.options && typeof item !== 'object') return '';
  const vals = Object.keys(item)
    .filter(k => !SALE_CART_KEY_EXCLUDE.has(k))
    .map(k => item[k])
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '');
  return vals.join(' | ');
}

function addToCartSale(saleItem, quantity) {
  const cartKey = buildSaleCartKey(saleItem);
  const existing = __cartStore.value.find(item => item.cartKey === cartKey);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, 100);
  } else {
    const options = {};
    Object.keys(saleItem)
      .filter(k => !SALE_CART_KEY_EXCLUDE.has(k))
      .forEach(k => { options[k] = saleItem[k]; });
    __cartStore.value.push({
      cartKey,
      name: saleItem.name || saleItem['Название'] || '',
      price: Number(saleItem.salePrice) || 0,
      quantity,
      available: true,
      isSale: true,
      options,
      image: saleItem.image || saleItem['Общая картинка'] || ''
    });
  }
  saveCartToStorage();
  updateCartBadge();
  try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (e) {}
}

function renderSaleCard(item) {
  const name = item.name || item['Название'] || '';
  const image = item.image || item['Общая картинка'] || '';
  const oldPrice = Number(item.price) || 0;
  const salePrice = Number(item.salePrice) || 0;
  const hasOldPrice = oldPrice > 0 && oldPrice !== salePrice;
  const subtitle = getSaleItemSubtitle(item);
  const formatPriceFn = window.formatPriceForCountry || formatPrice;
  const country = window.__selectedCountryStore.value || 'RU';
  const cfg = window.getCurrentCountryConfig ? window.getCurrentCountryConfig() : { currency: 'RUB' };
  const currencyLabel = cfg.currency;

  return (
    '<div class="bg-white rounded-2xl p-4 shadow-lg group cursor-pointer relative w-full" data-sale-id="' + escapeHtml(item.id) + '">' +
    '<div class="absolute top-2 right-2 z-10 flex items-center justify-center w-7 h-7 bg-red-500 text-white text-xs font-bold rounded-full shadow">%</div>' +
    '<div class="w-full h-32 rounded-xl mb-3 bg-gray-50 flex items-center justify-center overflow-hidden">' +
    (image
      ? '<img src="' + image.replace(/'/g, "\\'") + '" class="max-w-full max-h-full object-contain" alt="" onerror="this.style.display=\'none\'">'
      : '<svg class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>') +
    '</div>' +
    '<div class="font-bold text-base mb-1 product-title">' + escapeHtml(name) + '</div>' +
    '<div class="flex items-baseline gap-2">' +
    (hasOldPrice && oldPrice !== salePrice
      ? '<span class="text-sm text-gray-400 line-through">' + currencyLabel + ' ' + formatPriceFn(oldPrice, country) + '</span>'
      : '') +
    '<span class="text-red-600 font-black text-xl">' + currencyLabel + ' ' + formatPriceFn(salePrice, country) + '</span>' +
    '</div>' +
    '</div>'
  );
}

function renderSalePage(sales) {
  root.innerHTML =
    '<div class="relative min-h-[100vh] p-4 pb-[80px] max-w-md mx-auto">' +
    '<h2 class="text-xl font-bold text-gray-800 mb-4">Распродажа</h2>' +
    '<div class="grid grid-cols-2 gap-3">' +
    sales.map(renderSaleCard).join('') +
    '</div>' +
    '</div>';

  document.querySelectorAll('[data-sale-id]').forEach(function(card) {
    card.onclick = function(e) {
      if (e.target.closest('button') || e.target.closest('.dot')) return;
      var id = card.dataset.saleId;
      var item = sales.find(function(s) { return s.id === id; });
      if (!item) return;
      if (typeof showSaleModal === 'function') {
        showSaleModal(item);
      }
    };
  });
}

function showSaleModal(saleItem) {
  var name = saleItem.name || saleItem['Название'] || '';
  var price = Number(saleItem.salePrice) || 0;
  var oldPrice = Number(saleItem.price) || 0;
  var image = saleItem.image || saleItem['Общая картинка'] || '';
  var formatPriceFn = window.formatPriceForCountry || formatPrice;
  var country = window.__selectedCountryStore.value || 'RU';
  var cfg = window.getCurrentCountryConfig ? window.getCurrentCountryConfig() : { currency: 'RUB' };
  var currencyLabel = cfg.currency;

  if (!modal) return;
  var modalContent = document.getElementById('modalContent');
  if (!modalContent) return;

  modalContent.innerHTML =
    '<div class="flex flex-col h-full">' +
    '<div class="p-6 pb-4 border-b border-gray-200">' +
    '<div class="flex items-center justify-between mb-2">' +
    '<h2 class="text-2xl font-bold">' + escapeHtml(name) + '</h2>' +
    '<button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-xl">' +
    '<svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>' +
    '</svg>' +
    '</button>' +
    '</div>' +
    '<div class="flex items-center gap-2 text-sm">' +
    (oldPrice > 0 ? '<span class="text-gray-400 line-through">' + currencyLabel + ' ' + formatPriceFn(oldPrice, country) + '</span>' : '') +
    '<span class="text-red-600 font-bold text-lg">' + currencyLabel + ' ' + formatPriceFn(price, country) + '</span>' +
    '<span class="text-green-600 font-semibold text-sm">-' + Math.round((1 - price / (oldPrice || price)) * 100) + '%</span>' +
    '</div>' +
    '</div>' +
    '<div class="flex-1 overflow-y-auto p-6">' +
    (image
      ? '<div class="w-full h-48 bg-gray-50 rounded-xl flex items-center justify-center mb-4">' +
        '<img src="' + image.replace(/'/g, "\\'") + '" class="max-w-full max-h-full object-contain" alt="">' +
        '</div>'
      : '') +
    '<button onclick="addToCartSale(' + JSON.stringify(saleItem).replace(/'/g, "\\'") + ', 1); closeModal(); switchTab(\'cart\')" ' +
    'class="w-full text-sm font-semibold py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white active:scale-[0.97] transition-transform">' +
    'В корзину' +
    '</button>' +
    '</div>' +
    '</div>';

  modal.classList.remove('hidden');
  tg?.expand();
}

function showSaleTab() {
  fetch(SALES_API_URL)
    .then(function(r) { return r.json(); })
    .then(function(sales) {
      if (!sales || !sales.length) {
        renderSalePlaceholder();
        return;
      }
      renderSalePage(sales);
    })
    .catch(function() {
      renderSalePlaceholder();
    });
}