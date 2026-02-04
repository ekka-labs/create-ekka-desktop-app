fn main() {
    // Rerun if env files change (check both src-tauri and project root)
    println!("cargo:rerun-if-changed=.env");
    println!("cargo:rerun-if-changed=.env.local");
    println!("cargo:rerun-if-changed=../.env");
    println!("cargo:rerun-if-changed=../.env.local");

    // Load env files: try src-tauri first, then project root
    // .env.local takes precedence over .env
    let _ = dotenvy::from_filename(".env.local");
    let _ = dotenvy::from_filename(".env");
    let _ = dotenvy::from_filename("../.env.local");
    let _ = dotenvy::from_filename("../.env");

    // EKKA_ENGINE_URL is required at build time
    let engine_url = std::env::var("EKKA_ENGINE_URL").unwrap_or_else(|_| {
        panic!(
            "\n\n\
            ╔══════════════════════════════════════════════════════════════════╗\n\
            ║  BUILD ERROR: EKKA_ENGINE_URL is not set                         ║\n\
            ╠══════════════════════════════════════════════════════════════════╣\n\
            ║  Add EKKA_ENGINE_URL to .env.local or .env before building:      ║\n\
            ║                                                                  ║\n\
            ║    echo 'EKKA_ENGINE_URL=https://api.ekka.ai' >> .env.local      ║\n\
            ║                                                                  ║\n\
            ╚══════════════════════════════════════════════════════════════════╝\n\n"
        )
    });

    if engine_url.trim().is_empty() {
        panic!(
            "\n\n\
            ╔══════════════════════════════════════════════════════════════════╗\n\
            ║  BUILD ERROR: EKKA_ENGINE_URL is empty                           ║\n\
            ╠══════════════════════════════════════════════════════════════════╣\n\
            ║  Set a valid URL in .env.local or .env:                          ║\n\
            ║                                                                  ║\n\
            ║    EKKA_ENGINE_URL=https://api.ekka.ai                           ║\n\
            ║                                                                  ║\n\
            ╚══════════════════════════════════════════════════════════════════╝\n\n"
        )
    }

    // Bake EKKA_ENGINE_URL into the binary at compile time
    println!("cargo:rustc-env=EKKA_ENGINE_URL={}", engine_url);

    // Continue with tauri build
    tauri_build::build()
}
