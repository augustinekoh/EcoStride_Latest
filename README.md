<div align="center">
  <h1>🌿 EcoStride</h1>
  <p><b>Walk for the Planet. Earn Rewards. Build a Community.</b></p>
  <p>EcoStride is an interactive, gamified eco-fitness application that seamlessly integrates native mobile walk tracking, carbon footprint reduction, robust social interactions, and a real-world merchant reward ecosystem — powered by Edge AI and Cloudflare Workers.</p>
  <h2>🌍 <a href="https://home.ecostride.cc/">Visit Our Official Website</a> 🌍</h2>
</div>

---

## 📖 About EcoStride

EcoStride converts your physical movement into tangible environmental impact. Every step you take helps reduce carbon emissions, and in return, you earn **Eco Coins**. Use these coins to purchase vouchers from our merchant partners, plant virtual trees on the real-world map, and compete on dynamic leaderboards with your friends or within your community guilds!

### 🌟 Key Features

- 📱 **Native Mobile Integration**: Fully compatible with Android via Capacitor 8. Features a native Foreground Service for continuous walk tracking (even when the app is minimized or screen is locked) and dual-channel FCM Push Notifications + In-App Mailbox.
- 🗺️ **Core Map Exploration**: Built on Mapbox GL JS with real-time geolocation tracking, custom environment markers, a dedicated "My Location" button, and a modern Glassmorphism UI. Features a sleek Draggable Map Widget (Picture-in-Picture).
- 💰 **Walk Tracking & Economy**: Background geodesic tracking (via `@turf/turf` & `@capgo/background-geolocation`) with strict anti-cheat measures (e.g., max GPS accuracy 150m). Earn 17 Eco-Coins and offset 0.17kg CO₂ per valid 1km walked!
- 🤖 **Gemini Edge AI Systems**:
  - **CivicIntelligence**: Automatic multimodal AI triage of civic reports. Analyzes user-uploaded photos via Gemini 3.1 Flash-Lite to instantly assign severity, standardize descriptions, and recommend dispatch actions.
  - **Authority Copilot AI**: A real-time, WebSocket-powered conversational AI (Gemini 2.5 Flash) that helps municipal authorities synthesize multi-report investigations and query city infrastructure data with persistent conversational context.
- 🏛️ **Authority & Civic Engagement**: Allow users to report infrastructural issues to regional authorities. Complete with AI auto-triage, 1v1 resolution chat, and the new Authority Copilot workspace.
- 💬 **Real-time Social & Community**: Create or join guilds, manage Capybara friend requests, and chat in real-time. Powered by **Cloudflare Durable Objects + WebSockets** for low-latency guild chats and 1v1 issue resolutions.
- 🏪 **Merchant & Reward Hub**: Multi-store management for business owners, and in-person QR code validation using the device camera.
- 🏆 **Dynamic Badge Engine**: Server-side async badge awarding based on user achievements. Showcase your badges on your public profile.
- 🛡️ **Global Ban & Admin System**: Advanced Admin dashboard to manage users, invite authorities via secure tokens, toggle dynamic CRON jobs, and permanently lock out banned users.

---

## 🛠️ Comprehensive Tech Stack

EcoStride is structured as a full-stack monorepo spanning mobile, edge backend, and web marketing.

### 1. Frontend App (`ecostride-app`)
- **Core Framework**: React 19 + TypeScript + Vite
- **Mobile Native Wrapping**: Capacitor 8 (Android)
- **Styling**: Tailwind CSS v4 + Vanilla CSS Variables
- **State Management**: Zustand v5 (Modularized, Persisted)
- **Map Engine**: Mapbox GL JS (`react-map-gl`) + Turf.js (`@turf/turf`)
- **Mobile Capabilities**: `@capgo/background-geolocation`, `@capacitor/push-notifications`, `@yudiel/react-qr-scanner`, `@capacitor/preferences`

### 2. Backend Edge API (`ecostride-backend`)
- **Runtime Framework**: Cloudflare Workers (V8 Isolate Edge Computing) + Hono
- **Relational Database**: Cloudflare D1 (Serverless SQLite with 10+ schemas)
- **Object Storage**: Cloudflare R2 (Avatars, Attachments, Photo Proofs)
- **Real-time WebSockets**: Cloudflare Durable Objects (`CommunityChatRoom`, `IssueConversationDO`, `AuthorityCopilotDO`)
- **AI Inference**: Google Gemini API (`gemini-3.1-flash-lite`, `gemini-2.5-flash`)
- **Push Notification Gateway**: Custom FCM HTTP v1 Integration with JWT signing (`jose`)

### 3. Marketing Web (`ecostride-web`)
- **Core Framework**: React 19 SPA + Vite
- **Styling**: Custom CSS Design System (Apple-like Glassmorphism)
- **Routing**: `react-router-dom`

---

## 📂 Monorepo Structure

```text
EcoStride_NEW/
├── .github/workflows/
│   └── release-android.yml   # CI/CD: Auto-build & sign Android APKs on GitHub tags
├── ecostride-app/            # Native Android App Workspace (React + Capacitor)
│   ├── android/              # Gradle Android Project
│   └── src/
│       ├── components/       # UI by domain (Admin, Authorities, Map, Social, etc.)
│       ├── hooks/            # WebSocket lifecycle & App state hooks
│       ├── lib/              # API Client, Background GPS Tracking pipeline
│       └── stores/           # Zustand global stores
├── ecostride-backend/        # Cloudflare Worker API
│   ├── src/
│   │   ├── index.ts          # Hono app entry (REST Routes & Auth)
│   │   ├── civicIntelligence.ts # Async Gemini Vision API pipeline
│   │   ├── *DO.ts            # Durable Object classes (Chat & Copilot AI)
│   │   ├── badgeEngine.ts    # Background achievement processor
│   │   └── notificationService.ts
│   ├── schema.sql            # D1 SQLite schemas & indexes
│   └── wrangler.toml         # Cloudflare Edge Configuration
└── ecostride-web/            # Marketing & Download Website (React SPA)
    └── src/
```

---

## 🚀 CI/CD Pipeline

EcoStride features a fully automated continuous integration and deployment pipeline for Android via **GitHub Actions**. 
When a new version tag (e.g., `v1.2.3`) is pushed to the repository, the pipeline will:
1. Setup **Java 21** and **Node.js 22**.
2. Build the Vite frontend assets.
3. Sync Capacitor plugins.
4. Compile and securely sign the Android Release APK using a securely injected Base64 Keystore.
5. Auto-publish the `.apk` as a new GitHub Release with generated changelogs and SHA-256 checksums.

---

## 🛠️ Getting Started

### 📋 Prerequisites
Before you begin, ensure you have the following installed:
- **[Node.js 22+](https://nodejs.org/)** (Required for Vite, React, and Cloudflare Workers)
- **[Java 21 (Temurin)](https://adoptium.net/)** (Required for Capacitor Android compilation)
- **[Android Studio](https://developer.android.com/studio)** (Required to run the mobile app emulator or build APKs natively)
- **[Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)** (`npm install -g wrangler`) for D1/R2 management and deployment.

### 1. Clone the repository
```bash
git clone https://github.com/augustinekoh/ecostride.git
cd ecostride
```

### 2. Backend Setup (`ecostride-backend`)
```bash
cd ecostride-backend
npm install

# 1. Configure wrangler.toml with your D1 and R2 bindings
# 2. Add secrets: GEMINI_API_KEY, FIREBASE_PROJECT_ID, R2_ACCESS_KEY, etc.
# 3. Apply schema to local D1
npm run db:push

# 4. Start local edge server
npm run dev
```

### 3. Frontend App Setup (`ecostride-app`)
```bash
cd ../ecostride-app
npm install

# 1. Provide Mapbox API, Firebase credentials, and API_BASE_URL in .env.local
# 2. Run local web dev server
npm run dev

# 📱 To build and compile for Android natively:
npm run build:android
# Open the android/ folder in Android Studio to run on a physical device.
```

### 4. Web Setup (`ecostride-web`)
```bash
cd ../ecostride-web
npm install
# 1. Run local web dev server
npm run dev
```

---

<div align="center">
  <p>Made with 💚 for the Planet.</p>
</div>
