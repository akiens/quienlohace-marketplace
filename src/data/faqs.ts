export type Faq = {
  category: string;
  question: string;
  answer: string;
};

export const FAQ_CATEGORIES = [
  "General",
  "Para clientes",
  "Para profesionales",
  "Perfiles",
  "Opiniones",
  "Planes",
] as const;

export const FAQS: Faq[] = [
  {
    category: "General",
    question: "¿Qué es QuienLoHace?",
    answer:
      "Es un directorio uruguayo de profesionales, empresas de servicios y negocios especializados. Buscás lo que necesitás, comparás perfiles y contactás directo al profesional. No intermediamos el trabajo ni cobramos comisión.",
  },
  {
    category: "General",
    question: "¿Tiene costo usar el sitio?",
    answer:
      "Para quien busca un servicio es gratis y no requiere cuenta. Para los profesionales, el perfil básico también es gratuito; más adelante habrá planes con posicionamiento destacado y landing propia.",
  },
  {
    category: "Para clientes",
    question: "¿Necesito crear una cuenta para contactar a alguien?",
    answer:
      "No. Podés buscar, filtrar, abrir perfiles y contactar por WhatsApp o teléfono sin registrarte.",
  },
  {
    category: "Para clientes",
    question: "¿Cómo elijo bien entre varios profesionales?",
    answer:
      "Mirá la calificación y la cantidad de opiniones, los servicios que ofrece, las zonas donde trabaja y los métodos de pago. Consultar a dos o tres es lo habitual antes de decidir.",
  },
  {
    category: "Para clientes",
    question: "¿Los profesionales están verificados?",
    answer:
      "El distintivo Verificado indica que validamos identidad o datos de la empresa. No es una garantía del resultado del trabajo: la responsabilidad del servicio es del profesional.",
  },
  {
    category: "Para profesionales",
    question: "¿Cómo publico mi perfil?",
    answer:
      "Entrás con Google o email, completás nombre, categoría, subcategorías, servicios, zonas de trabajo y hasta 4 imágenes. La publicación es inmediata.",
  },
  {
    category: "Para profesionales",
    question: "¿Puedo aparecer en más de una categoría?",
    answer:
      "Sí. Podés elegir hasta cinco subcategorías, idealmente las que realmente trabajás: eso mejora la coincidencia con las búsquedas.",
  },
  {
    category: "Perfiles",
    question: "¿Qué incluye el perfil gratuito?",
    answer:
      "Portada, logo o avatar, descripción corta, servicios, hasta 4 imágenes, información de contacto, zonas de trabajo, horarios, métodos de pago y opiniones.",
  },
  {
    category: "Perfiles",
    question: "¿Qué diferencia hay con un perfil destacado?",
    answer:
      "El destacado aparece primero en su categoría y en resultados, con un distintivo amarillo. Más adelante sumará una landing premium con galerías, video y bloques propios.",
  },
  {
    category: "Opiniones",
    question: "¿Quién puede dejar una opinión?",
    answer:
      "Personas que contactaron al profesional a través de la plataforma. Moderamos reseñas con lenguaje ofensivo o sin relación con el servicio.",
  },
  {
    category: "Opiniones",
    question: "¿Se pueden borrar opiniones negativas?",
    answer:
      "No se borran por pedido del profesional. Sí se eliminan si incumplen las normas o si se comprueba que son falsas.",
  },
  {
    category: "Planes",
    question: "¿Cuándo van a estar los planes de pago?",
    answer:
      "Estamos trabajando en planes con posicionamiento destacado, estadísticas y landing premium. Si te interesa, escribinos y te avisamos primero.",
  },
];
