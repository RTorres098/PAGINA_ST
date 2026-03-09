"use client"

import React from 'react'
// Importamos todos los iconos necesarios para evitar los errores de las imágenes 4 y 5
// Nota: Usamos 'FlaskConical' en lugar de 'Vial' ya que es el nombre estándar en Lucide
import { 
  Home, 
  Users, 
  Settings, 
  Briefcase, 
  GraduationCap, 
  Mail, 
  MapPin, 
  Instagram, 
  Facebook, 
  Linkedin,
  FlaskConical,
  Map as MapIcon,
  ChevronDown,
  Download,
  ArrowRight,
  MousePointer2,
  Phone,
  Send
} from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"

export default function SoilTechPage() {
  // Definición de los botones del menú animado para SoilTech
  const navItems = [
    { name: 'Inicio', url: '#inicio', icon: Home },
    { name: 'Nosotros', url: '#nosotros', icon: Users },
    { name: 'Servicios', url: '#servicios', icon: Briefcase },
    { name: 'Capacitaciones', url: '#capacitaciones', icon: GraduationCap }
  ]

  return (
    <main className="scroll-smooth antialiased bg-[#fcfcfc] text-[#363636]">
      {/* NAVBAR ANIMADO */}
      <NavBar items={navItems} />

      {/* SECCIÓN HERO (Basada en tu PORTADA.webp) */}
      <header id="inicio" className="relative min-h-screen flex items-center overflow-hidden bg-[#132723]">
        <div className="absolute inset-0 z-0">
          <img src="/PORTADA.webp" className="w-full h-full object-cover opacity-60" alt="Fondo SoilTech" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#363636]"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10 pt-20">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2 mb-8">
              {["SUELOS", "SIG Y TELEDETECCIÓN", "Business Intelligence"].map((tag) => (
                <span key={tag} className="px-4 py-1 bg-[#34A678] text-white font-bold text-[10px] rounded-full uppercase tracking-widest">
                  {tag}
                </span>
              ))}
            </div>
            
            <h1 className="text-5xl md:text-8xl font-black text-white leading-[0.9] mb-8 uppercase tracking-tighter">
              Ciencia y Tecnología <br /> para la 
              <span className="text-[#34A678]"> Producción Sostenible</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-200 mb-12 max-w-2xl leading-relaxed font-medium">
              Soluciones innovadoras que optimizan la toma de decisiones mediante tecnología SIG, estudios de suelo y formación técnica especializada.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <a href="#servicios" className="bg-[#34A678] text-white px-10 py-5 rounded-2xl font-bold text-lg hover:bg-white hover:text-[#132723] transition-all shadow-2xl">
                Nuestros Servicios
              </a>
              <a href="#capacitaciones" className="border-2 border-white text-white px-10 py-5 rounded-2xl font-bold text-lg hover:bg-white hover:text-[#132723] transition-all">
                Ver Capacitaciones
              </a>
            </div>
          </div>
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 animate-bounce text-white/50">
          <ChevronDown size={32} />
        </div>
      </header>

      {/* SECCIÓN NOSOTROS */}
      <section id="nosotros" className="py-24 bg-white">
        <div className="container mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
          <div className="relative">
            <h2 className="text-4xl font-black text-[#132723] mb-8 uppercase tracking-tighter">Sobre Nosotros</h2>
            <div className="space-y-6 text-gray-600 text-lg leading-relaxed">
              <p>En <span className="text-[#34A678] font-bold uppercase">SoilTech</span>, somos un equipo dedicado a ofrecer soluciones innovadoras que optimizan la toma de decisiones en diversos sectores productivos.</p>
              <p>Nuestro enfoque está centrado en el desarrollo sostenible, brindando herramientas precisas mediante <span className="text-[#34A678] font-bold">Estudios de Suelo y SIG.</span></p>
            </div>
            <div className="mt-10 p-8 bg-[#E6F4F1] rounded-3xl border-l-8 border-[#34A678]">
              <p className="text-[#245A50] font-bold text-xl italic leading-snug">
                "SoilTech es tu aliado estratégico para llevar adelante el cambio con soluciones basadas en datos, tecnología y educación."
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 h-[500px]">
             <div className="bg-gray-200 rounded-3xl overflow-hidden shadow-xl mt-12"><img src="/perfil 0 a 30.jpg" className="w-full h-full object-cover" alt="Suelos" /></div>
             <div className="bg-gray-200 rounded-3xl overflow-hidden shadow-xl"><img src="/densidad.jpg" className="w-full h-full object-cover" alt="Densidad" /></div>
          </div>
        </div>
      </section>

      {/* SECCIÓN SERVICIOS */}
      <section id="servicios" className="relative py-24 bg-[#132723] overflow-hidden text-white">
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-[#34A678] text-sm font-black uppercase tracking-[0.3em] mb-4">No Soil = No Food</h2>
            <h3 className="text-5xl font-black italic uppercase tracking-tighter">Lo que hacemos</h3>
            <div className="w-20 h-2 bg-[#34A678] mx-auto mt-6 rounded-full shadow-[0_0_15px_rgba(52,166,120,0.5)]"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <ServiceCard 
              icon={<FlaskConical />} 
              title="Estudios de Suelo" 
              desc="Ejecutamos proyectos de estudio de suelo, interpretación y recomendación de fertilizantes." 
            />
            <ServiceCard 
              icon={<MapIcon />} 
              title="Geoprocesamientos" 
              desc="Implementación de Sistemas de Información Geográfica (SIG) para la gestión eficiente." 
            />
            <ServiceCard 
              icon={<GraduationCap />} 
              title="Capacitaciones" 
              desc="Formación técnica especializada para profesionales del sector agropecuario." 
            />
          </div>
        </div>
      </section>

      {/* SECCIÓN CAPACITACIONES */}
      <section id="capacitaciones" className="py-24 bg-[#132723] text-white">
        <div className="container mx-auto px-6">
          <div className="bg-gradient-to-br from-white/10 to-[#EFBF04]/5 border-2 border-[#EFBF04] rounded-[3rem] p-10 md:p-16 shadow-2xl relative overflow-hidden">
            <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
              <div>
                <span className="bg-[#EFBF04] text-black text-[10px] font-black px-4 py-1 rounded-full uppercase mb-6 inline-block">Más solicitado</span>
                <h3 className="text-4xl md:text-5xl font-black mb-6 leading-none">CAPACITACIÓN EN SIG <br/> <span className="text-[#34A678]">ARCGIS PRO & ONLINE</span></h3>
                <p className="text-gray-300 text-lg mb-8 leading-relaxed">Domina el ecosistema líder de Esri con un enfoque 100% práctico diseñado para gestión territorial.</p>
                <div className="flex flex-wrap gap-6 mb-10">
                  <div className="flex items-center gap-2 text-sm"><GraduationCap className="text-[#34A678]" /> 25 Horas Certificadas</div>
                  <div className="flex items-center gap-2 text-sm"><Briefcase className="text-[#34A678]" /> Licencia x 3 Meses</div>
                </div>
                <a href="https://www.soiltechpy.com/curso_arcgis/" target="_blank" className="inline-flex items-center gap-4 bg-[#34A678] text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-white hover:text-[#132723] transition-all">
                  Ver Detalles <ArrowRight />
                </a>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/10 flex flex-col items-center">
                <img src="/arcgis_pro.png" className="h-24 mb-8 object-contain" alt="ArcGIS" />
                <p className="text-center text-sm italic text-gray-400">Inicio 13 de Abril - Modalidad Híbrida</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#132723] text-white pt-20 pb-10 border-t border-white/5">
        <div className="container mx-auto px-6 grid md:grid-cols-3 gap-16">
          <div className="space-y-6">
            <img src="/horizontal2_2026.svg" alt="SoilTech" className="h-12" />
            <p className="text-gray-400 text-sm leading-relaxed">Consultoría y Capacitaciones en el sector agrícola, forestal y ganadero.</p>
          </div>
          <div>
            <h4 className="font-bold text-[#34A678] uppercase mb-8 text-sm tracking-widest">Contacto Directo</h4>
            <div className="space-y-4 text-gray-300 text-sm">
              <p className="flex items-center gap-3"><Phone size={16} className="text-[#34A678]" /> +595 982 369 083</p>
              <p className="flex items-center gap-3"><Mail size={16} className="text-[#34A678]" /> admin@soiltechpy.com</p>
              <p className="flex items-center gap-3"><MapPin size={16} className="text-[#34A678]" /> San Lorenzo, Paraguay</p>
            </div>
          </div>
          <div className="flex gap-4 items-start justify-center md:justify-start">
            <SocialIcon icon={<Instagram />} href="https://www.instagram.com/py.soiltech/" />
            <SocialIcon icon={<Facebook />} href="https://www.facebook.com/py.soiltech/" />
            <SocialIcon icon={<Linkedin />} href="#" />
          </div>
        </div>
        <div className="border-t border-white/5 mt-16 pt-8 text-center text-[10px] text-gray-500 uppercase tracking-widest">
          <p>&copy; 2026 SoilTech Paraguay. Todos los derechos reservados.</p>
        </div>
      </footer>
    </main>
  )
}

// Componentes de apoyo para mantener el código organizado
function ServiceCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-md p-10 rounded-[2.5rem] border border-white/10 border-b-8 border-[#34A678] hover:-translate-y-2 transition-all">
      <div className="w-16 h-16 bg-[#34A678] rounded-2xl flex items-center justify-center text-3xl mb-8 text-white shadow-lg">{icon}</div>
      <h4 className="text-2xl font-black text-white mb-4 uppercase">{title}</h4>
      <p className="text-gray-300 leading-relaxed font-medium">{desc}</p>
    </div>
  )
}

function SocialIcon({ icon, href }: { icon: React.ReactNode, href: string }) {
  return (
    <a href={href} target="_blank" className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#34A678] transition-all text-white">
      {icon}
    </a>
  )
}