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
    '<div class="relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">' +
    '<div class="absolute top-2 left-2 z-10 flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">' +
    '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9h6a1 1 0 110 2H7a1 1 0 110-2zm0 4h4a1 1 0 110 2H7a1 1 0 110-2zm3-8a1 1 0 011 1v2h2a1 1 0 110 2h-2v2a1 1 0 11-2 0v-2H8a1 1 0 110-2h2V6a1 1 0 011-1z"/></svg>' +
    ' -' + Math.round((1 - salePrice / (oldPrice || salePrice)) * 100) + '%' +
    '</div>' +
    (image
      ? '<div class="w-full h-40 bg-gray-50 flex items-center justify-center p-4">' +
        '<img src="' + image.replace(/'/g, "\\'") + '" class="max-w-full max-h-full object-contain" alt="" onerror="this.style.display=\'none\'">' +
        '</div>'
      : '<div class="w-full h-32 bg-gray-50 flex items-center justify-center"><svg class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>') +
    '<div class="p-3">' +
    '<div class="font-medium text-sm text-gray-900 leading-tight line-clamp-2 min-h-[2.5em]">' + escapeHtml(name) + '</div>' +
    (subtitle ? '<div class="text-xs text-gray-500 mt-1 truncate">' + escapeHtml(subtitle) + '</div>' : '') +
    '<div class="flex items-baseline gap-2 mt-2">' +
    (hasOldPrice
      ? '<span class="text-sm text-gray-400 line-through">' + currencyLabel + ' ' + formatPriceFn(oldPrice, country) + '</span>'
      : '') +
    '<span class="text-lg text-red-600 font-bold">' + currencyLabel + ' ' + formatPriceFn(salePrice, country) + '</span>' +
    '</div>' +
    '<button onclick="addToCartSale(' + JSON.stringify(item).replace(/'/g, "\\'") + ', 1); switchTab(\'cart\')" ' +
    'class="mt-3 w-full text-sm font-semibold py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white active:scale-[0.97] transition-transform">' +
    'В корзину' +
    '</button>' +
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