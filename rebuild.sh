#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "🔨 [1/5] Сборка веб-части (Vite)..."
npx vite build

echo "📱 [2/5] Синхронизация с Android (Capacitor)..."
npx cap sync android

echo "📤 [3/5] Добавление изменений в Git..."
cd ~/screed-pro
git add .

echo "📝 [4/5] Фиксация (Commit)..."
git commit -m "Auto-update: $(date '+%Y-%m-%d %H:%M:%S')" --allow-empty

echo "🚀 [5/5] Отправка на GitHub (Build)..."
git push

echo "✅ ГОТОВО! Откройте Actions на GitHub и скачайте новый APK через 5 минут."
