Para un correcto registro de usuario debemos asegurarnos de que funciona correctamente el formulario de registro. Este formulario sera muy simple y su intencion es no generar friccion inicial al proveedor de servicios.

# Como registrarse
1. Mediante el uso de google.
2. Entrando correo y contraseña.
- En este caso tendremos 3 inputs: correo, contraseña y repetir contraseña

# Validacion del formulario de registro
- Siempre habra un plan seleccionado. Por defecto cobre
- Validar en el frontend y backend que el correo entrado realmente tiene un formato de correo.
- Validar en el backend que el correo no esta en uso por parte de otro proveedor. En caso de que este en uso entonces hay que pasar un mensaje advirtiendo de que ese correo ya esta en uso.
- Validar que las contraseñas al menos tienen 8 caracteres.
- Validar que las contraseñas son iguales. Esta validacion se hace en el frontend y en el backend.

# Que ocurre cuando se registra correctamente.
1. Se crea un nuevo usuario de tipo proveedor.
2. Nos aseguramos que la cache relacionada con "Profile Creator Wizard" es limpiada. Esto es solo para evitar que haya datos de usuarios que se registraron en le mismo navegador. En la practica puedes ser algo raro que ocurra.
3. Una ves creado el usuario, la aplicacion nos redirige directamente a la pagina para crear el perfil.
