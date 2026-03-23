// SoilTech Firebase Configuration
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBPOafEUJTh43Rl97EgWZ42gXu6zTDSFN4",
  authDomain: "control-gastos-st26-97032.firebaseapp.com",
  projectId: "control-gastos-st26-97032",
  storageBucket: "control-gastos-st26-97032.firebasestorage.app",
  messagingSenderId: "398401283687",
  appId: "1:398401283687:web:f40e250299011e808396c2"
};

const SERVICIOS = [
  { code:'ST-01', name:'MUESTREO DE SUELO PARA ANÁLISIS DE LABORATORIO' },
  { code:'ST-02', name:'ESTUDIO DE SUELO PARA APTITUD' },
  { code:'ST-03', name:'ESTUDIO DE SUELO PARA DETERMINACION DE STOCK DE CARBONO' },
  { code:'ST-04', name:'ESTUDIO DE SUELO PARA DETERMINACION DE AREAS DE HUMEDAL' },
  { code:'ST-05', name:'ESTUDIO DE SUELO PARA DEGRADACION' },
  { code:'ST-06', name:'ESTUDIO DE SUELO CON DESCRIPCION DE CALICATAS HUMEDALES Y CARBONO ORGANICO' },
  { code:'ST-07', name:'CARACTERIZACION DE SUELO CON DESCRIPCION DE CALICATAS HUMEDALES, DEGRADACION Y CARBONO ORGANICO' },
  { code:'STC-01', name:'CAPACITACIÓN SIG - QGIS' },
  { code:'STC-02', name:'CAPACITACIÓN METODOLOGÍAS DE INFILTRACIÓN' },
];

const LAB_ANALISIS = [
  { id:'macro', name:'MACRO', price:150000, usd:25, desc:'pH, P, K, Ca, Mg, Al, CIC, V, MOS' },
  { id:'macro_s', name:'MACRO + S', price:192000, usd:32, desc:'MACRO + Azufre' },
  { id:'macro_s_b', name:'MACRO + S + B', price:231000, usd:38, desc:'MACRO + S + Boro' },
  { id:'macro_tex', name:'MACRO + TEXTURA', price:240000, usd:40, desc:'MACRO + Granulometría' },
  { id:'macro_s_b_micro', name:'MACRO + S + B + MICRO', price:264000, usd:44, desc:'+ Fe, Cu, Zn, Mn' },
  { id:'quimico', name:'COMPLETO QUÍMICO', price:342000, usd:57, desc:'MACRO+MICRO+S+B+P-rem' },
  { id:'completo_tex', name:'COMPLETO con TEXTURA', price:354000, usd:59, desc:'MACRO+MICRO+S+B+Textura' },
  { id:'completo_prem_tex', name:'COMPLETO + P-REM + TEXTURA', price:432000, usd:72, desc:'Todo incluido' },
  { id:'textura', name:'Textura', price:90000, usd:15, desc:'Arena, Limo, Arcilla' },
  { id:'fisico', name:'Análisis Físico', price:150000, usd:25, desc:'Granulometría + Densidad Real' },
  { id:'prem', name:'P-Rem', price:78000, usd:13, desc:'Fósforo remanente' },
  { id:'conductividad', name:'Conductividad Eléctrica', price:55000, usd:9, desc:'CE' },
  { id:'densidad', name:'Densidad Aparente', price:75000, usd:13, desc:'da' },
];

const CARGOS = [
  'Director de Proyecto',
  'Coordinador de Campo',
  'Especialista GIS',
  'Técnico de Campo',
  'Ayudante de Campo',
  'Consultor Externo',
  'Traductor',
];

const fmtGs = n => n.toLocaleString('es-PY', { maximumFractionDigits: 0 });
const fmtUsd = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function numToWords(n) {
  const u=['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE'];
  const d=['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  const h=['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
  const x=Math.floor(n); if(x===0)return'CERO'; if(x===100)return'CIEN';
  if(x<16)return u[x]; if(x<20)return'DIECI'+u[x-10]; if(x===20)return'VEINTE';
  if(x<30)return'VEINTI'+u[x-20]; if(x<100){const t=Math.floor(x/10),r=x%10;return d[t]+(r?' Y '+u[r]:'');}
  if(x<1000){const c=Math.floor(x/100),r=x%100;return h[c]+(r?' '+numToWords(r):'');}
  if(x<1000000){const m=Math.floor(x/1000),r=x%1000;return(m===1?'MIL':numToWords(m)+' MIL')+(r?' '+numToWords(r):'');}
  if(x<1000000000){const mm=Math.floor(x/1000000),r=x%1000000;return(mm===1?'UN MILLON':numToWords(mm)+' MILLONES')+(r?' '+numToWords(r):'');}
  return String(x);
}
