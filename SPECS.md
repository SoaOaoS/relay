# Relay — Complete Product Specification v1.0

> **Product:** Relay — Your personal AI assistant that does things
> **Status:** Draft v1.0
> **Last Updated:** 2026-08-05

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Personas](#2-user-personas)
3. [Information Architecture](#3-information-architecture)
4. [Screen-by-Screen Spec](#4-screen-by-screen-spec)
5. [Component Tree](#5-component-tree)
6. [Data Model](#6-data-model)
7. [API Specification](#7-api-specification)
8. [State Management](#8-state-management)
9. [Error Handling](#9-error-handling)
10. [Edge Cases](#10-edge-cases)
11. [Performance Budget](#11-performance-budget)
12. [Security Model](#12-security-model)
13. [Accessibility](#13-accessibility)
14. [Internationalization](#14-internationalization)
15. [Analytics & Monitoring](#15-analytics--monitoring)
16. [Testing Strategy](#16-testing-strategy)
17. [Deployment Architecture](#17-deployment-architecture)
18. [Future Considerations](#18-future-considerations)

---

## 1. Product Overview

### 1.1 Elevator Pitch
Relay is an AI assistant that doesn't just chat — it acts. It searches the web, makes phone calls, edits files, browses GitHub, and executes tasks. One conversation, infinite possibilities.

### 1.2 Target Audience
- **Primary:** Solo developers, indie hackers, technical founders
- **Secondary:** Small business owners, freelancers, power users
- **Tertiary:** Non-technical users who want a "personal assistant"

### 1.3 Core Value Proposition
- **Save time:** Relay does tasks the user would do manually (research, calls, file editing)
- **One interface:** No switching between browser, phone, editor, GitHub
- **Always available:** 24/7, no scheduling, no waiting

### 1.4 Key Differentiators
- AI phone calls (unique vs ChatGPT, Claude, Copilot)
- MCP tool ecosystem (extensible)
- Web search + GitHub + files in one chat
- Simple pricing, no enterprise bloat

### 1.5 Success Metrics
- **Activation:** User sends 5+ messages in first session
- **Retention:** User returns 3+ times in first week
- **Conversion:** Free → Pro within 30 days
- **Engagement:** Avg 20+ messages/week per active user
- **Calls:** 10% of active users make at least 1 call/week
- **NPS:** > 40 after 30 days

---

## 2. User Personas

### 2.1 Alex — The Solo Developer
- **Age:** 28
- **Occupation:** Freelance full-stack developer
- **Tech level:** Expert
- **Pain points:** Spends hours on research, code review, debugging. Hates phone calls.
- **Uses Relay for:** Code review, GitHub PR analysis, web research, calling clients
- **Plan:** Pro ($29/mo)
- **Key needs:** Fast responses, code syntax highlighting, GitHub integration

### 2.2 Sarah — The Small Business Owner
- **Age:** 35
- **Occupation:** Runs an online boutique
- **Tech level:** Moderate
- **Pain points:** Too many tools, hates admin tasks, needs to call suppliers
- **Uses Relay for:** Researching products, comparing prices, calling suppliers, drafting emails
- **Plan:** Pro ($29/mo)
- **Key needs:** Simple interface, phone calls, document help

### 2.3 Marcus — The Power User
- **Age:** 42
- **Occupation:** Tech lead at a startup
- **Tech level:** Expert
- **Pain points:** Overwhelmed by context switching, needs a "second brain"
- **Uses Relay for:** Everything — research, coding, calls, automation
- **Plan:** Unlimited ($99/mo)
- **Key needs:** Unlimited usage, all tools, priority support

### 2.4 Claire — The Casual User
- **Age:** 24
- **Occupation:** Marketing coordinator
- **Tech level:** Low
- **Pain points:** Needs quick answers, doesn't want complexity
- **Uses Relay for:** Quick web searches, simple writing tasks
- **Plan:** Free
- **Key needs:** Simple, no setup, works immediately

---

## 3. Information Architecture

### 3.1 Site Map

```
relay.com (Landing)
├── / (Hero, features, pricing, CTA)
├── /features (Detailed feature breakdown)
├── /pricing (Pricing table)
└── /blog (Content marketing)

app.relay.com (Application)
├── /auth
│   ├── /login (Magic link request)
│   ├── /callback (OAuth callback)
│   └── /confirm (Email confirmed)
├── /dashboard (Main app)
│   ├── / (Chat interface)
│   │   ├── Sidebar
│   │   │   ├── New conversation button
│   │   │   ├── Conversation list
│   │   │   └── User menu (plan, settings, logout)
│   │   ├── Chat area
│   │   │   ├── Message list (streaming)
│   │   │   ├── Input bar
│   │   │   └── Tool indicators
│   │   └── Tools panel (slide-over)
│   ├── /settings
│   │   ├── Profile (name, email, avatar)
│   │   ├── Plan (current plan, upgrade, cancel)
│   │   ├── API Keys (generate/manage)
│   │   ├── Notifications (email preferences)
│   │   └── Danger zone (delete account)
│   ├── /calls
│   │   ├── Call history list
│   │   └── Call detail (transcript, summary, audio)
│   └── /billing
│       ├── /upgrade (Plan selection)
│       ├── /manage (Stripe customer portal)
│       └── /history (Invoice list)
└── /api (Internal)
    ├── /chat (POST)
    ├── /mcp (POST)
    ├── /vapi/call (POST)
    ├── /vapi/webhook (POST)
    ├── /stripe/checkout (POST)
    ├── /stripe/webhook (POST)
    ├── /stripe/portal (GET)
    └── /user (GET, PATCH)
```

### 3.2 Navigation Flow

```
Landing Page
  │
  ├── [Get Started] → /auth/login
  │
  └── [Learn More] → Scroll to features

Auth
  │
  ├── [Enter Email] → Magic link sent
  │   └── [Click Link] → /auth/callback → /dashboard
  │
  └── [Already have account?] → /auth/login

Dashboard
  │
  ├── [New Conversation] → Clear chat, focus input
  ├── [Select Conversation] → Load messages
  ├── [Type + Enter] → Send message → Stream response
  ├── [Call Button] → Phone modal → Initiate call
  ├── [Tools Button] → Toggle tools panel
  ├── [Settings] → /dashboard/settings
  ├── [Call History] → /dashboard/calls
  └── [Upgrade] → /dashboard/billing/upgrade
```

---

## 4. Screen-by-Screen Spec

### 4.1 Landing Page (`relay.com`)

**Purpose:** Convert visitors into signups

**Sections:**

#### 4.1.1 Navigation Bar
- **Logo:** "Relay" text + icon (lightning bolt or "R")
- **Links:** How it works, Features, Pricing
- **CTA:** "Get started" button (blue, pill-shaped)
- **Behavior:** Transparent on hero, white with shadow on scroll
- **Mobile:** Hamburger menu with same links

#### 4.1.2 Hero Section
- **Headline:** "An assistant that does things."
- **Subheadline:** "Not just chat. Relay researches the web, makes phone calls, edits files, browses GitHub, and gets real work done."
- **CTAs:** "Try Relay free" (primary), "See how it works" (secondary)
- **Demo card:** Animated chat showing a real use case (search + call)
- **States:**
  - **Loading:** Skeleton shimmer on demo card
  - **Error:** N/A (static page)
  - **Empty:** N/A
  - **Edge case:** Very long headlines wrap gracefully

#### 4.1.3 Social Proof Bar
- **Text:** "Trusted by solo founders and small teams"
- **Logos:** Placeholder logos (indiehackers, producthunt, hackernews, dev.to)
- **States:** Static, no interaction

#### 4.1.4 How It Works Section
- **3 steps:** Ask → Relay acts → Get results
- **Each step:** Number, title, description
- **States:** Scroll reveal animation

#### 4.1.5 Features Section
- **Grid of 6 feature cards:** Smart conversations, Web search, Phone calls, Documents, GitHub, Task automation
- **Each card:** Icon, title, short description
- **States:** Hover lifts card slightly

#### 4.1.6 Phone Calls Demo Section
- **Two-column layout:** Call in progress → Call completed
- **Left column:** Live transcript showing Relay speaking French to a store
- **Right column:** Summary with bullet points
- **States:** Static mockup, no interaction

#### 4.1.7 Testimonials Section
- **4 testimonial cards:** 2x2 grid
- **Each card:** Star rating, quote, author name + title
- **States:** Scroll reveal

#### 4.1.8 Pricing Section
- **3 plans:** Free ($0), Pro ($29), Unlimited ($99)
- **Each card:** Plan name, price, feature list, CTA button
- **Pro card:** Highlighted with "Most popular" badge
- **States:**
  - **Hover:** Card lifts slightly
  - **CTA click:** Redirects to /auth

#### 4.1.9 CTA Section
- **Headline:** "Ready to try Relay?"
- **Subtext:** "Free to start. No credit card required."
- **Button:** "Try Relay free"
- **States:** Scroll reveal

#### 4.1.10 Footer
- **Text:** "Relay — Your personal AI assistant."
- **Links:** Privacy, Terms, Contact (placeholder)

**Responsive Breakpoints:**
- **Desktop (>1024px):** Full layout, 3-column pricing
- **Tablet (768-1024px):** 2-column features, stacked pricing
- **Mobile (<768px):** Single column, hamburger nav, stacked everything

**Edge Cases:**
- Very long headlines: Clamp to 2 lines on mobile
- Slow connection: Fonts load from CDN, critical CSS inline
- No JavaScript: Basic HTML fallback with links to auth

---

### 4.2 Auth Page (`/auth`)

**Purpose:** Sign in or sign up via magic link

**States:**

#### 4.2.1 Initial State
- **Logo:** Relay icon centered
- **Title:** "Welcome to Relay"
- **Subtitle:** "Sign in with your email"
- **Input:** Email field with validation
- **Button:** "Send magic link"
- **Link:** "Back to home"

#### 4.2.2 Loading State
- Button shows "Sending..."
- Input disabled
- No double-submit possible

#### 4.2.3 Success State
- Checkmark icon (green)
- Title: "Check your email"
- Message: "We sent a magic link to [email]. Click it to sign in."
- No further action needed

#### 4.2.4 Error States
- **Invalid email:** "Please enter a valid email address" (inline validation)
- **Rate limited:** "Too many requests. Please wait a minute."
- **Network error:** "Could not send email. Please try again."
- **Unknown error:** "Something went wrong. Please try again."

**Edge Cases:**
- User enters email with typos: Validate format, suggest correction
- User tries to sign in with same email twice: Show success state (idempotent)
- User closes tab after sending: Magic link still works
- Magic link expired: Show "Link expired. Request a new one." with button
- User already signed in: Redirect to /dashboard

---

### 4.3 Dashboard (`/dashboard`)

**Purpose:** Main chat interface — the core product

**Layout:** Three-panel (sidebar, chat, optional tools panel)

#### 4.3.1 Sidebar

**Components:**
- **Logo + brand:** "Relay" with icon
- **New conversation button:** Dashed border, "New conversation"
- **Conversation list:** Scrollable, shows last 50 conversations
- **User section:** Plan badge, message count, upgrade button, sign out

**States:**
- **Loading:** Skeleton placeholders for conversation list
- **Empty (no conversations):** "No conversations yet. Start one!"
- **List loaded:** Show conversations with title, date
- **Active conversation:** Highlighted with blue background
- **Collapsed:** Hidden, toggle button in top bar

**Interactions:**
- Click conversation → Load messages, set active
- Click "New" → Clear active, focus input
- Right-click conversation → Context menu (rename, delete)
- Drag conversation → Reorder (future)

**Edge Cases:**
- 50+ conversations: Virtual scroll or pagination
- Very long titles: Truncate with ellipsis
- Deleted conversation: Remove from list, show toast
- All conversations deleted: Show empty state

#### 4.3.2 Top Bar

**Components:**
- **Sidebar toggle:** Hamburger icon (when sidebar hidden)
- **Title:** Current conversation title (editable on click)
- **Actions:** Tools toggle, Call button, Settings (gear icon)

**States:**
- **No active conversation:** Title shows "New conversation"
- **Editing title:** Input replaces text, save on blur/Enter

**Edge Cases:**
- Empty title: Revert to "New conversation"
- Very long title: Truncate with ellipsis

#### 4.3.3 Chat Area

**Components:**
- **Message list:** Scrollable, newest at bottom
- **Empty state:** Bot icon + "What can I help you with?" + suggestions
- **User messages:** Right-aligned, blue background
- **Assistant messages:** Left-aligned, gray background, markdown rendered
- **Streaming indicator:** Typing dots animation
- **Tool usage badges:** Small tags showing which tools were used

**Message Types:**
1. **Text:** Standard markdown message
2. **Code block:** Syntax highlighted, copy button, language label
3. **Tool result:** Collapsible section showing tool output
4. **Call result:** Phone icon, duration, transcript link
5. **Error:** Red background, error message, retry button
6. **System:** Centered, muted text (e.g., "Conversation started")

**States:**
- **Loading history:** Spinner in center
- **Empty:** Welcome message with suggestion chips
- **Streaming:** Typing dots → message appears incrementally
- **Complete:** Full message with all formatting
- **Error:** Error banner with retry

**Interactions:**
- Click code block → Copy to clipboard
- Click link → Open in new tab
- Hover message → Show timestamp
- Long-press message → Show context menu (copy, delete, report)

**Edge Cases:**
- Very long messages: Max height with scroll, "Show more" button
- Many code blocks: Each independently scrollable
- Malformed markdown: Render as plain text
- XSS in markdown: Sanitize all HTML
- Message exceeds context window: Show warning, summarize older messages

#### 4.3.4 Input Bar

**Components:**
- **Text input:** Multi-line, auto-resize, placeholder text
- **Send button:** Blue, disabled when empty/sending
- **Character count:** Optional, shown when approaching limit

**States:**
- **Empty:** Placeholder "Ask me anything..."
- **Typing:** Auto-resize up to 6 lines, then scroll
- **Sending:** Button disabled, shows spinner
- **At limit:** Warning message "You've reached your message limit. Upgrade to Pro."

**Interactions:**
- Enter → Send (Shift+Enter → new line)
- Paste → Handle text, images (future), files (future)
- Cmd+K → Open command palette (future)

**Edge Cases:**
- Very long input: Max 4000 chars, show counter
- Paste rich text: Strip formatting, keep plain text
- Paste image: Show preview, upload (future)
- Network offline: Show "No connection" warning, queue message

#### 4.3.5 Tools Panel (Slide-over)

**Components:**
- **Title:** "MCP Tools"
- **Description:** "Toggle tools the AI can use"
- **Tool list:** Checkbox + name + description for each tool
- **Tool categories:** Grouped by type (Web, GitHub, Files, Phone)

**Tools:**
| ID | Name | Description | Category | Default |
|----|------|-------------|----------|---------|
| web-search | Web Search | Search the web for information | Web | On |
| web-fetch | Web Fetch | Fetch and read web pages | Web | On |
| github-search | GitHub Search | Search code, issues, PRs | GitHub | On |
| github-read | GitHub Read | Read files and repos | GitHub | On |
| file-read | File Read | Read files from workspace | Files | Off |
| file-write | File Write | Write and edit files | Files | Off |
| file-glob | File Search | Search files by pattern | Files | Off |
| phone-call | Phone Call | Make AI phone calls | Phone | On |

**States:**
- **Open:** Slides in from right, 280px wide
- **Closed:** Hidden, toggle button in top bar
- **Mobile:** Full-screen overlay

**Edge Cases:**
- All tools disabled: AI can still chat, just no tool access
- Tool unavailable on plan: Show lock icon, "Upgrade to Pro"

---

### 4.4 Phone Call Modal

**Purpose:** Initiate an AI phone call

**Components:**
- **Title:** "Make a phone call"
- **Description:** "Relay will call this number and handle the conversation."
- **Input:** Phone number field (E.164 format)
- **Buttons:** Cancel, Call

**States:**
- **Closed:** Hidden
- **Open:** Overlay with centered modal
- **Calling:** Button shows "Calling...", input disabled
- **Success:** Modal closes, call result appears in chat
- **Error:** Error message in modal, retry option

**Validation:**
- Must be valid E.164 format (+33634554177)
- Must not be empty
- Must not be a premium rate number (future)

**Edge Cases:**
- User enters number without country code: Auto-add +33 (France) or user's country
- User enters letters: Strip non-numeric characters
- Call fails: Show error, offer retry
- Number is busy: Vapi handles retry, report back
- User closes modal during call: Call continues, result appears in chat

---

### 4.5 Settings Page (`/dashboard/settings`)

**Purpose:** User account management

**Tabs:**

#### 4.5.1 Profile
- **Avatar:** Upload, crop, preview
- **Name:** Text input
- **Email:** Read-only (change via Supabase)
- **Save button:** Updates profile

#### 4.5.2 Plan & Billing
- **Current plan:** Card showing plan name, features, price
- **Usage:** Progress bar for messages, calls this month
- **Upgrade button:** If on Free
- **Manage subscription:** Link to Stripe Customer Portal
- **Cancel:** Confirmation dialog, then cancel subscription

#### 4.5.3 API Keys (Future)
- **Key list:** Name, prefix, created date, last used
- **Create key:** Name input, scope selection, generated key (shown once)
- **Revoke key:** Confirmation dialog
- **Rate limits:** Display current limits

#### 4.5.4 Notifications
- **Email preferences:** Toggles for:
  - Monthly usage report
  - Call transcripts
  - Product updates
  - Billing reminders

#### 4.5.5 Danger Zone
- **Delete account:** Confirmation dialog (type "DELETE" to confirm)
- **Data export:** Download all conversations as JSON/CSV

**Edge Cases:**
- User tries to downgrade: Show warning about losing features
- User cancels mid-cycle: Access until end of billing period
- Delete account: Cascade delete all data, cancel subscription

---

### 4.6 Call History Page (`/dashboard/calls`)

**Purpose:** View past phone calls

**Components:**
- **Call list:** Table/cards with date, number, duration, status
- **Call detail:** Expandable row showing transcript + summary
- **Filters:** Date range, status (completed, failed)
- **Search:** Search by phone number

**States:**
- **Loading:** Skeleton rows
- **Empty:** "No calls yet. Ask Relay to make a call!"
- **List loaded:** Show calls, newest first
- **Error:** "Could not load calls. Please try again."

**Edge Cases:**
- Very long transcripts: Collapse with "Show full transcript"
- Call failed: Show error reason if available
- Call in progress: Show "In progress" status, auto-refresh

---

### 4.7 Billing Page (`/dashboard/billing`)

**Purpose:** Upgrade or manage subscription

**Components:**
- **Current plan:** Highlighted card
- **Other plans:** Comparison cards
- **Feature comparison:** Table of all features per plan
- **Payment method:** Managed via Stripe

**States:**
- **Loading:** Skeleton cards
- **Already on highest plan:** "You're on the Unlimited plan"
- **Upgrade success:** Confirmation with next steps
- **Error:** "Payment failed. Please try a different card."

**Edge Cases:**
- User already has active subscription: Show "Manage" instead of "Upgrade"
- Payment fails: Show specific error (card declined, insufficient funds)
- Coupon code: Input field (future)
- Annual vs monthly: Toggle (future)

---

## 5. Component Tree

```
App
├── Providers
│   ├── AuthProvider (Supabase session context)
│   ├── ThemeProvider (dark/light mode)
│   └── AnalyticsProvider
│
├── Layout
│   ├── Navbar (landing only)
│   └── Footer (landing only)
│
├── Pages
│   ├── LandingPage
│   │   ├── HeroSection
│   │   │   ├── Badge
│   │   │   ├── Headline
│   │   │   ├── Subheadline
│   │   │   ├── CTAButtons
│   │   │   └── DemoCard
│   │   │       ├── DemoMessage (repeating)
│   │   │       └── DemoToolTag
│   │   ├── SocialProof
│   │   │   └── LogoCloud
│   │   ├── HowItWorks
│   │   │   └── Step (repeating)
│   │   ├── FeaturesSection
│   │   │   └── FeatureCard (repeating)
│   │   ├── PhoneDemo
│   │   │   ├── PhoneCallCard
│   │   │   └── PhoneResultCard
│   │   ├── Testimonials
│   │   │   └── TestimonialCard (repeating)
│   │   ├── PricingSection
│   │   │   └── PricingCard (repeating)
│   │   └── CTASection
│   │
│   ├── AuthPage
│   │   ├── AuthForm
│   │   │   ├── EmailInput
│   │   │   └── SubmitButton
│   │   └── AuthSuccess
│   │
│   └── DashboardLayout
│       ├── Sidebar
│       │   ├── Logo
│       │   ├── NewConversationButton
│       │   ├── ConversationList
│       │   │   └── ConversationItem (repeating)
│       │   └── UserSection
│       │       ├── PlanBadge
│       │       ├── MessageCounter
│       │       ├── UpgradeButton
│       │       └── SignOutButton
│       │
│       ├── TopBar
│       │   ├── SidebarToggle
│       │   ├── ConversationTitle
│       │   ├── ToolsToggle
│       │   ├── CallButton
│       │   └── SettingsLink
│       │
│       ├── ChatArea
│       │   ├── EmptyState
│       │   │   ├── BotIcon
│       │   │   ├── WelcomeText
│       │   │   └── SuggestionChips
│       │   ├── MessageList
│       │   │   └── Message (repeating)
│       │   │       ├── UserMessage
│       │   │       ├── AssistantMessage
│       │   │       │   ├── MarkdownRenderer
│       │   │       │   ├── CodeBlock
│       │   │       │   │   ├── LanguageLabel
│       │   │       │   │   ├── CopyButton
│       │   │       │   │   └── CodeContent
│       │   │       │   ├── ToolCallBadge
│       │   │       │   └── CallResultCard
│       │   │       └── ErrorMessage
│       │   ├── StreamingIndicator
│       │   └── ScrollAnchor
│       │
│       ├── InputBar
│       │   ├── TextArea (auto-resize)
│       │   ├── SendButton
│       │   └── LimitWarning
│       │
│       ├── ToolsPanel
│       │   └── ToolToggle (repeating)
│       │
│       └── PhoneModal
│           ├── ModalOverlay
│           ├── PhoneInput
│           └── ActionButtons
│
├── Shared Components
│   ├── Button (variants: primary, secondary, ghost, danger)
│   ├── Input (text, email, tel, password)
│   ├── Modal
│   ├── Toast (success, error, warning, info)
│   ├── Spinner
│   ├── Skeleton
│   ├── Badge
│   ├── ProgressBar
│   ├── Avatar
│   ├── Dropdown
│   ├── Tooltip
│   └── IconButton
│
└── Hooks
    ├── useAuth
    ├── useProfile
    ├── useConversations
    ├── useMessages
    ├── useStreamingChat
    ├── usePhoneCall
    ├── useTools
    ├── useKeyboardShortcuts
    └── useMediaQuery
```

---

## 6. Data Model

### 6.1 Database Schema (Supabase/PostgreSQL)

#### Table: `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  messages_used INTEGER DEFAULT 0,
  calls_used INTEGER DEFAULT 0,
  is_pro BOOLEAN DEFAULT false,
  is_unlimited BOOLEAN DEFAULT false,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'inactive', -- 'active', 'past_due', 'canceled', 'inactive'
  subscription_period_end TIMESTAMPTZ,
  api_keys_enabled BOOLEAN DEFAULT false,
  email_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id);
CREATE INDEX idx_profiles_subscription_status ON profiles(subscription_status);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
```

#### Table: `conversations`
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'New conversation',
  model TEXT DEFAULT 'claude-sonnet-4', -- which AI model was used
  message_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0, -- approximate
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX idx_conversations_archived ON conversations(user_id, is_archived);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own conversations" ON conversations FOR ALL USING (auth.uid() = user_id);
```

#### Table: `messages`
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB, -- [{name: string, arguments: object, result: string}]
  model TEXT, -- which model generated this response
  tokens_in INTEGER, -- approximate input tokens
  tokens_out INTEGER, -- approximate output tokens
  latency_ms INTEGER, -- time to generate
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own messages" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())
);
```

#### Table: `calls`
```sql
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  call_id TEXT, -- Vapi call ID
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer')),
  duration INTEGER, -- seconds
  cost_cents INTEGER, -- cost in cents (for tracking)
  transcript TEXT,
  summary TEXT, -- AI-generated summary
  recording_url TEXT, -- Vapi recording URL
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_calls_user ON calls(user_id);
CREATE INDEX idx_calls_created ON calls(created_at DESC);
CREATE INDEX idx_calls_status ON calls(status);

-- RLS
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own calls" ON calls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calls" ON calls FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### Table: `api_keys` (Future)
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- first 8 chars of the key
  key_hash TEXT NOT NULL, -- hashed full key
  scopes TEXT[] DEFAULT '{}', -- ['chat', 'calls', 'tools']
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own API keys" ON api_keys FOR ALL USING (auth.uid() = user_id);
```

#### Table: `usage_logs` (Future — for billing analytics)
```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('message', 'call', 'tool_call', 'api_call')),
  metadata JSONB, -- flexible metadata
  cost_cents INTEGER, -- estimated cost
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_usage_logs_user ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX idx_usage_logs_type ON usage_logs(event_type);

-- RLS
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own usage" ON usage_logs FOR SELECT USING (auth.uid() = user_id);
```

### 6.2 Triggers

```sql
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Update conversation updated_at on new message
CREATE OR REPLACE FUNCTION handle_message_inserted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = now(),
      message_count = message_count + 1
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_message_inserted();
```

### 6.3 Client-Side State

```typescript
// Auth State
interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

// Profile State
interface ProfileState {
  profile: Profile | null
  loading: boolean
  error: string | null
}

// Chat State
interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  streaming: boolean
  streamingContent: string // partial response being built
  loadingMessages: boolean
  loadingConversations: boolean
  error: string | null
}

// Tools State
interface ToolsState {
  enabledTools: Set<string>
  panelOpen: boolean
}

// UI State
interface UIState {
  sidebarOpen: boolean
  phoneModalOpen: boolean
  settingsTab: string
  theme: 'light' | 'dark'
}
```

---

## 7. API Specification

### 7.1 POST /api/chat

**Purpose:** Send a message to the AI and get a response

**Authentication:** Required (Supabase session)

**Rate Limit:** Based on plan (20/500/unlimited per month)

**Request:**
```json
{
  "message": "string (required, max 4000 chars)",
  "conversationId": "uuid | null (null = new conversation)",
  "tools": "string[] (optional, which tools are enabled)",
  "messages": [
    {
      "role": "user | assistant",
      "content": "string"
    }
  ]
}
```

**Response (200):**
```json
{
  "response": "string (markdown)",
  "conversationId": "uuid",
  "toolCalls": [
    {
      "name": "string",
      "result": "string"
    }
  ],
  "usage": {
    "tokensIn": "number",
    "tokensOut": "number"
  }
}
```

**Error Responses:**
- **401:** `{ "error": "Unauthorized" }`
- **429:** `{ "error": "Rate limit exceeded", "resetAt": "ISO date" }`
- **402:** `{ "error": "Payment required", "upgradeUrl": "string" }`
- **500:** `{ "error": "Internal server error" }`

**Edge Cases:**
- Empty message: Return 400
- Message too long: Return 400 with max length
- Conversation not owned by user: Return 403
- AI API down: Return 503 with retry-after header
- Context window exceeded: Summarize older messages, continue

### 7.2 POST /api/chat/stream (Future)

**Purpose:** Stream AI response via Server-Sent Events

**Response (200):** SSE stream
```
event: token
data: {"token": "Hello"}

event: token
data: {"token": " world"}

event: tool_call
data: {"name": "web-search", "result": "..."}

event: done
data: {"conversationId": "uuid", "usage": {...}}

event: error
data: {"error": "string"}
```

### 7.3 POST /api/mcp

**Purpose:** Execute an MCP tool

**Authentication:** Required

**Request:**
```json
{
  "toolId": "string (one of: web-search, web-fetch, github-search, github-read, file-read, file-write, file-glob)",
  "params": "object (tool-specific parameters)"
}
```

**Tool Parameters:**

| Tool | Params | Description |
|------|--------|-------------|
| web-search | `{ query: string }` | Search the web |
| web-fetch | `{ url: string }` | Fetch a web page |
| github-search | `{ query: string }` | Search GitHub code |
| github-read | `{ owner, repo, path }` | Read a GitHub file |
| file-read | `{ path: string }` | Read a local file |
| file-write | `{ path, content }` | Write to a file |
| file-glob | `{ pattern: string }` | Search files by pattern |

**Response (200):**
```json
{
  "result": "any (tool-specific)",
  "toolId": "string"
}
```

**Error Responses:**
- **401:** Unauthorized
- **403:** Tool not available on current plan
- **404:** Tool not found
- **500:** Tool execution failed

### 7.4 POST /api/vapi/call

**Purpose:** Initiate an outbound phone call

**Authentication:** Required

**Rate Limit:** Based on plan (0/5/50 per month)

**Request:**
```json
{
  "number": "string (E.164 format)",
  "context": "string (conversation context for the AI)"
}
```

**Response (200):**
```json
{
  "callId": "uuid",
  "status": "queued"
}
```

**Error Responses:**
- **400:** Invalid phone number
- **402:** No calls remaining on plan
- **500:** Vapi API error

### 7.5 POST /api/vapi/webhook

**Purpose:** Receive call events from Vapi

**Authentication:** Vapi signature verification

**Events:**
- `call.started` — Call has been initiated
- `call.ringing` — Phone is ringing
- `call.in-progress` — Call is connected
- `call.ended` — Call has ended (with transcript)
- `call.failed` — Call failed

**Request (Vapi format):**
```json
{
  "type": "call.ended",
  "call": {
    "id": "uuid",
    "status": "ended",
    "duration": 154,
    "transcript": "...",
    "summary": "...",
    "recordingUrl": "...",
    "cost": 0.05
  }
}
```

**Response:** `{ "ok": true }`

### 7.6 POST /api/stripe/checkout

**Purpose:** Create a Stripe Checkout session for subscription

**Authentication:** Required

**Request:**
```json
{
  "priceId": "string (optional, defaults to monthly)",
  "successUrl": "string (optional)",
  "cancelUrl": "string (optional)"
}
```

**Response (200):**
```json
{
  "url": "string (Stripe Checkout URL)"
}
```

### 7.7 POST /api/stripe/webhook

**Purpose:** Handle Stripe subscription events

**Authentication:** Stripe webhook signature

**Events Handled:**
- `checkout.session.completed` — Activate subscription
- `customer.subscription.updated` — Sync plan changes
- `customer.subscription.deleted` — Deactivate plan
- `invoice.payment_succeeded` — Renew subscription
- `invoice.payment_failed` — Notify user, retry
- `customer.subscription.past_due` — Warn user

### 7.8 GET /api/stripe/portal

**Purpose:** Redirect to Stripe Customer Portal

**Authentication:** Required

**Response (302):** Redirect to Stripe Customer Portal URL

### 7.9 GET /api/user

**Purpose:** Get current user profile

**Authentication:** Required

**Response (200):**
```json
{
  "id": "uuid",
  "email": "string",
  "displayName": "string",
  "avatarUrl": "string",
  "plan": "free | pro | unlimited",
  "usage": {
    "messagesUsed": 5,
    "messagesLimit": 20,
    "callsUsed": 0,
    "callsLimit": 0
  },
  "subscription": {
    "status": "active | past_due | canceled | inactive",
    "periodEnd": "ISO date"
  }
}
```

### 7.10 PATCH /api/user

**Purpose:** Update user profile

**Authentication:** Required

**Request:**
```json
{
  "displayName": "string (optional)",
  "avatarUrl": "string (optional)",
  "emailNotifications": "boolean (optional)"
}
```

**Response (200):** Updated profile

---

## 8. State Management

### 8.1 Global State (React Context)

```typescript
// AuthContext
interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

// ProfileContext
interface ProfileContextType {
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
  updateProfile: (data: Partial<Profile>) => Promise<void>
}

// ChatContext
interface ChatContextType {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  streaming: boolean
  streamingContent: string
  setActiveConversation: (id: string | null) => void
  sendMessage: (content: string) => Promise<void>
  createConversation: () => Promise<string>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
}
```

### 8.2 State Transitions

**Chat Flow:**
```
IDLE → TYPING → SENDING → STREAMING → COMPLETE → IDLE
                              ↓
                           ERROR → IDLE
```

**Phone Call Flow:**
```
IDLE → MODAL_OPEN → VALIDATING → CALLING → IN_PROGRESS → COMPLETE → IDLE
                                                              ↓
                                                           ERROR → IDLE
```

**Auth Flow:**
```
LOADING → UNAUTHENTICATED → SIGNING_IN → CHECK_EMAIL → AUTHENTICATED
                                                              ↓
                                                           ERROR
```

---

## 9. Error Handling

### 9.1 Error Types

| Category | Error | User Message | HTTP Status | Action |
|----------|-------|-------------|-------------|--------|
| Auth | No session | "Please sign in to continue" | 401 | Redirect to /auth |
| Auth | Session expired | "Your session expired. Please sign in again." | 401 | Redirect to /auth |
| Auth | Invalid email | "Please enter a valid email address" | 400 | Show inline error |
| Rate Limit | Messages exceeded | "You've used all your messages this month. Upgrade to Pro for more." | 402 | Show upgrade prompt |
| Rate Limit | Calls exceeded | "You've used all your calls this month. Upgrade to Pro for more." | 402 | Show upgrade prompt |
| Rate Limit | Too fast | "You're sending messages too fast. Please wait a moment." | 429 | Show cooldown |
| AI | API down | "The AI service is temporarily unavailable. Please try again." | 503 | Show retry button |
| AI | Context overflow | "This conversation is getting long. I'll summarize older messages." | - | Auto-summarize |
| AI | Content policy | "I can't respond to that request. Please rephrase." | - | Show policy message |
| Network | Offline | "You're offline. Messages will be sent when you reconnect." | - | Queue, show banner |
| Network | Timeout | "The request timed out. Please try again." | 504 | Show retry button |
| Phone | Invalid number | "Please enter a valid phone number with country code." | 400 | Show inline error |
| Phone | Vapi error | "Could not place the call. Please try again." | 500 | Show retry button |
| Payment | Card declined | "Your card was declined. Please try a different payment method." | 402 | Show error in Stripe |
| Payment | Requires action | "Your bank requires authentication. Please complete the verification." | 402 | Redirect to Stripe |
| General | Unknown | "Something went wrong. Please try again." | 500 | Show generic error |

### 9.2 Error UI Patterns

**Toast Notifications:**
- Success: Green, auto-dismiss 3s
- Error: Red, auto-dismiss 5s
- Warning: Yellow, auto-dismiss 5s
- Info: Blue, auto-dismiss 3s

**Inline Errors:**
- Form fields: Red border + error text below input
- Chat messages: Red background + error text + retry button
- API responses: JSON error in response body

**Error Boundaries:**
- Each major section wrapped in error boundary
- Fallback UI: "Something went wrong" + "Reload" button
- Log error to console + analytics

### 9.3 Retry Strategy

| Operation | Max Retries | Backoff | Idempotent |
|-----------|-------------|---------|------------|
| AI Chat | 1 | None | No (re-send) |
| Phone Call | 2 | 5s, 10s | No (new call) |
| Web Search | 2 | 1s, 3s | Yes |
| GitHub API | 2 | 1s, 3s | Yes |
| Stripe Webhook | 3 | 1s, 5s, 15s | Yes |
| Database | 1 | None | Yes |

---

## 10. Edge Cases

### 10.1 Chat Edge Cases

1. **User sends empty message:** Ignore, don't send
2. **User sends only whitespace:** Trim, if empty → ignore
3. **Message exceeds 4000 chars:** Show counter, block at limit
4. **Conversation has 100+ messages:** Summarize oldest, continue
5. **AI response is empty:** Show "I didn't get a response. Please try again."
6. **AI response is very long (>10000 chars):** Stream progressively, collapse sections
7. **User switches conversation while streaming:** Cancel stream, save partial response
8. **User closes tab while streaming:** Response lost, show "incomplete" marker
9. **Multiple rapid sends:** Queue, process sequentially
10. **Paste large text (>10000 chars):** Truncate with warning
11. **Paste HTML:** Strip tags, keep text
12. **Paste image:** Show "Image upload coming soon" (future)
13. **Code block with 1000+ lines:** Collapse, show line count, expand on click
14. **Malformed markdown:** Render as plain text
15. **XSS in markdown:** Sanitize all HTML, strip script tags
16. **Very long single word:** Break with CSS word-break
17. **RTL text:** Detect and apply dir="auto"
18. **Emoji-heavy messages:** Render natively
19. **User mentions @someone:** No-op (no mentions feature yet)
20. **User types /command:** No-op (no commands yet)

### 10.2 Phone Call Edge Cases

1. **Number without country code:** Assume user's country (from profile)
2. **Number with letters:** Strip non-numeric
3. **Premium rate number:** Block, show warning
4. **Number is busy:** Vapi retries, report "Line was busy"
5. **No answer:** Report "No one answered"
6. **Call dropped mid-conversation:** Report partial transcript
7. **Very long call (>30 min):** Cap at 30 min, auto-end
8. **User calls same number twice:** Allow (separate calls)
9. **User calls international:** Allow (Vapi supports it)
10. **Transcript is very long:** Summarize, offer full transcript
11. **Recording unavailable:** Show transcript only
12. **Vapi API is down:** Queue call, retry later
13. **User has no remaining calls:** Show upgrade prompt
14. **Call costs exceed plan:** Warn before initiating

### 10.3 Auth Edge Cases

1. **Magic link expired:** Show "Link expired" page with "Send new link" button
2. **User clicks magic link on different device:** Works (cross-device)
3. **User clicks magic link twice:** First click works, second shows "Already signed in"
4. **User signs in with new email:** Creates new account
5. **User signs in with existing email:** Signs in to existing account
6. **Email delivery delayed:** Show "Resend email" after 60s
7. **Email bounces:** Log, no user-facing error (user will retry)
8. **User deletes account, signs in again:** Creates new profile (old data gone)
9. **Session expires mid-use:** Redirect to /auth, preserve return URL
10. **Multiple tabs:** Same session, no conflict

### 10.4 Billing Edge Cases

1. **Payment fails at checkout:** Show Stripe error, offer retry
2. **Subscription renewal fails:** Send email, downgrade after grace period (7 days)
3. **User upgrades mid-cycle:** Prorate, immediate access
4. **User downgrades:** Apply at end of billing period
5. **User cancels:** Access until end of period, then downgrade to Free
6. **User reactivates after cancel:** Resume subscription
7. **Coupon code:** Apply discount (future)
8. **Free user hits limit:** Show upgrade prompt, block further messages
9. **Pro user hits limit:** Show "Upgrade to Unlimited" prompt
10. **Unlimited user:** No limits (but fair use policy applies)

### 10.5 Data Edge Cases

1. **User deletes conversation with 100+ messages:** Cascade delete, confirm first
2. **User deletes account:** Cascade delete all data, cancel subscription
3. **Database connection lost:** Show "Service unavailable", retry
4. **Concurrent writes:** Last write wins (no conflict resolution needed)
5. **Very old conversations:** Archive after 6 months (future)
6. **Data export fails:** Show error, offer email delivery
7. **Storage limit exceeded:** Warn user (future)

---

## 11. Performance Budget

### 11.1 Loading Times

| Metric | Target | Measurement |
|--------|--------|-------------|
| Landing page load | < 2s | Lighthouse |
| Landing page interactive | < 3s | Lighthouse |
| Dashboard load | < 2s | First paint |
| Conversation list load | < 500ms | API response |
| Message history load | < 1s | API response |
| AI response first token | < 2s | Time to first token |
| AI response complete | < 10s | Total time |
| Phone call initiation | < 2s | API response |
| Page navigation | < 300ms | Route change |

### 11.2 Bundle Size

| Asset | Target | Current |
|-------|--------|---------|
| Landing page HTML | < 50KB | ~18KB |
| Landing page CSS (inlined) | < 30KB | ~8KB |
| Dashboard JS (initial) | < 150KB | TBD |
| Dashboard CSS | < 50KB | TBD |
| Total (dashboard) | < 300KB | TBD |

### 11.3 API Latency

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| POST /api/chat | 3s | 8s | 15s |
| POST /api/mcp | 1s | 3s | 5s |
| POST /api/vapi/call | 1s | 2s | 3s |
| GET /api/user | 50ms | 100ms | 200ms |
| Database queries | 10ms | 50ms | 100ms |

### 11.4 Caching Strategy

| Data | Cache | TTL | Invalidation |
|------|-------|-----|-------------|
| Landing page | CDN (Vercel) | 1 hour | Deploy |
| User profile | Local (React Query) | 5 min | Mutation |
| Conversation list | Local (React Query) | 1 min | New message |
| Message history | Local (React Query) | Session | New message |
| AI responses | No cache | - | - |
| Tool results | No cache | - | - |
| Static assets | CDN (Vercel) | 1 year | Hash change |

---

## 12. Security Model

### 12.1 Authentication
- Supabase Auth with magic link
- Session stored in HTTP-only cookie (server) + localStorage (client)
- Session refresh handled by Supabase
- No password storage

### 12.2 Authorization
- Row Level Security on all tables
- API routes check session on every request
- Service role key used server-side only (never exposed to client)
- Plan-based feature gating (Free/Pro/Unlimited)

### 12.3 Data Protection
- All data encrypted at rest (Supabase managed)
- All traffic over HTTPS
- API keys stored as hashes (bcrypt)
- Phone numbers stored encrypted (future)
- Transcripts stored with user isolation

### 12.4 Third-Party Security
- Stripe: Webhook signature verification
- Vapi: Token-based auth, webhook verification
- Anthropic: API key stored as env var
- GitHub: Token stored as env var

### 12.5 Rate Limiting
- Chat: Based on plan limits (20/500/unlimited per month)
- API: 60 requests/minute per user
- Auth: 3 magic link requests/minute per email
- Phone: Based on plan limits (0/5/50 per month)

### 12.6 Input Validation
- All user input sanitized (XSS prevention)
- Markdown rendered with sanitized HTML
- Phone numbers validated (E.164 format)
- Email validated (regex)
- Message length capped (4000 chars)

---

## 13. Accessibility

### 13.1 WCAG 2.1 Compliance Target: AA

| Criteria | Implementation |
|----------|---------------|
| Color contrast | 4.5:1 for text, 3:1 for large text |
| Keyboard navigation | All interactive elements focusable, logical tab order |
| Screen reader | ARIA labels on all interactive elements, semantic HTML |
| Focus indicators | Visible focus ring on all elements |
| Motion | Respect prefers-reduced-motion |
| Text resize | No loss of functionality up to 200% zoom |
| Error identification | Clear error messages, aria-invalid on fields |
| Landmarks | header, main, nav, footer, role attributes |
| Skip links | "Skip to content" link |
| Alt text | All images have alt text |

### 13.2 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Enter | Send message |
| Shift+Enter | New line |
| Cmd+K | Command palette (future) |
| Cmd+N | New conversation |
| Cmd+Shift+C | Toggle tools panel |
| Cmd+Shift+P | Toggle phone modal |
| Escape | Close modal / panel |
| Arrow Up/Down | Navigate conversation list (when focused) |

---

## 14. Internationalization

### 14.1 Languages (Phase 2)
- English (default)
- French
- Spanish
- German

### 14.2 i18n Strategy
- next-intl for translations
- Language detection from browser
- Language selector in settings
- AI responses in user's language (Claude handles this)

### 14.3 Locale-Specific Features
- Phone number format per country
- Currency formatting ($, €, £)
- Date/time formatting
- Number formatting (decimal, thousand separator)

---

## 15. Analytics & Monitoring

### 15.1 Events to Track

**User Events:**
- `user.signed_up` — Email, referrer
- `user.signed_in` — Email
- `user.upgraded` — Plan, price
- `user.downgraded` — Plan
- `user.canceled` — Reason (optional)
- `user.deleted` — Reason (optional)

**Engagement Events:**
- `message.sent` — Length, has_tools
- `message.received` — Latency, tokens
- `conversation.created` — Source (new/from history)
- `conversation.resumed` — Time since last message
- `tool.used` — Tool name, success/failure
- `call.initiated` — Number length, country
- `call.completed` — Duration, cost
- `call.failed` — Error reason

**Business Events:**
- `subscription.started` — Plan, price
- `subscription.renewed` — Plan, price
- `subscription.canceled` — Reason
- `payment.succeeded` — Amount
- `payment.failed` — Error code

### 15.2 Monitoring

- **Uptime:** Vercel status page
- **Errors:** Sentry (or similar)
- **API Latency:** Custom logging to Supabase
- **AI Costs:** Track per-user token usage
- **Phone Costs:** Track per-user call costs

### 15.3 Alerts

- Error rate > 1% → Slack/email
- API latency P95 > 10s → Slack/email
- AI API down → Slack/email
- Vapi API down → Slack/email
- Stripe webhook failures → Slack/email
- Cost spike > 2x normal → Slack/email

---

## 16. Testing Strategy

### 16.1 Unit Tests (Jest + React Testing Library)
- All utility functions
- All hooks
- All components (render, interactions, states)
- API route handlers (with mocked Supabase)

### 16.2 Integration Tests
- Auth flow (sign in → callback → dashboard)
- Chat flow (send message → receive response)
- Phone call flow (initiate → webhook → update)
- Billing flow (checkout → webhook → upgrade)

### 16.3 E2E Tests (Playwright)
- Landing page navigation
- Auth flow (email → magic link → dashboard)
- Dashboard (new conversation → send → receive)
- Phone call (open modal → enter number → call)
- Settings (update profile → save)
- Billing (upgrade → Stripe redirect → success)

### 16.4 Test Coverage Target
- Unit tests: 80%+ coverage
- Integration tests: All critical paths
- E2E tests: All user stories (P0)

### 16.5 Test Data
- Mock Supabase client
- Mock Stripe
- Mock Vapi
- Mock Anthropic
- Test user accounts (Supabase)

---

## 17. Deployment Architecture

### 17.1 Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Production | relay.com, app.relay.com | Live |
| Staging | staging.relay.com | Pre-release testing |
| Development | localhost:3000 | Local development |

### 17.2 CI/CD (GitHub Actions)

**On push to main:**
1. Lint + type check
2. Run unit tests
3. Run integration tests
4. Build Next.js app
5. Deploy to Vercel (preview)
6. Run E2E tests on preview
7. Promote to production

**On push to staging:**
1. Lint + type check
2. Run unit tests
3. Deploy to Vercel (staging)

### 17.3 Infrastructure

| Service | Plan | Cost |
|---------|------|------|
| Vercel (app) | Free (Hobby) | $0 |
| GitHub Pages (landing) | Free | $0 |
| Supabase (database + auth) | Free (500MB) | $0 |
| Stripe | Pay-as-you-go | 2.9% + $0.30 |
| Vapi | Pay-as-you-go | ~$0.05/min |
| Anthropic | Pay-as-you-go | ~$0.003/msg |
| Domain | Namecheap | ~$10-30/yr |
| **Total base** | | **~$10-30/mo** |

### 17.4 Scaling Considerations

- **100 users:** Free tier of all services
- **1,000 users:** Supabase Pro ($25/mo), Vercel Pro ($20/mo)
- **10,000 users:** Dedicated DB, edge functions, CDN
- **100,000 users:** Multi-region, read replicas, caching layer

---

## 18. Future Considerations

### 18.1 Phase 2 Features (Post-Launch)
- Streaming responses (SSE)
- File upload (PDF, images, code files)
- Voice input
- Dark mode
- Mobile app (React Native / PWA)
- API for developers
- Custom MCP server integration
- Team workspaces
- Browser extension

### 18.2 Phase 3 Features (6+ Months)
- Image generation (DALL-E / Stable Diffusion)
- Image analysis (vision models)
- Email integration (send/receive via Relay)
- Calendar integration
- Slack integration
- Zapier / Make integration
- Custom AI model selection
- Fine-tuned models per user
- Analytics dashboard

### 18.3 Long-Term Vision
- Relay as a platform (not just a product)
- Marketplace for MCP tools
- Enterprise SSO (SAML/OIDC)
- SOC 2 compliance
- EU data residency
- White-label for businesses
- API-first, embeddable
- AI agent marketplace
