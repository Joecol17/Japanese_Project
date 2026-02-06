# 🚀 Quick Start - Cloudflare + Firebase Backend

## First Time Setup (5 minutes)

### 1. Run Setup Script
```powershell
cd "c:\Users\josep\OneDrive - Farnborough College of Technology\Documents\GitHub\Japanese_Project"
.\setup-local-dev.ps1
```

This will:
- ✅ Install Firebase CLI and Wrangler
- ✅ Create .gitignore and .env.local
- ✅ Set up VS Code debugging
- ✅ Create helpful npm scripts

### 2. Configure Firebase Service Account

Get your service account from Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → Settings → Service Accounts
3. Click "Generate new private key"
4. Save the JSON file

### 3. Set Cloudflare Secret

```powershell
cd cloudflare
wrangler login
wrangler secret put FIREBASE_SERVICE_ACCOUNT
# Paste the entire JSON content when prompted
```

### 4. Create `.dev.vars` for Local Testing

Create `cloudflare/.dev.vars`:
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"japanese-slots",...}
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
```

## Local Development (Daily Use)

### Start Everything

Open **3 terminals**:

**Terminal 1 - Firebase Emulators:**
```powershell
npm run dev
```
- Emulator UI: http://localhost:4000
- Firestore: http://localhost:8080
- Functions: http://localhost:5001

**Terminal 2 - Cloudflare Worker:**
```powershell
npm run dev:worker
```
- Worker: http://localhost:8787

**Terminal 3 - Web Server:**
```powershell
python -m http.server 5500
# OR right-click index.html → "Open with Live Server"
```
- Website: http://localhost:5500

### Make Changes

Your code will auto-reload! Just save and refresh.

### Use Emulators in Frontend

Update your JavaScript to use emulators:

```javascript
import { BackendAPI } from './js/backend-config.js';

const api = new BackendAPI();

// Connect to emulators in development
if (window.location.hostname === 'localhost') {
  // Use Firebase emulator
  firebase.functions().useEmulator('localhost', 5001);
  firebase.firestore().useEmulator('localhost', 8080);
}

await api.initFirebase(...);
```

## Deployment (Production)

### Deploy Everything
```powershell
npm run deploy
```

### Deploy Specific Service
```powershell
npm run deploy:cf    # Cloudflare only
npm run deploy:fb    # Firebase only
```

### View Logs
```powershell
npm run logs:worker     # Cloudflare Worker logs
npm run logs:functions  # Firebase Function logs
```

## Common Tasks

### Test Cloudflare Worker Locally
```powershell
curl http://localhost:8787 -Method POST -ContentType "application/json" -Body '{"name":"Test","score":100,"collection":"scores"}'
```

### Test Firebase Function Locally
```javascript
// In browser console
const functions = firebase.functions();
functions.useEmulator('localhost', 5001);
const placeBet = functions.httpsCallable('placeBetAndSpin');
placeBet({ bet: 10 }).then(r => console.log(r.data));
```

### Clear Emulator Data
```powershell
firebase emulators:kill
rm -r .firebase  # or manually delete .firebase folder
firebase emulators:start
```

## Architecture Overview

```
┌─────────────┐
│  Frontend   │
│  (HTML/JS)  │
└─────┬───────┘
      │
      ├─────────────────────┐
      │                     │
      ▼                     ▼
┌──────────────┐    ┌──────────────┐
│  Cloudflare  │    │   Firebase   │
│   Worker     │    │  Functions   │
│              │    │              │
│ • Score save │    │ • Game logic │
│ • Rate limit │    │ • Wallets    │
│ • Validation │    │ • Auth       │
└──────┬───────┘    └──────┬───────┘
       │                   │
       └────────┬──────────┘
                ▼
        ┌───────────────┐
        │   Firestore   │
        │   Database    │
        │               │
        │ • scores      │
        │ • wallets     │
        │ • rounds      │
        └───────────────┘
```

## Why This Architecture?

### Cloudflare Worker
- ⚡ **Fast**: Edge computing = low latency worldwide
- 💰 **Cheap**: 100K free requests/day
- 🛡️ **Secure**: Built-in rate limiting
- 📊 **Simple**: Stateless score saving

### Firebase Functions
- 🔐 **Authenticated**: Built-in auth integration
- 💾 **Transactional**: Atomic database operations
- 🎯 **Complex Logic**: Game rules, wallet updates
- 🔄 **Reliable**: Automatic retries

## Troubleshooting

### "Firebase Service Account not configured"
```powershell
cd cloudflare
wrangler secret put FIREBASE_SERVICE_ACCOUNT
```

### "Port already in use"
Kill the process using the port:
```powershell
# Find process on port 5001
netstat -ano | findstr :5001
# Kill it
taskkill /PID <PID> /F
```

### "CORS errors"
Update `ALLOWED_ORIGINS` in `cloudflare/wrangler.toml`

### "Emulator connection refused"
Make sure emulators are running:
```powershell
firebase emulators:start
```

## Files Reference

| File | Purpose |
|------|---------|
| `BACKEND_SETUP.md` | Complete setup guide |
| `DEV_GUIDE.md` | Development workflows |
| `QUICKSTART.md` | This file! |
| `deploy-backend.ps1` | Deployment automation |
| `setup-local-dev.ps1` | Local setup automation |
| `js/backend-config.js` | Frontend API wrapper |
| `cloudflare/worker-save-score.js` | Cloudflare Worker code |
| `functions/index.js` | Firebase Functions code |

## Getting Help

1. Check logs: `npm run logs:worker` or `npm run logs:functions`
2. Use emulator UI: http://localhost:4000
3. Check Firebase Console: https://console.firebase.google.com/
4. Check Cloudflare Dashboard: https://dash.cloudflare.com/

## Next Steps

- [ ] Run `.\setup-local-dev.ps1`
- [ ] Configure service account
- [ ] Test locally with emulators
- [ ] Deploy to production
- [ ] Set up authentication
- [ ] Add monitoring/alerts

---

**Need more details?** See [BACKEND_SETUP.md](BACKEND_SETUP.md) and [DEV_GUIDE.md](DEV_GUIDE.md)
