Despues de haber usado el Asistente para Crear perfiles inicialmente, creo que en verdad es un poco complicado, y podria llegar a ser un problema para personas que quizas no conocen mucho de tecnologia. Por lo tanto quisiera elaborar un Asistente mas dinamico que en realidad aconpañe al usuario que quiera crearse un perfil.

# Planes
Como ya sabemos tenemos 3 planes y en el proceso de creacion los pasos y capacidades aumentaran o bajaran segun el plan. Por eso el asistente debera tener en cuenta esto. Usualmente si se aumenta el plan no va a haber problemas pero si se degrada lo mas seguro es que ya algunas capacidades no sean validas. Todo este sistema y reglas se van a mantener, la nueva version del asistente solo acompañara para que el proceso de creacion tenga mas sentido.

# Idea
La idea es que el asistente acompañe al usuario en la creacion del perfil completando paso por paso y ofreciendo una guia

# Steps y que se espera
1. Bienvenida.
La idea es dar una bienvenida al usurio y dar una breve explicacion al usurio de cuales seran los steps que hay que completar para tener el perfil listo. Explicarle que en cualquier momento podra cambiar el plan si asi lo desea. Que podra llenar solo la informacion basica para tener un perfil funcional y que luego podra llenar el resto si asi lo desea.
- Mostrar el texto de bienvenida y un button `Comenzar` centrado debajo del texto.

2. Presentacion de Steps
Mostrar los steps entonces cuando seleccionas 1 debajo va haber una descripcion con un button `completar` cuando das click en el button se habre un popup que cubre todo la pantalla menos el header. La idea es ganar el mayor espacio posible.
- Cada step tendra una descripcion de explicando de que va el paso etc.
- Cada popup tendra el nombre del step, por ejemplo: Especialidades, Servicios, Ubicación
- Cuando el step es llenado correctamente entonces se activa el button `Continuar`


## Step 1 - Rubro y Especialidades (obligatorio llenar)
- Aca en ves de mostrar un select creo que lo mejor es mostrar un listado como se hace los filter y que seleccione las especialidades.
- Siempre se debe mostrar cuanto se puede seleccionar de acuerdo al plan, tal y como se hace actualmente.

## Step 2 - Servicios (obligatorio llenar)
- Aca directamente vamos a tener un input con un button agregar al lado, esto es para agregar directamente servicios propios. Si se agrega un servicio propio recuerda que hay que darle para que seleccione a que especialidad pertenece y asi vincularlo.
- Debajo vamos a mostrarle a sugerecias de servicios preestablecidos para que pueda seleccionar. Recuerda que es basado en lo que previamente se selecciono.
- Siempre debe estar visible cuanto puede seleccionar de acuerdo al plan.

## Step 3 - Identidad (obligatorio llenar)
- Aca tendremos el campo para nombre del perfil.
- Se seleccionara el tipo de perfil, pero vamos a mostrarlo como radio buttons asi quedan claras las opcines y no escondidas como es el caso del select.
- Como puedes notar movi identidad al paso #3 y el motivo es que en este punto ya sabemos cual es el rubro, especialidad y servicios que el usuarion piensa ofrecer. Estuve pensando que en el caso del text area `Descripcion` podemos ofrecer suggerencias de texto basado en el primer rubro/especialidad/servicio. Es solo una idea, podriamos armar un texto generico.

## Step 4 - Ubicacion (obligatorio llenar)
Aca mantendremos la misma presentacion de `Como prestas el servicio`, si elijes `en nuestro local` entonces damos a seleccionar localidad y direccion. El problema con la localidad es que un select es super incomodo as que es preferible mostrar otro popup encima del tamano del viewpor completo para que seleccione.
- En el caso de `zonas donde trabajas` creo que es mejor hacer lo mismo que con los rubros y especialidades, mostrar un checkbox para seleccionar, siempre respetando los limites del plan.

## Step 5 - Contacto (obligatorio llenar)
Este lo mantendria como esta.

## Plan limite
En este punto si estamos en plan cobre ya podriamos dar por finalizado la creacion del perfil si asi lo desea. Para los demas planes solo seria obligatorio el paso de pagar, que por ahora se mantendra con el checkbox para marcarlo como done.

## Step 6 - Imagenes (opcional)
- Aca quiero que la forma de subir el avatar y la imagen de portada sea igual que la de la galeria, o sea dar un click encima de la imagen, eso reduciria el espacio.

## pasos extras para planes de pago

## Step 7 - Redes (opcional)
- Creo que lo mejor es simplemente mostrar un imput por cada red en un formato de Icono haciendo el papel de un titulo y de subtitulo el nombre, uno debajo del otro como un conjunto y justo al lado el input.
- Aca no seria obligado entrar todos o ninguno, solo validariamos cual se lleno, si se lleno correctamente y creamos entradas para los que se llenaron bien y mostramos error para los que se agregaron mal, si esta vacio simplemente se ignora.

## Step 7 - Pago (obligatorio llenar)
- mantenerlo como lo tenemos ahora.

# Rules
- No se permitira avanzar en la creacion del perfil si no se llena el paso previo si este es obligatorio. La idea es evitar avanzar y despues ir hacia atras a buscar a ver que se olvido.
- Si el step en el que esta el usario es obligatorio entonces no se activa siguiente hasta que este se completa correctamente.





# Correcciones en Asistente Para Crear Perfil
- cuando llenamos el step `Contacto` que se muestra un resumen, en ves de mostrar en la parte de abajo el button `Agregar fotos` quiero que al lado derecho de `Crear perfil` o `Continuar al pago` (dependiendo del plan seleccionado) pongas el siguiente paso, en este caso `Imagenes`.
- En el  sticky footer donde pones estos buttons, no pongas ningun text. Reservemos esto solo para los buttons.