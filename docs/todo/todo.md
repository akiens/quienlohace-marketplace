
# load time issue on Inicio and Buscar pages
Right now the `Inicio` page and the `Buscar` page are pretty slow and look like is because we are doing search on this pages. So lets avoid that, I think is a better approach to dont search on this pages and first load and get a pre-prepared loaded cards. So lets do this:

## Inicio
We need to implement a way have the ability to select the providers to appear in `Profesionales destacados`, I mean be able to selec 1, 2........10, then we show these in this section, so if we do this on build time we can create this section with fixed data. If there is not provider selected then we just pick up the first 4 from db. But the idea is to have a prebuild cards.
The same before for `Mejor calificados` section


## Search Page
Here just the same as in `Inicio` page before. Has the ability to select providers and services to show in precompiled way. So I want to just as we do for search when no parameters is added and not criteria, lets pick the firt 12 result and prebuild them, but remember to respect the search rules of intercalation betwen services and provider owner. I dont want 1 provider to get all the search result.


Note: Remember that the idea behind this is to avoid search at first load. I dont care about is the result is the same. Now when we perform a search then we go to the normal flow as we have before.

