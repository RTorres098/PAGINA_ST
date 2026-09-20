/* SoilTech — Catálogo de servicios
 *
 * Una sola fuente de verdad para el nombre de cada servicio. El nombre NO se
 * escribe a mano en ningún lado: se elige del catálogo. Lo que cambia de una
 * factura a otra (el inmueble, la etapa) va en campos aparte.
 *
 * Campos:
 *   codigo    el que se imprime y se usa para agrupar
 *   nombre    el texto oficial que sale en la factura y en la propuesta
 *   corto     para listas y selectores
 *   tipo      Tipo de servicio: Muestreo · Estudio · Capacitación …
 *   activo    false = no se ofrece más, pero el histórico lo sigue mostrando
 *   alias     textos y códigos viejos que apuntan acá (sirven para migrar)
 */
/* Semilla: lo que se carga la primera vez y lo que se usa si Firestore no responde. */
var SERVICIOS_SEED = [

  /* ── Muestreo: salida a campo y toma de muestras, sin informe ── */
  { codigo:'STM-01', tipo:'Muestreo', corto:'Muestreo para análisis de laboratorio',
    nombre:'MUESTREO DE SUELO PARA ANÁLISIS DE LABORATORIO',
    alias:['ST-01','MUESTREO DE SUELO PARA ANALISIS DE LABORATORIO'] },

  { codigo:'STM-02', tipo:'Muestreo', corto:'Muestreo para análisis químico',
    nombre:'MUESTREO DE SUELO PARA ANÁLISIS QUÍMICO',
    alias:['ST-08','MUESTREO DE SUELO PARA ANÁLISIS QUIMICO'] },

  { codigo:'STM-03', tipo:'Muestreo', corto:'Muestreo para stock de carbono',
    nombre:'MUESTREO DE SUELO PARA DETERMINACIÓN DE STOCK DE CARBONO',
    alias:['MUESTREO DE SUELO PARA DETERMINACION DE STOCK DE CARBONO'] },

  { codigo:'STM-04', tipo:'Muestreo', corto:'Muestreo de biomasa (Stocking Index)',
    nombre:'MUESTREO DE BIOMASA PARA STOCKING INDEX',
    alias:['STC-03'] },

  /* ── Estudios: muestreo + laboratorio + informe ── */
  { codigo:'ST-02', tipo:'Estudio', corto:'Aptitud de suelo',
    nombre:'ESTUDIO DE SUELO PARA APTITUD', alias:[] },

  { codigo:'ST-03', tipo:'Estudio', corto:'Stock de carbono',
    nombre:'ESTUDIO DE SUELO PARA DETERMINACIÓN DE STOCK DE CARBONO',
    alias:['ESTUDIO DE SUELO PARA DETERMINACION DE STOCK DE CARBONO'] },

  { codigo:'ST-04', tipo:'Estudio', corto:'Áreas de humedal',
    nombre:'ESTUDIO DE SUELO PARA DETERMINACIÓN DE ÁREAS DE HUMEDAL',
    alias:['ESTUDIO DE SUELO PARA DETERMINACION DE AREAS DE HUMEDAL'] },

  { codigo:'ST-05', tipo:'Estudio', corto:'Degradación',
    nombre:'ESTUDIO DE SUELO PARA DEGRADACIÓN',
    alias:['ESTUDIO DE SUELO PARA DEGRADACION'] },

  { codigo:'ST-06', tipo:'Estudio', corto:'Calicatas, humedales y carbono',
    nombre:'ESTUDIO DE SUELO CON DESCRIPCIÓN DE CALICATAS, HUMEDALES Y CARBONO ORGÁNICO',
    alias:['ESTUDIO DE SUELO CON DESCRIPCION DE CALICATAS HUMEDALES Y CARBONO ORGANICO'] },

  { codigo:'ST-07', tipo:'Estudio', corto:'Caracterización completa',
    nombre:'CARACTERIZACIÓN DE SUELO CON DESCRIPCIÓN DE CALICATAS, HUMEDALES, DEGRADACIÓN Y CARBONO ORGÁNICO',
    alias:['CARACTERIZACION DE SUELO CON DESCRIPCION DE CALICATAS HUMEDALES, DEGRADACION Y CARBONO ORGANICO'] },

  /* ── Capacitación: un código por curso ── */
  { codigo:'STC-01', tipo:'Capacitación', corto:'SIG — QGIS',
    nombre:'CAPACITACIÓN SIG — QGIS',
    alias:['CAPACITACIÓN SIG - QGIS','SERVICIO DE CAPACITACIÓN TÉCNICA EN SIG BÁSICO EN EL MARCO DEL PROYECTO PROEZA'] },

  { codigo:'STC-02', tipo:'Capacitación', corto:'Infiltración de agua',
    nombre:'CAPACITACIÓN Y ACOMPAÑAMIENTO PARA LA APLICACIÓN DE METODOLOGÍAS DE MEDICIÓN DE INFILTRACIÓN DE AGUA EN EL SUELO',
    alias:['CAPACITACIÓN METODOLOGÍAS DE INFILTRACIÓN',
           'CAPACITACIÓN Y ACOMPAÑAMIENTO PARA LA APLICACIÓN DE METODOLOGÍAS DE MEDICIÓN DE INFILTRACIÓN DE AGUA EN EL SUEL'] },

  { codigo:'STC-06', tipo:'Capacitación', corto:'SIG — ArcGIS Pro y Online',
    nombre:'CAPACITACIÓN SIG — ARCGIS PRO Y ARCGIS ONLINE',
    alias:['STC-04','CAPACITACIÓN SIG - ARCGIS PRO Y ONLINE'] },

  { codigo:'STC-07', tipo:'Capacitación', corto:'Power BI',
    nombre:'CAPACITACIÓN EN ANÁLISIS DE DATOS CON POWER BI',
    alias:['STC-05','CAPACITACIÓN EN POWERBI','CAPACITACION EN POWERBI'] }
];

/* Etapas de facturación: lo que hoy va pegado al nombre del servicio */
var ETAPAS_FACTURA = [
  { id:'',            nombre:'—' },
  { id:'anticipo',    nombre:'Anticipo' },
  { id:'avance',      nombre:'Avance de proyecto' },
  { id:'preliminar',  nombre:'Entrega de informes preliminares' },
  { id:'cierre',      nombre:'Cierre de proyecto' }
];

/* ════════════════════════════════════════════════════════════════════
   Cargador del catálogo.
   Vive en Firestore, en config/servicios. Si todavía no está cargado o
   Firestore no responde, se usa la semilla de arriba: la página nunca
   se queda sin catálogo.
   ════════════════════════════════════════════════════════════════════ */
var ServiciosCat = (function () {
  var DOC = 'servicios';
  var cache = null, cargadoEn = 0, pendiente = null, desdeFirestore = false;

  /* Normaliza para comparar: sin tildes, sin signos, en mayúsculas. */
  function N(t) {
    return String(t || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[—–]/g, '-').replace(/[^A-Z0-9]+/g, ' ').trim();
  }

  function normalizar(lista) {
    return (lista || []).map(function (s) {
      return {
        codigo: String(s.codigo || '').trim(),
        nombre: String(s.nombre || '').trim(),
        corto: String(s.corto || '').trim() || String(s.nombre || '').trim(),
        tipo: String(s.tipo || s.familia || 'Otros').trim(),  // familia: nombre viejo del campo
        activo: s.activo !== false,
        alias: (s.alias || []).map(function (a) { return String(a).trim(); }).filter(Boolean)
      };
    }).filter(function (s) { return s.codigo && s.nombre; });
  }

  function cargar(db, forzar) {
    if (!forzar && cache && Date.now() - cargadoEn < 60000) return Promise.resolve(cache);
    if (pendiente) return pendiente;
    pendiente = db.collection('config').doc(DOC).get().then(function (d) {
      var data = d.exists ? (d.data() || {}) : {};
      var lista = normalizar(data.lista);
      desdeFirestore = lista.length > 0;
      cache = desdeFirestore ? lista : normalizar(SERVICIOS_SEED);
      cargadoEn = Date.now(); pendiente = null;
      return cache;
    }, function (e) {
      pendiente = null;
      cache = normalizar(SERVICIOS_SEED); desdeFirestore = false; cargadoEn = Date.now();
      console.warn('Catálogo de servicios: se usa la semilla local.', e && e.message);
      return cache;
    });
    return pendiente;
  }

  function guardar(db, lista) {
    var limpia = normalizar(lista);
    var choque = duplicados(limpia);
    if (choque) return Promise.reject(new Error(choque));
    return db.collection('config').doc(DOC).set({
      lista: limpia,
      actualizado: new Date()
    }).then(function () {
      cache = limpia; cargadoEn = Date.now(); desdeFirestore = true;
      return limpia;
    });
  }

  /* Un código no se puede repetir, y un alias no puede apuntar a dos servicios. */
  function duplicados(lista) {
    var cods = {}, als = {};
    for (var i = 0; i < lista.length; i++) {
      var s = lista[i], c = N(s.codigo);
      if (cods[c]) return 'El código ' + s.codigo + ' está repetido.';
      cods[c] = s.codigo;
      var claves = [N(s.nombre)].concat(s.alias.map(N));
      for (var j = 0; j < claves.length; j++) {
        var k = claves[j];
        if (!k) continue;
        if (als[k] && als[k] !== s.codigo) return 'El texto «' + (s.alias[j - 1] || s.nombre) + '» ya apunta a ' + als[k] + '.';
        als[k] = s.codigo;
      }
    }
    return null;
  }

  function lista() { return cache || normalizar(SERVICIOS_SEED); }

  /* Devuelve el servicio de un código, aunque sea uno viejo: primero lo busca
     tal cual y después entre los textos anteriores. null si no lo reconoce. */
  function resolver(codigo) {
    if (!codigo) return null;
    var s = buscar(codigo);
    if (s) return s;
    var r = partir(codigo);
    return r.codigo ? buscar(r.codigo) : null;
  }
  function activos() { return lista().filter(function (s) { return s.activo; }); }
  function esDeFirestore() { return desdeFirestore; }
  function buscar(codigo) {
    var c = N(codigo);
    return lista().filter(function (s) { return N(s.codigo) === c; })[0] || null;
  }

  /* Índice texto → código, con el nombre oficial y todos los alias. */
  function indice() {
    var m = {};
    lista().forEach(function (s) {
      m[N(s.nombre)] = s.codigo;
      s.alias.forEach(function (a) { m[N(a)] = s.codigo; });
    });
    return m;
  }

  var ETQ = [
    [/^CIERRE DE PROYECTO\s+/i, 'cierre'],
    [/\s*-\s*ENTREGA DE INFORMES PRELIMINARES$/i, 'preliminar'],
    [/^ANTICIPO\s+(?:DE\s+)?/i, 'anticipo']
  ];

  /* Separa una descripción vieja en servicio + alcance + etapa.
     Devuelve {codigo, alcance, etapa}; codigo en null si no reconoce nada. */
  function partir(texto) {
    var t = String(texto || '').trim(), etapa = '', idx = indice();
    ETQ.forEach(function (p) { if (p[0].test(t)) { etapa = p[1]; t = t.replace(p[0], ''); } });
    var alcance = '';
    for (;;) {
      var c = idx[N(t)];
      if (c) return { codigo: c, alcance: alcance.trim(), etapa: etapa };
      var i = t.lastIndexOf(' - ');
      if (i < 0) return { codigo: null, alcance: alcance.trim(), etapa: etapa };
      alcance = t.slice(i + 3) + (alcance ? ' ' + alcance : '');
      t = t.slice(0, i);
    }
  }

  /* Arma el texto que se imprime. Es solo la propuesta: el concepto
     de la factura se sigue pudiendo editar a mano. */
  function describir(codigo, alcance, etapa) {
    var s = buscar(codigo);
    if (!s) return '';
    var t = s.nombre;
    if (alcance) t += ' - ' + String(alcance).trim().toUpperCase();
    var e = ETAPAS_FACTURA.filter(function (x) { return x.id === etapa; })[0];
    if (e && e.id) t = e.id === 'cierre' ? 'CIERRE DE PROYECTO ' + t : t + ' - ' + e.nombre.toUpperCase();
    return t;
  }

  function tipos() {
    var f = [], vistas = {};
    lista().forEach(function (s) { if (!vistas[s.tipo]) { vistas[s.tipo] = 1; f.push(s.tipo); } });
    return f;
  }

  /* Cada tipo de servicio tiene su prefijo de código. */
  var PREFIJOS = { 'Muestreo': 'STM', 'Estudio': 'ST', 'Capacitación': 'STC', 'Laboratorio': 'STL', 'Otros': 'STX' };
  function prefijoDe(tipo) { return PREFIJOS[tipo] || 'STX'; }

  /* Siguiente código libre de ese tipo. Sigue la numeración más alta que ya
     exista, así los códigos que se quemaron por error no se vuelven a usar. */
  function proximoCodigo(tipo) {
    var pre = prefijoDe(tipo);
    var re = new RegExp('^' + pre + '-(\\d+)$', 'i');
    var max = 0;
    lista().forEach(function (s) {
      var m = String(s.codigo || '').match(re);
      if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
    });
    return pre + '-' + String(max + 1).padStart(2, '0');
  }

  return {
    cargar: cargar, guardar: guardar, lista: lista, activos: activos, buscar: buscar, resolver: resolver,
    partir: partir, describir: describir, tipos: tipos, duplicados: duplicados,
    proximoCodigo: proximoCodigo, prefijoDe: prefijoDe, PREFIJOS: PREFIJOS,
    esDeFirestore: esDeFirestore, normalizar: normalizar, N: N, ETAPAS: ETAPAS_FACTURA, SEED: SERVICIOS_SEED
  };
})();
