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
    }];
  }

  /* Los que son porcentaje: un 150% de anticipo no es un typo que convenga
     dejar pasar hasta el formulario. */
  var PORCENTAJES = ['pImp', 'pRet', 'pAnt', 'pctMargen', 'pesoPrep', 'pesoLab', 'pesoInf'];

  function prepararPresupuesto(args, ctx) {
    var r = resolverProyecto(args.proyecto, ctx.proyectos);
    if (r.error) return { error: r.error };
    var p = r.proyecto;

    var cambios = args.cambios || [];
    if (!cambios.length) return { error: 'No dijiste qué cambiar. Preguntale al usuario.' };
    if (cambios.length > 12) return { error: 'Son demasiados cambios de una vez. Hacelo por partes.' };

    var validos = CamposPres.editables(), vistos = {}, limpios = [], filas = [];
    var actuales = (p.presupuesto && p.presupuesto.form && p.presupuesto.form.campos) || {};

    for (var i = 0; i < cambios.length; i++) {
      var c = cambios[i] || {}, campo = c.campo;
      if (validos.indexOf(campo) < 0) {
        return { error: '"' + campo + '" no es un campo del formulario. Los que se pueden cambiar son: ' +
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

      var antes = actuales[campo];
      limpios.push({ campo: campo, valor: valor });
      filas.push({
        k: CamposPres.etiqueta(campo),
        v: (antes === undefined || antes === '' ? '(vacío)' : antes) + '  →  ' + valor
      });
    }

    return {
      propuesta: {
        tipo: 'editar_presupuesto',
        titulo: 'Cambiar el presupuesto de ' + p.nombre,
        verbo: 'Abrir el presupuesto con los cambios',
        filas: filas,
        cambios: limpios,
        proyecto: p,
        resumen: limpios.length + (limpios.length === 1 ? ' cambio' : ' cambios') + ' en ' + p.nombre
      }
    };
  }

  /* ── Preparar: valida y arma la propuesta, sin tocar la base ── */
  function preparar(nombre, args, ctx) {
    args = args || {};
    if (nombre === 'editar_presupuesto') return prepararPresupuesto(args, ctx);
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
    '- Con editar_presupuesto no se guarda nada: se abre el formulario con los cambios puestos y ' +
    'el usuario guarda desde ahí. Decilo así.';

  return {
    herramientas: herramientas, preparar: preparar, ejecutar: ejecutar,
    resolverProyecto: resolverProyecto, esCurso: esCurso, aNumero: aNumero,
    INSTRUCCIONES: INSTRUCCIONES, N: N
  };
})();
