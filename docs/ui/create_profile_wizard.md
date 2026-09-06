Cuando un usuario se registra por primera vez entonces es redirigido a la pagina "Crear" esta pagina mostrara un formulario por etapas que ayudara a crear un perfil basico o avanzado segun el plan elegido.

# Flow

- El borrador (`qlh.profileDraft` en localStorage) se borra **al enviar el formulario de registro**, no al entrar a "Crear".

  Antes se borraba al entrar a "Crear" y eso rompía la recarga: quien recargaba a mitad del formulario perdía el paso y todo lo cargado. Borrar en el registro cumple lo mismo —garantizar que una cuenta nueva no arranque con datos de otra— sin castigar a quien simplemente recarga.

  El borrador además lleva anotada la cuenta que lo escribió y no se lee desde ninguna otra, así que una máquina compartida no arrastra datos ajenos aunque el borrado no llegue a correr.

- El plan elegido (`qlh.selectedPlan`) sí se reclama al entrar a "Crear": se elige en `/planes` sin sesión, así que no puede nacer a nombre de nadie. Al entrar se le pone dueño, y si ya era de otra cuenta se descarta.

- Desde `/planes`, tocar el botón de un plan lleva a "Registro" con ese plan ya elegido y con el foco puesto en el formulario (ancla `#auth-form`).

## Persistencia al recargar

El formulario guarda el borrador en cada cambio, pero **no antes de haber leído el que ya estaba**.

`useSyncExternalStore` rinde primero el snapshot del servidor —vacío, para que la hidratación calce— y recién en el render siguiente el del cliente. Si el guardado corre en ese primer render escribe un formulario en blanco encima del guardado. No alcanza con ignorar los borradores vacíos: la modalidad viene con "A domicilio" puesta de fábrica, así que el borrador del primer render no parece vacío y pisa igual.

# Rules

- En el step#4 Ubicación, si el proveedor no selecciona "A domicilio" entonces no se muestra "Zonas donde trabajás": no va a ninguna zona, atiende en su local o a distancia.

  Las zonas se derivan igual, porque todo perfil activo necesita al menos un área o no aparece en ninguna búsqueda (BR-016): se toma el departamento de cada local declarado, y si no hay ningún local —sólo a distancia— el país entero.

- El correo de contacto se precarga con el correo entrado en el formulario de registro. Queda editable: puede ser distinto del de acceso.

- Las modalidades del step#4 son tres, explícitas: `A domicilio`, `En nuestro local`, `A distancia`. No hay opción "híbrida" ni se la nombra — quien atiende de varias formas marca varias, y ponerle nombre a la combinación agregaba un concepto para decir lo que las tres casillas ya dicen.

- El contador de cada campo se mantiene ("Especialidades 2/2"): dice cuánto queda por agregar, que es lo que hace falta saber mientras se carga.

  Lo que no va en las etiquetas es el nombre del plan ("tu plan Cobre permite hasta 2"). Repetirlo en cada campo alargaba los labels y agobiaba sin agregar nada: el número ya está en el contador. El aviso con el plan y el enlace para ampliarlo aparece una sola vez, al llegar al tope, que es cuando saber qué plan te limita sirve para algo.
