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
    },
    groups: groupsEs,
  },
};
