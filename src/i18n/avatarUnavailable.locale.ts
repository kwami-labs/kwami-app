/**
 * The notice shown in place of the avatar when it could not start.
 *
 * Braces are placeholders and a bare pipe silently keeps one branch, so
 * neither may appear as prose here.
 */
export const avatarUnavailableEn = {
  avatarUnavailable: {
    title: 'The 3D avatar cannot start',
    webglBody:
      'This browser is not giving the page WebGL, which the avatar needs to draw. Everything else still works.',
    webglHint:
      'In Chrome, open Settings, then System, turn on "Use graphics acceleration when available" and relaunch.',
    errorBody: 'Something went wrong while starting the avatar. Reload the page to try again.',
  },
};

export const avatarUnavailableEs: typeof avatarUnavailableEn = {
  avatarUnavailable: {
    title: 'El avatar 3D no puede arrancar',
    webglBody:
      'Este navegador no le da WebGL a la pagina, y el avatar lo necesita para dibujarse. Todo lo demas sigue funcionando.',
    webglHint:
      'En Chrome, abre Configuracion, luego Sistema, activa "Usar aceleracion de graficos cuando este disponible" y reinicia.',
    errorBody: 'Algo fallo al arrancar el avatar. Recarga la pagina para intentarlo de nuevo.',
  },
};
