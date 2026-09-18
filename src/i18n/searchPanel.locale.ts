/**
 * Strings for the windowed search panel and its agent tools.
 *
 * Kept out of `translations/en.ts` so the panel and its tool descriptions land
 * as one reviewable unit, the same way `workspaceAgentTools.locale.ts` does.
 *
 * Note for anyone adding messages here: vue-i18n treats braces and the pipe
 * character as message syntax, and this app is on v11, where the v12
 * backslash escapes do not work. A description containing a literal brace
 * raises "Invalid token in placeholder" and hands the model a broken tool
 * description at runtime. Reword rather than escape.
 */
export const searchPanelEn = {
  searchPanel: {
    panelLabel: 'Search results',
    untitled: 'Search',
    searching: 'Searching...',
    noResults: 'No results for this search.',
    openInBrowser: 'Open in browser',
    openInTab: 'Open in new tab',
    dismiss: 'Dismiss',
    clearAll: 'Clear results',
    moveHint: 'Drag to move the search panel, or use the arrow keys',
    resizeHint: 'Drag to resize the search panel, or use the arrow keys',
    centerHint: 'Centre the search panel',
    floatHint: 'Show results in a window',
    dockHint: 'Show results around the avatar',
    expandHint: 'Expand the search panel',
    collapseHint: 'Collapse the search panel',

    // -- agent tool results -------------------------------------------------
    layoutSet: 'Search results are now shown as: {layout}.',
    layoutAlready: 'Search results are already shown as: {layout}.',
    layoutInvalid: 'Unknown search layout. Use orbit, floating, or fullscreen.',
    expanded: 'Expanded the search panel.',
    collapsed: 'Collapsed the search panel.',
    moved: 'Moved the search panel.',
    resized: 'Resized the search panel.',
    centered: 'Centred the search panel.',
    layoutReset: 'Reset the search panel to its default position.',
    positionObject: 'Provide position as an object with x and y numbers.',
    sizeObject: 'Provide size as an object with width and height numbers.',
    notFloating:
      'The search panel is not in its floating layout, so there is nothing to move. Set layout to floating first.',
    unknownControl:
      'Unknown search panel control "{control}". Use one of: {list}.',
    controlString: 'Provide the search panel control as a string.',

    focusedResult: 'Focused result {position}: {title}',
    focusIndexNumber: 'Provide the result number as a number, counting from 1.',
    focusOutOfRange:
      'There is no result number {position}. There are {count} results right now.',
    noResultsToFocus: 'There are no search results on screen to point at.',
    openedResult: 'Asked the browser to open result {position}: {title}',
    openNoUrl: 'That result has no link to open.',

    actionSearchPanel: 'Changed search panel',
    actionFocusResult: 'Focused search result',
    actionOpenResult: 'Opened search result',

    toolDescSetSearchPanel:
      'Move, resize, expand or restore the search results panel. Controls: layout with the values orbit, floating or fullscreen; expand with true or false; position taking x and y; size taking width and height; center; and reset. Orbit is the default and arcs the result cards around the avatar. Floating is a draggable window that lists every result and can be scrolled. Fullscreen covers the screen for reading. This only changes how results are presented and never runs a new search, and it does not touch the live browser panel, which has its own set_browser_panel tool.',
    toolDescFocusSearchResult:
      'Point at one search result so the user can see which one is meant, counting from 1 in the order they are on screen. Use this when the user says something like the second one. It only highlights and never opens anything, so follow it with open_search_result if they want to read the page.',
    toolDescOpenSearchResult:
      'Open one search result in the live browser panel, counting from 1. The page loads in the cloud browser session that carries the user saved logins, so it opens signed in. Read the returned message rather than assuming it worked, and say which result was opened by its title so a wrong pick can be caught.',
  },
} as const;

export const searchPanelEs = {
  searchPanel: {
    panelLabel: 'Resultados de busqueda',
    untitled: 'Busqueda',
    searching: 'Buscando...',
    noResults: 'Sin resultados para esta busqueda.',
    openInBrowser: 'Abrir en el navegador',
    openInTab: 'Abrir en una pestana nueva',
    dismiss: 'Descartar',
    clearAll: 'Borrar resultados',
    moveHint: 'Arrastra para mover el panel de busqueda, o usa las flechas',
    resizeHint: 'Arrastra para redimensionar el panel de busqueda, o usa las flechas',
    centerHint: 'Centrar el panel de busqueda',
    floatHint: 'Mostrar los resultados en una ventana',
    dockHint: 'Mostrar los resultados alrededor del avatar',
    expandHint: 'Ampliar el panel de busqueda',
    collapseHint: 'Reducir el panel de busqueda',

    layoutSet: 'Los resultados se muestran ahora como: {layout}.',
    layoutAlready: 'Los resultados ya se muestran como: {layout}.',
    layoutInvalid: 'Disposicion de busqueda desconocida. Usa orbit, floating o fullscreen.',
    expanded: 'Panel de busqueda ampliado.',
    collapsed: 'Panel de busqueda reducido.',
    moved: 'Panel de busqueda movido.',
    resized: 'Panel de busqueda redimensionado.',
    centered: 'Panel de busqueda centrado.',
    layoutReset: 'Panel de busqueda restablecido a su posicion por defecto.',
    positionObject: 'Indica la posicion como un objeto con x e y numericos.',
    sizeObject: 'Indica el tamano como un objeto con width y height numericos.',
    notFloating:
      'El panel de busqueda no esta en su disposicion flotante, asi que no hay nada que mover. Cambia layout a floating primero.',
    unknownControl:
      'Control del panel de busqueda desconocido "{control}". Usa uno de: {list}.',
    controlString: 'Indica el control del panel de busqueda como texto.',

    focusedResult: 'Resultado {position} destacado: {title}',
    focusIndexNumber: 'Indica el numero de resultado como un numero, empezando por 1.',
    focusOutOfRange:
      'No existe el resultado numero {position}. Ahora mismo hay {count} resultados.',
    noResultsToFocus: 'No hay resultados de busqueda en pantalla a los que apuntar.',
    openedResult: 'Se ha pedido al navegador abrir el resultado {position}: {title}',
    openNoUrl: 'Ese resultado no tiene enlace que abrir.',

    actionSearchPanel: 'Panel de busqueda cambiado',
    actionFocusResult: 'Resultado destacado',
    actionOpenResult: 'Resultado abierto',

    toolDescSetSearchPanel:
      'Mueve, redimensiona, amplia o restaura el panel de resultados de busqueda. Controles: layout con los valores orbit, floating o fullscreen; expand con true o false; position con x e y; size con width y height; center; y reset. Orbit es el valor por defecto y coloca las tarjetas alrededor del avatar. Floating es una ventana arrastrable que lista todos los resultados y se puede desplazar. Fullscreen ocupa la pantalla para leer. Solo cambia como se presentan los resultados y nunca lanza una busqueda nueva, y no afecta al panel del navegador en vivo, que tiene su propia herramienta set_browser_panel.',
    toolDescFocusSearchResult:
      'Senala un resultado de busqueda para que el usuario vea a cual te refieres, contando desde 1 en el orden en que aparecen. Usalo cuando el usuario diga algo como el segundo. Solo lo resalta y nunca abre nada, asi que continua con open_search_result si quiere leer la pagina.',
    toolDescOpenSearchResult:
      'Abre un resultado de busqueda en el panel del navegador en vivo, contando desde 1. La pagina se carga en la sesion de navegador en la nube que conserva las sesiones iniciadas del usuario, asi que se abre con la sesion iniciada. Lee el mensaje devuelto en lugar de dar por hecho que funciono, y di que resultado se abrio por su titulo para que se pueda detectar una eleccion equivocada.',
  },
} as const;

export const searchPanelFr = {
  searchPanel: {
    panelLabel: 'Résultats de recherche',
    untitled: 'Recherche',
    searching: 'Recherche en cours...',
    noResults: 'Aucun résultat pour cette recherche.',
    openInBrowser: 'Ouvrir dans le navigateur',
    openInTab: 'Ouvrir dans un nouvel onglet',
    dismiss: 'Fermer',
    clearAll: 'Effacer les résultats',
    moveHint: 'Fais glisser pour déplacer le panneau de recherche, ou utilise les flèches',
    resizeHint: 'Fais glisser pour redimensionner le panneau de recherche, ou utilise les flèches',
    centerHint: 'Centrer le panneau de recherche',
    floatHint: 'Afficher les résultats dans une fenêtre',
    dockHint: "Afficher les résultats autour de l'avatar",
    expandHint: 'Agrandir le panneau de recherche',
    collapseHint: 'Réduire le panneau de recherche',

    layoutSet: 'Les résultats sont maintenant affichés ainsi : {layout}.',
    layoutAlready: 'Les résultats sont déjà affichés ainsi : {layout}.',
    layoutInvalid: 'Disposition de recherche inconnue. Utilise orbit, floating ou fullscreen.',
    expanded: 'Panneau de recherche agrandi.',
    collapsed: 'Panneau de recherche réduit.',
    moved: 'Panneau de recherche déplacé.',
    resized: 'Panneau de recherche redimensionné.',
    centered: 'Panneau de recherche centré.',
    layoutReset: 'Panneau de recherche remis à sa position par défaut.',
    positionObject: 'Indique la position comme un objet avec des nombres x et y.',
    sizeObject: 'Indique la taille comme un objet avec des nombres width et height.',
    notFloating:
      "Le panneau de recherche n'est pas dans sa disposition flottante, il n'y a donc rien à déplacer. Mets d'abord layout sur floating.",
    unknownControl:
      'Contrôle du panneau de recherche inconnu "{control}". Utilise l\'un de : {list}.',
    controlString: 'Indique le contrôle du panneau de recherche sous forme de texte.',

    focusedResult: 'Résultat {position} mis en avant : {title}',
    focusIndexNumber: 'Indique le numéro du résultat comme un nombre, en comptant à partir de 1.',
    focusOutOfRange:
      "Il n'y a pas de résultat numéro {position}. Il y a {count} résultats en ce moment.",
    noResultsToFocus: "Il n'y a aucun résultat de recherche à l'écran à montrer.",
    openedResult: 'Le navigateur a été invité à ouvrir le résultat {position} : {title}',
    openNoUrl: "Ce résultat n'a aucun lien à ouvrir.",

    actionSearchPanel: 'Panneau de recherche modifié',
    actionFocusResult: 'Résultat de recherche mis en avant',
    actionOpenResult: 'Résultat de recherche ouvert',

    toolDescSetSearchPanel:
      "Déplace, redimensionne, agrandit ou restaure le panneau de résultats de recherche. Contrôles : layout avec les valeurs orbit, floating ou fullscreen ; expand avec true ou false ; position prenant x et y ; size prenant width et height ; center ; et reset. Orbit est la valeur par défaut et dispose les cartes de résultats en arc autour de l'avatar. Floating est une fenêtre déplaçable qui liste tous les résultats et peut défiler. Fullscreen occupe l'écran pour la lecture. Cela change seulement la manière dont les résultats sont présentés et ne lance jamais une nouvelle recherche, et cela ne touche pas au panneau de navigateur en direct, qui a son propre outil set_browser_panel.",
    toolDescFocusSearchResult:
      "Montre un résultat de recherche pour que l'utilisateur voie duquel il s'agit, en comptant à partir de 1 dans l'ordre où ils sont à l'écran. Utilise ceci quand l'utilisateur dit quelque chose comme le deuxième. Cela ne fait que mettre en avant et n'ouvre jamais rien, donc enchaîne avec open_search_result s'il veut lire la page.",
    toolDescOpenSearchResult:
      "Ouvre un résultat de recherche dans le panneau de navigateur en direct, en comptant à partir de 1. La page se charge dans la session de navigateur dans le cloud qui conserve les connexions de l'utilisateur, elle s'ouvre donc déjà connectée. Lis le message renvoyé plutôt que de supposer que ça a marché, et dis quel résultat a été ouvert par son titre pour qu'un mauvais choix puisse être repéré.",
  },
} as const;

export const searchPanelPt = {
  searchPanel: {
    panelLabel: 'Resultados da pesquisa',
    untitled: 'Pesquisa',
    searching: 'A pesquisar...',
    noResults: 'Sem resultados para esta pesquisa.',
    openInBrowser: 'Abrir no navegador',
    openInTab: 'Abrir num separador novo',
    dismiss: 'Dispensar',
    clearAll: 'Limpar resultados',
    moveHint: 'Arrasta para mover o painel de pesquisa, ou usa as setas',
    resizeHint: 'Arrasta para redimensionar o painel de pesquisa, ou usa as setas',
    centerHint: 'Centrar o painel de pesquisa',
    floatHint: 'Mostrar os resultados numa janela',
    dockHint: 'Mostrar os resultados à volta do avatar',
    expandHint: 'Ampliar o painel de pesquisa',
    collapseHint: 'Reduzir o painel de pesquisa',

    layoutSet: 'Os resultados aparecem agora assim: {layout}.',
    layoutAlready: 'Os resultados já aparecem assim: {layout}.',
    layoutInvalid: 'Disposição de pesquisa desconhecida. Usa orbit, floating ou fullscreen.',
    expanded: 'Painel de pesquisa ampliado.',
    collapsed: 'Painel de pesquisa reduzido.',
    moved: 'Painel de pesquisa movido.',
    resized: 'Painel de pesquisa redimensionado.',
    centered: 'Painel de pesquisa centrado.',
    layoutReset: 'Painel de pesquisa reposto na sua posição predefinida.',
    positionObject: 'Indica a posição como um objeto com números x e y.',
    sizeObject: 'Indica o tamanho como um objeto com números width e height.',
    notFloating:
      'O painel de pesquisa não está na sua disposição flutuante, por isso não há nada para mover. Põe primeiro layout em floating.',
    unknownControl:
      'Controlo do painel de pesquisa desconhecido "{control}". Usa um de: {list}.',
    controlString: 'Indica o controlo do painel de pesquisa como texto.',

    focusedResult: 'Resultado {position} destacado: {title}',
    focusIndexNumber: 'Indica o número do resultado como um número, a contar a partir de 1.',
    focusOutOfRange:
      'Não existe o resultado número {position}. Neste momento há {count} resultados.',
    noResultsToFocus: 'Não há resultados de pesquisa no ecrã para apontar.',
    openedResult: 'Foi pedido ao navegador que abrisse o resultado {position}: {title}',
    openNoUrl: 'Esse resultado não tem ligação para abrir.',

    actionSearchPanel: 'Painel de pesquisa alterado',
    actionFocusResult: 'Resultado de pesquisa destacado',
    actionOpenResult: 'Resultado de pesquisa aberto',

    toolDescSetSearchPanel:
      'Move, redimensiona, amplia ou restaura o painel de resultados de pesquisa. Controlos: layout com os valores orbit, floating ou fullscreen; expand com true ou false; position com x e y; size com width e height; center; e reset. Orbit é a predefinição e dispõe os cartões de resultado em arco à volta do avatar. Floating é uma janela arrastável que lista todos os resultados e pode ser percorrida. Fullscreen ocupa o ecrã para leitura. Isto só muda como os resultados são apresentados e nunca lança uma pesquisa nova, e não mexe no painel do navegador em direto, que tem a sua própria ferramenta set_browser_panel.',
    toolDescFocusSearchResult:
      'Aponta para um resultado de pesquisa para que o utilizador veja a qual te referes, a contar a partir de 1 pela ordem em que estão no ecrã. Usa isto quando o utilizador disser algo como o segundo. Só destaca e nunca abre nada, por isso segue com open_search_result se ele quiser ler a página.',
    toolDescOpenSearchResult:
      'Abre um resultado de pesquisa no painel do navegador em direto, a contar a partir de 1. A página carrega na sessão de navegador na nuvem que guarda os inícios de sessão do utilizador, por isso abre já com sessão iniciada. Lê a mensagem devolvida em vez de assumir que funcionou, e diz que resultado foi aberto pelo título para que uma escolha errada possa ser apanhada.',
  },
} as const;

export const searchPanelIt = {
  searchPanel: {
    panelLabel: 'Risultati di ricerca',
    untitled: 'Ricerca',
    searching: 'Ricerca in corso...',
    noResults: 'Nessun risultato per questa ricerca.',
    openInBrowser: 'Apri nel browser',
    openInTab: 'Apri in una nuova scheda',
    dismiss: 'Chiudi',
    clearAll: 'Cancella i risultati',
    moveHint: 'Trascina per spostare il pannello di ricerca, o usa le frecce',
    resizeHint: 'Trascina per ridimensionare il pannello di ricerca, o usa le frecce',
    centerHint: 'Centra il pannello di ricerca',
    floatHint: 'Mostra i risultati in una finestra',
    dockHint: "Mostra i risultati attorno all'avatar",
    expandHint: 'Espandi il pannello di ricerca',
    collapseHint: 'Riduci il pannello di ricerca',

    layoutSet: 'I risultati sono ora mostrati così: {layout}.',
    layoutAlready: 'I risultati sono già mostrati così: {layout}.',
    layoutInvalid: 'Disposizione di ricerca sconosciuta. Usa orbit, floating o fullscreen.',
    expanded: 'Pannello di ricerca espanso.',
    collapsed: 'Pannello di ricerca ridotto.',
    moved: 'Pannello di ricerca spostato.',
    resized: 'Pannello di ricerca ridimensionato.',
    centered: 'Pannello di ricerca centrato.',
    layoutReset: 'Pannello di ricerca riportato alla sua posizione predefinita.',
    positionObject: 'Indica la posizione come un oggetto con numeri x e y.',
    sizeObject: 'Indica la dimensione come un oggetto con numeri width e height.',
    notFloating:
      "Il pannello di ricerca non è nella sua disposizione flottante, quindi non c'è nulla da spostare. Metti prima layout su floating.",
    unknownControl:
      'Controllo del pannello di ricerca sconosciuto "{control}". Usa uno tra: {list}.',
    controlString: 'Indica il controllo del pannello di ricerca come testo.',

    focusedResult: 'Risultato {position} evidenziato: {title}',
    focusIndexNumber: 'Indica il numero del risultato come un numero, contando da 1.',
    focusOutOfRange:
      'Non esiste il risultato numero {position}. In questo momento ci sono {count} risultati.',
    noResultsToFocus: 'Non ci sono risultati di ricerca sullo schermo da indicare.',
    openedResult: 'Al browser è stato chiesto di aprire il risultato {position}: {title}',
    openNoUrl: 'Quel risultato non ha nessun link da aprire.',

    actionSearchPanel: 'Pannello di ricerca modificato',
    actionFocusResult: 'Risultato di ricerca evidenziato',
    actionOpenResult: 'Risultato di ricerca aperto',

    toolDescSetSearchPanel:
      "Sposta, ridimensiona, espande o ripristina il pannello dei risultati di ricerca. Controlli: layout con i valori orbit, floating o fullscreen; expand con true o false; position che prende x e y; size che prende width e height; center; e reset. Orbit è il valore predefinito e dispone le schede dei risultati ad arco attorno all'avatar. Floating è una finestra trascinabile che elenca tutti i risultati e si può scorrere. Fullscreen occupa lo schermo per la lettura. Questo cambia solo il modo in cui i risultati sono presentati e non avvia mai una nuova ricerca, e non tocca il pannello del browser dal vivo, che ha il suo strumento set_browser_panel.",
    toolDescFocusSearchResult:
      "Indica un risultato di ricerca perché l'utente veda a quale ti riferisci, contando da 1 nell'ordine in cui stanno sullo schermo. Usa questo quando l'utente dice qualcosa come il secondo. Si limita a evidenziare e non apre mai nulla, quindi prosegui con open_search_result se vuole leggere la pagina.",
    toolDescOpenSearchResult:
      "Apre un risultato di ricerca nel pannello del browser dal vivo, contando da 1. La pagina si carica nella sessione di browser nel cloud che conserva gli accessi dell'utente, quindi si apre già autenticata. Leggi il messaggio restituito invece di dare per scontato che abbia funzionato, e di' quale risultato è stato aperto citandone il titolo, così una scelta sbagliata può essere individuata.",
  },
} as const;
