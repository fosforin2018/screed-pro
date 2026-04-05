#!/data/data/com.termux/files/usr/bin/bash
set -e
cd ~/screed-pro
echo "🔨 Сборка веб-части..."
npx vite build
echo "📱 Синхронизация с Android..."
npx cap sync android
echo "📤 Отправка на GitHub для сборки APK..."
git add .
git commit -m "Update: $(date '+%Y-%m-%d %H:%M')" --allow-empty
git push
echo "✅ Готово! Откройте Actions на GitHub и скачайте новый APK из Artifacts."
