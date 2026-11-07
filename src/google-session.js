// Account identity only. Real-data authorization must be enforced by the API.
export function publicIdentity(user) {
  if (!user?.uid || !user.emailVerified || !user.providerData?.some(p => p.providerId === 'google.com')) return null;
  return Object.freeze({ uid: user.uid, email: user.email ?? '', name: user.displayName ?? '' });
}
export function authMessage(error) {
  return ({
    'auth/popup-closed-by-user': 'ログインをキャンセルしました。',
    'auth/cancelled-popup-request': '別のログイン操作が進行しています。',
    'auth/popup-blocked': 'ポップアップがブロックされました。許可してもう一度お試しください。',
    'auth/unauthorized-domain': 'この公開先のGoogleログイン設定が完了していません。',
    'auth/network-request-failed': '接続を確認して、もう一度お試しください。',
    'auth/operation-not-allowed': 'Googleログインがまだ有効になっていません。',
  })[error?.code] ?? 'Googleログインを確認できませんでした。もう一度お試しください。';
}
export function createGoogleSession(driver) {
  let state = Object.freeze({ status: 'loading', user: null, message: '' });
  const listeners = new Set();
  let disposed = false, busy = false, signInActive = false, observedSignOut = false;
  const emit = patch => {
    if (disposed) return;
    state = Object.freeze({ ...state, ...patch });
    for (const fn of listeners) fn(state);
  };
  const off = driver.observe(user => {
    const identity = publicIdentity(user);
    // A pending popup may receive the initial signed-out observation first.
    // Keep waiting, but never retain an identity after an observed sign-out.
    if (!user && signInActive && state.status === 'signing-in' && !state.user) return;
    if (!identity && signInActive && state.user) observedSignOut = true;
    const priorFailure = !state.user && ['signed-out','error'].includes(state.status) ? state.message : '';
    emit({status: identity ? 'signed-in' : 'signed-out', user: identity, message: identity ? '' : user ? 'Googleアカウントを確認できませんでした。' : priorFailure});
  }, error => emit({status:'error',user:null,message:authMessage(error)}));
  return {
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
    async signIn() {
      if (disposed || busy) return false;
      busy = true; signInActive = true; observedSignOut = false; emit({status:'signing-in',message:''});
      try {
        const credential = await driver.signIn();
        if (disposed) return false;
        const identity = publicIdentity(credential?.user);
        // The SDK return is a fallback for a missing/delayed observer event,
        // not authorization: the entry gate still checks actual currentUser.
        if (identity && !state.user && !observedSignOut) emit({status:'signed-in',user:identity,message:''});
        if (!state.user) { emit({status:'signed-out',user:null,message:'Googleログインの結果をこの画面で確認できませんでした。もう一度お試しください。'}); return false; }
        return true;
      }
      catch(error) { emit({status:state.user?'signed-in':'signed-out',message:authMessage(error)}); return false; }
      finally { busy = false; signInActive = false; }
    },
    async signOut() {
      if (disposed || busy) return false;
      busy = true; emit({status:'signing-out',message:''});
      try { await driver.signOut(); emit({status:'signed-out',user:null,message:''}); return true; }
      catch(error) { emit({status:state.user?'signed-in':'signed-out',message:'ログアウトできませんでした。もう一度お試しください。'}); return false; }
      finally { busy = false; }
    },
    dispose() { disposed=true; off?.(); listeners.clear(); },
  };
}
