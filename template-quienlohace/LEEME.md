# QuienLoHace — Template completa

Marketplace/directorio uruguayo de profesionales. Este paquete contiene la plantilla
navegable completa, el código fuente y el set de marca.

---

## 1. Plantilla lista para abrir

`QuienLoHace-template-completa.html`

Un solo archivo autocontenido (sin internet, sin servidor): se abre con doble clic en
cualquier navegador. Incluye las 11 páginas navegables:

1. Inicio
2. Destacados
3. Resultados de búsqueda
4. Categoría
5. Subcategoría
6. Perfil del proveedor
7. Cómo funciona
8. Sobre nosotros
9. Contacto
10. Preguntas frecuentes
11. Login

Y los componentes globales: header sticky con mega-menú de 20 categorías, buscador
global (ubicación jerárquica Departamento → Localidad → Barrio, categoría,
filtros), panel de filtros (drawer en desktop / bottom sheet en mobile), card de
proveedor, footer negro chocolate.

**Estados incluidos:** resultados, sin resultados, filtros activos, proveedor
destacado / normal / sin opiniones, loading con skeletons, formulario enviado y
error de validación.

**Desktop / Mobile:** el pill flotante inferior alterna entre vista desktop y un
encuadre mobile de 430px. También responde al ancho real de la ventana
(modo compacto por debajo de 1120px).

---

## 2. Sistema visual

| Rol | Valor |
| --- | --- |
| Azul marca (oscuro) | `#182D53` |
| Azul marca | `#20375F` · `#30466F` · `#455D88` |
| Gradiente de marca | `linear-gradient(180deg,#455D88 0%,#182D53 100%)` |
| Header | `linear-gradient(90deg,#101F3C,#1B3055 42%,#3A5081)` |
| Amarillo acento | `#F4C542` (hover `#E9B92F`) |
| Fondo | `#F7F8FA` · Superficie `#FFFFFF` |
| Texto | `#172033` primario · `#667085` secundario |
| Borde | `#E4E7EC` |
| Footer | `#1D1815` · texto `#B8B1AC` |
| WhatsApp / verificado | `#25A366` |

Proporción de uso: ~75% neutros / 20% azul / 5% amarillo.

**Tipografía:** Inter (400/500/600/700/800).
**Radios:** 10px inputs · 12–14px cards · 999px pills.
**Iconos:** Material Symbols Outlined, un icono propio y constante por categoría.

---

## 3. Marca (`/brand`)

**Logo completo (aro QH + wordmark + subtítulo)**
- `logo-full-light.svg` — versión clara, para fondos oscuros (vector)
- `logo-full-light@2x.png` — PNG transparente 1650×400
- `logo-full-light-navybg.jpg` — JPG sobre azul de marca
- `logo-full-navy.svg` — versión azul, para fondos claros (vector)
- `logo-full-navy@2x.png` — PNG transparente 1650×400
- `logo-full-navy.jpg` — JPG sobre blanco

**Piezas sueltas**
- `logo-mark.svg` — solo el aro con QH (vector)
- `logo-mark-light.png` — 600×600 transparente
- `logo-word.svg` — solo el wordmark QuienLoHace

**Favicon circular (aro QH sobre disco azul)**
- `favicon.svg` — vector, el que usa el sitio
- `favicon-32.png`, `favicon-64.png`, `favicon-180.png` (Apple touch),
  `favicon-192.png`, `favicon-512.png` — transparentes
- `favicon-512.jpg` — con fondo azul

**Redes / mensajería (imagen cuadrada, sin transparencia)**
- `perfil-whatsapp-1000.jpg` — 1000×1000, ideal para foto de perfil de WhatsApp
  Business y firma de Gmail
- `perfil-whatsapp-1000.png` — misma pieza en PNG transparente

Uso: en el header y el footer va la versión clara; sobre blanco, la azul. El
subtítulo "Conectamos clientes y profesionales" siempre centrado respecto al
wordmark y de menor ancho que él.

---

## 4. Código fuente (`/fuente`)

Componentes separados, listos para portar a React/Next.js + TypeScript + Tailwind:

- `QuienLoHace.dc.html` — páginas, datos mock (taxonomía de 20 categorías,
  19 departamentos con localidades y barrios, 19 proveedores) y navegación
- `SiteHeader.dc.html` — header, mega-menú, drawer mobile
- `SearchPanel.dc.html` — buscador global (variantes hero y compacta)
- `FiltersPanel.dc.html` — panel de filtros completo
- `ProviderCard.dc.html` — card de proveedor (1 proveedor = 1 card)
- `SiteFooter.dc.html` — footer global
- `support.js` — runtime necesario para abrir los `.dc.html` sueltos
- logos y favicon que referencian los componentes

Todos los estilos son inline, así que cada bloque se traduce directamente a
clases de Tailwind.

---

## 5. Reglas de producto reflejadas en la plantilla

- 1 proveedor = 1 card, aunque ofrezca varios servicios.
- Home: ~6 cards por sección; listados largos van en Resultados / Categoría /
  Subcategoría / Destacados, con 12 iniciales y "Mostrar 12 más" (sin scroll infinito).
- Ubicación multiselect, máximo 5, con chips legibles ("Pocitos, Montevideo") y
  opción "Usar mi ubicación" que deshabilita la selección manual.
- Categorías/subcategorías y servicios: máximo 5 selecciones.
- La ubicación del profesional es distinta de las zonas donde trabaja (visible en el perfil).
- Perfil gratuito: portada, avatar, descripción corta, servicios, hasta 4 imágenes,
  info de contacto, zonas, horarios, pagos y opiniones (5 visibles + "Ver más").
- Espacio publicitario nativo, siempre rotulado, después de mostrar valor.

© 2026 QuienLoHace
