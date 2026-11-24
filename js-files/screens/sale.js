const SALE_CART_KEY_EXCLUDE = new Set([
  'id', 'Артикул', 'Цена', 'Входная цена', 'Наценка',
  'inStock', 'Статус', 'Общая картинка', 'Изображения', 'images',
  'cat', 'Категория', 'sourceSheet', 'isPreview', 'redPrice',
  'price', 'salePrice', 'image', 'rowNumber'
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
  var maxQty = saleItem.quantity || 1;
  var cartKey = buildSaleCartKey(saleItem);
  var existing = __cartStore.value.find(function(item) { return item.cartKey === cartKey; });
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, maxQty);
  } else {
    var options = {};
    Object.keys(saleItem)
      .filter(function(k) { return !SALE_CART_KEY_EXCLUDE.has(k); })
      .forEach(function(k) { options[k] = saleItem[k]; });
    __cartStore.value.push({
      cartKey: cartKey,
      name: saleItem.name || saleItem['Название'] || '',
      price: Number(saleItem.salePrice) || 0,
      quantity: Math.min(quantity, maxQty),
      maxQuantity: maxQty,
      available: true,
      isSale: true,
      id: saleItem.id || '',
      rowNumber: saleItem.rowNumber,
      options: options,
      image: saleItem.image || saleItem['Общая картинка'] || ''
    });
  }
  saveCartToStorage();
  updateCartBadge();
  try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (e) {}
}

function renderSaleCard(item) {
  var name = item.name || item['Название'] || '';
  var image = item.image || item['Общая картинка'] || '';
  var oldPrice = Number(item.price) || 0;
  var salePrice = Number(item.salePrice) || 0;
  var subtitle = getSaleItemSubtitle(item);
  var formatPriceFn = window.formatPriceForCountry || formatPrice;
  var country = window.__selectedCountryStore.value || 'RU';
  var cfg = window.getCurrentCountryConfig ? window.getCurrentCountryConfig() : { currency: 'RUB' };
  var currencyLabel = cfg.currency;
  var randId = 'simg_' + Math.random().toString(36).substr(2, 9);

  return (
    '<div class="bg-white rounded-2xl p-4 shadow-lg group cursor-pointer relative w-full" data-sale-id="' + escapeHtml(item.id) + '">' +
    '<div class="absolute top-2 right-2 z-10 flex items-center justify-center w-7 h-7 bg-red-500 text-white text-xs font-bold rounded-full shadow">%</div>' +
    '<div class="w-full h-32 rounded-xl mb-3 image-carousel cursor-pointer overflow-hidden relative bg-gray-50">' +
    (image
      ? '<div class="image-placeholder-container relative w-full h-full" id="' + randId + '">' +
        '<div class="image-placeholder-svg absolute inset-0">' +
          '<svg class="w-10 h-10 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>' +
          '</svg>' +
        '</div>' +
        '<img src="' + image.replace(/'/g, "\\'") + '" class="product-image animatable absolute inset-0 object-contain" alt="" onload="handleSaleImageLoad(this, \'' + image.replace(/'/g, "\\'") + '\')" onerror="this.style.display=\'none\'">' +
        '</div>'
      : '<svg class="w-10 h-10 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>') +
    '</div>' +
    '<div class="font-bold text-base mb-1 product-title">' + escapeHtml(name) + '</div>' +
    '<div class="flex flex-col leading-tight">' +
    (oldPrice > 0
      ? '<span class="text-sm text-gray-400 line-through">' + currencyLabel + ' ' + formatPriceFn(oldPrice, country) + '</span>'
      : '<span class="text-sm invisible">0</span>') +
    '<span class="text-red-600 font-black text-xl">' + currencyLabel + ' ' + formatPriceFn(salePrice, country) + '</span>' +
    '</div>' +
    '</div>'
  );
}

window.handleSaleImageLoad = function(img, url) {
  var container = img.closest('.image-placeholder-container');
  if (!container) { img.classList.add('fade-in-image'); return; }
  var svg = container.querySelector('.image-placeholder-svg');
  if (!svg) { img.classList.add('fade-in-image'); return; }
  svg.classList.add('svg-fade-out');
  setTimeout(function() { img.classList.add('fade-in-image'); }, 500);
};

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
  var images = saleItem.images || (image ? [image] : []);
  var formatPriceFn = window.formatPriceForCountry || window.formatPrice;
  var country = window.__selectedCountryStore.value || 'RU';
  var cfg = window.getCurrentCountryConfig ? window.getCurrentCountryConfig() : { currency: 'RUB' };
  var currencyLabel = cfg.currency;
  var discountPercent = oldPrice > 0 ? Math.round((1 - price / oldPrice) * 100) : 0;

  if (modal && !modal.classList.contains('hidden')) {
    saveModalState(currentTab);
    modal.classList.add('hidden');
  }
  delete savedModalState.sale;
  currentProduct = saleItem;

  if (!window.modal) return;
  var modalRoot = document.getElementById('modalContent');
  if (!modalRoot) return;

  if (modalRoot.dataset.initialized) delete modalRoot.dataset.initialized;
  modalRoot.innerHTML =
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
        '</div>' +
    '</div>' +
    '<div class="flex-1 overflow-y-auto" id="modalScrollArea">' +
      '<div class="modal-image-section">' +
        '<div class="w-full image-carousel h-64 rounded-xl overflow-hidden bg-white" id="modalCarousel">' +
          '<div class="image-carousel-inner w-full h-full flex items-center justify-center" id="modalCarouselInner">' +
            '<div class="flex w-full h-full" id="modalSlidesWrapper">' +
              (images.length
                ? images.map(function(url, i) {
                    return '<div class="w-full h-64 flex-shrink-0 flex items-center justify-center relative bg-white">' +
                      '<img src="' + url.replace(/'/g, "\\'") + '" class="carousel-img w-full h-64 object-contain modal-photo modal-photo-hidden" alt="" loading="lazy" onerror="saleImgError(this)" data-slide="' + i + '">' +
                      '</div>';
                  }).join('')
                : '<div class="w-full h-64 flex-shrink-0 flex items-center justify-center relative bg-white">' +
                  '<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                  '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>' +
                  '</svg></div>'
              ) +
            '</div>' +
          '</div>' +
          (images.length > 1
            ? '<div class="modal-carousel-footer"><div class="carousel-dots" id="modalDots"></div></div>' +
              '<button class="nav-btn nav-prev" id="modalPrevBtn" onclick="modalPrev(); event.stopPropagation()">' +
                '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">' +
                  '<path d="M14.5 6L9 12l5.5 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />' +
                '</svg>' +
              '</button>' +
              '<button class="nav-btn nav-next" id="modalNextBtn" onclick="modalNext(); event.stopPropagation()">' +
                '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">' +
                  '<path d="M9.5 6L15 12l-5.5 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />' +
                '</svg>' +
              '</button>'
            : ''
          ) +
        '</div>' +
      '</div>' +
      '<div id="modalBodyDynamic" class="px-4 pt-0 pb-4 space-y-4"></div>' +
    '</div>' +
    '<div class="modal-footer border-t bg-white"' +
    '     style="padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);">' +
      '<button id="modalAddButton" class="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 rounded-2xl shadow-2xl cursor-pointer" onclick="addToCartSaleFromModal(); return false;">В корзину</button>' +
    '</div>' +
  '</div>';

  modalCurrentIndex = 0;
  startSaleCarousel();

  window.modal.classList.remove('hidden');
  tg?.expand();
}

window.saleImgError = function(el) {
  el.parentElement.innerHTML = '<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
};

window.addToCartSaleFromModal = function () {
  addToCartSale(currentProduct, 1);
  closeModal();
};

function startSaleCarousel() {
  var slidesWrapper = document.getElementById('modalSlidesWrapper');
  var dotsRoot = document.getElementById('modalDots');
  var prevBtn = document.getElementById('modalPrevBtn');
  var nextBtn = document.getElementById('modalNextBtn');
  var carouselInner = document.getElementById('modalCarouselInner');
  if (!slidesWrapper || !carouselInner) return;

  var slides = slidesWrapper.children;
  if (slides.length <= 1) {
    if (slides.length === 1) {
      var firstImg = slides[0].querySelector('.modal-photo');
      if (firstImg) setTimeout(function() { firstImg.classList.remove('modal-photo-hidden'); firstImg.classList.add('modal-photo-visible'); }, 100);
    }
    return;
  }

  if (dotsRoot) {
    dotsRoot.innerHTML = '';
    for (var i = 0; i < slides.length; i++) {
      var dot = document.createElement('div');
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.onclick = function(idx) { return function() { goToSaleSlide(idx); }; }(i);
      dotsRoot.appendChild(dot);
    }
  }

  if (prevBtn) prevBtn.style.display = 'flex';
  if (nextBtn) nextBtn.style.display = 'flex';

  setTimeout(function() { goToSaleSlide(0); }, 50);

  window.modalPrev = function() {
    var idx = modalCurrentIndex > 0 ? modalCurrentIndex - 1 : slides.length - 1;
    goToSaleSlide(idx);
  };

  window.modalNext = function() {
    var idx = modalCurrentIndex < slides.length - 1 ? modalCurrentIndex + 1 : 0;
    goToSaleSlide(idx);
  };

  function goToSaleSlide(idx) {
    modalCurrentIndex = idx;
    carouselInner.style.transform = 'translateX(-' + (idx * 100) + '%)';
    if (dotsRoot) {
      var dots = dotsRoot.children;
      for (var j = 0; j < dots.length; j++) {
        dots[j].className = 'carousel-dot' + (j === idx ? ' active' : '');
      }
    }
    var slideImgs = slidesWrapper.children[idx].querySelectorAll('.modal-photo');
    slideImgs.forEach(function(el) {
      el.classList.remove('modal-photo-hidden');
      el.classList.add('modal-photo-visible');
    });
  }
}

function filterInStockSales(sales) {
  return (sales || []).filter(function(s) { return s.inStock !== false; });
}

function showSaleTab() {
  if (window.__salesStore && window.__salesStore.value && window.__salesStore.value.length) {
    renderSalePage(filterInStockSales(window.__salesStore.value));
    return;
  }

  fetch(SALES_API_URL)
    .then(function(r) { return r.json(); })
    .then(function(sales) {
      if (!sales || !sales.length) {
        renderSalePlaceholder();
        return;
      }
      if (window.__salesStore) window.__salesStore.value = sales;
      renderSalePage(filterInStockSales(sales));
    })
    .catch(function() {
      renderSalePlaceholder();
    });
}