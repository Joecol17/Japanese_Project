# Cloudflare + Firebase Backend Integration Guide

## Overview
This project uses a hybrid backend architecture:
- **Cloudflare Workers**: Edge computing for score saving (low latency, global distribution)
- **Firebase Functions**: Server-side game logic and wallet management
- **Firebase Firestore**: Database for scores, wallets, and game rounds

## Current Architecture

```
Frontend (HTML/JS)
    ├─→ Cloudflare Worker (save-score.japanesegyanburu.workers.dev)
    │       └─→ Firestore (via REST API) - saves scores
    │
    └─→ Firebase Functions (us-central1-japanese-slots.cloudfunctions.net)
            └─→ Firestore (via Admin SDK) - game logic & wallet updates
```

## Setup Instructions

### 1. Firebase Setup

#### Install Firebase CLI
```powershell
npm install -g firebase-tools
firebase login
```

#### Initialize Firebase Project
```powershell
# Navigate to project root
cd "c:\Users\josep\OneDrive - Farnborough College of Technology\Documents\GitHub\Japanese_Project"

# Initialize Firebase (if not already done)
firebase init
```

Select:
- Firestore (rules and indexes)
- Functions (Cloud Functions)

#### Deploy Firebase Functions
```powershell
# Option 1: Deploy the main functions
cd functions
npm install
firebase deploy --only functions

# Option 2: Deploy placeBet functions
cd firebase_functions/placeBet
npm install
firebase deploy --only functions
```

#### Get Service Account Key
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Project Settings → Service Accounts
3. Click "Generate New Private Key"
4. Save the JSON file securely (DO NOT commit to git)

### 2. Cloudflare Workers Setup

#### Install Wrangler CLI
```powershell
npm install -g wrangler
wrangler login
```

#### Configure KV Namespace (for rate limiting)
```powershell
cd cloudflare

# Create KV namespace if not exists
wrangler kv:namespace create "RATE_LIMIT"

# Update wrangler.toml with the ID returned
```

#### Set Firebase Service Account Secret
```powershell
# Base64 encode your service account JSON or paste the JSON directly
wrangler secret put FIREBASE_SERVICE_ACCOUNT

# When prompted, paste your service account JSON
```

#### Deploy Worker
```powershell
cd cloudflare
wrangler deploy
```

### 3. Environment Configuration

#### Update Firebase Config in HTML Files
Find and update the Firebase config in your HTML files (gambling.html, etc.):

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "japanese-slots.firebaseapp.com",
  projectId: "japanese-slots",
  storageBucket: "japanese-slots.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

#### Update Allowed Origins
In `cloudflare/wrangler.toml`:
```toml
ALLOWED_ORIGINS = "https://your-production-domain.com,http://localhost:5500,http://127.0.0.1:5500"
```

### 4. Firestore Security Rules

Update your `firebase.rules` to secure your database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read for scores leaderboard
    match /scores/{scoreId} {
      allow read: if true;
      allow create: if request.auth != null || true; // Allow worker writes
    }
    
    match /pachinko_scores/{scoreId} {
      allow read: if true;
      allow create: if request.auth != null || true; // Allow worker writes
    }
    
    // User wallets - authenticated only
    match /wallets/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /rounds/{roundId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if false; // Only functions can write
      }
    }
    
    // Rate limits - functions only
    match /rate_limits/{userId} {
      allow read, write: if false;
    }
  }
}
```

Deploy rules:
```powershell
firebase deploy --only firestore:rules
```

### 5. Testing the Integration

#### Test Cloudflare Worker
```powershell
# Test score submission
curl -X POST https://save-score.japanesegyanburu.workers.dev `
  -H "Content-Type: application/json" `
  -d '{\"name\":\"TestPlayer\",\"score\":1000,\"collection\":\"scores\",\"maxBet\":100,\"maxMultiplier\":10,\"roundsPlayed\":100}'
```

#### Test Firebase Function
```javascript
// In browser console on your site
const functions = firebase.functions();
const placeBet = functions.httpsCallable('placeBetAndSpin');

placeBet({ bet: 10 })
  .then(result => console.log('Result:', result.data))
  .catch(error => console.error('Error:', error));
```

## Integration Points

### Frontend → Cloudflare Worker
**Purpose**: Save scores to leaderboard

```javascript
async function saveScore(name, score, collection) {
  const response = await fetch('https://save-score.japanesegyanburu.workers.dev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      score,
      collection,
      maxBet: 100,
      maxMultiplier: 10,
      roundsPlayed: 100
    })
  });
  return response.json();
}
```

### Frontend → Firebase Functions
**Purpose**: Execute game logic (spins, bets)

```javascript
const functions = firebase.functions();
const placeBetAndSpin = functions.httpsCallable('placeBetAndSpin');

async function spin(betAmount) {
  try {
    const result = await placeBetAndSpin({ 
      bet: betAmount,
      iconCount: 12 
    });
    console.log('Spin result:', result.data);
    return result.data;
  } catch (error) {
    console.error('Spin error:', error);
    throw error;
  }
}
```

## Common Issues & Solutions

### Issue: CORS Errors
**Solution**: Ensure `ALLOWED_ORIGINS` in wrangler.toml includes your domain

### Issue: "Insufficient Permissions"
**Solution**: Check Firestore rules and ensure user is authenticated

### Issue: Rate Limiting
**Solution**: Cloudflare Worker includes rate limiting (20 requests/minute per IP)

### Issue: Firebase Functions timeout
**Solution**: Functions have a 60s timeout by default. Increase in firebase.json:
```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20",
    "memory": "256MB",
    "timeoutSeconds": 60
  }
}
```

## Monitoring

### Cloudflare Logs
```powershell
wrangler tail
```

### Firebase Logs
```powershell
firebase functions:log
```

Or view in [Firebase Console](https://console.firebase.google.com/) → Functions → Logs

## Cost Optimization

- **Cloudflare Workers**: 100,000 free requests/day
- **Firebase Functions**: First 2M invocations/month free
- **Firestore**: First 50K reads, 20K writes/day free

Consider:
1. Cache leaderboard data client-side
2. Batch score updates
3. Use Cloudflare Worker for read-heavy operations
4. Use Firebase Functions for write-heavy with validation

## Security Checklist

- [ ] Firebase service account stored as Cloudflare secret (not in code)
- [ ] Firestore rules properly configured
- [ ] CORS origins restricted to your domains
- [ ] Rate limiting enabled
- [ ] Score validation logic server-side
- [ ] Authentication required for wallet operations
- [ ] `.env` files in `.gitignore`

## Next Steps

1. Set up Firebase Authentication for users
2. Add more game logic to Firebase Functions
3. Create admin dashboard for monitoring
4. Add analytics tracking
5. Set up staging and production environments
