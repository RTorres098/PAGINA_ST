/* Markdown mínimo — SoilTech
 *
 * Solo lo que Claude usa de verdad en una respuesta: tablas, listas,
 * negritas, títulos y código. No pretende ser un parser general.
 *
 * Escapa SIEMPRE antes de parsear, así nada de lo que venga de la API
 * puede inyectar HTML en el panel.
 */
var Markdown = (function () {

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render(texto){
    var L=esc(texto).split('\n'), out=[], i=0;
    function inline(x){
      return x.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
              .replace(/`([^`]+)`/g,'<code>$1</code>');
    }
    function celdas(fila){
      return fila.trim().replace(/^\||\|$/g,'').split('|')
        .map(function(c){return inline(c.trim())});
    }
    var esLista=function(x){return /^\s*[-*]\s+/.test(x)};
    var esNum=function(x){return /^\s*\d+[.)]\s+/.test(x)};
    while(i<L.length){
      var l=L[i];
      if(!l.trim()){i++;continue}
      if(/^\s*\|/.test(l)&&i+1<L.length&&/^\s*\|?[\s:|-]+\|?\s*$/.test(L[i+1])&&L[i+1].indexOf('-')>=0){
        var th=celdas(l); i+=2; var filas=[];
        while(i<L.length&&/^\s*\|/.test(L[i])){filas.push(celdas(L[i]));i++}
        out.push('<table><thead><tr>'+th.map(function(c){return '<th>'+c+'</th>'}).join('')+
          '</tr></thead><tbody>'+filas.map(function(f){
            return '<tr>'+f.map(function(c){return '<td>'+c+'</td>'}).join('')+'</tr>'}).join('')+
          '</tbody></table>');
        continue;
      }
      var h=l.match(/^#{1,6}\s+(.*)$/);
      if(h){out.push('<h4>'+inline(h[1])+'</h4>');i++;continue}
      if(esLista(l)){
        var li=[];
        while(i<L.length&&esLista(L[i])){li.push('<li>'+inline(L[i].replace(/^\s*[-*]\s+/,''))+'</li>');i++}
        out.push('<ul>'+li.join('')+'</ul>');continue;
      }
      if(esNum(l)){
        var ol=[];
        while(i<L.length&&esNum(L[i])){ol.push('<li>'+inline(L[i].replace(/^\s*\d+[.)]\s+/,''))+'</li>');i++}
        out.push('<ol>'+ol.join('')+'</ol>');continue;
      }
      var par=[];
      while(i<L.length&&L[i].trim()&&!esLista(L[i])&&!esNum(L[i])&&
            !/^#{1,6}\s/.test(L[i])&&!/^\s*\|/.test(L[i])){par.push(L[i]);i++}
      out.push('<p>'+inline(par.join(' '))+'</p>');
    }
    return out.join('');
  }

  return { render: render, esc: esc };
})();
