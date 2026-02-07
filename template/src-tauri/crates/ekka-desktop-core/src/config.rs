//! Compile-time app configuration
//!
//! All values are baked at build time from app.config.json.
//! Mirrors Bridge config.rs for the subset needed by Desktop Core.

#![allow(dead_code)]

macro_rules! baked_config {
    ($name:ident, $env:literal) => {
        pub fn $name() -> &'static str {
            option_env!($env).expect(concat!(
                $env,
                " not baked at build time. Check build.rs and app.config.json"
            ))
        }
    };
}

// App display name (e.g., "EKKA Desktop")
baked_config!(app_name, "EKKA_APP_NAME");

// App slug for machine use (e.g., "ekka-desktop")
baked_config!(app_slug, "EKKA_APP_SLUG");

// Home folder name (e.g., ".ekka-desktop")
baked_config!(home_folder, "EKKA_HOME_FOLDER");

// Keychain service identifier (e.g., "ai.ekka.desktop")
baked_config!(keychain_service, "EKKA_KEYCHAIN_SERVICE");

// EKKA Engine URL (e.g., "https://api.ekka.ai")
baked_config!(engine_url, "EKKA_ENGINE_URL");
