# Kala.ai — Artisan Product Marketplace

A full-stack mobile and web marketplace platform for Indian artisans to showcase, sell, and manage handmade products using AI-powered product analysis and image enhancement.

## 🎯 Project Overview

**Kala.ai** connects artisans with customers through an intelligent marketplace. Artisans can:
- Photograph their products
- Use AI (Google Gemini) to generate product titles, descriptions, and pricing
- Enhance images (remove backgrounds, resize, sharpen)
- Publish products to the marketplace
- Manage inventory and earnings

Customers can:
- Browse the marketplace
- Search products by artisan or category
- View product details and reviews
- Purchase from authenticated sellers

## 🏗️ Architecture

### Stack
- **Frontend**: React Native (Expo) with file-based routing, TypeScript
- **Backend**: Node.js/Express.js with MongoDB GridFS for image storage
- **Auth & Database**: Firebase Authentication + Firestore
- **AI Services**: Google Generative AI (Gemini Vision API)
- **Image Processing**: `sharp` for enhancement, `remove.bg` API for background removal

### Technology Stack

| Layer | Technology |
|-------|------------|
| Mobile/Web | Expo (React Native), React 19, TypeScript |
| Backend | Express.js 5.x, Node.js |
| Database | MongoDB (GridFS for images), Firestore (app data) |
| Auth | Firebase Authentication |
| AI | Google Generative AI (Gemini 2.5 Flash) |
| Image Processing | Sharp, remove.bg API |
| HTTP Client | Axios, node-fetch |
| State Management | React Hooks, Firebase SDK |

## 📁 Project Structure

```
kala.ai/
├── app/                          # Expo Router (File-based routing)
│   ├── (tabs)/
│   │   ├── index.tsx            # Dashboard (user's products)
│   │   ├── add.tsx              # Add new product (image + AI generation)
│   │   ├── marketplace.tsx       # Browse all products
│   │   └── profile.tsx          # User profile & settings
│   ├── product/
│   │   └── [id].tsx             # Product detail screen
│   ├── login.tsx                # Firebase login
│   ├── signup.tsx               # Firebase signup
│   └── _layout.tsx              # Root layout
├── server/
│   └── index.js                 # Express backend (Node.js)
├── components/                  # Reusable UI components
├── firebase/
│   ├── firebase.js              # Firebase SDK init
│   └── firebaseConfig.ts        # Firebase config (API keys)
├── constants/
│   ├── api.ts                   # API endpoint constants
│   └── theme.ts                 # UI theme (colors, spacing, typography)
├── hooks/                       # Custom React hooks
├── scripts/
│   └── reset-project.js         # Expo project reset
├── android/                     # Android native code (Gradle)
├── app.json                     # Expo configuration
├── tsconfig.json                # TypeScript config
├── package.json                 # Dependencies
├── .env                         # Environment variables (GITIGNORED)
├── .env.example                 # Env template (for reference)
└── firestore.rules              # Firestore security rules
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** 16+ and npm/pnpm/yarn
- **Expo CLI**: `npm install -g expo-cli`
- **Firebase Project** with Firestore enabled
- **API Keys**: Google Gemini, remove.bg (optional)
- **MongoDB Atlas** account for image storage (optional, can use local fallback)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/2002apoorv/kala.ai.git
   cd kala.ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or: pnpm i / yarn
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Fill in required values:
     ```bash
     GEMINI_API_KEY=your_google_gemini_api_key
     REMOVE_BG_KEY=your_removebg_api_key
     EXPO_PUBLIC_API_URL=http://localhost:4000
     MONGODB_URI=your_mongodb_connection_string
     ```

4. **Setup Firebase**
   - Update `firebase/firebaseConfig.ts` with your Firebase project credentials
   - Deploy Firestore security rules (see below)

### Running the App

#### Start the Backend Server
```bash
# Terminal 1: Start Node.js server
GEMINI_API_KEY=your_key REMOVE_BG_KEY=your_key node server/index.js
# Server runs on http://0.0.0.0:4000
```

#### Start the Mobile App
```bash
# Terminal 2: Start Expo dev server
npm run start
# Or for specific platform:
npm run android
npm run ios
npm run web
```

#### Configure API URL for Mobile Emulator
- **Android Emulator**: Use `http://10.0.2.2:4000` (special alias for host machine)
- **iOS Simulator**: Use `http://localhost:4000`
- **Physical Device**: Use your machine's IP (e.g., `http://192.168.1.10:4000`)

Set via Expo env var:
```bash
set EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

## 🔑 Key Features

### 1. **AI-Powered Product Generation**
- **Image Cropping & Enhancement**: Remove backgrounds, resize, sharpen using `sharp` and remove.bg API
- **Auto-Generate Metadata**: Use Google Gemini Vision API to analyze product images and generate:
  - SEO-friendly product titles (max 60 chars)
  - Detailed descriptions (80-120 words)
  - Estimated market price in Indian Rupees (₹)

### 2. **Image Management**
- **Image Upload**: Capture or select photos with Expo's Image Picker
- **Storage**: MongoDB GridFS for scalable image storage
- **Retrieval**: Cached image serving with 1-year browser cache

### 3. **Firebase Integration**
- **Authentication**: Email/password signup & login
- **Firestore Database**: Store user profiles, products, orders
- **Security Rules**: Role-based access (user data, published products)

### 4. **Marketplace**
- **Browse Products**: View all published artisan products
- **Product Details**: Full product info with images and seller details
- **Search & Filter**: (Framework ready, implementation extensible)

### 5. **Artisan Dashboard**
- **Manage Products**: View, edit, delete personal products
- **Analytics**: Track views, sales (foundation for future)

## 🛠️ Backend API Endpoints

### Image Processing
- **POST** `/api/enhance-image`
  - Crop, remove background, and enhance image
  - Body: `{ croppedImageBase64: string }`
  - Response: `{ ok: boolean, enhancedImageUrl: string }`

- **POST** `/api/crop-and-enhance` (Legacy)
  - Combined crop and enhancement endpoint
  - Backward compatibility

### AI Generation
- **POST** `/api/generate-product-info`
  - Analyze product image and generate title, description, price
  - Body: `{ croppedImageBase64: string, language?: string }`
  - Response: `{ ok: boolean, title, description, estimatedPrice }`

### Image Upload & Retrieval
- **POST** `/api/upload-image`
  - Upload image to MongoDB GridFS
  - Body: `{ imageBase64: string, userId?: string }`
  - Response: `{ ok: boolean, imageId, imageUrl }`

- **GET** `/api/image/:imageId`
  - Retrieve image from GridFS
  - Response: Image binary (with proper MIME type and cache headers)

### Publishing
- **POST** `/api/publish`
  - Publish product to marketplace
  - Body: `{ marketplaces: {}, title: string }`
  - Response: `{ ok: boolean, submitted: array, title: string }`

### Health Check
- **GET** `/health`
  - Server health check
  - Response: `{ ok: boolean, message: string }`

## 🔒 Security Setup

### Firebase Firestore Security Rules
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → Firestore Database → Rules
3. Copy content from `firestore.rules` and publish
4. Rules enforce:
   - Users can only read/write their own data
   - Published products visible to all
   - Seller info (name, location) public for artisan profiles

### Environment Variables
- **Never commit `.env`** — it's in `.gitignore`
- Use `.env.example` as template
- Rotate credentials if exposed
- Set strong MongoDB passwords

### API Key Management
- Store keys in environment variables
- Use rate limiting in production (add `express-rate-limit`)
- Monitor API usage (Gemini quotas, remove.bg limits)

## 📊 Database Schema

### Firestore Collections

**users**
```json
{
  "uid": "firebase-auth-uid",
  "name": "Artisan Name",
  "email": "user@example.com",
  "location": "City, State",
  "profileImage": "url-to-image",
  "bio": "Bio text",
  "createdAt": "timestamp"
}
```

**products**
```json
{
  "uid": "creator-uid",
  "title": "Product Title",
  "description": "Detailed description",
  "price": 1299,
  "quantity": 10,
  "imageUrl": "firebase-storage-url",
  "imageId": "mongodb-gridfs-id",
  "status": "published|draft",
  "category": "pottery|textile|jewelry|...",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### MongoDB Collections (GridFS)
- **images.files** & **images.chunks**: GridFS buckets for product images

## 🚢 Deployment

### Deploy Backend Server

**Heroku** (or any Node.js hosting)
```bash
# Create Procfile
echo "web: node server/index.js" > Procfile

# Deploy
git push heroku main
```

**Render** or **Railway**
```bash
# Set environment variables in dashboard:
# GEMINI_API_KEY, REMOVE_BG_KEY, MONGODB_URI

# Connect GitHub repo and auto-deploy
```

### Deploy Mobile App

**Expo** (managed hosting)
```bash
npm run build:android
npm run build:ios
```

**Bare React Native** (for App Store/Google Play)
- Use Expo development build tools
- Set `EXPO_PUBLIC_API_URL` to production backend

### Domain & SSL
- Use a CDN (Cloudflare) for API endpoint
- Enable HTTPS for all endpoints
- Restrict CORS to production domain

## 📦 Dependencies Overview

### Core
- **expo**: Cross-platform development framework
- **react-native**: Mobile UI framework
- **react-navigation**: Screen navigation
- **firebase**: Auth & Firestore

### UI
- **react-native-paper**: Material Design components
- **@react-native-async-storage**: Local storage
- **expo-image-picker**: Camera & gallery access

### Backend
- **express**: Web framework
- **mongodb**: Database driver & GridFS
- **multer**: File upload middleware
- **@google/generative-ai**: AI API client

### Image Processing
- **sharp**: Fast image resizing & manipulation
- **remove.bg**: Background removal API

### Dev Tools
- **typescript**: Type safety
- **eslint**: Code linting

## 🐛 Common Issues & Troubleshooting

### 1. **"Cannot connect to API server"**
   - Verify backend is running on port 4000
   - Check `EXPO_PUBLIC_API_URL` matches your machine IP
   - Use `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find IP

### 2. **"Gemini API key not configured"**
   - Set `GEMINI_API_KEY` in `.env`
   - Ensure key is valid at [Google AI Studio](https://makersuite.google.com/app/apikey)

### 3. **"Missing or insufficient permissions" (Firestore)**
   - Deploy `firestore.rules` (see Security Setup)
   - Wait for rules to propagate (1-2 mins)

### 4. **"Image upload fails"**
   - Check MongoDB connection (MONGODB_URI in `.env`)
   - Ensure MongoDB Atlas IP whitelist includes your machine
   - Verify GridFS bucket exists

### 5. **".env file being pushed to GitHub"**
   - Run: `git rm --cached .env`
   - Commit: `git commit -m "Remove .env from tracking"`
   - Push: `git push origin main`
   - Rotate all exposed API keys immediately

## 🔄 Development Workflow

### Adding a New Feature
1. Create a branch: `git checkout -b feat/feature-name`
2. Implement in mobile app (`app/`) or backend (`server/`)
3. Test on emulator or device
4. Commit with descriptive message: `git commit -m "feat: add feature"`
5. Push: `git push origin feat/feature-name`
6. Open Pull Request on GitHub

### Updating Dependencies
```bash
npm update                  # Update to latest patch versions
npm install <package>@latest  # Install specific latest version
npm audit                   # Check for vulnerabilities
npm audit fix               # Auto-fix if possible
```

### Linting & Format
```bash
npm run lint                # Run ESLint
npm run lint -- --fix       # Auto-fix issues
```

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [Firebase Docs](https://firebase.google.com/docs)
- [Google Generative AI](https://ai.google.dev)
- [MongoDB GridFS](https://docs.mongodb.com/manual/core/gridfs/)
- [Express.js Guide](https://expressjs.com)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit changes: `git commit -m "feat: your feature"`
4. Push to branch: `git push origin feat/your-feature`
5. Open a Pull Request

## 📝 License

This project is open source. Check `LICENSE` file for details.

## 👥 Authors

- **Apoorv Singh** ([@2002apoorv](https://github.com/2002apoorv))

## 🎓 Learning Outcomes

This project demonstrates:
- Full-stack mobile app development (Expo/React Native)
- Backend API design (Express.js, RESTful endpoints)
- Cloud integration (Firebase, MongoDB, Google AI)
- Image processing and optimization
- Authentication and authorization
- Database design and queries
- DevOps basics (environment management, deployment)

## 📞 Support & Issues

- **Report Issues**: [GitHub Issues](https://github.com/2002apoorv/kala.ai/issues)
- **Email**: apoorv2002singh@example.com (update with your contact)
- **Discord Community**: (Link if available)

---

**Last Updated**: November 16, 2025  
**Project Status**: Active Development
