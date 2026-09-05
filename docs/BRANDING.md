# NegOSu Branding

## Naming contract

**Commercial brand:** `NegOSu`

**Tagline:** The Operating System for Your Negosyo.

The `OS` letters stay visually distinct in the logo because they communicate the operating-system idea inside the name. Customer-facing text must preserve the `NegOSu` casing. Do not substitute `Negosu`, `NEGOSU`, or `Negosu OS`.

The central application contract lives in `modules/platform/brand.ts`. Shared public UI should consume `productBrand` and `verticalBrands` rather than create a second name or route map. `components/brand-wordmark.tsx` renders the approved image assets with accessible alternative text:

- `NegOSu_logo_dark.png` on light backgrounds.
- `NegOSu_logo_light.png` on dark backgrounds.

The shared palette follows the logo: deep navy for structural text or approved dark chrome and one bright blue for primary actions, focus, key links, and selected states. Authenticated work areas remain predominantly white and slate; pale blue is limited to subtle selected or branded emphasis. Operational warning, success, danger, and informational colors are used only when they communicate those meanings.

Navigation order and group headings express operational priority. Different navigation groups do not receive competing blue, cyan, or slate identities; only the current destination uses the shared NegOSu selected state.

## Brand, vertical, and organization

These names describe separate layers:

```text
NegOSu                       Commercial SaaS brand
├── NegOSu Automotive       Supported Automotive solution
│   └── Customer business   Actual Automotive organization
└── NegOSu Salon & Beauty   Supported Salon solution
    └── Customer business   Actual Salon organization
```

`ServiceCore` remains the internal shared-platform and repository architecture name. `KarKR`, `automotive`, and existing Automotive type/module names remain internal or compatibility terminology where a mass rename would add risk without improving the customer experience.

## Public routes

| Route | Purpose |
| --- | --- |
| `/` | Master NegOSu landing and supported-industry selector |
| `/automotive` | NegOSu Automotive solution |
| `/salon` | NegOSu Salon & Beauty solution |
| `/signup` | Shared account and business setup |
| `/login` | Shared authentication |

Automotive and Salon CTAs use the allowlisted `industry` query value to preselect presentation during the shared signup/login flow. The server remains authoritative for organization creation and industry persistence.

## Architecture relationship

```text
                         NegOSu
                 Business Operating System
                           │
                     ServiceCore
                  Shared Platform (internal)
                           │
             ┌─────────────┴─────────────┐
             ↓                           ↓
     NegOSu Automotive          NegOSu Salon & Beauty
             │                           │
      Automotive modules              Salon modules
```

Public marketing content may describe product outcomes but must not expose module names, database concepts, or vertical-adapter architecture. Salon marketing must not use Vehicle, Job Order, inspection, VIN, odometer, or maintenance language.

## Metadata and visual assets

Global browser and share metadata identify NegOSu as a business operating system. Each solution route provides a specific title, description, and canonical path. No Open Graph image is declared until an approved NegOSu asset exists; this avoids publishing a missing or obsolete KarKR image.

The approved light- and dark-background NegOSu logos live in `public/images`. Existing KarKR image assets remain there for compatibility with internal or legacy Automotive surfaces; they are not the NegOSu master logo.

## External setup still required

The repository change does not alter domain/DNS configuration, verified email sender domains, SMS sender names, social profiles, or external marketplace branding. Those require separate provider-side approval and rollout. A dedicated design phase may add approved NegOSu favicon, application icon, and social-share artwork.
