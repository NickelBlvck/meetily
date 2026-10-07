// call_detection.rs
//
// Detects known voice/video call activity while Meetily is running:
//   - Zoom (Zoom.exe window present)
//   - Google Meet / Zoom meeting opened in a browser tab (window title match)
//   - Microsoft Teams call window ("| Microsoft Teams" title)
//   - Skype, Webex (process presence)
//
// When a call is detected, a `call-detected` event is emitted so the UI can
// offer to start recording. Windows-only: relies on Win32 window enumeration.

use log::{debug, info, warn};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};

const POLL_INTERVAL: Duration = Duration::from_secs(5);
/// Do not re-notify about the same call app for this long
const COOLDOWN: Duration = Duration::from_secs(15 * 60);

/// Browser process names (without .exe) whose window titles are scanned for
/// meeting tabs like "… - Google Meet".
const BROWSERS: &[&str] = &[
    "chrome",
    "msedge",
    "firefox",
    "brave",
    "opera",
    "yandex",
    "vivaldi",
    "chromium",
    "thorium",
    "duckduckgo",
];

static LAST_NOTIFIED: Lazy<Mutex<HashMap<String, Instant>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[cfg(target_os = "windows")]
mod win {
    use windows_sys::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    };

    pub struct WindowInfo {
        pub pid: u32,
        pub title: String,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let list = &mut *(lparam as *mut Vec<WindowInfo>);
        if IsWindowVisible(hwnd) != 0 {
            let mut buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            if len > 0 {
                let mut pid = 0u32;
                GetWindowThreadProcessId(hwnd, &mut pid);
                if pid != 0 {
                    list.push(WindowInfo {
                        pid,
                        title: String::from_utf16_lossy(&buf[..len as usize]),
                    });
                }
            }
        }
        1
    }

    pub fn visible_windows() -> Vec<WindowInfo> {
        let mut list: Vec<WindowInfo> = Vec::new();
        unsafe {
            EnumWindows(Some(enum_proc), &mut list as *mut _ as LPARAM);
        }
        list
    }

    /// Executable file name of the process owning the pid (e.g. "chrome.exe")
    pub fn process_image_name(pid: u32) -> Option<String> {
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() {
                return None;
            }
            let mut buf = [0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                buf.as_mut_ptr(),
                &mut len,
            );
            CloseHandle(handle);
            if ok != 0 {
                Some(String::from_utf16_lossy(&buf[..len as usize]))
            } else {
                None
            }
        }
    }
}

/// Returns the call app name if a known call is in progress, based on the
/// visible windows (process name, lowercased executable, window title).
fn detect_call(windows: &[(String, String, String)]) -> Option<&'static str> {
    for (proc_name, exe_name, title) in windows {
        let title_lc = title.to_lowercase();

        // Meeting pages open in any browser
        if BROWSERS.contains(&proc_name.as_str())
            && (title_lc.contains("google meet")
                || title_lc.contains("zoom meeting")
                || title_lc.contains("zoom webinar"))
        {
            if title_lc.contains("google meet") {
                return Some("Google Meet");
            }
            return Some("Zoom");
        }

        match proc_name.as_str() {
            // Zoom app itself (user asked to catch Zoom.exe launch)
            "zoom" => return Some("Zoom"),
            "skype" => return Some("Skype"),
            p if p.contains("webex") => return Some("Webex"),
            // Teams: only when a call window is open, not the idle main window
            "teams" | "ms-teams" if title_lc.contains("| microsoft teams") => {
                let _ = exe_name;
                return Some("Microsoft Teams");
            }
            _ => {}
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn collect_visible_windows() -> Vec<(String, String, String)> {
    let mut result = Vec::new();
    for window in win::visible_windows() {
        let Some(exe) = win::process_image_name(window.pid) else {
            continue;
        };
        let exe_lc = exe.to_lowercase();
        let proc_name = exe_lc
            .rsplit(['\\', '/'])
            .next()
            .unwrap_or(&exe_lc)
            .trim_end_matches(".exe")
            .to_string();
        result.push((proc_name, exe_lc, window.title));
    }
    result
}

#[cfg(not(target_os = "windows"))]
fn collect_visible_windows() -> Vec<(String, String, String)> {
    Vec::new()
}

fn poll_once<R: Runtime>(app: &AppHandle<R>) {
    let windows = collect_visible_windows();
    if windows.is_empty() {
        return;
    }

    let Some(app_name) = detect_call(&windows) else {
        return;
    };

    // Cooldown per app
    {
        let mut last = LAST_NOTIFIED.lock().unwrap();
        if let Some(prev) = last.get(app_name) {
            if prev.elapsed() < COOLDOWN {
                debug!("Call detection: '{}' within cooldown, skipping", app_name);
                return;
            }
        }
        last.insert(app_name.to_string(), Instant::now());
    }

    info!("📞 Call detected: {}", app_name);
    if let Err(e) = app.emit("call-detected", serde_json::json!({ "app": app_name })) {
        warn!("Failed to emit call-detected event: {}", e);
    }
}

/// Spawn the background polling thread (no-op on non-Windows platforms).
pub fn spawn<R: Runtime>(app: AppHandle<R>) {
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || loop {
            std::thread::sleep(POLL_INTERVAL);
            poll_once(&app);
        });
        info!("Call detection thread started (polling every {}s)", POLL_INTERVAL.as_secs());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
    }
}
