// this hides the console for Windows release builds
#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use serde_json::json;
use std::error::Error;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager; // used by .get_window
use tauri_plugin_aptabase::EventTracker;
// use tauri_plugin_window_state;

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
  Ok(())
}

fn main() {
  let client = sentry_tauri::sentry::init((
    "https://1f1c817c7a28926f06caede2527f99c4@o4505697045184512.ingest.sentry.io/4505697054097408",
    sentry_tauri::sentry::ClientOptions {
      release: sentry_tauri::sentry::release_name!(),
      ..Default::default()
    },
  ));

  // let _guard = sentry_tauri::minidump::init(&client);

  // main window should be invisible to allow either the setup delay or the plugin to show the window
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![send_cast])
    .plugin(sentry_tauri::plugin())
    // .plugin(tauri_plugin_window_state::Builder::default().build()) // Enable if you want to control the window state
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
