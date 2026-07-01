# COVENANT UI/UX REDESIGN MASTER SPECIFICATION
## Version 1.0 — From Marketing Site to Functional Application
## Target: Production-grade Treasury Dashboard (Benzo-inspired + Covenant Identity)

---

## TABLE OF CONTENTS

1. Design Philosophy & Principles
2. Color System (Dark + Light + Auto)
3. Typography & Spacing
4. Layout Architecture
5. Component Library (50+ Components)
6. Page Specifications (7 Pages)
7. Wallet Integration
8. State Management & Data Flow
9. Animation & Interaction Design
10. Responsive Breakpoints
11. Accessibility Requirements
12. Implementation Roadmap
13. File Structure
14. Key Design Decisions
15. Critical Success Metrics
16. Anti-Patterns to Avoid
17. The Vision

---

## 1. DESIGN PHILOSOPHY & PRINCIPLES

### Core Principle: "Cryptography Invisible, Power Visible"

Users should never see the words "UltraHonk", "BN254", "sumcheck", or "Fiat-Shamir" in the main UI. These belong in the ZK Explorer (technical documentation tab) only.

### The 5 Principles:

1. **Progressive Disclosure**: Show simple actions first. Reveal technical details only when requested ("Advanced" toggle).
2. **Action-Oriented**: Every screen has a primary action. No dead-end pages.
3. **Trust Through Transparency**: Show proof status, verification badges, and audit trails — but in human-readable form.
4. **Institutional Calm**: No neon, no gradients, no crypto-bro aesthetics. Banking-grade professionalism.
5. **Mobile-First Responsive**: Sidebar collapses to bottom nav on mobile. Touch targets >= 44px.

### User Personas:

| Persona | Role | Primary Actions | Technical Sophistication |
|---------|------|----------------|------------------------|
| **Compliance Officer** | Issues/regulates credentials | Generate credential, renew, audit | Medium |
| **Treasury Manager** | Manages institutional funds | Make private, prove reserves, settle | Low-Medium |
| **Settlement Desk** | Executes cross-border payments | Initiate settlement, batch settle | Medium |
| **Regulator** | Audits compliance | Verify view key, generate reports | Low |
| **Developer** | Integrates with API | View contract addresses, test endpoints | High |

---

## 2. COLOR SYSTEM

### 2.1 Dark Mode (Default)

```css
:root[data-theme="dark"] {
  /* Backgrounds */
  --bg-base: #0a0a0f;
  --bg-surface: #12121a;
  --bg-elevated: #1a1a25;
  --bg-overlay: #222230;
  --bg-input: #0f0f17;

  /* Text */
  --text-primary: #f0f0f5;
  --text-secondary: #8a8a9a;
  --text-tertiary: #5a5a6a;
  --text-inverse: #0a0a0f;

  /* Accents */
  --accent-primary: #7c5cff;
  --accent-primary-hover: #9178ff;
  --accent-primary-active: #6b4de6;
  --accent-primary-subtle: rgba(124, 92, 255, 0.1);

  --accent-success: #10b981;
  --accent-success-subtle: rgba(16, 185, 129, 0.1);
  --accent-warning: #f59e0b;
  --accent-warning-subtle: rgba(245, 158, 11, 0.1);
  --accent-danger: #ef4444;
  --accent-danger-subtle: rgba(239, 68, 68, 0.1);
  --accent-info: #3b82f6;
  --accent-info-subtle: rgba(59, 130, 246, 0.1);

  /* Shielded/Privacy specific */
  --shielded-primary: #a855f7;
  --shielded-subtle: rgba(168, 85, 247, 0.1);
  --shielded-glow: rgba(168, 85, 247, 0.3);

  /* Public/Visible specific */
  --public-primary: #06b6d4;
  --public-subtle: rgba(6, 182, 212, 0.1);

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.1);
  --border-strong: rgba(255, 255, 255, 0.15);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px var(--shielded-glow);

  /* Tier colors */
  --tier-platinum: #e5e4e2;
  --tier-gold: #ffd700;
  --tier-silver: #c0c0c0;
  --tier-bronze: #cd7f32;
  --tier-basic: #8b7355;
}
```

### 2.2 Light Mode

```css
:root[data-theme="light"] {
  --bg-base: #fafafa;
  --bg-surface: #ffffff;
  --bg-elevated: #f5f5f7;
  --bg-overlay: #ebebef;
  --bg-input: #ffffff;
  --text-primary: #111118;
  --text-secondary: #6b6b7b;
  --text-tertiary: #9a9aaa;
  --text-inverse: #ffffff;
  --accent-primary: #6d4eea;
  --accent-primary-hover: #5a3fd6;
  --accent-primary-active: #4a32b8;
  --accent-primary-subtle: rgba(109, 78, 234, 0.08);
  --accent-success: #059669;
  --accent-success-subtle: rgba(5, 150, 105, 0.08);
  --accent-warning: #d97706;
  --accent-warning-subtle: rgba(217, 119, 6, 0.08);
  --accent-danger: #dc2626;
  --accent-danger-subtle: rgba(220, 38, 38, 0.08);
  --accent-info: #2563eb;
  --accent-info-subtle: rgba(37, 99, 235, 0.08);
  --shielded-primary: #9333ea;
  --shielded-subtle: rgba(147, 51, 234, 0.08);
  --shielded-glow: rgba(147, 51, 234, 0.15);
  --public-primary: #0891b2;
  --public-subtle: rgba(8, 145, 178, 0.08);
  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-default: rgba(0, 0, 0, 0.1);
  --border-strong: rgba(0, 0, 0, 0.15);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-glow: 0 0 20px var(--shielded-glow);
}
```

### 2.3 Theme Switcher Component

```tsx
// src/components/ThemeSwitcher.tsx
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-2 bg-bg-elevated rounded-lg p-1">
      <button onClick={() => setTheme('light')} className={theme === 'light' ? 'bg-bg-surface shadow-sm' : ''}>
        <SunIcon className="w-4 h-4" />
      </button>
      <button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'bg-bg-surface shadow-sm' : ''}>
        <MoonIcon className="w-4 h-4" />
      </button>
      <button onClick={() => setTheme('system')} className={theme === 'system' ? 'bg-bg-surface shadow-sm' : ''}>
        <MonitorIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
```

### 2.4 Theme Hook

```tsx
// src/hooks/useTheme.ts
type Theme = 'dark' | 'light' | 'system';
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('covenant-theme') as Theme) || 'system');
  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const activeTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
    root.setAttribute('data-theme', activeTheme);
    localStorage.setItem('covenant-theme', theme);
  }, [theme]);
  return { theme, setTheme };
}
```

---

## 3. TYPOGRAPHY & SPACING

### 3.1 Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 3.2 Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| display-xl | 48px | 700 | 1.1 | Hero headlines |
| display-lg | 36px | 700 | 1.15 | Page titles |
| display-md | 30px | 600 | 1.2 | Section headers |
| heading-lg | 24px | 600 | 1.3 | Card titles |
| heading-md | 20px | 600 | 1.35 | Subsection titles |
| heading-sm | 16px | 600 | 1.4 | Labels, badges |
| body-lg | 16px | 400 | 1.6 | Primary body text |
| body-md | 14px | 400 | 1.6 | Secondary body text |
| body-sm | 13px | 400 | 1.5 | Captions, metadata |
| body-xs | 12px | 500 | 1.4 | Tags, timestamps |
| mono-lg | 16px | 400 | 1.5 | Addresses, hashes |
| mono-md | 14px | 400 | 1.5 | Transaction IDs |
| mono-sm | 12px | 400 | 1.4 | Small data points |

### 3.3 Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| space-px | 1px | Hairlines |
| space-1 | 4px | Icon padding |
| space-2 | 8px | Tight gaps |
| space-3 | 12px | Button padding-y |
| space-4 | 16px | Card padding |
| space-5 | 20px | Form gaps |
| space-6 | 24px | Section gaps |
| space-8 | 32px | Card grid gaps |
| space-10 | 40px | Page sections |
| space-12 | 48px | Major sections |
| space-16 | 64px | Page padding |
| space-20 | 80px | Hero spacing |
| space-24 | 96px | Large sections |

---

## 4. LAYOUT ARCHITECTURE

### 4.1 Overall Structure

```
Top Bar (64px) — Logo | Search | Theme | Wallet
Sidebar (240px) — Navigation sections
Main Content (flex: 1, max-width: 1200px) — Page content
```

### 4.2 Top Bar

```tsx
<header className="h-16 bg-bg-surface border-b border-border-subtle flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-50">
  <div className="flex items-center gap-3">
    <CovenantLogo className="w-8 h-8" />
    <div>
      <span className="text-heading-sm font-semibold">Covenant</span>
      <span className="text-body-xs text-text-tertiary">ZK Compliance</span>
    </div>
  </div>
  <div className="flex-1 max-w-md mx-8">
    <SearchBar placeholder="Search payees, runs, actions..." shortcut="⌘K" />
  </div>
  <div className="flex items-center gap-3">
    <NetworkBadge network="testnet" />
    <ThemeSwitcher />
    <NotificationBell count={3} />
    <WalletConnectButton />
  </div>
</header>
```

### 4.3 Sidebar

```tsx
const NAV_SECTIONS = [
  { label: 'OVERVIEW', items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' }] },
  { label: 'OPERATE', items: [
    { icon: Shield, label: 'Treasury', path: '/treasury' },
    { icon: FileBadge, label: 'Credentials', path: '/credentials', badge: '2' },
    { icon: Send, label: 'Settlements', path: '/settlements' },
    { icon: ArrowLeftRight, label: 'Bridge', path: '/bridge' },
  ]},
  { label: 'CONTROL', items: [
    { icon: CheckCircle, label: 'Approvals', path: '/approvals', badge: '1' },
    { icon: Settings2, label: 'Policies', path: '/policies' },
    { icon: Users, label: 'Team', path: '/team' },
  ]},
  { label: 'AUDIT', items: [
    { icon: KeyRound, label: 'Auditor Grants', path: '/auditor-grants' },
    { icon: ScrollText, label: 'Audit Log', path: '/audit-log' },
  ]},
  { label: 'SYSTEM', items: [
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: HelpCircle, label: 'Support', path: '/support' },
  ]},
];
```

### 4.4 Main Content

```tsx
<main className={cn('pt-16 transition-all', collapsed ? 'pl-[72px]' : 'pl-[240px]')}>
  <div className="max-w-[1200px] mx-auto p-8">{children}</div>
</main>
```

---

## 5. COMPONENT LIBRARY

### 5.1 Foundation Components

**Button** — Variants: primary, secondary, tertiary, danger, ghost. Sizes: sm, md, lg, xl.
**Card** — Variants: default, elevated, bordered, ghost. Padding: none, sm, md, lg, xl.
**Badge** — Variants: default, success, warning, danger, info, shielded, public.
**Input** — Label, helper, error, icon, suffix, sizes: sm, md, lg.
**Select** — Searchable, clearable, with icons.
**Modal** — Sizes: sm, md, lg, xl, full. With title, subtitle, footer.
**Toast** — Types: success, error, warning, info. With action button.
**Skeleton** — Variants: text, circular, rectangular, rounded.
**Tooltip** — Positions: top, bottom, left, right.
**Dropdown** — Items with icons, danger state.
**Tabs** — Variants: default, pills, underline.
**Accordion** — Single or multiple open.
**Progress** — Sizes: sm, md, lg. Variants: default, success, warning, danger.
**Stepper** — Horizontal or vertical.

### 5.2 Data Display Components

**DataTable** — Sortable, filterable, paginated, selectable.
**StatCard** — Label, value, change indicator, icon, variant.
**BalanceCard** — Type (private/public), balance, asset, masked, actions.
**TransactionList** — Type, status, amount, counterparty, timestamp, txHash.
**CredentialCard** — Tier, status, issuedAt, expiresAt, kycProvider, actions.
**TierBadge** — Tier 1-5, size, showLimit.

### 5.3 Form Components

**AmountInput** — Asset selector, max button, tier limit indicator, real-time validation.
**AddressInput** — Stellar validation, recent addresses, QR scanner, federation lookup.
**ProofGenerationPanel** — 7-step animated stepper with progress bars.

### 5.4 Wallet Components

**WalletConnectButton** — States: disconnected, connecting, connected, error.
**WalletModal** — Freighter, Albedo, xBull, Rabet, Ledger.
**NetworkBadge** — Testnet/mainnet/futurenet with latency.

### 5.5 Specialized Components

**ZKStatusIndicator** — Unverified, verifying, verified, failed.
**ViewKeyInput** — Password-style input, jurisdiction dropdown, verify button.
**ComplianceTierSlider** — 5-segment slider with tier colors.
**MerkleTreeViz** — Tree diagram with highlighted paths.

---

## 6. PAGE SPECIFICATIONS

### 6.1 Dashboard (`/dashboard`)
- 4 stat cards (Private Balance, Public Balance, Active Credentials, Pending Approvals)
- Recent Activity list
- Network Stats panel
- Contract Status indicators

### 6.2 Treasury (`/treasury`) — MOST IMPORTANT
- Private Balance Card (masked, shielded badge, "Make private" action)
- Public Balance Card (visible, public badge, send/receive actions)
- Make Private Form (amount input, max button, tier limit, submit)
- Prove Reserves Form (threshold input, generate proof button)
- Prove Solvency Form (one-click proof button)
- Operating/Payroll/Treasury sub-accounts

### 6.3 Credentials (`/credentials`)
- Active Credentials list (CredentialCards)
- Issue New Credential form (KYC provider, risk score, tier preview, generate)
- Proof Generation Animation (7 steps)

### 6.4 Settlements (`/settlements`)
- New Settlement form (from, to, amount, asset, memo, cross-currency toggle)
- Tier limit validation
- Settlement History table

### 6.5 Bridge (`/bridge`)
- Cross-Currency Settlement form (send asset, receive asset, amount)
- Exchange rate display
- Path visualization (USDC -> XLM -> EURC)
- Slippage warning
- Bridge History table

### 6.6 Audit (`/audit`)
- Regulator Verification form (jurisdiction, view key input)
- Audit Results panel (credential details, settlement history, export)
- Session Log table

### 6.7 Settings (`/settings`)
- Wallet (connected address, disconnect, explorer link)
- Network (testnet/mainnet/futurenet, custom endpoints)
- Contract Addresses (copy, explorer links)
- Theme (light/dark/system)
- Advanced (show ZK details, developer mode, debug logging)

---

## 7. WALLET INTEGRATION

### Supported Wallets
| Wallet | Type | Priority |
|--------|------|----------|
| Freighter | Browser extension | P0 |
| Albedo | Browser + Mobile | P1 |
| xBull | Browser extension | P1 |
| Rabet | Browser extension | P2 |
| Ledger | Hardware | P2 |

### Connection Flow
1. Click "Connect Wallet"
2. Choose wallet modal
3. Wallet authorization prompt
4. Receive public key
5. Fetch account from Horizon
6. Check for Covenant credentials
7. Load dashboard

---

## 8. STATE MANAGEMENT

### Zustand Stores
- **appStore** — theme, sidebar, notifications, loading states
- **walletStore** — address, network, balance, connection status
- **credentialStore** — credentials, active tier, expiry
- **settlementStore** — settlements, history, pending

### Data Flow
User Action -> UI Component -> Store Action -> API Call -> Blockchain -> Optimistic Update -> Confirmation -> Toast

---

## 9. ANIMATION & INTERACTION

### Key Animations
| Animation | Duration | Easing |
|-----------|----------|--------|
| Page transition | 300ms | ease-out |
| Card hover | 150ms | ease-out |
| Button press | 100ms | ease-in-out |
| Toast enter/exit | 300ms/200ms | ease-out/ease-in |
| Modal open | 300ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Skeleton shimmer | 1500ms | linear infinite |
| Proof generation step | 500ms | ease-in-out |
| Balance reveal | 200ms | ease-out |
| Sidebar collapse | 300ms | ease-in-out |

### Proof Generation Animation (7 Steps)
1. Hashing KYC documents (2s)
2. Building Merkle proof (3s)
3. Computing witness (4s)
4. Generating UltraHonk proof (5s)
5. Verifying off-chain (2s)
6. Registering on-chain (3s)
7. Credential active (1s)

Visual: Vertical stepper with animated progress bars, icons, status indicators.

---

## 10. RESPONSIVE BREAKPOINTS

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Bottom nav, stacked cards, full-width forms |
| Tablet | 640-1024px | Collapsed sidebar (72px), 2-column grids |
| Desktop | 1024-1440px | Full sidebar (240px), 2-3 column grids |
| Wide | > 1440px | Full sidebar, 3-4 column grids, max-width container |

---

## 11. ACCESSIBILITY

### WCAG 2.1 AA
- Color contrast >= 4.5:1
- Visible 2px focus indicators
- Full keyboard navigation (Tab, Enter, Space)
- ARIA labels and live regions
- Respect prefers-reduced-motion
- Touch targets >= 44x44px

---

## 12. IMPLEMENTATION ROADMAP

### Week 1: Foundation
- Day 1: Project setup (Vite, React, Tailwind, Zustand, Router)
- Day 2: Theme system (dark/light/system)
- Day 3: Layout shell (TopBar, Sidebar, responsive)
- Day 4: UI primitives (Button, Card, Badge, Input, Modal, Toast)
- Day 5: Wallet integration (Freighter, useWallet)
- Day 6: Dashboard page
- Day 7: Polish (animations, loading, errors)

### Week 2: Core Flows
- Day 8: Treasury page (balance cards, make private, prove reserves)
- Day 9: Credentials page (form, tier slider, proof animation)
- Day 10: Settlements page (form, validation, history)
- Day 11: Bridge page (cross-currency, rate display)
- Day 12: Audit page (view key, jurisdiction, results)
- Day 13: Settings page (wallet, network, contracts, theme)
- Day 14: Polish (validation, errors, success flows)

### Week 3: Advanced
- Day 15: Data tables (sort, filter, paginate)
- Day 16: Charts (balance history, volume, tier distribution)
- Day 17: Batch operations
- Day 18: Notifications system
- Day 19: Export & reports
- Day 20: Search & command palette
- Day 21: Mobile optimization

### Week 4: Polish
- Day 22: Performance (lazy loading, code splitting)
- Day 23: Accessibility (ARIA, keyboard, screen readers)
- Day 24: Testing (unit, integration, E2E)
- Day 25: Documentation (Storybook, API docs)
- Day 26: Bug fixes
- Day 27: Final review
- Day 28: Deploy

---

## 13. FILE STRUCTURE

```
covenant-ui/
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── ui/ (Button, Card, Badge, Input, Select, Modal, Toast, Skeleton, Tooltip, Dropdown, Tabs, Accordion, Progress, Stepper, DataTable)
│   │   ├── layout/ (TopBar, Sidebar, MobileNav, Layout)
│   │   ├── wallet/ (WalletConnectButton, WalletModal, NetworkBadge)
│   │   ├── treasury/ (BalanceCard, MakePrivateForm, ProveReservesForm, ProveSolvencyForm)
│   │   ├── credentials/ (CredentialCard, CredentialForm, TierSlider, ProofGenerationPanel)
│   │   ├── settlements/ (SettlementForm, SettlementHistory, ZKStatusIndicator)
│   │   ├── bridge/ (BridgeForm, ExchangeRateDisplay)
│   │   ├── audit/ (ViewKeyInput, AuditResultCard, SessionLog)
│   │   └── shared/ (AmountInput, AddressInput, StatCard, TransactionList, CovenantLogo, ThemeSwitcher, SearchBar)
│   ├── hooks/ (useTheme, useWallet, useCredentials, useSettlements, useBalances, useNetwork, useToast)
│   ├── stores/ (appStore, walletStore, credentialStore, settlementStore)
│   ├── api/ (covenant, stellar, proving)
│   ├── pages/ (Dashboard, Treasury, Credentials, Settlements, Bridge, Audit, Settings)
│   ├── lib/ (utils, constants, formatters, validators)
│   ├── types/ (wallet, credential, settlement, index)
│   ├── styles/ (globals.css, animations.css)
│   ├── App.tsx
│   ├── main.tsx
│   └── router.tsx
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 14. KEY DESIGN DECISIONS

- **No Shadcn/ui**: Custom shielded/public visual language, ZK-specific components, institutional aesthetic
- **Zustand over Redux**: Smaller, simpler, TypeScript-friendly
- **Tailwind over CSS Modules**: Rapid prototyping, consistent design system, dark mode support
- **React Router over Next.js**: No SSR needed, simpler deployment

---

## 15. CRITICAL SUCCESS METRICS

| Metric | Target |
|--------|--------|
| Time to first credential | < 60 seconds |
| Time to first settlement | < 90 seconds |
| Wallet connection success | > 95% |
| Proof generation success | > 98% |
| Page load time | < 2 seconds |
| Accessibility score | > 95 |
| Mobile usability | > 90 |
| User satisfaction (NPS) | > 50 |

---

## 16. ANTI-PATTERNS TO AVOID

- Don't expose ZK jargon in main UI
- Don't show raw hashes (truncate, use identicons)
- Don't block on loading (use skeletons, optimistic updates)
- Don't use crypto-bro aesthetics (no neon, no gradients, no memes)
- Don't require technical knowledge
- Don't ignore errors (human-readable messages + retry)
- Don't forget mobile
- Don't skip accessibility

---

## 17. THE VISION

> **"Covenant should feel like a Bloomberg Terminal for private compliance — powerful, precise, and invisible. The cryptography is the foundation, not the feature. Users should feel confident, not confused. Powerful, not overwhelmed."**

The UI is not a wrapper around the ZK. The UI **is** the product. The ZK is the engine that makes it possible. Users never need to know what's under the hood — they just need to know that their settlements are private, compliant, and irreversibly proven.

---

**END OF SPECIFICATION**

**Total Components:** 50+
**Total Pages:** 7
**Estimated Implementation:** 4 weeks (1 dev) or 2 weeks (2 devs)
**Priority:** P0 = Must have, P1 = Should have, P2 = Nice to have, P3 = Future
