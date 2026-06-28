# DarkText

An offline word processor for authors. Your work lives in a normal folder on your disk.

**[Download latest release](https://github.com/kylelekyle/DarkText/releases/latest)** — grab `darktext.exe`, run it. No account, no cloud.

---

## Why I made it

My philosophy when it comes to writing is that it should be available, for free, to everyone. One of the best things we can do as humans is tell stories and write them to a page. Every time I went looking for something to write in however, there was always a catch: Trial mode until you pay, always online, sync I didn't ask for, or a subscription hiding behind "free", terrible dark modes, you name it I found issues with all of them

So, I made DarkText.

---

## What it is

DarkText is a truly offline, portable `.exe`. It doesn't phone home. It doesn't need an account, or a server. No AI bolted onto every word you write. No hidden cost. No cloud.

Most of all, it has a genuinely good dark mode.

Your book is a normal folder on your disk (JSON + HTML). The app reads from and writes to that folder through Rust, and Rust checks paths before it touches anything. You chose the library folder. You own the files.

Run the exe. Create a library folder. Write. Copy both somewhere else if you want to move machines. That is the whole setup.

**What you get today (v0.1):**

- Rich-text editor (headings, tables, images, scene/page breaks)
- Chapters, research notes, and character sheets
- Comments and track changes
- Cross-chapter search
- Export HTML, Markdown, plain text, DOCX
- Compile, snapshots, mind-map, focus mode, custom fonts

**Requirements:** Windows 10/11 (64-bit), [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (on most PCs already).

**First run:** Launch DarkText → **Create Library** → pick an empty folder → start writing. Chapters auto-save into that folder.

---

## What it isn't

- **Not a cloud app.** No sync, no login, no "all your manuscripts are belong to us."
- **Not AI writing software.** No generated prose, no chat panel, no "improve this paragraph" button.
- **Not Scrivener, Word, or Google Docs.** It is smaller and younger. Some export and polish features are still catching up. (Here be dragons.)
- **Not spyware.** I am not selling your words or harvesting usage data. See [SECURITY.md](SECURITY.md) if you want the technical version.
- **Not zero footprint.** The portable exe is the app; Windows may keep WebView settings under `%LOCALAPPDATA%\com.darktext.app`. Your **library** is separate and fully portable. The exe does not litter random folders across your PC like some installers do.

---

## Roadmap

Honest list. No dates. Shipped when it is good enough to use.

| Planned                     | Notes                                                                        |
| --------------------------- | ---------------------------------------------------------------------------- |
| **Split view**              | Two chapters side by side (Scrivener-style), both editable. Target for v0.2. |
| **Stronger DOCX export**    | Tables, fonts, fewer surprises                                               |
| **Writing workflow polish** | Search, compile, review on big manuscripts                                   |
| **Bug fixes from real use** | The stuff you only find when you live in the app                             |

Not planned: subscriptions, accounts, cloud sync, AI features, telemetry.

---

## Build from source

```bash
npm install
npm run tauri dev
npm run tauri build
```

Stack: Tauri 2, Rust, SvelteKit, TipTap. MIT license — see [LICENSE](LICENSE).

Security: [SECURITY.md](SECURITY.md)