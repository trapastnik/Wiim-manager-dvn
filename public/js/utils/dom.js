/**
 * Утилиты для работы с DOM
 */

/**
 * Безопасное получение элемента по ID
 * @param {string} id - ID элемента
 * @returns {HTMLElement|null}
 */
export function getElement(id) {
  return document.getElementById(id);
}

/**
 * Безопасное получение значения input элемента
 * @param {string} id - ID элемента
 * @returns {string}
 */
export function getInputValue(id) {
  const element = getElement(id);
  return element ? element.value.trim() : '';
}

/**
 * Установка значения input элемента
 * @param {string} id - ID элемента
 * @param {string} value - значение
 */
export function setInputValue(id, value) {
  const element = getElement(id);
  if (element) {
    element.value = value;
  }
}

/**
 * Показать элемент
 * @param {string} id - ID элемента
 */
export function showElement(id) {
  const element = getElement(id);
  if (element) {
    element.style.display = 'block';
  }
}

/**
 * Скрыть элемент
 * @param {string} id - ID элемента
 */
export function hideElement(id) {
  const element = getElement(id);
  if (element) {
    element.style.display = 'none';
  }
}

/**
 * Переключить класс у элемента
 * @param {string} id - ID элемента
 * @param {string} className - имя класса
 */
export function toggleClass(id, className) {
  const element = getElement(id);
  if (element) {
    element.classList.toggle(className);
  }
}

/**
 * Добавить класс к элементу
 * @param {string} id - ID элемента
 * @param {string} className - имя класса
 */
export function addClass(id, className) {
  const element = getElement(id);
  if (element) {
    element.classList.add(className);
  }
}

/**
 * Удалить класс у элемента
 * @param {string} id - ID элемента
 * @param {string} className - имя класса
 */
export function removeClass(id, className) {
  const element = getElement(id);
  if (element) {
    element.classList.remove(className);
  }
}

/**
 * Установить HTML содержимое элемента
 * @param {string} id - ID элемента
 * @param {string} html - HTML содержимое
 */
export function setHTML(id, html) {
  const element = getElement(id);
  if (element) {
    element.innerHTML = html;
  }
}

/**
 * Установить текстовое содержимое элемента
 * @param {string} id - ID элемента
 * @param {string} text - текст
 */
export function setText(id, text) {
  const element = getElement(id);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Включить/выключить кнопку
 * @param {string} id - ID кнопки
 * @param {boolean} disabled - состояние
 */
export function setButtonDisabled(id, disabled) {
  const element = getElement(id);
  if (element) {
    element.disabled = disabled;
  }
}

/**
 * Создать элемент с классами и атрибутами
 * @param {string} tag - тег элемента
 * @param {Object} options - опции {className, attributes, innerHTML, textContent}
 * @returns {HTMLElement}
 */
export function createElement(tag, options = {}) {
  const element = document.createElement(tag);

  if (options.className) {
    element.className = options.className;
  }

  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }

  if (options.innerHTML) {
    element.innerHTML = options.innerHTML;
  }

  if (options.textContent) {
    element.textContent = options.textContent;
  }

  return element;
}
