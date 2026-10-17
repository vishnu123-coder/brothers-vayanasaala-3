// With the native Firebase SDK the app configures itself from
// google-services.json at build time — no manual config object is needed.
import firestore from '@react-native-firebase/firestore';

const db = firestore();

// Offline persistence: data typed in while offline is saved on the phone
// immediately and synced automatically when the connection returns.
// (Unlimited cache so a large library never gets evicted from the phone.)
try {
  db.settings({ persistence: true, cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED });
} catch (e) {
  // settings() can only be called once, before first use — safe to ignore.
}

// Static helpers (FieldValue, etc.) live on the module itself.
export const firestoreStatic = firestore;

export { db };
export default db;
