# Keyboard shortcuts

Shortcuts are ignored when the event target is editable (`isEditableTarget`) or when a modifier chord is held (`isBareShortcut`), except the Alt+size presets.

## Global (App.vue)

| Key | Action |
| --- | --- |
| `B` | Switch to `blob-xyz` |
| `H` | Switch to `black-hole` |
| `R` | Randomize avatar panel |
| `L` | Force `listening` |
| `T` | Force `thinking` |
| `I` | Force `idle` |
| `Alt+1` | Panel width preset **small** (default 320px) |
| `Alt+2` | **medium** (680px) |
| `Alt+3` | **large** (1300px) |

`P` is **not** handled here. It lives in `usePanelShortcuts` so it does not toggle twice.

## Panels (`usePanelShortcuts`)

`P` toggles the sidebar panel.

Digit keys pick a panel by **current sidebar mode**.

### Settings mode

| Key | Panel |
| --- | --- |
| `1` | Avatar |
| `2` | Scene |
| `3` | Audio |
| `4` | Voice |
| `5` | Enhancements |
| `6` | Metrics |
| `7` | Soul |
| `8` | Memory |
| `9` | Tools |
| `0` | Memory (same as 8; historical) |
| `-` | Tools |
| `=` | Info |

Account / Theme / Models / Energy are opened from the nav, not digits.

### Apps mode

| Key | Panel |
| --- | --- |
| `1` | Contacts |
| `2` | Email |
| `3` | Phone |
| `4` | WhatsApp |
| `5` | SMS |
| `6` | History |
| `7` | Wallet |
| `8` | Calendar |

## Notes

- Clicking the **already open** nav item closes the panel
- Below 768px compact mode is forced; custom resize is disabled
- Do not add overlapping handlers in `App.vue` for keys owned by `usePanelShortcuts`
