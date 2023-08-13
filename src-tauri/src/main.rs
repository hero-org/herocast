// this hides the console for Windows release builds
#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use farcaster_rs::types::casts::published_cast::PublishedCast;
use farcaster_rs::{Account, Farcaster};
use serde_json::json;
use std::error::Error;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager; // used by .get_window
use tauri_plugin_aptabase::EventTracker;
use tauri_plugin_window_state;

#[derive(Clone, serde::Serialize)]
struct SingleInstancePayload {
  args: Vec<String>,
  cwd: String,
}

#[derive(serde::Serialize)]
struct CustomResponse {
  message: String,
}

// fn get_epoch_ms() -> u128 {
//   SystemTime::now()
//     .duration_since(UNIX_EPOCH)
//     .unwrap()
//     .as_millis()
// }

#[tauri::command]
async fn send_cast(private_key: String, message: String) -> Result<(), String> {
  println!("Posting message from rust: {}", message);
  let pk: &str = &private_key;
  println!("pk: {}", pk);
  let account: Account = Account::from_private_key(&private_key, None)
    .await
    .map_err(|err| {
      println!("error: {}", err);
      return "error";
    })?;
  println!("account: {}", 1);

  let farcaster: Farcaster = Farcaster::new("https://nemes.farcaster.xyz:2283", account)
    .await
    .map_err(|_| "")?;
  println!("farcaster: {}", 2);
  // Publish a cast.
  // 1st Param: Content
  // 2nd & 3rd Param: Parent Cast Hash & Parent User FID
  //
  let m = message;
  println!("message: {}", 3);
  let cast: PublishedCast = farcaster
    .publish_cast(&m, None, None)
    .await
    .map_err(|_| "")?;
  Ok(())
  // Ok(cast.hash)
}

fn main() {
  // let quit = CustomMenuItem::new("quit".to_string(), "Quit");
  // let hide = CustomMenuItem::new("hide".to_string(), "Hide");
  // let tray_menu = SystemTrayMenu::new()
  // .add_item(quit)
  // .add_native_item(SystemTrayMenuItem::Separator)
  // .add_item(hide);

  let client = sentry_tauri::sentry::init((
    "https://1f1c817c7a28926f06caede2527f99c4@o4505697045184512.ingest.sentry.io/4505697054097408",
    sentry_tauri::sentry::ClientOptions {
      release: sentry_tauri::sentry::release_name!(),
      ..Default::default()
    },
  ));

  let _guard = sentry_tauri::minidump::init(&client);

  // main window should be invisible to allow either the setup delay or the plugin to show the window
  tauri::Builder::default()
    // .system_tray(SystemTray::new().with_menu(tray_menu))
    // .on_system_tray_event(|app, event| match event {
    //   SystemTrayEvent::LeftClick { .. } => {
    //     let window = match app.get_window("main") {
    //       Some(window) => match window.is_visible().expect("winvis") {
    //         true => {
    //           // hide the window instead of closing due to processes not closing memory leak: https://github.com/tauri-apps/wry/issues/590
    //           window.hide().expect("winhide");
    //           // window.close().expect("winclose");
    //           return;
    //         }
    //         false => window,
    //       },
    //       None => return,
    //     };
    //     #[cfg(not(target_os = "macos"))]
    //     {
    //       window.show().unwrap();
    //     }
    //     window.set_focus().unwrap();
    //   }
    //   SystemTrayEvent::RightClick {
    //     position: _,
    //     size: _,
    //     ..
    //   } => {
    //     println!("system tray received a right click");
    //   }
    //   SystemTrayEvent::DoubleClick {
    //     position: _,
    //     size: _,
    //     ..
    //   } => {
    //     println!("system tray received a double click");
    //   }
    //   SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
    //     "quit" => {
    //       std::process::exit(0);
    //     }
    //     "hide" => {
    //       let window = app.get_window("main").unwrap();
    //       window.hide().unwrap();
    //     }
    //     _ => {}
    //   },
    //   _ => {}
    // })
    .invoke_handler(tauri::generate_handler![send_cast])
    .plugin(sentry_tauri::plugin())
    .plugin(tauri_plugin_window_state::Builder::default().build()) // Enable if you want to control the window state
    // .plugin(tauri_plugin_store::Builder::default().build())
    // .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(
      tauri_plugin_aptabase::Builder::new("A-EU-5263596644")
        .with_panic_hook(Box::new(|client, info| {
          client.track_event(
            "panic",
            Some(json!({
                "info": format!("{:?}", info),
            })),
          );
        }))
        .build(),
    )
    .setup(|app| {
      app.track_event("app_started", None);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
