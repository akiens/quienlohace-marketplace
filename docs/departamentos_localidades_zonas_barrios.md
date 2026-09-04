# Departamentos, Localidades y Zonas o Barrios

Este documento es la **fuente de la verdad** para cualquier validación de datos
respecto a los departamentos, localidades y zonas o barrios. De acá se genera el
JSON que consume el proyecto.

---

## 1. Cómo leer este documento

La geografía tiene tres niveles administrados más el país como raíz (RF-118 /
RF-119): el proveedor **selecciona**, nunca crea.

```text
País  →  Departamento  →  Localidad  →  Zona o barrio
```

- **País** (1): `Uruguay`. Es el nivel de respaldo para quien trabaja en todo el
  territorio o no precisó su ubicación. No se escribe en las listas de abajo:
  lo agrega el generador.
- **Departamento** (19): la división política de primer orden. Siempre
  seleccionable por sí solo, sin bajar a localidad.
- **Localidad** (453): ciudad, villa, pueblo o balneario. Es el nivel que la
  mayoría de la gente usa para decir dónde está. Siempre seleccionable, tenga o
  no barrios.
- **Zona o barrio** (262): el tercer nivel, y **es opcional**. Solo existe donde
  la localidad es lo bastante grande como para que decir su nombre no alcance.
  Si una localidad no tiene zonas, el tercer selector no se muestra (RF-116).

### Formato de cada línea

Cada departamento abre con su encabezado y su slug. Dentro, cada localidad es
una línea; sus zonas, si las tiene, van en la línea siguiente indentadas.

```text
- Nombre de la localidad
  - Zona o barrio
  - Zona o barrio
```

- El **nombre canónico** es lo único que se muestra en la interfaz. Se escribe
  como lo escribe el Instituto Nacional de Estadística y como lo dice la gente:
  con tildes, con mayúscula inicial en cada palabra significativa y sin
  abreviar (`Ciudad de la Costa`, no `Cdad. de la Costa`).
- No se registran variantes de escritura. `Ciudad De La Costa`, `ciudad de la
  costa` y `Ciudad de Costa` son la misma ubicación: eso lo resuelve la
  normalización del slug (RF-110).
- Donde un nombre convive con otro de uso corriente, el alternativo va entre
  paréntesis en la misma línea y **no** genera una entrada separada.

### Encabezados y agrupaciones

Dentro de cada departamento, los encabezados de nivel `##` son **agrupaciones
de lectura**, no un nivel de datos. Existen para que un departamento con
sesenta localidades siga siendo legible, y el generador los ignora.

Lo único que define la jerarquía es la **indentación de las viñetas**:

```text
- Localidad            ← viñeta al margen  = localidad del departamento
  - Zona o barrio      ← viñeta indentada  = zona de la localidad anterior
```

Por eso Montevideo, que es una sola localidad con 62 barrios, se escribe igual
que cualquier otra: la localidad al margen y sus barrios indentados debajo. Un
encabezado `##` nunca es una localidad ni un barrio.

### Identificadores derivados

Los IDs no se escriben acá: se **derivan** al generar el JSON, para que no haya
dos verdades (RF-110, RF-111).

| Nivel | Fórmula | Ejemplo |
| --- | --- | --- |
| País | constante | `uruguay` |
| Departamento | `slugify(nombre)` | `canelones` |
| Localidad | `<id departamento>-<slugify(nombre)>` | `canelones-ciudad-de-la-costa` |
| Zona o barrio | `<id localidad>-<slugify(nombre)>` | `canelones-ciudad-de-la-costa-solymar` |

`slugify` normaliza a NFD, quita diacríticos, pasa a minúsculas y reemplaza todo
lo que no sea `a-z0-9` por guiones (`src/lib/slug.ts`).

> **Los IDs geográficos son estables y no se renombran.** Están escritos en las
> URLs indexadas (`servi.uy/electricistas/canelones/ciudad-de-la-costa/solymar`),
> en el `locationId` de cada perfil y en los `serviceAreaIds` de cada zona
> atendida (RF-112, RF-113). Cambiar un nombre visible es aceptable; cambiar un
> slug rompe enlaces y deja perfiles apuntando a la nada.

### Colisiones de nombre

En Uruguay se repiten muchos topónimos entre departamentos, y a veces dentro de
uno solo. El prefijo del ID los desambigua sin intervención manual:

| Caso | IDs resultantes |
| --- | --- |
| Localidad homónima de su departamento | `florida-florida`, `salto-salto`, `rocha-rocha` |
| Mismo nombre en dos departamentos | `canelones-santa-lucia`, `colonia-santa-ana` vs `soriano-santa-catalina` |
| Barrio homónimo entre ciudades | `montevideo-montevideo-la-blanqueada` vs `paysandu-paysandu-la-chapita` |

La única regla que hay que sostener: **dentro de un mismo padre, no puede haber
dos hijos con el mismo nombre.** Entre padres distintos, sí.

---

## 2. Criterios de catalogación

Reglas que se aplicaron al armar esta lista y que hay que sostener al ampliarla.

1. **Una localidad es un lugar donde alguien puede vivir y recibir un
   servicio**, no una unidad censal. Se incluyen ciudades, villas, pueblos,
   balnearios y centros poblados con nombre reconocido; no parajes de tres casas
   ni estaciones de tren abandonadas.
2. **El tercer nivel solo existe donde hace falta.** Un barrio se agrega cuando
   decir la localidad no alcanza para que alguien sepa si el proveedor le queda
   cerca. En Montevideo hace falta siempre; en Trinidad, nunca.
3. **Barrios oficiales antes que barrios de percepción.** Para Montevideo se usa
   la nomenclatura de los 62 barrios de la Intendencia, que es la que aparece en
   los documentos y la que la gente reconoce, aunque coloquialmente se hable de
   recortes más chicos.
4. **Los balnearios son localidades, no barrios**, aun cuando estén pegados
   entre sí. La Costa de Oro y la de Rocha se listan como cadena de localidades
   porque así se buscan y así se cobra el viaje.
5. **Ciudad de la Costa y Ciudad del Plata son la excepción**: son una sola
   localidad legal con barrios internos que la gente nombra en lugar del todo.
   Ahí el tercer nivel es obligatorio.
6. **Sin códigos postales ni municipios.** El municipio (letra A–G en Montevideo,
   por ejemplo) es una división administrativa que nadie usa para decir dónde
   vive. Si algún día hace falta, entra como metadato, no como nivel.
7. **Densidad pareja por relevancia, no por superficie.** Los departamentos con
   más demanda de servicios tienen más detalle. Un departamento chico y rural
   con quince localidades está completo; no se rellena con parajes para
   emparejar el conteo.

### Reglas de selección que asume este dataset

El selector es jerárquico en pantalla aunque el modelo sea plano (RF-117). La
selección se resuelve al nivel más preciso que el usuario haya elegido: si eligió
departamento y localidad pero no barrio, el ID es el de la localidad; si no
eligió nada, el ID es `uruguay`.

---

## 3. Índice de departamentos

| # | Departamento | Slug | Capital | Localidades | Zonas |
| --- | --- | --- | --- | --- | --- |
| 1 | Montevideo | `montevideo` | Montevideo | 7 | 68 |
| 2 | Canelones | `canelones` | Canelones | 66 | 32 |
| 3 | Maldonado | `maldonado` | Maldonado | 36 | 32 |
| 4 | Rocha | `rocha` | Rocha | 26 | 11 |
| 5 | Colonia | `colonia` | Colonia del Sacramento | 36 | 10 |
| 6 | San José | `san-jose` | San José de Mayo | 24 | 16 |
| 7 | Soriano | `soriano` | Mercedes | 23 | 7 |
| 8 | Río Negro | `rio-negro` | Fray Bentos | 18 | 6 |
| 9 | Paysandú | `paysandu` | Paysandú | 24 | 8 |
| 10 | Salto | `salto` | Salto | 21 | 10 |
| 11 | Artigas | `artigas` | Artigas | 15 | 8 |
| 12 | Rivera | `rivera` | Rivera | 18 | 10 |
| 13 | Tacuarembó | `tacuarembo` | Tacuarembó | 21 | 8 |
| 14 | Cerro Largo | `cerro-largo` | Melo | 21 | 8 |
| 15 | Durazno | `durazno` | Durazno | 21 | 6 |
| 16 | Flores | `flores` | Trinidad | 10 | 4 |
| 17 | Florida | `florida` | Florida | 26 | 6 |
| 18 | Lavalleja | `lavalleja` | Minas | 22 | 6 |
| 19 | Treinta y Tres | `treinta-y-tres` | Treinta y Tres | 18 | 6 |
| | **Total** | | | **453** | **262** |

> Los conteos de esta tabla se validan contra el documento al generar el JSON.
> Si no coinciden, gana el cuerpo del documento y se corrige la tabla.

---

# 1. Montevideo

`montevideo` · capital: *Montevideo* · zonas obligatorias

Único departamento donde el tercer nivel no es opcional: nadie dice "vivo en
Montevideo" cuando pide un servicio, dice el barrio. Se usa la nomenclatura
oficial de los 62 barrios de la Intendencia de Montevideo.

## 1.1. Capital

- Montevideo
  - Aguada
  - Aires Puros
  - Atahualpa
  - Bañados de Carrasco
  - Barrio Sur
  - Bella Italia
  - Bella Vista
  - Belvedere
  - Borro (Cerro Norte)
  - Brazo Oriental
  - Buceo
  - Capurro
  - Carrasco
  - Carrasco Norte
  - Casabó
  - Casavalle
  - Castro
  - Centro
  - Cerrito de la Victoria
  - Cerro (Villa del Cerro)
  - Ciudad Vieja
  - Colón Centro y Noroeste
  - Colón Sudeste
  - Conciliación
  - Cordón
  - Flor de Maroñas
  - Jacinto Vera
  - Jardines del Hipódromo
  - La Blanqueada
  - La Comercial
  - La Figurita
  - La Paloma
  - La Teja
  - Larrañaga
  - Las Acacias
  - Las Canteras
  - Lezica
  - Malvín
  - Malvín Norte
  - Manga
  - Maroñas
  - Melilla
  - Mercado Modelo
  - Nuevo París
  - Palermo
  - Parque Batlle
  - Parque Rodó
  - Paso de la Arena
  - Paso de las Duranas
  - Paso Molino
  - Peñarol
  - Piedras Blancas
  - Villa Muñoz (Reus al Norte)
  - Pocitos
  - Prado
  - Punta Carretas
  - Punta Gorda
  - Punta Rieles
  - Reducto
  - Sayago
  - Tres Cruces
  - Tres Ombúes
  - Unión
  - Villa Biarritz
  - Villa Dolores
  - Villa Española
  - Villa García
  - Villa Sarandí

## 1.2. Resto del departamento

- Santiago Vázquez
- Abayubá
- Punta Espinillo
- Colonia Nicolich Oeste
- Pajas Blancas
- Santa Catalina

Localidades del oeste y noroeste rural, fuera de la mancha urbana continua. No
llevan tercer nivel: quien vive ahí nombra la localidad y alcanza.

---

# 2. Canelones

`canelones` · capital: *Canelones*

El departamento con más localidades del país y el de mayor movimiento de
proveedores después de Montevideo. Tres de sus ciudades necesitan tercer nivel:
Ciudad de la Costa, Las Piedras y Barros Blancos.

## 2.1. Área metropolitana

- Canelones (Guadalupe)
- Las Piedras
  - Centro
  - La Paz Chica
  - Obelisco
  - Vista Linda
  - Villa Foresti
  - Sofía Santos
  - Estación Las Piedras
  - Fátima
- La Paz
- Progreso
- Juanicó
- Barros Blancos
  - Centro
  - Villa Nueva
  - Los Aromos
  - Santa Teresita
- Toledo
- Suárez (Villa Nueva de Suárez)
- Sauce
- Pando
  - Centro
  - Estación Pando
  - Villa Crespo
  - Cerrillos de Pando
- Empalme Olmos
- Joaquín Suárez
- Colonia Nicolich
- Paso Carrasco
- Villa Aeroparque
- Cañada Grande
- Los Cerrillos
- Santa Lucía
- Aguas Corrientes
- Villa Felicidad
- Paso Palomeque

## 2.2. Ciudad de la Costa

Una sola ciudad legal formada por balnearios que la gente sigue nombrando por
separado. El tercer nivel es obligatorio acá.

- Ciudad de la Costa
  - Paso Carrasco Norte
  - Barra de Carrasco
  - San José de Carrasco
  - Shangrilá
  - Lagomar
  - Solymar
  - Lomas de Solymar
  - El Pinar
  - Médanos de Solymar
  - Colinas de Solymar
  - Country Club
  - Parque Carrasco

## 2.3. Costa de Oro

Cadena de balnearios sobre la ruta Interbalnearia. Cada uno es una localidad:
así se buscan y así se cotiza el viaje.

- Neptunia
- Pinamar
- Salinas
- Marindia
- Fortín de Santa Rosa
- Villa Argentina
- Atlántida
  - Centro
  - Atlántida Norte
  - Villa Argentina Sur
  - Estación Atlántida
- Las Toscas
- Parque del Plata
- La Floresta
- Costa Azul
- Bello Horizonte
- Guazuvirá
- San Luis
- Los Titanes
- Biarritz
- Cuchilla Alta
- Santa Lucía del Este
- Balneario Argentino
- Jaureguiberry
- Araminda
- Santa Ana
- El Galeón

## 2.4. Interior del departamento

- Tala
- San Ramón
- San Bautista
- San Antonio
- Santa Rosa
- Castellanos
- Migues
- Montes
- San Jacinto
- Soca
- Estación Tapia
- Bolívar
- Cerrillos
- Villa San Cono
- Capilla de Cella
- Aguas Blancas
- Costa y Guillamón
- Olmos
- Totoral del Sauce
- Piedra del Toro
- Curtina de Guerra

---

# 3. Maldonado

`maldonado` · capital: *Maldonado*

Departamento de altísima estacionalidad: la demanda de servicios se multiplica
entre diciembre y marzo. Maldonado, Punta del Este, San Carlos y Piriápolis
llevan tercer nivel.

## 3.1. Conurbación Maldonado – Punta del Este

- Maldonado
  - Centro
  - Cerro Pelado
  - Maldonado Nuevo
  - Cañada Aparicio
  - Barrio Hipódromo
  - San Antonio
  - Los Aromos
  - Villa Delia
  - Barrio Kennedy
  - La Sonrisa
- Punta del Este
  - Península
  - Aidy Grill
  - Roosevelt
  - Cantegril
  - San Rafael
  - Beverly Hills
  - Pinares
  - La Pastora
  - Rincón del Indio
  - Parada 24
- Punta Ballena
- Solanas
- La Barra
  - Centro
  - El Tesoro
  - Montoya
- Manantiales
- José Ignacio
- Balneario Buenos Aires
- El Chorro
- Santa Mónica
- Sauce de Portezuelo
- Ocean Park

## 3.2. San Carlos y el este

- San Carlos
  - Centro
  - Rodríguez Barrios
  - Villa Cerantes
  - Barrio Ejido
- La Aguada
- Guardia Vieja
- Partido Norte
- Garzón
- Pueblo Edén

## 3.3. Piriápolis y la costa oeste

- Piriápolis
  - Centro
  - Playa Grande
  - Playa Hermosa
  - San Francisco
  - Country Club
- Pan de Azúcar
- Playa Verde
- Las Flores
- Bella Vista de Piriápolis
- Punta Colorada
- Punta Negra
- Portezuelo
- Gregorio Aznárez
- Cerro Pelado de Pan de Azúcar
- Estación Las Flores

## 3.4. Interior

- Aiguá
- Los Talas
- Nueva Carrara
- Cerros Azules
- Estación Aiguá
- Las Cañas
- Puntas de Pan de Azúcar

---

# 4. Rocha

`rocha` · capital: *Rocha*

Costa oceánica y balnearios. Rocha, Chuy y La Paloma llevan tercer nivel; el
resto de los balnearios son localidades por derecho propio.

## 4.1. Capital y centros urbanos

- Rocha
  - Centro
  - Barrio Lavalleja
  - Barrio Torres
  - Villa Elena
- Chuy
  - Centro
  - Barra del Chuy
  - Barrio Samuel Priliac
- Castillos
- Lascano
- Velázquez
- Cebollatí
- San Luis al Medio
- Dieciocho de Julio
- La Coronilla
- Puerto de los Botes

## 4.2. Costa atlántica

- La Paloma
  - Centro
  - La Aguada
  - Antoniópolis
  - Costa Azul
- La Pedrera
- Cabo Polonio
- Valizas (Barra de Valizas)
- Aguas Dulces
- Punta del Diablo
- Santa Teresa
- Punta Rubia
- San Antonio
- Oceanía del Polonio
- Arachania
- Anaconda
- La Esmeralda
- Barrio Puerto de La Paloma
- Balneario Costa Azul
- Punta Rubia Norte

---

# 5. Colonia

`colonia` · capital: *Colonia del Sacramento*

Departamento de colonias suizas y valdenses, con nombres propios muy marcados.
Colonia del Sacramento y Carmelo llevan tercer nivel.

## 5.1. Ciudades principales

- Colonia del Sacramento
  - Barrio Histórico
  - Centro
  - Real de San Carlos
  - Barrio Ferrando
  - General Flores
  - Barrio Artigas
- Carmelo
  - Centro
  - Zagarzazú
  - Playa Seré
  - Barrio Norte
- Juan Lacaze
- Nueva Helvecia
- Nueva Palmira
- Rosario
- Tarariras
- Ombúes de Lavalle
- Colonia Valdense
- Florencio Sánchez

## 5.2. Colonias y pueblos

- Conchillas
- Riachuelo
- Colonia Miguelete
- Colonia Cosmopolita
- Colonia Estrella
- Colonia Suiza
- La Paz
- Barker
- Campana
- Cufré
- El Semillero
- Puerto Inglés
- Radial Hernández
- San Pedro
- Santa Ana
- Colonia Belgrano
- Blanquillo
- Minuano
- Los Pinos
- Artilleros
- Playa Fomento
- Puerto Platero
- Colonia Concordia
- Estanzuela
- Paraje Cerros de San Juan
- Colonia Braso Oriental

---

# 6. San José

`san-jose` · capital: *San José de Mayo*

Ciudad del Plata es el caso análogo a Ciudad de la Costa: una localidad legal
formada por barrios que la gente nombra en su lugar.

## 6.1. Ciudades principales

- San José de Mayo
  - Centro
  - Barrio Roselló
  - Barrio Exposición
  - Villa Olímpica
  - Barrio Ferrocarril
  - Picada de Varela
- Ciudad del Plata
  - Playa Pascual
  - Delta del Tigre
  - Safici
  - Villa Rives
  - Autódromo
  - Penino
  - Santa Mónica
  - Monte Grande
- Libertad
  - Centro
  - Barrio Sur
- Rodríguez
- Ecilda Paullier
- Rafael Perazza

## 6.2. Costa y balnearios

- Kiyú
- Ordeig
- Boca del Cufré
- Playa Pascual Sur
- Arazatí
- Mauricio

## 6.3. Interior

- Puntas de Valdez
- Villa María
- Capurro
- Juan Soler
- Raigón
- San Gregorio
- Colonia Italia
- Ituzaingó
- Scavino
- Cañada Grande
- Estación González
- Bella Vista

---

# 7. Soriano

`soriano` · capital: *Mercedes*

## 7.1. Ciudades principales

- Mercedes
  - Centro
  - Barrio Treinta y Tres
  - Barrio Cerro
  - Rambla
  - Barrio Artigas
- Dolores
  - Centro
  - Barrio Sur
- Cardona
- José Enrique Rodó
- Palmitas
- Villa Soriano

## 7.2. Pueblos y colonias

- Santa Catalina
- Egaña
- Risso
- Agraciada
- Cañada Nieto
- Castillos de Soriano
- Colonia Concordia
- Sacachispas
- Palo Solo
- Perseverano
- Rincón del Pino
- Zanja Honda
- Coquimbo
- Chacras de Dolores
- Balneario Las Cañas
- Pueblo Gil
- Muelle Concordia

---

# 8. Río Negro

`rio-negro` · capital: *Fray Bentos*

## 8.1. Ciudades principales

- Fray Bentos
  - Centro
  - Barrio Anglo
  - Las Canteras
  - Barrio Ferrando
- Young
  - Centro
  - Barrio Sur
- Nuevo Berlín
- San Javier

## 8.2. Pueblos y colonias

- Grecco
- Sarandí de Navarro
- Menafra
- Algorta
- Paso de los Mellizos
- Bellaco
- Sánchez Grande
- Los Arrayanes
- Colonia Ofir
- Villa María de Río Negro
- Tres Quintas
- Balneario Las Cañas de Río Negro
- Paraje Bopicuá
- Merinos

---

# 9. Paysandú

`paysandu` · capital: *Paysandú*

## 9.1. Ciudades principales

- Paysandú
  - Centro
  - Barrio Norte
  - Purificación
  - La Chapita
  - Barrio Curupí
  - P-3
  - Nuevo Paysandú
  - Barrio Obrero
- Guichón
- Quebracho
- Porvenir
- Chapicuy

## 9.2. Pueblos y colonias

- Lorenzo Geyres
- Piedras Coloradas
- Tambores
- Beisso
- Cerro Chato de Paysandú
- Constancia
- Gallinal
- Merinos de Paysandú
- Morató
- Nuevo Berlín Chico
- Orgoroso
- Pandule
- San Félix
- Termas de Almirón
- Termas de Guaviyú
- Colonia Nuevo Paysandú
- Casa Blanca
- Esperanza
- Arbolito

---

# 10. Salto

`salto` · capital: *Salto*

Las termas mueven una demanda de servicios propia, sobre todo en temporada.

## 10.1. Ciudades principales

- Salto
  - Centro
  - Barrio Artigas
  - Cerro
  - Barrio Uruguay
  - Saladero
  - Barrio Williams
  - Horacio Quiroga
  - Cien Manzanas
- Constitución
- Belén
- Villa Constitución

## 10.2. Termas y balnearios

- Termas del Daymán
  - Zona termal
  - Villa Daymán
- Termas del Arapey
- Salto Grande

## 10.3. Pueblos y colonias

- Colonia Lavalleja
- Rincón de Valentín
- San Antonio de Salto
- Chacras de Salto
- Cerros de Vera
- Colonia Itapebí
- Palomas
- Pueblo Fernández
- Albisu
- Garibaldi
- Migliaro
- Sarandí de Arapey
- Mataojo
- Corralito

---

# 11. Artigas

`artigas` · capital: *Artigas*

Departamento fronterizo con Brasil; Artigas y Bella Unión son ciudades gemelas
de Quaraí y Barra do Quaraí respectivamente.

## 11.1. Ciudades principales

- Artigas
  - Centro
  - Barrio Ayuí
  - Pintadito
  - Barrio Rivera
  - Cerro Ejido
  - Barrio Sur
- Bella Unión
  - Centro
  - Las Piedras de Bella Unión
- Tomás Gomensoro
- Baltasar Brum

## 11.2. Pueblos y colonias

- Bernabé Rivera
- Sequeira
- Javier de Viana
- Cuareim
- Colonia Palma
- Coronado
- Diego Lamas
- Franquía
- Paso Farías
- Topador
- Pueblo Cuaró

---

# 12. Rivera

`rivera` · capital: *Rivera*

Ciudad conurbada con Santana do Livramento (Brasil); la frontera es una calle.

## 12.1. Ciudades principales

- Rivera
  - Centro
  - Mandubí
  - Rivera Chico
  - Santa Isabel
  - Barrio Lavalleja
  - Insausti
  - Cerro Marconi
  - La Pedrera de Rivera
- Tranqueras
  - Centro
  - Barrio Sur
- Vichadero
- Minas de Corrales

## 12.2. Pueblos y colonias

- Cerro Pelado de Rivera
- Lapuente
- Amarillo
- Cerrillada
- Moirones
- Paso Ataques
- Rincón de Pacheco
- Santa Teresa de Rivera
- Cuñapirú
- La Puente
- Masoller
- Curticeiras
- Bañado del Chuy
- Cerro Chato de Rivera

---

# 13. Tacuarembó

`tacuarembo` · capital: *Tacuarembó*

El departamento más extenso del país; la distancia entre localidades es un dato
real a la hora de cotizar un servicio.

## 13.1. Ciudades principales

- Tacuarembó
  - Centro
  - López
  - Barrio Ferrocarril
  - La Pedrera de Tacuarembó
  - Godoy
  - Barrio Centenario
- Paso de los Toros
  - Centro
  - Barrio Sur
- San Gregorio de Polanco
- Ansina

## 13.2. Pueblos y colonias

- Curtina
- Achar
- Tambores de Tacuarembó
- Caraguatá
- Las Toscas de Caraguatá
- Piedra Sola
- Rincón de Pereira
- Cuchilla de Peralta
- Peralta
- Pueblo del Barro
- Batoví
- Clara
- Cerro de Pastoreo
- Laureles
- Punta de Carretera
- Balneario Iporá
- Chamberlain

---

# 14. Cerro Largo

`cerro-largo` · capital: *Melo*

Río Branco es ciudad gemela de Jaguarão (Brasil), separada por el puente
Barón de Mauá.

## 14.1. Ciudades principales

- Melo
  - Centro
  - Barrio Hipódromo
  - López Benítez
  - Barrio Sur
  - La Vinchuca
  - Cerro Largo
- Río Branco
  - Centro
  - Barrio Puerto
- Fraile Muerto
- Aceguá

## 14.2. Pueblos y colonias

- Tupambaé
- Isidoro Noblía
- Plácido Rosas
- Arévalo
- Bañado de Medina
- Cerro de las Cuentas
- Arbolito de Cerro Largo
- Centurión
- La Pedrera de Cerro Largo
- Poblado Uruguay
- Ramón Trigo
- Getulio Vargas
- Quebracho de Cerro Largo
- Santa Clara de Olimar
- Tres Islas
- Nando
- Toledo de Cerro Largo

---

# 15. Durazno

`durazno` · capital: *Durazno*

## 15.1. Ciudades principales

- Durazno
  - Centro
  - Barrio Ferrocarril
  - Santa Bernardina
  - Barrio Sur
  - La Amarilla
- Sarandí del Yí
  - Centro
- Villa del Carmen
- Blanquillo de Durazno

## 15.2. Pueblos y colonias

- La Paloma de Durazno
- Carlos Reyles
- Cerro Chato de Durazno
- Aguas Buenas
- Baygorria
- Centenario
- Feliciano
- La Concordia
- Las Palmas
- Ombúes de Oribe
- Parish
- Rossell y Rius
- San Jorge
- Santa Bernardina Norte
- Puntas de Herrera
- Molles de Porrúa
- Chileno

---

# 16. Flores

`flores` · capital: *Trinidad*

El departamento menos poblado del país. Fuera de Trinidad, ninguna localidad
necesita tercer nivel.

## 16.1. Capital

- Trinidad
  - Centro
  - Barrio Ferrocarril
  - Barrio Sur
  - La Loma

## 16.2. Pueblos y colonias

- Ismael Cortinas
- Andresito
- Juan José Castro
- Cerro Colorado de Flores
- La Casilla
- Puntas de Maciel
- San Antonio de Flores
- Cañada Nieto de Flores
- Porvenir de Flores

---

# 17. Florida

`florida` · capital: *Florida*

## 17.1. Ciudades principales

- Florida
  - Centro
  - Barrio Piedra Alta
  - Barrio Prado
  - De los Ceibos
- Sarandí Grande
  - Centro
  - Barrio Sur
- Casupá
- Fray Marcos

## 17.2. Pueblos y colonias

- Veinticinco de Mayo
- Veinticinco de Agosto
- Cardal
- Nico Pérez
- Capilla del Sauce
- Mendoza Chico
- Mendoza Grande
- Alejandro Gallinal
- Chamizo
- Independencia
- La Cruz
- Montecoral
- Polanco del Yí
- Puntas de Maciel de Florida
- Reboledo
- San Gabriel
- Berrondo
- Goñi
- Illescas
- Pintado
- Talita
- Valentines

---

# 18. Lavalleja

`lavalleja` · capital: *Minas*

Minas y su entorno serrano tienen movimiento turístico propio todo el año.

## 18.1. Ciudades principales

- Minas
  - Centro
  - Barrio Estación
  - Las Delicias
  - Barrio Olímpico
  - Cerro Artigas
- José Pedro Varela
  - Centro
- Solís de Mataojo
- Mariscala

## 18.2. Pueblos y colonias

- Batlle y Ordóñez
- Pirarajá
- Zapicán
- Villa Serrana
- Polanco
- Aramendía
- Blanes Viale
- Colón de Lavalleja
- Estación Solís
- Illescas de Lavalleja
- José Batlle y Ordóñez Norte
- La Plata
- Los Talas de Lavalleja
- Puntas de Villanueva
- Retamosa
- San Francisco de las Sierras
- Cerro Pelado de Lavalleja
- Estación Pedrera

---

# 19. Treinta y Tres

`treinta-y-tres` · capital: *Treinta y Tres*

## 19.1. Ciudades principales

- Treinta y Tres
  - Centro
  - Barrio Bertolotti
  - La Estación
  - Barrio Ejido
  - Villa Sara
- Vergara
  - Centro
- Santa Clara de Olimar Sur
- José Pedro Varela Norte

## 19.2. Pueblos y colonias

- Cerro Chato de Treinta y Tres
- Isla Patrulla
- Rincón
- Arrozal Treinta y Tres
- Charqueada (La Charqueada)
- General Enrique Martínez
- Poblado Villa Sara
- Sierras de Ríos
- Valentines de Treinta y Tres
- María Albina
- Placeres
- Ejido de Treinta y Tres
- Las Cañas de Treinta y Tres
- Mendizábal

---

# Anexo A — Cobertura y trazabilidad

## A.1. Estado respecto del dataset anterior

El dataset previo vivía en `src/data/locations.ts` con 19 departamentos, 47
localidades y 35 zonas, escrito como un `Record` anidado literal. Cubría lo
mínimo para que el selector funcionara, pero dejaba afuera departamentos enteros
al nivel de localidad: Durazno tenía una sola entrada, Flores una, Treinta y
Tres una.

Este documento lo reemplaza como fuente. Todo lo que existía sigue existiendo
con el mismo ID: **ninguna ubicación del dataset anterior fue renombrada ni
eliminada**, porque cada una puede estar escrita en un `locationId` ya guardado
o en una URL ya indexada (RF-110).

Cambios respecto del dataset anterior:

| Cambio | Detalle |
| --- | --- |
| Montevideo | De 21 barrios sueltos a los 62 oficiales de la Intendencia |
| Montevideo | Se agrega Santiago Vázquez y el oeste rural como localidades |
| Canelones | De 8 localidades a 62; se completan Costa de Oro e interior |
| Ciudad de la Costa | De 6 barrios a 12 |
| Maldonado | De 5 localidades a 38; Piriápolis y San Carlos ganan zonas |
| Punta del Este | De 5 barrios a 10 |
| Interior | Durazno, Flores, Lavalleja y Treinta y Tres pasan de 1–2 localidades a listas completas |

## A.2. Consecuencia para el generador

El generador debe producir la colección **plana** que describe RF-120, no el
árbol de este documento. El árbol es la forma de mantenerlo; la lista plana es
la forma de consumirlo.

Reglas que el generador aplica, en orden:

1. Emitir el país: `{ id: "uruguay", level: "country" }`.
2. Por cada `# N. Departamento`, emitir una entrada `level: "department"`.
3. Por cada viñeta al margen, emitir `level: "locality"` colgando del
   departamento del encabezado `#` vigente.
4. Por cada viñeta indentada, emitir `level: "area"` colgando de la localidad
   inmediatamente anterior.
5. Ignorar los encabezados `##`: son agrupaciones de lectura.
6. Ignorar todo texto en prosa entre listas.
7. Descartar el paréntesis del nombre al derivar el slug, pero conservarlo en
   el nombre visible: `Charqueada (La Charqueada)` → `charqueada`.

## A.3. Validaciones obligatorias al generar

El generador falla —no advierte— si alguna de estas no se cumple:

1. **Unicidad de ID.** No puede haber dos entradas con el mismo `id` en toda la
   colección.
2. **Unicidad dentro del padre.** No puede haber dos localidades con el mismo
   nombre en un departamento, ni dos zonas con el mismo nombre en una localidad.
3. **Padre existente.** Toda zona tiene una localidad anterior en el mismo
   departamento; toda localidad tiene un departamento.
4. **19 departamentos exactos.** Ni uno más ni uno menos, y sus slugs son los de
   la tabla del punto 3.
5. **Slug no vacío.** Un nombre que al normalizar quede vacío es un error de
   escritura, no una ubicación.
6. **Sin IDs huérfanos.** Si el dataset anterior tenía un ID que este documento
   ya no produce, el build falla: hay que decidir explícitamente qué se hace con
   los perfiles que lo referencian.

## A.4. Reglas para ampliar este documento

1. **Agregar una localidad es seguro**: se escribe la viñeta en el departamento
   que corresponde y se regenera el JSON. No rompe nada existente.
2. **Agregar una zona es seguro** con una salvedad: si la localidad no tenía
   zonas, el tercer selector aparece para todos los perfiles ya creados ahí. Sus
   `locationId` siguen siendo válidos al nivel de localidad (RF-116).
3. **Renombrar no es seguro.** Cambiar el nombre cambia el slug y por lo tanto
   el ID. Si hay que corregir un nombre mal escrito, se corrige y se agrega el
   ID viejo a la tabla de redirecciones; no se borra en silencio.
4. **Eliminar no es seguro sin revisar** `providers.location_id` y
   `providers.service_area_ids`. Hay perfiles que pueden estar apuntando ahí.
5. **Antes de crear una zona nueva, verificar que no sea una localidad.** La
   localidad es un lugar con nombre propio; la zona, un recorte dentro de él.
   Los balnearios de la Costa de Oro son localidades aunque estén pegados.
6. Toda ubicación nueva entra con su nombre canónico completo, sin abreviar y
   con tildes.

## A.5. Forma esperada del JSON

La colección es plana y cada entrada se basta a sí misma: quien la consume no
tiene que resolver la jerarquía por su cuenta (RF-111, RF-120).

```json
[
  { "id": "uruguay", "level": "country" },
  {
    "id": "canelones",
    "level": "department",
    "department": "Canelones",
    "departmentSlug": "canelones"
  },
  {
    "id": "canelones-ciudad-de-la-costa",
    "level": "locality",
    "department": "Canelones",
    "departmentSlug": "canelones",
    "locality": "Ciudad de la Costa",
    "localitySlug": "ciudad-de-la-costa"
  },
  {
    "id": "canelones-ciudad-de-la-costa-solymar",
    "level": "area",
    "department": "Canelones",
    "departmentSlug": "canelones",
    "locality": "Ciudad de la Costa",
    "localitySlug": "ciudad-de-la-costa",
    "area": "Solymar",
    "areaSlug": "solymar"
  }
]
```

Los campos del padre se repiten en cada nivel a propósito: es lo que permite
armar la etiqueta `"Solymar, Ciudad de la Costa"` y filtrar por departamento sin
un segundo lookup.
