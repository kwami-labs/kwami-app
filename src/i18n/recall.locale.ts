/**
 * Strings for the memory-correction and conversation-history tools.
 *
 * Braces are placeholders; a bare pipe is a plural separator that silently
 * keeps one branch. Neither may appear as prose in these messages.
 */
export const recallEn = {
  recall: {
    confirmApply: 'Yes, do it',
    confirmCancel: 'Cancel',

    memoryLoadFailed: 'Could not read what is remembered: {error}',
    memoriesFound: 'Found {count} remembered items.',
    noMemories: 'Nothing is remembered yet.',
    forgetQueryRequired: 'Say what should be forgotten.',
    memoryNotFound: 'Nothing remembered matches "{query}".',
    memoryAmbiguous:
      'More than one remembered item matches "{query}": {list}. Ask which one is meant before forgetting anything.',
    confirmForgetTitle: 'Forget this',
    confirmForgetBody: 'This permanently forgets: {text}',
    forgetCancelled: 'Nothing was forgotten.',
    forgot: 'Forgotten: {text}',
    forgetFailed: 'Could not forget that: {error}',
    confirmForgetAllTitle: 'Forget everything',
    confirmForgetAllBody:
      'This permanently erases everything the Kwami remembers about the user. It cannot be undone.',
    forgetAllCancelled: 'Nothing was erased.',
    forgotAll: 'Everything remembered has been erased.',

    sessionsFound: 'There are {count} past conversations.',
    noSessions: 'There are no past conversations yet.',
    sessionTargetRequired: 'Say which conversation, by number or by its name.',
    sessionNotFound: 'No past conversation called "{name}".',
    sessionOutOfRange: 'There is no conversation number {position}. There are {count}.',
    sessionAmbiguous:
      'More than one conversation matches "{name}": {list}. Ask which one is meant.',
    openedSession: 'Showing the conversation from {title}.',
    alreadyLive: 'Already showing the live conversation.',
    returnedLive: 'Back to the live conversation.',
    confirmDeleteSessionTitle: 'Delete this conversation',
    confirmDeleteSessionBody: 'This permanently deletes the transcript from {title}.',
    deleteSessionCancelled: 'Nothing was deleted.',
    deletedSession: 'Deleted the conversation from {title}.',
    confirmClearTitle: 'Clear the transcript',
    confirmClearBody: 'This clears what is on screen for this conversation.',
    clearCancelled: 'The transcript was left alone.',
    cleared: 'Cleared the transcript.',

    actionForgot: 'Forgot something',
    actionForgotAll: 'Erased all memory',
    actionOpenedSession: 'Opened a past conversation',
    actionDeletedSession: 'Deleted a conversation',
    actionCleared: 'Cleared the transcript',

    toolDescListMemories:
      'List what the Kwami remembers about the user, optionally filtered by a search word. Returns both facts and entities, because the user does not distinguish them when speaking. Read only. This reads the memory panel; recall_memories is the other way to look things up and is usually the better one for answering a question, while this one is for showing the user what is stored so they can correct it.',
    toolDescForgetMemory:
      'Permanently forget one thing the Kwami remembers, found by a search word. Use this when the user says something like forget that, or that is wrong. It searches facts and entities together and refuses rather than choosing when more than one matches, returning the candidates so you can ask which is meant. This cannot be undone, so the app asks the user to confirm and reads the item back first: wait for the result and read the forgotten field rather than saying it is gone while the dialog is still open.',
    toolDescForgetEverything:
      'Permanently erase everything the Kwami remembers about the user. This is the wipe button in the memory panel and it cannot be undone. Only use it when the user clearly asks for everything to be erased, not when they want one thing forgotten, which is forget_memory. The app asks the user to confirm; wait for the result.',
    toolDescListConversations:
      'List past conversations with this Kwami, newest handling aside, in the order the panel shows them, each with a number starting at 1. Read only. Use it before opening or deleting one so the numbers mean something.',
    toolDescOpenConversation:
      'Show a past conversation in the transcript panel, chosen by its number from list_conversations or by its name. While one is open the panel is showing history rather than what is being said now, so tell the user that and use return_to_live_conversation when they are done, otherwise the next thing you say will look like it went missing.',
    toolDescReturnToLive:
      'Go back to showing the live conversation after looking at a past one. Safe to call even when already live.',
    toolDescDeleteConversation:
      'Permanently delete the transcript of one past conversation, chosen by its number or name. Cannot be undone, so the app asks the user to confirm and names the conversation first. Wait for the result rather than saying it is gone while the dialog is open.',
    toolDescClearTranscript:
      'Clear what is on screen for the current conversation. This only clears the transcript view and does not affect what the Kwami remembers, which is forget_memory. The app asks the user to confirm first.',
  },
} as const;

export const recallEs = {
  recall: {
    confirmApply: 'Si, hazlo',
    confirmCancel: 'Cancelar',

    memoryLoadFailed: 'No se pudo leer lo que recuerda: {error}',
    memoriesFound: 'Se han encontrado {count} cosas recordadas.',
    noMemories: 'Todavia no recuerda nada.',
    forgetQueryRequired: 'Di que hay que olvidar.',
    memoryNotFound: 'No hay nada recordado que coincida con "{query}".',
    memoryAmbiguous:
      'Hay mas de una cosa recordada que coincide con "{query}": {list}. Pregunta a cual se refiere antes de olvidar nada.',
    confirmForgetTitle: 'Olvidar esto',
    confirmForgetBody: 'Esto olvida permanentemente: {text}',
    forgetCancelled: 'No se ha olvidado nada.',
    forgot: 'Olvidado: {text}',
    forgetFailed: 'No se pudo olvidar eso: {error}',
    confirmForgetAllTitle: 'Olvidarlo todo',
    confirmForgetAllBody:
      'Esto borra permanentemente todo lo que el Kwami recuerda del usuario. No se puede deshacer.',
    forgetAllCancelled: 'No se ha borrado nada.',
    forgotAll: 'Se ha borrado todo lo recordado.',

    sessionsFound: 'Hay {count} conversaciones anteriores.',
    noSessions: 'Todavia no hay conversaciones anteriores.',
    sessionTargetRequired: 'Di que conversacion, por numero o por su nombre.',
    sessionNotFound: 'No hay ninguna conversacion anterior llamada "{name}".',
    sessionOutOfRange: 'No existe la conversacion numero {position}. Hay {count}.',
    sessionAmbiguous:
      'Hay mas de una conversacion que coincide con "{name}": {list}. Pregunta a cual se refiere.',
    openedSession: 'Mostrando la conversacion de {title}.',
    alreadyLive: 'Ya se esta mostrando la conversacion en directo.',
    returnedLive: 'De vuelta a la conversacion en directo.',
    confirmDeleteSessionTitle: 'Eliminar esta conversacion',
    confirmDeleteSessionBody: 'Esto elimina permanentemente la transcripcion de {title}.',
    deleteSessionCancelled: 'No se ha eliminado nada.',
    deletedSession: 'Se ha eliminado la conversacion de {title}.',
    confirmClearTitle: 'Borrar la transcripcion',
    confirmClearBody: 'Esto borra lo que hay en pantalla de esta conversacion.',
    clearCancelled: 'La transcripcion se ha dejado como estaba.',
    cleared: 'Transcripcion borrada.',

    actionForgot: 'Algo olvidado',
    actionForgotAll: 'Memoria borrada',
    actionOpenedSession: 'Conversacion anterior abierta',
    actionDeletedSession: 'Conversacion eliminada',
    actionCleared: 'Transcripcion borrada',

    toolDescListMemories:
      'Lista lo que el Kwami recuerda del usuario, opcionalmente filtrado por una palabra de busqueda. Devuelve hechos y entidades juntos, porque el usuario no los distingue al hablar. Solo lectura. Esto lee el panel de memoria; recall_memories es la otra forma de consultar y suele ser mejor para responder una pregunta, mientras que esta sirve para ensenar al usuario lo que hay guardado y que pueda corregirlo.',
    toolDescForgetMemory:
      'Olvida permanentemente una cosa que el Kwami recuerda, encontrada por una palabra de busqueda. Usalo cuando el usuario diga algo como olvida eso, o eso esta mal. Busca en hechos y entidades a la vez y se niega en lugar de elegir cuando coincide mas de uno, devolviendo los candidatos para que preguntes a cual se refiere. No se puede deshacer, asi que la app pide confirmacion y lee antes el elemento: espera el resultado y lee el campo forgotten en lugar de decir que ya no esta mientras el dialogo sigue abierto.',
    toolDescForgetEverything:
      'Borra permanentemente todo lo que el Kwami recuerda del usuario. Es el boton de borrado del panel de memoria y no se puede deshacer. Usalo solo cuando el usuario pida claramente borrarlo todo, no cuando quiera olvidar una cosa, que es forget_memory. La app pide confirmacion; espera el resultado.',
    toolDescListConversations:
      'Lista las conversaciones anteriores con este Kwami, en el orden en que las muestra el panel, cada una con un numero empezando por 1. Solo lectura. Usalo antes de abrir o eliminar una para que los numeros signifiquen algo.',
    toolDescOpenConversation:
      'Muestra una conversacion anterior en el panel de transcripcion, elegida por su numero de list_conversations o por su nombre. Mientras hay una abierta el panel muestra el historial y no lo que se esta diciendo ahora, asi que diselo al usuario y usa return_to_live_conversation cuando termine; si no, lo siguiente que digas parecera que se ha perdido.',
    toolDescReturnToLive:
      'Vuelve a mostrar la conversacion en directo despues de mirar una anterior. Es seguro llamarlo aunque ya se este en directo.',
    toolDescDeleteConversation:
      'Elimina permanentemente la transcripcion de una conversacion anterior, elegida por su numero o su nombre. No se puede deshacer, asi que la app pide confirmacion y nombra antes la conversacion. Espera el resultado en lugar de decir que ya no esta mientras el dialogo sigue abierto.',
    toolDescClearTranscript:
      'Borra lo que hay en pantalla de la conversacion actual. Solo borra la vista de transcripcion y no afecta a lo que el Kwami recuerda, que es forget_memory. La app pide confirmacion primero.',
  },
} as const;

export const recallFr = {
  recall: {
    confirmApply: 'Oui, fais-le',
    confirmCancel: 'Annuler',

    memoryLoadFailed: 'Impossible de lire ce qui est mémorisé : {error}',
    memoriesFound: '{count} éléments mémorisés trouvés.',
    noMemories: 'Rien n est encore mémorisé.',
    forgetQueryRequired: 'Dis ce qu il faut oublier.',
    memoryNotFound: 'Rien de mémorisé ne correspond à "{query}".',
    memoryAmbiguous:
      'Plusieurs éléments mémorisés correspondent à "{query}" : {list}. Demande lequel avant d oublier quoi que ce soit.',
    confirmForgetTitle: 'Oublier ceci',
    confirmForgetBody: 'Ceci oublie définitivement : {text}',
    forgetCancelled: 'Rien n a été oublié.',
    forgot: 'Oublié : {text}',
    forgetFailed: 'Impossible d oublier cela : {error}',
    confirmForgetAllTitle: 'Tout oublier',
    confirmForgetAllBody:
      'Ceci efface définitivement tout ce que le Kwami sait de l utilisateur. Irréversible.',
    forgetAllCancelled: 'Rien n a été effacé.',
    forgotAll: 'Tout ce qui était mémorisé a été effacé.',

    sessionsFound: 'Il y a {count} conversations passées.',
    noSessions: 'Il n y a pas encore de conversation passée.',
    sessionTargetRequired: 'Dis quelle conversation, par son numéro ou par son nom.',
    sessionNotFound: 'Aucune conversation passée appelée "{name}".',
    sessionOutOfRange: 'Il n y a pas de conversation numéro {position}. Il y en a {count}.',
    sessionAmbiguous:
      'Plusieurs conversations correspondent à "{name}" : {list}. Demande laquelle est visée.',
    openedSession: 'Affichage de la conversation du {title}.',
    alreadyLive: 'La conversation en direct est déjà affichée.',
    returnedLive: 'Retour à la conversation en direct.',
    confirmDeleteSessionTitle: 'Supprimer cette conversation',
    confirmDeleteSessionBody: 'Ceci supprime définitivement la transcription du {title}.',
    deleteSessionCancelled: 'Rien n a été supprimé.',
    deletedSession: 'La conversation du {title} a été supprimée.',
    confirmClearTitle: 'Effacer la transcription',
    confirmClearBody: 'Ceci efface ce qui est à l écran pour cette conversation.',
    clearCancelled: 'La transcription a été laissée telle quelle.',
    cleared: 'Transcription effacée.',

    actionForgot: 'Quelque chose oublié',
    actionForgotAll: 'Mémoire effacée',
    actionOpenedSession: 'Conversation passée ouverte',
    actionDeletedSession: 'Conversation supprimée',
    actionCleared: 'Transcription effacée',

    toolDescListMemories:
      'Liste ce que le Kwami sait de l utilisateur, filtré éventuellement par un mot de recherche. Renvoie les faits et les entités ensemble, parce que l utilisateur ne les distingue pas en parlant. Lecture seule. Ceci lit le panneau mémoire ; recall_memories est l autre façon de chercher et convient mieux pour répondre à une question, tandis que celui-ci sert à montrer à l utilisateur ce qui est stocké pour qu il puisse le corriger.',
    toolDescForgetMemory:
      'Oublie définitivement une chose que le Kwami a mémorisée, trouvée par un mot de recherche. Utilise-le quand l utilisateur dit quelque chose comme oublie ça, ou c est faux. Il cherche dans les faits et les entités à la fois et refuse au lieu de choisir quand plusieurs correspondent, en renvoyant les candidats pour que tu demandes lequel est visé. Irréversible, donc l application demande confirmation et relit l élément d abord : attends le résultat et lis le champ forgotten plutôt que de le déclarer oublié pendant que la boîte de dialogue est encore ouverte.',
    toolDescForgetEverything:
      'Efface définitivement tout ce que le Kwami sait de l utilisateur. C est le bouton d effacement du panneau mémoire et il est irréversible. Ne l utilise que si l utilisateur demande clairement que tout soit effacé, pas s il veut oublier une seule chose, ce qui est forget_memory. L application demande confirmation ; attends le résultat.',
    toolDescListConversations:
      'Liste les conversations passées avec ce Kwami, dans l ordre où le panneau les affiche, chacune avec un numéro à partir de 1. Lecture seule. Utilise-le avant d en ouvrir ou d en supprimer une pour que les numéros veuillent dire quelque chose.',
    toolDescOpenConversation:
      'Affiche une conversation passée dans le panneau de transcription, choisie par son numéro depuis list_conversations ou par son nom. Tant qu une conversation passée est ouverte, le panneau montre l historique et non ce qui se dit maintenant, donc dis-le à l utilisateur et utilise return_to_live_conversation quand il a fini, sinon la prochaine chose que tu diras aura l air d avoir disparu.',
    toolDescReturnToLive:
      'Revient à la conversation en direct après avoir regardé une conversation passée. Sans risque même si on est déjà en direct.',
    toolDescDeleteConversation:
      'Supprime définitivement la transcription d une conversation passée, choisie par son numéro ou son nom. Irréversible, donc l application demande confirmation et nomme la conversation d abord. Attends le résultat plutôt que de la déclarer supprimée pendant que la boîte de dialogue est ouverte.',
    toolDescClearTranscript:
      'Efface ce qui est à l écran pour la conversation en cours. Ceci n efface que la vue de transcription et ne touche pas à ce que le Kwami a mémorisé, ce qui est forget_memory. L application demande confirmation d abord.',
  },
} as const;

export const recallPt = {
  recall: {
    confirmApply: 'Sim, faz isso',
    confirmCancel: 'Cancelar',

    memoryLoadFailed: 'Não foi possível ler o que está memorizado: {error}',
    memoriesFound: 'Encontrados {count} itens memorizados.',
    noMemories: 'Ainda não há nada memorizado.',
    forgetQueryRequired: 'Diz o que deve ser esquecido.',
    memoryNotFound: 'Nada memorizado corresponde a "{query}".',
    memoryAmbiguous:
      'Há mais do que um item memorizado que corresponde a "{query}": {list}. Pergunta qual antes de esquecer seja o que for.',
    confirmForgetTitle: 'Esquecer isto',
    confirmForgetBody: 'Isto esquece permanentemente: {text}',
    forgetCancelled: 'Nada foi esquecido.',
    forgot: 'Esquecido: {text}',
    forgetFailed: 'Não foi possível esquecer isso: {error}',
    confirmForgetAllTitle: 'Esquecer tudo',
    confirmForgetAllBody:
      'Isto apaga permanentemente tudo o que o Kwami sabe sobre o utilizador. Não pode ser desfeito.',
    forgetAllCancelled: 'Nada foi apagado.',
    forgotAll: 'Tudo o que estava memorizado foi apagado.',

    sessionsFound: 'Há {count} conversas anteriores.',
    noSessions: 'Ainda não há conversas anteriores.',
    sessionTargetRequired: 'Diz qual conversa, pelo número ou pelo nome.',
    sessionNotFound: 'Não há nenhuma conversa anterior chamada "{name}".',
    sessionOutOfRange: 'Não existe a conversa número {position}. Há {count}.',
    sessionAmbiguous:
      'Mais do que uma conversa corresponde a "{name}": {list}. Pergunta qual se pretende.',
    openedSession: 'A mostrar a conversa de {title}.',
    alreadyLive: 'Já está a mostrar a conversa em direto.',
    returnedLive: 'De volta à conversa em direto.',
    confirmDeleteSessionTitle: 'Eliminar esta conversa',
    confirmDeleteSessionBody: 'Isto elimina permanentemente a transcrição de {title}.',
    deleteSessionCancelled: 'Nada foi eliminado.',
    deletedSession: 'Eliminada a conversa de {title}.',
    confirmClearTitle: 'Limpar a transcrição',
    confirmClearBody: 'Isto limpa o que está no ecrã desta conversa.',
    clearCancelled: 'A transcrição ficou como estava.',
    cleared: 'Transcrição limpa.',

    actionForgot: 'Algo esquecido',
    actionForgotAll: 'Memória apagada',
    actionOpenedSession: 'Conversa anterior aberta',
    actionDeletedSession: 'Conversa eliminada',
    actionCleared: 'Transcrição limpa',

    toolDescListMemories:
      'Lista o que o Kwami sabe sobre o utilizador, opcionalmente filtrado por uma palavra de pesquisa. Devolve factos e entidades juntos, porque o utilizador não os distingue ao falar. Só de leitura. Isto lê o painel de memória; recall_memories é a outra forma de consultar e costuma ser melhor para responder a uma pergunta, enquanto este serve para mostrar ao utilizador o que está guardado para que o possa corrigir.',
    toolDescForgetMemory:
      'Esquece permanentemente uma coisa que o Kwami memorizou, encontrada por uma palavra de pesquisa. Usa-o quando o utilizador disser algo como esquece isso, ou isso está errado. Procura em factos e entidades ao mesmo tempo e recusa em vez de escolher quando corresponde mais do que um, devolvendo os candidatos para que perguntes qual se pretende. Não pode ser desfeito, por isso a aplicação pede confirmação e lê primeiro o item: espera pelo resultado e lê o campo forgotten em vez de o dar como esquecido enquanto a caixa de diálogo ainda está aberta.',
    toolDescForgetEverything:
      'Apaga permanentemente tudo o que o Kwami sabe sobre o utilizador. É o botão de apagar do painel de memória e não pode ser desfeito. Só o uses quando o utilizador pedir claramente para apagar tudo, não quando quiser esquecer uma coisa, que é forget_memory. A aplicação pede confirmação; espera pelo resultado.',
    toolDescListConversations:
      'Lista as conversas anteriores com este Kwami, pela ordem em que o painel as mostra, cada uma com um número a começar em 1. Só de leitura. Usa-o antes de abrir ou eliminar uma para que os números signifiquem alguma coisa.',
    toolDescOpenConversation:
      'Mostra uma conversa anterior no painel de transcrição, escolhida pelo número de list_conversations ou pelo nome. Enquanto houver uma aberta o painel mostra o histórico e não o que está a ser dito agora, por isso di-lo ao utilizador e usa return_to_live_conversation quando ele acabar; caso contrário a próxima coisa que disseres vai parecer perdida.',
    toolDescReturnToLive:
      'Volta a mostrar a conversa em direto depois de ver uma anterior. É seguro chamar mesmo já estando em direto.',
    toolDescDeleteConversation:
      'Elimina permanentemente a transcrição de uma conversa anterior, escolhida pelo número ou pelo nome. Não pode ser desfeito, por isso a aplicação pede confirmação e nomeia primeiro a conversa. Espera pelo resultado em vez de a dar como eliminada enquanto a caixa de diálogo está aberta.',
    toolDescClearTranscript:
      'Limpa o que está no ecrã da conversa atual. Só limpa a vista de transcrição e não afeta o que o Kwami memorizou, que é forget_memory. A aplicação pede confirmação primeiro.',
  },
} as const;

export const recallIt = {
  recall: {
    confirmApply: 'Sì, fallo',
    confirmCancel: 'Annulla',

    memoryLoadFailed: 'Non è stato possibile leggere ciò che è memorizzato: {error}',
    memoriesFound: 'Trovati {count} elementi memorizzati.',
    noMemories: 'Non è ancora memorizzato nulla.',
    forgetQueryRequired: 'Di cosa bisogna dimenticare.',
    memoryNotFound: 'Nulla di memorizzato corrisponde a "{query}".',
    memoryAmbiguous:
      'Più di un elemento memorizzato corrisponde a "{query}": {list}. Chiedi quale prima di dimenticare qualsiasi cosa.',
    confirmForgetTitle: 'Dimenticare questo',
    confirmForgetBody: 'Questo dimentica definitivamente: {text}',
    forgetCancelled: 'Non è stato dimenticato nulla.',
    forgot: 'Dimenticato: {text}',
    forgetFailed: 'Non è stato possibile dimenticarlo: {error}',
    confirmForgetAllTitle: 'Dimenticare tutto',
    confirmForgetAllBody:
      'Questo cancella definitivamente tutto ciò che il Kwami sa dell utente. Non si può annullare.',
    forgetAllCancelled: 'Non è stato cancellato nulla.',
    forgotAll: 'Tutto ciò che era memorizzato è stato cancellato.',

    sessionsFound: 'Ci sono {count} conversazioni passate.',
    noSessions: 'Non ci sono ancora conversazioni passate.',
    sessionTargetRequired: 'Di quale conversazione, per numero o per nome.',
    sessionNotFound: 'Nessuna conversazione passata chiamata "{name}".',
    sessionOutOfRange: 'Non esiste la conversazione numero {position}. Ce ne sono {count}.',
    sessionAmbiguous:
      'Più di una conversazione corrisponde a "{name}": {list}. Chiedi quale si intende.',
    openedSession: 'Mostro la conversazione del {title}.',
    alreadyLive: 'La conversazione dal vivo è già mostrata.',
    returnedLive: 'Tornato alla conversazione dal vivo.',
    confirmDeleteSessionTitle: 'Eliminare questa conversazione',
    confirmDeleteSessionBody: 'Questo elimina definitivamente la trascrizione del {title}.',
    deleteSessionCancelled: 'Non è stato eliminato nulla.',
    deletedSession: 'Eliminata la conversazione del {title}.',
    confirmClearTitle: 'Cancellare la trascrizione',
    confirmClearBody: 'Questo cancella ciò che è sullo schermo per questa conversazione.',
    clearCancelled: 'La trascrizione è stata lasciata com era.',
    cleared: 'Trascrizione cancellata.',

    actionForgot: 'Qualcosa dimenticato',
    actionForgotAll: 'Memoria cancellata',
    actionOpenedSession: 'Conversazione passata aperta',
    actionDeletedSession: 'Conversazione eliminata',
    actionCleared: 'Trascrizione cancellata',

    toolDescListMemories:
      'Elenca ciò che il Kwami sa dell utente, eventualmente filtrato da una parola di ricerca. Restituisce fatti ed entità insieme, perché l utente non li distingue parlando. Sola lettura. Questo legge il pannello memoria; recall_memories è l altro modo di cercare ed è di solito migliore per rispondere a una domanda, mentre questo serve a mostrare all utente cosa è memorizzato perché possa correggerlo.',
    toolDescForgetMemory:
      'Dimentica definitivamente una cosa che il Kwami ha memorizzato, trovata tramite una parola di ricerca. Usalo quando l utente dice qualcosa come dimenticalo, oppure è sbagliato. Cerca tra fatti ed entità insieme e rifiuta invece di scegliere quando ne corrisponde più di uno, restituendo i candidati perché tu chieda quale si intende. Non si può annullare, quindi l applicazione chiede conferma e rilegge prima l elemento: aspetta il risultato e leggi il campo forgotten invece di darlo per dimenticato mentre la finestra di dialogo è ancora aperta.',
    toolDescForgetEverything:
      'Cancella definitivamente tutto ciò che il Kwami sa dell utente. È il pulsante di cancellazione del pannello memoria e non si può annullare. Usalo solo quando l utente chiede chiaramente di cancellare tutto, non quando vuole dimenticare una cosa sola, che è forget_memory. L applicazione chiede conferma; aspetta il risultato.',
    toolDescListConversations:
      'Elenca le conversazioni passate con questo Kwami, nell ordine in cui le mostra il pannello, ciascuna con un numero a partire da 1. Sola lettura. Usalo prima di aprirne o eliminarne una perché i numeri abbiano un senso.',
    toolDescOpenConversation:
      'Mostra una conversazione passata nel pannello di trascrizione, scelta per numero da list_conversations o per nome. Finché ne è aperta una il pannello mostra la cronologia e non ciò che si sta dicendo ora, quindi dillo all utente e usa return_to_live_conversation quando ha finito, altrimenti la prossima cosa che dirai sembrerà sparita.',
    toolDescReturnToLive:
      'Torna a mostrare la conversazione dal vivo dopo averne guardata una passata. Sicuro da chiamare anche se si è già dal vivo.',
    toolDescDeleteConversation:
      'Elimina definitivamente la trascrizione di una conversazione passata, scelta per numero o per nome. Non si può annullare, quindi l applicazione chiede conferma e nomina prima la conversazione. Aspetta il risultato invece di darla per eliminata mentre la finestra di dialogo è aperta.',
    toolDescClearTranscript:
      'Cancella ciò che è sullo schermo per la conversazione in corso. Cancella solo la vista di trascrizione e non tocca ciò che il Kwami ha memorizzato, che è forget_memory. L applicazione chiede prima conferma.',
  },
} as const;
