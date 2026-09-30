/* Directorio de personas — SoilTech
 *
 * Una persona se carga UNA vez y se reutiliza en todos los cursos a los que
 * asista. Los datos de contacto viven acá; lo que cambia de un curso a otro
 * (cuánto pagó, con qué tipo, si ya cobró) vive en la inscripción.
 *
 *   personas/{id} → nombre · ocupacion · telefono · correo · empresa
 *   proyectos/{id}/inscriptos/{id} → personaId + lo del curso
 */
var Personas = (function () {
  var LISTA = [], cargadoEn = 0, pendiente = null;

  function N(t) {
    return String(t == null ? '' : t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z0-9]+/g, ' ').trim();
  }
  /* Solo dígitos: así "0981 123-456" y "0981123456" son el mismo teléfono. */
  function soloNum(t) { return String(t == null ? '' : t).replace(/\D+/g, ''); }
  function correoN(t) { return String(t == null ? '' : t).trim().toLowerCase(); }

  function limpiar(d) {
    return {
      nombre: String(d.nombre || '').trim(),
      ocupacion: String(d.ocupacion || '').trim(),
      telefono: String(d.telefono || '').trim(),
      correo: correoN(d.correo),
      empresa: String(d.empresa || '').trim()
    };
  }

  function cargar(db, forzar) {
    if (!forzar && cargadoEn && Date.now() - cargadoEn < 60000) return Promise.resolve(LISTA);
    if (pendiente) return pendiente;
    pendiente = db.collection('personas').get().then(function (s) {
      LISTA = s.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); })
        .sort(function (a, b) { return String(a.nombre || '').localeCompare(String(b.nombre || '')); });
      cargadoEn = Date.now(); pendiente = null;
      return LISTA;
    }, function (e) { pendiente = null; throw e; });
    return pendiente;
  }

  function lista() { return LISTA; }
  function porId(id) { return LISTA.filter(function (p) { return p._id === id; })[0] || null; }

  /* Busca por cualquier parte del nombre, correo, teléfono u ocupación. */
  function buscar(txt, limite) {
    var q = N(txt);
    if (!q) return LISTA.slice(0, limite || 8);
    var num = soloNum(txt);
    return LISTA.filter(function (p) {
      if (N(p.nombre + ' ' + (p.ocupacion || '') + ' ' + (p.empresa || '')).indexOf(q) >= 0) return true;
      if (correoN(p.correo).indexOf(correoN(txt)) >= 0 && txt.trim()) return true;
      return !!num && soloNum(p.telefono).indexOf(num) >= 0;
    }).slice(0, limite || 8);
  }

  /* ¿Ya existe esta persona? Primero por correo, después por teléfono y por
     último por nombre exacto: así no se duplica la misma persona en dos cursos. */
  function similar(d) {
    var c = correoN(d.correo), t = soloNum(d.telefono), n = N(d.nombre);
    if (c) { var pc = LISTA.filter(function (p) { return correoN(p.correo) === c; })[0]; if (pc) return pc; }
    if (t.length >= 6) { var pt = LISTA.filter(function (p) { return soloNum(p.telefono) === t; })[0]; if (pt) return pt; }
    if (n) { var pn = LISTA.filter(function (p) { return N(p.nombre) === n; })[0]; if (pn) return pn; }
    return null;
  }

  /* Crea la persona, o devuelve la que ya estaba completándole los datos nuevos. */
  function crearOUsar(db, datos) {
    var d = limpiar(datos);
    if (!d.nombre) return Promise.reject(new Error('Falta el nombre'));
    var ya = similar(d);
    if (ya) {
      var faltantes = {};
      ['ocupacion', 'telefono', 'correo', 'empresa'].forEach(function (k) {
        if (d[k] && !String(ya[k] || '').trim()) faltantes[k] = d[k];
      });
      if (!Object.keys(faltantes).length) return Promise.resolve(ya);
      return db.collection('personas').doc(ya._id).update(faltantes).then(function () {
        Object.assign(ya, faltantes);
        return ya;
      });
    }
    return db.collection('personas').add(d).then(function (ref) {
      var nueva = Object.assign({ _id: ref.id }, d);
      LISTA.push(nueva);
      LISTA.sort(function (a, b) { return String(a.nombre || '').localeCompare(String(b.nombre || '')); });
      return nueva;
    });
  }

  function actualizar(db, id, datos) {
    var d = limpiar(datos);
    return db.collection('personas').doc(id).update(d).then(function () {
      var p = porId(id); if (p) Object.assign(p, d);
      return p;
    });
  }

  function invalidar() { cargadoEn = 0; }

  return {
    cargar: cargar, lista: lista, porId: porId, buscar: buscar, similar: similar,
    crearOUsar: crearOUsar, actualizar: actualizar, invalidar: invalidar, limpiar: limpiar, N: N
  };
})();
