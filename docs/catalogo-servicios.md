# Catálogo inicial de servicios — QuienLoHace

> Fuente del selector de servicios del alta. `src/data/services.json` se genera
> desde acá con `npx tsx scripts/generate-services.ts`: este documento manda,
> el JSON es el resultado.

## Criterios del catálogo

- Mantiene las 20 categorías principales definidas para QuienLoHace.
- Utiliza tres niveles: **categoría → subcategoría → servicio**.
- Cada servicio representa algo concreto que una persona puede buscar o que un proveedor puede ofrecer.
- Los nombres canónicos están escritos en español natural para Uruguay.
- Los alias ayudan a encontrar resultados con términos alternativos, regionales, sinónimos o errores previsibles.
- Conviene normalizar la búsqueda ignorando mayúsculas, tildes y diferencias de singular/plural.
- Los alias son términos de búsqueda: no necesitan mostrarse como opciones independientes.

## Sobre las subcategorías de este documento

Las subcategorías de acá abajo son las del catálogo, y **no** son las que usa
el sitio: agrupan distinto y abren rubros que la taxonomía de
`src/data/categories.ts` no tiene ("Yeso, cielorrasos y construcción en seco",
"Techos e impermeabilización"). La correspondencia entre unas y otras vive en
la tabla `MAPPING` de `scripts/generate-services.ts`, que es lo que hay que
tocar cuando este documento crezca.

---

# 1. Hogar, Construcción y Mantenimiento

## Electricidad

- Instalación eléctrica — alias: electricista, instalaciones eléctricas, instalación de luz
- Reparación de fallas eléctricas — alias: corto circuito, corte de luz, falla eléctrica
- Instalación y reparación de tableros eléctricos — alias: tablero, llave térmica, disyuntor
- Cambio de llaves térmicas y disyuntores — alias: térmica, diferencial
- Instalación de tomacorrientes e interruptores — alias: enchufes, llaves de luz
- Instalación de luminarias — alias: lámparas, luces, plafones
- Instalación de luces LED — alias: tiras led, iluminación led
- Cableado y recableado eléctrico — alias: cambio de cables, recableado
- Puesta a tierra — alias: descarga a tierra, jabalina
- Certificación y revisión de instalación eléctrica — alias: firma de electricista, inspección eléctrica
- Electricista de urgencia — alias: emergencia eléctrica, electricista 24 horas
- Instalación eléctrica para obra nueva — alias: electricidad de obra
- Automatización de iluminación — alias: luces inteligentes, domótica

## Sanitaria y plomería

- Reparación de pérdidas de agua — alias: sanitario, plomero, fuga de agua
- Destape de cañerías — alias: desobstrucción, caño tapado, desagüe tapado
- Instalación de cañerías — alias: tuberías, sanitaria
- Reparación de cisternas — alias: cisterna pierde, mochila de baño
- Instalación y reparación de grifería — alias: canilla, mezcladora
- Instalación de inodoros y bidés — alias: colocar inodoro, colocar bidet
- Instalación de lavamanos y piletas — alias: bacha, pileta de cocina
- Reparación de bombas de agua — alias: bomba presurizadora, bomba de agua
- Instalación de tanque de agua — alias: depósito de agua
- Limpieza de tanque de agua — alias: desinfección de tanque
- Detección de fugas — alias: pérdida oculta, humedad por caño
- Reparación de desagües — alias: drenaje, desagüe
- Sanitario de urgencia — alias: plomero urgente, sanitaria 24 horas

## Albañilería y construcción

- Construcción de vivienda — alias: obra nueva, albañil
- Reformas y remodelaciones — alias: reforma de casa, renovación
- Ampliación de vivienda — alias: ampliaciones, nuevo ambiente
- Construcción de muros — alias: pared, muro de ladrillos
- Revoque de paredes — alias: revocar, fino, grueso
- Colocación de pisos — alias: baldosas, cerámicas, porcelanato
- Colocación de revestimientos — alias: azulejos, revestir pared
- Construcción de churrasqueras — alias: parrillero, barbacoa
- Construcción de pérgolas — alias: pergolado
- Construcción y reparación de veredas — alias: entrada vehicular, camino
- Reparación de grietas y fisuras — alias: pared rajada, fisuras
- Impermeabilización de cimientos — alias: humedad de cimientos, humedad ascendente
- Demoliciones pequeñas — alias: tirar pared, demolición interior
- Contrapiso y carpetas — alias: nivelación de piso

## Pintura

- Pintura interior — alias: pintor de interiores, pintar casa
- Pintura exterior — alias: pintar fachada, pintor exterior
- Pintura de fachadas — alias: renovación de fachada
- Pintura de techos — alias: techo pintado
- Pintura de aberturas — alias: pintar puertas, pintar ventanas
- Pintura de rejas — alias: pintura de hierro
- Enduido y preparación de paredes — alias: alisado, reparar pared antes de pintar
- Tratamiento antihumedad — alias: pintura antihumedad, manchas de humedad
- Empapelado de paredes — alias: papel tapiz, wallpaper
- Pintura decorativa — alias: efectos, texturas
- Hidrolavado previo a pintura — alias: lavado de fachada

## Yeso, cielorrasos y construcción en seco

- Colocación de cielorraso de yeso — alias: cielo raso, cielorraso
- Construcción de paredes de yeso — alias: drywall, tabiquería, yeso
- Reparación de cielorrasos — alias: techo de yeso roto
- Revestimiento de paredes con yeso — alias: placas de yeso
- Molduras y terminaciones en yeso — alias: garganta de yeso, molduras
- Aislación térmica y acústica — alias: aislación de paredes, lana de vidrio
- Construcción con steel framing — alias: estructura liviana, construcción seca

## Carpintería y muebles

- Muebles a medida — alias: carpintero, mueble personalizado
- Placares a medida — alias: ropero, armario empotrado
- Muebles de cocina — alias: bajo mesada, aéreo de cocina
- Reparación de muebles — alias: arreglo de muebles
- Restauración de muebles — alias: restaurador, reciclaje de muebles
- Instalación de puertas de madera — alias: colocar puerta
- Reparación de puertas y marcos — alias: puerta trancada, marco roto
- Colocación de estantes — alias: repisas, biblioteca
- Decks de madera — alias: piso exterior de madera
- Pérgolas de madera — alias: techo liviano de madera
- Lustrado y barnizado — alias: barniz, pulido de madera

## Herrería y aluminio

- Rejas a medida — alias: herrero, rejas para ventanas
- Portones de hierro — alias: portón metálico
- Reparación de portones — alias: arreglo de portón
- Estructuras metálicas — alias: estructura de hierro
- Escaleras y barandas — alias: pasamanos, baranda metálica
- Cerramientos de aluminio — alias: aluminio, cerramiento
- Ventanas de aluminio — alias: abertura de aluminio
- Mosquiteros a medida — alias: tela mosquitera
- Soldadura a domicilio — alias: soldador, trabajos de soldadura
- Automatización de portones — alias: motor de portón, portón automático

## Techos e impermeabilización

- Reparación de techos — alias: gotera, techo roto
- Impermeabilización de azoteas — alias: membrana, impermeabilizar techo
- Colocación de membrana asfáltica — alias: membrana para azotea
- Impermeabilización con membrana líquida — alias: pintura impermeable
- Reparación de goteras — alias: filtración de techo
- Construcción de techo liviano — alias: techo de chapa, isopanel
- Colocación y reparación de canaletas — alias: canalón, desagüe pluvial
- Limpieza de canaletas — alias: canaleta tapada
- Aislación térmica de techos — alias: aislante, poliuretano

## Pisos y revestimientos

- Colocación de cerámicas — alias: ceramista, baldosa
- Colocación de porcelanato — alias: porcelanato
- Colocación de piso flotante — alias: piso laminado
- Colocación de piso vinílico — alias: vinilo, piso pvc
- Pulido de pisos — alias: pulidor, lustrado de piso
- Plastificado de parquet — alias: parquet, plastificador
- Reparación de pisos — alias: baldosas rotas
- Microcemento — alias: piso continuo, revestimiento cementicio

## Jardinería y exteriores

- Mantenimiento de jardines — alias: jardinero, cuidado de jardín
- Corte de césped — alias: cortar pasto
- Poda de árboles — alias: podador, poda en altura
- Tala controlada de árboles — alias: sacar árbol, tala
- Diseño de jardines — alias: paisajismo, paisajista
- Plantación de césped — alias: panes de césped, sembrar pasto
- Instalación de riego automático — alias: sistema de riego, aspersores
- Mantenimiento de piscinas — alias: piscinero, limpieza de piscina
- Construcción de piscinas — alias: piscina de material
- Cercos y alambrados — alias: cerco perimetral, tejido
- Desmalezado y limpieza de terrenos — alias: cortar maleza, limpiar terreno

# 2. Reparaciones y Servicio Técnico

## Electrodomésticos

- Reparación de heladeras — alias: técnico de heladera, refrigerador
- Reparación de lavarropas — alias: técnico de lavarropas, lavadora
- Reparación de secarropas — alias: secadora
- Reparación de lavavajillas — alias: lavaplatos
- Reparación de cocinas y hornos — alias: cocina a gas, horno eléctrico
- Reparación de microondas — alias: técnico de microondas
- Reparación de calefones — alias: termotanque, calentador de agua
- Reparación de pequeños electrodomésticos — alias: licuadora, batidora, aspiradora
- Instalación de electrodomésticos — alias: conexión de lavarropas, instalar cocina

## Climatización y calefacción

- Instalación de aire acondicionado — alias: aire, split, instalador de aire
- Reparación de aire acondicionado — alias: service de aire, técnico de aire
- Mantenimiento de aire acondicionado — alias: limpieza de aire, carga de gas
- Desinstalación y traslado de aire acondicionado — alias: mover split
- Reparación de estufas — alias: calefactor, estufa a gas
- Instalación de calefacción — alias: calefacción central, radiadores
- Mantenimiento de calderas — alias: service de caldera
- Instalación de bomba de calor — alias: calefacción por bomba de calor

## Electrónica, TV y audio

- Reparación de televisores — alias: técnico tv, smart tv
- Instalación de TV y soportes — alias: colgar televisor, soporte de pared
- Reparación de equipos de audio — alias: parlantes, amplificador
- Instalación de antenas — alias: antenista, antena digital
- Configuración de televisión digital — alias: decodificador, canales digitales
- Reparación de consolas de videojuegos — alias: PlayStation, Xbox, Nintendo
- Reparación de placas electrónicas — alias: electrónica, circuitos

## Celulares y tablets

- Reparación de celulares — alias: técnico de celular, smartphone
- Cambio de pantalla de celular — alias: pantalla rota, módulo
- Cambio de batería de celular — alias: batería agotada
- Reparación de puerto de carga — alias: conector de carga
- Reparación de tablets — alias: técnico de tablet
- Recuperación de datos de celular — alias: fotos borradas, archivos del teléfono
- Configuración y respaldo de celular — alias: backup, pasar datos

## Máquinas y herramientas

- Reparación de herramientas eléctricas — alias: taladro, amoladora, sierra
- Reparación de cortadoras de césped — alias: máquina de cortar pasto
- Reparación de hidrolavadoras — alias: service de hidrolavadora
- Reparación de generadores — alias: grupo electrógeno
- Reparación de bombas — alias: bomba eléctrica, bomba sumergible
- Mantenimiento de maquinaria liviana — alias: service de máquinas

# 3. Limpieza y Servicios para el Hogar

## Limpieza doméstica

- Limpieza de casas — alias: limpiadora, doméstica, limpieza del hogar
- Limpieza de apartamentos — alias: limpieza de apartamento
- Limpieza profunda — alias: limpieza general, limpieza a fondo
- Limpieza por horas — alias: servicio doméstico por hora
- Limpieza de cocinas — alias: desengrasado, limpieza de horno
- Limpieza de baños — alias: desinfección de baño
- Limpieza de vidrios — alias: limpiavidrios, ventanas
- Limpieza después de mudanza — alias: limpieza de entrega
- Limpieza de fin de obra — alias: limpieza posobra, limpieza de obra
- Limpieza para alquileres temporarios — alias: Airbnb, recambio de huéspedes

## Limpieza comercial

- Limpieza de oficinas — alias: empresa de limpieza, oficina
- Limpieza de locales comerciales — alias: comercio, tienda
- Limpieza de edificios — alias: áreas comunes, edificio
- Limpieza de depósitos — alias: galpón, almacén
- Limpieza industrial — alias: fábrica, planta
- Limpieza de centros educativos — alias: colegio, escuela
- Limpieza para eventos — alias: limpieza antes y después de fiesta

## Tapizados, alfombras y colchones

- Limpieza de sillones — alias: sofá, tapizado
- Limpieza de alfombras — alias: lavado de alfombra
- Limpieza de moquetas — alias: alfombra fija
- Limpieza de colchones — alias: lavado de colchón, ácaros
- Limpieza de sillas tapizadas — alias: tapicería
- Limpieza de interiores de vehículos — alias: detailing interior, tapizado de auto

## Control de plagas y saneamiento

- Fumigación de cucarachas — alias: control de cucarachas
- Control de roedores — alias: desratización, ratas, ratones
- Control de hormigas — alias: fumigar hormigas
- Control de pulgas y garrapatas — alias: fumigación de pulgas
- Control de mosquitos — alias: fumigar mosquitos
- Retiro de panales y avispas — alias: abejas, avispas
- Desinfección de ambientes — alias: sanitización
- Control de palomas — alias: ahuyentamiento de aves
- Fumigación comercial — alias: empresa de fumigación

## Servicios domésticos complementarios

- Lavado y planchado de ropa — alias: planchadora, lavandería
- Organización de hogares — alias: orden de casa, organizador profesional
- Cocinero a domicilio — alias: cocina doméstica, viandas en casa
- Cuidado de vivienda durante ausencias — alias: house sitting, vigilancia de casa

# 4. Mudanzas, Transporte y Logística

## Mudanzas

- Mudanza de casa — alias: empresa de mudanzas, flete
- Mudanza de apartamento — alias: traslado de apartamento
- Mudanza de oficina — alias: traslado empresarial
- Mudanza dentro de Montevideo — alias: mudanza local
- Mudanza al interior — alias: mudanza interdepartamental
- Mudanza internacional — alias: traslado internacional
- Embalaje para mudanza — alias: empacado, cajas
- Desarme y armado de muebles — alias: desmontaje de muebles
- Elevación de muebles — alias: subida por balcón, guinche
- Guardamuebles — alias: depósito temporal, almacenamiento

## Fletes y repartos

- Flete pequeño — alias: camioneta, traslado chico
- Flete con camión — alias: transporte de carga
- Reparto de mercadería — alias: distribución, entregas
- Retiro y entrega de muebles — alias: traslado de muebles
- Transporte de electrodomésticos — alias: llevar heladera, llevar lavarropas
- Envíos urgentes — alias: cadetería urgente, entrega rápida
- Cadetería — alias: mandados, mensajería
- Última milla para comercios — alias: delivery empresarial, ecommerce

## Transporte de pasajeros

- Traslado al aeropuerto — alias: transfer Carrasco, taxi aeropuerto
- Chofer particular — alias: conductor privado
- Transporte para eventos — alias: traslado de invitados
- Transporte escolar — alias: camioneta escolar
- Transporte accesible — alias: traslado en silla de ruedas
- Minibús con chofer — alias: van, traslado de grupos

# 5. Automotor

## Mecánica

- Mecánica general — alias: mecánico, taller mecánico
- Service de automóvil — alias: mantenimiento, service del auto
- Cambio de aceite y filtros — alias: lubricentro
- Reparación de motor — alias: motorista, motor
- Reparación de frenos — alias: frenos, pastillas
- Reparación de embrague — alias: cambio de embrague
- Reparación de suspensión — alias: amortiguadores, tren delantero
- Alineación y balanceo — alias: alinear auto, balancear ruedas
- Diagnóstico computarizado — alias: escáner automotriz, check engine
- Mecánico a domicilio — alias: auxilio mecánico

## Electricidad y electrónica automotriz

- Electricidad automotriz — alias: electricista de autos
- Reparación de alternador — alias: alternador
- Reparación de arranque — alias: motor de arranque
- Cambio de batería — alias: batería de auto
- Diagnóstico electrónico automotriz — alias: scanner, computadora del auto
- Instalación de alarma para vehículo — alias: alarma de auto
- Instalación de cámaras y sensores — alias: cámara de reversa, sensor de estacionamiento
- Instalación de audio para automóvil — alias: radio, parlantes de auto

## Neumáticos y auxilio

- Gomería — alias: gomero, neumáticos
- Reparación de pinchazos — alias: rueda pinchada
- Cambio de neumáticos — alias: cubiertas
- Gomería móvil — alias: gomero a domicilio
- Auxilio mecánico — alias: asistencia en ruta
- Remolque de vehículos — alias: grúa, guinche
- Arranque de batería — alias: puente de batería

## Chapa, pintura y estética

- Chapa y pintura — alias: chapista, pintor automotriz
- Reparación de abolladuras — alias: sacar bollos, desabollado
- Reparación de paragolpes — alias: paragolpe roto
- Pulido de automóvil — alias: pulido de carrocería
- Lavado de automóvil — alias: lavadero, lavado de auto
- Detailing automotriz — alias: limpieza premium, estética vehicular
- Tratamiento cerámico — alias: coating, protección de pintura
- Polarizado de vidrios — alias: lámina solar, polarizado
- Tapicería automotriz — alias: reparación de asientos, tapizado de auto

## Motos y bicicletas

- Reparación de motos — alias: mecánico de motos, taller de motos
- Service de motos — alias: mantenimiento de moto
- Reparación de bicicletas — alias: bicicletería, mecánico de bici
- Service de bicicletas — alias: mantenimiento de bicicleta
- Reparación de bicicletas eléctricas — alias: ebike, bici eléctrica

# 6. Salud

> La plataforma deberá exigir las habilitaciones profesionales que correspondan y evitar presentar servicios de salud como sustitutos de emergencias.

## Medicina y atención clínica

- Medicina general — alias: médico general, consulta médica
- Medicina familiar — alias: médico de familia
- Pediatría — alias: pediatra, médico de niños
- Geriatría — alias: geriatra, adulto mayor
- Dermatología — alias: dermatólogo, piel
- Ginecología — alias: ginecólogo
- Cardiología — alias: cardiólogo, corazón
- Traumatología — alias: traumatólogo, lesiones
- Consulta médica a domicilio — alias: médico a domicilio
- Telemedicina — alias: consulta médica online

## Odontología

- Consulta odontológica — alias: dentista, odontólogo
- Limpieza dental — alias: profilaxis, sarro
- Tratamiento de caries — alias: empaste, arreglo dental
- Extracción dental — alias: sacar muela
- Ortodoncia — alias: brackets, alineadores
- Prótesis dental — alias: dentadura, corona
- Implantes dentales — alias: implante
- Odontología infantil — alias: dentista para niños
- Urgencia odontológica — alias: dolor de muela, dentista urgente
- Blanqueamiento dental — alias: estética dental

## Psicología y salud mental

- Psicoterapia individual — alias: psicólogo, terapia
- Psicología infantil — alias: psicólogo para niños
- Terapia de pareja — alias: psicólogo de pareja
- Terapia familiar — alias: psicología familiar
- Atención psicológica online — alias: psicólogo remoto
- Psiquiatría — alias: psiquiatra
- Orientación vocacional — alias: test vocacional
- Neuropsicología — alias: evaluación neuropsicológica

## Rehabilitación y terapias

- Fisioterapia — alias: fisioterapeuta, rehabilitación física
- Quiropraxia — alias: quiropráctico
- Osteopatía — alias: osteópata
- Terapia ocupacional — alias: terapeuta ocupacional
- Fonoaudiología — alias: fonoaudiólogo, terapia del habla
- Psicomotricidad — alias: psicomotricista
- Rehabilitación deportiva — alias: recuperación de lesiones
- Masaje terapéutico — alias: masoterapia, masajista terapéutico

## Nutrición y cuidados de salud

- Consulta nutricional — alias: nutricionista, dieta
- Nutrición deportiva — alias: alimentación para deportistas
- Enfermería a domicilio — alias: enfermero, curaciones
- Inyectables a domicilio — alias: dar inyección
- Curaciones y control de heridas — alias: enfermería
- Podología — alias: podólogo, cuidado de pies
- Acompañamiento terapéutico — alias: acompañante terapéutico

# 7. Belleza, Estética y Bienestar

## Peluquería y barbería

- Corte de cabello para mujer — alias: peluquera, corte femenino
- Corte de cabello para hombre — alias: peluquero, corte masculino
- Barbería — alias: barbero, arreglo de barba
- Coloración de cabello — alias: tintura, teñido
- Mechas y balayage — alias: reflejos, iluminación de cabello
- Peinados — alias: brushing, recogido
- Alisado y keratina — alias: alisado progresivo
- Tratamientos capilares — alias: hidratación, reparación de cabello
- Peluquería a domicilio — alias: estilista a domicilio

## Manos, pies y maquillaje

- Manicura — alias: uñas, manicurista
- Esmaltado semipermanente — alias: semi, uñas semipermanentes
- Uñas esculpidas — alias: uñas acrílicas, gel
- Pedicura — alias: cuidado de pies
- Maquillaje social — alias: maquilladora, maquillaje para fiesta
- Maquillaje para novias — alias: maquillaje de boda
- Maquillaje a domicilio — alias: maquillista a domicilio

## Estética

- Depilación — alias: depiladora, cera
- Depilación láser — alias: láser definitivo
- Limpieza facial — alias: facial, cosmetóloga
- Tratamientos faciales — alias: estética facial
- Tratamientos corporales — alias: estética corporal
- Masajes relajantes — alias: masajista, relax
- Drenaje linfático — alias: masaje linfático
- Extensiones de pestañas — alias: pestañas pelo por pelo
- Lifting de pestañas — alias: arqueado de pestañas
- Diseño de cejas — alias: perfilado, laminado de cejas
- Micropigmentación — alias: microblading, maquillaje permanente
- Solárium — alias: bronceado

## Bienestar integral

- Reiki — alias: terapia energética
- Reflexología — alias: masaje de pies
- Aromaterapia — alias: aceites esenciales
- Meditación guiada — alias: mindfulness
- Spa a domicilio — alias: bienestar en casa

# 8. Fitness y Deportes

## Entrenamiento

- Entrenamiento personal — alias: personal trainer, entrenador personal
- Entrenamiento funcional — alias: funcional
- Musculación — alias: gimnasio, pesas
- Entrenamiento para adultos mayores — alias: gimnasia para mayores
- Preparación física deportiva — alias: preparador físico
- Entrenamiento online — alias: personal trainer remoto
- Plan de entrenamiento — alias: rutina de ejercicios

## Clases deportivas

- Clases de yoga — alias: profesor de yoga
- Clases de pilates — alias: instructor de pilates
- Clases de natación — alias: profesor de natación
- Clases de fútbol — alias: entrenador de fútbol
- Clases de tenis — alias: profesor de tenis
- Clases de pádel — alias: profesor de pádel
- Clases de boxeo — alias: entrenador de boxeo
- Clases de artes marciales — alias: karate, judo, taekwondo
- Clases de danza — alias: profesor de baile
- Clases de running — alias: entrenador de corredores

## Servicios para deportistas

- Masaje deportivo — alias: recuperación muscular
- Asesoramiento de entrenamiento — alias: coaching deportivo
- Arbitraje deportivo — alias: árbitro para partidos
- Organización de torneos — alias: campeonato, evento deportivo

# 9. Servicios Profesionales y Empresariales

## Contabilidad y administración

- Contabilidad para empresas — alias: contador, estudio contable
- Contabilidad para unipersonales — alias: contador independiente
- Declaración jurada — alias: impuestos, DGI
- Liquidación de impuestos — alias: DGI, IVA, IRAE
- Liquidación de sueldos — alias: nómina, recibos de sueldo
- Inscripción de empresa — alias: abrir empresa, unipersonal
- Trámites ante BPS — alias: seguridad social, BPS
- Gestión administrativa — alias: administrativo externo
- Facturación y cobranza — alias: administración de facturas
- Asesoramiento financiero — alias: finanzas empresariales

## Servicios jurídicos y notariales

- Asesoramiento legal — alias: abogado, consulta jurídica
- Derecho laboral — alias: abogado laboral, despido
- Derecho de familia — alias: divorcio, tenencia, pensión
- Derecho civil — alias: abogado civil
- Derecho comercial — alias: abogado de empresas
- Derecho inmobiliario — alias: contratos de alquiler, propiedad
- Sucesiones — alias: herencia, trámite sucesorio
- Defensa del consumidor — alias: reclamo de consumo
- Servicios notariales — alias: escribano, escribanía
- Certificación de firmas — alias: escribano público
- Poderes y escrituras — alias: escritura pública, poder notarial

## Recursos humanos

- Selección de personal — alias: reclutamiento, contratar empleados
- Evaluación psicotécnica — alias: evaluación laboral
- Consultoría de recursos humanos — alias: gestión humana
- Capacitación empresarial — alias: formación para empresas
- Coaching ejecutivo — alias: coach empresarial
- Outsourcing administrativo — alias: tercerización administrativa

## Consultoría y gestión

- Consultoría empresarial — alias: asesor de empresas
- Plan de negocios — alias: proyecto empresarial
- Gestión de proyectos — alias: project manager
- Consultoría de procesos — alias: mejora de procesos
- Consultoría de calidad — alias: ISO, sistema de calidad
- Prevención de riesgos laborales — alias: técnico prevencionista, seguridad laboral
- Comercio exterior — alias: importación, exportación, despachante
- Traducción profesional — alias: traductor, traducciones
- Traducción pública — alias: traductor público

# 10. Tecnología

## Informática y computadoras

- Reparación de computadoras — alias: técnico PC, arreglo de computadora
- Reparación de notebooks — alias: laptop, técnico de notebook
- Formateo e instalación de sistema — alias: instalar Windows, formatear PC
- Eliminación de virus y malware — alias: computadora con virus
- Optimización de computadora — alias: PC lenta, acelerar notebook
- Armado de PC — alias: ensamblaje de computadora, PC gamer
- Actualización de hardware — alias: memoria RAM, disco SSD
- Recuperación de datos — alias: archivos borrados, disco dañado
- Soporte técnico a domicilio — alias: informático a domicilio
- Soporte técnico remoto — alias: asistencia informática online

## Redes y conectividad

- Instalación de redes Wi-Fi — alias: wifi, red inalámbrica
- Mejora de cobertura Wi-Fi — alias: repetidor, mesh, wifi lento
- Cableado de red — alias: ethernet, cable UTP
- Configuración de routers — alias: módem, router wifi
- Redes para empresas — alias: infraestructura de red
- Instalación de servidores — alias: servidor empresarial
- Configuración de almacenamiento NAS — alias: servidor de archivos

## Desarrollo y servicios digitales

- Desarrollo de páginas web — alias: sitio web, programador web
- Desarrollo de tienda online — alias: ecommerce, comercio electrónico
- Desarrollo de aplicaciones — alias: programador, software a medida
- Desarrollo de aplicaciones móviles — alias: app Android, app iOS
- Mantenimiento de páginas web — alias: actualizar web, soporte web
- Automatización de procesos — alias: integraciones, automatización empresarial
- Configuración de correo corporativo — alias: email de empresa, dominio
- Migración y respaldo en la nube — alias: cloud, backup
- Ciberseguridad para empresas — alias: seguridad informática, auditoría
- Consultoría tecnológica — alias: asesor IT, transformación digital

# 11. Marketing, Diseño y Comunicación

## Diseño gráfico y marca

- Diseño de logotipo — alias: logo, identidad visual
- Diseño de identidad de marca — alias: branding, manual de marca
- Diseño de tarjetas personales — alias: tarjeta de presentación
- Diseño de folletería — alias: flyer, folleto, volante
- Diseño de cartelería — alias: cartel, banner
- Diseño editorial — alias: catálogo, revista, libro
- Ilustración — alias: ilustrador, dibujo digital
- Diseño de presentaciones — alias: PowerPoint, pitch deck

## Marketing digital

- Gestión de redes sociales — alias: community manager, social media
- Publicidad en redes sociales — alias: Meta Ads, Facebook Ads, Instagram Ads
- Publicidad en Google — alias: Google Ads, SEM
- Posicionamiento SEO — alias: aparecer en Google, SEO web
- Estrategia de marketing — alias: plan de marketing
- Email marketing — alias: newsletters, campañas de correo
- Creación de contenido — alias: contenido para redes
- Analítica digital — alias: Google Analytics, métricas web
- Marketing para comercios locales — alias: promoción local

## Fotografía y audiovisual

- Fotografía de productos — alias: fotos para catálogo, ecommerce
- Fotografía corporativa — alias: fotos empresariales
- Retratos profesionales — alias: foto de perfil, headshot
- Producción de video — alias: videógrafo, filmación
- Edición de video — alias: editor audiovisual
- Videos para redes sociales — alias: reels, TikTok
- Fotografía inmobiliaria — alias: fotos de propiedades
- Fotografía gastronómica — alias: fotos de comida
- Fotografía con dron — alias: drone, tomas aéreas

## Comunicación y contenidos

- Redacción de contenidos — alias: redactor, copywriter
- Corrección de textos — alias: corrector, edición de texto
- Comunicación institucional — alias: prensa, relaciones públicas
- Locución — alias: voz en off, locutor
- Producción de podcast — alias: edición de podcast, audio

# 12. Educación y Clases

## Apoyo académico

- Clases de matemática — alias: profesor de matemáticas, apoyo de matemática
- Clases de física — alias: profesor de física
- Clases de química — alias: profesor de química
- Clases de biología — alias: profesor de biología
- Clases de idioma español — alias: lengua, literatura
- Apoyo escolar — alias: maestro particular, deberes
- Apoyo liceal — alias: profesor particular, secundaria
- Preparación de exámenes — alias: clases para examen
- Técnicas de estudio — alias: aprender a estudiar
- Clases universitarias de apoyo — alias: tutor universitario

## Idiomas

- Clases de inglés — alias: profesor de inglés, inglés particular
- Clases de portugués — alias: profesor de portugués
- Clases de francés — alias: profesor de francés
- Clases de italiano — alias: profesor de italiano
- Clases de alemán — alias: profesor de alemán
- Preparación de exámenes internacionales — alias: Cambridge, TOEFL, IELTS
- Conversación en idiomas — alias: práctica de conversación
- Clases de español para extranjeros — alias: Spanish lessons

## Arte y música

- Clases de guitarra — alias: profesor de guitarra
- Clases de piano — alias: profesor de piano
- Clases de canto — alias: profesor de canto
- Clases de batería — alias: profesor de batería
- Clases de violín — alias: profesor de violín
- Clases de dibujo y pintura — alias: arte, taller de pintura
- Clases de fotografía — alias: curso de fotografía
- Clases de teatro — alias: actuación
- Clases de danza — alias: baile, profesor de danza

## Capacitación práctica

- Clases de informática — alias: computación, PC para principiantes
- Clases de programación — alias: aprender a programar
- Clases de Excel — alias: planillas, Microsoft Excel
- Clases de manejo — alias: instructor de conducción, academia de choferes
- Clases de cocina — alias: curso de cocina
- Tutorías online — alias: clases remotas, profesor online

# 13. Eventos y Celebraciones

## Organización y coordinación

- Organización de eventos — alias: organizador, productor de eventos
- Wedding planner — alias: organizador de bodas, casamiento
- Coordinación de cumpleaños — alias: fiesta de cumpleaños
- Organización de eventos empresariales — alias: evento corporativo
- Ceremonial y protocolo — alias: coordinación protocolar
- Personal para eventos — alias: mozos, azafatas, recepción

## Música y entretenimiento

- DJ para eventos — alias: disc jockey, música para fiesta
- Banda en vivo — alias: músicos para fiesta
- Sonido e iluminación — alias: luces para eventos, amplificación
- Animación infantil — alias: animador de cumpleaños
- Inflables y juegos — alias: castillos inflables, entretenimiento infantil
- Magia y espectáculos — alias: mago, show
- Karaoke para eventos — alias: alquiler de karaoke
- Fotocabina — alias: cabina de fotos

## Decoración y equipamiento

- Decoración de eventos — alias: decorador de fiestas
- Decoración con globos — alias: globos, arco de globos
- Alquiler de mobiliario para eventos — alias: mesas, sillas, livings
- Alquiler de vajilla — alias: platos, copas, cubiertos
- Alquiler de carpas — alias: gazebo, toldo para evento
- Alquiler de mantelería — alias: manteles, fundas de sillas
- Ambientación floral — alias: flores para eventos
- Iluminación decorativa — alias: guirnaldas, luces de fiesta

## Foto y video para eventos

- Fotografía de bodas — alias: fotógrafo de casamiento
- Fotografía de cumpleaños — alias: fotógrafo de fiesta
- Filmación de eventos — alias: video de boda, videógrafo
- Transmisión en vivo de eventos — alias: streaming

# 14. Inmuebles y Propiedades

## Operaciones inmobiliarias

- Venta de propiedades — alias: inmobiliaria, vender casa
- Alquiler de propiedades — alias: alquilar casa, alquilar apartamento
- Administración de alquileres — alias: gestión de propiedades
- Tasación de propiedades — alias: tasador, valoración inmobiliaria
- Búsqueda de propiedades — alias: asesor inmobiliario
- Alquiler temporario — alias: alquiler por temporada
- Gestión de garantías de alquiler — alias: garantía, contrato de alquiler

## Arquitectura y obra

- Proyecto arquitectónico — alias: arquitecto, diseño de vivienda
- Dirección de obra — alias: arquitecto de obra
- Regularización de construcciones — alias: regularizar obra, planos
- Relevamiento y planos — alias: dibujante técnico, planos de casa
- Permiso de construcción — alias: trámite de obra, intendencia
- Diseño de interiores — alias: interiorista, decoración interior
- Render arquitectónico — alias: visualización 3D, render 3D

## Agrimensura e inspección

- Mensura de terrenos — alias: agrimensor, medir terreno
- Fraccionamiento de terrenos — alias: división de padrón
- Amojonamiento — alias: límites del terreno, mojones
- Inspección técnica de propiedades — alias: revisar casa antes de comprar
- Inventario de propiedad — alias: inventario para alquiler
- Certificado de eficiencia energética — alias: evaluación energética

# 15. Mascotas

## Salud animal

- Consulta veterinaria — alias: veterinario, veterinaria
- Veterinario a domicilio — alias: consulta veterinaria en casa
- Vacunación de mascotas — alias: vacunas para perro, vacunas para gato
- Castración — alias: esterilización, castrar mascota
- Desparasitación — alias: antiparasitario
- Urgencia veterinaria — alias: veterinaria 24 horas
- Fisioterapia animal — alias: rehabilitación veterinaria

## Higiene y estética

- Peluquería canina — alias: baño y corte de perro
- Peluquería felina — alias: baño y corte de gato
- Baño de mascotas — alias: lavado de perro
- Corte de uñas para mascotas — alias: uñas de perro, uñas de gato

## Cuidado y entrenamiento

- Paseo de perros — alias: paseador, dog walker
- Cuidado de mascotas a domicilio — alias: pet sitter, cuidador de animales
- Guardería para perros — alias: guardería canina
- Hospedaje para mascotas — alias: hotel para perros, pensionado
- Adiestramiento canino — alias: entrenador de perros
- Educación de cachorros — alias: conducta canina
- Traslado de mascotas — alias: taxi de mascotas

# 16. Cuidado Personal y Asistencia

## Personas mayores y dependencia

- Cuidado de adultos mayores — alias: cuidador, acompañante de ancianos
- Acompañamiento en domicilio — alias: compañía para mayores
- Acompañamiento hospitalario — alias: cuidador en hospital, sanatorio
- Asistencia para personas con discapacidad — alias: cuidador personal
- Apoyo en actividades cotidianas — alias: asistencia diaria
- Relevo para cuidadores familiares — alias: respiro familiar
- Cuidado nocturno — alias: acompañante nocturno

## Infancia y familia

- Cuidado de niños — alias: niñera, babysitter
- Cuidado de bebés — alias: niñera para bebé
- Niñera por horas — alias: babysitting ocasional
- Acompañamiento y retiro escolar — alias: llevar y buscar niños
- Apoyo familiar posparto — alias: puericultora, ayuda con recién nacido
- Animación y cuidado infantil en eventos — alias: niñera para fiestas

## Asistencia cotidiana

- Acompañamiento a consultas médicas — alias: acompañante para trámites médicos
- Realización de mandados — alias: compras, trámites personales
- Asistencia personal a domicilio — alias: ayudante personal
- Lectura y compañía — alias: acompañamiento social

# 17. Gastronomía y Alimentación

## Comidas y catering

- Catering para eventos — alias: servicio de comida, catering
- Lunch para eventos — alias: bocados, mesa de lunch
- Parrillero para eventos — alias: asador, parrilla
- Chef a domicilio — alias: cocinero privado
- Viandas semanales — alias: comida preparada, menú semanal
- Viandas saludables — alias: comida sana, dieta
- Menú vegetariano y vegano — alias: comida vegana, comida vegetariana
- Comida para empresas — alias: almuerzos empresariales
- Servicio de mozos — alias: mozo para fiesta

## Panadería y repostería

- Tortas personalizadas — alias: torta de cumpleaños, cake
- Repostería para eventos — alias: postres, mesa dulce
- Cupcakes y galletas decoradas — alias: cookies, cupcakes
- Panadería artesanal — alias: pan casero, masa madre
- Pastelería sin gluten — alias: celíacos, libre de gluten
- Postres a pedido — alias: dulces, postres caseros

## Bebidas y servicios gastronómicos

- Barra de tragos para eventos — alias: bartender, coctelería
- Servicio de café para eventos — alias: cafetería móvil, barista
- Alquiler de dispensadores de bebidas — alias: choperas, jugueras
- Diseño de menú gastronómico — alias: carta de restaurante
- Asesoría gastronómica — alias: consultor de restaurante

# 18. Turismo y Experiencias

## Guías y recorridos

- Guía turístico en Montevideo — alias: city tour, guía local
- Guía turístico en Colonia — alias: tour Colonia del Sacramento
- Guía turístico en Punta del Este — alias: tour Maldonado
- Recorridos históricos — alias: tour histórico
- Tours gastronómicos — alias: experiencia culinaria
- Tours de bodegas — alias: enoturismo, visita a bodega
- Turismo rural — alias: estancia turística, experiencia rural
- Avistamiento de aves — alias: birdwatching
- Pesca guiada — alias: guía de pesca

## Traslados y planificación

- Planificación de viajes dentro de Uruguay — alias: itinerario, asesor de viaje
- Traslados turísticos — alias: transfer turístico
- Excursiones privadas — alias: paseo privado
- Alquiler de vehículo con chofer — alias: chofer turístico
- Recepción de pasajeros — alias: asistencia al turista

## Experiencias y actividades

- Paseos a caballo — alias: cabalgata
- Clases de surf — alias: instructor de surf
- Paseos en kayak — alias: kayak guiado
- Senderismo guiado — alias: trekking
- Experiencias fotográficas — alias: tour de fotografía
- Actividades para grupos — alias: team building, excursión grupal

# 19. Servicios Rurales

## Maquinaria y labores

- Laboreo de suelos — alias: arado, preparación de tierra
- Siembra — alias: sembradora, servicio de siembra
- Cosecha — alias: cosechadora, servicio de cosecha
- Pulverización agrícola — alias: fumigación de cultivo
- Corte y enfardado — alias: fardos, pastura
- Contratación de maquinaria agrícola — alias: tractor, maquinaria rural
- Reparación de maquinaria agrícola — alias: mecánico agrícola
- Movimiento de tierra — alias: retroexcavadora, tajamar

## Ganadería y animales

- Veterinaria rural — alias: veterinario de campo, ganado
- Inseminación artificial — alias: reproducción animal
- Esquila — alias: esquilador, ovejas
- Alambrado rural — alias: alambrador, cerco de campo
- Manejo de ganado — alias: trabajo con vacunos
- Transporte de animales — alias: traslado de ganado
- Herrado de caballos — alias: herrador, equinos

## Asesoramiento y mantenimiento rural

- Asesoramiento agronómico — alias: ingeniero agrónomo
- Gestión de establecimientos rurales — alias: administración de campo
- Control de plagas agrícolas — alias: plagas de cultivo
- Instalación de riego rural — alias: riego agrícola
- Perforación de pozos de agua — alias: pozo semisurgente, perforista
- Limpieza de tajamares — alias: mantenimiento de tajamar
- Desmalezado de campos — alias: limpieza de campo
- Mensura rural — alias: agrimensor rural

# 20. Seguridad

## Alarmas y videovigilancia

- Instalación de cámaras de seguridad — alias: CCTV, videovigilancia
- Configuración de cámaras IP — alias: cámara wifi, cámara remota
- Instalación de alarmas — alias: alarma para casa, alarma comercial
- Mantenimiento de sistemas de alarma — alias: service de alarma
- Monitoreo de alarmas — alias: respuesta de alarma
- Videoporteros — alias: portero eléctrico con cámara
- Control de acceso — alias: tarjeta, huella, acceso electrónico

## Cerrajería

- Cerrajero a domicilio — alias: cerrajero, abrir puerta
- Apertura de puertas — alias: llave adentro, puerta trancada
- Cambio de cerraduras — alias: cerradura nueva
- Reparación de cerraduras — alias: cerradura rota
- Copia y codificación de llaves — alias: duplicado de llave
- Cerrajería automotriz — alias: llave de auto, abrir auto
- Cerrajero de urgencia — alias: cerrajero 24 horas
- Instalación de cerraduras inteligentes — alias: cerradura digital

## Protección y prevención

- Servicio de vigilancia — alias: guardia de seguridad, vigilante
- Seguridad para eventos — alias: control de acceso en fiestas
- Instalación de cercas eléctricas — alias: cerco eléctrico
- Instalación de portones automáticos — alias: acceso vehicular
- Asesoría en seguridad — alias: evaluación de riesgos
- Sistemas contra incendios — alias: detección de incendio, alarma de humo
- Instalación y mantenimiento de extintores — alias: matafuegos, recarga de extintor

---

# Reglas de búsqueda

El buscador indexa, por cada servicio: nombre canónico, alias, subcategoría y
categoría. Antes de comparar normaliza: minúsculas, sin tildes, sin espacios
de más. El orden de relevancia va de coincidencia exacta del nombre a
coincidencia parcial en un alias, y de ahí a subcategoría y categoría.

No se crean opciones separadas para singular, plural o sinónimos: todos esos
términos llegan al mismo servicio canónico por sus `aliases`.
