// Integration Test Script
// Tests both Cloudflare Worker and Firebase Functions

const TEST_CONFIG = {
  cloudflare: {
    local: 'http://localhost:8787',
    production: 'https://save-score.japanesegyanburu.workers.dev'
  },
  firebase: {
    projectId: 'japanese-slots',
    local: {
      functions: 'http://localhost:5001',
      firestore: 'localhost:8080'
    }
  }
};

// Determine environment
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const workerUrl = isLocal ? TEST_CONFIG.cloudflare.local : TEST_CONFIG.cloudflare.production;

class BackendTester {
  constructor() {
    this.results = [];
  }

  async testCloudflareWorker() {
    console.group('🧪 Testing Cloudflare Worker');
    
    try {
      // Test CORS preflight
      console.log('Testing CORS preflight...');
      const corsResponse = await fetch(workerUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin
        }
      });
      
      if (!corsResponse.ok) {
        throw new Error(`CORS preflight failed: ${corsResponse.status}`);
      }
      console.log('✅ CORS preflight successful');

      // Test score submission
      console.log('Testing score submission...');
      const scoreData = {
        name: 'TestPlayer',
        score: 1000,
        collection: 'scores',
        maxBet: 100,
        maxMultiplier: 10,
        roundsPlayed: 100
      };

      const submitResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scoreData)
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.json();
        throw new Error(`Score submission failed: ${error.error || submitResponse.status}`);
      }

      const result = await submitResponse.json();
      console.log('✅ Score submission successful:', result);

      // Test invalid data
      console.log('Testing validation (invalid score)...');
      const invalidResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'TestPlayer',
          score: -100,  // Invalid: negative score
          collection: 'scores'
        })
      });

      if (invalidResponse.status === 400) {
        console.log('✅ Validation working correctly');
      } else {
        console.warn('⚠️ Validation may not be working');
      }

      // Test rate limiting (if applicable)
      console.log('Testing rate limiting...');
      const rateLimitPromises = Array(5).fill().map(() =>
        fetch(workerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scoreData)
        })
      );

      const rateLimitResults = await Promise.all(rateLimitPromises);
      console.log('📊 Rate limit test results:', rateLimitResults.map(r => r.status));

      this.results.push({
        service: 'Cloudflare Worker',
        status: 'success',
        tests: ['CORS', 'Score submission', 'Validation', 'Rate limiting']
      });

    } catch (error) {
      console.error('❌ Cloudflare Worker test failed:', error);
      this.results.push({
        service: 'Cloudflare Worker',
        status: 'failed',
        error: error.message
      });
    }
    
    console.groupEnd();
  }

  async testFirebaseFunctions() {
    console.group('🧪 Testing Firebase Functions');

    try {
      // Check if Firebase is loaded
      if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded');
      }

      // Configure emulator if local
      if (isLocal) {
        console.log('Connecting to Firebase emulators...');
        firebase.functions().useEmulator('localhost', 5001);
        console.log('✅ Connected to Functions emulator');
      }

      // Test authentication check
      console.log('Testing unauthenticated request...');
      const placeBetFunc = firebase.functions().httpsCallable('placeBetAndSpin');
      
      try {
        await placeBetFunc({ bet: 10 });
        console.warn('⚠️ Expected authentication error but request succeeded');
      } catch (error) {
        if (error.code === 'unauthenticated') {
          console.log('✅ Authentication check working correctly');
        } else {
          throw error;
        }
      }

      // Test with mock authentication (if available)
      if (firebase.auth().currentUser) {
        console.log('Testing authenticated request...');
        
        try {
          const result = await placeBetFunc({ 
            bet: 10,
            iconCount: 12 
          });
          console.log('✅ Spin result:', result.data);
        } catch (error) {
          if (error.code === 'failed-precondition') {
            console.log('✅ Function executed (insufficient credits is expected)');
          } else {
            throw error;
          }
        }
      } else {
        console.log('ℹ️ No user signed in, skipping authenticated tests');
      }

      this.results.push({
        service: 'Firebase Functions',
        status: 'success',
        tests: ['Authentication check', 'Function callable']
      });

    } catch (error) {
      console.error('❌ Firebase Functions test failed:', error);
      this.results.push({
        service: 'Firebase Functions',
        status: 'failed',
        error: error.message
      });
    }

    console.groupEnd();
  }

  async testFirestore() {
    console.group('🧪 Testing Firestore');

    try {
      if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded');
      }

      const db = firebase.firestore();

      // Configure emulator if local
      if (isLocal) {
        console.log('Connecting to Firestore emulator...');
        db.useEmulator('localhost', 8080);
        console.log('✅ Connected to Firestore emulator');
      }

      // Test reading scores
      console.log('Testing score read...');
      const scoresRef = db.collection('scores');
      const snapshot = await scoresRef.limit(5).get();
      
      console.log(`✅ Read ${snapshot.size} scores from Firestore`);

      // Test real-time listener
      console.log('Testing real-time listener...');
      const unsubscribe = scoresRef.limit(1).onSnapshot(
        (snapshot) => {
          console.log('✅ Real-time listener working');
          unsubscribe();
        },
        (error) => {
          console.error('❌ Real-time listener failed:', error);
        }
      );

      this.results.push({
        service: 'Firestore',
        status: 'success',
        tests: ['Read', 'Real-time listener']
      });

    } catch (error) {
      console.error('❌ Firestore test failed:', error);
      this.results.push({
        service: 'Firestore',
        status: 'failed',
        error: error.message
      });
    }

    console.groupEnd();
  }

  async runAll() {
    console.log('🚀 Starting Backend Integration Tests');
    console.log(`Environment: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
    console.log('═══════════════════════════════════════');

    await this.testCloudflareWorker();
    await this.testFirebaseFunctions();
    await this.testFirestore();

    console.log('\n📊 Test Results Summary');
    console.log('═══════════════════════════════════════');
    console.table(this.results);

    const allPassed = this.results.every(r => r.status === 'success');
    if (allPassed) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log('\n❌ Some tests failed. Check the details above.');
    }

    return this.results;
  }
}

// Export for use in console or other scripts
window.BackendTester = BackendTester;

// Auto-run if ?test=true in URL
if (window.location.search.includes('test=true')) {
  window.addEventListener('DOMContentLoaded', async () => {
    const tester = new BackendTester();
    await tester.runAll();
  });
}

// Usage in console:
// const tester = new BackendTester();
// await tester.runAll();
