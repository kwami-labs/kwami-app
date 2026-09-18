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
    recipientRequired: 'Di a quien contactar, con un nombre de los contactos o un numero de telefono.',
    recipientLabel: '{name} en el numero terminado en {tail}',
    contactNotFound: 'No hay ningun contacto llamado "{name}". Revisa el nombre o da el numero directamente.',
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
