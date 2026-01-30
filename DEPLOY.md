Deployment steps
Deployment steps

1) Install Firebase CLI (if not already):

```powershell
npm install -g firebase-tools
firebase login
```

2) Configure project locally (optional):

```powershell
firebase use --add
# choose your project id
```

3) Install function dependencies and deploy from your machine:

```powershell
cd functions
npm install
cd ..
firebase deploy --only functions,firestore:rules --project YOUR_PROJECT_ID
```

4) Or use GitHub Actions (recommended for CI):
- Add repository secrets `FIREBASE_TOKEN` and `FIREBASE_PROJECT`.
  - `FIREBASE_TOKEN` can be created with `firebase login:ci` and copying the token.
  - `FIREBASE_PROJECT` is your Firebase project id.
- Push to `main` to trigger the workflow.

5) Enable Anonymous Authentication in Firebase Console → Authentication → Sign-in method → Anonymous.
6) Verify Firestore rules are active in Firestore → Rules and that `wallets/{uid}` cannot be written from client.
7) Test in browser: open `slot_machine.html`, sign-in anonymously, perform spin and verify `wallets/{uid}` updates.

8) Stripe environment variables (for Netlify functions):

- `STRIPE_SECRET_KEY`: your Stripe secret API key (starts with `sk_live_...` for production or `sk_test_...` for testing)
- `STRIPE_PRICE_ID`: the Price ID configured in Stripe for the product you sell (optional if you create sessions with a dynamic amount)
- `STRIPE_SUCCESS_URL`: full URL to your `success.html` (optional; defaults to `/success.html`)
- `SITE_URL`: optional base URL for redirects (e.g. `https://your-site.example`)

9) Stripe webhook & Firebase service account (Netlify environment variables):

- `STRIPE_WEBHOOK_SECRET`: the webhook signing secret from your Stripe dashboard (used to verify incoming webhooks).
- `FIREBASE_SERVICE_ACCOUNT`: JSON string of a Firebase service account key (set this in Netlify as a secret). Example value is the JSON blob from Google Cloud service account credentials. The webhook uses this to update Firestore wallets when checkout succeeds.
- `STRIPE_CREDIT_AMOUNT`: optional number of in-app credits to grant per successful purchase (default `1000`).

Important: keep `FIREBASE_SERVICE_ACCOUNT` and `STRIPE_SECRET_KEY` private. In Netlify, add them under Site → Settings → Build & deploy → Environment → Environment variables.

When deploying to Netlify, add those env vars in the Netlify site settings (or set them in your CI environment). Example local test with `netlify dev` or similar should set these env vars before invoking functions.
