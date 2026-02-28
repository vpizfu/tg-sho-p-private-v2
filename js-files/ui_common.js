  function escapeHtml(s) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
    return String(s).replace(/[&<>"']/g, m => map[m]);
  }

  function normalizePhone(raw) {
    if (!raw) return '';
    // убираем пробелы, скобки, тире и т.п.
    let v = raw.replace(/[^\d+]/g, '');
  
    // приводим к российскому формату +7XXXXXXXXXX [web:19]
    if (v.startsWith('+7')) {
      v = v.slice(2);
    } else if (v.startsWith('8')) {
      v = v.slice(1);
    } else if (v.startsWith('+')) {
      // другой код страны — считаем невалидным
      return '';
    }
  
    // должны остаться ровно 10 цифр
    if (!/^\d{10}$/.test(v)) return '';
  
    return '+7' + v;
  }
  
  function isValidName(name) { 
    const v = String(name).trim();
    if (v.length < 1 || v.length > 50) return false;
  
    // только буквы (вкл. кириллицу), пробел, дефис, апостроф [web:21][web:24]
    if (!/^[A-Za-zА-Яа-яЁё\s\-']+$/.test(v)) return false;
  
    // хотя бы одна буква
    return /[A-Za-zА-Яа-яЁё]/.test(v);
  }

  function formatPrice(value) {
    const num = Number(value) || 0;
    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 0
    }).format(num);
  }  
  
  function showError(message) {
    root.innerHTML =
      '<div class="flex flex-col items-center justify-center min-h-screen text-center p-8 pb-[65px]">' +
        '<div class="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mb-6">' +
          '<svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
            ' d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
          '</svg>' +
        '</div>' +
        '<h2 class="text-2xl font-bold text-gray-800 mb-4">Ошибка загрузки</h2>' +
        '<p class="text-lg text-red-600 mb-2">' +
          escapeHtml(message) +
        '</p>' +
        '<p class="text-lg text-500-blue mb-2">' + "Для заказа через менеджера напишите @TechBex." + '</p>' +
        '<button onclick="location.reload()"' +
          ' class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg">' +
          'Попробовать снова' +
        '</button>' +
      '</div>';
  
    tg?.showAlert?.('❌ ' + message + '\nДля заказа через менеджера напишите @TechBex.');
  }  
  
  // Бэкдроп модалки
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal();
    });
  }
  
  // ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (modal && !modal.classList.contains('hidden')) {
        closeModal();
      }
    }
  });