// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let rooms = [], editingId = null, roomUid = 0, currentCalc = null;
let corrections = { globalMm: 3, perRoomMm: 0, enabled: true };

console.log('✅ app.js loaded');

// === БЕЗОПАСНЫЙ КАЛЬКУЛЯТОР ===
function safeCalculate(str) {
    const cleanStr = str.replace(/[^0-9\.\+\-\*\/\(\)]/g, '');
    if (!cleanStr) return 0;
    try { return new Function('return ' + cleanStr)(); } 
    catch (e) { return 0; }
}

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', () => { 
  console.log('🚀 DOMContentLoaded');
  loadSettings(); loadTheme();
  document.getElementById('measDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('corrToggle').checked = true;
  toggleCorrection(); addRoom(); renderHistory(); filterForCost();
  console.log('✅ Init complete');
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
  updateRoom(id, 'area', val);
  const r = rooms.find(x=>x.id===id);
  if(r && r.area) {
    const el = document.getElementById(`res-${r.id}`);
    if(el) {
      const numVal = safeCalculate(val);
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
  let meshC = 0, meshArea = 0;
  if(s.meshEnabled) {
    meshArea = s.meshArea > 0 ? s.meshArea : area;
    meshC = meshArea * s.meshPrice;
  }
  const total = sandC+cemC+fibC+filmC+meshC+delC+liftC+labC, ppm = total/area;
  currentCalc = {m,s,area,layer,total,ppm,sandB,sandC,cemB,cemC,fibKg,fibC,filmC,meshC,meshArea,totTons,trips,delC,liftC,labC};
  
  const box = document.getElementById('costResult'); 
  box.style.display='block';
  
  let meshRow = '';
  if(s.meshEnabled && meshArea > 0) {
    meshRow = `<tr><td>Сетка</td><td>${meshArea.toFixed(2)} м²</td><td style="text-align:right">${meshC.toLocaleString('ru-RU')} ₽</td></tr>`;
  }
  
  box.innerHTML = `<div class="cost-summary"><div class="cost-summary-item"><div class="label">Площадь</div><div class="value">${area.toFixed(2)} м²</div></div><div class="cost-summary-item"><div class="label">Слой</div><div class="value">${layer.toFixed(1)} см</div></div><div class="cost-summary-item"><div class="label">Цена/м²</div><div class="value">${ppm.toFixed(0)} ₽</div></div></div><div class="cost-result"><table class="cost-table"><tr><th>Позиция</th><th>Расчёт</th><th style="text-align:right">Сумма</th></tr><tr><td>Песок</td><td>${sandB} меш.</td><td style="text-align:right">${sandC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Цемент</td><td>${cemB} меш.</td><td style="text-align:right">${cemC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Фибра</td><td>${fibKg.toFixed(2)} кг</td><td style="text-align:right">${fibC.toFixed(0)} ₽</td></tr><tr><td>Плёнка</td><td>${area.toFixed(2)} м²</td><td style="text-align:right">${filmC.toFixed(0)} ₽</td></tr>${meshRow}<tr><td>Доставка</td><td>${totTons.toFixed(1)} т → ${trips} рейс.</td><td style="text-align:right">${delC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Подъём</td><td>${Math.ceil(totTons)} т</td><td style="text-align:right">${liftC.toLocaleString('ru-RU')} ₽</td></tr><tr><td>Работа</td><td>${area.toFixed(2)} м²</td><td style="text-align:right">${labC.toLocaleString('ru-RU')} ₽</td></tr><tr class="total-row"><td>ИТОГО</td><td></td><td style="text-align:right">${total.toLocaleString('ru-RU')} ₽</td></tr></table><div class="btn-group"><button class="btn btn-secondary" onclick="showCostList()">← Назад</button><button class="btn" style="background:var(--success)" onclick="window.showCostPDFModal()">📥 PDF</button></div></div>`;
}

// === 📄 PDF МОДАЛЬНОЕ ОКНО ===
let currentPdfBlob = null;
let currentPdfName = '';

function closeModal(){ 
  const modal = document.getElementById('pdfModal');
  if(modal) modal.classList.remove('show');
}

function showMeasPDFModal(id){
  console.log('📄 showMeasPDFModal called with id:', id);
  const modal = document.getElementById('pdfModal');
  if(!modal) {
    console.error('❌ Modal element not found!');
    return showToast('⚠️ Ошибка интерфейса');
  }
  
  document.getElementById('modalTitle').textContent='📄 Лист замера';
  document.getElementById('modalText').textContent='Нажмите кнопку для создания файла';
  
  const m = getDB().find(x=>x.id===id);
  if(!m) return showToast('⚠️ Замер не найден');
  
  // Заполняем данные PDF
  fillMeasPDF(m);
  
  // Показываем кнопки
  const actions = document.getElementById('modalActions');
  actions.innerHTML = `
    <button class="modal-btn modal-btn-primary" onclick="generateAndDownloadPDF('meas', '${id}')">📥 Скачать PDF</button>
    <button class="modal-btn modal-btn-success" onclick="generateAndSharePDF('meas', '${id}')">📤 Отправить</button>
    <button class="modal-btn" onclick="closeModal()">Отмена</button>
  `;
  
  modal.classList.add('show');
  showToast('✅ Окно открыто');
}

function showCostPDFModal(){
  console.log('💰 showCostPDFModal called');
  if(!currentCalc) return showToast('⚠️ Сначала выполните расчёт');
  
  const modal = document.getElementById('pdfModal');
  if(!modal) {
    console.error('❌ Modal element not found!');
    return showToast('⚠️ Ошибка интерфейса');
  }
  
  document.getElementById('modalTitle').textContent='💰 Коммерческое предложение';
  document.getElementById('modalText').textContent='Нажмите кнопку для создания файла';
  
  // Заполняем данные PDF
  fillCostPDF();
  
  // Показываем кнопки
  const actions = document.getElementById('modalActions');
  actions.innerHTML = `
    <button class="modal-btn modal-btn-primary" onclick="generateAndDownloadPDF('cost')">📥 Скачать PDF</button>
    <button class="modal-btn modal-btn-success" onclick="generateAndSharePDF('cost')">📤 Отправить</button>
    <button class="modal-btn" onclick="closeModal()">Отмена</button>
  `;
  
  modal.classList.add('show');
  showToast('✅ Окно открыто');
}

function fillMeasPDF(m){
  document.getElementById('pdfMeasAddr').textContent = m.address;
  document.getElementById('pdfMeasClient').textContent = m.client || 'Не указан';
  document.getElementById('pdfMeasArea').textContent = m.totalArea.toFixed(2) + ' м²';
  document.getElementById('pdfMeasLayer').textContent = m.avgLayer.toFixed(2) + ' см';
  document.getElementById('pdfMeasVolume').textContent = (m.totalArea * m.avgLayer / 100).toFixed(2) + ' м³';
  document.getElementById('pdfMeasDocNum').textContent = '№'+Math.floor(1000+Math.random()*9000);
  document.getElementById('pdfMeasDate').textContent = m.date || new Date().toLocaleDateString('ru-RU');
  document.getElementById('pdfMeasGenDate').textContent = new Date().toLocaleString('ru-RU');
  
  const c = m.corrections||{globalMm:0,perRoomMm:0,enabled:false};
  const cBlock = document.getElementById('pdfMeasCorrection');
  const cText = document.getElementById('pdfMeasCorrText');
  
  if(c.enabled && (c.globalMm!==0 || c.perRoomMm!==0)){
    cBlock.style.display = 'block';
    let t='';
    if(c.globalMm!==0) t += `Общая поправка: ${c.globalMm>0?'+':''}${c.globalMm} мм. `;
    if(c.perRoomMm!==0) t += `К каждой комнате: ${c.perRoomMm>0?'+':''}${c.perRoomMm} мм.`;
    cText.textContent = t;
  } else {
    cBlock.style.display = 'none';
  }
  
  const tb = document.getElementById('pdfMeasRows'); 
  tb.innerHTML = ''; 
  let idx = 0;
  
  m.rooms.forEach((r) => {
    const a = parseFloat(r.area)||0;
    const base = parseFloat(r.layer)||0;
    const eff = getEff(base, c);
    const res = a * eff;
    idx += res;
    if(a > 0) {
      tb.innerHTML += `<tr><td>${r.name}</td><td style="text-align:right">${a.toFixed(2)}</td><td style="text-align:right">${eff.toFixed(1)}</td><td style="text-align:right; font-weight:600">${res.toFixed(2)}</td></tr>`;
    }
  });
  
  document.getElementById('pdfMeasIndex').textContent = idx.toFixed(2);
  
  const settings = getSettings();
  document.getElementById('pdfMeasMasterName').textContent = settings.masterName || 'Мастер-замерщик';
}

function fillCostPDF(){
  if(!currentCalc) return;
  const {s,area,layer,total,ppm,sandB,sandC,cemB,cemC,fibKg,fibC,filmC,meshC,meshArea,totTons,trips,delC,liftC,labC} = currentCalc;
  const m = currentCalc.m;
  
  document.getElementById('pdfCostAddr').textContent = m.address;
  document.getElementById('pdfCostArea').textContent = area.toFixed(1) + ' м²';
  document.getElementById('pdfCostLayer').textContent = layer.toFixed(1) + ' см';
  document.getElementById('pdfCostPpm').textContent = ppm.toFixed(0) + ' ₽';
  document.getElementById('pdfCostNum').textContent = '№'+Math.floor(1000+Math.random()*9000);
  document.getElementById('pdfCostDate').textContent = new Date().toLocaleDateString('ru-RU');
  document.getElementById('pdfCostGenDate').textContent = new Date().toLocaleString('ru-RU');
  
  const totalMixKg = area*layer*s.mixDensity; 
  let meshRow='';
  if(s.meshEnabled && meshArea > 0){ 
    meshRow=`<tr><td>Сетка армирующая</td><td>${meshArea.toFixed(1)} м²</td><td>${s.meshPrice} ₽</td><td style="text-align:right">${meshC.toLocaleString()} ₽</td></tr>`; 
  }
  
  document.getElementById('pdfCostRows').innerHTML = `
    <tr><td>Песок</td><td>${sandB} меш. (${(sandB*s.sandBagW)} кг)</td><td>${s.sandPrice} ₽</td><td style="text-align:right">${sandC.toLocaleString()} ₽</td></tr>
    <tr><td>Цемент</td><td>${cemB} меш. (${(cemB*s.cementBagW)} кг)</td><td>${s.cementPrice} ₽</td><td style="text-align:right">${cemC.toLocaleString()} ₽</td></tr>
    <tr><td>Фиброволокно</td><td>${fibKg.toFixed(1)} кг</td><td>${s.fiberPrice} ₽</td><td style="text-align:right">${fibC.toFixed(0)} ₽</td></tr>
    <tr><td>Плёнка</td><td>${area.toFixed(1)} м²</td><td>${s.filmPrice} ₽</td><td style="text-align:right">${filmC.toFixed(0)} ₽</td></tr>
    ${meshRow}
    <tr><td>Доставка</td><td>${trips} рейс. (${(totalMixKg/1000).toFixed(1)} т)</td><td>${s.deliveryPrice} ₽</td><td style="text-align:right">${delC.toLocaleString()} ₽</td></tr>
    <tr><td>Подъём материалов</td><td>${Math.ceil(totalMixKg/1000)} т</td><td>${s.liftPrice} ₽</td><td style="text-align:right">${liftC.toLocaleString()} ₽</td></tr>
    <tr style="font-weight:600"><td>Работа (стяжка)</td><td>${area.toFixed(1)} м²</td><td>${s.laborPrice} ₽/м²</td><td style="text-align:right">${labC.toLocaleString()} ₽</td></tr>
  `;
  
  document.getElementById('pdfCostTotal').textContent = total.toLocaleString('ru-RU') + ' ₽';
}

async function generateAndDownloadPDF(type, id) {
  console.log('📥 generateAndDownloadPDF called', type, id);
  showToast('⏳ Генерация PDF...');
  
  const tplId = type === 'meas' ? 'pdfMeasTpl' : 'pdfCostTpl';
  const contId = type === 'meas' ? 'pdfMeasCont' : 'pdfCostCont';
  const baseName = type === 'meas' ? 'ЛистЗамера' : 'Расчёт';
  
  const tpl = document.getElementById(tplId);
  if(!tpl) {
    console.error('❌ Template not found:', tplId);
    return showToast('⚠️ Шаблон не найден');
  }
  
  tpl.style.display = 'block';
  
  const opt = {
    margin:[5,5,5,5], 
    filename: baseName + '_' + Date.now() + '.pdf', 
    image:{type:'jpeg',quality:0.98}, 
    html2canvas:{scale:2,useCORS:true,logging:false,windowWidth:800}, 
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait',compress:true}
  };
  
  try{
    const blob = await html2pdf().set(opt).from(tpl).outputPdf('blob');
    tpl.style.display = 'none';
    closeModal();
    
    // Скачивание
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = opt.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('✅ PDF сохранён');
  } catch(e){ 
    console.error('❌ PDF Error:',e); 
    tpl.style.display='none'; 
    showToast('⚠️ Ошибка: ' + e.message); 
  }
}

async function generateAndSharePDF(type, id) {
  console.log('📤 generateAndSharePDF called', type, id);
  showToast('⏳ Генерация PDF...');
  
  const tplId = type === 'meas' ? 'pdfMeasTpl' : 'pdfCostTpl';
  const contId = type === 'meas' ? 'pdfMeasCont' : 'pdfCostCont';
  const baseName = type === 'meas' ? 'ЛистЗамера' : 'Расчёт';
  
  const tpl = document.getElementById(tplId);
  if(!tpl) {
    console.error('❌ Template not found:', tplId);
    return showToast('⚠️ Шаблон не найден');
  }
  
  tpl.style.display = 'block';
  
  const opt = {
    margin:[5,5,5,5], 
    filename: baseName + '_' + Date.now() + '.pdf', 
    image:{type:'jpeg',quality:0.98}, 
    html2canvas:{scale:2,useCORS:true,logging:false,windowWidth:800}, 
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait',compress:true}
  };
  
  try{
    const blob = await html2pdf().set(opt).from(tpl).outputPdf('blob');
    tpl.style.display = 'none';
    closeModal();
    
    // Попытка поделиться
    const file = new File([blob], opt.filename, { type: 'application/pdf' });
    
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: opt.filename,
        text: 'Документ из Стяжка Pro'
      });
      showToast('📤 Отправлено');
    } else {
      // Fallback - скачивание
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = opt.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✅ PDF сохранён (поделиться недоступно)');
    }
  } catch(e){ 
    console.error('❌ Share Error:',e); 
    tpl.style.display='none'; 
    showToast('⚠️ Ошибка: ' + e.message); 
  }
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
function showToast(msg){ 
  const t=document.getElementById('toast'); 
  if(!t) return alert(msg);
  t.textContent=msg; 
  t.classList.add('show'); 
  clearTimeout(t._t); 
  t._t=setTimeout(()=>t.classList.remove('show'),3000); 
}

// === 🚨 ГЛОБАЛЬНЫЙ ЭКСПОРТ ===
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
window.closeModal = closeModal;
window.showMeasPDFModal = showMeasPDFModal;
window.showCostPDFModal = showCostPDFModal;
window.generateAndDownloadPDF = generateAndDownloadPDF;
window.generateAndSharePDF = generateAndSharePDF;
window.exportData = exportData;
window.importData = importData;
window.showToast = showToast;
window.saveSettings = saveSettings;
window.clearAllData = clearAllData;

console.log('✅ All functions exported to window');

// === 📄 PDF: ОБЁРТКА ДЛЯ СТАТИЧЕСКИХ КНОПОК В HTML (совместимость) ===
function startPDF(action) {
  console.log('🔄 startPDF wrapper called:', action);
  
  const title = document.getElementById('modalTitle')?.textContent || '';
  const isMeas = title.includes('Лист замера');
  
  // Для листа замера
  if (isMeas) {
    const db = getDB();
    const m = db[db.length - 1]; // Берём последний сохранённый замер
    if (m && m.id) {
      if (action === 'download' || action === 'save') {
        generateAndDownloadPDF('meas', m.id);
      } else {
        generateAndSharePDF('meas', m.id);
      }
    } else {
      showToast('⚠️ Нет данных для экспорта');
    }
  } 
  // Для коммерческого предложения
  else {
    if (!currentCalc) return showToast('⚠️ Сначала выполните расчёт');
    if (action === 'download' || action === 'save') {
      generateAndDownloadPDF('cost');
    } else {
      generateAndSharePDF('cost');
    }
  }
}

// Экспортируем функцию глобально
window.startPDF = startPDF;
console.log('✅ startPDF wrapper exported');

// === 📄 ОБЁРТКА ДЛЯ КНОПОК MODAL (исправляет onclick) ===
function startPDF(action) {
  const title = document.getElementById('modalTitle')?.textContent || '';
  const isMeas = title.includes('Лист замера');
  if (isMeas) {
    const db = getDB(); const m = db[db.length - 1];
    if (m?.id) action === 'download' ? generateAndDownloadPDF('meas', m.id) : generateAndSharePDF('meas', m.id);
    else showToast('⚠️ Нет данных');
  } else {
    if (!currentCalc) return showToast('⚠️ Сначала выполните расчёт');
    action === 'download' ? generateAndDownloadPDF('cost') : generateAndSharePDF('cost');
  }
}
window.startPDF = startPDF;
