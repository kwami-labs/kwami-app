/**
 * Strings for the Kwami lifecycle, credits, sign-out and randomize tools.
 *
 * Braces are placeholders and a bare pipe is a plural separator that silently
 * keeps one branch, so neither may appear as prose. Use the literal forms if
 * one is ever genuinely needed.
 */
export const kwamiAdminEn = {
  kwamiAdmin: {
    confirmApply: 'Yes, do it',
    confirmCancel: 'Cancel',

    targetRequired: 'Say which Kwami, by name.',
    notFound: 'There is no Kwami called "{name}".',
    ambiguous:
      'More than one Kwami matches "{name}": {list}. Ask which one is meant before changing anything.',
    nameRequired: 'Say what the new name should be.',

    created: 'Created a new Kwami called {name} and switched to it.',
    createFailed: 'Could not create the Kwami: {error}',
    renamed: 'Renamed {previous} to {name}.',
    renameFailed: 'Could not rename the Kwami: {error}',
    deleted: 'Deleted {name}.',
    deleteFailed: 'Could not delete the Kwami: {error}',
    deleteRefused: 'The server refused to delete {name}, so nothing was removed.',
    deleteCancelled: 'Not deleted. {name} is still here.',
    deleteLast:
      'That is the only Kwami there is, so deleting it would leave nothing. Create another one first.',
    confirmDeleteTitle: 'Delete this Kwami',
    confirmDeleteBody: 'This permanently deletes {name} and everything configured on it.',

    creditsBalance: 'There is {display} of energy left.',
    creditsEmpty: 'There is no energy left.',
    creditsFailed: 'Could not read the energy balance: {error}',

    notSignedIn: 'Nobody is signed in.',
    signedOut: 'Signed out.',
    signOutCancelled: 'Still signed in. The sign-out was cancelled.',
    signOutFailed: 'Could not sign out: {error}',
    confirmSignOutTitle: 'Sign out',
    confirmSignOutBody: 'This ends the session and returns to the login screen.',

    randomized: 'Rolled a new look.',
    randomizedWithScene: 'Rolled a new look, with {background} behind.',
    randomizeNothing: 'Nothing was changed.',
    randomizeTargetInvalid: 'Unknown thing to randomize. Use one of: {list}.',

    actionCreated: 'Created a Kwami',
    actionRenamed: 'Renamed a Kwami',
    actionDeleted: 'Deleted a Kwami',
    actionRandomized: 'Rolled a new look',

    toolDescCreateKwami:
      'Create a new Kwami and switch to it. Give a name if the user said one, otherwise one is generated. It comes out with a randomised look by default, because a new Kwami with no appearance is a grey placeholder the user then has to describe from scratch; pass randomize false for a plain one, or activate false to create it without switching. Reversible with delete_kwami, so it does not ask the user to confirm. To move between Kwamis that already exist, use switch_kwami_profile instead.',
    toolDescRenameKwami:
      'Rename an existing Kwami, named by its current name or id. Only the name changes; the look and the settings are left alone. An ambiguous name is refused with the candidates listed rather than guessed at, so ask which one is meant.',
    toolDescDeleteKwami:
      'Permanently delete a Kwami and everything configured on it, named by name or id. This cannot be undone, so the app asks the user to confirm and names the Kwami first: say which one and wait for the result rather than reporting it gone while the dialog is still open. It refuses to delete the last remaining Kwami. Read the returned deleted field, because the server can refuse and nothing is removed when it does.',
    toolDescGetCreditBalance:
      'Read how much energy the user has left, the balance shown in the energy panel. Read only. It cannot buy more, and the canPurchase field is always false, so if the user wants to top up tell them to do it in the energy panel.',
    toolDescSignOut:
      'Sign the user out and return to the login screen. This ends the conversation, so only do it when clearly asked. The app asks the user to confirm first; wait for the result rather than saying goodbye while the dialog is still open.',
    toolDescRandomizeAppearance:
      'Roll a new random look, for when the user says something like surprise me. Target avatar rerolls every parameter of the avatar currently showing, which is the same dice button the avatar panel has. Target scene picks one of the backgrounds that ship with the app at random rather than inventing one, so it is a random choice among the presets and not a randomly generated background; say so if the user expects something generated. Target both does the two together. Everything it changes can be put back with reset_ui_domain.',
  },
} as const;

export const kwamiAdminEs = {
  kwamiAdmin: {
    confirmApply: 'Si, hazlo',
    confirmCancel: 'Cancelar',

    targetRequired: 'Di que Kwami, por su nombre.',
    notFound: 'No hay ningun Kwami llamado "{name}".',
    ambiguous:
      'Hay mas de un Kwami que coincide con "{name}": {list}. Pregunta a cual se refiere antes de cambiar nada.',
    nameRequired: 'Di cual debe ser el nombre nuevo.',

    created: 'Se ha creado un Kwami nuevo llamado {name} y se ha cambiado a el.',
    createFailed: 'No se pudo crear el Kwami: {error}',
    renamed: 'Se ha renombrado {previous} a {name}.',
    renameFailed: 'No se pudo renombrar el Kwami: {error}',
    deleted: 'Se ha eliminado {name}.',
    deleteFailed: 'No se pudo eliminar el Kwami: {error}',
    deleteRefused: 'El servidor se nego a eliminar {name}, asi que no se ha borrado nada.',
    deleteCancelled: 'No se ha eliminado. {name} sigue aqui.',
    deleteLast:
      'Es el unico Kwami que hay, asi que eliminarlo no dejaria ninguno. Crea otro primero.',
    confirmDeleteTitle: 'Eliminar este Kwami',
    confirmDeleteBody: 'Esto elimina permanentemente a {name} y todo lo que tenga configurado.',

    creditsBalance: 'Queda {display} de energia.',
    creditsEmpty: 'No queda energia.',
    creditsFailed: 'No se pudo leer el saldo de energia: {error}',

    notSignedIn: 'No hay nadie con la sesion iniciada.',
    signedOut: 'Sesion cerrada.',
    signOutCancelled: 'La sesion sigue abierta. Se cancelo el cierre.',
    signOutFailed: 'No se pudo cerrar la sesion: {error}',
    confirmSignOutTitle: 'Cerrar sesion',
    confirmSignOutBody: 'Esto termina la sesion y vuelve a la pantalla de inicio.',

    randomized: 'Nuevo aspecto generado.',
    randomizedWithScene: 'Nuevo aspecto generado, con {background} de fondo.',
    randomizeNothing: 'No se ha cambiado nada.',
    randomizeTargetInvalid: 'No se sabe que hay que aleatorizar. Usa uno de: {list}.',

    actionCreated: 'Kwami creado',
    actionRenamed: 'Kwami renombrado',
    actionDeleted: 'Kwami eliminado',
    actionRandomized: 'Nuevo aspecto',

    toolDescCreateKwami:
      'Crea un Kwami nuevo y cambia a el. Dale un nombre si el usuario ha dicho uno; si no, se genera. Sale con un aspecto aleatorio por defecto, porque un Kwami nuevo sin aspecto es un marcador gris que el usuario tendria que describir desde cero; pasa randomize false para uno sencillo, o activate false para crearlo sin cambiar a el. Es reversible con delete_kwami, asi que no pide confirmacion. Para moverte entre Kwamis que ya existen, usa switch_kwami_profile.',
    toolDescRenameKwami:
      'Renombra un Kwami existente, indicado por su nombre actual o su id. Solo cambia el nombre; el aspecto y los ajustes se dejan igual. Un nombre ambiguo se rechaza listando los candidatos en lugar de adivinarse, asi que pregunta a cual se refiere.',
    toolDescDeleteKwami:
      'Elimina permanentemente un Kwami y todo lo que tenga configurado, indicado por nombre o id. No se puede deshacer, asi que la app pide confirmacion al usuario y nombra antes el Kwami: di cual y espera el resultado en lugar de darlo por eliminado mientras el dialogo sigue abierto. Se niega a eliminar el ultimo Kwami que quede. Lee el campo deleted que devuelve, porque el servidor puede negarse y entonces no se borra nada.',
    toolDescGetCreditBalance:
      'Consulta cuanta energia le queda al usuario, el saldo que muestra el panel de energia. Solo lectura. No puede comprar mas, y el campo canPurchase siempre es false, asi que si el usuario quiere recargar dile que lo haga en el panel de energia.',
    toolDescSignOut:
      'Cierra la sesion del usuario y vuelve a la pantalla de inicio. Esto termina la conversacion, asi que hazlo solo cuando te lo pidan claramente. La app pide confirmacion primero; espera el resultado en lugar de despedirte mientras el dialogo sigue abierto.',
    toolDescRandomizeAppearance:
      'Genera un aspecto nuevo al azar, para cuando el usuario diga algo como sorprendeme. El objetivo avatar vuelve a tirar todos los parametros del avatar que se este mostrando, que es el mismo boton de dado que tiene el panel de avatar. El objetivo scene elige al azar uno de los fondos que vienen con la app en lugar de inventar uno, asi que es una eleccion al azar entre los preajustes y no un fondo generado al azar; dilo si el usuario espera algo generado. El objetivo both hace las dos cosas. Todo lo que cambia se puede deshacer con reset_ui_domain.',
  },
} as const;

export const kwamiAdminFr = {
  kwamiAdmin: {
    confirmApply: 'Oui, fais-le',
    confirmCancel: 'Annuler',

    targetRequired: 'Dis quel Kwami, par son nom.',
    notFound: 'Il n y a aucun Kwami appelé "{name}".',
    ambiguous:
      'Plusieurs Kwami correspondent à "{name}" : {list}. Demande lequel avant de changer quoi que ce soit.',
    nameRequired: 'Dis quel doit être le nouveau nom.',

    created: 'Nouveau Kwami appelé {name} créé, et il est maintenant actif.',
    createFailed: 'Impossible de créer le Kwami : {error}',
    renamed: '{previous} a été renommé en {name}.',
    renameFailed: 'Impossible de renommer le Kwami : {error}',
    deleted: '{name} a été supprimé.',
    deleteFailed: 'Impossible de supprimer le Kwami : {error}',
    deleteRefused: 'Le serveur a refusé de supprimer {name}, donc rien n a été supprimé.',
    deleteCancelled: 'Rien supprimé. {name} est toujours là.',
    deleteLast:
      'C est le seul Kwami qui existe, donc le supprimer n en laisserait aucun. Crées-en un autre d abord.',
    confirmDeleteTitle: 'Supprimer ce Kwami',
    confirmDeleteBody: 'Ceci supprime définitivement {name} et tout ce qui y est configuré.',

    creditsBalance: 'Il reste {display} d énergie.',
    creditsEmpty: 'Il ne reste plus d énergie.',
    creditsFailed: 'Impossible de lire le solde d énergie : {error}',

    notSignedIn: 'Personne n est connecté.',
    signedOut: 'Déconnecté.',
    signOutCancelled: 'Toujours connecté. La déconnexion a été annulée.',
    signOutFailed: 'Impossible de se déconnecter : {error}',
    confirmSignOutTitle: 'Se déconnecter',
    confirmSignOutBody: 'Ceci termine la session et revient à l écran de connexion.',

    randomized: 'Nouvelle apparence tirée au sort.',
    randomizedWithScene: 'Nouvelle apparence tirée au sort, avec {background} en fond.',
    randomizeNothing: 'Rien n a été changé.',
    randomizeTargetInvalid: 'Élément à tirer au sort inconnu. Utilise l un de : {list}.',

    actionCreated: 'Kwami créé',
    actionRenamed: 'Kwami renommé',
    actionDeleted: 'Kwami supprimé',
    actionRandomized: 'Nouvelle apparence',

    toolDescCreateKwami:
      'Crée un nouveau Kwami et bascule dessus. Donne-lui un nom si l utilisateur en a dit un, sinon un nom est généré. Il sort avec une apparence aléatoire par défaut, parce qu un Kwami neuf sans apparence est un gris que l utilisateur devrait ensuite décrire de zéro ; passe randomize false pour un simple, ou activate false pour le créer sans basculer dessus. Réversible avec delete_kwami, donc il ne demande pas de confirmation. Pour passer d un Kwami existant à un autre, utilise switch_kwami_profile.',
    toolDescRenameKwami:
      'Renomme un Kwami existant, désigné par son nom actuel ou son identifiant. Seul le nom change ; l apparence et les réglages restent intacts. Un nom ambigu est refusé avec la liste des candidats plutôt que deviné, donc demande lequel est visé.',
    toolDescDeleteKwami:
      'Supprime définitivement un Kwami et tout ce qui y est configuré, désigné par nom ou identifiant. Irréversible, donc l application demande confirmation à l utilisateur et nomme le Kwami d abord : dis lequel et attends le résultat plutôt que de le déclarer supprimé pendant que la boîte de dialogue est encore ouverte. Il refuse de supprimer le dernier Kwami restant. Lis le champ deleted renvoyé, car le serveur peut refuser et rien n est alors supprimé.',
    toolDescGetCreditBalance:
      'Consulte combien d énergie il reste à l utilisateur, le solde affiché dans le panneau d énergie. Lecture seule. Cet outil ne peut pas en acheter, et le champ canPurchase vaut toujours false, donc si l utilisateur veut recharger, dis-lui de le faire dans le panneau d énergie.',
    toolDescSignOut:
      'Déconnecte l utilisateur et revient à l écran de connexion. Ceci met fin à la conversation, donc ne le fais que si on te le demande clairement. L application demande confirmation d abord ; attends le résultat plutôt que de dire au revoir pendant que la boîte de dialogue est encore ouverte.',
    toolDescRandomizeAppearance:
      'Tire une nouvelle apparence au hasard, pour quand l utilisateur dit quelque chose comme surprends-moi. La cible avatar retire tous les paramètres de l avatar affiché, ce qui est le même bouton dé que celui du panneau avatar. La cible scene choisit au hasard un des fonds fournis avec l application plutôt que d en inventer un, donc c est un choix au hasard parmi les préréglages et non un fond généré au hasard ; dis-le si l utilisateur attend quelque chose de généré. La cible both fait les deux. Tout ce qu il change peut être remis en place avec reset_ui_domain.',
  },
} as const;

export const kwamiAdminPt = {
  kwamiAdmin: {
    confirmApply: 'Sim, faz isso',
    confirmCancel: 'Cancelar',

    targetRequired: 'Diz qual Kwami, pelo nome.',
    notFound: 'Não existe nenhum Kwami chamado "{name}".',
    ambiguous:
      'Há mais do que um Kwami que corresponde a "{name}": {list}. Pergunta qual antes de mudar seja o que for.',
    nameRequired: 'Diz qual deve ser o novo nome.',

    created: 'Criado um novo Kwami chamado {name} e mudou-se para ele.',
    createFailed: 'Não foi possível criar o Kwami: {error}',
    renamed: '{previous} foi renomeado para {name}.',
    renameFailed: 'Não foi possível renomear o Kwami: {error}',
    deleted: '{name} foi eliminado.',
    deleteFailed: 'Não foi possível eliminar o Kwami: {error}',
    deleteRefused: 'O servidor recusou eliminar {name}, por isso nada foi removido.',
    deleteCancelled: 'Nada eliminado. {name} continua aqui.',
    deleteLast:
      'É o único Kwami que existe, por isso eliminá-lo não deixaria nenhum. Cria outro primeiro.',
    confirmDeleteTitle: 'Eliminar este Kwami',
    confirmDeleteBody: 'Isto elimina permanentemente {name} e tudo o que estiver configurado nele.',

    creditsBalance: 'Resta {display} de energia.',
    creditsEmpty: 'Não resta energia.',
    creditsFailed: 'Não foi possível ler o saldo de energia: {error}',

    notSignedIn: 'Não há ninguém com sessão iniciada.',
    signedOut: 'Sessão terminada.',
    signOutCancelled: 'A sessão continua aberta. O fecho foi cancelado.',
    signOutFailed: 'Não foi possível terminar a sessão: {error}',
    confirmSignOutTitle: 'Terminar sessão',
    confirmSignOutBody: 'Isto termina a sessão e volta ao ecrã de entrada.',

    randomized: 'Novo aspeto sorteado.',
    randomizedWithScene: 'Novo aspeto sorteado, com {background} ao fundo.',
    randomizeNothing: 'Nada foi mudado.',
    randomizeTargetInvalid: 'Não se sabe o que aleatorizar. Usa um de: {list}.',

    actionCreated: 'Kwami criado',
    actionRenamed: 'Kwami renomeado',
    actionDeleted: 'Kwami eliminado',
    actionRandomized: 'Novo aspeto',

    toolDescCreateKwami:
      'Cria um Kwami novo e muda para ele. Dá-lhe um nome se o utilizador disse algum; caso contrário é gerado. Sai com um aspeto aleatório por omissão, porque um Kwami novo sem aspeto é um cinzento que o utilizador teria depois de descrever do zero; passa randomize false para um simples, ou activate false para o criar sem mudar para ele. É reversível com delete_kwami, por isso não pede confirmação. Para mudar entre Kwamis que já existem, usa switch_kwami_profile.',
    toolDescRenameKwami:
      'Renomeia um Kwami existente, indicado pelo nome atual ou pelo identificador. Só o nome muda; o aspeto e as definições ficam intactos. Um nome ambíguo é recusado com a lista de candidatos em vez de adivinhado, por isso pergunta qual é.',
    toolDescDeleteKwami:
      'Elimina permanentemente um Kwami e tudo o que estiver configurado nele, indicado por nome ou identificador. Não pode ser desfeito, por isso a aplicação pede confirmação ao utilizador e nomeia primeiro o Kwami: diz qual e espera pelo resultado em vez de o dar como eliminado enquanto a caixa de diálogo ainda está aberta. Recusa eliminar o último Kwami que reste. Lê o campo deleted devolvido, porque o servidor pode recusar e nesse caso nada é removido.',
    toolDescGetCreditBalance:
      'Consulta quanta energia resta ao utilizador, o saldo mostrado no painel de energia. Só de leitura. Não pode comprar mais, e o campo canPurchase é sempre false, por isso se o utilizador quiser carregar diz-lhe para o fazer no painel de energia.',
    toolDescSignOut:
      'Termina a sessão do utilizador e volta ao ecrã de entrada. Isto termina a conversa, por isso só o faças quando te pedirem claramente. A aplicação pede confirmação primeiro; espera pelo resultado em vez de te despedires enquanto a caixa de diálogo ainda está aberta.',
    toolDescRandomizeAppearance:
      'Sorteia um aspeto novo, para quando o utilizador disser algo como surpreende-me. O alvo avatar volta a sortear todos os parâmetros do avatar que está a ser mostrado, que é o mesmo botão de dado do painel de avatar. O alvo scene escolhe ao acaso um dos fundos que vêm com a aplicação em vez de inventar um, por isso é uma escolha ao acaso entre as predefinições e não um fundo gerado ao acaso; di-lo se o utilizador esperar algo gerado. O alvo both faz as duas coisas. Tudo o que muda pode ser reposto com reset_ui_domain.',
  },
} as const;

export const kwamiAdminIt = {
  kwamiAdmin: {
    confirmApply: 'Sì, fallo',
    confirmCancel: 'Annulla',

    targetRequired: 'Di quale Kwami, per nome.',
    notFound: 'Non esiste nessun Kwami chiamato "{name}".',
    ambiguous:
      'Più di un Kwami corrisponde a "{name}": {list}. Chiedi quale prima di cambiare qualsiasi cosa.',
    nameRequired: 'Di quale deve essere il nuovo nome.',

    created: 'Creato un nuovo Kwami chiamato {name} e reso attivo.',
    createFailed: 'Non è stato possibile creare il Kwami: {error}',
    renamed: '{previous} è stato rinominato in {name}.',
    renameFailed: 'Non è stato possibile rinominare il Kwami: {error}',
    deleted: '{name} è stato eliminato.',
    deleteFailed: 'Non è stato possibile eliminare il Kwami: {error}',
    deleteRefused: 'Il server ha rifiutato di eliminare {name}, quindi non è stato rimosso nulla.',
    deleteCancelled: 'Non eliminato. {name} è ancora qui.',
    deleteLast:
      'È l unico Kwami che esiste, quindi eliminarlo non ne lascerebbe nessuno. Creane un altro prima.',
    confirmDeleteTitle: 'Eliminare questo Kwami',
    confirmDeleteBody: 'Questo elimina definitivamente {name} e tutto ciò che vi è configurato.',

    creditsBalance: 'Resta {display} di energia.',
    creditsEmpty: 'Non resta energia.',
    creditsFailed: 'Non è stato possibile leggere il saldo di energia: {error}',

    notSignedIn: 'Non c è nessuno collegato.',
    signedOut: 'Disconnesso.',
    signOutCancelled: 'Ancora collegato. La disconnessione è stata annullata.',
    signOutFailed: 'Non è stato possibile disconnettersi: {error}',
    confirmSignOutTitle: 'Disconnettersi',
    confirmSignOutBody: 'Questo termina la sessione e torna alla schermata di accesso.',

    randomized: 'Nuovo aspetto estratto a caso.',
    randomizedWithScene: 'Nuovo aspetto estratto a caso, con {background} sullo sfondo.',
    randomizeNothing: 'Non è stato cambiato nulla.',
    randomizeTargetInvalid: 'Non si sa cosa rendere casuale. Usa uno tra: {list}.',

    actionCreated: 'Kwami creato',
    actionRenamed: 'Kwami rinominato',
    actionDeleted: 'Kwami eliminato',
    actionRandomized: 'Nuovo aspetto',

    toolDescCreateKwami:
      'Crea un nuovo Kwami e passa a esso. Dagli un nome se l utente ne ha detto uno, altrimenti ne viene generato uno. Esce con un aspetto casuale per impostazione predefinita, perché un Kwami nuovo senza aspetto è un grigio che l utente dovrebbe poi descrivere da zero; passa randomize false per uno semplice, o activate false per crearlo senza passarci. È reversibile con delete_kwami, quindi non chiede conferma. Per spostarti tra Kwami che esistono già, usa switch_kwami_profile.',
    toolDescRenameKwami:
      'Rinomina un Kwami esistente, indicato dal nome attuale o dall identificativo. Cambia solo il nome; l aspetto e le impostazioni restano intatti. Un nome ambiguo viene rifiutato elencando i candidati invece di essere indovinato, quindi chiedi quale si intende.',
    toolDescDeleteKwami:
      'Elimina definitivamente un Kwami e tutto ciò che vi è configurato, indicato per nome o identificativo. Non si può annullare, quindi l applicazione chiede conferma all utente e nomina prima il Kwami: di quale e aspetta il risultato invece di darlo per eliminato mentre la finestra di dialogo è ancora aperta. Si rifiuta di eliminare l ultimo Kwami rimasto. Leggi il campo deleted restituito, perché il server può rifiutare e in tal caso non viene rimosso nulla.',
    toolDescGetCreditBalance:
      'Legge quanta energia resta all utente, il saldo mostrato nel pannello energia. Sola lettura. Non può comprarne altra, e il campo canPurchase è sempre false, quindi se l utente vuole ricaricare digli di farlo nel pannello energia.',
    toolDescSignOut:
      'Disconnette l utente e torna alla schermata di accesso. Questo termina la conversazione, quindi fallo solo quando te lo chiedono chiaramente. L applicazione chiede prima conferma; aspetta il risultato invece di salutare mentre la finestra di dialogo è ancora aperta.',
    toolDescRandomizeAppearance:
      'Estrae un aspetto nuovo a caso, per quando l utente dice qualcosa come sorprendimi. Il bersaglio avatar riestrae tutti i parametri dell avatar mostrato, che è lo stesso pulsante dado del pannello avatar. Il bersaglio scene sceglie a caso uno degli sfondi forniti con l applicazione invece di inventarne uno, quindi è una scelta casuale tra le preimpostazioni e non uno sfondo generato a caso; dillo se l utente si aspetta qualcosa di generato. Il bersaglio both fa entrambe le cose. Tutto ciò che cambia si può ripristinare con reset_ui_domain.',
  },
} as const;
