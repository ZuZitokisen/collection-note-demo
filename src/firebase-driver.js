// Public Firebase web app configuration. This is not a server credential.
import { createGoogleSession, publicIdentity } from './google-session.js';
const config = {
  apiKey: 'AIzaSyBcjwDYX1YjPXMRYx6ZOI6H0lX26qc8L8w',
  authDomain: 'routenote-38b82.firebaseapp.com',
  projectId: 'routenote-38b82',
  appId: '1:150886615845:web:807dfafa886208e85ea8cc',
};
let runtimePromise;
async function googleRuntime() {
 if (runtimePromise) return runtimePromise;
 runtimePromise = (async () => {
  const [appSDK, sdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js'),
  ]);
  const app = appSDK.getApps().find(app=>app.name==='routenote-auth') ?? appSDK.initializeApp(config,'routenote-auth');
  const auth = sdk.getAuth(app);
  auth.languageCode = 'ja';
  return {auth,sdk};
 })().catch(error=>{runtimePromise=null;throw error;});
 return runtimePromise;
}
export async function initializeGoogleSession() {
  const {auth,sdk}=await googleRuntime();
  // Session-scoped persistence. Never copy tokens into app storage or logs.
  await sdk.setPersistence(auth, sdk.browserSessionPersistence);
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  const session = createGoogleSession({
    observe: (next,error) => sdk.onAuthStateChanged(auth,next,error),
    signIn: () => sdk.signInWithPopup(auth,provider),
    signOut: () => sdk.signOut(auth),
  });
  session.verifyIdentity = async () => {
    const user = auth.currentUser;
    if (!user) return null;
    await sdk.reload(user);
    await sdk.getIdToken(user, true);
    return auth.currentUser?.uid === user.uid ? publicIdentity(user) : null;
  };
  return session;
}

// The token stays in memory and is sent only to the configured read-only API.
// This is not an authorization decision; the server verifies membership on every call.
export async function googleApiIdentity() {
 const {auth,sdk}=await googleRuntime();
 return createApiIdentity({auth,sdk,online:()=>globalThis.navigator?.onLine===true});
}
export function createApiIdentity({auth,sdk,online}) {
 return {
  currentUid:()=>auth.currentUser?.uid??null,
  subscribe:listener=>sdk.onAuthStateChanged(auth,user=>listener(user?.uid??null),()=>listener(null)),
  async getIdToken(){
   if(!online())throw new Error('LOGIN_REQUIRED');
   const user=auth.currentUser;
   if(!user||!user.providerData.some(provider=>provider.providerId==='google.com'))throw new Error('LOGIN_REQUIRED');
   await sdk.reload(user);
   const token=await sdk.getIdToken(user,true);
   if(auth.currentUser?.uid!==user.uid)throw new Error('LOGIN_REQUIRED');
   return token;
  },
 };
}
