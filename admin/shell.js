/* SoilTech Admin — arma la barra lateral y convierte la barra superior de cada página.
 *
 * Cómo se usa en una página:
 *   <link rel="stylesheet" href="../shell.css">
 *   ... el <header class="st-top"> de siempre, con su .st-brand, .st-nav y .st-right ...
 *   <script src="../shell.js"></script>          (después del header)
 *   y dentro del callback de initAuthGuard:  STShell.usuario(data, rol, user);
 *
 * Qué hace:
 *   · Mete la barra lateral (la misma en todas las páginas) y recuerda si está colapsada.
 *   · Al <header class="st-top"> le saca el logo y los enlaces (ya están en la barra lateral),
 *     le pone el botón de menú y el título, y deja los botones de la página a la derecha.
 *   · Los botones secundarios (.st-btn-ghost) se agrupan en un menú «···».
 */
var STShell = (function () {
  var LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M3 7c3-2 6 2 9 0s6-2 9 0"/><path d="M3 12c3-2 6 2 9 0s6-2 9 0"/><path d="M3 17c3-2 6 2 9 0s6-2 9 0"/></svg>';

  var IC = {
    inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/><path d="M9.5 21v-6h5v6"/>',
    balance: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    presu: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    factu: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h3"/>',
    clien: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    ajustes: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.63.67 1.1 1.31 1.1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    sitio: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>'
  };

  function svg(d, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) + '" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ../ desde una subcarpeta, ./ desde /admin/ */
  function base() { return /\/(presupuesto|facturacion|clientes|servicios)\//.test(location.pathname) ? '../' : './'; }

  /* Qué página es, para marcar el ítem activo */
  function actual() {
    var p = location.pathname;
    if (/\/presupuesto\//.test(p)) return location.hash.indexOf('balance') >= 0 ? 'balance' : 'presupuestos';
    if (/\/facturacion\//.test(p)) return 'facturacion';
    if (/\/clientes\//.test(p)) return 'clientes';
    if (/\/servicios\//.test(p)) return 'servicios';
    return 'inicio';
  }

  function itemsNav() {
    var b = base();
    return [
      { g: 'Panel' },
      { k: 'inicio', t: 'Inicio', h: b, i: IC.inicio },
      { k: 'balance', t: 'Balance', h: b + 'presupuesto/#/balance', i: IC.balance },
      { g: 'Operación' },
      { k: 'presupuestos', t: 'Presupuestos', h: b + 'presupuesto/', i: IC.presu },
      { k: 'facturacion', t: 'Facturación', h: b + 'facturacion/', i: IC.factu },
      { k: 'clientes', t: 'Clientes', h: b + 'clientes/', i: IC.clien },
      { g: 'Ajustes' },
      { k: 'servicios', t: 'Servicios', h: b + 'servicios/', i: IC.ajustes },
      { g: 'Crear' },
      { k: 'n-pres', t: 'Nuevo presupuesto', h: b + 'presupuesto/#/nuevo', i: IC.mas },
      { k: 'n-fact', t: 'Nueva factura', h: b + 'facturacion/#nueva', i: IC.mas },
      { k: 'n-cli', t: 'Nuevo cliente', h: b + 'clientes/#nuevo', i: IC.mas }
    ];
  }

  function htmlSidebar() {
    var b = base(), act = actual();
    var nav = itemsNav().map(function (x) {
      if (x.g) return '<div class="sh-grp">' + x.g + '</div>';
      return '<a class="' + (x.k === act ? 'on' : '') + '" href="' + x.h + '" title="' + esc(x.t) + '">' +
        svg(x.i) + '<span class="lb">' + esc(x.t) + '</span></a>';
    }).join('');
    return '<div class="sh-scrim" id="shScrim"></div>' +
      '<aside class="sh-side">' +
      '<a class="sh-logo" href="' + b + '"><span class="mk">' + LOGO + '</span><span class="tt">SoilTech<small>Admin</small></span></a>' +
      '<nav class="sh-nav">' + nav + '</nav>' +
      '<div class="sh-foot"><a href="/" title="Ver el sitio">' + svg(IC.sitio) + '<span class="lb">Ver el sitio</span></a></div>' +
      '</aside>';
  }

  var TITULOS = { inicio: 'Inicio', balance: 'Balance', presupuestos: 'Presupuestos', facturacion: 'Facturación', clientes: 'Clientes', servicios: 'Servicios' };

  /* Convierte el <header class="st-top"> de la página en la barra superior clara. */
  function armarTopbar() {
    var top = document.querySelector('.st-top');
    if (!top) return;
    var derecha = top.querySelector('.st-right');
    var marca = top.querySelector('.st-brand');
    var nav = top.querySelector('.st-nav');
    if (marca) marca.remove();
    if (nav) nav.remove();

    var burg = document.createElement('button');
    burg.className = 'sh-burg';
    burg.title = 'Contraer o expandir el menú';
    burg.setAttribute('aria-label', 'Menú');
    burg.innerHTML = svg('<path d="M4 7h16M4 12h16M4 17h10"/>', 2);
    burg.onclick = alternar;

    var titulo = document.createElement('div');
    titulo.className = 'sh-title';
    titulo.textContent = TITULOS[actual()] || 'Admin';

    top.classList.remove('st-top');
    top.classList.add('sh-top');
    top.insertBefore(titulo, top.firstChild);
    top.insertBefore(burg, top.firstChild);

    /* Los botones de la página van a la derecha; los secundarios, a un menú «···» */
    var tools = document.createElement('div');
    tools.className = 'sh-tools';
    if (derecha) {
      var ghosts = Array.prototype.slice.call(derecha.querySelectorAll('.st-btn-ghost'));
      if (ghosts.length > 1) {
        var pop = document.createElement('div');
        pop.className = 'sh-pop';
        pop.id = 'shPopMas';
        pop.innerHTML = '<h4>Más acciones</h4>';
        var guardados = document.createElement('div');
        guardados.className = 'sh-guardados';
        guardados.style.display = 'none';
        ghosts.forEach(function (b) {
          var it = document.createElement('button');
          it.className = 'it';
          it.textContent = (b.textContent || '').trim();
          it.title = b.title || '';
          it.onclick = function () { pop.classList.remove('show'); b.click(); };
          it.setAttribute('data-espejo', b.id || '');
          it._fuente = b;                 // para saber si la página lo mostró u ocultó
          pop.appendChild(it);
          guardados.appendChild(b);       // se mueve, NO se borra: getElementById lo sigue encontrando
        });
        pop.appendChild(guardados);
        var mas = document.createElement('button');
        mas.className = 'sh-ico';
        mas.title = 'Más acciones';
        mas.innerHTML = svg('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>', 2);
        mas.onclick = function (e) {
          var its = pop.querySelectorAll('.it');
          for (var k = 0; k < its.length; k++) {
            var f = its[k]._fuente;
            if (f) its[k].style.display = (f.style.display === 'none') ? 'none' : '';
          }
          abrirPop('shPopMas'); e.stopPropagation();
        };
        tools.appendChild(mas);
        tools.appendChild(pop);
      }
      /* lo que quede visible (el botón principal) se mueve tal cual */
      Array.prototype.slice.call(derecha.children).forEach(function (b) {
        tools.appendChild(b);
      });
      derecha.remove();
    }

    var usr = document.createElement('button');
    usr.className = 'sh-user';
    usr.id = 'shUser';
    usr.innerHTML = '<span class="av" id="shAv">··</span><span class="nm" id="shNm">Cuenta<small id="shRol"></small></span>';
    usr.onclick = function (e) { abrirPop('shPopUser'); e.stopPropagation(); };
    tools.appendChild(usr);

    var popU = document.createElement('div');
    popU.className = 'sh-pop';
    popU.id = 'shPopUser';
    popU.innerHTML = '<h4 id="shMail">—</h4>' +
      '<a class="it" href="' + base() + '">' + svg(IC.inicio, 2) + 'Ir al inicio</a>' +
      '<a class="it" href="/">' + svg(IC.sitio, 2) + 'Ver el sitio</a>' +
      '<div class="sep"></div>' +
      '<button class="it dg" id="shSalir">' + svg(IC.salir, 2) + 'Cerrar sesión</button>';
    tools.appendChild(popU);
    top.appendChild(tools);

    var salir = popU.querySelector('#shSalir');
    salir.onclick = function () {
      if (typeof firebase !== 'undefined' && firebase.auth) firebase.auth().signOut();
      location.href = base();
    };
  }

  function abrirPop(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var abierto = el.classList.contains('show');
    var pops = document.querySelectorAll('.sh-pop');
    for (var i = 0; i < pops.length; i++) pops[i].classList.remove('show');
    if (!abierto) el.classList.add('show');
  }

  function alternar() {
    var b = document.body;
    if (window.matchMedia('(max-width:900px)').matches) {
      b.classList.toggle('sh-open');
      var s = document.getElementById('shScrim');
      if (s) s.classList.toggle('show', b.classList.contains('sh-open'));
      return;
    }
    b.classList.toggle('sh-col');
    try { localStorage.setItem('stSideCol', b.classList.contains('sh-col') ? '1' : '0'); } catch (e) {}
  }

  function cerrarCajon() {
    document.body.classList.remove('sh-open');
    var s = document.getElementById('shScrim');
    if (s) s.classList.remove('show');
  }

  /* Deja el contenido de la página dentro de .sh-main, al lado de la barra lateral. */
  function envolver() {
    var b = document.body;
    var main = document.createElement('div');
    main.className = 'sh-main';
    var hijos = Array.prototype.slice.call(b.children);
    hijos.forEach(function (n) {
      if (n.tagName === 'SCRIPT' || n.tagName === 'ASIDE' || n.id === 'shScrim' || n.id === 'authOverlay') return;
      main.appendChild(n);
    });
    b.appendChild(main);
  }

  function montar() {
    var b = document.body;
    if (b.classList.contains('sh-page')) return;
    b.classList.add('sh-page');
    try { if (localStorage.getItem('stSideCol') === '1') b.classList.add('sh-col'); } catch (e) {}

    envolver();
    b.insertAdjacentHTML('afterbegin', htmlSidebar());
    var s = document.getElementById('shScrim');
    if (s) s.onclick = cerrarCajon;
    armarTopbar();

    document.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('.sh-tools')) {
        var pops = document.querySelectorAll('.sh-pop');
        for (var i = 0; i < pops.length; i++) pops[i].classList.remove('show');
      }
    });
    /* en Presupuestos el ítem activo cambia con el hash (Balance) */
    window.addEventListener('hashchange', marcarActivo);
  }

  function marcarActivo() {
    var act = actual(), b = base();
    var mapa = { inicio: b, balance: b + 'presupuesto/#/balance', presupuestos: b + 'presupuesto/', facturacion: b + 'facturacion/', clientes: b + 'clientes/', servicios: b + 'servicios/' };
    var links = document.querySelectorAll('.sh-nav a');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle('on', links[i].getAttribute('href') === mapa[act]);
    }
    var t = document.querySelector('.sh-title');
    if (t) t.textContent = TITULOS[act] || 'Admin';
  }

  /* La llama cada página desde initAuthGuard. */
  function usuario(data, rol, user) {
    data = data || {};
    var nombre = data.nombre || '';
    var mail = (user && user.email) || '';
    var av = document.getElementById('shAv');
    var nm = document.getElementById('shNm');
    var ml = document.getElementById('shMail');
    if (av) av.textContent = (nombre || mail || '?').trim().split(/\s+/).slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase();
    if (nm) nm.innerHTML = esc(nombre.split(' ')[0] || 'Cuenta') + '<small>' + (rol === 'super_admin' ? 'Super Admin' : 'Administrador') + '</small>';
    if (ml) ml.textContent = mail;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();

  return { montar: montar, usuario: usuario, alternar: alternar, marcarActivo: marcarActivo };
})();
