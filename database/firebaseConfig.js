// With the native Firebase SDK, the app auto-configures itself from
// google-services.json at build time — no manual config object needed here.
import firestore from '@react-native-firebase/firestore';

const db = firestore();

// Native SDK has offline persistence ON by default on Android — this just
// makes it explicit. Data typed in while fully offline is saved to the
// phone's local storage immediately and synced automatically once the
// connection returns, even after fully closing and reopening the app.
db.settings({ persistence: true });

export { db };
export default db;
