#!/bin/bash

#############################################
# WiiM Web Control - Установка на Raspberry Pi
# Автоматическая установка с WiFi автоподключением
#############################################

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Пути
INSTALL_DIR="$HOME/wiim"
SERVICE_NAME="wiim-server"

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════╗"
echo "║   WiiM Web Control - Установка на RPi    ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Функция для красивого вывода
log_step() {
    echo -e "${BLUE}▶${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Проверка прав root для некоторых операций
check_sudo() {
    if ! sudo -n true 2>/dev/null; then
        log_warning "Потребуются права sudo для установки"
    fi
}

# Шаг 1: Проверка Node.js
log_step "Проверка Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_success "Node.js установлен: $NODE_VERSION"
else
    log_error "Node.js не установлен!"
    echo ""
    log_step "Установка Node.js v20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    log_success "Node.js установлен: $(node --version)"
fi

# Шаг 2: Установка зависимостей системы
log_step "Установка системных зависимостей..."
sudo apt update -qq
sudo apt install -y jq wireless-tools wpasupplicant

# Шаг 3: Проверка существующей установки
if [ -d "$INSTALL_DIR" ]; then
    log_warning "Директория $INSTALL_DIR уже существует"
    read -p "Переустановить? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_step "Остановка сервиса..."
        sudo systemctl stop $SERVICE_NAME 2>/dev/null || true

        log_step "Создание резервной копии..."
        if [ -f "$INSTALL_DIR/.env" ]; then
            cp "$INSTALL_DIR/.env" "$HOME/.env.backup"
            log_success "Конфигурация сохранена в ~/.env.backup"
        fi
        if [ -f "$INSTALL_DIR/wifi-networks.json" ]; then
            cp "$INSTALL_DIR/wifi-networks.json" "$HOME/wifi-networks.json.backup"
            log_success "WiFi конфигурация сохранена"
        fi

        rm -rf "$INSTALL_DIR"
    else
        log_error "Установка отменена"
        exit 1
    fi
fi

# Шаг 4: Клонирование/копирование проекта
log_step "Установка проекта в $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

echo ""
echo "Выберите способ установки:"
echo "1) Git clone (требуется URL репозитория)"
echo "2) Использовать локальные файлы (если уже скопированы)"
read -p "Ваш выбор (1/2): " -n 1 -r
echo

if [[ $REPLY == "1" ]]; then
    read -p "Введите URL GitHub репозитория: " REPO_URL
    git clone "$REPO_URL" "$INSTALL_DIR"
    log_success "Проект клонирован из Git"
elif [[ $REPLY == "2" ]]; then
    if [ -f "server.js" ] && [ -f "package.json" ]; then
        cp -r . "$INSTALL_DIR/"
        log_success "Файлы скопированы"
    else
        log_error "Файлы проекта не найдены в текущей директории"
        exit 1
    fi
else
    log_error "Неверный выбор"
    exit 1
fi

cd "$INSTALL_DIR"

# Шаг 5: Установка npm зависимостей
log_step "Установка npm зависимостей..."
npm install --production
log_success "Зависимости установлены"

# Шаг 6: Настройка конфигурации
log_step "Настройка конфигурации..."

# Восстановление .env если был backup
if [ -f "$HOME/.env.backup" ]; then
    cp "$HOME/.env.backup" .env
    log_success "Конфигурация восстановлена из backup"
else
    # Создание нового .env
    cat > .env << 'EOF'
WIIM_IP=192.168.1.156
PORT=3000
WIIM_USE_HTTPS=true
EOF

    echo ""
    read -p "Введите IP адрес WiiM плеера [192.168.1.156]: " WIIM_IP
    WIIM_IP=${WIIM_IP:-192.168.1.156}

    read -p "Порт сервера [3000]: " PORT
    PORT=${PORT:-3000}

    cat > .env << EOF
WIIM_IP=$WIIM_IP
PORT=$PORT
WIIM_USE_HTTPS=true
EOF

    log_success "Конфигурация создана"
fi

# Шаг 7: Настройка WiFi сетей
log_step "Настройка WiFi автоподключения..."

if [ -f "$HOME/wifi-networks.json.backup" ]; then
    cp "$HOME/wifi-networks.json.backup" wifi-networks.json
    log_success "WiFi конфигурация восстановлена"
else
    if [ ! -f "wifi-networks.json" ]; then
        echo ""
        log_warning "Необходимо настроить WiFi сети"
        read -p "Настроить сейчас? (y/n): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Интерактивная настройка WiFi
            cat > wifi-networks.json << 'EOF'
{
  "networks": []
}
EOF

            while true; do
                echo ""
                read -p "SSID сети: " SSID
                read -sp "Пароль: " PASSWORD
                echo ""
                read -p "Приоритет (100=наивысший): " PRIORITY
                PRIORITY=${PRIORITY:-100}

                # Добавление сети в JSON
                TEMP_JSON=$(jq ".networks += [{\"ssid\": \"$SSID\", \"password\": \"$PASSWORD\", \"priority\": $PRIORITY}]" wifi-networks.json)
                echo "$TEMP_JSON" > wifi-networks.json

                log_success "Сеть '$SSID' добавлена"

                read -p "Добавить еще одну сеть? (y/n): " -n 1 -r
                echo
                [[ ! $REPLY =~ ^[Yy]$ ]] && break
            done

            log_success "WiFi сети настроены"
        else
            cp wifi-networks.json.example wifi-networks.json
            log_warning "Используется пример конфигурации. Отредактируйте wifi-networks.json вручную!"
        fi
    fi
fi

# Установка прав на скрипт
chmod +x wifi-connect.sh

# Шаг 8: Установка systemd сервиса
log_step "Установка systemd сервиса..."

sudo cp wiim-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME

log_success "Сервис установлен и добавлен в автозагрузку"

# Шаг 9: Создание логов
sudo touch /var/log/wiim-wifi.log
sudo chown $USER:$USER /var/log/wiim-wifi.log

# Шаг 10: Запуск сервиса
log_step "Запуск сервиса..."
sudo systemctl start $SERVICE_NAME

sleep 3

if sudo systemctl is-active --quiet $SERVICE_NAME; then
    log_success "Сервис успешно запущен!"
else
    log_error "Ошибка запуска сервиса"
    echo ""
    echo "Просмотр логов:"
    echo "  sudo journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi

# Финальная информация
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Установка завершена! ✓            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Полезные команды:${NC}"
echo ""
echo "  Статус сервиса:"
echo "    sudo systemctl status $SERVICE_NAME"
echo ""
echo "  Просмотр логов:"
echo "    sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "  Перезапуск:"
echo "    sudo systemctl restart $SERVICE_NAME"
echo ""
echo "  Остановка:"
echo "    sudo systemctl stop $SERVICE_NAME"
echo ""
echo "  Логи WiFi:"
echo "    tail -f /var/log/wiim-wifi.log"
echo ""
echo -e "${CYAN}Веб-интерфейс доступен:${NC}"
echo "  http://$(hostname -I | awk '{print $1}'):$PORT"
echo ""
echo -e "${YELLOW}Не забудьте настроить wifi-networks.json!${NC}"
echo ""
