# Carta de servicio
- When we create or edit a service card we need to vinculate this one with 1 of the existing services from the provider. The idea is to improve search results.
- On Profile edit mode when we going to create ar edit any service card, we need instead of open a form below the cards, show a popup for these operation. Remember to follow the rules for form validation.

# bug
- When you fixed the horizontal scroll, you broke the rimbow from profile and profile edit mode.



Creo que deberiamos vincular con servicio en ves de espicialidad, al final un servicio ya tiene una especialidad vinculada y una carta de servicio esta presentando un servicio en concreto



# Busqueda
La busqueda no esta funcionando correctamente, esta trayendo resultados no homegeneos, por ejemplo si pides dentista, te pone inicialmente un servicio e dentista que es ahora mismo lo que tenemos, eso esta bien, pero despues en los proveedores aparecen muchos proveedores que no tienen ningun servicio de dentista o odontologia.

La idea del buscador a la hora de normalizar la data seria:
1. Buscar todos los servicios que estan relacionado o tienen mas peso con respecto al texto que se puso. 
2. Intercalar los resultados para evitar que un solo proveedor lo acapare todo.
3. Siempre los servicios deberian ir primero y luego los proveedores.
Ejemplo:
`criteria de busqueda:` Necesito un dentista
Este texto deberia retornar todos los dentistas u odontologos. O sea primero se deberia buscar en servicios para revisar match y luego en las especialidades que estan relacionadas directamente.

Imagina que la respuesta ordenada por relevancia es esta:

1. juan - carta servicio
2. juan - carta proveedor
3. amelia - carta proveedor
4. eugenio - carta servicio
5. teresa - carta proveedor
6. teresa - carta servicio
7. teresa - carta servicio
8. marcos- carta servicio
9. arletys - carta proveedor
10. pavel - carta servicio
11. alietys - carta proveedor
12. pedro - carta servicio

Teniendo en cuenta que la prioridad es el servicio cuando un proveedor tiene varios, y que la data debe intercalarse para que un proveedor no ocupe las principales posiciones siempre, entonces el orden deberia ser el siguiente:

1. Juan - Carta Servicio
2. amelia - carta proveedor
3. eugenio - carta servicio
4. teresa - carta servicio
5. marcos- carta servicio
6. arletys - carta proveedor
7. pavel - carta servicio
8. alietys - carta proveedor
9. pedro - carta servicio
10. juan - carta proveedor
11. teresa - carta servicio
12. teresa - carta proveedor

**Mi idea para una busqueda mas efectiva:** 
Yo creo que para evitar errores de busqueda deberiamos implementar un exact match. Algo como que las especialidades esten relacionadas por muchas palabras que serian servicios y estos servicios a su ves estaran relacionadas con otras palabras

Ejemplo: 
`Rubro`: Hogar y mantenimiento
`Especialidad`: Plomeria y sanitaria
`Servicios`: instalacion de caños, arreglo de fugas de agua, etc
`criteria`: caños, fontanero, fugas de agua, plomero, sanitaria, sanitario, fontaneria, plomeria