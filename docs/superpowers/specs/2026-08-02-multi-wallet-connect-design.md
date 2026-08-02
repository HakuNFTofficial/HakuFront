# Multi-Wallet Connection Design

## Objective

Replace the current first-connector wallet flow with an explicit wallet picker that supports EIP-6963 browser-wallet discovery and WalletConnect QR connections while preserving the existing wagmi/viem architecture and HakuFront visual language.

## Scope

The feature includes:

- Explicit EIP-6963 discovery through wagmi.
- A compact, responsive wallet-selection modal.
- Duplicate suppression between EIP-6963 providers and the legacy injected fallback.
- WalletConnect QR support configured by `VITE_WALLETCONNECT_PROJECT_ID`.
- Inline loading and connection-error states.
- Automated tests, production build verification, pull-request delivery, and deployment to the existing Haku server.

The feature does not migrate the application to Reown AppKit, RainbowKit, or ConnectKit, and it does not change contract, swap, NFT, or network-switching behavior.

## Architecture

### Wagmi configuration

`frontend/src/wagmi.ts` will explicitly set `multiInjectedProviderDiscovery: true`. The hard-coded MetaMask-first connector will be removed. A generic `injected()` connector remains as a compatibility fallback for legacy EIP-1193 wallets that do not announce through EIP-6963.

When `VITE_WALLETCONNECT_PROJECT_ID` is set, the configuration will append a `walletConnect()` connector with QR-modal support and Haku metadata. When the variable is absent, WalletConnect will not be registered and development builds will emit a clear configuration warning.

The Project ID is build-time browser configuration. Its real value will not be committed to Git. `frontend/.env.example` will document the variable, while the existing deployment environment will receive the provided real value.

### Wallet option normalization

A focused wallet-option utility will transform wagmi connectors into display options. It will:

- Preserve discovered provider names and icons.
- Prefer named EIP-6963 connectors over the generic injected fallback.
- Remove duplicate connector representations.
- Keep the generic “Browser Wallet” option only when no named injected wallet is available.
- Place WalletConnect after detected browser wallets.

The normalization function will be independent of React so its behavior can be unit tested directly.

### UI boundaries

A new `WalletConnectModal` component will own presentation, keyboard behavior, selection state, and error rendering. `App.tsx` will only own whether the picker is open and will pass the current wagmi connectors and connect action into the component.

The current `connectors[0]` click behavior will be removed. The Connect button will open the picker, and a connection will begin only after the user selects a specific wallet.

## Interaction Design

The approved layout is a compact single-column list consistent with the existing dark modal styling.

- The header reads “Connect Wallet” with the subtitle “Choose a wallet to continue.”
- Each detected extension row shows its icon, wallet name, and a “Detected” badge.
- Wallets without icons use a name-initial fallback.
- WalletConnect appears as the final row with “Scan with a mobile wallet.”
- The modal closes through its close button, backdrop click, or Escape.
- The dialog exposes appropriate dialog semantics and moves focus to a useful control when opened.
- The wallet list can scroll when many providers are discovered.
- The layout remains usable at mobile viewport widths.

When the user selects a wallet, only that row enters a connecting state and other choices are temporarily disabled. A successful connection closes the picker. User rejection, unavailable providers, or other connection failures leave the picker open and show a concise inline message instead of using `alert`.

Selecting WalletConnect hands off to the standard WalletConnect QR modal. After a successful WalletConnect session, the Haku picker closes.

## Data Flow

1. `createConfig` starts EIP-6963 discovery and creates configured fallback and WalletConnect connectors.
2. `useConnect()` exposes the reactive connector list to `App`.
3. Opening the Connect button renders `WalletConnectModal` with normalized wallet options.
4. Providers announced after page load update the option list automatically.
5. Selecting an option calls wagmi `connect({ connector })` for that exact connector.
6. Success closes the modal; failure is normalized into inline UI text.

## Error Handling

Connection errors will be mapped to user-facing messages without exposing stack traces. User cancellation will be described as a canceled request rather than a system failure. Missing providers and transport failures will use distinct general messages where wagmi exposes enough information to classify them.

The original error remains available to development logging for diagnosis. A missing WalletConnect Project ID is handled during configuration by omitting the connector rather than presenting a dead action.

## Testing

The frontend will add Vitest, React Testing Library, and jsdom as its minimal test stack.

Unit tests will cover:

- Named EIP-6963 options replacing the generic injected fallback.
- Duplicate connector suppression.
- Preservation and ordering of multiple detected wallets.
- WalletConnect placement.
- Generic fallback behavior when no named provider exists.

Component tests will cover:

- Rendering the normalized wallet list.
- Selecting the exact requested connector.
- Close-button, backdrop, and Escape behavior.
- Connecting state and prevention of duplicate requests.
- Inline failure messages.
- Missing icon fallback.

Delivery verification will run the complete frontend test suite, TypeScript compilation, and a Vite production build. Manual production verification will confirm the deployed Connect button opens the picker, the site serves the new bundle, and the WalletConnect entry initializes with the configured Project ID.

## Deployment

Before delivery, the feature branch will merge the latest `origin/main` and rerun verification. The exact verified commit will be pushed and opened as a pull request.

The existing Haku server will then be inspected over SSH to identify its current checkout, build, environment, and service layout. The deployment will preserve the existing configuration, set `VITE_WALLETCONNECT_PROJECT_ID` in the server-side build environment, build the verified feature commit, update the served frontend using the server’s established deployment mechanism, and perform an HTTP smoke test against `https://www.hakupump.club/`.

Reown should allow `https://www.hakupump.club` as a project domain. If `https://hakupump.club` serves the application directly, that origin should also be allowed.

## Acceptance Criteria

- Multiple EIP-6963-compatible browser wallets appear as distinct choices.
- No wallet is connected merely because it was injected first.
- Duplicate generic and named representations are not shown together.
- The selected connector, and only the selected connector, receives the connection request.
- WalletConnect appears and opens its QR flow when the Project ID is configured.
- Connection loading, cancellation, and failure states are understandable and recoverable.
- Existing connected-wallet, network-switching, contract, swap, and NFT flows still build and operate through the same wagmi provider.
- Automated tests and production build pass.
- The verified feature commit is pushed, has a pull request, and is deployed to the existing Haku server with an HTTP smoke test.
