use std::fs;

fn main() {
    // Read app.config.json (same source as Bridge build.rs)
    // Walk up to find app.config.json from crates/ekka-desktop-core/
    let config_path = "../../../app.config.json";
    println!("cargo:rerun-if-changed={}", config_path);

    let config_str = fs::read_to_string(config_path).unwrap_or_else(|_| {
        panic!(
            "\n\nBUILD ERROR: app.config.json not found at {}\n\
             Desktop Core must be built from within the ekka-desktop-app tree.\n\n",
            config_path
        )
    });

    let config: serde_json::Value = serde_json::from_str(&config_str).unwrap_or_else(|e| {
        panic!("\n\nBUILD ERROR: Invalid app.config.json: {}\n\n", e)
    });

    let app = config.get("app").expect("app.config.json missing 'app' section");
    let storage = config.get("storage").expect("app.config.json missing 'storage' section");
    let engine = config.get("engine").expect("app.config.json missing 'engine' section");

    let app_name = app.get("name").and_then(|v| v.as_str())
        .expect("app.config.json: app.name is required");
    let app_slug = app.get("slug").and_then(|v| v.as_str())
        .expect("app.config.json: app.slug is required");
    let home_folder = storage.get("homeFolderName").and_then(|v| v.as_str())
        .expect("app.config.json: storage.homeFolderName is required");
    let keychain_service = storage.get("keychainService").and_then(|v| v.as_str())
        .expect("app.config.json: storage.keychainService is required");
    let engine_url = engine.get("url").and_then(|v| v.as_str())
        .expect("app.config.json: engine.url is required");

    // Bake identical values as Bridge build.rs
    println!("cargo:rustc-env=EKKA_APP_NAME={}", app_name);
    println!("cargo:rustc-env=EKKA_APP_SLUG={}", app_slug);
    println!("cargo:rustc-env=EKKA_HOME_FOLDER={}", home_folder);
    println!("cargo:rustc-env=EKKA_KEYCHAIN_SERVICE={}", keychain_service);
    println!("cargo:rustc-env=EKKA_ENGINE_URL={}", engine_url);
}
