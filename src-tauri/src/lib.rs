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

mod downloads {
  //! Where a file downloaded in the app goes (2026-11-21).
  //!
  //! WebView2 put every download in the user's Downloads, with no word in the app: a
  //! recording, a document of Jarvis's and an exported theme all landed side by side. Now
  //! each goes to the Windows folder of its kind, in a `KWAMI` folder of its own: videos to
  //! Videos, pictures to Pictures, sound to Music, documents to Documents, anything else to
  //! Downloads. A name already there gets " (2)", " (3)"..., never an overwrite. When it
  //! finishes, the app hears where it went (`EVENT`), and only a file saved here can be
  //! shown in its folder (`reveal_download`).
  use std::collections::HashSet;
  use std::path::{Path, PathBuf};
  use std::sync::Mutex;

  use tauri::webview::DownloadEvent;
  use tauri::{AppHandle, Emitter, Manager, Runtime, Webview};

  pub const EVENT: &str = "kwami-download";
  pub const FOLDER: &str = "KWAMI";

  #[derive(Clone, Copy, Debug, PartialEq, Eq)]
  pub enum Kind {
    Video,
    Image,
    Audio,
    Document,
    Other,
  }

  pub fn kind_of(name: &str) -> Kind {
    let extension = Path::new(name)
      .extension()
      .and_then(|e| e.to_str())
      .unwrap_or("")
      .to_ascii_lowercase();
    match extension.as_str() {
      "webm" | "mp4" | "mov" | "mkv" | "avi" | "m4v" => Kind::Video,
      "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg" | "bmp" | "avif" | "ico" => Kind::Image,
      "mp3" | "wav" | "ogg" | "m4a" | "flac" | "opus" | "aac" => Kind::Audio,
      "md" | "html" | "htm" | "pdf" | "txt" | "doc" | "docx" | "odt" | "rtf" | "csv"
      | "xlsx" | "xls" | "pptx" | "ppt" | "epub" => Kind::Document,
      _ => Kind::Other,
    }
  }

  fn base_dir<R: Runtime>(app: &AppHandle<R>, kind: Kind) -> Option<PathBuf> {
    let path = app.path();
    let dir = match kind {
      Kind::Video => path.video_dir(),
      Kind::Image => path.picture_dir(),
      Kind::Audio => path.audio_dir(),
      Kind::Document => path.document_dir(),
      Kind::Other => path.download_dir(),
    };
    dir.ok().map(|d| d.join(FOLDER))
  }

  /// `path`, or `name (2).ext`, `name (3).ext`... beside it when that one is taken.
  pub fn unique(path: PathBuf) -> PathBuf {
    if !path.exists() {
      return path;
    }
    let parent = path.parent().map(Path::to_path_buf).unwrap_or_default();
    let stem = path
      .file_stem()
      .and_then(|s| s.to_str())
      .unwrap_or("descarga")
      .to_string();
    let extension = path
      .extension()
      .and_then(|e| e.to_str())
      .map(|e| format!(".{e}"))
      .unwrap_or_default();
    for n in 2..1000 {
      let candidate = parent.join(format!("{stem} ({n}){extension}"));
      if !candidate.exists() {
        return candidate;
      }
    }
    path
  }

  /// The files saved here: the only ones the app may show in their folder.
  #[derive(Default)]
  pub struct Saved(pub Mutex<HashSet<PathBuf>>);

  /// Whether `path` is inside Jarvis's downloads folder under `documents`, with no `..`
  /// that would lead out of it.
  pub fn in_jarvis_folder(documents: &Path, path: &Path) -> bool {
    let folder = documents.join("Jarvis").join("descargas");
    path.starts_with(&folder)
      && path != folder
      && !path
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
  }

  #[derive(Clone, serde::Serialize)]
  struct Finished {
    name: String,
    path: String,
    folder: String,
    success: bool,
  }

  pub fn handle<R: Runtime>(webview: Webview<R>, event: DownloadEvent<'_>) -> bool {
    match event {
      DownloadEvent::Requested { destination, .. } => {
        let name = destination
          .file_name()
          .and_then(|n| n.to_str())
          .unwrap_or("descarga")
          .to_string();
        if let Some(dir) = base_dir(webview.app_handle(), kind_of(&name)) {
          if std::fs::create_dir_all(&dir).is_ok() {
            *destination = unique(dir.join(&name));
          }
        }
        true
      }
      DownloadEvent::Finished { path, success, .. } => {
        if let Some(path) = path {
          if success {
            if let Ok(mut saved) = webview.state::<Saved>().0.lock() {
              saved.insert(path.clone());
            }
          }
          let _ = webview.app_handle().emit_to(
            "main",
            EVENT,
            Finished {
              name: path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string(),
              folder: path
                .parent()
                .map(|p| p.display().to_string())
                .unwrap_or_default(),
              path: path.display().to_string(),
              success,
            },
          );
        }
        true
      }
      _ => true,
    }
  }

  #[cfg(test)]
  mod tests {
    use super::*;

    #[test]
    fn each_kind_of_file_has_its_folder() {
      assert_eq!(kind_of("grabacion.webm"), Kind::Video);
      assert_eq!(kind_of("FOTO.PNG"), Kind::Image);
      assert_eq!(kind_of("voz.mp3"), Kind::Audio);
      assert_eq!(kind_of("informe.md"), Kind::Document);
      assert_eq!(kind_of("kwami-theme.json"), Kind::Other);
      assert_eq!(kind_of("sin-extension"), Kind::Other);
    }

    #[test]
    fn only_jarvis_downloads_folder_is_his() {
      let documents = Path::new("C:\\Users\\u\\Documents");
      let folder = documents.join("Jarvis").join("descargas");
      assert!(in_jarvis_folder(documents, &folder.join("factura.pdf")));
      assert!(!in_jarvis_folder(documents, &folder), "the folder itself");
      assert!(!in_jarvis_folder(documents, &folder.join("..").join("..").join("x.txt")));
      assert!(!in_jarvis_folder(documents, &documents.join("Jarvis").join("nube").join("a")));
      assert!(!in_jarvis_folder(documents, Path::new("C:\\Windows\\win.ini")));
    }

    #[test]
    fn a_name_already_there_gets_a_number() {
      let dir = std::env::temp_dir().join(format!("kwami-downloads-{}", std::process::id()));
      std::fs::create_dir_all(&dir).unwrap();
      let first = dir.join("a.txt");
      assert_eq!(unique(first.clone()), first);
      std::fs::write(&first, "1").unwrap();
      std::fs::write(dir.join("a (2).txt"), "2").unwrap();
      assert_eq!(unique(first.clone()), dir.join("a (3).txt"));
      let bare = dir.join("notas");
      std::fs::write(&bare, "1").unwrap();
      assert_eq!(unique(bare), dir.join("notas (2)"));
      std::fs::remove_dir_all(&dir).unwrap();
    }
  }
}

/// Show a downloaded file in its folder: one the app saved, or one Jarvis's browser saved in
/// his folder (`Documents\Jarvis\descargas`, the agent's `browser.downloads`). Nothing else:
/// the page cannot point it anywhere else on the disk.
#[tauri::command]
fn reveal_download(app: tauri::AppHandle, path: String) -> Result<(), String> {
  let path = std::path::PathBuf::from(path);
  let saved = app
    .state::<downloads::Saved>()
    .0
    .lock()
    .map(|saved| saved.contains(&path))
    .unwrap_or(false);
  let jarvis = app
    .path()
    .document_dir()
    .map(|documents| downloads::in_jarvis_folder(&documents, &path))
    .unwrap_or(false);
  if !(saved || jarvis) || !path.exists() {
    return Err("not a file the app downloaded".into());
  }
  tauri_plugin_opener::reveal_item_in_dir(&path).map_err(|e| e.to_string())
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
    // A file a page in the HUD downloads goes where the app's own do.
    .on_download(downloads::handle)
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
    .manage(downloads::Saved::default())
    .invoke_handler(tauri::generate_handler![
      hud_web_open,
      hud_web_bounds,
      hud_web_navigate,
      hud_web_history,
      hud_web_zoom,
      hud_web_close,
      reveal_download
    ])
    .setup(|app| {
      // The main window is made here, not by the config (`"create": false`), because only a
      // window built in code can say where its downloads go.
      let main = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or("no window in the configuration")?;
      tauri::WebviewWindowBuilder::from_config(app.handle(), &main)?
        .on_download(downloads::handle)
        .build()?;
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
