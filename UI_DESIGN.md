# MajiMeter — UI & Screens Design Spec

## Design Philosophy
**Friendly, Approachable, and Human-Crafted.** The app should feel more like a modern consumer app (like Apple Fitness or an engaging health tracker) rather than a serious infrastructure tool. It is bright, bubbly, and easy to understand at a glance.

**Theme Rules:** 
- **Light Theme Default:** The primary interface is clean white with high-contrast distinct elements.
- **Dark Theme:** Fully supported but strictly optional (toggled manually by the user or following OS settings, but light is the primary focus).
- **Styling:** We use pure React Native `StyleSheet`. No TailwindCSS or utility classes. 

## Role Intelligent UI (Universal App)
MajiMeter uses a **Universal App** strategy. Instead of building separate apps for Users, Technicians, and Admins, we build one intelligent app that adapts its UI, navigation, and features based on the logged-in user's role.

### Role-Based Navigation
- **User:** Home, Map, Reports, Profile.
- **Technician:** Home, Map, Reports, Alerts (with Ack), Profile.
- **Admin:** Home, Map, Reports, Alerts, Analytics (System-wide), Admin Panel.

### Component-Level Adaptation
- **Action Buttons:** "Acknowledge Alert" or "Edit Water Point" are only rendered if `user.role` is `technician` or `admin`.
- **Form Fields:** Sensitive fields (like Sensor IDs) are read-only for Users but editable for Technicians.
- **Dashboard Context:** 
  - *User Dashboard:* Focuses on personal usage and local area points.
  - *Admin Dashboard:* Focuses on network health, total active alerts, and system-wide efficiency.

---

## Design System

### Visual Language & Aesthetics
Drawing inspiration from Apple Fitness and modern human-crafted apps:
- **Cards:** Crisp white backgrounds, rounded corners (large radii), and distinct fine black borders (or soft shadows) to make them pop.
- **Data Visualization:** Thick "rings" or circular gauges for data like water levels. Sparklines and area charts with soft blue gradients for usage trends.
- **Typography:** Bold, highly legible, sans-serif fonts using native system stacks. Very large hero numbers.
- **Icons:** We exclusively use **Phosphor Icons** (`phosphor-react-native`). They are universally friendly, customizable, and have a beautiful geometric consistency that perfectly matches the "bubbly" aesthetic.

```javascript
export const Colors = {
  // Brand & Accents
  primary: '#007AFF',      // Vibrant, friendly blue (Apple-esque)
  primaryLight: '#4DB8FF', // Secondary bright blue
  waterAccent: '#38BDF8',  // Cyan/Water feel for liquid visuals
  
  // Statuses
  success: '#34C759',      // Bright green for good/active status
  warning: '#FF9500',      // Friendly amber
  critical: '#FF3B30',     // Bright red
  
  // Backgrounds
  background: '#F9FAFB',   // Very soft off-white
  surface: '#FFFFFF',      // Pure white for cards/modals
  
  // Inks / Text
  textPrimary: '#111827',  // Deep, friendly black
  textSecondary: '#6B7280',// Soft grey
  textMuted: '#9CA3AF',
  
  // Borders
  border: '#E5E7EB',
  cardOutline: '#111827',  // Used for high-contrast card borders where necessary
};
```

### Spacing & Layout
We use native flexbox layouts rather than hardcoded sizes to ensure full responsiveness across screens of all sizes.
```javascript
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radii = {
  sm: 8,
  md: 16,
  lg: 24,       // Primary for main cards (bubbly feel)
  huge: 32,
  pill: 999,    // Buttons, FABs
};
```

---

## Component Specifications

### Buttons
- **Shape:** Pill-shaped (`borderRadius: 999`).
- **Primary:** Solid `Colors.primary` background, white text. Soft native shadow to make it float.
- **Floating Action Button (FAB):** Large circle (e.g., 64x64) or expanded pill ("+ Report Issue"). Sits at the bottom right or center bottom of the Map.
- **Interactions:** Use `Pressable` with scaling animations (shrinks slightly on press using Reanimated or standard `Animated.spring`).

### Cards & Metrics
- **Shape:** `borderRadius: 24`, white background.
- **Style:** Can employ either a 1.5px black border for a high-concept graphic look, or a deep, soft grey shadow for a purely elevated look.
- **Gauges:** Use circular SVG elements to represent "liquid fill" for water level or standard animated rings (like Apple Fitness rings) for efficiency scores.

### Charts
- We will rely on `victory-native` to draw complex graphs (Day/Week/Month usages).
- Area charts should have a solid blue line with a semi-transparent linear downward gradient fill.

---

## Screens & Navigation

### Bottom Tab Bar
- **Tab Layout:** 4-5 tabs at the bottom.
- **Aesthetic:** Floating pill-style tab bar at the bottom instead of extending edge-to-edge, sitting slightly above the safe area. 
- **Icons:** Phosphor Icons (Fill variant for active, Regular variant for inactive).

### 1. Dashboard (Overview)
**Header:** 
- "MAJIMETER" centered, large, bold.
- Subtext: User's localized area name.
- Top-right bell icon (Phosphor: `BellRing`).

**Metric Grid:**
- **Water Level Card:** Large vertical card. Features an animated SVG circle filled dynamically with blue wavy liquid. Shows percentage text in the center.
- **Flow Rate Card:** Shows a mini sparkline chart indicating normal/abnormal flow.
- **Pressure Card:** A speedometer-style gauge. 

**Insights & Trends:**
- Large card at the bottom displaying "Daily Usage Trends".
- Bar chart (soft blue bars with rounded top corners).

### 2. Map & Reporting Tab
- **Map View:** Full-screen light map (Apple Maps or Google Maps light mode).
- **Markers:** Small distinct location pins with water drop icons. If there is an issue, marker is a high-contrast black bubble with an exclamation mark.
- **Reporting FAB:** A floating pill button at the bottom center: `[ Report Issue + ]`. Black background for the text body, primary blue circle for the `+` icon side.

### 3. Usage Insights (Analytics)
- **Time Selection:** Segmented control (Day | Week | Month | Year) using soft text styling.
- **Hero Chart:** Large area chart graphing usage patterns.
- **Stat Cards:** "Total Usage", "Average Flow", "Peak Usage".
- **Efficiency Ring:** A horizontal bar or ring component showing efficiency score with text recommendations below.

### 4. Reporting Flow (Modal Bottom Sheet)
Triggered via the FAB on the map.
- Rides up as a heavily rounded bottom sheet (e.g., using `gorhom/bottom-sheet`).
- **Step 1:** "Select Issue Type". Grid of massive, chunky, friendly icons (Phosphor: `Wrench`, `Drop`, `WarningCircle`, `Question`).
- Includes "Burst Pipe", "Water Shortage", "Infrastructure Issue", etc.
- **Actions:** Pill buttons for `Cancel` and `Next`.
- Fun, optimistic micro-animations transition the user through the 3-step reporting process.

---

## Animation Rules
- **Springs over Easing:** Everywhere. Modals, cards, scaling, and navigations should feel bouncy, weighty, and human, not rigid and linear.
- **Skeleton Loaders:** Instead of dull gray blocks, use soft pulsing rounded shapes with a very subtle blue tint to maintain the bubbly vibe during loads.
