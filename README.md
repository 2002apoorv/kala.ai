## Kala.ai — Setup

1) Install dependencies
```
pnpm i || npm i || yarn
```

2) Start the API server (optionally with Google Gemini for AI)
```
GEMINI_API_KEY=your_key_here node server/index.js
```

Optional background removal + enhancement:
```
REMOVE_BG_KEY=your_removebg_key GEMINI_API_KEY=your_key_here node server/index.js
```

3) Configure the mobile app to reach your server
- For Android emulator: use `http://10.0.2.2:4000`
- For iOS simulator: `http://localhost:4000`
- For physical devices: use your machine IP, e.g. `http://192.168.1.10:4000`

Set the URL via Expo env var before starting the app:
```
set EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

4) Run the app
```
npm run start
```

Then open:
- **Mobile App**: Use Expo Go or development build (Android/iOS)
- **Web Marketplace**: Press `w` in the terminal or visit the web URL to browse all published products at `/marketplace`

Login/Signup uses Firebase (config in `firebase/firebaseConfig.ts`).

5) **IMPORTANT: Update Firestore Security Rules**

Open [Firebase Console](https://console.firebase.google.com) → Your Project → Firestore Database → Rules

Copy and paste the rules from `firestore.rules` file, then click **Publish**.

This allows:
- Authenticated users to read/write their own user data
- Public access to published products (for marketplace)
- Public access to basic user info (name, location) for artisan display

Without these rules, you'll get "Missing or insufficient permissions" errors.

6) **IMPORTANT: Create Firestore Indexes**

When you first run the app, Firebase will show errors about missing indexes. You have two options:

**Option A: Click the link in the error message** (Easiest!)
- When you see an error like "The query requires an index", click the link provided in the error
- Firebase will automatically create the required index
- Wait a few minutes for the index to build

**Option B: Create indexes manually**

Go to [Firebase Console](https://console.firebase.google.com) → Your Project → Firestore Database → Indexes → Create Index

Create these composite indexes:

1. **For Dashboard (User's Products)**:
   - Collection ID: `products`
   - Fields to index:
     - `uid` (Ascending)
     - `status` (Ascending)
     - `createdAt` (Descending)
   - Query scope: Collection

2. **For Marketplace (All Products)**:
   - Collection ID: `products`
   - Fields to index:
     - `status` (Ascending)
     - `createdAt` (Descending)
   - Query scope: Collection

**Note:** The app will work without these indexes (using fallback queries), but indexes improve performance significantly. The app will automatically fall back to simpler queries if indexes are missing.

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
