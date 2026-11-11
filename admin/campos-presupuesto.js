/* Campos del formulario de presupuesto — SoilTech
 *
 * Vive afuera de presupuesto/index.html porque lo usan dos pantallas: el
 * formulario y el asistente. Mientras estaba adentro, darle los nombres de
 * los campos al asistente significaba copiarlos, y dos copias de una lista
 * se separan sin que nadie se entere.
 *
 * Acá van listas y etiquetas, nunca cálculo. El cálculo sigue siendo de
 * calc(), que lee el formulario: es la única versión que existe.
 */
var CamposPres = (function () {

  /* Los campos simples del formulario, en el orden en que aparecen. */
  var CAMPOS = ['proyNombre', 'cliSel', 'cliContacto', 'tipoServicio', 'proyUbi', 'superficie',
    'cotizacion', 'pImp', 'pRet', 'pAnt',
    'calicatas', 'mpc', 'barrenadas', 'mpb',
    'nVehiculos', 'diasCampo', 'diasTotal', 'distKm', 'nViajes', 'consumo', 'pComb', 'cAlq', 'personas', 'cCons', 'cHosp',
    'pesoPrep', 'pesoLab', 'pesoInf', 'pctMargen', 'montoSolicitar'];

  /* Los que conviene no dejar vacíos: el formulario los marca en amarillo.
     Agregar algo acá cambia esa marca, así que no es una lista de etiquetas. */
  var REQ = {
    proyNombre: 'Nombre del proyecto', cliSel: 'Cliente', tipoServicio: 'Tipo de servicio', proyUbi: 'Ubicación', superficie: 'Superficie (ha)',
    cotizacion: 'Cotización Gs/USD', pImp: 'Imprevisto (%)', pRet: 'Retención IVA (%)', pAnt: 'Anticipo (%)',
    calicatas: 'Nº calicatas', mpc: 'Muestras/calicata', barrenadas: 'Nº barrenadas', mpb: 'Muestras/barrenada',
    nVehiculos: 'Nº vehículos', diasCampo: 'Días de campo', diasTotal: 'Días totales', distKm: 'Km ida+vuelta', nViajes: 'Nº viajes',
    consumo: 'Consumo L/100km', pComb: 'Precio combustible', cAlq: 'Alquiler/día', personas: 'Personas en campo', cCons: 'Viático/pers/día', cHosp: 'Hospedaje/pers/día',
    pctMargen: 'Margen SoilTech (%)'
  };
  var OBLIG = ['proyNombre', 'cliSel', 'cotizacion'];

  /* Los que REQ no nombra, solo para mostrarlos. Separados a propósito. */
  var OTRAS = {
    cliContacto: 'Contacto del cliente',
    pesoPrep: 'Peso preparación (%)', pesoLab: 'Peso laboratorio (%)', pesoInf: 'Peso informe (%)',
    montoSolicitar: 'Monto a solicitar (USD)'
  };

  function etiqueta(id) { return REQ[id] || OTRAS[id] || id; }

  /* Textos, no números: el nombre, la ubicación y el tipo de servicio. */
  var TEXTO = ['proyNombre', 'proyUbi', 'tipoServicio', 'cliContacto'];
  function esTexto(id) { return TEXTO.indexOf(id) >= 0; }

  /* Lo que el asistente puede proponer. Queda afuera el cliente: es un
     select de ids, y elegir el cliente equivocado en un presupuesto es
     peor que no poder cambiarlo desde el chat. */
  function editables() { return CAMPOS.filter(function (c) { return c !== 'cliSel'; }); }

  /* ── El traspaso al formulario ──
     El asistente no escribe el presupuesto: deja los cambios acá y abre el
     formulario, que los aplica y recalcula con calc(). Así hay una sola
     versión del cálculo, y vos ves los totales antes de guardar.
     Se consume una sola vez y vence, para que un cambio viejo no aparezca
     la semana que viene en otro presupuesto. */
  var LLAVE = 'presupuesto';
  var NUEVO = 'nuevo';   // el id que usa un presupuesto que todavía no existe

  function dejar(proyectoId, cambios, extra) {
    return Traspaso.dejar(LLAVE, { proyectoId: proyectoId, cambios: cambios, extra: extra || null });
  }

  function tomar(proyectoId) {
    var d = Traspaso.tomar(LLAVE);
    if (!d || d.proyectoId !== proyectoId) return null;
    return { cambios: d.cambios || [], extra: d.extra || {} };
  }

  return {
    CAMPOS: CAMPOS, REQ: REQ, OBLIG: OBLIG, OTRAS: OTRAS,
    etiqueta: etiqueta, esTexto: esTexto, editables: editables,
    dejar: dejar, tomar: tomar, LLAVE: LLAVE, NUEVO: NUEVO
  };
})();
