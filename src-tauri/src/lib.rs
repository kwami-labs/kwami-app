use tauri::webview::{PageLoadEvent, WebviewBuilder};
use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, Url, Webview, WebviewUrl};

mod hud_web {
  //! Pages shown inside Jarvis's own window: the HUD's web view.
  //!
  //! An `<iframe>` cannot show most sites (they forbid being framed), so the desktop
  //! app opens each one as a native child webview laid over the HUD window that holds
  //! it. Only the app's own page may drive them (`only_main`), only http(s) pages load
  //! in them, and they are separate webviews: the pages get no access to the app.
  use super::*;

  const PREFIX: &str = "hud-web-";
  /// The event the app listens to, to keep each window's address bar honest.
  pub const EVENT: &str = "hud-web";

  pub fn only_main(caller: &Webview) -> Result<(), String> {
    if caller.label() == "main" {
      Ok(())
    } else {
      Err("only the app may open pages in its HUD".into())
    }
  }

  pub fn label(raw: &str) -> Result<String, String> {
    let ok = !raw.is_empty()
      && raw.len() <= 48
      && raw.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    if ok {
      Ok(format!("{PREFIX}{raw}"))
    } else {
      Err("bad HUD web view name".into())
    }
  }

  pub fn web_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|e| e.to_string())?;
    match url.scheme() {
      "http" | "https" => Ok(url),
      _ => Err("the HUD only opens http and https pages".into()),
    }
  }

  pub fn find(app: &tauri::AppHandle, raw: &str) -> Result<Webview, String> {
    app
      .get_webview(&label(raw)?)
      .ok_or_else(|| "that page is no longer open".into())
  }

  pub fn place(webview: &Webview, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    webview
      .set_position(LogicalPosition::new(x, y))
      .map_err(|e| e.to_string())?;
    webview
      .set_size(LogicalSize::new(width.max(1.0), height.max(1.0)))
      .map_err(|e| e.to_string())
  }
}

#[derive(Clone, serde::Serialize)]
struct HudWebEvent {
  label: String,
  url: String,
  loading: bool,
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn hud_web_open(
  app: tauri::AppHandle,
  webview: Webview,
  label: String,
  url: String,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) -> Result<(), String> {
  hud_web::only_main(&webview)?;
  let name = hud_web::label(&label)?;
  let url = hud_web::web_url(&url)?;
  if let Some(existing) = app.get_webview(&name) {
    existing.navigate(url).map_err(|e| e.to_string())?;
    hud_web::place(&existing, x, y, width, height)?;
    return existing.show().map_err(|e| e.to_string());
  }
  let emitter = app.clone();
  let short = label.clone();
  let builder = WebviewBuilder::new(&name, WebviewUrl::External(url))
    // Links to other schemes (the app's own kwami://, file:, javascript:) go nowhere.
    .on_navigation(|url| matches!(url.scheme(), "http" | "https"))
    .on_page_load(move |_webview, payload| {
      let _ = emitter.emit_to(
        "main",
        hud_web::EVENT,
        HudWebEvent {
          label: short.clone(),
          url: payload.url().to_string(),
          loading: matches!(payload.event(), PageLoadEvent::Started),
        },
      );
    });
  webview
    .window()
    .add_child(
      builder,
      LogicalPosition::new(x, y),
      LogicalSize::new(width.max(1.0), height.max(1.0)),
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

/// Place a view and show it, or hide it, in one call: the app moves views on every
/// frame of a drag, and two round trips per frame were half of that cost.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn hud_web_bounds(
  app: tauri::AppHandle,
  webview: Webview,
  label: String,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
  visible: Option<bool>,
) -> Result<(), String> {
  hud_web::only_main(&webview)?;
  let page = hud_web::find(&app, &label)?;
  if visible == Some(false) {
    return page.hide().map_err(|e| e.to_string());
  }
  hud_web::place(&page, x, y, width, height)?;
  page.show().map_err(|e| e.to_string())
}

#[tauri::command]
fn hud_web_navigate(
  app: tauri::AppHandle,
  webview: Webview,
  label: String,
  url: String,
) -> Result<(), String> {
  hud_web::only_main(&webview)?;
  let url = hud_web::web_url(&url)?;
  hud_web::find(&app, &label)?
    .navigate(url)
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn hud_web_history(
  app: tauri::AppHandle,
  webview: Webview,
  label: String,
  step: String,
) -> Result<(), String> {
  hud_web::only_main(&webview)?;
  let script = match step.as_str() {
    "back" => "history.back()",
    "forward" => "history.forward()",
    "reload" => "location.reload()",
    _ => return Err("unknown step".into()),
  };
  hud_web::find(&app, &label)?
    .eval(script)
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn hud_web_zoom(
  app: tauri::AppHandle,
  webview: Webview,
  label: String,
  factor: f64,
) -> Result<(), String> {
  hud_web::only_main(&webview)?;
  hud_web::find(&app, &label)?
    .set_zoom(factor.clamp(0.25, 4.0))
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn hud_web_close(app: tauri::AppHandle, webview: Webview, label: String) -> Result<(), String> {
  hud_web::only_main(&webview)?;
  match app.get_webview(&hud_web::label(&label)?) {
    Some(page) => page.close().map_err(|e| e.to_string()),
    None => Ok(()),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Must be the first plugin: an OAuth return opens `kwami://auth/callback`, which Windows
    // and Linux hand to a fresh process. With the deep-link feature that process forwards the
    // URL to the running window (the one holding the PKCE verifier) and exits.
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      // `get_window`, not `get_webview_window`: once the HUD lays a page over the app,
      // the main window holds more than one webview and is no longer a "webview window".
      if let Some(window) = app.get_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }))
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      hud_web_open,
      hud_web_bounds,
      hud_web_navigate,
      hud_web_history,
      hud_web_zoom,
      hud_web_close
    ])
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
