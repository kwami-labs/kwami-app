/**
 * Strings for the phone, SMS, WhatsApp, contacts and wallet tools.
 *
 * vue-i18n treats braces and the pipe character as message syntax and this app
 * is on v11, where the v12 backslash escapes do not work. A literal brace in a
 * tool description raises "Invalid token in placeholder" and hands the model a
 * broken description at runtime, in one locale at a time. Reword, never escape.
 */
export const commsAgentToolsEn = {
  comms: {
    // -- recipient resolution ----------------------------------------------
    recipientRequired: 'Say who to contact, either a name from the contacts or a phone number.',
    recipientLabel: '{name} on the number ending {tail}',
    contactNotFound: 'No contact called "{name}". Check the name, or give the number directly.',
    contactAmbiguous:
      'More than one contact matches "{name}": {list}. Ask which one is meant before sending anything.',
    contactHasNoNumber: 'The contact {name} has no number saved for {channel}.',
    contactLookupFailed: 'Could not read the contacts: {error}',
    noActiveKwami: 'No Kwami is selected, so there is nothing to send from.',

    // -- channels -----------------------------------------------------------
    channelsFound: 'Found {count} connected channels.',
    noChannels: 'This Kwami has no phone, SMS or WhatsApp channel connected yet.',
    channelsFailed: 'Could not read the channels: {error}',
    numbersFound: 'Found {count} available numbers.',
    noNumbersFound: 'No available numbers matched that search.',
    numberSearchFailed: 'Could not search for numbers: {error}',

    // -- messaging ----------------------------------------------------------
    bodyRequired: 'Say what the message should contain.',
    confirmSmsTitle: 'Send this text message',
    confirmWhatsappTitle: 'Send this WhatsApp message',
    confirmSendBody: 'To {recipient}. Message: {text}',
    confirmSend: 'Send',
    confirmCancel: 'Cancel',
    sendCancelled: 'Not sent. The message to {recipient} was cancelled.',
    sendAccepted: 'The provider accepted the message to {recipient} for delivery.',
    sendFailed: 'The message to {recipient} was not sent: {error}',
    errSend: 'Message failed',
    actionSentSms: 'Sent a text',
    actionSentWhatsapp: 'Sent a WhatsApp message',

    // -- calling ------------------------------------------------------------
    confirmCallTitle: 'Place this call',
    confirmCallBody: 'Calling {recipient}. Full number: {number}',
    callCancelled: 'Not called. The call to {recipient} was cancelled.',
    callStarted: 'Dialling {recipient} now.',
    callFailed: 'The call to {recipient} did not start: {error}',
    errCall: 'Call failed',
    actionPlacedCall: 'Placed a call',

    // -- contacts -----------------------------------------------------------
    contactsFound: 'Found {count} contacts.',
    noContacts: 'There are no contacts saved yet.',
    contactSingle: 'One match: {name}, on {phone}.',
    contactMultiple: '{count} contacts match. Ask which one is meant.',
    contactNameRequired: 'A contact needs a name.',
    contactPhoneRequired: 'A contact needs a phone number.',
    contactTargetRequired: 'Say which contact, by name or by id.',
    contactNothingToChange: 'Nothing was given to change on that contact.',
    contactCreated: 'Saved {name} to the contacts.',
    contactUpdated: 'Updated {name}.',
    contactDeleted: 'Deleted {name} from the contacts.',
    contactSaveFailed: 'Could not save the contact: {error}',
    confirmDeleteContactTitle: 'Delete this contact',
    confirmDeleteContactBody: 'This removes {name} on {phone} and cannot be undone.',
    deleteCancelled: 'Not deleted. {name} is still in the contacts.',
    actionCreatedContact: 'Saved a contact',
    actionUpdatedContact: 'Updated a contact',
    actionDeletedContact: 'Deleted a contact',

    // -- wallet -------------------------------------------------------------
    noWallet: 'This Kwami has no wallet yet.',
    walletEmpty: 'The wallet exists but holds no balance.',
    walletSummary: 'The wallet holds {list}.',
    walletFailed: 'Could not read the wallet: {error}',

    // -- tool descriptions --------------------------------------------------
    toolDescListPhoneChannels:
      'List the phone, SMS and WhatsApp channels this Kwami has connected, with their numbers and status. Read this before sending anything if it is not already known whether a channel exists, because sending without one fails.',
    toolDescSearchPhoneNumbers:
      'Search for phone numbers available to buy, by country code and optionally an area code or digits the number should contain. This only searches and can never buy a number, because provisioning spends real money. Tell the user they need to buy it themselves in the phone panel.',
    toolDescSendSms:
      'Send a text message. The recipient can be a contact name or a phone number, and a name is looked up in the contacts rather than guessed: if more than one contact matches, the tool refuses and lists them, so ask which one is meant. The app asks the user to confirm before anything leaves, so say who it is going to and read the message back first, then wait for the result and do not tell the user it is sent while the dialog is still open. Report what the tool returns, not what you asked it to do. A message can be rejected by the carrier and a number can be unreachable; the accepted field says whether the provider took it for delivery, which is not the same as the recipient having read it. If it failed, say so plainly rather than softening it, because the user will act on the belief that it was sent.',
    toolDescSendWhatsapp:
      'Send a WhatsApp message. The recipient can be a contact name or a number, and a name is resolved against the contacts rather than guessed: an ambiguous name is refused with the candidates listed, so ask which one is meant. It uses the contact saved WhatsApp address when there is one and their phone number otherwise. The app asks the user to confirm first, so read the message back, then wait for the result rather than announcing success while the dialog is open. Report the accepted field rather than assuming it arrived.',
    toolDescPlaceCall:
      'Place a phone call to a contact or a number. Treat this as heavier than sending a message: a text is read later, a call rings a real person immediately and cannot be recalled. Always say who is being called and on which number before calling this tool, and when the number came from the contacts rather than from the user, say the name and the last digits together so a wrong match can be caught. The app asks the user to confirm, so wait for the result. The dialling field says whether the call actually started; report that rather than announcing a connection, because whether anyone picks up is not knowable here.',
    toolDescListContacts:
      'List the saved contacts, optionally filtered by a search word. Read only and safe to call whenever a name needs checking.',
    toolDescFindContact:
      'Look up one contact by name and read back their number. Use this before sending or calling when the user named a person rather than a number, so the number can be confirmed out loud. It returns every match rather than picking one, and the unique field says whether there was exactly one.',
    toolDescCreateContact:
      'Save a new contact with a name and a phone number, and optionally a WhatsApp address and an email. Safe and reversible, so it does not ask the user to confirm.',
    toolDescUpdateContact:
      'Change some details of an existing contact, named by contact name or id. Only the fields given are changed and everything else is left alone, so it is safe to call with just the one thing that is different. An ambiguous name is refused with the candidates listed rather than guessed at.',
    toolDescDeleteContact:
      'Delete a contact, named by contact name or id. This cannot be undone, so the app asks the user to confirm and names the contact and their number first. Wait for the result rather than saying it is gone while the dialog is open.',
    toolDescGetWalletSummary:
      'Read the wallet: whether one exists, which network it is on, and the balances it holds. Read only. It cannot move, send or spend anything, and the canSpend field is always false, so if the user asks to transfer or add funds tell them that has to be done in the wallet panel by hand.',
  },
} as const;

export const commsAgentToolsEs = {
  comms: {
    recipientRequired:
      'Di a quien contactar, con un nombre de los contactos o un numero de telefono.',
    recipientLabel: '{name} en el numero terminado en {tail}',
    contactNotFound:
      'No hay ningun contacto llamado "{name}". Revisa el nombre o da el numero directamente.',
    contactAmbiguous:
      'Hay mas de un contacto que coincide con "{name}": {list}. Pregunta a cual se refiere antes de enviar nada.',
    contactHasNoNumber: 'El contacto {name} no tiene numero guardado para {channel}.',
    contactLookupFailed: 'No se pudieron leer los contactos: {error}',
    noActiveKwami: 'No hay ningun Kwami seleccionado, asi que no hay desde donde enviar.',

    channelsFound: 'Se han encontrado {count} canales conectados.',
    noChannels: 'Este Kwami aun no tiene ningun canal de telefono, SMS o WhatsApp conectado.',
    channelsFailed: 'No se pudieron leer los canales: {error}',
    numbersFound: 'Se han encontrado {count} numeros disponibles.',
    noNumbersFound: 'Ningun numero disponible coincide con esa busqueda.',
    numberSearchFailed: 'No se pudo buscar numeros: {error}',

    bodyRequired: 'Di que debe decir el mensaje.',
    confirmSmsTitle: 'Enviar este mensaje de texto',
    confirmWhatsappTitle: 'Enviar este mensaje de WhatsApp',
    confirmSendBody: 'Para {recipient}. Mensaje: {text}',
    confirmSend: 'Enviar',
    confirmCancel: 'Cancelar',
    sendCancelled: 'No enviado. Se cancelo el mensaje a {recipient}.',
    sendAccepted: 'El proveedor acepto el mensaje a {recipient} para su entrega.',
    sendFailed: 'El mensaje a {recipient} no se envio: {error}',
    errSend: 'Fallo el envio',
    actionSentSms: 'Mensaje enviado',
    actionSentWhatsapp: 'WhatsApp enviado',

    confirmCallTitle: 'Realizar esta llamada',
    confirmCallBody: 'Llamando a {recipient}. Numero completo: {number}',
    callCancelled: 'No se ha llamado. Se cancelo la llamada a {recipient}.',
    callStarted: 'Marcando a {recipient} ahora.',
    callFailed: 'La llamada a {recipient} no se inicio: {error}',
    errCall: 'Fallo la llamada',
    actionPlacedCall: 'Llamada realizada',

    contactsFound: 'Se han encontrado {count} contactos.',
    noContacts: 'Todavia no hay contactos guardados.',
    contactSingle: 'Una coincidencia: {name}, en {phone}.',
    contactMultiple: 'Coinciden {count} contactos. Pregunta a cual se refiere.',
    contactNameRequired: 'Un contacto necesita un nombre.',
    contactPhoneRequired: 'Un contacto necesita un numero de telefono.',
    contactTargetRequired: 'Di que contacto, por nombre o por id.',
    contactNothingToChange: 'No se ha indicado nada que cambiar en ese contacto.',
    contactCreated: 'Se ha guardado {name} en los contactos.',
    contactUpdated: 'Se ha actualizado {name}.',
    contactDeleted: 'Se ha eliminado {name} de los contactos.',
    contactSaveFailed: 'No se pudo guardar el contacto: {error}',
    confirmDeleteContactTitle: 'Eliminar este contacto',
    confirmDeleteContactBody: 'Esto elimina a {name} en {phone} y no se puede deshacer.',
    deleteCancelled: 'No se ha eliminado. {name} sigue en los contactos.',
    actionCreatedContact: 'Contacto guardado',
    actionUpdatedContact: 'Contacto actualizado',
    actionDeletedContact: 'Contacto eliminado',

    noWallet: 'Este Kwami todavia no tiene monedero.',
    walletEmpty: 'El monedero existe pero no tiene saldo.',
    walletSummary: 'El monedero tiene {list}.',
    walletFailed: 'No se pudo leer el monedero: {error}',

    toolDescListPhoneChannels:
      'Lista los canales de telefono, SMS y WhatsApp que tiene conectados este Kwami, con sus numeros y su estado. Consultalo antes de enviar nada si no se sabe ya si existe un canal, porque enviar sin uno falla.',
    toolDescSearchPhoneNumbers:
      'Busca numeros de telefono disponibles para comprar, por codigo de pais y opcionalmente un prefijo o unos digitos que deba contener. Solo busca y nunca puede comprar un numero, porque aprovisionar gasta dinero real. Di al usuario que tiene que comprarlo el mismo en el panel de telefono.',
    toolDescSendSms:
      'Envia un mensaje de texto. El destinatario puede ser un nombre de contacto o un numero, y un nombre se busca en los contactos en lugar de adivinarse: si coincide mas de un contacto, la herramienta se niega y los lista, asi que pregunta a cual se refiere. La app pide confirmacion al usuario antes de que salga nada, asi que di a quien va dirigido y lee el mensaje en voz alta primero, luego espera el resultado y no digas al usuario que se ha enviado mientras el dialogo sigue abierto. Informa de lo que devuelve la herramienta, no de lo que pediste. Un mensaje puede ser rechazado por la operadora y un numero puede estar inaccesible; el campo accepted dice si el proveedor lo acepto para entrega, que no es lo mismo que que el destinatario lo haya leido. Si fallo, dilo claramente en lugar de suavizarlo, porque el usuario actuara creyendo que se envio.',
    toolDescSendWhatsapp:
      'Envia un mensaje de WhatsApp. El destinatario puede ser un nombre de contacto o un numero, y un nombre se resuelve contra los contactos en lugar de adivinarse: un nombre ambiguo se rechaza listando los candidatos, asi que pregunta a cual se refiere. Usa la direccion de WhatsApp guardada del contacto si la hay y su numero de telefono si no. La app pide confirmacion primero, asi que lee el mensaje en voz alta y luego espera el resultado en lugar de anunciar exito mientras el dialogo sigue abierto. Informa del campo accepted en lugar de dar por hecho que llego.',
    toolDescPlaceCall:
      'Realiza una llamada a un contacto o a un numero. Tratalo como algo mas serio que enviar un mensaje: un texto se lee despues, una llamada suena en el telefono de una persona real de inmediato y no se puede retirar. Di siempre a quien se llama y a que numero antes de llamar a esta herramienta, y cuando el numero venga de los contactos y no del usuario, di el nombre y los ultimos digitos juntos para que se pueda detectar una coincidencia equivocada. La app pide confirmacion al usuario, asi que espera el resultado. El campo dialling dice si la llamada se inicio de verdad; informa de eso en lugar de anunciar una conexion, porque desde aqui no se puede saber si alguien descuelga.',
    toolDescListContacts:
      'Lista los contactos guardados, opcionalmente filtrados por una palabra de busqueda. Solo lectura y seguro de usar siempre que haya que comprobar un nombre.',
    toolDescFindContact:
      'Busca un contacto por nombre y lee su numero. Usalo antes de enviar o llamar cuando el usuario haya nombrado a una persona en lugar de un numero, para poder confirmar el numero en voz alta. Devuelve todas las coincidencias en lugar de elegir una, y el campo unique dice si habia exactamente una.',
    toolDescCreateContact:
      'Guarda un contacto nuevo con nombre y numero de telefono, y opcionalmente una direccion de WhatsApp y un correo. Es seguro y reversible, asi que no pide confirmacion al usuario.',
    toolDescUpdateContact:
      'Cambia algunos datos de un contacto existente, indicado por nombre o por id. Solo se cambian los campos que se indican y el resto se deja igual, asi que es seguro llamarlo solo con lo que cambia. Un nombre ambiguo se rechaza listando los candidatos en lugar de adivinarse.',
    toolDescDeleteContact:
      'Elimina un contacto, indicado por nombre o por id. No se puede deshacer, asi que la app pide confirmacion al usuario y nombra antes el contacto y su numero. Espera el resultado en lugar de decir que ya no esta mientras el dialogo sigue abierto.',
    toolDescGetWalletSummary:
      'Lee el monedero: si existe, en que red esta y que saldos tiene. Solo lectura. No puede mover, enviar ni gastar nada, y el campo canSpend siempre es false, asi que si el usuario pide transferir o anadir fondos dile que eso hay que hacerlo a mano en el panel del monedero.',
  },
} as const;

export const commsAgentToolsFr = {
  comms: {
    recipientRequired: 'Dis qui contacter, soit un nom des contacts, soit un numéro de téléphone.',
    recipientLabel: '{name} au numéro se terminant par {tail}',
    contactNotFound:
      'Aucun contact appelé "{name}". Vérifie le nom, ou donne le numéro directement.',
    contactAmbiguous:
      'Plusieurs contacts correspondent à "{name}" : {list}. Demande lequel avant d envoyer quoi que ce soit.',
    contactHasNoNumber: 'Le contact {name} n a pas de numéro enregistré pour {channel}.',
    contactLookupFailed: 'Impossible de lire les contacts : {error}',
    noActiveKwami: 'Aucun Kwami n est sélectionné, donc il n y a rien depuis quoi envoyer.',

    channelsFound: '{count} canaux connectés trouvés.',
    noChannels: 'Ce Kwami n a encore aucun canal téléphone, SMS ou WhatsApp connecté.',
    channelsFailed: 'Impossible de lire les canaux : {error}',
    numbersFound: '{count} numéros disponibles trouvés.',
    noNumbersFound: 'Aucun numéro disponible ne correspond à cette recherche.',
    numberSearchFailed: 'Impossible de rechercher des numéros : {error}',

    bodyRequired: 'Dis ce que doit contenir le message.',
    confirmSmsTitle: 'Envoyer ce message texte',
    confirmWhatsappTitle: 'Envoyer ce message WhatsApp',
    confirmSendBody: 'À {recipient}. Message : {text}',
    confirmSend: 'Envoyer',
    confirmCancel: 'Annuler',
    sendCancelled: 'Non envoyé. Le message à {recipient} a été annulé.',
    sendAccepted: 'Le fournisseur a accepté le message à {recipient} pour livraison.',
    sendFailed: 'Le message à {recipient} n a pas été envoyé : {error}',
    errSend: 'Échec de l envoi',
    actionSentSms: 'Message texte envoyé',
    actionSentWhatsapp: 'Message WhatsApp envoyé',

    confirmCallTitle: 'Passer cet appel',
    confirmCallBody: 'Appel de {recipient}. Numéro complet : {number}',
    callCancelled: 'Pas appelé. L appel à {recipient} a été annulé.',
    callStarted: 'Composition du numéro de {recipient} en cours.',
    callFailed: 'L appel à {recipient} n a pas démarré : {error}',
    errCall: 'Échec de l appel',
    actionPlacedCall: 'Appel passé',

    contactsFound: '{count} contacts trouvés.',
    noContacts: 'Aucun contact enregistré pour l instant.',
    contactSingle: 'Une correspondance : {name}, au {phone}.',
    contactMultiple: '{count} contacts correspondent. Demande lequel est visé.',
    contactNameRequired: 'Un contact a besoin d un nom.',
    contactPhoneRequired: 'Un contact a besoin d un numéro de téléphone.',
    contactTargetRequired: 'Dis quel contact, par nom ou par identifiant.',
    contactNothingToChange: 'Rien n a été indiqué à changer sur ce contact.',
    contactCreated: '{name} a été enregistré dans les contacts.',
    contactUpdated: '{name} a été mis à jour.',
    contactDeleted: '{name} a été supprimé des contacts.',
    contactSaveFailed: 'Impossible d enregistrer le contact : {error}',
    confirmDeleteContactTitle: 'Supprimer ce contact',
    confirmDeleteContactBody: 'Ceci supprime {name} au {phone} et est irréversible.',
    deleteCancelled: 'Non supprimé. {name} est toujours dans les contacts.',
    actionCreatedContact: 'Contact enregistré',
    actionUpdatedContact: 'Contact mis à jour',
    actionDeletedContact: 'Contact supprimé',

    noWallet: 'Ce Kwami n a pas encore de portefeuille.',
    walletEmpty: 'Le portefeuille existe mais ne contient aucun solde.',
    walletSummary: 'Le portefeuille contient {list}.',
    walletFailed: 'Impossible de lire le portefeuille : {error}',

    toolDescListPhoneChannels:
      'Liste les canaux téléphone, SMS et WhatsApp connectés à ce Kwami, avec leurs numéros et leur état. Consulte-le avant d envoyer quoi que ce soit si on ne sait pas déjà qu un canal existe, car envoyer sans canal échoue.',
    toolDescSearchPhoneNumbers:
      'Recherche des numéros de téléphone disponibles à l achat, par indicatif de pays et éventuellement un indicatif régional ou des chiffres que le numéro doit contenir. Ceci ne fait que chercher et ne peut jamais acheter un numéro, car l approvisionnement dépense de l argent réel. Dis à l utilisateur qu il doit l acheter lui-même dans le panneau téléphone.',
    toolDescSendSms:
      'Envoie un message texte. Le destinataire peut être un nom de contact ou un numéro de téléphone, et un nom est recherché dans les contacts plutôt que deviné : si plusieurs contacts correspondent, l outil refuse et les liste, donc demande lequel est visé. L application demande confirmation à l utilisateur avant que quoi que ce soit parte, donc dis à qui cela va et relis le message d abord, puis attends le résultat et ne dis pas à l utilisateur que c est envoyé pendant que la boîte de dialogue est encore ouverte. Rapporte ce que renvoie l outil, pas ce que tu as demandé. Un message peut être rejeté par l opérateur et un numéro peut être injoignable ; le champ accepted dit si le fournisseur l a pris en charge pour livraison, ce qui n est pas la même chose que le destinataire l ayant lu. En cas d échec, dis-le franchement plutôt que de l adoucir, car l utilisateur agira en croyant que c est parti.',
    toolDescSendWhatsapp:
      'Envoie un message WhatsApp. Le destinataire peut être un nom de contact ou un numéro, et un nom est résolu contre les contacts plutôt que deviné : un nom ambigu est refusé avec la liste des candidats, donc demande lequel est visé. Il utilise l adresse WhatsApp enregistrée du contact quand il y en a une et son numéro de téléphone sinon. L application demande confirmation d abord, donc relis le message, puis attends le résultat plutôt que d annoncer un succès pendant que la boîte de dialogue est ouverte. Rapporte le champ accepted plutôt que de supposer que c est arrivé.',
    toolDescPlaceCall:
      'Passe un appel téléphonique à un contact ou à un numéro. Traite ceci comme plus lourd qu envoyer un message : un texte se lit plus tard, un appel sonne immédiatement chez une personne réelle et ne peut pas être rappelé. Dis toujours qui est appelé et à quel numéro avant d appeler cet outil, et quand le numéro vient des contacts plutôt que de l utilisateur, dis le nom et les derniers chiffres ensemble pour qu une erreur de contact puisse être rattrapée. L application demande confirmation, donc attends le résultat. Le champ dialling dit si l appel a réellement démarré ; rapporte cela plutôt que d annoncer une connexion, car savoir si quelqu un décroche est impossible ici.',
    toolDescListContacts:
      'Liste les contacts enregistrés, filtrés éventuellement par un mot de recherche. Lecture seule et sans risque à appeler dès qu un nom doit être vérifié.',
    toolDescFindContact:
      'Cherche un contact par son nom et relit son numéro. Utilise-le avant d envoyer ou d appeler quand l utilisateur a nommé une personne plutôt qu un numéro, pour que le numéro puisse être confirmé à voix haute. Il renvoie toutes les correspondances plutôt que d en choisir une, et le champ unique dit s il y en avait exactement une.',
    toolDescCreateContact:
      'Enregistre un nouveau contact avec un nom et un numéro de téléphone, et éventuellement une adresse WhatsApp et un courriel. Sans risque et réversible, donc il ne demande pas de confirmation.',
    toolDescUpdateContact:
      'Change certaines informations d un contact existant, désigné par nom ou identifiant. Seuls les champs donnés changent et le reste est laissé intact, donc il est sûr de l appeler avec la seule chose qui diffère. Un nom ambigu est refusé avec la liste des candidats plutôt que deviné.',
    toolDescDeleteContact:
      'Supprime un contact, désigné par nom ou identifiant. Irréversible, donc l application demande confirmation et nomme d abord le contact et son numéro. Attends le résultat plutôt que de le déclarer supprimé pendant que la boîte de dialogue est ouverte.',
    toolDescGetWalletSummary:
      'Lit le portefeuille : s il existe, sur quel réseau il est, et quels soldes il contient. Lecture seule. Il ne peut rien déplacer, envoyer ni dépenser, et le champ canSpend vaut toujours false, donc si l utilisateur demande un transfert ou un ajout de fonds, dis-lui que cela doit se faire à la main dans le panneau portefeuille.',
  },
} as const;

export const commsAgentToolsPt = {
  comms: {
    recipientRequired: 'Diz quem contactar, com um nome dos contactos ou um número de telefone.',
    recipientLabel: '{name} no número terminado em {tail}',
    contactNotFound:
      'Não há nenhum contacto chamado "{name}". Verifica o nome, ou dá o número diretamente.',
    contactAmbiguous:
      'Há mais do que um contacto que corresponde a "{name}": {list}. Pergunta qual antes de enviar seja o que for.',
    contactHasNoNumber: 'O contacto {name} não tem número guardado para {channel}.',
    contactLookupFailed: 'Não foi possível ler os contactos: {error}',
    noActiveKwami: 'Não há nenhum Kwami selecionado, por isso não há de onde enviar.',

    channelsFound: 'Encontrados {count} canais ligados.',
    noChannels: 'Este Kwami ainda não tem nenhum canal de telefone, SMS ou WhatsApp ligado.',
    channelsFailed: 'Não foi possível ler os canais: {error}',
    numbersFound: 'Encontrados {count} números disponíveis.',
    noNumbersFound: 'Nenhum número disponível corresponde a essa pesquisa.',
    numberSearchFailed: 'Não foi possível procurar números: {error}',

    bodyRequired: 'Diz o que a mensagem deve dizer.',
    confirmSmsTitle: 'Enviar esta mensagem de texto',
    confirmWhatsappTitle: 'Enviar esta mensagem de WhatsApp',
    confirmSendBody: 'Para {recipient}. Mensagem: {text}',
    confirmSend: 'Enviar',
    confirmCancel: 'Cancelar',
    sendCancelled: 'Não enviado. A mensagem para {recipient} foi cancelada.',
    sendAccepted: 'O fornecedor aceitou a mensagem para {recipient} para entrega.',
    sendFailed: 'A mensagem para {recipient} não foi enviada: {error}',
    errSend: 'Falha no envio',
    actionSentSms: 'Mensagem enviada',
    actionSentWhatsapp: 'WhatsApp enviado',

    confirmCallTitle: 'Fazer esta chamada',
    confirmCallBody: 'A ligar a {recipient}. Número completo: {number}',
    callCancelled: 'Não se ligou. A chamada para {recipient} foi cancelada.',
    callStarted: 'A marcar para {recipient} agora.',
    callFailed: 'A chamada para {recipient} não começou: {error}',
    errCall: 'Falha na chamada',
    actionPlacedCall: 'Chamada feita',

    contactsFound: 'Encontrados {count} contactos.',
    noContacts: 'Ainda não há contactos guardados.',
    contactSingle: 'Uma correspondência: {name}, em {phone}.',
    contactMultiple: 'Correspondem {count} contactos. Pergunta qual se pretende.',
    contactNameRequired: 'Um contacto precisa de um nome.',
    contactPhoneRequired: 'Um contacto precisa de um número de telefone.',
    contactTargetRequired: 'Diz qual contacto, por nome ou por identificador.',
    contactNothingToChange: 'Não foi indicado nada para mudar nesse contacto.',
    contactCreated: 'Guardado {name} nos contactos.',
    contactUpdated: 'Atualizado {name}.',
    contactDeleted: 'Eliminado {name} dos contactos.',
    contactSaveFailed: 'Não foi possível guardar o contacto: {error}',
    confirmDeleteContactTitle: 'Eliminar este contacto',
    confirmDeleteContactBody: 'Isto remove {name} em {phone} e não pode ser desfeito.',
    deleteCancelled: 'Não eliminado. {name} continua nos contactos.',
    actionCreatedContact: 'Contacto guardado',
    actionUpdatedContact: 'Contacto atualizado',
    actionDeletedContact: 'Contacto eliminado',

    noWallet: 'Este Kwami ainda não tem carteira.',
    walletEmpty: 'A carteira existe mas não tem saldo.',
    walletSummary: 'A carteira tem {list}.',
    walletFailed: 'Não foi possível ler a carteira: {error}',

    toolDescListPhoneChannels:
      'Lista os canais de telefone, SMS e WhatsApp que este Kwami tem ligados, com os seus números e estado. Consulta-o antes de enviar seja o que for se ainda não se souber se existe um canal, porque enviar sem um falha.',
    toolDescSearchPhoneNumbers:
      'Procura números de telefone disponíveis para comprar, por indicativo de país e opcionalmente um indicativo regional ou dígitos que o número deva conter. Isto só procura e nunca pode comprar um número, porque o aprovisionamento gasta dinheiro real. Diz ao utilizador que tem de o comprar ele próprio no painel de telefone.',
    toolDescSendSms:
      'Envia uma mensagem de texto. O destinatário pode ser um nome de contacto ou um número, e um nome é procurado nos contactos em vez de adivinhado: se corresponder mais do que um contacto, a ferramenta recusa e lista-os, por isso pergunta qual se pretende. A aplicação pede confirmação ao utilizador antes de sair seja o que for, por isso diz para quem vai e relê a mensagem primeiro, depois espera pelo resultado e não digas ao utilizador que está enviada enquanto a caixa de diálogo ainda está aberta. Relata o que a ferramenta devolve, não o que pediste. Uma mensagem pode ser rejeitada pela operadora e um número pode estar inacessível; o campo accepted diz se o fornecedor a aceitou para entrega, o que não é o mesmo que o destinatário a ter lido. Se falhou, di-lo claramente em vez de suavizar, porque o utilizador vai agir a acreditar que foi enviada.',
    toolDescSendWhatsapp:
      'Envia uma mensagem de WhatsApp. O destinatário pode ser um nome de contacto ou um número, e um nome é resolvido contra os contactos em vez de adivinhado: um nome ambíguo é recusado com os candidatos listados, por isso pergunta qual se pretende. Usa o endereço de WhatsApp guardado do contacto quando existe e o número de telefone caso contrário. A aplicação pede confirmação primeiro, por isso relê a mensagem e depois espera pelo resultado em vez de anunciar sucesso enquanto a caixa de diálogo está aberta. Relata o campo accepted em vez de assumir que chegou.',
    toolDescPlaceCall:
      'Faz uma chamada telefónica para um contacto ou um número. Trata isto como mais sério do que enviar uma mensagem: um texto lê-se depois, uma chamada toca imediatamente no telefone de uma pessoa real e não pode ser retirada. Diz sempre quem é chamado e para que número antes de chamar esta ferramenta, e quando o número vier dos contactos em vez de vir do utilizador, diz o nome e os últimos dígitos juntos para que uma correspondência errada possa ser apanhada. A aplicação pede confirmação, por isso espera pelo resultado. O campo dialling diz se a chamada começou mesmo; relata isso em vez de anunciar uma ligação, porque daqui não se pode saber se alguém atende.',
    toolDescListContacts:
      'Lista os contactos guardados, opcionalmente filtrados por uma palavra de pesquisa. Só de leitura e seguro de usar sempre que seja preciso verificar um nome.',
    toolDescFindContact:
      'Procura um contacto pelo nome e relê o seu número. Usa-o antes de enviar ou ligar quando o utilizador tiver nomeado uma pessoa em vez de um número, para que o número possa ser confirmado em voz alta. Devolve todas as correspondências em vez de escolher uma, e o campo unique diz se havia exatamente uma.',
    toolDescCreateContact:
      'Guarda um contacto novo com nome e número de telefone, e opcionalmente um endereço de WhatsApp e um email. É seguro e reversível, por isso não pede confirmação.',
    toolDescUpdateContact:
      'Muda alguns dados de um contacto existente, indicado por nome ou identificador. Só mudam os campos indicados e o resto fica igual, por isso é seguro chamá-lo só com o que é diferente. Um nome ambíguo é recusado com os candidatos listados em vez de adivinhado.',
    toolDescDeleteContact:
      'Elimina um contacto, indicado por nome ou identificador. Não pode ser desfeito, por isso a aplicação pede confirmação e nomeia primeiro o contacto e o seu número. Espera pelo resultado em vez de o dar como eliminado enquanto a caixa de diálogo está aberta.',
    toolDescGetWalletSummary:
      'Lê a carteira: se existe, em que rede está e que saldos tem. Só de leitura. Não pode mover, enviar nem gastar nada, e o campo canSpend é sempre false, por isso se o utilizador pedir para transferir ou adicionar fundos diz-lhe que isso tem de ser feito à mão no painel de carteira.',
  },
} as const;

export const commsAgentToolsIt = {
  comms: {
    recipientRequired: 'Di chi contattare, con un nome dai contatti o un numero di telefono.',
    recipientLabel: '{name} al numero che finisce con {tail}',
    contactNotFound:
      'Nessun contatto chiamato "{name}". Controlla il nome, o dai direttamente il numero.',
    contactAmbiguous:
      'Più di un contatto corrisponde a "{name}": {list}. Chiedi quale prima di inviare qualsiasi cosa.',
    contactHasNoNumber: 'Il contatto {name} non ha un numero salvato per {channel}.',
    contactLookupFailed: 'Non è stato possibile leggere i contatti: {error}',
    noActiveKwami: 'Non è selezionato nessun Kwami, quindi non c è da dove inviare.',

    channelsFound: 'Trovati {count} canali collegati.',
    noChannels: 'Questo Kwami non ha ancora nessun canale telefono, SMS o WhatsApp collegato.',
    channelsFailed: 'Non è stato possibile leggere i canali: {error}',
    numbersFound: 'Trovati {count} numeri disponibili.',
    noNumbersFound: 'Nessun numero disponibile corrisponde a questa ricerca.',
    numberSearchFailed: 'Non è stato possibile cercare numeri: {error}',

    bodyRequired: 'Di cosa deve contenere il messaggio.',
    confirmSmsTitle: 'Inviare questo messaggio di testo',
    confirmWhatsappTitle: 'Inviare questo messaggio WhatsApp',
    confirmSendBody: 'A {recipient}. Messaggio: {text}',
    confirmSend: 'Invia',
    confirmCancel: 'Annulla',
    sendCancelled: 'Non inviato. Il messaggio a {recipient} è stato annullato.',
    sendAccepted: 'Il fornitore ha accettato il messaggio a {recipient} per la consegna.',
    sendFailed: 'Il messaggio a {recipient} non è stato inviato: {error}',
    errSend: 'Invio fallito',
    actionSentSms: 'Messaggio inviato',
    actionSentWhatsapp: 'WhatsApp inviato',

    confirmCallTitle: 'Fare questa chiamata',
    confirmCallBody: 'Chiamata a {recipient}. Numero completo: {number}',
    callCancelled: 'Non chiamato. La chiamata a {recipient} è stata annullata.',
    callStarted: 'Sto componendo il numero di {recipient}.',
    callFailed: 'La chiamata a {recipient} non è partita: {error}',
    errCall: 'Chiamata fallita',
    actionPlacedCall: 'Chiamata effettuata',

    contactsFound: 'Trovati {count} contatti.',
    noContacts: 'Non ci sono ancora contatti salvati.',
    contactSingle: 'Una corrispondenza: {name}, al {phone}.',
    contactMultiple: 'Corrispondono {count} contatti. Chiedi quale si intende.',
    contactNameRequired: 'Un contatto ha bisogno di un nome.',
    contactPhoneRequired: 'Un contatto ha bisogno di un numero di telefono.',
    contactTargetRequired: 'Di quale contatto, per nome o per identificativo.',
    contactNothingToChange: 'Non è stato indicato nulla da cambiare su quel contatto.',
    contactCreated: 'Salvato {name} nei contatti.',
    contactUpdated: 'Aggiornato {name}.',
    contactDeleted: 'Eliminato {name} dai contatti.',
    contactSaveFailed: 'Non è stato possibile salvare il contatto: {error}',
    confirmDeleteContactTitle: 'Eliminare questo contatto',
    confirmDeleteContactBody: 'Questo rimuove {name} al {phone} e non si può annullare.',
    deleteCancelled: 'Non eliminato. {name} è ancora nei contatti.',
    actionCreatedContact: 'Contatto salvato',
    actionUpdatedContact: 'Contatto aggiornato',
    actionDeletedContact: 'Contatto eliminato',

    noWallet: 'Questo Kwami non ha ancora un portafoglio.',
    walletEmpty: 'Il portafoglio esiste ma non ha saldo.',
    walletSummary: 'Il portafoglio contiene {list}.',
    walletFailed: 'Non è stato possibile leggere il portafoglio: {error}',

    toolDescListPhoneChannels:
      'Elenca i canali telefono, SMS e WhatsApp collegati a questo Kwami, con i loro numeri e il loro stato. Consultalo prima di inviare qualsiasi cosa se non si sa già che esiste un canale, perché inviare senza uno fallisce.',
    toolDescSearchPhoneNumbers:
      'Cerca numeri di telefono disponibili all acquisto, per prefisso internazionale ed eventualmente un prefisso locale o cifre che il numero deve contenere. Questo cerca soltanto e non può mai comprare un numero, perché il provisioning spende denaro reale. Di all utente che deve comprarlo lui stesso nel pannello telefono.',
    toolDescSendSms:
      'Invia un messaggio di testo. Il destinatario può essere un nome di contatto o un numero di telefono, e un nome viene cercato nei contatti invece che indovinato: se corrisponde più di un contatto, lo strumento rifiuta e li elenca, quindi chiedi quale si intende. L applicazione chiede conferma all utente prima che parta qualsiasi cosa, quindi di a chi è diretto e rileggi prima il messaggio, poi aspetta il risultato e non dire all utente che è inviato mentre la finestra di dialogo è ancora aperta. Riferisci ciò che lo strumento restituisce, non ciò che hai chiesto. Un messaggio può essere rifiutato dall operatore e un numero può essere irraggiungibile; il campo accepted dice se il fornitore lo ha preso in carico per la consegna, che non è lo stesso che il destinatario lo abbia letto. Se è fallito, dillo chiaramente invece di addolcirlo, perché l utente agirà credendo che sia partito.',
    toolDescSendWhatsapp:
      'Invia un messaggio WhatsApp. Il destinatario può essere un nome di contatto o un numero, e un nome viene risolto sui contatti invece che indovinato: un nome ambiguo viene rifiutato elencando i candidati, quindi chiedi quale si intende. Usa l indirizzo WhatsApp salvato del contatto quando c è e il suo numero di telefono altrimenti. L applicazione chiede prima conferma, quindi rileggi il messaggio e poi aspetta il risultato invece di annunciare un successo mentre la finestra di dialogo è aperta. Riferisci il campo accepted invece di dare per scontato che sia arrivato.',
    toolDescPlaceCall:
      'Effettua una telefonata a un contatto o a un numero. Trattala come più impegnativa di un messaggio: un testo si legge dopo, una chiamata squilla subito sul telefono di una persona reale e non può essere richiamata. Di sempre chi viene chiamato e a quale numero prima di chiamare questo strumento, e quando il numero viene dai contatti invece che dall utente, di il nome e le ultime cifre insieme perché una corrispondenza sbagliata possa essere colta. L applicazione chiede conferma, quindi aspetta il risultato. Il campo dialling dice se la chiamata è davvero partita; riferisci quello invece di annunciare una connessione, perché da qui non si può sapere se qualcuno risponde.',
    toolDescListContacts:
      'Elenca i contatti salvati, eventualmente filtrati da una parola di ricerca. Sola lettura e sicuro da chiamare ogni volta che serve controllare un nome.',
    toolDescFindContact:
      'Cerca un contatto per nome e rilegge il suo numero. Usalo prima di inviare o chiamare quando l utente ha nominato una persona invece di un numero, così il numero può essere confermato ad alta voce. Restituisce tutte le corrispondenze invece di sceglierne una, e il campo unique dice se ce n era esattamente una.',
    toolDescCreateContact:
      'Salva un nuovo contatto con nome e numero di telefono, ed eventualmente un indirizzo WhatsApp e un email. Sicuro e reversibile, quindi non chiede conferma.',
    toolDescUpdateContact:
      'Cambia alcuni dati di un contatto esistente, indicato per nome o identificativo. Cambiano solo i campi indicati e il resto resta com era, quindi è sicuro chiamarlo con la sola cosa che cambia. Un nome ambiguo viene rifiutato elencando i candidati invece di essere indovinato.',
    toolDescDeleteContact:
      'Elimina un contatto, indicato per nome o identificativo. Non si può annullare, quindi l applicazione chiede conferma e nomina prima il contatto e il suo numero. Aspetta il risultato invece di darlo per eliminato mentre la finestra di dialogo è aperta.',
    toolDescGetWalletSummary:
      'Legge il portafoglio: se esiste, su quale rete è e quali saldi contiene. Sola lettura. Non può spostare, inviare né spendere nulla, e il campo canSpend è sempre false, quindi se l utente chiede di trasferire o aggiungere fondi digli che va fatto a mano nel pannello portafoglio.',
  },
} as const;
