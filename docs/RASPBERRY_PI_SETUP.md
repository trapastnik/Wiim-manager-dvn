# Установка WiiM Web Control на Raspberry Pi 5

Полное руководство по установке с автоматическим подключением к WiFi сетям.

## Содержание

1. [Быстрая установка](#быстрая-установка)
2. [Настройка WiFi автоподключения](#настройка-wifi-автоподключения)
3. [Ручная установка](#ручная-установка)
4. [Управление сервисом](#управление-сервисом)
5. [Решение проблем](#решение-проблем)

---

## Быстрая установка

### Шаг 1: Скопировать проект на Raspberry Pi

**С Mac на Raspberry Pi:**

```bash
# На Mac
cd /Users/dvn/Desktop/DDDD/wiim
tar -czf wiim.tar.gz --exclude=node_modules --exclude=.git .
scp wiim.tar.gz user@192.168.1.87:~/

# На Raspberry Pi
cd ~
tar -xzf wiim.tar.gz -C wiim
cd wiim
rm ~/wiim.tar.gz
```

### Шаг 2: Запустить установку

```bash
cd ~/wiim
chmod +x install-rpi.sh
./install-rpi.sh
```

Скрипт автоматически:
- Проверит/установит Node.js
- Установит системные зависимости
- Настроит WiFi сети (интерактивно)
- Создаст systemd сервис
- Запустит сервер

### Шаг 3: Проверить работу

```bash
# Проверить статус
sudo systemctl status wiim-server

# Открыть в браузере
http://192.168.1.87:3000
```

---

## Настройка WiFi автоподключения

### Концепция

Система автоматически:
1. Сканирует доступные WiFi сети при загрузке
2. Подключается к сети с наивысшим приоритетом
3. Если подключение не удалось - пробует следующую
4. После успешного подключения запускает сервер

### Конфигурация сетей

Файл: `wifi-networks.json`

```json
{
  "networks": [
    {
      "ssid": "Home_WiFi",
      "password": "your_password",
      "priority": 100,
      "description": "Домашняя сеть"
    },
    {
      "ssid": "Office_WiFi",
      "password": "office_pass",
      "priority": 80,
      "description": "Офис"
    },
    {
      "ssid": "Mobile_Hotspot",
      "password": "mobile_pass",
      "priority": 50,
      "description": "Мобильный хотспот"
    }
  ]
}
```

**Приоритеты:**
- `100` - Наивысший (домашняя сеть)
- `80-90` - Высокий (офис, знакомые места)
- `50-70` - Средний (публичные места)
- `1-40` - Низкий (запасные сети)

### Создание конфигурации

**Вариант 1: Интерактивно (при установке)**

Скрипт `install-rpi.sh` предложит настроить сети пошагово.

**Вариант 2: Вручную**

```bash
cd ~/wiim
nano wifi-networks.json
```

**Вариант 3: Копирование с примера**

```bash
cp wifi-networks.json.example wifi-networks.json
nano wifi-networks.json  # Отредактировать
```

### Тестирование WiFi скрипта

```bash
# Ручной запуск (для проверки)
cd ~/wiim
./wifi-connect.sh

# Просмотр логов
tail -f /var/log/wiim-wifi.log
```

---

## Ручная установка

Если хотите больше контроля над процессом:

### 1. Установить Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Проверка
```

### 2. Установить зависимости системы

```bash
sudo apt update
sudo apt install -y jq wireless-tools wpasupplicant git
```

### 3. Клонировать проект

```bash
cd ~
git clone <URL_репозитория> wiim
cd wiim
```

### 4. Установить npm зависимости

```bash
npm install
```

### 5. Настроить конфигурацию

```bash
# Создать .env
cat > .env << 'EOF'
WIIM_IP=192.168.1.156
PORT=3000
WIIM_USE_HTTPS=true
EOF
```

### 6. Настроить WiFi сети

```bash
# Скопировать пример
cp wifi-networks.json.example wifi-networks.json

# Отредактировать
nano wifi-networks.json
```

### 7. Установить systemd сервис

```bash
# Сделать скрипты исполняемыми
chmod +x wifi-connect.sh

# Скопировать service файл
sudo cp wiim-server.service /etc/systemd/system/

# Создать лог файл
sudo touch /var/log/wiim-wifi.log
sudo chown $USER:$USER /var/log/wiim-wifi.log

# Активировать сервис
sudo systemctl daemon-reload
sudo systemctl enable wiim-server
sudo systemctl start wiim-server
```

### 8. Проверить запуск

```bash
sudo systemctl status wiim-server
```

---

## Управление сервисом

### Основные команды

```bash
# Статус
sudo systemctl status wiim-server

# Запуск
sudo systemctl start wiim-server

# Остановка
sudo systemctl stop wiim-server

# Перезапуск
sudo systemctl restart wiim-server

# Отключить автозапуск
sudo systemctl disable wiim-server

# Включить автозапуск
sudo systemctl enable wiim-server
```

### Просмотр логов

```bash
# Логи сервера (в реальном времени)
sudo journalctl -u wiim-server -f

# Последние 50 строк логов
sudo journalctl -u wiim-server -n 50

# Логи WiFi подключения
tail -f /var/log/wiim-wifi.log

# Все логи с начала загрузки
sudo journalctl -u wiim-server -b
```

### Редактирование конфигурации

```bash
# Изменить .env
nano ~/wiim/.env

# Изменить WiFi сети
nano ~/wiim/wifi-networks.json

# Перезапустить после изменений
sudo systemctl restart wiim-server
```

---

## Решение проблем

### Сервис не запускается

```bash
# Просмотр ошибок
sudo journalctl -u wiim-server -n 50 --no-pager

# Проверка синтаксиса service файла
systemd-analyze verify /etc/systemd/system/wiim-server.service

# Ручной запуск для отладки
cd ~/wiim
node server.js
```

### WiFi не подключается

```bash
# Просмотр логов WiFi
tail -n 50 /var/log/wiim-wifi.log

# Проверка доступных сетей
sudo iwlist wlan0 scan | grep ESSID

# Ручной запуск WiFi скрипта
cd ~/wiim
./wifi-connect.sh

# Проверка текущего подключения
iwgetid -r
```

### Порт занят

```bash
# Проверить, что использует порт 3000
sudo lsof -i :3000

# Изменить порт
nano ~/wiim/.env
# PORT=8080

sudo systemctl restart wiim-server
```

### Нет доступа с других устройств

```bash
# Проверить IP Raspberry Pi
hostname -I

# Проверить, что сервер слушает все интерфейсы
sudo netstat -tlnp | grep 3000

# Проверить firewall
sudo ufw status
sudo ufw allow 3000/tcp
```

### Node.js устаревшая версия

```bash
# Удалить старую версию
sudo apt remove nodejs

# Установить новую
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Переустановить зависимости
cd ~/wiim
rm -rf node_modules package-lock.json
npm install
```

### Сервис падает при отключении WiFi

Это нормальное поведение. Сервис автоматически перезапустится через 10 секунд (настроено в service файле).

```bash
# Проверить автоперезапуск
sudo systemctl show wiim-server | grep Restart
# Restart=always
# RestartSec=10s
```

---

## Дополнительные возможности

### Изменение пользователя для запуска

По умолчанию сервис работает от пользователя `pi`. Для изменения:

```bash
sudo nano /etc/systemd/system/wiim-server.service
# Изменить: User=your_username

sudo systemctl daemon-reload
sudo systemctl restart wiim-server
```

### Запуск на другом порту

```bash
nano ~/wiim/.env
# PORT=8080

sudo systemctl restart wiim-server
```

### Добавление новой WiFi сети

```bash
# Отредактировать конфигурацию
nano ~/wiim/wifi-networks.json

# Добавить:
# {
#   "ssid": "New_Network",
#   "password": "password",
#   "priority": 60
# }

# Перезапуск не требуется - сеть будет использована при следующем подключении
```

### Отключение WiFi автоподключения

Если хотите управлять WiFi вручную:

```bash
sudo nano /etc/systemd/system/wiim-server.service

# Закомментировать строку:
# ExecStartPre=/home/pi/wiim/wifi-connect.sh

sudo systemctl daemon-reload
sudo systemctl restart wiim-server
```

---

## Автоматическое обновление

Для получения обновлений с GitHub:

```bash
cd ~/wiim

# Остановить сервис
sudo systemctl stop wiim-server

# Сохранить конфигурацию
cp .env ~/.env.backup
cp wifi-networks.json ~/.wifi-networks.json.backup

# Обновить код
git pull

# Обновить зависимости
npm install

# Восстановить конфигурацию
cp ~/.env.backup .env
cp ~/.wifi-networks.json.backup wifi-networks.json

# Запустить
sudo systemctl start wiim-server
```

---

## Безопасность

### Рекомендации

1. **WiFi пароли** - Защитите `wifi-networks.json`:
   ```bash
   chmod 600 ~/wiim/wifi-networks.json
   ```

2. **Firewall** - Ограничьте доступ только локальной сетью:
   ```bash
   sudo ufw enable
   sudo ufw allow from 192.168.1.0/24 to any port 3000
   ```

3. **SSH** - Используйте ключи вместо паролей:
   ```bash
   # На Mac
   ssh-copy-id user@192.168.1.87
   ```

4. **Обновления** - Регулярно обновляйте систему:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

---

## Полезные ссылки

- [Главная документация](../README.md)
- [Быстрый старт](QUICK_START.md)
- [Список возможностей](FEATURES.md)
- [Диагностика](DIAGNOSTICS-GUIDE.md)

---

**Вопросы?** Откройте Issue на GitHub!
