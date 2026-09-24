# kwami-app — Changelog

All notable changes to this client are documented here. This file is generated from the commit history by semantic-release — do not edit it by hand.

`v0.1.0` is a baseline tag placed at the commit that introduced this automation. Everything before it lives in the git log rather than here: it shipped before there was a release line to put it on.

## [0.1.2](https://github.com/kwami-labs/kwami-app/compare/v0.1.1...v0.1.2) (2026-09-23)

## [0.1.1](https://github.com/kwami-labs/kwami-app/compare/v0.1.0...v0.1.1) (2026-09-22)


### Bug Fixes

* **ci:** pin TypeScript to 5.9 so vue-tsc can typecheck ([db591d7](https://github.com/kwami-labs/kwami-app/commit/db591d7c672ba286b5e1b5b871d55e5c48164901))


### Features

* **auth:** record the screen from the welcome soundtrack pill ([fb22f7a](https://github.com/kwami-labs/kwami-app/commit/fb22f7a83e02b9f940a497258421994392838e90))

# [1.0.0-stg.2](https://github.com/kwami-labs/kwami-app/compare/v1.0.0-stg.1...v1.0.0-stg.2) (2026-09-22)


### Bug Fixes

* **ci:** pin TypeScript to 5.9 so vue-tsc can typecheck ([db591d7](https://github.com/kwami-labs/kwami-app/commit/db591d7c672ba286b5e1b5b871d55e5c48164901))


### Features

* **auth:** record the screen from the welcome soundtrack pill ([fb22f7a](https://github.com/kwami-labs/kwami-app/commit/fb22f7a83e02b9f940a497258421994392838e90))

# 1.0.0-stg.1 (2026-09-21)


### Bug Fixes

* **auth:** connect Phantom before SIWS and map opaque wallet errors ([b0fd6a4](https://github.com/kwami-labs/kwami-app/commit/b0fd6a47cfd4f5ea32ac3e9b91d6cf90afa0c3ac))
* **auth:** drop unused YouTube player binding so production builds ([e617db3](https://github.com/kwami-labs/kwami-app/commit/e617db3fa299857bab488d78261ba2aed6743938))
* **auth:** move the KWAMI wordmark into the open login panel ([cd33563](https://github.com/kwami-labs/kwami-app/commit/cd3356313d549178d0aa31494f9fde29355561ec))
* **auth:** wait for the login panel to settle and keep validation in-app ([41c55cb](https://github.com/kwami-labs/kwami-app/commit/41c55cb424d63507d87dfc965a078bb275fb2f96))
* **avatar:** hero-fit only blob and iris on workspace resize ([f2adefe](https://github.com/kwami-labs/kwami-app/commit/f2adefe431d50a51af9cf8365775dea4c7200dce))
* **avatar:** tolerate missing import.meta.hot.data in tests ([a69d95f](https://github.com/kwami-labs/kwami-app/commit/a69d95f91f37ae3310ad2e4620b7a9723e618f13))
* **browser:** remember fullscreen return layout in the store ([b68559b](https://github.com/kwami-labs/kwami-app/commit/b68559b7f8699fd4b6011909f9c8265f384e997a))
* **browser:** surface iframe load failures instead of spinning forever ([f1389a2](https://github.com/kwami-labs/kwami-app/commit/f1389a29aa2dcc4e7ebabca5efd0815d75ba78c9))
* **connect:** mint LiveKit tokens through the shared client ([b41401c](https://github.com/kwami-labs/kwami-app/commit/b41401c1c4e5190fa38d984b082f7426d4af85a9))
* **e2e:** map digit shortcuts to SETTINGS_PANEL_ORDER ([38a50d5](https://github.com/kwami-labs/kwami-app/commit/38a50d579ff8fdae109b3f79ce48d7107eebd681))
* **i18n:** escape braces that vue-i18n treated as interpolations ([60726b5](https://github.com/kwami-labs/kwami-app/commit/60726b5b1ad05aa2a0c81ef952278905124f5f4a))
* **i18n:** nest agent tool strings so t('workspaceAgentTools.*') resolves ([8c81d7e](https://github.com/kwami-labs/kwami-app/commit/8c81d7ee5d5722df37a5bb8647e9689622d5bb9d))
* **i18n:** say the welcome avatar shifts, not that it gets a new look ([2495f4e](https://github.com/kwami-labs/kwami-app/commit/2495f4ef296d67b3f6911d70f3b4580647e0f926))
* **info:** document the full panel shortcut sequence ([001369b](https://github.com/kwami-labs/kwami-app/commit/001369b30660362a10c4930266adff77c520e293))
* **pwa:** keep tour tracks out of the precache ([c5ef1dd](https://github.com/kwami-labs/kwami-app/commit/c5ef1dda5124970bbed164f0f0a28cec2647b9de))
* **pwa:** split vendor chunks so workbox can precache the app shell ([d450cbf](https://github.com/kwami-labs/kwami-app/commit/d450cbfb1701c4a6b05ecc222d20d854f7958e9c))
* **pwa:** use the sphere icon in the install card ([fa6ea55](https://github.com/kwami-labs/kwami-app/commit/fa6ea557d367b0d19a443293e988ed639b8634f6))
* **search:** address panel controls by name, not position ([8f95c98](https://github.com/kwami-labs/kwami-app/commit/8f95c98fcfe40d0e8676e475b50e94c8d96052b7))
* **shortcuts:** drive digit keys from the shared panel order ([32252e6](https://github.com/kwami-labs/kwami-app/commit/32252e61f80617f85bc1baa648f5825aa9b8e07c))
* **soundtrack:** collapse the pill while the login panel is open ([9df98bf](https://github.com/kwami-labs/kwami-app/commit/9df98bff761b75fa8c826d39f0a831516863abec))
* **soundtrack:** keep the workspace crate alive when the audio panel closes ([e9d7757](https://github.com/kwami-labs/kwami-app/commit/e9d7757ee7ca6f50af46f53045738902bbdac5c8))
* **theme:** point remaining login chrome at the auth tokens ([fea927d](https://github.com/kwami-labs/kwami-app/commit/fea927d751806620b000efcb9e950b010a0523b8))
* **tools:** register webhooks with the agent instead of a local mock ([addff84](https://github.com/kwami-labs/kwami-app/commit/addff84e9c8560d8ac0f8c977d8b8e29439a15ea))
* **wallet:** i18n the panel and treat a 503 as feature-disabled ([12ddd2b](https://github.com/kwami-labs/kwami-app/commit/12ddd2be836f0941c9e492661e80669613c15697))


### Features

* **agent:** add browser, scene, companion, and eye-iris tools ([68df92d](https://github.com/kwami-labs/kwami-app/commit/68df92d95603d0562569c629549d6b5648fd6f17))
* **agent:** add create, rename, delete, and surprise-me Kwami tools ([cd85a15](https://github.com/kwami-labs/kwami-app/commit/cd85a15bf7ef2eaf9a50fe370107f0db187c62cb))
* **agent:** add phone, SMS, WhatsApp, contacts, and wallet tools ([69e4314](https://github.com/kwami-labs/kwami-app/commit/69e431497b7a0ebd5925e5e071b072e56023ce9d))
* **agent:** add soul and soundtrack voice tools ([35f473e](https://github.com/kwami-labs/kwami-app/commit/35f473e71c0b5431579c8a3cc5d39750fb12e07c))
* **agent:** add theme export, metrics, and wallet-create tools ([dead5a8](https://github.com/kwami-labs/kwami-app/commit/dead5a8be52405291baa7e800dec7220032bed27))
* **agent:** add tools to forget memories and jump conversations ([08621e2](https://github.com/kwami-labs/kwami-app/commit/08621e21fb8944c5946c1d1840a0ba66798fbadd))
* **agent:** register comms tools and switch the app locale by voice ([48bb572](https://github.com/kwami-labs/kwami-app/commit/48bb5726d1c7b60671c19d946e7f1f0d1905120f))
* **agent:** register recall, admin, and extras tools ([3d703bc](https://github.com/kwami-labs/kwami-app/commit/3d703bc097456d1a24999250c1628d80384e005c))
* **agent:** report the resolved theme, not just the preference ([eaa4291](https://github.com/kwami-labs/kwami-app/commit/eaa42918b95c361029bb35341f103856d8de62b9))
* **api:** add a shared HTTP client and migrate the calendar store ([8fd0c00](https://github.com/kwami-labs/kwami-app/commit/8fd0c003c5ae6a1f536a9e63f108f31fc9882311))
* **audio:** follow band levels with an attack/release envelope ([6277188](https://github.com/kwami-labs/kwami-app/commit/6277188080d444f47982651cc6737ef24f691c50))
* **audio:** run the music player bands through the envelope ([bd56c6b](https://github.com/kwami-labs/kwami-app/commit/bd56c6b81c5f2fabbda9f1fa2853ea316de3fcb8))
* **auth:** add a language and theme pill on the login screen ([568d67d](https://github.com/kwami-labs/kwami-app/commit/568d67df46af81bc560dcd0fef81f05865a3bfc6))
* **auth:** add email sign-in and resolve Phantom by namespace ([46633eb](https://github.com/kwami-labs/kwami-app/commit/46633ebde2cc9e376cd50f83f4610837fddb96f7))
* **auth:** add phone OTP sign-in on a Mobile tab ([c8ec1cf](https://github.com/kwami-labs/kwami-app/commit/c8ec1cfaa15137a897717162cf6becc411826acc))
* **auth:** always show the eye-iris on the welcome screen ([7f29574](https://github.com/kwami-labs/kwami-app/commit/7f29574cfd8c5da0d5035761061ea15e6f4799df))
* **auth:** cycle welcome eye-iris through a wider color set ([b188bc9](https://github.com/kwami-labs/kwami-app/commit/b188bc9dabfa510c80775874d6a9e63b92c26062))
* **auth:** dance the welcome blob to a beat clock, not just onsets ([ed95114](https://github.com/kwami-labs/kwami-app/commit/ed95114f9e66536c7b5ee426726c9f2b995d39c2))
* **auth:** detect MetaMask via EIP-6963 and deep-link phones to the app ([839384f](https://github.com/kwami-labs/kwami-app/commit/839384fceb1a3db9bdd122e3f369e49fd508fc85))
* **auth:** draw Phantom and MetaMask marks inline ([9d5eb61](https://github.com/kwami-labs/kwami-app/commit/9d5eb61ca1cd4406eacb478e5ccd1888afc77efe))
* **auth:** drive the welcome blob from beat onsets, not loudness ([e690a02](https://github.com/kwami-labs/kwami-app/commit/e690a02588af58505ad11dac96f011afd64505b1))
* **auth:** drive the welcome iris from the beat pulse ([50fb0dc](https://github.com/kwami-labs/kwami-app/commit/50fb0dc361f106cad5afaa3fa8fdb2a49b7baea1))
* **auth:** fit the welcome hero to the live viewport ([04e4ea6](https://github.com/kwami-labs/kwami-app/commit/04e4ea69d4eed5672f3fd0630d556b5fe87856c9))
* **auth:** follow the pointer and freeze the avatar during approval ([2a369a8](https://github.com/kwami-labs/kwami-app/commit/2a369a8cfdc082883fd622ae37c5e5c034c1b101))
* **auth:** give the Phantom button the app accent ([f5de7da](https://github.com/kwami-labs/kwami-app/commit/f5de7da64bd405d1f256b1a11d1792becfe49bd2))
* **auth:** keep the welcome eye-iris as a rare roll ([00f82eb](https://github.com/kwami-labs/kwami-app/commit/00f82eb4b10f14b0558545590d42fae3be649863))
* **auth:** let Phantom SIWS own the connect, and hold the page ([effaa86](https://github.com/kwami-labs/kwami-app/commit/effaa860c56313c560c88763008a0c6f4659f481))
* **auth:** let the soundtrack pill set the welcome randomize rate ([3b74a54](https://github.com/kwami-labs/kwami-app/commit/3b74a546aa5b64326c11e14e4be3475d1510b93e))
* **auth:** let the welcome blob pin a finer icosahedron ([a153acd](https://github.com/kwami-labs/kwami-app/commit/a153acde5c6f35fae1016fde4f02d364d29e36d1))
* **auth:** let the welcome screen play a scene video backdrop ([9510dab](https://github.com/kwami-labs/kwami-app/commit/9510dab1e3b7a95e4f658955f230c89e761b688f))
* **auth:** offer configurable OAuth and wallet sign-in ([f25f7e4](https://github.com/kwami-labs/kwami-app/commit/f25f7e4e0f2cac45ec85a06787ad268b05fe60ac))
* **auth:** open the wallet download page when the extension is missing ([97fa441](https://github.com/kwami-labs/kwami-app/commit/97fa441e2472fb9cd126b46c3213a5e9f8fccdd9))
* **auth:** paint the crate YouTube video as the welcome backdrop ([662727d](https://github.com/kwami-labs/kwami-app/commit/662727df53f5494b5d24157bcf82b1f662580a76))
* **auth:** pin the double-click hint above the preferences pill ([947032f](https://github.com/kwami-labs/kwami-app/commit/947032f68d32029b624d1b098c52bec47b7df680))
* **auth:** point Phantom install at the Chrome Web Store listing ([fe65f03](https://github.com/kwami-labs/kwami-app/commit/fe65f031a6756884514d0cb7f4740b056b6daa55))
* **auth:** remix welcome blob spikes as one density ([4d20a93](https://github.com/kwami-labs/kwami-app/commit/4d20a93965c268c347f55565818587b34de2c759))
* **auth:** replace the Web3 tab with wallet cards and enable MetaMask ([0a46cc5](https://github.com/kwami-labs/kwami-app/commit/0a46cc56fcbc43fe7aff55cdfdba35eba3eef483))
* **auth:** shuffle the welcome video on an empty-backdrop double-click ([a583539](https://github.com/kwami-labs/kwami-app/commit/a583539b0d96f2eb2c8299a4bb27e440938cc12b))
* **auth:** tween the welcome blob between shapes ([91ac178](https://github.com/kwami-labs/kwami-app/commit/91ac178a381c4dc2b3fe77ba7bc33e591a52b59f))
* **avatar:** budget amplitude against spike density ([8e70bac](https://github.com/kwami-labs/kwami-app/commit/8e70bac781b85049882017c7d96f71151f395021))
* **avatar:** expose the particles-face renderer in the panel ([34038a0](https://github.com/kwami-labs/kwami-app/commit/34038a06ad1472d40336646bd1c349cbc9112bee))
* **avatar:** fit the workspace kwami to the live canvas ([04897d0](https://github.com/kwami-labs/kwami-app/commit/04897d0fc31181501a457a02c97a849d9f9ce335))
* **avatar:** keep the blob a rounded drop instead of a cone ([2ee35ee](https://github.com/kwami-labs/kwami-app/commit/2ee35eebded9fc8e55de0068dda042eeedd6fe2d))
* **avatar:** re-frame the workspace kwami when scale is edited ([67c3e06](https://github.com/kwami-labs/kwami-app/commit/67c3e06cdda49966c823fc6805cf6e3132a9a1bb))
* **avatar:** retune the welcome blob for higher-frequency spikes ([ccdfb6a](https://github.com/kwami-labs/kwami-app/commit/ccdfb6ae8b42ab4d894e34f9f56b63c97d2657ee))
* **browser:** float, expand, and persist the live browser panel ([6f97e00](https://github.com/kwami-labs/kwami-app/commit/6f97e00a60cc74e0d77d9ca5e1696889ad71a3ee))
* **db:** check in Supabase schema migrations ([ce9a6a5](https://github.com/kwami-labs/kwami-app/commit/ce9a6a5ccc10e53671481ce214530831c3357f4c))
* **env:** validate required credentials at startup ([ea8f001](https://github.com/kwami-labs/kwami-app/commit/ea8f001d634f45c42c3661138f427da3de481227))
* **i18n:** add admin, recall, and extras tool strings ([d7fa7d2](https://github.com/kwami-labs/kwami-app/commit/d7fa7d21fcd2923760745932b232dfb009948a87))
* **i18n:** add French, Italian, and Portuguese strings ([9d2f6a6](https://github.com/kwami-labs/kwami-app/commit/9d2f6a6b094ecdd9f097a6f0a2cd6a1c82156aed))
* **i18n:** add login preference strings and spell Español correctly ([61ccf91](https://github.com/kwami-labs/kwami-app/commit/61ccf910252b0ec3f79727514666dc86b9dfcb7f))
* **i18n:** add search and comms strings and share the app bundle ([c0122b4](https://github.com/kwami-labs/kwami-app/commit/c0122b454005438a5fc2d9a1eb2d3933542190ff))
* **i18n:** add strings for floating and fullscreen browser chrome ([498978d](https://github.com/kwami-labs/kwami-app/commit/498978d1e5ba67e3d15916f07d3bf28d86969b4f))
* **i18n:** add the welcome double-click video hint ([86446de](https://github.com/kwami-labs/kwami-app/commit/86446de682af771afb0db78258d23d04defeb7af))
* **infra:** add Cloudflare Workers static-assets config ([2321ad3](https://github.com/kwami-labs/kwami-app/commit/2321ad3aa44d609f8a05c1ff6d85ef930e4e9f45))
* **infra:** add Terraform to attach Worker custom domains ([45adf60](https://github.com/kwami-labs/kwami-app/commit/45adf60642597290893abbe34be23fa5ce1747fc))
* **memory:** extract a store and talk to the backend via the shared client ([95dc090](https://github.com/kwami-labs/kwami-app/commit/95dc090eb91923556b3621fb2d9bc64627192e8c))
* **pwa:** add installable icons and an account-panel download flow ([7232434](https://github.com/kwami-labs/kwami-app/commit/72324341bad29a7a61103c0051f69f69c9ad0c5d))
* **search:** add a draggable window for results ([7c5fae5](https://github.com/kwami-labs/kwami-app/commit/7c5fae5764fd8cca010beedab25870d4a136bd08))
* **soundtrack:** play the tour crate on login and in Settings ([ac3b3c8](https://github.com/kwami-labs/kwami-app/commit/ac3b3c8ec0eacde89d346f41a2453fb9370ada0d))
* **theme:** frost the login tab chip and add wallet and video tokens ([36475fb](https://github.com/kwami-labs/kwami-app/commit/36475fb4d1af553bba4a81f74d1cfac3b24462a8))
* **theme:** give the login screen its own light and dark tokens ([3b2226e](https://github.com/kwami-labs/kwami-app/commit/3b2226e14649ba0aab1d31cf205ad4c2ba51a957))
* **theme:** keep the login tab indicator dark enough for white labels ([475c1f2](https://github.com/kwami-labs/kwami-app/commit/475c1f2a3b18b5618c97c551d6fb2e38c6604dce))
* **theme:** move Phantom button colors onto the auth tokens ([f4c84e4](https://github.com/kwami-labs/kwami-app/commit/f4c84e454636f85afd0e48bb8b3dbb7523be6f56))


### Performance Improvements

* **app:** lazy-load panels so they stay out of the entry chunk ([4096620](https://github.com/kwami-labs/kwami-app/commit/4096620dd997c97822ccc5b86000ec2445fb5b39))
* **build:** drop console and debugger only in production bundles ([0bba8b3](https://github.com/kwami-labs/kwami-app/commit/0bba8b308be58217a8bf42768b14ba1e359014c7))


### Reverts

* **avatar:** stop swapping the blob mesh for an icosahedron ([ab43e48](https://github.com/kwami-labs/kwami-app/commit/ab43e4883c5254ca2b71fcf7040555f1e7232939))

# kwami-app — Changelog

All notable changes to this client are documented here. From the first automated release onward this file is generated from the commit history by semantic-release — do not edit it by hand.

`v0.1.0` is a baseline tag placed at the commit that introduced this automation. Entries below describe work that shipped before there was a release line to put it on.

## [Unreleased]

### Added

- Architecture, guides, concepts, and reference under [`docs/`](docs/README.md)
- Security policy, contributor guide, and code of conduct
- Shared HTTP client (`apiClient`) for every Kwami API call
- Environment validation at startup (`src/lib/env.ts`)
- Configurable OAuth and wallet sign-in via `VITE_AUTH_PROVIDERS`
- PWA install icons and an Account-panel download flow
- Particles-face renderer in the Avatar panel
- A soundtrack on the login screen: a play/pause pill over the welcome kwami,
  which moves to the music through the SDK's audio analyser. The same crate is
  playable from Settings -> Audio
- Memory Pinia store talking to `/memory/*` through the shared client
- Single source of truth for panel order (`src/constants/panels.ts`)
- CI workflow: typecheck, lint, format, unit coverage, production build, Playwright
- The live browser panel can be floated, dragged, resized and expanded to
  fullscreen, not only docked as a split pane. Layout persists, is clamped back
  into the viewport on every change (a panel dragged off-screen has no header
  to grab and no close button to click), and is movable and resizable from the
  keyboard. A transparent shield covers the iframe mid-gesture, without which a
  drag dies the moment the cursor crosses into it.
- The panel says when a browsing session is ephemeral, rather than letting the
  user find out by being signed out of everything next time.
- Agent tools for the parts of the UI it could not reach: `set_browser_panel`,
  `list_scene_presets` / `apply_scene_preset` (`set_scene_control` took only raw
  URLs, which the model cannot invent, so every "put a forest behind you" either
  failed or produced a dead link), and `list_kwami_profiles` /
  `switch_kwami_profile`.
- `tests/unit/i18nMessageSyntax.test.ts`: renders every message in both locales.
  vue-i18n compiles lazily and treats `{...}` and `|` as syntax, so a message
  written with JSON or prose punctuation throws only when something displays it.

### Changed

- LiveKit room tokens are minted through `apiClient` (`POST /token`), not a separate `VITE_LIVEKIT_TOKEN_ENDPOINT`
- Catalogues, credits, email, contacts, calendar, wallet, and communications all go through the shared client
- Sidebar nav, digit shortcuts, and agent panel tools derive from the same panel lists

### Fixed

- Wallet panel i18n; treat HTTP 503 as feature-disabled
- Browser panel surfaces iframe load failures instead of spinning forever
- Digit shortcuts follow the visible sidebar order (including phone-gated WhatsApp / SMS)
- Info panel documents the full shortcut sequence
- The theme panel's JSON import placeholder threw
  `Message compilation error` whenever that section rendered: vue-i18n reads a
  bare `{` as a placeholder, and the message was a literal JSON example
- Switching the voice pipeline told the backend nothing. `updateConfig` only
  mutates the local object, so the mode never left the browser and the UI told
  the user to reconnect. It is now sent over the data channel and applied live
- The `eye-iris` renderer was unreachable by voice. The store, its presets and
  `applySnapshot` all supported it; only the agent-facing enum omitted it

### Security

- Stopped shipping Zep credentials in the client bundle
- Token minting preserves typed `402` so the insufficient-credits toast can fire
- OAuth popup `postMessage` remains same-origin only (see [Security](docs/security.md))

### Removed

- Unused `VITE_LIVEKIT_TOKEN_ENDPOINT` environment variable

## [0.1.0] - 2026-09-16

Initial documented snapshot of the Vue 3 / PWA / optional Tauri client:

- Voice sessions over LiveKit (STT → LLM → TTS or realtime)
- Four Three.js avatar renderers via the `kwami` SDK
- Per-companion workspaces in Supabase (`user_kwamis`)
- Memory graph explorer (Zep behind the API)
- Apps: contacts, email, calendar, phone, WhatsApp, SMS, wallet
- Energy (credits) balance, packs, and usage
- English and Spanish via `vue-i18n`
- Vitest + MSW unit tests and Playwright e2e

[Unreleased]: https://github.com/kwami-labs/kwami-app/commits/main
[0.1.0]: https://github.com/kwami-labs/kwami-app
