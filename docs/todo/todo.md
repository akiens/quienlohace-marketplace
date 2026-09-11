The load time issue from "Inicio" page and "Buscar" page is ok. But we introduce 2 issues:
1. On `Inicio` page when we try to search something from `Buscar` component we need to be automatically redirected to `Buscar` page and show an scheleton frame of cards until the search return with results. Right now when you do click on search the page wait for response and then navigate to `Buscar` page and show the result and this is not a good experience.
2. There are 2 ways to land into `Buscar` page:
  1. Normal navigation. The client just do click on header menu item `Buscar`.
  2. As result of a search. When the client is on `Inicio` page or another page and do a search and land to `Buscar` page.
- On 1er way there is an issue related to the search. If we navigate to buscar page we are going to get a preloaded services card, this is ok, but the situation is when you try to search something throught the  `buscar` component, the buscar button show like is disable and dont search nothing.

# The search must have this behavior
- If we are in `buscar` page and we didnt perform any search, then if we do click on the buscar button we need to show a scheleton until we retrive the data and show to the user.
- If we already did a search but we change any parameter, filter or criteria then we again show a scheleton until we get the data back and show the result.
- If we already did a search but we didnt change nothing, no criteria or filter change then we show a message indicating that is not necessary to perform the search because we already have the result.
- If we are waiting for a search result we need to show in the button search a loading state (we already have) and dont allow new search until the result arrive.
- If we do click on show more, we need to place the scheleton and way unit the result arrive then we interchange.