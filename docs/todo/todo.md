# Editar Perfil



# Formularios 
Creo que los formularios no se estan comportando homogeneamente. Aca te dejo una guia general de como deberia funcionar:

## Validacion
- La validacion debe ser echa tanto en el cliente (frontend) como en el backend (backend). Se debe cumplir los mismos requisitos para que sean validos.
- Nunca revelar en los form alerts el mensage stack real del error. Hay que evitar mostrar data sensible al usario.

### Frontend
- Los formularios deberan solo activar el `Guardar Cambios` solo si se cambia alguno de los inputs, selects o elementos de formulario y los valores son validos de acuerdo a la rule preestablecida para ese elemento.
- Cada input, select o element debe estar pendiente de los cambios que se van haciendo y mostrar un error mas el borde en rojo para el caso de los inputs si se esta tecleando algo mal. 
- Si se hace un cambio que es valido automaticamente se activa el buttom  `guardar cambios`

- Una ves se da click en `Guardar Cambios`:
  - Si se recive un success entonces mostramos el success form alert y desabilitamos el formulario de vuelta a espera de algun otro tipo de cambio.
  - Si se recive un fail o error entonces mostramos el error form alert y mostramos en los inputs bordeados de alert color. Si no esta relacionado con los inputs entonces lo mostramos en el form-alert

### Backend
- Si ocurre un error que no permite processar los datos entonces enviamos hacia atras un error como debe ser pero no pasamos el stack del mensaje de error, solo pasamos una sentencia generica para cada situacion. Hay que evitar mostrar informacion sensible al usuario.

## Rules
- Crea las rules que sean necesario para que esto sea persistente