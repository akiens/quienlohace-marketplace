# issues to solve
- After service card implementation we get an horizontal scroll on mobile. All the implementation related to this service card is broken have a horizontal scroll. Remember for smaller devices we use px-1 so we use all the available width.
- On dashboard (profile) I want to incorporate a popup that show how the services is going to look like if we navigate to that service. So you can add a button bellow to the card created, the button can say something like: `Ver detalles`. You can do the same on edit mode, I mean in edit mode when we create a service card we can directly show it as it is present in production mode, then we show 3 buttons bellow the card: `Detalles`, `Modificar`, `Eliminar`. If we do click in `Detalles` then we do the same as profile.





# Carta de Servicio(s) - Editar perfil
- La descripcion e inclusiones deberia tener un limite de caracteres bien determinado ademas de que se debe mostrar.
- el precio minimo y maximo cuando se selecciona rango deben de ir pegados asi es facil de agregar. Propongo crear un mismo div asi siempre caen juntos.
- En el modo edicion del profile, una ves creada la carte el modificar y eliminar buttons se ven muy feos. Mejor agregar un row debajo de la carta y agregar estos como buttons y incluir un `visualizar` par poder ver como quedo, este visualizar estaria mostrado en un popoup sin salir del modo edicion.
- aca en editar sigue el mismo flujo y estilos. Veo que la carta de servicios esta como separado del resto.