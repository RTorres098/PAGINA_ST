/* Catálogo de bancos — SoilTech
 *
 * Lo usan los cheques (banco emisor) y los préstamos bancarios (acreedor).
 * Mismo patrón que el catálogo de servicios: vive en config/bancos, con una
 * semilla local para que la pantalla funcione aunque Firestore falle.
 *
 * La semilla es un punto de partida, no una verdad: los bancos de Paraguay
 * se fusionan y cambian de nombre seguido. Editala desde el panel.
 */
var BANCOS_SEED = [
  /* `mio` marca dónde hay cuenta habilitada: esos salen primero al elegir
     banco y son los únicos que se consultan al buscar promociones.
     `dominio` va sin https:// porque así lo pide allowed_domains. */
  { id: 'itau',        nombre: 'Banco Itaú',        mio: true, dominio: 'itau.com.py' },
  { id: 'continental', nombre: 'Banco Continental', mio: true, dominio: 'bancontinental.com.py' },
  { id: 'basa',        nombre: 'Banco Basa',        mio: true, dominio: 'bancobasa.com.py' },

  /* El resto queda por si aparece un cheque de otro banco, sin marcar. */
  { id: 'ueno',        nombre: 'Ueno Bank' },
  { id: 'bnf',         nombre: 'Banco Nacional de Fomento' },
  { id: 'atlas',       nombre: 'Banco Atlas' },
  { id: 'familiar',    nombre: 'Banco Familiar' },
  { id: 'vision',      nombre: 'Visión Banco' },
  { id: 'sudameris',   nombre: 'Banco Sudameris' },
  { id: 'bancop',      nombre: 'Bancop' }
];

var Bancos = (function () {
  var DOC = 'bancos';
  var cache = null, cargadoEn = 0, pendiente = null, desdeFirestore = false;

  function N(t) {
    return String(t == null ? '' : t).toUpperCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
  }
  /* El id sale del nombre, así no hay que inventarlo al agregar uno nuevo. */
  function idDe(nombre) {
    return N(nombre).toLowerCase().replace(/\s+/g, '-').slice(0, 40);
  }

  function normalizar(lista) {
    var vistos = {}, out = [];
    (lista || []).forEach(function (b) {
      var nombre = String((b && b.nombre) || '').trim();
      if (!nombre) return;
      var id = String((b && b.id) || '').trim() || idDe(nombre);
      if (vistos[id]) return;            // un id no se repite
      vistos[id] = true;
      out.push({
        id: id, nombre: nombre, activo: b.activo !== false,
        mio: !!b.mio,
        dominio: String(b.dominio || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
      });
    });
    /* Los propios arriba, y dentro de cada grupo por nombre. */
    out.sort(function (a, b) {
      if (a.mio !== b.mio) return a.mio ? -1 : 1;
      return a.nombre.localeCompare(b.nombre);
    });
    return out;
  }

  function cargar(db, forzar) {
    if (!forzar && cache && Date.now() - cargadoEn < 300000) return Promise.resolve(cache);
    if (pendiente) return pendiente;
    pendiente = db.collection('config').doc(DOC).get().then(function (d) {
      var lista = (d.exists && d.data() && d.data().lista) || null;
      desdeFirestore = !!(lista && lista.length);
      cache = normalizar(desdeFirestore ? lista : BANCOS_SEED);
      cargadoEn = Date.now(); pendiente = null;
      return cache;
    }, function (e) {
      pendiente = null;
      cache = normalizar(BANCOS_SEED); desdeFirestore = false; cargadoEn = Date.now();
      console.warn('Catálogo de bancos: se usa la semilla local.', e && e.message);
      return cache;
    });
    return pendiente;
  }

  function lista(incluirInactivos) {
    var l = cache || normalizar(BANCOS_SEED);
    return incluirInactivos ? l.slice() : l.filter(function (b) { return b.activo; });
  }
  function porId(id) {
    return lista(true).filter(function (b) { return b.id === id; })[0] || null;
  }
  /* Acepta un id o un nombre escrito a mano: así los cheques viejos, cargados
     antes de que existiera la lista, siguen encontrando su banco. */
  function resolver(valor) {
    if (!valor) return null;
    var porIdExacto = porId(String(valor).trim());
    if (porIdExacto) return porIdExacto;
    var n = N(valor);
    return lista(true).filter(function (b) { return N(b.nombre) === n; })[0] || null;
  }
  function nombreDe(valor) {
    var b = resolver(valor);
    return b ? b.nombre : String(valor || '');
  }

  /* Agrega uno nuevo sin pisar los que ya estaban. Devuelve el banco. */
  function agregar(db, nombre) {
    nombre = String(nombre || '').trim();
    if (!nombre) return Promise.reject(new Error('Falta el nombre del banco'));
    var ya = resolver(nombre);
    if (ya) return Promise.resolve(ya);
    var nuevo = { id: idDe(nombre), nombre: nombre, activo: true, mio: false, dominio: '' };
    var completa = normalizar(lista(true).concat([nuevo]));
    return guardar(db, completa).then(function () { return porId(nuevo.id) || nuevo; });
  }

  function guardar(db, l) {
    var limpia = normalizar(l);
    if (!limpia.length) return Promise.reject(new Error('La lista no puede quedar vacía'));
    return db.collection('config').doc(DOC).set({
      lista: limpia, actualizado: new Date()
    }).then(function () {
      cache = limpia; cargadoEn = Date.now(); desdeFirestore = true;
      return limpia;
    });
  }

  /* Los bancos donde hay cuenta. Es la lista que se consulta al buscar
     promociones: sin esto se traerían ofertas de bancos ajenos. */
  function mios() { return lista(true).filter(function (b) { return b.mio; }); }

  /* Dominios de los bancos propios, para limitar la búsqueda web. */
  function dominiosMios() {
    return mios().map(function (b) { return b.dominio; }).filter(Boolean);
  }

  function enNube() { return desdeFirestore; }
  function invalidar() { cargadoEn = 0; }

  return {
    cargar: cargar, lista: lista, porId: porId, resolver: resolver, nombreDe: nombreDe,
    agregar: agregar, guardar: guardar, normalizar: normalizar, idDe: idDe,
    mios: mios, dominiosMios: dominiosMios,
    enNube: enNube, invalidar: invalidar, SEED: BANCOS_SEED
  };
})();
