/* SoilTech — Impresión de facturas sobre hoja preimpresa.
 * Todas las posiciones están en milímetros, medidas desde la esquina superior izquierda de cada copia.
 * La configuración se guarda en Firestore (config/impresion) para que todas las computadoras impriman igual.
 */
var IMPRESION_DEF = {
  papel: { w: 216, h: 330 },     // hoja oficio
  copiaAlto: 160,                // alto de cada copia
  copia2Y: 165,                  // distancia desde el borde de la hoja hasta la 2ª copia
  offX: 0, offY: 0,              // corrimiento general (ajuste fino de la impresora)
  filas: { y: 52, alto: 10.2, max: 7 },
  campos: {
    fecha:        { x: 17,  y: 27,    size: 11, w: 40 },
    condContado:  { x: 130, y: 27,    size: 14, w: 6, bold: 1 },
    condCredito:  { x: 158, y: 27,    size: 14, w: 6, bold: 1 },
    cliente:      { x: 17,  y: 33.5,  size: 11, w: 105 },
    ruc:          { x: 130, y: 33.5,  size: 11, w: 45 },
    direccion:    { x: 17,  y: 40,    size: 9,  w: 108 },
    telefono:     { x: 130, y: 40,    size: 11, w: 45 },
    itemCant:     { x: 8,   size: 10, w: 9,  align: 'center' },
    itemCodigo:   { x: 18,  size: 9,  w: 16 },
    itemDesc:     { x: 36,  size: 8,  w: 80 },
    itemUnit:     { x: 118, size: 10, w: 22, align: 'right' },
    itemExentas:  { x: 142, size: 10, w: 22, align: 'right' },
    item5:        { x: 160, size: 10, w: 22, align: 'right' },
    item10:       { x: 178, size: 10, w: 25, align: 'right' },
    subExentas:   { x: 142, y: 124,   size: 10, w: 22, align: 'right', bold: 1 },
    sub5:         { x: 160, y: 124,   size: 10, w: 22, align: 'right', bold: 1 },
    sub10:        { x: 178, y: 124,   size: 10, w: 25, align: 'right', bold: 1 },
    totalLetras:  { x: 8,   y: 129.5, size: 7,  w: 135 },
    totalGeneral: { x: 175, y: 126,   size: 12, w: 28, align: 'right', bold: 1 },
    liq5:         { x: 50,  y: 134,   size: 9,  w: 25, align: 'right' },
    liq10:        { x: 95,  y: 134,   size: 9,  w: 25, align: 'right' },
    liqTotal:     { x: 140, y: 134,   size: 9,  w: 25, align: 'right' }
  }
};

/* Nombre visible de cada campo y a qué grupo pertenece */
var CAMPOS_IMP = [
  ['fecha', 'Fecha', 'cabecera'],
  ['condContado', 'X de CONTADO', 'cabecera'],
  ['condCredito', 'X de CRÉDITO', 'cabecera'],
  ['cliente', 'Cliente', 'cabecera'],
  ['ruc', 'RUC / CI', 'cabecera'],
  ['direccion', 'Dirección', 'cabecera'],
  ['telefono', 'Teléfono', 'cabecera'],
  ['itemCant', 'Columna: cantidad', 'items'],
  ['itemCodigo', 'Columna: código', 'items'],
  ['itemDesc', 'Columna: descripción', 'items'],
  ['itemUnit', 'Columna: precio unitario', 'items'],
  ['itemExentas', 'Columna: exentas', 'items'],
  ['item5', 'Columna: 5%', 'items'],
  ['item10', 'Columna: 10%', 'items'],
  ['subExentas', 'Subtotal exentas', 'totales'],
  ['sub5', 'Subtotal 5%', 'totales'],
  ['sub10', 'Subtotal 10%', 'totales'],
  ['totalGeneral', 'Total a pagar', 'totales'],
  ['totalLetras', 'Total en letras', 'totales'],
  ['liq5', 'Liquidación IVA 5%', 'totales'],
  ['liq10', 'Liquidación IVA 10%', 'totales'],
  ['liqTotal', 'Liquidación IVA total', 'totales']
];
var GRUPOS_IMP = { cabecera: 'Cabecera', items: 'Columnas de los ítems', totales: 'Totales y liquidación del IVA' };

var IMPRESION = JSON.parse(JSON.stringify(IMPRESION_DEF));
var IMPRESION_FONDO = null;   // {dataUrl, x, y, w} — imagen escaneada de la hoja, solo para calibrar

function _mezclar(base, extra) {
  if (!extra) return base;
  var out = JSON.parse(JSON.stringify(base));
  Object.keys(extra).forEach(function (k) {
    if (k === 'campos' || k === 'filas' || k === 'papel') {
      out[k] = out[k] || {};
      Object.keys(extra[k] || {}).forEach(function (c) {
        out[k][c] = (k === 'campos') ? Object.assign({}, out[k][c] || {}, extra[k][c]) : extra[k][c];
      });
    } else out[k] = extra[k];
  });
  return out;
}

function cargarConfigImpresion(db) {
  return db.collection('config').doc('impresion').get().then(function (d) {
    if (d.exists) IMPRESION = _mezclar(IMPRESION_DEF, d.data());
    return IMPRESION;
  }).catch(function () { return IMPRESION; });
}
function cargarFondoImpresion(db) {
  return db.collection('config').doc('impresion_fondo').get().then(function (d) {
    IMPRESION_FONDO = d.exists ? d.data() : null;
    return IMPRESION_FONDO;
  }).catch(function () { return null; });
}

/* ── Datos de una factura, listos para imprimir ── */
function datosImpresion(f) {
  var isU = (f.moneda || '').indexOf('DOLAR') >= 0;
  var iva = f.tipoIva == null ? 10 : +f.tipoIva;
  var mon = function (n) { return isU ? fmtUsd(n || 0) : fmtGs(Math.round(n || 0)); };
  var total = +(f.total || 0);
  var ivaAmt = iva === 10 ? total / 11 : (iva === 5 ? total / 21 : 0);
  var items = (f.items && f.items.length ? f.items : []).map(function (it) {
    var c = +(it.cant || 1), u = +(it.unit || 0);
    return { cant: c, code: it.code || '', desc: it.desc || '', unit: u, total: c * u };
  });
  var letras = (isU ? 'DOLARES AMERICANOS ' : 'GUARANIES ') + numToWords(Math.floor(total)) +
    (isU ? ' con ' + String(Math.round((total - Math.floor(total)) * 100)).padStart(2, '0') + '/100' : '');
  return { isU: isU, iva: iva, mon: mon, total: total, ivaAmt: ivaAmt, items: items, letras: letras };
}

/* Devuelve el HTML de UNA copia (los campos posicionados) */
function copiaHtml(f, cfg) {
  cfg = cfg || IMPRESION;
  var d = datosImpresion(f), C = cfg.campos, h = '';
  var put = function (key, texto, extra) {
    var c = C[key];
    if (!c || texto === '' || texto == null) return;
    var y = (extra && extra.y != null) ? extra.y : c.y;
    if (y == null) return;
    h += '<div class="pf" style="top:' + (y + (cfg.offY || 0)) + 'mm;left:' + (c.x + (cfg.offX || 0)) + 'mm;font-size:' + (c.size || 10) + 'px' +
      (c.w ? ';width:' + c.w + 'mm' : '') +
      (c.align ? ';text-align:' + c.align : '') +
      (c.bold ? ';font-weight:700' : '') +
      ';overflow:hidden;white-space:nowrap">' + texto + '</div>';
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
  put('fecha', esc(f.fecha || ''));
  put(f.condicion === 'CREDITO' ? 'condCredito' : 'condContado', 'X');
  put('cliente', esc(f.cliente || ''));
  put('ruc', esc(f.ruc || ''));
  put('direccion', esc(f.direccion || ''));
  put('telefono', esc(f.telefono || ''));
  var colMonto = d.iva === 10 ? 'item10' : (d.iva === 5 ? 'item5' : 'itemExentas');
  d.items.slice(0, cfg.filas.max).forEach(function (it, i) {
    var y = cfg.filas.y + i * cfg.filas.alto;
    put('itemCant', esc(it.cant), { y: y });
    put('itemCodigo', esc(it.code), { y: y });
    put('itemDesc', esc(it.desc), { y: y });
    put('itemUnit', d.mon(it.unit), { y: y });
    put(colMonto, d.mon(it.total), { y: y });
  });
  put(d.iva === 10 ? 'sub10' : (d.iva === 5 ? 'sub5' : 'subExentas'), d.mon(d.total));
  put('totalGeneral', d.mon(d.total));
  put('totalLetras', esc(d.letras));
  if (d.iva === 5) put('liq5', d.mon(d.ivaAmt));
  if (d.iva === 10) put('liq10', d.mon(d.ivaAmt));
  if (d.iva) put('liqTotal', d.mon(d.ivaAmt));
  return h;
}

/* Arma la hoja completa (las dos copias) en el div #pp */
function armarHoja(f, cfg) {
  cfg = cfg || IMPRESION;
  var ch = copiaHtml(f, cfg);
  var pp = document.getElementById('pp');
  pp.style.width = cfg.papel.w + 'mm';
  pp.style.height = cfg.papel.h + 'mm';
  var copia = function (top) {
    return '<div class="ic" style="top:' + top + 'mm;width:' + cfg.papel.w + 'mm;height:' + cfg.copiaAlto + 'mm">' + ch + '</div>';
  };
  pp.innerHTML = copia(0) + copia(cfg.copia2Y);
  return pp;
}

/* Factura de ejemplo para calibrar */
function facturaEjemplo() {
  return {
    nroFormateado: '001-001-0000999', fecha: new Date().toISOString().split('T')[0], condicion: 'CONTADO',
    moneda: 'GUARANIES', tipoIva: 10, cliente: 'CLIENTE DE PRUEBA S.A.', ruc: '80012345-6',
    direccion: 'Av. Mariscal López 1234 c/ Campos Cervera, Asunción', telefono: '0981 123 456',
    items: [
      { cant: 1, code: 'ST-07', desc: 'CARACTERIZACION DE SUELO CON CALICATAS', unit: 21000000 },
      { cant: 2, code: 'ST-01', desc: 'MUESTREO DE SUELO PARA ANALISIS', unit: 1500000 },
      { cant: 1, code: '', desc: 'Viáticos y movilidad', unit: 800000 }
    ],
    total: 25300000
  };
}

/* ═══════════════════════════════════════════════════════════════
   CALIBRACIÓN VISUAL
   Se abre con el botón «Calibrar impresión». Permite arrastrar cada
   dato hasta donde está impreso en la hoja y guardar las posiciones.
   ═══════════════════════════════════════════════════════════════ */
var CAL = { esc: 3.2, sel: null, db: null, cfg: null, cambios: false };

function calMsg(m) { if (typeof toast === 'function') toast(m); }

function abrirCalibracion(db) {
  CAL.db = db;
  CAL.cfg = JSON.parse(JSON.stringify(IMPRESION));
  CAL.sel = CAL.sel || 'fecha';
  CAL.cambios = false;
  if (!document.getElementById('calWrap')) document.body.insertAdjacentHTML('beforeend', calHtml());
  document.getElementById('calWrap').style.display = 'flex';
  document.addEventListener('keydown', calTeclas);
  (IMPRESION_FONDO ? Promise.resolve(IMPRESION_FONDO) : cargarFondoImpresion(db)).then(calRender);
  calRender();
}
function cerrarCalibracion() {
  if (CAL.cambios && !confirm('Tenés cambios sin guardar en la calibración. ¿Cerrar igual?')) return;
  document.getElementById('calWrap').style.display = 'none';
  document.removeEventListener('keydown', calTeclas);
}
function calHtml() {
  return '<div class="cal" id="calWrap">' +
    '<div class="cal-top">' +
      '<strong>Calibrar impresión</strong>' +
      '<span class="cal-hint">Arrastrá cada dato hasta donde va en tu factura preimpresa. Las flechas del teclado mueven 0,5 mm (con Shift, 2 mm).</span>' +
      '<span class="cal-acts">' +
        '<label class="cal-btn" title="Cargar una foto o escaneo de la factura en blanco">🖼 Fondo<input type="file" accept="image/*" style="display:none" onchange="calFondo(this)"></label>' +
        '<button class="cal-btn" id="calQuitarBtn" style="display:none" onclick="calQuitarFondo()" title="Sacar la imagen de fondo">✕ Quitar fondo</button>' +
        '<button class="cal-btn" onclick="calImprimirRegla()">📏 Imprimir regla</button>' +
        '<button class="cal-btn" onclick="calImprimirPrueba()">🖨 Imprimir prueba</button>' +
        '<button class="cal-btn" onclick="calRestablecer()">Restablecer</button>' +
        '<button class="cal-btn ok" onclick="calGuardar()">💾 Guardar</button>' +
        '<button class="cal-btn" onclick="cerrarCalibracion()">Cerrar</button>' +
      '</span>' +
    '</div>' +
    '<div class="cal-body">' +
      '<div class="cal-canvas"><div class="cal-sheet" id="calSheet"></div></div>' +
      '<aside class="cal-side" id="calSide"></aside>' +
    '</div>' +
  '</div>';
}
function calRender() {
  var cfg = CAL.cfg, esc = CAL.esc, f = facturaEjemplo(), d = datosImpresion(f);
  var sheet = document.getElementById('calSheet');
  if (!sheet) return;
  sheet.style.width = (cfg.papel.w * esc) + 'px';
  sheet.style.height = (cfg.copiaAlto * esc) + 'px';
  var ejemplo = {
    fecha: f.fecha, condContado: 'X', condCredito: 'X', cliente: f.cliente, ruc: f.ruc, direccion: f.direccion, telefono: f.telefono,
    itemCant: '1', itemCodigo: 'ST-07', itemDesc: f.items[0].desc, itemUnit: d.mon(f.items[0].unit),
    itemExentas: d.mon(0), item5: d.mon(0), item10: d.mon(f.items[0].total),
    subExentas: d.mon(0), sub5: d.mon(0), sub10: d.mon(f.total), totalGeneral: d.mon(f.total),
    totalLetras: d.letras, liq5: d.mon(0), liq10: d.mon(d.ivaAmt), liqTotal: d.mon(d.ivaAmt)
  };
  var h = '';
  if (IMPRESION_FONDO && IMPRESION_FONDO.dataUrl) {
    h += '<img class="cal-bg" src="' + IMPRESION_FONDO.dataUrl + '" style="left:' + ((IMPRESION_FONDO.x || 0) * esc) + 'px;top:' + ((IMPRESION_FONDO.y || 0) * esc) + 'px;width:' + ((IMPRESION_FONDO.w || cfg.papel.w) * esc) + 'px;opacity:' + (IMPRESION_FONDO.op == null ? 0.6 : IMPRESION_FONDO.op) + '">';
  }
  // reglas de referencia cada 10 mm
  for (var x = 0; x <= cfg.papel.w; x += 10) h += '<div class="cal-gl v" style="left:' + (x * esc) + 'px"></div>';
  for (var y = 0; y <= cfg.copiaAlto; y += 10) h += '<div class="cal-gl h" style="top:' + (y * esc) + 'px"></div>';
  // filas de ítems (líneas guía)
  for (var i = 0; i < cfg.filas.max; i++) {
    h += '<div class="cal-fila" style="top:' + ((cfg.filas.y + i * cfg.filas.alto) * esc) + 'px;width:' + (cfg.papel.w * esc) + 'px"></div>';
  }
  CAMPOS_IMP.forEach(function (c) {
    var k = c[0], cf = cfg.campos[k];
    if (!cf) return;
    var esItem = c[2] === 'items';
    var top = (esItem ? cfg.filas.y : cf.y);
    h += '<div class="cal-f' + (CAL.sel === k ? ' sel' : '') + (esItem ? ' item' : '') + '" data-k="' + k + '" title="' + c[1] + '" ' +
      'style="left:' + (cf.x * esc) + 'px;top:' + (top * esc) + 'px;width:' + ((cf.w || 20) * esc) + 'px;font-size:' + ((cf.size || 10) * esc / 3.78) + 'px;text-align:' + (cf.align || 'left') + (cf.bold ? ';font-weight:700' : '') + '">' +
      String(ejemplo[k] == null ? c[1] : ejemplo[k]) + '</div>';
  });
  sheet.innerHTML = h;
  var qb = document.getElementById('calQuitarBtn');
  if (qb) qb.style.display = (IMPRESION_FONDO && IMPRESION_FONDO.dataUrl) ? '' : 'none';
  Array.prototype.forEach.call(sheet.querySelectorAll('.cal-f'), function (el) {
    el.addEventListener('pointerdown', calDrag);
  });
  calSide();
}
function calSide() {
  var cfg = CAL.cfg, k = CAL.sel, cf = cfg.campos[k] || {}, meta = CAMPOS_IMP.find(function (c) { return c[0] === k; }) || ['', '', ''];
  var esItem = meta[2] === 'items';
  var num = function (l, v, path, step) { return '<label class="cal-in"><span>' + l + '</span><input type="number" step="' + (step || 0.5) + '" value="' + (v == null ? '' : v) + '" oninput="calSet(\'' + path + '\',this.value)"></label>'; };
  var lista = '';
  ['cabecera', 'items', 'totales'].forEach(function (g) {
    lista += '<div class="cal-g">' + GRUPOS_IMP[g] + '</div>';
    CAMPOS_IMP.filter(function (c) { return c[2] === g; }).forEach(function (c) {
      lista += '<button class="cal-item' + (CAL.sel === c[0] ? ' on' : '') + '" onclick="calSel(\'' + c[0] + '\')">' + c[1] + '</button>';
    });
  });
  document.getElementById('calSide').innerHTML =
    '<div class="cal-box"><h4>' + (meta[1] || '—') + '</h4>' +
      '<div class="cal-row">' + num('X (mm)', cf.x, 'campos.' + k + '.x') + (esItem ? num('Y de la 1ª fila', cfg.filas.y, 'filas.y') : num('Y (mm)', cf.y, 'campos.' + k + '.y')) + '</div>' +
      '<div class="cal-row">' + num('Ancho (mm)', cf.w, 'campos.' + k + '.w') + num('Letra (px)', cf.size, 'campos.' + k + '.size') + '</div>' +
      '<div class="cal-row"><label class="cal-in"><span>Alineación</span><select onchange="calSet(\'campos.' + k + '.align\',this.value)">' +
        ['left', 'center', 'right'].map(function (a) { return '<option value="' + a + '"' + ((cf.align || 'left') === a ? ' selected' : '') + '>' + { left: 'Izquierda', center: 'Centro', right: 'Derecha' }[a] + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="cal-in"><span>Negrita</span><input type="checkbox"' + (cf.bold ? ' checked' : '') + ' onchange="calSet(\'campos.' + k + '.bold\',this.checked?1:0)"></label></div>' +
    '</div>' +
    '<div class="cal-box"><h4>Hoja e impresora</h4>' +
      '<div class="cal-row">' + num('Corrimiento X', cfg.offX, 'offX') + num('Corrimiento Y', cfg.offY, 'offY') + '</div>' +
      '<div class="cal-row">' + num('Alto de cada copia', cfg.copiaAlto, 'copiaAlto') + num('Y de la 2ª copia', cfg.copia2Y, 'copia2Y') + '</div>' +
      '<div class="cal-row">' + num('Alto de fila', cfg.filas.alto, 'filas.alto', 0.1) + num('Filas de ítems', cfg.filas.max, 'filas.max', 1) + '</div>' +
      '<div class="cal-row">' + num('Ancho hoja', cfg.papel.w, 'papel.w', 1) + num('Alto hoja', cfg.papel.h, 'papel.h', 1) + '</div>' +
    '</div>' +
    (IMPRESION_FONDO && IMPRESION_FONDO.dataUrl ? '<div class="cal-box"><h4>Imagen de fondo</h4>' +
      '<div class="cal-row"><label class="cal-in"><span>X (mm)</span><input type="number" step="0.5" value="' + (IMPRESION_FONDO.x || 0) + '" oninput="calFondoSet(\'x\',this.value)"></label><label class="cal-in"><span>Y (mm)</span><input type="number" step="0.5" value="' + (IMPRESION_FONDO.y || 0) + '" oninput="calFondoSet(\'y\',this.value)"></label></div>' +
      '<div class="cal-row"><label class="cal-in"><span>Ancho (mm)</span><input type="number" step="0.5" value="' + (IMPRESION_FONDO.w || cfg.papel.w) + '" oninput="calFondoSet(\'w\',this.value)"></label><label class="cal-in"><span>Transparencia</span><input type="range" min="0.15" max="1" step="0.05" value="' + (IMPRESION_FONDO.op == null ? 0.6 : IMPRESION_FONDO.op) + '" oninput="calFondoSet(\'op\',this.value)"></label></div>' +
      '<div class="cal-row"><button class="cal-btn" style="flex:1" onclick="calGuardarFondo()">Guardar fondo para todos</button><button class="cal-btn" onclick="calQuitarFondo()">Quitar</button></div>' +
      '<div class="cal-nota">La imagen es solo una ayuda para ubicar los campos: no se imprime.</div></div>' : '') +
    '<div class="cal-box"><h4>Campos</h4><div class="cal-lista">' + lista + '</div></div>' +
    '<div class="cal-box"><h4>Zoom</h4><input type="range" min="2" max="6" step="0.2" value="' + CAL.esc + '" oninput="CAL.esc=+this.value;calRender()" style="width:100%"></div>';
}
function calSel(k) { CAL.sel = k; calRender(); }
function calSet(path, valor) {
  var partes = path.split('.'), o = CAL.cfg;
  for (var i = 0; i < partes.length - 1; i++) { o[partes[i]] = o[partes[i]] || {}; o = o[partes[i]]; }
  var ult = partes[partes.length - 1];
  o[ult] = (ult === 'align') ? valor : (valor === '' ? null : (isNaN(+valor) ? valor : +valor));
  CAL.cambios = true;
  calRender();
}
function calDrag(ev) {
  var el = ev.currentTarget, k = el.dataset.k;
  CAL.sel = k;
  var cf = CAL.cfg.campos[k], esItem = (CAMPOS_IMP.find(function (c) { return c[0] === k; }) || [])[2] === 'items';
  var x0 = ev.clientX, y0 = ev.clientY, cx = cf.x, cy = esItem ? CAL.cfg.filas.y : cf.y;
  el.setPointerCapture(ev.pointerId);
  var mover = function (e) {
    var dx = (e.clientX - x0) / CAL.esc, dy = (e.clientY - y0) / CAL.esc;
    var nx = Math.max(0, Math.round((cx + dx) * 4) / 4), ny = Math.max(0, Math.round((cy + dy) * 4) / 4);
    cf.x = nx;
    if (esItem) CAL.cfg.filas.y = ny; else cf.y = ny;
    CAL.cambios = true;
    el.style.left = (nx * CAL.esc) + 'px';
    el.style.top = (ny * CAL.esc) + 'px';
  };
  var soltar = function () {
    el.removeEventListener('pointermove', mover);
    el.removeEventListener('pointerup', soltar);
    calRender();
  };
  el.addEventListener('pointermove', mover);
  el.addEventListener('pointerup', soltar);
  ev.preventDefault();
}
function calTeclas(e) {
  if (e.key === 'Escape') { cerrarCalibracion(); return; }
  if (['INPUT', 'SELECT', 'TEXTAREA'].indexOf((e.target.tagName || '')) >= 0) return;
  var m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!m || !CAL.sel) return;
  e.preventDefault();
  var paso = e.shiftKey ? 2 : 0.5, cf = CAL.cfg.campos[CAL.sel];
  var esItem = (CAMPOS_IMP.find(function (c) { return c[0] === CAL.sel; }) || [])[2] === 'items';
  cf.x = Math.max(0, Math.round((cf.x + m[0] * paso) * 4) / 4);
  if (m[1]) {
    if (esItem) CAL.cfg.filas.y = Math.max(0, Math.round((CAL.cfg.filas.y + m[1] * paso) * 4) / 4);
    else cf.y = Math.max(0, Math.round((cf.y + m[1] * paso) * 4) / 4);
  }
  CAL.cambios = true;
  calRender();
}
function calRestablecer() {
  if (!confirm('¿Volver a las posiciones originales? Se pierde la calibración actual (hasta que guardes, la que está publicada no cambia).')) return;
  CAL.cfg = JSON.parse(JSON.stringify(IMPRESION_DEF));
  CAL.cambios = true;
  calRender();
}
function calGuardar() {
  if (!CAL.db) return;
  CAL.cfg.actualizado = new Date().toISOString();
  CAL.db.collection('config').doc('impresion').set(CAL.cfg).then(function () {
    IMPRESION = JSON.parse(JSON.stringify(CAL.cfg));
    CAL.cambios = false;
    calMsg('✅ Calibración guardada');
  }).catch(function (e) { calMsg('❌ ' + e.message + ' — revisá las reglas de Firestore (colección config)'); });
}
function calImprimirPrueba() {
  var pp = armarHoja(facturaEjemplo(), CAL.cfg);
  pp.style.display = 'block';
  setTimeout(function () { window.print(); pp.style.display = 'none'; }, 250);
}
function calImprimirRegla() {
  var cfg = CAL.cfg, pp = document.getElementById('pp'), h = '';
  for (var x = 0; x <= cfg.papel.w; x += 5) {
    h += '<div style="position:absolute;left:' + x + 'mm;top:0;width:0;height:' + (x % 10 ? 4 : 8) + 'mm;border-left:0.2mm solid #000"></div>';
    if (x % 10 === 0) h += '<div style="position:absolute;left:' + (x + 0.5) + 'mm;top:8mm;font-size:7px">' + x + '</div>';
  }
  for (var y = 0; y <= cfg.copiaAlto; y += 5) {
    h += '<div style="position:absolute;top:' + y + 'mm;left:0;height:0;width:' + (y % 10 ? 4 : 8) + 'mm;border-top:0.2mm solid #000"></div>';
    if (y % 10 === 0) h += '<div style="position:absolute;top:' + (y + 0.5) + 'mm;left:8mm;font-size:7px">' + y + '</div>';
  }
  for (var gx = 10; gx <= cfg.papel.w; gx += 10) h += '<div style="position:absolute;left:' + gx + 'mm;top:0;bottom:0;border-left:0.1mm dotted #999"></div>';
  for (var gy = 10; gy <= cfg.copiaAlto; gy += 10) h += '<div style="position:absolute;top:' + gy + 'mm;left:0;right:0;border-top:0.1mm dotted #999"></div>';
  pp.style.width = cfg.papel.w + 'mm'; pp.style.height = cfg.papel.h + 'mm';
  pp.innerHTML = '<div class="ic" style="top:0;width:' + cfg.papel.w + 'mm;height:' + cfg.copiaAlto + 'mm">' + h + '</div>' +
                 '<div class="ic" style="top:' + cfg.copia2Y + 'mm;width:' + cfg.papel.w + 'mm;height:' + cfg.copiaAlto + 'mm">' + h + '</div>';
  pp.style.display = 'block';
  setTimeout(function () { window.print(); pp.style.display = 'none'; }, 250);
}
/* ── Imagen de fondo ── */
function calFondo(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var fr = new FileReader();
  fr.onload = function () {
    var img = new Image();
    img.onload = function () {
      var max = 1400, k = Math.min(1, max / img.width);
      var cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      var w = CAL.cfg.papel.w;
      IMPRESION_FONDO = { dataUrl: cv.toDataURL('image/jpeg', 0.7), x: 0, y: 0, w: w, op: 0.6 };
      calRender();
      calMsg('Imagen cargada: ajustá su ancho hasta que coincida con la regla');
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
  input.value = '';
}
function calFondoSet(k, v) { if (!IMPRESION_FONDO) return; IMPRESION_FONDO[k] = +v; calRender(); }
function calQuitarFondo() {
  if (!IMPRESION_FONDO) return;
  if (!confirm('¿Sacar la imagen de fondo? Las posiciones de los campos no se tocan.')) return;
  IMPRESION_FONDO = null;
  if (CAL.db) CAL.db.collection('config').doc('impresion_fondo').delete().catch(function () {});
  calRender();
  calMsg('Fondo quitado');
}
function calGuardarFondo() {
  if (!IMPRESION_FONDO || !CAL.db) return;
  if (IMPRESION_FONDO.dataUrl.length > 900000) { calMsg('❌ La imagen es muy pesada: sacá una foto más chica'); return; }
  CAL.db.collection('config').doc('impresion_fondo').set(IMPRESION_FONDO).then(function () { calMsg('✅ Fondo guardado'); })
    .catch(function (e) { calMsg('❌ ' + e.message); });
}
