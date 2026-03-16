# Idea Lab — DBIT

Team formation platform for first-year students at Don Bosco Institute of Technology, Bangalore. Students self-organize into cross-branch teams of 6 members, with real-time constraint validation and admin oversight.

> **Live** — [idea-lab-sage.vercel.app](https://idea-lab-sage.vercel.app/)
> **Repo** — [github.com/harshaxyZ/idea.lab](https://github.com/harshaxyZ/idea.lab.git)
> **Report** — [IEEE Format (PDF)](report/main.pdf)

---

## Preview

```
┌─────────────────────────────────────────────────────────────────┐
│  IDEA LAB — DBIT                                    [Register]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│   │  Register   │  │  Dashboard  │  │   Browse    │           │
│   │  USN + OTP  │→ │  Team Mgmt  │→ │   Teams     │           │
│   │  3-step     │  │  Invites    │  │   Join/Req  │           │
│   └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│   │   Create    │  │    Team     │  │   Admin     │           │
│   │   Team      │  │   Page      │  │   Panel     │           │
│   │  TEAM-XXXX  │  │  Constraints│  │  6 Tabs     │           │
│   └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                                 │
│   Design: Paper & Ink  │  Auth: OTP + JWT  │  DB: Firestore   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Highlights

- **825+ students** across **7 engineering branches**
- **Real-time constraint validation** — max 4 from one branch, min 2 unique branches, EEE/ECE requirement
- **Custom OTP authentication** via Brevo Email API with rate limiting
- **Admin dashboard** — CSV upload, gate controls, stats, export
- **10,937 lines** of TypeScript | **58 files** | **19 components** | **11 API routes**

### Team

| Name | USN | Role |
|------|-----|------|
| Harsha N | 1DB25CS065 | Developer |
| Mithun Gowda B | 1DB25CS109 | Lead Developer |
| Naren V | 1DB25CS113 | QA & Review |
| Nevil Anson Dsouza | 1DB25CS116 | Developer |

> Dept. of Computer Science & Engineering, Section B — Don Bosco Institute of Technology, Bangalore (VTU)

---

## Table of Contents

- [Overview](#overview)
- [Student Flow](#student-flow)
- [Admin Flow](#admin-flow)
- [Team Constraints](#team-constraints)
- [CSV Format](#csv-format)
- [USN Format & Branch Mapping](#usn-format--branch-mapping)
- [Data Flows](#data-flows)
- [Gate Control System](#gate-control-system)
- [Firestore Schema](#firestore-schema)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)

---

## Overview

Idea Lab enables ~825 first-year students across 7 branches to form cross-disciplinary teams of 6. The platform replaces manual team assignment with a self-service model:

1. Admin uploads student CSV master data
2. Students register using their USN (validated against CSV)
3. Students create teams or browse/join existing ones
4. Team leads manage invites and join requests
5. Admin monitors progress with real-time stats and gate controls

---

## Student Flow

### 0. Landing Page (`/`)

- Logged-in users (session in localStorage) are **redirected to `/dashboard`** automatically
- Hero CTA and bottom CTA show "My Dashboard" if logged in, "Register / Login" if not
- Browse Teams link always visible

### 1. Registration (`/register`)

Registration uses a 3-step flow with **email OTP verification** via custom Brevo Email API:

```
Step 1: USN Validation
─────────────────────
Student enters USN
        |
        v
Format validation (1DB25XX###)
        |
        v
Local validUSNs check + Server-side lookup
POST /api/auth/lookup-usn (admin SDK)
        |
    +---+---+
    |       |
  Found   Not found
    |       |
    v       v
Show email  "USN not found in
from CSV    student database.
(read-only) Contact admin."
    |       (blocked)
    v
"Send Verification Code" button

Step 2: Email OTP Verification
──────────────────────────────
POST /api/auth/send-otp
  → IP rate limit (5 sends/15min)
  → USN validation + email match
  → Generate 6-digit OTP
  → Store in Firestore otp_codes via admin SDK (10min expiry)
  → Send via Brevo Email API (round-robin multi-key)
        |
        v
Student enters code
        |
        v
POST /api/auth/verify-otp
  → IP rate limit (10 attempts/15min)
  → Validate against Firestore otp_codes
  → Max 5 attempts per code
        |
    +---+---+
    |       |
  Valid   Invalid/Expired
    |       |
    v       v
On success: "Invalid or expired
  → Set JWT  code" (retry/resend)
    cookie
  → Create
    Firebase
    custom
    token
    |
    v
60-second resend cooldown

Step 3: Complete Registration (new students)
────────────────────────────────────────────
Confirm name, phone (email locked)
        |
        v
Write to registrations/{USN}
(Firebase Auth active via custom token)
        |
        v
localStorage session + JWT cookie + Firebase Auth
        |
        v
Redirect to /dashboard
```

**Returning students** (USN found in `registrations`):
```
Enter USN → masked email shown → Send OTP → verify → JWT + Firebase Auth → session restored → /dashboard
```

- USN validated against local CSV-derived list + server-side Firebase lookup
- Email verified via custom OTP (Brevo API + Firestore admin SDK) before registration completes
- Returning students see masked email (e.g., `r****l@dbit.in`) and skip registration fields
- Name, email, phone auto-filled from CSV; phone is editable and required (10 digits)
- Branch and section derived from USN automatically

### 2. Dashboard (`/dashboard`)

Protected by `SessionGuard` — validates JWT cookie via `initializeAuth()`, then validates session against Firestore on load and syncs stale `teamId`/`teamRole`.

**Welcome Header** — first-name greeting with branch, section, and USN.

**Pending Invites** — shows all incoming team invites with "Respond" links.

**Leader Panel** (when user is team lead):
- Team name heading with team ID badge
- Leader avatar card with initials, name, USN, branch info
- `TeamStatusBadge` and `BranchConstraintIndicator` shared components
- Member list with Joined/Waiting status indicators
- **Edit mode** toggle to manage pending invites:
  - Remove pending invites
  - Direct invite up to 3 friends by USN (with branch constraint validation via `canAddMember()`)
  - USN lookup checks `registrations` first, then `students` fallback
- Open slot indicators showing remaining capacity
- Progress bar visualizing team completion (joined vs waiting vs total)
- Team ID sharing note for browse discoverability

**Member Panel** (when user is a non-lead team member):
- Team name, ID, member count, and status badge
- Branch constraint indicator
- Link to full team page

**No Team Card** — shown when user has no team, with Create Team and Browse Teams actions.

**Quick Actions** — grid of cards linking to Create Team, Browse Teams, and Check Status.

### 3. Create Team (`/team/create`)

```
Student clicks "Create Team"
        |
        v
Check: teamFormationOpen gate
        |
    +---+---+
    |       |
  Open    Closed
    |       |
    v       v
Show form  "Team Formation
    |       Closed" (locked)
    v
Set team name (optional)
Set visibility (public/private)
        |
        v
Generate TEAM-XXXX ID
        |
        v
Write teams/{TEAM-XXXX} doc
Update registrations/{USN}.teamId
Update localStorage session
        |
        v
Redirect to /team/{TEAM-XXXX}
```

- Student becomes **team lead**
- Team starts with 1 member (the lead) in "forming" status
- Public teams appear in browse; private teams are invite-only

### 4. Team Management (`/team/[teamId]` + Dashboard)

**Team Lead can:**
- Invite up to 3 members directly by USN from the Dashboard (edit mode)
  - Branch constraint validation via `canAddMember()` before sending
  - USN lookup checks `registrations` → `students` fallback
  - Uses shared `generateInviteId()` (unambiguous charset)
- Invite members by USN from the team page (creates invite doc, type: "invite")
- Approve/reject join requests from browse page
- See real-time constraint indicator (branch slots, EEE/ECE check)
- Remove pending invites in edit mode

**All Members can:**
- View team members with status badges (Joined/Invited/Requested)
- See branch distribution and constraint progress

### 5. Browse & Join (`/team/browse`)

```
Student opens Browse Teams
        |
        v
Check: teamFormationOpen gate
        |
    +---+---+
    |       |
  Open    Closed
    |       |
    v       v
Fetch public  "Team Formation
forming teams  Closed" (locked)
    |
    v
Filter/search by name, ID, branch
    |
    v
Click "Request to Join"
    |
    v
Create invites/{INV-XXXXXX} (type: "request")
Add as pending_request member in team
    |
    v
Team lead reviews in their team page
```

### 6. Invite Response (`/invite/[inviteId]`)

When a team lead invites a student:
- Student sees invite details (team name, lead name, current members)
- Accept: updates invite status, adds to team members, updates registration
- Reject: updates invite status, removes pending member from team

---

## Admin Flow

### 1. Login (`/admin`)

- Firebase email/password authentication
- Only authorized admin emails can access
- Responsive sidebar (desktop) / top tabs (mobile) navigation

### 2. Dashboard Tab

- **Total Registrations** — count of `registrations` collection
- **CSV Students** — count of `students` collection (imported records)
- **Teams Forming** — teams with status "forming"
- **Teams Full** — teams with status "full" or "locked"
- **Branch Distribution** — horizontal bar chart showing registrations per branch

### 3. Students Tab

Upload student master data via CSV:

```
Click/drag CSV file
        |
        v
Client-side parse (csvParser.ts)
        |
        v
Preview table (Name, USN, Mobile, Email, Branch)
        |
        v
"Upload X Students" button
        |
        v
Batch write to students/{USN}
(450 docs per Firestore batch)
        |
        v
Update config.csvLastUploadedAt
```

### 4. Registrations Tab

- Searchable, paginated table of all registered students
- Columns: Name, USN, Branch, Section, Team ID, Team Role
- **Export CSV** — downloads all data as `.csv`
- **Export XLS** — downloads all data as `.xlsx` (via xlsx library)
- **Reload Data** button for manual refresh

### 5. Teams Tab

- Filtered view of students who are assigned to teams
- Shows Team ID and Role (Lead/Member) columns

### 6. Admins Tab

- **Authorize Admin** — add email to admin whitelist
- **Authorized Staff** — list current admins with revoke option
- Cannot revoke your own admin access

### 7. Settings Tab

- **Registration Gate** — toggle student registrations open/closed
- **Team Formation Gate** — toggle team creation and joining open/closed
- **Danger Zone** — reset database (requires password re-authentication + type "reset database")
  - Always deletes all `registrations`, `teams`, and `invites` documents
  - Optional: **Clear OTP codes** — checked by default
  - Optional: **Clear CSV student master data** (`students` collection) — unchecked by default
  - Does NOT delete `admins` or `config`

---

## Team Constraints

| Rule | Value | Enforcement |
|------|-------|-------------|
| Team size | Exactly **6** members | Hard block at 6 |
| Max same branch | **4** from one branch | Blocked when adding 5th |
| Min different branches | **2** unique branches | Checked at completion |
| EEE/ECE requirement | At least **1** member | Warning until 6th member, then hard block |

Constraints are validated in real-time during team building via `teamConstraints.ts`:
- `canAddMember(members, newBranch)` — checks before adding
- `validateTeamComposition(members)` — full validation
- `getBranchDistribution(members)` — returns `{ CSE: 2, IOT: 1, ... }`

---

## CSV Format

### Standard Format

```csv
Name,USN,Mobile,Email
Rahul Sharma,1DB25CS001,9876543210,rahul.s@dbit.in
Priya Patel,1DB25EC042,9123456789,priya.p@dbit.in
Arjun Kumar,1DB25IS100,8765432190,arjun.k@dbit.in
```

### Column Rules

| Column | Required | Notes |
|--------|----------|-------|
| `Name` | Yes | Student full name |
| `USN` | Yes | Must match format `1DB25XX###` |
| `Mobile` | No | 10-digit phone number. Also accepts header `Phone` |
| `Email` | No | Student email address |
| `Branch` | No | Auto-derived from USN if omitted |
| `Section` | No | Auto-derived from USN if omitted |

### Parsing Behavior

- Column order does not matter — matched by header name (case-insensitive)
- Handles quoted fields (`"Doe, John"` works correctly)
- Empty USN or Name rows are skipped with per-row error reporting
- Branch/section auto-derived from USN using DBIT 2025 section mapping
- Upload is batched at 450 docs per Firestore write (limit is 500)

---

## USN Format & Branch Mapping

USN format: `1DB25{BRANCH_CODE}{ROLL_NUMBER}`

| Code | Branch | Full Name |
|------|--------|-----------|
| `CS` | CSE | Computer Science & Engineering |
| `IC` | IOT | Internet of Things |
| `CI` | AI&ML | Artificial Intelligence & Machine Learning |
| `AD` | AI&DS | AI & Data Science |
| `IS` | ISE | Information Science & Engineering |
| `EC` | ECE | Electronics & Communication |
| `EE` | EEE | Electrical & Electronics |

### Section Mapping (DBIT 2025)

Sections are determined by branch code and roll number range:

| Branch | Roll Range | Section |
|--------|-----------|---------|
| CS | 001–059 | A |
| CS | 060–118 | B |
| CS | 119–177 | C |
| CS | 178–197 | D |
| IC | 001–037 | D |
| CI | 001–061 | E |
| CI | 062–100 | F |
| AD | 001–024 | F |
| AD | 025–087 | G |
| IS | 001–066 | I |
| IS | 067–130 | J |
| IS | 131–194 | K |
| EC | 001–053 | L |
| EC | 054–108 | M |
| EC | 109–163 | N |
| EE | 001–045 | P |

Example: `1DB25CS075` → Branch: **CSE**, Section: **B**

---

## Data Flows

### Registration Flow

```
[Student]                    [Server API]             [Firestore]
    |                            |                         |
    |-- Enter USN ------------->|                         |
    |                            |-- /api/auth/lookup-usn  |
    |                            |   (admin SDK lookup)    |
    |<-- Show email from CSV ---|                         |
    |                            |                         |
    |-- "Send OTP" ------------>|                         |
    |                            |-- /api/auth/send-otp    |
    |                            |   IP rate limit check   |
    |                            |   Store OTP (admin SDK) |
    |<-- 6-digit code to email -|   Send via Brevo API    |
    |                            |                         |
    |-- Enter code ------------>|                         |
    |                            |-- /api/auth/verify-otp  |
    |                            |   Validate OTP          |
    |                            |   Create JWT cookie     |
    |                            |   Create Firebase token |
    |<-- JWT + custom token ----|                         |
    |                            |                         |
    |-- signInWithCustomToken   |                         |
    |-- Confirm & Submit ------>|                         |
    |                            |-- Write registrations/  |
    |<-- Session created -------|                         |
    |                            |                         |
    |-- Redirect /dashboard     |                         |
```

### Team Creation Flow

```
[Team Lead]                  [Firestore]
    |                            |
    |-- Create Team ----------->|
    |                            |-- Write teams/{TEAM-XXXX}
    |                            |-- Update registrations/{USN}.teamId
    |<-- Redirect to team ------|
```

### Invite Flow

```
[Team Lead]      [Firestore]      [Brevo API]      [Invitee]
    |                |                |                |
    |-- Invite USN ->|                |                |
    |                |-- Write        |                |
    |                |   invites/     |                |
    |                |   {INV-XXXX}   |                |
    |                |                |                |
    |-- POST /api/notify/email ------>|                |
    |   (fire-and-forget)             |-- Email ------>|
    |                |                |  invite link   |
    |                |                |                |
    |                |<------------- Open link --------|
    |                |                                 |
    |                |-- Accept ---------------------->|
    |                |   Update invite, team, reg      |
```

### Join Request Flow

```
[Student]        [Firestore]      [Brevo API]      [Team Lead]
    |                |                |                |
    |-- Request ---->|                |                |
    |   Join         |-- Write        |                |
    |                |   invites/     |                |
    |                |   (type:       |                |
    |                |    request)    |                |
    |                |                |                |
    |-- POST /api/notify/email ------>|                |
    |   (fire-and-forget)             |-- Email ------>|
    |                |                |  review req    |
    |                |                |                |
    |                |<------------- Approve? ---------|
    |                |                                 |
    |<-- Added ------|   Update all documents          |
    |   to team      |                                 |
```

### Admin CSV Upload Flow

```
[Admin]                      [Firestore]
    |                            |
    |-- Upload .csv file         |
    |                            |
    |-- Client-side parse        |
    |   (csvParser.ts)           |
    |                            |
    |-- Preview table shown      |
    |                            |
    |-- Confirm upload --------->|
    |                            |-- Batch write students/{USN}
    |                            |   (450 per batch)
    |                            |-- Update config.csvLastUploadedAt
    |<-- "X students imported" --|
```

---

## Gate Control System

Admins control two independent gates from the Settings tab:

| Gate | Controls | When Closed |
|------|----------|-------------|
| **Registration Gate** | `/register` page | Shows "Registrations Closed" with lock icon |
| **Team Formation Gate** | `/team/create` and `/team/browse` | Shows "Team Formation Closed" with lock icon |

Both gates are stored in `config/global_config` document:

```json
{
  "registrationsOpen": true,
  "teamFormationOpen": true,
  "csvLastUploadedAt": "..."
}
```

Gates take effect immediately — no restart required. Students see a locked state with a message explaining why access is restricted.

---

## Firestore Schema

### `students` (CSV-imported master data)

```
Document ID: USN (e.g., "1DB25CS001")
{
  usn: "1DB25CS001",
  name: "Rahul Sharma",
  email: "rahul.s@dbit.in",
  phone: "9876543210",
  branch: "CSE",           // auto-derived from USN
  section: "A",            // auto-derived from USN
  importedAt: Timestamp,
  importBatch: "batch_1710000000000"
}
```

### `registrations` (registered students)

```
Document ID: USN
{
  usn: "1DB25CS001",
  name: "Rahul Sharma",
  email: "rahul.s@dbit.in",
  phone: "9876543210",
  branch: "CSE",
  section: "A",
  teamId: "TEAM-A1B2" | null,
  teamRole: "lead" | "member" | null,
  registeredAt: Timestamp
}
```

### `teams` (self-organized teams)

```
Document ID: "TEAM-XXXX" (4 alphanumeric chars)
{
  teamId: "TEAM-A1B2",
  name: "Innovators" | null,
  leadUSN: "1DB25CS001",
  members: [
    { usn, name, branch, section, status: "approved"|"pending_invite"|"pending_request", joinedAt }
  ],
  memberCount: 3,
  status: "forming" | "full" | "locked",
  branchDistribution: { "CSE": 2, "ECE": 1 },
  isPublic: true,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `invites` (invite/request documents)

```
Document ID: "INV-XXXXXX" (6 alphanumeric chars)
{
  inviteId: "INV-A1B2C3",
  type: "invite" | "request",
  teamId: "TEAM-A1B2",
  teamName: "Innovators" | null,
  fromUSN: "1DB25CS001",
  fromName: "Rahul Sharma",
  toUSN: "1DB25EC042",
  toName: "Priya Patel",
  status: "pending" | "approved" | "rejected" | "expired",
  createdAt: Timestamp,
  respondedAt: Timestamp | null
}
```

### `config` (global configuration)

```
Document ID: "global_config"
{
  registrationsOpen: true,
  teamFormationOpen: true,
  csvLastUploadedAt: Timestamp
}
```

### `notifications` (real-time notification system)

```
Document ID: auto-generated (timestamp + random)
{
  id: "1710432000000_a1b2c3",
  userId: "1DB25EC042",           // recipient USN
  type: "invite_received" | "request_received" | "invite_accepted" |
        "invite_rejected" | "request_approved" | "request_rejected" |
        "kicked_from_team" | "lead_transferred" | "member_left_team" |
        "team_dissolved",
  title: "Team Invite",
  message: "Rahul invited you to join Innovators",
  teamId: "TEAM-A1B2",
  teamName: "Innovators" | null,
  fromUSN: "1DB25CS001",
  fromName: "Rahul Sharma",
  linkUrl: "/dashboard",
  read: false,
  createdAt: Timestamp
}
```

### `otp_codes` (email verification codes)

```
Document ID: auto-generated
{
  email: "student@dbit.in",
  otp: "482917",
  expiresAt: 1710432600000,       // 10 minutes from creation
  used: false,
  attempts: 0,                    // max 5, then invalidated
  createdAt: 1710432000000
}
```

### `admins` (admin whitelist)

```
Document ID: email with @ and . replaced by _
{
  email: "admin@dbit.in"
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | Firebase Firestore |
| Admin Auth | Firebase Authentication (email/password) |
| Student Auth | Custom OTP (Brevo Email API) + JWT cookies + Firebase custom tokens |
| Server SDK | Firebase Admin SDK (Firestore admin access, custom token creation) |
| JWT | jose (HS256, Edge-compatible) |
| Rate Limiting | In-memory IP-based rate limiter |
| Notifications | Real-time Firestore onSnapshot + Browser Notification API + Brevo email |
| Styling | Custom CSS (Paper & Ink design system) |
| Icons | Lucide React |
| Export | xlsx library for .xlsx downloads |
| Session | JWT httpOnly cookie (auth) + localStorage (UI cache) |
| Fonts | Bebas Neue (headings), Instrument Sans (body) |

### Design System: Paper & Ink

Minimal, print-inspired aesthetic using CSS custom properties:

| Variable | Value | Usage |
|----------|-------|-------|
| `--ink` | `#0D0D0D` | Text, borders, primary actions |
| `--paper` | `#F2EFE9` | Background |
| `--paper2` | `#E8E4DD` | Secondary background |
| `--red` | `#E8341A` | Accent, errors, danger |
| `--muted` | `#7A7670` | Secondary text |
| `--line` | `rgba(13,13,13,0.12)` | Subtle borders |

---

## Project Structure

```
src/
├── middleware.ts             # Route protection, origin checking, security headers
├── app/
│   ├── layout.tsx             # Root layout (fonts, global CSS, AuthProvider)
│   ├── page.tsx               # Landing page
│   ├── globals.css            # All styles (Paper & Ink design system)
│   ├── register/page.tsx      # Student registration
│   ├── dashboard/page.tsx     # Student dashboard
│   ├── status/page.tsx        # USN status lookup
│   ├── join/page.tsx          # Legacy join redirect
│   ├── admin/page.tsx         # Admin panel (sidebar + tabs)
│   ├── api/
│   │   ├── auth/
│   │   │   ├── send-otp/route.ts       # IP rate-limited OTP generation via admin SDK
│   │   │   ├── verify-otp/route.ts     # OTP verification → JWT cookie + Firebase custom token
│   │   │   ├── lookup-usn/route.ts     # Server-side USN lookup (admin SDK, pre-auth)
│   │   │   ├── firebase-token/route.ts # Refresh Firebase custom token from JWT cookie
│   │   │   └── logout/route.ts         # Clear JWT session cookie
│   │   └── notify/
│   │       └── email/route.ts          # Email notifications for invites & join requests (Brevo)
│   ├── team/
│   │   ├── create/page.tsx    # Create new team (gate-checked)
│   │   ├── browse/page.tsx    # Browse open teams (gate-checked)
│   │   └── [teamId]/page.tsx  # Team detail view
│   └── invite/
│       └── [inviteId]/page.tsx # Invite response page
├── components/
│   ├── AuthProvider.tsx              # Firebase Auth state context (wraps app)
│   ├── Navbar.tsx                    # Shared nav (session-aware, notification bell)
│   ├── NotificationBell.tsx          # Bell icon + dropdown + toast for notifications
│   ├── SessionGuard.tsx              # Auth wrapper (JWT + Firestore validation)
│   ├── StudentRegistrationForm.tsx   # USN-validated registration form
│   ├── TeamCard.tsx                  # Team card for browse grid
│   ├── TeamMemberList.tsx            # Member list with status badges
│   ├── TeamStatusBadge.tsx           # Forming/Full/Locked badge
│   ├── BranchConstraintIndicator.tsx # Visual branch slot display
│   ├── InviteManager.tsx             # Team lead: send invites by USN
│   ├── JoinRequestManager.tsx        # Team lead: approve/reject requests
│   ├── InviteResponseCard.tsx        # Accept/reject invite UI
│   ├── CSVUploader.tsx               # Admin CSV upload with preview
│   ├── AdminStats.tsx                # Dashboard stats cards (4-grid)
│   ├── StudentTable.tsx              # Searchable table with CSV/XLS export
│   └── StatusLookup.tsx              # USN lookup with team details
├── hooks/
│   └── useNotifications.ts    # Real-time Firestore notification listener
└── lib/
    ├── firebase.ts            # Firebase client SDK config (singleton)
    ├── firebase-admin.ts      # Firebase Admin SDK (server-side, custom tokens)
    ├── jwt.ts                 # JWT session signing/verification (jose, HS256)
    ├── rate-limit.ts          # In-memory IP rate limiter with auto-cleanup
    ├── notifications.ts       # createNotification() helper
    ├── types.ts               # All TypeScript interfaces
    ├── session.ts             # localStorage + initializeAuth() + fullLogout()
    ├── teamConstraints.ts     # Team composition validation
    ├── csvParser.ts           # CSV parser (Name,USN,Mobile,Email)
    ├── xlsExport.ts           # XLS file generation
    ├── idGenerator.ts         # TEAM-XXXX and INV-XXXXXX generators
    ├── usnValidator.ts        # USN format, branch, section validation
    ├── validUSNs.ts           # Static USN list (CSV-derived)
    └── matchingAlgorithm.ts   # Pair matching (legacy fallback)

firestore.rules              # Firestore security rules (deploy separately)
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in Firebase client config, Firebase Admin service account key,
# JWT secret, Brevo API key, and admin emails

# Generate JWT secret
openssl rand -base64 32
# Paste output as JWT_SECRET in .env.local

# Run development server
npm run dev

# Deploy Firestore rules (after all code is deployed)
firebase deploy --only firestore:rules
```

---

## Environment Variables

Create `.env.local` with your config (see `.env.example`):

```env
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (server-side only)
# Firebase Console → Project Settings → Service Accounts → Generate New Private Key
# Paste the entire JSON as a single-line string
FIREBASE_SERVICE_ACCOUNT_KEY=

# JWT Session Secret (generate with: openssl rand -base64 32)
JWT_SECRET=

# Admin emails (comma-separated)
ADMIN_EMAILS=admin@dfriendsclub.in

# Brevo Email API (single key)
BREVO_API_KEY=
BREVO_SENDER_EMAIL=

# Brevo Multi-key (optional — round-robin with auto-fallback)
# BREVO_KEYS=apikey1:sender1@email.com,apikey2:sender2@email.com

# Origin allowlist (comma-separated, optional)
# ALLOWED_ORIGINS=https://idealab.dfriendsclub.in,http://localhost:3000
```

### Firebase Admin Setup

1. Go to Firebase Console → **Project Settings → Service Accounts**
2. Click **Generate New Private Key** — downloads a JSON file
3. Paste the entire JSON (as a single line) into `FIREBASE_SERVICE_ACCOUNT_KEY`
4. This enables server-side Firestore access and custom token creation

### Brevo Setup

1. Create a free account at [brevo.com](https://brevo.com) (300 emails/day)
2. Go to **Settings → Senders & IPs → Senders** — add and verify your sender email
3. Go to **Settings → SMTP & API → API Keys** — generate an API v3 key
4. Copy the API key and verified sender email into `.env.local`
5. For higher volume, create multiple Brevo accounts and use `BREVO_KEYS` for round-robin

> **Fallback mechanism**: If `BREVO_KEYS` is set, the system distributes emails across keys in round-robin fashion. If one key fails (rate limit, error), it automatically tries the next key.

> **Email notifications**: The same Brevo keys are used for team invite and join request email notifications (`POST /api/notify/email`). This uses a separate round-robin counter from OTP emails. Notifications are fire-and-forget — if email sending fails, in-app notifications still work.

---

## Security Architecture

### Authentication Layers

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| **JWT Cookie** | `idealab_token` (httpOnly, SameSite=lax, HS256) | Server-side session — verified by middleware |
| **Firebase Custom Token** | Created by admin SDK on OTP verify | Client-side Firestore auth — enforces security rules |
| **localStorage** | `idealab_session` (UI data cache) | Fast client-side rendering of user info |

### Auth Flow

1. Student verifies OTP → server creates JWT cookie + Firebase custom token
2. Middleware checks JWT on protected routes (`/dashboard`, `/team/create`)
3. `AuthProvider` restores Firebase Auth from JWT cookie on page load
4. `SessionGuard` validates JWT + Firestore record before rendering
5. Logout clears all three layers (cookie + Firebase signOut + localStorage)

### Route Protection (Middleware)

| Route | Protection |
|-------|-----------|
| `/dashboard/*`, `/team/create/*` | JWT cookie required → redirect to `/register` |
| `/admin/*` | Passes through (uses own Firebase email/password auth) |
| `/api/*` | Origin checking (blocks cross-origin requests) |
| All routes | Security headers (CSP, HSTS, X-Frame-Options, etc.) |

### API Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/auth/send-otp` | 5 requests per IP | 15 minutes |
| `POST /api/auth/verify-otp` | 10 attempts per IP | 15 minutes |
| Per-OTP attempts | 5 attempts | Until expired |
| Per-email cooldown | 1 OTP | 60 seconds |

### Firestore Security Rules

All client-side Firestore access requires Firebase Auth (`auth != null`). Key authorization rules:

- **registrations**: Only self can create/update; team lead can set `teamId`/`teamRole`
- **invites**: Only `fromUSN` can create; only participants can update
- **notifications**: Only recipient can read/update; `fromUSN` must match creator
- **otp_codes**: Client access denied (admin SDK only)
- **config**: Publicly readable (non-sensitive status flags)
- **students**: Read-only for authenticated users

Deploy rules: `firebase deploy --only firestore:rules`

### Security Headers

| Header | Value |
|--------|-------|
| `X-Frame-Options` | DENY |
| `X-Content-Type-Options` | nosniff |
| `Referrer-Policy` | strict-origin-when-cross-origin |
| `Permissions-Policy` | camera=(), microphone=(), geolocation=() |
| `Content-Security-Policy` | Restricts scripts, styles, fonts, connections |
| `Strict-Transport-Security` | max-age=31536000; includeSubDomains |
| `X-Powered-By` | Removed |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| USN not in CSV | "USN not found in student database" — registration blocked |
| Network error on USN lookup | "Could not verify USN" — registration blocked |
| OTP send failure | Error message shown, can retry |
| Invalid/expired OTP | "Invalid or expired code" — can retry or resend after 60s cooldown |
| Team full (6 members) | Join/invite blocked |
| 5th same-branch member | `canAddMember()` returns false |
| Team complete without EEE/ECE | Warning during building, hard block at 6th member |
| Already on a team | "You're already on a team" with link to current team |
| Duplicate join request | "You already have a pending request for this team" |
| Race condition (team filled during invite) | Final `canAddMember()` check before Firestore write |
| CSV parse errors | Per-row error reporting with row numbers |
| Database reset | Requires password re-auth + confirmation phrase |
