"use client"

import React from 'react'
import { 
  Home, 
  Users, 
  Briefcase, 
  GraduationCap, 
  Award, 
  Key, 
  Video, 
  MapPin, 
  Laptop, 
  Coffee, 
  Database, 
  Code,
  Info,
  ChevronDown
} from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import { GlowCard } from "@/components/ui/glow-card"

export default function CursoArcGISPage() {
  // 1. Configuración del NavBar Animado
  const navItems = [
    { name: 'Inicio', url: 'https://www.soiltechpy.com/#inicio', icon: Home },
    { name: 'Nosotros', url: 'https://www.soiltechpy.com/#nosotros', icon: Users },
    { name: 'Servicios', url: 'https://www.soiltechpy.com/#servicios', icon: Briefcase },
    { name: 'Capacitaciones', url: 'https://www.soiltechpy.com/#capacitaciones', icon: GraduationCap }
  ]

  return (
    <main className="antialiased bg-[#fcfcfc] text-[#363636]">
      {/* HEADER ANIMADO */}
      <NavBar items={navItems} />

      {/* HERO SECTION */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-6 overflow-hidden bg-black">
        <div className="absolute inset-0 z-0">
          <img src="/back_sig.png" alt="Fondo GIS" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#132723] via-transparent to-transparent"></div>
        </div>

        <div className="container mx-auto text-center max-w-4xl relative z-10 pt-20">
          <span className="bg-[#34A678]/20 text-[#34A678] border border-[#34A678]/40 backdrop-blur-md text-xs font-bold px-4 py-1 rounded-full uppercase tracking-widest inline-block mb-6">
            Modalidad Híbrida
          </span>
          <h1 className="text-4xl md:text-7xl font-extrabold mb-8 text-white leading-[1.1] drop-shadow-lg">
            Capacitación en SIG <br />
            <span className="text-[#34A678]">ArcGIS Pro & Online</span>
          </h1>

          <div className="flex justify-center items-center gap-6 mb-8">
            <img src="/arcgis_pro.png" alt="ArcGIS Pro" className="h-10 w-auto opacity-90" />
            <div className="h-8 w-px bg-white/30"></div>
            <img src="/arcgis_online.png" alt="ArcGIS Online" className="h-10 w-auto opacity-90" />
          </div>

          <p className="text-lg md:text-xl text-gray-200 mb-10 font-light max-w-2xl mx-auto">
            Domina el ecosistema Esri con un enfoque práctico en gestión territorial, lenguaje Arcade y visualización avanzada.
          </p>

          {/* 2. CUADRO CON EFECTO DE BRILLO INMERSIVO (GlowCard) */}
          <div className="flex justify-center mb-12">
            <GlowCard 
              glowColor="green" 
              customSize={true} 
              className="w-full max-w-2xl mx-auto flex flex-wrap justify-center gap-8 py-8 px-6"
            >
              <div className="flex items-center gap-3 text-white text-base font-bold relative z-10">
                <Award className="text-[#34A678] w-6 h-6" />
                25 Horas Certificadas
              </div>
              <div className="hidden md:block w-px h-8 bg-white/10 relative z-10"></div>
              <div className="flex items-center gap-3 text-white text-base font-bold relative z-10">
                <Key className="text-[#34A678] w-6 h-6" />
                Licencia Full x 3 Meses
              </div>
            </GlowCard>
          </div>

          <div className="flex justify-center">
            <a href="https://wa.me/595982369083" className="group relative bg-[#34A678] text-white px-12 py-5 rounded-full font-black text-xl hover:bg-[#EFBF04] hover:text-[#132723] transition-all duration-500 shadow-2xl flex items-center gap-4 overflow-hidden">
              <span className="group-hover:hidden transition-all">Quiero Inscribirme Ahora</span>
              <span className="hidden group-hover:block transition-all tracking-widest uppercase">¡JAHA HESE!</span>
            </a>
          </div>
        </div>
      </section>

      {/* SECCIÓN INCLUYE */}
      <section className="py-24 bg-white">
        <div className="text-center mb-16 px-6">
          <h2 className="text-3xl md:text-5xl font-black text-[#132723] mb-4 uppercase">Incluye con el Programa</h2>
          <div className="w-20 h-1.5 bg-[#34A678] mx-auto rounded-full"></div>
        </div>
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          <BenefitCard icon={<Laptop />} title="Licencia Advanced" desc="Acceso total a ArcGIS Pro por 3 meses para seguir practicando." />
          <BenefitCard icon={<Coffee />} title="Coffee Break" desc="Networking y receso incluido en jornadas presenciales." />
          <BenefitCard icon={<Database />} title="Material Premium" desc="Datasets reales de Paraguay y guías paso a paso en PDF." />
          <BenefitCard icon={<Code />} title="Business Intelligence" desc="Dashboard interactivos en tiempo real y ArcGIS para PowerBI." />
        </div>
      </section>

      {/* CRONOGRAMA */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16 text-[#132723] uppercase">Cronograma del Curso</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
            <div className="bg-white p-10 rounded-[2rem] shadow-sm border border-gray-100">
              <h3 className="text-2xl font-bold mb-8 flex items-center gap-3 text-[#132723]">
                <Video className="text-[#34A678]" /> Fase Virtual (18:00 - 21:00)
              </h3>
              <div className="space-y-4">
                <ScheduleRow date="Lunes 13 de Abril" label="Clase 1" />
                <ScheduleRow date="Miércoles 15 de Abril" label="Clase 2" />
                <ScheduleRow date="Jueves 16 de Abril" label="Clase 3" />
              </div>
            </div>

            <div className="bg-white p-10 rounded-[2rem] shadow-sm border-2 border-green-50">
              <h3 className="text-2xl font-bold mb-8 flex items-center gap-3 text-[#132723]">
                <MapPin className="text-[#34A678]" /> Fase Presencial (08:00 - 16:00)
              </h3>
              <div className="space-y-4">
                <CityRow city="Coronel Oviedo" date="Sábado 18 de Abril" />
                <CityRow city="Encarnación" date="Sábado 25 de Abril" />
                <CityRow city="Ciudad del Este" date="Sábado 02 de Mayo" />
                <CityRow city="Asunción" date="Sábado 09 de Mayo" />
              </div>
            </div>
          </div>
          
          <div className="max-w-4xl mx-auto bg-[#34A678]/5 border border-[#34A678]/20 p-8 rounded-3xl flex gap-6">
            <Info className="text-[#34A678] shrink-0" />
            <p className="text-sm text-gray-700 leading-relaxed italic">
              El paquete del curso incluye el acceso a todas las clases virtuales y la participación en una de las jornadas presenciales.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

// COMPONENTES AUXILIARES PARA LIMPIEZA
function BenefitCard({ icon, title, desc }: any) {
  return (
    <div className="p-8 bg-[#E6F4F1] rounded-[2rem] border-b-8 border-[#34A678] hover:-translate-y-2 transition-all duration-300">
      <div className="text-[#34A678] mb-6">{React.cloneElement(icon, { size: 40 })}</div>
      <h3 className="font-bold text-xl mb-3 text-[#132723]">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
    </div>
  )
}

function ScheduleRow({ date, label }: any) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-50">
      <span className="text-gray-600 font-medium">{date}</span>
      <span className="bg-[#34A678]/10 text-[#34A678] px-4 py-1 rounded-full text-xs font-bold uppercase">{label}</span>
    </div>
  )
}

function CityRow({ city, date }: any) {
  return (
    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
      <div>
        <p className="font-bold text-[#132723]">{city}</p>
        <p className="text-xs text-gray-500 italic">{date}</p>
      </div>
      <span className="bg-white text-[#34A678] px-4 py-1 rounded-full text-[10px] font-black shadow-sm border border-[#34A678]/20 uppercase">Cupos Libres</span>
    </div>
  )
}