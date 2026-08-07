# EcoStride Architecture (ARCHITECTURE.md)

## 1. 技术栈 (Tech Stack)

### 前端 (Frontend)
- **核心框架**: React 18, TypeScript, Vite
- **认证系统**: Firebase Auth (`firebase.ts`)
- **状态管理**: Zustand 
  - `useAuthStore` (用户鉴权与全局会话流转)
  - `useUserStore` (用户基本信息、积分、封禁状态 `bannedUntil`、偏好设置)
  - `useMapStore` (地图路线与坐标状态)
  - `useMailStore` (系统站内信与通知)
  - `useDemoStore` (用于展示的模拟数据开关)
- **样式与UI**: Tailwind CSS, Lucide-React (图标), 自定义 CSS Variables (实现无缝 Light/Dark Mode 切换)
- **地图引擎**: Mapbox GL JS (`react-map-gl/mapbox`) 与 Turf.js (地理计算)
- **特定功能库**: 
  - `@yudiel/react-qr-scanner` / `react-qr-code` (扫码与生成)
  - `react-easy-crop` / `browser-image-compression` (头像裁剪与压缩)
  - `canvas-confetti` (徽章/升级动效)

### 后端 (Backend)
- **运行环境**: Cloudflare Workers (Serverless)
- **实时通讯**: Cloudflare Durable Objects + WebSockets (用于社区群聊与私聊)
- **数据库 (Cloudflare D1)**: 
  - **Database Name**: `ecostride-db`
  - **Binding**: `DB`
  - **核心 Schema (`schema.sql` / 动态更新)**: 包含 `users`, `activity_history`, `trees`, `point_store`, `signposts`, `purchases`, `mail`, `merchants`, `applications` 等表。
- **存储 (Cloudflare R2)**:
  - **Bucket Name**: `ecostride`
  - **Binding**: `AVATARS_BUCKET` (主要用于存储用户裁剪后上传的 Avatar 头像及其他静态资源文件)
- **预定部署方案 (Planned Deployment)**: 
  - Frontend -> Cloudflare Pages
  - Backend -> Cloudflare Workers

---

## 2. 数据结构详列 (Data Structures)

### Cloudflare D1 (SQLite) - 完整数据表结构

目前数据库支撑起用户、社交、地图生态、成就徽章和商家系统：

1. **`users` (用户核心表)**
   - `id` (PK), `email`, `username`, `player_id`, `guild_id`, `role`, `coins`, `total_distance_km`, `total_trees_planted`, `created_at`, `verified_email`, `nationality`, `bio`, `unlocked_badges`, `showcased_badges`, `avatar`, `read_mails`, `banned_until` (管理员封禁时间戳)
2. **`merchants` (商家表)**
   - `id` (PK), `owner_id` (FK -> users), `store_name`, `menu_link`, `location`, `status`, `created_at`
3. **`point_store` (商家商品/Voucher 表)**
   - `id` (PK), `merchant_id`, `category`, `name`, `desc`, `price`, `stock`, `icon`, `status`, `link`
4. **`purchases` (用户购买/核销记录表)**
   - `id` (PK), `user_id` (FK), `merchant_id`, `item_id` (FK), `item_name`, `price`, `status`, `purchased_at`, `redeemed_at`, `expires_at`
5. **`applications` (商家入驻/修改申请表)**
   - `id` (PK), `owner_id` (FK), `type`, `details`, `status`, `created_at`
6. **`signposts` (地图路牌故事表)**
   - `id` (PK), `author_id` (FK), `lng`, `lat`, `message`, `emoji`, `category`, `created_at`, `expires_at`, `likes`, `liked_by`, `images`
7. **`activity_history` (运动历史记录表)**
   - `id` (PK), `user_id` (FK), `date`, `distance`
8. **`trees` (地图种树记录表)**
   - `id` (PK), `author_id` (FK), `lng`, `lat`, `guild_id`, `planted_at`
9. **`mail` 与 `user_deleted_mail` (系统/站内信表)**
   - `mail`: `id` (PK), `title`, `content`, `sender`, `recipient_type`, `recipient_id`, `expires_for_new_users`, `created_at`
   - `user_deleted_mail`: 记录用户删除的公共信件状态。
10. **社交与社区模块表 (Social & Chat)**
    - **`guilds`**: 社区公会主表，记录 `name`, `owner_id`, `is_public`, `require_approval`, `member_count` 等。
    - **`friends`**: 好友关系表，记录 `user_id`, `friend_id`, `status` (`pending`, `accepted`) 等。
    - **`chat_messages`**: 全局消息表，存储社区群聊与 1v1 私聊历史。
    - **`user_chat_reads`**: 已读回执状态表，记录 `user_id` 在特定聊天室的 `last_read_at`。
11. **其他辅助表**：
    - `demo_requests`, `store_categories`, `global_settings`

---

## 3. 核心模块与目录职责 (Core Modules & Directories)

### `ecostride-app/` (Frontend)
- `/src/components/`
  - `/admin/`: 管理员后台面板。包含 `AdminDashboard` (集成数据大盘、社区管控、用户 Economy 调控与**安全封禁 Ban 系统**)。
  - `/landing/`: 着陆页模块 (LandingPage, VerificationPending)。
  - `/map/`: 核心地图交互。
    - `MapView.tsx`: 主地图视图，集成 Mapbox GL JS。
    - `DraggableMapWidget.tsx`: 悬浮/画中画模式的小地图挂件，保障跨页面地图常驻。
    - `SignpostStoryViewer.tsx` & `CreateSignpostModal.tsx`: 地图路牌与故事互动系统。
    - `useMapGeolocation.ts`: 处理底层设备 GPS 实时定位追踪。
  - `/merchant/`: 商家中心 (MerchantDashboard, MerchantOnboardingForm)。集成 `@yudiel/react-qr-scanner` 实现核销扫码。
  - `/profile/`: 个人主页与设置。包含 ProfileView (带彩蛋开关的 Dark/Light Mode)、SettingsView、BadgeShowcase (徽章展示柜)、PublicProfileModal (查看他人主页)。
  - `/social/`: 社区与社交模块。
    - 包含高度优化的 Dark Mode 适配 UI、无缝 Community Dashboard、私聊/群聊头部极简导航。
    - 包含社区发现与预览 (`CommunityDiscovery`, `CommunityPreviewModal`)。
    - 包含特殊命名组件 `CapybaraRequests.tsx` 用于处理好友与入群请求。
  - `/modals/`: 独立弹窗系统。
    - 鉴权与上传：`AuthModal`, `AvatarCropModal` (整合 `react-easy-crop`)。
    - 积分与排名：`PointsStoreModal` (积分商城), `LeaderboardModal` (全局/社区排行榜), `LeaderboardModal_friend` (好友排行榜)。
    - 数据与成就：`CarbonStatsModal` (碳排减量统计), `ImpactReportModal` (环境影响报告), `MailboxModal` (站内信)。
  - `/controls/`: 控制面板与模拟器。包含 `RouteSimulator` 用于在无法获取 GPS 时模拟运动路线。
  - `/city/`: `CityView.tsx` 城市虚拟建设与总览视图。
- `/src/stores/`: Zustand 全局状态池。
- `/src/hooks/`: 共享逻辑钩子 (如 `useCommunityChat.ts` 处理 WebSocket)。
- `/src/lib/`: 工具类 (`api.ts` 作为统一请求入口)。

### `ecostride-backend/` (Backend)
- `/src/index.ts`: Cloudflare Workers 主路由。承载 Auth 校验、Admin 防火墙、数据库实时 `ALTER TABLE` 升级逻辑。
- `/src/badgeEngine.ts`: 强大的**动态徽章成就引擎**。拦截 API 请求并根据用户数据（种树量、步行里程、账号创建天数、路牌互动）进行溯源与追发成就徽章。
- `/src/CommunityChatRoom.ts`: Cloudflare Durable Object，维护 WebSocket 会话池，处理群组广播与离线消息落盘。

---

## 4. 数据流向与高级系统 (Data Flow & Advanced Systems)

1. **强拦截封禁系统 (Admin Ban System)**:
   - Admin 在前端选取封禁期限 -> 后端生成并落盘 Unix 时间戳至 `banned_until` -> 用户下次登录时，`App.tsx` 的全局拦截器优先比对 `Date.now()` -> 触发不可跳过的倒计时 `BannedScreen` 页面，彻底切断主应用访问。
2. **全局 Dark Mode 生态**:
   - 依赖自定义 CSS 变量 (`var(--color-bg-main)`, `var(--color-text-main)` 等)。Profile 页面的 "绳子彩蛋" 与 Setting 页面的开关联动，直接修改 `<html class="dark">`，并渗透至弹窗、聊天头部、导航栏及下拉列表，保障无死角的深色视觉体验。
3. **成就与徽章引擎 (Badge Engine)**:
   - 去中心化校验机制。每当触发相关 API (如 `GET /api/users/:id`) 时，引擎会在服务端异步核算当前玩家的数据量，若达标则自动补发对应徽章至 `unlocked_badges` 数组，并通过通知提示玩家。
4. **实时聊天 (Durable Objects WebSockets)**:
   - 前端发起 WSS 连接 -> Cloudflare 路由至对应 Room -> 状态保存于 RAM 中 -> 广播完成后异步刷入 D1 SQLite。

---

## 5. 目前发现的代码结构挑战与优化方向 (Architecture Opportunities)

1. **D1 数据表结构的演进**: 当前大量表结构的变更依赖于在 `index.ts` 中写死的 `try { ALTER TABLE ... } catch {}`（如 `banned_until`, `player_id` 等），虽然灵活性极高，但未来上线时需梳理成正式的 Migration 脚本以保数据安全。
2. **Demo 模式强耦合**: `useDemoStore` 在生命周期中插入过深，应当进一步切分。
3. **Zustand 缓存生命周期**: 像此前发现的 `Sign Out` 后 `bannedUntil` 缓存残留问题，说明需要建立一个强有力的全局 `RESET_STORE` Action 统一应对账号安全退出。
4. **巨石组件待拆分**: `AdminDashboard.tsx` 逻辑目前过载 (1500+ 行)，集成了所有维度的管理功能。未来需要将各个 Tab (Users, Merchants, Applications, Broadcasts) 拆分为独立的子组件。
