// analytics.js

// ===== КОНФИГ =====

const ANALYTICS_URL =
  (typeof BACKEND_BASE_URL === 'string'
    ? BACKEND_BASE_URL
    : 'https://tg-shop-test-backend.onrender.com') + '/analytics';

const ANALYTICS_BATCH_SIZE = 20;
const ANALYTICS_FLUSH_INTERVAL_MS = 5000;
const ANALYTICS_MAX_QUEUE = 1000;

const ANALYTICS_CLIENT_ID_KEY = 'tbx_analytics_client_id_v1';
const ANALYTICS_SESSION_ID_KEY = 'tbx_analytics_session_id_v1';
const ANALYTICS_SESSION_TTL_MS = 60 * 60 * 1000; // 1 час

let analyticsClientId = null;
let analyticsSessionId = null;
let analyticsSessionStartedAt = Date.now();
let analyticsQueue = [];
let analyticsFlushTimer = null;
let analyticsStarted = false;

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function analyticsGenerateId(prefix) {
  return (
    prefix +
    '_' +
    Math.random().toString(36).slice(2) +
    '_' +
    Date.now().toString(36)
  );
}

function analyticsLoadClientId() {
  try {
    const v = localStorage.getItem(ANALYTICS_CLIENT_ID_KEY);
    if (v && typeof v === 'string' && v.length > 0) {
      return v;
    }
  } catch (_) {}
  const cid = analyticsGenerateId('cid');
  try {
    localStorage.setItem(ANALYTICS_CLIENT_ID_KEY, cid);
  } catch (_) {}
  return cid;
}

function analyticsLoadSessionId() {
  try {
    const raw = localStorage.getItem(ANALYTICS_SESSION_ID_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { id, startedAt } = parsed;
    if (!id || typeof id !== 'string') return null;
    const ts = typeof startedAt === 'number' ? startedAt : 0;
    const now = Date.now();
    if (now - ts > ANALYTICS_SESSION_TTL_MS) {
      return null;
    }
    analyticsSessionStartedAt = ts;
    return id;
  } catch (_) {
    return null;
  }
}

function analyticsSaveSessionId(id) {
  try {
    const obj = {
      id,
      startedAt: analyticsSessionStartedAt
    };
    localStorage.setItem(
      ANALYTICS_SESSION_ID_KEY,
      JSON.stringify(obj)
    );
  } catch (_) {}
}

function analyticsEnsureIds() {
  if (!analyticsClientId) {
    analyticsClientId = analyticsLoadClientId();
  }
  if (!analyticsSessionId) {
    analyticsSessionStartedAt = Date.now();
    analyticsSessionId = analyticsGenerateId('sess');
    analyticsSaveSessionId(analyticsSessionId);
  }
}

function analyticsGetBaseContext() {
  analyticsEnsureIds();

  const now = Date.now();
  let platform = 'web';
  let source = 'web';
  let tgUserId = null;
  let tgUsername = null;

  const tgLocal = window.Telegram && window.Telegram.WebApp;
  if (tgLocal && tgLocal.initData) {
    platform = 'telegram_webapp';
    source = 'telegram';
    const u =
      tgLocal.initDataUnsafe &&
      tgLocal.initDataUnsafe.user;
    if (u) {
      tgUserId = u.id ?? null;
      tgUsername = u.username ?? null;
    }
  }

  const url =
    typeof location !== 'undefined' ? location.href : '';
  const referrer =
    typeof document !== 'undefined'
      ? document.referrer
      : '';
  const ua =
    typeof navigator !== 'undefined'
      ? navigator.userAgent || ''
      : '';
  const lang =
    typeof navigator !== 'undefined'
      ? navigator.language || ''
      : '';
  const screenW =
    typeof screen !== 'undefined'
      ? screen.width || null
      : null;
  const screenH =
    typeof screen !== 'undefined'
      ? screen.height || null
      : null;
  const tzOffset = new Date().getTimezoneOffset();

  return {
    ts: now,
    client_id: analyticsClientId,
    session_id: analyticsSessionId,
    platform,
    source,
    url,
    referrer,
    ua,
    lang,
    screen_w: screenW,
    screen_h: screenH,
    tz_offset_min: tzOffset,
    tg_user_id: tgUserId,
    tg_username: tgUsername
  };
}

function analyticsScheduleFlush() {
  if (analyticsFlushTimer) return;
  analyticsFlushTimer = setTimeout(
    analyticsFlush,
    ANALYTICS_FLUSH_INTERVAL_MS
  );
}

async function analyticsFlush() {
  analyticsFlushTimer = null;
  if (!analyticsQueue.length) return;

  const batch = analyticsQueue.slice(
    0,
    ANALYTICS_BATCH_SIZE
  );
  analyticsQueue = analyticsQueue.slice(batch.length);

  try {
    await fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ events: batch })
    });
  } catch (e) {
    console.error('[analytics] flush error', e);
    analyticsQueue = batch
      .concat(analyticsQueue)
      .slice(-ANALYTICS_MAX_QUEUE);
  } finally {
    if (analyticsQueue.length) {
      analyticsScheduleFlush();
    }
  }
}

function analyticsEnqueue(event) {
  analyticsQueue.push(event);
  if (analyticsQueue.length >= ANALYTICS_BATCH_SIZE) {
    analyticsFlush();
  } else {
    analyticsScheduleFlush();
  }
}

// ===== ПУБЛИЧНЫЙ API =====

function detectEntryPoint() {
  try {
    const tgLocal = window.Telegram && window.Telegram.WebApp;
    if (tgLocal && tgLocal.initData) {
      const init = tgLocal.initDataUnsafe || {};
      if (init.start_param)
        return (
          'tg_start_param_' + String(init.start_param)
        );
      return 'telegram';
    }
  } catch (_) {}
  if (
    document.referrer &&
    document.referrer.includes('t.me')
  ) {
    return 'web_from_telegram';
  }
  return 'web_direct';
}

function initAnalytics(initial) {
    if (analyticsStarted) return;
    analyticsStarted = true;
    analyticsEnsureIds();
  
    const entryPoint =
      (initial && initial.entryPoint) || detectEntryPoint();
  
    // ГАРАНТИРОВАННЫЙ app_open
    try {
      const base = analyticsGetBaseContext();
      const evt = {
        id: analyticsGenerateId('evt'),
        name: 'app_open',
        ts: base.ts,
        context: base,
        payload: { entry_point: entryPoint }
      };
  
      if (
        typeof navigator !== 'undefined' &&
        navigator.sendBeacon
      ) {
        // максимально надёжно — sendBeacon
        navigator.sendBeacon(
          ANALYTICS_URL,
          JSON.stringify({ events: [evt] })
        );
      } else {
        // фолбэк — обычная очередь
        analyticsEnqueue(evt);
      }
    } catch (e) {
      console.error('[analytics] app_open send error', e);
    }
  
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        analyticsHandlePossibleCheckoutAbandon('beforeunload');
        analyticsHandlePossibleShopAbandon('beforeunload');
      });
  
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          trackEvent('app_hide', {}, { sync: true });
          analyticsHandlePossibleCheckoutAbandon('hidden');
          analyticsHandlePossibleShopAbandon('hidden');
        } else if (document.visibilityState === 'visible') {
          trackEvent('app_show', {}, {});
        }
      });
    }
  }  
/**
 * options: { sync?: boolean }
 */
function trackEvent(name, payload, options) {
  try {
    if (!analyticsStarted) {
      initAnalytics();
    }

    const base = analyticsGetBaseContext();
    const evt = {
      id: analyticsGenerateId('evt'),
      name,
      ts: base.ts,
      context: base,
      payload: payload || {}
    };

    if (
      options &&
      options.sync &&
      typeof navigator !== 'undefined' &&
      navigator.sendBeacon
    ) {
      try {
        navigator.sendBeacon(
          ANALYTICS_URL,
          JSON.stringify({ events: [evt] })
        );
        return;
      } catch (e) {
        console.error(
          '[analytics] sendBeacon error, fallback to queue',
          e
        );
      }
    }

    analyticsEnqueue(evt);
  } catch (e) {
    console.error('[analytics] trackEvent error', e);
  }
}

// ---------- ЗАГЛУШКИ ДЛЯ ОНЛАЙН-АБАНДОНОВ ----------

function analyticsHandlePossibleCheckoutAbandon(reason) {
  // оставляем вызовы, но НИЧЕГО не шлём:
  // оффлайн-абандон считаем в analytics_report по цепочкам событий
  // reason: 'hidden' | 'beforeunload'
  try {
    // no-op
  } catch (e) {
    console.error(
      '[analytics] abandon check error',
      e
    );
  }
}

function analyticsHandlePossibleShopAbandon(reason) {
  // оставляем вызовы, но НИЧЕГО не шлём:
  // оффлайн-абандон загрузки считаем в analytics_report
  try {
    // no-op
  } catch (e) {
    console.error(
      '[analytics] shop abandon check error',
      e
    );
  }
}

function trackScreenView(screenName, extra) {
  trackEvent('screen_view', {
    screen: screenName,
    ...((extra && typeof extra === 'object')
      ? extra
      : {})
  });
}

function trackError(message, extra) {
  trackEvent('error', {
    message: String(message || ''),
    ...((extra && typeof extra === 'object')
      ? extra
      : {})
  });
}

// ===== ECOMMERCE ХЕЛПЕРЫ =====

function trackAddToCart(item, extra) {
  if (!item) return;
  trackEvent('add_to_cart', {
    cart_key: item.cartKey || null,
    product_name: item.name || null,
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 1,
    category: item.cat || null,
    options: item.options || null,
    ...((extra && typeof extra === 'object')
      ? extra
      : {})
  });
}

function trackRemoveFromCart(item, extra) {
  if (!item) return;
  trackEvent('remove_from_cart', {
    cart_key: item.cartKey || null,
    product_name: item.name || null,
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 1,
    category: item.cat || null,
    options: item.options || null,
    ...((extra && typeof extra === 'object')
      ? extra
      : {})
  });
}

function trackCartQuantityChange(item, newQty, extra) {
  if (!item) return;
  trackEvent('cart_change_quantity', {
    cart_key: item.cartKey || null,
    product_name: item.name || null,
    price: Number(item.price) || 0,
    old_quantity: Number(item.quantity) || 0,
    new_quantity: Number(newQty) || 0,
    category: item.cat || null,
    options: item.options || null,
    ...((extra && typeof extra === 'object')
      ? extra
      : {})
  });
}

function trackCartView(items) {
  const arr = Array.isArray(items) ? items : [];
  trackEvent('cart_view', {
    items: arr.map(i => ({
      cart_key: i.cartKey || null,
      product_name: i.name || null,
      price: Number(i.price) || 0,
      quantity: Number(i.quantity) || 0,
      category: i.cat || null
    }))
  });
}

function trackCheckoutStart(cartItems, extra) {
  const arr = Array.isArray(cartItems) ? cartItems : [];
  trackEvent('checkout_start', {
    items: arr.map(i => ({
      cart_key: i.cartKey || null,
      product_name: i.name || null,
      price: Number(i.price) || 0,
      quantity: Number(i.quantity) || 0,
      category: i.cat || null
    })),
    ...((extra && typeof extra === 'object')
      ? extra
      : {})
  });
}

function trackCheckoutSubmit(order, extra) {
  if (!order) return;
  trackEvent('checkout_submit', {
    order_id: order.id,
    total: Number(order.total) || 0,
    subtotal: Number(order.subtotal) || 0,
    commission: Number(order.commission) || 0,
    payment_type: order.paymentType || null,
    pickup_mode: !!order.pickupMode,
    pickup_location: order.pickupMode
      ? order.pickupLocation || ''
      : '',
    items: (order.items || []).map(i => ({
      cart_key: i.cartKey || null,
      product_name: i.name || null,
      price: Number(i.price) || 0,
      quantity: Number(i.quantity) || 0,
      category: i.cat || null
    })),
    ...((extra && typeof extra === 'object')
      ? extra
      : {})
  });
}

function trackCheckoutResult(orderId, ok, extra) {
  trackEvent('checkout_result', {
    order_id: orderId,
    ok: !!ok,
    ...((extra && typeof extra === 'object')
      ? extra
      : {})
  });
}

function trackCheckoutFormFilled(params) {
  trackEvent('checkout_form_filled', {
    ...((params && typeof params === 'object')
      ? params
      : {})
  });
}

// analytics.js

(function () {
    // уже есть: trackEvent, analyticsEnsureIds, initAnalytics и т.п.
  
    function safeInitAnalyticsFromDom() {
      try {
        if (typeof initAnalytics === 'function') {
          initAnalytics({ entryPoint: detectEntryPoint() });
        }
      } catch (e) {
        console.error('[analytics] auto initAnalytics error', e);
      }
    }
  
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', safeInitAnalyticsFromDom, { once: true });
      } else {
        // DOM уже готов
        safeInitAnalyticsFromDom();
      }
    }
  })();  

// экспорт в window

window.initAnalytics = initAnalytics;
window.trackEvent = trackEvent;
window.trackError = trackError;
window.trackScreenView = trackScreenView;
window.trackAddToCart = trackAddToCart;
window.trackRemoveFromCart = trackRemoveFromCart;
window.trackCartQuantityChange =
  trackCartQuantityChange;
window.trackCartView = trackCartView;
window.trackCheckoutStart = trackCheckoutStart;
window.trackCheckoutSubmit = trackCheckoutSubmit;
window.trackCheckoutResult = trackCheckoutResult;
window.trackCheckoutFormFilled =
  trackCheckoutFormFilled;
