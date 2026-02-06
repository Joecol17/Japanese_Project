// Backend Configuration Manager
// This file helps manage environment-specific configurations

const ENVIRONMENTS = {
  development: {
    cloudflare: {
      workerUrl: 'http://localhost:8787', // Local worker for testing
      allowedOrigins: ['http://localhost:5500', 'http://127.0.0.1:5500']
    },
    firebase: {
      projectId: 'japanese-slots',
      region: 'us-central1',
      apiKey: 'YOUR_DEV_API_KEY',
      authDomain: 'japanese-slots.firebaseapp.com',
      storageBucket: 'japanese-slots.firebasestorage.app'
    }
  },
  production: {
    cloudflare: {
      workerUrl: 'https://save-score.japanesegyanburu.workers.dev',
      allowedOrigins: ['https://japanesegyanburu.com', 'https://www.japanesegyanburu.com']
    },
    firebase: {
      projectId: 'japanese-slots',
      region: 'us-central1',
      apiKey: 'YOUR_PROD_API_KEY',
      authDomain: 'japanese-slots.firebaseapp.com',
      storageBucket: 'japanese-slots.firebasestorage.app'
    }
  }
};

// Detect current environment
function getCurrentEnvironment() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  return 'production';
}

// Get current config
export function getBackendConfig() {
  const env = getCurrentEnvironment();
  return ENVIRONMENTS[env];
}

// Backend API wrapper
export class BackendAPI {
  constructor() {
    this.config = getBackendConfig();
    this.firebase = null;
    this.functions = null;
  }

  // Initialize Firebase
  async initFirebase(firebaseApp, firebaseFunctions) {
    const fbConfig = {
      apiKey: this.config.firebase.apiKey,
      authDomain: this.config.firebase.authDomain,
      projectId: this.config.firebase.projectId,
      storageBucket: this.config.firebase.storageBucket,
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };

    this.firebase = firebaseApp.initializeApp(fbConfig);
    this.functions = firebaseFunctions.getFunctions(this.firebase, this.config.firebase.region);
    
    return this.firebase;
  }

  // Save score via Cloudflare Worker
  async saveScore({ name, score, collection = 'scores', maxBet = 100, maxMultiplier = 10, roundsPlayed = 100 }) {
    try {
      const response = await fetch(this.config.cloudflare.workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          score,
          collection,
          maxBet,
          maxMultiplier,
          roundsPlayed
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save score');
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving score:', error);
      throw error;
    }
  }

  // Place bet and spin via Firebase Function
  async placeBetAndSpin({ bet, iconCount = 12 }) {
    if (!this.functions) {
      throw new Error('Firebase not initialized. Call initFirebase() first.');
    }

    try {
      const placeBet = this.functions.httpsCallable('placeBetAndSpin');
      const result = await placeBet({ bet, iconCount });
      return result.data;
    } catch (error) {
      console.error('Error placing bet:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'unauthenticated') {
        throw new Error('Please sign in to play');
      } else if (error.code === 'failed-precondition') {
        throw new Error('Insufficient credits');
      } else if (error.code === 'resource-exhausted') {
        throw new Error('Please slow down - too many spins');
      }
      
      throw error;
    }
  }

  // Get leaderboard from Firestore
  async getLeaderboard({ collection = 'scores', limit = 10 }) {
    if (!this.firebase) {
      throw new Error('Firebase not initialized. Call initFirebase() first.');
    }

    try {
      const { getFirestore, collection: firestoreCollection, query, orderBy, limit: firestoreLimit, getDocs } = 
        await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      const db = getFirestore(this.firebase);
      const scoresRef = firestoreCollection(db, collection);
      const q = query(scoresRef, orderBy('score', 'desc'), firestoreLimit(limit));
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  }

  // Real-time leaderboard listener
  onLeaderboardUpdate({ collection = 'scores', limit = 10, callback }) {
    if (!this.firebase) {
      throw new Error('Firebase not initialized. Call initFirebase() first.');
    }

    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')
      .then(({ getFirestore, collection: firestoreCollection, query, orderBy, limit: firestoreLimit, onSnapshot }) => {
        const db = getFirestore(this.firebase);
        const scoresRef = firestoreCollection(db, collection);
        const q = query(scoresRef, orderBy('score', 'desc'), firestoreLimit(limit));
        
        return onSnapshot(q, (snapshot) => {
          const scores = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          callback(scores);
        });
      })
      .catch(error => {
        console.error('Error setting up leaderboard listener:', error);
      });
  }

  // Health check
  async healthCheck() {
    const health = {
      cloudflare: false,
      firebase: false
    };

    // Check Cloudflare Worker
    try {
      const response = await fetch(this.config.cloudflare.workerUrl, {
        method: 'OPTIONS'
      });
      health.cloudflare = response.ok;
    } catch (error) {
      console.error('Cloudflare health check failed:', error);
    }

    // Check Firebase
    health.firebase = this.firebase !== null;

    return health;
  }
}

// Usage example:
/*
import { BackendAPI } from './backend-config.js';

const api = new BackendAPI();

// Initialize Firebase
await api.initFirebase(
  await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'),
  await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js')
);

// Save score
await api.saveScore({
  name: 'Player1',
  score: 5000,
  collection: 'scores'
});

// Place bet
const result = await api.placeBetAndSpin({
  bet: 10,
  iconCount: 12
});

// Get leaderboard
const leaderboard = await api.getLeaderboard({ limit: 10 });

// Real-time leaderboard
api.onLeaderboardUpdate({
  limit: 10,
  callback: (scores) => {
    console.log('Leaderboard updated:', scores);
  }
});
*/
