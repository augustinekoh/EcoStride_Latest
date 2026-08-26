<div align="center">
  <h1>🌿 EcoStride</h1>
  <p><b>Walk for the Planet. Earn Rewards. Build a Community.</b></p>
  <p>EcoStride is an interactive Web3-inspired eco-fitness application that seamlessly integrates native mobile walk tracking, carbon footprint reduction, social interactions, and a real-world merchant reward ecosystem.</p>
</div>

---

## 📖 About EcoStride

EcoStride converts your physical movement into environmental impact. Every step you take helps reduce carbon emissions, and in return, you earn **Eco Coins**. Use these coins to purchase vouchers from our merchant partners, plant virtual trees, and compete on the leaderboards with your friends or within your community guilds!

### 🌟 Key Features

- 📱 **Native Mobile Integration**: Fully compatible with Android via Capacitor. Features a native Foreground Service for continuous walk tracking (even when the app is minimized or screen is locked) and FCM (Firebase Cloud Messaging) for robust push notifications.
- 🗺️ **Core Map Exploration**: Built on Mapbox GL JS with real-time geolocation tracking, custom markers, a dedicated "My Location" button, and modern Glassmorphism UI. Features a sleek Draggable Map Widget (Picture-in-Picture) so you never lose your map context.
- 💰 **Walk Tracking & Economy**: Background geodesic tracking (via `@turf/turf` & `@capgo/background-geolocation`) with strict anti-cheat measures (e.g. speed <= 15 km/h, max accuracy 50m). Earn 17 Eco-Coins per valid 1km walked!
- 🏆 **Dynamic Badge Engine**: Server-side async badge awarding based on user achievements (trees planted, distance walked, active days). Showcase them on your public profile!
- 🏟️ **City Events**: Admin-created local community events (e.g., marathons, cleanups). Users can join, submit proofs, and earn exclusive event-specific badges.
- 🏪 **Merchant & Reward Hub**: Multi-store management for business owners, step-by-step onboarding, and in-person QR code validation using the device camera. Includes a **Consumer Protection** system that auto-refunds coins if a merchant takes down a voucher.
- 💬 **Social & Community**: Create/join guilds, manage Capybara friend requests, and chat in real-time via Cloudflare Durable Objects + WebSockets. Supports 1v1 & Group Chat, Photo Uploads, **Message Editing & Deletion**, and Rich Card Sharing.
- 🏛️ **Authority & Issue Reporting**: Civic engagement platform allowing users to report infrastructural issues to dedicated regional authorities, complete with case tracking, 1v1 resolution chat, Authority Take-Down capabilities, and a dedicated **Analytics Dashboard**.
- 🛡️ **Global Ban & Admin System**: Advanced Admin dashboard to manage users, invite authorities, toggle dynamic CRON jobs, and permanently lock out banned users.
- 🌙 **Global Dark Mode & UI**: Flawless Light/Dark mode toggling driven by CSS Variables, native mobile Pull-To-Refresh, and Android physical back button interception.

---

## 🛠️ Tech Stack

### Frontend (`ecostride-app`)
- **Core Framework**: React 18 + TypeScript + Vite
- **Mobile Native Wrapping**: Capacitor 6 (Android)
- **Styling**: Tailwind CSS v4 + Custom CSS Variables
- **State Management**: Zustand
- **Map Engine**: Mapbox GL JS (`react-map-gl`) + Turf.js
- **Auth**: Firebase Authentication
- **Mobile Capabilities**: `@capgo/background-geolocation`, `@capacitor/push-notifications`, `@yudiel/react-qr-scanner`

### Backend (`ecostride-backend`)
- **Runtime**: Cloudflare Workers (Serverless)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (Avatars & Static Assets)
- **Real-time**: Cloudflare Durable Objects + WebSockets

---

## 📂 Project Structure

```text
EcoStride/
├── ecostride-app/            # Frontend (React + Vite + Capacitor)
│   ├── android/              # Native Android App Workspace
│   ├── src/
│   │   ├── components/       # UI Components (Map, Social, Authorities, Admin, Merchant, etc.)
│   │   ├── stores/           # Zustand global state
│   │   ├── hooks/            # Custom hooks (e.g., useCommunityChat)
│   │   └── lib/              # API wrappers and background geolocation logic
├── ecostride-backend/        # Backend (Cloudflare Workers)
│   ├── src/
│   │   ├── index.ts          # Main Cloudflare router, FCM Push, & Admin firewall
│   │   ├── authorities.ts    # Authority registration & regional data APIs
│   │   ├── badgeEngine.ts    # Asynchronous achievement & badge processor
│   │   ├── cityEvents.ts     # City Events logic & dynamic badge awarding
│   │   ├── locationData.ts   # Canonical geographic location dataset
│   │   ├── notificationService.ts # FCM Push Notification Payload Formatter
│   │   ├── CommunityChatRoom.ts # Durable Object for WebSocket group chatting
│   │   └── IssueConversationDO.ts # Durable Object for 1v1 issue resolution chat
```

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/augustinekoh/ecostride.git
cd ecostride
```

### 2. Frontend Setup
```bash
cd ecostride-app
npm install
# Create a .env.local file and configure Firebase and Mapbox credentials
npm run dev

# To build for Android:
npm run build:android
```

### 3. Backend Setup
```bash
cd ../ecostride-backend
npm install
# Configure wrangler.toml with your D1 and R2 bindings
npx wrangler dev
```

---

<div align="center">
  <p>Made with 💚 for the Planet.</p>
</div>
