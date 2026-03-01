// ===== ДЕДУПЛИКАЦИЯ ВАРИАНТОВ (ОБЩАЯ) =====

const VARIANT_TECH_FIELDS = ['Артикул', 'id', 'SKU'];

function makeVariantUserKeyWithoutPrice(variant) {
  const entries = Object.entries(variant)
    .filter(
      ([key]) => !VARIANT_TECH_FIELDS.includes(key) && key !== 'Цена'
    )
    .sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify(entries);
}

function getCategoriesFromProducts() {
  if (!productsData || !productsData.length) {
    return ['Популярное'];
  }

  const categoriesSet = new Set();

  productsData.forEach(p => {
    if (!p) return;
    if (!p.inStock) return;

    let cat = p.cat != null ? String(p.cat).trim() : '';

    if (!cat) {
      cat = 'Без категории';
    }

    categoriesSet.add(cat);
  });

  const cats = Array.from(categoriesSet).sort((a, b) =>
    a.localeCompare(b, 'ru')
  );

  return ['Популярное', ...cats];
}

function dedupeIdenticalVariants(variants) {
  const map = new Map();

  variants.forEach(v => {
    const key = makeVariantUserKeyWithoutPrice(v);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, v);
      return;
    }

    const prevPrice = Number(existing['Цена'] || 0);
    const nextPrice = Number(v['Цена'] || 0);

    if (nextPrice > prevPrice) {
      map.set(key, v);
    }
  });

  return Array.from(map.values());
}

function getFilterOrderForProduct(productCat) {
  return FILTER_ORDER_BY_CAT[productCat] || [];
}

function getActiveTypesForProduct(product, variants) {
  const order = getFilterOrderForProduct(product.cat);
  return order.filter(type =>
    variants.some(
      v => v[type] !== undefined && v[type] !== null && v[type] !== ''
    )
  );
}

function getFilteredVariants(variants) {
  if (!variants.length) return [];
  const order = getFilterOrderForProduct(variants[0].cat);
  return variants.filter(variant =>
    order.every(type => {
      const selectedValue = selectedOption[type];
      if (!selectedValue) return true;
      const v = variant[type];
      return String(v) === String(selectedValue);
    })
  );
}

function getAvailableOptions(type, variants) {
  const filteredVariants = getFilteredVariants(variants);
  const options = [
    ...new Set(filteredVariants.map(v => v[type]).filter(Boolean))
  ];
  return options.sort();
}

function normalizeProducts(products) {
  if (!Array.isArray(products)) {
    console.warn('[normalizeProducts] products is not an array', products);
    return [];
  }

  const toStr = v =>
    v === null || v === undefined ? '' : String(v).trim();

  const toNum = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const toBool = v => {
    if (typeof v === 'boolean') return v;
    const s = String(v || '').trim();
    if (!s) return false;
    return s === 'true' || s === '1' || s.indexOf('✅') !== -1;
  };

  const toImagesArray = v => {
    if (Array.isArray(v)) {
      return v.map(toStr).filter(Boolean);
    }
    if (typeof v === 'string') {
      return v
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  return products.map((row, idx) => {
    const safe = row && typeof row === 'object' ? row : {};

    const id = toStr(
      safe.id || safe.code || safe.article || safe.sku || ''
    );
    const name = toStr(safe.name || safe.title || '');
    const cat = toStr(safe.cat || safe.category || '');
    const price = toNum(safe.price);

    const storage = toStr(safe.memory || safe.storage);
    const region = toStr(safe.region);
    const simType = toStr(safe.sim || safe.simType);
    const color = toStr(safe.color);

    const diameter = toStr(safe.diameter);
    const caseColor = toStr(safe.caseColor);
    const bandColor = toStr(safe.bandColor);
    const bandType = toStr(safe.bandType);
    const bandSize = toStr(safe.bandSize);

    const diagonal = toStr(safe.diagonal);
    const ram = toStr(safe.ram);
    const ssd = toStr(safe.ssd);
    const keyboard = toStr(safe.keyboard);
    const cpu = toStr(safe.cpu);
    const gpu = toStr(safe.gpu);

    const inStock = toBool(safe.inStock);
    const commonImage = toStr(
      safe.commonImage || safe.mainImage || ''
    );
    const images = toImagesArray(safe.images);

    if (!id && name) {
      console.warn(
        '[normalizeProducts] missing id for product',
        idx,
        name
      );
    }

    return {
      id,
      name,
      price,
      cat,

      code: id,

      storage,
      region,
      simType,
      color,

      diameter,
      caseColor,
      bandColor,
      bandType,
      bandSize,

      diagonal,
      ram,
      ssd,
      keyboard,
      cpu,
      gpu,

      inStock,
      commonImage,
      images
    };
  });
}

function getFilteredProductImages(variants) {
  const images = new Set();
  variants.forEach(variant => {
    const arr = variant['Изображения'];
    if (arr && Array.isArray(arr)) {
      arr.forEach(img => {
        if (img && String(img).trim()) images.add(String(img).trim());
      });
    }
  });
  return Array.from(images);
}

// все варианты по имени товара
function getProductVariants(productName) {
  return productsData
    ? productsData.filter(p => p['Название'] === productName)
    : [];
}

function isCompleteSelection() {
  if (!currentProduct) return false;

  const allVariants = getProductVariants(
    currentProduct['Название']
  ).filter(v => v.inStock);
  if (!allVariants.length) return false;

  const filtered = getFilteredVariants(allVariants);
  if (!filtered.length) return false;

  if (filtered.length > 1) {
    const activeTypes = getActiveTypesForProduct(
      currentProduct,
      allVariants
    );
    const first = filtered[0];

    const allSame = filtered.every(v =>
      activeTypes.every(
        type =>
          String(v[type] ?? '') === String(first[type] ?? '')
      )
    );

    if (!allSame) return false;
  }
  const v = filtered[0];

  const activeTypes = getActiveTypesForProduct(
    currentProduct,
    allVariants
  );
  const finalTypes = activeTypes.filter(type =>
    filtered.some(
      variant =>
        variant[type] !== undefined &&
        variant[type] !== null &&
        variant[type] !== ''
    )
  );

  return finalTypes.every(type => {
    const value = v[type];
    if (value === undefined || value === null || value === '')
      return true;
    return !!selectedOption[type];
  });
}

function getCurrentSectionIndex() {
  if (!currentProduct) return 0;

  const variants = getProductVariants(
    currentProduct['Название']
  ).filter(v => v.inStock);
  if (!variants.length) return 0;

  const filtered = getFilteredVariants(variants);
  const activeTypes = getActiveTypesForProduct(
    currentProduct,
    variants
  );

  const finalTypes = activeTypes.filter(type =>
    filtered.some(
      v =>
        v[type] !== undefined &&
        v[type] !== null &&
        v[type] !== ''
    )
  );

  for (let i = 0; i < finalTypes.length; i++) {
    if (!selectedOption[finalTypes[i]]) return i;
  }
  return finalTypes.length;
}

function getVariantCountText(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return count + ' вариант';
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return count + ' варианта';
  }
  return count + ' вариантов';
}

function getRequiredTypesForProduct(product) {
  const variants = getProductVariants(
    product['Название']
  ).filter(v => v.inStock);
  if (!variants.length) return [];

  const order = getFilterOrderForProduct(product.cat);

  return order.filter(type => {
    const values = variants
      .map(v => v[type])
      .filter(v => v !== undefined && v !== null && v !== '');
    if (!values.length) return false;

    const unique = Array.from(new Set(values.map(String)));
    return unique.length > 1;
  });
}

function shuffleArray(items) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getMaxNumberFromName(name) {
  if (!name) return 0;
  const matches = String(name).match(/\d+/g);
  if (!matches) return 0;
  return Math.max(...matches.map(n => parseInt(n, 10) || 0));
}

// список товаров для отображения в магазине
function getVisibleProducts() {
  if (!productsData) {
    console.log(
      '[getVisibleProducts] productsData is null, query =',
      query
    );
    return [];
  }

  console.log(
    '[getVisibleProducts] START, query =',
    JSON.stringify(query),
    ', selectedCategory =',
    selectedCategory,
    ', total variants =',
    productsData.length
  );

  const groupedByName = {};

  productsData.forEach(p => {
    const title = p['Название'];
    if (!groupedByName[title]) groupedByName[title] = [];
    groupedByName[title].push(p);
  });

  let groupedVisible = Object.values(groupedByName)
    .filter(arr => arr.some(v => v.inStock))
    .map(arr => {
      const inStockVariants = arr.filter(v => v.inStock);
      const cheapestVariant = inStockVariants.reduce(
        (min, p) => (p['Цена'] < min['Цена'] ? p : min),
        inStockVariants[0]
      );
      const resolvedCat = resolveCategoryForVariants(arr);
      return {
        ...cheapestVariant,
        cat: resolvedCat
      };
    });

  console.log(
    '[getVisibleProducts] after inStock & grouping, count =',
    groupedVisible.length
  );

  if (selectedCategory !== 'Популярное') {
    groupedVisible = groupedVisible.filter(
      p => p.cat === selectedCategory
    );
    console.log(
      '[getVisibleProducts] after category filter, category =',
      selectedCategory,
      ', count =',
      groupedVisible.length
    );
  }

  if (query.trim()) {
    const q = query.trim().toLowerCase();
    groupedVisible = groupedVisible.filter(
      p =>
        (p['Название'] &&
          String(p['Название']).toLowerCase().includes(q)) ||
        (p.cat && String(p.cat).toLowerCase().includes(q))
    );
  }

  groupedVisible.sort((a, b) => {
    const na = getMaxNumberFromName(a['Название']);
    const nb = getMaxNumberFromName(b['Название']);
    if (na !== nb) {
      return nb - na;
    }
    return String(a['Название']).localeCompare(
      String(b['Название'])
    );
  });

  console.log(
    '[getVisibleProducts] END, result count =',
    groupedVisible.length
  );

  return groupedVisible;
}

// предзагрузка картинок карточек (старый код, сейчас не используется отдельно)
function preloadAllImages(products) {
  products.forEach(product => {
    const variants = getProductVariants(product.name).filter(
      v => v.inStock
    );
    const allImages = getFilteredProductImages(variants);
    allImages.forEach(imgSrc => {
      if (!imageCache.has(imgSrc) && imgSrc) {
        const img = new Image();
        img.onload = () => imageCache.set(imgSrc, true);
        img.onerror = () => imageCache.set(imgSrc, false);
        img.src = imgSrc;
      }
    });
  });
}

function getLabel(type) {
  const labels = {
    simType: 'SIM/eSIM',
    storage: 'Память',
    color: 'Цвет',
    region: 'Регион',

    diameter: 'Диаметр',
    caseColor: 'Цвет корпуса',
    bandColor: 'Цвет ремешка',
    bandType: 'Тип ремешка',
    bandSize: 'Размер ремешка',

    diagonal: 'Диагональ',
    ram: 'ОЗУ',
    ssd: 'SSD',
    gpu: 'GPU',
    cpu: 'CPU',
    keyboard: 'Раскладка'
  };
  return labels[type] || type;
}

// ---------- рендер магазина ----------

function renderShopHeader(list, showCount) {
  const categories = getCategoriesFromProducts();

  let optionsHtml = '';
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    optionsHtml +=
      '<option value="' +
      c +
      '"' +
      (c === selectedCategory ? ' selected' : '') +
      '>' +
      c +
      '</option>';
  }

  return (
    '<div class="mb-5">' +
'<div class="flex items-center justify-center mb-4 gap-2">' +
  '<a href="#" class="nav-logo">Tech<span>Bex</span></a>' +
'</div>' +
      '<div class="flex items-center gap-3">' +
      /* дальше без изменений */
      '<div class="flex-1 bg-white rounded-2xl shadow px-3 py-2">' +
      '<label class="text-xs text-gray-500 block mb-1">Категория</label>' +
      '<select id="category" class="w-full bg-transparent border-none font-semibold text-base focus:outline-none appearance-none">' +
      optionsHtml +
      '</select>' +
      '</div>' +
      '<div class="w-44 bg-white rounded-2xl shadow px-3 py-2">' +
      '<label class="text-xs text-gray-500 block mb-1">Поиск</label>' +
      '<div class="flex items-center">' +
      '<svg class="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
      ' d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"/>' +
      '</svg>' +
      '<input id="search" value="' +
      escapeHtml(query) +
      '" placeholder="Поиск..."' +
      ' class="w-full bg-transparent outline-none text-sm text-gray-900" />' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="mt-3 text-xs text-gray-500">' +
      'Показано: <span class="font-semibold">' +
      showCount +
      '</span> из ' +
      list.length +
      '</div>' +
      '</div>'
  );
}

let sessionImageLoads = new Map();

function handleProductImageSequentialLoad(
  img,
  imageSrc,
  cacheKey,
  animation
) {
  if (
    typeof failedImageUrls !== 'undefined' &&
    failedImageUrls.has(imageSrc)
  ) {
    handleProductImageError(img, imageSrc);
    return;
  }

  if (typeof markImageAsLoaded === 'function' && cacheKey) {
    markImageAsLoaded(cacheKey);
  } else if (
    typeof loadedImageUrls !== 'undefined' &&
    imageSrc
  ) {
    loadedImageUrls.add(imageSrc);
  }

  if (cacheKey) {
    const prev = sessionImageLoads.get(cacheKey) || 0;
    const current = prev + 1;
    sessionImageLoads.set(cacheKey, current);
  }

  const container = img.closest('.image-placeholder-container');
  if (!container) {
    img.classList.add('fade-in-image');
    return;
  }

  const svg = container.querySelector('.image-placeholder-svg');
  if (!svg) {
    img.classList.add('fade-in-image');
    return;
  }

  svg.classList.add('svg-fade-out');

  setTimeout(() => {
    img.classList.add('fade-in-image');
  }, 500);
}

function handleProductImageError(img, imageSrc) {
  if (typeof failedImageUrls !== 'undefined') {
    failedImageUrls.add(imageSrc);
  }

  img.style.display = 'none';
}

function productCard(product) {
  const allVariants = getProductVariants(product['Название']);
  const variants = allVariants.filter(v => v.inStock);
  if (!variants.length) return '';

  const uniqueVariants = dedupeIdenticalVariants(variants);

  const cheapestVariant = uniqueVariants.reduce(
    (min, p) => (p['Цена'] < min['Цена'] ? p : min),
    uniqueVariants[0]
  );

  const commonImage =
    product['Общая картинка'] ||
    uniqueVariants[0]?.['Общая картинка'] ||
    '';
  const hasImage = !!commonImage;
  const safeMainImage = hasImage ? commonImage.replace(/'/g, "\\'") : '';
  const carouselId =
    'carousel_' + Math.random().toString(36).substr(2, 9);

  const cacheKey = hasImage
    ? getImageCacheKey(product, safeMainImage)
    : '';

  const isLoadedPersistently =
    hasImage &&
    cacheKey &&
    typeof loadedImageCacheKeys !== 'undefined' &&
    loadedImageCacheKeys.has(cacheKey);

  const sessionCount = cacheKey
    ? sessionImageLoads.get(cacheKey) || 0
    : 0;
  const isInstant = isLoadedPersistently && sessionCount > 0;

  const isFailed =
    hasImage &&
    typeof failedImageUrls !== 'undefined' &&
    failedImageUrls.has(safeMainImage);

  console.log('[persist-debug]', {
    name: product['Название'],
    hasImage,
    cacheKey,
    cacheSetDefined:
      typeof loadedImageCacheKeys !== 'undefined',
    inSet:
      typeof loadedImageCacheKeys !== 'undefined'
        ? loadedImageCacheKeys.has(cacheKey)
        : null,
    isLoadedPersistently
  });

  return (
    '<div class="bg-white rounded-2xl p-4 shadow-lg group cursor-pointer relative w-full"' +
    ' data-product-name="' +
    escapeHtml(product['Название']) +
    '"' +
    ' data-carousel-id="' +
    carouselId +
    '">' +
    '<div class="w-full h-32 rounded-xl mb-3 image-carousel cursor-pointer overflow-hidden relative">' +
    '<div class="image-placeholder-container relative w-full h-full">' +
    (!hasImage
      ? '<div class="image-placeholder-svg absolute inset-0">' +
        getPlainSvgPlaceholder() +
        '</div>'
      : (!isInstant && !isLoadedPersistently) || isFailed
      ? '<div class="image-placeholder-svg absolute inset-0">' +
        getPlainSvgPlaceholder() +
        '</div>'
      : '') +
    (!hasImage || isFailed
      ? ''
      : '<img src="' +
        commonImage +
        '" ' +
        'class="carousel-img product-image absolute inset-0 object-contain ' +
        (isInstant ? '' : 'animatable') +
        '" ' +
        'alt="Product" ' +
        'data-src="' +
        safeMainImage +
        '" ' +
        (isInstant
          ? ''
          : 'onload="handleProductImageSequentialLoad(this, \'' +
            safeMainImage +
            '\', \'' +
            cacheKey +
            '\')" ') +
        'onerror="handleProductImageError(this, \'' +
        safeMainImage +
        '\')" ' +
        '/>') +
    '</div>' +
    '<div class="image-carousel-inner relative w-full h-full" data-carousel="' +
    carouselId +
    '" data-current="0">' +
    '</div>' +
    '</div>' +
    '<div class="font-bold text-base mb-1 product-title">' +
    escapeHtml(product['Название']) +
    '</div>' +
    '<div class="text-blue-600 font-black text-xl mb-1">RUB ' +
    formatPrice(cheapestVariant['Цена']) +
    '</div>' +
    '<div class="text-xs text-gray-500 mb-4">' +
    getVariantCountText(uniqueVariants.length) +
    '</div>' +
    '</div>'
  );
}

function renderShopList(list, showCount) {
  return list
    .slice(0, showCount)
    .map(productCard)
    .join('');
}

let isFirstShopRender = true;

function getImageCacheKey(product, url) {
  const version = product.imageVersion || product.updatedAt || '';
  return url + '|' + version;
}

// итоговая категория для группы вариантов
function resolveCategoryForVariants(variants) {
  const counts = new Map();
  let hasNonEmptyCategory = false;

  variants.forEach(v => {
    let raw = v.cat != null ? String(v.cat).trim() : '';
    if (raw === 'Без категории') {
      raw = '';
    }
    if (!raw) {
      return;
    }
    hasNonEmptyCategory = true;
    counts.set(raw, (counts.get(raw) || 0) + 1);
  });

  if (!hasNonEmptyCategory) {
    return 'Без категории';
  }

  let bestCount = 0;
  let candidates = [];

  counts.forEach((cnt, cat) => {
    if (cnt > bestCount) {
      bestCount = cnt;
      candidates = [cat];
    } else if (cnt === bestCount) {
      candidates.push(cat);
    }
  });

  if (candidates.length === 1) {
    return candidates[0];
  }

  const productName =
    variants[0] && variants[0]['Название']
      ? String(variants[0]['Название'])
      : '';

  const nameLower = productName.toLowerCase();

  for (let i = 0; i < candidates.length; i++) {
    const cat = candidates[i];
    if (!cat) continue;
    if (nameLower.includes(String(cat).toLowerCase())) {
      return cat;
    }
  }

  return candidates[0];
}

function rerenderShopPreserveSearchFocus() {
  const prevValue =
    document.getElementById('search')?.value || query || '';
  const hadFocus =
    document.activeElement &&
    document.activeElement.id === 'search';

  renderShop();

  const newSearch = document.getElementById('search');
  if (newSearch) {
    newSearch.value = prevValue;
    if (hadFocus) {
      newSearch.focus();
      const len = newSearch.value.length;
      newSearch.setSelectionRange(len, len);
    }
  }
}

// ------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ НОВОЙ СХЕМЫ ПРОГРЕВА -------

// main-изображение для товара (предпросмотр карточки)
function getMainProductImage(p) {
  if (!p) return '';
  if (p['Общая картинка']) return String(p['Общая картинка']).trim();
  if (p.commonImage) return String(p.commonImage).trim();
  return '';
}

// все изображения товара (main + галереи)
function getAllProductImages(p) {
  const urls = new Set();

  const main = getMainProductImage(p);
  if (main) urls.add(main);

  const rawImages = p['Изображения'] || p.images;
  if (Array.isArray(rawImages)) {
    rawImages.forEach(u => {
      if (u) urls.add(String(u).trim());
    });
  } else if (typeof rawImages === 'string') {
    rawImages.split(',').forEach(u => {
      const s = u.trim();
      if (s) urls.add(s);
    });
  }

  return Array.from(urls);
}

// сбор отдельных очередей main/other с приоритетом iPhone
function buildSeparatedPreloadQueues(allProducts) {
  const mainQueue = [];
  const otherQueueIphone = [];
  const otherQueueOther = [];

  if (!allProducts || !allProducts.length) {
    return { mainQueue, otherQueue: [] };
  }

  allProducts.forEach(p => {
    if (!p || !p.inStock) return;

    const mainUrl = getMainProductImage(p);
    if (mainUrl) mainQueue.push(mainUrl);

    const urls = getAllProductImages(p);
    const cat = (p.cat || p['Категория'] || '')
      .toString()
      .toLowerCase();
    const targetArr = cat.includes('iphone')
      ? otherQueueIphone
      : otherQueueOther;

    urls.forEach(u => {
      if (!u) return;
      if (u === mainUrl) return;
      targetArr.push(u);
    });
  });

  const seenMain = new Set();
  const finalMain = [];
  mainQueue.forEach(u => {
    if (!u) return;
    if (seenMain.has(u)) return;
    seenMain.add(u);
    finalMain.push(u);
  });

  const seenOther = new Set();
  const finalOther = [];
  [...otherQueueIphone, ...otherQueueOther].forEach(u => {
    if (!u) return;
    if (seenOther.has(u)) return;
    seenOther.add(u);
    finalOther.push(u);
  });

  return { mainQueue: finalMain, otherQueue: finalOther };
}

// --------- Рендер магазина ---------

function renderShop() {
  console.log('---------------- [renderShop] ----------------');
  console.log(
    '[renderShop] BEFORE getVisibleProducts, query =',
    JSON.stringify(query),
    ', selectedCategory =',
    selectedCategory,
    ', loadedCount =',
    loadedCount
  );
  const categories = getCategoriesFromProducts();
  if (!productsData || productsData.length === 0) {
    root.innerHTML =
      '<div class="flex flex-col items-center justify-center min-h-[70vh] text-center p-8 pb-[65px] max-w-md mx-auto">' +
      '<div class="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mb-4">' +
      '<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
      ' d="M3 4h2l1.5 11h10.5L20 7H7" />' +
      '<circle cx="8" cy="19" r="1.5" stroke-width="2" />' +
      '<circle cx="16" cy="19" r="1.5" stroke-width="2" />' +
      '</svg>' +
      '</div>' +
      '<h2 class="text-xl font-bold text-gray-800 mb-2">Нет товаров</h2>' +
      '<p class="text-sm text-gray-500 mb-4 max-w-xs text-center">Проверьте соединение и попробуйте обновить список товаров. Для заказа через менеджера напишите @TechBex.</p>' +
      '<button onclick="refreshProducts()"' +
      ' class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-6 rounded-2xl shadow-lg  text-sm">' +
      'Обновить товары' +
      '</button>' +
      '</div>';
    return;
  }

  const list = getVisibleProducts();

  let showCount;
  if (query.trim()) {
    showCount = list.length;
  } else {
    showCount = Math.min(loadedCount, list.length);
  }

  console.log(
    '[renderShop] AFTER getVisibleProducts, query =',
    JSON.stringify(query),
    ', list.length =',
    list.length,
    ', loadedCount =',
    loadedCount,
    ', showCount =',
    showCount
  );

  const activeEl = document.activeElement;
  const isSearchFocused =
    activeEl && activeEl.id === 'search';

  if (isSearchFocused && document.getElementById('productGrid')) {
    const grid = document.getElementById('productGrid');
    const sentinelEl = document.getElementById('scrollSentinel');

    if (grid) {
      grid.innerHTML = renderShopList(list, showCount);

      const counterEl = document.querySelector(
        '.mt-3.text-xs.text-gray-500'
      );
      if (counterEl) {
        counterEl.innerHTML =
          'Показано: <span class="font-semibold">' +
          showCount +
          '</span> из ' +
          list.length;
      }

      setupHandlers();
      setupImageCarousels();
      setupInfiniteScroll();
    }

    if (sentinelEl) {
      sentinelEl.innerHTML =
        showCount < list.length
          ? '<div class="w-full">' +
            '<div class="h-4 w-3/4 mx-auto mb-2 rounded placeholder-shimmer"></div>' +
            '<div class="h-4 w-1/2 mx-auto rounded placeholder-shimmer"></div>' +
            '</div>'
          : '';
    }

    return;
  }

  console.log('[renderShop] branch: full rerender');

  root.innerHTML =
    '<div class="pb-[65px]">' +
    '<div class="mb-5">' +
'<div class="flex items-center justify-center mb-4 gap-2">' +
  '<a href="#" class="nav-logo">Tech<span>Bex</span></a>' +
'</div>' +
  '<div class="flex items-center gap-3">' +
  /* дальше текущий код с categorySelect + search */
    '<div class="flex-1 bg-white rounded-2xl shadow px-3 py-2 relative">' +
    '<label class="text-xs text-gray-500 block mb-1">Категория</label>' +
    '<div id="categorySelect" class="relative">' +
    '<button type="button"' +
    ' id="categorySelectButton"' +
    ' class="w-full text-left font-semibold text-base flex items-center justify-between gap-2">' +
    '<span id="categorySelectLabel">' +
    escapeHtml(selectedCategory) +
    '</span>' +
    '<svg class="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor">' +
    '<path d="M6 8l4 4 4-4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />' +
    '</svg>' +
    '</button>' +
    '<div id="categorySelectDropdown"' +
    ' class="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg z-30 max-h-64 overflow-y-auto hidden">' +
    categories
      .map(
        c =>
          '<button type="button"' +
          ' class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-100' +
          (c === selectedCategory
            ? ' text-blue-600 font-semibold'
            : ' text-gray-800') +
          '"' +
          ' data-value="' +
          escapeHtml(c) +
          '">' +
          (c === selectedCategory
            ? '<span class="text-blue-500">✓</span>'
            : '<span class="w-4"></span>') +
          '<span>' +
          escapeHtml(c) +
          '</span>' +
          '</button>'
      )
      .join('') +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="w-44 bg-white rounded-2xl shadow px-3 py-2">' +
    '<label class="text-xs text-gray-500 block mb-1">Поиск</label>' +
    '<div class="flex items-center">' +
    '<svg class="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
    ' d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"/>' +
    '</svg>' +
    '<input id="search" value="' +
    escapeHtml(query) +
    '" placeholder="Поиск..."' +
    ' class="w-full bg-transparent outline-none text-sm text-gray-900" />' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="mt-3 text-xs text-gray-500">' +
    'Показано: <span class="font-semibold">' +
    showCount +
    '</span> из ' +
    list.length +
    '</div>' +
    '</div>' +
    '<div class="product-grid" id="productGrid"></div>' +
    '<div id="scrollSentinel" class="h-10 flex items-center justify-center mt-4">' +
    (showCount < list.length
      ? '<div class="w-full">' +
        '<div class="h-4 w-3/4 mx-auto mb-2 rounded placeholder-shimmer"></div>' +
        '<div class="h-4 w-1/2 mx-auto rounded placeholder-shimmer"></div>' +
        '</div>'
      : '') +
    '</div>' +
    '</div>';

  const grid = document.getElementById('productGrid');
  if (grid) {
    grid.innerHTML = renderShopList(list, showCount);
    console.log(
      '[renderShop] grid updated (full rerender), rendered items =',
      showCount
    );
  } else {
    console.log('[renderShop] grid element NOT FOUND');
  }

  setupHandlers();
  setupImageCarousels();
  setupInfiniteScroll();

  isFirstShopRender = false;
  console.log('---------------- [/renderShop] ----------------');
  if (!hasShopLoadedOnce) {
    hasShopLoadedOnce = true;
    try {
      if (typeof trackEvent === 'function') {
        trackEvent('shop_loaded', {
          products_count: Array.isArray(productsData) ? productsData.length : 0
        });
      }
    } catch (e) {}
  }  
}

// ---------- навешивание обработчиков ----------

function setupHandlers() {
  const categoryButton =
    document.getElementById('categorySelectButton');
  const categoryDropdown = document.getElementById(
    'categorySelectDropdown'
  );
  const categoryLabel =
    document.getElementById('categorySelectLabel');
  const searchEl = document.getElementById('search');

  if (categoryButton && categoryDropdown) {
    categoryButton.onclick = function (e) {
      e.stopPropagation();
      const isHidden =
        categoryDropdown.classList.contains('hidden');
      if (isHidden) {
        categoryDropdown.classList.remove('hidden');
      } else {
        categoryDropdown.classList.add('hidden');
      }
    };

    categoryDropdown
      .querySelectorAll('button[data-value]')
      .forEach(btn => {
        btn.onclick = function (e) {
          e.stopPropagation();
          const value =
            btn.getAttribute('data-value') || 'Популярное';

          selectedCategory = value;
          loadedCount = 10;

          try {
            if (typeof trackEvent === 'function') {
              trackEvent('category_change', {
                category: value
              });
            }
          } catch (e2) {}

          if (categoryLabel) {
            categoryLabel.textContent = value;
          }

          categoryDropdown.classList.add('hidden');

          if (currentTab === 'shop') {
            renderShop();
          }
        };
      });

    document.addEventListener('click', function (e) {
      if (!categoryDropdown) return;
      const root = document.getElementById('categorySelect');
      if (!root) return;
      if (!root.contains(e.target)) {
        categoryDropdown.classList.add('hidden');
      }
    });
  }

  if (searchEl) {
    searchEl.onfocus = () => hideTabBar();
    searchEl.onblur = () => showTabBar();

    searchEl.oninput = function () {
      const value = searchEl.value || '';
      console.log(
        '[search.oninput] raw value =',
        JSON.stringify(value),
        ', old query =',
        JSON.stringify(query)
      );

      query = value;

      try {
        if (typeof trackEvent === 'function') {
          trackEvent('search_change', {
            query: value,
            has_text: !!value.trim()
          });
        }
      } catch (e2) {}

      loadedCount = 10;

      console.log(
        '[search.oninput] NEW query =',
        JSON.stringify(query),
        ', loadedCount reset to',
        loadedCount
      );

      if (currentTab === 'shop') {
        console.log(
          '[search.oninput] calling rerenderShopPreserveSearchFocus'
        );
        rerenderShopPreserveSearchFocus();
      }
    };

    searchEl.onkeydown = function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = searchEl.value || '';
        console.log(
          '[search.onkeydown] ENTER, value =',
          JSON.stringify(value),
          ', old query =',
          JSON.stringify(query)
        );

        query = value;

        try {
          if (typeof trackEvent === 'function') {
            trackEvent('search_submit', {
              query: value.trim(),
              length: value.trim().length
            });
          }
        } catch (e2) {}

        loadedCount = 10;

        console.log(
          '[search.onkeydown] NEW query =',
          JSON.stringify(query),
          ', loadedCount reset to',
          loadedCount
        );

        if (currentTab === 'shop') {
          console.log(
            '[search.onkeydown] calling rerenderShopPreserveSearchFocus'
          );
          rerenderShopPreserveSearchFocus();
        }
      }
    };
  }

  document.querySelectorAll('[data-product-name]').forEach(card => {
    card.onclick = function (e) {
      if (e.target.closest('button') || e.target.closest('.dot'))
        return;

      const active = document.activeElement;
      if (active && active.blur) active.blur();

      const productName = card.dataset.productName;
      const product = productsData.find(
        p => p['Название'] === productName
      );
      if (!product) return;

      selectedOption = {};
      selectedQuantity = 1;

      try {
        if (typeof trackEvent === 'function') {
          trackEvent('product_view', {
            product_name: product['Название'] || null,
            category: product.cat || null
          });
        }
      } catch (e2) {}

      setTimeout(() => {
        showModal(product);
        tg?.HapticFeedback?.impactOccurred('medium');
      }, 50);
    };
  });
}

// ---------- карусели на карточках ----------

function setupImageCarousels() {
  Object.keys(window)
  .filter(k =>
    k.startsWith('carouselNext_') ||
    k.startsWith('carouselPrev_') ||
    k.startsWith('carouselGoTo_')
  )
  .forEach(k => delete window[k]);
  
  document
    .querySelectorAll('.image-carousel-inner[data-carousel]')
    .forEach(inner => {
      const dots = inner.parentElement.querySelectorAll('.dot');
      const carouselId = inner.dataset.carousel;
      let currentIndex = 0;

      function updateCarousel() {
        inner.style.transform =
          'translateX(-' + currentIndex * 100 + '%)';
        dots.forEach((dot, idx) => {
          dot.classList.toggle('active', idx === currentIndex);
        });
      }

      window['carouselNext_' + carouselId] = function () {
        currentIndex = (currentIndex + 1) % inner.children.length;
        updateCarousel();
        tg?.HapticFeedback?.selectionChanged();
      };

      window['carouselPrev_' + carouselId] = function () {
        currentIndex =
          currentIndex === 0
            ? inner.children.length - 1
            : currentIndex - 1;
        updateCarousel();
        tg?.HapticFeedback?.selectionChanged();
      };

      window['carouselGoTo_' + carouselId] = function (index) {
        currentIndex = index;
        updateCarousel();
        tg?.HapticFeedback?.selectionChanged();
      };

      dots.forEach((dot, idx) => {
        dot.onclick = function (e) {
          e.stopPropagation();
          currentIndex = idx;
          updateCarousel();
          tg?.HapticFeedback?.selectionChanged();
        };
      });

      updateCarousel();
    });
}

window.carouselNext = function (id) {
  if (window['carouselNext_' + id]) window['carouselNext_' + id]();
};
window.carouselPrev = function (id) {
  if (window['carouselPrev_' + id]) window['carouselPrev_' + id]();
};
window.carouselGoTo = function (id, index) {
  if (window['carouselGoTo_' + id])
    window['carouselGoTo_' + id](index);
};
