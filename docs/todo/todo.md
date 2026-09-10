# search and search filter
Right now look like there are some issues related to the search result and the way the search is working.

- if we do any search and then we open the filter and try to do any click on any criteria, inmediatly we get a search. This is not correct and is not the expected behavior

# How the search must work
- Whe we enter any criteria on the input and we do click on "buscar" we get all the result related and then if we do click on mostrar we retrieve the next documents like a pagination, so we need to show a "Cargando..." or something that show progress. 
- If we go and open de filter then and select any filter option, we dont inmediatly to search nothing, we need to wait for the event click on "buscar" button, no matter if is from the filter or from the man search. 
- In all the cases the result must be a pagination.