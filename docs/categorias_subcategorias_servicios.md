# Categorías, Subcategorías y Servicios

Este documento es la **fuente de la verdad** para cualquier validación de datos
respecto a las categorías, subcategorías y servicios de cualquier rubro que un
proveedor podrá seleccionar. De acá se genera el JSON que consume el proyecto.

---

## Notas para la UI

Este documento utiliza los términos técnicos **Categoría**, **Subcategoría** y
**Servicio**, que también pueden conservarse internamente en el código, el JSON
y la base de datos. Sin embargo, en la interfaz se deben utilizar nombres más
naturales y fáciles de comprender para el usuario:

| Término técnico | Nombre en la UI |
| --- | --- |
| Categoría | **Rubro** |
| Subcategoría | **Especialidad** |
| Servicio | **Servicio** |

Por lo tanto, la jerarquía debe presentarse en la interfaz como:

```text
Rubro  →  Especialidad  →  Servicio
```

Ejemplo:

```text
Hogar, Construcción y Mantenimiento
└── Electricidad
    └── Instalación de luminarias
```

Textos sugeridos para los formularios:

1. **¿En qué rubro trabajás?**
2. **Elegí tu especialidad.**
3. **¿Qué servicios ofrecés?**

Esta diferencia es únicamente de presentación: no modifica la taxonomía, los
identificadores, los nombres de propiedades ni las relaciones descritas en este
documento.

---

## 1. Cómo leer este documento

La taxonomía tiene tres niveles, administrados (RF-019): el proveedor
**selecciona**, nunca crea.

```text
Categoría  →  Subcategoría  →  Servicio
```

- **Categoría** (20): el rubro madre. Define la navegación y la URL
  `/categorias/<slug-categoría>`.
- **Subcategoría** (120): el oficio o especialidad. Define la URL
  `/categorias/<slug-categoría>/<slug-subcategoría>` y es lo que se persiste en
  `providers.subcategory_id`.
- **Servicio** (1174): lo concreto que el proveedor dice que hace y que la
  persona busca. Es lo que alimenta el buscador del alta.

### Formato de cada línea

```text
- Nombre canónico del servicio — alias: término1, término2, término3
```

- El **nombre canónico** es lo único que se muestra en la interfaz. Escrito en
  español natural de Uruguay, en singular y empezando por el sustantivo o la
  acción ("Instalación de aire acondicionado", no "Instalar aires").
- Los **alias** son exclusivamente términos de búsqueda: sinónimos, regionalismos,
  marcas genéricas y formas coloquiales. **Nunca se muestran** como opción
  seleccionable ni aparecen en el perfil público.
- No se crean entradas separadas para singular, plural, con o sin tilde: eso lo
  resuelve la normalización del buscador.

### Identificadores derivados

Los IDs no se escriben acá: se **derivan** al generar el JSON, para que no haya
dos verdades.

| Nivel | Fórmula | Ejemplo |
| --- | --- | --- |
| Categoría | `slugify(nombre corto)` | `hogar-y-mantenimiento` |
| Subcategoría | `<id categoría>-<slugify(nombre)>` | `hogar-y-mantenimiento-electricidad` |
| Servicio | `<id subcategoría>-<slugify(nombre)>` | `hogar-y-mantenimiento-electricidad-puesta-a-tierra` |

`slugify` normaliza a NFD, quita diacríticos, pasa a minúsculas y reemplaza todo
lo que no sea `a-z0-9` por guiones (`src/lib/slug.ts`).

> **Los IDs de categoría y subcategoría son estables y no se renombran.** Están
> escritos en las URLs indexadas y en el `subcategory_id` de cada perfil ya
> creado. Cambiar un nombre visible es aceptable; cambiar un slug rompe enlaces
> y deja perfiles huérfanos.

---

## 2. Criterios de catalogación

Reglas que se aplicaron al armar esta lista y que hay que sostener al ampliarla.

1. **Un servicio es una unidad de contratación**, no una habilidad. "Reparación
   de frenos" sí; "conocimiento de hidráulica" no.
2. **Cada servicio cuelga de exactamente una subcategoría.** Si un servicio
   parece pertenecer a dos, se elige la que corresponde a *quién lo presta*, no
   a *para qué sirve*. El descubrimiento cruzado lo resuelven los alias, no la
   duplicación.
3. **Granularidad pareja**: entre 4 y 20 servicios por subcategoría. Menos de 4
   indica que la subcategoría sobra o está mal recortada; más de 20, que
   convendría partirla.
4. **Nombres orientados a quien busca**, no a quien factura. "Destape de
   cañerías" antes que "Desobstrucción de conductos sanitarios".
5. **Alias con intención de búsqueda real**: cómo lo escribe alguien apurado en
   el celular. Incluye el nombre del oficio ("plomero", "gomero"), el
   regionalismo ("bollos", "canilla") y el error previsible.
6. **Sin marcas comerciales** como nombre canónico. Se admiten como alias
   cuando son el término de uso corriente (`PlayStation`, `Airbnb`, `Excel`).
7. **Rubros regulados**: los servicios de salud, legales, notariales, contables
   y de seguros existen en el catálogo, pero su publicación queda sujeta a la
   verificación de habilitación profesional (RF-086).

### Reglas de búsqueda que asume este catálogo

El buscador indexa, por servicio: nombre canónico, alias, nombre de
subcategoría y nombre de categoría. Antes de comparar normaliza a minúsculas,
sin tildes y sin espacios repetidos. La relevancia baja en este orden:
coincidencia exacta de nombre → prefijo de nombre → alias exacto → palabra del
nombre → prefijo de alias → nombre parcial → alias parcial → subcategoría →
categoría.

---

## 3. Índice de categorías

| # | Categoría | Nombre corto (base del slug) | Icono | Subcats | Servicios |
| --- | --- | --- | --- | --- | --- |
| 1 | Hogar, Construcción y Mantenimiento | Hogar y mantenimiento | `home_repair_service` | 11 | 153 |
| 2 | Reparaciones y Servicio Técnico | Reparaciones y servicio técnico | `handyman` | 5 | 51 |
| 3 | Limpieza y Servicios para el Hogar | Limpieza | `cleaning_services` | 4 | 34 |
| 4 | Mudanzas, Transporte y Logística | Mudanzas y transporte | `local_shipping` | 4 | 33 |
| 5 | Automotor | Automotor | `directions_car` | 6 | 60 |
| 6 | Salud | Salud | `medical_services` | 9 | 88 |
| 7 | Belleza, Estética y Bienestar | Belleza y bienestar | `content_cut` | 7 | 70 |
| 8 | Fitness y Deportes | Fitness y deportes | `fitness_center` | 5 | 48 |
| 9 | Servicios Profesionales y Empresariales | Servicios profesionales | `business_center` | 6 | 62 |
| 10 | Tecnología | Tecnología | `computer` | 5 | 54 |
| 11 | Marketing, Diseño y Comunicación | Marketing y diseño | `campaign` | 6 | 60 |
| 12 | Educación y Clases | Educación y clases | `school` | 7 | 72 |
| 13 | Eventos y Celebraciones | Eventos | `celebration` | 6 | 55 |
| 14 | Inmuebles y Propiedades | Inmuebles | `apartment` | 8 | 68 |
| 15 | Mascotas | Mascotas | `pets` | 4 | 34 |
| 16 | Cuidado Personal y Asistencia | Cuidado y asistencia | `volunteer_activism` | 3 | 24 |
| 17 | Gastronomía y Alimentación | Gastronomía | `restaurant` | 6 | 49 |
| 18 | Turismo y Experiencias | Turismo | `travel_explore` | 5 | 42 |
| 19 | Servicios Rurales | Servicios rurales | `agriculture` | 6 | 58 |
| 20 | Seguridad | Seguridad | `shield` | 7 | 59 |
| | **Total** | | | **120** | **1174** |

---

# 1. Hogar, Construcción y Mantenimiento

`hogar-y-mantenimiento` · corto: *Hogar y mantenimiento* · icono: `home_repair_service`

## 1.1. Plomería y sanitaria

`hogar-y-mantenimiento-plomeria-y-sanitaria`

- Reparación de pérdidas de agua — alias: sanitario, plomero, fuga de agua, pérdida de agua
- Destape de cañerías — alias: desobstrucción, caño tapado, desagüe tapado, destapaciones
- Instalación de cañerías — alias: tuberías, sanitaria, cañería nueva
- Reparación de cisternas — alias: cisterna pierde, mochila de baño, depósito de inodoro
- Instalación y reparación de grifería — alias: canilla, mezcladora, grifo que gotea
- Instalación de inodoros y bidés — alias: colocar inodoro, colocar bidet, sanitarios
- Instalación de lavamanos y piletas — alias: bacha, pileta de cocina, lavatorio
- Reparación de bombas de agua — alias: bomba presurizadora, bomba de agua, presurizador
- Instalación de tanque de agua — alias: depósito de agua, tanque nuevo
- Limpieza de tanque de agua — alias: desinfección de tanque, lavado de tanque
- Detección de fugas — alias: pérdida oculta, humedad por caño, geofonía
- Reparación de desagües — alias: drenaje, desagüe, pluvial
- Instalación y reparación de calefones — alias: calefón, termotanque, calentador de agua
- Instalación de sanitaria para obra nueva — alias: sanitaria de obra, cañería de obra
- Sanitario de urgencia — alias: plomero urgente, sanitaria 24 horas, plomero de emergencia

## 1.2. Electricidad

`hogar-y-mantenimiento-electricidad`

- Instalación eléctrica — alias: electricista, instalaciones eléctricas, instalación de luz
- Reparación de fallas eléctricas — alias: corto circuito, corte de luz, falla eléctrica
- Instalación y reparación de tableros eléctricos — alias: tablero, llave térmica, disyuntor
- Cambio de llaves térmicas y disyuntores — alias: térmica, diferencial, llave general
- Instalación de tomacorrientes e interruptores — alias: enchufes, llaves de luz, tomas
- Instalación de luminarias — alias: lámparas, luces, plafones, artefactos de luz
- Instalación de luces LED — alias: tiras led, iluminación led, spots led
- Cableado y recableado eléctrico — alias: cambio de cables, recableado, cables viejos
- Puesta a tierra — alias: descarga a tierra, jabalina, aterramiento
- Certificación y revisión de instalación eléctrica — alias: firma de electricista, inspección eléctrica, UTE
- Instalación de generadores — alias: grupo electrógeno, generador eléctrico
- Instalación eléctrica para obra nueva — alias: electricidad de obra
- Automatización de iluminación — alias: luces inteligentes, domótica, smart home
- Electricista de urgencia — alias: emergencia eléctrica, electricista 24 horas

## 1.3. Construcción

`hogar-y-mantenimiento-construccion`

Absorbe albañilería, obra seca, techos, impermeabilización y pisos: en la
taxonomía del sitio no tienen rubro propio y todas son obra.

- Construcción de vivienda — alias: obra nueva, albañil, construir casa
- Reformas y remodelaciones — alias: reforma de casa, renovación, remodelar
- Ampliación de vivienda — alias: ampliaciones, nuevo ambiente
- Construcción de muros — alias: pared, muro de ladrillos, levantar pared
- Revoque de paredes — alias: revocar, fino, grueso, revoque
- Contrapiso y carpetas — alias: nivelación de piso, carpeta de cemento
- Reparación de grietas y fisuras — alias: pared rajada, fisuras, grieta
- Demoliciones pequeñas — alias: tirar pared, demolición interior
- Construcción de churrasqueras — alias: parrillero, barbacoa, parrilla de material
- Construcción de pérgolas — alias: pergolado
- Construcción y reparación de veredas — alias: entrada vehicular, camino, vereda
- Construcción con steel framing — alias: estructura liviana, construcción seca
- Construcción de paredes de yeso — alias: drywall, tabiquería, yeso, durlock
- Colocación de cielorraso de yeso — alias: cielo raso, cielorraso
- Reparación de cielorrasos — alias: techo de yeso roto, cielorraso caído
- Revestimiento de paredes con yeso — alias: placas de yeso, yesería
- Molduras y terminaciones en yeso — alias: garganta de yeso, molduras
- Aislación térmica y acústica — alias: aislación de paredes, lana de vidrio, aislante acústico
- Reparación de techos — alias: gotera, techo roto, arreglo de techo
- Construcción de techo liviano — alias: techo de chapa, isopanel
- Impermeabilización de azoteas — alias: membrana, impermeabilizar techo, azotea
- Colocación de membrana asfáltica — alias: membrana para azotea
- Impermeabilización con membrana líquida — alias: pintura impermeable
- Impermeabilización de cimientos — alias: humedad de cimientos, humedad ascendente
- Reparación de goteras — alias: filtración de techo, gotera
- Colocación y reparación de canaletas — alias: canalón, desagüe pluvial
- Limpieza de canaletas — alias: canaleta tapada
- Colocación de pisos — alias: baldosas, cerámicas, porcelanato
- Colocación de cerámicas — alias: ceramista, baldosa, cerámica
- Colocación de porcelanato — alias: porcelanato, porcelanato rectificado
- Colocación de piso flotante — alias: piso laminado, flotante
- Colocación de piso vinílico — alias: vinilo, piso pvc, vinílico
- Colocación de revestimientos — alias: azulejos, revestir pared
- Microcemento — alias: piso continuo, revestimiento cementicio
- Pulido de pisos — alias: pulidor, lustrado de piso, granito
- Plastificado de parquet — alias: parquet, plastificador
- Reparación de pisos — alias: baldosas rotas, piso levantado

## 1.4. Pintura

`hogar-y-mantenimiento-pintura`

- Pintura interior — alias: pintor de interiores, pintar casa, pintor
- Pintura exterior — alias: pintar fachada, pintor exterior
- Pintura de fachadas — alias: renovación de fachada, frente de casa
- Pintura de techos — alias: techo pintado, pintar cielorraso
- Pintura de aberturas — alias: pintar puertas, pintar ventanas
- Pintura de rejas — alias: pintura de hierro, antióxido
- Enduido y preparación de paredes — alias: alisado, reparar pared antes de pintar, enduido
- Tratamiento antihumedad — alias: pintura antihumedad, manchas de humedad, humedad en pared
- Empapelado de paredes — alias: papel tapiz, wallpaper, empapelar
- Pintura decorativa — alias: efectos, texturas, estuco
- Hidrolavado previo a pintura — alias: lavado de fachada, hidrolavadora

## 1.5. Carpintería

`hogar-y-mantenimiento-carpinteria`

- Muebles a medida — alias: carpintero, mueble personalizado, muebles de madera
- Placares a medida — alias: ropero, armario empotrado, placard
- Muebles de cocina — alias: bajo mesada, aéreo de cocina, amoblamiento de cocina
- Reparación de muebles — alias: arreglo de muebles, mueble roto
- Restauración de muebles — alias: restaurador, reciclaje de muebles, mueble antiguo
- Instalación de puertas de madera — alias: colocar puerta, puerta placa
- Reparación de puertas y marcos — alias: puerta trancada, marco roto
- Colocación de estantes — alias: repisas, biblioteca, estantería
- Decks de madera — alias: piso exterior de madera, deck
- Pérgolas de madera — alias: techo liviano de madera
- Lustrado y barnizado — alias: barniz, pulido de madera, lustre
- Carpintería exterior — alias: muebles de jardín, madera para exterior

## 1.6. Herrería y metal

`hogar-y-mantenimiento-herreria-y-metal`

- Rejas a medida — alias: herrero, rejas para ventanas, reja
- Portones de hierro — alias: portón metálico, portón de hierro
- Reparación de portones — alias: arreglo de portón, portón trabado
- Automatización de portones — alias: motor de portón, portón automático
- Estructuras metálicas — alias: estructura de hierro, tinglado
- Escaleras y barandas — alias: pasamanos, baranda metálica, escalera de hierro
- Soldadura a domicilio — alias: soldador, trabajos de soldadura, soldar
- Cercas y cerramientos metálicos — alias: cerco metálico, cerramiento de hierro
- Herrería artística — alias: hierro forjado, trabajos decorativos en hierro
- Rejas de seguridad para puertas — alias: puerta reja, reja de seguridad

## 1.7. Aberturas

`hogar-y-mantenimiento-aberturas`

- Cerramientos de aluminio — alias: aluminio, cerramiento, cerramiento de balcón
- Ventanas de aluminio — alias: abertura de aluminio, ventana de aluminio
- Aberturas de PVC — alias: pvc, ventana de pvc, dvh
- Instalación de vidrios — alias: vidriería, vidriero, cambiar vidrio
- Vidrios templados y blindex — alias: blindex, mampara de vidrio, templado
- Mosquiteros a medida — alias: tela mosquitera, mosquitero
- Instalación de persianas — alias: persiana, persiana de aluminio
- Reparación de persianas — alias: persiana trabada, cinta de persiana
- Cortinas de enrollar — alias: cortina metálica, enrollable
- Instalación de cortinas y rieles — alias: barral, riel de cortina
- Reparación de aberturas — alias: ventana que no cierra, arreglo de abertura
- Colocación de mamparas de baño — alias: mampara, box de ducha

## 1.8. Climatización

`hogar-y-mantenimiento-climatizacion`

- Instalación de aire acondicionado — alias: aire, split, instalador de aire
- Reparación de aire acondicionado — alias: service de aire, técnico de aire
- Mantenimiento de aire acondicionado — alias: limpieza de aire, carga de gas
- Desinstalación y traslado de aire acondicionado — alias: mover split, sacar aire
- Reparación de estufas — alias: calefactor, estufa a gas
- Instalación de calefacción — alias: calefacción central, radiadores, losa radiante
- Mantenimiento de calderas — alias: service de caldera, caldera
- Instalación de bomba de calor — alias: calefacción por bomba de calor
- Instalación de ventilación y extractores — alias: extractor de aire, ventilación forzada
- Instalación de estufas a leña y pellet — alias: salamandra, estufa a leña, pellet

## 1.9. Jardinería

`hogar-y-mantenimiento-jardineria`

- Mantenimiento de jardines — alias: jardinero, cuidado de jardín
- Corte de césped — alias: cortar pasto, cortar césped
- Poda de árboles — alias: podador, poda en altura, podar
- Tala controlada de árboles — alias: sacar árbol, tala, extracción de árbol
- Diseño de jardines — alias: paisajismo, paisajista
- Plantación de césped — alias: panes de césped, sembrar pasto, tepes
- Instalación de riego automático — alias: sistema de riego, aspersores, riego por goteo
- Cercos y alambrados — alias: cerco perimetral, tejido, alambrado
- Desmalezado y limpieza de terrenos — alias: cortar maleza, limpiar terreno, desmalezar
- Colocación de césped sintético — alias: pasto sintético, césped artificial
- Mantenimiento de espacios verdes para empresas — alias: parquización, áreas verdes

## 1.10. Piscinas

`hogar-y-mantenimiento-piscinas`

- Construcción de piscinas — alias: piscina de material, hacer piscina, pileta
- Instalación de piscinas prefabricadas — alias: piscina de fibra, pileta prefabricada
- Mantenimiento de piscinas — alias: piscinero, cuidado de pileta
- Limpieza de piscinas — alias: limpieza de pileta, barrefondo
- Reparación de piscinas — alias: pileta que pierde, arreglo de piscina
- Tratamiento de agua de piscina — alias: cloración, química de pileta, agua verde
- Instalación y reparación de bombas y filtros — alias: filtro de pileta, bomba de piscina
- Instalación de climatización para piscinas — alias: pileta climatizada, calentar piscina
- Colocación de cobertores y lonas — alias: cobertor de pileta, lona para piscina
- Puesta a punto de temporada — alias: apertura de pileta, cierre de temporada

## 1.11. Control de plagas

`hogar-y-mantenimiento-control-de-plagas`

- Fumigación de cucarachas — alias: control de cucarachas, cucarachas
- Control de roedores — alias: desratización, ratas, ratones
- Control de hormigas — alias: fumigar hormigas, hormiguero
- Control de termitas — alias: termitas, polilla de madera
- Control de pulgas y garrapatas — alias: fumigación de pulgas, garrapatas
- Control de mosquitos — alias: fumigar mosquitos, mosquitos
- Retiro de panales y avispas — alias: abejas, avispas, panal
- Control de palomas — alias: ahuyentamiento de aves, palomas
- Desinfección de ambientes — alias: sanitización, desinfectar
- Fumigación comercial — alias: empresa de fumigación, fumigación de local
- Certificado de fumigación — alias: constancia de fumigación, libreta sanitaria

---

# 2. Reparaciones y Servicio Técnico

`reparaciones-y-servicio-tecnico` · corto: *Reparaciones y servicio técnico* · icono: `handyman`

## 2.1. Electrodomésticos

`reparaciones-y-servicio-tecnico-electrodomesticos`

- Reparación de heladeras — alias: técnico de heladera, refrigerador, heladera
- Reparación de freezers — alias: freezer, congelador
- Reparación de lavarropas — alias: técnico de lavarropas, lavadora, lavarropas
- Reparación de secarropas — alias: secadora, secarropas
- Reparación de lavavajillas — alias: lavaplatos, lavavajilla
- Reparación de cocinas y hornos — alias: cocina a gas, horno eléctrico, anafe
- Reparación de microondas — alias: técnico de microondas, microondas
- Reparación de calefones — alias: termotanque, calentador de agua, calefón
- Reparación de pequeños electrodomésticos — alias: licuadora, batidora, aspiradora, cafetera
- Instalación de electrodomésticos — alias: conexión de lavarropas, instalar cocina, empotrar horno

## 2.2. Computación

`reparaciones-y-servicio-tecnico-computacion`

Reparación de equipos y asistencia al usuario final. Los servicios de red,
servidores y ciberseguridad corporativos viven en *Tecnología · Soporte IT*.

- Reparación de computadoras — alias: técnico PC, arreglo de computadora, pc rota
- Reparación de notebooks — alias: laptop, técnico de notebook, notebook
- Cambio de pantalla de notebook — alias: display de notebook, pantalla rota
- Formateo e instalación de sistema — alias: instalar Windows, formatear PC, sistema operativo
- Instalación de programas — alias: instalar software, licencias, office
- Eliminación de virus y malware — alias: computadora con virus, ransomware
- Optimización de computadora — alias: PC lenta, acelerar notebook
- Armado de PC — alias: ensamblaje de computadora, PC gamer, armar computadora
- Actualización de hardware — alias: memoria RAM, disco SSD, upgrade
- Recuperación de datos — alias: archivos borrados, disco dañado, recuperar información
- Reparación de impresoras — alias: impresora, técnico de impresora
- Instalación de redes domésticas — alias: wifi de casa, red hogareña, router
- Soporte informático a domicilio — alias: informático a domicilio, técnico a domicilio
- Soporte informático remoto — alias: asistencia informática online, soporte remoto

## 2.3. Celulares y tablets

`reparaciones-y-servicio-tecnico-celulares-y-tablets`

- Reparación de celulares — alias: técnico de celular, smartphone, celular roto
- Cambio de pantalla de celular — alias: pantalla rota, módulo, display
- Cambio de batería de celular — alias: batería agotada, batería de celular
- Reparación de puerto de carga — alias: conector de carga, no carga
- Reparación por daño de líquidos — alias: celular mojado, se cayó al agua
- Reparación de tablets — alias: técnico de tablet, tablet
- Liberación de equipos — alias: desbloquear celular, liberar teléfono
- Recuperación de datos de celular — alias: fotos borradas, archivos del teléfono
- Configuración y respaldo de celular — alias: backup, pasar datos, migrar celular

## 2.4. Televisión y audio

`reparaciones-y-servicio-tecnico-television-y-audio`

- Reparación de televisores — alias: técnico tv, smart tv, televisor
- Instalación de TV y soportes — alias: colgar televisor, soporte de pared
- Reparación de equipos de audio — alias: parlantes, amplificador, equipo de música
- Instalación de home theater — alias: home theater, sonido envolvente
- Instalación de antenas — alias: antenista, antena digital, antena
- Configuración de televisión digital — alias: decodificador, canales digitales, TDA
- Reparación de consolas de videojuegos — alias: PlayStation, Xbox, Nintendo, consola
- Reparación de placas electrónicas — alias: electrónica, circuitos, soldadura electrónica
- Instalación de sonido para locales — alias: sonorización, audio comercial

## 2.5. Otros equipos

`reparaciones-y-servicio-tecnico-otros-equipos`

- Reparación de herramientas eléctricas — alias: taladro, amoladora, sierra
- Reparación de cortadoras de césped — alias: máquina de cortar pasto, cortadora
- Reparación de hidrolavadoras — alias: service de hidrolavadora, hidrolavadora
- Reparación de generadores — alias: grupo electrógeno, generador
- Reparación de bombas — alias: bomba eléctrica, bomba sumergible
- Mantenimiento de maquinaria liviana — alias: service de máquinas
- Reparación de equipamiento gastronómico — alias: heladera comercial, cámara de frío, horno industrial
- Reparación de máquinas de coser — alias: máquina de coser
- Reparación de bicicletas eléctricas y monopatines — alias: ebike, monopatín eléctrico, scooter

---

# 3. Limpieza y Servicios para el Hogar

`limpieza` · corto: *Limpieza* · icono: `cleaning_services`

## 3.1. Limpieza doméstica

`limpieza-limpieza-domestica`

- Limpieza de casas — alias: limpiadora, doméstica, limpieza del hogar
- Limpieza de apartamentos — alias: limpieza de apartamento
- Limpieza por horas — alias: servicio doméstico por hora, limpieza por hora
- Limpieza de cocinas — alias: desengrasado, limpieza de horno
- Limpieza de baños — alias: desinfección de baño
- Limpieza de vidrios — alias: limpiavidrios, ventanas
- Limpieza para alquileres temporarios — alias: Airbnb, recambio de huéspedes
- Limpieza de patios y balcones — alias: limpieza de exteriores, balcón

## 3.2. Limpieza profunda

`limpieza-limpieza-profunda`

- Limpieza profunda — alias: limpieza general, limpieza a fondo
- Limpieza de fin de obra — alias: limpieza posobra, limpieza de obra
- Limpieza después de mudanza — alias: limpieza de entrega, entrega de casa
- Limpieza de sillones — alias: sofá, tapizado, lavado de sillón
- Limpieza de alfombras — alias: lavado de alfombra, alfombra
- Limpieza de moquetas — alias: alfombra fija, moqueta
- Limpieza de colchones — alias: lavado de colchón, ácaros
- Limpieza de sillas tapizadas — alias: tapicería, sillas
- Limpieza de cortinas — alias: lavado de cortinas
- Limpieza de interiores de vehículos — alias: detailing interior, tapizado de auto
- Hidrolavado de superficies — alias: hidrolavadora, lavado a presión

## 3.3. Limpieza comercial

`limpieza-limpieza-comercial`

- Limpieza de oficinas — alias: empresa de limpieza, oficina
- Limpieza de locales comerciales — alias: comercio, tienda, local
- Limpieza de edificios — alias: áreas comunes, edificio, portería
- Limpieza de depósitos — alias: galpón, almacén, depósito
- Limpieza industrial — alias: fábrica, planta
- Limpieza de centros educativos — alias: colegio, escuela, instituto
- Limpieza de consultorios y clínicas — alias: clínica, consultorio, sanitización médica
- Limpieza de restaurantes y cocinas industriales — alias: restaurante, cocina comercial
- Limpieza para eventos — alias: limpieza antes y después de fiesta

## 3.4. Servicios domésticos

`limpieza-servicios-domesticos`

- Personal doméstico — alias: mucama, empleada doméstica, personal de casa
- Lavado y planchado de ropa — alias: planchadora, lavandería, planchado
- Organización de hogares — alias: orden de casa, organizador profesional, home organizer
- Cocinero a domicilio — alias: cocina doméstica, viandas en casa
- Cuidado de vivienda durante ausencias — alias: house sitting, vigilancia de casa
- Mantenimiento general del hogar — alias: marido de alquiler, arreglos varios, manitas

---

# 4. Mudanzas, Transporte y Logística

`mudanzas-y-transporte` · corto: *Mudanzas y transporte* · icono: `local_shipping`

## 4.1. Mudanzas

`mudanzas-y-transporte-mudanzas`

- Mudanza de casa — alias: empresa de mudanzas, mudanza, mudarse
- Mudanza de apartamento — alias: traslado de apartamento
- Mudanza de oficina — alias: traslado empresarial, mudanza corporativa
- Mudanza dentro de Montevideo — alias: mudanza local
- Mudanza al interior — alias: mudanza interdepartamental, mudanza nacional
- Mudanza internacional — alias: traslado internacional
- Mudanzas pequeñas — alias: mudanza chica, pocas cosas
- Embalaje para mudanza — alias: empacado, cajas, embalar
- Desarme y armado de muebles — alias: desmontaje de muebles, armar muebles
- Elevación de muebles — alias: subida por balcón, guinche, montacargas
- Guardamuebles — alias: depósito temporal, almacenamiento, guardar muebles

## 4.2. Fletes

`mudanzas-y-transporte-fletes`

- Flete pequeño — alias: camioneta, traslado chico, fletero
- Flete con camión — alias: transporte de carga, camión
- Retiro y entrega de muebles — alias: traslado de muebles, llevar mueble
- Transporte de electrodomésticos — alias: llevar heladera, llevar lavarropas
- Transporte de materiales de construcción — alias: llevar arena, materiales
- Retiro de escombros y residuos — alias: sacar escombros, volqueta, chatarra
- Transporte de mercadería — alias: carga general, mercadería

## 4.3. Logística

`mudanzas-y-transporte-logistica`

- Cadetería — alias: mandados, mensajería, cadete
- Mensajería empresarial — alias: mensajería, documentación
- Reparto de mercadería — alias: distribución, entregas, reparto
- Envíos urgentes — alias: cadetería urgente, entrega rápida, express
- Última milla para comercios — alias: delivery empresarial, ecommerce, last mile
- Distribución para comercios — alias: logística comercial, ruta de reparto
- Almacenamiento y depósito — alias: depósito de mercadería, fulfillment

## 4.4. Transporte de personas

`mudanzas-y-transporte-transporte-de-personas`

- Traslado al aeropuerto — alias: transfer Carrasco, taxi aeropuerto, aeropuerto
- Remise y traslados privados — alias: remise, auto con chofer
- Chofer particular — alias: conductor privado, chofer
- Transporte ejecutivo — alias: traslado corporativo, servicio ejecutivo
- Transporte para eventos — alias: traslado de invitados
- Transporte escolar — alias: camioneta escolar, transporte de niños
- Transporte accesible — alias: traslado en silla de ruedas, transporte adaptado
- Minibús con chofer — alias: van, traslado de grupos, combi

---

# 5. Automotor

`automotor` · corto: *Automotor* · icono: `directions_car`

## 5.1. Mecánica

`automotor-mecanica`

Incluye el taller de motos y bicicletas, que en el sitio no tiene rubro propio.

- Mecánica general — alias: mecánico, taller mecánico, arreglar auto
- Service de automóvil — alias: mantenimiento, service del auto, service
- Cambio de aceite y filtros — alias: lubricentro, cambio de aceite
- Reparación de motor — alias: motorista, motor, rectificación
- Reparación de caja y transmisión — alias: caja de cambios, transmisión, caja automática
- Reparación de frenos — alias: frenos, pastillas, discos de freno
- Reparación de embrague — alias: cambio de embrague, cloch
- Reparación de suspensión — alias: amortiguadores, tren delantero, suspensión
- Reparación del sistema de escape — alias: caño de escape, silenciador
- Reparación del sistema de refrigeración — alias: radiador, se calienta el auto
- Diagnóstico computarizado — alias: escáner automotriz, check engine, scanner
- Mecánico a domicilio — alias: auxilio mecánico, mecánico a domicilio
- Preparación para inspección técnica — alias: ITV, inspección vehicular, revisión técnica
- Reparación de motos — alias: mecánico de motos, taller de motos, moto
- Service de motos — alias: mantenimiento de moto
- Reparación de bicicletas — alias: bicicletería, mecánico de bici, bici
- Service de bicicletas — alias: mantenimiento de bicicleta
- Reparación de bicicletas eléctricas — alias: ebike, bici eléctrica

## 5.2. Electricidad automotriz

`automotor-electricidad-automotriz`

- Electricidad automotriz — alias: electricista de autos, electricista automotor
- Reparación de alternador — alias: alternador, no carga la batería
- Reparación de motor de arranque — alias: motor de arranque, burro de arranque
- Cambio de batería — alias: batería de auto, batería
- Diagnóstico electrónico automotriz — alias: computadora del auto, ECU, inyección
- Reparación de sistema de luces — alias: luces del auto, faros
- Reparación de cierre centralizado y alzacristales — alias: alzacristales, cierre centralizado
- Reparación de aire acondicionado automotriz — alias: aire del auto, carga de gas del auto

## 5.3. Neumáticos

`automotor-neumaticos`

- Gomería — alias: gomero, neumáticos, cubiertas
- Reparación de pinchazos — alias: rueda pinchada, pinchadura
- Cambio de neumáticos — alias: cubiertas, cambiar gomas
- Alineación y balanceo — alias: alinear auto, balancear ruedas, alineación
- Gomería móvil — alias: gomero a domicilio, gomería a domicilio
- Auxilio mecánico — alias: asistencia en ruta, auxilio
- Remolque de vehículos — alias: grúa, guinche, remolque
- Arranque de batería — alias: puente de batería, arrancar auto

## 5.4. Carrocería

`automotor-carroceria`

- Chapa y pintura — alias: chapista, pintor automotriz, chapa
- Reparación de abolladuras — alias: sacar bollos, desabollado, sacabollos
- Reparación de paragolpes — alias: paragolpe roto, paragolpes
- Enderezado de chasis — alias: chasis, alineación de chasis
- Restauración de vehículos — alias: restauración, auto antiguo
- Reparación y cambio de parabrisas — alias: parabrisas, vidrio del auto
- Tapicería automotriz — alias: reparación de asientos, tapizado de auto
- Reparación de capotas y techos corredizos — alias: capota, techo solar

## 5.5. Estética automotriz

`automotor-estetica-automotriz`

- Lavado de automóvil — alias: lavadero, lavado de auto, lavar el auto
- Lavado a domicilio — alias: lavadero a domicilio, lavado en seco
- Pulido de automóvil — alias: pulido de carrocería, pulir auto
- Detailing automotriz — alias: limpieza premium, estética vehicular, detailing
- Limpieza de interiores de vehículos — alias: limpieza de tapizado, interior del auto
- Tratamiento cerámico — alias: coating, protección de pintura, cerámico
- Encerado y sellado de pintura — alias: cera, sellador de pintura
- Limpieza y restauración de ópticas — alias: pulido de faros, ópticas opacas
- Lavado de motos y motocicletas — alias: lavado de moto

## 5.6. Accesorios

`automotor-accesorios`

- Instalación de alarma para vehículo — alias: alarma de auto, alarma
- Instalación de GPS y rastreo — alias: gps para auto, rastreo satelital
- Instalación de audio para automóvil — alias: radio, parlantes de auto, estéreo
- Instalación de cámaras y sensores — alias: cámara de reversa, sensor de estacionamiento
- Polarizado de vidrios — alias: lámina solar, polarizado, tintado
- Instalación de enganches y portaequipajes — alias: enganche de remolque, barras de techo
- Instalación de equipos de GNC — alias: gnc, gas natural vehicular
- Colocación de gráficas y vinilos — alias: rotulado, vinilo, wrapping
- Instalación de accesorios de seguridad — alias: barras antivuelco, protector de cárter

---

# 6. Salud

`salud` · corto: *Salud* · icono: `medical_services`

> **Rubro regulado (RF-086).** La publicación de estos servicios queda sujeta a
> la verificación de la habilitación profesional correspondiente. El catálogo
> no presenta ninguno de estos servicios como sustituto de una emergencia.

## 6.1. Medicina

`salud-medicina`

- Medicina general — alias: médico general, consulta médica, médico
- Medicina familiar — alias: médico de familia
- Pediatría — alias: pediatra, médico de niños
- Geriatría — alias: geriatra, médico de adultos mayores
- Dermatología — alias: dermatólogo, piel
- Ginecología — alias: ginecólogo, ginecóloga
- Cardiología — alias: cardiólogo, corazón
- Traumatología — alias: traumatólogo, lesiones, huesos
- Oftalmología — alias: oftalmólogo, vista, ojos
- Otorrinolaringología — alias: otorrino, oído nariz y garganta
- Endocrinología — alias: endocrinólogo, tiroides
- Consulta médica a domicilio — alias: médico a domicilio
- Telemedicina — alias: consulta médica online, médico online

## 6.2. Odontología

`salud-odontologia`

- Consulta odontológica — alias: dentista, odontólogo, odontología general
- Limpieza dental — alias: profilaxis, sarro, limpieza de dientes
- Tratamiento de caries — alias: empaste, arreglo dental, caries
- Endodoncia — alias: tratamiento de conducto, endodoncista
- Extracción dental — alias: sacar muela, extracción
- Ortodoncia — alias: brackets, alineadores, ortodoncista
- Prótesis dental — alias: dentadura, corona, prótesis
- Implantes dentales — alias: implante, implantología
- Odontología infantil — alias: dentista para niños, odontopediatría
- Blanqueamiento dental — alias: estética dental, blanquear dientes
- Urgencia odontológica — alias: dolor de muela, dentista urgente

## 6.3. Salud mental

`salud-salud-mental`

- Psicoterapia individual — alias: psicólogo, terapia, psicóloga
- Psicología infantil — alias: psicólogo para niños
- Psicología para adolescentes — alias: psicólogo de adolescentes
- Terapia de pareja — alias: psicólogo de pareja, terapia de parejas
- Terapia familiar — alias: psicología familiar
- Atención psicológica online — alias: psicólogo remoto, terapia online
- Psiquiatría — alias: psiquiatra
- Neuropsicología — alias: evaluación neuropsicológica, neuropsicólogo
- Orientación vocacional — alias: test vocacional, orientación
- Tratamiento de adicciones — alias: adicciones, consumo problemático

## 6.4. Rehabilitación

`salud-rehabilitacion`

- Fisioterapia — alias: fisioterapeuta, rehabilitación física, fisio
- Kinesiología — alias: kinesiólogo, kine
- Fisiatría — alias: fisiatra, medicina física
- Quiropraxia — alias: quiropráctico, quiropraxia
- Osteopatía — alias: osteópata
- Terapia ocupacional — alias: terapeuta ocupacional
- Psicomotricidad — alias: psicomotricista
- Rehabilitación deportiva — alias: recuperación de lesiones, readaptación
- Rehabilitación neurológica — alias: rehabilitación post ACV, neurorehabilitación
- Masaje terapéutico — alias: masoterapia, masajista terapéutico
- Rehabilitación respiratoria — alias: fisioterapia respiratoria

## 6.5. Nutrición

`salud-nutricion`

- Consulta nutricional — alias: nutricionista, dieta, plan alimentario
- Nutrición deportiva — alias: alimentación para deportistas
- Nutrición infantil — alias: nutricionista de niños
- Nutrición clínica — alias: nutrición para diabetes, celiaquía
- Plan de descenso de peso — alias: bajar de peso, adelgazar
- Nutrición vegetariana y vegana — alias: dieta vegana, alimentación vegetariana
- Asesoramiento alimentario online — alias: nutricionista online

## 6.6. Fonoaudiología

`salud-fonoaudiologia`

- Consulta fonoaudiológica — alias: fonoaudiólogo, fono
- Terapia del lenguaje — alias: retraso del habla, lenguaje
- Tratamiento de dislalias y pronunciación — alias: no pronuncia bien, dislalia
- Terapia de la voz — alias: disfonía, rehabilitación vocal
- Tratamiento de tartamudez — alias: tartamudeo, disfluencia
- Terapia de deglución — alias: disfagia, dificultad para tragar
- Estimulación del lenguaje infantil — alias: estimulación temprana, lenguaje en niños
- Evaluación y adaptación de audífonos — alias: audiometría, audífonos, sordera

## 6.7. Podología

`salud-podologia`

- Consulta podológica — alias: podólogo, cuidado de pies, podología
- Tratamiento de uñas encarnadas — alias: uña encarnada, onicocriptosis
- Tratamiento de callos y durezas — alias: callos, durezas, hiperqueratosis
- Tratamiento de hongos en uñas — alias: onicomicosis, hongos en los pies
- Pie diabético — alias: cuidado del pie diabético, diabetes
- Estudio de la pisada y plantillas — alias: plantillas ortopédicas, baropodometría
- Podología a domicilio — alias: podólogo a domicilio
- Reflexología podal — alias: masaje de pies, reflexología

## 6.8. Enfermería

`salud-enfermeria`

- Enfermería a domicilio — alias: enfermero, enfermera a domicilio
- Curaciones y control de heridas — alias: curaciones, heridas, úlceras
- Inyectables a domicilio — alias: dar inyección, inyección intramuscular
- Colocación y control de sueros — alias: suero, vía intravenosa
- Control de signos vitales — alias: presión arterial, control de presión
- Cuidados posoperatorios — alias: postoperatorio, recuperación de cirugía
- Cuidados paliativos — alias: acompañamiento paliativo
- Acompañamiento terapéutico — alias: acompañante terapéutico, AT
- Vacunación a domicilio — alias: vacunas a domicilio
- Control de sondas y catéteres — alias: sonda vesical, catéter

## 6.9. Centros de salud

`salud-centros-de-salud`

Perfiles institucionales: la organización, no la persona.

- Policlínica — alias: policlínico, centro de atención primaria
- Consultorio médico — alias: consultorio, consulta privada
- Clínica médica — alias: clínica, sanatorio
- Clínica odontológica — alias: clínica dental, centro odontológico
- Centro de rehabilitación — alias: centro de fisioterapia, rehabilitación
- Centro de diagnóstico por imagen — alias: radiografía, ecografía, resonancia
- Laboratorio de análisis clínicos — alias: laboratorio, análisis de sangre
- Centro de salud mental — alias: centro psicológico, clínica psiquiátrica
- Servicio de emergencia móvil — alias: emergencia móvil, ambulancia
- Centro de vacunación — alias: vacunatorio

---

# 7. Belleza, Estética y Bienestar

`belleza-y-bienestar` · corto: *Belleza y bienestar* · icono: `content_cut`

## 7.1. Peluquería

`belleza-y-bienestar-peluqueria`

- Corte de cabello para mujer — alias: peluquera, corte femenino, corte de pelo
- Corte de cabello para hombre — alias: peluquero, corte masculino
- Corte de cabello infantil — alias: corte para niños, peluquería infantil
- Coloración de cabello — alias: tintura, teñido, color
- Mechas y balayage — alias: reflejos, iluminación de cabello, babylights
- Peinados — alias: brushing, recogido, peinado de fiesta
- Alisado y keratina — alias: alisado progresivo, keratina, botox capilar
- Permanente y ondulado — alias: permanente, rulos
- Tratamientos capilares — alias: hidratación, reparación de cabello, nutrición capilar
- Peluquería a domicilio — alias: estilista a domicilio, peluquera a domicilio
- Extensiones de cabello — alias: extensiones, pelo largo

## 7.2. Barbería

`belleza-y-bienestar-barberia`

- Corte de barbería — alias: barbero, barbería, corte masculino
- Arreglo y perfilado de barba — alias: barba, recorte de barba
- Afeitado clásico — alias: afeitado a navaja, afeitado tradicional
- Diseño de cortes y degradados — alias: fade, degradé, freestyle
- Coloración masculina — alias: tintura para hombre, cubrir canas
- Tratamiento capilar masculino — alias: cuidado del cabello masculino
- Barbería a domicilio — alias: barbero a domicilio
- Depilación facial masculina — alias: cera para hombre, cejas masculinas

## 7.3. Uñas

`belleza-y-bienestar-unas`

- Manicura — alias: uñas, manicurista, manicura tradicional
- Esmaltado semipermanente — alias: semi, uñas semipermanentes, gel polish
- Uñas esculpidas — alias: uñas acrílicas, gel, uñas postizas
- Kapping y refuerzo de uñas — alias: kapping, endurecedor
- Pedicura — alias: cuidado de pies, pedicuría
- Nail art y decoración — alias: decoración de uñas, nail art
- Retiro de esmaltado y reparación — alias: sacar semipermanente, retiro de gel
- Manicura a domicilio — alias: manicura a domicilio, uñas a domicilio

## 7.4. Estética

`belleza-y-bienestar-estetica`

- Depilación — alias: depiladora, cera, depilación con cera
- Depilación láser — alias: láser definitivo, depilación definitiva
- Limpieza facial — alias: facial, cosmetóloga, limpieza de cutis
- Tratamientos faciales — alias: estética facial, peeling, hidratación facial
- Tratamientos corporales — alias: estética corporal, celulitis, reductores
- Extensiones de pestañas — alias: pestañas pelo por pelo, extensiones de pestañas
- Lifting de pestañas — alias: arqueado de pestañas, lifting
- Diseño de cejas — alias: perfilado, laminado de cejas, cejas
- Micropigmentación — alias: microblading, maquillaje permanente
- Maquillaje social — alias: maquilladora, maquillaje para fiesta
- Maquillaje para novias — alias: maquillaje de boda, novia
- Maquillaje a domicilio — alias: maquillista a domicilio
- Solárium y bronceado — alias: bronceado, autobronceante
- Aparatología estética — alias: radiofrecuencia, criolipólisis, ultracavitación

## 7.5. Masajes

`belleza-y-bienestar-masajes`

- Masajes relajantes — alias: masajista, relax, masaje descontracturante
- Masaje descontracturante — alias: contracturas, masaje profundo
- Masaje deportivo — alias: recuperación muscular, masaje para deportistas
- Drenaje linfático — alias: masaje linfático, drenaje
- Masaje con piedras calientes — alias: piedras calientes, hot stone
- Masaje a domicilio — alias: masajista a domicilio
- Masaje prenatal — alias: masaje para embarazadas
- Reflexología — alias: masaje de pies, reflexología podal
- Reiki — alias: terapia energética, reiki
- Aromaterapia — alias: aceites esenciales, aromaterapia
- Meditación guiada — alias: mindfulness, meditación

## 7.6. Tatuajes y piercing

`belleza-y-bienestar-tatuajes-y-piercing`

- Tatuajes — alias: tatuador, tattoo, tatuaje
- Diseño personalizado de tatuaje — alias: diseño de tattoo, boceto
- Cobertura de tatuajes — alias: cover up, tapar tatuaje
- Retoque de tatuajes — alias: retocar tatuaje
- Eliminación de tatuajes — alias: borrar tatuaje, láser para tatuajes
- Perforaciones corporales — alias: piercing, perforación
- Perforación de lóbulos — alias: agujerear orejas, aritos
- Colocación de expansiones — alias: expansiones, dilataciones
- Micropigmentación capilar — alias: tricopigmentación, tatuaje capilar

## 7.7. Centros

`belleza-y-bienestar-centros`

Perfiles institucionales: el local, no la persona.

- Salón de belleza — alias: salón, peluquería, centro de belleza
- Centro de estética — alias: centro estético, gabinete de estética
- Spa — alias: spa, día de spa
- Spa a domicilio — alias: bienestar en casa, spa móvil
- Barbershop — alias: barbería, barber shop
- Centro de depilación láser — alias: centro láser, depilación definitiva
- Centro de bronceado — alias: solárium, centro de bronceado
- Estudio de uñas — alias: nail studio, salón de uñas
- Estudio de tatuajes — alias: tattoo studio, estudio de tatuaje

---

# 8. Fitness y Deportes

`fitness-y-deportes` · corto: *Fitness y deportes* · icono: `fitness_center`

## 8.1. Entrenamiento

`fitness-y-deportes-entrenamiento`

- Entrenamiento personal — alias: personal trainer, entrenador personal, PT
- Entrenamiento funcional — alias: funcional, entrenamiento funcional
- Musculación — alias: gimnasio, pesas, musculación
- Entrenamiento en domicilio — alias: entrenador a domicilio, entrenar en casa
- Entrenamiento para adultos mayores — alias: gimnasia para mayores, actividad física adultos mayores
- Preparación física deportiva — alias: preparador físico, preparación física
- Entrenamiento online — alias: personal trainer remoto, entrenamiento virtual
- Plan de entrenamiento — alias: rutina de ejercicios, rutina personalizada
- Entrenamiento posparto y prenatal — alias: ejercicio en el embarazo, posparto

## 8.2. Gimnasios

`fitness-y-deportes-gimnasios`

Perfiles institucionales: el centro, no el entrenador.

- Gimnasio — alias: gym, gimnasio
- Centro de entrenamiento funcional — alias: box funcional, centro funcional
- Box de crossfit — alias: crossfit, box
- Estudio de pilates — alias: estudio de pilates, centro de pilates
- Centro de spinning y ciclismo indoor — alias: spinning, indoor cycling
- Gimnasio para mujeres — alias: gimnasio femenino
- Centro de artes marciales — alias: dojo, academia de artes marciales
- Piscina y natatorio — alias: natatorio, piscina climatizada

## 8.3. Yoga y pilates

`fitness-y-deportes-yoga-y-pilates`

- Clases de yoga — alias: profesor de yoga, yoga
- Hatha yoga — alias: hatha, yoga tradicional
- Vinyasa y power yoga — alias: vinyasa, power yoga
- Yoga para embarazadas — alias: yoga prenatal
- Yoga a domicilio — alias: yoga en casa, profesor de yoga a domicilio
- Yoga online — alias: clases de yoga virtuales
- Clases de pilates — alias: instructor de pilates, pilates
- Pilates reformer — alias: reformer, pilates con máquinas
- Pilates en suelo — alias: pilates mat, mat pilates
- Pilates terapéutico — alias: pilates para la espalda, pilates de rehabilitación
- Stretching y elongación — alias: elongación, flexibilidad

## 8.4. Deportes

`fitness-y-deportes-deportes`

- Masaje deportivo — alias: recuperación muscular, masaje para deportistas
- Asesoramiento de entrenamiento — alias: coaching deportivo, coach deportivo
- Arbitraje deportivo — alias: árbitro para partidos, árbitro
- Organización de torneos — alias: campeonato, evento deportivo
- Psicología deportiva — alias: psicólogo deportivo, mentalidad deportiva
- Evaluación y test físico — alias: test de esfuerzo, evaluación funcional
- Alquiler de canchas — alias: cancha de fútbol, alquiler de cancha
- Escuelas deportivas infantiles — alias: escuelita de fútbol, deporte para niños

## 8.5. Clases deportivas

`fitness-y-deportes-clases-deportivas`

- Clases de natación — alias: profesor de natación, natación
- Clases de fútbol — alias: entrenador de fútbol, escuela de fútbol
- Clases de tenis — alias: profesor de tenis, tenis
- Clases de pádel — alias: profesor de pádel, padel
- Clases de básquetbol — alias: profesor de básquet, básquet
- Clases de boxeo — alias: entrenador de boxeo, boxeo
- Clases de artes marciales — alias: karate, judo, taekwondo, jiu jitsu
- Clases de running — alias: entrenador de corredores, running
- Clases de ciclismo — alias: entrenador de ciclismo, ciclismo
- Clases de surf — alias: instructor de surf, surf
- Clases de danza y baile — alias: profesor de baile, zumba, danza
- Clases grupales de gimnasia — alias: clases grupales, gimnasia aeróbica

---

# 9. Servicios Profesionales y Empresariales

`servicios-profesionales` · corto: *Servicios profesionales* · icono: `business_center`

> **Rubro parcialmente regulado (RF-086).** Contabilidad, abogacía, escribanía
> y seguros exigen habilitación profesional verificada antes de publicar.

## 9.1. Contabilidad

`servicios-profesionales-contabilidad`

- Contabilidad para empresas — alias: contador, estudio contable, contabilidad
- Contabilidad para unipersonales — alias: contador independiente, unipersonal
- Declaración jurada — alias: impuestos, DGI, declaración
- Liquidación de impuestos — alias: DGI, IVA, IRAE, IRPF
- Liquidación de sueldos — alias: nómina, recibos de sueldo, sueldos
- Inscripción de empresa — alias: abrir empresa, unipersonal, alta de empresa
- Trámites ante BPS — alias: seguridad social, BPS
- Auditoría contable — alias: auditor, auditoría
- Estados contables — alias: balance, estados financieros
- Asesoramiento financiero — alias: finanzas empresariales, asesor financiero
- Facturación electrónica — alias: e-factura, CFE, facturación

## 9.2. Legal

`servicios-profesionales-legal`

- Asesoramiento legal — alias: abogado, consulta jurídica, abogada
- Derecho laboral — alias: abogado laboral, despido, juicio laboral
- Derecho de familia — alias: divorcio, tenencia, pensión alimenticia
- Derecho civil — alias: abogado civil
- Derecho comercial — alias: abogado de empresas, societario
- Derecho penal — alias: abogado penalista, penal
- Derecho inmobiliario — alias: contratos de alquiler, propiedad
- Sucesiones — alias: herencia, trámite sucesorio, sucesión
- Defensa del consumidor — alias: reclamo de consumo, defensa al consumidor
- Servicios notariales — alias: escribano, escribanía, escribana
- Certificación de firmas — alias: escribano público, certificar firma
- Poderes y escrituras — alias: escritura pública, poder notarial
- Procuración — alias: procurador, gestión judicial
- Mediación y conciliación — alias: mediador, conciliación

## 9.3. Administración

`servicios-profesionales-administracion`

- Administración de empresas — alias: administrador, gestión empresarial
- Gestión administrativa — alias: administrativo externo, tareas administrativas
- Facturación y cobranza — alias: administración de facturas, cobranzas
- Gestoría y trámites — alias: gestor, gestoría, trámites
- Trámites ante organismos públicos — alias: BPS, DGI, intendencia, trámites
- Asistencia virtual — alias: asistente virtual, secretaria remota
- Outsourcing administrativo — alias: tercerización administrativa, BPO
- Gestión de compras y proveedores — alias: compras, abastecimiento
- Control de inventarios — alias: stock, inventario

## 9.4. Recursos humanos

`servicios-profesionales-recursos-humanos`

- Selección de personal — alias: reclutamiento, contratar empleados, búsqueda laboral
- Evaluación psicotécnica — alias: evaluación laboral, psicotécnico
- Consultoría de recursos humanos — alias: gestión humana, RRHH
- Capacitación empresarial — alias: formación para empresas, capacitación
- Coaching ejecutivo — alias: coach empresarial, coaching
- Evaluación de desempeño — alias: evaluación de personal, performance
- Clima y cultura organizacional — alias: clima laboral, encuesta de clima
- Desvinculación y outplacement — alias: outplacement, desvinculación

## 9.5. Consultoría

`servicios-profesionales-consultoria`

- Consultoría empresarial — alias: asesor de empresas, consultor
- Plan de negocios — alias: proyecto empresarial, business plan
- Gestión de proyectos — alias: project manager, PMO
- Consultoría de procesos — alias: mejora de procesos, procesos
- Consultoría de calidad — alias: ISO, sistema de calidad, certificación
- Prevención de riesgos laborales — alias: técnico prevencionista, seguridad laboral
- Comercio exterior — alias: importación, exportación, despachante de aduana
- Consultoría ambiental — alias: gestión ambiental, impacto ambiental
- Traducción profesional — alias: traductor, traducciones
- Traducción pública — alias: traductor público, traducción certificada
- Interpretación simultánea — alias: intérprete, traducción simultánea

## 9.6. Seguros

`servicios-profesionales-seguros`

- Corredor de seguros — alias: corredor, agente de seguros
- Asesoramiento en seguros — alias: asesor de seguros, consultor de seguros
- Seguro de automóvil — alias: seguro de auto, póliza de auto
- Seguro de hogar — alias: seguro de casa, seguro del hogar
- Seguro de vida — alias: póliza de vida, seguro de vida
- Seguro de salud — alias: seguro médico, cobertura médica
- Seguros para empresas — alias: seguro comercial, seguro de responsabilidad civil
- Gestión de siniestros — alias: siniestro, reclamo de seguro
- Seguro de accidentes de trabajo — alias: BSE, accidentes laborales

---

# 10. Tecnología

`tecnologia` · corto: *Tecnología* · icono: `computer`

## 10.1. Desarrollo

`tecnologia-desarrollo`

- Desarrollo de páginas web — alias: sitio web, programador web, página web
- Desarrollo de tienda online — alias: ecommerce, comercio electrónico, tienda virtual
- Desarrollo de aplicaciones — alias: programador, software a medida, sistema
- Desarrollo de aplicaciones móviles — alias: app Android, app iOS, app
- Desarrollo de APIs e integraciones — alias: API, integración de sistemas
- Desarrollo backend — alias: backend, servidor, base de datos
- Desarrollo frontend — alias: frontend, interfaz web
- Mantenimiento de páginas web — alias: actualizar web, soporte web
- Migración y modernización de sistemas — alias: migrar sistema, legacy
- Desarrollo de sistemas de gestión — alias: ERP, CRM, sistema de gestión

## 10.2. Diseño web

`tecnologia-diseno-web`

- Diseño de sitios web — alias: diseñador web, diseño de página
- Diseño de landing pages — alias: landing page, página de aterrizaje
- Diseño UX/UI — alias: UX, UI, experiencia de usuario
- Prototipado y wireframes — alias: prototipo, mockup, wireframe
- Rediseño de sitios web — alias: renovar sitio web, rediseño
- Diseño web responsive — alias: web para celular, responsive
- Diseño de tiendas online — alias: diseño de ecommerce, diseño de tienda
- Sitios web en WordPress — alias: WordPress, wp
- Optimización de velocidad web — alias: sitio lento, performance web
- Accesibilidad web — alias: web accesible, WCAG

## 10.3. Soporte IT

`tecnologia-soporte-it`

Infraestructura y soporte corporativo. La reparación de equipos de usuario
final está en *Reparaciones y Servicio Técnico · Computación*.

- Soporte técnico para empresas — alias: mesa de ayuda, helpdesk, soporte IT
- Administración de servidores — alias: servidor empresarial, sysadmin
- Instalación de servidores — alias: servidor, montar servidor
- Redes para empresas — alias: infraestructura de red, red corporativa
- Cableado estructurado — alias: ethernet, cable UTP, cableado de red
- Instalación de redes Wi-Fi — alias: wifi, red inalámbrica, access point
- Mejora de cobertura Wi-Fi — alias: repetidor, mesh, wifi lento
- Configuración de firewall y VPN — alias: firewall, VPN, acceso remoto
- Configuración de almacenamiento NAS — alias: servidor de archivos, NAS
- Migración y respaldo en la nube — alias: cloud, backup, nube
- Ciberseguridad para empresas — alias: seguridad informática, auditoría de seguridad
- Configuración de correo corporativo — alias: email de empresa, dominio, Google Workspace
- Gestión de licencias y software — alias: licencias, Microsoft 365
- Monitoreo de infraestructura — alias: monitoreo, uptime
- Plan de continuidad y recuperación — alias: disaster recovery, contingencia

## 10.4. Datos

`tecnologia-datos`

- Administración de bases de datos — alias: DBA, base de datos, SQL
- Diseño de bases de datos — alias: modelo de datos, esquema
- Business intelligence — alias: BI, tablero, dashboard
- Análisis de datos — alias: analista de datos, data analyst
- Visualización de datos — alias: Power BI, Looker, gráficos
- Data warehouse y ETL — alias: ETL, data warehouse, pipeline de datos
- Migración de datos — alias: migrar datos, importar información
- Reportes e informes automáticos — alias: reportería, informes
- Ciencia de datos y modelos predictivos — alias: data science, machine learning

## 10.5. Servicios digitales

`tecnologia-servicios-digitales`

- Automatización de procesos — alias: integraciones, automatización empresarial, RPA
- Integración de sistemas — alias: conectar sistemas, integraciones
- Desarrollo de chatbots — alias: chatbot, bot de WhatsApp
- Soluciones con inteligencia artificial — alias: IA, inteligencia artificial, AI
- Consultoría tecnológica — alias: asesor IT, transformación digital
- Registro y gestión de dominios — alias: dominio, .uy, DNS
- Hosting y administración de servidores web — alias: hosting, alojamiento web
- Integración de medios de pago — alias: pasarela de pago, cobros online
- Firma digital y facturación electrónica — alias: firma electrónica, e-factura
- Digitalización de documentos — alias: escaneo de documentos, digitalizar

---

# 11. Marketing, Diseño y Comunicación

`marketing-y-diseno` · corto: *Marketing y diseño* · icono: `campaign`

## 11.1. Marketing

`marketing-y-diseno-marketing`

- Estrategia de marketing — alias: plan de marketing, estrategia
- Marketing digital — alias: marketing online, agencia de marketing
- Marketing para comercios locales — alias: promoción local, marketing local
- Investigación de mercado — alias: estudio de mercado, research
- Marketing de contenidos — alias: content marketing, contenidos
- Email marketing — alias: newsletters, campañas de correo, mailing
- Marketing automation — alias: automatización de marketing, embudos
- Analítica digital — alias: Google Analytics, métricas web, GA4
- Consultoría de marketing — alias: asesor de marketing, consultor de marketing
- Marketing para ecommerce — alias: marketing de tienda online

## 11.2. Social media

`marketing-y-diseno-social-media`

- Gestión de redes sociales — alias: community manager, social media, CM
- Creación de contenido para redes — alias: contenido para redes, posteos
- Estrategia de redes sociales — alias: plan de redes, estrategia social
- Producción de reels y videos cortos — alias: reels, TikTok, videos verticales
- Diseño de piezas para redes — alias: placas, artes para redes
- Gestión de comunidad y respuestas — alias: moderación, responder mensajes
- Marketing de influencers — alias: influencers, colaboraciones
- Auditoría de redes sociales — alias: análisis de redes, diagnóstico
- Gestión de perfil de Google Business — alias: Google Maps, ficha de Google

## 11.3. Publicidad digital

`marketing-y-diseno-publicidad-digital`

- Publicidad en Google — alias: Google Ads, SEM, anuncios en Google
- Publicidad en redes sociales — alias: Meta Ads, Facebook Ads, Instagram Ads
- Publicidad en TikTok — alias: TikTok Ads
- Publicidad en LinkedIn — alias: LinkedIn Ads
- Posicionamiento SEO — alias: aparecer en Google, SEO web, SEO
- SEO local — alias: aparecer en Google Maps, SEO local
- Campañas de remarketing — alias: remarketing, retargeting
- Gestión de presupuesto publicitario — alias: pauta, pauta digital
- Optimización de conversiones — alias: CRO, mejorar conversiones
- Publicidad en portales y medios — alias: pauta en medios, banners

## 11.4. Diseño

`marketing-y-diseno-diseno`

- Diseño de logotipo — alias: logo, identidad visual, logotipo
- Diseño de identidad de marca — alias: branding, manual de marca
- Diseño de tarjetas personales — alias: tarjeta de presentación, tarjetas
- Diseño de folletería — alias: flyer, folleto, volante
- Diseño de cartelería — alias: cartel, banner, señalética
- Diseño de packaging — alias: envases, etiquetas, packaging
- Diseño editorial — alias: catálogo, revista, libro
- Ilustración — alias: ilustrador, dibujo digital
- Diseño de presentaciones — alias: PowerPoint, pitch deck, presentación
- Diseño para vehículos y locales — alias: rotulado, vidrieras, gráfica
- Diseño 3D y modelado — alias: modelado 3D, render de producto

## 11.5. Audiovisual

`marketing-y-diseno-audiovisual`

- Fotografía de productos — alias: fotos para catálogo, ecommerce, foto de producto
- Fotografía corporativa — alias: fotos empresariales, fotografía institucional
- Retratos profesionales — alias: foto de perfil, headshot, book
- Fotografía inmobiliaria — alias: fotos de propiedades, fotos de casas
- Fotografía gastronómica — alias: fotos de comida, food photography
- Fotografía con dron — alias: drone, tomas aéreas, dron
- Producción de video — alias: videógrafo, filmación, video institucional
- Edición de video — alias: editor audiovisual, edición
- Videos para redes sociales — alias: reels, TikTok, contenido vertical
- Animación y motion graphics — alias: animación, motion, after effects
- Producción de spots publicitarios — alias: comercial, spot, publicidad audiovisual

## 11.6. Comunicación

`marketing-y-diseno-comunicacion`

- Redacción de contenidos — alias: redactor, copywriter, redacción
- Corrección de textos — alias: corrector, edición de texto, corrección de estilo
- Comunicación institucional — alias: prensa, relaciones públicas, RRPP
- Gestión de crisis y reputación — alias: crisis de comunicación, reputación online
- Locución — alias: voz en off, locutor, locución comercial
- Producción de podcast — alias: edición de podcast, audio, podcast
- Guion y storytelling — alias: guionista, guion, storytelling
- Comunicación interna — alias: comunicación para empleados, endomarketing
- Organización de conferencias de prensa — alias: conferencia de prensa, gacetilla

---

# 12. Educación y Clases

`educacion-y-clases` · corto: *Educación y clases* · icono: `school`

## 12.1. Apoyo académico

`educacion-y-clases-apoyo-academico`

- Apoyo escolar — alias: maestro particular, deberes, primaria
- Apoyo liceal — alias: profesor particular, secundaria, liceo
- Clases universitarias de apoyo — alias: tutor universitario, facultad
- Clases de matemática — alias: profesor de matemáticas, apoyo de matemática, mate
- Clases de física — alias: profesor de física, física
- Clases de química — alias: profesor de química, química
- Clases de biología — alias: profesor de biología, biología
- Clases de historia y geografía — alias: profesor de historia, geografía
- Clases de idioma español — alias: lengua, literatura, idioma español
- Preparación de exámenes — alias: clases para examen, previas
- Técnicas de estudio — alias: aprender a estudiar, hábitos de estudio
- Apoyo para dificultades de aprendizaje — alias: dislexia, maestra especializada

## 12.2. Idiomas

`educacion-y-clases-idiomas`

- Clases de inglés — alias: profesor de inglés, inglés particular, inglés
- Clases de portugués — alias: profesor de portugués, portugués
- Clases de francés — alias: profesor de francés, francés
- Clases de italiano — alias: profesor de italiano, italiano
- Clases de alemán — alias: profesor de alemán, alemán
- Clases de chino — alias: mandarín, chino
- Clases de español para extranjeros — alias: Spanish lessons, español para extranjeros
- Preparación de exámenes internacionales — alias: Cambridge, TOEFL, IELTS
- Conversación en idiomas — alias: práctica de conversación, conversation
- Inglés para negocios — alias: business english, inglés laboral
- Clases de lengua de señas — alias: LSU, lengua de señas

## 12.3. Tecnología

`educacion-y-clases-tecnologia`

- Clases de informática — alias: computación, PC para principiantes, informática
- Clases de programación — alias: aprender a programar, programación
- Clases de Excel — alias: planillas, Microsoft Excel, excel
- Clases de ofimática — alias: Word, Office, ofimática
- Clases de diseño gráfico — alias: Photoshop, Illustrator, diseño
- Clases de edición de video — alias: Premiere, edición audiovisual
- Clases de robótica para niños — alias: robótica, programación para niños
- Clases de inteligencia artificial — alias: IA, herramientas de IA
- Alfabetización digital para adultos mayores — alias: celular para adultos mayores, computación básica

## 12.4. Música

`educacion-y-clases-musica`

- Clases de guitarra — alias: profesor de guitarra, guitarra
- Clases de piano — alias: profesor de piano, piano
- Clases de canto — alias: profesor de canto, canto
- Clases de batería — alias: profesor de batería, batería
- Clases de bajo — alias: profesor de bajo, bajo eléctrico
- Clases de violín — alias: profesor de violín, violín
- Clases de saxofón y vientos — alias: saxo, flauta, vientos
- Clases de percusión — alias: candombe, tambor, percusión
- Clases de producción musical — alias: producción musical, home studio
- Clases de teoría musical — alias: solfeo, lenguaje musical
- Iniciación musical para niños — alias: música para niños, estimulación musical

## 12.5. Arte

`educacion-y-clases-arte`

- Clases de dibujo — alias: dibujo, aprender a dibujar
- Clases de pintura — alias: taller de pintura, pintura artística
- Clases de fotografía — alias: curso de fotografía, fotografía
- Clases de teatro — alias: actuación, teatro
- Clases de cerámica — alias: cerámica, alfarería, torno
- Clases de escultura — alias: escultura, modelado
- Clases de manualidades — alias: manualidades, artesanías
- Clases de costura y textil — alias: costura, corte y confección
- Clases de escritura creativa — alias: taller literario, escritura
- Clases de danza y expresión corporal — alias: danza, expresión corporal, baile

## 12.6. Clases profesionales

`educacion-y-clases-clases-profesionales`

- Clases de contabilidad — alias: contabilidad, apoyo de contabilidad
- Clases de marketing — alias: curso de marketing, marketing
- Clases de negocios y emprendimiento — alias: emprendedurismo, negocios
- Clases de finanzas personales — alias: finanzas, educación financiera
- Clases de manejo — alias: instructor de conducción, academia de choferes, manejar
- Clases de cocina — alias: curso de cocina, cocina
- Capacitación en atención al cliente — alias: atención al cliente, ventas
- Capacitación en oficios — alias: curso de oficio, electricidad práctica
- Preparación para concursos y oposiciones — alias: concurso, oposición
- Tutorías online — alias: clases remotas, profesor online, clases virtuales

## 12.7. Academias

`educacion-y-clases-academias`

Perfiles institucionales: el instituto, no el docente.

- Academia de idiomas — alias: instituto de inglés, academia de inglés
- Academia de conducción — alias: escuela de manejo, autoescuela
- Instituto de enseñanza — alias: instituto, centro educativo
- Centro de apoyo escolar — alias: centro de estudios, apoyo escolar
- Escuela de música — alias: conservatorio, academia de música
- Escuela de danza — alias: academia de baile, escuela de baile
- Escuela de arte — alias: taller de arte, academia de arte
- Centro de capacitación laboral — alias: capacitación, centro de formación
- Academia de informática — alias: instituto de computación, escuela de programación

---

# 13. Eventos y Celebraciones

`eventos` · corto: *Eventos* · icono: `celebration`

## 13.1. Organización

`eventos-organizacion`

- Organización de eventos — alias: organizador, productor de eventos, event planner
- Wedding planner — alias: organizador de bodas, casamiento, boda
- Coordinación de cumpleaños — alias: fiesta de cumpleaños, cumpleaños
- Organización de quinceañeros — alias: quince años, fiesta de 15
- Organización de eventos empresariales — alias: evento corporativo, evento de empresa
- Ceremonial y protocolo — alias: coordinación protocolar, protocolo
- Personal para eventos — alias: mozos, azafatas, recepción, personal
- Coordinación del día del evento — alias: coordinador del día, día B

## 13.2. Fotografía y video

`eventos-fotografia-y-video`

- Fotografía de bodas — alias: fotógrafo de casamiento, fotos de boda
- Fotografía de cumpleaños — alias: fotógrafo de fiesta, fotos de cumpleaños
- Fotografía de quinceañeros — alias: fotos de 15, book de quince
- Fotografía de eventos corporativos — alias: fotógrafo de eventos, fotos de evento
- Filmación de eventos — alias: video de boda, videógrafo, filmación
- Video con dron para eventos — alias: dron, tomas aéreas
- Transmisión en vivo de eventos — alias: streaming, transmisión online
- Fotocabina — alias: cabina de fotos, photobooth
- Edición y álbum fotográfico — alias: álbum, fotolibro

## 13.3. Música

`eventos-musica`

- DJ para eventos — alias: disc jockey, música para fiesta, dj
- Banda en vivo — alias: músicos para fiesta, banda
- Solista y músico en vivo — alias: cantante, solista, músico
- Grupo folclórico y tropical — alias: cumbia, folclore, música tropical
- Coro y música ceremonial — alias: coro, música para ceremonia
- Sonido e iluminación — alias: luces para eventos, amplificación, sonido
- Alquiler de equipos de sonido — alias: alquiler de sonido, equipo de audio
- Karaoke para eventos — alias: alquiler de karaoke, karaoke
- Pantallas LED y proyección — alias: pantalla led, proyector

## 13.4. Gastronomía

`eventos-gastronomia`

Gastronomía contratada específicamente para un evento. La oferta gastronómica
general vive en la categoría 17.

- Catering para eventos — alias: servicio de comida, catering
- Lunch y mesa de bocados — alias: bocados, mesa de lunch, lunch
- Parrillero para eventos — alias: asador, parrilla, asado
- Mesa dulce y candy bar — alias: mesa dulce, candy bar, mesa de postres
- Torta de fiesta — alias: torta de casamiento, torta de cumpleaños
- Barra de tragos para eventos — alias: bartender, coctelería, barra
- Servicio de café para eventos — alias: cafetería móvil, barista
- Servicio de mozos — alias: mozo para fiesta, mozos
- Food truck para eventos — alias: food truck, gastronomía móvil

## 13.5. Decoración

`eventos-decoracion`

- Decoración de eventos — alias: decorador de fiestas, ambientación
- Decoración con globos — alias: globos, arco de globos, globología
- Ambientación floral — alias: flores para eventos, arreglos florales
- Alquiler de mobiliario para eventos — alias: mesas, sillas, livings
- Alquiler de vajilla — alias: platos, copas, cubiertos, vajilla
- Alquiler de mantelería — alias: manteles, fundas de sillas
- Alquiler de carpas — alias: gazebo, toldo para evento, carpa
- Iluminación decorativa — alias: guirnaldas, luces de fiesta
- Diseño de invitaciones y papelería — alias: invitaciones, tarjetas de boda
- Alquiler de pisos y tarimas — alias: tarima, escenario, pista de baile

## 13.6. Entretenimiento

`eventos-entretenimiento`

- Animación infantil — alias: animador de cumpleaños, animación
- Inflables y juegos — alias: castillos inflables, entretenimiento infantil
- Magia y espectáculos — alias: mago, show, espectáculo
- Shows en vivo y performances — alias: show artístico, performance
- Metegol, mesas de juego y arcade — alias: metegol, ping pong, arcade
- Pintacaritas y maquillaje artístico — alias: pintacaritas, maquillaje infantil
- Cotillón y souvenirs — alias: cotillón, souvenirs, recuerdos
- Peloteros y juegos infantiles — alias: pelotero, plaza blanda
- Espectáculos de fuego y pirotecnia fría — alias: pirotecnia fría, chispero
- Team building y dinámicas grupales — alias: team building, dinámicas

---

# 14. Inmuebles y Propiedades

`inmuebles` · corto: *Inmuebles* · icono: `apartment`

## 14.1. Inmobiliarias

`inmuebles-inmobiliarias`

Perfiles institucionales: la empresa. El profesional individual va en
*Agentes inmobiliarios*.

- Venta de propiedades — alias: inmobiliaria, vender casa, venta de inmuebles
- Alquiler de propiedades — alias: alquilar casa, alquilar apartamento
- Alquiler temporario — alias: alquiler por temporada, temporal
- Comercialización de emprendimientos — alias: pozo, emprendimiento inmobiliario
- Venta de terrenos y campos — alias: terreno, chacra, campo
- Venta de locales y oficinas — alias: local comercial, oficina
- Gestión de garantías de alquiler — alias: garantía, ANDA, contaduría
- Contratos de alquiler — alias: contrato, contrato de arrendamiento

## 14.2. Agentes inmobiliarios

`inmuebles-agentes-inmobiliarios`

- Agente inmobiliario — alias: agente, asesor inmobiliario
- Corredor inmobiliario — alias: corredor, corretaje
- Búsqueda personalizada de propiedades — alias: buscar casa, personal shopper inmobiliario
- Asesoramiento en compraventa — alias: asesor de compra, comprar casa
- Asesoramiento para inversores — alias: inversión inmobiliaria, renta
- Captación de propiedades — alias: captación, publicar propiedad
- Negociación y cierre de operaciones — alias: negociación, cierre de venta
- Asesoramiento en alquileres — alias: asesor de alquiler

## 14.3. Administración

`inmuebles-administracion`

- Administración de alquileres — alias: gestión de propiedades, administrar alquiler
- Administración de edificios — alias: administrador de edificio, propiedad horizontal
- Administración de consorcios — alias: consorcio, copropiedad
- Gestión de cobranzas de alquiler — alias: cobrar alquiler, cobranza
- Mantenimiento de propiedades en alquiler — alias: mantenimiento de alquiler
- Gestión de alquileres temporarios — alias: Airbnb management, administración temporaria
- Rendición de cuentas y liquidaciones — alias: liquidación de alquiler, rendición
- Gestión de gastos comunes — alias: gastos comunes, expensas

## 14.4. Tasaciones

`inmuebles-tasaciones`

- Tasación de propiedades — alias: tasador, valoración inmobiliaria, tasación
- Tasación para créditos hipotecarios — alias: tasación bancaria, BHU
- Tasación de terrenos — alias: tasación de terreno, valor de terreno
- Tasación de campos — alias: tasación rural, valor de campo
- Tasación para sucesiones y divisiones — alias: tasación judicial, partición
- Informe de valor de mercado — alias: valor de mercado, precio de venta
- Tasación de locales comerciales — alias: tasación comercial

## 14.5. Arquitectura

`inmuebles-arquitectura`

- Proyecto arquitectónico — alias: arquitecto, diseño de vivienda, proyecto
- Dirección de obra — alias: arquitecto de obra, dirección técnica
- Regularización de construcciones — alias: regularizar obra, planos, final de obra
- Relevamiento y planos — alias: dibujante técnico, planos de casa
- Permiso de construcción — alias: trámite de obra, intendencia, permiso
- Diseño de interiores — alias: interiorista, decoración interior
- Render arquitectónico — alias: visualización 3D, render 3D
- Diseño de locales comerciales — alias: diseño comercial, local
- Reforma y refuncionalización — alias: reforma, refuncionalizar
- Certificado energético y sustentabilidad — alias: eficiencia energética, construcción sustentable

## 14.6. Ingeniería

`inmuebles-ingenieria`

- Ingeniería civil — alias: ingeniero civil, obra civil
- Cálculo estructural — alias: ingeniería estructural, estructura
- Estudio de suelos — alias: estudio geotécnico, suelo
- Ingeniería eléctrica de proyecto — alias: proyecto eléctrico, ingeniero electricista
- Ingeniería sanitaria de proyecto — alias: proyecto sanitario, saneamiento
- Ingeniería hidráulica — alias: hidráulica, drenaje pluvial
- Consultoría técnica de obra — alias: asesoramiento técnico, consultor de obra
- Estudio de impacto ambiental — alias: impacto ambiental, DINAMA
- Peritaje técnico — alias: perito, informe pericial
- Ingeniería de seguridad e incendios — alias: proyecto contra incendios, bomberos

## 14.7. Agrimensura

`inmuebles-agrimensura`

- Mensura de terrenos — alias: agrimensor, medir terreno, mensura
- Fraccionamiento de terrenos — alias: división de padrón, fraccionar
- Amojonamiento — alias: límites del terreno, mojones, deslinde
- Replanteo de obra — alias: replanteo, marcar obra
- Plano de propiedad horizontal — alias: propiedad horizontal, plano PH
- Relevamiento topográfico — alias: topografía, levantamiento topográfico
- Certificado de mensura — alias: plano de mensura, certificado
- Mensura rural — alias: agrimensor rural, mensura de campo

## 14.8. Inspecciones

`inmuebles-inspecciones`

- Inspección técnica de propiedades — alias: revisar casa antes de comprar, inspección
- Informe técnico de estado — alias: informe técnico, diagnóstico de vivienda
- Inspección de humedades y filtraciones — alias: humedad, filtración
- Inspección estructural — alias: revisión estructural, grietas
- Inspección de instalaciones eléctricas y sanitarias — alias: revisión de instalaciones
- Inventario de propiedad — alias: inventario para alquiler, estado de entrega
- Certificado de eficiencia energética — alias: evaluación energética, etiquetado energético
- Inspección con termografía — alias: cámara térmica, termografía
- Peritaje de siniestros — alias: perito de seguros, siniestro

---

# 15. Mascotas

`mascotas` · corto: *Mascotas* · icono: `pets`

## 15.1. Veterinaria

`mascotas-veterinaria`

- Consulta veterinaria — alias: veterinario, veterinaria, vete
- Veterinario a domicilio — alias: consulta veterinaria en casa
- Vacunación de mascotas — alias: vacunas para perro, vacunas para gato
- Castración y esterilización — alias: esterilización, castrar mascota, castración
- Desparasitación — alias: antiparasitario, desparasitar
- Cirugía veterinaria — alias: operación de mascota, cirugía
- Análisis y diagnóstico veterinario — alias: análisis de sangre, radiografía veterinaria
- Odontología veterinaria — alias: limpieza dental de mascotas
- Fisioterapia animal — alias: rehabilitación veterinaria, fisioterapia veterinaria
- Urgencia veterinaria — alias: veterinaria 24 horas, emergencia veterinaria
- Colocación de microchip — alias: microchip, identificación

## 15.2. Estética animal

`mascotas-estetica-animal`

- Peluquería canina — alias: baño y corte de perro, peluquería para perros
- Peluquería felina — alias: baño y corte de gato
- Baño de mascotas — alias: lavado de perro, bañar mascota
- Corte de uñas para mascotas — alias: uñas de perro, uñas de gato
- Limpieza de oídos y glándulas — alias: limpieza de oídos, glándulas anales
- Grooming a domicilio — alias: peluquería canina a domicilio, grooming
- Deslanado y cepillado — alias: deslanado, sacar pelo muerto
- Tratamiento antipulgas estético — alias: baño antipulgas, pipeta

## 15.3. Cuidado

`mascotas-cuidado`

- Paseo de perros — alias: paseador, dog walker, pasear perro
- Cuidado de mascotas a domicilio — alias: pet sitter, cuidador de animales
- Guardería para perros — alias: guardería canina, daycare
- Hospedaje para mascotas — alias: hotel para perros, pensionado, pensión
- Cuidado de gatos a domicilio — alias: cat sitter, cuidador de gatos
- Traslado de mascotas — alias: taxi de mascotas, transporte de mascotas
- Cuidado de mascotas con medicación — alias: dar medicación, cuidados especiales

## 15.4. Entrenamiento

`mascotas-entrenamiento`

- Adiestramiento canino — alias: entrenador de perros, adiestrador, adiestramiento
- Educación de cachorros — alias: conducta canina, cachorro
- Corrección de conducta — alias: perro agresivo, problemas de conducta
- Adiestramiento en obediencia básica — alias: obediencia, sentarse quieto
- Socialización de mascotas — alias: socializar perro
- Entrenamiento de perros de asistencia — alias: perro de asistencia, perro guía
- Adiestramiento deportivo canino — alias: agility, deporte canino
- Consulta de etología animal — alias: etólogo, etología

---

# 16. Cuidado Personal y Asistencia

`cuidado-y-asistencia` · corto: *Cuidado y asistencia* · icono: `volunteer_activism`

> Rubro sensible: exige atención especial a identidad, verificación y
> antecedentes de quien presta el servicio.

## 16.1. Cuidado de niños

`cuidado-y-asistencia-cuidado-de-ninos`

- Cuidado de niños — alias: niñera, babysitter, cuidadora de niños
- Cuidado de bebés — alias: niñera para bebé, cuidado de recién nacido
- Niñera por horas — alias: babysitting ocasional, niñera por hora
- Acompañamiento y retiro escolar — alias: llevar y buscar niños, retiro del colegio
- Apoyo familiar posparto — alias: puericultora, ayuda con recién nacido, doula
- Cuidado infantil nocturno — alias: niñera de noche
- Animación y cuidado infantil en eventos — alias: niñera para fiestas
- Cuidado de niños con necesidades especiales — alias: acompañante terapéutico infantil

## 16.2. Adultos mayores

`cuidado-y-asistencia-adultos-mayores`

- Cuidado de adultos mayores — alias: cuidador, acompañante de ancianos, cuidadora
- Acompañamiento en domicilio — alias: compañía para mayores, acompañante domiciliario
- Acompañamiento hospitalario — alias: cuidador en hospital, sanatorio
- Cuidado nocturno — alias: acompañante nocturno, cuidado de noche
- Relevo para cuidadores familiares — alias: respiro familiar, relevo
- Asistencia en actividades cotidianas — alias: higiene, alimentación, asistencia diaria
- Acompañamiento a consultas médicas — alias: llevar al médico, acompañante médico
- Estimulación cognitiva para adultos mayores — alias: memoria, estimulación cognitiva

## 16.3. Personas con dependencia

`cuidado-y-asistencia-personas-con-dependencia`

- Asistencia para personas con discapacidad — alias: cuidador personal, asistente personal
- Cuidados domiciliarios permanentes — alias: cuidado 24 horas, cuidado permanente
- Acompañamiento en actividades sociales — alias: acompañamiento social, salidas
- Apoyo en movilidad y traslados — alias: movilidad reducida, traslado asistido
- Asistencia personal a domicilio — alias: ayudante personal
- Realización de mandados — alias: compras, trámites personales, mandados
- Lectura y compañía — alias: acompañamiento, compañía
- Apoyo en rehabilitación domiciliaria — alias: ejercicios en casa, apoyo terapéutico

---

# 17. Gastronomía y Alimentación

`gastronomia` · corto: *Gastronomía* · icono: `restaurant`

> El foco es la **contratación de servicios gastronómicos**, no el directorio
> de comercios de alimentación.

## 17.1. Catering

`gastronomia-catering`

- Catering para eventos — alias: servicio de comida, catering
- Catering empresarial — alias: catering corporativo, comida para empresas
- Lunch para eventos — alias: bocados, mesa de lunch
- Catering para casamientos — alias: catering de boda
- Catering de cumpleaños — alias: comida para cumpleaños
- Catering temático — alias: catering vegano, catering sin gluten
- Servicio de mozos — alias: mozo para fiesta, mozos
- Alquiler de equipamiento gastronómico — alias: alquiler de cocina, equipamiento

## 17.2. Chef

`gastronomia-chef`

- Chef a domicilio — alias: cocinero privado, chef privado, chef
- Cena privada en casa — alias: cena a domicilio, experiencia gastronómica
- Parrillero a domicilio — alias: asador, parrillero, asado
- Cocinero para eventos — alias: cocinero, cocinera
- Clases de cocina personalizadas — alias: clase de cocina privada
- Diseño de menú gastronómico — alias: carta de restaurante, menú
- Asesoría gastronómica — alias: consultor de restaurante, asesoría de cocina
- Chef para empresas — alias: cocinero corporativo

## 17.3. Repostería

`gastronomia-reposteria`

- Tortas personalizadas — alias: torta de cumpleaños, cake, torta
- Tortas de casamiento — alias: torta de boda, wedding cake
- Repostería para eventos — alias: postres, mesa dulce
- Cupcakes y galletas decoradas — alias: cookies, cupcakes
- Panadería artesanal — alias: pan casero, masa madre
- Pastelería sin gluten — alias: celíacos, libre de gluten, sin TACC
- Repostería vegana — alias: postres veganos, repostería sin lácteos
- Postres a pedido — alias: dulces, postres caseros
- Bocaditos dulces y salados — alias: bocaditos, petit fours

## 17.4. Viandas

`gastronomia-viandas`

- Viandas semanales — alias: comida preparada, menú semanal, viandas
- Viandas saludables — alias: comida sana, dieta
- Viandas empresariales — alias: viandas para empresas, almuerzos empresariales
- Viandas para dietas especiales — alias: sin gluten, sin lactosa, diabéticos
- Menú vegetariano y vegano — alias: comida vegana, comida vegetariana
- Viandas para adultos mayores — alias: comida para adultos mayores
- Viandas deportivas — alias: comida para deportistas, meal prep
- Comidas congeladas a pedido — alias: comida congelada, freezer

## 17.5. Bebidas y eventos

`gastronomia-bebidas-y-eventos`

- Barra de tragos para eventos — alias: bartender, coctelería, barra móvil
- Servicio de café para eventos — alias: cafetería móvil, barista
- Alquiler de dispensadores de bebidas — alias: choperas, jugueras, chopera
- Cata y degustación de vinos — alias: sommelier, cata de vinos
- Cata de cervezas artesanales — alias: cerveza artesanal, degustación de cerveza
- Servicio de coctelería sin alcohol — alias: mocktails, tragos sin alcohol
- Asesoramiento en carta de bebidas — alias: carta de tragos, carta de vinos

## 17.6. Servicios móviles

`gastronomia-servicios-moviles`

- Food truck — alias: food truck, camión de comida
- Carro de comidas para eventos — alias: carrito de comida, carro
- Pizza móvil — alias: pizza a la piedra, horno móvil
- Parrilla móvil — alias: parrilla para eventos, asador móvil
- Heladería móvil — alias: carrito de helados, helados para eventos
- Carro de panchos y hamburguesas — alias: panchos, hamburguesas, panchería
- Cafetería móvil — alias: coffee truck, café móvil
- Barra móvil de tragos — alias: barra móvil, bar móvil
- Puesto de algodón de azúcar y pochoclos — alias: algodón de azúcar, pochoclos, pop corn

---

# 18. Turismo y Experiencias

`turismo` · corto: *Turismo* · icono: `travel_explore`

## 18.1. Guías

`turismo-guias`

- Guía turístico — alias: guía, guía profesional
- Guía privado — alias: guía personalizado, tour privado
- Guía turístico en Montevideo — alias: city tour, guía local, Montevideo
- Guía turístico en Colonia — alias: tour Colonia del Sacramento, Colonia
- Guía turístico en Punta del Este — alias: tour Maldonado, Punta del Este
- Guía en idiomas extranjeros — alias: guía en inglés, guía en portugués
- Guía de pesca — alias: pesca guiada, guía de pesca
- Guía de naturaleza y aves — alias: birdwatching, avistamiento de aves
- Guía de montaña y senderismo — alias: guía de trekking, senderismo

## 18.2. Tours

`turismo-tours`

- Tours urbanos — alias: city tour, recorrido por la ciudad
- Recorridos históricos — alias: tour histórico, patrimonio
- Tours gastronómicos — alias: experiencia culinaria, food tour
- Tours de bodegas — alias: enoturismo, visita a bodega, vino
- Tours culturales — alias: tour cultural, museos
- Tours temáticos — alias: tour de tango, tour de candombe
- Tours fotográficos — alias: tour de fotografía, photo tour
- Tours en bicicleta — alias: bike tour, paseo en bici
- Free tours — alias: free tour, tour a la gorra

## 18.3. Traslados

`turismo-traslados`

- Traslados turísticos — alias: transfer turístico, transfer
- Traslado desde y hacia el aeropuerto — alias: transfer Carrasco, aeropuerto
- Alquiler de vehículo con chofer — alias: chofer turístico, auto con chofer
- Traslados entre destinos — alias: traslado a Punta del Este, traslado al interior
- Traslados para grupos — alias: minibús turístico, combi turística
- Recepción de pasajeros — alias: asistencia al turista, meet and greet

## 18.4. Excursiones

`turismo-excursiones`

- Excursiones privadas — alias: paseo privado, excursión privada
- Excursiones de un día — alias: day trip, salida de un día
- Excursiones grupales — alias: excursión en grupo, salida grupal
- Excursiones a estancias — alias: turismo rural, día de campo, estancia
- Excursiones a termas — alias: termas, Salto, Daymán
- Excursiones a la costa — alias: playa, costa, Rocha
- Excursiones de naturaleza — alias: reserva natural, ecoturismo
- Actividades guiadas para grupos — alias: actividad guiada, salida educativa

## 18.5. Experiencias

`turismo-experiencias`

- Paseos a caballo — alias: cabalgata, cabalgatas
- Clases de surf — alias: instructor de surf, surf
- Paseos en kayak — alias: kayak guiado, kayak
- Senderismo guiado — alias: trekking, caminata
- Paseos en barco y náutica — alias: paseo en barco, náutico, velero
- Experiencias gastronómicas — alias: experiencia culinaria, asado uruguayo
- Experiencias de aventura — alias: tirolesa, rappel, aventura
- Turismo rural y vida de campo — alias: estancia turística, experiencia rural
- Planificación de viajes dentro de Uruguay — alias: itinerario, asesor de viaje
- Actividades para grupos y empresas — alias: team building, excursión grupal

---

# 19. Servicios Rurales

`servicios-rurales` · corto: *Servicios rurales* · icono: `agriculture`

## 19.1. Servicios agrícolas

`servicios-rurales-servicios-agricolas`

- Laboreo de suelos — alias: arado, preparación de tierra, laboreo
- Siembra — alias: sembradora, servicio de siembra, sembrar
- Cosecha — alias: cosechadora, servicio de cosecha, cosechar
- Pulverización agrícola — alias: fumigación de cultivo, pulverizadora
- Corte y enfardado — alias: fardos, pastura, enfardado
- Control de plagas agrícolas — alias: plagas de cultivo, malezas
- Fertilización y encalado — alias: fertilizante, encalado
- Movimiento de tierra — alias: retroexcavadora, tajamar, nivelación
- Riego agrícola — alias: instalación de riego rural, riego por pivot
- Silaje y reservas forrajeras — alias: silo, silaje, ensilado

## 19.2. Servicios ganaderos

`servicios-rurales-servicios-ganaderos`

- Manejo de ganado — alias: trabajo con vacunos, manejo ganadero
- Esquila — alias: esquilador, ovejas, esquila
- Inseminación artificial — alias: reproducción animal, inseminación
- Transporte de animales — alias: traslado de ganado, jaula
- Herrado de caballos — alias: herrador, equinos, herraje
- Clasificación y embarque de hacienda — alias: embarque, clasificación de ganado
- Alimentación y suplementación — alias: ración, suplementación
- Doma y trabajo con caballos — alias: domador, doma
- Control de parásitos en ganado — alias: garrapata, desparasitación de ganado

## 19.3. Veterinaria rural

`servicios-rurales-veterinaria-rural`

- Veterinaria rural — alias: veterinario de campo, veterinario rural
- Sanidad animal de rodeo — alias: sanidad animal, plan sanitario
- Vacunación de ganado — alias: vacunar ganado, aftosa, brucelosis
- Diagnóstico de gestación — alias: tacto, ecografía de vacas
- Asesoramiento reproductivo — alias: reproducción de rodeo, IATF
- Cirugía y atención veterinaria en campo — alias: cirugía de campo
- Nutrición animal — alias: nutricionista animal, dieta de ganado
- Certificados sanitarios — alias: guía de propiedad, certificado veterinario
- Atención veterinaria de equinos — alias: veterinario de caballos, equinos

## 19.4. Infraestructura rural

`servicios-rurales-infraestructura-rural`

- Alambrado rural — alias: alambrador, cerco de campo, alambrado
- Reparación de alambrados — alias: arreglo de alambrado
- Construcción de corrales y bretes — alias: brete, corral, manga
- Construcción de galpones rurales — alias: galpón, tinglado rural
- Perforación de pozos de agua — alias: pozo semisurgente, perforista, pozo
- Instalación de bombas y molinos — alias: molino de viento, bomba de campo
- Construcción y limpieza de tajamares — alias: tajamar, represa
- Caminería rural — alias: camino de campo, caminería
- Instalación de energía solar rural — alias: paneles solares, energía solar
- Electrificación rural — alias: electricidad de campo, línea rural
- Asesoramiento agronómico — alias: ingeniero agrónomo, agrónomo
- Gestión de establecimientos rurales — alias: administración de campo, gestión de campo

## 19.5. Maquinaria agrícola

`servicios-rurales-maquinaria-agricola`

- Contratación de maquinaria agrícola — alias: tractor, maquinaria rural, contratista
- Reparación de maquinaria agrícola — alias: mecánico agrícola, arreglo de tractor
- Mantenimiento de maquinaria agrícola — alias: service de tractor, mantenimiento
- Reparación de implementos — alias: sembradora, arado, implementos
- Alquiler de tractores — alias: alquiler de tractor
- Alquiler de retroexcavadoras — alias: retro, excavadora, alquiler de máquina
- Operación de maquinaria — alias: operario de máquina, tractorista
- Hidráulica y soldadura agrícola — alias: hidráulica, soldadura de campo
- Repuestos y asistencia en campo — alias: mecánico a domicilio rural

## 19.6. Apicultura

`servicios-rurales-apicultura`

- Servicios apícolas — alias: apicultor, apicultura
- Manejo de colmenas — alias: colmenas, manejo apícola
- Instalación de apiarios — alias: apiario, colmenar
- Extracción de miel — alias: cosecha de miel, extracción
- Sanidad apícola — alias: varroa, sanidad de colmenas
- Polinización con colmenas — alias: servicio de polinización, polinización
- Cría de reinas y núcleos — alias: reinas, núcleos, cría
- Retiro y traslado de enjambres — alias: enjambre, mudanza de colmenas
- Asesoramiento apícola — alias: asesor apícola, consultoría apícola

---

# 20. Seguridad

`seguridad` · corto: *Seguridad* · icono: `shield`

## 20.1. Seguridad privada

`seguridad-seguridad-privada`

- Servicio de vigilancia — alias: guardia de seguridad, vigilante, vigilancia
- Seguridad para eventos — alias: control de acceso en fiestas, seguridad de evento
- Custodia de personas — alias: guardaespaldas, custodio
- Custodia de mercadería y traslados — alias: custodia de carga, traslado de valores
- Seguridad para obras y depósitos — alias: sereno, guardia de obra
- Portería y control de ingreso — alias: portero, recepción de seguridad
- Rondas y patrullaje — alias: patrullaje, rondín
- Asesoría en seguridad — alias: evaluación de riesgos, consultoría de seguridad
- Sistemas contra incendios — alias: detección de incendio, alarma de humo, incendios
- Instalación y mantenimiento de extintores — alias: matafuegos, recarga de extintor, extintores

## 20.2. Alarmas

`seguridad-alarmas`

- Instalación de alarmas — alias: alarma para casa, alarma comercial, alarma
- Mantenimiento de sistemas de alarma — alias: service de alarma
- Reparación de alarmas — alias: alarma no funciona
- Monitoreo de alarmas — alias: respuesta de alarma, central de monitoreo
- Instalación de sensores y detectores — alias: sensor de movimiento, detector
- Botón antipánico — alias: botón de pánico, antipánico
- Alarmas comunitarias — alias: alarma vecinal, alarma de barrio
- Alarmas para vehículos y maquinaria — alias: alarma de auto, alarma de máquina

## 20.3. Cámaras

`seguridad-camaras`

- Instalación de cámaras de seguridad — alias: CCTV, videovigilancia, cámaras
- Configuración de cámaras IP — alias: cámara wifi, cámara remota, cámara IP
- Mantenimiento de sistemas de videovigilancia — alias: service de cámaras
- Reparación de cámaras de seguridad — alias: cámara no funciona
- Instalación de grabadores DVR y NVR — alias: DVR, NVR, grabador
- Configuración de acceso remoto a cámaras — alias: ver cámaras del celular, acceso remoto
- Cámaras para comercios — alias: cámaras de local, videovigilancia comercial
- Cámaras con analítica y reconocimiento — alias: reconocimiento facial, analítica de video

## 20.4. Control de acceso

`seguridad-control-de-acceso`

- Instalación de control de acceso — alias: tarjeta, huella, acceso electrónico
- Sistemas biométricos — alias: lector de huella, biometría
- Control de acceso vehicular — alias: barrera, talanquera, acceso vehicular
- Instalación de portones automáticos — alias: portón automático, motor de portón, acceso vehicular
- Molinetes y torniquetes — alias: molinete, torniquete
- Control de asistencia de personal — alias: reloj de fichar, control horario
- Cerraduras electrónicas y digitales — alias: cerradura digital, cerradura inteligente
- Intercomunicadores — alias: intercomunicador, interfón
- Integración de sistemas de acceso — alias: integración de accesos, gestión de accesos

## 20.5. Cercos eléctricos

`seguridad-cercos-electricos`

- Instalación de cercos eléctricos — alias: cerco eléctrico, cerca eléctrica
- Reparación de cercos eléctricos — alias: cerco no funciona
- Mantenimiento de cercos eléctricos — alias: service de cerco eléctrico
- Instalación de concertinas — alias: concertina, alambre de púa
- Cercos perimetrales de seguridad — alias: cerco perimetral, perímetro
- Cercos eléctricos rurales — alias: boyero, cerco eléctrico de campo
- Sistemas de detección perimetral — alias: detección perimetral, barrera infrarroja

## 20.6. Cerrajería

`seguridad-cerrajeria`

- Cerrajero a domicilio — alias: cerrajero, abrir puerta, cerrajería
- Apertura de puertas — alias: llave adentro, puerta trancada
- Cambio de cerraduras — alias: cerradura nueva, cambiar cerradura
- Reparación de cerraduras — alias: cerradura rota, cerradura trabada
- Copia y codificación de llaves — alias: duplicado de llave, copia de llave
- Cerrajería automotriz — alias: llave de auto, abrir auto, llave codificada
- Instalación de cerraduras de seguridad — alias: cerradura multipunto, cerradura de seguridad
- Instalación de cerraduras inteligentes — alias: cerradura digital, smart lock
- Apertura de cajas fuertes — alias: caja fuerte, abrir caja de seguridad
- Cerrajero de urgencia — alias: cerrajero 24 horas, cerrajero urgente

## 20.7. Porteros y videoporteros

`seguridad-porteros-y-videoporteros`

- Instalación de porteros eléctricos — alias: portero eléctrico, portero
- Instalación de videoporteros — alias: portero eléctrico con cámara, videoportero
- Reparación de porteros eléctricos — alias: portero no funciona, arreglo de portero
- Mantenimiento de porteros para edificios — alias: service de portero, portero de edificio
- Instalación de timbres inalámbricos — alias: timbre inalámbrico, timbre
- Videoporteros con conexión a celular — alias: portero al celular, videoportero wifi
- Sistemas de portería para consorcios — alias: portería de edificio, sistema de portería

---

# Anexo A — Cobertura y trazabilidad

## A.1. Estado respecto del catálogo anterior

Este documento **reemplaza** a `projects/quienlohace-marketplace/docs/catalogo-servicios.md`
como fuente de la verdad.

El catálogo anterior estaba escrito contra una división de subcategorías propia
que **no** era la del sitio, y se aplanaba con la tabla `MAPPING` de
`scripts/generate-services.ts`. El efecto de ese aplanamiento era que **45 de
las 120 subcategorías reales quedaban sin un solo servicio**: sus páginas
`/categorias/<categoría>/<subcategoría>` existían pero no ofrecían nada que
seleccionar en el alta.

Las subcategorías que estaban vacías y ahora tienen servicios propios:

| Categoría | Subcategorías que estaban vacías |
| --- | --- |
| Hogar y mantenimiento | Aberturas, Piscinas |
| Reparaciones y servicio técnico | Computación |
| Mudanzas y transporte | Logística |
| Automotor | Estética automotriz, Accesorios |
| Salud | Fonoaudiología, Podología, Enfermería, Centros de salud |
| Belleza y bienestar | Barbería, Tatuajes y piercing, Centros |
| Fitness y deportes | Gimnasios, Yoga y pilates |
| Servicios profesionales | Administración, Seguros |
| Tecnología | Diseño web, Datos, Servicios digitales |
| Marketing y diseño | Social media, Publicidad digital |
| Educación y clases | Tecnología, Arte, Academias |
| Eventos | Música, Gastronomía |
| Inmuebles | Agentes inmobiliarios, Administración, Tasaciones, Ingeniería, Inspecciones |
| Mascotas | Entrenamiento |
| Gastronomía | Chef, Viandas, Servicios móviles |
| Turismo | Tours, Excursiones |
| Servicios rurales | Veterinaria rural, Maquinaria agrícola, Apicultura |
| Seguridad | Cámaras, Control de acceso, Cercos eléctricos, Porteros y videoporteros |

Ningún servicio del catálogo anterior se perdió: los 633 existentes están todos
acá, reubicados en la subcategoría que les corresponde en la taxonomía real.

## A.2. Consecuencia para el generador

Como este documento ya está escrito contra las subcategorías reales del sitio,
**la tabla `MAPPING` deja de ser necesaria**: cada bloque `##` declara su propio
`subcategory_id` en la línea de código que le sigue. El generador debe leer ese
identificador en lugar de traducir nombres.

Antes de reemplazar el JSON hay que verificar que ningún perfil ya publicado
quede apuntando a un servicio que cambió de subcategoría. Los servicios se
guardan por nombre en `provider_services` (texto), así que el riesgo real está
acotado a `providers.subcategory_id`, que este documento **no** modifica: las
120 subcategorías y sus slugs son exactamente los de `src/data/categories.ts`.

## A.3. Reubicaciones respecto del JSON actual

Servicios que cambian de subcategoría al adoptar este documento:

| Servicio | Antes | Ahora |
| --- | --- | --- |
| Reparación de computadoras, de notebooks, formateo, virus, armado de PC, actualización de hardware, recuperación de datos, optimización, soporte a domicilio y remoto | `tecnologia-soporte-it` | `reparaciones-y-servicio-tecnico-computacion` |
| Lavado, pulido, detailing, tratamiento cerámico, polarizado | `automotor-carroceria` | `automotor-estetica-automotriz` / `automotor-accesorios` |
| Instalación de alarma, GPS, audio, cámaras y sensores para vehículo | `automotor-electricidad-automotriz` | `automotor-accesorios` |
| Masajes relajantes, drenaje linfático | `belleza-y-bienestar-estetica` | `belleza-y-bienestar-masajes` |
| Reiki, reflexología, aromaterapia, meditación | `belleza-y-bienestar-masajes` | se mantienen en Masajes |
| Cadetería, envíos urgentes, última milla, reparto de mercadería | `mudanzas-y-transporte-fletes` | `mudanzas-y-transporte-logistica` |
| Clases de yoga y de pilates | `fitness-y-deportes-clases-deportivas` | `fitness-y-deportes-yoga-y-pilates` |
| Fonoaudiología | `salud-rehabilitacion` | `salud-fonoaudiologia` |
| Podología | `salud-nutricion` | `salud-podologia` |
| Enfermería a domicilio, inyectables, curaciones, acompañamiento terapéutico | `salud-nutricion` | `salud-enfermeria` |
| Gestión de redes sociales, creación de contenido | `marketing-y-diseno-marketing` | `marketing-y-diseno-social-media` |
| Publicidad en Google, en redes, SEO, remarketing | `marketing-y-diseno-marketing` | `marketing-y-diseno-publicidad-digital` |
| Redes Wi-Fi, cableado, routers, NAS, servidores | `tecnologia-soporte-it` | se reparten entre Soporte IT (empresa) y Computación (hogar) |
| DJ, banda, sonido e iluminación, karaoke | `eventos-entretenimiento` | `eventos-musica` |
| Clases de informática, programación, Excel | `educacion-y-clases-clases-profesionales` | `educacion-y-clases-tecnologia` |
| Clases de dibujo y pintura, fotografía, teatro | `educacion-y-clases-musica` | `educacion-y-clases-arte` |
| Tasación de propiedades | `inmuebles-inmobiliarias` | `inmuebles-tasaciones` |
| Inspección técnica, inventario, certificado energético | `inmuebles-agrimensura` | `inmuebles-inspecciones` |
| Chef a domicilio, parrillero, diseño de menú, asesoría gastronómica | `gastronomia-catering` / `gastronomia-bebidas-y-eventos` | `gastronomia-chef` |
| Viandas semanales, saludables, menú vegetariano | `gastronomia-catering` | `gastronomia-viandas` |
| Adiestramiento canino, educación de cachorros | `mascotas-cuidado` | `mascotas-entrenamiento` |
| Cámaras de seguridad, cámaras IP | `seguridad-alarmas` | `seguridad-camaras` |
| Control de acceso | `seguridad-alarmas` | `seguridad-control-de-acceso` |
| Videoporteros | `seguridad-alarmas` | `seguridad-porteros-y-videoporteros` |
| Cercas eléctricas | `seguridad-seguridad-privada` | `seguridad-cercos-electricos` |

## A.4. Reglas para ampliar este documento

1. **Nunca renombrar ni reordenar** una categoría o subcategoría existente sin
   una migración explícita: el slug está en URLs indexadas y en
   `providers.subcategory_id`.
2. Agregar un servicio es seguro: se añade la línea en el bloque `##` que
   corresponde y se regenera el JSON.
3. Eliminar un servicio **no** es seguro sin revisar `provider_services`: hay
   perfiles que pueden tenerlo declarado por nombre.
4. Antes de crear una subcategoría nueva, verificar que no sea un servicio
   dentro de una existente. La subcategoría es un oficio; el servicio, una
   contratación.
5. Todo servicio nuevo entra con al menos un alias, salvo que su nombre
   canónico ya sea el término exacto que se busca.

## A.5. Forma esperada del JSON

```json
[
  {
    "id": "hogar-y-mantenimiento-electricidad-puesta-a-tierra",
    "categoryId": "hogar-y-mantenimiento",
    "subcategoryId": "hogar-y-mantenimiento-electricidad",
    "name": "Puesta a tierra",
    "aliases": ["descarga a tierra", "jabalina", "aterramiento"]
  }
]
```

`categoryId` es derivable de `subcategoryId`, pero incluirlo evita que cada
consumidor tenga que resolver la pertenencia por su cuenta.
