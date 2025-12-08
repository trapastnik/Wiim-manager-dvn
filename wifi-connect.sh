#!/bin/bash

#############################################
# WiFi Auto-Connect Script для WiiM Server
# Автоматически подключается к доступным WiFi сетям
# из списка приоритетов и запускает сервер
#############################################

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Путь к конфигурации
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/wifi-networks.json"
LOG_FILE="/var/log/wiim-wifi.log"

# Функция логирования
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Проверка наличия конфигурационного файла
if [ ! -f "$CONFIG_FILE" ]; then
    log_error "Конфигурационный файл $CONFIG_FILE не найден!"
    log "Создайте файл wifi-networks.json со списком WiFi сетей"
    exit 1
fi

# Функция проверки подключения к интернету
check_internet() {
    if ping -c 1 -W 2 8.8.8.8 &> /dev/null || ping -c 1 -W 2 1.1.1.1 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Функция получения текущего WiFi
get_current_wifi() {
    iwgetid -r 2>/dev/null || echo ""
}

# Функция сканирования доступных сетей
scan_networks() {
    log "Сканирование доступных WiFi сетей..."
    sudo iwlist wlan0 scan 2>/dev/null | grep -oP 'ESSID:"\K[^"]+' || echo ""
}

# Функция подключения к WiFi
connect_to_wifi() {
    local ssid="$1"
    local password="$2"
    local priority="$3"

    log "Попытка подключения к сети: $ssid (приоритет: $priority)"

    # Проверка, существует ли уже конфигурация для этой сети
    local network_id=$(sudo wpa_cli -i wlan0 list_networks | grep -w "$ssid" | cut -f1)

    if [ -z "$network_id" ]; then
        # Добавление новой сети
        network_id=$(sudo wpa_cli -i wlan0 add_network | tail -n 1)
        sudo wpa_cli -i wlan0 set_network "$network_id" ssid "\"$ssid\"" > /dev/null
        sudo wpa_cli -i wlan0 set_network "$network_id" psk "\"$password\"" > /dev/null
        sudo wpa_cli -i wlan0 set_network "$network_id" priority "$priority" > /dev/null
    fi

    # Включение сети
    sudo wpa_cli -i wlan0 enable_network "$network_id" > /dev/null
    sudo wpa_cli -i wlan0 select_network "$network_id" > /dev/null

    # Ожидание подключения (максимум 15 секунд)
    for i in {1..15}; do
        sleep 1
        if [ "$(get_current_wifi)" == "$ssid" ]; then
            log_success "Подключено к сети: $ssid"

            # Проверка интернета
            sleep 2
            if check_internet; then
                log_success "Интернет доступен"
                return 0
            else
                log_warning "Подключено к WiFi, но интернет недоступен"
                return 0
            fi
        fi
    done

    log_error "Не удалось подключиться к сети: $ssid"
    return 1
}

# Основная логика подключения
main_connect() {
    log "========================================="
    log "Запуск WiFi Auto-Connect"
    log "========================================="

    # Проверка текущего подключения
    current_wifi=$(get_current_wifi)

    if [ -n "$current_wifi" ]; then
        log "Уже подключено к сети: $current_wifi"

        if check_internet; then
            log_success "Интернет доступен. Подключение в порядке."
            return 0
        else
            log_warning "WiFi подключен, но интернет недоступен. Пробуем другие сети..."
        fi
    else
        log "WiFi не подключен. Начинаем поиск сетей..."
    fi

    # Получение списка доступных сетей
    available_networks=$(scan_networks)

    if [ -z "$available_networks" ]; then
        log_error "Не найдено ни одной WiFi сети!"
        return 1
    fi

    log "Найдено сетей: $(echo "$available_networks" | wc -l)"

    # Чтение конфигурации и попытка подключения
    # Сети отсортированы по приоритету (от большего к меньшему)
    while IFS= read -r network; do
        ssid=$(echo "$network" | jq -r '.ssid')
        password=$(echo "$network" | jq -r '.password')
        priority=$(echo "$network" | jq -r '.priority')

        # Проверка, доступна ли эта сеть
        if echo "$available_networks" | grep -qw "$ssid"; then
            log "Сеть '$ssid' доступна. Пытаемся подключиться..."

            if connect_to_wifi "$ssid" "$password" "$priority"; then
                log_success "Успешное подключение к '$ssid'"
                return 0
            fi
        else
            log "Сеть '$ssid' не найдена в диапазоне"
        fi
    done < <(jq -c '.networks | sort_by(.priority) | reverse | .[]' "$CONFIG_FILE")

    log_error "Не удалось подключиться ни к одной сети из списка"
    return 1
}

# Запуск основной функции
main_connect

# Возврат кода выхода
exit $?
