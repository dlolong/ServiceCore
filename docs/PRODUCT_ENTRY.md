# NegOSu Product Entry, Authentication, and Onboarding

NegOSu is the customer-facing business operating system. ServiceCore remains an internal architecture and repository name. The two currently supported commercial verticals are **NegOSu Automotive** and **NegOSu Salon & Beauty**.

```text
                         NegOSu
                 Business Operating System
                           │
                  Shared authentication
                           │
                      Organization
                           │
                 Persisted industry config
               ┌───────────┴───────────┐
               ↓                       ↓
      NegOSu Automotive       NegOSu Salon & Beauty
```

## Public routes and presentation context

- `/` is the shared NegOSu landing page.
- `/automotive` is the NegOSu Automotive solution page.
- `/salon` is the NegOSu Salon & Beauty solution page.
- `/login` and `/signup` are one shared authentication implementation.
- `/sign-in` and `/sign-up` remain compatibility redirects and preserve their query parameters.

An allowlisted `industry=automotive|salon` query may prefill signup and present the matching vertical context in shared auth. It is not authorization and never changes an existing organization. Missing or unsupported context stays generic; generic signup requires the customer to choose one of the supported business types. A prefilled choice remains editable.

## Account and first-business flow

```text
NegOSu entry
↓
Account + Automotive or Salon & Beauty selection
↓
Email verification / shared Supabase identity
↓
Business identity + vertical-specific business type
↓
Transactional Organization + owner membership + free subscription
↓
Recoverable first Branch setup
↓
Derived vertical checklist
↓
Dashboard
```

The browser never submits an owner role. `create_first_organization` derives the user from `auth.uid()`, validates enabled industries and business-type pairing, takes a per-user transaction advisory lock, and creates the organization, owner membership, subscription, and audit record together. Duplicate or concurrent first-organization requests cannot create another first organization.

Organization creation and first-branch creation remain separate transactions deliberately. If identity or organization setup succeeds but the next step is interrupted, login derives the missing step from active membership and Branch records and returns the owner to it. No cleanup or redundant onboarding flags are required. The rolling-deployment compatibility path continues to support legacy Automotive organization creation, but never sends Salon setup to the old Automotive-only RPC.

## Organization resolution and switching

```text
Login
→ active memberships
→ no organization: business setup
→ one organization: branch recovery or dashboard
→ multiple organizations: Choose Business
→ membership-authorized selection
→ HTTP-only active-organization cookie
→ persisted industry config
→ vertical navigation and server route gates
```

The selector and authenticated shell perform a real tenant-context change. The server validates an active membership, clears stale Branch context, and derives either first-branch recovery or the dashboard destination. A missing, forged, or inactive organization cookie never silently selects one of several tenants. Industry presentation and browser state cannot bypass organization membership, role checks, server route/action gates, or RLS.

## Derived vertical onboarding

`modules/platform/onboarding.ts` defines the visible checklist per supported industry. Completion is derived from tenant-scoped Branches, Services/Treatments, additional Staff memberships, Scheduling Resources, Customers/Clients, Vehicles where applicable, and Appointments.

NegOSu Automotive:

```text
Branch → Services → Staff → Service Bays → Customer → Vehicle → Appointment
```

NegOSu Salon & Beauty:

```text
Branch → Treatments → Staff → Chairs / Rooms → Client → Appointment
```

Owners may open the dashboard before the optional checklist is complete and return through **Continue setup**. No setup-completion booleans are stored.

## Branding and legacy compatibility

Customer-facing shared auth, onboarding, organization selection, and application chrome use `NegOSu`, with `NegOSu Automotive` or `NegOSu Salon & Beauty` as subtle product context. ServiceCore remains valid in internal architecture, source paths, database compatibility cookies, and developer documentation. KarKR names may remain in internal Automotive fixtures, symbols, and legacy assets while compatibility work continues; they are not the shared public product identity.

The development seed contains fake Automotive and Salon organizations for cross-vertical switching. It provides no reusable production credential and must never be applied to production.
