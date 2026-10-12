/* Gastos de proyecto — SoilTech
 *
 * Mismo modelo que la app (lib/models/gasto_model.dart). Lo importante:
 *  · `fecha` se guarda como Timestamp, no como texto: la app la lee con un
 *    cast a Timestamp y si encuentra un string se queda con la fecha de hoy.
 *  · `proyectoNombre` va en mayúsculas, igual que la app.
 *  · `origen` lo agrega solo la web. Los gastos de la app no lo tienen, así
 *    que la ausencia del campo significa que vino del teléfono.
 *  · El desglose de IVA usa las mismas divisiones que la app: 10% → /11,
 *    5% → /21, porque el monto ya viene con el impuesto incluido.
 */
var Gastos = (function () {

  /* Categorías: las mismas claves con las que el panel reparte el presupuesto.
     Si cambian acá, hay que cambiarlas en la app (CategoriaGasto). */
  var CAMPO = ['Consumición', 'Combustible', 'Colaboradores', 'Peaje', 'Hospedaje',
               'Implementos de trabajo', 'Maquinaria', 'Varios', 'Farmacia', 'Laboratorio', 'Camioneta'];
  var CURSO = ['Disertante', 'Salón', 'Publicidad', 'Plataformas',
               'Materiales', 'Catering', 'Viáticos', 'Varios'];

  var MEDIOS = ['Efectivo', 'Transferencia', 'Tarj. Débito', 'Tarj. Crédito'];
  var TARJETAS = ['UENO', 'GOLD', 'INTERVENTAJAS'];
  var IVA = ['SOLO 10%', 'SOLO 5%', '5% y 10%', 'Exento'];

  function categorias(esCurso) { return (esCurso ? CURSO : CAMPO).slice(); }

  function num(v) { var n = typeof v === 'number' ? v : parseFloat(v); return isNaN(n) ? 0 : n; }

  /* El monto ya incluye el impuesto, así que el IVA se saca dividiendo.
     En el mixto cada base trae su propio impuesto adentro. */
  function calcIva(tipoIva, monto, val10, val5) {
    var m = num(monto), v10 = num(val10), v5 = num(val5);
    if (tipoIva === 'SOLO 10%') return { iva10: (v10 > 0 ? v10 : m) / 11, iva5: 0 };
    if (tipoIva === 'SOLO 5%') return { iva10: 0, iva5: (v5 > 0 ? v5 : m) / 21 };
    if (tipoIva === '5% y 10%') return { iva10: v10 / 11, iva5: v5 / 21 };
    return { iva10: 0, iva5: 0 };   // Exento
  }

  /* Avisa cuando las bases del mixto no suman el total, con la misma
     tolerancia del 2% que usa la app. */
  function descuadre(tipoIva, monto, val10, val5) {
    if (tipoIva !== '5% y 10%') return false;
    var m = num(monto); if (!(m > 0)) return false;
    return Math.abs(num(val10) + num(val5) - m) > m * 0.02;
  }

  function origen(g) { return (g && g.origen) === 'web' ? 'web' : 'app'; }

  /* Pasa la fecha del input (texto aaaa-mm-dd) a Timestamp al mediodía, para
     que ningún cambio de zona horaria la corra al día anterior. */
  function aTimestamp(texto) {
    var m = String(texto || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0) : new Date();
    return firebase.firestore.Timestamp.fromDate(d);
  }
  /* Y al revés, para rellenar el input al editar. */
  function aInput(v) {
    var ms = 0;
    if (!v) ms = Date.now();
    else if (v.toMillis) ms = v.toMillis();
    else if (v instanceof Date) ms = v.getTime();
    else if (typeof v === 'number') ms = v;
    else if (v.seconds) ms = v.seconds * 1000;
    else { var m = String(v).match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; ms = Date.parse(v) || Date.now(); }
    var d = new Date(ms), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function hoy() { return aInput(new Date()); }

  /* Arma el documento. `datos` viene del formulario; `proy` es el proyecto
     para copiar su nombre; `yo` es el usuario logueado. */
  function armar(datos, proy, yo) {
    var conFactura = !!datos.factura;
    var iva = conFactura ? calcIva(datos.tipoIva, datos.monto, datos.valor10, datos.valor5) : { iva10: 0, iva5: 0 };
    var vacio = function (t) { var s = String(t == null ? '' : t).trim(); return s || null; };
    return {
      proyectoId: datos.proyectoId,
      proyectoNombre: String((proy && proy.nombre) || '').toUpperCase(),
      tipo: datos.tipo,
      concepto: String(datos.concepto || '').trim(),
      descripcion: vacio(datos.descripcion),
      fecha: aTimestamp(datos.fecha),
      hora: datos.hora || null,
      monto: num(datos.monto),
      factura: conFactura,
      numeroFactura: conFactura ? vacio(datos.numeroFactura) : null,
      tipoIva: conFactura ? (datos.tipoIva || null) : null,
      valor10: conFactura ? num(datos.valor10) : 0,
      montoIva10: iva.iva10,
      valor5: conFactura ? num(datos.valor5) : 0,
      montoIva5: iva.iva5,
      fotoUrl: datos.fotoUrl || null,
      imputacion: 'Soiltech',           // regla: gasto de proyecto = SoilTech
      medioPago: datos.medioPago || 'Efectivo',
      tarjetaCredito: datos.medioPago === 'Tarj. Crédito' ? (datos.tarjetaCredito || null) : null,
      rucCliente: conFactura ? vacio(datos.rucCliente) : null,
      proveedor: vacio(datos.proveedor),
      rucProveedor: conFactura ? vacio(datos.rucProveedor) : null,
      timbrado: conFactura ? vacio(datos.timbrado) : null,
      cargadoPorUid: datos.cargadoPorUid || (yo && yo.uid) || null,
      cargadoPorNombre: datos.cargadoPorNombre || (yo && yo.nombre) || null,
      origen: datos.origen || 'web'
    };
  }

  function validar(d) {
    if (!d.proyectoId) return 'Elegí el proyecto';
    if (!d.tipo) return 'Elegí la categoría';
    if (!String(d.concepto || '').trim()) return 'Falta el concepto';
    if (!(num(d.monto) > 0)) return 'El monto tiene que ser mayor a cero';
    if (!d.fecha) return 'Falta la fecha';
    if (d.medioPago === 'Tarj. Crédito' && !d.tarjetaCredito) return 'Elegí la tarjeta';
    if (d.factura && !d.tipoIva) return 'Elegí el tipo de IVA';
    return null;
  }

  function crear(db, datos, proy, yo) {
    var err = validar(datos);
    if (err) return Promise.reject(new Error(err));
    var doc = armar(datos, proy, yo);
    /* Hora de carga, igual que la app, para ordenar los gastos del mismo día. */
    if (!doc.hora) { var n = new Date(); doc.hora = n.getHours() + ':' + String(n.getMinutes()).padStart(2, '0'); }
    return db.collection('gastos').add(doc).then(function (ref) { return ref.id; });
  }

  /* Al editar se respeta quién lo cargó y de dónde vino: corregir un gasto
     del teléfono no lo convierte en un gasto de la web. */
  function actualizar(db, id, datos, proy, previo) {
    var err = validar(datos);
    if (err) return Promise.reject(new Error(err));
    previo = previo || {};
    var doc = armar(Object.assign({}, datos, {
      hora: previo.hora || datos.hora || null,
      fotoUrl: previo.fotoUrl || null,
      cargadoPorUid: previo.cargadoPorUid || null,
      cargadoPorNombre: previo.cargadoPorNombre || null,
      origen: previo.origen || 'app'
    }), proy, null);
    doc.editadoEn = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('gastos').doc(id).update(doc).then(function () { return id; });
  }

  function borrar(db, id) { return db.collection('gastos').doc(id).delete(); }

  return {
    CAMPO: CAMPO, CURSO: CURSO, MEDIOS: MEDIOS, TARJETAS: TARJETAS, IVA: IVA,
    categorias: categorias, calcIva: calcIva, descuadre: descuadre, origen: origen,
    aTimestamp: aTimestamp, aInput: aInput, hoy: hoy, armar: armar, validar: validar,
    crear: crear, actualizar: actualizar, borrar: borrar, num: num
  };
})();
