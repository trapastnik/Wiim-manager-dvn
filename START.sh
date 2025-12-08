#!/bin/bash

echo "=== Запуск WiiM Web Control ==="
echo ""
echo "Проверка конфигурации..."
cat .env
echo ""
echo "Запуск сервера..."
node server.js
