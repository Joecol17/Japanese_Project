const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

function rngIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simple rate-limit policy per user to prevent mass spins
async function checkAndUpdateRateLimit(tx, uid) {
  const metaRef = db.collection('rate_limits').doc(uid);
  const metaSnap = await tx.get(metaRef);
  const now = Date.now();
  const COOL_DOWN_MS = 800; // min ms between spins
  const WINDOW_MS = 60 * 1000; // 1 minute window
  const WINDOW_LIMIT = 30; // max spins per window

  let meta = {};
  if (metaSnap.exists) meta = metaSnap.data();

  const lastSpinAt = meta.lastSpinAt || 0;
  if (now - lastSpinAt < COOL_DOWN_MS) {
    throw new functions.https.HttpsError('resource-exhausted', 'Spins are too frequent; please slow down.');
  }

  let windowStart = meta.windowStart || 0;
  let windowCount = meta.windowCount || 0;

  if (now - windowStart < WINDOW_MS) {
    if (windowCount >= WINDOW_LIMIT) {
      throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded for spins.');
    }
    windowCount += 1;
  } else {
    windowStart = now;
    windowCount = 1;
  }

  tx.set(metaRef, { lastSpinAt: now, windowStart, windowCount }, { merge: true });
}

exports.placeBetAndSpin = functions.https.onCall(async (data, context) => {
  const uid = context.auth && context.auth.uid;
  if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');

  const bet = Number(data.bet || 0);
  if (!Number.isFinite(bet) || bet <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Bet must be a positive number.');
  }

  const walletRef = db.collection('wallets').doc(uid);

  try {
    const result = await db.runTransaction(async (tx) => {
      const walletSnap = await tx.get(walletRef);
      if (!walletSnap.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'Wallet does not exist.');
      }

      const wallet = walletSnap.data();
      const credits = Number(wallet.credits || 0);
      if (credits < bet) {
        throw new functions.https.HttpsError('failed-precondition', 'Insufficient credits.');
      }

      // Rate-limit check/update
      await checkAndUpdateRateLimit(tx, uid);

      // Generate server RNG outcome for a slot of 3 icons from 0..(N-1)
      const ICON_COUNT = Number(data.iconCount) || 12; // default 12
      const indices = [];
      for (let i = 0; i < 3; i++) indices.push(rngIntInclusive(0, ICON_COUNT - 1));

      // Compute payout: simple rule - 3 of a kind => bet*10, pair => bet*2, else lose
      let payout = -bet;
      let type = 'lose';
      if (indices[0] === indices[1] && indices[1] === indices[2]) {
        payout = bet * 10;
        type = 'three';
      } else if (indices[0] === indices[1] || indices[1] === indices[2] || indices[0] === indices[2]) {
        payout = bet * 2;
        type = 'pair';
      }

      const newCredits = credits + payout;

      tx.update(walletRef, { credits: newCredits, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });

      // Log the round
      const roundsRef = db.collection('rounds');
      tx.set(roundsRef.doc(), {
        uid,
        bet,
        indices,
        payout,
        type,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { indices, payout, type, newCredits };
    });

    return result;
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    console.error('placeBetAndSpin error:', err);
    throw new functions.https.HttpsError('internal', 'Server error during spin.');
  }
});

exports.saveScore = functions.https.onCall(async (data, context) => {
  const uid = context.auth && context.auth.uid;
  if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');

  let name = String(data.name || '').trim().slice(0, 50);
  let score = Number(data.score || 0);
  if (!Number.isFinite(score) || score < 0) score = 0;

  // Sanitize name basic: remove newlines
  name = name.replace(/[\r\n]/g, ' ');
  if (name.length === 0) name = 'Anonymous';

  const docRef = db.collection('scores').doc();
  await docRef.set({ uid, name, score, createdAt: admin.firestore.FieldValue.serverTimestamp() });

  return { ok: true };
});
