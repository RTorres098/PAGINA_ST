/* Pasarle datos a otra pantalla — SoilTech
 *
 * El asistente no escribe presupuestos ni facturas: deja los datos acá,
 * abre la pantalla que corresponde y esa pantalla los aplica a su propio
 * formulario. Así el cálculo y la numeración siguen siendo de una sola
 * versión, la que ya estaba andando.
 *
 * Dos reglas: se consume una sola vez y vence. Un traspaso que quede
 * dando vueltas aparece la semana que viene en el formulario equivocado.
 */
var Traspaso = (function () {

  var PREFIJO = 'stTraspaso:';
  var VENCE = 5 * 60 * 1000;

  function dejar(llave, datos) {
    try {
      localStorage.setItem(PREFIJO + llave, JSON.stringify({ datos: datos, cuando: Date.now() }));
      return true;
    } catch (e) { return false; }
  }

  function tomar(llave) {
    var crudo;
    try { crudo = localStorage.getItem(PREFIJO + llave); } catch (e) { return null; }
    if (!crudo) return null;
    try { localStorage.removeItem(PREFIJO + llave); } catch (e) {}
    var d;
    try { d = JSON.parse(crudo); } catch (e) { return null; }
    if (!d || !d.cuando || Date.now() - d.cuando > VENCE) return null;
    return d.datos || null;
  }

  function limpiar(llave) {
    try { localStorage.removeItem(PREFIJO + llave); } catch (e) {}
  }

  return { dejar: dejar, tomar: tomar, limpiar: limpiar, PREFIJO: PREFIJO, VENCE: VENCE };
})();
