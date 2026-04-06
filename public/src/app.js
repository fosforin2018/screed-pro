// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let rooms = [], editingId = null, roomUid = 0, currentCalc = null;
let corrections = { globalMm: 3, perRoomMm: 0, enabled: true };
let pdfData = { blob: null, name: '', pendingAction: null };

console.log("🚀 [APP] Starting...");

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', () => {
  console.log("📅 [APP] DOMContentLoaded");
  
  if (typeof html2pdf === 'undefined') {
    console.error("❌ html2pdf not loaded");
    document.body.innerHTML = '<div style="padding:40px;text-align:center;color:red">⚠️ Ошибка: нет интернета для PDF</div>';
    return;
  }
  
  loadSettings(); loadTheme();
  document.getElementById('measDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('corrToggle').checked = true;
  toggleCorrection(); addRoom(); renderHistory(); filterForCost();
  
  // Привязываем кнопки модального окна ПОСЛЕ загрузки DOM
  bindModalButtons();
  
  console.log("✅ [APP] Ready");
});

// === ПРИВЯЗКА КНОПОК МОДАЛЬНОГО ОКНА ===
function bindModalButtons() {
  console.log("🔗 [MODAL] Binding buttons...");
  
  const downloadBtn = document.getElementById('btnPdfDownload');
  const shareBtn = document.getElementById('btnPdfShare');
  
  if (downloadBtn) {
    downloadBtn.onclick = async function() {
      console.log("⬇️ [MODAL] Download clicked");
      const type = document.getElementById('modalTitle').textContent.includes('Лист замера') ? 'meas' : 'cost';
      const id = window.currentMeasId;
      const ok = await preparePDFData(type, id);
      if (ok) startPDF('download');
    };
  }
  
  if (shareBtn) {
    shareBtn.onclick = async function() {
      console.log("📤 [MODAL] Share clicked");
      const type = document.getElementById('modalTitle').textContent.includes('Лист замера') ? 'meas' : 'cost';
      const id = window.currentMeasId;
      const ok = await preparePDFData(type, id);
      if (ok) startPDF('share');
    };
  }
  
  console.log("✅ [MODAL] Buttons bound");
}

// === ТЕМЫ ===
function toggleTheme(){
  document.body.classList.toggle('dark');
  const d = document.body.classList.contains('dark');
  document.getElementById('themeBtn').textContent = d ? '☀️' : '🌙';
  localStorage.setItem('darkMode', d ? '1' : '0');
}
function loadTheme(){
  if(localStorage.getItem('darkMode')==='1'){
    document.body.classList.add('dark');
    document.getElementById('themeBtn').textContent='☀️';
  }
}

// === НАВИГАЦИЯ ===
function switchTab(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const m = {pageMeasurements:0, pageCost:1, pageHistory:2, pageSettings:3};
  if(m[id]!==undefined) document.querySelectorAll('.nav-btn')[m[id]].classList.add('active');
  if(id==='pageHistory') renderHistory();
  if(id==='pageCost') showCostList();
}

// === КОМНАТЫ ===
function addRoom(n='',a='',l=''){
  roomUid++;
  rooms.push({id:`r_${Date.now()}_${roomUid}`, name:n||`Комната ${rooms.length+1}`, area:a, layer:l});
  renderRooms(); recalcSummary();
}
function removeRoom(id){
  if(rooms.length<=1) return showToast('⚠️ Нужна хотя бы одна комната');
  rooms = rooms.filter(r=>r.id!==id);
  renderRooms(); recalcSummary();
}
function updateRoom(id,f,v){
  const r = rooms.find(x=>x.id===id);
  if(r){ r[f]=v; recalcSummary(); }
}
function renderRooms(){
  const c = document.getElementById('roomsContainer');
  c.innerHTML = rooms.map((r,i)=>{
    const a = parseFloat(r.area)||0, l = getEff(parseFloat(r.layer)||0);
    const res = (a>0&&l>0) ? `Итог: ${a.toFixed(2)} × ${l} = ${(a*l).toFixed(2)}` : '';
    return `<div class="room-card"><div class="room-header"><span class="room-number">${i+1}</span><button class="btn-remove" onclick="removeRoom('${r.id}')">✕</button></div><div class="room-fields"><div class="field-group"><label>Название</label><input type="text" value="${r.name}" oninput="updateRoom('${r.id}','name',this.value)"></div><div class="field-group"><label>Площадь</label><input type="text" value="${r.area}" oninput="updateRoom('${r.id}','area',this.value)"></div><div class="field-group"><label>Слой</label><input type="number" step="0.1" value="${r.layer}" oninput="updateRoom('${r.id}','layer',this.value)"></div></div><div class="room-result">${res}</div></div>`;
  }).join('');
}

// === КОРРЕКЦИИ ===
function toggleCorrection(){
  corrections.enabled = document.getElementById('corrToggle').checked;
  document.querySelectorAll('.correction-grid input').forEach(i=>i.disabled=!corrections.enabled);
  recalcSummary();
}
function applyCorrections(){
  corrections.globalMm = parseFloat(document.getElementById('corrGlobalMm').value)||0;
  corrections.perRoomMm = parseFloat(document.getElementById('corrPerRoomMm').value)||0;
  recalcSummary();
}
function getEff(baseCm, corr){
  const c = corr||corrections;
  if(!c.enabled) return baseCm;
  return baseCm + (c.globalMm/10) + (c.perRoomMm/10);
}
function recalcSummary(){
  let ta=0, w=0;
  rooms.forEach(r=>{ const a=parseFloat(r.area)||0, l=getEff(parseFloat(r.layer)||0); if(a>0){ ta+=a; w+=(a*l); }});
  const avg = ta>0 ? w/ta : 0;
  document.getElementById('totalArea').textContent = ta.toFixed(2)+' м²';
  document.getElementById('avgLayer').textContent = avg.toFixed(2)+' см';
  document.getElementById('totalVolume').textContent = (ta*avg/100).toFixed(3)+' м³';
  document.getElementById('totalIndex').textContent = w.toFixed(2);
}

// === СОХРАНЕНИЕ ===
function saveMeasurement(){
  const addr = document.getElementById('addressInput').value.trim();
  if(!addr) return showToast('⚠️ Введите адрес');
  if(rooms.filter(r=>parseFloat(r.area)>0).length===0) return showToast('⚠️ Заполните площадь');
  
  let ta=0, w=0;
  rooms.forEach(r=>{ const a=parseFloat(r.area)||0, l=getEff(parseFloat(r.layer)||0); if(a>0){ ta+=a; w+=(a*l); }});
  
  const data = {
    id: editingId||'m_'+Date.now(),
    address: addr,
    client: document.getElementById('clientName').value.trim(),
    date: document.getElementById('measDate').value,
    rooms: JSON.parse(JSON.stringify(rooms)),
    totalArea: ta,
    avgLayer: ta>0 ? w/ta : 0,
    corrections: {...corrections},
    savedAt: new Date().toISOString()
  };
  
  let db = getDB();
  if(editingId){ const i=db.findIndex(m=>m.id===editingId); if(i!==-1) db[i]=data; editingId=null; }
  else db.push(data);
  
  localStorage.setItem('screed_final', JSON.stringify(db));
  showToast('✅ Сохранено'); clearForm();
}
function getDB(){ return JSON.parse(localStorage.getItem('screed_final')||'[]'); }

// === ИСТОРИЯ ===
function renderHistory(){
  const db = getDB(), list = document.getElementById('savedList');
  if(db.length===0){ list.innerHTML=''; document.getElementById('emptyState').style.display='block'; return; }
  document.getElementById('emptyState').style.display='none';
  
  list.innerHTML = db.map(m=>{
    const c = m.corrections||{};
    const hint = c.enabled ? ` • 🔧 ${c.globalMm||0}/${c.perRoomMm||0}мм` : '';
    return `<li class="saved-item"><div class="saved-address">📍 ${m.address}</div><div class="saved-client">👤 ${m.client||'—'}</div><div class="saved-meta">${m.date||''} · ${m.totalArea.toFixed(1)} м²${hint}</div><div class="saved-actions"><button class="btn-edit" onclick="window.loadMeasurement('${m.id}')">✏️</button><button class="btn-calc" onclick="window.calcFromArchive('${m.id}')">💰</button><button class="btn-pdf-m" onclick="window.showMeasPDFModal('${m.id}')">📄</button><button class="btn-del" onclick="window.deleteMeasurement('${m.id}')">🗑</button></div></li>`;
  }).join('');
}

// === РАСЧЁТ СТОИМОСТИ ===
window.calcFromArchive = function(id){
  switchTab('pageCost');
  setTimeout(()=>calculateCost(id), 200);
};

function calculateCost(id){
  const m = getDB().find(x=>x.id===id); if(!m) return;
  const s = getSettings(), area = m.totalArea, layer = m.avgLayer;
  
  const mixKg = area*layer*s.mixDensity;
  const sandKg = mixKg*(s.ratio/(s.ratio+1)), cemKg = mixKg*(1/(s.ratio+1));
  const sandB = Math.ceil(sandKg/s.sandBagW), cemB = Math.ceil(cemKg/s.cementBagW);
  const sandC = sandB*s.sandPrice, cemC = cemB*s.cementPrice;
  const fibKg = (area*s.fiberG)/1000, fibC = fibKg*s.fiberPrice, filmC = area*s.filmPrice;
  const totTons = (sandKg+cemKg)/1000, trips = Math.ceil(totTons/s.truckCap);
  const delC = trips*s.deliveryPrice, liftC = Math.ceil(totTons)*s.liftPrice, labC = area*s.laborPrice;
  
  const total = sandC+cemC+fibC+filmC+delC+liftC+labC, ppm = total/area;
  
  currentCalc = {m,s,area,layer,total,ppm,sandB,sandC,cemB,cemC,fibKg,fibC,filmC,totTons,trips,delC,liftC,labC};
  
  const box = document.getElementById('costResult');
  box.style.display = 'block';
  box.innerHTML = `<div class="cost-summary"><div><div class="label">Площадь</div><div class="value">${area.toFixed(2)} м²</div></div><div><div class="label">Слой</div><div class="value">${layer.toFixed(1)} см</div></div><div><div class="label">Цена/м²</div><div class="value">${ppm.toFixed(0)} ₽</div></div></div><table class="cost-table"><tr><th>Позиция</th><th>Расчёт</th><th style="text-align:right">Сумма</th></tr><tr><td>Песок</td><td>${sandB} меш.</td><td style="text-align:right">${sandC.toLocaleString()} ₽</td></tr><tr><td>Цемент</td><td>${cemB} меш.</td><td style="text-align:right">${cemC.toLocaleString()} ₽</td></tr><tr><td>Фибра</td><td>${fibKg.toFixed(1)} кг</td><td style="text-align:right">${fibC.toFixed(0)} ₽</td></tr><tr><td>Плёнка</td><td>${area.toFixed(1)} м²</td><td style="text-align:right">${filmC.toFixed(0)} ₽</td></tr><tr><td>Доставка</td><td>${trips} рейс.</td><td style="text-align:right">${delC.toLocaleString()} ₽</td></tr><tr><td>Подъём</td><td>${Math.ceil(totTons)} т</td><td style="text-align:right">${liftC.toLocaleString()} ₽</td></tr><tr><td>Работа</td><td>${area.toFixed(1)} м²</td><td style="text-align:right">${labC.toLocaleString()} ₽</td></tr><tr class="total-row"><td>ИТОГО</td><td></td><td style="text-align:right">${total.toLocaleString()} ₽</td></tr></table><div class="btn-group"><button class="btn btn-secondary" onclick="showCostList()">← Назад</button><button class="btn" style="background:var(--success)" onclick="window.showCostPDFModal()">📥 PDF</button></div>`;
}

// === 📄 PDF: МОДАЛЬНОЕ ОКНО ===
function closeModal(){
  const modal = document.getElementById('pdfModal');
  if(modal) modal.classList.remove('show');
}

window.showMeasPDFModal = function(id){
  console.log("📄 [PDF] Opening meas modal, id:", id);
  window.currentMeasId = id; // Сохраняем ID для кнопок
  
  const modal = document.getElementById('pdfModal');
  if(!modal) return showToast('⚠️ Ошибка интерфейса');
  
  document.getElementById('modalTitle').textContent = '📄 Лист замера';
  document.getElementById('modalText').textContent = 'Нажмите кнопку для создания файла';
  modal.classList.add('show');
  
  // Перепривязываем кнопки (на случай, если они изменились)
  bindModalButtons();
};

window.showCostPDFModal = function(){
  if(!currentCalc || !currentCalc.m) return showToast('⚠️ Сначала выполните расчёт');
  console.log("💰 [PDF] Opening cost modal");
  
  window.currentMeasId = null; // Для КП не нужен ID
  
  const modal = document.getElementById('pdfModal');
  if(!modal) return showToast('⚠️ Ошибка интерфейса');
  
  document.getElementById('modalTitle').textContent = '💰 Коммерческое предложение';
  document.getElementById('modalText').textContent = 'Нажмите кнопку для создания файла';
  modal.classList.add('show');
  
  bindModalButtons();
};

// === 📄 PDF: ГЕНЕРАЦИЯ ===
async function preparePDFData(type, id) {
  console.log(`📄 [PDF] Preparing ${type}, id=${id}`);
  
  const m = type === 'meas' && id ? getDB().find(x => x.id === id) : (type === 'cost' ? currentCalc?.m : null);
  if (!m) return showToast('⚠️ Данные не найдены');
  
  if (type === 'meas') {
    // Заполняем лист замера
    document.getElementById('pdfMeasAddr').textContent = m.address;
    document.getElementById('pdfMeasClient').textContent = m.client || 'Не указан';
    document.getElementById('pdfMeasArea').textContent = m.totalArea.toFixed(2) + ' м²';
    document.getElementById('pdfMeasLayer').textContent = m.avgLayer.toFixed(2) + ' см';
    document.getElementById('pdfMeasDate').textContent = m.date || new Date().toLocaleDateString('ru-RU');
    document.getElementById('pdfMeasGenDate').textContent = new Date().toLocaleString('ru-RU');
    
    const tb = document.getElementById('pdfMeasRows'); tb.innerHTML = ''; let idx = 0;
    m.rooms.forEach(r => {
      const a = parseFloat(r.area)||0, base = parseFloat(r.layer)||0;
      const eff = base + (corrections.globalMm/10) + (corrections.perRoomMm/10);
      const res = a * eff; idx += res;
      if(a > 0) tb.innerHTML += `<tr><td>${r.name}</td><td style="text-align:right">${a.toFixed(2)}</td><td style="text-align:right">${eff.toFixed(1)}</td><td style="text-align:right;font-weight:600">${res.toFixed(2)}</td></tr>`;
    });
    document.getElementById('pdfMeasIndex').textContent = idx.toFixed(2);
    
  } else if (type === 'cost' && currentCalc) {
    // Заполняем КП
    const {s,area,layer,total,ppm,sandB,sandC,cemB,cemC,fibKg,fibC,filmC,totTons,trips,delC,liftC,labC} = currentCalc;
    
    document.getElementById('pdfCostNum').textContent = '№'+Math.floor(1000+Math.random()*9000);
    document.getElementById('pdfCostDate').textContent = new Date().toLocaleDateString('ru-RU');
    document.getElementById('pdfCostGenDate').textContent = new Date().toLocaleString('ru-RU');
    
    document.getElementById('pdfCostRows').innerHTML = `
      <tr><td>Песок</td><td>${sandB} меш.</td><td>${s.sandPrice} ₽</td><td style="text-align:right">${sandC.toLocaleString()} ₽</td></tr>
      <tr><td>Цемент</td><td>${cemB} меш.</td><td>${s.cementPrice} ₽</td><td style="text-align:right">${cemC.toLocaleString()} ₽</td></tr>
      <tr><td>Фибра</td><td>${fibKg.toFixed(1)} кг</td><td>${s.fiberPrice} ₽</td><td style="text-align:right">${fibC.toFixed(0)} ₽</td></tr>
      <tr><td>Плёнка</td><td>${area.toFixed(1)} м²</td><td>${s.filmPrice} ₽</td><td style="text-align:right">${filmC.toFixed(0)} ₽</td></tr>
      <tr><td>Доставка</td><td>${trips} рейс.</td><td>${s.deliveryPrice} ₽</td><td style="text-align:right">${delC.toLocaleString()} ₽</td></tr>
      <tr><td>Подъём</td><td>${Math.ceil(totTons)} т</td><td>${s.liftPrice} ₽</td><td style="text-align:right">${liftC.toLocaleString()} ₽</td></tr>
      <tr style="font-weight:600"><td>Работа</td><td>${area.toFixed(1)} м²</td><td>${s.laborPrice} ₽/м²</td><td style="text-align:right">${labC.toLocaleString()} ₽</td></tr>
    `;
    document.getElementById('pdfCostTotal').textContent = total.toLocaleString('ru-RU') + ' ₽';
  }
  
  // Генерация PDF
  const tplId = type === 'meas' ? 'pdfMeasCont' : 'pdfCostCont';
  const tpl = document.getElementById(tplId);
  if(!tpl) return showToast('⚠️ Шаблон не найден');
  
  tpl.style.display = 'block';
  pdfData.name = `${type === 'meas' ? 'ЛистЗамера' : 'Расчёт'}_${Date.now()}.pdf`;
  
  const opt = {
    margin:[5,5,5,5], filename: pdfData.name, image:{type:'jpeg',quality:0.98},
    html2canvas:{scale:2,useCORS:true,logging:false,windowWidth:800},
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait',compress:true}
  };
  
  try {
    await new Promise(r => setTimeout(r, 500));
    pdfData.blob = await html2pdf().set(opt).from(tpl).outputPdf('blob');
    tpl.style.display = 'none';
    console.log("✅ [PDF] Generated");
    showToast('✅ PDF готов');
    return true;
  } catch(e) {
    console.error("❌ [PDF] Error:", e);
    tpl.style.display = 'none';
    showToast('⚠️ Ошибка: ' + e.message);
    return false;
  }
}

// === 📄 PDF: СКАЧИВАНИЕ / ОТПРАВКА ===
function startPDF(action) {
  console.log("💾 [PDF] startPDF:", action);
  if (!pdfData || !pdfData.blob) return showToast('⚠️ Файл не создан');
  
  pdfData.pendingAction = action;
  const url = URL.createObjectURL(pdfData.blob);
  const file = new File([pdfData.blob], pdfData.name, { type: 'application/pdf' });
  
  if (action === 'share' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: pdfData.name, text: 'Документ из Стяжка Pro' })
      .then(() => showToast('📤 Отправлено'))
      .catch(() => executeFallback(url));
  } else { 
    executeFallback(url); 
  }
}

function executeFallback(url){
  if(navigator.userAgent.match(/iPad|iPhone|iPod/i)){
    const win = window.open(url, '_blank');
    if(!win) showToast('📥 Разрешите всплывающие окна');
  } else {
    const a = document.createElement('a');
    a.href = url; a.download = pdfData.name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
  }
  URL.revokeObjectURL(url);
  showToast('✅ Файл сохранён');
}

// === НАСТРОЙКИ ===
function getSettings(){
  const g=id=>parseFloat(document.getElementById(id).value)||0, t=id=>document.getElementById(id)?.value||'';
  return {
    sandBagW:g('sandBagW'),sandPrice:g('sandPrice'),cementBagW:g('cementBagW'),cementPrice:g('cementPrice'),
    ratio:g('ratio')||3,mixDensity:g('mixDensity')||20,truckCap:g('truckCap')||5,deliveryPrice:g('deliveryPrice')||4000,
    liftPrice:g('liftPrice')||800,fiberG:g('fiberG')||50,fiberPrice:g('fiberPrice')||450,filmPrice:g('filmPrice')||25,
    laborPrice:g('laborPrice')||450,logoUrl:t('logoUrl'),masterName:t('masterName')
  };
}
function saveSettings(){
  ['sandBagW','sandPrice','cementBagW','cementPrice','ratio','mixDensity','truckCap','deliveryPrice','liftPrice','fiberG','fiberPrice','filmPrice','laborPrice','logoUrl','masterName'].forEach(id=>{
    if(document.getElementById(id)) localStorage.setItem(id, document.getElementById(id).value);
  });
}
function loadSettings(){
  ['sandBagW','sandPrice','cementBagW','cementPrice','ratio','mixDensity','truckCap','deliveryPrice','liftPrice','fiberG','fiberPrice','filmPrice','laborPrice','logoUrl','masterName'].forEach(id=>{
    if(localStorage.getItem(id) && document.getElementById(id)) document.getElementById(id).value = localStorage.getItem(id);
  });
}
function clearAllData(){ if(!confirm('Удалить ВСЕ данные?')) return; localStorage.clear(); location.reload(); }
function exportData(){ const d={v:'8.0',date:new Date().toISOString(),measurements:getDB(),settings:getSettings()}, b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}), a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`ScreedBackup_${new Date().toISOString().split('T')[0]}.json`; a.click(); showToast('📤 Экспорт готов'); }
function importData(inp){ const f=inp.files[0]; if(!f) return; const r=new FileReader(); r.onload=e=>{ try{ const d=JSON.parse(e.target.result); if(d.measurements) localStorage.setItem('screed_final',JSON.stringify(d.measurements)); if(d.settings){ Object.keys(d.settings).forEach(k=>{ if(document.getElementById(k)) document.getElementById(k).value=d.settings[k] }); saveSettings(); } renderHistory(); filterForCost(); showToast('📥 Импорт успешен'); } catch(err){ showToast('⚠️ Ошибка файла'); } }; r.readAsText(f); inp.value=''; }

// === УВЕДОМЛЕНИЯ ===
function showToast(msg){ const t=document.getElementById('toast'); if(!t) return alert(msg); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),3000); }

// === 🚨 ГЛОБАЛЬНЫЙ ЭКСПОРТ ===
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.addRoom = addRoom;
window.removeRoom = removeRoom;
window.updateRoom = updateRoom;
window.renderRooms = renderRooms;
window.toggleCorrection = toggleCorrection;
window.applyCorrections = applyCorrections;
window.saveMeasurement = saveMeasurement;
window.loadMeasurement = function(id){ /* упрощённая загрузка */ const m=getDB().find(x=>x.id===id); if(m){ rooms=JSON.parse(JSON.stringify(m.rooms)); renderRooms(); recalcSummary(); switchTab('pageMeasurements'); } };
window.deleteMeasurement = function(id){ if(confirm('Удалить?')){ localStorage.setItem('screed_final',JSON.stringify(getDB().filter(m=>m.id!==id))); renderHistory(); } };
window.clearForm = function(){ rooms=[]; editingId=null; renderRooms(); recalcSummary(); };
window.calcFromArchive = window.calcFromArchive;
window.showCostList = function(){ document.getElementById('costResult').style.display='none'; document.getElementById('costList').style.display='block'; };
window.filterForCost = function(){};
window.calculateCost = calculateCost;
window.closeModal = closeModal;
window.showMeasPDFModal = window.showMeasPDFModal;
window.showCostPDFModal = window.showCostPDFModal;
window.startPDF = startPDF;
window.exportData = exportData;
window.importData = importData;
window.showToast = showToast;
window.saveSettings = saveSettings;
window.clearAllData = clearAllData;

console.log("✅ [APP] All functions exported");
