// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let rooms = [], editingId = null, roomUid = 0, currentCalc = null;
let corrections = { globalMm: 3, perRoomMm: 0, enabled: true };

// === БЕЗОПАСНЫЙ КАЛЬКУЛЯТОР ===
function safeCalculate(str) {
    const cleanStr = str.replace(/[^0-9\.\+\-\*\/\(\)]/g, '');
    if (!cleanStr) return 0;
    try { return new Function('return ' + cleanStr)(); } 
    catch (e) { return 0; }
}

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', () => { 
  loadSettings(); loadTheme();
  document.getElementById('measDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('corrToggle').checked = true;
  toggleCorrection(); addRoom(); renderHistory(); filterForCost();
});

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
  if(r){
    r[f]=v;
    const el = document.getElementById(`res-${id}`);
    if(el){
      const a = parseFloat(r.area)||0, l = getEff(parseFloat(r.layer)||0);
      el.textContent = (a>0&&l>0) ? `Итог: ${a} × ${l} = ${(a*l).toFixed(2)}` : '';
    }
    recalcSummary();
  }
}
function renderRooms(){
  const c = document.getElementById('roomsContainer');
  c.innerHTML = rooms.map((r,i)=>{
    const a = parseFloat(r.area)||0;
    const l = getEff(parseFloat(r.layer)||0);
    const res = (a>0&&l>0) ? `Итог: ${a.toFixed(2)} × ${l} = ${(a*l).toFixed(2)}` : '';
    return `<div class="room-card"><div class="room-header"><span class="room-number">${i+1}</span><button class="btn-remove" onclick="removeRoom('${r.id}')">✕</button></div><div class="room-fields"><div class="field-group"><label>Название</label><input type="text" value="${r.name}" oninput="updateRoom('${r.id}','name',this.value)"></div><div class="field-group"><label>Площадь (м²)</label><input type="text" placeholder="3.5+6.7" value="${r.area}" oninput="handleAreaInput('${r.id}', this.value)"></div><div class="field-group"><label>Слой (см)</label><input type="number" step="0.1" min="0" value="${r.layer}" oninput="updateRoom('${r.id}','layer',this.value)"></div></div><div class="room-result" id="res-${r.id}">${res}</div></div>`;
  }).join('');
}
function handleAreaInput(id, val) {
  const numVal = safeCalculate(val);
  updateRoom(id, 'area', val);
  const r = rooms.find(x=>x.id===id);
  if(r && r.area) {
    const el = document.getElementById(`res-${r.id}`);
    if(el) {
      const l = getEff(parseFloat(r.layer)||0);
      const res = (numVal>0&&l>0) ? `Итог: ${numVal.toFixed(2)} × ${l} = ${(numVal*l).toFixed(2)}` : '';
      el.textContent = res;
    }
  }
  recalcSummary();
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
  const avg = ta>0 ? w/ta : 0, vol = ta*(avg/100);
  document.getElementById('totalArea').textContent = ta.toFixed(2)+' м²';
  document.getElementById('avgLayer').textContent = avg.toFixed(2)+' см';
  document.getElementById('totalVolume').textContent = vol.toFixed(3)+' м³';
  document.getElementById('totalIndex').textContent = w.toFixed(2);
}

// === СОХРАНЕНИЕ ===
function saveMeasurement(){
  const addr = document.getElementById('addressInput').value.trim(),
        dt = document.getElementById('measDate').value,
        cl = document.getElementById('clientName').value.trim();
  if(!addr) return showToast('⚠️ Введите адрес');
  if(rooms.filter(r=>parseFloat(r.area)>0).length===0) return showToast('⚠️ Заполните площадь');
  let ta=0, w=0;
  rooms.forEach(r=>{ const a=parseFloat(r.area)||0, l=getEff(parseFloat(r.layer)||0); if(a>0){ ta+=a; w+=(a*l); }});
  const data = {
    id: editingId||'m_'+Date.now(), address:addr, client:cl, date:dt,
    rooms: JSON.parse(JSON.stringify(rooms)), totalArea:ta, avgLayer: ta>0?w/ta:0,
    corrections: {...corrections}, savedAt: new Date().toISOString()
  };
  let db = getDB();
  if(editingId){ const i=db.findIndex(m=>m.id===editingId); if(i!==-1) db[i]=data; editingId=null; document.getElementById('editIndicator').classList.remove('visible'); }
  else db.push(data);
  localStorage.setItem('screed_final', JSON.stringify(db));
  showToast('✅ Сохранено'); clearForm();
}
function getDB(){ return JSON.parse(localStorage.getItem('screed_final')||'[]'); }
function loadMeasurement(id){
  const m = getDB().find(x=>x.id===id); if(!m) return;
  editingId = m.id;
  document.getElementById('addressInput').value = m.address;
  document.getElementById('clientName').value = m.client||'';
  document.getElementById('measDate').value = m.date||new Date().toISOString().split('T')[0];
  rooms = JSON.parse(JSON.stringify(m.rooms));
  corrections = m.corrections||{globalMm:0,perRoomMm:0,enabled:false};
  document.getElementById('corrGlobalMm').value = corrections.globalMm;
  document.getElementById('corrPerRoomMm').value = corrections.perRoomMm;
  document.getElementById('corrToggle').checked = corrections.enabled;
  toggleCorrection(); renderRooms(); recalcSummary();
  document.getElementById('editIndicator').classList.add('visible');
  switchTab('pageMeasurements'); showToast('✏️ Загружено');
}
function deleteMeasurement(id){
  if(!confirm('Удалить замер?')) return;
  localStorage.setItem('screed_final', JSON.stringify(getDB().filter(m=>m.id!==id)));
  renderHistory(); filterForCost(); showToast('🗑 Удалено');
}
function clearForm(){
  document.getElementById('addressInput').value='';
  document.getElementById('clientName').value='';
  document.getElementById('measDate').value=new Date().toISOString().split('T')[0];
  rooms=[]; editingId=null;
  corrections={globalMm:3,perRoomMm:0,enabled:true};
  document.getElementById('corrGlobalMm').value=3;
  document.getElementById('corrPerRoomMm').value=0;
  document.getElementById('corrToggle').checked=true;
  toggleCorrection();
  document.getElementById('editIndicator').classList.remove('visible');
  addRoom();
}

// === ИСТОРИЯ ===
function renderHistory(){
  const db=getDB(), list=document.getElementById('savedList'), emp=document.getElementById('emptyState');
  if(db.length===0){ list.innerHTML=''; emp.style.display='block'; return; }
  emp.style.display='none';
  list.innerHTML = db.map(m=>{
    const c=m.corrections||{globalMm:0,perRoomMm:0,enabled:false};
    const hint = c.enabled ? ` • 🔧 ${c.globalMm>0?'+':''}${c.globalMm}/${c.perRoomMm>0?'+':''}${c.perRoomMm}мм` : '';
    return `<li class="saved-item"><div class="saved-address">📍 ${m.address}</div><div class="saved-client">👤 ${m.client||'Не указан'}</div><div class="saved-meta">${m.date||''} · ${m.rooms.length} комн. · ${m.totalArea.toFixed(1)} м² · ${m.avgLayer.toFixed(1)} см${hint}</div><div class="saved-actions"><button class="btn-edit" onclick="window.loadMeasurement('${m.id}')">✏️ Редактировать</button><button class="btn-calc" onclick="window.calcFromArchive('${m.id}')">💰 Расчёт</button><button class="btn-pdf-m" onclick="window.showMeasPDFModal('${m.id}')">📄 Лист замера</button><button class="btn-del" onclick="window.deleteMeasurement('${m.id}')">🗑 Удалить</button></div></li>`;
  }).join('');
}

// === РАСЧЁТ СТОИМОСТИ ===
window.calcFromArchive = function(id){
  switchTab('pageCost');
  document.getElementById('costSearchBlock').style.display='none';
  document.getElementById('costList').style.display='none';
  document.getElementById('costResult').style.display='none';
  setTimeout(()=>calculateCost(id), 200);
};
function showCostList(){
  document.getElementById('costSearchBlock').style.display='block';
  document.getElementById('costList').style.display='block';
  document.getElementById('costResult').style.display='none';
  document.getElementById('searchCost').value='';
  filterForCost();
}
function filterForCost(){
  const q = document.getElementById('searchCost').value.toLowerCase();
  const db = getDB().filter(m => (m.address||'').toLowerCase().includes(q) || (m.client||'').toLowerCase().includes(q) || (m.date||'').includes(q));
  const cont = document.getElementById('costList');
  if(q.length>0 && db.length===0){ cont.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-secondary)">Ничего не найдено</div>'; return; }
  cont.innerHTML = db.map(m=>`<div class="cost-item" id="ci-${m.id}" onclick="window.calcFromArchive('${m.id}')"><div style="font-weight:600">📍 ${m.address}</div><div style="font-size:12px;color:var(--text-secondary)">👤 ${m.client||'—'} • 📅 ${m.date||'—'} • ${m.totalArea.toFixed(1)} м²</div></div>`).join('');
}
function calculateCost(id){
  if(!id) return showToast('⚠️ Выберите замер');
  const m = getDB().find(x=>x.id===id); if(!m) return;
  const s = getSettings(), area = m.totalArea, layer = m.avgLayer;
  const mixKg = area*layer*s.mixDensity, sandKg = mixKg*(s.ratio/(s.ratio+1)), cemKg = mixKg*(1/(s.ratio+1));
  const sandB = Math.ceil(sandKg/s.sandBagW), cemB = Math.ceil(cemKg/s.cementBagW), sandC = sandB*s.sandPrice, cemC = cemB*s.cementPrice;
  const fibKg = (area*s.fiberG)/1000, fibC = fibKg*s.fiberPrice, filmC = area*s.filmPrice;
  const totTons = (sandKg+cemKg)/1000, trips = Math.ceil(totTons/s.truckCap), delC = trips*s.deliveryPrice, liftC = Math.ceil(totTons)*s.liftPrice, labC = area*s.laborPrice;
  let meshC = 0;
  if(s.meshEnabled) { const mArea = s.meshArea > 0 ? s.meshArea : area; meshC = mArea * s.meshPrice; }
  const total = sandC+cemC+fibC+filmC+meshC+delC+liftC+labC, ppm = total/area;
  currentCalc = {m,s,area,layer,total,ppm,sandB,sandC,cemB,cemC,fibKg,fibC,filmC,meshC,totTons,trips,delC,liftC,labC};
  const box = document.getElementById('costResult'); box.style.display='block';
  box.innerHTML = `<div class="cost-summary"><div class="cost-summary-item"><div class="label">Площадь</div><div class="value">${area.toFixed(2)} м²</div></div><div class="cost-summary-item"><div class="label">Слой</div><div class="value">${layer.toFixed(1)} см</div></div><div class="cost-summary-item"><div class="label">Цена/м²</div><div class="value">${ppm.toFixed(0)} ₽</div></div></div><div class="cost-result"><table class="cost-table"><tr><th>Позиция</th><th>Расчёт</th><th>Сумма</th></tr><tr><td>Песок</td><td>${sandB} меш.</td><td>${sandC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Цемент</td><td>${cemB} меш.</td><td>${cemC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Фибра</td><td>${fibKg.toFixed(2)} кг</td><td>${fibC.toFixed(0)} ₽</td></tr><tr><td>Плёнка</td><td>${area.toFixed(2)} м²</td><td>${filmC.toFixed(0)} ₽</td></tr>${s.meshEnabled?`<tr><td>Сетка</td><td>${s.meshArea>0?s.meshArea.toFixed(2):area.toFixed(2)} м²</td><td>${s.meshPrice.toFixed(0)} ₽</td><td>${meshC.toLocaleString('ru-RU')} ₽</td></tr>`:''}<tr><td>Доставка</td><td>${totTons.toFixed(1)} т → ${trips} рейс.</td><td>${delC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Подъём</td><td>${Math.ceil(totTons)} т</td><td>${liftC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Работа</td><td>${area.toFixed(2)} м²</td><td>${labC.toLocaleString('ru-RU')} ₽</td></tr><tr class="total-row"><td>ИТОГО</td><td></td><td>${total.toLocaleString('ru-RU')} ₽</td></tr></table><div class="btn-group"><button class="btn btn-secondary" onclick="showCostList()">← Назад</button><button class="btn" style="background:var(--success)" onclick="window.showCostPDFModal()">📥 Показать отчёт</button></div></div>`;
}

// === 📄 HTML ОТЧЁТ ВМЕСТО PDF (простой и надёжный) ===
function showMeasPDFModal(id) {
  // Открываем отдельную страницу отчёта
  const url = `report.html?type=meas&id=${id}`;
  window.open(url, '_blank');
  showToast('📄 Отчёт открыт');
}

function showCostPDFModal() {
  if (!currentCalc) return showToast('⚠️ Сначала выполните расчёт');
  
  const {m, s, area, layer, total, ppm, sandB, sandC, cemB, cemC, fibKg, fibC, filmC, meshC, totTons, trips, delC, liftC, labC} = currentCalc;
  
  const text = `
КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ
№${Math.floor(1000 + Math.random() * 9000)} от ${new Date().toLocaleDateString('ru-RU')}

📍 Объект: ${m.address}
📐 Площадь: ${area.toFixed(2)} м² | Слой: ${layer.toFixed(1)} см
💰 Цена за м²: ${ppm.toFixed(0)} ₽

─────────────────────────
📦 МАТЕРИАЛЫ:
─────────────────────────
• Песок: ${sandB} меш. × ${s.sandPrice} ₽ = ${sandC.toLocaleString('ru-RU')} ₽
• Цемент: ${cemB} меш. × ${s.cementPrice} ₽ = ${cemC.toLocaleString('ru-RU')} ₽
• Фибра: ${fibKg.toFixed(2)} кг × ${s.fiberPrice} ₽ = ${fibC.toFixed(0)} ₽
• Плёнка: ${area.toFixed(2)} м² × ${s.filmPrice} ₽ = ${filmC.toFixed(0)} ₽
${s.meshEnabled ? `• Сетка: ${(s.meshArea > 0 ? s.meshArea : area).toFixed(2)} м² × ${s.meshPrice} ₽ = ${meshC.toLocaleString('ru-RU')} ₽` : ''}

─────────────────────────
🚚 ЛОГИСТИКА:
─────────────────────────
• Доставка: ${trips} рейс. × ${s.deliveryPrice} ₽ = ${delC.toLocaleString('ru-RU')} ₽
• Подъём: ${Math.ceil(totTons)} т × ${s.liftPrice} ₽ = ${liftC.toLocaleString('ru-RU')} ₽

─────────────────────────
👷 РАБОТА:
─────────────────────────
• Стяжка: ${area.toFixed(2)} м² × ${s.laborPrice} ₽/м² = ${labC.toLocaleString('ru-RU')} ₽

═════════════════════════
💵 ИТОГО: ${total.toLocaleString('ru-RU')} ₽
═════════════════════════

✓ Действительно 14 дней
  `.trim();

  // Показываем в модальном окне
  showCostReportModal(text);
}

function showCostReportModal(text) {
  // Удаляем старое модальное окно если есть
  const old = document.getElementById('costReportModal');
  if (old) old.remove();
  
  const modal = document.createElement('div');
  modal.id = 'costReportModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); z-index: 9999;
    display: flex; align-items: center; justify-content: center;
    padding: 20px; font-family: sans-serif;
  `;
  
  modal.innerHTML = `
    <div style="
      background: white; border-radius: 12px; padding: 20px;
      max-width: 450px; width: 100%; max-height: 85vh; overflow-y: auto;
      font-family: monospace; white-space: pre-wrap; line-height: 1.5; font-size: 13px;
    ">${text}</div>
  `;
  
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex; gap:10px; margin-top:15px; justify-content:center; padding-top:15px; border-top:1px solid #eee;';
  actions.innerHTML = `
    <button style="padding:10px 20px; background:#2563eb; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600;">📋 Копировать</button>
    <button style="padding:10px 20px; background:#f1f5f9; color:#475569; border:none; border-radius:8px; cursor:pointer; font-weight:600;">Закрыть</button>
  `;
  
  actions.children[0].onclick = () => {
    navigator.clipboard.writeText(text).then(() => showToast('📋 Скопировано!'));
  };
  actions.children[1].onclick = () => modal.remove();
  
  modal.querySelector('div').appendChild(actions);
  document.body.appendChild(modal);
}

// === НАСТРОЙКИ ===
function getSettings(){
  const g=id=>parseFloat(document.getElementById(id).value)||0, t=id=>document.getElementById(id)?.value||'', chk=id=>document.getElementById(id)?.checked;
  return {sandBagW:g('sandBagW'),sandPrice:g('sandPrice'),cementBagW:g('cementBagW'),cementPrice:g('cementPrice'),ratio:g('ratio')||3,mixDensity:g('mixDensity')||20,truckCap:g('truckCap')||5,deliveryPrice:g('deliveryPrice')||4000,liftPrice:g('liftPrice')||800,fiberG:g('fiberG')||50,fiberPrice:g('fiberPrice')||450,filmPrice:g('filmPrice')||25,meshEnabled:chk('meshEnabled'),meshPrice:g('meshPrice'),meshArea:g('meshArea'),laborPrice:g('laborPrice'),logoUrl:t('logoUrl'),masterName:t('masterName')};
}
function saveSettings(){
  ['sandBagW','sandPrice','cementBagW','cementPrice','ratio','mixDensity','truckCap','deliveryPrice','liftPrice','fiberG','fiberPrice','filmPrice','meshPrice','meshArea','laborPrice'].forEach(id=>localStorage.setItem(id,document.getElementById(id).value));
  localStorage.setItem('meshEnabled', document.getElementById('meshEnabled').checked);
  localStorage.setItem('logoUrl', document.getElementById('logoUrl').value);
  localStorage.setItem('masterName', document.getElementById('masterName').value);
}
function loadSettings(){
  ['sandBagW','sandPrice','cementBagW','cementPrice','ratio','mixDensity','truckCap','deliveryPrice','liftPrice','fiberG','fiberPrice','filmPrice','meshPrice','meshArea','laborPrice'].forEach(id=>{ if(localStorage.getItem(id)) document.getElementById(id).value=localStorage.getItem(id); });
  if(localStorage.getItem('meshEnabled')!==null) document.getElementById('meshEnabled').checked = localStorage.getItem('meshEnabled')==='true';
  if(localStorage.getItem('logoUrl')) document.getElementById('logoUrl').value = localStorage.getItem('logoUrl');
  if(localStorage.getItem('masterName')) document.getElementById('masterName').value = localStorage.getItem('masterName');
}
function clearAllData(){ if(!confirm('Удалить ВСЕ данные?')) return; localStorage.clear(); location.reload(); }
function exportData(){ const d={v:'8.0',date:new Date().toISOString(),measurements:getDB(),settings:getSettings()}, b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}), a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`ScreedBackup_${new Date().toISOString().split('T')[0]}.json`; a.click(); showToast('📤 Экспорт готов'); }
function importData(inp){ const f=inp.files[0]; if(!f) return; const r=new FileReader(); r.onload=e=>{ try{ const d=JSON.parse(e.target.result); if(d.measurements) localStorage.setItem('screed_final',JSON.stringify(d.measurements)); if(d.settings){ Object.keys(d.settings).forEach(k=>{ if(document.getElementById(k)){ if(k==='meshEnabled') document.getElementById(k).checked=d.settings[k]; else document.getElementById(k).value=d.settings[k] }}); saveSettings(); } renderHistory(); filterForCost(); showToast('📥 Импорт успешен'); } catch(err){ showToast('⚠️ Ошибка файла'); } }; r.readAsText(f); inp.value=''; }

// === УВЕДОМЛЕНИЯ ===
function showToast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2500); }

// === 🚨 ГЛОБАЛЬНЫЙ ЭКСПОРТ ФУНКЦИЙ ===
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.addRoom = addRoom;
window.removeRoom = removeRoom;
window.updateRoom = updateRoom;
window.handleAreaInput = handleAreaInput;
window.toggleCorrection = toggleCorrection;
window.applyCorrections = applyCorrections;
window.saveMeasurement = saveMeasurement;
window.loadMeasurement = loadMeasurement;
window.deleteMeasurement = deleteMeasurement;
window.clearForm = clearForm;
window.calcFromArchive = calcFromArchive;
window.showCostList = showCostList;
window.filterForCost = filterForCost;
window.calculateCost = calculateCost;
window.showMeasPDFModal = showMeasPDFModal;
window.showCostPDFModal = showCostPDFModal;
window.exportData = exportData;
window.importData = importData;
window.showToast = showToast;
window.saveSettings = saveSettings;
window.clearAllData = clearAllData;
