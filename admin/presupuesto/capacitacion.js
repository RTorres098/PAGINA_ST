
/* ═══════════════════════════════════════ */
/*  CAPACITACIONES — presupuesto de cursos */
/* ═══════════════════════════════════════ */
/* Un curso no se presupuesta como un estudio de suelo: no hay calicatas ni
   laboratorio, hay disertantes, sala, difusión y plataformas. Y la plata puede
   entrar por cupos (precio × inscriptos) o por un monto cerrado que paga una
   institución. Todo eso vive en p.capacitacion, aparte de p.presupuesto. */

var CAP_COSTOS=[
  {k:'salon',   n:'Salón / sede',            ico:'🏛'},
  {k:'public',  n:'Publicidad y difusión',   ico:'📣'},
  {k:'plat',    n:'Plataformas y licencias', ico:'💻'},
  {k:'mat',     n:'Materiales y certificados',ico:'📄'},
  {k:'coffee',  n:'Coffee break y catering', ico:'☕'},
  {k:'viat',    n:'Viáticos del disertante', ico:'✈'},
  {k:'otros',   n:'Otros costos',            ico:'➕'}
];

function capVacio(){
  return {modo:'cupos',moneda:'Gs',cot:0,precioCupo:0,precioSocio:0,cupos:0,cuposMin:0,montoCerrado:0,
    comisionPct:0,disertantes:[{nombre:'',rol:'',monto:0}],
    costos:{salon:0,public:0,plat:0,mat:0,coffee:0,viat:0,otros:0},
    modalidad:'Presencial',horas:0,fechaIni:'',fechaFin:'',lugar:''};
}
function capDe(p){
  var c=Object.assign(capVacio(),(p&&p.capacitacion)||{});
  c.costos=Object.assign(capVacio().costos,c.costos||{});
  if(!c.disertantes||!c.disertantes.length)c.disertantes=[{nombre:'',rol:'',monto:0}];
  return c;
}

/* ── números del curso ── */
function capCalc(c){
  var dis=(c.disertantes||[]).reduce(function(s,d){return s+(+d.monto||0)},0);
  var otros=CAP_COSTOS.reduce(function(s,x){return s+(+((c.costos||{})[x.k])||0)},0);
  var ingresoBruto=c.modo==='cupos'?(+c.precioCupo||0)*(+c.cupos||0):(+c.montoCerrado||0);
  var comision=ingresoBruto*((+c.comisionPct||0)/100);
  var costoTotal=dis+otros+comision;
  var utilidad=ingresoBruto-costoTotal;
  var margen=ingresoBruto>0?utilidad/ingresoBruto:0;
  /* Punto de equilibrio: cuántos cupos cubren los costos que no dependen del cupo */
  var fijos=dis+otros;
  var aporteCupo=(+c.precioCupo||0)*(1-((+c.comisionPct||0)/100));
  var equilibrio=(c.modo==='cupos'&&aporteCupo>0)?Math.ceil(fijos/aporteCupo):null;
  return {dis:dis,otros:otros,comision:comision,costoTotal:costoTotal,ingresoBruto:ingresoBruto,
    utilidad:utilidad,margen:margen,equilibrio:equilibrio,
    costoPorCupo:(c.modo==='cupos'&&+c.cupos>0)?costoTotal/(+c.cupos):null};
}
function capMon(c){return c.moneda==='USD'?'USD':'Gs'}
function capFmt(c,v){return c.moneda==='USD'?('USD '+fmtUsd(v||0)):('₲ '+fmtGs(Math.round(v||0)))}
/* Valor del curso llevado a USD, para que la lista y los KPIs sigan comparando peras con peras */
function capUsd(c){
  var r=capCalc(c);
  if(c.moneda==='USD')return r.ingresoBruto;
  var cot=+c.cot||0;
  return cot>0?r.ingresoBruto/cot:0;
}

/* ── elegir el tipo antes de arrancar ── */
function elegirTipoProyecto(clienteId){
  var q=clienteId?('/c/'+encodeURIComponent(clienteId)):'';
  document.getElementById('tipoProyBody').innerHTML=
    '<div class="tp-op" onclick="nav(\'#/nuevo'+q+'\')">'+
      '<div class="tp-ico">🌱</div><div><div class="tp-t">Estudio de suelo</div>'+
      '<div class="tp-d">Calicatas, barrenadas, laboratorio, informes y cartografía. El formulario completo de siempre.</div></div></div>'+
    '<div class="tp-op" onclick="nav(\'#/nuevo/cap'+q+'\')">'+
      '<div class="tp-ico">🎓</div><div><div class="tp-t">Capacitación</div>'+
      '<div class="tp-d">Cursos y talleres: disertantes, salón, publicidad y plataformas. Por cupos o contratado.</div></div></div>';
  showModal('tipoProyModal');
}

/* ── formulario ── */
var CAPST=null;
function renderCapForm(id,clienteId){
  var p=id?findProj(id):null;
  if(id&&!p){noEncontrado();return;}
  editingId=id||null;
  CAPST=capDe(p);
  CAPST._nombre=p?(p.nombre||''):'';
  CAPST._cliente=p?(p.cliente||''):'';
  if(!id&&clienteId){var cl=CLIS.find(function(x){return x.id===clienteId});if(cl)CAPST._cliente=cl.nombre||''}
  document.title=(id?'Editar ':'Nueva ')+'capacitación — SoilTech';
  document.getElementById('rpTitle').textContent=id?('Editando: '+(p.nombre||'')):'Nueva capacitación';
  renderFormCrumbs(id?(p.nombre||'Sin nombre'):'Nueva capacitación',!!id,true);
  document.getElementById('formNote').innerHTML='<div class="form-note info">Presupuesto de curso: cargá lo que vas a cobrar y lo que te va a costar. El sistema calcula margen, utilidad y —si vendés por cupos— cuántos inscriptos necesitás para no perder plata.</div>';
  showPanel('panelForm');
  pintarCapForm();
  formDirty=false;
}

function pintarCapForm(){
  var c=CAPST,h='';
  h+='<div class="sec">🎓 Datos del curso</div>';
  h+='<div class="g2"><div class="f"><label>Nombre del curso</label><input id="cpNombre" value="'+esc(c._nombre||'')+'" oninput="capTouch()" placeholder="Ej.: QGIS aplicado a suelos"></div>'+
     '<div class="f"><label>Cliente / organizador</label><input id="cpCliente" list="cpCliList" value="'+esc(c._cliente||'')+'" oninput="capTouch()" placeholder="Abierto al público o institución">'+
     '<datalist id="cpCliList">'+CLIS.map(function(x){return '<option value="'+esc(x.nombre||'')+'">'}).join('')+'</datalist></div></div>';
  h+='<div class="g4"><div class="f"><label>Modalidad</label><select id="cpModalidad" onchange="capTouch()">'+
     ['Presencial','Virtual','Híbrido'].map(function(m){return '<option'+(c.modalidad===m?' selected':'')+'>'+m+'</option>'}).join('')+'</select></div>'+
     '<div class="f"><label>Horas</label><input id="cpHoras" type="number" value="'+(c.horas||'')+'" oninput="capTouch()"></div>'+
     '<div class="f"><label>Desde</label><input id="cpIni" type="date" value="'+(c.fechaIni||'')+'" oninput="capTouch()"></div>'+
     '<div class="f"><label>Hasta</label><input id="cpFin" type="date" value="'+(c.fechaFin||'')+'" oninput="capTouch()"></div></div>';
  h+='<div class="f"><label>Lugar o plataforma</label><input id="cpLugar" value="'+esc(c.lugar||'')+'" oninput="capTouch()" placeholder="Ej.: Hotel Guaraní / Zoom"></div>';

  /* ingresos */
  h+='<div class="sec">💵 Lo que se cobra</div>';
  h+='<div class="g3"><div class="f"><label>Forma de venta</label><select id="cpModo" onchange="capLeer();pintarCapForm()">'+
     '<option value="cupos"'+(c.modo==='cupos'?' selected':'')+'>Por cupos (abierto)</option>'+
     '<option value="cerrado"'+(c.modo==='cerrado'?' selected':'')+'>Monto cerrado (contratado)</option></select></div>'+
     '<div class="f"><label>Moneda</label><select id="cpMoneda" onchange="capLeer();pintarCapForm()">'+
     '<option'+(c.moneda==='Gs'?' selected':'')+'>Gs</option><option'+(c.moneda==='USD'?' selected':'')+'>USD</option></select></div>'+
     '<div class="f"><label>Cotización (₲/USD)</label><input id="cpCot" type="number" value="'+(c.cot||'')+'" oninput="capTouch()" '+(c.moneda==='USD'?'disabled title="Solo hace falta si cobrás en guaraníes"':'')+'></div></div>';
  if(c.modo==='cupos'){
    h+='<div class="g4"><div class="f"><label>Precio particular</label><input id="cpPrecio" type="number" value="'+(c.precioCupo||'')+'" oninput="capTouch()"></div>'+
       '<div class="f"><label>Precio socio / aliado</label><input id="cpPrecioSocio" type="number" value="'+(c.precioSocio||'')+'" oninput="capTouch()"><div class="f-hint">El de empresa se fija caso por caso</div></div>'+
       '<div class="f"><label>Cupos estimados</label><input id="cpCupos" type="number" value="'+(c.cupos||'')+'" oninput="capTouch()"></div>'+
       '<div class="f"><label>Cupo mínimo para abrir</label><input id="cpCuposMin" type="number" value="'+(c.cuposMin||'')+'" oninput="capTouch()"></div></div>';
  }else{
    h+='<div class="g2"><div class="f"><label>Monto total acordado</label><input id="cpCerrado" type="number" value="'+(c.montoCerrado||'')+'" oninput="capTouch()"></div>'+
       '<div class="f"><label>Cupos previstos (opcional)</label><input id="cpCupos" type="number" value="'+(c.cupos||'')+'" oninput="capTouch()"></div></div>';
  }
  h+='<div class="f" style="max-width:260px"><label>Comisión de cobro (%)</label><input id="cpComision" type="number" step="0.1" value="'+(c.comisionPct||'')+'" oninput="capTouch()"><div class="f-hint">Lo que se lleva la pasarela de pago o el banco</div></div>';

  /* disertantes */
  h+='<div class="sec">🎤 Disertantes</div>';
  h+='<table class="ht"><thead><tr><th>Nombre</th><th style="width:150px">Rol / módulo</th><th style="width:130px">Honorario</th><th style="width:30px"></th></tr></thead><tbody id="cpDisBody">';
  (c.disertantes||[]).forEach(function(d,i){
    h+='<tr><td><input value="'+esc(d.nombre||'')+'" oninput="capTouch()"></td>'+
       '<td><input value="'+esc(d.rol||'')+'" oninput="capTouch()" placeholder="Ej.: Módulo 1"></td>'+
       '<td><input type="number" value="'+(d.monto||'')+'" oninput="capTouch()"></td>'+
       '<td><button class="rm" onclick="capQuitarDis('+i+')" title="Quitar">×</button></td></tr>';
  });
  h+='</tbody></table><button class="ab" onclick="capAgregarDis()">+ Agregar disertante</button>';

  /* costos */
  h+='<div class="sec">🧾 Otros costos</div><div class="g3">';
  CAP_COSTOS.forEach(function(x){
    h+='<div class="f"><label>'+x.ico+' '+x.n+'</label><input id="cp_'+x.k+'" type="number" value="'+((c.costos||{})[x.k]||'')+'" oninput="capTouch()"></div>';
  });
  h+='</div>';

  h+='<div style="display:flex;gap:8px;margin:18px 0 40px"><button class="btn btn-g" style="flex:1;padding:12px" onclick="guardarCap()">💾 Guardar capacitación</button>'+
     '<button class="btn" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd)" onclick="backFromForm()">Cancelar</button></div>';

  document.getElementById('formContent').innerHTML=h;
  capResumen();
}

function capTouch(){formDirty=true;capLeer();capResumen()}
function capLeer(){
  var c=CAPST,v=function(id){var e=document.getElementById(id);return e?e.value:''};
  var n=function(id){return parseFloat(v(id))||0};
  c._nombre=v('cpNombre');c._cliente=v('cpCliente');
  c.modalidad=v('cpModalidad')||c.modalidad;c.horas=n('cpHoras');
  c.fechaIni=v('cpIni');c.fechaFin=v('cpFin');c.lugar=v('cpLugar');
  if(document.getElementById('cpModo'))c.modo=v('cpModo');
  if(document.getElementById('cpMoneda'))c.moneda=v('cpMoneda');
  c.cot=n('cpCot');c.precioCupo=n('cpPrecio');c.precioSocio=n('cpPrecioSocio');c.cupos=n('cpCupos');c.cuposMin=n('cpCuposMin');
  c.montoCerrado=n('cpCerrado');c.comisionPct=n('cpComision');
  var body=document.getElementById('cpDisBody');
  if(body){
    c.disertantes=Array.prototype.map.call(body.querySelectorAll('tr'),function(tr){
      var i=tr.querySelectorAll('input');
      return {nombre:i[0].value,rol:i[1].value,monto:parseFloat(i[2].value)||0};
    });
  }
  CAP_COSTOS.forEach(function(x){c.costos[x.k]=n('cp_'+x.k)});
}
function capAgregarDis(){capLeer();CAPST.disertantes.push({nombre:'',rol:'',monto:0});formDirty=true;pintarCapForm()}
function capQuitarDis(i){capLeer();CAPST.disertantes.splice(i,1);if(!CAPST.disertantes.length)CAPST.disertantes=[{nombre:'',rol:'',monto:0}];formDirty=true;pintarCapForm()}

/* panel derecho: mismas clases que el resumen de suelo */
function capResumen(){
  var c=CAPST,r=capCalc(c);
  var h='<div class="rs">El curso</div>';
  h+='<div class="rr"><span>Ingreso previsto</span><span class="rv">'+capFmt(c,r.ingresoBruto)+'</span></div>';
  h+='<div class="rr"><span>Costo total</span><span class="rv">'+capFmt(c,r.costoTotal)+'</span></div>';
  h+='<div class="rr sol"><span>Utilidad</span><span class="rv">'+capFmt(c,r.utilidad)+'</span></div>';
  h+='<div class="rr"><span>Margen</span><span class="rv">'+(r.margen*100).toFixed(0)+'%</span></div>';
  h+='<div class="rdiv"></div><div class="rs">Costos</div>';
  h+='<div class="rr"><span>Disertantes</span><span class="rv">'+capFmt(c,r.dis)+'</span></div>';
  CAP_COSTOS.forEach(function(x){
    var v=(c.costos||{})[x.k]||0;
    if(v>0)h+='<div class="rr"><span>'+x.n+'</span><span class="rv">'+capFmt(c,v)+'</span></div>';
  });
  if(r.comision>0)h+='<div class="rr"><span>Comisión de cobro</span><span class="rv">'+capFmt(c,r.comision)+'</span></div>';
  if(c.modo==='cupos'){
    h+='<div class="rdiv"></div><div class="rs">Por cupo</div>';
    h+='<div class="rr"><span>Costo por cupo</span><span class="rv">'+(r.costoPorCupo!=null?capFmt(c,r.costoPorCupo):'—')+'</span></div>';
    if(r.equilibrio!=null){
      var alcanza=(+c.cupos||0)>=r.equilibrio;
      h+='<div class="margin-box" style="border-color:'+(alcanza?'rgba(52,166,120,0.35)':'rgba(239,68,68,0.5)')+';background:'+(alcanza?'rgba(52,166,120,0.08)':'rgba(239,68,68,0.10)')+'">'+
         '<div class="rr"><span>Punto de equilibrio</span><span class="rv">'+r.equilibrio+' cupos</span></div>'+
         '<div style="font-size:10px;color:rgba(255,255,255,0.6);margin-top:2px">'+(alcanza
            ?'Con '+(c.cupos||0)+' inscriptos ya cubrís los costos.'
            :'Faltan '+(r.equilibrio-(+c.cupos||0))+' inscriptos para cubrir los costos.')+'</div></div>';
    }
    if(+c.cuposMin>0&&r.equilibrio!=null&&+c.cuposMin<r.equilibrio)
      h+=capAviso('El cupo mínimo ('+c.cuposMin+') está por debajo del punto de equilibrio.');
  }
  if(c.moneda==='Gs'&&!(+c.cot>0))h+=capAviso('Sin cotización, este curso no se puede comparar con los proyectos en USD.');
  document.getElementById('rc').innerHTML=h;
}
function capAviso(t){
  return '<div style="margin-top:8px;padding:8px 10px;border-radius:6px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);font-size:10px;color:#FDE68A">'+t+'</div>';
}

/* guardar */
function guardarCap(){
  capLeer();
  var c=CAPST;
  if(!(c._nombre||'').trim()){toast('❌ Falta el nombre del curso');return}
  var r=capCalc(c);
  if(r.ingresoBruto<=0&&!confirm('El curso no tiene ingreso cargado. ¿Guardar igual?'))return;
  var datos={
    nombre:(c._nombre||'').trim().toUpperCase(),
    cliente:(c._cliente||'').trim().toUpperCase(),
    tipoProyecto:'capacitacion',
    capacitacion:{
      modo:c.modo,moneda:c.moneda,cot:c.cot,precioCupo:c.precioCupo,precioSocio:c.precioSocio,cupos:c.cupos,cuposMin:c.cuposMin,
      montoCerrado:c.montoCerrado,comisionPct:c.comisionPct,disertantes:c.disertantes,costos:c.costos,
      modalidad:c.modalidad,horas:c.horas,fechaIni:c.fechaIni,fechaFin:c.fechaFin,lugar:c.lugar
    },
    valorUsd:capUsd(c),
    cotizacion:c.cot||null,
    fechaModificacion:firebase.firestore.FieldValue.serverTimestamp()
  };
  var p=editingId?findProj(editingId):null;
  if(!editingId){
    datos.estado='Cotización';
    datos.fechaCreacion=firebase.firestore.FieldValue.serverTimestamp();
  }
  var op=editingId
    ? db.collection('proyectos').doc(editingId).update(datos)
    : db.collection('proyectos').add(datos).then(function(ref){editingId=ref.id});
  op.then(function(){
    formDirty=false;
    toast('✅ Capacitación guardada');
    return sincronizarAsignacionesCap(editingId,c);
  }).then(function(){
    BalanceData.invalidar();
    return loadAll();
  }).then(function(){
    nav('#/p/'+encodeURIComponent(editingId));
  }).catch(function(e){toast('❌ '+e.message)});
}

/* Las asignaciones alimentan el balance: se guardan en guaraníes, como los gastos */
function sincronizarAsignacionesCap(id,c){
  if(!id)return Promise.resolve();
  var cot=+c.cot||0;
  var aGs=function(v){return c.moneda==='USD'?(cot>0?v*cot:0):v};
  var dis=(c.disertantes||[]).reduce(function(s,d){return s+(+d.monto||0)},0);
  var asig={
    'Disertante':aGs(dis),
    'Salón':aGs(c.costos.salon),
    'Publicidad':aGs(c.costos.public),
    'Plataformas':aGs(c.costos.plat),
    'Materiales':aGs(c.costos.mat),
    'Catering':aGs(c.costos.coffee),
    'Viáticos':aGs(c.costos.viat),
    'Varios':aGs(c.costos.otros)
  };
  var ref=db.collection('proyectos').doc(id).collection('asignaciones');
  return Promise.all(Object.keys(asig).map(function(k){
    return asig[k]>0?ref.doc(k).set({monto:Math.round(asig[k]),categoria:k}):ref.doc(k).delete().catch(function(){});
  }));
}

/* ── detalle ── */
function renderCapDetalle(p){
  var c=capDe(p),r=capCalc(c);
  var kc=r.margen>=0.3?'kpi-g':r.margen>=0.15?'kpi-w':'kpi-d';
  function kpi(cls,v,l){return '<div class="det-kpi '+cls+'"><div class="kv">'+v+'</div><div class="kl">'+l+'</div></div>'}
  function fila(l,v){return '<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:12px;border-bottom:1px solid var(--sf2)"><span style="color:var(--tx2)">'+l+'</span><b style="color:var(--gd)">'+v+'</b></div>'}

  var h='<div class="det-kpis">'+
    kpi('kpi-b',capFmt(c,r.ingresoBruto),'Ingreso previsto')+
    kpi('kpi-d',capFmt(c,r.costoTotal),'Costo total')+
    kpi(kc,capFmt(c,r.utilidad),'Utilidad')+
    kpi(kc,(r.margen*100).toFixed(0)+'%','Margen')+
    kpi('kpi-g',(c.modo==='cupos'?((r.equilibrio!=null?r.equilibrio:'—')+' cupos'):esc(c.modalidad||'—')),(c.modo==='cupos'?'Punto de equilibrio':'Modalidad'))+
  '</div>';

  h+='<div class="det-grid">';
  h+='<div class="det-card"><h4>🎓 El curso</h4>'+
     fila('Modalidad',esc(c.modalidad||'—'))+
     fila('Horas',(c.horas||'—'))+
     fila('Fechas',(c.fechaIni||'—')+(c.fechaFin?' al '+c.fechaFin:''))+
     fila('Lugar / plataforma',esc(c.lugar||'—'))+
     fila('Venta',c.modo==='cupos'?('Por cupos · '+capFmt(c,c.precioCupo)+' × '+(c.cupos||0)):'Monto cerrado')+
     (c.modo==='cupos'&&+c.precioSocio>0?fila('Precio socio / aliado',capFmt(c,c.precioSocio)):'')+
     (c.modo==='cupos'?fila('Cupo mínimo',(c.cuposMin||'—')):'')+
     '</div>';

  var dis=(c.disertantes||[]).filter(function(d){return (d.nombre||'').trim()||+d.monto>0});
  h+='<div class="det-card"><h4>🎤 Disertantes</h4>'+
     (dis.length?dis.map(function(d){return fila(esc(d.nombre||'Sin nombre')+(d.rol?' <span style="color:var(--tx3)">· '+esc(d.rol)+'</span>':''),capFmt(c,d.monto))}).join('')+fila('<strong>Total</strong>',capFmt(c,r.dis))
                :'<div style="font-size:12px;color:var(--tx3)">Sin disertantes cargados</div>')+
     '</div>';
  h+='</div>';

  h+='<div class="det-card full"><h4>🧾 Costos</h4>';
  h+=fila('Disertantes',capFmt(c,r.dis));
  CAP_COSTOS.forEach(function(x){var v=(c.costos||{})[x.k]||0;if(v>0)h+=fila(x.ico+' '+x.n,capFmt(c,v))});
  if(r.comision>0)h+=fila('Comisión de cobro ('+c.comisionPct+'%)',capFmt(c,r.comision));
  h+=fila('<strong>Costo total</strong>','<span style="color:var(--dg)">'+capFmt(c,r.costoTotal)+'</span>');
  if(c.modo==='cupos'&&r.costoPorCupo!=null)h+=fila('Costo por cupo',capFmt(c,r.costoPorCupo));
  h+='</div>';

  h+='<div class="det-card full"><h4>👥 Inscriptos</h4><div id="capInscBody"><div style="font-size:12px;color:var(--tx3)">Cargando…</div></div></div>';
  setTimeout(function(){capCargarInscriptos(p._id)},0);
  return h;
}


/* ═══ INSCRIPTOS ═══ */
/* Lo presupuestado es una estimación; acá se anota lo que realmente pagó cada uno,
   que no siempre es el precio de lista (socios, acuerdos con empresas, becas). */
var CAP_TIPOS=['Particular','Socio / aliado','Empresa','Beca / cortesía'];
var INSC=[],INSC_PROY=null;

var INSC_FACT={};
function capCargarInscriptos(id){
  INSC_PROY=id;
  Promise.all([
    db.collection('proyectos').doc(id).collection('inscriptos').get(),
    capCargarFacturasInsc(id)
  ]).then(function(r){
    INSC=r[0].docs.map(function(d){return Object.assign({_id:d.id},d.data())})
      .sort(function(a,b){return String(a.nombre||'').localeCompare(String(b.nombre||''))});
    INSC_FACT=r[1]||{};
    pintarInscriptos();
  }).catch(function(e){
    var el=document.getElementById('capInscBody');
    if(el)el.innerHTML='<div style="font-size:12px;color:var(--dg)">No se pudieron leer los inscriptos: '+esc(e.message)+'</div>';
  });
}

function pintarInscriptos(){
  var el=document.getElementById('capInscBody');if(!el)return;
  var p=findProj(INSC_PROY),c=capDe(p),r=capCalc(c);
  var cobrado=INSC.filter(function(x){return x.cobrado}).reduce(function(s,x){return s+(+x.monto||0)},0);
  var pendiente=INSC.filter(function(x){return !x.cobrado}).reduce(function(s,x){return s+(+x.monto||0)},0);
  var total=cobrado+pendiente;
  var h='';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">'+
     miniKpi(INSC.length+(c.cupos?' / '+c.cupos:''),'Inscriptos')+
     miniKpi(capFmt(c,cobrado),'Cobrado')+
     miniKpi(capFmt(c,pendiente),'Por cobrar')+
     miniKpi(capFmt(c,total-r.costoTotal),'Resultado real')+
     '</div>';
  if(c.modo==='cupos'&&r.equilibrio!=null){
    var falta=r.equilibrio-INSC.length;
    h+='<div style="font-size:11.5px;margin-bottom:8px;color:'+(falta<=0?'#1F7A56':'#B45309')+'">'+
       (falta<=0?'✔ Ya superaste el punto de equilibrio ('+r.equilibrio+' cupos).'
                :'Faltan '+falta+' inscripto'+(falta===1?'':'s')+' para llegar al punto de equilibrio ('+r.equilibrio+').')+'</div>';
  }
  if(!INSC.length){
    h+='<div style="font-size:12px;color:var(--tx3);padding:8px 0">Todavía no cargaste inscriptos.</div>';
  }else{
    h+='<table class="ht" style="width:100%"><thead><tr><th>Nombre</th><th style="width:130px">Tipo</th><th style="width:120px">Pagó</th><th style="width:90px">Estado</th><th style="width:30px"></th></tr></thead><tbody>';
    INSC.forEach(function(x){
      var fac=INSC_FACT[x._id];
      h+='<tr><td>'+esc(x.nombre||'')+(x.empresa?'<div style="font-size:10px;color:var(--tx3)">'+esc(x.empresa)+'</div>':'')+
         (fac?'<div style="font-size:10px;color:var(--g);font-weight:600">🧾 '+esc(fac.nroFormateado||'')+'</div>':'<div style="font-size:10px;color:var(--tx3)">sin factura</div>')+'</td>'+
         '<td>'+esc(x.tipo||'')+'</td>'+
         '<td style="text-align:right">'+capFmt(c,x.monto)+'</td>'+
         '<td><button class="ab" style="margin:0" onclick="capToggleCobro(\''+x._id+'\')">'+(x.cobrado?'✔ Cobrado':'Pendiente')+'</button></td>'+
         '<td><button class="rm" title="Quitar" onclick="capQuitarInscripto(\''+x._id+'\')">×</button></td></tr>';
    });
    h+='</tbody></table>';
  }
  h+='<button class="ab" onclick="capAbrirInscripto()">+ Agregar inscripto</button>';
  el.innerHTML=h;
  function miniKpi(v,l){return '<div style="flex:1;min-width:110px;background:var(--sf2);border-radius:8px;padding:8px 10px"><div style="font-size:15px;font-weight:700;color:var(--gd)">'+v+'</div><div style="font-size:9px;color:var(--tx2);text-transform:uppercase">'+l+'</div></div>'}
}

function capAbrirInscripto(){
  var p=findProj(INSC_PROY),c=capDe(p);
  document.getElementById('inscTipo').innerHTML=CAP_TIPOS.map(function(t){return '<option>'+t+'</option>'}).join('');
  document.getElementById('inscNombre').value='';
  document.getElementById('inscEmpresa').value='';
  document.getElementById('inscMonto').value=c.precioCupo||'';
  document.getElementById('inscCobrado').checked=true;
  document.getElementById('inscMoneda').textContent=c.moneda==='USD'?'USD':'Gs';
  showModal('inscModal');
  setTimeout(function(){document.getElementById('inscNombre').focus()},60);
}
/* Al cambiar el tipo se sugiere el precio que corresponde */
function capTipoCambio(){
  var p=findProj(INSC_PROY),c=capDe(p);
  var t=document.getElementById('inscTipo').value;
  var m=document.getElementById('inscMonto');
  if(t==='Socio / aliado'&&+c.precioSocio>0)m.value=c.precioSocio;
  else if(t==='Particular'&&+c.precioCupo>0)m.value=c.precioCupo;
  else if(t==='Beca / cortesía')m.value=0;
}
function capGuardarInscripto(){
  var nombre=document.getElementById('inscNombre').value.trim();
  if(!nombre){toast('❌ Falta el nombre');return}
  var d={nombre:nombre,tipo:document.getElementById('inscTipo').value,
    empresa:document.getElementById('inscEmpresa').value.trim()||null,
    monto:parseFloat(document.getElementById('inscMonto').value)||0,
    cobrado:document.getElementById('inscCobrado').checked,
    fecha:new Date().toISOString().split('T')[0]};
  db.collection('proyectos').doc(INSC_PROY).collection('inscriptos').add(d).then(function(){
    hideModal('inscModal');toast('✅ Inscripto agregado');capCargarInscriptos(INSC_PROY);
  }).catch(function(e){toast('❌ '+e.message)});
}
function capToggleCobro(id){
  var x=INSC.find(function(y){return y._id===id});if(!x)return;
  db.collection('proyectos').doc(INSC_PROY).collection('inscriptos').doc(id).update({cobrado:!x.cobrado})
    .then(function(){capCargarInscriptos(INSC_PROY)}).catch(function(e){toast('❌ '+e.message)});
}
function capQuitarInscripto(id){
  var x=INSC.find(function(y){return y._id===id});
  confirmar({icono:'🗑',titulo:'Quitar inscripto',cuerpo:'<p>Se quita <strong>'+esc((x&&x.nombre)||'')+'</strong> de la lista.</p>',ok:'Quitar',peligro:true}).then(function(ok){
    if(!ok)return;
    db.collection('proyectos').doc(INSC_PROY).collection('inscriptos').doc(id).delete()
      .then(function(){capCargarInscriptos(INSC_PROY)}).catch(function(e){toast('❌ '+e.message)});
  });
}


/* Aprobar un curso: pasa a En Curso y deja las asignaciones listas para el balance.
   No usa el modal de anticipo/retención del estudio de suelo, que no aplica acá. */
function capAprobar(id){
  var p=findProj(id);if(!p)return;
  var c=capDe(p),r=capCalc(c);
  var falta=(c.moneda==='Gs'&&!(+c.cot>0));
  confirmar({
    icono:'🎓',titulo:'Aprobar capacitación',
    cuerpo:'<p>«'+esc(p.nombre||'')+'» pasa a <strong>En curso</strong> y empieza a aparecer en el Balance.</p>'+
      '<div style="background:var(--sf2);border-radius:8px;padding:10px 12px;margin-top:8px;font-size:12.5px">'+
      '<div style="display:flex;justify-content:space-between"><span>Ingreso previsto</span><b>'+capFmt(c,r.ingresoBruto)+'</b></div>'+
      '<div style="display:flex;justify-content:space-between"><span>Costo presupuestado</span><b>'+capFmt(c,r.costoTotal)+'</b></div></div>'+
      (falta?'<div style="margin-top:8px;font-size:12px;color:#B45309">Ojo: sin cotización cargada, el curso no va a poder compararse en dólares con el resto.</div>':''),
    ok:'Aprobar'
  }).then(function(ok){
    if(!ok)return;
    return db.collection('proyectos').doc(id).update({
      estado:'En Curso',
      valorUsd:capUsd(c),
      fechaModificacion:firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(){return sincronizarAsignacionesCap(id,c)})
      .then(function(){
        toast('✅ Capacitación aprobada');
        BalanceData.invalidar();
        return loadAll();
      }).then(function(){refrescarVista()});
  }).catch(function(e){toast('❌ '+e.message)});
}

/* Facturas vinculadas a cada inscripto */
function capCargarFacturasInsc(id){
  return db.collection('facturas').where('proyectoId','==',id).get().then(function(sn){
    var m={};
    sn.docs.forEach(function(d){
      var f=d.data();
      if(f.inscriptoId)m[f.inscriptoId]=f;
    });
    return m;
  }).catch(function(){return {}});
}
