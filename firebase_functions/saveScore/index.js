const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize the admin SDK (uses FIREBASE_CONFIG or service account when deployed)
if (!admin.apps.length) admin.initializeApp();

// Callable function to save a score server-side. Client must be authenticated (anonymous is fine).
exports.saveScore = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required to submit score');
  }

  const rawName = String(data.name || 'Player').trim();
  const name = rawName.slice(0, 20) || 'Player';
  const clientScore = Number(data.score || 0);

  // Basic validation and sanitization
  if (!Number.isFinite(clientScore) || clientScore < 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid score');
  }

  // Clamp server-side to a sane maximum (adjust as desired)
  const serverScore = Math.min(1000000, Math.floor(clientScore));

  try {
    const docRef = await admin.firestore().collection('scores').add({
      name,
      score: serverScore,
      uid: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: docRef.id, score: serverScore };
  } catch (err) {
    console.error('saveScore error', err);
    throw new functions.https.HttpsError('internal', 'Failed to save score');
  }
});
