/* Lo que el asistente sabe de tu negocio — SoilTech
 *
 * Arma un resumen compacto de Firestore para mandarlo como contexto. Dos
 * reglas que lo gobiernan:
 *
 *  1. Los números salen de BalanceCalc, los mismos que muestra la pantalla de
 *     balance. Si el asistente calculara por su cuenta, tarde o temprano diría
 *     algo distinto a lo que ves en pantalla, y no sabrías a cuál creerle.
 *  2. El resumen tiene tope. Cada token se paga, y mandar las 29 facturas
 *     enteras para preguntar cuánto se gastó en combustible es tirar plata.
 *     Se mandan agregados, y solo las últimas filas de cada cosa.
 */
var Contexto = (function () {

  var TOPE_FACTURAS = 25;   // las más recientes, en detalle
  var TOPE_GASTOS = 30;
  var TOPE_CHEQUES = 15;

  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function gs(n) { return Math.round(num(n)).toLocaleString('es-PY'); }
  function fecha(v) {
    if (!v) return '';
    if (v.toDate) v = v.toDate();
    if (typeof v === 'string') { var m = v.match(/^\d{4}-\d{2}-\d{2}/); if (m) return m[0]; }
    var d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 24);
    var p = function (x) { return String(x).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function ms(v) {
    if (!v) return 0;
    if (v.toMillis) return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    var t = Date.parse(v); return isNaN(t) ? 0 : t;
  }

  /* Agrupa y suma, para no mandar filas sueltas cuando alcanza un total. */
  function sumarPor(lista, clave, valor) {
    var m = {};
    (lista || []).forEach(function (x) {
      var k = (typeof clave === 'function' ? clave(x) : x[clave]) || 'Sin especificar';
      m[k] = (m[k] || 0) + num(typeof valor === 'function' ? valor(x) : x[valor]);
    });
    return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; })
      .map(function (k) { return { k: k, v: m[k] }; });
  }

  function lineas(pares, sufijo) {
    return pares.map(function (p) { return '- ' + p.k + ': ' + gs(p.v) + (sufijo || ''); }).join('\n');
  }

  /* `d` es lo que devuelve BalanceData.cargar: gastos, ingresos, colabs,
     facturas. `proyectos` es la lista cruda. */
  function armar(d, proyectos, extras) {
    extras = extras || {};
    d = d || {}; proyectos = proyectos || [];
    var hoy = new Date();
    var partes = [];

    partes.push('# Datos de SoilTech');
    partes.push('Fecha de hoy: ' + fecha(hoy) + '. Moneda: guaraníes (₲) salvo donde diga USD.');
    partes.push('Los montos ya vienen calculados; no los recalcules a partir de las filas sueltas.');

    /* ── Proyectos, con los números del balance ── */
    var g = (typeof BalanceCalc !== 'undefined')
      ? BalanceCalc.general(proyectos, d.gastos, d.ingresos, d.colabs) : null;
    if (g && g.proyectos && g.proyectos.length) {
      partes.push('\n## Proyectos (' + g.proyectos.length + ')');
      partes.push('Totales: cobrado ₲' + gs(g.ingresoGs) + ' · egresos ₲' + gs(g.egresos) +
                  ' · disponible ₲' + gs(g.disponible) + ' · por cobrar USD ' + (Math.round(g.porCobrarUsd * 100) / 100));
      partes.push(g.proyectos.map(function (b) {
        return '- ' + b.nombre + ' [' + (b.estado || 'sin estado') + ']' +
          ' · valor USD ' + Math.round(b.valorNetoUsd) +
          ' · cobrado ₲' + gs(b.ingresoGs) +
          ' · gastos ₲' + gs(b.gastos) +
          ' · colaboradores ₲' + gs(b.pagosColaboradores) +
          ' · disponible ₲' + gs(b.disponible) +
          ' · por cobrar USD ' + Math.round(b.porCobrarUsd) +
          (b.margenEstimado != null ? ' · margen ' + Math.round(b.margenEstimado * 100) + '%' : '');
      }).join('\n'));
    }

    /* ── Facturas ── */
    var F = (d.facturas || []).filter(function (f) { return f.estado !== 'anulada'; });
    if (F.length) {
      partes.push('\n## Facturas (' + F.length + ' activas)');
      var totalF = F.reduce(function (s, f) { return s + num(f.totalGs || f.total); }, 0);
      partes.push('Total facturado: ₲' + gs(totalF));
      partes.push('\nPor servicio:');
      partes.push(lineas(sumarPor(F, function (f) {
        var it = (f.items || [])[0] || {};
        var cod = it.code || f.codigoServicio || '';
        var nom = it.desc || f.servicio || '';
        return (cod ? cod + ' ' : '') + (nom || 'sin detalle');
      }, function (f) { return num(f.totalGs || f.total); })));
      partes.push('\nPor cliente:');
      partes.push(lineas(sumarPor(F, 'cliente', function (f) { return num(f.totalGs || f.total); })));
      var ult = F.slice().sort(function (a, b) { return ms(b.fecha) - ms(a.fecha); }).slice(0, TOPE_FACTURAS);
      partes.push('\nÚltimas ' + ult.length + ' facturas:');
      partes.push(ult.map(function (f) {
        return '- ' + (f.nroFormateado || f.numero || '') + ' · ' + fecha(f.fecha) + ' · ' + (f.cliente || '') +
          ' · ₲' + gs(f.totalGs || f.total) +
          (f.pagada ? ' · pagada' : ' · SIN COBRAR');
      }).join('\n'));
    }

    /* ── Gastos ── */
    var G = d.gastos || [];
    if (G.length) {
      partes.push('\n## Gastos (' + G.length + ')');
      partes.push('Total: ₲' + gs(G.reduce(function (s, x) { return s + num(x.monto); }, 0)));
      partes.push('\nPor categoría:');
      partes.push(lineas(sumarPor(G, 'tipo', 'monto')));
      partes.push('\nPor proyecto:');
      partes.push(lineas(sumarPor(G, 'proyectoNombre', 'monto')));
      var ug = G.slice().sort(function (a, b) { return ms(b.fecha) - ms(a.fecha); }).slice(0, TOPE_GASTOS);
      partes.push('\nÚltimos ' + ug.length + ' gastos:');
      partes.push(ug.map(function (x) {
        return '- ' + fecha(x.fecha) + ' · ' + (x.tipo || '') + ' · ' + (x.concepto || '') +
          ' · ₲' + gs(x.monto) + (x.proyectoNombre ? ' · ' + x.proyectoNombre : '');
      }).join('\n'));
    }

    /* ── Cheques pendientes ── */
    var C = (extras.cheques || []).filter(function (c) { return c.estado === 'pendiente'; });
    if (C.length) {
      partes.push('\n## Cheques pendientes (' + C.length + ')');
      partes.push('Comprometido: ₲' + gs(C.reduce(function (s, c) { return s + num(c.monto); }, 0)));
      partes.push(C.slice()
        .sort(function (a, b) { return ms(a.fechaCobro) - ms(b.fechaCobro); })
        .slice(0, TOPE_CHEQUES)
        .map(function (c) {
          return '- ' + (c.numero || '') + ' · ' + (c.bancoNombre || '') + ' · se cobra ' + fecha(c.fechaCobro) +
            ' · ₲' + gs(c.monto) + ' · ' + (c.concepto || '') + ' · ' + (c.destino || '');
        }).join('\n'));
    }

    /* ── Catálogo, para que entienda los códigos ── */
    if (extras.servicios && extras.servicios.length) {
      partes.push('\n## Catálogo de servicios');
      partes.push(extras.servicios.map(function (s) {
        return '- ' + s.codigo + ' (' + (s.tipo || '') + '): ' + s.nombre;
      }).join('\n'));
    }

    return partes.join('\n');
  }

  /* Aproximación de tokens, para avisar antes de mandar algo carísimo.
     Un token ronda los 4 caracteres en castellano. */
  function tokensAprox(texto) { return Math.ceil(String(texto || '').length / 4); }

  var SISTEMA =
    'Sos el asistente del panel de SoilTech, la consultora de suelos de Ramón Torres, en Paraguay.\n' +
    'Respondés sobre sus datos reales de gastos, facturas, proyectos y cheques.\n\n' +
    'Reglas:\n' +
    '- Usá solo los datos que te paso. Si algo no está, decí que no está en los datos, no lo estimes.\n' +
    '- Los totales ya vienen calculados. No los recalcules sumando las filas de ejemplo, que están recortadas.\n' +
    '- Montos en guaraníes con separador de miles. Aclarás cuando algo esté en dólares.\n' +
    '- Respuestas cortas y directas. Una tabla cuando se comparan cosas, prosa cuando no.\n' +
    '- Si la pregunta es ambigua, respondé con la interpretación más probable y aclarala en una línea.\n' +
    '- No inventes números. Es preferible decir que falta el dato.';

  return {
    armar: armar, tokensAprox: tokensAprox, SISTEMA: SISTEMA,
    sumarPor: sumarPor, TOPES: { facturas: TOPE_FACTURAS, gastos: TOPE_GASTOS, cheques: TOPE_CHEQUES }
  };
})();
