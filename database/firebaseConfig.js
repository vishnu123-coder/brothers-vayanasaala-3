import { initializeApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';

// From Firebase Console → Project settings → Your apps → Web app config.
const firebaseConfig = {
  apiKey: 'AIzaSyCHNTYrW95bsCnq6L8pAAQxyDCH6uYXMeI',
  authDomain: 'brothers-vayanasala-2.firebaseapp.com',
  projectId: 'brothers-vayanasala-2',
  storageBucket: 'brothers-vayanasala-2.firebasestorage.app',
  messagingSenderId: '95634722926',
  appId: '1:95634722926:web:2143abfb7067709146d67f',
};

const app = initializeApp(firebaseConfig);

// React Native doesn't have IndexedDB, so we use the in-memory cache — this
// means pending writes made while offline are queued and sent automatically
// once the connection returns during the same app session (handles brief
// signal drops fine), but won't survive a full app restart while offline.
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true, // more reliable on flaky mobile networks
});

export default app;
