// modal_v2.js

let modalCurrentIndex = 0;
let modalImageCount = 0;
let modalImageIndexBeforeFullscreen = 0;

let modalTouchStartX = 0;
let modalTouchStartY = 0;

let modalCurrentImageKey = null;

// Запоминаем: для каких URL был onerror (чтобы сразу ставить заглушку)
const brokenImageMap = new Map();

function getVariantCountText(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return count + ' вариант';
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return count + ' варианта';
  }
  return count + ' вариантов';
}

// вспомогалка: получить finalTypes для текущего продукта/выбора
function getFinalTypesForCurrentProduct() {
  if (!currentProduct || !productsData) return [];

  const variantsAll = getProductVariants(currentProduct.name).filter(v => v.inStock);
  if (!variantsAll.length) return [];

  const filtered = getFilteredVariants(variantsAll);
  const activeTypes = getActiveTypesForProduct(currentProduct, variantsAll);

  const finalTypes = activeTypes.filter(type =>
    filtered.some(v => v[type] !== undefined && v[type] !== null && v[type] !== '')
  );

  return finalTypes;
}

function selectOptionNoFocus(type, option) {
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }

  const scrollContainer = document.querySelector('#modalContent .flex-1');
  const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

  const finalTypes = getFinalTypesForCurrentProduct();
  const typeIndex = finalTypes.indexOf(type);

  if (typeIndex === -1) return;

  if (selectedOption[type] === option) {
    // снимаем выбор и чистим всё дальше
    for (let i = typeIndex; i < finalTypes.length; i++) {
      delete selectedOption[finalTypes[i]];
    }
  } else {
    // ставим новое значение и чистим всё дальше
    for (let i = typeIndex + 1; i < finalTypes.length; i++) {
      delete selectedOption[finalTypes[i]];
    }
    selectedOption[type] = option;
  }

  renderProductModal(currentProduct);

  const newScrollContainer = document.querySelector('#modalContent .flex-1');
  if (newScrollContainer) newScrollContainer.scrollTop = prevScrollTop;

  tg?.HapticFeedback?.impactOccurred('light');
}

function clearOptionNoFocus(type) {
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }

  const scrollContainer = document.querySelector('#modalContent .flex-1');
  const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

  const finalTypes = getFinalTypesForCurrentProduct();
  const typeIndex = finalTypes.indexOf(type);

  if (typeIndex === -1) return;

  for (let i = typeIndex; i < finalTypes.length; i++) {
    delete selectedOption[finalTypes[i]];
  }

  renderProductModal(currentProduct);

  const newScrollContainer = document.querySelector('#modalContent .flex-1');
  if (newScrollContainer) newScrollContainer.scrollTop = prevScrollTop;

  tg?.HapticFeedback?.impactOccurred('light');
}

window.selectOptionNoFocus = selectOptionNoFocus;
window.clearOptionNoFocus = clearOptionNoFocus;

window.changeQuantity = function (delta) {
  const scrollContainer = document.querySelector('#modalContent .flex-1');
  const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

  let q = selectedQuantity + delta;
  if (q < 1) q = 1;
  if (q > 100) q = 100;
  selectedQuantity = q;

  const span = document.getElementById('quantityValue');
  if (span) span.textContent = selectedQuantity;

  if (currentProduct) {
    renderProductModal(currentProduct);
  }

  const newScrollContainer = document.querySelector('#modalContent .flex-1');
  if (newScrollContainer) newScrollContainer.scrollTop = prevScrollTop;
};

// без дополнительного запроса за таблицей
window.addToCartFromModal = async function () {
  if (isAddingToCart) return;

  const scrollContainer = document.querySelector('#modalContent .flex-1');
  const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

  try {
    isAddingToCart = true;
    renderProductModal(currentProduct);
    const sc2 = document.querySelector('#modalContent .flex-1');
    if (sc2) sc2.scrollTop = prevScrollTop;

    if (!isCompleteSelection()) {
      tg?.showAlert?.('❌ Выберите все опции');
      return;
    }

    if (!productsData) {
      tg?.showAlert?.('Товары не загрузились, попробуйте позже');
      return;
    }

    const variants = getFilteredVariants(
      getProductVariants(currentProduct.name).filter(v => v.inStock)
    );

    if (!variants.length) {
      tg?.showAlert?.('❌ Нет доступных вариантов');
      return;
    }

    const selectedVariant = variants[0];
    addToCart(selectedVariant, selectedQuantity);

    const subtitle = getCartItemSubtitle(selectedVariant);
    tg?.showAlert?.(
      '✅ ' +
        selectedVariant.name +
        (subtitle ? '\n' + subtitle : '') +
        '\nКоличество: ' +
        selectedQuantity +
        '\nRUB ' +
        selectedVariant.price * selectedQuantity
    );
    closeModal();
  } finally {
    isAddingToCart = false;
    const scA = document.querySelector('#modalContent .flex-1');
    const prevA = scA ? scA.scrollTop : 0;
    if (currentProduct) {
      renderProductModal(currentProduct);
      const scB = document.querySelector('#modalContent .flex-1');
      if (scB) scB.scrollTop = prevA;
    }
  }
};

function renderProductModal(product) {
  currentProduct = product;

  const modalRoot = document.getElementById('modalContent');

  // жёсткий сброс скролла при каждом новом продукте
  const scrollContainer = modalRoot.querySelector('.flex-1');
  if (scrollContainer) scrollContainer.scrollTop = 0;

  const allVariants = getProductVariants(product.name);
  const variants = allVariants.filter(v => v.inStock);

  if (!variants.length) {
    modalRoot.innerHTML =
      '<div class="flex flex-col h-full">' +
        '<div class="p-6 pb-4 border-b border-gray-200">' +
          '<div class="flex items-center justify-between mb-2">' +
            '<h2 class="text-2xl font-bold">' + escapeHtml(product.name) + '</h2>' +
            '<button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-xl">' +
              '<svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<div class="text-sm text-red-500">Нет доступных вариантов</div>' +
        '</div>' +
      '</div>';
    return;
  }

  const filteredVariants = getFilteredVariants(variants);
  const availableVariants = filteredVariants;

  const activeTypes = getActiveTypesForProduct(product, variants);

  // типы, которые показываем: по текущим вариантам поле должно быть где‑то непустым
  const finalTypes = activeTypes.filter(type =>
    availableVariants.some(v => v[type] !== undefined && v[type] !== null && v[type] !== '')
  );

  const availableOptions = {};
  finalTypes.forEach(type => {
    availableOptions[type] = getAvailableOptions(type, variants);
  });

  const complete = isCompleteSelection();

  const currentMinPrice = availableVariants.length
    ? Math.min.apply(null, availableVariants.map(v => v.price))
    : Math.min.apply(null, variants.map(v => v.price));

  let headerPriceText;
  let headerSuffix = '';

  if (!complete) {
    headerPriceText = 'от RUB ' + currentMinPrice;
    headerSuffix = 'за единицу';
  } else if (complete && availableVariants.length > 0) {
    const priceToShow = availableVariants[0].price;
    headerPriceText = 'RUB ' + priceToShow;
    headerSuffix = 'за единицу';
  } else {
    headerPriceText = 'Нет вариантов';
  }

  let filteredImages = [];
  if (complete && availableVariants.length > 0) {
    filteredImages = getFilteredProductImages(availableVariants);
    if (!filteredImages.length && variants[0].commonImage) {
      filteredImages = [variants[0].commonImage];
    }
  }

  const productCommonImage = product.commonImage || '';

  if (!modalRoot.dataset.initialized) {
    modalRoot.dataset.initialized = '1';

    modalRoot.innerHTML =
      '<div class="flex flex-col h-full">' +

        '<div class="p-6 pb-4 border-b border-gray-200">' +
          '<div class="flex items-center justify-between mb-2">' +
            '<h2 class="text-2xl font-bold" id="modalTitle"></h2>' +
            '<button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-xl">' +
              '<svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<div class="flex items-center gap-2 text-sm text-gray-500">' +
            '<span id="modalPrice"></span>' +
            '<span>• <span id="modalVariantCount"></span></span>' +
          '</div>' +
        '</div>' +

        '<div class="flex-1 overflow-y-auto" id="modalScrollArea">' +

'<div class="modal-image-section">' +
  '<div class="w-full image-carousel h-64 rounded-xl overflow-hidden bg-white" id="modalCarousel">' +
    '<div class="image-carousel-inner w-full h-full flex items-center justify-center" id="modalCarouselInner">' +
      // стартовый плейсхолдер на полный размер
      '<div class="w-full h-full flex items-center justify-center">' +
        getPlainSvgPlaceholder() +
      '</div>' +
    '</div>' +
    '<div class="modal-carousel-footer">' +
      '<div class="carousel-dots" id="modalDots"></div>' +
      '<div id="modalImageHint" class="px-3 pt-1 pb-0 text-xs text-gray-500 text-center"></div>' +
    '</div>' +
    '<button class="nav-btn nav-prev" id="modalPrevBtn" onclick="modalPrev(); event.stopPropagation()">‹</button>' +
    '<button class="nav-btn nav-next" id="modalNextBtn" onclick="modalNext(); event.stopPropagation()">›</button>' +
  '</div>' +
'</div>' +
          '<div id="modalBodyDynamic" class="px-4 pt-0 pb-4 space-y-4"></div>' +
        '</div>' +

        '<div class="modal-footer border-t bg-white">' +
          '<button id="modalAddButton"' +
          ' class="w-full flex items-center justify-center gap-2 text-white font-semibold px-4 rounded-2xl shadow-lg " onclick="addToCartFromModal(); return false;"></button>' +
        '</div>' +

      '</div>';

    initModalSwipe();
  }

  document.getElementById('modalTitle').textContent = product.name;
  document.getElementById('modalPrice').textContent =
    headerPriceText + (headerSuffix ? ' ' + headerSuffix : '');
  document.getElementById('modalVariantCount').textContent =
    getVariantCountText(availableVariants.length);

  // === БЛОК КАРУСЕЛИ / ПЛЕЙСХОЛДЕР ===
  const carouselInner = document.getElementById('modalCarouselInner');
  const dotsRoot = document.getElementById('modalDots');
  const imageHintEl = document.getElementById('modalImageHint');
  const prevBtn = document.getElementById('modalPrevBtn');
  const nextBtn = document.getElementById('modalNextBtn');

  let imagesToShow = [];
  if (complete && filteredImages.length > 0) {
    imagesToShow = filteredImages.slice(0, 10);
  } else if (productCommonImage) {
    imagesToShow = [productCommonImage];
  }

  const nextKey = JSON.stringify({
    complete,
    images: imagesToShow,
    common: productCommonImage
  });

  const INITIAL_FADE_MS = 1000; // первое открытие
  const SWAP_FADE_MS = 500;    // смена опций (совпадает с CSS 0.5s)

  function applyFadeIn(el, durationMs) {
    if (!el) return;
    const prevTransition = el.style.transition;

    if (durationMs !== SWAP_FADE_MS) {
      el.style.transition = 'opacity ' + durationMs + 'ms ease';
    }

    el.classList.remove('modal-photo-visible');
    el.classList.add('modal-photo-hidden');

    requestAnimationFrame(() => {
      el.classList.remove('modal-photo-hidden');
      el.classList.add('modal-photo-visible');
      setTimeout(() => {
        el.style.transition = prevTransition;
      }, durationMs);
    });
  }

  function buildSlides() {
    carouselInner.innerHTML =
      '<div class="flex w-full h-full" id="modalSlidesWrapper"></div>';
    dotsRoot.innerHTML = '';
    modalImageCount = imagesToShow.length;

    const slidesWrapper = document.getElementById('modalSlidesWrapper');

    const svgPlaceholder =
      '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"' +
      ' class="w-12 h-12 text-gray-400">' +
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
        ' d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>' +
      '</svg>';

    function makeSlideContent(url, mode) {
      const hasPhoto = mode === 'photo' && url;
      const showPlaceholder = mode === 'placeholder';

      if (hasPhoto) {
        return (
          '<img src="' + url + '"' +
          ' class="carousel-img w-full h-64 object-contain modal-photo modal-photo-hidden"' +
          ' alt="Product image" loading="lazy" />'
        );
      }
      if (showPlaceholder) {
        return (
          '<div class="modal-photo modal-photo-hidden flex items-center justify-center">' +
            svgPlaceholder +
          '</div>'
        );
      }
      return '';
    }

    function makeSlide(url, mode) {
      return (
        '<div class="w-full h-64 flex-shrink-0 flex items-center justify-center relative bg-white">' +
          makeSlideContent(url, mode) +
        '</div>'
      );
    }

    const durationForThisBuild =
      modalCurrentImageKey === null ? INITIAL_FADE_MS : SWAP_FADE_MS;

    if (!imagesToShow.length) {
      slidesWrapper.innerHTML = makeSlide('', 'placeholder');
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';

      requestAnimationFrame(() => {
        const slide = slidesWrapper.firstElementChild;
        const layer = slide?.querySelector('.modal-photo');
        applyFadeIn(layer, durationForThisBuild);
      });
    } else {
      slidesWrapper.innerHTML = imagesToShow
        .map(url => makeSlide(url, 'empty'))
        .join('');

      const slideEls = slidesWrapper.children;

      imagesToShow.forEach((url, idx) => {
        const slide = slideEls[idx];

        if (!url || brokenImageMap.get(url)) {
          slide.innerHTML = makeSlideContent('', 'placeholder');
          const ph = slide.querySelector('.modal-photo');
          requestAnimationFrame(() => {
            applyFadeIn(ph, durationForThisBuild);
          });
          return;
        }

        slide.innerHTML = makeSlideContent(url, 'photo');
        const img = slide.querySelector('img');

        requestAnimationFrame(() => {
          applyFadeIn(img, durationForThisBuild);
        });

        img.addEventListener('error', () => {
          brokenImageMap.set(url, true);
          slide.innerHTML = makeSlideContent('', 'placeholder');
          const ph = slide.querySelector('.modal-photo');
          requestAnimationFrame(() => {
            applyFadeIn(ph, durationForThisBuild);
          });
        });
      });

      modalCurrentIndex = 0;

      if (imagesToShow.length > 1) {
        dotsRoot.innerHTML = imagesToShow
          .map(
            (_, idx) =>
              '<div class="dot' +
              (idx === modalCurrentIndex ? ' active' : '') +
              '" onclick="modalGoTo(' +
              idx +
              '); event.stopPropagation()"></div>'
          )
          .join('');
        prevBtn.style.display = '';
        nextBtn.style.display = '';
        initModalCarousel(imagesToShow.length);
      } else {
        dotsRoot.innerHTML = '';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      }
    }

    if (!complete || !filteredImages.length) {
      imageHintEl.textContent =
        '❓ Чтобы посмотреть реальные фото товара, выберите все параметры устройства.';
      imageHintEl.classList.remove('modal-image-hint-hidden');
    } else {
      imageHintEl.textContent = '';
      imageHintEl.classList.add('modal-image-hint-hidden');
    }    
  }

  if (modalCurrentImageKey === null) {
    // первое открытие: fade-in 1500ms
    buildSlides();
    modalCurrentImageKey = nextKey;
  } else if (modalCurrentImageKey !== nextKey) {
    // смена опций: 500ms fade-out старого + 500ms fade-in нового
    const slidesWrapperOld = document.getElementById('modalSlidesWrapper');
    if (slidesWrapperOld) {
      const activeLayers = slidesWrapperOld.querySelectorAll(
        '.modal-photo-visible, .modal-photo-hidden'
      );
      activeLayers.forEach(el => {
        el.classList.remove('modal-photo-visible');
        el.classList.add('modal-photo-hidden');
      });
    }
  
    modalCurrentImageKey = nextKey;
  
    setTimeout(() => {
      buildSlides();
    }, SWAP_FADE_MS);
  }

  // === ТЕЛО МОДАЛКИ (опции, количество) ===
  const body = document.getElementById('modalBodyDynamic');
  const order = finalTypes;

  body.innerHTML =
  order.map((type, index) => {
    const isLocked = index > getCurrentSectionIndex();
    return (
      '<div class="option-section ' +
        (isLocked ? 'locked' : 'unlocked') +
        '" data-section="' + type + '">' +
        '<label class="text-sm font-semibold text-gray-700 capitalize mb-2 block">' +
          getLabel(type) +
        '</label>' +
        '<div class="flex gap-2 scroll-carousel pb-1">' +

          availableOptions[type]
            .map(option => {
              const isSelected = selectedOption[type] === option;
              return (
                '<button class="option-btn px-3 py-1.5 text-xs font-medium rounded-full border scroll-item ' +
                  (isSelected
                    ? 'bg-blue-500 text-white border-blue-500 shadow-md font-bold'
                    : 'bg-gray-100 border-gray-300') +
                '"' +
                ' data-type="' + type + '"' +
                ' data-option="' + escapeHtml(option) + '"' +
                ' onclick="selectOptionNoFocus(\'' + type + '\', \'' + escapeHtml(option) + '\'); return false;">' +
                  escapeHtml(option) +
                '</button>'
              );
            })
            .join('') +

          (selectedOption[type]
            ? '<button class="option-clear px-3 py-1.5 text-xs text-red-500 font-medium rounded-full border border-red-200 scroll-item w-12"' +
                ' data-type="' + type + '">✕</button>'
            : '') +

        '</div>' +
        (!availableOptions[type].length
          ? '<p class="text-xs text-gray-400 mt-1">Нет вариантов</p>'
          : '') +
      '</div>'
    );
  }).join('') +
  '<div class="quantity-section">' +
    '<label class="text-sm font-semibold text-gray-700 mb-2 block">Количество</label>' +
    '<div class="flex items-center gap-3">' +
      '<button class="px-3 py-1.5 rounded-full bg-gray-200 text-lg font-bold"' +
      ' onclick="changeQuantity(-1); return false;">-</button>' +
      '<span id="quantityValue" class="min-w-[40px] text-center font-semibold">' +
        selectedQuantity +
      '</span>' +
      '<button class="px-3 py-1.5 rounded-full bg-gray-200 text-lg font-bold"' +
      ' onclick="changeQuantity(1); return false;">+</button>' +
    '</div>' +
    '<p class="text-xs text-gray-400 mt-1">Максимум 100 шт.</p>' +
  '</div>' +

  '<div class="pt-4 border-t">' +
    '<div class="text-center text-sm text-gray-500 mb-3">' +
      'Доступно: <span id="variantCount" class="font-bold text-blue-600">' +
        getVariantCountText(availableVariants.length) +
      '</span>' +
      (complete && availableVariants.length === 1
        ? '<div class="text-xs mt-1 bg-blue-50 border border-blue-200 rounded-xl p-2">' +
            '✅ Спецификация выбрана' +
          '</div>'
        : '') +
    '</div>' +
  '</div>';

// повесим безопасные хендлеры на крестики
document.querySelectorAll('#modalBodyDynamic .option-clear').forEach(btn => {
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('touchend', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const type = btn.getAttribute('data-type');
    clearOptionNoFocus(type);
  }, { passive: false });

  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const type = btn.getAttribute('data-type');
    clearOptionNoFocus(type);
  });
});


  const btn = document.getElementById('modalAddButton');

  if (isAddingToCart) {
    btn.innerHTML = '<span class="loader-circle"></span><span>Проверяю наличие...</span>';
    btn.className =
      'w-full flex itemscenter justify-center gap-2 bg-gray-400 text-white font-semibold px-4 rounded-2xl shadow-lg  cursor-not-allowed';
    btn.disabled = true;
  } else if (complete && availableVariants.length > 0) {
    const sum = availableVariants[0].price
      ? availableVariants[0].price * selectedQuantity
      : '';
    btn.innerHTML = '✅ В корзину RUB ' + sum;
    btn.className =
      'w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 rounded-2xl shadow-lg ';
    btn.disabled = false;
  } else {
    btn.innerHTML = 'Выберите все опции';
    btn.className =
      'w-full flex items-center justify-center gap-2 bg-gray-400 text-white font-semibold px-4 rounded-2xl shadow-lg  cursor-not-allowed';
    btn.disabled = true;
  }
}

// Карусель
function initModalCarousel(imageCount) {
  if (imageCount <= 1) return;
  modalImageCount = imageCount;
  const inner =
    document.getElementById('modalSlidesWrapper') ||
    document.getElementById('modalCarouselInner');
  if (!inner) return;

  function updateModalCarousel() {
    inner.style.transform = 'translateX(-' + modalCurrentIndex * 100 + '%)';
    const dots = document.querySelectorAll('#modalDots .dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === modalCurrentIndex);
    });
  }

  window.modalNext = function () {
    modalCurrentIndex = (modalCurrentIndex + 1) % modalImageCount;
    updateModalCarousel();
    tg?.HapticFeedback?.selectionChanged();
  };

  window.modalPrev = function () {
    modalCurrentIndex =
      modalCurrentIndex === 0 ? modalImageCount - 1 : modalCurrentIndex - 1;
    updateModalCarousel();
    tg?.HapticFeedback?.selectionChanged();
  };

  window.modalGoTo = function (i) {
    modalCurrentIndex = i;
    updateModalCarousel();
    tg?.HapticFeedback?.selectionChanged();
  };

  updateModalCarousel();
}

function initModalSwipe() {
  const carousel = document.getElementById('modalCarousel');
  if (!carousel) return;

  carousel.addEventListener(
    'touchstart',
    function (e) {
      const touch = e.changedTouches[0];
      modalTouchStartX = touch.clientX;
      modalTouchStartY = touch.clientY;
    },
    { passive: true }
  );

  carousel.addEventListener(
    'touchend',
    function (e) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - modalTouchStartX;
      const dy = Math.abs(touch.clientY - modalTouchStartY);

      if (Math.abs(dx) < 40 || dy > 50) return;

      if (dx < 0) {
        window.modalNext && window.modalNext();
      } else {
        window.modalPrev && window.modalPrev();
      }
    },
    { passive: true }
  );
}

function preloadProductVariantImages(product) {
  const variants = getProductVariants(product.name).filter(v => v.inStock);
  if (!variants.length) return;

  // все уникальные картинки по вариантам этого товара
  const allImages = getFilteredProductImages(variants); // без slice

  allImages.forEach(imgSrc => {
    if (!imgSrc) return;
    if (imageCache && imageCache.has && imageCache.has(imgSrc)) return;

    const img = new Image();
    img.onload = () => {
      if (imageCache && imageCache.set) imageCache.set(imgSrc, true);
    };
    img.onerror = () => {
      if (imageCache && imageCache.set) imageCache.set(imgSrc, false);
    };
    img.src = imgSrc;
  });
}

function showModal(product) {
  if (currentTab === 'shop') {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    tabScrollTops.shop = y;
    console.log('[modal] showModal, saved shop scrollY =', y);
  }

  console.log('[modal] renderProductModal for', product?.name);
  renderProductModal(product);

  modal.classList.remove('hidden');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const scrollContainer = document.querySelector('#modalContent .flex-1');
      if (scrollContainer) scrollContainer.scrollTop = 0;
    });
  });

  tg?.expand();
  preloadProductVariantImages(product);
}

window.closeModal = function () {
  if (modalWasOpenOnShop) {
    console.log('[modal] closeModal after tab return: renderShop + restoreTabScroll(shop), scrollY =', tabScrollTops.shop);
    renderShop();
    restoreTabScroll('shop');
  } else {
    console.log('[modal] closeModal from shop (no tab switch), no renderShop');
  }

  modal.classList.add('hidden');

  selectedOption = {};
  currentProduct = null;
  selectedQuantity = 1;
  modalCurrentImageKey = null;

  modalWasOpenOnShop = false;
  modalSavedScrollTop = 0;

  const scrollContainer = document.querySelector('#modalContent .flex-1');
  if (scrollContainer) scrollContainer.scrollTop = 0;

  const modalRoot = document.getElementById('modalContent');
  if (modalRoot && modalRoot.dataset.initialized) {
    delete modalRoot.dataset.initialized;
    modalRoot.innerHTML = '';
  }

  tg?.HapticFeedback?.impactOccurred('light');
};
