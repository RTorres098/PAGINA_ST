/* Asistente — SoilTech
 *
 * Habla con la API de Claude desde el navegador. Normalmente eso no se puede:
 * la API corta los pedidos de un navegador salvo que se mande la cabecera
 * `anthropic-dangerous-direct-browser-access`. El nombre es una advertencia y
 * hay que tomarla en serio: la clave queda visible en la pestaña de red.
 *
 * Acá es aceptable porque es un panel de un solo dueño, con su propia clave,
 * guardada en un documento que solo él puede leer (ia/{uid}). Si algún día
 * entra otra persona al panel, esto tiene que pasar a un servidor.
 *
 * La clave NUNCA se escribe en el código ni se commitea: se carga desde la
 * pantalla de ajustes y vive en Firestore.
 */
var IA = (function () {

  var URL = 'https://api.anthropic.com/v1/messages';
  var VERSION = '2026-10-21';

  /* Haiku para extraer datos, que es barato y rápido; Sonnet para razonar
     sobre números y redactar. */
  var MODELOS = {
    rapido: 'claude-haiku-5-5',
    bueno: 'claude-sonnet-5-5'
  };

  var _clave = null, _uid = null, _workspace = null;

  function tieneClave() { return !!_clave; }
  /* Para mostrarla sin mostrarla. */
  function claveEnmascarada() {
    if (!_clave) return '';
    return _clave.slice(0, 7) + '…' + _clave.slice(-4);
  }

  function cargarClave(db, uid) {
    _uid = uid;
    return db.collection('ia').doc(uid).get().then(function (d) {
      var dd = (d.exists && d.data()) || {};
      _clave = dd.clave || null;
      _workspace = dd.workspace || null;
      return tieneClave();
    }, function () { _clave = null; _workspace = null; return false; });
  }

  /* `workspace` solo hace falta cuando la clave no está asignada a uno:
     en ese caso la API exige la cabecera anthropic-workspace-id. Si la clave
     ya pertenece a un workspace, se deja vacío. */
  function guardarClave(db, uid, clave, workspace) {
    clave = String(clave || '').trim();
    workspace = String(workspace || '').trim();
    if (!clave) return Promise.reject(new Error('Pegá la clave'));
    if (clave.indexOf('sk-ant-') !== 0) {
      return Promise.reject(new Error('Una clave de Anthropic empieza con sk-ant-'));
    }
    if (workspace && workspace.indexOf('wrkspc_') !== 0) {
      return Promise.reject(new Error('El id de workspace empieza con wrkspc_'));
    }
    /* merge: el documento también guarda las promociones; un set sin
       merge se las llevaría puestas al cambiar la clave. */
    return db.collection('ia').doc(uid).set({
      clave: clave, workspace: workspace || null, actualizado: new Date()
    }, { merge: true }).then(function () {
      _clave = clave; _workspace = workspace || null; _uid = uid; return true;
    });
  }

  function workspace() { return _workspace; }

  function borrarClave(db, uid) {
    return db.collection('ia').doc(uid).delete().then(function () { _clave = null; _workspace = null; });
  }

  /* Traduce lo que devuelve la API a algo que se entienda en pantalla. */
  function mensajeDeError(estado, cuerpo) {
    var detalle = (cuerpo && cuerpo.error && cuerpo.error.message) || '';
    if (estado === 401) return 'La clave no es válida o fue revocada';
    /* Lo específico antes que lo genérico: un 400 por workspace también es un
       400, y si se mira primero el código nunca se llega a explicarlo. */
    if (/workspace/i.test(detalle)) {
      return 'La clave no está asignada a un workspace. Poné el id del workspace en Ajustes, o creá una clave ya asignada a uno';
    }
    if (estado === 400 && /credit|balance/i.test(detalle)) return 'La cuenta de Anthropic no tiene saldo';
    if (estado === 400) return 'Pedido mal armado: ' + detalle;
    if (estado === 403) return 'La clave no tiene permiso para esto';
    if (estado === 429) return 'Demasiados pedidos seguidos. Esperá unos segundos';
    if (estado === 529) return 'La API está sobrecargada. Probá de nuevo en un momento';
    if (estado >= 500) return 'Falla del lado de Anthropic (' + estado + ')';
    return detalle || ('Error ' + estado);
  }

  /* El pedido en crudo. `opciones` acepta sistema, modelo, herramientas,
     maxTokens. Devuelve la respuesta completa de la API.
     No mandamos `temperature`: los modelos nuevos lo rechazan con
     "Extra inputs are not permitted". */
  function pedir(mensajes, opciones) {
    opciones = opciones || {};
    if (!_clave) return Promise.reject(new Error('Falta cargar la clave en Ajustes'));

    var cuerpo = {
      model: opciones.modelo || MODELOS.bueno,
      max_tokens: opciones.maxTokens || 2048,
      messages: mensajes
    };
    if (opciones.sistema) cuerpo.system = opciones.sistema;
    if (opciones.herramientas) cuerpo.tools = opciones.herramientas;

    var cabeceras = {
      'content-type': 'application/json',
      'x-api-key': _clave,
      'anthropic-version': VERSION,
      /* Sin esto el navegador ni siquiera llega: la API lo rechaza. */
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    /* Solo hace falta si la clave no pertenece a un workspace. */
    if (_workspace) cabeceras['anthropic-workspace-id'] = _workspace;

    return fetch(URL, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify(cuerpo)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(mensajeDeError(r.status, j));
        return j;
      });
    }, function (e) {
      /* fetch solo falla así cuando no hubo respuesta: sin red, o CORS. */
      throw new Error('No se pudo contactar a la API: ' + (e && e.message ? e.message : 'sin conexión'));
    });
  }

  /* El texto de la respuesta, juntando los bloques de texto y dejando afuera
     los de uso de herramientas. */
  function textoDe(respuesta) {
    var bloques = (respuesta && respuesta.content) || [];
    return bloques.filter(function (b) { return b.type === 'text'; })
      .map(function (b) { return b.text; }).join('').trim();
  }

  /* Las fuentes citadas, sin repetir, para poder mostrar de dónde salió cada
     cosa cuando se usó la búsqueda web. */
  function fuentesDe(respuesta) {
    var vistas = {}, out = [];
    ((respuesta && respuesta.content) || []).forEach(function (b) {
      if (b.type !== 'text' || !b.citations) return;
      b.citations.forEach(function (c) {
        if (!c.url || vistas[c.url]) return;
        vistas[c.url] = true;
        out.push({ url: c.url, titulo: c.title || c.url });
      });
    });
    return out;
  }

  /* Cuántos tokens y búsquedas costó, para poder mostrarlo. */
  function consumoDe(respuesta) {
    var u = (respuesta && respuesta.usage) || {};
    return {
      entrada: u.input_tokens || 0,
      salida: u.output_tokens || 0,
      busquedas: (u.server_tool_use && u.server_tool_use.web_search_requests) || 0
    };
  }

  /* Atajo para una pregunta suelta: devuelve solo el texto. */
  function preguntar(texto, opciones) {
    return pedir([{ role: 'user', content: texto }], opciones).then(textoDe);
  }

  /* La herramienta de búsqueda web, limitada a los dominios que se le pasen.
     Sin esa lista traería resultados de cualquier lado. */
  function herramientaBusqueda(dominios, maxBusquedas) {
    var h = {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: maxBusquedas || 5,
      user_location: {
        type: 'approximate',
        city: 'Asunción',
        country: 'PY',
        timezone: 'America/Asuncion'
      }
    };
    if (dominios && dominios.length) h.allowed_domains = dominios;
    return h;
  }

  return {
    MODELOS: MODELOS,
    tieneClave: tieneClave, claveEnmascarada: claveEnmascarada,
    cargarClave: cargarClave, guardarClave: guardarClave, borrarClave: borrarClave,
    workspace: workspace,
    pedir: pedir, preguntar: preguntar,
    textoDe: textoDe, fuentesDe: fuentesDe, consumoDe: consumoDe,
    herramientaBusqueda: herramientaBusqueda,
    mensajeDeError: mensajeDeError
  };
})();
