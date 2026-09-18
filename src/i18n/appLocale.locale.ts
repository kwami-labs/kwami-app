/**
 * Strings for the app-language tool.
 *
 * As everywhere in this folder: vue-i18n reads braces and pipes as message
 * syntax on v11, so tool descriptions must avoid them rather than escape them.
 */
export const appLocaleEn = {
  appLocale: {
    name: {
      en: 'English',
      es: 'Spanish',
    },
    current: 'The app is in {language}.',
    already: 'The app is already in {language}.',
    changed: 'Switched the app to {language}.',
    unsupported: 'The app does not have "{language}". Available: {list}.',
    actionChanged: 'Changed app language',
    toolDescGetAppLanguage:
      'Read which language the app interface is currently in, and which languages it has. Read only.',
    toolDescSetAppLanguage:
      'Switch the language of the app interface itself, which is the selector in the account panel. This is not the same as change_language: that one retunes speech recognition and speech synthesis and leaves every label on screen untouched. If the user asks for the app or the interface to be in another language, or starts speaking another language and asks you to switch everything, use this as well as change_language. The choice is remembered for next time.',
  },
} as const;

export const appLocaleEs = {
  appLocale: {
    name: {
      en: 'ingles',
      es: 'espanol',
    },
    current: 'La app esta en {language}.',
    already: 'La app ya esta en {language}.',
    changed: 'Se ha cambiado la app a {language}.',
    unsupported: 'La app no tiene "{language}". Disponibles: {list}.',
    actionChanged: 'Idioma de la app cambiado',
    toolDescGetAppLanguage:
      'Consulta en que idioma esta la interfaz de la app ahora mismo, y que idiomas tiene. Solo lectura.',
    toolDescSetAppLanguage:
      'Cambia el idioma de la interfaz de la app, que es el selector del panel de cuenta. No es lo mismo que change_language: esa reajusta el reconocimiento y la sintesis de voz y deja sin tocar todas las etiquetas de la pantalla. Si el usuario pide que la app o la interfaz este en otro idioma, o empieza a hablar en otro idioma y pide cambiarlo todo, usa esta ademas de change_language. La eleccion se recuerda para la proxima vez.',
  },
} as const;
