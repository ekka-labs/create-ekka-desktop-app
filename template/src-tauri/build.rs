use std::fs;

fn main() {
    // Rerun if config changes
    println!("cargo:rerun-if-changed=../app.config.json");

    // 1. Read app.config.json
    let config_path = "../app.config.json";
    let config_str = fs::read_to_string(config_path).unwrap_or_else(|_| {
        panic!(
            "\n\n\
            ╔══════════════════════════════════════════════════════════════════╗\n\
            ║  BUILD ERROR: app.config.json not found                          ║\n\
            ╠══════════════════════════════════════════════════════════════════╣\n\
            ║  This file is required and should have been created by CDA.      ║\n\
            ║  Regenerate your app with:                                       ║\n\
            ║                                                                  ║\n\
            ║    npx create-ekka-desktop-app@latest my-app                     ║\n\
            ║                                                                  ║\n\
            ╚══════════════════════════════════════════════════════════════════╝\n\n"
        )
    });

    let config: serde_json::Value = serde_json::from_str(&config_str).unwrap_or_else(|e| {
        panic!("\n\nBUILD ERROR: Invalid app.config.json: {}\n\n", e)
    });

    // 2. Extract and validate required fields
    let app = config.get("app").expect("app.config.json missing 'app' section");
    let storage = config.get("storage").expect("app.config.json missing 'storage' section");
    let engine = config.get("engine").expect("app.config.json missing 'engine' section");

    let app_name = app.get("name").and_then(|v| v.as_str())
        .expect("app.config.json: app.name is required");
    let app_slug = app.get("slug").and_then(|v| v.as_str())
        .expect("app.config.json: app.slug is required");
    let app_identifier = app.get("identifier").and_then(|v| v.as_str())
        .expect("app.config.json: app.identifier is required");

    let home_folder = storage.get("homeFolderName").and_then(|v| v.as_str())
        .expect("app.config.json: storage.homeFolderName is required");
    let keychain_service = storage.get("keychainService").and_then(|v| v.as_str())
        .expect("app.config.json: storage.keychainService is required");

    let engine_url = engine.get("url").and_then(|v| v.as_str())
        .expect("app.config.json: engine.url is required");

    // 3. Validate non-empty
    if app_slug.is_empty() {
        panic!("\n\nBUILD ERROR: app.slug cannot be empty in app.config.json\n\n");
    }
    if home_folder.is_empty() {
        panic!("\n\nBUILD ERROR: storage.homeFolderName cannot be empty in app.config.json\n\n");
    }
    if engine_url.is_empty() {
        panic!(
            "\n\n\
            ╔══════════════════════════════════════════════════════════════════╗\n\
            ║  BUILD ERROR: engine.url is empty in app.config.json             ║\n\
            ╠══════════════════════════════════════════════════════════════════╣\n\
            ║  Set your EKKA Engine URL in app.config.json:                    ║\n\
            ║                                                                  ║\n\
            ║    \"engine\": {{                                                  ║\n\
            ║      \"url\": \"https://api.ekka.ai\"                               ║\n\
            ║    }}                                                             ║\n\
            ║                                                                  ║\n\
            ╚══════════════════════════════════════════════════════════════════╝\n\n"
        );
    }

    // 4. Bake values into binary at compile time
    println!("cargo:rustc-env=EKKA_APP_NAME={}", app_name);
    println!("cargo:rustc-env=EKKA_APP_SLUG={}", app_slug);
    println!("cargo:rustc-env=EKKA_APP_IDENTIFIER={}", app_identifier);
    println!("cargo:rustc-env=EKKA_HOME_FOLDER={}", home_folder);
    println!("cargo:rustc-env=EKKA_KEYCHAIN_SERVICE={}", keychain_service);
    println!("cargo:rustc-env=EKKA_ENGINE_URL={}", engine_url);

    // Continue with tauri build
    tauri_build::build()
}
