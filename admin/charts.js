/* SoilTech Admin — gráficos en SVG, sin librerías.
 * Todo devuelve una cadena de HTML lista para inyectar.
 *   STChart.barras(datos,{alto,color,formato})   datos: [{etiqueta,valor,fuerte}]
 *   STChart.dona(partes,{tamano,grosor,centro,sub})  partes: [{etiqueta,valor,color}]
 *   STChart.barrasH(datos)                        datos: [{etiqueta,valor,color}]
 */
var STChart = (function () {
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function corto(n){
    var a=Math.abs(n);
    if(a>=1e9)return (n/1e9).toFixed(a>=1e10?0:1).replace('.',',')+' MM';
    if(a>=1e6)return (n/1e6).toFixed(a>=1e7?0:1).replace('.',',')+' M';
    if(a>=1e3)return Math.round(n/1e3)+' mil';
    return String(Math.round(n));
  }

  /* Barras verticales en HTML: el texto nunca se deforma. */
  function barras(datos,o){
    o=o||{};
    var alto=o.alto||200, color=o.color||'#34A678', fmt=o.formato||corto;
    if(!datos.length)return '<div class="empty">Sin datos todavía.</div>';
    var max=0;datos.forEach(function(d){if(d.valor>max)max=d.valor});
    if(max<=0)max=1;
    var grilla='';
    [0,.25,.5,.75,1].forEach(function(p){
      grilla+='<div style="position:absolute;left:0;right:0;bottom:'+(p*100)+'%;height:1px;background:#EDE9E0"></div>';
    });
    var cols=datos.map(function(d){
      var h=Math.max(d.valor/max*100,.7);
      return '<div style="position:relative;flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0" title="'+esc(d.etiqueta)+': '+esc(d.titulo||fmt(d.valor))+'">'+
        (d.valor>0?'<div style="font-size:11px;font-weight:700;color:#18403E;margin-bottom:5px;white-space:nowrap">'+esc(fmt(d.valor))+'</div>':'')+
        '<div style="width:56%;max-width:46px;height:'+h.toFixed(1)+'%;border-radius:6px 6px 3px 3px;background:'+(d.fuerte===false?'#CFE7DB':color)+'"></div>'+
      '</div>';
    }).join('');
    var etq=datos.map(function(d){
      return '<div style="flex:1;text-align:center;font-size:11px;font-weight:600;color:#6B6B6B;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(d.etiqueta)+'</div>';
    }).join('');
    return '<div style="position:relative;min-height:'+alto+'px;height:100%;display:flex;align-items:stretch;gap:6px;padding-top:4px">'+
             grilla+cols+
           '</div><div style="display:flex;gap:6px;margin-top:8px;padding-top:7px;border-top:1px solid #EDE9E0">'+etq+'</div>';
  }

  /* Dona con texto al centro. */
  function dona(partes,o){
    o=o||{};
    var T=o.tamano||168, gr=o.grosor||22, R=(T-gr)/2, C=T/2;
    var total=partes.reduce(function(s,p){return s+(p.valor>0?p.valor:0)},0);
    var svg='<svg viewBox="0 0 '+T+' '+T+'" style="width:'+T+'px;height:'+T+'px;flex-shrink:0">';
    if(total<=0){
      svg+='<circle cx="'+C+'" cy="'+C+'" r="'+R+'" fill="none" stroke="#EDE9E0" stroke-width="'+gr+'"/>';
    }else{
      var circ=2*Math.PI*R, off=0;
      partes.forEach(function(p){
        if(!(p.valor>0))return;
        var frac=p.valor/total, len=circ*frac;
        svg+='<circle cx="'+C+'" cy="'+C+'" r="'+R+'" fill="none" stroke="'+p.color+'" stroke-width="'+gr+'"'+
             ' stroke-dasharray="'+len.toFixed(2)+' '+(circ-len).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'"'+
             ' transform="rotate(-90 '+C+' '+C+')" stroke-linecap="butt"><title>'+esc(p.etiqueta)+': '+Math.round(frac*100)+'%</title></circle>';
        off+=len;
      });
    }
    if(o.centro)svg+='<text x="'+C+'" y="'+(C-1)+'" text-anchor="middle" font-size="19" font-weight="700" fill="#18403E">'+esc(o.centro)+'</text>';
    if(o.sub)svg+='<text x="'+C+'" y="'+(C+15)+'" text-anchor="middle" font-size="10" font-weight="600" fill="#9CA3AF">'+esc(o.sub)+'</text>';
    return svg+'</svg>';
  }

  /* Barras horizontales con etiqueta y conteo. */
  function barrasH(datos){
    if(!datos.length)return '<div class="empty">Sin datos todavía.</div>';
    var max=0;datos.forEach(function(d){if(d.valor>max)max=d.valor});
    if(max<=0)max=1;
    return datos.map(function(d){
      var p=Math.round(d.valor/max*100);
      return '<div style="margin-bottom:13px">'+
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:5px">'+
          '<span style="font-size:12.5px;font-weight:600;color:#1A1A1A">'+esc(d.etiqueta)+'</span>'+
          '<span style="font-size:13px;font-weight:700;color:#18403E">'+esc(d.texto!=null?d.texto:d.valor)+'</span>'+
        '</div>'+
        '<div style="height:8px;border-radius:5px;background:#EDE9E0;overflow:hidden">'+
          '<div style="height:100%;width:'+p+'%;border-radius:5px;background:'+(d.color||'#34A678')+'"></div>'+
        '</div></div>';
    }).join('');
  }

  function leyenda(partes,fmt){
    return '<div class="lgd">'+partes.map(function(p){
      return '<span><i style="background:'+p.color+'"></i>'+esc(p.etiqueta)+(fmt?' · '+esc(fmt(p.valor)):'')+'</span>';
    }).join('')+'</div>';
  }

  return {barras:barras,dona:dona,barrasH:barrasH,leyenda:leyenda,corto:corto};
})();
