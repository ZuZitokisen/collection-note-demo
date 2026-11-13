import { publicIdentity } from './google-session.js';

// Share only work that is still pending. Completed tokens/identities are never cached.
export function createIdentityVerifier({ auth, sdk, online }) {
  let observedUser = auth.currentUser;
  let observedUid = observedUser?.uid ?? null;
  let epoch = 0, pending = null, disposed = false;
  const observe = user => {
    const uid = user?.uid ?? null;
    if (user !== observedUser || uid !== observedUid) {
      observedUser = user;
      observedUid = uid;
      epoch++;
    }
  };
  // Observe transitions as well as sampling currentUser: A -> null -> A must
  // invalidate pending work even if the very same User object returns.
  const unsubscribe = sdk.onAuthStateChanged(auth, observe, () => { epoch++; });
  const required = () => { throw new Error('LOGIN_REQUIRED'); };
  const assertCurrent = operation => {
    observe(auth.currentUser);
    if (disposed || !online() || epoch !== operation.epoch ||
        auth.currentUser !== operation.user || auth.currentUser?.uid !== operation.uid ||
        !publicIdentity(operation.user)) required();
  };
  return {
    verify() {
      observe(auth.currentUser);
      const user = auth.currentUser;
      const operation = { user, uid: user?.uid, epoch };
      try { assertCurrent(operation); } catch (error) { return Promise.reject(error); }
      if (pending && pending.user === user && pending.uid === operation.uid && pending.epoch === epoch) {
        return pending.promise;
      }
      operation.promise = Promise.resolve().then(async () => {
        assertCurrent(operation);
        await sdk.reload(user);
        assertCurrent(operation);
        const token = await sdk.getIdToken(user, true);
        assertCurrent(operation);
        return { identity: publicIdentity(user), token };
      }).finally(() => {
        // A stale completion must not evict newer work for another identity.
        if (pending === operation) pending = null;
      });
      pending = operation;
      return operation.promise;
    },
    dispose() { disposed = true; epoch++; pending = null; unsubscribe?.(); },
  };
}
