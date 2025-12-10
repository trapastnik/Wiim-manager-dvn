# 🍓 Развертывание на Raspberry Pi

## Поддержка платформ

✅ **Raspberry Pi 5** - Полная поддержка
✅ **Raspberry Pi 4** - Полная поддержка
✅ **Raspberry Pi 3 B+** - Работает, но медленнее

---

## Системные требования

### Минимальные требования:
- **OS**: Raspberry Pi OS (64-bit, рекомендуется)
- **Node.js**: >= 18.0.0
- **RAM**: 512 MB (рекомендуется 1 GB+)
- **Storage**: 100 MB свободного места
- **Network**: WiFi или Ethernet

### Рекомендуемые:
- **Raspberry Pi 5** с 4-8 GB RAM
- **Raspberry Pi OS Lite** (без GUI для лучшей производительности)
- **SSD** вместо SD карты (быстрее и надежнее)

---

## Установка Node.js 18+

### Вариант 1: Официальный репозиторий NodeSource

```bash
# Установка Node.js 20 LTS (рекомендуется)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка версии
node --version  # Должно быть v20.x.x
npm --version
```

### Вариант 2: Через nvm (Node Version Manager)

```bash
# Установка nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Перезагрузка shell
source ~/.bashrc

# Установка Node.js 20
nvm install 20
nvm use 20
nvm alias default 20
```

---

## Установка приложения

### 1. Клонирование проекта

```bash
cd ~
git clone https://github.com/your-repo/wiim-web-control.git
cd wiim-web-control
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Создание .env файла

```bash
cp .env.example .env
nano .env
```

Настройте параметры:
```bash
PORT=3000
WIIM_USE_HTTPS=true

# Для Raspberry Pi рекомендуется увеличить таймаут:
WIIM_REQUEST_TIMEOUT=7000

# Отключите статистику для производительности:
ENABLE_STATS=false
```

### 4. Создание директорий

```bash
mkdir -p data media
```

---

## Запуск приложения

### Вариант 1: Прямой запуск

```bash
npm start
```

### Вариант 2: Автозапуск через systemd (рекомендуется)

Создайте systemd сервис:

```bash
sudo nano /etc/systemd/system/wiim-control.service
```

Содержимое файла:

```ini
[Unit]
Description=WiiM Web Control
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/wiim-web-control
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Логирование
StandardOutput=append:/home/pi/wiim-web-control/logs/output.log
StandardError=append:/home/pi/wiim-web-control/logs/error.log

[Install]
WantedBy=multi-user.target
```

Создайте директорию для логов:

```bash
mkdir -p ~/wiim-web-control/logs
```

Активируйте сервис:

```bash
sudo systemctl daemon-reload
sudo systemctl enable wiim-control
sudo systemctl start wiim-control

# Проверка статуса
sudo systemctl status wiim-control

# Просмотр логов
tail -f ~/wiim-web-control/logs/output.log
```

---

## Оптимизация для Raspberry Pi

### 1. Увеличение лимитов файловых дескрипторов

```bash
# Добавьте в /etc/security/limits.conf
sudo nano /etc/security/limits.conf

# Добавьте строки:
pi soft nofile 4096
pi hard nofile 8192
```

### 2. Оптимизация сети

```bash
# Отключите энергосбережение WiFi
sudo nano /etc/rc.local

# Добавьте перед 'exit 0':
iwconfig wlan0 power off
```

### 3. Настройка swap (для Pi с 2GB RAM и меньше)

```bash
# Увеличьте swap
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile

# Измените:
CONF_SWAPSIZE=2048

# Применить
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### 4. Оптимизация .env для Raspberry Pi

```bash
# Увеличенный таймаут для стабильности
WIIM_REQUEST_TIMEOUT=7000

# Обязательно отключите статистику
ENABLE_STATS=false

# Используйте локальный IP вместо localhost
# (найдите через: hostname -I)
# Добавьте в hosts:
sudo nano /etc/hosts
# 192.168.x.x wiim-server
```

---

## Мониторинг производительности

### Проверка использования ресурсов

```bash
# CPU и RAM
htop

# Логи приложения
sudo journalctl -u wiim-control -f

# Проверка сети
ping 192.168.x.x  # IP вашего WiiM устройства
```

### Типичное использование ресурсов

| Операция | CPU (%) | RAM (MB) |
|----------|---------|----------|
| Idle | 1-3% | 80-120 |
| Обновление статусов 7 плееров | 5-10% | 100-150 |
| Запуск группы | 10-15% | 100-150 |
| Сканирование сети | 20-30% | 120-180 |

---

## Решение проблем

### Проблема: "Error: Cannot find module 'express'"

```bash
cd ~/wiim-web-control
npm install
```

### Проблема: "Port 3000 already in use"

```bash
# Найдите процесс
sudo lsof -i :3000

# Убейте процесс
sudo kill -9 [PID]

# Или измените порт в .env
PORT=3001
```

### Проблема: Медленное обновление статусов

```bash
# Увеличьте таймаут в .env
WIIM_REQUEST_TIMEOUT=10000

# Проверьте качество WiFi
iwconfig wlan0 | grep Quality
```

### Проблема: Высокая нагрузка на CPU

```bash
# Убедитесь, что статистика отключена
nano .env
# ENABLE_STATS=false

# Перезапустите сервис
sudo systemctl restart wiim-control
```

### Проблема: Out of memory

```bash
# Проверьте swap
free -h

# Увеличьте swap (см. раздел оптимизации)
# Или обновите до Pi с большей памятью
```

---

## Производительность

### Raspberry Pi 5 (4GB RAM)

| Операция | Время |
|----------|-------|
| Обновление 7 плееров | ~250-300ms |
| Запуск группы из 7 плееров | ~180-220ms |
| Синхронность воспроизведения | <20ms |
| Сканирование сети /24 | ~30-40 сек |

### Raspberry Pi 4 (2GB RAM)

| Операция | Время |
|----------|-------|
| Обновление 7 плееров | ~350-450ms |
| Запуск группы из 7 плееров | ~250-300ms |
| Синхронность воспроизведения | <25ms |
| Сканирование сети /24 | ~40-50 сек |

---

## Безопасность

### Firewall (UFW)

```bash
# Установка UFW
sudo apt install ufw

# Разрешите SSH
sudo ufw allow ssh

# Разрешите порт приложения
sudo ufw allow 3000/tcp

# Включите firewall
sudo ufw enable

# Проверка
sudo ufw status
```

### Обновления системы

```bash
# Регулярно обновляйте систему
sudo apt update
sudo apt upgrade -y

# Обновление Node.js пакетов
cd ~/wiim-web-control
npm update
```

---

## Доступ из внешней сети (опционально)

⚠️ **Внимание**: Это приложение не имеет встроенной аутентификации!

Если вам нужен доступ из интернета, используйте:

1. **VPN** (WireGuard, OpenVPN) - Рекомендуется
2. **Reverse proxy с аутентификацией** (nginx + basic auth)
3. **Cloudflare Tunnel** - Простой вариант

### Пример: nginx с basic auth

```bash
# Установка nginx
sudo apt install nginx apache2-utils

# Создание пароля
sudo htpasswd -c /etc/nginx/.htpasswd admin

# Конфигурация nginx
sudo nano /etc/nginx/sites-available/wiim

# Содержимое:
server {
    listen 80;
    server_name wiim.yourdomain.com;

    auth_basic "WiiM Control";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Активация
sudo ln -s /etc/nginx/sites-available/wiim /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Рекомендации по эксплуатации

### ✅ DO:
- Используйте Raspberry Pi OS 64-bit
- Устанавливайте Node.js 18+
- Отключайте статистику (`ENABLE_STATS=false`)
- Используйте systemd для автозапуска
- Регулярно обновляйте систему
- Используйте проводное подключение для стабильности

### ❌ DON'T:
- Не используйте старые версии Node.js (<18)
- Не включайте статистику без необходимости
- Не используйте SD карты класса ниже 10
- Не запускайте другие тяжелые приложения одновременно
- Не открывайте порт в интернет без аутентификации

---

## Поддержка

При возникновении проблем:

1. Проверьте логи: `sudo journalctl -u wiim-control -n 100`
2. Проверьте ресурсы: `htop`
3. Проверьте сеть: `ping [WiiM-IP]`
4. Проверьте версию Node.js: `node --version`

Система протестирована на:
- ✅ Raspberry Pi 5 (4GB) - Отлично
- ✅ Raspberry Pi 4 (2GB/4GB) - Хорошо
- ✅ Raspberry Pi 3 B+ - Приемлемо
