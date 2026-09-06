# dashboard page
- El mensaje de downgrade se debe mostrar justo debajo del header del sitio. Ahora mismo esta debajo del header de la pagina "Mi perfil"
- Quita el precio del plan tanto en desktop como en mobile. En mobile deja en el button de cambiar la palabra "Cambiarmi plan"


## Bug
- Los rubros se muestran, pero creo que no estas usando el mismo en todo, por ejemplo en las categorias del menu de la aplicacion usas "Hogar y mantenimiento" y aca en el dashboard estas usando "Hogar, construccion y mantenimiento" esto no es uniforme.
- Si te fijas en el nombre e los servicios para jotas@gmail.com esta en el dashboard usando el id y esto es porque de alguna forma cuando se persistio la data en el nombre se puso el id en ves del nombre del servicio que se selecciono por lo que creo que hay un bug a la hora de seleccionar los servicios y a la hora de persistirlos. Solo se deberia persistir el nombre. Tambien recuerda que los servicios son texto libre que puede darse el caso que no esta vinculados a ninguna especialidad.
