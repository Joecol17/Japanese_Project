const functions = require('firebase-functions');
const admin = require('firebase-admin');

if(!admin.apps.length) admin.initializeApp();

// Utility: returns a random integer [0,n)
function randInt(n){ return Math.floor(Math.random()*n); }

// Server-side spin function for the slot machine
// Expects data:{ bet: number }
// Requires context.auth
exports.placeBetAndSpin = functions.https.onCall(async (data, context) => {
  if(!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = context.auth.uid;
  const bet = Number(data.bet || 0);
  if(!Number.isFinite(bet) || bet <= 0){
    throw new functions.https.HttpsError('invalid-argument','Invalid bet');
  }

  const walletRef = admin.firestore().collection('wallets').doc(uid);
  // We'll keep an icons count consistent with client (7 symbols)
  const ICONS = 7;
  // multipliers
  const JACKPOT_MULT = 10;
  const PAIR_MULT = 2;

  try{
    // Use transaction to read/update wallet atomically
    const result = await admin.firestore().runTransaction(async tx => {
      const snap = await tx.get(walletRef);
      let credits = 100; // default starting credits
      if(snap.exists && typeof snap.data().credits === 'number') credits = snap.data().credits;
      if(bet > credits){
        throw new functions.https.HttpsError('failed-precondition','Insufficient credits');
      }

      // produce three random indices
      const i0 = randInt(ICONS);
      const i1 = randInt(ICONS);
      const i2 = randInt(ICONS);

      let type = 'lose';
      let mult = 0;
      if(i0 === i1 && i1 === i2){ type = 'jackpot'; mult = JACKPOT_MULT; }
      else if(i0===i1 || i1===i2 || i0===i2){ type = 'pair'; mult = PAIR_MULT; }

      const payout = Math.floor(bet * mult);
      const newCredits = credits - bet + payout;

      // update wallet
      tx.set(walletRef, { credits: newCredits, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      // write a round log under wallets/{uid}/rounds
      const roundsRef = walletRef.collection('rounds').doc();
      tx.set(roundsRef, {
        bet,
        outcomeType: type,
        payout,
        indices: [i0,i1,i2],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { indices:[i0,i1,i2], type, mult, payout, newCredits };
    });

    return result;
  }catch(err){
    if(err instanceof functions.https.HttpsError) throw err;
    console.error('placeBetAndSpin error', err);
    throw new functions.https.HttpsError('internal','Server error');
  }
});
