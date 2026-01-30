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
