Este es el filtro general y unico del buscador. La idea es dar al usuario una amplia posibilidad de busqueda y dejar limpio el buscador en si ya que este solo necesitara 2 buttons mas el input para el criterio de busqueda.

# Secciones del filtro
## 1. Proveedor independiente, Proveedor Empresa y Servicios
Aca el usuario podra seleccionar si la busqueda incluira estas modalidades. Esto esta dado porque a parte de los proveedores vamos a publicar cartas de servicio, donde se oferta un servicio especifico, esto significa que un proveedor podra armar un servicio que aparecera en la busqueda.

Nota: Por ahora no esta implementado la targeta de servicio, solo tenemos la del perfil que puede ser proveedor independiente y la de empresa o equipo.

## 2. Ubicacion
Aca todo trata de la zona donde el cliente esta esperando encontrar ese servicio. 

- Tendra un checkbox `Uruguay . todo el pais` y todas las localidades.

### Rule
- Si se selecciona `Uruguay . Todo el pais` entonces se esconde las localidades, ya que no tine sentido.
- No limitar departamentos o localidades.

## 3. Calificacion
Aca permitira seleccionar los proveedores y servicios con mejor calificacion.

Note: Los servicios no tienen calificacion en su caso usaran las del proveedor.

#### Rule
- Por defecto se buscaran por todas las calificaciones.

## 4 Rubros y Especialidades.
Aca podras ser mas especifico con los rubros y especialidades.

- Creo que deberiamos agregar un checkbox: Todos los Rubros y especialidades.

### Rule
- no limitar la cantidad

## 5 Formas de pago
Permite a la busqueda ser mas especifica en cuanto a la formas de pago.

- Agregar un checkbox con `todos`.

## 6 Modalidad
Aca vamos a agregar otro filtro que diga si es a distancia, a domicilio, en local, de nuevo tendra un `todos`.

# General Rule
- En todos los casos donde existe un checkbox que marca a todos y este esta seleccionado, no escondas los filtros, mas bien ponlos como desabilitados, asi el usuario sabe que existe la posibilidad de ser especifico.
- El numero de filtros applicados debe estar presente tambien en el icono del buscar general.