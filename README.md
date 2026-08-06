<div align="center">
  <h1>🌿 EcoStride</h1>
  <p><b>Walk for the Planet. Earn Rewards. Build a Community.</b></p>
  <p>EcoStride is an interactive Web3-inspired eco-fitness application that seamlessly integrates walking/running tracking, carbon footprint reduction, social interactions, and a real-world merchant reward ecosystem.</p>
</div>

---

## 📖 About EcoStride

EcoStride converts your physical movement into environmental impact. Every step you take helps reduce carbon emissions, and in return, you earn **Eco Coins**. Use these coins to purchase vouchers from our merchant partners, plant virtual trees, and compete on the leaderboards with your friends or within your community guilds!

### 🌟 Key Features

- 🗺️ **Core Map Exploration**: Built on Mapbox GL JS with real-time geolocation tracking and custom markers. Features a sleek Draggable Map Widget (Picture-in-Picture) so you never lose your map context while navigating the app.
- 💰 **Carbon Points & Economy**: Step-to-coin conversion algorithm. View your environmental impact via detailed Carbon Stats and an interactive `CityView`.
- 🏆 **Dynamic Badge Engine**: Server-side async badge awarding based on user achievements (trees planted, distance walked, active days). Showcase them on your public profile!
- 🏪 **Merchant & Reward Hub**: Step-by-step merchant onboarding. Users can redeem Eco Coins for vouchers, and merchants can use the built-in QR Code Scanner for verification.
- 💬 **Social & Community**: Create/join guilds, manage Capybara friend requests, and chat in real-time via Cloudflare Durable Objects + WebSockets (1v1 & Group Chat).
- 🛡️ **Global Ban & Admin System**: Advanced Admin dashboard to manage users and merchants, featuring a global interceptor that permanently locks out banned users.
- 🌙 **Global Dark Mode**: Flawless Light/Dark mode toggling driven by CSS Variables, rigorously optimized across social and chat interfaces.

---

## 🛠️ Tech Stack

### Frontend (`ecostride-app`)
- **Core Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Custom CSS Variables
- **State Management**: Zustand
- **Map Engine**: Mapbox GL JS (`react-map-gl`) + Turf.js
- **Auth**: Firebase Authentication

### Backend (`ecostride-backend`)
- **Runtime**: Cloudflare Workers (Serverless)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (Avatars & Static Assets)
- **Real-time**: Cloudflare Durable Objects + WebSockets

---

## 📂 Project Structure

```text
EcoStride/
├── ecostride-app/            # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/       # UI Components (Map, Social, Admin, Merchant, etc.)
│   │   ├── stores/           # Zustand global state (useAuth, useUser, useMap...)
│   │   ├── hooks/            # Custom hooks (e.g., useCommunityChat)
│   │   └── lib/              # API wrappers and utilities
├── ecostride-backend/        # Backend (Cloudflare Workers)
│   ├── src/
│   │   ├── index.ts          # Main Cloudflare router & Admin firewall
│   │   ├── badgeEngine.ts    # Asynchronous achievement & badge processor
│   │   └── CommunityChatRoom.ts # Durable Object for WebSocket chatting
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
# Create a .env file and configure Firebase and Mapbox credentials
npm run dev
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
