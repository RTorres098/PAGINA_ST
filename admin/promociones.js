/* Promociones de tus bancos — SoilTech
 *
 * Los bancos paraguayos no publican una API de promociones, y el
 * navegador no puede leer sus páginas directamente porque CORS lo
 * bloquea. El único camino es la búsqueda web de la API de Anthropic,
 * que corre del lado del servidor y devuelve el texto con sus fuentes.
 *
 * Dos cosas que gobiernan este archivo:
 *
 *  1. La búsqueda va limitada a los dominios de TUS bancos. Sin esa
 *     lista traería promociones de cualquier banco de la región, que no
 *     te sirven de nada.
 *  2. Cada búsqueda cuesta, y bastante más que una pregunta sobre tus
 *     datos: son varias búsquedas web más el texto de las páginas. Por
 *     eso el resultado se guarda y la pantalla lo muestra con su fecha,
 *     en vez de buscar cada vez que entrás.
 */
var Promos = (function () {

  var HORAS_FRESCO = 12;          // debajo de esto no vale la pena volver a buscar
  var MAX_BUSQUEDAS = 6;

  function horasDesde(cuando) {
    if (!cuando) return Infinity;
    var t = cuando.toMillis ? cuando.toMillis() : (cuando.seconds ? cuando.seconds * 1000 : +new Date(cuando));
    if (!t || isNaN(t)) return Infinity;
    return (Date.now() - t) / 3600000;
  }

  function fresco(guardado) { return !!guardado && horasDesde(guardado.cuando) < HORAS_FRESCO; }

  function hace(cuando) {
    var h = horasDesde(cuando);
    if (h === Infinity) return '';
    if (h < 1) {
      var m = Math.max(1, Math.round(h * 60));
      return 'hace ' + m + (m === 1 ? ' minuto' : ' minutos');
    }
    if (h < 24) return 'hace ' + Math.round(h) + (Math.round(h) === 1 ? ' hora' : ' horas');
    var d = Math.round(h / 24);
    return 'hace ' + d + (d === 1 ? ' día' : ' días');
  }

  /* Qué le pedimos. Lo importante: que no rellene. Una promoción
     inventada te hace ir a un local a pedir un descuento que no existe. */
  function instrucciones(bancos, tarjetas) {
    var hoy = new Date();
    var meses = ['enero','febrero','marzo','abril','mayo','junio','julio',
                 'agosto','septiembre','octubre','noviembre','diciembre'];
    return 'Sos el asistente de SoilTech, en Paraguay. Buscá las promociones VIGENTES de estos bancos ' +
      'en sus sitios oficiales:\n' +
      bancos.map(function (b) { return '- ' + b.nombre + ' (' + (b.dominio || 'sin sitio') + ')'; }).join('\n') +
      '\n\nLas tarjetas que usa:\n' +
      (tarjetas.length ? tarjetas.map(function (t) {
        return '- ' + t.nombre + ' ' + t.marca + ', de ' + (t.banco === 'itau' ? 'Itaú' : t.banco);
      }).join('\n') : '- Solo débito') +
      '\n\nHoy es ' + hoy.getDate() + ' de ' + meses[hoy.getMonth()] + ' de ' + hoy.getFullYear() + '.\n\n' +
      'Reglas:\n' +
      '- Agrupá por banco, con un título ## por banco.\n' +
      '- Por cada promoción poné en una lista: el comercio o rubro, el beneficio (descuento o cuotas), ' +
      'con qué tarjeta aplica y hasta cuándo.\n' +
      '- Si una promoción no aplica a ninguna de sus tarjetas ni al débito, no la pongas.\n' +
      '- Si de un banco no encontraste nada, escribí bajo su título "No encontré promociones vigentes ' +
      'publicadas" y nada más. No rellenes.\n' +
      '- No inventes fechas, comercios ni porcentajes. Si una promoción no dice hasta cuándo, poné ' +
      '"sin fecha de fin publicada".\n' +
      '- Si algo parece vencido por la fecha de hoy, no lo incluyas.\n' +
      '- Nada de introducciones ni cierres: arrancá con el primer título.';
  }

  function pregunta(bancos) {
    return 'Buscá y listá las promociones vigentes de ' +
      bancos.map(function (b) { return b.nombre; }).join(', ') + '.';
  }

  /* Busca de verdad. Devuelve {texto, fuentes, consumo}. */
  function buscar() {
    var bancos = Bancos.mios();
    if (!bancos.length) {
      return Promise.reject(new Error('No hay ningún banco marcado como tuyo en la lista de bancos'));
    }
    var dominios = Bancos.dominiosMios();
    if (!dominios.length) {
      return Promise.reject(new Error('Tus bancos no tienen cargado el sitio web, así que la búsqueda ' +
                                      'traería promociones de cualquier lado'));
    }
    var tarjetas = Bancos.tarjetasMias();
    return IA.pedir([{ role: 'user', content: pregunta(bancos) }], {
      sistema: instrucciones(bancos, tarjetas),
      modelo: IA.MODELOS.bueno,
      maxTokens: 2500,
      herramientas: [IA.herramientaBusqueda(dominios, MAX_BUSQUEDAS)]
    }).then(function (r) {
      var texto = IA.textoDe(r);
      if (!texto) throw new Error('La búsqueda no devolvió nada. Probá de nuevo en un rato.');
      return { texto: texto, fuentes: IA.fuentesDe(r), consumo: IA.consumoDe(r) };
    });
  }

  /* Se guarda junto a la clave, en el documento del usuario: así no hace
     falta tocar las reglas de Firestore para una colección nueva. */
  function guardar(db, uid, res) {
    return db.collection('ia').doc(uid).set({
      promos: {
        texto: res.texto,
        fuentes: res.fuentes || [],
        busquedas: (res.consumo && res.consumo.busquedas) || 0,
        cuando: new Date()
      }
    }, { merge: true }).then(function () { return res; });
  }

  function leer(db, uid) {
    return db.collection('ia').doc(uid).get().then(function (d) {
      var dd = (d.exists && d.data()) || {};
      return dd.promos || null;
    }, function () { return null; });
  }

  /* Lo que usa la pantalla: devuelve lo guardado si está fresco, y si no
     busca. `forzar` saltea la frescura. */
  function obtener(db, uid, forzar) {
    return leer(db, uid).then(function (guardado) {
      if (!forzar && fresco(guardado)) return { promos: guardado, deCache: true };
      return buscar().then(function (res) {
        return guardar(db, uid, res).then(function () {
          return leer(db, uid).then(function (g) { return { promos: g, deCache: false }; });
        });
      }).catch(function (e) {
        /* Si la búsqueda falla pero hay algo viejo guardado, mejor mostrarlo
           con su fecha que dejar la pantalla en blanco. */
        if (guardado) return { promos: guardado, deCache: true, error: e.message };
        throw e;
      });
    });
  }

  return {
    HORAS_FRESCO: HORAS_FRESCO, horasDesde: horasDesde, fresco: fresco, hace: hace,
    instrucciones: instrucciones, pregunta: pregunta,
    buscar: buscar, guardar: guardar, leer: leer, obtener: obtener
  };
})();
