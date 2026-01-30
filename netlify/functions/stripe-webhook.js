const Stripe = require("stripe");
const admin = require('firebase-admin');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin using service account JSON provided in env var
function initFirebase() {
  if (admin.apps && admin.apps.length) return admin;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) {
    console.warn('FIREBASE_SERVICE_ACCOUNT not provided; webhook will not update Firestore.');
    return null;
  }
  let creds;
  try {
    creds = JSON.parse(svc);
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON', e);
    return null;
  }
  admin.initializeApp({ credential: admin.credential.cert(creds) });
  return admin;
}

exports.handler = async (event) => {
  const sig = (event.headers && (event.headers['stripe-signature'] || event.headers['Stripe-Signature'])) || '';

  // Stripe expects the raw request body for signature verification
  const rawBody = event.body || '';

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err && err.message);
    return { statusCode: 400, body: `Webhook Error: ${err && err.message}` };
  }

  // Handle checkout.session.completed and credit the user's wallet if uid was attached
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    console.log('✅ Payment successful:', session.id, 'metadata:', session.metadata);

    const uid = session.metadata && session.metadata.uid;
    const creditAmount = Number(process.env.STRIPE_CREDIT_AMOUNT || '1000'); // credits to add per successful purchase

    const adminSdk = initFirebase();
    if (!adminSdk) {
      console.warn('Firebase admin not initialized; skipping wallet update.');
      return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }

    try {
      const db = adminSdk.firestore();
      if (uid) {
        const walletRef = db.collection('wallets').doc(String(uid));
        // transactionally increment credits and set metadata
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(walletRef);
          if (!snap.exists) {
            tx.set(walletRef, {
              credits: creditAmount,
              lastPaidAt: adminSdk.firestore.FieldValue.serverTimestamp(),
              stripeSessions: [session.id]
            });
          } else {
            tx.update(walletRef, {
              credits: adminSdk.firestore.FieldValue.increment(creditAmount),
              lastPaidAt: adminSdk.firestore.FieldValue.serverTimestamp(),
              stripeSessions: adminSdk.firestore.FieldValue.arrayUnion(session.id)
            });
          }
        });
        console.log(`Credited ${creditAmount} credits to uid=${uid}`);
      } else {
        console.warn('No uid metadata on session; not updating any wallet.');
      }
    } catch (e) {
      console.error('Error updating Firestore wallet:', e);
      // still return 200 to acknowledge the webhook to Stripe; you may retry separately
      return { statusCode: 200, body: JSON.stringify({ received: true, error: String(e) }) };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
