const tg = window.Telegram?.WebApp;
try {
  tg?.ready();
  tg?.expand();
  tg?.setBackgroundColor?.('#f3f4f6'); // bg-gray-100
} catch (e) {
  console.log('[core] tg init error', e);
}

const API_URL =
  'https://script.google.com/macros/s/AKfycbyTyFoMfjn5gHa8JNqnld1Gm1Zqivy_p2rfC1nym-17f3GYvpXqRar8ctPZ0pJOAP2N-w/exec';
const ORDERS_API_URL = 'https://tg-shop-test-backend.onrender.com/orders';
const BACKEND_ORDER_URL = 'https://tg-shop-test-backend.onrender.com/order';

const isMobileDevice =
  (navigator.userAgentData && navigator.userAgentData.mobile) ||
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(
    navigator.userAgent || ''
  );

// --------- Глобальный стейт ---------

let CATEGORIES = ['Все'];
let isOrdersLoading = false;

let FILTER_ORDER_BY_CAT = {}; // динамический порядок фильтров по категориям

// поля, которые не должны участвовать в фильтрах/модалке
const EXCLUDE_FILTER_FIELDS = new Set([
  'id',
  'cat',
  'inStock',
  'Название',
  'Цена',
  'Категория',
  'Артикул',
  'Статус',
  'Общая картинка',
  'Изображения'
]);

let selectedCategory = 'Все',
  query = '',
  loadedCount = 10,
  imageCache = new Map(),
  productsData = null,
  currentProduct = null,
  selectedOption = {},
  selectedQuantity = 1,
  searchTimeout = null,
  currentTab = 'shop';

let cartItems = [];
let savedAddresses = [];
let previousOrders = [];

let savedProfile = {
  name: '',
  phone: '',
  confirmed: false
};

let paymentType = 'cash';
let pickupMode = false;
let pickupLocation = '';

const PICKUP_LOCATIONS = [
  'ТЦ Галерея, пр-т Победителей, 9',
  'ТРЦ Dana Mall, ул. Петра Мстиславца, 11'
];

let isAddingToCart = false;
let isPlacingOrder = false;
let isRefreshingProducts = false;
let isTabChanging = false;
let placeOrderTimeoutId = null;

// модалка при переключении табов
let modalWasOpenOnShop = false;
let modalSavedScrollTop = 0;
let modalClosedAfterTabReturn = false;

// сохранение состояния формы корзины между рендерами
let cartFormState = {
  addressText: '',
  comment: '',
  contactName: '',
  contactPhone: '',
  savedAddressValue: '',
  pickupLocationValue: '',
  contactConfirmed: false,
  contactEditedManually: false
};

const root = document.getElementById('root');
const modal = document.getElementById('productModal');

// ---------- Глобальная обработка ошибок ----------

window.onerror = function (message, source, lineno, colno, error) {
  try {
    console.error('Global error:', message, source, lineno, colno, error);
  } catch (_) {
    // на всякий случай
  }

  try {
    // без несуществующего showError
    tg?.showAlert?.(
      'Произошла ошибка в приложении. Попробуйте обновить Mini App.'
    );
  } catch (_) {
    // глушим любые падения внутри onerror
  }

  // true = не пускать ошибку дальше
  return true;
};

// ---------- localStorage (корзина, адреса, профиль) ----------

function saveCartToStorage() {
  try {
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
  } catch (e) {
    console.log('[core] saveCartToStorage error', e);
  }
}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('cartItems');
    cartItems = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.log('[core] loadCartFromStorage error', e);
    cartItems = [];
  }
  console.log('[core] cartItems loaded', cartItems);
  updateCartBadge();
}

function saveAddressesToStorage() {
  try {
    localStorage.setItem('addresses', JSON.stringify(savedAddresses));
  } catch (e) {
    console.log('[core] saveAddressesToStorage error', e);
  }
}

function loadAddressesFromStorage() {
  try {
    const raw = localStorage.getItem('addresses');
    savedAddresses = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.log('[core] loadAddressesFromStorage error', e);
    savedAddresses = [];
  }
  console.log('[core] savedAddresses loaded', savedAddresses);
}

function saveProfileToStorage() {
  try {
    localStorage.setItem('profile', JSON.stringify(savedProfile));
  } catch (e) {
    console.log('[core] saveProfileToStorage error', e);
  }
}

function buildFilterOrderByCat(products) {
  const map = {};

  products.forEach(p => {
    const cat = p.cat || 'default';
    if (!map[cat]) map[cat] = new Set();

    Object.keys(p).forEach(key => {
      if (EXCLUDE_FILTER_FIELDS.has(key)) return;

      const value = p[key];
      if (value === undefined || value === null || value === '') return;

      map[cat].add(key);
    });
  });

  const result = {};
  Object.keys(map).forEach(cat => {
    result[cat] = Array.from(map[cat]);
  });
  return result;
}

const DELIVERY_PREFS_KEY = 'deliveryPrefs_v1';

let deliveryPrefs = {
  paymentType: 'cash',
  pickupMode: false,
  pickupLocation: '',
  savedAddressValue: ''
};

function loadDeliveryPrefs() {
  try {
    const raw = localStorage.getItem(DELIVERY_PREFS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    deliveryPrefs.paymentType = parsed.paymentType ?? 'cash';
    deliveryPrefs.pickupMode = !!parsed.pickupMode;
    deliveryPrefs.pickupLocation = parsed.pickupLocation || '';
    deliveryPrefs.savedAddressValue = parsed.savedAddressValue || '';

    paymentType = deliveryPrefs.paymentType;
    pickupMode = deliveryPrefs.pickupMode;
    pickupLocation = deliveryPrefs.pickupLocation;
    cartFormState.savedAddressValue = deliveryPrefs.savedAddressValue;
  } catch (e) {
    console.log('[core] loadDeliveryPrefs error', e);
  }
}

function saveDeliveryPrefs() {
  try {
    const data = {
      paymentType,
      pickupMode,
      pickupLocation,
      savedAddressValue: cartFormState.savedAddressValue || ''
    };
    localStorage.setItem(DELIVERY_PREFS_KEY, JSON.stringify(data));
  } catch (e) {
    console.log('[core] saveDeliveryPrefs error', e);
  }
}

function loadProfileFromStorage() {
  try {
    const raw = localStorage.getItem('profile');
    if (!raw) {
      savedProfile = { name: '', phone: '', confirmed: false };
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      savedProfile = {
        name: parsed.name || '',
        phone: parsed.phone || '',
        confirmed: !!parsed.confirmed
      };
    }
  } catch (e) {
    console.log('[core] loadProfileFromStorage.error', e);
    savedProfile = { name: '', phone: '', confirmed: false };
  }
  console.log('[core] savedProfile loaded', savedProfile);
}

// заказы всегда только с сервера
function saveOrdersToStorage() {}
function loadOrdersFromStorage() {
  previousOrders = [];
  console.log('[core] previousOrders reset to []');
}

// ---------- Запрет зума ----------

document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());
document.addEventListener(
  'touchstart',
  e => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false }
);

// ---------- Таббар ----------

function setTabBarDisabled(disabled) {
  const tabBar = document.getElementById('tabBar');
  if (!tabBar) return;
  if (disabled) {
    tabBar.classList.add('pointer-events-none');
  } else {
    tabBar.classList.remove('pointer-events-none');
  }
}

function hideTabBar() {
  if (!isMobileDevice) return;
  const tabBar = document.getElementById('tabBar');
  if (!tabBar) return;
  tabBar.style.opacity = '0';
  tabBar.style.pointerEvents = 'none';
}

function showTabBar() {
  if (!isMobileDevice) return;
  const tabBar = document.getElementById('tabBar');
  if (!tabBar) return;
  tabBar.style.opacity = '1';
  tabBar.style.pointerEvents = 'auto';
}

function updateTabBarActive() {
  document
    .querySelectorAll('#tabBar .tab-item')
    .forEach(t => t.classList.remove('active'));

  const activeEl = document.querySelector('[data-tab="' + currentTab + '"]');
  if (activeEl) activeEl.classList.add('active');
}

function initTabBar() {
  console.log('[core] initTabBar');

  const tabs = Array.from(document.querySelectorAll('#tabBar .tab-item'));

  const handler = e => {
    e.preventDefault();
    e.stopPropagation();

    if (isTabChanging) return;

    const tab = e.currentTarget;
    const tabName = tab.dataset.tab;
    if (!tabName || tabName === currentTab) return;

    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    isTabChanging = true;
    setTabBarDisabled(true);

    switchTab(tabName);
  };

  tabs.forEach(tab => {
    tab.addEventListener('pointerdown', handler);
    tab.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  updateTabBarActive();
}

// ---------- Скролл по табам ----------

const tabScrollTops = {
  shop: 0,
  cart: 0,
  sale: 0,
  profile: 0,
  about: 0
};

function saveCurrentTabScroll() {
  // не трогаем сохранённый скролл магазина,
  // если модалка была открыта на shop и мы в процессе этих туда‑сюда switchTab
  if (currentTab === 'shop' && modalWasOpenOnShop) {
    return;
  }

  const y = window.scrollY || document.documentElement.scrollTop || 0;
  if (tabScrollTops.hasOwnProperty(currentTab)) {
    tabScrollTops[currentTab] = y;
  }
}

function restoreTabScroll(tabName) {
  const y = tabScrollTops.hasOwnProperty(tabName) ? tabScrollTops[tabName] : 0;
  window.scrollTo(0, y > 0 ? y : 0);
}

// ---------- Переключение табов ----------

function switchTab(tabName) {
  console.log('[core] switchTab from', currentTab, 'to', tabName);

  if (currentTab === tabName) {
    isTabChanging = false;
    setTabBarDisabled(false);
    return;
  }

  // перед уходом с корзины — сохранить форму
  if (currentTab === 'cart') {
    try {
      saveCartFormState();
    } catch (e) {
      console.log('[core] saveCartFormState on tab switch error', e);
    }
  }

  const prevTab = currentTab;
  saveCurrentTabScroll();

  // спец‑логика выхода из shop (модалка)
// спец‑логика выхода из shop (модалка)
if (currentTab === 'shop' && tabName !== 'shop') {
  if (modal && !modal.classList.contains('hidden')) {
    const scrollContainer = document.querySelector('#modalContent .flex-1');
    modalSavedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    modalWasOpenOnShop = true;
    modal.classList.add('hidden'); // только скрыть
    console.log('[modal] hide on tab switch, saved modal scroll =', modalSavedScrollTop);
  } else {
    modalWasOpenOnShop = false;
    modalSavedScrollTop = 0;
    console.log('[modal] no open modal on leaving shop');
  }
}

  Promise.resolve()
    .then(() => {
      if (tabName === 'shop') {
        if (modalWasOpenOnShop && currentProduct && modal) {
          console.log('[modal] return to shop with open modal, restore modal scroll =', modalSavedScrollTop);
          modal.classList.remove('hidden');
          const scrollContainer = document.querySelector('#modalContent .flex-1');
          if (scrollContainer) scrollContainer.scrollTop = modalSavedScrollTop;
        } else {
          console.log('[modal] return to shop without modal, rerender shop');
          modalWasOpenOnShop = false;
          modalSavedScrollTop = 0;
          renderShop();
          restoreTabScroll('shop');
        }
      }           
       else if (tabName === 'cart') {
        showCartTab();
        restoreTabScroll('cart');
      } else if (tabName === 'sale') {
        showSaleTab();
        restoreTabScroll('sale');
      } else if (tabName === 'profile') {
        showProfileTab();
        restoreTabScroll('profile');
      } else if (tabName === 'about') {
        showAboutTab();
        restoreTabScroll('about');
      }

      currentTab = tabName;
      updateTabBarActive();
    })
    .catch(err => {
      console.error('[core] switchTab error', err);
      currentTab = prevTab;
      updateTabBarActive();
    })
    .finally(() => {
      isTabChanging = false;
      setTabBarDisabled(false);
      // при смене таба всегда гарантированно показываем таббар
      showTabBar();
    });
}

// ---------- Синхронизация корзины и товаров ----------

function syncCartWithProducts() {
  if (!productsData) return;
  cartItems = cartItems.map(item => {
    const exists = productsData.some(p => p.id === item.id && p.inStock);
    return { ...item, available: exists };
  });
  console.log('[core] syncCartWithProducts result', cartItems);
  saveCartToStorage();
  updateCartBadge();
}

function syncProductsAndCart() {
  syncCartWithProducts();
  if (currentTab === 'shop') {
    renderShop();
  }
  if (currentTab === 'cart') {
    showCartTab();
  }
}

// ---------- Метрики ----------

function logStage(label, startTime) {
  const now = performance.now();
  console.log(`[perf] ${label}: ${Math.round(now - startTime)} ms`);
}

// ---------- Загрузка товаров с API ----------

async function fetchAndUpdateProducts(showLoader = false) {
  const t0 = performance.now();
  console.log('[core] fetchAndUpdateProducts start, showLoader =', showLoader, 'tab=', currentTab);

  if (showLoader && currentTab === 'shop') {
    root.innerHTML =
      '<div class="pb-[65px] max-w-md mx-auto">' +
        '<div class="mb-5">' +
          '<div class="h-6 w-32 mb-4 rounded placeholder-shimmer"></div>' +
          '<div class="flex items-center gap-3">' +
            '<div class="flex-1 bg-white rounded-2xl px-3 py-2">' +
              '<div class="h-3 w-20 mb-2 rounded placeholder-shimmer"></div>' +
              '<div class="h-4 w-full rounded placeholder-shimmer"></div>' +
            '</div>' +
            '<div class="w-44 bg-white rounded-2xl px-3 py-2">' +
              '<div class="h-3 w-16 mb-2 rounded placeholder-shimmer"></div>' +
              '<div class="h-4 w-full rounded placeholder-shimmer"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="product-grid">' +
          Array.from({ length: 6 }).map(() =>
            '<div class="bg-white rounded-2xl p-4 shadow-lg">' +
              '<div class="h-32 mb-3 rounded-xl overflow-hidden">' +
                '<div class="w-full h-full rounded-xl placeholder-shimmer"></div>' +
              '</div>' +
              '<div class="h-4 w-3/4 mb-2 rounded placeholder-shimmer"></div>' +
              '<div class="h-5 w-1/2 mb-2 rounded placeholder-shimmer"></div>' +
              '<div class="h-3 w-1/3 rounded placeholder-shimmer"></div>' +
            '</div>'
          ).join('') +
        '</div>' +
      '</div>';
  }

  try {
    const response = await fetch(API_URL);
    logStage('products fetch', t0);
    console.log('[core] products response status', response.status);

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const products = await response.json();
    logStage('products json parse', t0);
    console.log('[core] products count', Array.isArray(products) ? products.length : 'not array');

    // БЕЗ normalizeProducts: работаем напрямую с данными из doGet
    productsData = Array.isArray(products) ? products : [];

    FILTER_ORDER_BY_CAT = buildFilterOrderByCat(productsData);
    console.log('[core] FILTER_ORDER_BY_CAT', FILTER_ORDER_BY_CAT);

    const cats = Array.from(new Set(productsData.map(p => p.cat).filter(Boolean)));
    CATEGORIES = ['Все', ...cats];
    console.log('[core] CATEGORIES', CATEGORIES);

    syncProductsAndCart();
    logStage('update productsData + sync', t0);
  } catch (error) {  
    console.error('[core] products API error:', error);
    if (showLoader && currentTab === 'shop') {
      isRefreshingProducts = false;
      root.innerHTML =
        '<div class="flex flex-col items-center justify-center min-h-[70vh] text-center p-8 pb-[65px] max-w-md mx-auto">' +
          '<div class="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center mb-4">' +
            '<svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
              ' d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
            '</svg>' +
          '</div>' +
          '<h2 class="text-xl font-bold text-gray-800 mb-2">Не удалось загрузить товары</h2>' +
          '<p class="text-sm text-gray-500 mb-4 max-w-xs">' +
            'Проверьте соединение и попробуйте обновить список товаров.' +
          '</p>' +
          '<button onclick="refreshProducts()"' +
            ' class="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-2xl shadow-lg text-sm">' +
            '<span class="loader-circle"></span>' +
            '<span>Обновить товары</span>' +
          '</button>' +
        '</div>';
    }
  }
}

// ---------- Загрузка изображений с таймаутом ----------

let loadedImageUrls = new Set();
let failedImageUrls = new Set();

function getPlainSvgPlaceholder() {
  return (
    '<div class="placeholder-wrapper bg-gray-100 w-full h-full flex items-center justify-center">' +
      '<svg class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
        ' d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>' +
        '</svg>' +
    '</div>'
  );
}

function attachImageTimeout(img) {
  try {
    const url = img.getAttribute('data-src') || img.src;

    if (loadedImageUrls.has(url) || failedImageUrls.has(url)) {
      img.style.opacity = '1';
      const wrapper = img.closest('.image-carousel');
      const skeleton = wrapper ? wrapper.querySelector('[data-skeleton="image"]') : null;
      if (skeleton) skeleton.remove();
      return;
    }

    if (img.dataset.loadTimeoutAttached === '1') return;
    img.dataset.loadTimeoutAttached = '1';

    const timeoutId = setTimeout(() => {
      if (loadedImageUrls.has(url) || failedImageUrls.has(url)) return;

      const wrapper = img.closest('.image-carousel');
      const skeleton = wrapper ? wrapper.querySelector('[data-skeleton="image"]') : null;

      if (wrapper) {
        const inner = wrapper.querySelector('.image-carousel-inner');
        if (inner) {
          inner.innerHTML = getPlainSvgPlaceholder();
        }
      }

      if (skeleton) skeleton.remove();

      delete img.dataset.loadTimeoutAttached;
      delete img.dataset.loadTimeoutId;

      failedImageUrls.add(url);
    }, 10000);

    img.dataset.loadTimeoutId = String(timeoutId);
  } catch (e) {
    console.log('[images] attachImageTimeout error', e);
  }
}

function setupImageTimeoutsForGrid() {
  document.querySelectorAll('.product-grid img.product-image').forEach(img => {
    attachImageTimeout(img);
  });
}

window.handleProductImageError = function (img, url) {
  try {
    const wrapper = img.closest('.image-carousel');
    const skeleton = wrapper ? wrapper.querySelector('[data-skeleton="image"]') : null;

    if (wrapper) {
      const inner = wrapper.querySelector('.image-carousel-inner');
      if (inner) {
        inner.innerHTML = getPlainSvgPlaceholder();
      }
    }

    if (skeleton) skeleton.remove();

    if (img.dataset.loadTimeoutId) {
      clearTimeout(Number(img.dataset.loadTimeoutId));
      delete img.dataset.loadTimeoutId;
    }
    delete img.dataset.loadTimeoutAttached;

    failedImageUrls.add(url);
  } catch (e) {
    console.log('[images] handleProductImageError error', e);
  }
};

window.handleProductImageLoad = function (img, url) {
  try {
    const wrapper = img.closest('.image-carousel');
    const skeleton = wrapper ? wrapper.querySelector('[data-skeleton="image"]') : null;

    const alreadyLoaded = loadedImageUrls.has(url);
    loadedImageUrls.add(url);
    failedImageUrls.delete(url);

    if (img.dataset.loadTimeoutId) {
      clearTimeout(Number(img.dataset.loadTimeoutId));
      delete img.dataset.loadTimeoutId;
    }
    delete img.dataset.loadTimeoutAttached;

    img.classList.remove('fade-in-once', 'no-fade');
    img.classList.add(alreadyLoaded ? 'no-fade' : 'fade-in-once');

    if (wrapper) {
      const phWrapper = wrapper.querySelector('.placeholder-wrapper');
      if (phWrapper) {
        phWrapper.classList.remove('bg-gray-100');
        phWrapper.classList.add('bg-white');
      }
    }

    if (skeleton) {
      skeleton.remove();
    }
  } catch (e) {
    console.log('[images] handleProductImageLoad error', e);
    img.style.opacity = '1';
  }
};

// ---------- Обновление товаров вручную ----------

window.refreshProducts = async function () {
  if (isRefreshingProducts) return;
  isRefreshingProducts = true;
  console.log('[core] refreshProducts clicked');

  root.innerHTML =
    '<div class="pb-[65px] max-w-md mx-auto">' +
      '<div class="product-grid">' +
        Array.from({ length: 6 }).map(() =>
          '<div class="bg-white rounded-2xl p-4 shadow-lg">' +
            '<div class="h-32 mb-3 rounded-xl placeholder-shimmer"></div>' +
            '<div class="h-4 w-3/4 mb-2 rounded placeholder-shimmer"></div>' +
            '<div class="h-5 w-1/2 mb-2 rounded placeholder-shimmer"></div>' +
            '<div class="h-3 w-1/3 mb-2 rounded placeholder-shimmer"></div>' +
          '</div>'
        ).join('') +
      '</div>' +
    '</div>';

  try {
    await fetchAndUpdateProducts(true);
  } finally {
    isRefreshingProducts = false;
  }
};

// ---------- История заказов с backend ----------

async function fetchUserOrders() {
  try {
    const userId = tg?.initDataUnsafe?.user?.id;
    console.log('[orders] fetchUserOrders userId =', userId);
    if (!userId) return;

    isOrdersLoading = true;

    if (currentTab === 'profile') {
      if (typeof renderOrdersSection === 'function') {
        renderOrdersSection();
      }
    }

    const url = ORDERS_API_URL + '?userId=' + encodeURIComponent(userId);
    console.log('[orders] fetch url:', url);
    const resp = await fetch(url);
    console.log('[orders] response status', resp.status);
    if (!resp.ok) return;

    const data = await resp.json();
    console.log(
      '[orders] data.ok=',
      data.ok,
      'count=',
      Array.isArray(data.orders) ? data.orders.length : 'no array'
    );
    if (!data.ok || !Array.isArray(data.orders)) return;

    previousOrders = data.orders;
    console.log('[orders] previousOrders updated', previousOrders.length);
  } catch (e) {
    console.error('[orders] fetchUserOrders error', e);
  } finally {
    isOrdersLoading = false;
    if (currentTab === 'profile' && typeof renderOrdersSection === 'function') {
      renderOrdersSection();
    }
  }
}

// ---------- Infinite scroll ----------

const LOAD_STEP = 10;
let scrollObserver = null;

function setupInfiniteScroll() {
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }

  const sentinel = document.getElementById('scrollSentinel');
  if (!sentinel) return;

  const list = getVisibleProducts();
  if (loadedCount >= list.length) return;

  const grid = document.getElementById('productGrid');
  if (!grid) return;

  scrollObserver = new IntersectionObserver(
    entries => {
      const entry = entries[0];
      if (!entry.isIntersecting) return;

      const all = getVisibleProducts();
      if (loadedCount >= all.length) {
        scrollObserver.disconnect();
        return;
      }

      const prevCount = loadedCount;
      loadedCount = Math.min(loadedCount + LOAD_STEP, all.length);

      const showCount = loadedCount;

      const newSlice = all.slice(prevCount, showCount);
      grid.insertAdjacentHTML('beforeend', newSlice.map(productCard).join(''));
      // preloadAllImages(newSlice);
      setupImageCarousels();

      document.querySelectorAll('[data-product-name]').forEach(card => {
        if (!card.dataset.clickBound) {
          card.dataset.clickBound = '1';
          card.onclick = function (e) {
            if (e.target.closest('button') || e.target.closest('.dot')) {
              return;
            }
            const productName = card.dataset.productName;
            const product = productsData.find(p => p['Название'] === productName);
            if (product) {
              selectedOption = {};
              selectedQuantity = 1;
              showModal(product);
              tg?.HapticFeedback?.impactOccurred('medium');
            }
          };
        }      
      });

      const counterSpan = document.querySelector(
        '.mt-3.text-xs.text-gray-500 span.font-semibold'
      );
      if (counterSpan) {
        counterSpan.textContent = String(showCount);
      }

      const sentinelEl = document.getElementById('scrollSentinel');
      if (sentinelEl) {
        sentinelEl.innerHTML =
          showCount < all.length
            ? '<div class="w-full">' +
                '<div class="h-4 w-3/4 mx-auto mb-2 rounded placeholder-shimmer"></div>' +
                '<div class="h-4 w-1/2 mx-auto rounded placeholder-shimmer"></div>' +
              '</div>'
            : '';
      }

      if (loadedCount >= all.length && scrollObserver) {
        scrollObserver.disconnect();
      }
    },
    {
      root: null,
      rootMargin: '0px 0px 200px 0px',
      threshold: 0
    }
  );

  scrollObserver.observe(sentinel);
}

// ---------- localStorage (кэш картинок) ----------

const IMAGE_CACHE_KEY = 'shopLoadedImages_v1';
const IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000 * 7;
let imageCacheMeta = {};
let loadedImageCacheKeys = new Set();

function loadPersistentImageCache() {
  try {
    const raw = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!raw) {
      imageCacheMeta = {};
      loadedImageCacheKeys = new Set();
      return;
    }

    const parsed = JSON.parse(raw);
    const meta = parsed && typeof parsed === 'object' ? parsed : {};
    const now = Date.now();

    imageCacheMeta = {};
    loadedImageCacheKeys = new Set();

    Object.keys(meta).forEach(key => {
      const ts = meta[key];
      if (typeof ts !== 'number') return;
      if (now - ts <= IMAGE_CACHE_TTL_MS) {
        imageCacheMeta[key] = ts;
        loadedImageCacheKeys.add(key);
      }
    });
  } catch (e) {
    console.log('[core] loadPersistentImageCache error', e);
    imageCacheMeta = {};
    loadedImageCacheKeys = new Set();
  }
}

function savePersistentImageCache() {
  try {
    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(imageCacheMeta));
  } catch (e) {
    console.log('[core] savePersistentImageCache error', e);
  }
}

function markImageAsLoaded(cacheKey) {
  if (!cacheKey) return;
  const now = Date.now();
  if (!imageCacheMeta) imageCacheMeta = {};
  if (!loadedImageCacheKeys) loadedImageCacheKeys = new Set();

  if (!imageCacheMeta[cacheKey]) {
    imageCacheMeta[cacheKey] = now;
  }

  loadedImageCacheKeys.add(cacheKey);
  savePersistentImageCache();
}

// ---------- Инициализация ----------

async function initApp() {
  const t0 = performance.now();
  try {
    console.log('[core] initApp start');
    console.log('tg object:', window.Telegram?.WebApp);
    console.log('initData string:', window.Telegram?.WebApp?.initData);
    console.log('initDataUnsafe object:', window.Telegram?.WebApp?.initDataUnsafe);
    console.log('initDataUnsafe.user:', window.Telegram?.WebApp?.initDataUnsafe?.user);

    initTabBar();
    logStage('after initTabBar', t0);

    loadOrdersFromStorage();
    loadAddressesFromStorage();
    loadProfileFromStorage();
    loadCartFromStorage();
    loadDeliveryPrefs();
    logStage('after localStorage', t0);

    loadPersistentImageCache();

    await fetchAndUpdateProducts(true);
    logStage('after fetchAndUpdateProducts', t0);

    fetchUserOrders().catch(e => console.error('[orders] init fetch error', e));

    if (currentTab === 'shop') {
      renderShop();
    } else if (currentTab === 'cart') {
      showCartTab();
    } else if (currentTab === 'sale') {
      showSaleTab();
    } else if (currentTab === 'profile') {
      showProfileTab();
    } else if (currentTab === 'about') {
      showAboutTab();
    }
    logStage('after initial tab render', t0);

    setInterval(() => {
      try {
        fetchAndUpdateProducts(false).catch(err =>
          console.error('[core] Auto-refresh error', err)
        );
      } catch (e) {
        console.error('[core] Auto-refresh exception', e);
      }
    }, 5 * 60 * 1000);
  } catch (e) {
    console.error('[core] Init error:', e);
    showError(e.message || 'Ошибка инициализации приложения');
  }
}