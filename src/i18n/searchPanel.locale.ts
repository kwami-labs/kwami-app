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
