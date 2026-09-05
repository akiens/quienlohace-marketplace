# Departamentos y Localidades

Este documento es la **fuente de la verdad** para los nombres e identificadores
de los departamentos y localidades de Uruguay. De acá se genera el dataset
inicial utilizado para poblar la tabla jerárquica `locations`.

---

## 1. Cómo leer este documento

La geografía tiene tres niveles seleccionables. `Uruguay` es la raíz, los
departamentos dependen del país y las localidades dependen de un departamento.
El proveedor selecciona una opción existente; nunca crea ubicaciones.

```text
Uruguay → Departamento → Localidad
```

- **País** (1): `Uruguay`. Es una selección válida cuando el proveedor no quiere
  precisar su ubicación o cuando ofrece servicios en todo el territorio.
- **Departamento** (19): es una selección válida cuando el proveedor quiere
  indicar un departamento completo sin precisar una localidad.
- **Localidad** (452): ciudad, villa, pueblo, balneario o centro poblado utilizado
  cuando el proveedor desea indicar una ubicación o cobertura más precisa.

Los barrios y las zonas internas de una ciudad quedan fuera de este catálogo.
La mayor precisión admitida por el modelo inicial es la localidad.

### Formato de cada línea

Cada departamento abre con su encabezado y su slug. Dentro, cada localidad se
escribe como una viñeta sin indentación:

```text
- Nombre de la localidad
```

- El **nombre canónico** es lo único que se muestra en la interfaz. Se conserva
  con tildes, mayúsculas y sin abreviaciones innecesarias.
- Las variantes de escritura no generan registros separados; las resuelve la
  normalización utilizada para búsquedas.
- Cuando un nombre convive con otro de uso corriente, el alternativo se mantiene
  entre paréntesis y no genera una localidad adicional.

### Encabezados y agrupaciones

Los encabezados de nivel `##` dentro de un departamento son agrupaciones de
lectura. No representan otro nivel geográfico y el generador debe ignorarlos.
Solo las viñetas sin indentación representan localidades.

### Identificadores derivados

Los IDs se derivan al generar los datos iniciales para evitar mantener dos
fuentes diferentes:

| Nivel | Fórmula | Ejemplo |
| --- | --- | --- |
| País | constante | `uruguay` |
| Departamento | `slugify(nombre)` | `canelones` |
| Localidad | `<id departamento>-<slugify(nombre)>` | `canelones-ciudad-de-la-costa` |

`slugify` normaliza a NFD, quita diacríticos, pasa a minúsculas y reemplaza todo
lo que no sea `a-z0-9` por guiones (`src/lib/slug.ts`).

> **Los IDs geográficos son estables y no se renombran.** Pueden aparecer en
> URLs, en la ubicación de un perfil y en sus áreas de servicio. Cambiar
> un nombre visible es posible; cambiar su ID requiere una migración explícita.

### Colisiones de nombre

En Uruguay se repiten topónimos entre departamentos. El prefijo del departamento
desambigua cada localidad:

| Caso | IDs resultantes |
| --- | --- |
| Localidad homónima de su departamento | `florida-florida`, `salto-salto`, `rocha-rocha` |
| Mismo nombre en departamentos diferentes | `canelones-santa-lucia`, `colonia-santa-ana` |

Dentro de un mismo departamento no puede haber dos localidades con el mismo ID.

---

## 2. Criterios de catalogación

1. Una localidad es un lugar reconocido donde alguien puede ubicarse o recibir
   un servicio: ciudad, villa, pueblo, balneario o centro poblado.
2. Los barrios, zonas internas, municipios, códigos postales y calles no forman
   parte de esta versión del catálogo.
3. Los balnearios reconocidos se mantienen como localidades aunque estén próximos
   entre sí.
4. El catálogo prioriza lugares útiles para la búsqueda de servicios y evita
   subdivisiones que obliguen al usuario a tomar decisiones demasiado precisas.

### Reglas de selección que asume este dataset

- **Ubicación del proveedor:** puede seleccionar `Uruguay`, un departamento o
  una localidad. Solo se guarda una selección.
- **Lugares donde ofrece servicios:** puede seleccionar `Uruguay`, uno o varios
  departamentos, una o varias localidades, o una combinación no redundante de
  departamentos y localidades.
- El proveedor nunca está obligado a llegar hasta la localidad. El valor que se
  guarda es el nivel más específico que decidió indicar.
- `Uruguay` debe ser una elección explícita. No se debe interpretar un dato
  ausente como cobertura nacional en un perfil activo.
- Seleccionar `Uruguay` reemplaza cualquier área de servicio más específica.
- Seleccionar un departamento hace redundantes sus localidades descendientes,
  pero puede combinarse con localidades de otros departamentos.

---

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

> Los conteos se validan contra las localidades del cuerpo del documento. Si no
> coinciden, se corrige esta tabla antes de generar los datos iniciales.

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

# Anexo A — Cobertura y trazabilidad

## A.1. Estado respecto del dataset anterior

La versión anterior del documento contenía un tercer nivel con zonas y barrios.
Ese nivel fue eliminado para simplificar la selección y mantener únicamente
departamentos y localidades.

Si ya existen perfiles con identificadores de zonas o barrios, antes de aplicar
este catálogo se debe migrar cada referencia hacia su localidad padre. Si aún no
hay datos persistidos en producción, el cambio puede aplicarse directamente.

Se conservan los 19 departamentos y las 452 localidades listadas en el cuerpo
del documento.

## A.2. Consecuencia para el generador

El generador debe producir una única colección para poblar `locations`.
`Uruguay` se guarda como el registro raíz, de modo que elegir el país sea una
selección explícita y use la misma FK que departamentos y localidades.

Reglas que el generador aplica, en orden:

1. Emitir `uruguay` como registro raíz de tipo `country`, con `parent_id = null`.
2. Por cada `# N. Departamento`, emitir un registro de tipo `department` con
   `parent_id = 'uruguay'`.
3. Por cada viñeta sin indentación, emitir un registro de tipo `locality` con
   `parent_id` igual al ID del departamento del encabezado `#` vigente.
4. Rechazar cualquier viñeta indentada: el catálogo no admite un nivel inferior
   a localidad.
5. Ignorar los encabezados `##`: son agrupaciones de lectura.
6. Ignorar todo texto en prosa entre listas.
7. Descartar el paréntesis del nombre al derivar el slug, pero conservarlo en
   el nombre visible: `Charqueada (La Charqueada)` → `charqueada`.

## A.3. Validaciones obligatorias al generar

El generador falla —no advierte— si alguna de estas no se cumple:

1. **Unicidad de ID.** No puede haber dos entradas con el mismo `id` en toda la
   colección.
2. **Unicidad dentro del departamento.** No puede haber dos localidades con el
   mismo ID dentro de un departamento.
3. **Padre existente.** Todo departamento debe depender de `uruguay` y toda
   localidad debe depender de uno de los departamentos definidos.
4. **19 departamentos exactos.** Ni uno más ni uno menos, y sus slugs son los de
   la tabla del punto 3.
5. **Slug no vacío.** Un nombre que al normalizar quede vacío es un error de
   escritura, no una ubicación.
6. **Conteo consistente.** El número de localidades por departamento debe
   coincidir con el índice del punto 3.
7. **Sin cuarto nivel.** Una viñeta indentada es un error y debe detener la
   generación.
8. **Raíz única.** `uruguay` debe ser el único registro sin `parentId` y el único
   registro de tipo `country`.

## A.4. Reglas para ampliar este documento

1. **Agregar una localidad es seguro**: se escribe la viñeta en el departamento
   que corresponde y se regenera el JSON. No rompe nada existente.
2. **Renombrar no es seguro.** Cambiar el nombre cambia el slug y por lo tanto
   el ID. Si hay que corregir un nombre mal escrito, se corrige y se agrega el
   ID viejo a la tabla de redirecciones; no se borra en silencio.
3. **Eliminar no es seguro** sin revisar `profiles.location_id` y
   `profile_service_areas.location_id`.
4. **No agregar barrios o zonas internas.** Si se necesita mayor precisión en
   el futuro, debe diseñarse como una ampliación explícita del modelo.
5. Toda localidad nueva entra con su nombre canónico completo, sin abreviar y
   con tildes.

## A.5. Forma esperada del JSON

El JSON entrega una sola colección jerárquica destinada a poblar `locations`:

```json
{
  "locations": [
    {
      "id": "uruguay",
      "parentId": null,
      "type": "country",
      "name": "Uruguay",
      "slug": "uruguay"
    },
    {
      "id": "canelones",
      "parentId": "uruguay",
      "type": "department",
      "name": "Canelones",
      "slug": "canelones"
    },
    {
      "id": "canelones-ciudad-de-la-costa",
      "parentId": "canelones",
      "type": "locality",
      "name": "Ciudad de la Costa",
      "slug": "ciudad-de-la-costa"
    }
  ]
}
```
