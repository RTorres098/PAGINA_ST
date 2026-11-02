/* Cheques emitidos — SoilTech
 *
 * Un cheque diferido se firma hoy y se cobra más adelante. Lo que importa es
 * la fecha de cobro: es la que dice cuándo tiene que haber plata en la cuenta
 * y la que dispara los avisos de 3, 2, 1 días y el día mismo.
 *
 *   cheques/{id} → banco · número · monto · fechaCobro · concepto · destino
 *
 * Los mismos cálculos están repetidos en la app (lib/models/cheque_model.dart).
 * Si cambia una regla acá, hay que cambiarla allá.
 */
var Cheques = (function () {

  var ESTADOS = ['pendiente', 'cobrado', 'anulado'];
  var DESTINOS = ['Personal', 'Negocio'];
  var DIAS_AVISO = [3, 2, 1, 0];      // cuándo avisa, contando hacia atrás

  function num(v) { var n = typeof v === 'number' ? v : parseFloat(v); return isNaN(n) ? 0 : n; }
  function txt(v) { var s = String(v == null ? '' : v).trim(); return s || null; }

  /* Fechas al mediodía: así ningún cambio de huso corre un cheque un día. */
  function aFecha(v) {
    if (!v) return null;
    if (v.toDate) return v.toDate();
    if (v instanceof Date) return v;
    if (typeof v === 'number') return new Date(v);
    if (v.seconds) return new Date(v.seconds * 1000);
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
    var t = Date.parse(v);
    return isNaN(t) ? null : new Date(t);
  }
  function aInput(v) {
    var d = aFecha(v); if (!d) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function aTimestamp(texto) {
    var m = String(texto || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0) : new Date();
    return firebase.firestore.Timestamp.fromDate(d);
  }
  /* Medianoche local, para contar días sin que la hora meta ruido. */
  function dia(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

  /* Días que faltan: 0 es hoy, negativo es que ya pasó. */
  function diasPara(cheque, hoy) {
    var f = aFecha(cheque && cheque.fechaCobro); if (!f) return null;
    var ref = hoy ? aFecha(hoy) : new Date();
    return Math.round((dia(f) - dia(ref)) / 86400000);
  }

  /* En qué situación está, para pintarlo y para decidir si avisar.
     Un cheque ya cobrado o anulado no avisa nunca más. */
  function situacion(cheque, hoy) {
    if (!cheque) return 'lejos';
    if (cheque.estado === 'cobrado') return 'cobrado';
    if (cheque.estado === 'anulado') return 'anulado';
    var d = diasPara(cheque, hoy);
    if (d === null) return 'lejos';
    if (d < 0) return 'vencido';
    if (d === 0) return 'hoy';
    if (d <= 3) return 'proximo';
    return 'lejos';
  }

  function urge(cheque, hoy) {
    var s = situacion(cheque, hoy);
    return s === 'vencido' || s === 'hoy' || s === 'proximo';
  }

  /* Texto corto para la fila y para el aviso. */
  function leyenda(cheque, hoy) {
    var s = situacion(cheque, hoy), d = diasPara(cheque, hoy);
    if (s === 'cobrado') return 'Cobrado';
    if (s === 'anulado') return 'Anulado';
    if (s === 'vencido') return 'Venció hace ' + Math.abs(d) + (Math.abs(d) === 1 ? ' día' : ' días');
    if (s === 'hoy') return 'Se cobra hoy';
    if (d === 1) return 'Mañana';
    return 'En ' + d + ' días';
  }

  /* Los pendientes que entran dentro de los próximos `dias`, más los vencidos,
     ordenados por urgencia. Es lo que alimenta la franja de avisos. */
  function porVencer(lista, dias, hoy) {
    dias = dias == null ? 3 : dias;
    return (lista || [])
      .filter(function (c) {
        if (c.estado !== 'pendiente') return false;
        var d = diasPara(c, hoy);
        return d !== null && d <= dias;
      })
      .sort(function (a, b) { return diasPara(a, hoy) - diasPara(b, hoy); });
  }

  function totalDe(lista) {
    return (lista || []).reduce(function (s, c) { return s + num(c.monto); }, 0);
  }

  /* Comprometido: lo que todavía tiene que salir de la cuenta. */
  function comprometido(lista, destino) {
    return (lista || [])
      .filter(function (c) { return c.estado === 'pendiente' && (!destino || c.destino === destino); })
      .reduce(function (s, c) { return s + num(c.monto); }, 0);
  }

  function validar(d) {
    if (!String(d.numero || '').trim()) return 'Falta el número del cheque';
    if (!d.bancoId) return 'Elegí el banco';
    if (!(num(d.monto) > 0)) return 'El monto tiene que ser mayor a cero';
    if (!d.fechaCobro) return 'Falta la fecha de cobro';
    if (!String(d.concepto || '').trim()) return 'Falta el concepto: para qué se usó';
    if (d.destino && DESTINOS.indexOf(d.destino) < 0) return 'Destino inválido';
    var em = aFecha(d.fechaEmision), co = aFecha(d.fechaCobro);
    if (em && co && dia(co) < dia(em)) return 'La fecha de cobro no puede ser anterior a la de emisión';
    return null;
  }

  function armar(d, banco) {
    return {
      numero: String(d.numero || '').trim(),
      bancoId: d.bancoId,
      bancoNombre: (banco && banco.nombre) || d.bancoNombre || '',
      monto: num(d.monto),
      fechaEmision: aTimestamp(d.fechaEmision || aInput(new Date())),
      fechaCobro: aTimestamp(d.fechaCobro),
      concepto: String(d.concepto || '').trim(),
      beneficiario: txt(d.beneficiario),
      destino: d.destino || 'Personal',
      estado: d.estado || 'pendiente',
      prestamoId: d.prestamoId || null,     // el préstamo que lo cubre
      fechaCobrado: d.estado === 'cobrado' ? (d.fechaCobrado || aTimestamp(aInput(new Date()))) : null,
      nota: txt(d.nota)
    };
  }

  function crear(db, d, banco) {
    var err = validar(d);
    if (err) return Promise.reject(new Error(err));
    var doc = armar(d, banco);
    doc.creado = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('cheques').add(doc).then(function (r) { return r.id; });
  }

  function actualizar(db, id, d, banco, previo) {
    var err = validar(d);
    if (err) return Promise.reject(new Error(err));
    var doc = armar(d, banco);
    if (previo && previo.creado) doc.creado = previo.creado;
    doc.editadoEn = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('cheques').doc(id).update(doc).then(function () { return id; });
  }

  function marcarCobrado(db, id) {
    return db.collection('cheques').doc(id).update({
      estado: 'cobrado',
      fechaCobrado: aTimestamp(aInput(new Date())),
      editadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  function anular(db, id) {
    return db.collection('cheques').doc(id).update({
      estado: 'anulado',
      editadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  function borrar(db, id) { return db.collection('cheques').doc(id).delete(); }

  function cargar(db) {
    return db.collection('cheques').get().then(function (s) {
      return s.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); })
        .sort(function (a, b) {
          var fa = aFecha(a.fechaCobro), fb = aFecha(b.fechaCobro);
          return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
        });
    });
  }

  return {
    ESTADOS: ESTADOS, DESTINOS: DESTINOS, DIAS_AVISO: DIAS_AVISO,
    aFecha: aFecha, aInput: aInput, aTimestamp: aTimestamp,
    diasPara: diasPara, situacion: situacion, urge: urge, leyenda: leyenda,
    porVencer: porVencer, totalDe: totalDe, comprometido: comprometido,
    validar: validar, armar: armar,
    crear: crear, actualizar: actualizar, marcarCobrado: marcarCobrado,
    anular: anular, borrar: borrar, cargar: cargar, num: num
  };
})();
