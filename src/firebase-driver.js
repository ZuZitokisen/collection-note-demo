// Public Firebase web app configuration. This is not a server credential.
import { createGoogleSession } from './google-session.js';
const config = {
  apiKey: 'AIzaSyBcjwDYX1YjPXMRYx6ZOI6H0lX26qc8L8w',
  authDomain: 'routenote-38b82.firebaseapp.com',
  projectId: 'routenote-38b82',
  appId: '1:150886615845:web:807dfafa886208e85ea8cc',
};
export async function initializeGoogleSession() {
  const [appSDK, sdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js'),
  ]);
  const app = appSDK.getApps().find(app=>app.name==='routenote-auth') ?? appSDK.initializeApp(config,'routenote-auth');
  const auth = sdk.getAuth(app);
  auth.languageCode = 'ja';
  // Session-scoped persistence. Never copy tokens into app storage or logs.
  await sdk.setPersistence(auth, sdk.browserSessionPersistence);
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  return createGoogleSession({
    observe: (next,error) => sdk.onAuthStateChanged(auth,next,error),
    signIn: () => sdk.signInWithPopup(auth,provider),
    signOut: () => sdk.signOut(auth),
  });
}
