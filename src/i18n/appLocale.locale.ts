/**
 * Strings for the app-language tool.
 *
 * As everywhere in this folder: vue-i18n reads braces and pipes as message
 * syntax on v11, so tool descriptions must avoid them rather than escape them.
 * The English and Spanish blocks are unaccented, which is this folder's older
 * habit rather than a rule -- nothing technical depends on it, and `es.ts` is
 * itself inconsistent about it. French, Portuguese and Italian are written
 * properly accented, because stripping diacritics from those is not a style
 * choice but an error. Matching is unaffected either way: `normalizeKey` in
 * `useLocaleAgentTools` folds diacritics, so "portugues" and "português"
 * resolve to the same locale.
 *
 * There is deliberately no table of language names here. `Intl.DisplayNames`
 * already holds every language named in every language, correctly accented,
 * and `languageName()` in `useLocaleAgentTools` reads it -- so the {language}
 * these messages interpolate is supplied, not stored. A hand-written table
 * would grow with the square of the language count and be wrong in the corner
 * nobody checks.
 */
export const appLocaleEn = {
  appLocale: {
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

export const appLocaleFr = {
  appLocale: {
    current: "L'app est en {language}.",
    already: "L'app est déjà en {language}.",
    changed: "L'app est passée en {language}.",
    unsupported: 'L\'app n\'a pas "{language}". Disponibles : {list}.',
    actionChanged: "Langue de l'app changée",
    toolDescGetAppLanguage:
      "Consulte dans quelle langue est l'interface de l'app en ce moment, et quelles langues elle propose. Lecture seule.",
    toolDescSetAppLanguage:
      "Change la langue de l'interface de l'app elle-même, c'est-à-dire le sélecteur du panneau de compte. Ce n'est pas la même chose que change_language : celle-là réajuste la reconnaissance et la synthèse vocales et ne touche à aucune étiquette à l'écran. Si l'utilisateur demande que l'app ou l'interface soit dans une autre langue, ou se met à parler une autre langue et demande de tout changer, utilise celle-ci en plus de change_language. Le choix est retenu pour la prochaine fois.",
  },
} as const;

export const appLocalePt = {
  appLocale: {
    current: 'A app está em {language}.',
    already: 'A app já está em {language}.',
    changed: 'A app passou para {language}.',
    unsupported: 'A app não tem "{language}". Disponíveis: {list}.',
    actionChanged: 'Idioma da app alterado',
    toolDescGetAppLanguage:
      'Consulta em que idioma está a interface da app neste momento, e que idiomas tem. Apenas leitura.',
    toolDescSetAppLanguage:
      'Muda o idioma da própria interface da app, que é o seletor do painel de conta. Não é o mesmo que change_language: essa reajusta o reconhecimento e a síntese de voz e não toca em nenhuma etiqueta do ecrã. Se o utilizador pedir que a app ou a interface esteja noutro idioma, ou começar a falar outro idioma e pedir para mudar tudo, usa esta além de change_language. A escolha fica guardada para a próxima vez.',
  },
} as const;

export const appLocaleIt = {
  appLocale: {
    current: "L'app è in {language}.",
    already: "L'app è già in {language}.",
    changed: "L'app è passata a {language}.",
    unsupported: 'L\'app non ha "{language}". Disponibili: {list}.',
    actionChanged: "Lingua dell'app cambiata",
    toolDescGetAppLanguage:
      "Controlla in che lingua è l'interfaccia dell'app in questo momento, e quali lingue ha. Sola lettura.",
    toolDescSetAppLanguage:
      "Cambia la lingua dell'interfaccia dell'app stessa, cioè il selettore del pannello account. Non è la stessa cosa di change_language: quella ritara il riconoscimento e la sintesi vocale e non tocca nessuna etichetta sullo schermo. Se l'utente chiede che l'app o l'interfaccia sia in un'altra lingua, o inizia a parlare un'altra lingua e chiede di cambiare tutto, usa questa oltre a change_language. La scelta viene ricordata per la prossima volta.",
  },
} as const;
