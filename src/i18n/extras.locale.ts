/**
 * Strings for theme transfer, pipeline metrics and wallet creation.
 *
 * Braces are placeholders and a bare pipe silently keeps one branch, so
 * neither may appear as prose here.
 */
export const extrasEn = {
  extras: {
    themeExported: 'Here is the current theme as JSON.',
    themeJsonRequired: 'Provide the theme as a JSON string.',
    themeImportRejected: 'That is not a theme this app can read, so nothing changed.',
    themeImported: 'Applied the imported theme.',
    actionImportedTheme: 'Imported a theme',

    metricsNotYet: 'No turns have completed yet, so there is nothing to measure.',
    metricsOverall: 'The last turn took {overall} end to end.',
    metricsReset: 'Reset the performance counters.',

    walletExists: 'This Kwami already has a wallet.',
    walletCreated: 'Created a wallet on {network}.',
    walletCreateNoResult: 'The wallet was not created; the server returned nothing.',
    walletCreateFailed: 'Could not create the wallet: {error}',
    actionCreatedWallet: 'Created a wallet',

    toolDescExportTheme:
      'Get the current theme as a JSON string, the same thing the theme panel export button copies. Read only. The result is long, so offer it to the user or hand it on rather than reading it out.',
    toolDescImportTheme:
      'Apply a theme from a JSON string, the same thing the theme panel import box accepts. Read the returned applied field rather than assuming it worked: malformed JSON is rejected and the screen stays exactly as it was, so reporting off the request would claim a change the user cannot see. Reversible with reset_ui_domain on the theme domain, so it does not ask the user to confirm.',
    toolDescGetPerformanceMetrics:
      'Read how fast the voice pipeline is running: speech recognition, end of turn, model, speech synthesis and the overall time for the last turn, plus how many turns and interruptions there have been. Read only. Check the hasData field first, because before any turn completes the panel shows a dash rather than a number and reading that out would be nonsense.',
    toolDescResetPerformanceMetrics:
      'Reset the performance counters back to zero. Affects only the numbers shown in the metrics panel and nothing about the conversation.',
    toolDescCreateWallet:
      'Create a wallet for this Kwami, the same button the wallet panel has. This makes an empty wallet and nothing else: it moves no money, spends nothing, and the canSpend field is always false. If one already exists it says so and changes nothing. Adding funds or sending anything is deliberately not possible by voice and has to be done by hand in the wallet panel.',
  },
} as const;

export const extrasEs = {
  extras: {
    themeExported: 'Aqui esta el tema actual en JSON.',
    themeJsonRequired: 'Indica el tema como una cadena JSON.',
    themeImportRejected: 'Eso no es un tema que la app pueda leer, asi que no ha cambiado nada.',
    themeImported: 'Se ha aplicado el tema importado.',
    actionImportedTheme: 'Tema importado',

    metricsNotYet: 'Todavia no se ha completado ningun turno, asi que no hay nada que medir.',
    metricsOverall: 'El ultimo turno tardo {overall} de principio a fin.',
    metricsReset: 'Contadores de rendimiento reiniciados.',

    walletExists: 'Este Kwami ya tiene monedero.',
    walletCreated: 'Se ha creado un monedero en {network}.',
    walletCreateNoResult: 'No se creo el monedero; el servidor no devolvio nada.',
    walletCreateFailed: 'No se pudo crear el monedero: {error}',
    actionCreatedWallet: 'Monedero creado',

    toolDescExportTheme:
      'Obtiene el tema actual como cadena JSON, lo mismo que copia el boton de exportar del panel de tema. Solo lectura. El resultado es largo, asi que ofrecelo al usuario o pasalo en lugar de leerlo en voz alta.',
    toolDescImportTheme:
      'Aplica un tema desde una cadena JSON, lo mismo que acepta la caja de importar del panel de tema. Lee el campo applied que devuelve en lugar de dar por hecho que funciono: un JSON mal formado se rechaza y la pantalla se queda igual, asi que informar de lo que pediste afirmaria un cambio que el usuario no ve. Es reversible con reset_ui_domain en el dominio theme, asi que no pide confirmacion.',
    toolDescGetPerformanceMetrics:
      'Consulta a que velocidad va la tuberia de voz: reconocimiento, fin de turno, modelo, sintesis y el tiempo total del ultimo turno, ademas de cuantos turnos e interrupciones ha habido. Solo lectura. Mira antes el campo hasData, porque antes de que se complete un turno el panel muestra un guion en lugar de un numero y leerlo en voz alta no tendria sentido.',
    toolDescResetPerformanceMetrics:
      'Reinicia los contadores de rendimiento a cero. Solo afecta a los numeros del panel de metricas y a nada de la conversacion.',
    toolDescCreateWallet:
      'Crea un monedero para este Kwami, el mismo boton que tiene el panel de monedero. Crea un monedero vacio y nada mas: no mueve dinero, no gasta nada y el campo canSpend siempre es false. Si ya existe uno lo dice y no cambia nada. Anadir fondos o enviar algo no se puede hacer por voz a proposito y hay que hacerlo a mano en el panel de monedero.',
  },
} as const;

export const extrasFr = {
  extras: {
    themeExported: 'Voici le thème actuel en JSON.',
    themeJsonRequired: 'Indique le thème sous forme de chaîne JSON.',
    themeImportRejected: "Ce n'est pas un thème que l'app sait lire, donc rien n'a changé.",
    themeImported: 'Le thème importé a été appliqué.',
    actionImportedTheme: 'Thème importé',

    metricsNotYet: "Aucun tour ne s'est encore terminé, il n'y a donc rien à mesurer.",
    metricsOverall: 'Le dernier tour a pris {overall} de bout en bout.',
    metricsReset: 'Compteurs de performance remis à zéro.',

    walletExists: 'Ce Kwami a déjà un portefeuille.',
    walletCreated: 'Portefeuille créé sur {network}.',
    walletCreateNoResult: "Le portefeuille n'a pas été créé ; le serveur n'a rien renvoyé.",
    walletCreateFailed: 'Impossible de créer le portefeuille : {error}',
    actionCreatedWallet: 'Portefeuille créé',

    toolDescExportTheme:
      "Récupère le thème actuel sous forme de chaîne JSON, la même chose que copie le bouton d'export du panneau de thème. Lecture seule. Le résultat est long, donc propose-le à l'utilisateur ou transmets-le plutôt que de le lire à voix haute.",
    toolDescImportTheme:
      "Applique un thème depuis une chaîne JSON, la même chose qu'accepte la boîte d'import du panneau de thème. Lis le champ applied renvoyé plutôt que de supposer que ça a marché : un JSON mal formé est rejeté et l'écran reste exactement tel quel, donc rendre compte de ta demande affirmerait un changement que l'utilisateur ne voit pas. Réversible avec reset_ui_domain sur le domaine theme, donc cela ne demande pas de confirmation à l'utilisateur.",
    toolDescGetPerformanceMetrics:
      "Consulte à quelle vitesse tourne le pipeline vocal : reconnaissance, fin de tour, modèle, synthèse et le temps total du dernier tour, plus le nombre de tours et d'interruptions. Lecture seule. Regarde d'abord le champ hasData, car avant qu'un tour ne se termine le panneau affiche un tiret au lieu d'un nombre et le lire à voix haute n'aurait aucun sens.",
    toolDescResetPerformanceMetrics:
      'Remet les compteurs de performance à zéro. Cela ne touche que les nombres du panneau de métriques et rien de la conversation.',
    toolDescCreateWallet:
      "Crée un portefeuille pour ce Kwami, le même bouton que celui du panneau portefeuille. Cela crée un portefeuille vide et rien d'autre : ça ne déplace pas d'argent, ne dépense rien, et le champ canSpend est toujours false. S'il en existe déjà un, cela le dit et ne change rien. Ajouter des fonds ou envoyer quoi que ce soit est volontairement impossible à la voix et doit se faire à la main dans le panneau portefeuille.",
  },
} as const;

export const extrasPt = {
  extras: {
    themeExported: 'Aqui está o tema atual em JSON.',
    themeJsonRequired: 'Indica o tema como uma cadeia JSON.',
    themeImportRejected: 'Isso não é um tema que a app consiga ler, por isso nada mudou.',
    themeImported: 'O tema importado foi aplicado.',
    actionImportedTheme: 'Tema importado',

    metricsNotYet: 'Ainda não terminou nenhum turno, por isso não há nada para medir.',
    metricsOverall: 'O último turno demorou {overall} de ponta a ponta.',
    metricsReset: 'Contadores de desempenho reiniciados.',

    walletExists: 'Este Kwami já tem carteira.',
    walletCreated: 'Carteira criada em {network}.',
    walletCreateNoResult: 'A carteira não foi criada; o servidor não devolveu nada.',
    walletCreateFailed: 'Não foi possível criar a carteira: {error}',
    actionCreatedWallet: 'Carteira criada',

    toolDescExportTheme:
      'Obtém o tema atual como cadeia JSON, o mesmo que o botão de exportar do painel de tema copia. Apenas leitura. O resultado é longo, por isso oferece-o ao utilizador ou passa-o adiante em vez de o ler em voz alta.',
    toolDescImportTheme:
      'Aplica um tema a partir de uma cadeia JSON, o mesmo que a caixa de importar do painel de tema aceita. Lê o campo applied devolvido em vez de assumir que funcionou: um JSON mal formado é rejeitado e o ecrã fica exatamente como estava, por isso relatar a partir do pedido afirmaria uma mudança que o utilizador não vê. Reversível com reset_ui_domain no domínio theme, por isso não pede confirmação ao utilizador.',
    toolDescGetPerformanceMetrics:
      'Consulta a que velocidade corre o pipeline de voz: reconhecimento, fim de turno, modelo, síntese e o tempo total do último turno, além de quantos turnos e interrupções houve. Apenas leitura. Vê primeiro o campo hasData, porque antes de um turno terminar o painel mostra um traço em vez de um número e lê-lo em voz alta não faria sentido.',
    toolDescResetPerformanceMetrics:
      'Reinicia os contadores de desempenho a zero. Só afeta os números do painel de métricas e nada da conversa.',
    toolDescCreateWallet:
      'Cria uma carteira para este Kwami, o mesmo botão que o painel de carteira tem. Cria uma carteira vazia e mais nada: não move dinheiro, não gasta nada, e o campo canSpend é sempre false. Se já existir uma, diz isso e não muda nada. Adicionar fundos ou enviar seja o que for é propositadamente impossível por voz e tem de ser feito à mão no painel de carteira.',
  },
} as const;

export const extrasIt = {
  extras: {
    themeExported: 'Ecco il tema attuale in JSON.',
    themeJsonRequired: 'Indica il tema come stringa JSON.',
    themeImportRejected: "Quello non è un tema che l'app sappia leggere, quindi non è cambiato nulla.",
    themeImported: 'Il tema importato è stato applicato.',
    actionImportedTheme: 'Tema importato',

    metricsNotYet: "Non si è ancora concluso nessun turno, quindi non c'è nulla da misurare.",
    metricsOverall: "L'ultimo turno ha impiegato {overall} da un capo all'altro.",
    metricsReset: 'Contatori delle prestazioni azzerati.',

    walletExists: 'Questo Kwami ha già un portafoglio.',
    walletCreated: 'Portafoglio creato su {network}.',
    walletCreateNoResult: 'Il portafoglio non è stato creato; il server non ha restituito nulla.',
    walletCreateFailed: 'Non è stato possibile creare il portafoglio: {error}',
    actionCreatedWallet: 'Portafoglio creato',

    toolDescExportTheme:
      "Ottiene il tema attuale come stringa JSON, la stessa cosa che copia il pulsante di esportazione del pannello tema. Sola lettura. Il risultato è lungo, quindi offrilo all'utente o passalo invece di leggerlo ad alta voce.",
    toolDescImportTheme:
      "Applica un tema da una stringa JSON, la stessa cosa che accetta la casella di importazione del pannello tema. Leggi il campo applied restituito invece di dare per scontato che abbia funzionato: un JSON malformato viene rifiutato e lo schermo resta esattamente com'era, quindi riferire in base alla richiesta affermerebbe un cambiamento che l'utente non vede. Reversibile con reset_ui_domain sul dominio theme, quindi non chiede conferma all'utente.",
    toolDescGetPerformanceMetrics:
      "Controlla a che velocità gira la pipeline vocale: riconoscimento, fine turno, modello, sintesi e il tempo complessivo dell'ultimo turno, oltre a quanti turni e interruzioni ci sono stati. Sola lettura. Guarda prima il campo hasData, perché prima che un turno si concluda il pannello mostra un trattino invece di un numero e leggerlo ad alta voce non avrebbe senso.",
    toolDescResetPerformanceMetrics:
      'Azzera i contatori delle prestazioni. Riguarda solo i numeri del pannello metriche e nulla della conversazione.',
    toolDescCreateWallet:
      "Crea un portafoglio per questo Kwami, lo stesso pulsante che ha il pannello portafoglio. Crea un portafoglio vuoto e nient'altro: non muove denaro, non spende nulla, e il campo canSpend è sempre false. Se ne esiste già uno lo dice e non cambia nulla. Aggiungere fondi o inviare qualsiasi cosa è volutamente impossibile a voce e va fatto a mano nel pannello portafoglio.",
  },
} as const;
