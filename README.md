# Aanira Milk & Milk Products (Kovaipudur)
> **Fresh Milk • Healthy Family**
> Cross-Platform React Native & Web Application

---

## 📱 Features & Screens Implemented

### 1. 🔐 Login Screen
- **Branding**: Official Aanira Milk royal blue header, cow logo, milk drop graphics, and "📍 Kovaipudur" badge.
- **Supply Boy ID**: Quick login selector profiles (`RAVI`, `BALA`, `KUMAR`, `ADMIN`) or manual ID input.
- **Area Selector**: Area 1 (Kovaipudur North), Area 2 (Kovaipudur South), Area 3 (Ashram Road), Area 4.
- **Scenic Meadow Illustration**: Bottom pasture with grazing spotted cow, wildflower meadow, and fresh milk bottle.

### 2. 🥛 Add Milk Entry Screen
- **Shift Toggle**: ☀️ **Morning** & 🌙 **Evening** shift selector tabs.
- **Date Navigation**: Active date display (`03-10-2026`) with 1-tap previous/next day navigation.
- **Customer Delivery Table**:
  - Columns: `#`, `Customer Name`, `Qty (L)`, `Amount (₹)`
  - Real-time customer search & area filters.
  - **Dynamic Quantity Preset Controls**: `1/4 L (0.25)`, `1/2 L (0.5)`, `1 L`, `1.5 L`, `2 L`, custom decimal input, and inline `+` / `-` steppers.
  - Automatically prefills each customer's morning vs. evening delivery habits.
- **Real-Time Summary Bar**:
  - `Total Customers` count
  - `Total Milk (L)` sum
  - `Total Amount (₹)` calculated dynamically based on customer rates.
- **Save Entry**: 💾 Saves daily deliveries with instant feedback toast.

### 3. 📊 Monthly Summary Screen
- **Monthly Selector**: October 2026, September 2026, August 2026.
- **KPI Summary Cards**:
  - `Total Customers`: e.g. **18**
  - `Total Milk (L)`: e.g. **245.5 L**
  - `Total Amount`: e.g. **₹12,275**
- **Customer-Wise Breakdown**:
  - List showing `#`, `Customer Name`, `Total Milk (L)`, `Amount (₹)`.
  - Tap any customer row (e.g. *Kumar*, *Ravi*, *Priya*, *Suresh*, *Meena*, *Logan*) to navigate directly to their itemized monthly bill.

### 4. 🧾 Customer Bill Screen & WhatsApp Integration
- **Customer Header**: Name, Phone number (`+91 98765 43210`), and quick WhatsApp action pill.
- **Itemized Delivery Breakdown**:
  - Complete daily delivery sheet with `Date`, `Shift` (Morning/Evening badges), `Qty (L)`, and `Amount (₹)`.
- **Monthly Totals**: `Total Milk (L)` and `Total Amount (₹)`.
- **WhatsApp Automation**:
  - 🟢 **Send Monthly Bill via WhatsApp** button.
  - Generates professional formatted WhatsApp billing text with customer details, dates, liter breakdown, totals, and UPI payment info.

### 5. ⚙️ Masters & Configuration Panel
- **Customers Master**: Add/Edit customer name, phone number, area, default morning quantity (L), default evening quantity (L), and custom price per liter.
- **Rates & Quantity Units**: Adjust base milk price per liter (e.g. ₹60) and view quantity units (`1/4 L`, `1/2 L`, `1 L`, etc.).
- **Areas Master**: Add new delivery routes and areas.
- **Delivery Boys Master**: Add and assign delivery boys to specific routes.
- **Reset Demo Data**: Restore seed data anytime for testing and demonstration.

---

## 🚀 Running the App

### Web (Browser)
```bash
npm run web
# Opens http://localhost:8081 with responsive mobile simulator & dashboard modes
```

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

---

## 🛠️ Tech Stack
- **Framework**: React Native + Expo (SDK 57) + React Native Web
- **Icons & Graphics**: `@expo/vector-icons` (Ionicons), `react-native-svg` custom vector brand illustrations
- **Persistence**: `@react-native-async-storage/async-storage` with automatic local sync
