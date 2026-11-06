/**
 * Copy for the Tools panel.
 *
 * Its own bundle, like the agent-tool locales: the panel is being rebuilt in
 * steps, and keeping its strings here keeps those steps out of the shared
 * en.ts / es.ts that every other panel edits. `tools.title` stays in the main
 * bundle because the sidebar and the Info panel use it too.
 */

const groupsEn = {
  interface: {
    title: 'Interface and panels',
    hint: 'Open, move and size panels; language and app status.',
  },
  appearance: {
    title: 'Look and ambience',
    hint: 'Theme, avatar, scene, effects and background music.',
  },
  personality: {
    title: 'Voice and personality',
    hint: 'Voice, soul, presets and companion profiles.',
  },
  search: { title: 'Search and browser', hint: 'Search results and the live browser.' },
  memory: {
    title: 'Memory and profile',
    hint: 'Memories, past conversations and what it knows about you.',
  },
  assistant: { title: 'Assistant', hint: 'Reminders, scheduled work and notifications.' },
  communications: {
    title: 'Phone and contacts',
    hint: 'Calls, SMS, WhatsApp, contacts and the wallet summary.',
  },
  email: { title: 'Email', hint: "The app's inbox: read, reply, send and archive." },
  calendar: { title: 'Calendar', hint: "Events in the app's calendar." },
  google: {
    title: 'Google',
    hint: 'Gmail, Calendar, Drive, Docs, Sheets and more from your Google accounts.',
  },
  companions: {
    title: 'Companions and account',
    hint: 'Create, rename and delete kwamis; credits and sign-out.',
  },
  extras: { title: 'Extras', hint: 'Theme files, performance metrics and the wallet.' },
  custom: { title: 'Your tools', hint: 'Webhooks you added.' },
  mcp: { title: 'MCP servers', hint: 'Tools from the MCP servers you connected.' },
  other: { title: 'Other', hint: 'Tools registered outside any group.' },
};

const groupsEs: typeof groupsEn = {
  interface: {
    title: 'Interfaz y paneles',
    hint: 'Abrir, mover y ajustar paneles; idioma y estado de la app.',
  },
  appearance: {
    title: 'Apariencia y ambiente',
    hint: 'Tema, avatar, escena, efectos y música de fondo.',
  },
  personality: {
    title: 'Voz y personalidad',
    hint: 'Voz, alma, presets y perfiles del kwami.',
  },
  search: { title: 'Búsqueda y navegador', hint: 'Resultados de búsqueda y el navegador en vivo.' },
  memory: {
    title: 'Memoria y perfil',
    hint: 'Recuerdos, conversaciones anteriores y lo que sabe de ti.',
  },
  assistant: { title: 'Asistente', hint: 'Recordatorios, trabajo programado y avisos.' },
  communications: {
    title: 'Teléfono y contactos',
    hint: 'Llamadas, SMS, WhatsApp, contactos y resumen de la cartera.',
  },
  email: { title: 'Correo', hint: 'La bandeja de la app: leer, responder, enviar y archivar.' },
  calendar: { title: 'Calendario', hint: 'Eventos del calendario de la app.' },
  google: {
    title: 'Google',
    hint: 'Gmail, Calendar, Drive, Docs, Sheets y más de tus cuentas de Google.',
  },
  companions: {
    title: 'Kwamis y cuenta',
    hint: 'Crear, renombrar y borrar kwamis; créditos y cierre de sesión.',
  },
  extras: { title: 'Extras', hint: 'Archivos de tema, métricas de rendimiento y cartera.' },
  custom: { title: 'Tus herramientas', hint: 'Webhooks que has añadido tú.' },
  mcp: { title: 'Servidores MCP', hint: 'Herramientas de los servidores MCP que conectaste.' },
  other: { title: 'Otras', hint: 'Herramientas registradas fuera de un grupo.' },
};

export const toolsPanelEn = {
  toolsPanel: {
    tabs: {
      catalog: 'Catalog',
      create: 'Create',
      mcp: 'MCP',
      test: 'Test',
    },
    summary: {
      tool: 'tool',
      tools: 'tools',
      group: 'group',
      groups: 'groups',
      intro:
        'Everything the agent can do in this app. It reads each description to decide when to use a tool.',
    },
    catalog: {
      searchPlaceholder: 'Search tools…',
      searchLabel: 'Search tools by name, description or parameter',
      clearSearch: 'Clear search',
      filterAll: 'All',
      filterApp: 'App',
      filterYours: 'Yours',
      noMatches: 'No tool matches "{query}".',
      noTools: 'No tools are registered yet. They appear once the companion has loaded.',
      expandAll: 'Expand all',
      collapseAll: 'Collapse all',
      params: 'Parameters',
      noParams: 'No parameters',
      required: 'required',
      values: 'Values',
      paramCount: 'no parameters | 1 parameter | {n} parameters',
      test: 'Test',
      copy: 'Copy definition',
      copied: 'Definition of {name} copied',
      copyFailed: 'Could not copy to the clipboard',
      remove: 'Remove',
      removeConfirm: 'Remove the tool "{name}"? The agent will stop seeing it.',
      sourceApp: 'App',
      sourceCustom: 'Webhook',
      sourceMcp: 'MCP',
      edit: 'Edit',
    },
    create: {
      intro:
        'Give the agent a tool that calls a web address. Start from a template that works as is, or from a blank webhook for Zapier, Make or n8n.',
      templates: 'Start from',
      editing: 'Editing {name}',
      name: 'Name',
      nameHint:
        'Letters, digits and underscores, starting with a letter. The agent calls it by this name.',
      description: 'What it does',
      descriptionHint:
        'The agent reads this to decide when to call the tool: say what it does, when to use it and what comes back.',
      method: 'Method',
      methodHint: 'GET sends the arguments in the address; POST sends them as JSON.',
      url: 'Address',
      urlHint:
        "Write {'{'}name{'}'} where a parameter goes in the path. The service must accept calls from a browser (CORS).",
      inPath: 'In the address:',
      params: 'Parameters',
      paramsHint: 'What the agent fills in when it calls the tool.',
      addParam: 'Add parameter',
      paramName: 'Name',
      paramType: 'Type',
      paramRequired: 'Required',
      paramDescription: 'Description for the agent',
      paramValues: 'Allowed values, separated by commas',
      paramMore: 'More options for {name}',
      removeParam: 'Remove parameter {name}',
      noParams: 'No parameters: the agent calls it as is.',
      types: {
        string: 'Text',
        number: 'Number',
        integer: 'Integer',
        boolean: 'Yes / no',
      },
      preview: 'What the model receives',
      tryIt: 'Try it',
      tryItHint: 'Calls the address now with these values, without saving.',
      save: 'Add tool',
      saveChanges: 'Save changes',
      cancel: 'Cancel',
      reset: 'Start over',
      saved: '{name} is ready for the agent. Save the kwami to keep it.',
      updated: '{name} updated. Save the kwami to keep the change.',
      fixFirst: 'Fix the highlighted fields first.',
      yourTools: 'Your tools',
    },
    issues: {
      nameRequired: 'Give the tool a name.',
      nameInvalid: 'Only letters, digits and underscores, starting with a letter (64 at most).',
      nameTaken: 'A tool with this name already exists.',
      descriptionRequired: 'Describe what the tool does; the agent decides from this.',
      urlInvalid: 'Enter a full http(s) address.',
      urlInsecure: 'Use https: the arguments would travel unencrypted.',
      paramNameInvalid:
        'Parameter "{subject}": letters, digits and underscores, starting with a letter.',
      paramDuplicate: 'Two parameters are called "{subject}".',
      placeholderUnknown: 'The address uses «{subject}» but no parameter has that name.',
      enumEmpty: 'Parameter "{subject}" lists no allowed values.',
    },
    args: {
      required: 'required',
      json: 'JSON value',
      invalidJson: 'Not valid JSON',
      yes: 'Yes',
      no: 'No',
      any: 'Any',
      noParams: 'This tool takes no parameters.',
    },
    result: {
      ok: 'Answered',
      failed: 'Failed',
      status: 'HTTP {status}',
      duration: '{ms} ms',
      copy: 'Copy result',
      copied: 'Result copied',
    },
    mcp: {
      intro:
        'Connect MCP (Model Context Protocol) servers over HTTP. Their tools join the catalog with the server name in front, and the agent can use them.',
      examples: 'Try one',
      exampleDeepwiki: 'Ask about any public GitHub repository',
      exampleGitmcp: 'Documentation of any GitHub project',
      add: 'Add a server',
      name: 'Name',
      namePlaceholder: 'deepwiki',
      url: 'Server address',
      urlHint:
        'The Streamable HTTP endpoint, often ending in /mcp. It must accept calls from this app (CORS).',
      key: 'API key (optional)',
      keyHint: 'Sent as a Bearer token. It is never saved with the kwami.',
      remember: 'Remember the key on this device',
      connect: 'Connect',
      connecting: 'Connecting…',
      connected: 'Connected',
      failed: 'Not connected',
      empty: 'No servers yet. Add one below or start from an example.',
      toolCount: 'no tools | 1 tool | {n} tools',
      enabledCount: '{enabled} of {total} active',
      showTools: 'Choose tools',
      hideTools: 'Hide tools',
      reconnect: 'Reconnect',
      remove: 'Remove',
      removeConfirm: 'Remove the server "{name}"? Its tools stop being available to the agent.',
      saved: 'Connected to {name}: {count} tools. Save the kwami to keep it.',
      setKey: 'Use this key',
      issues: {
        nameRequired: 'Give the server a short name (40 characters at most).',
        nameTaken: 'A server with this name is already added.',
        urlInvalid: 'Enter a full http(s) address.',
        urlInsecure: 'Use https: the key and the arguments would travel unencrypted.',
      },
      errors: {
        network:
          'Could not reach the server. It may be down, or it may not accept calls from this app (CORS).',
        unauthorized: 'The server wants a key, or does not accept this one.',
        legacy:
          'This address does not answer the Streamable HTTP transport. Older servers use /sse; look for an address ending in /mcp.',
        timeout: 'The server did not answer in time.',
        other: 'The server answered with an error: {message}',
      },
    },
    templates: {
      weather: {
        label: 'Current weather',
        hint: 'Open-Meteo, no key',
        description:
          'Returns the current weather at a pair of coordinates: temperature and feels-like (°C), humidity (%), precipitation (mm), wind speed (km/h) and the WMO weather code. Use it when the user asks what the weather is like somewhere; pass that place’s latitude and longitude.',
        latitude: 'Latitude in decimal degrees, e.g. 40.42 for Madrid',
        longitude: 'Longitude in decimal degrees, e.g. -3.70 for Madrid',
      },
      wikipedia: {
        label: 'Wikipedia summary',
        hint: 'Wikipedia, no key',
        description:
          'Returns the summary of an English Wikipedia article: its title, a short description and the opening paragraph. Use it for quick background on a person, place or idea.',
        title: 'Exact article title, with spaces, e.g. Albert Einstein',
      },
      exchange: {
        label: 'Exchange rates',
        hint: 'European Central Bank, no key',
        description:
          'Returns the European Central Bank’s reference exchange rates for the latest working day. Use it to convert amounts between currencies; multiply the amount by the rate.',
        base: 'Currency to convert from, ISO code such as EUR',
        symbols:
          'Currencies to convert to, comma-separated ISO codes such as USD,GBP; all when empty',
      },
      holidays: {
        label: 'Public holidays',
        hint: 'Nager.Date, no key',
        description:
          'Returns a country’s public holidays for a year: date, local name and whether each is national or regional. Use it to plan around holidays or to check whether a day is one.',
        year: 'Four-digit year, e.g. 2026',
        countryCode: 'Two-letter ISO country code, e.g. ES',
      },
      automation: {
        label: 'Automation webhook',
        hint: 'Zapier, Make, n8n…',
      },
    },
    groups: groupsEn,
  },
};

export const toolsPanelEs: typeof toolsPanelEn = {
  toolsPanel: {
    tabs: {
      catalog: 'Catálogo',
      create: 'Crear',
      mcp: 'MCP',
      test: 'Probar',
    },
    summary: {
      tool: 'herramienta',
      tools: 'herramientas',
      group: 'grupo',
      groups: 'grupos',
      intro:
        'Todo lo que el agente puede hacer en esta app. Lee cada descripción para decidir cuándo usar una herramienta.',
    },
    catalog: {
      searchPlaceholder: 'Buscar herramientas…',
      searchLabel: 'Buscar herramientas por nombre, descripción o parámetro',
      clearSearch: 'Borrar búsqueda',
      filterAll: 'Todas',
      filterApp: 'App',
      filterYours: 'Tuyas',
      noMatches: 'Ninguna herramienta coincide con «{query}».',
      noTools: 'Aún no hay herramientas registradas. Aparecen cuando el kwami termina de cargar.',
      expandAll: 'Desplegar todo',
      collapseAll: 'Plegar todo',
      params: 'Parámetros',
      noParams: 'Sin parámetros',
      required: 'obligatorio',
      values: 'Valores',
      paramCount: 'sin parámetros | 1 parámetro | {n} parámetros',
      test: 'Probar',
      copy: 'Copiar definición',
      copied: 'Definición de {name} copiada',
      copyFailed: 'No se pudo copiar al portapapeles',
      remove: 'Quitar',
      removeConfirm: '¿Quitar la herramienta «{name}»? El agente dejará de verla.',
      sourceApp: 'App',
      sourceCustom: 'Webhook',
      sourceMcp: 'MCP',
      edit: 'Editar',
    },
    create: {
      intro:
        'Dale al agente una herramienta que llama a una dirección web. Empieza con una plantilla que ya funciona o con un webhook en blanco para Zapier, Make o n8n.',
      templates: 'Empezar con',
      editing: 'Editando {name}',
      name: 'Nombre',
      nameHint:
        'Letras, números y guiones bajos, empezando por una letra. El agente la llama por este nombre.',
      description: 'Qué hace',
      descriptionHint:
        'El agente lee esto para decidir cuándo usarla: di qué hace, cuándo usarla y qué devuelve.',
      method: 'Método',
      methodHint: 'GET envía los argumentos en la dirección; POST, como JSON.',
      url: 'Dirección',
      urlHint:
        "Escribe {'{'}nombre{'}'} donde va un parámetro dentro de la ruta. El servicio debe aceptar llamadas desde el navegador (CORS).",
      inPath: 'En la dirección:',
      params: 'Parámetros',
      paramsHint: 'Lo que el agente rellena al llamarla.',
      addParam: 'Añadir parámetro',
      paramName: 'Nombre',
      paramType: 'Tipo',
      paramRequired: 'Obligatorio',
      paramDescription: 'Descripción para el agente',
      paramValues: 'Valores permitidos, separados por comas',
      paramMore: 'Más opciones de {name}',
      removeParam: 'Quitar el parámetro {name}',
      noParams: 'Sin parámetros: el agente la llama tal cual.',
      types: {
        string: 'Texto',
        number: 'Número',
        integer: 'Entero',
        boolean: 'Sí / no',
      },
      preview: 'Lo que recibe el modelo',
      tryIt: 'Probar',
      tryItHint: 'Llama ahora a la dirección con estos valores, sin guardar.',
      save: 'Añadir herramienta',
      saveChanges: 'Guardar cambios',
      cancel: 'Cancelar',
      reset: 'Empezar de nuevo',
      saved: '«{name}» ya está disponible para el agente. Guarda el kwami para conservarla.',
      updated: '«{name}» actualizada. Guarda el kwami para conservar el cambio.',
      fixFirst: 'Corrige primero los campos marcados.',
      yourTools: 'Tus herramientas',
    },
    issues: {
      nameRequired: 'Ponle un nombre a la herramienta.',
      nameInvalid:
        'Solo letras, números y guiones bajos, empezando por una letra (64 como máximo).',
      nameTaken: 'Ya hay una herramienta con este nombre.',
      descriptionRequired: 'Describe qué hace; el agente decide a partir de esto.',
      urlInvalid: 'Escribe una dirección http(s) completa.',
      urlInsecure: 'Usa https: los argumentos viajarían sin cifrar.',
      paramNameInvalid:
        'Parámetro «{subject}»: letras, números y guiones bajos, empezando por una letra.',
      paramDuplicate: 'Hay dos parámetros llamados «{subject}».',
      placeholderUnknown: 'La dirección usa «{subject}» pero ningún parámetro se llama así.',
      enumEmpty: 'El parámetro «{subject}» no tiene valores permitidos.',
    },
    args: {
      required: 'obligatorio',
      json: 'Valor JSON',
      invalidJson: 'No es JSON válido',
      yes: 'Sí',
      no: 'No',
      any: 'Cualquiera',
      noParams: 'Esta herramienta no tiene parámetros.',
    },
    result: {
      ok: 'Respondió',
      failed: 'Falló',
      status: 'HTTP {status}',
      duration: '{ms} ms',
      copy: 'Copiar resultado',
      copied: 'Resultado copiado',
    },
    mcp: {
      intro:
        'Conecta servidores MCP (Model Context Protocol) por HTTP. Sus herramientas se suman al catálogo con el nombre del servidor delante y el agente puede usarlas.',
      examples: 'Prueba uno',
      exampleDeepwiki: 'Pregunta por cualquier repositorio público de GitHub',
      exampleGitmcp: 'Documentación de cualquier proyecto de GitHub',
      add: 'Añadir un servidor',
      name: 'Nombre',
      namePlaceholder: 'deepwiki',
      url: 'Dirección del servidor',
      urlHint:
        'El punto de acceso Streamable HTTP, que suele acabar en /mcp. Debe aceptar llamadas desde esta app (CORS).',
      key: 'Clave de API (opcional)',
      keyHint: 'Se envía como token Bearer. Nunca se guarda con el kwami.',
      remember: 'Recordar la clave en este dispositivo',
      connect: 'Conectar',
      connecting: 'Conectando…',
      connected: 'Conectado',
      failed: 'Sin conexión',
      empty: 'Aún no hay servidores. Añade uno abajo o empieza con un ejemplo.',
      toolCount: 'sin herramientas | 1 herramienta | {n} herramientas',
      enabledCount: '{enabled} de {total} activas',
      showTools: 'Elegir herramientas',
      hideTools: 'Ocultar herramientas',
      reconnect: 'Reconectar',
      remove: 'Quitar',
      removeConfirm:
        '¿Quitar el servidor «{name}»? Sus herramientas dejarán de estar disponibles para el agente.',
      saved: 'Conectado a «{name}»: {count} herramientas. Guarda el kwami para conservarlo.',
      setKey: 'Usar esta clave',
      issues: {
        nameRequired: 'Ponle al servidor un nombre corto (40 caracteres como máximo).',
        nameTaken: 'Ya hay un servidor con este nombre.',
        urlInvalid: 'Escribe una dirección http(s) completa.',
        urlInsecure: 'Usa https: la clave y los argumentos viajarían sin cifrar.',
      },
      errors: {
        network:
          'No se pudo llegar al servidor. Puede estar caído o no aceptar llamadas desde esta app (CORS).',
        unauthorized: 'El servidor pide una clave o no acepta esta.',
        legacy:
          'Esta dirección no responde al transporte Streamable HTTP. Los servidores antiguos usan /sse; busca una dirección que acabe en /mcp.',
        timeout: 'El servidor no respondió a tiempo.',
        other: 'El servidor respondió con un error: {message}',
      },
    },
    templates: {
      weather: {
        label: 'Tiempo actual',
        hint: 'Open-Meteo, sin clave',
        description:
          'Devuelve el tiempo actual en unas coordenadas: temperatura y sensación térmica (°C), humedad (%), precipitación (mm), viento (km/h) y el código de tiempo WMO. Úsala cuando el usuario pregunte qué tiempo hace en un lugar; pasa la latitud y la longitud de ese lugar.',
        latitude: 'Latitud en grados decimales, p. ej. 40.42 para Madrid',
        longitude: 'Longitud en grados decimales, p. ej. -3.70 para Madrid',
      },
      wikipedia: {
        label: 'Resumen de Wikipedia',
        hint: 'Wikipedia, sin clave',
        description:
          'Devuelve el resumen de un artículo de Wikipedia en español: título, descripción breve y el primer párrafo. Úsala para dar contexto rápido sobre una persona, un lugar o una idea.',
        title: 'Título exacto del artículo, con espacios, p. ej. Albert Einstein',
      },
      exchange: {
        label: 'Tipos de cambio',
        hint: 'Banco Central Europeo, sin clave',
        description:
          'Devuelve los tipos de cambio de referencia del Banco Central Europeo del último día hábil. Úsala para convertir importes entre monedas; multiplica el importe por el tipo.',
        base: 'Moneda de origen, código ISO como EUR',
        symbols:
          'Monedas de destino, códigos ISO separados por comas como USD,GBP; todas si se deja vacío',
      },
      holidays: {
        label: 'Festivos',
        hint: 'Nager.Date, sin clave',
        description:
          'Devuelve los festivos oficiales de un país en un año: fecha, nombre local y si son nacionales o regionales. Úsala para planificar o para saber si un día es festivo.',
        year: 'Año con cuatro cifras, p. ej. 2026',
        countryCode: 'Código ISO del país, dos letras, p. ej. ES',
      },
      automation: {
        label: 'Webhook de automatización',
        hint: 'Zapier, Make, n8n…',
      },
    },
    groups: groupsEs,
  },
};
