# metrics
Como puedes ver en los planes, nosotros ofrecemos metricas como como parte de los planes. 

## Idea
Mi idea inicial es trackear todo lo posible para poder analizar la data y mejorar busquedas basado en eso. Con la metadata guardada pode generar metricas para los usuarios. Todo esto sin violar privacidad.

# como trakear
- Cuando un usuario entra a la pagina crear un identificador.


## Ideas de Track
1- Tiempo de permanencia del usuario en la pagina.
2- Cuando presiona en buscar, guardar todos los criterios de busqueda, incluidos los del filtro. Para esto quizas podemos crear un objeto. Como un usuario hace mas que una busqueda quizas podremos guardar ese objecto en un arreglo.
3- Guardar todos los click realizados por un usuario en un servicio, perfil publico, proveedor etc.
4- si el usuario dio click en un watsapp de un cliente.
5- por que paginas navego.
6- geolocalizacion, asi puedo saber desde donde fue visitada la pagina.
7- Medir todo lo que sea posible medir

## Mas ideas
Mi idea es poder guardar acciones de clientes y para poder determinar proveedores destacados, ofrecerle metricas de relevancia a los proveedores, tales como veces vistado su perfil etc.

Todo esto seria raw save y luego cuando cree el admin dashboard desde ahi podre leerlo mejor y crear features para obeservar comportamiento.

## aspectos tecnicos
- Implementar este tracking lo mas silente posible para el usuario. Que no sea tan evidente. 
- Un approach puede ser enviar just antes de cerrar el browser, una pestaña que tenga el sitio abierto.

