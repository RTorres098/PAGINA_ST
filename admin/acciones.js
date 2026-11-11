/* Lo que el asistente puede hacer, además de responder — SoilTech
 *
 * Tres reglas que gobiernan este archivo:
 *
 *  1. Ninguna herramienta escribe en Firestore. Devuelven una propuesta;
 *     la pantalla la muestra y recién si confirmás se ejecuta. Un nombre
 *     de proyecto parecido a otro alcanza para escribir en el equivocado,
 *     y un gasto mal cargado te ensucia el balance sin que se note.
 *
 *  2. Cuando se ejecuta, se llama a la misma función que usa el panel
 *     (Gastos.crear, no un add suelto). Si el asistente escribiera los
 *     campos por su cuenta, sería una segunda versión de la misma
 *     operación, y tarde o temprano las dos dirían cosas distintas.
 *
 *  3. El asistente no maneja ids. Nombra los proyectos como los nombrás
 *     vos y acá se resuelven. Si hay dos parecidos, no elige: devuelve
 *     las opciones para que pregunte.
 */
var Acciones = (function () {

  function N(t) {
    return String(t == null ? '' : t).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  function num(v) { var n = typeof v === 'number' ? v : parseFloat(v); return isNaN(n) ? 0 : n; }

  /* "7.500" son siete mil quinientos y "125.5" son ciento veinticinco y
     medio. Sacar todos los puntos convertiría lo segundo en 1255. */
  function aNumero(t) {
    if (typeof t === 'number') return t;
    var x = String(t == null ? '' : t).trim().replace(/\s|\u20B2|USD|Gs\.?/gi, '');
    if (!x) return NaN;
    var coma = x.indexOf(',') >= 0, punto = x.indexOf('.') >= 0;
    if (coma && punto) x = x.replace(/\./g, '').replace(',', '.');
    else if (coma) x = x.replace(',', '.');
    else if (punto && /^\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, '');
    return /^-?\d*\.?\d+$/.test(x) ? parseFloat(x) : NaN;
  }
  function gs(n) { return '₲ ' + Math.round(num(n)).toLocaleString('es-PY'); }

  function esCurso(p) {
    return !!(p && (p.tipoProyecto === 'capacitacion' || p.tipoProyecto === 'curso'));
  }

  /* Exacto, después por prefijo, después por contenido. Si en algún nivel
     hay más de uno, corta ahí y devuelve las opciones: adivinar entre dos
     proyectos parecidos es justamente lo que no queremos. */
  function resolverProyecto(nombre, proyectos) {
    var q = N(nombre);
    if (!q) return { error: 'No dijiste a qué proyecto va el gasto.' };
    var lista = proyectos || [];
    var intentos = [
      function (p) { return N(p.nombre) === q; },
      function (p) { return N(p.nombre).indexOf(q) === 0; },
      function (p) { return N(p.nombre).indexOf(q) >= 0; }
    ];
    for (var i = 0; i < intentos.length; i++) {
      var hay = lista.filter(intentos[i]);
      if (hay.length === 1) return { proyecto: hay[0] };
      if (hay.length > 1) {
        return { error: 'Hay más de un proyecto que coincide con "' + nombre + '": ' +
                 hay.map(function (p) { return p.nombre; }).join(', ') +
                 '. Preguntale al usuario cuál es.' };
      }
    }
    return { error: 'No existe ningún proyecto parecido a "' + nombre + '". Los que hay son: ' +
             lista.map(function (p) { return p.nombre; }).join(', ') + '.' };
  }

  function hoyISO() {
    var d = new Date(), p = function (x) { return String(x).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ── Las herramientas, tal como las ve la API ── */
  function herramientas() {
    var todas = Gastos.CAMPO.concat(Gastos.CURSO).filter(function (c, i, a) { return a.indexOf(c) === i; });
    return [{
      name: 'registrar_gasto',
      description:
        'Registra un gasto de un proyecto de SoilTech. Usala cuando el usuario cuente que gastó ' +
        'algo, por ejemplo "cargá 850 mil de nafta para SILVIPAR". No la uses para preguntas ' +
        'sobre gastos que ya existen. El monto va en guaraníes. Si falta el proyecto, la ' +
        'categoría, el concepto o el monto, preguntáselo al usuario en vez de inventarlo. ' +
        'El usuario tiene que confirmar antes de que se guarde, así que no afirmes que ya quedó ' +
        'registrado.',
      input_schema: {
        type: 'object',
        properties: {
          proyecto: { type: 'string', description: 'Nombre del proyecto, como lo dijo el usuario.' },
          categoria: { type: 'string', enum: todas, description: 'Categoría del gasto.' },
          concepto: { type: 'string', description: 'Qué se compró o pagó, en pocas palabras.' },
          monto: { type: 'number', description: 'Monto total en guaraníes, impuestos incluidos.' },
          fecha: { type: 'string', description: 'Fecha en formato AAAA-MM-DD. Si no la dicen, es hoy.' },
          proveedor: { type: 'string', description: 'A quién se le pagó, si lo mencionan.' },
          medioPago: { type: 'string', enum: Gastos.MEDIOS, description: 'Cómo se pagó. Por defecto Efectivo.' },
          tarjeta: { type: 'string', enum: Gastos.TARJETAS, description: 'Solo si se pagó con tarjeta de crédito.' },
          conFactura: { type: 'boolean', description: 'Si el gasto tiene factura.' },
          numeroFactura: { type: 'string' },
          tipoIva: { type: 'string', enum: Gastos.IVA, description: 'Obligatorio si conFactura es verdadero.' },
          valor10: { type: 'number', description: 'Base gravada al 10%, solo en facturas mixtas.' },
          valor5: { type: 'number', description: 'Base gravada al 5%, solo en facturas mixtas.' },
          rucProveedor: { type: 'string' }
        },
        required: ['proyecto', 'categoria', 'concepto', 'monto']
      }
    },
    {
      name: 'editar_presupuesto',
      description:
        'Prepara cambios en el presupuesto de un proyecto y abre el formulario con esos ' +
        'cambios aplicados, sin guardarlos. Usala cuando el usuario pida cambiar un valor del ' +
        'presupuesto, por ejemplo "subí las calicatas a 20 en SILVIPAR" o "poné la cotización a 7500". ' +
        'No guarda nada: el usuario revisa los totales recalculados en el formulario y guarda ' +
        'desde ahí. Decíselo así, no digas que el presupuesto quedó cambiado. ' +
        'No sirve para precios de laboratorio, maquinaria ni honorarios, que son tablas: para eso ' +
        'decile que los edite en el formulario.',
      input_schema: {
        type: 'object',
        properties: {
          proyecto: { type: 'string', description: 'Nombre del proyecto, como lo dijo el usuario.' },
          cambios: {
            type: 'array',
            description: 'Los campos a cambiar, con su valor nuevo.',
            items: {
              type: 'object',
              properties: {
                campo: { type: 'string', enum: CamposPres.editables(), description: 'Id del campo del formulario.' },
                valor: { type: 'string', description: 'Valor nuevo, como texto. Los porcentajes van de 0 a 100.' }
              },
              required: ['campo', 'valor']
            }
          }
        },
        required: ['proyecto', 'cambios']
      }
    },
    {
      name: 'registrar_cobro',
      description:
        'Marca una factura como cobrada: crea el pago recibido y deja la factura pagada, los dos ' +
        'juntos. Usala cuando el usuario diga que le pagaron una factura, por ejemplo "ya cobré la ' +
        '26" o "SILVIPAR me pagó la factura de octubre". Identificá la factura por su número. ' +
        'Si no decís el monto se toma el total de la factura; si no decís la cotización se toma la ' +
        'del proyecto. El usuario confirma antes de que se escriba, así que no digas que ya quedó ' +
        'cobrada. Para anular o desmarcar una factura, decile que lo haga en Facturación.',
      input_schema: {
        type: 'object',
        properties: {
          factura: { type: 'string', description: 'Número de la factura, como lo dijo el usuario. Puede ser el número completo o los últimos dígitos.' },
          monto: { type: 'string', description: 'Monto cobrado antes de retención, en la moneda de la factura. Si no lo dicen, no lo mandes.' },
          fecha: { type: 'string', description: 'Fecha del cobro en formato AAAA-MM-DD. Si no la dicen, es hoy.' },
          cotizacion: { type: 'string', description: 'Cotización Gs/USD del día del cobro. Si no la dicen, no la mandes.' },
          retencionPct: { type: 'string', description: 'Retención de IVA en porcentaje, de 0 a 100. Si no la dicen, no la mandes.' }
        },
        required: ['factura']
      }
    },
    {
      name: 'crear_presupuesto',
      description:
        'Arma un presupuesto nuevo y abre el formulario con los datos cargados, sin guardarlo. ' +
        'Usala cuando el usuario describa un trabajo a presupuestar, por ejemplo "preparame un ' +
        'presupuesto de 10 calicatas y 3 barrenadas con 4 días de campo". ' +
        'Poné SOLO los valores que el usuario dijo o que se deducen directamente de lo que dijo: ' +
        'si menciona un coordinador y dos jornaleros, son 3 personas en campo. No inventes ' +
        'muestras por calicata, kilómetros ni precios que no dijo: el formulario marca en amarillo ' +
        'lo que falta y el usuario lo completa. ' +
        'Los porcentajes fijos, los precios de laboratorio y las tablas de honorarios, maquinaria y ' +
        'peaje vienen con los valores de siempre y se ajustan en el formulario, no desde acá. ' +
        'No se guarda nada: el usuario revisa los totales y guarda desde el formulario. Decilo así.',
      input_schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del proyecto. Si el usuario no lo dijo, preguntáselo.' },
          cliente: { type: 'string', description: 'Nombre del cliente, si lo dijo. Si no está en la lista, el formulario lo marca para que lo elija.' },
          valores: {
            type: 'array',
            description: 'Los campos del formulario que el usuario dio.',
            items: {
              type: 'object',
              properties: {
                campo: { type: 'string', enum: CamposPres.editables(), description: 'Id del campo del formulario.' },
                valor: { type: 'string', description: 'Valor, como texto. Los porcentajes van de 0 a 100.' }
              },
              required: ['campo', 'valor']
            }
          }
        },
        required: ['nombre', 'valores']
      }
    },
    {
      name: 'preparar_factura',
      description:
        'Abre el formulario de factura nueva con los datos cargados, para que el usuario la revise ' +
        'y la emita. Usala cuando pida facturar algo, por ejemplo "armame la factura de SILVIPAR por ' +
        'el inventario forestal, 4.200 dólares". ' +
        'NO emite la factura ni elige el número: el número y el timbrado los pone el sistema de ' +
        'numeración cuando se abre el formulario, y el usuario guarda e imprime. Nunca digas que la ' +
        'factura quedó emitida ni inventes un número de factura. ' +
        'Necesita al menos el proyecto o el cliente. Poné solo lo que el usuario dijo.',
      input_schema: {
        type: 'object',
        properties: {
          proyecto: { type: 'string', description: 'Nombre del proyecto a facturar. Trae el cliente, el RUC y el servicio solos.' },
          cliente: { type: 'string', description: 'Nombre del cliente, si no hay proyecto.' },
          servicio: { type: 'string', description: 'Código del servicio del catálogo, por ejemplo ST-07.' },
          descripcion: { type: 'string', description: 'Detalle del ítem, si el usuario quiere uno distinto al del catálogo.' },
          cantidad: { type: 'string', description: 'Cantidad del ítem. Por defecto 1.' },
          precioUnitario: { type: 'string', description: 'Precio unitario, en la moneda de la factura.' },
          moneda: { type: 'string', enum: ['DOLARES AMERICANOS', 'GUARANIES'], description: 'Por defecto dólares.' },
          condicion: { type: 'string', enum: ['CONTADO', 'CREDITO'], description: 'Por defecto contado.' },
          tipoIva: { type: 'string', enum: ['10', '5', '0'], description: 'IVA en porcentaje. Por defecto 10.' },
          fecha: { type: 'string', description: 'Fecha de la factura en formato AAAA-MM-DD. Por defecto hoy.' }
        },
        required: []
      }
    }];
  }

  function prepararFactura(args, ctx) {
    var p = null;
    if (args.proyecto) {
      var r = resolverProyecto(args.proyecto, ctx.proyectos);
      if (r.error) return { error: r.error };
      p = r.proyecto;
    }
    var cliente = String(args.cliente || '').trim();
    if (!p && !cliente) {
      return { error: 'Para armar la factura hace falta al menos el proyecto o el cliente. Preguntáselo.' };
    }

    /* El servicio se resuelve contra el catálogo: un código inventado deja
       la descripción vacía en la factura impresa. */
    var servicio = null;
    if (args.servicio) {
      if (typeof ServiciosCat === 'undefined') return { error: 'No pude leer el catálogo de servicios.' };
      servicio = ServiciosCat.buscar(args.servicio) || ServiciosCat.resolver(args.servicio);
      if (!servicio) {
        return { error: 'El servicio "' + args.servicio + '" no está en el catálogo. Los códigos válidos ' +
                 'son: ' + ServiciosCat.activos().map(function (x) { return x.codigo; }).join(', ') + '.' };
      }
    }

    var d = { proyectoId: p ? p._id : null, servicio: servicio ? servicio.codigo : null };
    var filas = [];
    if (p) filas.push({ k: 'Proyecto', v: p.nombre });
    if (cliente && !p) { d.cliente = cliente; filas.push({ k: 'Cliente', v: cliente }); }
    if (servicio) filas.push({ k: 'Servicio', v: servicio.codigo + ' · ' + servicio.nombre });

    if (args.descripcion) { d.descripcion = String(args.descripcion).trim(); filas.push({ k: 'Detalle', v: d.descripcion }); }

    if (args.cantidad != null && args.cantidad !== '') {
      var c = aNumero(args.cantidad);
      if (isNaN(c) || c <= 0) return { error: 'La cantidad tiene que ser un número mayor a cero, y mandaste "' + args.cantidad + '".' };
      d.cantidad = c; filas.push({ k: 'Cantidad', v: String(c) });
    }
    if (args.precioUnitario != null && args.precioUnitario !== '') {
      var u = aNumero(args.precioUnitario);
      if (isNaN(u) || u < 0) return { error: 'El precio unitario tiene que ser un número, y mandaste "' + args.precioUnitario + '".' };
      d.precioUnitario = u; filas.push({ k: 'Precio unitario', v: String(u) });
    }
    if (args.moneda) { d.moneda = args.moneda; filas.push({ k: 'Moneda', v: args.moneda }); }
    if (args.condicion) { d.condicion = args.condicion; filas.push({ k: 'Condición', v: args.condicion }); }
    if (args.tipoIva != null && args.tipoIva !== '') {
      var iva = aNumero(args.tipoIva);
      if ([0, 5, 10].indexOf(iva) < 0) return { error: 'El IVA solo puede ser 10, 5 o exento (0).' };
      d.tipoIva = iva; filas.push({ k: 'IVA', v: iva + '%' });
    }
    if (args.fecha) { d.fecha = String(args.fecha).slice(0, 10); filas.push({ k: 'Fecha', v: d.fecha }); }

    filas.push({ k: 'Número', v: 'Lo asigna la numeración del timbrado vigente, al abrir el formulario' });

    return {
      propuesta: {
        tipo: 'preparar_factura',
        titulo: 'Armar la factura de ' + ((p && p.nombre) || cliente),
        verbo: 'Abrir la factura preparada',
        filas: filas,
        datos: d,
        resumen: 'Factura de ' + ((p && p.nombre) || cliente) + ' lista para revisar'
      }
    };
  }

  function prepararNuevo(args) {
    var nombre = String(args.nombre || '').trim();
    if (!nombre) return { error: 'Falta el nombre del proyecto. Preguntáselo al usuario.' };

    var valores = (args.valores || []).filter(function (c) { return c && c.campo !== 'proyNombre'; });
    var v = validarCampos(valores, {}, false);
    if (v.error) return { error: v.error };

    var cambios = [{ campo: 'proyNombre', valor: nombre }].concat(v.limpios);
    var cliente = String(args.cliente || '').trim();

    var filas = [{ k: 'Proyecto', v: nombre }];
    if (cliente) filas.push({ k: 'Cliente', v: cliente });
    filas = filas.concat(v.filas);
    filas.push({ k: 'Lo demás', v: 'Porcentajes fijos, precios de laboratorio y tablas, con los valores de siempre' });

    return {
      propuesta: {
        tipo: 'crear_presupuesto',
        titulo: 'Armar el presupuesto de ' + nombre,
        verbo: 'Abrir el presupuesto armado',
        filas: filas,
        cambios: cambios,
        extra: cliente ? { cliente: cliente } : null,
        resumen: 'Presupuesto de ' + nombre + ' con ' + v.limpios.length +
                 (v.limpios.length === 1 ? ' dato' : ' datos') + ' cargados'
      }
    };
  }

  /* Por número exacto, y si no por los últimos dígitos: "la 26" tiene que
     encontrar la 001-001-0000026. Las anuladas no cuentan. */
  function resolverFactura(texto, facturas) {
    var q = String(texto == null ? '' : texto).replace(/\D/g, '');
    if (!q) return { error: 'No dijiste qué factura. Preguntale el número al usuario.' };
    var vivas = (facturas || []).filter(function (f) { return f.estado !== 'anulada'; });
    var dig = function (f) { return String(f.nroFormateado || f.numero || '').replace(/\D/g, ''); };

    var exacto = vivas.filter(function (f) { return dig(f) === q; });
    var hay = exacto.length ? exacto : vivas.filter(function (f) {
      var d = dig(f);
      return d.length >= q.length && d.slice(-q.length) === q;
    });

    if (!hay.length) {
      return { error: 'No encontré ninguna factura con el número "' + texto + '". Pedile al usuario ' +
               'el número completo.' };
    }
    if (hay.length > 1) {
      return { error: 'Hay ' + hay.length + ' facturas que terminan en ' + q + ': ' +
               hay.map(function (f) { return (f.nroFormateado || '') + ' de ' + (f.cliente || ''); }).join(', ') +
               '. Preguntale al usuario cuál.' };
    }
    return { factura: hay[0] };
  }

  function prepararCobro(args, ctx) {
    var r = resolverFactura(args.factura, ctx.facturas);
    if (r.error) return { error: r.error };
    var f = r.factura;

    if (f.pagada) {
      return { error: 'La factura ' + (f.nroFormateado || '') + ' ya figura cobrada. Si hay que ' +
               'corregirla, decile al usuario que la desmarque en Facturación.' };
    }
    if (!f.proyectoId) {
      return { error: 'La factura ' + (f.nroFormateado || '') + ' no tiene proyecto asignado, así que ' +
               'el cobro no sumaría a ningún balance. Decile que le asigne el proyecto en Facturación.' };
    }
    var p = (ctx.proyectos || []).filter(function (x) { return x._id === f.proyectoId; })[0] || null;
    var esUsd = Cobros.esUsd(f);

    var monto = args.monto != null && args.monto !== '' ? aNumero(args.monto) : num(f.total);
    if (isNaN(monto)) return { error: 'No entendí el monto "' + args.monto + '".' };

    var cot = args.cotizacion != null && args.cotizacion !== '' ? aNumero(args.cotizacion)
                                                               : num(p && p.cotizacion);
    if (!(cot > 0)) {
      return { error: 'Falta la cotización del día del cobro: el proyecto no tiene una cargada. ' +
               'Preguntásela al usuario.' };
    }
    var ret = args.retencionPct != null && args.retencionPct !== ''
      ? aNumero(args.retencionPct) / 100 : Cobros.retencionDe(p);
    if (isNaN(ret)) return { error: 'No entendí la retención "' + args.retencionPct + '".' };

    var calc = Cobros.calcular({ monto: monto, retencion: ret, cotizacion: cot, esUsd: esUsd });
    if (calc.error) return { error: calc.error };

    var fecha = args.fecha || hoyISO();
    var usd = function (n) { return 'USD ' + (Math.round(n * 100) / 100).toLocaleString('es-PY'); };

    return {
      propuesta: {
        tipo: 'registrar_cobro',
        titulo: 'Registrar el cobro de la factura ' + (f.nroFormateado || ''),
        verbo: 'Registrar el cobro',
        filas: [
          { k: 'Factura', v: (f.nroFormateado || '') + ' · ' + (f.cliente || '') },
          { k: 'Proyecto', v: (p && p.nombre) || f.proyectoNombre || '(sin proyecto)' },
          { k: 'Cobrado', v: (esUsd ? usd(monto) : gs(monto)) + ' antes de retención' },
          { k: 'Retención', v: Math.round(ret * 1000) / 10 + '%' },
          { k: 'Cotización', v: gs(cot) + ' por USD' },
          { k: 'Fecha', v: fecha },
          { k: 'Suma al balance', v: gs(calc.finalGs) + '  ·  ' + usd(calc.finalUsd) }
        ],
        factura: f, facturaId: f._id, proyecto: p, calculo: calc, fecha: fecha,
        resumen: 'Cobro de la factura ' + (f.nroFormateado || '') + ' por ' + gs(calc.finalGs) + ' netos'
      }
    };
  }

  /* Los que son porcentaje: un 150% de anticipo no es un typo que convenga
     dejar pasar hasta el formulario. */
  var PORCENTAJES = ['pImp', 'pRet', 'pAnt', 'pctMargen', 'pesoPrep', 'pesoLab', 'pesoInf'];

  /* Valida una lista de campos del formulario. `actuales` son los valores
     que ya tiene el presupuesto, para mostrar el antes; en uno nuevo va
     vacío. Devuelve {error} o {limpios, filas}. */
  function validarCampos(cambios, actuales, conAntes) {
    cambios = cambios || [];
    actuales = actuales || {};
    if (!cambios.length) return { error: 'No dijiste qué valores poner. Preguntale al usuario.' };
    if (cambios.length > 20) return { error: 'Son demasiados campos de una vez. Hacelo por partes.' };

    var validos = CamposPres.editables(), vistos = {}, limpios = [], filas = [];
    for (var i = 0; i < cambios.length; i++) {
      var c = cambios[i] || {}, campo = c.campo;
      if (validos.indexOf(campo) < 0) {
        return { error: '"' + campo + '" no es un campo del formulario. Los que se pueden poner son: ' +
                 validos.map(function (x) { return x + ' (' + CamposPres.etiqueta(x) + ')'; }).join(', ') + '.' };
      }
      if (vistos[campo]) return { error: 'Mandaste dos valores distintos para ' + CamposPres.etiqueta(campo) + '.' };
      vistos[campo] = true;

      var valor = c.valor;
      if (!CamposPres.esTexto(campo)) {
        var n = aNumero(valor);
        if (isNaN(n)) return { error: CamposPres.etiqueta(campo) + ' tiene que ser un número, y mandaste "' + valor + '".' };
        if (n < 0) return { error: CamposPres.etiqueta(campo) + ' no puede ser negativo.' };
        if (PORCENTAJES.indexOf(campo) >= 0 && n > 100) {
          return { error: CamposPres.etiqueta(campo) + ' es un porcentaje y mandaste ' + n +
                   '. Confirmá con el usuario qué quiso decir.' };
        }
        valor = n;
      } else {
        valor = String(valor == null ? '' : valor).trim();
      }

      limpios.push({ campo: campo, valor: valor });
      if (conAntes) {
        var antes = actuales[campo];
        filas.push({ k: CamposPres.etiqueta(campo),
                     v: (antes === undefined || antes === '' ? '(vacío)' : antes) + '  \u2192  ' + valor });
      } else {
        filas.push({ k: CamposPres.etiqueta(campo), v: String(valor) });
      }
    }
    return { limpios: limpios, filas: filas };
  }

  function prepararPresupuesto(args, ctx) {
    var r = resolverProyecto(args.proyecto, ctx.proyectos);
    if (r.error) return { error: r.error };
    var p = r.proyecto;

    var actuales = (p.presupuesto && p.presupuesto.form && p.presupuesto.form.campos) || {};
    var v = validarCampos(args.cambios, actuales, true);
    if (v.error) return { error: v.error };

    return {
      propuesta: {
        tipo: 'editar_presupuesto',
        titulo: 'Cambiar el presupuesto de ' + p.nombre,
        verbo: 'Abrir el presupuesto con los cambios',
        filas: v.filas,
        cambios: v.limpios,
        proyecto: p,
        resumen: v.limpios.length + (v.limpios.length === 1 ? ' cambio' : ' cambios') + ' en ' + p.nombre
      }
    };
  }

  /* ── Preparar: valida y arma la propuesta, sin tocar la base ── */
  function preparar(nombre, args, ctx) {
    args = args || {};
    if (nombre === 'editar_presupuesto') return prepararPresupuesto(args, ctx);
    if (nombre === 'registrar_cobro') return prepararCobro(args, ctx);
    if (nombre === 'crear_presupuesto') return prepararNuevo(args);
    if (nombre === 'preparar_factura') return prepararFactura(args, ctx);
    if (nombre !== 'registrar_gasto') return { error: 'No conozco la herramienta "' + nombre + '".' };

    var r = resolverProyecto(args.proyecto, ctx.proyectos);
    if (r.error) return { error: r.error };
    var p = r.proyecto;

    var validas = Gastos.categorias(esCurso(p));
    if (validas.indexOf(args.categoria) < 0) {
      return { error: '"' + args.categoria + '" no es una categoría válida para ' + p.nombre +
               '. Las que acepta son: ' + validas.join(', ') + '.' };
    }

    var datos = {
      proyectoId: p._id,
      tipo: args.categoria,
      concepto: args.concepto,
      monto: num(args.monto),
      fecha: args.fecha || hoyISO(),
      proveedor: args.proveedor || null,
      medioPago: args.medioPago || 'Efectivo',
      tarjetaCredito: args.tarjeta || null,
      factura: !!args.conFactura,
      numeroFactura: args.numeroFactura || null,
      tipoIva: args.tipoIva || null,
      valor10: num(args.valor10),
      valor5: num(args.valor5),
      rucProveedor: args.rucProveedor || null,
      origen: 'asistente'          // queda marcado de dónde salió
    };

    var err = Gastos.validar(datos);
    if (err) return { error: err };

    /* descuadre() devuelve true/false, no un mensaje: el texto lo pone acá. */
    if (datos.factura && Gastos.descuadre(datos.tipoIva, datos.monto, datos.valor10, datos.valor5)) {
      return { error: 'En una factura con 5% y 10%, las dos bases tienen que sumar el total. ' +
               'Diste ' + gs(datos.valor10) + ' al 10% y ' + gs(datos.valor5) + ' al 5%, que no dan ' +
               gs(datos.monto) + '. Preguntale al usuario cómo se reparte.' };
    }

    var filas = [
      { k: 'Proyecto', v: p.nombre },
      { k: 'Categoría', v: datos.tipo },
      { k: 'Concepto', v: datos.concepto },
      { k: 'Monto', v: gs(datos.monto) },
      { k: 'Fecha', v: datos.fecha },
      { k: 'Pago', v: datos.medioPago + (datos.tarjetaCredito ? ' (' + datos.tarjetaCredito + ')' : '') }
    ];
    if (datos.proveedor) filas.push({ k: 'Proveedor', v: datos.proveedor });
    if (datos.factura) {
      filas.push({ k: 'Factura', v: (datos.numeroFactura || 'sin número') + ' · IVA ' + datos.tipoIva });
    }

    return {
      propuesta: {
        tipo: 'registrar_gasto',
        titulo: 'Registrar un gasto',
        verbo: 'Guardar el gasto',
        filas: filas,
        datos: datos,
        proyecto: p,
        resumen: 'Gasto de ' + gs(datos.monto) + ' en ' + datos.tipo + ', proyecto ' + p.nombre
      }
    };
  }

  /* ── Ejecutar: recién acá se escribe, y por la vía del panel ── */
  function ejecutar(db, propuesta, yo) {
    if (!propuesta) return Promise.reject(new Error('Propuesta desconocida'));

    /* El presupuesto no se escribe desde acá. El cálculo del total vive en
       calc(), que lee el formulario, y son trescientas líneas: una segunda
       versión que el asistente escribiera por su cuenta daría otro número
       el día que cambie una. Así que se dejan los cambios, se abre el
       formulario y el total lo recalcula el mismo código de siempre. */
    /* La factura tampoco se escribe: el numero sale del timbrado vigente
       cuando se abre el formulario, y emitir una mal no es un bug de
       pantalla, hay que dar de baja el numero quemado. */
    if (propuesta.tipo === 'preparar_factura') {
      if (!Traspaso.dejar('factura', propuesta.datos)) {
        return Promise.reject(new Error('El navegador no dejó guardar los datos para pasarlos al formulario'));
      }
      window.open('../facturacion/#nueva/ia', '_blank');
      return Promise.resolve(
        'Se abrió el formulario de factura nueva en otra pestaña, con los datos cargados. El número ' +
        'lo asignó la numeración del timbrado. Falta que el usuario revise, guarde e imprima. ' +
        'No afirmes que la factura está emitida ni menciones un número.');
    }

    if (propuesta.tipo === 'crear_presupuesto') {
      if (!CamposPres.dejar(CamposPres.NUEVO, propuesta.cambios, propuesta.extra)) {
        return Promise.reject(new Error('El navegador no dejó guardar los datos para pasarlos al formulario'));
      }
      window.open('../presupuesto/#/nuevo', '_blank');
      return Promise.resolve(
        'Se abrió el formulario de presupuesto nuevo en otra pestaña, con lo que dijo cargado y sin ' +
        'guardar. Falta que complete lo que quedó en amarillo, revise los totales y guarde. ' +
        'No afirmes que el presupuesto ya existe.');
    }

    if (propuesta.tipo === 'editar_presupuesto') {
      var id = propuesta.proyecto._id;
      if (!CamposPres.dejar(id, propuesta.cambios)) {
        return Promise.reject(new Error('El navegador no dejó guardar los cambios para pasarlos al formulario'));
      }
      window.open('../presupuesto/#/p/' + encodeURIComponent(id) + '/editar', '_blank');
      return Promise.resolve(
        'Se abrió el formulario del presupuesto de ' + propuesta.proyecto.nombre +
        ' en otra pestaña, con los cambios aplicados y sin guardar. El usuario tiene que ' +
        'revisar los totales y guardar desde ahí. No afirmes que ya está guardado.');
    }

    /* Las dos escrituras del cobro van en un batch dentro de Cobros. */
    if (propuesta.tipo === 'registrar_cobro') {
      return Cobros.registrar(db, {
        factura: propuesta.factura, facturaId: propuesta.facturaId,
        proyecto: propuesta.proyecto, calculo: propuesta.calculo, fecha: propuesta.fecha
      }).then(function () {
        return 'Listo, ' + propuesta.resumen + '. La factura quedó marcada como pagada.';
      });
    }

    if (propuesta.tipo !== 'registrar_gasto') {
      return Promise.reject(new Error('Propuesta desconocida'));
    }
    return Gastos.crear(db, propuesta.datos, propuesta.proyecto, yo).then(function (id) {
      return 'Listo, el gasto quedó guardado con el id ' + id + '. ' + propuesta.resumen + '.';
    });
  }

  var INSTRUCCIONES =
    '\n\n## Acciones\n' +
    'Además de responder, podés registrar gastos con la herramienta registrar_gasto.\n' +
    '- Nunca digas que algo quedó guardado: el usuario tiene que confirmarlo en pantalla primero.\n' +
    '- Si te falta un dato obligatorio, preguntáselo. No inventes montos, proyectos ni categorías.\n' +
    '- Si el usuario solo pregunta algo, respondé. Las herramientas son para cuando pide hacer algo.\n' +
    '- Con editar_presupuesto y crear_presupuesto no se guarda nada: se abre el formulario con los ' +
    'datos puestos y el usuario guarda desde ahí. Decilo así.\n' +
    '- preparar_factura tampoco emite nada: abre el formulario y el usuario guarda e imprime. ' +
    'Nunca inventes ni menciones un número de factura.';

  return {
    herramientas: herramientas, preparar: preparar, ejecutar: ejecutar,
    resolverProyecto: resolverProyecto, resolverFactura: resolverFactura,
    esCurso: esCurso, aNumero: aNumero,
    INSTRUCCIONES: INSTRUCCIONES, N: N
  };
})();
