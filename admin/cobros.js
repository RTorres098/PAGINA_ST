/* Registrar el cobro de una factura — SoilTech
 *
 * Un cobro son DOS documentos que tienen que moverse juntos:
 *   · un `pagos_recibidos`, que es lo que el balance suma como cobrado
 *   · la factura, que queda `pagada` y apuntando a ese pago
 *
 * Si se escribe uno solo, el balance y la facturación dicen cosas
 * distintas: o cobraste algo que ninguna factura respalda, o la factura
 * figura pagada sin plata atrás. Por eso los dos van en un batch, que
 * Firestore aplica entero o no aplica nada. Antes iban uno después del
 * otro y una caída en el medio dejaba el desfasaje.
 *
 * Vive afuera de facturacion/index.html porque lo usan la pantalla de
 * facturación y el asistente. Una segunda versión de esto es justamente
 * la forma de que los dos números dejen de coincidir.
 */
var Cobros = (function () {

  function num(v) { var n = typeof v === 'number' ? v : parseFloat(v); return isNaN(n) ? NaN : n; }

  function esUsd(factura) { return String((factura && factura.moneda) || '').indexOf('DOLAR') >= 0; }

  /* La retención por defecto sale del proyecto; 7% si no tiene. */
  function retencionDe(proyecto) {
    var r = proyecto && proyecto.descuentoIva;
    return r != null ? r : 0.07;
  }

  /* Devuelve los montos o {error}. Mismo cálculo que el modal de
     facturación: el neto cobrado es lo que suma en el balance. */
  function calcular(e) {
    e = e || {};
    var monto = num(e.monto), ret = num(e.retencion), cot = num(e.cotizacion);
    if (isNaN(ret)) ret = 0;
    if (!(monto > 0)) return { error: 'Ingresá el monto cobrado' };
    if (!(cot > 0)) return { error: 'Ingresá la cotización del día del cobro' };
    if (ret < 0 || ret >= 1) return { error: 'La retención tiene que estar entre 0 y 100%' };
    var usd = e.esUsd ? monto : monto / cot;
    var finalUsd = usd - usd * ret;
    var finalGs = e.esUsd ? finalUsd * cot : monto - monto * ret;
    return { usd: usd, ret: ret, cot: cot, finalUsd: finalUsd, finalGs: finalGs };
  }

  function concepto(factura) {
    var f = factura || {};
    var desc = (f.items && f.items[0] && f.items[0].desc) || f.servicio || '';
    return (f.tipo === 'anticipo' ? 'Anticipo' : 'Factura') + ' ' + (f.nroFormateado || '') +
           (desc && f.tipo !== 'anticipo' ? ' — ' + desc.slice(0, 60) : '');
  }

  /* Mediodía, para que ningún huso corra la fecha un día. */
  function aFecha(iso) {
    var t = String(iso || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(t + 'T12:00:00') : new Date();
  }

  function armar(factura, proyecto, calculo, fechaISO, facturaId) {
    return {
      proyectoId: factura.proyectoId,
      proyectoNombre: String((proyecto && proyecto.nombre) || factura.proyectoNombre || '').toUpperCase(),
      concepto: concepto(factura),
      montoUsd: calculo.usd,
      retencion: calculo.ret,
      montoFinalUsd: calculo.finalUsd,
      cotizacion: calculo.cot,
      montoFinalGs: calculo.finalGs,
      fecha: aFecha(fechaISO),
      facturaId: facturaId
    };
  }

  /* Al aprobar un proyecto se crea un cobro de anticipo sin factura.
     Si después se factura ese anticipo hay que reusarlo, no duplicarlo. */
  function anticipoPrevio(db, factura) {
    if (!factura || factura.tipo !== 'anticipo' || !factura.proyectoId) return Promise.resolve(null);
    return db.collection('pagos_recibidos').where('proyectoId', '==', factura.proyectoId).get()
      .then(function (s) {
        return s.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); })
          .find(function (x) {
            return x.proyectoId === factura.proyectoId && !x.facturaId && /^anticipo/i.test(x.concepto || '');
          }) || null;
      }, function () { return null; });
  }

  /* El pago y la factura, juntos o nada. Devuelve el id del pago. */
  function registrar(db, e) {
    var factura = e.factura, facturaId = e.facturaId;
    if (!factura || !facturaId) return Promise.reject(new Error('Falta la factura'));
    if (!factura.proyectoId) return Promise.reject(new Error('La factura no tiene proyecto asignado'));
    var calculo = e.calculo || calcular({
      monto: e.monto, retencion: e.retencion, cotizacion: e.cotizacion, esUsd: esUsd(factura)
    });
    if (calculo.error) return Promise.reject(new Error(calculo.error));

    var fechaISO = String(e.fecha || '').slice(0, 10) || new Date().toISOString().split('T')[0];
    var pago = armar(factura, e.proyecto, calculo, fechaISO, facturaId);

    var previo = e.previoId || factura.pagoRecibidoId || null;
    var refPago = previo ? db.collection('pagos_recibidos').doc(previo)
                         : db.collection('pagos_recibidos').doc();

    var lote = db.batch();
    lote.set(refPago, pago);
    lote.update(db.collection('facturas').doc(facturaId), {
      pagada: true, fechaPago: fechaISO, pagoRecibidoId: refPago.id
    });
    return lote.commit().then(function () { return refPago.id; });
  }

  /* Deshacer: también los dos juntos. */
  function quitar(db, factura, facturaId) {
    if (!facturaId) return Promise.reject(new Error('Falta la factura'));
    var lote = db.batch();
    if (factura && factura.pagoRecibidoId) {
      lote.delete(db.collection('pagos_recibidos').doc(factura.pagoRecibidoId));
    }
    lote.update(db.collection('facturas').doc(facturaId), {
      pagada: false, fechaPago: null, pagoRecibidoId: null
    });
    return lote.commit();
  }

  return {
    esUsd: esUsd, retencionDe: retencionDe, calcular: calcular, concepto: concepto,
    aFecha: aFecha, armar: armar, anticipoPrevio: anticipoPrevio,
    registrar: registrar, quitar: quitar, num: num
  };
})();
