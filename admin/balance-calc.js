/* SoilTech — Cálculo del balance (misma lógica que la app: lib/models/balance.dart)
 *
 * Reglas:
 *  • Ingreso USD  = montoFinalUsd (neto de retención). Si falta: montoUsd × (1 − retención).
 *  • Ingreso Gs   = montoFinalGs. Si falta: ingreso USD × cotización del pago;
 *                   si el pago no tiene cotización: × cotización del proyecto (se avisa).
 *                   Sin ninguna cotización: no se suma en Gs (se avisa).
 *  • Egresos      = gastos del proyecto + pagos a colaboradores del proyecto.
 *  • Disponible   = ingresos Gs − egresos.
 *  • Por cobrar   = valor neto del contrato (USD) − ingresos USD.
 *  • Resultado estimado = (ingresos Gs + por cobrar × cotización) − egresos.
 *  • En el total general, las cotizaciones (aún no aprobadas) no suman al "por cobrar".
 */
var BalanceCalc = (function () {
  var COLAB = 'Colaboradores';
  var COTIZACION = 'Cotización';

  function num(v) { var n = typeof v === 'number' ? v : parseFloat(v); return isNaN(n) ? 0 : n; }
  function numOrNull(v) { if (v === null || v === undefined || v === '') return null; var n = typeof v === 'number' ? v : parseFloat(v); return isNaN(n) ? null : n; }

  function netoUsd(p) {
    var f = numOrNull(p.montoFinalUsd);
    if (f !== null) return f;
    var usd = num(p.montoUsd), ret = numOrNull(p.retencion) || 0;
    return usd - usd * ret;
  }

  function valorNetoUsd(proy) {
    var vt = num(proy.valorTotal);
    if (vt > 0) return vt;
    var desc = numOrNull(proy.descuentoIva);
    if (desc === null) desc = 0.07;
    return num(proy.valorUsd) * (1 - desc);
  }

  function proyecto(proy, gastos, ingresos, colabs, asignaciones) {
    var id = proy._id || proy.id;
    var cotP = num(proy.cotizacion) > 0 ? num(proy.cotizacion) : null;
    var b = {
      proyectoId: id, nombre: proy.nombre || '', estado: proy.estado || '',
      valorUsd: num(proy.valorUsd), valorNetoUsd: valorNetoUsd(proy),
      ingresoUsd: 0, ingresoGs: 0, cantIngresos: 0, ingresosConCotizacionProyecto: 0, ingresosSinCotizacion: 0,
      gastos: 0, pagosColaboradores: 0, cantGastos: 0, cantPagosColaboradores: 0,
      porCategoria: {}, asignaciones: asignaciones || {}, presupuesto: 0, cotizacionRef: null
    };
    var usdConGs = 0;
    (ingresos || []).forEach(function (p) {
      if (p.proyectoId !== id) return;
      b.cantIngresos++;
      var usd = netoUsd(p);
      b.ingresoUsd += usd;
      var gs = numOrNull(p.montoFinalGs);
      if (gs === null) {
        var cot = num(p.cotizacion) > 0 ? num(p.cotizacion) : null;
        if (cot !== null) gs = usd * cot;
        else if (cotP !== null) { gs = usd * cotP; b.ingresosConCotizacionProyecto++; }
        else b.ingresosSinCotizacion++;
      }
      if (gs !== null) { b.ingresoGs += gs; usdConGs += usd; }
    });
    (gastos || []).forEach(function (g) {
      if (g.proyectoId !== id) return;
      var m = num(g.monto);
      b.cantGastos++; b.gastos += m;
      var t = g.tipo || 'Sin categoría';
      b.porCategoria[t] = (b.porCategoria[t] || 0) + m;
    });
    (colabs || []).forEach(function (c) {
      if (c.proyectoId !== id) return;
      b.cantPagosColaboradores++; b.pagosColaboradores += num(c.monto);
    });
    if (b.pagosColaboradores > 0) b.porCategoria[COLAB] = (b.porCategoria[COLAB] || 0) + b.pagosColaboradores;
    b.cotizacionRef = cotP !== null ? cotP : (usdConGs > 0 ? b.ingresoGs / usdConGs : null);
    Object.keys(b.asignaciones).forEach(function (k) { b.presupuesto += num(b.asignaciones[k]); });

    b.egresos = b.gastos + b.pagosColaboradores;
    b.disponible = b.ingresoGs - b.egresos;
    var pc = b.valorNetoUsd - b.ingresoUsd;
    b.porCobrarUsd = Math.abs(pc) < 0.005 ? 0 : pc;
    b.avanceCobro = b.valorNetoUsd > 0 ? b.ingresoUsd / b.valorNetoUsd : null;
    b.usoDeIngresos = b.ingresoGs > 0 ? b.egresos / b.ingresoGs : (b.egresos > 0 ? 1 : 0);
    b.porCobrarGs = b.cotizacionRef === null ? null : b.porCobrarUsd * b.cotizacionRef;
    b.resultadoEstimado = b.porCobrarGs === null ? null : b.ingresoGs + b.porCobrarGs - b.egresos;
    var totalEst = b.porCobrarGs === null ? null : b.ingresoGs + b.porCobrarGs;
    b.margenEstimado = (b.resultadoEstimado === null || totalEst === null || totalEst <= 0) ? null : b.resultadoEstimado / totalEst;
    b.ejecucionPresupuesto = b.presupuesto > 0 ? b.egresos / b.presupuesto : null;
    b.cobradoDeMas = b.valorNetoUsd > 0 && b.ingresoUsd > b.valorNetoUsd * 1.005;
    b.avisos = [];
    if (b.ingresosSinCotizacion > 0) b.avisos.push(b.ingresosSinCotizacion + ' ingreso(s) sin cotización: no se suman en guaraníes.');
    if (b.ingresosConCotizacionProyecto > 0) b.avisos.push(b.ingresosConCotizacionProyecto + ' ingreso(s) sin cotización propia: se usó la del proyecto.');
    if (b.cobradoDeMas) b.avisos.push('Lo cobrado supera el valor neto del contrato.');
    if (b.cotizacionRef === null && b.porCobrarUsd > 0) b.avisos.push('Sin cotización para estimar el saldo por cobrar en guaraníes.');
    return b;
  }

  function general(proyectos, gastos, ingresos, colabs) {
    var ids = {};
    proyectos.forEach(function (p) { ids[p._id || p.id] = true; });
    var por = function (list) { var m = {}; (list || []).forEach(function (x) { (m[x.proyectoId] = m[x.proyectoId] || []).push(x); }); return m; };
    var gP = por(gastos), iP = por(ingresos), cP = por(colabs);
    var lista = proyectos.map(function (p) { var id = p._id || p.id; return proyecto(p, gP[id], iP[id], cP[id], {}); });
    var sum = function (f, filtro) { return lista.reduce(function (s, b) { return s + (filtro && !filtro(b) ? 0 : f(b)); }, 0); };
    var g = {
      proyectos: lista,
      ingresoGs: sum(function (b) { return b.ingresoGs; }),
      ingresoUsd: sum(function (b) { return b.ingresoUsd; }),
      gastos: sum(function (b) { return b.gastos; }),
      pagosColaboradores: sum(function (b) { return b.pagosColaboradores; }),
      porCobrarUsd: sum(function (b) { return b.porCobrarUsd > 0 ? b.porCobrarUsd : 0; }, function (b) { return b.estado !== COTIZACION; }),
      gastosHuerfanos: (gastos || []).filter(function (x) { return !ids[x.proyectoId]; }).reduce(function (s, x) { return s + num(x.monto); }, 0),
      ingresosHuerfanosGs: (ingresos || []).filter(function (x) { return !ids[x.proyectoId]; }).reduce(function (s, x) { return s + (numOrNull(x.montoFinalGs) || 0); }, 0),
      pagosColabHuerfanos: (colabs || []).filter(function (x) { return !ids[x.proyectoId]; }).reduce(function (s, x) { return s + num(x.monto); }, 0)
    };
    g.egresos = g.gastos + g.pagosColaboradores;
    g.disponible = g.ingresoGs - g.egresos;
    g.usoDeIngresos = g.ingresoGs > 0 ? g.egresos / g.ingresoGs : (g.egresos > 0 ? 1 : 0);
    g.porCategoria = {};
    lista.forEach(function (b) { Object.keys(b.porCategoria).forEach(function (k) { g.porCategoria[k] = (g.porCategoria[k] || 0) + b.porCategoria[k]; }); });
    g.hayHuerfanos = g.gastosHuerfanos > 0 || g.ingresosHuerfanosGs > 0 || g.pagosColabHuerfanos > 0;
    return g;
  }

  /* Colores de categoría (iguales a la app: CategoriaGasto.color) */
  var COLORES = {
    'Consumición': '#F97316', 'Combustible': '#EF4444', 'Colaboradores': '#8B5CF6', 'Peaje': '#6366F1',
    'Hospedaje': '#14B8A6', 'Implementos de trabajo': '#3B82F6', 'Maquinaria': '#F59E0B', 'Varios': '#6B7280',
    'Farmacia': '#10B981', 'Laboratorio': '#06B6D4', 'Camioneta': '#EC4899'
  };
  function color(cat) { return COLORES[cat] || '#6B7280'; }

  return { proyecto: proyecto, general: general, netoUsd: netoUsd, valorNetoUsd: valorNetoUsd, color: color, num: num, CATEGORIAS: Object.keys(COLORES) };
})();

/* Lectura de datos para el balance (Firestore compat). Guarda en memoria y refresca cada 60 s. */
var BalanceData = (function () {
  var cache = null, cargadoEn = 0, pendiente = null;
  function docs(snap) { return snap.docs.map(function (d) { var o = d.data(); o._id = d.id; return o; }); }
  function cargar(db, forzar) {
    if (!forzar && cache && Date.now() - cargadoEn < 60000) return Promise.resolve(cache);
    if (pendiente) return pendiente;
    pendiente = Promise.all([
      db.collection('gastos').get(),
      db.collection('pagos_recibidos').get(),
      db.collection('pagos_colaboradores').get(),
      db.collection('facturas').get()
    ]).then(function (r) {
      cache = { gastos: docs(r[0]), ingresos: docs(r[1]), colabs: docs(r[2]), facturas: docs(r[3]) };
      cargadoEn = Date.now(); pendiente = null;
      return cache;
    }, function (e) { pendiente = null; throw e; });
    return pendiente;
  }
  function asignaciones(db, proyectoId) {
    return db.collection('proyectos').doc(proyectoId).collection('asignaciones').get().then(function (s) {
      var m = {};
      s.docs.forEach(function (d) { m[d.id] = BalanceCalc.num((d.data() || {}).monto); });
      return m;
    });
  }
  function invalidar() { cargadoEn = 0; }
  function actual() { return cache; }
  return { cargar: cargar, asignaciones: asignaciones, invalidar: invalidar, actual: actual };
})();
