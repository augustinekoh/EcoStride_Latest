<div align="center">
  <h1>🌿 EcoStride</h1>
  <p><b>Walk for the Planet. Earn Rewards. Build a Community.</b></p>
  <p>EcoStride is an interactive, gamified eco-fitness application that seamlessly integrates native mobile walk tracking, carbon footprint reduction, robust social interactions, and a real-world merchant reward ecosystem.</p>
</div>

---

## 📖 About EcoStride

EcoStride converts your physical movement into tangible environmental impact. Every step you take helps reduce carbon emissions, and in return, you earn **Eco Coins**. Use these coins to purchase vouchers from our merchant partners, plant virtual trees on the real-world map, and compete on dynamic leaderboards with your friends or within your community guilds!

### 🌟 Key Features

- 📱 **Native Mobile Integration**: Fully compatible with Android via Capacitor 8. Features a native Foreground Service for continuous walk tracking (even when the app is minimized or screen is locked) and FCM (Firebase Cloud Messaging) for robust cross-platform push notifications.
- 🗺️ **Core Map Exploration**: Built on Mapbox GL JS with real-time geolocation tracking, custom environment markers, a dedicated "My Location" button, and a modern Glassmorphism UI. Features a sleek Draggable Map Widget (Picture-in-Picture) so you never lose your map context while navigating the app.
- 💰 **Walk Tracking & Economy**: Background geodesic tracking (via `@turf/turf` & `@capgo/background-geolocation`) with strict anti-cheat measures (e.g., speed <= 15 km/h, max GPS accuracy 50m). Earn 17 Eco-Coins per valid 1km walked!
- 🏆 **Dynamic Badge Engine**: Server-side async badge awarding based on user achievements (trees planted, distance walked, active days). Showcase your badges on your public profile.
- 🏟️ **City Events**: Admin-created local community events (e.g., marathons, cleanups). Users can join, submit geo-tagged photo proofs, and earn exclusive event-specific badges upon Admin approval.
- 🏪 **Merchant & Reward Hub**: Multi-store management for business owners, step-by-step onboarding, and in-person QR code validation using the device camera. Includes a **Consumer Protection** system that auto-refunds coins if a merchant takes down a voucher.
- 💬 **Social & Community**: Create or join guilds, manage Capybara friend requests, and chat in real-time via Cloudflare Durable Objects + WebSockets. Supports 1v1 & Group Chat, Photo Uploads, **Message Editing & Deletion**, and Rich Interactive Card Sharing.
- 🏛️ **Authority & Issue Reporting**: A civic engagement platform allowing users to report infrastructural or environmental issues to dedicated regional authorities. Complete with case tracking, 1v1 resolution chat, Authority Take-Down capabilities, and a dedicated **Analytics Dashboard**.
- 🛡️ **Global Ban & Admin System**: Advanced Admin dashboard to manage users, invite authorities, toggle dynamic CRON jobs, and permanently lock out banned users.
- 🌙 **Global Dark Mode & UI Excellence**: Flawless Light/Dark mode toggling driven by custom CSS Variables, native mobile Pull-To-Refresh, Android physical back button interception, and buttery smooth page transitions.

---

## 🛠️ Comprehensive Tech Stack

### Frontend (`ecostride-app`)
- **Core Framework**: React 18 + TypeScript + Vite
- **Mobile Native Wrapping**: Capacitor 8 (Android)
- **Styling**: Tailwind CSS v4 + Custom Contextual CSS Variables
- **State Management**: Zustand (Modularized, Persisted)
- **Map Engine**: Mapbox GL JS (`react-map-gl`) + Turf.js (`@turf/turf`)
- **Mobile Capabilities**: `@capgo/background-geolocation`, `@capacitor/push-notifications`, `@yudiel/react-qr-scanner`, `@capacitor/preferences`

### Backend (`ecostride-backend`)
- **Runtime Framework**: Cloudflare Workers (Serverless Edge Computing) + Hono
- **Relational Database**: Cloudflare D1 (Serverless SQLite)
- **Object Storage**: Cloudflare R2 (Avatars, Attachments, Proofs)
- **Real-time WebSockets**: Cloudflare Durable Objects
- **Push Notification Gateway**: Custom FCM HTTP v1 Integration with JWT signing (`jose`)

---

## 📂 Project Structure

```text
EcoStride/
├── ecostride-app/            # Frontend (React + Vite + Capacitor)
│   ├── android/              # Native Android App Workspace (Capacitor Sync)
│   ├── src/
│   │   ├── components/       # Reusable UI (Map, Social, Authorities, Admin, Merchant)
│   │   ├── stores/           # Zustand global state (useUserStore, useMapStore, etc.)
│   │   ├── hooks/            # Custom React hooks (e.g., useCommunityChat)
│   │   ├── lib/              # API wrappers, background geolocation, utilities
│   │   ├── types/            # TypeScript interface definitions
│   │   └── App.tsx           # Main Router & Provider boundary
├── ecostride-backend/        # Backend (Cloudflare Workers + Hono)
│   ├── src/
│   │   ├── index.ts          # Main Cloudflare router, FCM Push, & Admin firewall
│   │   ├── authorities.ts    # Authority registration & regional data APIs
│   │   ├── badgeEngine.ts    # Asynchronous achievement & badge processor
│   │   ├── cityEvents.ts     # City Events logic & dynamic badge awarding
│   │   ├── locationData.ts   # Canonical geographic location dataset
│   │   ├── notificationService.ts # FCM Push Notification Payload Formatter
│   │   ├── CommunityChatRoom.ts   # Durable Object for WebSocket group chatting
│   │   └── IssueConversationDO.ts # Durable Object for 1v1 issue resolution chat
│   ├── schema.sql            # D1 Relational Schema Definitions
│   └── wrangler.toml         # Cloudflare Deployment Configuration
```

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/augustinekoh/ecostride.git
cd ecostride
```

### 2. Backend Setup & Database Initialization
```bash
cd ecostride-backend
npm install

# 1. Configure wrangler.toml with your D1 and R2 bindings
# 2. Initialize the local D1 database schema
npm run db:init

# 3. Start the local Cloudflare Worker development server
npm run dev
```

### 3. Frontend Setup
```bash
cd ../ecostride-app
npm install

# 1. Create a .env.local file based on .env.example
# 2. Configure Firebase credentials and Mapbox Access Token
npm run dev

# 📱 To build and sync for Android natively:
npm run build:android
# Open the android/ folder in Android Studio to run on an emulator/device
```

---

<div align="center">
  <p>Made with 💚 for the Planet.</p>
</div>
