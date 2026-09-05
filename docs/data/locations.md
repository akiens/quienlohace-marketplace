# Departamentos y Localidades

Este documento es la **fuente de la verdad** para los nombres e identificadores
de los departamentos y localidades de Uruguay. De acá se genera el dataset
inicial utilizado para poblar la tabla jerárquica `locations`.

---

## 1. Formato editorial

El cuerpo mantiene la jerarquía `Uruguay → departamento → localidad`. Cada
departamento abre con un encabezado y su slug; cada localidad es una viñeta sin
indentación. Los encabezados de nivel `##` son agrupaciones de lectura.

Los nombres conservan tildes, mayúsculas y aclaraciones entre paréntesis. Este
documento no define cómo seleccionar, normalizar, buscar o persistir lugares.

## 2. Referencias normativas

- Catálogo y alcance geográfico: **BR-014**.
- Ubicaciones físicas: **BR-015**.
- Áreas de servicio y búsqueda: **BR-016**.
- Estructura persistida y normalización: **TR-017 a TR-019**.
- Parsing, IDs, validaciones y evolución del dataset: **TR-032 a TR-034**.

## 3. Índice de departamentos

| # | Departamento | Slug | Capital | Localidades |
| --- | --- | --- | --- | --- |
| 1 | Montevideo | `montevideo` | Montevideo | 7 |
| 2 | Canelones | `canelones` | Canelones | 66 |
| 3 | Maldonado | `maldonado` | Maldonado | 36 |
| 4 | Rocha | `rocha` | Rocha | 25 |
| 5 | Colonia | `colonia` | Colonia del Sacramento | 36 |
| 6 | San José | `san-jose` | San José de Mayo | 24 |
| 7 | Soriano | `soriano` | Mercedes | 23 |
| 8 | Río Negro | `rio-negro` | Fray Bentos | 18 |
| 9 | Paysandú | `paysandu` | Paysandú | 24 |
| 10 | Salto | `salto` | Salto | 21 |
| 11 | Artigas | `artigas` | Artigas | 15 |
| 12 | Rivera | `rivera` | Rivera | 18 |
| 13 | Tacuarembó | `tacuarembo` | Tacuarembó | 21 |
| 14 | Cerro Largo | `cerro-largo` | Melo | 21 |
| 15 | Durazno | `durazno` | Durazno | 21 |
| 16 | Flores | `flores` | Trinidad | 10 |
| 17 | Florida | `florida` | Florida | 26 |
| 18 | Lavalleja | `lavalleja` | Minas | 22 |
| 19 | Treinta y Tres | `treinta-y-tres` | Treinta y Tres | 18 |
| | **Total** | | | **452** |

> La validación de estos conteos está definida en **TR-033**.

---

# 1. Montevideo

`montevideo` · capital: *Montevideo*

En el modelo inicial, Montevideo se selecciona como localidad completa. Los
barrios no forman parte del catálogo.

## 1.1. Capital

- Montevideo

## 1.2. Resto del departamento

- Santiago Vázquez
- Abayubá
- Punta Espinillo
- Colonia Nicolich Oeste
- Pajas Blancas
- Santa Catalina

Localidades del oeste y noroeste rural, fuera de la mancha urbana continua.

---

# 2. Canelones

`canelones` · capital: *Canelones*

El departamento con más localidades del catálogo y uno de los principales
centros de actividad de proveedores después de Montevideo.

## 2.1. Área metropolitana

- Canelones (Guadalupe)
- Las Piedras
- La Paz
- Progreso
- Juanicó
- Barros Blancos
- Toledo
- Suárez (Villa Nueva de Suárez)
- Sauce
- Pando
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

Se conserva como una única localidad. El modelo inicial no divide Ciudad de la
Costa en zonas internas.

- Ciudad de la Costa

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

Departamento de alta estacionalidad, con varias ciudades y balnearios que se
mantienen como localidades independientes.

## 3.1. Conurbación Maldonado – Punta del Este

- Maldonado
- Punta del Este
- Punta Ballena
- Solanas
- La Barra
- Manantiales
- José Ignacio
- Balneario Buenos Aires
- El Chorro
- Santa Mónica
- Sauce de Portezuelo
- Ocean Park

## 3.2. San Carlos y el este

- San Carlos
- La Aguada
- Guardia Vieja
- Partido Norte
- Garzón
- Pueblo Edén

## 3.3. Piriápolis y la costa oeste

- Piriápolis
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

Costa oceánica y balnearios. Cada lugar incluido se trata como una localidad,
sin subdivisiones internas.

## 4.1. Capital y centros urbanos

- Rocha
- Chuy
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
- Balneario Costa Azul
- Punta Rubia Norte

---

# 5. Colonia

`colonia` · capital: *Colonia del Sacramento*

Departamento de colonias suizas y valdenses, con localidades de nombres propios
muy reconocibles.

## 5.1. Ciudades principales

- Colonia del Sacramento
- Carmelo
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

Ciudad del Plata se conserva como una única localidad, sin subdivisiones
internas en el modelo inicial.

## 6.1. Ciudades principales

- San José de Mayo
- Ciudad del Plata
- Libertad
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
- Dolores
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
- Young
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
- Constitución
- Belén
- Villa Constitución

## 10.2. Termas y balnearios

- Termas del Daymán
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
- Bella Unión
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
- Tranqueras
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
- Paso de los Toros
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
- Río Branco
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
- Sarandí del Yí
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

El departamento menos poblado del país. Todas sus opciones se representan al
nivel de localidad.

## 16.1. Capital

- Trinidad

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
- Sarandí Grande
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
- José Pedro Varela
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
- Vergara
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

# Anexo A — Trazabilidad

La versión anterior contenía zonas y barrios. Este nivel fue eliminado y las
referencias existentes deben migrarse a su localidad padre antes de adoptar el
dataset actual. El cuerpo conserva 19 departamentos y 452 localidades.

Las reglas de generación, validación, migración, renombre y eliminación están
centralizadas en **TR-032**, **TR-033** y **TR-034**. Las reglas funcionales de
selección y cobertura están en **BR-014 a BR-016**.
