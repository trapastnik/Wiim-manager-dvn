/**
 * Базовый API клиент с обработкой ошибок
 */

/**
 * Выполнить GET запрос
 * @param {string} url - URL endpoint
 * @returns {Promise<any>}
 */
export async function get(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`GET ${url} failed:`, error);
    throw error;
  }
}

/**
 * Выполнить POST запрос
 * @param {string} url - URL endpoint
 * @param {Object} data - данные для отправки
 * @returns {Promise<any>}
 */
export async function post(url, data = {}) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`POST ${url} failed:`, error);
    throw error;
  }
}

/**
 * Выполнить DELETE запрос
 * @param {string} url - URL endpoint
 * @returns {Promise<any>}
 */
export async function del(url) {
  try {
    const response = await fetch(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`DELETE ${url} failed:`, error);
    throw error;
  }
}

/**
 * Загрузить файл
 * @param {string} url - URL endpoint
 * @param {FormData} formData - данные формы с файлом
 * @returns {Promise<any>}
 */
export async function upload(url, formData) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`UPLOAD ${url} failed:`, error);
    throw error;
  }
}
