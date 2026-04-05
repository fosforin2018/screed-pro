#!/data/data/com.termux/files/usr/bin/bash

# Добавляем новые функции для работы с подписью
cat >> ~/screed-pro/public/src/app.js << 'APPENDEOF'

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПОДПИСИ В PDF ===
function setupMeasPDFSignature() {
  const settings = getSettings();
  const masterName = settings.masterName || 'Мастер-замерщик';
  const logoUrl = settings.logoUrl || '';
  
  // Подпись в листе замера
  document.getElementById('pdfMeasMasterName').textContent = masterName;
  
  // Логотип в листе замера
  const logoArea = document.getElementById('pdfMeasLogoArea');
  if (logoUrl) {
    if (logoUrl.startsWith('http') || logoUrl.startsWith('data:image')) {
      logoArea.innerHTML = `<img src="${logoUrl}" style="max-width:100px; max-height:60px; object-fit:contain;">`;
    } else {
      logoArea.innerHTML = `<div style="font-size:11px; font-weight:600;">${logoUrl}</div>`;
    }
  } else {
    logoArea.innerHTML = '';
  }
}

function setupCostPDFSignature() {
  const settings = getSettings();
  const masterName = settings.masterName || 'Руководитель';
  const logoUrl = settings.logoUrl || '';
  
  // Подпись в КП
  document.getElementById('pdfCostMasterName').textContent = masterName;
  
  // Логотип в КП
  const logoArea = document.getElementById('pdfCostLogoArea');
  if (logoUrl) {
    if (logoUrl.startsWith('http') || logoUrl.startsWith('data:image')) {
      logoArea.innerHTML = `<img src="${logoUrl}" style="max-width:120px; max-height:70px; object-fit:contain;">`;
    } else {
      logoArea.innerHTML = `<div style="font-size:12px; font-weight:600; color:#1e3a8a;">${logoUrl}</div>`;
    }
  } else {
    logoArea.innerHTML = '<div style="width:120px; height:70px; background:#f8fafc; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:10px; color:#94a3b8;">LOGO</div>';
  }
}

function setupPDFDocNumbers() {
  const docNum = '№' + Math.floor(1000 + Math.random() * 9000);
  const measDate = new Date().toLocaleDateString('ru-RU');
  
  document.getElementById('pdfMeasDocNum').textContent = docNum;
  document.getElementById('pdfMeasDate').textContent = measDate;
  document.getElementById('pdfCostNum').textContent = docNum;
  document.getElementById('pdfCostDate').textContent = measDate;
}
APPENDEOF

echo "✅ Функции для подписи добавлены в app.js"
