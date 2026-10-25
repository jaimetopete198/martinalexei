/* ============================================================
   CONFIGURACIÓN · lo único que se edita por cliente (+ /assets)
   Todo lo vacío ("") se muestra como placeholder y nunca rompe la página.
   ============================================================ */
window.CLINIC = {
  name: "MARTINALEXEI",
  doctor: "Dr. Nombre Apellido",
  specialty: "Odontología estética y digital",
  cedula: "Cédula profesional 0000000",

  headline: ["Tu sonrisa,", "a tu medida."],
  subtitle: "Estética dental, sin dolor y sin sorpresas.",

  phone: "+52 33 0000 0000",
  whatsapp: "",                       // solo dígitos con lada de país (ej. 5213312345678). Vacío = oculta WhatsApp
  email: "contacto@martinalexei.mx",
  address: "Av. Ejemplo 123, Col. Centro, Guadalajara, Jal.",
  mapQuery: "Guadalajara, Jalisco",
  hoursText: "Lun–Vie 9:00–19:00 · Sáb 9:00–14:00",

  /* Paleta: Blanco + Greige + Taupe  /  Blanco + Charcoal */
  colors: {
    bg: "#FFFFFF", soft: "#F7F5F1", paper: "#F7F7F7",
    sand: "#D8D0C5", taupe: "#82786D", stone: "#B7B7B2", ink: "#292B2D"
  },

  /* Media */
  heroVideo: "assets/videos/hero.mp4",     // vertical, 8-20 s, sin audio, < 8 MB. Se reproduce solo y en loop
  smilePhoto: "assets/fotos/sonrisa-hd.jpg",   // sonrisa macro en HD (3000 px), SIN recorte
  smileMask: "assets/fotos/sonrisa-mask.png",  // máscara suave de los dientes: solo ahí cambia el tono

  /* Mapa de piezas del PNG (FDI, caja de cada diente en px del PNG). Se genera al recortar la foto. */
  teethMap: {"w":3000,"h":2000,"teeth":[{"f":21,"x0":1167,"x1":1371,"top":760,"bot":1140},{"f":11,"x0":1354,"x1":1720,"top":690,"bot":1140},{"f":12,"x0":1714,"x1":2089,"top":707,"bot":1088},{"f":13,"x0":2089,"x1":2389,"top":717,"bot":1050},{"f":14,"x0":2389,"x1":2667,"top":707,"bot":1024},{"f":15,"x0":2667,"x1":2871,"top":728,"bot":1002}]},

  sections: { smilelab: true, treatments: true, cases: true, reels: true, visit: true, doctor: true, testimonials: true, booking: true, faq: true, contact: true },

  stats: [
    { n: "12+",    t: "años de experiencia" },
    { n: "3,500+", t: "sonrisas diseñadas" },
    { n: "4.9",    t: "★ · 200+ reseñas en Google" }
  ],

  /* Casos antes/después. Para casos reales: before / after con rutas de fotos.
     Los de ejemplo (demo:true) generan el "antes" desde la misma foto y llevan etiqueta EJEMPLO. */
  cases: [
    { title: "Blanqueamiento profesional", tag: "Aclarado de 6 tonos", demo: true, src: "assets/fotos/sonrisa.jpg", crop: [0.353, 0.44, 0.2, 0.15], roi: [0.15, 0.15, 0.78, 0.7], from: 22, to: 100 },
    { title: "Blanqueamiento en consultorio", tag: "Una sola sesión", demo: true, src: "assets/fotos/blanqueamiento.jpg", crop: [0.36, 0.2, 0.46, 0.4], roi: [0.2, 0.3, 0.9, 0.78], from: 30, to: 100 },
    { title: "Mantenimiento y brillo", tag: "Tono natural", demo: true, src: "assets/fotos/post1.jpg", crop: [0, 0, 1, 1], roi: [0.12, 0.18, 0.86, 0.74], from: 35, to: 100 }
  ],

  /* ---------- REELS ----------
     El cliente puede: (1) subir su reel desde el Panel del consultorio, o
     (2) copiar el .mp4 a assets/videos/ y agregar una línea aquí.
     ig: enlace al reel original en Instagram (opcional). */
  instagram: "https://www.instagram.com/martinalexei",
  reels: [
    { title: "Colocación de carillas",  video: "assets/videos/reel1.mp4", ig: "" },
    { title: "El antes y el después",   video: "assets/videos/reel2.mp4", ig: "" },
    { title: "Una sonrisa natural",     video: "assets/videos/reel3.mp4", ig: "" },
    { title: "Elige tu tono ideal",     video: "assets/videos/reel4.mp4", ig: "" },
    { title: "Detalles que se notan",   video: "assets/videos/reel5.mp4", ig: "" },
    { title: "Sonríe sin filtros",      video: "assets/videos/reel6.mp4", ig: "" },
    { title: "Cuidado diario",          video: "assets/videos/reel7.mp4", ig: "" },
    { title: "Resultado final",         video: "assets/videos/reel8.mp4", ig: "" }
  ],
  social: [
    { name: "Instagram", handle: "@martinalexei", url: "https://www.instagram.com/martinalexei" },
    { name: "TikTok",    handle: "@martinalexei", url: "#" },
    { name: "Facebook",  handle: "MARTINALEXEI",  url: "#" }
  ],

  treatments: [
    { key: "blanq", name: "Blanqueamiento", tag: "ESTÉTICA", time: "60 min", price: "Desde $3,500", img: "assets/fotos/blanqueamiento.jpg",
      desc: "Hasta 8 tonos más claro en una sesión.",
      steps: ["Valoración y registro de tono", "Protección de encías", "Aplicación + luz LED", "Resultado el mismo día"] },
    { key: "carilla", name: "Carillas y diseño de sonrisa", tag: "ESTÉTICA", time: "2 citas", price: "Desde $6,500 / diente", img: "assets/fotos/carillas.jpg",
      desc: "Porcelana o resina, planeadas en digital.",
      steps: ["Escaneo 3D + fotos", "Vista previa de tu sonrisa", "Preparación mínima", "Colocación y ajuste"] },
    { key: "orto", name: "Ortodoncia invisible", tag: "ORTODONCIA", time: "12-24 meses", price: "Desde $1,200 / mes", img: "assets/fotos/ortodoncia.jpg",
      desc: "Alineadores transparentes. Ves el resultado en 3D.",
      steps: ["Escaneo intraoral", "Simulación del movimiento", "Entrega de alineadores", "Revisiones cada 6-8 semanas"] },
    { key: "implante", name: "Implantes dentales", tag: "CIRUGÍA", time: "3-6 meses", price: "Desde $18,000", img: "assets/fotos/implantes.jpg",
      desc: "Recupera tu diente. Natural y duradero.",
      steps: ["Tomografía y plan 3D", "Colocación del implante", "Cicatrización", "Corona definitiva"] },
    { key: "limpieza", name: "Limpieza y revisión", tag: "PREVENCIÓN", time: "45 min", price: "Desde $800", img: "assets/fotos/limpieza.jpg",
      desc: "Limpieza, diagnóstico y radiografía digital.",
      steps: ["Revisión completa", "Limpieza ultrasónica", "Pulido y flúor", "Plan de cuidado"] },
    { key: "peds", name: "Odontopediatría", tag: "NIÑOS", time: "30 min", price: "Desde $600", img: "assets/fotos/odontopediatria.jpg",
      desc: "Un ambiente pensado para los más pequeños.",
      steps: ["Visita de reconocimiento", "Revisión sin miedo", "Sellador o flúor", "Premio y stickers"] },
    { key: "endo", name: "Endodoncia", tag: "TRATAMIENTO", time: "1-2 citas", price: "Desde $3,000", img: "assets/fotos/endodoncia.jpg",
      desc: "Salvamos tu diente, sin dolor.",
      steps: ["Diagnóstico con rayos X", "Anestesia", "Limpieza de conductos", "Sellado y restauración"] },
    { key: "encia", name: "Contorno de encía", tag: "ESTÉTICA", time: "1 sesión", price: "Desde ,500", img: "assets/fotos/post4.jpg",
      desc: "Equilibramos la línea de la encía para una sonrisa armónica.",
      steps: ["Diseño digital", "Anestesia", "Contorno con láser", "Cuidados"] },
    { key: "urg", name: "Urgencias", tag: "MISMO DÍA", time: "Hoy", price: "Valoración $500", img: "assets/fotos/urgencias.jpg",
      desc: "Dolor o fractura: te atendemos hoy.",
      steps: ["Escríbenos o agenda como urgencia", "Alivio inmediato", "Diagnóstico", "Plan de solución"] }
  ],
  finance: { min: 2000, max: 60000, step: 500, months: [3, 6, 12, 18], note: "Montos referenciales. El costo final se confirma en tu valoración gratuita." },

  visit: [
    { m: "01", t: "Agendas en 1 minuto",        d: "Eliges horario y queda apartado.", img: "assets/fotos/blanqueamiento.jpg" },
    { m: "02", t: "Escaneo y diagnóstico",      d: "Escáner 3D y rayos X. Sin moldes.",                 img: "assets/fotos/endodoncia.jpg" },
    { m: "03", t: "Plan y presupuesto claros",  d: "Opciones, tiempos y costos.",                      img: "assets/fotos/doctor.jpg" },
    { m: "04", t: "Tratamiento sin dolor",      d: "Comodidad primero.",                   img: "assets/fotos/limpieza.jpg" }
  ],

  doctorBio: [
    "Rehabilitación oral y estética dental. Resultados naturales, incluso frente a una cámara."
  ],
  doctorPhoto: "assets/fotos/doctor.jpg",
  credentials: ["Universidad de Guadalajara", "Especialidad en Rehabilitación Oral", "Miembro de la ADM", "Certificado en alineadores invisibles"],
  tech: [
    { t: "Escáner 3D",   d: "Sin moldes." },
    { t: "Rayos X digitales", d: "Menos radiación." },
    { t: "Láser dental", d: "Menos molestia." },
    { t: "Esterilización clase B", d: "Estéril por paciente." }
  ],

  rating: "4.9", ratingCount: "200+ reseñas en Google",
  testimonials: [
    { name: "María G.",  text: "Me cambió la sonrisa y la confianza. Cero dolor y súper atento en todo momento.", stars: 5, treatment: "Carillas" },
    { name: "Carlos R.", text: "Llegué con una urgencia y me atendieron el mismo día. Muy profesionales.",         stars: 5, treatment: "Endodoncia" },
    { name: "Ana L.",    text: "Mi hijo le tenía miedo al dentista y ahora pide venir. ¡Gracias!",                  stars: 5, treatment: "Odontopediatría" }
  ],

  faqs: [
    { q: "¿Duele el tratamiento?", a: "Usamos anestesia tópica y técnicas suaves, así que la gran mayoría de los procedimientos se hacen sin dolor.", k: ["duele", "dolor", "anestesia"] },
    { q: "¿Cuánto cuesta un implante?", a: "Un implante inicia desde $18,000. El precio final depende de tu caso; la valoración es gratis.", k: ["implante"] },
    { q: "¿Cuánto cuesta una limpieza?", a: "La limpieza con revisión inicia desde $800.", k: ["limpieza", "profilaxis"] },
    { q: "¿Tienen planes de pago?", a: "Sí: mensualidades sin intereses con tarjetas participantes y facturación.", k: ["pago", "mensualidades", "meses", "tarjeta", "precio", "cuesta", "costo", "cuanto"] },
    { q: "¿Atienden urgencias?", a: "Sí, el mismo día. Elige 'Tengo dolor' en la agenda o escríbenos por WhatsApp.", k: ["urgencia", "urgente", "emergencia"] },
    { q: "¿Atienden niños?", a: "Sí, tenemos odontopediatría con un ambiente pensado para ellos.", k: ["nino", "ninos", "hijo", "pediatr"] },
    { q: "¿Cuánto dura el blanqueamiento?", a: "La sesión dura aproximadamente una hora y el efecto dura 1-2 años con buenos hábitos.", k: ["blanqueamiento", "blanquear"] },
    { q: "¿Cuáles son sus horarios?", a: "Lunes a viernes de 9:00 a 19:00 y sábados de 9:00 a 14:00.", k: ["horario", "hora", "abren", "cierran"] }
  ],

  /* Agenda. Día: 0=dom ... 6=sáb. [apertura, cierre] en horas. */
  schedule: { 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [9, 14] },
  slotMinutes: 60,
  leadHours: 2,        // anticipación mínima para reservar
  daysAhead: 21
};
