/**
 * Strings for the panel layout and the notification settings by voice.
 *
 * No braces or pipes in tool descriptions: see the note in
 * `commsAgentTools.locale.ts`.
 */
export const layoutEn = {
  layout: {
    title: 'Panel layout',
    hint: 'Order and hide the panels in the sidebar. Saved in your account.',
    moveUp: 'Move {panel} up',
    moveDown: 'Move {panel} down',
    hide: 'Hide {panel}',
    show: 'Show {panel}',
    reset: 'Reset',
    unknownPanel: 'There is no panel called {panel}.',
    unknownAction: 'The action must be hide, show, move_up, move_down or reset.',
    confirmApply: 'Apply',
    confirmCancel: 'Cancel',
    confirmNotifyTitle: 'Change where your reminders go',
    confirmNotifyBody: 'Send to {to} by {channel}. Reports: {reports}.',
    reportsOn: 'on',
    reportsOff: 'off',
    toolArrange:
      'Hide, show or reorder the panels in the sidebar, or reset them. panel is an id such as avatar, audio, scene, models, voice, soul, memory, metrics, info, email or calendar. Theme, account and credits cannot be hidden.',
    toolNotifications:
      'Switch the Monday, Friday and Sunday reports on or off, or change the phone or channel for reminders. Pass only what changes. The app always asks the user first.',
  },
};

export const layoutEs: typeof layoutEn = {
  layout: {
    title: 'Disposición de los paneles',
    hint: 'Ordene y oculte los paneles de la barra lateral. Se guarda en su cuenta.',
    moveUp: 'Subir {panel}',
    moveDown: 'Bajar {panel}',
    hide: 'Ocultar {panel}',
    show: 'Mostrar {panel}',
    reset: 'Restablecer',
    unknownPanel: 'No existe el panel {panel}.',
    unknownAction: 'La acción debe ser hide, show, move_up, move_down o reset.',
    confirmApply: 'Aplicar',
    confirmCancel: 'Cancelar',
    confirmNotifyTitle: 'Cambiar adónde van sus avisos',
    confirmNotifyBody: 'Enviar a {to} por {channel}. Informes: {reports}.',
    reportsOn: 'activados',
    reportsOff: 'desactivados',
    toolArrange:
      'Oculta, muestra o reordena los paneles de la barra lateral, o los restablece. panel es un id como avatar, audio, scene, models, voice, soul, memory, metrics, info, email o calendar. Theme, account y credits no se pueden ocultar.',
    toolNotifications:
      'Activa o desactiva los informes de lunes, viernes y domingo, o cambia el telefono o el canal de los avisos. Pasa solo lo que cambie. La app siempre pregunta antes al usuario.',
  },
};
