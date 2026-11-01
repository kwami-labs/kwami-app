use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Must be the first plugin: an OAuth return opens `kwami://auth/callback`, which Windows
    // and Linux hand to a fresh process. With the deep-link feature that process forwards the
    // URL to the running window (the one holding the PKCE verifier) and exits.
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }))
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // Installers register the `kwami` scheme; `tauri dev` runs an unregistered binary, so
      // point the scheme at it here or the OAuth return never reaches the app.
      #[cfg(all(debug_assertions, any(windows, target_os = "linux")))]
      {
        use tauri_plugin_deep_link::DeepLinkExt;
        app.deep_link().register_all()?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
