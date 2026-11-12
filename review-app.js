var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/google-session.js
function publicIdentity(user) {
  if (!user?.uid || !user.emailVerified || !user.providerData?.some((p) => p.providerId === "google.com")) return null;
  return Object.freeze({ uid: user.uid, email: user.email ?? "", name: user.displayName ?? "" });
}
function authMessage(error) {
  return {
    "auth/popup-closed-by-user": "\u30ED\u30B0\u30A4\u30F3\u3092\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u307E\u3057\u305F\u3002",
    "auth/cancelled-popup-request": "\u5225\u306E\u30ED\u30B0\u30A4\u30F3\u64CD\u4F5C\u304C\u9032\u884C\u3057\u3066\u3044\u307E\u3059\u3002",
    "auth/popup-blocked": "\u30DD\u30C3\u30D7\u30A2\u30C3\u30D7\u304C\u30D6\u30ED\u30C3\u30AF\u3055\u308C\u307E\u3057\u305F\u3002\u8A31\u53EF\u3057\u3066\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002",
    "auth/unauthorized-domain": "\u3053\u306E\u516C\u958B\u5148\u306EGoogle\u30ED\u30B0\u30A4\u30F3\u8A2D\u5B9A\u304C\u5B8C\u4E86\u3057\u3066\u3044\u307E\u305B\u3093\u3002",
    "auth/network-request-failed": "\u63A5\u7D9A\u3092\u78BA\u8A8D\u3057\u3066\u3001\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002",
    "auth/operation-not-allowed": "Google\u30ED\u30B0\u30A4\u30F3\u304C\u307E\u3060\u6709\u52B9\u306B\u306A\u3063\u3066\u3044\u307E\u305B\u3093\u3002"
  }[error?.code] ?? "Google\u30ED\u30B0\u30A4\u30F3\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002";
}
function createGoogleSession(driver) {
  let state2 = Object.freeze({ status: "loading", user: null, message: "" });
  const listeners = /* @__PURE__ */ new Set();
  let disposed = false, busy = false, signInActive = false, observedSignOut = false;
  const emit = (patch) => {
    if (disposed) return;
    state2 = Object.freeze({ ...state2, ...patch });
    for (const fn of listeners) fn(state2);
  };
  const off = driver.observe((user) => {
    const identity2 = publicIdentity(user);
    if (!user && signInActive && state2.status === "signing-in" && !state2.user) return;
    if (!identity2 && signInActive && state2.user) observedSignOut = true;
    const priorFailure = !state2.user && ["signed-out", "error"].includes(state2.status) ? state2.message : "";
    emit({ status: identity2 ? "signed-in" : "signed-out", user: identity2, message: identity2 ? "" : user ? "Google\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002" : priorFailure });
  }, (error) => emit({ status: "error", user: null, message: authMessage(error) }));
  return {
    get state() {
      return state2;
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(state2);
      return () => listeners.delete(fn);
    },
    async signIn() {
      if (disposed || busy) return false;
      busy = true;
      signInActive = true;
      observedSignOut = false;
      emit({ status: "signing-in", message: "" });
      try {
        const credential = await driver.signIn();
        if (disposed) return false;
        const identity2 = publicIdentity(credential?.user);
        if (identity2 && !state2.user && !observedSignOut) emit({ status: "signed-in", user: identity2, message: "" });
        if (!state2.user) {
          emit({ status: "signed-out", user: null, message: "Google\u30ED\u30B0\u30A4\u30F3\u306E\u7D50\u679C\u3092\u3053\u306E\u753B\u9762\u3067\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002" });
          return false;
        }
        return true;
      } catch (error) {
        emit({ status: state2.user ? "signed-in" : "signed-out", message: authMessage(error) });
        return false;
      } finally {
        busy = false;
        signInActive = false;
      }
    },
    async signOut() {
      if (disposed || busy) return false;
      busy = true;
      emit({ status: "signing-out", message: "" });
      try {
        await driver.signOut();
        emit({ status: "signed-out", user: null, message: "" });
        return true;
      } catch (error) {
        emit({ status: state2.user ? "signed-in" : "signed-out", message: "\u30ED\u30B0\u30A2\u30A6\u30C8\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002" });
        return false;
      } finally {
        busy = false;
      }
    },
    dispose() {
      disposed = true;
      off?.();
      listeners.clear();
    }
  };
}
var init_google_session = __esm({
  "src/google-session.js"() {
  }
});

// src/identity-verifier.js
function createIdentityVerifier({ auth, sdk, online }) {
  let observedUser = auth.currentUser;
  let observedUid = observedUser?.uid ?? null;
  let epoch = 0, pending = null, disposed = false;
  const observe = (user) => {
    const uid2 = user?.uid ?? null;
    if (user !== observedUser || uid2 !== observedUid) {
      observedUser = user;
      observedUid = uid2;
      epoch++;
    }
  };
  const unsubscribe = sdk.onAuthStateChanged(auth, observe, () => {
    epoch++;
  });
  const required = () => {
    throw new Error("LOGIN_REQUIRED");
  };
  const assertCurrent = (operation) => {
    observe(auth.currentUser);
    if (disposed || !online() || epoch !== operation.epoch || auth.currentUser !== operation.user || auth.currentUser?.uid !== operation.uid || !publicIdentity(operation.user)) required();
  };
  return {
    verify() {
      observe(auth.currentUser);
      const user = auth.currentUser;
      const operation = { user, uid: user?.uid, epoch };
      try {
        assertCurrent(operation);
      } catch (error) {
        return Promise.reject(error);
      }
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
        if (pending === operation) pending = null;
      });
      pending = operation;
      return operation.promise;
    },
    dispose() {
      disposed = true;
      epoch++;
      pending = null;
      unsubscribe?.();
    }
  };
}
var init_identity_verifier = __esm({
  "src/identity-verifier.js"() {
    init_google_session();
  }
});

// src/firebase-driver.js
var firebase_driver_exports = {};
__export(firebase_driver_exports, {
  createApiIdentity: () => createApiIdentity,
  googleApiIdentity: () => googleApiIdentity,
  initializeGoogleSession: () => initializeGoogleSession
});
async function googleRuntime() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    const [appSDK, sdk] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js")
    ]);
    const app2 = appSDK.getApps().find((app3) => app3.name === "routenote-auth") ?? appSDK.initializeApp(config, "routenote-auth");
    const auth = sdk.getAuth(app2);
    auth.languageCode = "ja";
    const verifier = createIdentityVerifier({ auth, sdk, online: () => globalThis.navigator?.onLine === true });
    return { auth, sdk, verifier };
  })().catch((error) => {
    runtimePromise = null;
    throw error;
  });
  return runtimePromise;
}
async function initializeGoogleSession() {
  const { auth, sdk, verifier } = await googleRuntime();
  await sdk.setPersistence(auth, sdk.browserSessionPersistence);
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const session = createGoogleSession({
    observe: (next, error) => sdk.onAuthStateChanged(auth, next, error),
    signIn: () => sdk.signInWithPopup(auth, provider),
    signOut: () => sdk.signOut(auth)
  });
  session.verifyIdentity = async () => {
    if (!auth.currentUser) return null;
    return (await verifier.verify()).identity;
  };
  return session;
}
async function googleApiIdentity() {
  const { auth, sdk, verifier } = await googleRuntime();
  return createApiIdentity({ auth, sdk, online: () => globalThis.navigator?.onLine === true, verifier });
}
function createApiIdentity({ auth, sdk, online, verifier = createIdentityVerifier({ auth, sdk, online }) }) {
  return {
    currentUid: () => auth.currentUser?.uid ?? null,
    subscribe: (listener) => sdk.onAuthStateChanged(auth, (user) => listener(user?.uid ?? null), () => listener(null)),
    async getIdToken() {
      return (await verifier.verify()).token;
    }
  };
}
var config, runtimePromise;
var init_firebase_driver = __esm({
  "src/firebase-driver.js"() {
    init_google_session();
    init_identity_verifier();
    config = {
      apiKey: "AIzaSyBcjwDYX1YjPXMRYx6ZOI6H0lX26qc8L8w",
      authDomain: "routenote-38b82.firebaseapp.com",
      projectId: "routenote-38b82",
      appId: "1:150886615845:web:807dfafa886208e85ea8cc"
    };
  }
});

// src/domain.js
var domain_exports = {};
__export(domain_exports, {
  CATEGORIES: () => CATEGORIES,
  ConflictError: () => ConflictError,
  DuplicateError: () => DuplicateError,
  STORAGE_KEY_V3: () => STORAGE_KEY_V3,
  ValidationError: () => ValidationError,
  activeMasters: () => activeMasters,
  calculationSampleRows: () => calculationSampleRows,
  clone: () => clone,
  commonRateCategory: () => commonRateCategory,
  commonRates: () => commonRates,
  createCalculationSampleState: () => createCalculationSampleState,
  createRecord: () => createRecord,
  createRecords: () => createRecords,
  createSampleState: () => createSampleState,
  deleteRecord: () => deleteRecord,
  displayName: () => displayName,
  effectiveRates: () => effectiveRates,
  masterDraft: () => masterDraft,
  migrateState: () => migrateState,
  moveMaster: () => moveMaster,
  reorderMasters: () => reorderMasters,
  reportDefaults: () => reportDefaults,
  reportNotes: () => reportNotes,
  restoreRecord: () => restoreRecord,
  saveMaster: () => saveMaster,
  setMasterActive: () => setMasterActive,
  summarize: () => summarize,
  summaryPeriodLabels: () => summaryPeriodLabels,
  updateRecord: () => updateRecord,
  upgradeInitialItems: () => upgradeInitialItems,
  validateState: () => validateState
});

// src/model.js
var PEOPLE = ["\u62C5\u5F53\u8005A\uFF08\u67B6\u7A7A\uFF09", "\u62C5\u5F53\u8005B\uFF08\u67B6\u7A7A\uFF09", "\u62C5\u5F53\u8005C\uFF08\u67B6\u7A7A\uFF09"];
var CUSTOMERS = Array.from({ length: 29 }, (_, index) => ({ id: `demo-c${String(index + 1).padStart(3, "0")}`, name: `\u53D6\u5F15\u5148${String(index + 1).padStart(2, "0")}\uFF08\u67B6\u7A7A\uFF09` }));
var STORAGE_KEY = "collection-report-local-prototype-v2";
var clone = (value) => structuredClone(value);
var customerName = (id) => CUSTOMERS.find((customer) => customer.id === id)?.name ?? "\u4E0D\u660E\u306A\u67B6\u7A7A\u53D6\u5F15\u5148";
var ValidationError = class extends Error {
};
var DuplicateError = class extends ValidationError {
};
var ConflictError = class extends Error {
  constructor(current) {
    super("\u3053\u306E\u8A18\u9332\u306F\u3001\u7DE8\u96C6\u4E2D\u306B\u66F4\u65B0\u307E\u305F\u306F\u524A\u9664\u3055\u308C\u307E\u3057\u305F\u3002\u6700\u65B0\u306E\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    this.current = clone(current);
  }
};
function localDate(date = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type) => parts.find((value) => value.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function validateDate(value) {
  const date = String(value ?? "");
  const parsed = /* @__PURE__ */ new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) throw new ValidationError("\u6B63\u3057\u3044\u56DE\u53CE\u65E5\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  return date;
}
function monthBounds(month2) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month2)) throw new ValidationError("\u6B63\u3057\u3044\u5E74\u6708\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const [year, number3] = month2.split("-").map(Number);
  return { start: `${month2}-01`, end: `${number3 === 12 ? year + 1 : year}-${String(number3 === 12 ? 1 : number3 + 1).padStart(2, "0")}-01` };
}
function validPerson(value, label) {
  if (!PEOPLE.includes(value)) throw new ValidationError(`${label}\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002`);
  return value;
}
function optionalDecimal(value, label) {
  if (value === null || value === void 0 || String(value).trim() === "") return null;
  const text3 = String(value).trim();
  const number3 = Number(text3);
  if (!/^\d+(?:\.\d{1,6})?$/.test(text3) || !Number.isFinite(number3) || number3 < 0 || number3 > 1e9) throw new ValidationError(`${label}\u306F0\u301C1,000,000,000\u3001\u5C0F\u65706\u6841\u4EE5\u5185\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u8A66\u4F5C\u306E\u4EEE\u4ED5\u69D8\uFF09\u3002`);
  return number3;
}
function validateFields(input) {
  const date = validateDate(input.date);
  if (!CUSTOMERS.some((customer) => customer.id === input.customerId)) throw new ValidationError("\u53D6\u5F15\u5148\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const combustibleKg = optionalDecimal(input.combustibleKg, "\u53EF\u71C3\u306E\u91CD\u91CF");
  const noncombustibleKg = optionalDecimal(input.noncombustibleKg, "\u4E0D\u71C3\u306E\u91CD\u91CF");
  const otherFee = optionalDecimal(input.otherFee, "\u305D\u306E\u4ED6\u6599\u91D1");
  const otherItem = String(input.otherItem ?? "").trim();
  if (otherItem.length > 500) throw new ValidationError("\u305D\u306E\u4ED6\u54C1\u540D\u306F500\u6587\u5B57\u4EE5\u5185\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  if (combustibleKg === null && noncombustibleKg === null && otherFee === null && !otherItem) throw new ValidationError("\u9078\u629E\u3057\u305F\u53D6\u5F15\u5148\u306B\u306F\u3001\u91CD\u91CF\u30FB\u305D\u306E\u4ED6\u54C1\u540D\u30FB\u305D\u306E\u4ED6\u6599\u91D1\u306E\u3044\u305A\u308C\u304B\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u30020\u306F\u5165\u529B\u5024\u3068\u3057\u3066\u6271\u3044\u307E\u3059\u3002");
  return { date, customerId: input.customerId, combustibleKg, noncombustibleKg, otherItem, otherFee };
}
function auditEvent(action, before, after, actor, now, id) {
  return { id, recordId: (after ?? before).id, action, actor, timestamp: now, version: (after ?? before).version, before: clone(before), after: clone(after) };
}
function ensureUnique(state2, fields2, exceptId) {
  if (state2.records.some((record) => !record.deleted && record.id !== exceptId && record.date === fields2.date && record.customerId === fields2.customerId)) throw new DuplicateError(`${fields2.date}\u30FB${customerName(fields2.customerId)}\u306E\u8A18\u9332\u304C\u3059\u3067\u306B\u3042\u308A\u307E\u3059\u3002\u4E00\u89A7\u304B\u3089\u65E2\u5B58\u8A18\u9332\u3092\u7DE8\u96C6\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u540C\u65E5\u8907\u6570\u56DE\u306E\u8A18\u9332\u306B\u306F\u307E\u3060\u5BFE\u5FDC\u3057\u3066\u3044\u306A\u3044\u305F\u3081\u3001\u81EA\u52D5\u8FFD\u52A0\u30FB\u4E0A\u66F8\u304D\u306F\u3057\u307E\u305B\u3093\u3002`);
}
function createReport(state2, input, actor, { now = (/* @__PURE__ */ new Date()).toISOString(), id = crypto.randomUUID() } = {}) {
  validPerson(actor, "\u4ECA\u56DE\u306E\u5165\u529B\u8005\u30FB\u7DE8\u96C6\u8005");
  const createdBy = validPerson(input.createdBy, "\u5831\u544A\u8005\uFF08\u4F5C\u6210\u8005\uFF09");
  const fields2 = validateFields(input);
  ensureUnique(state2, fields2);
  if (state2.records.some((record2) => record2.id === id)) throw new ValidationError("\u8A18\u9332ID\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059\u3002");
  const record = { ...fields2, id, createdBy, lastEditedBy: actor, createdAt: now, updatedAt: now, version: 1, deleted: false };
  return { state: { ...clone(state2), records: [...clone(state2.records), record], history: [...clone(state2.history), auditEvent("create", null, record, actor, now, `${id}:1`)] }, record: clone(record) };
}
function updateReport(state2, id, expectedVersion, input, actor, { now = (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  validPerson(actor, "\u4ECA\u56DE\u306E\u5165\u529B\u8005\u30FB\u7DE8\u96C6\u8005");
  const current = state2.records.find((record) => record.id === id);
  if (!current || current.deleted || current.version !== expectedVersion) throw new ConflictError(current ?? null);
  const fields2 = validateFields(input);
  ensureUnique(state2, fields2, id);
  const next = { ...current, ...fields2, lastEditedBy: actor, updatedAt: now, version: current.version + 1 };
  return { state: { ...clone(state2), records: state2.records.map((record) => record.id === id ? next : clone(record)), history: [...clone(state2.history), auditEvent("update", current, next, actor, now, `${id}:${next.version}`)] }, record: clone(next) };
}
function sumField(records, field) {
  let micros = 0n;
  for (const record of records) {
    if (record[field] === null) continue;
    const [whole, fraction2] = record[field].toFixed(6).split(".");
    micros += BigInt(whole) * 1000000n + BigInt(fraction2);
  }
  const fraction = String(micros % 1000000n).padStart(6, "0").replace(/0+$/, "");
  return `${micros / 1000000n}${fraction ? `.${fraction}` : ""}`;
}
function sampleState(today = /* @__PURE__ */ new Date()) {
  let state2 = { schema: 2, records: [], history: [] };
  const day = localDate(today);
  const previous = /* @__PURE__ */ new Date(`${day}T12:00:00+09:00`);
  previous.setDate(previous.getDate() - 1);
  const [year, month2] = day.slice(0, 7).split("-").map(Number);
  const earlierMonth = `${month2 === 1 ? year - 1 : year}-${String(month2 === 1 ? 12 : month2 - 1).padStart(2, "0")}-15`;
  const samples = [
    { id: "demo-001", date: day, customerId: CUSTOMERS[0].id, combustibleKg: 12.5, noncombustibleKg: 3, otherItem: "", otherFee: null, createdBy: PEOPLE[0] },
    { id: "demo-002", date: day, customerId: CUSTOMERS[1].id, combustibleKg: 8, noncombustibleKg: 0, otherItem: "\u67B6\u7A7A\u306E\u5099\u54C1", otherFee: 300, createdBy: PEOPLE[1] },
    { id: "demo-003", date: localDate(previous), customerId: CUSTOMERS[2].id, combustibleKg: null, noncombustibleKg: 5.25, otherItem: "", otherFee: null, createdBy: PEOPLE[2] },
    { id: "demo-004", date: earlierMonth, customerId: CUSTOMERS[0].id, combustibleKg: 99, noncombustibleKg: 0, otherItem: "\u524D\u6708\u3092\u9664\u5916\u3059\u308B\u67B6\u7A7A\u30C6\u30B9\u30C8\u7528", otherFee: 0, createdBy: PEOPLE[0] }
  ];
  for (const input of samples) state2 = createReport(state2, input, input.createdBy, { id: input.id, now: (/* @__PURE__ */ new Date(`${input.date}T09:00:00+09:00`)).toISOString() }).state;
  state2 = updateReport(state2, "demo-002", 1, { ...samples[1], otherItem: "\u67B6\u7A7A\u306E\u5099\u54C1\uFF08\u78BA\u8A8D\u6E08\u307F\uFF09" }, PEOPLE[2], { now: (/* @__PURE__ */ new Date(`${day}T11:20:00+09:00`)).toISOString() }).state;
  return state2;
}

// src/domain.js
var STORAGE_KEY_V3 = "collection-report-local-prototype-v3";
var CATEGORIES = { combustible: "\u53EF\u71C3", noncombustible: "\u4E0D\u71C3", other: "\u305D\u306E\u4ED6" };
var types = ["customers", "members", "items"];
var stamp = () => (/* @__PURE__ */ new Date()).toISOString();
var uid = () => crypto.randomUUID();
var text = (v, max = 120) => {
  const s = String(v ?? "").trim();
  if (!s || s.length > max) throw new ValidationError(`\u540D\u79F0\u306F1\u301C${max}\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002`);
  return s;
};
function validateCategoryNotes(notes) {
  if (!notes || typeof notes !== "object" || Array.isArray(notes) || Object.entries(notes).some(([key, value]) => !Object.hasOwn(CATEGORIES, key) || typeof value !== "string" || value.length > 500)) throw new ValidationError("\u5404\u533A\u5206\u306E\u5099\u8003\u306F500\u6587\u5B57\u4EE5\u5185\u306E\u6587\u5B57\u5217\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  return notes;
}
function readReportNote(value) {
  if (typeof value !== "string" || value.length > 500) throw new ValidationError("\u5404\u533A\u5206\u306E\u5099\u8003\u306F500\u6587\u5B57\u4EE5\u5185\u306E\u6587\u5B57\u5217\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  return value.trim();
}
function reportNotes(record = {}) {
  return { combustible: record.categoryNotes?.combustible ?? "", noncombustible: record.categoryNotes?.noncombustible ?? "", other: record.otherItem ?? record.categoryNotes?.other ?? "" };
}
function validateMemberProfile(p) {
  if (!p || typeof p !== "object" || Array.isArray(p) || p.age !== void 0 && p.age !== null && (!Number.isInteger(p.age) || p.age < 0 || p.age > 120) || !["", "\u7537", "\u5973", "\u30FC"].includes(p.gender) || typeof p.license !== "string" || p.license.length > 1e3 || typeof p.other !== "string" || p.other.length > 500) throw new ValidationError("\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u306E\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002\u5E74\u9F62\u306F0\u301C120\u6B73\u3001\u6027\u5225\u306F\u7537\u30FB\u5973\u30FB\u30FC\u304B\u3089\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  if (p.birthDate !== void 0) {
    if (typeof p.birthDate !== "string") throw new ValidationError("\u751F\u5E74\u6708\u65E5\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    if (p.birthDate) {
      validateDate(p.birthDate);
      if (p.birthDate > localDate()) throw new ValidationError("\u751F\u5E74\u6708\u65E5\u306F\u4ECA\u65E5\u4EE5\u524D\u306E\u65E5\u4ED8\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    }
  }
  return p;
}
function readMemberProfile(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new ValidationError("\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u306E\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
  const age = p.age === null || p.age === void 0 || p.age === "" ? null : typeof p.age === "string" && /^\d{1,3}$/.test(p.age) ? Number(p.age) : p.age;
  return validateMemberProfile({ age, birthDate: p.birthDate ?? "", gender: p.gender ?? "", license: typeof p.license === "string" ? p.license.trim() : p.license ?? "", other: typeof p.other === "string" ? p.other.trim() : p.other ?? "" });
}
function master(state2, type, id) {
  return state2.masters[type]?.find((x) => x.id === id);
}
function activeMasters(state2, type) {
  return state2.masters[type].filter((x) => x.active);
}
function displayName(state2, type, id, snapshot = "") {
  const m = master(state2, type, id);
  return `${snapshot || m?.name || "\u540D\u79F0\u4E0D\u660E"}${m && !m.active ? "\uFF08\xD7\uFF09" : ""}`;
}
function member(state2, id) {
  const m = master(state2, "members", id);
  if (!m?.active) throw new ValidationError("\u4ECA\u56DE\u64CD\u4F5C\u3059\u308B\u6709\u52B9\u306A\u30E1\u30F3\u30D0\u30FC\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  return m;
}
function defaults() {
  return { enabled: { combustible: true, noncombustible: true, other: true }, rates: { combustible: null, noncombustible: null, other: null }, itemIds: ["demo-item-1", "demo-item-2", "demo-item-3"] };
}
function initialMasters() {
  return { customers: CUSTOMERS.map((c) => ({ ...c, active: true, version: 1, ...defaults() })), members: PEOPLE.map((name, i) => ({ id: `demo-member-${i + 1}`, name, active: true, version: 1 })), items: Object.keys(CATEGORIES).map((category, i) => ({ id: `demo-item-${i + 1}`, name: CATEGORIES[category], category, defaultRate: null, active: true, version: 1 })) };
}
var numericFields = ["combustibleKg", "noncombustibleKg", "otherFee", "combustibleRate", "noncombustibleRate"];
function validateLegacy(value) {
  if (!value || value.schema !== 2 || !Array.isArray(value.records) || !Array.isArray(value.history)) throw new ValidationError("\u65E7\u30C7\u30FC\u30BF\u306E\u5F62\u5F0F\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u5143\u30C7\u30FC\u30BF\u306F\u5909\u66F4\u3057\u307E\u305B\u3093\u3002");
  const ids = /* @__PURE__ */ new Set();
  for (const r of value.records) {
    if (!r || typeof r.id !== "string" || ids.has(r.id) || !CUSTOMERS.some((c) => c.id === r.customerId) || !PEOPLE.includes(r.createdBy) || !PEOPLE.includes(r.lastEditedBy) || typeof r.deleted !== "boolean" || !Number.isInteger(r.version) || r.version < 1 || !Number.isFinite(Date.parse(r.createdAt)) && !sourceUnknown(r, "createdAt") || !Number.isFinite(Date.parse(r.updatedAt)) && !sourceUnknown(r, "updatedAt")) throw new ValidationError("\u65E7\u8A18\u9332\u306E\u5F62\u5F0F\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
    validateDate(r.date);
    for (const key of ["combustibleKg", "noncombustibleKg", "otherFee"]) {
      if (r[key] !== null && typeof r[key] !== "number") throw new ValidationError("\u65E7\u8A18\u9332\u306E\u6570\u5024\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059\u3002");
      optionalDecimal(r[key], key);
    }
    if (typeof r.otherItem !== "string" || r.otherItem.length > 500) throw new ValidationError("\u65E7\u54C1\u540D\u304C\u4E0D\u6B63\u3067\u3059\u3002");
    ids.add(r.id);
  }
  for (const e of value.history) if (!e || typeof e.id !== "string" || !ids.has(e.recordId) || !["create", "update", "delete", "restore"].includes(e.action) || !PEOPLE.includes(e.actor) || !Number.isFinite(Date.parse(e.timestamp)) || !e.after || typeof e.after !== "object") throw new ValidationError("\u65E7\u5C65\u6B74\u306E\u5F62\u5F0F\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
}
function migrateState(value) {
  if (value?.schema === 3) return validateState(clone(value));
  validateLegacy(value);
  const masters = initialMasters();
  const augment = (r) => r ? { ...clone(r), customerName: CUSTOMERS.find((c) => c.id === r.customerId)?.name ?? "", createdById: masters.members.find((x) => x.name === r.createdBy)?.id ?? "", lastEditedById: masters.members.find((x) => x.name === r.lastEditedBy)?.id ?? "", combustibleRate: null, noncombustibleRate: null, itemIds: { combustible: "", noncombustible: "", other: "" }, itemNames: { combustible: "", noncombustible: "", other: "" }, defaultRates: { combustible: null, noncombustible: null, other: null }, priceSource: "legacy-unknown" } : null;
  return validateState({ schema: 3, revision: 1, masterRevision: 1, migratedFrom: 2, masters, records: value.records.map(augment), history: value.history.map((e) => ({ ...clone(e), actorId: masters.members.find((x) => x.name === e.actor)?.id ?? "", before: augment(e.before), after: augment(e.after) })), settingsHistory: [] });
}
function createSampleState() {
  const s = migrateState(sampleState());
  const names = ["\u9752\u8449\u307F\u3069\u308A\u5546\u5E97", "\u6E2F\u753A\u3053\u3080\u304E\u98DF\u5802", "\u65E5\u5411\u30D3\u30EB\u7BA1\u7406", "\u68EE\u306E\u307E\u3061\u30B9\u30FC\u30D1\u30FC", "\u3055\u304F\u3089\u901A\u308A\u30AA\u30D5\u30A3\u30B9", "\u3064\u3070\u3081\u88FD\u4F5C\u6240", "\u767D\u6CE2\u30D3\u30B8\u30CD\u30B9\u30DB\u30C6\u30EB", "\u3053\u3082\u308C\u3073\u83D3\u5B50\u5E97", "\u5317\u753A\u7269\u6D41\u30BB\u30F3\u30BF\u30FC", "\u3042\u304A\u305E\u3089\u30DB\u30FC\u30E0\u30BB\u30F3\u30BF\u30FC", "\u4E18\u306E\u4E0A\u30D9\u30FC\u30AB\u30EA\u30FC", "\u82E5\u8449\u5BB6\u5177\u5DE5\u623F", "\u4E03\u8272\u30A4\u30D9\u30F3\u30C8\u4F1A\u9928", "\u98A8\u898B\u30AB\u30D5\u30A7", "\u5C0F\u6625\u30D5\u30E9\u30EF\u30FC\u30B7\u30E7\u30C3\u30D7", "\u3072\u3060\u307E\u308A\u96C6\u5408\u4F4F\u5B85", "\u6C34\u8FBA\u306E\u5BBF", "\u4E2D\u592E\u6587\u5177\u30BB\u30F3\u30BF\u30FC", "\u3064\u304D\u306E\u308F\u98F2\u98DF\u9928", "\u5C71\u306E\u624B\u6574\u5099\u5DE5\u5834", "\u8679\u30F6\u4E18\u8CA9\u58F2\u6240", "\u3042\u3055\u3072\u98DF\u54C1\u52A0\u5DE5", "\u661F\u306E\u68EE\u96D1\u8CA8\u5E97", "\u99C5\u524D\u3057\u304A\u304B\u305C\u66F8\u5E97", "\u82E5\u8349\u5712\u82B8\u30BB\u30F3\u30BF\u30FC", "\u6728\u7ACB\u30EC\u30F3\u30BF\u30EB\u5009\u5EAB", "\u5357\u753A\u30B3\u30DF\u30E5\u30CB\u30C6\u30A3\u9928", "\u3066\u3089\u3059\u5171\u540C\u4E8B\u52D9\u6240", "\u4E09\u65E5\u6708\u5305\u88C5\u5DE5\u5834"];
  s.masters.customers.forEach((c, i) => {
    c.name = names[i] + "\uFF08\u67B6\u7A7A\uFF09";
    c.rates = { combustible: null, noncombustible: null, other: null };
  });
  for (const r of s.records) r.customerName = master(s, "customers", r.customerId).name;
  for (const e of s.history) for (const r of [e.before, e.after]) if (r) r.customerName = master(s, "customers", r.customerId).name;
  return validateState(s);
}
var sourceUnknownKeys = ["createdById", "lastEditedById", "createdAt", "updatedAt", "combustibleRate", "noncombustibleRate"];
function sourceUnknown(record, key) {
  return record?.provenance?.unknownFields?.includes(key) && record[key] === null;
}
function validateSourceProvenance(record) {
  const p = record.provenance;
  if (p === void 0) return;
  if (!p || !["legacy-sheet", "legacy-report-api", "direct-sheet-sync"].includes(p.origin) || typeof p.sourceRecordId !== "string" || !p.sourceRecordId || !Array.isArray(p.unknownFields) || new Set(p.unknownFields).size !== p.unknownFields.length || p.unknownFields.some((k) => !sourceUnknownKeys.includes(k) || record[k] !== null) || record.createdById === null && record.createdBy !== "" || record.lastEditedById === null && record.lastEditedBy !== "") throw new ValidationError("\u539F\u672C\u306E\u4E0D\u660E\u60C5\u5831\u306E\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
}
function sourceHistory(e) {
  const p = e?.provenance;
  return p?.origin === "direct-sheet-sync" && p.sourceEditorKnown === false && p.sourceTimeKnown === false && Number.isFinite(Date.parse(p.observedAt)) && e.actorId === null && e.actor === "" && e.timestamp === null;
}
function validateState(s) {
  if (!s || s.schema !== 3 || !Number.isInteger(s.revision) || s.revision < 1 || !Number.isInteger(s.masterRevision) || s.masterRevision < 1 || !Array.isArray(s.records) || !Array.isArray(s.history) || !Array.isArray(s.settingsHistory)) throw new ValidationError("\u4FDD\u5B58\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
  for (const type of types) {
    const ids2 = /* @__PURE__ */ new Set();
    if (!Array.isArray(s.masters?.[type])) throw new ValidationError("\u8A2D\u5B9A\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
    for (const m of s.masters[type]) {
      if (!m || typeof m.id !== "string" || !m.id || ids2.has(m.id) || typeof m.active !== "boolean" || !Number.isInteger(m.version) || m.version < 1) throw new ValidationError("\u8A2D\u5B9AID\u307E\u305F\u306F\u7248\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
      text(m.name);
      ids2.add(m.id);
      if (type === "members" && m.profile !== void 0) validateMemberProfile(m.profile);
      if (type === "items" && m.defaultRate !== void 0) {
        if (m.defaultRate !== null && typeof m.defaultRate !== "number") throw new ValidationError("\u5171\u901A\u5358\u4FA1\u306E\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
        optionalDecimal(m.defaultRate, "\u5171\u901A\u5358\u4FA1");
      }
      if (type === "items" && m.category !== void 0 && !CATEGORIES[m.category]) throw new ValidationError("\u533A\u5206\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
      if (type === "customers") {
        if (!Array.isArray(m.itemIds) || Object.keys(CATEGORIES).some((k) => typeof m.enabled?.[k] !== "boolean" || m.rates?.[k] !== null && typeof m.rates?.[k] !== "number")) throw new ValidationError("\u53D6\u5F15\u5148\u8A2D\u5B9A\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
        for (const k of Object.keys(CATEGORIES)) optionalDecimal(m.rates[k], "\u5358\u4FA1");
        if (m.invoicePostalCode !== void 0 && (typeof m.invoicePostalCode !== "string" || m.invoicePostalCode.length > 16)) throw new ValidationError("\u90F5\u4FBF\u756A\u53F7\u306F16\u6587\u5B57\u4EE5\u5185\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        if (m.invoiceAddress !== void 0 && (typeof m.invoiceAddress !== "string" || m.invoiceAddress.length > 90 || m.invoiceAddress.split("\n").length > 3)) throw new ValidationError("\u4F4F\u6240\u306F90\u6587\u5B57\u30FB3\u884C\u4EE5\u5185\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      }
    }
  }
  if (!activeMasters(s, "members").length) throw new ValidationError("\u6709\u52B9\u306A\u30E1\u30F3\u30D0\u30FC\u304C\u5FC5\u8981\u3067\u3059\u3002");
  for (const c of s.masters.customers) if (c.itemIds.some((id) => !master(s, "items", id))) throw new ValidationError("\u8A2D\u5B9A\u306E\u51E6\u5206\u7269\u54C1\u53C2\u7167\u304C\u4E0D\u6B63\u3067\u3059\u3002");
  const ids = /* @__PURE__ */ new Set();
  for (const r of s.records) {
    validateSourceProvenance(r);
    if (!r || typeof r.id !== "string" || ids.has(r.id) || !master(s, "customers", r.customerId) || !master(s, "members", r.createdById) && !sourceUnknown(r, "createdById") || !master(s, "members", r.lastEditedById) && !sourceUnknown(r, "lastEditedById") || !Number.isInteger(r.version) || r.version < 1 || typeof r.deleted !== "boolean" || !Number.isFinite(Date.parse(r.createdAt)) && !sourceUnknown(r, "createdAt") || !Number.isFinite(Date.parse(r.updatedAt)) && !sourceUnknown(r, "updatedAt")) throw new ValidationError("\u8A18\u9332\u306E\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
    validateDate(r.date);
    text(r.customerName);
    if (!sourceUnknown(r, "createdById")) text(r.createdBy);
    if (!sourceUnknown(r, "lastEditedById")) text(r.lastEditedBy);
    for (const key of numericFields) {
      if (r[key] !== null && typeof r[key] !== "number") throw new ValidationError("\u6570\u5024\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
      optionalDecimal(r[key], key);
    }
    if (typeof r.otherItem !== "string" || r.otherItem.length > 500) throw new ValidationError("\u305D\u306E\u4ED6\u5099\u8003\u306E\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
    if (r.categoryNotes !== void 0) validateCategoryNotes(r.categoryNotes);
    for (const k of Object.keys(CATEGORIES)) if (typeof r.itemIds?.[k] !== "string" || typeof r.itemNames?.[k] !== "string" || r.itemIds[k] && !master(s, "items", r.itemIds[k])) throw new ValidationError("\u51E6\u5206\u7269\u54C1\u306E\u53C2\u7167\u304C\u4E0D\u6B63\u3067\u3059\u3002");
    ids.add(r.id);
  }
  if (s.history.some((e) => !e || typeof e.id !== "string" || !ids.has(e.recordId) || !["create", "update", "delete", "restore"].includes(e.action) || (!master(s, "members", e.actorId) || !Number.isFinite(Date.parse(e.timestamp))) && !sourceHistory(e) || !e.after || typeof e.after !== "object") || s.settingsHistory.some((e) => !e || !types.includes(e.type) || !master(s, e.type, e.masterId) || (!master(s, "members", e.actorId) || !Number.isFinite(Date.parse(e.timestamp))) && !sourceHistory(e))) throw new ValidationError("\u5C65\u6B74\u306E\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
  for (const e of s.history) {
    if (!Number.isInteger(e.version) || e.version < 1 || typeof e.actor !== "string" || e.before !== null && typeof e.before !== "object") throw new ValidationError("\u5C65\u6B74\u306E\u7248\u30FB\u5B9F\u884C\u8005\u304C\u4E0D\u6B63\u3067\u3059\u3002");
    for (const snapshot of [e.before, e.after]) if (snapshot) {
      if (snapshot.id !== e.recordId) throw new ValidationError("\u5C65\u6B74\u306E\u8A18\u9332ID\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093\u3002");
      validateState({ ...s, records: [snapshot], history: [], settingsHistory: [] });
    }
  }
  for (const e of s.settingsHistory) if (e.type === "members") {
    for (const snapshot of [e.before, e.after]) if (snapshot?.profile !== void 0) validateMemberProfile(snapshot.profile);
  }
  return s;
}
function masterDraft(s, type, id, { duplicate = false } = {}) {
  const old = master(s, type, id);
  if (!old) throw new ValidationError("\u5BFE\u8C61\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
  const d = clone(old);
  if (duplicate) {
    delete d.id;
    delete d.version;
    d.name = "";
    d.active = true;
  }
  return d;
}
function masterChange(s, type, before, after, actorId, action) {
  const actor = member(s, actorId), next = clone(s);
  next.masters[type] = before ? next.masters[type].map((m) => m.id === before.id ? after : m) : [...next.masters[type], after];
  next.revision++;
  next.masterRevision++;
  next.settingsHistory.push({ id: uid(), type, masterId: after.id, action, actorId, actor: actor.name, timestamp: stamp(), before: clone(before), after: clone(after) });
  return { state: validateState(next), master: clone(after) };
}
function saveMaster(s, type, input, { id = null, expectedVersion = null, actorId } = {}) {
  if (!types.includes(type)) throw new ValidationError("\u8A2D\u5B9A\u7A2E\u5225\u304C\u4E0D\u6B63\u3067\u3059\u3002");
  member(s, actorId);
  const old = id ? master(s, type, id) : null;
  if (id && (!old || old.version !== expectedVersion)) throw new ConflictError(old ?? null);
  const name = text(input.name);
  if (s.masters[type].some((m) => m.id !== id && m.active && m.name === name)) throw new ValidationError("\u540C\u3058\u540D\u79F0\u304C\u767B\u9332\u6E08\u307F\u3067\u3059\u3002\u533A\u5225\u3067\u304D\u308B\u540D\u79F0\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const next = { id: old?.id ?? uid(), name, active: old?.active ?? true, version: (old?.version ?? 0) + 1 };
  if (type === "members") {
    if (input.profile !== void 0) next.profile = readMemberProfile({ ...old?.profile, ...input.profile });
    else if (old?.profile !== void 0) next.profile = clone(old.profile);
  }
  if (type === "items") {
    if (input.defaultRate !== void 0) next.defaultRate = optionalDecimal(input.defaultRate, "\u5171\u901A\u5358\u4FA1");
    else if (old?.defaultRate !== void 0) next.defaultRate = old.defaultRate;
    const category = input.category === void 0 ? old?.category : input.category;
    if (old && commonRateCategory(old) && category !== old.category) throw new ValidationError("\u5171\u901A\u5358\u4FA1\u306E\u57FA\u672C\u533A\u5206\u306F\u5909\u66F4\u3067\u304D\u307E\u305B\u3093\u3002");
    if (category !== void 0) {
      if (!CATEGORIES[category]) throw new ValidationError("\u533A\u5206\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
      if (old && old.category !== category && s.records.some((r) => Object.values(r.itemIds).includes(id))) throw new ValidationError("\u4F7F\u7528\u6E08\u307F\u7269\u54C1\u306E\u533A\u5206\u306F\u5909\u66F4\u3067\u304D\u307E\u305B\u3093\u3002");
      next.category = category;
    }
  }
  if (type === "customers") {
    for (const key of ["invoicePostalCode", "invoiceAddress"]) {
      const value = input[key] ?? old?.[key];
      if (value !== void 0) next[key] = String(value).replace(/\r\n?/g, "\n").split("\n").map((line2) => line2.trim()).join("\n").trim();
    }
    next.enabled = clone(input.enabled ?? old?.enabled ?? defaults().enabled);
    next.rates = {};
    for (const k of Object.keys(CATEGORIES)) next.rates[k] = optionalDecimal((input.rates ?? old?.rates)?.[k], `${CATEGORIES[k]}\u306E\u521D\u671F\u5024`);
    next.itemIds = [...new Set(input.itemIds ?? old?.itemIds ?? [])];
    if (next.itemIds.some((id2) => !master(s, "items", id2))) throw new ValidationError("\u51E6\u5206\u7269\u54C1\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002");
  }
  return masterChange(s, type, old, next, actorId, old ? "update" : "create");
}
function setMasterActive(s, type, id, expectedVersion, active, actorId) {
  member(s, actorId);
  const m = master(s, type, id);
  if (!m || m.version !== expectedVersion) throw new ConflictError(m ?? null);
  if (type === "members" && !active && activeMasters(s, type).length === 1 && m.active) throw new ValidationError("\u6700\u5F8C\u306E\u6709\u52B9\u306A\u30E1\u30F3\u30D0\u30FC\u306F\u524A\u9664\u3067\u304D\u307E\u305B\u3093\u3002");
  if (active && s.masters[type].some((x) => x.id !== id && x.active && x.name === m.name)) throw new ValidationError("\u540C\u3058\u540D\u79F0\u306E\u6709\u52B9\u306A\u9805\u76EE\u304C\u3042\u308A\u307E\u3059\u3002\u5148\u306B\u540D\u79F0\u3092\u533A\u5225\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  return masterChange(s, type, m, { ...m, active: !!active, version: m.version + 1 }, actorId, active ? "reactivate" : "deactivate");
}
function commonRateCategory(item) {
  const i = ["combustible", "noncombustible", "other"].indexOf(item?.category);
  return i >= 0 && item.id === `demo-item-${i + 1}` ? item.category : null;
}
function commonRates(s) {
  return Object.fromEntries(Object.keys(CATEGORIES).map((k) => {
    const row = s.masters.items.find((m) => m.active && commonRateCategory(m) === k);
    return [k, row?.defaultRate ?? null];
  }));
}
function effectiveRates(s, customerId) {
  const c = master(s, "customers", customerId);
  if (!c?.active) throw new ValidationError("\u6709\u52B9\u306A\u53D6\u5F15\u5148\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const common = commonRates(s);
  return Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, c.rates[k] ?? common[k]]));
}
function reportDefaults(s, customerId) {
  const rates = effectiveRates(s, customerId);
  return { combustibleKg: null, noncombustibleKg: null, otherItem: "", otherFee: rates.other, combustibleRate: rates.combustible, noncombustibleRate: rates.noncombustible, itemIds: { combustible: "", noncombustible: "", other: "" }, defaultRates: clone(rates), priceSource: "configured-default", masterRevision: s.masterRevision };
}
function upgradeInitialItems(value) {
  const s = validateState(value), changed = s.masters.items.filter((m) => commonRateCategory(m) && m.version === 1 && m.name === `${CATEGORIES[m.category]}\u30B5\u30F3\u30D7\u30EB\uFF08\u67B6\u7A7A\uFF09`);
  if (!changed.length) return s;
  const next = clone(s);
  for (const m of next.masters.items) if (changed.some((x) => x.id === m.id)) {
    m.name = CATEGORIES[m.category];
    m.version++;
  }
  next.revision++;
  next.masterRevision++;
  next.localMigrations = [...next.localMigrations ?? [], { id: "plain-initial-item-names-v0510", timestamp: stamp(), items: changed.map((m) => ({ id: m.id, before: m.name, after: CATEGORIES[m.category] })) }];
  return validateState(next);
}
function fields(s, input, current = null) {
  const c = master(s, "customers", input.customerId);
  if (!c || !c.active && current?.customerId !== c.id) throw new ValidationError("\u6709\u52B9\u306A\u53D6\u5F15\u5148\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  if (input.masterRevision !== s.masterRevision) throw new ConflictError({ message: "\u8A2D\u5B9A\u304C\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u3059\u3002\u5165\u529B\u5185\u5BB9\u3092\u63A7\u3048\u3001\u8A2D\u5B9A\u3092\u518D\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" });
  if (input.categoryNotes !== void 0) validateCategoryNotes(input.categoryNotes);
  const otherChanged = input.otherItem !== void 0 || input.categoryNotes?.other !== void 0;
  const f = { date: validateDate(input.date), customerId: c.id, customerName: current?.customerId === c.id ? current.customerName : c.name, otherItem: otherChanged ? readReportNote(input.otherItem !== void 0 ? input.otherItem : input.categoryNotes.other) : current?.otherItem ?? current?.categoryNotes?.other ?? "", itemIds: {}, itemNames: {}, defaultRates: clone(current?.defaultRates ?? effectiveRates(s, c.id)), priceSource: current?.priceSource ?? "report-input" };
  if (current?.categoryNotes !== void 0 || input.categoryNotes !== void 0) {
    f.categoryNotes = clone(current?.categoryNotes ?? {});
    for (const [key, value] of Object.entries(input.categoryNotes ?? {})) f.categoryNotes[key] = readReportNote(value);
    if (otherChanged && f.categoryNotes.other !== void 0) f.categoryNotes.other = f.otherItem;
  }
  for (const key of numericFields) f[key] = optionalDecimal(input[key], key);
  for (const k of Object.keys(CATEGORIES)) {
    const id = String(input.itemIds?.[k] ?? current?.itemIds?.[k] ?? ""), i = master(s, "items", id);
    if (id && (!i || i.category !== k || (!i.active || !c.itemIds.includes(id)) && current?.itemIds?.[k] !== id)) throw new ValidationError("\u9078\u629E\u3057\u305F\u51E6\u5206\u7269\u54C1\u306F\u73FE\u5728\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    f.itemIds[k] = id;
    f.itemNames[k] = current && input.itemIds?.[k] === void 0 ? current.itemNames[k] : id ? current?.itemIds?.[k] === id ? current.itemNames[k] : i.name : "";
  }
  const notes = reportNotes(f);
  if (f.combustibleKg === null && f.noncombustibleKg === null && f.otherFee === null && !Object.values(notes).some(Boolean) && !f.itemIds.other) throw new ValidationError("\u91CD\u91CF\u30FB\u5099\u8003\u30FB\u305D\u306E\u4ED6\u91D1\u984D\u306E\u3044\u305A\u308C\u304B\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  if (s.records.some((r) => !r.deleted && r.id !== current?.id && r.date === f.date && r.customerId === c.id)) throw new DuplicateError("\u540C\u3058\u65E5\u30FB\u53D6\u5F15\u5148\u306E\u8A18\u9332\u304C\u3042\u308A\u307E\u3059\u3002\u95B2\u89A7\u7DE8\u96C6\u304B\u3089\u65E2\u5B58\u8A18\u9332\u3092\u7DE8\u96C6\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  return f;
}
function recordChange(s, before, after, actorId, action) {
  if (after.provenance) {
    after = { ...after, provenance: { ...after.provenance, unknownFields: after.provenance.unknownFields.filter((k) => after[k] === null) } };
  }
  const a = member(s, actorId), next = clone(s);
  next.records = before ? next.records.map((r) => r.id === before.id ? after : r) : [...next.records, after];
  next.revision++;
  next.history.push({ id: uid(), recordId: after.id, action, actorId, actor: a.name, timestamp: after.updatedAt, version: after.version, before: clone(before), after: clone(after) });
  return { state: validateState(next), record: clone(after) };
}
function createRecord(s, input, actorId) {
  const a = member(s, actorId), creator = member(s, input.createdById), f = fields(s, input);
  const now = stamp();
  return recordChange(s, null, { ...f, id: uid(), createdById: creator.id, createdBy: creator.name, lastEditedById: a.id, lastEditedBy: a.name, createdAt: now, updatedAt: now, version: 1, deleted: false }, actorId, "create");
}
function createRecords(s, input, actorId) {
  member(s, actorId);
  if (!input.rows?.length) throw new ValidationError("\u5165\u529B\u3059\u308B\u53D6\u5F15\u5148\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  let next = s;
  const records = [];
  for (const row of input.rows) {
    try {
      const r = createRecord(next, { ...row, date: input.date, createdById: input.createdById, masterRevision: input.masterRevision }, actorId);
      next = r.state;
      records.push(r.record);
    } catch (e) {
      e.customerId = row.customerId;
      throw e;
    }
  }
  return { state: next, record: { count: records.length, records } };
}
function currentRecord(s, id, v, deleted = false) {
  const r = s.records.find((r2) => r2.id === id);
  if (!r || r.deleted !== deleted || r.version !== v) throw new ConflictError(r ?? null);
  return r;
}
function updateRecord(s, id, v, input, actorId) {
  const a = member(s, actorId), old = currentRecord(s, id, v), f = fields(s, input, old);
  return recordChange(s, old, { ...old, ...f, lastEditedById: a.id, lastEditedBy: a.name, updatedAt: stamp(), version: old.version + 1 }, actorId, "update");
}
function deleteRecord(s, id, v, actorId) {
  const a = member(s, actorId), old = currentRecord(s, id, v);
  return recordChange(s, old, { ...old, deleted: true, lastEditedById: a.id, lastEditedBy: a.name, updatedAt: stamp(), version: old.version + 1 }, actorId, "delete");
}
function restoreRecord(s, id, v, actorId) {
  const a = member(s, actorId), old = currentRecord(s, id, v, true);
  if (s.records.some((r) => !r.deleted && r.id !== id && r.date === old.date && r.customerId === old.customerId)) throw new DuplicateError("\u540C\u3058\u65E5\u30FB\u53D6\u5F15\u5148\u306E\u6709\u52B9\u306A\u8A18\u9332\u304C\u3042\u308B\u305F\u3081\u5FA9\u5143\u3092\u505C\u6B62\u3057\u307E\u3057\u305F\u3002");
  return recordChange(s, old, { ...old, deleted: false, lastEditedById: a.id, lastEditedBy: a.name, updatedAt: stamp(), version: old.version + 1 }, actorId, "restore");
}
function summaryCharges(rows) {
  const scale = 1000000n, productScale = scale * scale;
  const fixed3 = (value) => {
    if (value === null || value === void 0) return null;
    const [whole, fraction] = value.toFixed(6).split(".");
    return BigInt(whole) * scale + BigInt(fraction);
  };
  const decimal4 = (value, unit = productScale) => {
    const fraction = (value % unit).toString().padStart(String(unit).length - 1, "0").replace(/0+$/, "");
    return `${value / unit}${fraction ? "." + fraction : ""}`;
  };
  const category = (key) => {
    const groups = /* @__PURE__ */ new Map();
    let known = 0n, quantity = 0n, quantities = 0, entered2 = 0, missing2 = 0, missingWeight = 0, missingRate = 0;
    for (const row of rows) {
      const kg = fixed3(row[key + "Kg"]);
      if (kg === null && !reportNotes(row)[key] && !row.itemIds?.[key] && !row.itemNames?.[key]) continue;
      entered2++;
      const rate = row[key + "Rate"] ?? null, price = fixed3(rate), groupKey = rate === null ? "missing" : String(rate);
      if (!groups.has(groupKey)) groups.set(groupKey, { rate, count: 0, quantity: 0n, quantities: 0, known: 0n, missingWeight: 0 });
      const group = groups.get(groupKey);
      group.count++;
      if (kg === null) {
        missingWeight++;
        group.missingWeight++;
      } else {
        quantity += kg;
        quantities++;
        group.quantity += kg;
        group.quantities++;
      }
      if (price === null) missingRate++;
      if (kg === null || price === null) missing2++;
      else {
        known += kg * price;
        group.known += kg * price;
      }
    }
    const breakdown = [...groups.values()].sort((a, b) => a.rate === null ? 1 : b.rate === null ? -1 : a.rate - b.rate).map((group) => ({ rate: group.rate, count: group.count, quantity: group.quantities ? decimal4(group.quantity, scale) : null, missingWeight: group.missingWeight, amount: group.rate === null || group.missingWeight ? null : decimal4(group.known) }));
    return { entered: entered2, quantity: quantities ? decimal4(quantity, scale) : null, amount: entered2 && !missing2 ? decimal4(known) : null, knownAmount: decimal4(known), missing: missing2, missingWeight, missingRate, rates: breakdown.filter((group) => group.rate !== null).map((group) => group.rate), groups: breakdown };
  };
  const combustible = category("combustible"), noncombustible = category("noncombustible");
  let otherKnown = 0n, otherMissing = 0, otherEntered = 0;
  for (const row of rows) {
    const value = fixed3(row.otherFee);
    if (value === null && !reportNotes(row).other && !row.itemIds?.other && !row.itemNames?.other) continue;
    otherEntered++;
    if (value === null) otherMissing++;
    else otherKnown += value * scale;
  }
  const other = { entered: otherEntered, amount: otherEntered && !otherMissing ? decimal4(otherKnown) : null, knownAmount: decimal4(otherKnown), missing: otherMissing }, entered = combustible.entered + noncombustible.entered + otherEntered, missing = combustible.missing + noncombustible.missing + otherMissing;
  const total = !entered || missing ? null : decimal4([combustible.knownAmount, noncombustible.knownAmount, other.knownAmount].reduce((sum2, value) => {
    const [whole, fraction = ""] = value.split(".");
    return sum2 + BigInt(whole) * productScale + BigInt(fraction.padEnd(12, "0"));
  }, 0n));
  return { combustible, noncombustible, other, total, entered, missing };
}
function summarize(s, { period, value }) {
  let start, end;
  if (period === "day") {
    start = validateDate(value);
    end = start + "~";
  } else if (period === "month") {
    ({ start, end } = monthBounds(value));
  } else if (period === "year" && /^\d{4}$/.test(value) && Number(value) > 0) {
    start = value + "-01-01";
    end = String(Number(value) + 1).padStart(4, "0") + "-01-01";
  } else throw new ValidationError("\u96C6\u8A08\u671F\u9593\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const records = s.records.filter((r) => !r.deleted && r.date >= start && r.date < end);
  return s.masters.customers.map((c) => {
    const rows = records.filter((r) => r.customerId === c.id);
    return { customerId: c.id, name: displayName(s, "customers", c.id), count: rows.length, combustibleKg: sumField(rows, "combustibleKg"), noncombustibleKg: sumField(rows, "noncombustibleKg"), otherFee: sumField(rows, "otherFee"), missingCombustible: rows.filter((r) => r.combustibleKg === null).length, missingNoncombustible: rows.filter((r) => r.noncombustibleKg === null).length, missingOther: rows.filter((r) => r.otherFee === null).length, charges: summaryCharges(rows), records: [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map((r) => ({ recordId: r.id, date: r.date, charges: summaryCharges([r]) })) };
  }).filter((x) => x.count);
}
function moveMaster(s, type, id, direction, expectedMasterRevision, actorId) {
  if (!["members", "customers"].includes(type) || ![-1, 1].includes(direction)) throw new ValidationError("\u4E26\u3073\u66FF\u3048\u306E\u5BFE\u8C61\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const actor = member(s, actorId);
  if (expectedMasterRevision !== s.masterRevision) throw new ConflictError({ message: "\u4E00\u89A7\u304C\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u3059\u3002\u6700\u65B0\u306E\u4E26\u3073\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" });
  const index = s.masters[type].findIndex((m2) => m2.id === id);
  if (index < 0) throw new ValidationError("\u5BFE\u8C61\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
  const target = index + direction;
  if (target < 0 || target >= s.masters[type].length) return { state: clone(s), master: clone(s.masters[type][index]), changed: false };
  const next = clone(s), before = next.masters[type].map((m2) => m2.id);
  [next.masters[type][index], next.masters[type][target]] = [next.masters[type][target], next.masters[type][index]];
  const m = next.masters[type][target];
  next.revision++;
  next.masterRevision++;
  next.settingsHistory.push({ id: uid(), type, masterId: id, action: "reorder", actorId, actor: actor.name, timestamp: stamp(), before: clone(m), after: clone(m), orderBefore: before, orderAfter: next.masters[type].map((m2) => m2.id) });
  return { state: validateState(next), master: clone(m), changed: true };
}
function reorderMasters(s, type, orderedIds, expectedMasterRevision, actorId, draggedId) {
  if (!["members", "customers", "items"].includes(type)) throw new ValidationError("\u4E26\u3073\u66FF\u3048\u306E\u5BFE\u8C61\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const actor = member(s, actorId);
  if (expectedMasterRevision !== s.masterRevision) throw new ConflictError({ message: "\u4E00\u89A7\u304C\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u3059\u3002\u4E26\u3073\u306F\u4FDD\u5B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u6700\u65B0\u306E\u4E00\u89A7\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" });
  if (!Array.isArray(orderedIds)) throw new ValidationError("\u4E26\u3073\u9806\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const before = s.masters[type].map((m) => m.id), ids = new Set(orderedIds);
  if (orderedIds.length !== before.length || ids.size !== before.length || before.some((id) => !ids.has(id)) || !ids.has(draggedId)) throw new ValidationError("\u4E26\u3073\u9806\u306E\u5BFE\u8C61\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093\u3002\u4FDD\u5B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002");
  const item = s.masters[type].find((m) => m.id === draggedId);
  if (before.every((id, i) => id === orderedIds[i])) return { state: clone(s), master: clone(item), changed: false };
  const next = clone(s), byId = new Map(next.masters[type].map((m) => [m.id, m]));
  next.masters[type] = orderedIds.map((id) => byId.get(id));
  next.revision++;
  next.masterRevision++;
  next.settingsHistory.push({ id: uid(), type, masterId: draggedId, action: "reorder", actorId, actor: actor.name, timestamp: stamp(), before: clone(item), after: clone(item), orderBefore: before, orderAfter: [...orderedIds] });
  return { state: validateState(next), master: clone(item), changed: true };
}
function summaryPeriodLabels(period, value) {
  let first, last, label;
  if (period === "day") {
    first = last = validateDate(value);
    label = `${first.slice(0, 4)}\u5E74${first.slice(5, 7)}\u6708${first.slice(8, 10)}\u65E5`;
  } else if (period === "month") {
    const bounds = monthBounds(value);
    first = bounds.start;
    const end = /* @__PURE__ */ new Date(bounds.end + "T12:00:00+09:00");
    end.setUTCDate(end.getUTCDate() - 1);
    last = localDate(end);
    label = `${value.slice(0, 4)}\u5E74${value.slice(5, 7)}\u6708`;
  } else if (period === "year" && /^\d{4}$/.test(value) && Number(value) > 0) {
    first = value + "-01-01";
    last = value + "-12-31";
    label = `${value}\u5E74`;
  } else throw new ValidationError("\u96C6\u8A08\u671F\u9593\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const format = new Intl.DateTimeFormat("ja-JP-u-ca-japanese", { era: "long", year: "numeric", timeZone: "Asia/Tokyo" });
  const eras = [...new Set([first, last].map((date) => format.format(/* @__PURE__ */ new Date(date + "T12:00:00+09:00"))))];
  return { label, era: eras.join("\u30FB") };
}
function createCalculationSampleState() {
  const s = createSampleState();
  s.records = [];
  s.history = [];
  s.settingsHistory = [];
  s.masters.customers = s.masters.customers.slice(0, 2);
  s.masters.customers[0].name = "\u53D6\u5F15\u5148A\uFF08\u8A08\u7B97\u30B5\u30F3\u30D7\u30EB\uFF09";
  s.masters.customers[0].rates = { combustible: 30, noncombustible: null, other: 300 };
  s.masters.customers[1].name = "\u53D6\u5F15\u5148B\uFF08\u8A08\u7B97\u30B5\u30F3\u30D7\u30EB\uFF09";
  s.masters.customers[1].rates = { combustible: null, noncombustible: 50, other: 0 };
  s.masters.items[0].defaultRate = 25;
  s.masters.items[1].defaultRate = 40;
  s.calculationExample = true;
  return validateState(s);
}
function calculationSampleRows() {
  return [
    { customerId: "demo-c001", combustibleKg: 20, noncombustibleKg: 5, otherFee: 300 },
    { customerId: "demo-c002", combustibleKg: 10, noncombustibleKg: 2, otherFee: 0 }
  ];
}

// src/report-transfer.js
var REPORT_TRANSFER_PREFIX = "ROUTENOTE1:";
var REPORT_TRANSFER_LIMIT = 64e3;
var REPORT_TRUST = "untrusted-declared-author";
var ReportError = class extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "ReportError";
    this.code = code;
    this.details = details;
  }
};
var fail = (code, message) => {
  throw new ReportError(code, message);
};
var object = (value) => value && Object.getPrototypeOf(value) === Object.prototype;
var keys = (value, allowed) => object(value) && Object.keys(value).every((key) => allowed.includes(key));
var str = (value, max = 500) => typeof value === "string" && value.length <= max && value.isWellFormed() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
var uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
var timestamp = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
var decimal = (value) => value === null || typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e9 && /^\d+(?:\.\d{1,6})?$/.test(String(value));
var numbers = ["combustibleKg", "noncombustibleKg", "combustibleRate", "noncombustibleRate", "otherFee"];
var entryKeys = ["id", "date", "customerId", "customerName", ...numbers, "otherItem", "categoryNotes", "itemIds", "itemNames", "defaultRates", "priceSource", "createdById", "createdBy", "lastEditedById", "lastEditedBy", "createdAt", "updatedAt", "version", "deleted", "provenance", "billingProvenance", "masterRevision"];
function safeJSON(value, depth = 0) {
  if (depth > 8) fail("INVALID_REPORT", "\u5831\u544A\u306E\u5165\u308C\u5B50\u304C\u6DF1\u3059\u304E\u307E\u3059\u3002");
  if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) || str(value, 2e3)) return value;
  if (Array.isArray(value) && value.length <= 200) return value.map((v) => safeJSON(v, depth + 1));
  if (object(value)) {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (["__proto__", "constructor", "prototype"].includes(key) || !str(key, 100)) fail("INVALID_REPORT", "\u4F7F\u7528\u3067\u304D\u306A\u3044\u9805\u76EE\u540D\u3067\u3059\u3002");
      result[key] = safeJSON(value[key], depth + 1);
    }
    return result;
  }
  fail("INVALID_REPORT", "\u5831\u544A\u306B\u4FDD\u5B58\u3067\u304D\u306A\u3044\u5024\u304C\u3042\u308A\u307E\u3059\u3002");
}
function normalizeEntry(entry2) {
  if (!keys(entry2, entryKeys) || !str(entry2.id, 200) || !entry2.id || !str(entry2.customerId, 200) || !entry2.customerId || !str(entry2.customerName, 120) || !entry2.customerName || !/^\d{4}-\d{2}-\d{2}$/.test(entry2.date) || !Number.isFinite(Date.parse(entry2.date)) || new Date(entry2.date).toISOString().slice(0, 10) !== entry2.date || entry2.date.startsWith("0000") || numbers.some((key) => !decimal(entry2[key])) || !str(entry2.otherItem) || !Number.isSafeInteger(entry2.version) || entry2.version < 1 || typeof entry2.deleted !== "boolean") fail("INVALID_REPORT", "\u5831\u544A\u306E\u660E\u7D30\u5F62\u5F0F\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  for (const field of ["createdAt", "updatedAt"]) if (entry2[field] !== null && !timestamp(entry2[field])) fail("INVALID_REPORT", "\u8A18\u9332\u65E5\u6642\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  for (const field of ["createdById", "lastEditedById"]) if (entry2[field] !== null && !str(entry2[field], 200)) fail("INVALID_REPORT", "\u8A18\u9332\u8005\u306E\u5F62\u5F0F\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  for (const field of ["createdBy", "lastEditedBy"]) if (!str(entry2[field], 120)) fail("INVALID_REPORT", "\u8A18\u9332\u8005\u540D\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  for (const field of ["itemIds", "itemNames"]) if (!keys(entry2[field], ["combustible", "noncombustible", "other"]) || ["combustible", "noncombustible", "other"].some((key) => !str(entry2[field][key], 200))) fail("INVALID_REPORT", "\u54C1\u76EE\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  if (entry2.categoryNotes !== void 0 && (!keys(entry2.categoryNotes, ["combustible", "noncombustible", "other"]) || Object.values(entry2.categoryNotes).some((value) => !str(value)))) fail("INVALID_REPORT", "\u5099\u8003\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  if (entry2.defaultRates !== void 0 && (!keys(entry2.defaultRates, ["combustible", "noncombustible", "other"]) || Object.values(entry2.defaultRates).some((value) => !decimal(value)))) fail("INVALID_REPORT", "\u4FDD\u5B58\u5358\u4FA1\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  return safeJSON(entry2);
}
function normalizeReportBatch(value) {
  if (!keys(value, ["schemaVersion", "reportId", "revision", "createdAt", "updatedAt", "declaredActor", "entries"]) || value.schemaVersion !== 1 || !uuid(value.reportId) || !Number.isSafeInteger(value.revision) || value.revision < 1 || !timestamp(value.createdAt) || !timestamp(value.updatedAt) || value.updatedAt < value.createdAt || !keys(value.declaredActor, ["uid", "name"]) || !str(value.declaredActor.uid, 200) || !value.declaredActor.uid || !str(value.declaredActor.name, 120) || !Array.isArray(value.entries) || value.entries.length < 1 || value.entries.length > 100) fail("INVALID_REPORT", "\u5831\u544A\u5F62\u5F0F\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const entries = value.entries.map(normalizeEntry);
  if (new Set(entries.map((entry2) => entry2.id)).size !== entries.length) fail("INVALID_REPORT", "\u540C\u3058\u660E\u7D30ID\u304C\u91CD\u8907\u3057\u3066\u3044\u307E\u3059\u3002");
  const result = safeJSON({ ...value, entries });
  if (new TextEncoder().encode(JSON.stringify(result)).length > 256e3) fail("REPORT_TOO_LARGE", "\u5831\u544A\u5168\u4F53\u304C\u4FDD\u5B58\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\u3002");
  return result;
}
function createReportBatch({ entries, declaredActor, reportId = globalThis.crypto.randomUUID(), revision = 1, createdAt = (/* @__PURE__ */ new Date()).toISOString(), updatedAt = createdAt }) {
  return normalizeReportBatch({ schemaVersion: 1, reportId, revision, createdAt, updatedAt, declaredActor, entries });
}
var canonicalReport = (report) => JSON.stringify(normalizeReportBatch(report));
function compareReportBatches(existing, incoming) {
  const next = normalizeReportBatch(incoming);
  if (!existing) return { status: "new", incoming: next, trust: REPORT_TRUST };
  const old = normalizeReportBatch(existing);
  if (old.reportId !== next.reportId) fail("REPORT_ID_MISMATCH", "\u5831\u544AID\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093\u3002");
  const status = next.revision < old.revision ? "stale" : next.revision === old.revision ? canonicalReport(old) === canonicalReport(next) ? "noop" : "conflict" : "review";
  const before = new Map(old.entries.map((entry2) => [entry2.id, entry2])), after = new Map(next.entries.map((entry2) => [entry2.id, entry2]));
  const changes = [.../* @__PURE__ */ new Set([...before.keys(), ...after.keys()])].filter((id) => JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id))).map((id) => ({ id, before: before.get(id) ?? null, after: after.get(id) ?? null }));
  return { status, existing: old, incoming: next, changes, metadataChanged: ["createdAt", "declaredActor"].filter((key) => JSON.stringify(old[key]) !== JSON.stringify(next[key])), trust: REPORT_TRUST };
}
async function checksum(bytes) {
  if (!globalThis.crypto?.subtle) fail("CRYPTO_UNAVAILABLE", "\u3053\u306E\u74B0\u5883\u3067\u306F\u6574\u5408\u6027\u30C1\u30A7\u30C3\u30AF\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002");
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)), (value) => value.toString(16).padStart(2, "0")).join("");
}
async function encodeReportTransfer(report) {
  const bytes = new TextEncoder().encode(canonicalReport(report));
  const payload = btoa(Array.from(bytes, (value) => String.fromCharCode(value)).join("")).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const result = `${REPORT_TRANSFER_PREFIX}${payload}.${await checksum(bytes)}`;
  if (result.length > REPORT_TRANSFER_LIMIT) fail("TRANSFER_TOO_LARGE", "QR\u8EE2\u9001\u5168\u4F53\u306E\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\u3002\u5185\u5BB9\u306F\u7701\u7565\u3057\u307E\u305B\u3093\u3002\u5143\u306E\u5831\u544A\u3092\u4FDD\u6301\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  return result;
}
async function decodeReportTransfer(input) {
  if (typeof input !== "string" || input.length > REPORT_TRANSFER_LIMIT) fail("TRANSFER_TOO_LARGE", "QR\u306E\u30B5\u30A4\u30BA\u304C\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\u3002");
  if (!input.startsWith(REPORT_TRANSFER_PREFIX)) fail("INVALID_TRANSFER", "\u5BFE\u5FDC\u3059\u308B\u5831\u544AQR\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002");
  const match = /^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.exec(input.slice(REPORT_TRANSFER_PREFIX.length));
  if (!match) fail("INVALID_TRANSFER", "QR\u5F62\u5F0F\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  let bytes;
  try {
    bytes = Uint8Array.from(atob(match[1].replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));
  } catch {
    fail("INVALID_TRANSFER", "QR\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002");
  }
  if (await checksum(bytes) !== match[2]) fail("CHECKSUM_MISMATCH", "QR\u5185\u5BB9\u306E\u6574\u5408\u6027\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
  let report;
  try {
    report = normalizeReportBatch(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch (error) {
    if (error instanceof ReportError) throw error;
    fail("INVALID_TRANSFER", "QR\u306E\u5831\u544A\u5185\u5BB9\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002");
  }
  if (await encodeReportTransfer(report) !== input) fail("INVALID_TRANSFER", "QR\u306E\u6A19\u6E96\u5F62\u5F0F\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093\u3002");
  return { report, trust: REPORT_TRUST, notice: "\u7F72\u540D\u306E\u306A\u3044QR\u3067\u3059\u3002\u30C1\u30A7\u30C3\u30AF\u30B5\u30E0\u306F\u5185\u5BB9\u306E\u6574\u5408\u6027\u78BA\u8A8D\u3067\u3042\u308A\u3001\u4F5C\u8005\u306E\u8A8D\u8A3C\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002" };
}

// src/local-report-store.js
var LOCAL_REPORT_LIMIT = 10;
function createLocalReportStore({ uid: uid2, storage, locks = globalThis.navigator?.locks } = {}) {
  if (typeof uid2 !== "string" || !uid2 || uid2.length > 200 || !uid2.isWellFormed()) throw new ReportError("INVALID_UID", "\u672C\u4EBA\u306EUID\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  if (storage === void 0) {
    try {
      storage = globalThis.localStorage;
    } catch {
      throw new ReportError("STORAGE_UNAVAILABLE", "\u4FDD\u5B58\u9818\u57DF\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002");
    }
  }
  const key = `routenote-local-reports-v1:${encodeURIComponent(uid2)}`;
  function read() {
    let raw;
    try {
      raw = storage.getItem(key);
    } catch {
      throw new ReportError("STORAGE_UNAVAILABLE", "\u4FDD\u5B58\u9818\u57DF\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002");
    }
    if (raw === null) return { raw, reports: [], revision: 0 };
    try {
      const value = JSON.parse(raw);
      if (Object.keys(value).sort().join(",") !== "reports,revision,schemaVersion,uid" || value.schemaVersion !== 1 || value.uid !== uid2 || !Number.isSafeInteger(value.revision) || value.revision < 1 || !Array.isArray(value.reports) || value.reports.length > LOCAL_REPORT_LIMIT) throw Error();
      const reports2 = value.reports.map(normalizeReportBatch);
      if (new Set(reports2.map((report) => report.reportId)).size !== reports2.length) throw Error();
      return { raw, reports: reports2, revision: value.revision };
    } catch {
      throw new ReportError("INVALID_STORAGE", "\u4FDD\u5B58\u6E08\u307F\u5831\u544A\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002\u5143\u306E\u4FDD\u5B58\u5185\u5BB9\u306F\u5909\u66F4\u3057\u307E\u305B\u3093\u3002");
    }
  }
  function prepareImport(batch) {
    const snapshot = read(), incoming = normalizeReportBatch(batch);
    return { ...compareReportBatches(snapshot.reports.find((report) => report.reportId === incoming.reportId), incoming), expectedRaw: snapshot.raw };
  }
  async function save(batch, { expectedRaw, confirmRevision = false, evictReportId = null } = {}) {
    const incoming = normalizeReportBatch(batch);
    if (expectedRaw === void 0) throw new ReportError("EXPECTED_SNAPSHOT_REQUIRED", "\u4FDD\u5B58\u524D\u306E\u72B6\u614B\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    if (!locks?.request) throw new ReportError("LOCK_UNAVAILABLE", "\u8907\u6570\u753B\u9762\u306E\u4FDD\u5B58\u7AF6\u5408\u3092\u9632\u6B62\u3067\u304D\u306A\u3044\u305F\u3081\u4FDD\u5B58\u3057\u307E\u305B\u3093\u3002");
    return locks.request(key, { mode: "exclusive" }, () => {
      const snapshot = read();
      if (snapshot.raw !== expectedRaw) throw new ReportError("STORAGE_CONFLICT", "\u5225\u306E\u753B\u9762\u3067\u5831\u544A\u304C\u5909\u66F4\u3055\u308C\u307E\u3057\u305F\u3002\u518D\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      const comparison = compareReportBatches(snapshot.reports.find((report) => report.reportId === incoming.reportId), incoming);
      if (comparison.status === "noop") return { ...snapshot, status: "noop" };
      if (["conflict", "stale"].includes(comparison.status)) throw new ReportError(comparison.status === "conflict" ? "REVISION_CONFLICT" : "STALE_REVISION", "\u540C\u3058\u7248\u306E\u5185\u5BB9\u304C\u7570\u306A\u308B\u304B\u3001\u53E4\u3044\u7248\u3067\u3059\u3002\u4FDD\u5B58\u3057\u307E\u305B\u3093\u3002", comparison);
      if (comparison.status === "review" && confirmRevision !== true) return { ...comparison, expectedRaw: snapshot.raw };
      let reports2 = snapshot.reports.filter((report) => report.reportId !== incoming.reportId);
      if (evictReportId !== null) {
        if (typeof evictReportId !== "string" || evictReportId === incoming.reportId || !reports2.some((report) => report.reportId === evictReportId)) throw new ReportError("INVALID_EVICTION", "\u524A\u9664\u5BFE\u8C61\u306E\u5831\u544A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        reports2 = reports2.filter((report) => report.reportId !== evictReportId);
      }
      if (reports2.length >= LOCAL_REPORT_LIMIT) throw new ReportError("REPORT_LIMIT", "\u672C\u4EBA\u306E\u4FDD\u5B58\u306F10\u4EF6\u307E\u3067\u3067\u3059\u3002\u672A\u9001\u4FE1\u30FB\u672A\u4FDD\u7BA1\u306E\u5831\u544A\u3092\u4FDD\u8B77\u3059\u308B\u305F\u3081\u81EA\u52D5\u524A\u9664\u3057\u307E\u305B\u3093\u3002\u4FDD\u7BA1\u5F8C\u3001\u524A\u9664\u3059\u308B\u5831\u544A\u3092\u660E\u793A\u3057\u3066\u518D\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      if (snapshot.revision === Number.MAX_SAFE_INTEGER) throw new ReportError("REVISION_LIMIT", "\u4FDD\u5B58\u7248\u306E\u4E0A\u9650\u3067\u3059\u3002");
      reports2.unshift(incoming);
      const raw = JSON.stringify({ schemaVersion: 1, uid: uid2, revision: snapshot.revision + 1, reports: reports2 });
      try {
        storage.setItem(key, raw);
      } catch {
        throw new ReportError("WRITE_FAILED", "\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5165\u529B\u5185\u5BB9\u3092\u4FDD\u6301\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      }
      let actual;
      try {
        actual = storage.getItem(key);
      } catch {
        throw new ReportError("WRITE_UNCERTAIN", "\u66F8\u8FBC\u307F\u5F8C\u306E\u4FDD\u5B58\u78BA\u8A8D\u304C\u3067\u304D\u307E\u305B\u3093\u3002\u518D\u4FDD\u5B58\u524D\u306B\u72B6\u614B\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      }
      if (actual !== raw) throw new ReportError("WRITE_UNCERTAIN", "\u4FDD\u5B58\u76F4\u5F8C\u306B\u5225\u306E\u66F8\u8FBC\u307F\u3092\u691C\u51FA\u3057\u307E\u3057\u305F\u3002\u518D\u4FDD\u5B58\u524D\u306B\u72B6\u614B\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      return { raw, reports: structuredClone(reports2), revision: snapshot.revision + 1, status: "saved" };
    });
  }
  return { read, save, prepareImport };
}

// src/invoice-settings.js
var INVOICE_SETTINGS_KEY = "collection-note-invoice-settings-v1";
var INVOICE_SETTINGS_VERSION = 2;
var INVOICE_SETTINGS_LIMITS = Object.freeze({ tradeName: 60, legalName: 60, postalCode: 16, address: 90, registrationNumber: 32, addressLines: 3, bankName: 40, branchName: 40, accountType: 16, accountNumber: 20, accountHolder: 60, rate: 10, priceMode: 16, rounding: 16 });
var ISSUER_FIELDS = ["tradeName", "legalName", "postalCode", "address", "registrationNumber"];
var BANK_FIELDS = ["bankName", "branchName", "accountType", "accountNumber", "accountHolder"];
var TAX_FIELDS = ["rate", "priceMode", "rounding"];
var INVOICE_BANK_TYPES = Object.freeze({ ordinary: "\u666E\u901A", checking: "\u5F53\u5EA7", savings: "\u8CAF\u84C4" });
var INVOICE_TAX_PRICE_MODES = Object.freeze({ exclusive: "\u7A0E\u629C", inclusive: "\u7A0E\u8FBC" });
var INVOICE_TAX_ROUNDING = Object.freeze({ floor: "\u5207\u308A\u6368\u3066", round: "\u56DB\u6368\u4E94\u5165", ceil: "\u5207\u308A\u4E0A\u3052" });
var esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var hasKeys = (value, keys3) => isObject(value) && Object.keys(value).length === keys3.length && keys3.every((key) => Object.hasOwn(value, key));
var emptyFields = (fields2) => Object.fromEntries(fields2.map((key) => [key, ""]));
var copy = (value) => JSON.parse(JSON.stringify(value));
function emptyInvoiceSettings() {
  return { version: INVOICE_SETTINGS_VERSION, revision: 0, issuer: emptyFields(ISSUER_FIELDS), bankAccounts: [emptyFields(BANK_FIELDS), emptyFields(BANK_FIELDS)], tax: emptyFields(TAX_FIELDS) };
}
var InvoiceSettingsError = class extends Error {
  constructor(message, code) {
    super(message);
    this.name = "InvoiceSettingsError";
    this.code = code;
  }
};
var invalid = () => new InvoiceSettingsError("\u4F1A\u793E\u30FB\u9280\u884C\u30FB\u7A0E\u7387\u306E\u8A2D\u5B9A\u306E\u4FDD\u5B58\u30C7\u30FC\u30BF\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002\u5143\u306E\u30C7\u30FC\u30BF\u306F\u4E0A\u66F8\u304D\u3057\u3066\u3044\u307E\u305B\u3093\u3002", "invalid-storage");
function validFields(value, fields2) {
  return hasKeys(value, fields2) && fields2.every((key) => typeof value[key] === "string" && value[key].length <= INVOICE_SETTINGS_LIMITS[key] && !/[\u0000-\u0009\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069\ufffe\uffff]/u.test(value[key]) && (key === "address" ? value[key].split("\n").length <= INVOICE_SETTINGS_LIMITS.addressLines : !value[key].includes("\n")));
}
function validBanks(values) {
  return Array.isArray(values) && values.length === 2 && values.every((value) => validFields(value, BANK_FIELDS) && (value.accountType === "" || Object.hasOwn(INVOICE_BANK_TYPES, value.accountType)) && (value.accountNumber === "" || /^[0-9]{1,20}$/.test(value.accountNumber)));
}
function validTax(value) {
  return validFields(value, TAX_FIELDS) && (value.rate === "" || /^\d{1,3}(?:\.\d{1,6})?$/.test(value.rate) && Number(value.rate) <= 100) && (value.priceMode === "" || Object.hasOwn(INVOICE_TAX_PRICE_MODES, value.priceMode)) && (value.rounding === "" || Object.hasOwn(INVOICE_TAX_ROUNDING, value.rounding));
}
function validateInvoiceSettings(settings3) {
  if (!isObject(settings3) || !Number.isSafeInteger(settings3.revision) || settings3.revision < 0 || !validFields(settings3.issuer, ISSUER_FIELDS)) throw invalid();
  if (settings3.version === 1 && hasKeys(settings3, ["version", "revision", "issuer"])) return { ...emptyInvoiceSettings(), revision: settings3.revision, issuer: copy(settings3.issuer) };
  if (!hasKeys(settings3, ["version", "revision", "issuer", "bankAccounts", "tax"]) || settings3.version !== INVOICE_SETTINGS_VERSION || !validBanks(settings3.bankAccounts) || !validTax(settings3.tax)) throw invalid();
  return settings3;
}
function normalizeFields(values, fields2) {
  const normalized = {};
  for (const key of fields2) {
    if (typeof values?.[key] !== "string") throw new InvoiceSettingsError("\u5165\u529B\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "invalid-input");
    normalized[key] = values[key].replace(/\r\n?/g, "\n").split("\n").map((line2) => line2.trim()).join("\n").trim();
  }
  if (!validFields(normalized, fields2)) throw new InvoiceSettingsError("\u5165\u529B\u304C\u9577\u3059\u304E\u308B\u304B\u3001\u4F7F\u7528\u3067\u304D\u306A\u3044\u6587\u5B57\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002\u4F4F\u6240\u306F90\u6587\u5B57\u30FB3\u884C\u4EE5\u5185\u3001\u4F1A\u793E\u540D\u3068\u6CD5\u4EBA\u540D\u306F\u540460\u6587\u5B57\u4EE5\u5185\u3067\u3059\u3002", "invalid-input");
  return normalized;
}
function normalizeBankAccounts(values) {
  if (!Array.isArray(values) || values.length !== 2) throw new InvoiceSettingsError("\u632F\u8FBC\u5148\u306F2\u53E3\u5EA7\u307E\u3067\u8A2D\u5B9A\u3067\u304D\u307E\u3059\u3002", "invalid-input");
  const accounts = values.map((value) => normalizeFields(value, BANK_FIELDS));
  if (!validBanks(accounts)) throw new InvoiceSettingsError("\u53E3\u5EA7\u7A2E\u5225\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u53E3\u5EA7\u756A\u53F7\u306F\u6570\u5B5720\u6841\u4EE5\u5185\u3067\u3059\u3002", "invalid-input");
  return accounts;
}
function normalizeTax(value) {
  const tax = normalizeFields(value, TAX_FIELDS);
  if (!validTax(tax)) throw new InvoiceSettingsError("\u7A0E\u7387\u306F0\u301C100%\u30FB\u5C0F\u65706\u6841\u4EE5\u5185\u3001\u7A0E\u8FBC\uFF0F\u7A0E\u629C\u3068\u7AEF\u6570\u51E6\u7406\u306F\u9078\u629E\u80A2\u304B\u3089\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "invalid-input");
  return tax;
}
function normalizeSection(kind, values) {
  return kind === "bank" ? normalizeBankAccounts(values) : kind === "tax" ? normalizeTax(values) : normalizeFields(values, ISSUER_FIELDS);
}
function checkedStorageKey(storageKey) {
  if (typeof storageKey !== "string" || storageKey.length === 0 || storageKey.length > 256 || /[\u0000-\u001f\u007f]/u.test(storageKey)) throw new InvoiceSettingsError("\u4F1A\u793E\u30FB\u9280\u884C\u30FB\u7A0E\u7387\u306E\u8A2D\u5B9A\u306E\u4FDD\u5B58\u5148\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u4FDD\u5B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002", "invalid-storage-key");
  return storageKey;
}
function readInvoiceSettings(storage = globalThis.localStorage, storageKey = INVOICE_SETTINGS_KEY) {
  checkedStorageKey(storageKey);
  let raw;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    throw new InvoiceSettingsError("\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306E\u8A2D\u5B9A\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002\u4FDD\u5B58\u9818\u57DF\u306E\u5229\u7528\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "storage-unavailable");
  }
  if (raw === null) return { raw, settings: emptyInvoiceSettings() };
  try {
    return { raw, settings: validateInvoiceSettings(JSON.parse(raw)) };
  } catch {
    throw invalid();
  }
}
function createInvoiceSettingsStore({ getStorage = () => globalThis.localStorage, storageKey = INVOICE_SETTINGS_KEY } = {}) {
  checkedStorageKey(storageKey);
  function storage() {
    try {
      return getStorage();
    } catch {
      throw new InvoiceSettingsError("\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306E\u4FDD\u5B58\u9818\u57DF\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u306F\u4FDD\u5B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002", "storage-unavailable");
    }
  }
  function read() {
    return readInvoiceSettings(storage(), storageKey);
  }
  function saveSection(kind, values, expectedRaw) {
    const target = storage(), current = readInvoiceSettings(target, storageKey);
    if (current.raw !== expectedRaw) throw new InvoiceSettingsError("\u5225\u306E\u753B\u9762\u3067\u4F1A\u793E\u30FB\u9280\u884C\u30FB\u7A0E\u7387\u306E\u8A2D\u5B9A\u304C\u5909\u66F4\u3055\u308C\u307E\u3057\u305F\u3002\u4FDD\u5B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u5165\u529B\u5185\u5BB9\u3092\u63A7\u3048\u3001\u9589\u3058\u3066\u958B\u304D\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "conflict");
    const settings3 = copy(current.settings);
    if (settings3.revision >= Number.MAX_SAFE_INTEGER) throw invalid();
    settings3[kind === "bank" ? "bankAccounts" : kind === "tax" ? "tax" : "issuer"] = normalizeSection(kind, values);
    settings3.revision++;
    const raw = JSON.stringify(settings3);
    try {
      target.setItem(storageKey, raw);
    } catch {
      throw new InvoiceSettingsError("\u4FDD\u5B58\u9818\u57DF\u306E\u7A7A\u304D\u5BB9\u91CF\u306A\u3069\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u8A2D\u5B9A\u306F\u4FDD\u5B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u5165\u529B\u5185\u5BB9\u306F\u6B8B\u3057\u3066\u3044\u307E\u3059\u3002", "write-failed");
    }
    return { raw, settings: copy(settings3) };
  }
  return { read, getSettings: () => read().settings, saveIssuer: (values, raw) => saveSection("issuer", values, raw), saveBankAccounts: (values, raw) => saveSection("bank", values, raw), saveTax: (values, raw) => saveSection("tax", values, raw) };
}
function installInvoiceSettings({ doc = document, onChange = () => {
}, getStorage = () => doc.defaultView.localStorage, storageKey = INVOICE_SETTINGS_KEY, store: injectedStore, onSaveError = () => {
} } = {}) {
  const win = doc.defaultView, store = injectedStore ?? createInvoiceSettingsStore({ getStorage, storageKey });
  const dialog = doc.createElement("dialog");
  dialog.id = "invoice-settings-dialog";
  dialog.className = "invoice-settings-dialog";
  dialog.setAttribute("aria-labelledby", "invoice-settings-title");
  dialog.setAttribute("aria-describedby", "invoice-settings-note");
  doc.body.append(dialog);
  let context = null, origin = null, baseline = "", busy = false, disposed = false, discardAction = "close";
  const fieldsValues = (fields2, prefix = "") => Object.fromEntries(fields2.map((key) => [key, dialog.querySelector(`[name="${prefix}${key}"]`)?.value ?? ""]));
  const formValues = () => context?.kind === "bank" ? [fieldsValues(BANK_FIELDS, "bank0:"), fieldsValues(BANK_FIELDS, "bank1:")] : fieldsValues(context?.kind === "tax" ? TAX_FIELDS : ISSUER_FIELDS);
  const isDirty = () => Boolean(dialog.open && context?.mode === "edit" && JSON.stringify(formValues()) !== baseline);
  function setError(message) {
    const node = dialog.querySelector("#invoice-settings-error");
    if (node) {
      node.textContent = message;
      node.hidden = !message;
    }
  }
  function finishClose() {
    if (dialog.open) {
      if (dialog.close) dialog.close();
      else dialog.removeAttribute("open");
    }
    const kind = context?.kind || "issuer";
    context = null;
    baseline = "";
    const available = (element) => element?.isConnected && !element.closest("[hidden], dialog:not([open])");
    const replacement = [...doc.querySelectorAll(`[data-invoice-settings="${kind}"]`)].find(available);
    const focusTarget = available(origin) ? origin : available(replacement) ? replacement : null;
    focusTarget?.focus();
  }
  function confirmDiscard(action) {
    discardAction = action;
    const panel = dialog.querySelector("#invoice-settings-discard");
    panel.hidden = false;
    panel.querySelector("[data-invoice-discard]").textContent = action === "view" ? "\u7834\u68C4\u3057\u3066\u623B\u308B" : "\u7834\u68C4\u3057\u3066\u9589\u3058\u308B";
    panel.querySelector("[data-invoice-keep]").focus();
  }
  function close({ discard = false } = {}) {
    if (busy) return false;
    if (!dialog.open) return true;
    if (isDirty() && !discard) {
      confirmDiscard("close");
      return false;
    }
    finishClose();
    return true;
  }
  const labels = { tradeName: "\u4F1A\u793E\u540D\u30FB\u5C4B\u53F7", legalName: "\u6CD5\u4EBA\u540D\u30FB\u6C0F\u540D", postalCode: "\u90F5\u4FBF\u756A\u53F7", address: "\u4F4F\u6240", registrationNumber: "\u9069\u683C\u8ACB\u6C42\u66F8\u767A\u884C\u4E8B\u696D\u8005\u306E\u767B\u9332\u756A\u53F7", bankName: "\u91D1\u878D\u6A5F\u95A2\u540D", branchName: "\u652F\u5E97\u540D", accountType: "\u53E3\u5EA7\u7A2E\u5225", accountNumber: "\u53E3\u5EA7\u756A\u53F7", accountHolder: "\u53E3\u5EA7\u540D\u7FA9", rate: "\u7A0E\u7387\uFF08%\uFF09", priceMode: "\u7A0E\u8FBC\uFF0F\u7A0E\u629C", rounding: "\u7A0E\u984D\u306E\u7AEF\u6570\u51E6\u7406" };
  const optionLabels = { accountType: INVOICE_BANK_TYPES, priceMode: INVOICE_TAX_PRICE_MODES, rounding: INVOICE_TAX_ROUNDING };
  const titles = { issuer: "\u4F1A\u793E\u60C5\u5831", bank: "\u9280\u884C\u60C5\u5831", tax: "\u7A0E\u7387" };
  function field(key, value, prefix = "") {
    const name = prefix + key;
    const control = optionLabels[key] ? `<select name="${name}"><option value="" ${value === "" ? "selected" : ""}>\u672A\u8A2D\u5B9A</option>${Object.entries(optionLabels[key]).map(([option, label]) => `<option value="${option}" ${option === value ? "selected" : ""}>${label}</option>`).join("")}</select>` : key === "address" ? `<textarea name="${name}" rows="3" maxlength="${INVOICE_SETTINGS_LIMITS[key]}" aria-describedby="invoice-address-help">${esc(value)}</textarea><small id="invoice-address-help">90\u6587\u5B57\u30FB3\u884C\u307E\u3067\u3002\u884C\u982D\u306E\u7A7A\u767D\u306F\u4FDD\u5B58\u6642\u306B\u9664\u304D\u307E\u3059\u3002</small>` : `<input name="${name}" value="${esc(value)}" maxlength="${INVOICE_SETTINGS_LIMITS[key]}" autocomplete="off"${key === "rate" ? ' inputmode="decimal"' : key === "accountNumber" ? ' inputmode="numeric"' : ""}>`;
    return `<label class="field"><span>${labels[key]} <small>\u4EFB\u610F</small></span>${control}</label>`;
  }
  function fieldsHTML(fields2, values, editing, prefix = "") {
    return editing ? `<div class="invoice-settings-fields">${fields2.map((key) => field(key, values[key], prefix)).join("")}</div>` : `<dl class="invoice-settings-values">${fields2.map((key) => `<div><dt>${labels[key]}</dt><dd data-invoice-value="${prefix}${key}">${esc(context.error ? "\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093" : optionLabels[key]?.[values[key]] || values[key] || "\u672A\u8A2D\u5B9A")}</dd></div>`).join("")}</dl>`;
  }
  function render(mode = "view", message = "") {
    context.mode = mode;
    const editing = mode === "edit", kind = context.kind, title = titles[kind];
    const content = kind === "bank" ? context.settings.bankAccounts.map((account, index) => `<section class="invoice-bank-group"><h3>\u632F\u8FBC\u5148${index + 1}</h3>${fieldsHTML(BANK_FIELDS, account, editing, `bank${index}:`)}</section>`).join("") : fieldsHTML(kind === "tax" ? TAX_FIELDS : ISSUER_FIELDS, kind === "tax" ? context.settings.tax : context.settings.issuer, editing);
    const description = kind === "bank" ? "\u8ACB\u6C42\u66F8\u306B\u8868\u793A\u3059\u308B\u632F\u8FBC\u5148\uFF08\u4EFB\u610F\uFF09" : kind === "tax" ? "\u4ECA\u5F8C\u306E\u8A08\u7B97\u306B\u4F7F\u3046\u5019\u88DC\u306E\u8A2D\u5B9A" : "\u8ACB\u6C42\u66F8\u306B\u8868\u793A\u3059\u308B\u4F1A\u793E\u540D\u30FB\u4F4F\u6240";
    dialog.innerHTML = `<form id="invoice-settings-form" novalidate><header class="dialog-head"><div><h2 id="invoice-settings-title">${title}${editing ? "\u3092\u7DE8\u96C6" : ""}</h2><p>${description}</p></div><button type="button" class="icon-button" data-invoice-close aria-label="${title}\u3092\u9589\u3058\u308B">\xD7</button></header><div class="dialog-body"><p id="invoice-settings-note" class="invoice-settings-note">${injectedStore ? "\u767B\u9332\u30E1\u30F3\u30D0\u30FC\u3067\u5171\u6709\u3059\u308B\u8A2D\u5B9A\u3067\u3059\u3002" + (context.provenance?.[kind]?.origin === "reference-document" && context.provenance[kind].reviewStatus === "unreviewed" ? "\u8CC7\u6599\u304B\u3089\u4EEE\u5165\u529B\u30FB\u8981\u78BA\u8A8D\u3002" : "") : "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u5185\u3060\u3051\u306B\u4FDD\u5B58\u3057\u307E\u3059\u3002Google Sheets\u3078\u306E\u63A5\u7D9A\u30FB\u9001\u4FE1\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u8A66\u4F5C\u306E\u305F\u3081\u3001\u5B9F\u5728\u306E\u4F1A\u793E\u30FB\u500B\u4EBA\u30FB\u9280\u884C\u53E3\u5EA7\u306E\u60C5\u5831\u306F\u5165\u529B\u3057\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002"}</p>${content}<p class="invoice-settings-note">${kind === "tax" ? "\u7A0E\u7387\u30FB\u7A0E\u8FBC\uFF0F\u7A0E\u629C\u30FB\u7AEF\u6570\u51E6\u7406\u306F\u672A\u8A2D\u5B9A\u304B\u3089\u59CB\u3081\u307E\u3059\u3002\u4FDD\u5B58\u3057\u3066\u3082\u7A0E\u8A08\u7B97\u306F\u307E\u3060\u884C\u308F\u305A\u3001\u6B63\u5F0F\u306A\u8ACB\u6C42\u984D\u3082\u8A08\u7B97\u3057\u307E\u305B\u3093\u3002\u904E\u53BB\u306E\u5831\u544A\u30FB\u4FDD\u5B58\u6E08\u307FPDF\u3092\u5909\u66F4\u3057\u307E\u305B\u3093\u3002" : "\u7A7A\u6B04\u306F\u672A\u8A2D\u5B9A\u3068\u3057\u3066\u8868\u793A\u3057\u307E\u3059\u3002\u8A2D\u5B9A\u306F\u6B21\u306B\u4F5C\u308B\u898B\u672C\u3078\u53CD\u6620\u3057\u3001\u904E\u53BB\u306E\u5831\u544A\u30FB\u4FDD\u5B58\u6E08\u307FPDF\u306F\u5909\u66F4\u3057\u307E\u305B\u3093\u3002\u6B63\u5F0F\u306A\u8ACB\u6C42\u306B\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002"}</p><p id="invoice-settings-status" role="status">${esc(message)}</p><p id="invoice-settings-error" class="form-error" role="alert" ${context.error ? "" : "hidden"}>${esc(context.error)}</p><div id="invoice-settings-discard" class="invoice-settings-discard" role="group" aria-label="\u672A\u4FDD\u5B58\u306E\u5165\u529B\u3092\u7834\u68C4\u3059\u308B\u78BA\u8A8D" hidden><p>\u5165\u529B\u4E2D\u306E\u5185\u5BB9\u306F\u4FDD\u5B58\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u7834\u68C4\u3057\u307E\u3059\u304B\uFF1F</p><div class="actions"><button type="button" class="button secondary" data-invoice-keep>\u5165\u529B\u306B\u623B\u308B</button><button type="button" class="button secondary danger-text" data-invoice-discard>\u7834\u68C4\u3057\u3066\u9589\u3058\u308B</button></div></div></div><footer class="dialog-foot">${editing ? '<button type="button" class="button secondary" data-invoice-cancel-edit>\u30AD\u30E3\u30F3\u30BB\u30EB</button><button type="button" id="invoice-settings-save" class="button primary">\u4FDD\u5B58</button>' : `<button type="button" class="button secondary" data-invoice-close>\u9589\u3058\u308B</button><button type="button" class="button primary" data-invoice-edit ${context.error ? "disabled" : ""}>\u7DE8\u96C6</button>`}</footer></form>`;
    baseline = editing ? JSON.stringify(formValues()) : "";
  }
  function open(kind = "issuer") {
    if (disposed || busy || dialog.open) return false;
    origin = doc.activeElement;
    let loaded, error = "";
    try {
      loaded = store.read();
    } catch (failure2) {
      error = failure2.message;
      loaded = { raw: void 0, settings: emptyInvoiceSettings() };
    }
    context = { ...loaded, kind, mode: "view", error };
    render();
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.querySelector(".dialog-foot [data-invoice-close]")?.focus();
    return true;
  }
  function setBusy(value) {
    busy = value;
    dialog.querySelectorAll("input, select, textarea, button").forEach((node) => {
      node.disabled = value;
    });
    const save2 = dialog.querySelector("#invoice-settings-save");
    if (save2) {
      save2.disabled = value || Boolean(context?.error);
      save2.textContent = value ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58";
      save2.setAttribute("aria-busy", String(value));
    }
  }
  async function save() {
    if (busy || context?.mode !== "edit" || context.error) return;
    const draft = formValues(), expectedRaw = context.raw, kind = context.kind;
    try {
      normalizeSection(kind, draft);
    } catch (error) {
      setError(error.message);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const save2 = () => {
        if (disposed) throw new InvoiceSettingsError("\u753B\u9762\u304C\u9589\u3058\u3089\u308C\u305F\u305F\u3081\u4FDD\u5B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002", "disposed");
        return (kind === "bank" ? store.saveBankAccounts : kind === "tax" ? store.saveTax : store.saveIssuer)(draft, expectedRaw);
      };
      const saved = win.navigator.locks?.request ? await win.navigator.locks.request(storageKey, save2) : await save2();
      if (disposed) return;
      context = { ...saved, kind, mode: "view", error: "" };
      setBusy(false);
      render("view", injectedStore ? "\u5171\u6709\u8A2D\u5B9A\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002" : "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306B\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002");
      dialog.querySelector("[data-invoice-edit]").focus();
      doc.dispatchEvent(new win.CustomEvent("invoice-settings-change", { detail: { storageKey } }));
      try {
        onChange(copy(saved.settings));
      } catch {
      }
    } catch (error) {
      if (!disposed) {
        setError(error.message || "\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5165\u529B\u5185\u5BB9\u306F\u6B8B\u3057\u3066\u3044\u307E\u3059\u3002");
        onSaveError(dialog.querySelector("#invoice-settings-error"));
      }
    } finally {
      if (!disposed) setBusy(false);
    }
  }
  const click = (event) => {
    const target = event.target.closest?.("button");
    if (!target || busy) return;
    if (Object.hasOwn(titles, target.dataset.invoiceSettings || "")) {
      open(target.dataset.invoiceSettings);
      return;
    }
    if (!dialog.contains(target)) return;
    if (target.id === "invoice-settings-save") {
      void save();
      return;
    }
    if (target.matches("[data-invoice-close]")) close();
    else if (target.matches("[data-invoice-edit]") && !context.error) {
      render("edit");
      dialog.querySelector("input, select")?.focus();
    } else if (target.matches("[data-invoice-cancel-edit]")) {
      if (isDirty()) confirmDiscard("view");
      else {
        render();
        dialog.querySelector("[data-invoice-edit]").focus();
      }
    } else if (target.matches("[data-invoice-discard]")) {
      if (discardAction === "view") {
        render();
        dialog.querySelector("[data-invoice-edit]").focus();
      } else close({ discard: true });
    } else if (target.matches("[data-invoice-keep]")) {
      dialog.querySelector("#invoice-settings-discard").hidden = true;
      dialog.querySelector("input, select, textarea")?.focus();
    }
  };
  const submit = (event) => {
    if (event.target.id === "invoice-settings-form") event.preventDefault();
  };
  const keydown = (event) => {
    if (event.key === "Enter" && event.target.matches?.("input") && !event.isComposing && event.keyCode !== 229) event.preventDefault();
  };
  const cancel = (event) => {
    event.preventDefault();
    close();
  };
  const beforeUnload = (event) => {
    if (isDirty() || busy) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  const storageChange = (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    if (dialog.open) setError("\u5225\u306E\u753B\u9762\u3067\u4FDD\u5B58\u5185\u5BB9\u304C\u5909\u308F\u3063\u305F\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002\u5165\u529B\u306F\u6B8B\u3057\u3066\u3044\u307E\u3059\u3002\u4FDD\u5B58\u6642\u306B\u6700\u65B0\u306E\u5185\u5BB9\u3068\u7167\u5408\u3057\u307E\u3059\u3002");
  };
  doc.addEventListener("click", click);
  dialog.addEventListener("submit", submit);
  dialog.addEventListener("keydown", keydown);
  dialog.addEventListener("cancel", cancel);
  win.addEventListener("beforeunload", beforeUnload);
  win.addEventListener("storage", storageChange);
  return {
    openIssuer: () => open("issuer"),
    openBank: () => open("bank"),
    openTax: () => open("tax"),
    getSettings: store.getSettings,
    isDirty,
    isBusy: () => busy,
    close,
    dispose() {
      disposed = true;
      finishClose();
      dialog.remove();
      doc.removeEventListener("click", click);
      dialog.removeEventListener("submit", submit);
      dialog.removeEventListener("keydown", keydown);
      dialog.removeEventListener("cancel", cancel);
      win.removeEventListener("beforeunload", beforeUnload);
      win.removeEventListener("storage", storageChange);
    }
  };
}

// src/local-workspace-adapter.js
var clone2 = (value) => structuredClone(value);
var issue = (code, message = code) => Object.assign(new Error(message), { code });
var localWorkspaceKey = (uid2) => `routenote-lightweight-basics-v1:${encodeURIComponent(uid2)}`;
var reports = /* @__PURE__ */ new Set(["createRecord", "createRecords", "updateRecord", "deleteRecord", "restoreRecord"]);
var settings = /* @__PURE__ */ new Set(["saveMaster", "setMasterActive", "reorderMasters"]);
var operations = Object.fromEntries([...reports, ...settings].map((name) => [name, (...args) => ({ kind: reports.has(name) ? "report" : "settings", result: domain_exports[name](...args) })]));
function validate(value, uid2) {
  if (!value || value.schemaVersion !== 1 || value.uid !== uid2 || !value.actor?.memberId || !value.actor?.displayName) throw issue("LOCAL_INVALID");
  validateState(value.state);
  validateInvoiceSettings(value.invoiceSettings);
  if (!value.state.masters.members.some((m) => m.id === value.actor.memberId && m.active)) throw issue("LOCAL_INVALID");
  if (value.state.records.some((r) => r.createdById !== value.actor.memberId)) throw issue("LOCAL_OWNER_MISMATCH");
  return clone2(value);
}
function createLocalWorkspaceAdapter({ identity: identity2, storage, locks, initialBasics, settingsTransport, settingsTimeoutMs = 3e4, id = () => crypto.randomUUID() } = {}) {
  let saved = null, raw = null, owner = identity2.currentUid(), epoch = 0, disposed = false, busy = false, activeController = null;
  const initialOwner = owner, listeners = /* @__PURE__ */ new Set();
  const off = identity2.subscribe((uid2) => {
    if (uid2 !== owner) {
      owner = uid2;
      epoch++;
      activeController?.abort();
      saved = null;
      raw = null;
      for (const fn of listeners) fn();
    }
  });
  const ticket = () => {
    if (disposed || !owner || owner !== initialOwner || identity2.currentUid() !== owner) throw issue("LOGIN_REQUIRED");
    return { uid: owner, epoch };
  };
  const check = (t) => {
    if (disposed || t.uid !== owner || t.uid !== identity2.currentUid() || t.epoch !== epoch) throw issue("LOGIN_REQUIRED");
  };
  const boundStore = (t) => createLocalReportStore({ uid: t.uid, locks, storage: { getItem(key) {
    check(t);
    return storage.getItem(key);
  }, setItem(key, value) {
    check(t);
    storage.setItem(key, value);
  } } });
  const reportStore = { read() {
    return boundStore(ticket()).read();
  }, prepareImport(batch) {
    return boundStore(ticket()).prepareImport(batch);
  }, async save(batch, options) {
    const t = ticket();
    try {
      const result = await boundStore(t).save(batch, options);
      check(t);
      return result;
    } catch (error) {
      check(t);
      throw error;
    }
  } };
  const current = () => {
    ticket();
    if (!saved) throw issue("NOT_READY");
    return saved;
  };
  const stateView = () => {
    const base = clone2(current().state), snapshot = reportStore.read();
    base.records = snapshot.reports.filter((report) => report.declaredActor.uid === initialOwner).flatMap((report) => report.entries);
    base.history = [];
    base.revision += snapshot.revision;
    validateState(base);
    return base;
  };
  const lock = (t, fn) => locks?.request ? locks.request(`${localWorkspaceKey(t.uid)}:write`, fn) : Promise.reject(issue("LOCAL_LOCKS_REQUIRED"));
  const readStored = (t) => {
    check(t);
    const next = storage.getItem(localWorkspaceKey(t.uid));
    if (next === null) throw issue("missing-local-basics", "\u3053\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u306E\u57FA\u672C\u60C5\u5831\u304C\u7AEF\u672B\u306B\u3042\u308A\u307E\u305B\u3093\u3002\u521D\u56DE\u8A2D\u5B9A\u65B9\u6CD5\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    let value;
    try {
      value = JSON.parse(next);
    } catch {
      throw issue("LOCAL_INVALID");
    }
    saved = validate(value, t.uid);
    raw = next;
    return saved;
  };
  function persist(t, next) {
    check(t);
    const key = localWorkspaceKey(t.uid);
    if (storage.getItem(key) !== raw) throw issue("LOCAL_CONFLICT");
    const clean = { ...next, state: { ...next.state, records: [], history: [] } };
    const encoded = JSON.stringify(validate(clean, t.uid));
    storage.setItem(key, encoded);
    if (storage.getItem(key) !== encoded) throw issue("LOCAL_WRITE_UNCERTAIN");
    saved = clone2(clean);
    raw = encoded;
  }
  async function initialize() {
    const t = ticket();
    if (saved) return stateView();
    return lock(t, async () => {
      check(t);
      if (storage.getItem(localWorkspaceKey(t.uid)) === null) {
        if (!initialBasics) throw issue("missing-local-basics", "\u3053\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u306E\u57FA\u672C\u60C5\u5831\u304C\u7AEF\u672B\u306B\u3042\u308A\u307E\u305B\u3093\u3002\u521D\u56DE\u8A2D\u5B9A\u65B9\u6CD5\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        if (typeof initialBasics === "function") throw issue("LOCAL_BASICS_OBJECT_REQUIRED");
        const value = validate(initialBasics, t.uid);
        if (value.state.records.length || value.state.history.length) throw issue("LOCAL_BASICS_RECORDS_FORBIDDEN");
        raw = null;
        persist(t, value);
      } else readStored(t);
      return stateView();
    });
  }
  async function saveSettings(t, next) {
    if (!settingsTransport) throw issue("SETTINGS_NOT_CONNECTED", "\u8A2D\u5B9A\u4FDD\u5B58\u306E\u63A5\u7D9A\u304C\u672A\u5B8C\u4E86\u3067\u3059\u3002\u5165\u529B\u306F\u9001\u4FE1\u3057\u3066\u3044\u307E\u305B\u3093\u3002");
    if (current().pendingSettings) throw issue("OPERATION_UNKNOWN", "\u524D\u306E\u8A2D\u5B9A\u4FDD\u5B58\u7D50\u679C\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    const operationId = id(), request = { operationId, expectedMasterRevision: saved.state.masterRevision, expectedSettingsRevision: saved.invoiceSettings.revision, masters: clone2(next.state.masters), invoiceSettings: clone2(next.invoiceSettings) };
    persist(t, { ...saved, pendingSettings: request });
    let sent = false, timer;
    const controller = new AbortController();
    activeController = controller;
    const interrupted = new Promise((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(issue("OPERATION_UNKNOWN", "\u4FDD\u5B58\u7D50\u679C\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u518D\u9001\u305B\u305A\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002")), { once: true });
      timer = setTimeout(() => controller.abort(), settingsTimeoutMs);
    });
    void interrupted.catch(() => {
    });
    try {
      check(t);
      sent = true;
      const response = await Promise.race([settingsTransport(clone2(request), { signal: controller.signal }), interrupted]);
      check(t);
      if (response?.ok !== true || response.operationId !== operationId || !response.basics) throw issue("OPERATION_UNKNOWN");
      const basics2 = response.basics;
      const accepted = validate({ ...saved, ...basics2, uid: t.uid, actor: saved.actor, state: { ...next.state, ...basics2.state, records: next.state.records, history: next.state.history }, pendingSettings: null }, t.uid);
      persist(t, accepted);
      return stateView();
    } catch (error) {
      if (!sent || error?.definitiveRejection === true) {
        try {
          check(t);
          persist(t, { ...saved, pendingSettings: null });
        } catch {
        }
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (activeController === controller) activeController = null;
    }
  }
  const api = {
    mode: "local-lightweight",
    currentUid: () => ticket().uid,
    currentIdentity: () => ticket(),
    localReportStore: reportStore,
    operations,
    initialize,
    read: () => stateView(),
    actor: () => clone2(current().actor),
    snapshotKey: () => `${current().state.revision}:${current().invoiceSettings.revision}:${reportStore.read().revision}`,
    async refresh() {
      const t = ticket();
      return lock(t, () => {
        readStored(t);
        return stateView();
      });
    },
    async mutate(operation) {
      if (busy) throw issue("BUSY");
      busy = true;
      const t = ticket();
      try {
        return await lock(t, async () => {
          readStored(t);
          const command = operation(stateView(), saved.actor.memberId);
          if (!command || !["report", "settings"].includes(command.kind)) throw issue("BAD_REQUEST");
          const result = command.result;
          validateState(result.state);
          if (command.kind === "settings") {
            await saveSettings(t, { ...saved, state: result.state });
            return { ...result, state: stateView(), projectionCurrent: true, localOnly: false };
          }
          if (result.state.records.some((r) => r.createdById !== saved.actor.memberId)) throw issue("LOCAL_OWNER_MISMATCH");
          const snapshot = reportStore.read(), before = stateView(), oldById = new Map(before.records.map((row) => [row.id, row]));
          const changed = result.state.records.filter((row) => JSON.stringify(oldById.get(row.id)) !== JSON.stringify(row));
          if (!changed.length) throw issue("BAD_REQUEST");
          const affected = snapshot.reports.filter((batch2) => batch2.entries.some((row) => changed.some((item) => item.id === row.id)));
          if (affected.length > 1) throw issue("LOCAL_BATCH_CONFLICT");
          let batch;
          if (affected.length) {
            const previous = affected[0];
            if (previous.declaredActor.uid !== t.uid) throw issue("LOCAL_OWNER_MISMATCH");
            batch = createReportBatch({ ...previous, revision: previous.revision + 1, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), entries: previous.entries.map((row) => changed.find((item) => item.id === row.id) ?? row) });
          } else {
            batch = createReportBatch({ entries: changed, declaredActor: { uid: t.uid, name: saved.actor.displayName } });
          }
          await reportStore.save(batch, { expectedRaw: snapshot.raw, confirmRevision: true });
          check(t);
          return { ...result, state: stateView(), projectionCurrent: true, localOnly: true, reportBatch: batch };
        });
      } finally {
        busy = false;
      }
    },
    isBusy: () => busy,
    canBackgroundRefresh: () => false,
    invalidateReads() {
    },
    subscribeInvalidation(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    assertBillingReady() {
      throw issue("BILLING_NOT_CONNECTED", "\u8ACB\u6C42\u5BFE\u8C61\u306E\u53D6\u5F97\u306F\u51FA\u529B\u64CD\u4F5C\u3067\u884C\u3044\u307E\u3059\u3002\u7AEF\u672B\u5185\u306E\u5831\u544A\u3060\u3051\u3067\u306F\u8ACB\u6C42\u66F8\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3002");
    },
    referenceView() {
      throw issue("FULL_SUMMARY_NOT_AVAILABLE", "\u7AEF\u672B\u5185\u306E\u5831\u544A\u306F\u5168\u4F53\u96C6\u8A08\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002");
    },
    pendingSettings: () => clone2(current().pendingSettings ?? null),
    dispose() {
      disposed = true;
      epoch++;
      activeController?.abort();
      saved = null;
      raw = null;
      off?.();
      listeners.clear();
    }
  };
  api.invoiceSettingsStore = { read: () => ({ raw: String(current().invoiceSettings.revision), settings: clone2(current().invoiceSettings), provenance: null }), getSettings: () => clone2(current().invoiceSettings), ...Object.fromEntries([["saveIssuer", "issuer"], ["saveBankAccounts", "bankAccounts"], ["saveTax", "tax"]].map(([method, section]) => [method, async (values, expected) => {
    if (busy) throw issue("BUSY");
    busy = true;
    const t = ticket();
    try {
      return await lock(t, async () => {
        readStored(t);
        if (Number(expected) !== saved.invoiceSettings.revision) throw issue("SETTINGS_CONFLICT");
        const invoiceSettings = { ...saved.invoiceSettings, [section]: clone2(values), revision: saved.invoiceSettings.revision + 1 };
        validateInvoiceSettings(invoiceSettings);
        await saveSettings(t, { ...saved, invoiceSettings });
        return api.invoiceSettingsStore.read();
      });
    } finally {
      busy = false;
    }
  }])) };
  return api;
}

// src/workspace-client.js
var startupStages = /* @__PURE__ */ new Set(["READ", "VALIDATE", "UI", "OUTPUT", "FINAL"]);
var startupErrors = /* @__PURE__ */ new WeakMap();
function markStartupFailure(error, stage) {
  if (error && (typeof error === "object" || typeof error === "function") && startupStages.has(stage) && !startupErrors.has(error)) startupErrors.set(error, stage);
  return error;
}

// src/workspace-recovery-ui.js
function appendWorkspaceRecovery({ element, adapter, reload } = {}) {
  if (!element || element.querySelector("[data-workspace-recovery]")) return;
  const doc = element.ownerDocument, button = doc.createElement("button"), status = doc.createElement("p");
  button.type = "button";
  button.className = "button secondary";
  button.dataset.workspaceRecovery = "true";
  button.textContent = "\u4FDD\u5B58\u7D50\u679C\u3092\u78BA\u8A8D";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const result = await adapter.recover();
      if (!element.isConnected) return;
      if (result.status === "committed") {
        status.textContent = "\u524D\u306E\u4FDD\u5B58\u304C\u5B8C\u4E86\u3057\u305F\u3053\u3068\u3092\u78BA\u8A8D\u3057\u307E\u3057\u305F\u3002\u5165\u529B\u3092\u63A7\u3048\u3066\u304B\u3089\u6700\u65B0\u5185\u5BB9\u3092\u8AAD\u307F\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
        const refresh = doc.createElement("button");
        refresh.type = "button";
        refresh.className = "button secondary";
        refresh.textContent = "\u6700\u65B0\u5185\u5BB9\u3092\u8AAD\u307F\u76F4\u3059";
        refresh.addEventListener("click", reload);
        status.append(refresh);
      } else status.textContent = result.status === "none" ? "\u672A\u78BA\u8A8D\u306E\u4FDD\u5B58\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u5165\u529B\u5185\u5BB9\u3068\u6700\u65B0\u306E\u8A18\u9332\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : "\u4FDD\u5B58\u306E\u5230\u7740\u3092\u307E\u3060\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u91CD\u8907\u3092\u907F\u3051\u308B\u305F\u3081\u65B0\u3057\u3044\u4FDD\u5B58\u306F\u884C\u3044\u307E\u305B\u3093\u3002\u6642\u9593\u3092\u304A\u3044\u3066\u518D\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
    } catch (error) {
      if (element.isConnected) status.textContent = error.message;
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
  element.append(button, status);
}

// src/browse-record-sync.js
function createBrowseRecordSync({ adapter, checkChanges, isEditing = () => false, isSaving = () => false, onApplied = () => {
}, onConfirmed = () => {
}, onError = () => {
}, setTimer = setTimeout, clearTimer = clearTimeout, random = Math.random, now = Date.now } = {}) {
  let context = { browse: false, visible: false, authorized: false }, epoch = 0, timer = null, running = false, disposed = false, queued = false, failures = 0, lastFull = now();
  const active = () => !disposed && context.browse && context.visible && context.authorized;
  const safe = () => active() && !isEditing() && !isSaving() && adapter.canBackgroundRefresh();
  const cancel = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  function schedule() {
    cancel();
    if (!active()) return;
    const delay = failures ? Math.min(18e4, 3e4 * 2 ** failures) : 27e3 + Math.floor(Math.max(0, Math.min(1, random())) * 3e3);
    timer = setTimer(() => {
      timer = null;
      void run();
    }, delay);
  }
  async function run() {
    if (!active()) return;
    if (running) {
      queued = true;
      return;
    }
    if (!safe()) {
      schedule();
      return;
    }
    running = true;
    const generation = epoch, valid = () => generation === epoch && safe();
    try {
      const cursor = adapter.watchCursor(), hint = await checkChanges({ cursor });
      if (!valid()) return;
      if (!hint || hint.ok !== true || hint.schemaVersion !== 1 || hint.authoritative !== false || typeof hint.changed !== "boolean" || !/^[a-f0-9]{64}$/.test(hint.cursor) || typeof hint.checkedAt !== "string" || !Number.isFinite(Date.parse(hint.checkedAt)) || !hint.changed && hint.cursor !== cursor) throw Error("\u66F4\u65B0\u78BA\u8A8D\u306E\u5F62\u5F0F\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
      if (hint.changed || now() - lastFull >= 3e5) {
        const staged = await adapter.prepareRefresh();
        if (!valid()) return;
        if (!staged.commitIfCurrent(valid)) return;
        lastFull = now();
        onApplied(adapter.read());
      }
      if (valid()) {
        failures = 0;
        onConfirmed();
      }
    } catch (error) {
      if (generation === epoch && active()) {
        failures++;
        onError(error);
      }
    } finally {
      running = false;
      if (queued) {
        queued = false;
        if (active()) {
          void run();
          return;
        }
      }
      schedule();
    }
  }
  return { setContext(next, { alreadyFresh = false } = {}) {
    const previous = active();
    const changed = Object.keys(next).some((key) => context[key] !== next[key]);
    context = { ...context, ...next };
    if (changed) {
      epoch++;
      cancel();
    }
    if (!active()) return;
    if (!previous || changed) {
      if (alreadyFresh) {
        lastFull = now();
        schedule();
      } else void run();
    }
  }, retry() {
    cancel();
    void run();
  }, notifyFresh() {
    lastFull = now();
    failures = 0;
    schedule();
  }, dispose() {
    disposed = true;
    epoch++;
    queued = false;
    cancel();
  } };
}

// src/modal-suspension.js
function createModalSuspension(doc) {
  let suspended = false, disposed = false, entries = [];
  return { suspend() {
    if (disposed || suspended) return;
    suspended = true;
    entries = [...doc.querySelectorAll("dialog")].map((dialog) => {
      const show = dialog.showModal, close = dialog.close, wasOpen = dialog.open, hidden = dialog.hidden;
      let wanted = wasOpen;
      if (wasOpen) close.call(dialog);
      dialog.hidden = true;
      dialog.showModal = function() {
        wanted = true;
      };
      dialog.close = function(...args) {
        wanted = false;
        return close.apply(dialog, args);
      };
      return { dialog, show, close, hidden, wanted: () => wanted };
    });
  }, resume() {
    if (disposed || !suspended) return;
    for (const entry2 of entries) {
      const { dialog, show, close, hidden } = entry2;
      dialog.showModal = show;
      dialog.close = close;
      dialog.hidden = hidden;
      if (entry2.wanted() && dialog.isConnected) show.call(dialog);
    }
    entries = [];
    suspended = false;
  }, dispose() {
    disposed = true;
    for (const { dialog, show, close } of entries) {
      dialog.showModal = show;
      dialog.close = close;
      dialog.hidden = true;
      if (dialog.open) close.call(dialog);
    }
    entries = [];
  }, get suspended() {
    return suspended;
  } };
}

// src/reports-client.js
var ReportsError = class extends Error {
  constructor(code, uncertain = false) {
    super(code);
    this.code = code;
    this.uncertain = uncertain;
  }
};
var fail2 = (code, uncertain = false) => {
  throw new ReportsError(code, uncertain);
};
var uuid2 = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function normalizeFields2(value) {
  if (!value || typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(Date.parse(value.date + "T00:00:00Z")) || (/* @__PURE__ */ new Date(value.date + "T00:00:00Z")).toISOString().slice(0, 10) !== value.date) fail2("BAD_REQUEST");
  const str2 = (v, max) => {
    if (typeof v !== "string" || v.length > max) fail2("BAD_REQUEST");
    return v.trim();
  };
  const num2 = (v) => {
    if (v === null) return null;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e9 || Math.abs(v * 1e6 - Math.round(v * 1e6)) > 1e-4) fail2("BAD_REQUEST");
    return v;
  };
  const result = { date: value.date, customerName: str2(value.customerName, 120), combustibleKg: num2(value.combustibleKg), noncombustibleKg: num2(value.noncombustibleKg), otherItem: str2(value.otherItem, 500), otherFee: num2(value.otherFee) };
  if (!result.customerName || result.combustibleKg === null && result.noncombustibleKg === null && result.otherFee === null && !result.otherItem) fail2("BAD_REQUEST");
  return result;
}
function normalizeReports(value) {
  if (!value || !Array.isArray(value.records) || value.records.length > 1e4 || !Array.isArray(value.conflicts) || typeof value.totalsBlocked !== "boolean" || typeof value.projectionCurrent !== "boolean" || typeof value.publicationPending !== "boolean") fail2("INVALID_RESPONSE");
  if (value.ok !== true && !(value.ok === false && value.totalsBlocked && value.conflicts.length)) fail2("INVALID_RESPONSE");
  if (value.ok && (!Array.isArray(value.customerNames) || value.customerNames.some((n) => typeof n !== "string" || n.length > 120))) fail2("INVALID_RESPONSE");
  const ids = /* @__PURE__ */ new Set();
  const records = value.records.map((r) => {
    if (!r || !uuid2(r.id) || ids.has(r.id) || !Number.isSafeInteger(r.revision) || r.revision < 1 || typeof r.deleted !== "boolean" || typeof r.fingerprint !== "string" || !r.fingerprint || r.fingerprint.length > 256) fail2("INVALID_RESPONSE");
    ids.add(r.id);
    let fields2;
    try {
      fields2 = normalizeFields2(r.fields);
    } catch {
      fail2("INVALID_RESPONSE");
    }
    return { id: r.id, revision: r.revision, deleted: r.deleted, fingerprint: r.fingerprint, fields: fields2 };
  });
  return { records, customerNames: value.customerNames || [], blocked: value.totalsBlocked || value.conflicts.length > 0, projectionCurrent: value.projectionCurrent, publicationPending: value.publicationPending };
}
function makeChange(action, record, fields2, operationId = globalThis.crypto.randomUUID()) {
  if (!uuid2(operationId) || !["create", "update", "delete", "restore"].includes(action)) fail2("BAD_REQUEST");
  const change = { operationId, action };
  if (action !== "create") {
    if (!record || !uuid2(record.id) || !Number.isSafeInteger(record.revision) || typeof record.fingerprint !== "string") fail2("BAD_REQUEST");
    Object.assign(change, { recordId: record.id, expectedRevision: record.revision, expectedFingerprint: record.fingerprint });
  }
  if (action === "create" || action === "update") change.fields = Object.freeze(normalizeFields2(fields2));
  return Object.freeze(change);
}
function createReportsClient({ endpoint, getIdToken, fetchImpl = fetch, timeoutMs = 3e4 }) {
  const url = new URL(endpoint);
  if (url.origin !== "https://script.google.com" || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) || url.search || url.hash || typeof getIdToken !== "function" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw Error("Invalid reports configuration");
  async function request(action, change, { signal } = {}) {
    const writing = action === "reports.change";
    if (signal?.aborted) fail2("ABORTED");
    let token, authTimer, authAbort;
    try {
      const interrupted = new Promise((resolve, reject) => {
        authTimer = setTimeout(() => reject(Object.assign(new ReportsError("AUTH_TIMEOUT"), { retainPending: true })), timeoutMs);
        authAbort = () => reject(new ReportsError("ABORTED"));
        signal?.addEventListener("abort", authAbort, { once: true });
      });
      token = await Promise.race([Promise.resolve().then(() => getIdToken(true)), interrupted]);
    } catch (error) {
      if (error instanceof ReportsError) throw error;
      fail2("LOGIN_REQUIRED");
    } finally {
      clearTimeout(authTimer);
      signal?.removeEventListener("abort", authAbort);
    }
    if (typeof token !== "string" || !token) fail2("LOGIN_REQUIRED");
    if (signal?.aborted) fail2("ABORTED");
    const controller = new AbortController(), abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetchImpl(url.href, { method: "POST", mode: "cors", credentials: "omit", redirect: "follow", cache: "no-store", headers: { "Content-Type": "text/plain;charset=UTF-8" }, signal: controller.signal, body: JSON.stringify({ action, idToken: token, ...writing ? { change } : {} }) });
      if (!response.ok || response.type === "opaque") fail2("TRANSPORT_FAILED", writing);
      const value = await response.json();
      if (value?.ok === false && typeof value.error === "string") {
        const rejected = ["BAD_REQUEST", "UNAUTHENTICATED", "FORBIDDEN", "AUTH_UNAVAILABLE", "BUSY", "CONFLICT", "NOT_FOUND", "SOURCE_CONFLICT", "SOURCE_CHANGED", "SOURCE_ID_INVALID", "CUSTOMER_CHANGED", "DUPLICATE", "IDEMPOTENCY_CONFLICT", "ID_CONFLICT", "ROSTER_NOT_CONFIGURED", "ROSTER_INVALID"];
        fail2(value.error, writing && !rejected.includes(value.error));
      }
      if (!writing) return normalizeReports(value);
      if (value?.ok !== true || value.committed !== true || typeof value.projectionCurrent !== "boolean" || typeof value.publicationPending !== "boolean") fail2("INVALID_RESPONSE", true);
      return { committed: true, projectionCurrent: value.projectionCurrent, publicationPending: value.publicationPending };
    } catch (error) {
      if (error instanceof ReportsError) throw error;
      fail2("TRANSPORT_FAILED", writing);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  return { readPage: (options) => request("reports.read", null, options), change: (input, options) => request("reports.change", input, options) };
}

// src/reports-pending.js
var PENDING_PREFIX = "routenote.reports.pending.v1.";
var fail3 = () => {
  throw new Error("PENDING_STORAGE_UNAVAILABLE");
};
var keys2 = (value, allowed) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === allowed.length && allowed.every((k) => Object.hasOwn(value, k));
function validate2(input) {
  const action = input?.action;
  const allowed = ["operationId", "action", ...action === "create" ? [] : ["recordId", "expectedRevision", "expectedFingerprint"], ...["create", "update"].includes(action) ? ["fields"] : []];
  if (!keys2(input, allowed)) fail3();
  if (action !== "create" && (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || typeof input.expectedFingerprint !== "string" || !input.expectedFingerprint || input.expectedFingerprint.length > 256)) fail3();
  if (["create", "update"].includes(action) && !keys2(input.fields, ["date", "customerName", "combustibleKg", "noncombustibleKg", "otherItem", "otherFee"])) fail3();
  const copy2 = makeChange(action, action === "create" ? null : { id: input.recordId, revision: input.expectedRevision, fingerprint: input.expectedFingerprint }, input.fields, input.operationId);
  for (const k of allowed) {
    if (k === "fields") {
      for (const f of Object.keys(copy2.fields)) if (copy2.fields[f] !== input.fields[f]) fail3();
    } else if (copy2[k] !== input[k]) fail3();
  }
  return copy2;
}
function createPendingStore(getStorage, getLocks = () => globalThis.navigator?.locks) {
  const key = (uid2) => {
    if (typeof uid2 !== "string" || !uid2 || uid2.length > 256) fail3();
    return PENDING_PREFIX + encodeURIComponent(uid2);
  };
  function read(uid2) {
    try {
      const raw = getStorage().getItem(key(uid2));
      if (raw === null) return null;
      if (typeof raw !== "string" || raw.length > 1e4) fail3();
      const value = JSON.parse(raw);
      if (!keys2(value, ["version", "uid", "input"]) || value.version !== 1 || value.uid !== uid2) fail3();
      return validate2(value.input);
    } catch {
      fail3();
    }
  }
  async function exclusive(uid2, operation) {
    const name = key(uid2) + ".lock";
    try {
      const locks = getLocks();
      if (typeof locks?.request !== "function") fail3();
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 1e4);
      try {
        return await locks.request(name, { mode: "exclusive", signal: controller.signal }, (lock) => {
          if (!lock) fail3();
          return operation();
        });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      fail3();
    }
  }
  function probe(uid2) {
    try {
      const storage = getStorage(), k = key(uid2) + ".probe";
      storage.setItem(k, "1");
      if (storage.getItem(k) !== "1") fail3();
      storage.removeItem(k);
    } catch {
      fail3();
    }
  }
  return {
    read: (uid2) => exclusive(uid2, () => read(uid2)),
    probe: (uid2) => exclusive(uid2, () => probe(uid2)),
    inspect: (uid2) => exclusive(uid2, () => {
      probe(uid2);
      return read(uid2);
    }),
    save(uid2, input) {
      return exclusive(uid2, () => {
        try {
          const copy2 = validate2(input), existing = read(uid2);
          if (existing && JSON.stringify(existing) !== JSON.stringify(copy2)) fail3();
          const raw = JSON.stringify({ version: 1, uid: uid2, input: copy2 }), storage = getStorage();
          storage.setItem(key(uid2), raw);
          if (storage.getItem(key(uid2)) !== raw) fail3();
        } catch {
          fail3();
        }
      });
    },
    remove(uid2, input) {
      return exclusive(uid2, () => {
        try {
          const existing = read(uid2);
          if (existing && JSON.stringify(existing) !== JSON.stringify(validate2(input))) fail3();
          const storage = getStorage();
          storage.removeItem(key(uid2));
          if (storage.getItem(key(uid2)) !== null) fail3();
        } catch {
          fail3();
        }
      });
    }
  };
}

// src/ledger-panel.js
var ERROR_MESSAGES = Object.freeze({
  LOGIN_REQUIRED: "Google\u30ED\u30B0\u30A4\u30F3\u3092\u78BA\u8A8D\u3057\u3066\u304B\u3089\u3001\u3082\u3046\u4E00\u5EA6\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002",
  UNAUTHENTICATED: "Google\u30ED\u30B0\u30A4\u30F3\u3092\u78BA\u8A8D\u3057\u3066\u304B\u3089\u3001\u3082\u3046\u4E00\u5EA6\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002",
  FORBIDDEN: "\u3053\u306E\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u3092\u95B2\u89A7\u3059\u308B\u6A29\u9650\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
  AUTH_UNAVAILABLE: "\u95B2\u89A7\u6A29\u9650\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u63A5\u7D9A\u3092\u78BA\u8A8D\u3057\u3066\u3001\u3082\u3046\u4E00\u5EA6\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002",
  SOURCE_CHANGED: "\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u306E\u5F62\u5F0F\u304C\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u3059\u3002\u7BA1\u7406\u8005\u306B\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  SOURCE_LIMIT: "\u53D6\u5F97\u3067\u304D\u308B\u884C\u6570\u306E\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\u3002\u7BA1\u7406\u8005\u306B\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  INVALID_RESPONSE: "\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u306E\u5FDC\u7B54\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\u3002",
  TIMEOUT: "\u8AAD\u307F\u8FBC\u307F\u306B\u6642\u9593\u304C\u304B\u304B\u3063\u3066\u3044\u307E\u3059\u3002\u63A5\u7D9A\u3092\u78BA\u8A8D\u3057\u3066\u3001\u3082\u3046\u4E00\u5EA6\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\u3002"
});
var numberFormat = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 10 });
function formatLedgerNumber(value, unit) {
  return value === null ? "\u2014" : `${numberFormat.format(value)}${unit === "\u5186" ? "" : " "}${unit}`;
}

// src/reports-panel.js
var AUTH = /* @__PURE__ */ new Set(["LOGIN_REQUIRED", "UNAUTHENTICATED", "FORBIDDEN", "AUTH_UNAVAILABLE"]);
var ERRORS = {
  CONFLICT: "\u5225\u306E\u5909\u66F4\u304C\u3042\u308A\u307E\u3059\u3002\u518D\u8AAD\u8FBC\u3057\u3066\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3001\u6539\u3081\u3066\u7DE8\u96C6\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  SOURCE_CONFLICT: "\u5143\u30C7\u30FC\u30BF\u3068\u8A02\u6B63\u304C\u7AF6\u5408\u3057\u3066\u3044\u307E\u3059\u3002\u7BA1\u7406\u8005\u306E\u78BA\u8A8D\u304C\u5FC5\u8981\u3067\u3059\u3002",
  CUSTOMER_CHANGED: "\u53D6\u5F15\u5148\u304C\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u3059\u3002\u518D\u8AAD\u8FBC\u3057\u3066\u9078\u3073\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  DUPLICATE: "\u540C\u3058\u65E5\u4ED8\u30FB\u53D6\u5F15\u5148\u306E\u8A18\u9332\u304C\u3042\u308A\u307E\u3059\u3002\u65E2\u5B58\u306E\u8A18\u9332\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  BAD_REQUEST: "\u65E5\u4ED8\u30FB\u53D6\u5F15\u5148\u3068\u3001\u91CD\u91CF\u307E\u305F\u306F\u5099\u8003\u30FB\u305D\u306E\u4ED6\u91D1\u984D\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u6570\u5024\u306F0\u4EE5\u4E0A\u3001\u5C0F\u65706\u6841\u307E\u3067\u3067\u3059\u3002",
  IDEMPOTENCY_CONFLICT: "\u540C\u3058\u64CD\u4F5C\u306E\u5185\u5BB9\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093\u3002\u7BA1\u7406\u8005\u306B\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
};
function installReportsPanel({ host, readPage, change, uuid: uuid3 = () => globalThis.crypto.randomUUID(), pageSize = 30, getStorage, getLocks }) {
  const doc = host.ownerDocument, view = doc.defaultView;
  let visible = false, authorized = false, disposed = false, identity2 = null, sequence = 0;
  let snapshot = null, controller = null, reading = null, status = "locked", month2 = "", trash = false, page = 0;
  let editor = null, returnFocus = null, storageError2 = false;
  const pendingStore = createPendingStore(getStorage || (() => view.localStorage), getLocks || (() => view.navigator.locks));
  const operations2 = /* @__PURE__ */ new Map();
  const listeners = [];
  const el = (tag, cls, text3) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text3 !== void 0) n.textContent = text3;
    return n;
  };
  const button = (text3, action, fn) => {
    const b = el("button", "rn-ledger-button", text3);
    b.type = "button";
    b.dataset.action = action;
    if (fn) b.addEventListener("click", fn);
    return b;
  };
  const on = (target, event, fn) => {
    target.addEventListener(event, fn);
    listeners.push(() => target.removeEventListener(event, fn));
  };
  const root2 = el("section", "rn-ledger");
  root2.setAttribute("aria-label", "\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u306E\u8A18\u9332");
  const heading = el("div", "rn-ledger-heading");
  heading.append(el("h2", "rn-ledger-title", "\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u306E\u8A18\u9332"));
  const notice2 = el("p", "rn-ledger-notice", "\u5143\u306E\u884C\u306F\u6B8B\u3057\u3001\u8A02\u6B63\u30FB\u8FFD\u52A0\u30FB\u524A\u9664\u30FB\u5FA9\u5143\u3092\u5225\u306E\u5C65\u6B74\u306B\u4FDD\u5B58\u3057\u307E\u3059\u3002\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306E\u8A66\u4F5C\u30C7\u30FC\u30BF\u3084\u8A2D\u5B9A\u306F\u9001\u4FE1\u3057\u307E\u305B\u3093\u3002");
  const toolbar = el("div", "rn-ledger-toolbar");
  const refreshButton = button("\u518D\u8AAD\u8FBC", "refresh", () => void refresh());
  const createButton = button("\u8A18\u9332\u3092\u8FFD\u52A0", "create", () => openEditor("create"));
  const trashButton = button("\u524A\u9664\u6E08\u307F\u3092\u8868\u793A", "trash", () => {
    trash = !trash;
    page = 0;
    render();
  });
  const monthSelect = el("select", "rn-ledger-month");
  monthSelect.setAttribute("aria-label", "\u5BFE\u8C61\u6708");
  toolbar.append(monthSelect, refreshButton, createButton, trashButton);
  const message = el("p", "rn-ledger-status");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  const warning = el("p", "rn-ledger-warning");
  const storageWarning = el("p", "rn-ledger-warning");
  storageWarning.setAttribute("role", "alert");
  const recovery = el("div", "rn-reports-recovery");
  const recoveryText = el("p", "", "\u7D50\u679C\u672A\u78BA\u8A8D\u306E\u64CD\u4F5C\u304C\u3042\u308A\u307E\u3059\u3002\u65B0\u3057\u3044\u64CD\u4F5C\u306F\u505C\u6B62\u3057\u3066\u3044\u307E\u3059\u3002\u300C\u518D\u8AAD\u8FBC\u300D\u3067\u73FE\u72B6\u3092\u78BA\u8A8D\u3067\u304D\u307E\u3059\u304C\u3001\u4FDD\u5B58\u7D50\u679C\u306E\u78BA\u5B9A\u306B\u306F\u540C\u3058\u64CD\u4F5C\u306E\u78BA\u8A8D\u30FB\u518D\u9001\u304C\u5FC5\u8981\u3067\u3059\u3002");
  const retry = button("\u540C\u3058\u64CD\u4F5C\u3092\u78BA\u8A8D\u30FB\u518D\u9001", "retry-change", () => void submit(operations2.get(identity2)));
  recovery.append(recoveryText, retry);
  const list = el("div", "rn-ledger-list");
  list.setAttribute("role", "list");
  const nav = el("nav", "rn-ledger-pagination");
  const prev = button("\u524D\u3078", "previous", () => {
    page--;
    render();
  });
  const next = button("\u6B21\u3078", "next", () => {
    page++;
    render();
  });
  const pageText = el("span", "rn-ledger-page");
  nav.append(prev, pageText, next);
  root2.append(heading, notice2, toolbar, message, warning, storageWarning, recovery, list, nav, el("p", "rn-ledger-footnote", "\u7A7A\u6B04\u30680\u306F\u533A\u5225\u3057\u307E\u3059\u3002\u5B9F\u30C7\u30FC\u30BF\u306E\u5358\u4FA1\u30FB\u8ACB\u6C42\u984D\u30FB\u7A0E\u984D\u306F\u8A08\u7B97\u3057\u307E\u305B\u3093\u3002\u753B\u9762\u3092\u96E2\u308C\u308B\u3068\u8868\u793A\u3092\u6D88\u53BB\u3057\u307E\u3059\u3002\u7D50\u679C\u672A\u78BA\u8A8D\u306E\u64CD\u4F5C\u5185\u5BB9\u306F\u3001\u3053\u306E\u7AEF\u672B\u306B\u4E00\u6642\u4FDD\u5B58\u3057\u3001\u540C\u3058Google\u30A2\u30AB\u30A6\u30F3\u30C8\u3067\u5FA9\u65E7\u3057\u307E\u3059\u3002\u5171\u6709\u7AEF\u672B\u3067\u306F\u6CE8\u610F\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u30D6\u30E9\u30A6\u30B6\u30C7\u30FC\u30BF\u3092\u524A\u9664\u3057\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002"));
  const dialog = el("dialog", "rn-reports-dialog");
  dialog.setAttribute("aria-label", "\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u306E\u8A18\u9332\u3092\u5909\u66F4");
  host.replaceChildren(root2, dialog);
  host.hidden = true;
  const pending = () => operations2.get(identity2);
  const busy = () => status === "loading" || pending()?.state === "sending";
  const editable = () => authorized && visible && snapshot && !snapshot.blocked && !storageError2 && !pending() && !busy();
  const currentRows = () => (snapshot?.records || []).filter((r) => r.deleted === trash && (!month2 || r.fields.date.slice(0, 7) === month2));
  function closeEditor() {
    editor = null;
    if (dialog.open) dialog.close();
    dialog.replaceChildren();
    if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  }
  function clear() {
    sequence++;
    controller?.abort();
    controller = null;
    reading = null;
    snapshot = null;
    month2 = "";
    page = 0;
    closeEditor();
    list.replaceChildren();
    warning.textContent = "";
    message.textContent = "";
  }
  function controls() {
    storageWarning.textContent = storageError2 ? "\u78BA\u8A8D\u7528\u306E\u64CD\u4F5C\u3092\u3053\u306E\u7AEF\u672B\u306B\u5B89\u5168\u306B\u4FDD\u5B58\u30FB\u8AAD\u8FBC\u3067\u304D\u306A\u3044\u305F\u3081\u3001\u66F8\u304D\u8FBC\u307F\u3092\u505C\u6B62\u3057\u3066\u3044\u307E\u3059\u3002\u30D6\u30E9\u30A6\u30B6\u30C7\u30FC\u30BF\u306F\u524A\u9664\u305B\u305A\u3001\u4FDD\u5B58\u8A2D\u5B9A\u3068Web Locks\u5BFE\u5FDC\u30D6\u30E9\u30A6\u30B6\u3092\u78BA\u8A8D\u3057\u3066\u518D\u8AAD\u8FBC\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u7834\u640D\u304C\u3042\u308B\u5834\u5408\u306F\u7BA1\u7406\u8005\u306B\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : "";
    root2.dataset.state = status;
    root2.setAttribute("aria-busy", String(busy()));
    refreshButton.disabled = !authorized || busy();
    createButton.disabled = !editable();
    trashButton.disabled = !snapshot || busy();
    monthSelect.disabled = !snapshot || busy();
    trashButton.textContent = trash ? "\u901A\u5E38\u306E\u8A18\u9332\u3092\u8868\u793A" : "\u524A\u9664\u6E08\u307F\u3092\u8868\u793A";
    trashButton.setAttribute("aria-pressed", String(trash));
    recovery.hidden = !authorized || !pending();
    retry.disabled = !authorized || storageError2 || busy() || pending()?.state !== "uncertain";
    recoveryText.textContent = pending()?.state === "sending" ? "\u4FDD\u5B58\u7D50\u679C\u3092\u78BA\u8A8D\u3057\u3066\u3044\u307E\u3059\u3002\u91CD\u8907\u9001\u4FE1\u3092\u9632\u3050\u305F\u3081\u3001\u64CD\u4F5C\u3092\u505C\u6B62\u3057\u3066\u3044\u307E\u3059\u3002" : "\u7D50\u679C\u672A\u78BA\u8A8D\u306E\u64CD\u4F5C\u304C\u3042\u308A\u307E\u3059\u3002\u518D\u8AAD\u8FBC\u306F\u73FE\u72B6\u306E\u78BA\u8A8D\u306E\u307F\u3067\u3059\u3002\u540C\u3058\u64CD\u4F5C\u306E\u78BA\u8A8D\u30FB\u518D\u9001\u3067\u4FDD\u5B58\u7D50\u679C\u3092\u78BA\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u64CD\u4F5C\u5185\u5BB9\u306F\u3053\u306E\u7AEF\u672B\u306B\u4E00\u6642\u4FDD\u5B58\u3057\u3066\u3044\u307E\u3059\u3002\u540C\u3058Google\u30A2\u30AB\u30A6\u30F3\u30C8\u3067\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
    const count = currentRows().length;
    nav.hidden = !snapshot || count <= pageSize;
    prev.disabled = busy() || page === 0;
    next.disabled = busy() || (page + 1) * pageSize >= count;
  }
  function render() {
    monthSelect.replaceChildren();
    const all = el("option", "", "\u3059\u3079\u3066\u306E\u6708");
    all.value = "";
    monthSelect.append(all);
    for (const m of [...new Set((snapshot?.records || []).map((r) => r.fields.date.slice(0, 7)))].sort().reverse()) {
      const o = el("option", "", m);
      o.value = m;
      monthSelect.append(o);
    }
    monthSelect.value = month2;
    list.replaceChildren();
    const rows = currentRows();
    page = Math.min(Math.max(page, 0), Math.max(0, Math.ceil(rows.length / pageSize) - 1));
    for (const row of rows.slice(page * pageSize, (page + 1) * pageSize)) {
      const f = row.fields, card = el("article", "rn-ledger-card");
      card.setAttribute("role", "listitem");
      card.append(el("time", "rn-ledger-date", f.date), el("h3", "rn-ledger-customer", f.customerName));
      const metrics = el("dl", "rn-ledger-metrics");
      for (const [label, value] of [["\u53EF\u71C3", formatLedgerNumber(f.combustibleKg, "kg")], ["\u4E0D\u71C3", formatLedgerNumber(f.noncombustibleKg, "kg")], ["\u5099\u8003", f.otherItem || "\u2014"], ["\u305D\u306E\u4ED6", formatLedgerNumber(f.otherFee, "\u5186")]]) {
        const item = el("div", "rn-ledger-metric");
        item.append(el("dt", "", label), el("dd", "", value));
        metrics.append(item);
      }
      card.append(metrics);
      const actions = el("div", "rn-ledger-toolbar");
      for (const [action, label] of row.deleted ? [["restore", "\u5FA9\u5143"]] : [["update", "\u7DE8\u96C6"], ["delete", "\u524A\u9664"]]) {
        const b = button(label, action, () => openEditor(action, row));
        b.disabled = !editable();
        actions.append(b);
      }
      card.append(actions);
      list.append(card);
    }
    pageText.textContent = `${page + 1} / ${Math.max(1, Math.ceil(rows.length / pageSize))}`;
    warning.textContent = snapshot?.blocked ? "\u7AF6\u5408\u304C\u3042\u308B\u305F\u3081\u7DE8\u96C6\u30FB\u96C6\u8A08\u3092\u505C\u6B62\u3057\u3066\u3044\u307E\u3059\u3002\u7BA1\u7406\u8005\u306B\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : snapshot && (!snapshot.projectionCurrent || snapshot.publicationPending) ? "\u5B9F\u52B9\u65E5\u6B21\u30C7\u30FC\u30BF\u3078\u306E\u53CD\u6620\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u96C6\u8A08\u306B\u306F\u4F7F\u308F\u305A\u3001\u518D\u8AAD\u8FBC\u3067\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : snapshot ? "\u8AAD\u8FBC\u6642\u70B9\u306E\u5B9F\u52B9\u65E5\u6B21\u30C7\u30FC\u30BF\u3078\u306E\u53CD\u6620\u3092\u78BA\u8A8D\u3057\u307E\u3057\u305F\u3002\u8ACB\u6C42\u984D\u306E\u78BA\u8A8D\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002" : "";
    controls();
  }
  async function refresh() {
    if (disposed || !visible || !authorized || doc.visibilityState === "hidden" || pending()?.state === "sending") return false;
    if (reading) return reading;
    closeEditor();
    snapshot = null;
    status = "loading";
    message.textContent = "\u5B9F\u30C7\u30FC\u30BF\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026";
    render();
    const ticket = ++sequence;
    controller?.abort();
    const ctrl = new AbortController();
    controller = ctrl;
    reading = Promise.resolve().then(() => readPage({ signal: ctrl.signal })).then((result) => {
      if (disposed || !visible || !authorized || ticket !== sequence) return false;
      snapshot = result;
      status = "ready";
      message.textContent = result.blocked ? "\u5143\u30C7\u30FC\u30BF\u3068\u8A02\u6B63\u5C65\u6B74\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : `\u53D6\u5F97\u3057\u305F\u8A18\u9332 ${result.records.length}\u4EF6`;
      render();
      return true;
    }).catch((error) => {
      if (ticket !== sequence) return false;
      snapshot = null;
      status = "error";
      if (AUTH.has(error?.code)) {
        authorized = false;
        identity2 = null;
        operations2.clear();
        status = "locked";
        message.textContent = "Google\u30ED\u30B0\u30A4\u30F3\u3068\u767B\u9332\u30E1\u30F3\u30D0\u30FC\u6A29\u9650\u3092\u78BA\u8A8D\u3057\u3001\u3082\u3046\u4E00\u5EA6\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002";
      } else message.textContent = ERRORS[error?.code] || "\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u63A5\u7D9A\u30FB\u30B5\u30FC\u30D0\u30FC\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u518D\u8AAD\u8FBC\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      render();
      return false;
    }).finally(() => {
      if (ticket === sequence) {
        reading = null;
        controller = null;
        controls();
      }
    });
    return reading;
  }
  function openEditor(action, row) {
    if (!editable()) return;
    closeEditor();
    returnFocus = doc.activeElement;
    editor = { action, row };
    const form = el("form", "rn-reports-form"), title = el("h3", "", { create: "\u8A18\u9332\u3092\u8FFD\u52A0", update: "\u8A18\u9332\u3092\u7DE8\u96C6", delete: "\u3053\u306E\u8A18\u9332\u3092\u524A\u9664", restore: "\u3053\u306E\u8A18\u9332\u3092\u5FA9\u5143" }[action]);
    const error = el("p", "rn-ledger-warning");
    error.setAttribute("role", "alert");
    const fields2 = {};
    form.append(title);
    if (action === "create" || action === "update") {
      for (const [name, label, type] of [["date", "\u65E5\u4ED8", "date"], ["customerName", "\u53D6\u5F15\u5148", "select"], ["combustibleKg", "\u53EF\u71C3 kg", "number"], ["noncombustibleKg", "\u4E0D\u71C3 kg", "number"], ["otherItem", "\u5099\u8003", "text"], ["otherFee", "\u305D\u306E\u4ED6 \u5186", "number"]]) {
        const wrap2 = el("label", "field"), input = el(type === "select" ? "select" : "input");
        input.name = name;
        if (type === "select") {
          const empty = el("option", "", "\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
          empty.value = "";
          input.append(empty);
          for (const n of snapshot.customerNames) {
            const o = el("option", "", n);
            o.value = n;
            input.append(o);
          }
        } else input.type = type;
        if (type === "number") {
          input.min = "0";
          input.max = "1000000000";
          input.step = "0.000001";
          input.inputMode = "decimal";
        }
        if (type === "text") input.maxLength = 500;
        if (name === "date" || name === "customerName") input.required = true;
        input.value = row?.fields[name] ?? "";
        fields2[name] = input;
        wrap2.append(el("span", "", label), input);
        form.append(wrap2);
      }
    } else form.append(el("p", "", `${row.fields.date} / ${row.fields.customerName}`), el("p", "", action === "delete" ? "\u5143\u306E\u884C\u3068\u5C65\u6B74\u306F\u6B8B\u308A\u307E\u3059\u3002\u5B9F\u52B9\u30C7\u30FC\u30BF\u304B\u3089\u9664\u5916\u3057\u307E\u3059\u3002" : "\u8A18\u9332\u3092\u5B9F\u52B9\u30C7\u30FC\u30BF\u3078\u623B\u3057\u307E\u3059\u3002"));
    form.append(error);
    const footer = el("div", "rn-ledger-toolbar"), cancel = button("\u30AD\u30E3\u30F3\u30BB\u30EB", "cancel", closeEditor), save = button("\u78BA\u5B9A\u3057\u3066\u4FDD\u5B58", "save");
    save.type = "submit";
    footer.append(cancel, save);
    form.append(footer);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!editor || !editable()) return;
      try {
        let values;
        if (action === "create" || action === "update") {
          values = Object.fromEntries(Object.entries(fields2).map(([name, input2]) => [name, input2.type === "number" ? input2.value.trim() === "" ? null : Number(input2.value) : input2.value]));
          values = normalizeFields2(values);
        }
        const input = makeChange(action, row, values, uuid3());
        const operation = { input, uid: identity2, state: "new" };
        operations2.set(identity2, operation);
        closeEditor();
        void submit(operation);
      } catch {
        error.textContent = ERRORS.BAD_REQUEST;
      }
    });
    dialog.append(form);
    dialog.showModal();
    form.querySelector("input,select,button")?.focus();
  }
  async function submit(operation) {
    if (!operation || operation.uid !== identity2 || storageError2 || !authorized || !visible || operation.state === "sending" || operations2.get(identity2) !== operation) return;
    const uid2 = identity2, ticket = sequence;
    operation.state = "sending";
    message.textContent = "\u4FDD\u5B58\u7D50\u679C\u3092\u78BA\u8A8D\u3057\u3066\u3044\u307E\u3059\u2026";
    render();
    try {
      await pendingStore.save(uid2, operation.input);
    } catch {
      operation.state = "uncertain";
      if (!disposed && identity2 === uid2 && ticket === sequence) {
        storageError2 = true;
        render();
      }
      return;
    }
    if (disposed || !visible || !authorized || identity2 !== uid2 || ticket !== sequence || operations2.get(uid2) !== operation) {
      operation.state = "uncertain";
      if (!disposed && identity2 === uid2) render();
      return;
    }
    try {
      const result = await change(operation.input, { expectedUid: uid2 });
      if (result?.committed !== true) throw Object.assign(Error("Unknown"), { uncertain: true });
      await pendingStore.remove(uid2, operation.input);
      if (operations2.get(uid2) === operation) operations2.delete(uid2);
      if (!disposed && visible && authorized && identity2 === uid2) {
        await refresh();
        if (visible && authorized && identity2 === uid2) {
          message.textContent = result.projectionCurrent && !result.publicationPending ? "\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002\u73FE\u5728\u306E\u53CD\u6620\u72B6\u6CC1\u306F\u4E0B\u306E\u8868\u793A\u3067\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : "\u8A02\u6B63\u5C65\u6B74\u306F\u4FDD\u5B58\u6E08\u307F\u3067\u3059\u3002\u5B9F\u52B9\u65E5\u6B21\u30C7\u30FC\u30BF\u3078\u306E\u53CD\u6620\u306F\u672A\u78BA\u8A8D\u3067\u3059\u3002\u518D\u8AAD\u8FBC\u3067\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
          controls();
        }
      }
    } catch (error) {
      if (error?.uncertain !== false || error?.retainPending || operation.everUncertain) {
        operation.state = "uncertain";
        operation.everUncertain = true;
      } else {
        try {
          await pendingStore.remove(uid2, operation.input);
          if (operations2.get(uid2) === operation) operations2.delete(uid2);
        } catch {
          operation.state = "uncertain";
          operation.everUncertain = true;
          if (identity2 === uid2) storageError2 = true;
        }
      }
      if (error?.message === "PENDING_STORAGE_UNAVAILABLE" && identity2 === uid2) storageError2 = true;
      if (!disposed && visible && authorized && identity2 === uid2) {
        snapshot = null;
        status = "error";
        if (AUTH.has(error?.code)) {
          authorized = false;
          identity2 = null;
          operations2.clear();
          closeEditor();
          message.textContent = "Google\u30ED\u30B0\u30A4\u30F3\u3068\u6A29\u9650\u3092\u78BA\u8A8D\u3057\u3001\u3082\u3046\u4E00\u5EA6\u958B\u3044\u3066\u304F\u3060\u3055\u3044\u3002";
        } else message.textContent = error?.code === "AUTH_TIMEOUT" ? "\u8A8D\u8A3C\u306E\u78BA\u8A8D\u304C\u6642\u9593\u5207\u308C\u306B\u306A\u308A\u3001\u4ECA\u56DE\u306F\u9001\u4FE1\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u540C\u3058\u64CD\u4F5C\u306E\u78BA\u8A8D\u30FB\u518D\u9001\u3067\u7D9A\u3051\u3089\u308C\u307E\u3059\u3002" : operation.state === "uncertain" ? "\u4FDD\u5B58\u7D50\u679C\u304C\u672A\u78BA\u8A8D\u3067\u3059\u3002\u81EA\u52D5\u518D\u9001\u306F\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u4E0B\u306E\u30DC\u30BF\u30F3\u3067\u540C\u3058\u64CD\u4F5C\u3092\u78BA\u8A8D\u30FB\u518D\u9001\u3067\u304D\u307E\u3059\u3002" : ERRORS[error?.code] || "\u4FDD\u5B58\u306F\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u518D\u8AAD\u8FBC\u3057\u3066\u304B\u3089\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
        render();
      }
    }
  }
  on(monthSelect, "change", () => {
    month2 = monthSelect.value;
    page = 0;
    render();
  });
  on(dialog, "cancel", () => closeEditor());
  const suspend = () => {
    clear();
    status = authorized ? "idle" : "locked";
    render();
  };
  on(doc, "visibilitychange", () => {
    if (doc.visibilityState === "hidden") suspend();
  });
  on(view, "pagehide", suspend);
  on(view, "beforeunload", (event) => {
    if (operations2.size) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  render();
  return {
    async setIdentity(uid2) {
      if (identity2 !== uid2) {
        operations2.clear();
        identity2 = uid2;
        snapshot = null;
        closeEditor();
        list.replaceChildren();
        warning.textContent = "";
      }
      const ticket = sequence;
      storageError2 = true;
      controls();
      try {
        const stored = await pendingStore.inspect(uid2);
        if (disposed || identity2 !== uid2 || ticket !== sequence || !authorized) return;
        storageError2 = false;
        if (stored && (!operations2.has(uid2) || JSON.stringify(operations2.get(uid2).input) !== JSON.stringify(stored))) operations2.set(uid2, { input: stored, uid: uid2, state: "uncertain", everUncertain: true });
      } catch {
        if (disposed || identity2 !== uid2 || ticket !== sequence || !authorized) return;
        storageError2 = true;
      }
      controls();
    },
    setAuthorization(value) {
      authorized = value === true;
      if (!authorized) {
        identity2 = null;
        operations2.clear();
        storageError2 = false;
        clear();
        status = "locked";
        message.textContent = "Google\u30ED\u30B0\u30A4\u30F3\u3068\u767B\u9332\u30E1\u30F3\u30D0\u30FC\u6A29\u9650\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
        render();
      }
      return Promise.resolve(false);
    },
    show() {
      const changed = !visible;
      visible = true;
      host.hidden = false;
      return changed || status === "idle" || status === "locked" ? refresh() : reading || Promise.resolve(false);
    },
    hide() {
      visible = false;
      host.hidden = true;
      suspend();
    },
    refresh,
    getState: () => ({ visible, authorized, status, rowCount: snapshot?.records.length || 0, unresolved: !!pending(), storageError: storageError2 }),
    dispose() {
      disposed = true;
      visible = false;
      authorized = false;
      identity2 = null;
      operations2.clear();
      clear();
      listeners.forEach((fn) => fn());
      root2.remove();
      dialog.remove();
      host.hidden = true;
    }
  };
}

// src/sheet-connection.js
var ENDPOINT = "https://script.google.com/macros/s/AKfycbxhTCY4IWpOh-tEQoS24yXXQYctbpHfB-l5iQObilc1-2Jud2-0bYJFhvpnOzAZ0dF-Wg/exec";
async function loadGoogleConnection() {
  const identity2 = await (await Promise.resolve().then(() => (init_firebase_driver(), firebase_driver_exports))).googleApiIdentity();
  return { ...identity2, ...createReportsClient({ endpoint: ENDPOINT, getIdToken: () => identity2.getIdToken() }) };
}
var authError = () => Object.assign(new Error("Google\u30ED\u30B0\u30A4\u30F3\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"), { code: "UNAUTHENTICATED" });
function installSheetConnection({ doc = document, loadConnection = loadGoogleConnection } = {}) {
  const host = doc.querySelector("#sheet-ledger-panel"), local = doc.querySelector("#browse-local"), buttons = [...doc.querySelectorAll("[data-browse-source]")];
  let page = "", source = "local", sequence = 0, unsubscribe = null, disposed = false, identityUid = null;
  function clearIdentity() {
    unsubscribe?.();
    unsubscribe = null;
    identityUid = null;
  }
  const panel = installReportsPanel({ host, change: async (input, { expectedUid }) => {
    const connection = await loadConnection();
    if (disposed || connection.currentUid() !== expectedUid || identityUid !== expectedUid) throw new ReportsError("LOGIN_REQUIRED");
    return connection.change(input);
  }, readPage: async ({ signal }) => {
    const request = sequence;
    const connection = await loadConnection();
    if (disposed || request !== sequence || signal.aborted) throw authError();
    const uid2 = connection.currentUid();
    if (!uid2) throw authError();
    clearIdentity();
    identityUid = uid2;
    await panel.setIdentity(uid2);
    if (disposed || request !== sequence || signal.aborted || connection.currentUid() !== uid2) throw authError();
    unsubscribe = connection.subscribe((next) => {
      if (next !== identityUid) {
        sequence++;
        clearIdentity();
        panel.setAuthorization(false);
      }
    });
    if (!identityUid || signal.aborted) throw authError();
    const result = await connection.readPage({ signal });
    if (disposed || request !== sequence || signal.aborted || connection.currentUid() !== uid2) throw authError();
    return result;
  } });
  function render() {
    buttons.forEach((button) => {
      const active = button.dataset.browseSource === source;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    local.hidden = source === "sheet";
    if (page === "browse" && source === "sheet") {
      void panel.setAuthorization(true);
      void panel.show();
    } else {
      sequence++;
      clearIdentity();
      panel.hide();
      panel.setAuthorization(false);
    }
  }
  const handlers = buttons.map((button) => {
    const listener = () => {
      const next = button.dataset.browseSource;
      if (next === source) return;
      sequence++;
      clearIdentity();
      panel.hide();
      panel.setAuthorization(false);
      source = next;
      render();
    };
    button.addEventListener("click", listener);
    return () => button.removeEventListener("click", listener);
  });
  const conceal = () => {
    sequence++;
    clearIdentity();
    panel.hide();
    panel.setAuthorization(false);
  };
  doc.defaultView.addEventListener("pagehide", conceal);
  return { setPage(next, preferredSource) {
    const nextSource = preferredSource ?? source;
    if (next === page && nextSource === source) return;
    page = next;
    source = nextSource;
    render();
  }, dispose() {
    if (disposed) return;
    disposed = true;
    sequence++;
    clearIdentity();
    handlers.forEach((remove) => remove());
    doc.defaultView.removeEventListener("pagehide", conceal);
    panel.dispose();
  }, getState: () => ({ source, page, ...panel.getState() }) };
}

// src/session.js
var DEMO_SESSION_KEY = "collection-report-demo-session-v1";
var DemoSessionRequiredError = class extends Error {
  constructor() {
    super("\u5229\u7528\u8005\u3092\u9078\u3073\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u5165\u529B\u4E2D\u306E\u5185\u5BB9\u306F\u6B8B\u3057\u3066\u3044\u307E\u3059\u3002");
    this.name = "DemoSessionRequiredError";
  }
};
function createDemoSession({ getStorage = () => globalThis.sessionStorage } = {}) {
  let memberId = "", storageAvailable = true;
  const write = () => {
    try {
      const storage = getStorage();
      if (memberId) storage.setItem(DEMO_SESSION_KEY, JSON.stringify({ memberId }));
      else storage.removeItem(DEMO_SESSION_KEY);
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
  };
  try {
    const raw = getStorage().getItem(DEMO_SESSION_KEY);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved.memberId === "string") memberId = saved.memberId;
      else write();
    }
  } catch {
    storageAvailable = false;
  }
  return {
    current(state2) {
      const member2 = state2?.masters?.members?.find((m) => m.id === memberId && m.active);
      if (!member2 && memberId) {
        memberId = "";
        write();
      }
      return member2 ?? null;
    },
    require(state2) {
      const member2 = this.current(state2);
      if (!member2) throw new DemoSessionRequiredError();
      return member2;
    },
    select(state2, id) {
      const member2 = state2?.masters?.members?.find((m) => m.id === id && m.active);
      if (!member2) throw new DemoSessionRequiredError();
      memberId = member2.id;
      write();
      return member2;
    },
    clear() {
      memberId = "";
      write();
    },
    get storageAvailable() {
      return storageAvailable;
    }
  };
}

// src/master-reorder.js
var MasterReorderConflictError = class extends Error {
  constructor() {
    super("\u4E00\u89A7\u304C\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u3059\u3002\u6700\u65B0\u306E\u4E26\u3073\u3092\u78BA\u8A8D\u3057\u3066\u3001\u3082\u3046\u4E00\u5EA6\u4E26\u3073\u66FF\u3048\u3066\u304F\u3060\u3055\u3044\u3002");
    this.name = "MasterReorderConflictError";
    this.code = "MASTER_REORDER_CONFLICT";
  }
};
function moveOrderedId(ids, id, targetIndex) {
  const index = ids.indexOf(id);
  if (index < 0 || !Number.isInteger(targetIndex)) throw new TypeError("Invalid reorder target.");
  const result = [...ids];
  result.splice(index, 1);
  result.splice(Math.max(0, Math.min(result.length, targetIndex)), 0, id);
  return result;
}
function insertionIndex(rects, sourceIndex, draggedCenter, scrollShift = 0) {
  let target = sourceIndex;
  const center = (rect) => rect.top + rect.height / 2 + scrollShift;
  if (draggedCenter >= center(rects[sourceIndex])) {
    for (let i = sourceIndex + 1; i < rects.length; i++) {
      if (draggedCenter >= center(rects[i])) target = i;
    }
  } else {
    for (let i = sourceIndex - 1; i >= 0; i--) {
      if (draggedCenter <= center(rects[i])) target = i;
    }
  }
  return target;
}
function edgeScrollVelocity(y, top, bottom, edge = 56, maxSpeed = 650) {
  if (!(bottom > top) || edge <= 0) return 0;
  const band = Math.min(edge, (bottom - top) / 2);
  if (y < top + band) return -maxSpeed * Math.min(1, Math.max(0, (top + band - y) / band));
  if (y > bottom - band) return maxSpeed * Math.min(1, Math.max(0, (y - bottom + band) / band));
  return 0;
}
var ATTRIBUTES = ["tabindex", "role", "aria-label", "aria-keyshortcuts", "aria-roledescription", "aria-posinset", "aria-setsize"];
var restoreAttribute = (node, name, value) => value === null ? node.removeAttribute(name) : node.setAttribute(name, value);
var sameOrder = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);
function installMasterReorder({
  container,
  rowSelector = "[data-master-id]",
  getRowId = (row) => row.dataset.masterId,
  getRowLabel = (row) => row.dataset.reorderLabel || row.querySelector("h2,.master-name")?.textContent?.trim() || row.textContent.trim(),
  getRevision,
  onDraftChange = () => {
  },
  onError = () => {
  },
  onStatusChange = () => {
  },
  longPressMs = 400,
  moveTolerance = 9,
  edgeSize = 56,
  edgeSpeed = 650,
  viewportInsets = { top: 0, bottom: 0 },
  enabled: initiallyEnabled = false
} = {}) {
  if (!container?.ownerDocument || typeof getRevision !== "function" || typeof onDraftChange !== "function") {
    throw new TypeError("container and getRevision are required.");
  }
  const doc = container.ownerDocument, win = doc.defaultView;
  const snapshots = /* @__PURE__ */ new Map(), listeners = [];
  const originalRole = container.getAttribute("role"), originalBusy = container.getAttribute("aria-busy");
  const live = doc.createElement("p");
  live.className = "master-reorder-live";
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  container.insertAdjacentElement("afterend", live);
  let enabled = false, destroyed = false, phase = "idle", gesture = null;
  let timer = null, frame = null, renderedRevision, modeIds = [], modeNodes = [];
  let suppressClickUntil = 0;
  const now = () => win.performance.now();
  const rows = () => [...container.children].filter((row) => row.matches(rowSelector));
  const announce = (message) => {
    if (!destroyed) live.textContent = message;
  };
  const listen = (node, type, fn, options) => {
    node.addEventListener(type, fn, options);
    listeners.push(() => node.removeEventListener(type, fn, options));
  };
  const dirty = () => enabled && !sameOrder(rows().map(getRowId), modeIds);
  const status = () => {
    if (!destroyed) onStatusChange({ phase, enabled, dragging: phase === "dragging", busy: phase === "saving", dirty: dirty() });
  };
  const labelFor = (row) => snapshots.get(row)?.label ?? getRowLabel(row);
  const setPhase = (next) => {
    if (phase === next) return;
    phase = next;
    status();
  };
  const identify = (currentRows) => {
    const ids = currentRows.map(getRowId);
    if (ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== ids.length) {
      throw new TypeError("Reorder rows need unique, nonempty stable IDs.");
    }
    return ids;
  };
  const restoreRow = (row, snapshot) => {
    for (const name of ATTRIBUTES) restoreAttribute(row, name, snapshot.attributes[name]);
    row.classList.remove("master-reorder-row", "master-reorder-placeholder", "master-reorder-pressed", "master-reorder-keyboard");
    snapshot.controls?.remove();
    row.style.transform = snapshot.transform;
    row.style.transition = snapshot.transition;
  };
  const syncRows = () => {
    const currentRows = rows();
    identify(currentRows);
    for (const [row, snapshot] of snapshots) {
      if (!currentRows.includes(row) || !enabled) {
        restoreRow(row, snapshot);
        snapshots.delete(row);
      }
    }
    if (!enabled) return;
    currentRows.forEach((row, index) => {
      if (!snapshots.has(row)) snapshots.set(row, {
        attributes: Object.fromEntries(ATTRIBUTES.map((name) => [name, row.getAttribute(name)])),
        transform: row.style.transform,
        transition: row.style.transition,
        label: getRowLabel(row),
        controls: null
      });
      const snapshot = snapshots.get(row);
      if (!snapshot.controls) {
        const controls = doc.createElement("span");
        controls.className = "master-reorder-actions";
        for (const [delta, text3, label] of [[-1, "\u2191", "\u4E0A\u3078"], [1, "\u2193", "\u4E0B\u3078"]]) {
          const button = doc.createElement("button");
          button.type = "button";
          button.className = "master-reorder-step";
          button.dataset.reorderMove = String(delta);
          button.textContent = text3;
          button.setAttribute("aria-label", `${snapshot.label}\u3092${label}\u79FB\u52D5`);
          controls.append(button);
        }
        row.append(controls);
        snapshot.controls = controls;
      }
      snapshot.controls.querySelector('[data-reorder-move="-1"]').disabled = index === 0 || phase === "saving";
      snapshot.controls.querySelector('[data-reorder-move="1"]').disabled = index === currentRows.length - 1 || phase === "saving";
      row.classList.add("master-reorder-row");
      row.tabIndex = 0;
      row.setAttribute("role", "listitem");
      row.setAttribute("aria-roledescription", "\u4E26\u3073\u66FF\u3048\u3067\u304D\u308B\u9805\u76EE");
      row.setAttribute("aria-label", `${labelFor(row)}\u3002${index + 1} / ${currentRows.length}\u3002\u9577\u62BC\u3057\u3057\u3066\u79FB\u52D5\u3002\u30AD\u30FC\u30DC\u30FC\u30C9\u3067\u306F\u30B9\u30DA\u30FC\u30B9\u3067\u6301\u3061\u4E0A\u3052\u3001\u4E0A\u4E0B\u30AD\u30FC\u3067\u79FB\u52D5\u3001Enter\u3067\u7F6E\u304F\u3001Escape\u3067\u30AD\u30E3\u30F3\u30BB\u30EB\u3002\u6700\u5F8C\u306B\u4FDD\u5B58\u30DC\u30BF\u30F3\u3067\u78BA\u5B9A\u3002`);
      row.setAttribute("aria-keyshortcuts", "Space Enter ArrowUp ArrowDown Home End Escape");
      row.setAttribute("aria-posinset", String(index + 1));
      row.setAttribute("aria-setsize", String(currentRows.length));
    });
  };
  const clearTimer = () => {
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
  };
  const clearFrame = () => {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
  };
  const releasePointer = (previous) => {
    if (previous?.kind === "pointer" && previous.row.hasPointerCapture?.(previous.identifier)) {
      try {
        previous.row.releasePointerCapture(previous.identifier);
      } catch {
      }
    }
  };
  const resetPreview = (previous) => {
    previous?.ghost?.remove();
    previous?.row.classList.remove("master-reorder-pressed", "master-reorder-placeholder", "master-reorder-keyboard");
    if (previous?.nodes) for (const row of previous.nodes) {
      const snapshot = snapshots.get(row);
      if (snapshot) row.style.transform = snapshot.transform;
    }
    container.classList.remove("master-reorder-dragging");
    doc.documentElement.classList.remove("master-reorder-pointer-active");
  };
  const cancelGesture = (reason = "cancel") => {
    if (!gesture) return false;
    const previous = gesture, wasDragging = phase === "dragging";
    gesture = null;
    clearTimer();
    clearFrame();
    resetPreview(previous);
    releasePointer(previous);
    if (wasDragging) {
      suppressClickUntil = now() + 500;
      announce(reason === "changed" ? "\u4E00\u89A7\u304C\u5909\u66F4\u3055\u308C\u305F\u305F\u3081\u3001\u4E26\u3073\u66FF\u3048\u3092\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u307E\u3057\u305F\u3002" : "\u4E26\u3073\u66FF\u3048\u3092\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u307E\u3057\u305F\u3002");
    }
    setPhase("idle");
    return true;
  };
  const findRow = (event) => {
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    const row = target?.closest(rowSelector);
    if (!row || row.parentElement !== container) return null;
    if (target.closest('button,a,input,textarea,select,[contenteditable="true"]')) return null;
    return row;
  };
  const isCurrent = (g) => container.isConnected && g.nodes.every((row) => row.parentElement === container) && sameOrder(rows().map(getRowId), g.ids);
  const shifted = (g) => container.getBoundingClientRect().top - g.containerTop;
  const applyPreview = (g, target) => {
    g.targetIndex = target;
    const order = moveOrderedId(g.ids, g.id, target);
    let top = g.rects[0].top;
    for (let i = 0; i < order.length; i++) {
      const oldIndex = g.ids.indexOf(order[i]);
      const row = g.nodes[oldIndex], rect = g.rects[oldIndex];
      row.style.transform = `translate3d(0, ${top - rect.top}px, 0)`;
      top += rect.height + (g.gaps[i] ?? 0);
    }
    if (g.kind === "keyboard") {
      g.row.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      announce(`${labelFor(g.row)}\u3001${target + 1} / ${g.nodes.length}\u3002Enter\u3067\u7F6E\u304F\u3001Escape\u3067\u30AD\u30E3\u30F3\u30BB\u30EB\u3002\u6700\u5F8C\u306B\u4FDD\u5B58\u30DC\u30BF\u30F3\u3067\u78BA\u5B9A\u3002`);
    }
  };
  const updatePosition = () => {
    const g = gesture;
    if (!g || phase !== "dragging" || g.kind === "keyboard") return;
    if (!isCurrent(g)) {
      cancelGesture("changed");
      return;
    }
    const top = g.y - g.grabOffset, shift = shifted(g);
    g.ghost.style.transform = `translate3d(0, ${top - g.rect.top}px, 0)`;
    if (!g.departed) g.departed = top >= g.rect.bottom + shift || top + g.rect.height <= g.rect.top + shift;
    if (g.departed) {
      const target = insertionIndex(g.rects, g.sourceIndex, top + g.rect.height / 2, shift);
      if (target !== g.targetIndex) applyPreview(g, target);
    }
  };
  const scrollParents = () => {
    const result = [];
    for (let node = container; node && node !== doc.documentElement; node = node.parentElement) {
      if (/(auto|scroll|overlay)/.test(win.getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) result.push(node);
    }
    const root2 = doc.scrollingElement || doc.documentElement;
    if (!result.includes(root2)) result.push(root2);
    return result;
  };
  const autoScroll = (time) => {
    frame = null;
    const g = gesture;
    if (!g || phase !== "dragging" || g.kind === "keyboard") return;
    if (!isCurrent(g)) {
      cancelGesture("changed");
      return;
    }
    const elapsed = Math.max(1, Math.min(32, time - (g.frameTime ?? time - 16)));
    g.frameTime = time;
    const viewportTop = win.visualViewport?.offsetTop || 0;
    const viewportBottom = viewportTop + (win.visualViewport?.height || win.innerHeight);
    for (const node of g.scrollers) {
      const root2 = node === (doc.scrollingElement || doc.documentElement);
      const rect = root2 ? { top: viewportTop, bottom: viewportBottom } : node.getBoundingClientRect();
      const top = Math.max(rect.top, viewportTop + (viewportInsets.top || 0));
      const bottom = Math.min(rect.bottom, viewportBottom - (viewportInsets.bottom || 0));
      const velocity = edgeScrollVelocity(g.y, top, bottom, edgeSize, edgeSpeed);
      const maximum = Math.max(0, node.scrollHeight - (root2 ? win.innerHeight : node.clientHeight));
      if (!velocity || velocity < 0 && node.scrollTop <= 0 || velocity > 0 && node.scrollTop >= maximum) continue;
      const before = node.scrollTop;
      node.scrollTop = Math.max(0, Math.min(maximum, before + velocity * elapsed / 1e3));
      if (node.scrollTop !== before) break;
    }
    updatePosition();
    if (gesture === g) frame = win.requestAnimationFrame(autoScroll);
  };
  const createGhost = (g) => {
    const ghost = g.row.cloneNode(true);
    for (const node of [ghost, ...ghost.querySelectorAll("*")]) {
      for (const attr of ["id", "name", "for", "data-master-id", "data-reorder-id", "aria-labelledby", "aria-describedby"]) node.removeAttribute(attr);
      if (node.matches("button,input,textarea,select")) node.disabled = true;
      node.removeAttribute("tabindex");
    }
    ghost.classList.remove("master-reorder-placeholder", "master-reorder-pressed");
    ghost.classList.add("master-reorder-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("inert", "");
    Object.assign(ghost.style, { top: `${g.rect.top}px`, left: `${g.rect.left}px`, width: `${g.rect.width}px`, height: `${g.rect.height}px`, transform: "translate3d(0, 0, 0)" });
    doc.body.append(ghost);
    return ghost;
  };
  const activate = () => {
    const g = gesture;
    if (!g || destroyed || !enabled || phase !== "pending") return;
    clearTimer();
    if (!container.isConnected || g.row.parentElement !== container || getRevision() !== renderedRevision) {
      cancelGesture("changed");
      return;
    }
    g.nodes = rows();
    g.ids = identify(g.nodes);
    g.id = getRowId(g.row);
    g.sourceIndex = g.ids.indexOf(g.id);
    g.targetIndex = g.sourceIndex;
    g.rects = g.nodes.map((row) => {
      const r = row.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
    });
    g.rect = g.rects[g.sourceIndex];
    if (g.rect.height <= 0 || g.rect.width <= 0) {
      cancelGesture();
      return;
    }
    g.gaps = g.rects.map((rect, i) => Math.max(0, (g.rects[i + 1]?.top ?? rect.bottom) - rect.bottom));
    g.expectedMasterRevision = renderedRevision;
    g.containerTop = container.getBoundingClientRect().top;
    g.grabOffset = g.kind === "keyboard" ? g.rect.height / 2 : g.y - g.rect.top;
    g.departed = false;
    g.row.classList.remove("master-reorder-pressed");
    g.row.classList.add(g.kind === "keyboard" ? "master-reorder-keyboard" : "master-reorder-placeholder");
    container.classList.add("master-reorder-dragging");
    if (g.kind !== "keyboard") {
      g.ghost = createGhost(g);
      g.scrollers = scrollParents();
      doc.documentElement.classList.add("master-reorder-pointer-active");
      if (g.kind === "pointer") {
        try {
          g.row.setPointerCapture?.(g.identifier);
        } catch {
        }
      }
      frame = win.requestAnimationFrame(autoScroll);
    }
    g.row.focus({ preventScroll: true });
    setPhase("dragging");
    announce(`${labelFor(g.row)}\u3092\u6301\u3061\u4E0A\u3052\u307E\u3057\u305F\u3002\u4E0A\u4E0B\u306B\u79FB\u52D5\u3057\u3066\u96E2\u3059\u3068\u7F6E\u304D\u307E\u3059\u3002\u6700\u5F8C\u306B\u4FDD\u5B58\u30DC\u30BF\u30F3\u3067\u78BA\u5B9A\u3002Escape\u3067\u30AD\u30E3\u30F3\u30BB\u30EB\u3002`);
  };
  const start = (row, point, kind, identifier) => {
    if (!enabled || destroyed || phase === "saving" || rows().length < 2) return;
    if (gesture) {
      cancelGesture();
      return;
    }
    gesture = { row, kind, identifier, x: point.x, y: point.y, startX: point.x, startY: point.y };
    row.classList.add("master-reorder-pressed");
    setPhase("pending");
    if (kind === "keyboard") activate();
    else timer = win.setTimeout(activate, Math.max(0, longPressMs));
  };
  const move = (x, y) => {
    const g = gesture;
    if (!g) return;
    if (phase === "pending" && Math.hypot(x - g.startX, y - g.startY) > moveTolerance) {
      cancelGesture("scroll");
      return;
    }
    g.x = x;
    g.y = y;
    if (phase === "dragging") updatePosition();
  };
  const placeRows = (orderedRows) => {
    const markers = rows().map((row) => {
      const marker = doc.createComment("reorder");
      row.replaceWith(marker);
      return marker;
    });
    markers.forEach((marker, index) => marker.replaceWith(orderedRows[index]));
  };
  const emitDraft = (orderedIds, draggedId) => {
    syncRows();
    status();
    onDraftChange({ orderedIds: [...orderedIds], draggedId, expectedMasterRevision: renderedRevision });
  };
  const finish = () => {
    const g = gesture;
    if (!g) return;
    if (phase !== "dragging") {
      cancelGesture();
      return;
    }
    const orderedIds = moveOrderedId(g.ids, g.id, g.targetIndex);
    const changed = !sameOrder(orderedIds, g.ids);
    const valid = isCurrent(g) && getRevision() === g.expectedMasterRevision;
    gesture = null;
    clearTimer();
    clearFrame();
    for (const row of g.nodes) row.style.transition = "none";
    resetPreview(g);
    releasePointer(g);
    suppressClickUntil = now() + 500;
    setPhase("idle");
    if (!valid) {
      for (const row of g.nodes) row.style.transition = snapshots.get(row)?.transition || "";
      announce("\u4E00\u89A7\u304C\u5909\u66F4\u3055\u308C\u305F\u305F\u3081\u4E26\u3073\u66FF\u3048\u3066\u3044\u307E\u305B\u3093\u3002\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u3066\u6700\u65B0\u306E\u4E26\u3073\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      onError(new MasterReorderConflictError());
      return;
    }
    if (!changed) {
      for (const row of g.nodes) row.style.transition = snapshots.get(row)?.transition || "";
      announce("\u4E26\u3073\u9806\u306F\u5909\u308F\u3063\u3066\u3044\u307E\u305B\u3093\u3002");
      return;
    }
    placeRows(orderedIds.map((id) => g.nodes[g.ids.indexOf(id)]));
    void container.offsetHeight;
    for (const row of g.nodes) row.style.transition = snapshots.get(row)?.transition || "";
    g.row.focus({ preventScroll: true });
    emitDraft(orderedIds, g.id);
    announce(`${labelFor(g.row)}\u3092${g.targetIndex + 1}\u756A\u76EE\u306B\u79FB\u52D5\u3057\u307E\u3057\u305F\u3002\u4FDD\u5B58\u30DC\u30BF\u30F3\u3067\u78BA\u5B9A\u3057\u307E\u3059\u3002`);
  };
  const moveByButton = (row, delta) => {
    if (!enabled || destroyed || phase === "saving" || phase === "dragging") return;
    cancelGesture();
    if (getRevision() !== renderedRevision) {
      onError(new MasterReorderConflictError());
      return;
    }
    const currentRows = rows(), ids = identify(currentRows), id = getRowId(row);
    const from = ids.indexOf(id), target = from + delta;
    if (from < 0 || target < 0 || target >= ids.length) return;
    const order = moveOrderedId(ids, id, target);
    placeRows(order.map((value) => currentRows[ids.indexOf(value)]));
    emitDraft(order, id);
    row.focus({ preventScroll: true });
    announce(`${labelFor(row)}\u3092${target + 1}\u756A\u76EE\u306B\u79FB\u52D5\u3057\u307E\u3057\u305F\u3002\u4FDD\u5B58\u30DC\u30BF\u30F3\u3067\u78BA\u5B9A\u3057\u307E\u3059\u3002`);
  };
  const cancelMode = () => {
    if (destroyed || !enabled || phase === "saving") return false;
    cancelGesture();
    const current = rows();
    if (current.length === modeNodes.length && modeNodes.every((row) => row.parentElement === container)) placeRows(modeNodes);
    controller.setEnabled(false);
    announce("\u4E26\u3073\u66FF\u3048\u3092\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u3001\u5143\u306E\u4E26\u3073\u306B\u623B\u3057\u307E\u3057\u305F\u3002");
    return true;
  };
  listen(container, "pointerdown", (event) => {
    if (event.pointerType === "touch" && "TouchEvent" in win) return;
    if (event.button !== 0 || event.isPrimary === false) return;
    const row = findRow(event);
    if (row) start(row, { x: event.clientX, y: event.clientY }, "pointer", event.pointerId);
  });
  listen(doc, "pointermove", (event) => {
    if (gesture?.kind !== "pointer" || gesture.identifier !== event.pointerId) return;
    if (phase === "dragging") event.preventDefault();
    move(event.clientX, event.clientY);
  }, { passive: false });
  listen(doc, "pointerup", (event) => {
    if (gesture?.kind !== "pointer" || gesture.identifier !== event.pointerId) return;
    if (phase === "dragging") event.preventDefault();
    void finish();
  });
  listen(doc, "pointercancel", (event) => {
    if (gesture?.kind === "pointer" && gesture.identifier === event.pointerId) cancelGesture();
  });
  listen(container, "lostpointercapture", (event) => {
    if (gesture?.kind === "pointer" && gesture.identifier === event.pointerId) cancelGesture();
  });
  listen(container, "touchstart", (event) => {
    if (event.touches.length !== 1) {
      cancelGesture();
      return;
    }
    const row = findRow(event), touch = event.touches[0];
    if (row) start(row, { x: touch.clientX, y: touch.clientY }, "touch", touch.identifier);
  }, { passive: true });
  listen(doc, "touchmove", (event) => {
    if (gesture?.kind !== "touch") return;
    if (event.touches.length !== 1) {
      cancelGesture();
      return;
    }
    const touch = [...event.touches].find((t) => t.identifier === gesture.identifier);
    if (!touch) {
      cancelGesture();
      return;
    }
    if (phase === "dragging") {
      if (!event.cancelable) {
        cancelGesture("scroll");
        return;
      }
      event.preventDefault();
    }
    move(touch.clientX, touch.clientY);
  }, { passive: false });
  listen(doc, "touchstart", (event) => {
    if (gesture?.kind === "touch" && event.touches.length > 1) cancelGesture();
  }, { passive: true });
  listen(doc, "touchend", (event) => {
    if (gesture?.kind !== "touch" || ![...event.changedTouches].some((t) => t.identifier === gesture.identifier)) return;
    if (phase === "dragging") event.preventDefault();
    void finish();
  }, { passive: false });
  listen(doc, "touchcancel", () => {
    if (gesture?.kind === "touch") cancelGesture();
  });
  listen(container, "keydown", (event) => {
    if (!enabled || destroyed) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (gesture) cancelGesture();
      else cancelMode();
      return;
    }
    const row = findRow(event);
    if (!row || event.altKey || event.ctrlKey || event.metaKey) return;
    if ([" ", "Spacebar", "Enter"].includes(event.key)) {
      event.preventDefault();
      if (event.repeat || phase === "saving") return;
      if (!gesture) start(row, { x: 0, y: 0 }, "keyboard", null);
      else if (gesture.kind === "keyboard") void finish();
    } else if (gesture?.kind === "keyboard" && ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const g = gesture;
      const target = event.key === "Home" ? 0 : event.key === "End" ? g.nodes.length - 1 : Math.max(0, Math.min(g.nodes.length - 1, g.targetIndex + (event.key === "ArrowDown" ? 1 : -1)));
      applyPreview(g, target);
    } else if (event.key === "Tab" && gesture) cancelGesture();
  });
  listen(doc, "keydown", (event) => {
    if (event.key === "Escape" && gesture) {
      event.preventDefault();
      cancelGesture();
    }
  });
  listen(container, "click", (event) => {
    const button = event.target.closest?.("[data-reorder-move]");
    if (button && button.closest(rowSelector)?.parentElement === container) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!button.disabled) moveByButton(button.closest(rowSelector), Number(button.dataset.reorderMove));
      return;
    }
    if (enabled && phase === "saving" || now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  listen(container, "contextmenu", (event) => {
    if (enabled && findRow(event)) event.preventDefault();
  });
  listen(container, "dragstart", (event) => {
    if (enabled && findRow(event)) event.preventDefault();
  });
  listen(doc, "scroll", () => {
    if (phase === "pending") cancelGesture("scroll");
    else updatePosition();
  }, true);
  for (const name of ["blur", "resize", "pagehide", "hashchange", "popstate"]) listen(win, name, () => cancelGesture("navigation"));
  listen(doc, "visibilitychange", () => {
    if (doc.hidden) cancelGesture("navigation");
  });
  const observer = new win.MutationObserver(() => {
    if (gesture?.nodes && !isCurrent(gesture)) cancelGesture("changed");
    else if (gesture && gesture.row.parentElement !== container) cancelGesture("changed");
  });
  observer.observe(container, { childList: true });
  const controller = {
    setEnabled(value) {
      if (destroyed) return;
      const next = !!value;
      if (next === enabled) return;
      const nextNodes = next ? rows() : null, nextIds = next ? identify(nextNodes) : null;
      cancelGesture();
      enabled = next;
      if (phase === "saving") phase = "idle";
      container.classList.toggle("master-reorder-enabled", enabled);
      if (enabled) {
        container.setAttribute("role", "list");
        renderedRevision = getRevision();
        modeNodes = nextNodes;
        modeIds = nextIds;
      } else {
        restoreAttribute(container, "role", originalRole);
        restoreAttribute(container, "aria-busy", originalBusy);
      }
      syncRows();
      if (enabled) announce("\u9577\u62BC\u3057\u3057\u3066\u4E0A\u4E0B\u306B\u79FB\u52D5\u3001\u307E\u305F\u306F\u4E0A\u4E0B\u30DC\u30BF\u30F3\u3067\u4E26\u3073\u66FF\u3048\u307E\u3059\u3002\u6700\u5F8C\u306B\u4FDD\u5B58\u30DC\u30BF\u30F3\u3067\u78BA\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      else live.textContent = "";
      status();
    },
    getOrder() {
      return identify(rows());
    },
    getDirty() {
      return dirty();
    },
    setBusy(value) {
      if (destroyed || !enabled) return;
      cancelGesture();
      setPhase(value ? "saving" : "idle");
      if (value) container.setAttribute("aria-busy", "true");
      else restoreAttribute(container, "aria-busy", originalBusy);
      syncRows();
    },
    refresh() {
      if (destroyed) return;
      if (enabled) {
        if (phase === "saving") controller.setEnabled(false);
        else cancelMode();
      }
      syncRows();
    },
    cancel: cancelMode,
    cancelDrag: cancelGesture,
    destroy() {
      if (destroyed) return;
      cancelGesture("navigation");
      if (enabled && phase !== "saving") cancelMode();
      enabled = false;
      for (const [row, snapshot] of snapshots) restoreRow(row, snapshot);
      snapshots.clear();
      container.classList.remove("master-reorder-enabled", "master-reorder-dragging");
      restoreAttribute(container, "role", originalRole);
      restoreAttribute(container, "aria-busy", originalBusy);
      observer.disconnect();
      listeners.forEach((remove) => remove());
      live.remove();
      destroyed = true;
    },
    get revision() {
      return renderedRevision;
    },
    get enabled() {
      return enabled;
    },
    get dragging() {
      return phase === "dragging";
    },
    get busy() {
      return phase === "saving";
    },
    get phase() {
      return phase;
    }
  };
  if (initiallyEnabled) controller.setEnabled(true);
  return controller;
}

// src/invoice-seal.js
var SEAL_LIMITS = Object.freeze({ bytes: 5 * 1024 * 1024, side: 4096, pixels: 16e6 });
var PREFIX = "data:image/png;base64,";
var MAX_URL = PREFIX.length + 4 * Math.ceil(SEAL_LIMITS.bytes / 3);
var DB_NAME = "work-report-invoice-seal";
var STORE = "private-seal";
var InvoiceSealError = class extends Error {
  constructor(message, code) {
    super(message);
    this.name = "InvoiceSealError";
    this.code = code;
  }
};
var invalid2 = () => new InvoiceSealError("\u5370\u5F71\u306F5MB\u4EE5\u4E0B\u30FB4096\xD74096\u4EE5\u5185\uFF081600\u4E07\u753B\u7D20\u4EE5\u4E0B\uFF09\u306E\u6709\u52B9\u306APNG\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002", "invalid-png");
var storageError = () => new InvoiceSealError("\u5370\u5F71\u306E\u7AEF\u672B\u5185\u4FDD\u5B58\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002\u5831\u544A\u30FB\u8A2D\u5B9A\u30C7\u30FC\u30BF\u306F\u5909\u66F4\u3057\u3066\u3044\u307E\u305B\u3093\u3002", "storage-unavailable");
function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > SEAL_LIMITS.side || height > SEAL_LIMITS.side || width * height > SEAL_LIMITS.pixels) throw invalid2();
}
function crc(bytes, start, end) {
  let value = 4294967295;
  for (let i = start; i < end; i++) {
    value ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) value = value >>> 1 ^ 3988292384 & -(value & 1);
  }
  return (value ^ 4294967295) >>> 0;
}
function validateSealPNGHeader(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 33 || bytes.length > SEAL_LIMITS.bytes || ![137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) throw invalid2();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR" || view.getUint32(29) !== crc(bytes, 12, 29)) throw invalid2();
  const width = view.getUint32(16), height = view.getUint32(20);
  dimensions(width, height);
  const validDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  if (!validDepths[bytes[25]]?.includes(bytes[24]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1) throw invalid2();
  return { width, height };
}
function encode(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return PREFIX + globalThis.btoa(binary);
}
function validateCanonicalSeal(value) {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 3 || !["dataURL", "width", "height"].every((key) => Object.hasOwn(value, key))) throw invalid2();
  const { dataURL, width, height } = value;
  dimensions(width, height);
  if (typeof dataURL !== "string" || dataURL.length > MAX_URL || !dataURL.startsWith(PREFIX)) throw invalid2();
  const base64 = dataURL.slice(PREFIX.length);
  if (!base64.length || base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw invalid2();
  let bytes;
  try {
    bytes = Uint8Array.from(globalThis.atob(base64), (c) => c.charCodeAt(0));
  } catch {
    throw invalid2();
  }
  if (encode(bytes) !== dataURL) throw invalid2();
  const header = validateSealPNGHeader(bytes);
  if (width !== header.width || height !== header.height) throw invalid2();
  const view = new DataView(bytes.buffer);
  let offset = 33, sawData = false, ended = false;
  while (offset + 12 <= bytes.length) {
    const size = view.getUint32(offset), end = offset + 12 + size;
    if (end > bytes.length) throw invalid2();
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (!["IDAT", "IEND", "sRGB", "gAMA", "cHRM"].includes(type) || view.getUint32(end - 4) !== crc(bytes, offset + 4, end - 4)) throw invalid2();
    if (type === "IDAT") sawData ||= size > 0;
    if (type === "IEND") {
      if (size || end !== bytes.length) throw invalid2();
      ended = true;
      break;
    }
    offset = end;
  }
  if (!sawData || !ended) throw invalid2();
  return { dataURL, width, height };
}
async function prepareInvoiceSeal(file, doc = globalThis.document) {
  if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function" || !Number.isSafeInteger(file.size) || file.size < 33 || file.size > SEAL_LIMITS.bytes || file.type && file.type !== "image/png") throw invalid2();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length !== file.size) throw invalid2();
  const expected = validateSealPNGHeader(bytes);
  const ImageClass = doc?.defaultView?.Image;
  if (!ImageClass || !doc?.createElement) throw new InvoiceSealError("\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u3067\u306F\u5370\u5F71\u3092\u51E6\u7406\u3067\u304D\u307E\u305B\u3093\u3002", "canvas-unavailable");
  const image = new ImageClass();
  let canvas, output;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        image.onload = image.onerror = null;
        image.src = "";
        reject(invalid2());
      }, 15e3);
      image.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(invalid2());
      };
      image.src = encode(bytes);
    });
    if (image.naturalWidth !== expected.width || image.naturalHeight !== expected.height) throw invalid2();
    canvas = doc.createElement("canvas");
    canvas.width = expected.width;
    canvas.height = expected.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new InvoiceSealError("\u5370\u5F71\u306E\u753B\u50CF\u51E6\u7406\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002", "canvas-unavailable");
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1, hasTransparency = false;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (pixels.data[i + 3] < 255) hasTransparency = true;
      if (pixels.data[i + 3]) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
      pixels.data[i] = 201;
      pixels.data[i + 1] = 45;
      pixels.data[i + 2] = 41;
    }
    if (right < 0) throw new InvoiceSealError("\u900F\u660E\u306A\u753B\u50CF\u3060\u3051\u3067\u306F\u5370\u5F71\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3002", "empty-image");
    if (!hasTransparency) throw new InvoiceSealError("\u80CC\u666F\u304C\u900F\u660E\u306APNG\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002\u4E0D\u900F\u660E\u306A\u753B\u50CF\u306F\u5370\u5F71\u3068\u3057\u3066\u4F7F\u3048\u307E\u305B\u3093\u3002", "opaque-image");
    ctx.putImageData(pixels, 0, 0);
    left = Math.max(0, left - 2);
    top = Math.max(0, top - 2);
    right = Math.min(canvas.width - 1, right + 2);
    bottom = Math.min(canvas.height - 1, bottom + 2);
    output = doc.createElement("canvas");
    output.width = right - left + 1;
    output.height = bottom - top + 1;
    const out = output.getContext("2d");
    if (!out) throw new InvoiceSealError("\u5370\u5F71\u306E\u753B\u50CF\u51E6\u7406\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002", "canvas-unavailable");
    out.putImageData(ctx.getImageData(left, top, output.width, output.height), 0, 0);
    return validateCanonicalSeal({ dataURL: output.toDataURL("image/png"), width: output.width, height: output.height });
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    if (output) {
      output.width = 0;
      output.height = 0;
    }
    image.onload = image.onerror = null;
    image.src = "";
  }
}
var publicSealPreloads = /* @__PURE__ */ new WeakMap();
async function loadDefaultInvoiceSeal(doc = globalThis.document, ...options) {
  const ready = options.length === 0 ? publicSealPreloads.get(doc) : null;
  return ready ? structuredClone(await ready) : readDefaultInvoiceSeal(doc, ...options);
}
async function readDefaultInvoiceSeal(doc = globalThis.document, fetcher = doc?.defaultView?.fetch?.bind(doc.defaultView) ?? globalThis.fetch, prepare = null) {
  const location2 = doc?.defaultView?.location;
  if (!location2 || !["http:", "https:"].includes(location2.protocol) || !fetcher) throw new InvoiceSealError("\u6A19\u6E96\u306E\u793E\u5370\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3002", "default-unavailable");
  const url = new URL("./icons/invoice-seal-lowres.png", location2.href);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15e3);
  try {
    const response = await fetcher(url.href, { mode: "same-origin", credentials: "same-origin", redirect: "error", signal: controller.signal });
    if (!response.ok || response.type === "opaque" || response.redirected || response.url && response.url !== url.href) throw invalid2();
    const blob = await response.blob();
    if (blob.type !== "image/png") throw invalid2();
    let result;
    if (prepare) result = validateCanonicalSeal(await prepare(blob, doc));
    else {
      if (blob.size < 33 || blob.size > SEAL_LIMITS.bytes) throw invalid2();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const size = validateSealPNGHeader(bytes);
      result = validateCanonicalSeal({ dataURL: encode(bytes), ...size });
    }
    if (!result || result.width > 160 || result.height > 160) throw invalid2();
    return result;
  } finally {
    clearTimeout(timer);
  }
}
function createSealStore(indexedDB, { key = "current", guard = () => {
} } = {}) {
  async function run(mode, action) {
    guard();
    if (!indexedDB?.open) throw storageError();
    return new Promise((resolve, reject) => {
      let db, transaction, settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        db?.close();
        error ? reject(error) : resolve(value);
      };
      const timer = setTimeout(() => {
        try {
          transaction?.abort();
        } catch {
        }
        finish(storageError());
      }, 1e4);
      let request;
      try {
        request = indexedDB.open(DB_NAME, 1);
      } catch {
        finish(storageError());
        return;
      }
      request.onerror = request.onblocked = () => finish(storageError());
      request.onupgradeneeded = () => {
        if (settled) {
          try {
            request.transaction.abort();
          } catch {
          }
          return;
        }
        try {
          request.result.createObjectStore(STORE);
        } catch {
          finish(storageError());
        }
      };
      request.onsuccess = () => {
        db = request.result;
        if (settled) {
          db.close();
          return;
        }
        try {
          guard();
          transaction = db.transaction(STORE, mode);
          const operation = action(transaction.objectStore(STORE));
          let result;
          operation.onsuccess = () => {
            result = operation.result;
          };
          operation.onerror = () => finish(storageError());
          transaction.oncomplete = () => finish(null, result);
          transaction.onerror = transaction.onabort = () => finish(storageError());
        } catch {
          try {
            transaction?.abort();
          } catch {
          }
          finish(storageError());
        }
      };
    });
  }
  return {
    async load() {
      const value = await run("readonly", (store) => store.get(key));
      return value === void 0 ? null : validateCanonicalSeal(value);
    },
    async save(value) {
      const clean = validateCanonicalSeal(value);
      if (!clean) throw invalid2();
      await run("readwrite", (store) => store.put(clean, key));
      return clean;
    },
    async remove() {
      await run("readwrite", (store) => store.delete(key));
    }
  };
}

// src/invoice-document.js
var INVOICE_SEAL_BOX = Object.freeze({ x: 131, y: 68, width: 20, height: 20 });
var INVOICE_GEOMETRY = Object.freeze({
  pageWidth: 182,
  pageHeight: 257,
  pdfWidth: 182 * 72 / 25.4,
  pdfHeight: 257 * 72 / 25.4,
  pixelWidth: 182 * 96 / 25.4,
  pixelHeight: 257 * 96 / 25.4,
  left: 29,
  right: 153,
  columns: Object.freeze([56, 15, 13, 13, 27]),
  detailLeft: 25,
  detailTop: 41,
  detailColumns: Object.freeze([27, 25, 25, 27, 28]),
  detailRowHeight: 5.2
});
var FONT = 'Arial, "MS PGothic", "Yu Gothic", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif';
var esc2 = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var safeText = (value) => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "");
var num = (value) => value === null ? "\u7B97\u51FA\u4E0D\u53EF" : String(value).replace(/^(\d+)(.*)$/, (_, integer, fraction) => integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + fraction);
var sum = (values) => values.reduce((a, b) => a + b, 0);
var widthOf = (text3) => [...safeText(text3)].reduce((width, c) => width + (/^[\x20-\x7e]$/.test(c) ? 0.56 : 1), 0);
var text2 = (key, value, x, y, extra = {}) => ({ key, text: safeText(value), x, y, size: 3.2, ...extra });
var line = (x1, y1, x2, y2, width = 0.22) => ({ x1, y1, x2, y2, width });
var weightText = (item) => item.missing ? "\u4E0D\u660E" : item.value === null ? "" : num(item.value);
var quantityText = (item) => item.quantityMissing ? "\u4E0D\u660E" : item.quantity === null ? "\u672A\u5165\u529B" : num(item.quantity);
function eraDate(value) {
  const [year, month2, day] = value.split("-").map(Number);
  const yearText = year > 2019 || year === 2019 && month2 >= 5 ? `\u4EE4\u548C${year - 2018}\u5E74` : `${year}\u5E74`;
  return `${yearText}${month2}\u6708${day}\u65E5`;
}
function wrap(value, maxChars = 48) {
  const result = [];
  for (const paragraph of safeText(value).replace(/\r\n?/g, "\n").split("\n")) {
    const chars = [...paragraph];
    if (!chars.length) result.push("");
    for (let i = 0; i < chars.length; i += maxChars) result.push(chars.slice(i, i + maxChars).join(""));
  }
  return result;
}
function identityCells(view) {
  const issuer = view.issuer || {}, recipient = view.recipient || {};
  const value = (item) => safeText(item).trim();
  const postal = (item) => value(item) ? `\u3012${value(item).replace(/^〒\s*/, "")}` : "\u90F5\u4FBF\u756A\u53F7 \u672A\u8A2D\u5B9A";
  const address = (item, missing) => value(item) ? value(item).split("\n").map((line2) => line2.trim()) : [missing];
  const recipientLines = [
    ["recipient-postal", postal(recipient.postalCode)],
    ...address(recipient.address, "\u5B9B\u5148\u4F4F\u6240 \u672A\u8A2D\u5B9A").map((line2, i) => [i ? `recipient-address-${i + 1}` : "recipient-address", line2]),
    ["recipient", `${value(view.customer.name)}\u3000\u5FA1\u4E2D`]
  ];
  const issuerLines = [
    ["issuer-postal", postal(issuer.postalCode)],
    ...address(issuer.address, "\u767A\u884C\u8005\u4F4F\u6240 \u672A\u8A2D\u5B9A").map((line2, i) => [i ? `issuer-address-${i + 1}` : "issuer-address", line2]),
    ["issuer", value(issuer.tradeName) || "\u4F1A\u793E\u540D\u30FB\u5C4B\u53F7 \u672A\u8A2D\u5B9A"],
    ["issuer-name", value(issuer.legalName) || "\u6CD5\u4EBA\u540D\u30FB\u6C0F\u540D \u672A\u8A2D\u5B9A"],
    ["issuer-registration", `\u767B\u9332\u756A\u53F7\uFF1A${value(issuer.registrationNumber) || "\u672A\u8A2D\u5B9A"}`]
  ];
  return [
    ...recipientLines.map(([key, value2], i) => text2(key, value2, INVOICE_GEOMETRY.left, 40 + i * (16 / (recipientLines.length - 1)), { maxWidth: 79, size: key === "recipient" ? 3.6 : 3.2, align: "left", forceFit: true })),
    ...issuerLines.map(([key, value2], i) => text2(key, value2, 96, 62 + i * (28 / (issuerLines.length - 1)), { maxWidth: 65, bold: key === "issuer-name", align: "left", forceFit: true }))
  ];
}
function bankCells(view) {
  return [0, 1].flatMap((index) => {
    const account = view.bankAccounts?.[index] || {};
    const configured = Object.values(account).some((value2) => String(value2 || "").trim());
    if (!configured) return [text2(`bank-${index + 1}`, `\u632F\u8FBC\u5148${index + 1}\u3000\u91D1\u878D\u6A5F\u95A2\u30FB\u652F\u5E97\u30FB\u53E3\u5EA7\u60C5\u5831\uFF1A\u672A\u8A2D\u5B9A`, INVOICE_GEOMETRY.left, index ? 243 : 236, { size: 2.9, maxWidth: 124, bold: true, forceFit: true })];
    const value = (key) => safeText(account[key]).trim() || "\u672A\u8A2D\u5B9A";
    return [
      text2(`bank-${index + 1}`, `\u632F\u8FBC\u5148${index + 1}\u3000${value("bankName")}\u3000${value("branchName")}\u3000${INVOICE_BANK_TYPES[account.accountType] || "\u53E3\u5EA7\u7A2E\u5225 \u672A\u8A2D\u5B9A"}`, INVOICE_GEOMETRY.left, index ? 242 : 233, { size: 2.9, maxWidth: 124, bold: true, forceFit: true }),
      text2(`bank-${index + 1}-account`, `\u53E3\u5EA7\u756A\u53F7\uFF1A${value("accountNumber")}\u3000\u53E3\u5EA7\u540D\u7FA9\uFF1A${value("accountHolder")}`, INVOICE_GEOMETRY.left, index ? 246 : 237, { size: 2.6, maxWidth: 124, forceFit: true })
    ];
  });
}
function invoicePage(view, hasNotes) {
  const { left, right, columns } = INVOICE_GEOMETRY;
  const cells = [
    text2("title", "\u8ACB\u6C42\u66F8", 91, 25, { size: 3.8, align: "center" }),
    text2("issue-date", eraDate(view.issueDate), 157, 33, { align: "right" }),
    ...identityCells(view),
    text2("total-label", "\u3054\u8ACB\u6C42\u91D1\u984D\u3000\xA5", left, 100),
    text2("total-top", "\u2014", 81, 100, { align: "right" })
  ];
  const rules = [line(left, 102, 82, 102), line(left, 114, right, 114), line(left, 191, right, 191), line(98, 199, right, 199)];
  const headers = ["\u54C1\u540D", "\u5358\u4FA1", "\u6570\u91CF", "\u5358\u4F4D", "\u4FA1\u683C"];
  headers.forEach((value, i) => {
    const start = left + sum(columns.slice(0, i)), width = columns[i];
    cells.push(text2(`header-${i}`, value, i === 0 ? start : i === 4 ? start + width : start + width / 2, 112, { align: i === 0 ? "left" : i === 4 ? "right" : "center" }));
  });
  const otherAmount2 = view.other.entered ? num(view.other.amount) : "\u672A\u5165\u529B";
  const lineRows = [
    [`\u7279\u5225\u6E05\u6383\u904B\u642C\u6599\uFF08${Number(view.month.slice(5))}\u6708\u5206\uFF09`, otherAmount2, view.other.entered ? "1" : "\u2014", "\u5F0F", otherAmount2],
    ...view.lines.map((item, i) => [`\u51E6\u7406\u624B\u6570\u6599\u3000${i === 0 ? "\u53EF\u71C3" : "\u4E0D\u71C3"}`, !item.entered ? "\u672A\u5165\u529B" : item.missing ? "\u4E0D\u660E\u3042\u308A" : item.rates.length === 1 ? num(item.rates[0]) : "\u8907\u6570\u5358\u4FA1", quantityText(item), "kg", !item.entered ? "\u672A\u5165\u529B" : num(item.amount)])
  ];
  lineRows.forEach((values, row) => values.forEach((value, col) => {
    const start = left + sum(columns.slice(0, col)), width = columns[col];
    cells.push(text2(`line-${row}-${col}`, value, col === 0 || col === 3 ? start : start + width - 1, 120 + row * 7, { maxWidth: width - 2, align: col === 0 || col === 3 ? "left" : "right", bold: col === 0 }));
  }));
  if (hasNotes) cells.push(text2("notes-reference", "\u203B\u54C1\u76EE\u30FB\u56DE\u53CE\u6642\u306E\u5099\u8003\u306F\u5225\u7D19\u3092\u3054\u53C2\u7167\u304F\u3060\u3055\u3044\u3002", left, 174, { size: 2.6, maxWidth: 124 }));
  cells.push(
    text2("subtotal-label", "\u53C2\u8003\u5C0F\u8A08\uFF08\u8A18\u9332\u6599\u91D1\u306E\u307F\uFF09", left, 184, { size: 2.6 }),
    text2("subtotal", view.recordedCharges === null ? "\u7B97\u51FA\u4E0D\u53EF" : `${num(view.recordedCharges)} \u5186`, 92, 184, { size: 2.6, align: "right", maxWidth: 30 }),
    text2("total-bottom-label", "\u5408\u8A08", 99, 197),
    text2("total-bottom", "\u2014", right, 197, { align: "right" }),
    text2("tax-title", "\u7A0E\u7387\u5225\u5185\u8A33", left, 205, { bold: true }),
    text2("tax-net-label", "\u7A0E\u629C\u91D1\u984D", left, 212),
    text2("tax-net", "\u2014", 84, 212, { align: "right" }),
    text2("tax-label", "\u6D88\u8CBB\u7A0E\u984D", left, 219, { size: 2.9, maxWidth: 43 }),
    text2("tax-value", "\u2014", 84, 219, { align: "right", size: 2.9 }),
    text2("tax-inclusive-label", "\u7A0E\u8FBC\u91D1\u984D", left, 226),
    text2("tax-inclusive", "\u2014", 84, 226, { align: "right" }),
    ...bankCells(view),
    text2("draft-note", view.currentSourceReference ? "\u53C2\u8003\uFF1A\u65E7\u8A18\u9332\u306F\u73FE\u5728\u306E\u30B7\u30FC\u30C8\u5358\u4FA1\u3002\u904E\u53BB\u5358\u4FA1\u672A\u78BA\u8A8D\u3002\u6B63\u5F0F\u8ACB\u6C42\u30FB\u632F\u8FBC\u306B\u306F\u4F7F\u7528\u4E0D\u53EF\u3002" : "\u898B\u672C\uFF1A\u7A0E\u8A08\u7B97\u306F\u672A\u5B9F\u88C5\u3067\u3059\u3002\u6B63\u5F0F\u306A\u8ACB\u6C42\u30FB\u632F\u8FBC\u306B\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002", left, 250, { size: 2.2, maxWidth: 124 })
  );
  [207, 214, 221, 228].forEach((y) => rules.push(line(left, y, 85, y)));
  return { kind: "invoice", cells, rules, seal: validateCanonicalSeal(view.seal ?? null) };
}
function monthlyPage(view) {
  const g = INVOICE_GEOMETRY, left = g.detailLeft, top = g.detailTop, widths = g.detailColumns, right = left + sum(widths), rowHeight = g.detailRowHeight;
  const cells = [
    text2("detail-recipient", `${view.customer.name}\u3000\u5FA1\u4E2D`, 91, 27, { size: 4.5, bold: true, align: "center", maxWidth: 132 }),
    text2("detail-period", `\u6708\u9593\u56DE\u53CE\u660E\u7D30\u3000${view.label}`, 91, 36, { size: 2.7, align: "center" })
  ];
  const rules = [line(49, 30, 133, 30, 0.3), line(49, 30.8, 133, 30.8, 0.3)];
  const bodyTop = top + 9, bodyBottom = bodyTop + view.daily.length * rowHeight, bottom = bodyBottom + 12;
  [left, ...widths.map((_, i) => left + sum(widths.slice(0, i + 1)))].forEach((x) => rules.push(line(x, top, x, bottom, x === left || x === right ? 0.5 : 0.22)));
  rules.push(line(left, top, right, top, 0.5), line(left, bodyTop, right, bodyTop, 0.32), line(left, bottom, right, bottom, 0.5));
  const headers = [["\u65E5\u4ED8", ""], ["\u53EF\u71C3\u7269", "\uFF08kg\uFF09"], ["\u4E0D\u71C3\u7269", "\uFF08kg\uFF09"], ["\u305D\u306E\u4ED6\u6599\u91D1", "\uFF08\u5186\uFF09"], ["\u5408\u8A08\u91CD\u91CF", "\uFF08kg\uFF09"]];
  headers.forEach(([value, unit], i) => {
    const x = left + sum(widths.slice(0, i)) + widths[i] / 2;
    cells.push(text2(`detail-header-${i}`, value, x, top + 3.7, { size: 3.1, align: "center" }));
    if (unit) cells.push(text2(`detail-unit-${i}`, unit, x, top + 7.2, { size: 2.6, align: "center" }));
  });
  view.daily.forEach((day, i) => {
    const y = bodyTop + (i + 1) * rowHeight;
    rules.push(line(left, y, right, y, i === view.daily.length - 1 ? 0.4 : 0.18));
    const values = [`${Number(view.month.slice(5))}\u6708${Number(day.date.slice(8))}\u65E5`, weightText(day.combustible), weightText(day.noncombustible), weightText(day.other), weightText(day.weight)];
    values.forEach((value, col) => cells.push(text2(`day-${i + 1}-${col}`, value, left + sum(widths.slice(0, col + 1)) - 1.3, y - 1.2, { size: 3.3, align: "right", maxWidth: widths[col] - 2.6, bold: col === 4 })));
  });
  const weightValues = ["\u5408\u8A08\u91CD\u91CF", ...view.lines.map((item) => item.quantityMissing ? "\u4E0D\u660E" : item.quantity === null ? "" : num(item.quantity)), "", weightText(view.totalWeight)];
  const amountValues = ["\u53C2\u8003\u91D1\u984D", ...view.lines.map((item) => !item.entered ? "" : num(item.amount)), !view.other.entered ? "" : num(view.other.amount), view.recordedCharges === null ? "\u7B97\u51FA\u4E0D\u53EF" : `\xA5${num(view.recordedCharges)}`];
  [weightValues, amountValues].forEach((values, row) => values.forEach((value, col) => cells.push(text2(`detail-total-${row}-${col}`, value, col === 0 ? left + 0.8 : left + sum(widths.slice(0, col + 1)) - 1.3, bodyBottom + 4.5 + row * 6, { size: 3.3, maxWidth: widths[col] - 2.6, align: col === 0 ? "left" : "right", bold: col === 0 || col === 4 }))));
  rules.push(line(left, bodyBottom + 6, right, bodyBottom + 6, 0.28));
  const otherX = left + sum(widths.slice(0, 3));
  rules.push(line(otherX, bodyBottom + 6, otherX + widths[3], bodyBottom, 0.25));
  cells.push(
    text2("detail-unit-note", "\u5199\u771F\u306E\u300C\u7C97\u5927\u3054\u307F\u300D\u306F\u5358\u4F4D\u672A\u78BA\u8A8D\u306E\u305F\u3081\u3001\u4FDD\u5B58\u6E08\u307F\u306E\u305D\u306E\u4ED6\u6599\u91D1\uFF08\u5186\uFF09\u3092\u8868\u793A\u3002", left, bottom + 7, { size: 2.3, maxWidth: 132 }),
    text2("detail-weight-note", "\u5408\u8A08\u91CD\u91CF\u306F\u53EF\u71C3\u7269\uFF0B\u4E0D\u71C3\u7269\u306E\u307F\u3002\u305D\u306E\u4ED6\u6599\u91D1\u3092\u91CD\u91CF\u306B\u52A0\u7B97\u3057\u307E\u305B\u3093\u3002", left, bottom + 11.5, { size: 2.3, maxWidth: 132 }),
    text2("detail-amount-note", view.currentSourceReference ? "\u53C2\u8003\u91D1\u984D\u306F\u73FE\u5728\u306E\u30B7\u30FC\u30C8\u5358\u4FA1\u3092\u542B\u307F\u3001\u904E\u53BB\u5358\u4FA1\u672A\u78BA\u8A8D\u3002\u57FA\u672C\u6599\u30FB\u7A0E\u3092\u542B\u307E\u305A\u3001\u7AEF\u6570\u51E6\u7406\u524D\u3002" : "\u53C2\u8003\u91D1\u984D\u306E\u884C\u306F\u5186\u3002\u57FA\u672C\u6599\u30FB\u7A0E\u3092\u542B\u307E\u305A\u3001\u7AEF\u6570\u51E6\u7406\u524D\u3002\u7A7A\u6B04\u306F\u672A\u5165\u529B\u3001\u4E0D\u660E\u306F\u6B20\u640D\u3042\u308A\u3002", left, bottom + 16, { size: 2.2, maxWidth: 132 })
  );
  return { kind: "monthly-detail", cells, rules };
}
function buildInvoiceDocument(view) {
  if (!view.customer) return { pages: [], notes: [], geometry: INVOICE_GEOMETRY };
  const notes = [...view.lines, view.other].flatMap((item) => item.details.map((note) => ({ category: item.title, date: note.date, text: note.text, missing: note.amount === null })));
  const pages = view.documentType === "monthly-detail" ? [monthlyPage(view)] : [invoicePage(view, notes.length > 0)];
  if (view.documentType === "invoice" && view.includeMonthlyDetail) pages.push(monthlyPage(view));
  const lines = notes.flatMap((note) => [note.category, ...wrap(`${note.date.slice(8)}\u65E5: ${note.text}${note.missing ? "\uFF08\u91D1\u984D\u672A\u5165\u529B\uFF09" : ""}`), ""]);
  for (let i = 0; i < lines.length; i += 38) {
    const cells = [
      text2("notes-title", `\u5099\u8003\u5225\u7D19\u3000${view.label}`, 15, 24, { size: 4.5, bold: true }),
      text2("notes-recipient", view.customer.name, 15, 32, { size: 3.3, maxWidth: 152 }),
      ...lines.slice(i, i + 38).map((value, row) => text2(`note-${i + row}`, value, 15, 43 + row * 5, { size: 3.1, maxWidth: 152, forceFit: true }))
    ];
    pages.push({ kind: "notes", cells, rules: [] });
  }
  return { pages, notes, geometry: INVOICE_GEOMETRY, customerName: view.customer.name, month: view.label };
}
function textSVG(item) {
  const { text: value, x, y, size = 3.2, bold, align = "left", key = "", maxWidth, forceFit = false } = item;
  const fitted = value.length > 0 && maxWidth && (forceFit || widthOf(value) * size > maxWidth);
  const fittedWidth = forceFit ? Math.min(maxWidth, widthOf(value) * size) : maxWidth;
  return `<text x="${x}" y="${y}" xml:space="preserve" font-size="${size}"${bold ? ' font-weight="700"' : ""} text-anchor="${align === "right" ? "end" : align === "center" ? "middle" : "start"}"${key ? ` data-cell="${esc2(key)}"` : ""}${fitted ? ` textLength="${fittedWidth}" lengthAdjust="spacingAndGlyphs"` : ""}>${esc2(value)}</text>`;
}
function invoicePageSVG(document2, index) {
  const page = document2.pages[index];
  if (!page) throw new Error("\u51FA\u529B\u30DA\u30FC\u30B8\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
  const g = INVOICE_GEOMETRY;
  const mark = textSVG(text2("", "SAMPLE \u30FB \u67B6\u7A7A\u30C7\u30FC\u30BF / \u8ACB\u6C42\u306B\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093", 15, 9, { size: 2.2 }));
  const rules = page.rules.map((rule) => `<line x1="${rule.x1}" y1="${rule.y1}" x2="${rule.x2}" y2="${rule.y2}" stroke="#000" stroke-width="${rule.width}"/>`).join("");
  const seal = page.kind === "invoice" ? validateCanonicalSeal(page.seal ?? null) : null;
  const box = INVOICE_SEAL_BOX;
  const sealSVG = seal ? `<image data-invoice-seal="true" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" preserveAspectRatio="xMidYMid meet" href="${seal.dataURL}"/>` : "";
  const label = page.kind === "invoice" ? "\u8ACB\u6C42\u66F8\u306E\u67B6\u7A7A\u30D7\u30EC\u30D3\u30E5\u30FC" : page.kind === "monthly-detail" ? "\u6708\u9593\u56DE\u53CE\u660E\u7D30\u306E\u67B6\u7A7A\u30D7\u30EC\u30D3\u30E5\u30FC" : "\u5099\u8003\u5225\u7D19";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.pageWidth} ${g.pageHeight}" width="${g.pixelWidth}" height="${g.pixelHeight}" role="img" aria-label="${label} ${index + 1} / ${document2.pages.length}"><rect width="${g.pageWidth}" height="${g.pageHeight}" fill="white" data-invoice-layer="paper"/>${sealSVG}<g data-invoice-layer="content" fill="#000" font-family="${esc2(FONT)}">${mark}${rules}${page.cells.map(textSVG).join("")}${document2.pages.length > 1 ? textSVG(text2("", `${index + 1} / ${document2.pages.length}`, 171, 252, { size: 2.1, align: "right" })) : ""}</g></svg>`;
}
function jpegPagesToPDF(pages) {
  if (!pages.length) throw new Error("PDF\u306B\u3059\u308B\u30DA\u30FC\u30B8\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
  const encoder = new TextEncoder(), chunks = [], offsets = [0];
  let length = 0;
  const append = (part) => {
    const bytes2 = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes2);
    length += bytes2.length;
  };
  const object2 = (id, parts) => {
    offsets[id] = length;
    append(`${id} 0 obj
`);
    for (const p of parts) append(p);
    append("\nendobj\n");
  };
  append("%PDF-1.4\n% raster invoice\n");
  object2(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  object2(2, [`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`]);
  pages.forEach((page, i) => {
    if (!(page.jpeg instanceof Uint8Array) || page.jpeg[0] !== 255 || page.jpeg[1] !== 216 || !Number.isInteger(page.width) || page.width < 1 || !Number.isInteger(page.height) || page.height < 1) throw new Error("PDF\u753B\u50CF\u304C\u4E0D\u6B63\u3067\u3059\u3002");
    const width = INVOICE_GEOMETRY.pdfWidth.toFixed(6), height = INVOICE_GEOMETRY.pdfHeight.toFixed(6);
    const id = 3 + i * 3, content = `q
${width} 0 0 ${height} 0 0 cm
/PageImage Do
Q
`;
    object2(id, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /PageImage ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`]);
    object2(id + 1, [`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>
stream
`, page.jpeg, "\nendstream"]);
    object2(id + 2, [`<< /Length ${encoder.encode(content).length} >>
stream
${content}endstream`]);
  });
  const xref = length;
  append(`xref
0 ${offsets.length}
0000000000 65535 f 
`);
  for (let i = 1; i < offsets.length; i++) append(`${String(offsets[i]).padStart(10, "0")} 00000 n 
`);
  append(`trailer
<< /Size ${offsets.length} /Root 1 0 R >>
startxref
${xref}
%%EOF
`);
  const bytes = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, position);
    position += chunk.length;
  }
  return bytes;
}
async function createInvoicePDF(view, doc = globalThis.document) {
  const document2 = buildInvoiceDocument(view), win = doc.defaultView;
  if (!document2.pages.length) throw new Error("\u51FA\u529B\u3059\u308B\u53D6\u5F15\u5148\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
  await doc.fonts?.ready;
  const pages = [];
  for (let i = 0; i < document2.pages.length; i++) {
    const svg = invoicePageSVG(document2, i), image = new win.Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("PDF\u306E\u6587\u5B57\u753B\u50CF\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002"));
      image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
    const canvas = doc.createElement("canvas");
    canvas.width = Math.round(INVOICE_GEOMETRY.pixelWidth * 2);
    canvas.height = Math.round(INVOICE_GEOMETRY.pixelHeight * 2);
    try {
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PDF\u306E\u753B\u50CF\u51FA\u529B\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.97));
      if (!blob) throw new Error("PDF\u753B\u50CF\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
      const jpeg = new Uint8Array(await blob.arrayBuffer());
      pages.push({ jpeg, width: canvas.width, height: canvas.height });
    } finally {
      canvas.width = canvas.height = 1;
      image.onload = image.onerror = null;
      image.removeAttribute?.("src");
    }
  }
  return new win.Blob([jpegPagesToPDF(pages)], { type: "application/pdf" });
}

// src/invoice.js
var esc3 = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
var SCALE = 1000000n;
var PRODUCT_SCALE = SCALE * SCALE;
function fixed(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e9) return null;
  const [whole, fraction = ""] = value.toFixed(6).split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
}
function decimal2(value, scale = PRODUCT_SCALE) {
  const digits = String(scale).length - 1;
  const fraction = (value % scale).toString().padStart(digits, "0").replace(/0+$/, "");
  return `${value / scale}${fraction ? `.${fraction}` : ""}`;
}
function number(value) {
  if (value === null) return "\u7B97\u51FA\u4E0D\u53EF";
  const [whole, fraction] = String(value).split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? `.${fraction}` : "");
}
function monthInfo(month2) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month2) || month2.slice(0, 4) === "0000") throw new Error("\u5BFE\u8C61\u5E74\u6708\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const [year, mm] = month2.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const last = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm - 1];
  return { month: month2, label: `${year}\u5E74${mm}\u6708`, days: last, endDate: `${year}\u5E74${mm}\u6708${last}\u65E5`, start: `${month2}-01`, end: `${month2}-${last}` };
}
function validateIssueDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("\u767A\u884C\u65E5\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  let dates;
  try {
    dates = monthInfo(value.slice(0, 7));
  } catch {
    throw new Error("\u767A\u884C\u65E5\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  }
  if (Number(value.slice(8)) < 1 || Number(value.slice(8)) > dates.days) throw new Error("\u767A\u884C\u65E5\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  return value;
}
function issueDateLabel(value) {
  try {
    validateIssueDate(value);
  } catch {
    return "\u65E5\u4ED8\u3092\u9078\u629E";
  }
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1\u5E74$2\u6708$3\u65E5");
}
function categoryLine(records, category, title) {
  let kg = 0n, known = 0n, entered = 0, missing = 0, quantities = 0, quantityMissing = 0;
  const rates = /* @__PURE__ */ new Set();
  const details = [];
  for (const r of records) {
    const quantity = fixed(r[`${category}Kg`]), rate = fixed(r[`${category}Rate`]);
    const note = reportNotes(r)[category];
    const relevant = quantity !== null || Boolean(note || r.itemIds?.[category] || r.itemNames?.[category]);
    if (!relevant) continue;
    if (note) details.push({ date: r.date, text: note });
    entered++;
    if (quantity !== null) {
      kg += quantity;
      quantities++;
    } else quantityMissing++;
    if (rate !== null) rates.add(decimal2(rate, SCALE));
    if (quantity === null || rate === null) missing++;
    else known += quantity * rate;
  }
  return { category, title, quantity: quantities ? decimal2(kg, SCALE) : null, quantityMissing, unit: "kg", rates: [...rates], known, amount: entered && !missing ? decimal2(known) : null, entered, missing, details };
}
function totalWeight(lines) {
  if (lines.some((line2) => line2.quantityMissing)) return { value: null, missing: true };
  if (lines.every((line2) => line2.quantity === null)) return { value: null, missing: false };
  const value = lines.reduce((total, line2) => {
    const [whole, fraction = ""] = (line2.quantity || "0").split(".");
    return total + BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
  }, 0n);
  return { value: decimal2(value, SCALE), missing: false };
}
function otherAmount(records) {
  const relevant = records.filter((r) => fixed(r.otherFee) !== null || reportNotes(r).other || r.itemIds?.other || r.itemNames?.other);
  let total = 0n, missing = false;
  for (const r of relevant) {
    const fee = fixed(r.otherFee);
    if (fee === null) missing = true;
    else total += fee;
  }
  return { value: relevant.length && !missing ? decimal2(total, SCALE) : null, missing };
}
function buildInvoicePreview(state2, { month: month2 = localDate().slice(0, 7), customerId, issueDate = localDate(), documentType = "invoice", includeMonthlyDetail = false } = {}, invoiceSettings = emptyInvoiceSettings()) {
  invoiceSettings = validateInvoiceSettings(invoiceSettings);
  const dates = monthInfo(month2);
  if (!["invoice", "monthly-detail"].includes(documentType)) throw new Error("\u51FA\u529B\u306E\u7A2E\u985E\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  if (documentType === "invoice") validateIssueDate(issueDate);
  const customers = state2.masters.customers;
  const customer = customers.find((c) => c.id === customerId) || (customerId === void 0 ? customers.find((c) => state2.records.some((r) => !r.deleted && r.customerId === c.id && r.date >= dates.start && r.date <= dates.end)) || customers[0] : null);
  const records = customer ? state2.records.filter((r) => !r.deleted && r.customerId === customer.id && r.date >= dates.start && r.date <= dates.end).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)) : [];
  const combustible = categoryLine(records, "combustible", "\u53EF\u71C3\u7269\u51E6\u5206\u6599");
  const noncombustible = categoryLine(records, "noncombustible", "\u4E0D\u71C3\u7269\u51E6\u5206\u6599");
  const otherRecords = records.filter((r) => fixed(r.otherFee) !== null || reportNotes(r).other || r.itemIds?.other || r.itemNames?.other);
  let otherKnown = 0n, otherMissing = 0;
  for (const r of otherRecords) {
    const fee = fixed(r.otherFee);
    if (fee === null) otherMissing++;
    else otherKnown += fee * SCALE;
  }
  const missing = combustible.missing + noncombustible.missing + otherMissing;
  const hasCharges = combustible.entered + noncombustible.entered + otherRecords.length > 0;
  const known = combustible.known + noncombustible.known + otherKnown;
  const other = { title: documentType === "invoice" ? "\u7279\u5225\u6E05\u6383\u904B\u642C\u6599" : "\u7C97\u5927\u3054\u307F\u30FB\u305D\u306E\u4ED6", amount: otherRecords.length && !otherMissing ? decimal2(otherKnown) : null, entered: otherRecords.length, missing: otherMissing, details: otherRecords.map((r) => ({ date: r.date, text: reportNotes(r).other || r.itemNames?.other || "\u5099\u8003\u672A\u5165\u529B", amount: fixed(r.otherFee) === null ? null : decimal2(fixed(r.otherFee), SCALE) })) };
  const daily = Array.from({ length: dates.days }, (_, i) => {
    const date = `${month2}-${String(i + 1).padStart(2, "0")}`, rows = records.filter((r) => r.date === date);
    const c = categoryLine(rows, "combustible", ""), n = categoryLine(rows, "noncombustible", "");
    return { date, count: rows.length, combustible: { value: c.quantityMissing ? null : c.quantity, missing: c.quantityMissing > 0 }, noncombustible: { value: n.quantityMissing ? null : n.quantity, missing: n.quantityMissing > 0 }, other: otherAmount(rows), weight: totalWeight([c, n]) };
  });
  const publicLine = ({ known: _known, ...line2 }) => line2;
  return { ...dates, issuer: { ...invoiceSettings.issuer }, bankAccounts: invoiceSettings.bankAccounts.map((account) => ({ ...account })), tax: { ...invoiceSettings.tax }, recipient: { postalCode: customer?.invoicePostalCode || "", address: customer?.invoiceAddress || "" }, issueDate, documentType, includeMonthlyDetail: Boolean(includeMonthlyDetail), daily, totalWeight: totalWeight([combustible, noncombustible]), customer: customer ? { id: customer.id, name: customer.name, active: customer.active } : null, count: records.length, currentSourceReference: state2.referenceCalculation?.basis === "current-source-sheet" && state2.referenceCalculation.applied.some((entry2) => records.some((record) => record.id === entry2.recordId)), lines: [publicLine(combustible), publicLine(noncombustible)], other, missing, knownCharges: hasCharges ? decimal2(known) : null, recordedCharges: hasCharges && !missing ? decimal2(known) : null, legacyUnknown: records.filter((r) => r.priceSource === "legacy-unknown").length };
}
function previewHTML(view) {
  if (!view.customer) return '<div class="empty-state">\u51FA\u529B\u3059\u308B\u53D6\u5F15\u5148\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u3067\u67B6\u7A7A\u306E\u53D6\u5F15\u5148\u3092\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044\u3002</div>';
  const document2 = buildInvoiceDocument(view);
  return document2.pages.map((page, i) => `<article class="invoice-paper" data-document-kind="${page.kind}" aria-label="${page.kind === "invoice" ? "\u8ACB\u6C42\u66F8\u306E\u67B6\u7A7A\u30D7\u30EC\u30D3\u30E5\u30FC" : page.kind === "monthly-detail" ? "\u6708\u9593\u56DE\u53CE\u660E\u7D30\u306E\u67B6\u7A7A\u30D7\u30EC\u30D3\u30E5\u30FC" : "\u5099\u8003\u5225\u7D19"}">${invoicePageSVG(document2, i)}</article>`).join("");
}
function renderInvoiceOutput(state2, selection = {}, invoiceSettings = emptyInvoiceSettings(), sealState = {}) {
  const view = { ...buildInvoicePreview(state2, selection, invoiceSettings), seal: validateCanonicalSeal(sealState.seal ?? null) };
  const options = state2.masters.customers.map((c) => `<option value="${esc3(c.id)}" ${c.id === view.customer?.id ? "selected" : ""}>${esc3(c.name)}${c.active ? "" : "\uFF08\u5229\u7528\u505C\u6B62\uFF09"}</option>`).join("");
  return `<div class="section-heading"><div><p class="eyebrow">OUTPUT</p><h1>\u51FA\u529B</h1><p class="subheading">\u5199\u771F\u306E\u8ACB\u6C42\u66F8\u30FB\u6708\u9593\u660E\u7D30\u306B\u6CBF\u3063\u305FB5\u306E\u78BA\u8A8D\u7528\u898B\u672C\u3002</p></div><span class="page-chip">${sealState.connected ? "\u78BA\u8A8D\u7528\u30FB\u53C2\u8003\u5C0F\u8A08" : "\u67B6\u7A7A\u30C7\u30FC\u30BF\u306E\u307F"}</span></div>
    <div class="invoice-controls"><label class="field"><span>\u5BFE\u8C61\u5E74\u6708</span><input type="month" id="invoice-month" min="0001-01" max="9999-12" value="${view.month}" required></label><label class="field"><span>\u53D6\u5F15\u5148</span><select id="invoice-customer" ${options ? "" : "disabled"}>${options || '<option value="">\u53D6\u5F15\u5148\u306A\u3057</option>'}</select></label>
    <label class="field"><span>\u51FA\u529B\u306E\u7A2E\u985E</span><select id="invoice-document-type"><option value="invoice" ${view.documentType === "invoice" ? "selected" : ""}>\u8ACB\u6C42\u66F8</option><option value="monthly-detail" ${view.documentType === "monthly-detail" ? "selected" : ""}>\u6708\u9593\u56DE\u53CE\u660E\u7D30\u306E\u307F</option></select></label>
    <label class="field"><span>\u767A\u884C\u65E5\uFF08\u8ACB\u6C42\u66F8\u306E\u307F\uFF09</span><span class="invoice-date-control${view.documentType === "invoice" ? "" : " is-disabled"}"><input type="date" id="invoice-issue-date" min="0001-01-01" max="9999-12-31" value="${esc3(view.issueDate)}" ${view.documentType === "invoice" ? "required" : "disabled"}><span id="invoice-issue-date-formatted" class="invoice-date-formatted" aria-hidden="true">${issueDateLabel(view.issueDate)}</span></span></label>
    <label class="invoice-optional" ${view.documentType === "invoice" ? "" : "hidden"}><input type="checkbox" id="invoice-include-detail" ${view.includeMonthlyDetail ? "checked" : ""}>\u6708\u9593\u56DE\u53CE\u660E\u7D30\u3082\u540C\u3058PDF\u306B\u542B\u3081\u308B\uFF08\u4EFB\u610F\uFF09</label>
    <section class="invoice-seal-controls" aria-labelledby="invoice-seal-title"><h2 id="invoice-seal-title">\u793E\u5370</h2><p id="invoice-seal-status" role="status">${view.seal ? sealState.isDefault ? "\u6A19\u6E96\u306E\u793E\u5370" : sealState.persisted ? "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306B\u4FDD\u5B58\u6E08\u307F" : "\u9078\u629E\u4E2D\uFF08\u518D\u8AAD\u307F\u8FBC\u307F\u3067\u89E3\u9664\uFF09" : "\u30FC"}</p><p id="invoice-seal-error" class="form-error" role="alert" hidden></p>${sealState.storageWarning ? `<p class="form-error" role="status">${esc3(sealState.storageWarning)}</p>` : ""}<details id="invoice-seal-options"><summary>\u793E\u5370\u3092\u5909\u66F4</summary><div class="invoice-seal-actions"><label class="invoice-seal-picker"><span>\u900F\u904EPNG\uFF085MB\u4EE5\u5185\uFF09</span><input id="invoice-seal-file" type="file" accept=".png,image/png" aria-label="\u793E\u5370\u306E\u753B\u50CF\u3092\u9078\u3076" aria-describedby="invoice-seal-status"></label><button type="button" class="button secondary" id="invoice-seal-remove" ${sealState.isDefault ? "disabled" : ""}>\u6A19\u6E96\u306B\u623B\u3059</button></div><label class="invoice-optional"><input type="checkbox" id="invoice-seal-persist" ${sealState.persisted ? "checked" : ""} ${view.seal && !sealState.isDefault ? "" : "disabled"}>\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306B\u4FDD\u5B58\u3059\u308B</label><details><summary>\u793E\u5370\u306E\u4FDD\u5B58\u306B\u3064\u3044\u3066</summary><p>\u900F\u904EPNG\uFF085MB\u30FB4096px\u4EE5\u5185\uFF09\u3092\u8D64\u3044\u5370\u5F71\u3068\u3057\u3066\u4F7F\u3044\u307E\u3059\u3002\u6A19\u6E96\u306E\u793E\u5370\u306F\u516C\u958B\u3055\u308C\u305F\u4F4E\u753B\u8CEA\u753B\u50CF\u3067\u3059\u3002\u9078\u3093\u3060\u753B\u50CF\u306F\u3053\u306EPWA\u304B\u3089\u5916\u90E8\u3078\u9001\u4FE1\u305B\u305A\u3001\u521D\u671F\u72B6\u614B\u3067\u306F\u958B\u3044\u3066\u3044\u308B\u30DA\u30FC\u30B8\u5185\u3060\u3051\u3067\u4FDD\u6301\u3057\u307E\u3059\u3002\u300C\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306B\u4FDD\u5B58\u3059\u308B\u300D\u3092\u9078\u3076\u3068\u6B21\u56DE\u3082\u4F7F\u3048\u307E\u3059\u3002\u5225\u306E\u7AEF\u672B\u3084\u30D6\u30E9\u30A6\u30B6\u3078\u306F\u540C\u671F\u3055\u308C\u305A\u3001\u30D6\u30E9\u30A6\u30B6\u30C7\u30FC\u30BF\u306E\u6D88\u53BB\u3067\u5931\u308F\u308C\u307E\u3059\u3002</p><p>\u5171\u6709\u7AEF\u672B\u3067\u306F\u4FDD\u5B58\u3057\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002\u4FDD\u5B58\u5148\u306F\u6697\u53F7\u5316\u3055\u308C\u305F\u4F1A\u793E\u7528\u4FDD\u7BA1\u5EAB\u3067\u306F\u306A\u304F\u3001\u3053\u306E\u30B5\u30A4\u30C8\u306E\u51E6\u7406\u3084\u30D6\u30E9\u30A6\u30B6\u306E\u5229\u7528\u8005\u304B\u3089\u30A2\u30AF\u30BB\u30B9\u3067\u304D\u307E\u3059\u3002\u300C\u6A19\u6E96\u306B\u623B\u3059\u300D\u3067\u30D6\u30E9\u30A6\u30B6\u5185\u306E\u4FDD\u5B58\u3082\u89E3\u9664\u3057\u3001\u516C\u958B\u3055\u308C\u305F\u6A19\u6E96\u306E\u793E\u5370\u306B\u623B\u308A\u307E\u3059\u3002\u4FDD\u5B58\u6E08\u307FPDF\u306F\u5909\u308F\u308A\u307E\u305B\u3093\u3002PDF\u306E\u53D7\u53D6\u4EBA\u306F\u5370\u5F71\u3092\u30B3\u30D4\u30FC\u3067\u304D\u308B\u305F\u3081\u3001\u9001\u4ED8\u5148\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002</p></details></details></section>
    <div class="invoice-actions"><button type="button" class="button primary" id="invoice-download" ${view.count ? "" : "disabled"}>PDF\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9</button><button type="button" class="button secondary" id="invoice-print" ${view.count ? "" : "disabled"}>\u5370\u5237</button></div></div>
    <div class="invoice-guide"><p>\u7528\u7D19\u306FB5\u7E26\uFF08\u66AB\u5B9A\uFF1AJIS 182\xD7257mm\uFF09\u3002\u753B\u9762\u3068PDF\u306F\u540C\u3058\u914D\u7F6E\u3067\u3059\u3002\u521D\u671F\u72B6\u614B\u3067\u306F\u6708\u9593\u56DE\u53CE\u660E\u7D30\u3082\u542B\u3081\u307E\u3059\u3002\u4E0D\u8981\u306A\u5834\u5408\u306F\u30C1\u30A7\u30C3\u30AF\u3092\u5916\u305B\u307E\u3059\u3002\u56DE\u53CE\u6642\u306E\u5099\u8003\u306F\u5225\u7D19\u306B\u5168\u4EF6\u8868\u793A\u3057\u307E\u3059\u3002PDF\u306F\u753B\u50CF\u5F62\u5F0F\u306E\u305F\u3081\u6587\u5B57\u306E\u9078\u629E\u30FB\u691C\u7D22\u306F\u3067\u304D\u307E\u305B\u3093\u3002</p><p>\u767A\u884C\u65E5\u306F\u5BFE\u8C61\u6708\u3068\u5225\u306B\u9078\u3073\u307E\u3059\u3002\u4F1A\u793E\u60C5\u5831\u30FB\u9280\u884C\u60C5\u5831\u30FB\u7A0E\u7387\u3068\u8ACB\u6C42\u5148\u4F4F\u6240\u306F\u8A2D\u5B9A\u304B\u3089\u5165\u529B\u3067\u304D\u3001${sealState.connected ? "\u767B\u9332\u30E1\u30F3\u30D0\u30FC\u3067\u5171\u6709\u3057\u307E\u3059\u3002" : "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u5185\u3060\u3051\u306B\u4FDD\u5B58\u3055\u308C\u307E\u3059\u3002Google Sheets\u306B\u306F\u63A5\u7D9A\u3057\u307E\u305B\u3093\u3002"}\u7A0E\u7387\u7B49\u3092\u4FDD\u5B58\u3057\u3066\u3082\u7A0E\u8A08\u7B97\u30FB\u7AEF\u6570\u51E6\u7406\u306E\u8A08\u7B97\u306F\u307E\u3060\u884C\u3044\u307E\u305B\u3093\u3002\u63A1\u756A\u3082\u672A\u8A2D\u5B9A\u3067\u3059\u3002\u6B63\u5F0F\u306A\u8ACB\u6C42\u984D\u306F\u8A08\u7B97\u3057\u3066\u3044\u306A\u3044\u305F\u3081\u3001\u8ACB\u6C42\u306B\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002</p><p>\u53C2\u8003\u5C0F\u8A08\u306F\u5404\u56DE\u306E\u91CD\u91CF \xD7 \u4FDD\u5B58\u6642\u306E\u5358\u4FA1\u3068\u305D\u306E\u4ED6\u6599\u91D1\u306E\u5408\u7B97\u3067\u3059\u3002\u7A0E\u306F\u542B\u3081\u305A\u3001\u5186\u5358\u4F4D\u3078\u306E\u4E38\u3081\u3082\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u305D\u306E\u4ED6\u6599\u91D1\u306E\u6708\u5408\u8A08\u3092\u300C\u7279\u5225\u6E05\u6383\u904B\u642C\u6599\u300D\u306B1\u56DE\u3060\u3051\u8868\u793A\u3057\u3001\u5225\u306E\u57FA\u672C\u6599\u306F\u52A0\u3048\u307E\u305B\u3093\u3002${view.currentSourceReference ? "\u65E7\u8A18\u9332\u306E\u5358\u4FA1\u672A\u4FDD\u5B58\u5206\u306F\u73FE\u5728\u306E\u30B7\u30FC\u30C8\u5358\u4FA1\u306B\u3088\u308B\u53C2\u8003\u8A08\u7B97\u3067\u3059\u3002\u904E\u53BB\u5358\u4FA1\u306E\u78BA\u8A8D\u30FB\u4FDD\u5B58\u306F\u884C\u3063\u3066\u3044\u307E\u305B\u3093\u3002\u30B7\u30FC\u30C8\u6708\u6B21\u306E\u4E38\u3081\u30FB\u57FA\u672C\u6599\u30FB\u7A0E\u3068\u306F\u533A\u5225\u3057\u307E\u3059\u3002" : view.legacyUnknown ? "\u65E7\u7248\u306E\u4E0D\u660E\u306A\u5358\u4FA1\u306F\u88DC\u5B8C\u3057\u3066\u3044\u307E\u305B\u3093\u3002" : ""}</p><p>\u660E\u7D30\u306E\u300C\u305D\u306E\u4ED6\u6599\u91D1\u300D\u306F\u5186\u3067\u3059\u3002\u5199\u771F\u306E\u300C\u7C97\u5927\u3054\u307F\u300D\u306E\u5358\u4F4D\u306F\u672A\u78BA\u8A8D\u306E\u305F\u3081\u533A\u5225\u3057\u3001\u5408\u8A08\u91CD\u91CF\u306B\u306F\u53EF\u71C3\u30FB\u4E0D\u71C3\u306Ekg\u3060\u3051\u3092\u52A0\u3048\u307E\u3059\u3002\u7A7A\u6B04\u306F\u672A\u5165\u529B\u3067\u30010\u3068\u306F\u5225\u3067\u3059\u3002</p></div>
    ${view.missing ? `<p class="invoice-warning">\u91CD\u91CF\u30FB\u5358\u4FA1\u30FB\u91D1\u984D\u306E\u4E0D\u660E\u307E\u305F\u306F\u672A\u5165\u529B\u304C${view.missing}\u9805\u76EE\u3042\u308A\u307E\u3059\uFF08\u4E0D\u660E\u30FB\u672A\u5165\u529B\u3042\u308A\uFF09\u3002\u53C2\u8003\u5C0F\u8A08\u306F\u7B97\u51FA\u3067\u304D\u307E\u305B\u3093\u3002\u5165\u529B\u6E08\u307F\u90E8\u5206\u306E\u53C2\u8003\u984D: ${number(view.knownCharges)} \u5186\u3002${view.lines.filter((line2) => line2.missing).map((line2) => `${esc3(line2.title)}: ${line2.missing}\u4EF6\u306E\u91CD\u91CF\u30FB\u5358\u4FA1\u304C\u4E0D\u660E\u3002`).join("")}</p>` : ""}
    ${!view.count ? '<p class="invoice-warning">\u3053\u306E\u5E74\u6708\u30FB\u53D6\u5F15\u5148\u306E\u8A18\u9332\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u91D1\u984D\u30920\u5186\u3067\u88DC\u5B8C\u3057\u3066\u3044\u307E\u305B\u3093\u3002</p>' : ""}
    <p id="invoice-error" class="form-error" role="alert" hidden></p><p id="invoice-download-status" class="invoice-download-status" role="status" aria-live="polite"></p>
    <div id="invoice-save-result" class="invoice-save-result" hidden></div>
    <div id="invoice-preview" aria-live="polite">${previewHTML(view)}</div>`;
}
function installInvoiceOutput({ doc = document, getState, print = () => doc.defaultView.print(), createPDF = createInvoicePDF, savePDF, prepareSeal = prepareInvoiceSeal, loadDefaultSeal = loadDefaultInvoiceSeal, sealStore, storageKey = INVOICE_SETTINGS_KEY, getInvoiceSettings = () => readInvoiceSettings(doc.defaultView.localStorage, storageKey).settings, validateOutput = null, prepareInitialOutput = null, coordinatedRestoration = false } = {}) {
  const host = doc.querySelector("#output-section");
  if (!host) throw new Error("\u51FA\u529B\u753B\u9762\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002");
  const win = doc.defaultView, printMedia = win.matchMedia?.("print");
  let previewEpoch = 0, authoritySnapshot = null, authorizedPrint = false, authorizedDownload = false, previewLoading = false, previewValidated = !validateOutput;
  let initialPreparation = Boolean(validateOutput && prepareInitialOutput), sealNeedsReload = false, restoringSeal = false, sealRestorePromise = Promise.resolve();
  let selection = { includeMonthlyDetail: true }, disposed = false, busy = false, revision = 0, generated = null;
  const downloadURLs = /* @__PURE__ */ new Map();
  let sealIsDefault = false, sealError = "";
  let resolveReady, rejectReady;
  const sealReady = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  void sealReady.catch(() => {
  });
  let seal = null, sealPersisted = false, sealBusy = false, sealLoading = false, sealRevision = 0, sealOperation = 0, sealStorageWarning = "";
  const privateSealStore = sealStore || createSealStore(win.indexedDB);
  const build = (options = selection) => ({ ...buildInvoicePreview(getState(), options, getInvoiceSettings()), seal, sealRevision });
  function setSealBusy(value) {
    sealBusy = value;
    for (const id of ["invoice-seal-file", "invoice-seal-remove", "invoice-seal-persist"]) {
      const element = host.querySelector(`#${id}`);
      if (element) element.disabled = value || id === "invoice-seal-persist" && (!seal || sealIsDefault) || id === "invoice-seal-remove" && sealIsDefault && !sealStorageWarning;
    }
    const status = host.querySelector("#invoice-seal-status");
    if (status && sealLoading) status.textContent = "\u793E\u5370\u3092\u78BA\u8A8D\u4E2D\u2026";
    else if (status && value) status.textContent = "\u793E\u5370\u3092\u51E6\u7406\u4E2D\u2026";
    else if (status) status.textContent = seal ? sealIsDefault ? "\u6A19\u6E96\u306E\u793E\u5370" : sealPersisted ? "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306B\u4FDD\u5B58\u6E08\u307F" : "\u9078\u629E\u4E2D\uFF08\u518D\u8AAD\u307F\u8FBC\u307F\u3067\u89E3\u9664\uFF09" : "\u30FC";
    setBusy(busy);
  }
  function showSealError(message) {
    sealError = message;
    const error = host.querySelector("#invoice-seal-error");
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }
  function replaceSeal(value, persisted = false, isDefault = false) {
    const next = validateCanonicalSeal(value);
    if (!next) throw new Error("\u793E\u5370\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3002");
    seal = next;
    sealPersisted = persisted;
    sealIsDefault = isDefault;
    sealError = "";
    sealRevision++;
    if (!initialPreparation && !restoringSeal) refresh();
  }
  async function loadSavedSeal() {
    const token = ++sealOperation;
    sealLoading = true;
    setSealBusy(true);
    try {
      let saved = null;
      if (sealStore || win.indexedDB) {
        try {
          saved = await privateSealStore.load();
        } catch {
          if (!disposed && token === sealOperation) sealStorageWarning = "\u4FDD\u5B58\u6E08\u307F\u306E\u793E\u5370\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u753B\u50CF\u306E\u4E00\u6642\u5229\u7528\u306F\u53EF\u80FD\u3067\u3059\u304C\u3001\u30D6\u30E9\u30A6\u30B6\u5185\u306E\u65E7\u4FDD\u5B58\u306F\u672A\u78BA\u8A8D\u3067\u3059\u3002";
        }
      }
      if (disposed || token !== sealOperation) return;
      if (saved) replaceSeal(saved, true);
      else {
        const standard = await loadDefaultSeal(doc);
        if (!disposed && token === sealOperation) replaceSeal(standard, false, true);
      }
    } catch {
      if (!disposed && token === sealOperation) {
        if (!initialPreparation && !restoringSeal) refresh();
        showSealError("\u6A19\u6E96\u306E\u793E\u5370\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3002\u518D\u8AAD\u307F\u8FBC\u307F\u3059\u308B\u304B\u3001\u900F\u904EPNG\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002PDF\u306F\u307E\u3060\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3002");
      }
    } finally {
      if (!disposed && token === sealOperation) {
        sealLoading = false;
        setSealBusy(false);
        if (!seal || sealError || sealStorageWarning) rejectReady(Object.assign(new Error(sealError || sealStorageWarning || "\u793E\u5370\u306E\u6E96\u5099\u304C\u5B8C\u4E86\u3057\u307E\u305B\u3093\u3067\u3057\u305F\u3002"), { code: "startup-seal" }));
        else if (sealStorageWarning) rejectReady(Object.assign(new Error(sealStorageWarning), { code: "startup-seal" }));
        else resolveReady();
      }
    }
  }
  function invalidateSealPDF() {
    revision++;
    sealRevision++;
    retireGenerated();
  }
  async function changeSealFile(file) {
    if (!file || sealBusy) return;
    invalidateSealPDF();
    const token = ++sealOperation;
    setSealBusy(true);
    try {
      const next = validateCanonicalSeal(await prepareSeal(file, doc));
      if (disposed || token !== sealOperation) return;
      if (sealPersisted) await privateSealStore.remove();
      if (disposed || token !== sealOperation) return;
      replaceSeal(next, false);
    } catch (error) {
      if (!disposed && token === sealOperation) showSealError(error.message || "\u793E\u5370\u306E\u753B\u50CF\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002");
    } finally {
      if (!disposed && token === sealOperation) {
        setSealBusy(false);
        const input = host.querySelector("#invoice-seal-file");
        if (input) input.value = "";
      }
    }
  }
  async function persistSeal(checked) {
    if (sealBusy || !seal || sealIsDefault) return;
    const token = ++sealOperation;
    setSealBusy(true);
    try {
      if (checked) await privateSealStore.save(seal);
      else await privateSealStore.remove();
      if (disposed || token !== sealOperation) return;
      sealPersisted = checked;
      sealStorageWarning = "";
      refresh();
    } catch (error) {
      if (!disposed && token === sealOperation) {
        host.querySelector("#invoice-seal-persist").checked = sealPersisted;
        showSealError(error.message || "\u793E\u5370\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
      }
    } finally {
      if (!disposed && token === sealOperation) setSealBusy(false);
    }
  }
  async function removeSeal() {
    if (sealBusy) return;
    invalidateSealPDF();
    const token = ++sealOperation;
    setSealBusy(true);
    try {
      const standard = validateCanonicalSeal(await loadDefaultSeal(doc));
      if (!standard) throw new Error("\u6A19\u6E96\u306E\u793E\u5370\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3002");
      if (disposed || token !== sealOperation) return;
      if (sealPersisted || sealStorageWarning) await privateSealStore.remove();
      sealStorageWarning = "";
      if (disposed || token !== sealOperation) return;
      replaceSeal(standard, false, true);
    } catch (error) {
      if (!disposed && token === sealOperation) showSealError(error.message || "\u4FDD\u5B58\u3057\u305F\u793E\u5370\u3092\u89E3\u9664\u3067\u304D\u307E\u305B\u3093\u3002");
    } finally {
      if (!disposed && token === sealOperation) setSealBusy(false);
    }
  }
  function retireGenerated() {
    const url = generated?.url;
    generated = null;
    const result = host.querySelector("#invoice-save-result");
    if (result) {
      result.replaceChildren();
      result.hidden = true;
    }
    if (url) {
      const status = host.querySelector("#invoice-download-status");
      if (status) status.textContent = "";
    }
    if (!url || !downloadURLs.has(url) || downloadURLs.get(url) !== null) return;
    const timer = win.setTimeout(() => {
      win.URL.revokeObjectURL(url);
      downloadURLs.delete(url);
    }, 6e4);
    downloadURLs.set(url, timer);
  }
  const deliver = savePDF || ((blob, filename, snapshot) => {
    retireGenerated();
    const url = win.URL.createObjectURL(blob), anchor = doc.createElement("a");
    generated = { url, snapshot };
    downloadURLs.set(url, null);
    anchor.id = "invoice-save-link";
    anchor.className = "button primary";
    anchor.href = url;
    anchor.download = filename;
    anchor.textContent = "PDF\u3092\u4FDD\u5B58";
    const result = host.querySelector("#invoice-save-result");
    result.replaceChildren(anchor);
    result.hidden = false;
    try {
      anchor.click();
    } catch {
    }
  });
  function setBusy(value) {
    busy = value;
    const count = (() => {
      try {
        return build(controlsSelection()).count;
      } catch {
        return 0;
      }
    })();
    for (const id of ["invoice-download", "invoice-print"]) {
      const button2 = host.querySelector(`#${id}`);
      if (button2) button2.disabled = value || previewLoading || !previewValidated || sealBusy || !seal || !count;
    }
    const button = host.querySelector("#invoice-download");
    if (button) {
      button.textContent = value ? "PDF\u3092\u4F5C\u6210\u4E2D\u2026" : "PDF\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9";
      button.setAttribute("aria-busy", String(value));
    }
  }
  function renderNow() {
    if (disposed) return;
    retireGenerated();
    revision++;
    let settings3, error;
    try {
      settings3 = validateInvoiceSettings(getInvoiceSettings());
    } catch (failure2) {
      error = failure2;
      settings3 = emptyInvoiceSettings();
    }
    const view = buildInvoicePreview(getState(), selection, settings3);
    selection = { month: view.month, customerId: view.customer?.id, issueDate: view.issueDate, documentType: view.documentType, includeMonthlyDetail: view.includeMonthlyDetail };
    const sealOptionsOpen = host.querySelector("#invoice-seal-options")?.open;
    host.innerHTML = renderInvoiceOutput(getState(), selection, settings3, { seal, persisted: sealPersisted, isDefault: sealIsDefault, storageWarning: sealStorageWarning, connected: Boolean(validateOutput) });
    setSealBusy(sealBusy);
    if (sealOptionsOpen) host.querySelector("#invoice-seal-options").open = true;
    if (sealError) showSealError(sealError);
    if (error) showError(error.message || "\u81EA\u793E\u60C5\u5831\u30FB\u8ACB\u6C42\u5148\u4F4F\u6240\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002", true);
  }
  function invalidate() {
    if (disposed) return;
    previewEpoch++;
    authoritySnapshot = null;
    previewValidated = !validateOutput;
    retireGenerated();
    revision++;
    if (validateOutput) {
      host.querySelector("#invoice-preview")?.replaceChildren();
      setBusy(busy);
    }
  }
  function refresh() {
    initialPreparation = false;
    if (validateOutput && host.hidden) {
      invalidate();
      return Promise.resolve({ ok: true, deferred: true });
    }
    return refreshValidated(validateOutput);
  }
  async function refreshPreparedSnapshot(authority) {
    initialPreparation = false;
    invalidate();
    restoreSeal();
    const request = previewEpoch;
    await sealRestorePromise;
    if (disposed || request !== previewEpoch || doc.visibilityState === "hidden" || host.hidden) return { error: Error("\u5E33\u7968\u306E\u78BA\u8A8D\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002") };
    if (sealError || sealStorageWarning || !seal) return { error: Object.assign(Error("\u793E\u5370\u306E\u6E96\u5099\u304C\u5B8C\u4E86\u3057\u307E\u305B\u3093\u3067\u3057\u305F\u3002"), { code: "startup-seal" }) };
    if (!validateOutput || !coordinatedRestoration || typeof authority?.consume !== "function") return { error: Error("\u5E33\u7968\u306E\u78BA\u8A8D\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002") };
    return refreshValidated(() => authority.consume());
  }
  function refreshValidated(validate3) {
    if (!validate3) return renderNow();
    invalidate();
    const request = previewEpoch;
    previewLoading = true;
    setBusy(busy);
    const pendingView = host.querySelector("#invoice-preview");
    if (pendingView) pendingView.textContent = "\u6700\u65B0\u306E\u8A18\u9332\u3092\u78BA\u8A8D\u3057\u3066\u3044\u307E\u3059\u2026";
    return (async () => {
      try {
        if (disposed || doc.visibilityState === "hidden") throw Error("\u753B\u9762\u306B\u623B\u3063\u3066\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        const validation = validate3();
        const authority = validation && typeof validation.then === "function" ? await validation : validation;
        if (disposed || request !== previewEpoch || doc.visibilityState === "hidden") throw Error("\u5E33\u7968\u306E\u78BA\u8A8D\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002");
        authoritySnapshot = authority;
        previewValidated = true;
        renderNow();
        return { ok: true };
      } catch (error) {
        if (!disposed && request === previewEpoch) {
          previewValidated = false;
          renderNow();
          showError(error.message, true);
        }
        return { error };
      } finally {
        if (!disposed && request === previewEpoch) {
          previewLoading = false;
          setBusy(busy);
        }
      }
    })();
  }
  function showError(message, invalid3 = false) {
    const error = host.querySelector("#invoice-error");
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
    if (invalid3) {
      retireGenerated();
      revision++;
      for (const id of ["invoice-print", "invoice-download"]) host.querySelector(`#${id}`).disabled = true;
      host.querySelector("#invoice-preview").innerHTML = '<div class="empty-state">\u5BFE\u8C61\u5E74\u6708\u30FB\u767A\u884C\u65E5\u30FB\u51FA\u529B\u306E\u7A2E\u985E\u3092\u78BA\u8A8D\u3059\u308B\u3068\u3001\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u8868\u793A\u3057\u307E\u3059\u3002</div>';
    }
  }
  function controlsSelection() {
    return { month: host.querySelector("#invoice-month")?.value || "", customerId: host.querySelector("#invoice-customer")?.value, issueDate: host.querySelector("#invoice-issue-date")?.value || "", documentType: host.querySelector("#invoice-document-type")?.value || "invoice", includeMonthlyDetail: Boolean(host.querySelector("#invoice-include-detail")?.checked) };
  }
  const updateIssueDateLabel = (event) => {
    if (event.target.id === "invoice-issue-date") {
      const label = host.querySelector("#invoice-issue-date-formatted");
      if (label) label.textContent = issueDateLabel(event.target.value);
    }
  };
  const change = (event) => {
    if (event.target.id === "invoice-seal-file") {
      void changeSealFile(event.target.files?.[0]);
      return;
    }
    if (event.target.id === "invoice-seal-persist") {
      void persistSeal(event.target.checked);
      return;
    }
    if (!["invoice-month", "invoice-customer", "invoice-issue-date", "invoice-document-type", "invoice-include-detail"].includes(event.target.id)) return;
    updateIssueDateLabel(event);
    const focusId = event.target.id;
    const next = controlsSelection();
    try {
      build(next);
      selection = next;
      refresh();
      host.querySelector(`#${focusId}`).focus();
    } catch (error) {
      showError(error.message, true);
    }
  };
  const click = async (event) => {
    if (event.target.closest("#invoice-seal-remove")) {
      await removeSeal();
      return;
    }
    const saveLink = event.target.closest("#invoice-save-link");
    if (saveLink) {
      if (validateOutput && !authorizedDownload) {
        event.preventDefault();
        const saved = generated;
        try {
          await validateOutput(authoritySnapshot);
          if (disposed || doc.visibilityState === "hidden" || host.hidden || saved !== generated) return;
          authorizedDownload = true;
          saveLink.click();
        } catch (error) {
          retireGenerated();
          showError(error.message, true);
        } finally {
          authorizedDownload = false;
        }
        return;
      }
      let current = false;
      try {
        current = !disposed && !sealBusy && !host.hidden && Boolean(generated) && saveLink.getAttribute("href") === generated.url && JSON.stringify(build(controlsSelection())) === generated.snapshot;
      } catch {
      }
      if (!current) {
        event.preventDefault();
        retireGenerated();
        host.querySelector("#invoice-download-status").textContent = "";
        showError("\u5BFE\u8C61\u3084\u8A18\u9332\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002\u6700\u65B0\u306E\u5185\u5BB9\u3067PDF\u3092\u4F5C\u308A\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      }
      return;
    }
    const button = event.target.closest("#invoice-print, #invoice-download");
    if (!button || button.disabled || busy || sealBusy || !seal) return;
    try {
      const chosen = JSON.stringify(controlsSelection());
      if (validateOutput) {
        setBusy(true);
        authoritySnapshot = await validateOutput();
        if (disposed || doc.visibilityState === "hidden" || host.hidden) return;
        if (chosen !== JSON.stringify(controlsSelection())) throw Error("\u5BFE\u8C61\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      }
      renderNow();
      const view = build();
      if (!view.count) return;
      if (button.id === "invoice-print") {
        const original = JSON.stringify(view);
        if (validateOutput) await validateOutput(authoritySnapshot);
        if (disposed || doc.visibilityState === "hidden" || host.hidden) return;
        if (original !== JSON.stringify(build(controlsSelection()))) throw Error("\u5BFE\u8C61\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        authorizedPrint = true;
        doc.body.classList.add("invoice-printing");
        try {
          print();
        } finally {
          authorizedPrint = false;
        }
        return;
      }
      const started = revision, snapshot = JSON.stringify(view);
      setBusy(true);
      host.querySelector("#invoice-download-status").textContent = "PDF\u3092\u4F5C\u6210\u3057\u3066\u3044\u307E\u3059\u3002";
      const blob = await createPDF(view, doc);
      if (validateOutput) await validateOutput(authoritySnapshot);
      if (disposed || host.hidden || doc.visibilityState === "hidden") return;
      if (sealBusy || revision !== started || JSON.stringify(build()) !== snapshot) {
        host.querySelector("#invoice-download-status").textContent = "";
        showError("\u4F5C\u6210\u4E2D\u306B\u5BFE\u8C61\u3084\u8A18\u9332\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002\u6700\u65B0\u306E\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u3001\u3082\u3046\u4E00\u5EA6PDF\u3092\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        return;
      }
      await deliver(blob, `${view.documentType === "monthly-detail" ? "monthly-detail" : "invoice"}-sample-${view.month}.pdf`, snapshot);
      if (disposed) return;
      host.querySelector("#invoice-download-status").textContent = savePDF ? "PDF\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F\u3002" : "PDF\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F\u3002\u4FDD\u5B58\u304C\u59CB\u307E\u3089\u306A\u3044\u5834\u5408\u306F\u300CPDF\u3092\u4FDD\u5B58\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
    } catch (error) {
      finishPrint();
      if (!disposed) {
        host.querySelector("#invoice-download-status").textContent = "";
        showError(error?.message || "PDF\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5370\u5237\u304B\u3089\u306E\u4FDD\u5B58\u3082\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002");
      }
    } finally {
      if (!disposed) setBusy(false);
    }
  };
  function finishPrint() {
    doc.body.classList.remove("invoice-printing");
  }
  function beforePrint() {
    if (validateOutput) {
      if (!authorizedPrint) {
        finishPrint();
        host.querySelector("#invoice-preview")?.replaceChildren();
      }
      return;
    }
    if (host.hidden || sealBusy || !seal || !host.querySelector(".invoice-paper")) {
      finishPrint();
      return;
    }
    try {
      refresh();
      doc.body.classList.toggle("invoice-printing", build().count > 0);
    } catch {
      finishPrint();
    }
  }
  const printMediaChange = (event) => {
    if (!event.matches) finishPrint();
  };
  const settingsChanged = (event) => {
    if (!disposed && event.detail?.storageKey === storageKey) refresh();
  };
  const storageChanged = (event) => {
    if (validateOutput) return;
    if (!disposed && (event.key === storageKey || event.key === null)) refresh();
  };
  doc.addEventListener("invoice-settings-change", settingsChanged);
  win.addEventListener("storage", storageChanged);
  host.addEventListener("input", updateIssueDateLabel);
  host.addEventListener("change", change);
  host.addEventListener("click", click);
  win.addEventListener("beforeprint", beforePrint);
  win.addEventListener("afterprint", finishPrint);
  printMedia?.addEventListener("change", printMediaChange);
  const clearSealMemory = () => {
    initialPreparation = false;
    sealNeedsReload = true;
    sealOperation++;
    seal = null;
    sealIsDefault = false;
    sealError = "";
    sealPersisted = false;
    sealRevision++;
    sealBusy = true;
    sealLoading = true;
    retireGenerated();
    host.querySelectorAll("[data-invoice-seal]").forEach((element) => element.remove());
    const input = host.querySelector("#invoice-seal-file");
    if (input) input.value = "";
    setSealBusy(true);
  };
  const restoreSeal = () => {
    if (!disposed && sealNeedsReload && doc.visibilityState !== "hidden") {
      sealNeedsReload = false;
      restoringSeal = Boolean(validateOutput && coordinatedRestoration);
      if (restoringSeal) invalidate();
      else refresh();
      sealRestorePromise = loadSavedSeal().finally(() => {
        restoringSeal = false;
      });
    }
  };
  const pageShow = () => restoreSeal();
  win.addEventListener("pagehide", clearSealMemory);
  win.addEventListener("pageshow", pageShow);
  if (!validateOutput) refresh();
  const cloudHidden = () => {
    if (doc.visibilityState !== "hidden") restoreSeal();
    if (validateOutput && doc.visibilityState === "hidden") {
      previewEpoch++;
      retireGenerated();
      finishPrint();
      host.querySelector("#invoice-preview")?.replaceChildren();
    }
  };
  doc.addEventListener("visibilitychange", cloudHidden);
  const ready = (async () => {
    try {
      await sealReady;
      if (validateOutput) {
        const validate3 = initialPreparation ? prepareInitialOutput : validateOutput;
        initialPreparation = false;
        const result = await refreshValidated(validate3);
        if (!result?.ok && result?.error?.code !== "BILLING_NOT_READY") throw result?.error || Error("\u5E33\u7968\u306E\u6E96\u5099\u304C\u5B8C\u4E86\u3057\u307E\u305B\u3093\u3067\u3057\u305F\u3002");
      }
    } finally {
      initialPreparation = false;
    }
  })();
  void ready.catch(() => {
  });
  void loadSavedSeal();
  return { ready, refresh, refreshPreparedSnapshot, invalidate, destroy() {
    doc.removeEventListener("visibilitychange", cloudHidden);
    previewEpoch++;
    rejectReady(Object.assign(new Error("\u8D77\u52D5\u6E96\u5099\u304C\u7D42\u4E86\u3057\u307E\u3057\u305F\u3002"), { code: "startup-seal" }));
    disposed = true;
    revision++;
    clearSealMemory();
    win.removeEventListener("pagehide", clearSealMemory);
    win.removeEventListener("pageshow", pageShow);
    doc.removeEventListener("invoice-settings-change", settingsChanged);
    win.removeEventListener("storage", storageChanged);
    finishPrint();
    retireGenerated();
    host.removeEventListener("input", updateIssueDateLabel);
    host.removeEventListener("change", change);
    host.removeEventListener("click", click);
    win.removeEventListener("beforeprint", beforePrint);
    win.removeEventListener("afterprint", finishPrint);
    printMedia?.removeEventListener("change", printMediaChange);
  } };
}

// src/input-assist.js
function installInputAssist({ win = window, doc = document } = {}) {
  const toolbar = doc.createElement("div");
  toolbar.className = "input-assist";
  toolbar.hidden = true;
  toolbar.setAttribute("role", "group");
  toolbar.setAttribute("aria-label", "\u6570\u5024\u5165\u529B\u306E\u64CD\u4F5C");
  toolbar.innerHTML = '<span class="input-assist-label">\u6570\u5024\u5165\u529B</span><button type="button" data-input-next>\u6B21\u306E\u9805\u76EE <span aria-hidden="true">\u2193</span></button><button type="button" data-input-done>\u5165\u529B\u5B8C\u4E86</button>';
  doc.body.append(toolbar);
  const next = toolbar.querySelector("[data-input-next]"), done = toolbar.querySelector("[data-input-done]");
  let active = null;
  const editable = (el) => el?.matches?.("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=file]):not([type=color]):not([type=range]):not([type=reset]),select,textarea") && !el.disabled && !el.readOnly && !el.matches(":disabled") && !el.closest("[hidden],[inert],details:not([open])") && win.getComputedStyle(el).display !== "none" && win.getComputedStyle(el).visibility !== "hidden" && ![...ancestors(el)].some((x) => win.getComputedStyle(x).display === "none");
  function* ancestors(el) {
    for (let p = el.parentElement; p; p = p.parentElement) yield p;
  }
  const following = () => {
    if (!active?.isConnected) return null;
    const scope = active.form || active.closest("dialog") || doc;
    const fields2 = [...scope.querySelectorAll("input,select,textarea")].filter(editable);
    return fields2[fields2.indexOf(active) + 1] || null;
  };
  function position() {
    if (toolbar.hidden) return;
    const v = win.visualViewport;
    const gap = v ? Math.max(0, win.innerHeight - v.height - v.offsetTop) : 0;
    toolbar.style.bottom = `${gap + 8}px`;
    if (v) {
      toolbar.style.left = `${v.offsetLeft + 8}px`;
      toolbar.style.width = `${Math.max(0, v.width - 16)}px`;
    } else {
      toolbar.style.left = "8px";
      toolbar.style.width = "calc(100% - 16px)";
    }
  }
  function hide() {
    active = null;
    toolbar.hidden = true;
    doc.body.classList.remove("numeric-input-active");
  }
  function show(el) {
    active = el;
    const host = el.closest("dialog[open]") || doc.body;
    if (toolbar.parentElement !== host) host.append(toolbar);
    if (next.disabled !== !following()) next.disabled = !following();
    toolbar.hidden = false;
    doc.body.classList.add("numeric-input-active");
    position();
  }
  const onFocus = (e) => {
    if (e.target.matches?.("input[type=number],input[inputmode=decimal],input[inputmode=numeric]") && editable(e.target)) show(e.target);
    else if (!toolbar.contains(e.target)) hide();
  };
  const onBlur = (e) => {
    if (e.target !== active) return;
    if (toolbar.contains(e.relatedTarget)) return;
    hide();
  };
  function advance() {
    const target = following();
    if (target) {
      target.focus();
      target.scrollIntoView?.({ block: "center", behavior: "auto" });
    } else {
      active?.blur();
      hide();
    }
  }
  const finish = () => {
    active?.blur();
    hide();
  };
  const preserve = (e) => {
    if (e.target.closest("button")) e.preventDefault();
  };
  const key = (e) => {
    if (e.key === "Enter" && e.target === active && !e.isComposing && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      advance();
    } else if (e.key === "Escape" && e.target === active) {
      finish();
    }
  };
  doc.addEventListener("focusin", onFocus);
  doc.addEventListener("focusout", onBlur);
  doc.addEventListener("keydown", key);
  toolbar.addEventListener("pointerdown", preserve);
  next.addEventListener("click", advance);
  done.addEventListener("click", finish);
  win.addEventListener("resize", position);
  win.visualViewport?.addEventListener("resize", position);
  win.visualViewport?.addEventListener("scroll", position);
  const observer = new win.MutationObserver(() => {
    if (active) {
      if (!editable(active) || !active.isConnected) hide();
      else {
        const disabled = !following();
        if (next.disabled !== disabled) next.disabled = disabled;
      }
    }
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "disabled", "open", "inert"] });
  return () => {
    observer.disconnect();
    doc.removeEventListener("focusin", onFocus);
    doc.removeEventListener("focusout", onBlur);
    doc.removeEventListener("keydown", key);
    win.removeEventListener("resize", position);
    win.visualViewport?.removeEventListener("resize", position);
    win.visualViewport?.removeEventListener("scroll", position);
    hide();
    toolbar.remove();
  };
}

// src/updates.js
var APP_VERSION = "0.5.29";
var RELEASE_CHANGES = ["\u5168\u4EF6\u8AAD\u307F\u8FBC\u307F\u65B9\u5F0F\u3092\u7DAD\u6301\u3057\u3001\u30ED\u30B0\u30A4\u30F3\u4E2D\u306B\u516C\u958B\u8CC7\u6750\u3092\u5148\u884C\u6E96\u5099\u3002", "\u8A8D\u8A3C\u78BA\u8A8D\u3068\u5168\u4EF6\u53D6\u5F97\u306E\u6E96\u5099\u3092\u4E26\u884C\u3057\u3001\u9032\u884C\u4E2D\u306E\u672C\u4EBA\u78BA\u8A8D\u3092\u91CD\u8907\u3055\u305B\u305A\u5171\u6709\u3002", "\u5225\u30A2\u30AB\u30A6\u30F3\u30C8\u30FB\u30ED\u30B0\u30A2\u30A6\u30C8\u30FB\u4E2D\u65AD\u6642\u306E\u5148\u884C\u53D6\u5F97\u7D50\u679C\u306F\u8868\u793A\u3057\u307E\u305B\u3093\u3002"];
function startUpdates({ win = window, doc = document, guard = (fn) => fn(), canReload = () => true, reload = () => win.location.reload(), recovery = false } = {}) {
  let disposed = false;
  const removers = [];
  const listen = (target, type, fn) => {
    if (!target || disposed) return;
    target.addEventListener(type, fn);
    removers.push(() => target.removeEventListener(type, fn));
  };
  const checkButton = doc.querySelector("#check-update"), applyButton = doc.querySelector("#apply-update"), status = doc.querySelector("#update-status"), notice2 = doc.querySelector("#update-notice");
  const sw = win.navigator.serviceWorker;
  let registration = null, checking = false, applying = false, controllerChanged = false, lastCheck = 0, hadController = !!sw?.controller, availableVersion = null, availableChanges = [], hasUpdate = false, automaticPromptShown = /* @__PURE__ */ new Set(), activationTimer = null, applyAttempt = 0;
  const panel = doc.querySelector(".app-updates");
  if (applyButton) applyButton.hidden = true;
  const updateDialog = doc.createElement("dialog");
  updateDialog.id = "available-update-dialog";
  updateDialog.className = "available-update-dialog";
  updateDialog.setAttribute("aria-labelledby", "available-update-title");
  updateDialog.innerHTML = '<div class="dialog-head"><h2 id="available-update-title">\u5FC5\u305A\u66F4\u65B0\u3057\u3066\u304F\u3060\u3055\u3044</h2></div><div class="dialog-body"><h3>\u66F4\u65B0\u5185\u5BB9</h3><div id="available-update-changes" class="preserve-lines"></div><p>\u4FDD\u5B58\u6E08\u307F\u30C7\u30FC\u30BF\u3092\u6B8B\u3057\u3066\u66F4\u65B0\u3057\u307E\u3059\u3002\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u3066\u3001\u3053\u306E\u307E\u307E\u5229\u7528\u3059\u308B\u3053\u3068\u3082\u3067\u304D\u307E\u3059\u3002</p></div><div class="dialog-foot"><button type="button" class="button primary" id="available-update-apply">\u66F4\u65B0</button><button type="button" class="button secondary" id="available-update-cancel">\u30AD\u30E3\u30F3\u30BB\u30EB</button></div>';
  doc.body.append(updateDialog);
  const closePrompt = () => {
    if (updateDialog.open) {
      if (updateDialog.close) updateDialog.close();
      else updateDialog.removeAttribute("open");
    }
  };
  listen(doc.querySelector("#available-update-cancel"), "click", closePrompt);
  listen(doc.querySelector("#available-update-apply"), "click", () => {
    closePrompt();
    void check({ manual: true });
  });
  const showPrompt = () => {
    if (disposed || !availableVersion || automaticPromptShown.has(availableVersion) || applying) return;
    automaticPromptShown.add(availableVersion);
    doc.querySelector("#available-update-changes").textContent = changeText(availableVersion, availableChanges);
    if (updateDialog.showModal) updateDialog.showModal();
    else updateDialog.setAttribute("open", "");
  };
  let toast = doc.querySelector("#update-toast");
  if (!toast) {
    toast = doc.createElement("section");
    toast.id = "update-toast";
    doc.body.append(toast);
  }
  toast.removeAttribute("role");
  toast.removeAttribute("aria-live");
  toast.setAttribute("aria-labelledby", "update-toast-title");
  toast.hidden = true;
  const toastHeader = doc.createElement("div");
  toastHeader.className = "update-toast-header";
  const toastTitle = doc.createElement("h2");
  toastTitle.id = "update-toast-title";
  toastTitle.textContent = "\u66F4\u65B0\u5185\u5BB9";
  const toastClose = doc.createElement("button");
  toastClose.type = "button";
  toastClose.className = "update-toast-close";
  toastClose.textContent = "\u9589\u3058\u308B";
  toastClose.setAttribute("aria-label", "\u66F4\u65B0\u5185\u5BB9\u3092\u9589\u3058\u308B");
  const toastBody = doc.createElement("div");
  toastBody.className = "update-toast-body";
  toastBody.tabIndex = 0;
  toastBody.setAttribute("role", "status");
  toastBody.setAttribute("aria-live", "polite");
  toastBody.setAttribute("aria-atomic", "true");
  toastBody.setAttribute("aria-label", "\u66F4\u65B0\u5185\u5BB9\u306E\u8A73\u7D30");
  toastHeader.append(toastTitle, toastClose);
  toast.replaceChildren(toastHeader, toastBody);
  listen(toastClose, "click", () => {
    const restoreFocus = toast.contains(doc.activeElement);
    toast.hidden = true;
    toast.classList.remove("visible");
    if (restoreFocus) checkButton?.focus();
  });
  const flash = (text3, state2) => {
    if (disposed) return;
    toastBody.textContent = text3;
    toast.dataset.state = state2;
    toast.hidden = false;
    toast.classList.add("visible");
  };
  const buttonState = (state2) => {
    if (disposed || !checkButton) return;
    checkButton.dataset.state = state2;
    checkButton.classList.toggle("update-ready", hasUpdate);
    checkButton.textContent = state2 === "checking" ? "\u78BA\u8A8D\u4E2D\u2026" : state2 === "applying" ? "\u66F4\u65B0\u4E2D\u2026" : hasUpdate ? "\u66F4\u65B0\u3042\u308A" : state2 === "error" ? "\u66F4\u65B0\u3092\u518D\u78BA\u8A8D" : "\u66F4\u65B0";
    checkButton.setAttribute("aria-label", hasUpdate ? "\u65B0\u3057\u3044\u7248\u304C\u3042\u308A\u307E\u3059\u3002\u5909\u66F4\u5185\u5BB9\u3092\u78BA\u8A8D" : "\u30A2\u30D7\u30EA\u306E\u66F4\u65B0\u3092\u78BA\u8A8D");
  };
  const changeText = (version, changes) => `v${version} \u306E\u5909\u66F4\u5185\u5BB9
${changes.length ? changes.map((x) => "\u30FB" + x).join("\n") : "\u5909\u66F4\u5185\u5BB9\u306E\u8A73\u7D30\u306F\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002"}`;
  try {
    const applied = win.sessionStorage.getItem("collection-note-applied-version");
    if (applied) {
      win.sessionStorage.removeItem("collection-note-applied-version");
      if (applied === APP_VERSION) flash("\u66F4\u65B0\u3057\u307E\u3057\u305F\u3002\n" + changeText(APP_VERSION, RELEASE_CHANGES), "applied");
    }
  } catch {
  }
  const say = (text3) => {
    if (!disposed && status) status.textContent = text3;
  };
  const ready = () => {
    if (disposed) return;
    hasUpdate = true;
    buttonState("ready");
    if (panel) panel.hidden = false;
    if (notice2) notice2.hidden = false;
    if (applyButton) applyButton.hidden = true;
    say("\u65B0\u3057\u3044\u7248\u306E\u6E96\u5099\u304C\u3067\u304D\u307E\u3057\u305F\u3002\u4FDD\u5B58\u6E08\u307F\u30C7\u30FC\u30BF\u3092\u6B8B\u3057\u3066\u66F4\u65B0\u3067\u304D\u307E\u3059\u3002");
  };
  const clearActivation = () => {
    if (activationTimer !== null) win.clearTimeout(activationTimer);
    activationTimer = null;
  };
  const doReload = () => {
    if (disposed) return;
    clearActivation();
    applying = false;
    if (canReload()) {
      try {
        win.sessionStorage.setItem("collection-note-applied-version", availableVersion || APP_VERSION);
      } catch {
      }
      reload();
    } else {
      ready();
      say("\u65B0\u3057\u3044\u7248\u306E\u6E96\u5099\u304C\u3067\u304D\u307E\u3057\u305F\u3002\u5165\u529B\u4E2D\u306E\u5185\u5BB9\u3092\u4FDD\u5B58\u3057\u3066\u304B\u3089\u66F4\u65B0\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    }
  };
  const waitInstall = (worker) => new Promise((resolve, reject) => {
    if (!worker) return resolve();
    let timer;
    const done = () => {
      if (["installed", "activated", "redundant"].includes(worker.state)) {
        worker.removeEventListener("statechange", done);
        win.clearTimeout(timer);
        worker.state === "redundant" ? reject(new Error("\u65B0\u7248\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002")) : resolve();
      }
    };
    worker.addEventListener("statechange", done);
    timer = win.setTimeout(() => {
      worker.removeEventListener("statechange", done);
      reject(new Error("\u66F4\u65B0\u6E96\u5099\u304C\u5B8C\u4E86\u3057\u307E\u305B\u3093\u3067\u3057\u305F\u3002"));
    }, 15e3);
    done();
  });
  const workerVersion = () => new Promise((resolve) => {
    if (!sw?.controller || !win.MessageChannel) return resolve(null);
    const channel = new win.MessageChannel();
    const timer = win.setTimeout(() => {
      channel.port1.close();
      resolve(null);
    }, 1500);
    channel.port1.onmessage = (e) => {
      win.clearTimeout(timer);
      channel.port1.close();
      resolve(e.data?.version ?? null);
    };
    sw.controller.postMessage({ type: "GET_VERSION" }, [channel.port2]);
  });
  const ensureRegistration = async () => {
    if (disposed) throw Error("Disposed");
    if (!registration) {
      registration = await sw.register("./sw.js", { updateViaCache: "none" });
      if (disposed) throw Error("Disposed");
      listen(registration, "updatefound", () => {
        const worker = registration.installing;
        if (worker) waitInstall(worker).then(() => {
          if (registration.waiting) {
            ready();
            void check({ force: true });
          }
        }).catch(() => say("\u65B0\u3057\u3044\u7248\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u4ECA\u306E\u753B\u9762\u3068\u4FDD\u5B58\u30C7\u30FC\u30BF\u306F\u6B8B\u3063\u3066\u3044\u307E\u3059\u3002"));
      });
      if (registration.waiting) ready();
    }
    return registration;
  };
  async function check({ manual = false, force = false } = {}) {
    if (disposed || checking || applying) return;
    if (!manual && !force && Date.now() - lastCheck < 6e4) return;
    lastCheck = Date.now();
    checking = true;
    if (checkButton) checkButton.disabled = true;
    buttonState("checking");
    say("\u516C\u958B\u4E2D\u306E\u7248\u3068\u63A5\u7D9A\u3092\u78BA\u8A8D\u3057\u3066\u3044\u307E\u3059\u2026");
    if (manual) flash("\u66F4\u65B0\u3092\u78BA\u8A8D\u3057\u3066\u3044\u307E\u3059\u2026", "checking");
    try {
      if (!sw) throw new Error("\u3053\u306E\u74B0\u5883\u3067\u306F\u30A2\u30D7\u30EA\u5185\u66F4\u65B0\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002");
      const response = await win.fetch("./version.json?check=" + Date.now(), { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("\u516C\u958B\u5148\u3078\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093\u3002");
      const data = await response.json();
      if (disposed) return;
      if (typeof data.version !== "string" || !/^\d+\.\d+\.\d+$/.test(data.version)) throw new Error("\u516C\u958B\u7248\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
      availableVersion = data.version;
      availableChanges = Array.isArray(data.changes) ? data.changes.filter((x) => typeof x === "string").slice(0, 12).map((x) => x.slice(0, 180)) : data.version === APP_VERSION ? RELEASE_CHANGES : [];
      const reg = await ensureRegistration();
      await reg.update();
      await waitInstall(reg.installing);
      if (disposed) return;
      if (reg.waiting) {
        ready();
        if (manual) apply();
        else showPrompt();
        return;
      }
      const active = await workerVersion();
      if (disposed) return;
      if (controllerChanged || active && active !== APP_VERSION || recovery) {
        ready();
        if (manual) apply();
        else showPrompt();
        return;
      }
      if (data.version !== APP_VERSION) throw new Error("\u65B0\u3057\u3044\u7248\u304C\u3042\u308A\u307E\u3059\u304C\u3001\u6E96\u5099\u3092\u5B8C\u4E86\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5C11\u3057\u5F8C\u3067\u66F4\u65B0\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      hasUpdate = false;
      closePrompt();
      buttonState("current");
      if (notice2) notice2.hidden = true;
      if (applyButton) applyButton.hidden = true;
      if (panel) panel.hidden = true;
      if (manual) flash("\u6700\u65B0\u3067\u3059\u3002\u66F4\u65B0\u306F\u4E0D\u8981\u3067\u3059\u3002\n" + changeText(APP_VERSION, RELEASE_CHANGES), "current");
      say(`\u8868\u793A\u4E2D v${APP_VERSION} \u306F\u516C\u958B\u4E2D\u306E\u7248\u3068\u4E00\u81F4\u3057\u3066\u3044\u307E\u3059\u3002\u4FDD\u5B58\u30C7\u30FC\u30BF\u306F\u5909\u66F4\u3057\u3066\u3044\u307E\u305B\u3093\u3002`);
    } catch (error) {
      buttonState("error");
      if (manual) flash("\u66F4\u65B0\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u4FDD\u5B58\u30C7\u30FC\u30BF\u306F\u6B8B\u3063\u3066\u3044\u307E\u3059\u3002\n" + error.message, "error");
      say(`${error.message} \u4ECA\u306E\u753B\u9762\u3068\u4FDD\u5B58\u30C7\u30FC\u30BF\u306F\u6B8B\u3057\u3066\u3044\u307E\u3059\u3002\u901A\u4FE1\u3092\u78BA\u8A8D\u3057\u3066\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002`);
    } finally {
      checking = false;
      if (!disposed && checkButton) checkButton.disabled = false;
    }
  }
  function apply() {
    if (disposed || applying) return;
    closePrompt();
    guard(async () => {
      if (disposed) return;
      if (!canReload()) {
        ready();
        say("\u5165\u529B\u4E2D\u306E\u5185\u5BB9\u3092\u4FDD\u5B58\u3057\u3066\u304B\u3089\u66F4\u65B0\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        return;
      }
      applying = true;
      clearActivation();
      const attempt = ++applyAttempt;
      try {
        const reg = await ensureRegistration();
        if (disposed) return;
        if (!reg.waiting && !controllerChanged && !recovery) {
          const active = await workerVersion();
          if (disposed) return;
          if (!active || active === APP_VERSION) {
            applying = false;
            await check({ manual: true });
            return;
          }
        }
        if (reg.waiting) {
          say("\u66F4\u65B0\u3092\u9069\u7528\u3057\u3066\u3044\u307E\u3059\u2026");
          buttonState("applying");
          flash("\u66F4\u65B0\u3092\u9069\u7528\u3057\u3066\u3044\u307E\u3059\u2026\n" + changeText(availableVersion || APP_VERSION, availableChanges), "applying");
          activationTimer = win.setTimeout(() => {
            if (applying && attempt === applyAttempt) {
              activationTimer = null;
              applying = false;
              ready();
              say("\u9069\u7528\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30C7\u30FC\u30BF\u3092\u6D88\u3055\u305A\u3001\u66F4\u65B0\u3092\u78BA\u8A8D\u3057\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
              flash("\u9069\u7528\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30C7\u30FC\u30BF\u3092\u6D88\u3055\u305A\u3001\u66F4\u65B0\u3092\u78BA\u8A8D\u3057\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "error");
            }
          }, 15e3);
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        } else doReload();
      } catch {
        clearActivation();
        applying = false;
        say("\u66F4\u65B0\u3092\u9069\u7528\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u4FDD\u5B58\u30C7\u30FC\u30BF\u306F\u5909\u66F4\u3057\u3066\u3044\u307E\u305B\u3093\u3002");
        flash("\u66F4\u65B0\u3092\u9069\u7528\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u4FDD\u5B58\u30C7\u30FC\u30BF\u306F\u5909\u66F4\u3057\u3066\u3044\u307E\u305B\u3093\u3002", "error");
      }
    });
  }
  listen(checkButton, "click", () => check({ manual: true }));
  listen(applyButton, "click", apply);
  if (sw) {
    listen(sw, "controllerchange", () => {
      const first = !hadController;
      hadController = true;
      if (first && !recovery && !applying) return;
      controllerChanged = true;
      if (applying) doReload();
      else ready();
    });
    listen(doc, "visibilitychange", () => {
      if (doc.visibilityState === "visible") check();
    });
    listen(win, "online", () => check());
    ensureRegistration().then(() => check()).catch(() => say("\u66F4\u65B0\u6A5F\u80FD\u3092\u958B\u59CB\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u4ECA\u306E\u753B\u9762\u3068\u4FDD\u5B58\u30C7\u30FC\u30BF\u306F\u6B8B\u3063\u3066\u3044\u307E\u3059\u3002"));
  } else say("\u3053\u306E\u74B0\u5883\u3067\u306F\u30A2\u30D7\u30EA\u5185\u66F4\u65B0\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002");
  return { check, apply, dispose() {
    if (disposed) return;
    disposed = true;
    clearActivation();
    applyAttempt++;
    for (const remove of removers) remove();
    closePrompt();
    updateDialog.remove();
    toast.remove();
  } };
}

// src/original-app.js
async function startOriginalApp({ doc = globalThis.document, adapter = null, services = {} } = {}) {
  const document2 = doc, window2 = doc.defaultView, location2 = window2.location, history = window2.history, navigator = window2.navigator, FormData = window2.FormData, ResizeObserver = window2.ResizeObserver;
  const localStorage = adapter ? null : window2.localStorage;
  const lightweight = adapter?.mode === "local-lightweight";
  if (adapter) await adapter.initialize();
  const mutations = adapter?.operations ?? domain_exports;
  const lifecycle = new window2.AbortController();
  const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...typeof options === "boolean" ? { capture: options } : options, signal: lifecycle.signal });
  let transferPanel;
  let disposed = false, activated = false, assistDispose, updatesControl, invoiceSettings, invoiceOutput, browseSync, offAuth, suspendedDraft = false, visibilityEpoch = 0, revealPending = null, revealQueued = false, confirmedSnapshotKey = null, draftConflict = false, ownerUid = null, revealPrepared = false;
  const suspendedModals = createModalSuspension(document2), staleViews = /* @__PURE__ */ new Set();
  const root2 = document2.getElementById("google-app-root");
  try {
    let navIcon = function(key) {
      const paths = { aggregate: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z"/>', report: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h5M8 17h3"/>', browse: '<path d="M12 4H5v17h14v-7M8 8h3M8 12h2M14 8l5-5 3 3-5 5-4 1z"/>', summary: '<path d="M3 3v18h18"/><rect x="6" y="12" width="3" height="5" rx=".5"/><rect x="12" y="7" width="3" height="10" rx=".5"/><rect x="18" y="4" width="3" height="13" rx=".5"/>', output: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>', settings: '<path d="M3 6h4m4 0h10M3 12h10m4 0h4M3 18h2m4 0h12"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>' };
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
    }, read = function() {
      if (adapter) return adapter.read();
      const raw = localStorage.getItem(APP_STORAGE_KEY);
      return raw === null ? null : upgradeInitialItems(JSON.parse(raw));
    }, fail4 = function(error) {
      storageFailed = true;
      $("#global-error").hidden = false;
      $("#global-error").textContent = `\u7AEF\u672B\u5185\u30C7\u30FC\u30BF\u3092\u4FDD\u8B77\u3059\u308B\u305F\u3081\u5909\u66F4\u3092\u6B62\u3081\u3066\u3044\u307E\u3059\u3002\u4FDD\u5B58\u5F62\u5F0F\u30FB\u7A7A\u304D\u5BB9\u91CF\u30FB\u30D6\u30E9\u30A6\u30B6\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u5143\u30C7\u30FC\u30BF\u306F\u524A\u9664\u3057\u3066\u3044\u307E\u305B\u3093\u3002${error.message}`;
    }, initialize = function(ready) {
      if (adapter) {
        state2 = adapter.read();
        ready();
        return;
      }
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        ready();
      };
      const recover = (error) => {
        state2 = createSampleState();
        state2.records = [];
        state2.history = [];
        fail4(error);
        finish();
      };
      const perform = () => {
        try {
          const raw = localStorage.getItem(APP_STORAGE_KEY);
          if (raw !== null) state2 = upgradeInitialItems(JSON.parse(raw));
          else if (IS_CALCULATION_SAMPLE) state2 = createCalculationSampleState();
          else {
            const old = localStorage.getItem(STORAGE_KEY);
            state2 = old === null ? createSampleState() : migrateState(JSON.parse(old));
          }
          const next = JSON.stringify(state2);
          if (next !== raw) {
            if (localStorage.getItem(APP_STORAGE_KEY) !== raw) throw new Error("\u5225\u306E\u753B\u9762\u3067\u4FDD\u5B58\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002\u4E0A\u66F8\u304D\u305B\u305A\u6B62\u3081\u307E\u3057\u305F\u3002\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
            localStorage.setItem(APP_STORAGE_KEY, next);
          }
        } catch (error) {
          recover(error);
          return;
        }
        finish();
      };
      try {
        const promise = navigator.locks?.request ? navigator.locks.request(`${APP_STORAGE_KEY}:mutation`, perform) : perform();
        promise?.catch((error) => {
          if (!finished) recover(error);
        });
      } catch (error) {
        if (!finished) recover(error);
      }
    }, toast = function(msg) {
      $("#toast").textContent = msg;
      $("#toast").classList.add("visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 5e3);
    }, options = function(type, selected = "", placeholder = "\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044", includeId = "") {
      return `<option value="">${esc4(placeholder)}</option>` + state2.masters[type].filter((x) => x.active || x.id === includeId).map((x) => `<option value="${esc4(x.id)}" ${x.id === selected ? "selected" : ""}>${esc4(displayName(state2, type, x.id))}</option>`).join("");
    }, sessionAttribution = function(label = "\u7DE8\u96C6\u8005") {
      const member2 = demoSession.current(state2);
      return `<p class="session-attribution">${esc4(label)} <strong data-demo-user-name>${esc4(member2?.name ?? "\u672A\u9078\u629E")}</strong></p>`;
    }, renderSessionIdentity = function() {
      const member2 = demoSession.current(state2);
      $$("[data-demo-user-name]").forEach((el) => {
        el.textContent = member2?.name ?? "\u672A\u9078\u629E";
        el.title = member2?.name ?? "\u672A\u9078\u629E";
      });
      $("#demo-session-storage-note").hidden = demoSession.storageAvailable;
    }, showDemoSession = function() {
      if (adapter) return;
      const current = demoSession.current(state2), selection = $("#demo-session-member").value;
      $("#demo-session-member").innerHTML = options("members", current?.id ?? selection, "\u5229\u7528\u8005\u3092\u9078\u629E");
      $("#cancel-demo-session").hidden = !current;
      $("#demo-session-error").hidden = true;
      if (!sessionDialog.open) sessionDialog.showModal();
      $("#demo-session-member").focus();
    }, ensureDemoSession = function() {
      renderSessionIdentity();
      if (!pending && !storageFailed && !demoSession.current(state2)) showDemoSession();
    }, errorHTML = function(id) {
      return `<div id="${id}" class="form-error" role="alert" tabindex="-1" hidden></div>`;
    }, showError = function(id, error) {
      const el = $(`#${id}`);
      el.hidden = false;
      el.textContent = error.message || String(error);
      el.focus();
    }, numeric = function(name, label, value, unit = "") {
      return `<label class="field"><span class="field-label">${label}${unit ? ` <small>${unit}</small>` : ""}</span><input type="number" inputmode="decimal" enterkeyhint="next" min="0" max="1000000000" step="any" name="${esc4(name)}" value="${value ?? ""}" placeholder="\u672A\u5165\u529B"></label>`;
    }, noteFields = function(key, record, prefix, compact = false) {
      const notes = reportNotes(record), name = prefix + (key === "other" ? "otherItem" : "notes:" + key);
      return `<div class="category-notes field full"><label class="field"><span class="field-label">\u5099\u8003 <small>\u4EFB\u610F\u30FB\u81EA\u7531\u5165\u529B</small></span><textarea name="${esc4(name)}" rows="${compact ? 1 : 2}"${compact ? ' wrap="off" data-single-line-note' : ""} maxlength="500" placeholder="\u5185\u5BB9\u3084\u88DC\u8DB3\u3092\u5165\u529B">${esc4(notes[key])}</textarea></label>${record.itemIds?.[key] ? `<p class="rate-note">\u4EE5\u524D\u306E\u51E6\u5206\u7269\u54C1\uFF1A${esc4(displayName(state2, "items", record.itemIds[key], record.itemNames?.[key]))}\uFF08\u8A18\u9332\u306B\u4FDD\u6301\uFF09</p>` : ""}</div>`;
    }, reportProduct = function(quantity, rate) {
      const fixed3 = (raw) => {
        if (raw === null || raw === void 0 || String(raw).trim() === "") return null;
        const text3 = String(raw).trim(), value = Number(text3);
        if (!/^\d+(?:\.\d{1,6})?$/.test(text3) || !Number.isFinite(value) || value < 0 || value > 1e9) return null;
        const [whole, fraction] = value.toFixed(6).split(".");
        return BigInt(whole) * 1000000n + BigInt(fraction);
      };
      const kg = fixed3(quantity), price = fixed3(rate);
      if (kg === null || price === null) return null;
      const product = kg * price, decimals = (product % 1000000000000n).toString().padStart(12, "0").replace(/0+$/, "");
      return `${product / 1000000000000n}${decimals ? "." + decimals : ""}`;
    }, reportMoney = function(value) {
      if (value === null) return "\u30FC";
      const [whole, fraction] = String(value).split(".");
      return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? "." + fraction : "");
    }, refreshMeasureTotal = function(scope) {
      const blocks = scope.matches?.("[data-measure-category]") ? [scope] : [...scope.querySelectorAll("[data-measure-category]")];
      for (const block of blocks) {
        const kg = block.querySelector("[data-measure-weight] input"), rate = block.querySelector("[data-measure-rate] input"), total = reportProduct(kg.value, rate.value), output = block.querySelector("[data-measure-total]");
        output.textContent = reportMoney(total);
        output.dataset.amount = total ?? "";
        output.title = total === null ? "\u91CD\u91CF\u307E\u305F\u306F\u5358\u4FA1\u304C\u672A\u5165\u529B\u30FB\u5165\u529B\u9014\u4E2D\u3067\u3059" : `${reportMoney(total)} \u5186`;
      }
    }, measures = function(customer, record, prefix = "", editing = false) {
      return Object.keys(CATEGORIES).map((k) => {
        if (k === "other") {
          const used = editing && (record.otherFee !== null || reportNotes(record).other || record.itemIds?.other);
          return `<div class="category-block"><label class="check-label"><input type="checkbox" data-use-other="${esc4(prefix)}" ${used ? "checked" : ""}>\u305D\u306E\u4ED6\u3082\u5831\u544A\u3059\u308B</label><div class="other-fields form-grid" data-other-fields="${esc4(prefix)}" ${used ? "" : "hidden"}>${numeric(prefix + "otherFee", "\u7DCF\u8A08", record.otherFee, "\u5186")}${noteFields(k, record, prefix, !editing)}</div></div>`;
        }
        const total = reportProduct(record[k + "Kg"], record[k + "Rate"]), sum2 = `<div class="field measure-readout"><span class="field-label">\u7DCF\u8A08 <small>\u5186</small></span><output class="measure-value" data-measure-total data-amount="${total ?? ""}" aria-label="${CATEGORIES[k]}\u306E\u7DCF\u8A08" aria-live="polite" aria-atomic="true" title="${total === null ? "\u91CD\u91CF\u307E\u305F\u306F\u5358\u4FA1\u304C\u672A\u5165\u529B\u30FB\u5165\u529B\u9014\u4E2D\u3067\u3059" : reportMoney(total) + " \u5186"}">${reportMoney(total)}</output></div>`;
        return `<div class="category-block" data-measure-category="${k}"><h3>${CATEGORIES[k]}</h3><div class="form-grid report-measure-grid"><div class="measure-metrics"><div data-measure-weight>${numeric(prefix + k + "Kg", "\u91CD\u91CF", record[k + "Kg"], "kg")}</div><div data-measure-rate>${numeric(prefix + k + "Rate", editing ? "\u5F53\u56DE\u5358\u4FA1" : "\u8A2D\u5B9A\u5358\u4FA1", record[k + "Rate"], "\u5186/kg")}</div>${sum2}</div>${noteFields(k, record, prefix, !editing)}</div></div>`;
      }).join("");
    }, enforceOther = function(scope) {
      scope.querySelectorAll("[data-other-fields]").forEach((box) => {
        box.querySelectorAll("input,select,textarea,button").forEach((el) => el.disabled = box.hidden);
      });
    }, reportRowHTML = function() {
      const id = `report-row-${++reportRowSequence}`;
      return `<article class="entry-card" id="${id}" role="tabpanel" aria-labelledby="${id}-tab" data-report-row="${id}" data-entry="" hidden><div class="entry-customer-header"><label class="field"><span class="field-label">\u53D6\u5F15\u5148<span class="required">\u5FC5\u9808</span></span><select data-report-customer name="${id}:customerId" required>${options("customers", "", "\u53D6\u5F15\u5148\u3092\u9078\u629E")}</select></label><button class="button secondary danger-text" type="button" data-remove-report-row aria-label="\u3053\u306E\u5165\u529B\u884C\u3092\u524A\u9664">\u524A\u9664</button></div><div class="entry-fields" hidden></div></article>`;
    }, reportRows = function() {
      return $$("#report-form [data-report-row]");
    }, reportRowLabel = function(row, index) {
      return row.dataset.entry ? displayName(state2, "customers", row.dataset.entry) : `\u53D6\u5F15\u5148 ${index + 1}\uFF08\u672A\u9078\u629E\uFF09`;
    }, revealReportTab = function(tab) {
      if (!tab) return;
      const strip = $("#report-tabs"), bounds = strip.getBoundingClientRect(), item = tab.getBoundingClientRect();
      if (item.left < bounds.left) strip.scrollLeft -= bounds.left - item.left;
      else if (item.right > bounds.right) strip.scrollLeft += item.right - bounds.right;
    }, selectReportRow = function(id, { focusTab = false, reveal: reveal2 = true } = {}) {
      const rows = reportRows(), row = rows.find((row2) => row2.dataset.reportRow === id) ?? rows[0];
      activeReportRowId = row?.dataset.reportRow ?? null;
      rows.forEach((item) => item.hidden = item !== row);
      $$("#report-tabs [data-report-tab]").forEach((tab2) => {
        const selected = tab2.dataset.reportTab === activeReportRowId;
        tab2.setAttribute("aria-selected", String(selected));
        tab2.tabIndex = selected ? 0 : -1;
      });
      const label = $("#report-active-customer");
      label.hidden = !row;
      label.textContent = row ? `\u5165\u529B\u4E2D\uFF1A${reportRowLabel(row, rows.indexOf(row))}` : "";
      const tab = row ? document2.getElementById(`${activeReportRowId}-tab`) : null;
      if (focusTab) tab?.focus({ preventScroll: true });
      if (reveal2) revealReportTab(tab);
    }, refreshReportChoices = function() {
      const rows = reportRows(), chosen = rows.map((row) => row.dataset.entry).filter(Boolean), available = activeMasters(state2, "customers").length;
      rows.forEach((row, index) => {
        const select = row.querySelector("[data-report-customer]");
        select.setAttribute("aria-label", `\u53D6\u5F15\u5148 ${index + 1}`);
        [...select.options].forEach((option) => option.disabled = !!option.value && chosen.includes(option.value) && option.value !== row.dataset.entry);
        row.querySelector("[data-remove-report-row]").setAttribute("aria-label", `${reportRowLabel(row, index)}\u306E\u5165\u529B\u884C\u3092\u524A\u9664`);
      });
      const strip = $("#report-tabs"), scroll = strip.scrollLeft;
      strip.innerHTML = rows.map((row) => `<button type="button" class="report-tab" id="${row.dataset.reportRow}-tab" role="tab" aria-selected="false" aria-controls="${row.dataset.reportRow}" tabindex="-1" data-report-tab="${row.dataset.reportRow}"><span class="report-tab-name"></span></button>`).join("");
      layoutReportTabs();
      strip.scrollLeft = scroll;
      $("#selected-count").textContent = `${chosen.length}\u4EF6\u5165\u529B`;
      $("#add-report-row").disabled = storageFailed || rows.length >= available;
      $("#report-empty").hidden = rows.length > 0;
      selectReportRow(activeReportRowId);
    }, layoutReportTabs = function() {
      const strip = $("#report-tabs");
      if (!strip) return;
      const rows = reportRows(), tabs = [...strip.querySelectorAll("[data-report-tab]")], named = rows.length <= 3;
      const labelTabs = (mode) => {
        strip.dataset.labelMode = mode;
        tabs.forEach((tab, index) => {
          const row = rows[index], ordinal = `\u53D6\u5F15\u5148${index + 1}`, company = row.dataset.entry ? displayName(state2, "customers", row.dataset.entry) : "", label = mode === "names" ? company || ordinal : mode === "numbered" ? ordinal : String(index + 1);
          tab.title = company ? `${ordinal}\uFF1A${company}` : ordinal;
          tab.setAttribute("aria-label", tab.title);
          const name = tab.querySelector(".report-tab-name");
          if (mode === "numbered") name.innerHTML = `<span class="report-tab-prefix">\u53D6\u5F15\u5148</span><span>${index + 1}</span>`;
          else name.textContent = label;
        });
      };
      labelTabs(named ? "names" : "numbered");
      if (!named && strip.clientWidth > 0 && strip.scrollWidth > strip.clientWidth + 1) labelTabs("numbers");
      revealReportTab(document2.getElementById(`${activeReportRowId}-tab`));
    }, observeReportTabs = function() {
      reportTabsObserver?.disconnect();
      if (window2.ResizeObserver) {
        let width = -1;
        reportTabsObserver = new window2.ResizeObserver((entries) => {
          const next = entries[0]?.contentRect.width;
          if (next === width) return;
          width = next;
          layoutReportTabs();
        });
        reportTabsObserver.observe($("#report-tabs"));
      }
    }, renderReport = function() {
      const today = localDate(), available = activeMasters(state2, "customers").length;
      reportRowSequence = 0;
      activeReportRowId = null;
      $("#report-form-host").innerHTML = `<form id="report-form" novalidate data-master-revision="${state2.masterRevision}">${errorHTML("report-error")}<div class="report-meta"><div class="form-grid"><label class="field"><span class="field-label">\u56DE\u53CE\u65E5<span class="required">\u5FC5\u9808</span></span><input name="date" type="date" value="${today}" required></label><div class="field report-user"><span class="field-label">\u5831\u544A\u8005</span><output class="report-user-name" data-demo-user-name>${esc4(demoSession.current(state2)?.name ?? "\u672A\u9078\u629E")}</output></div></div></div><div class="batch-title"><h2>\u5165\u529B\u3059\u308B\u53D6\u5F15\u5148</h2><span class="page-chip" id="selected-count" aria-live="polite">0\u4EF6\u5165\u529B</span></div><p class="form-note" id="report-tabs-help">\u300C\uFF0B \u8FFD\u52A0\u300D\u3067\u53D6\u5F15\u5148\u3092\u5897\u3084\u3057\u3001\u30BF\u30D6\u3067\u5165\u529B\u6B04\u3092\u5207\u308A\u66FF\u3048\u307E\u3059\u3002\u30BF\u30D6\u304C\u96A0\u308C\u3066\u3044\u308B\u5834\u5408\u306F\u6A2A\u306B\u30B9\u30AF\u30ED\u30FC\u30EB\u3067\u304D\u307E\u3059\u3002</p><div class="report-workspace"><p class="sr-only" id="report-active-customer" aria-live="polite" aria-atomic="true"></p><div class="report-tab-toolbar"><div id="report-tabs" class="report-tabs" role="tablist" aria-label="\u5165\u529B\u3059\u308B\u53D6\u5F15\u5148" aria-orientation="horizontal" aria-describedby="report-tabs-help"></div><button class="button secondary add-report-row" type="button" id="add-report-row" aria-label="\u53D6\u5F15\u5148\u3092\u8FFD\u52A0" title="\u53D6\u5F15\u5148\u3092\u8FFD\u52A0" ${storageFailed || !available ? "disabled" : ""}><span aria-hidden="true">\uFF0B</span> \u8FFD\u52A0</button></div><div class="card-list" id="report-rows">${available ? reportRowHTML() : ""}</div><p class="empty-state" id="report-empty" ${available ? "hidden" : ""}>${available ? "\u300C\uFF0B \u8FFD\u52A0\u300D\u304B\u3089\u5165\u529B\u3092\u59CB\u3081\u3066\u304F\u3060\u3055\u3044\u3002" : "\u6709\u52B9\u306A\u53D6\u5F15\u5148\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u304B\u3089\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}</p></div><div class="report-save"><p>\u7A7A\u6B04\u30680\u3092\u533A\u5225\u3057\u307E\u3059\u3002<br>\u3059\u3079\u3066\u306E\u30BF\u30D6\u306E\u5165\u529B\u3092\u78BA\u8A8D\u3057\u3066\u304B\u3089\u4E00\u62EC\u4FDD\u5B58\u3057\u307E\u3059\u3002<br>${lightweight ? "\u3053\u306E\u7AEF\u672B\u306B\u4FDD\u5B58\u3057\u307E\u3059\u3002\u96C6\u7D04\u3057\u3066\u9001\u4FE1\u3059\u308B\u307E\u3067\u306F\u672A\u9001\u4FE1\u3067\u3059\u3002" : adapter ? "\u5171\u6709\u30C7\u30FC\u30BF\u3078\u4FDD\u5B58\u3057\u307E\u3059\u3002" : "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306B\u4FDD\u5B58\u3057\u307E\u3059\u3002\u30B7\u30FC\u30C8\u3078\u306E\u4FDD\u5B58\u306F\u672A\u63A5\u7D9A\u3067\u3059\u3002"}</p><button class="button primary" type="submit" id="save-report" ${storageFailed ? "disabled" : ""}>\u5165\u529B\u5206\u3092\u4FDD\u5B58</button></div></form>`;
      reportDirty = false;
      refreshReportChoices();
      observeReportTabs();
      if (IS_CALCULATION_SAMPLE && !calculationDraftOffered && !state2.records.length) fillCalculationSampleDraft();
    }, fillCalculationSampleDraft = function() {
      calculationDraftOffered = true;
      for (const example of calculationSampleRows()) {
        let row = reportRows().find((r) => !r.dataset.entry);
        if (!row) {
          $("#report-rows").insertAdjacentHTML("beforeend", reportRowHTML());
          row = reportRows().at(-1);
        }
        const select = row.querySelector("[data-report-customer]");
        select.value = example.customerId;
        changeReportCustomer(select);
        for (const key of ["combustibleKg", "noncombustibleKg", "otherFee"]) row.querySelector(`[name="${example.customerId}:${key}"]`).value = example[key];
        const checkbox = row.querySelector("[data-use-other]");
        checkbox.checked = true;
        checkbox.parentElement.nextElementSibling.hidden = false;
        enforceOther(row);
        refreshMeasureTotal(row);
      }
      activeReportRowId = reportRows()[0].dataset.reportRow;
      refreshReportChoices();
      reportDirty = true;
    }, confirmReportRow = function({ title, body, label, origin, apply }) {
      $("#confirm-content").innerHTML = `<div class="dialog-head"><h2 id="confirm-title">${title}</h2></div><div class="dialog-body"><p class="confirm-text">${body}</p></div><div class="dialog-foot"><button class="button secondary" type="button" id="cancel-report-row">\u5165\u529B\u3092\u6B8B\u3059</button><button class="button danger" type="button" id="confirm-report-row">${label}</button></div>`;
      confirmDialog.showModal();
      $("#cancel-report-row").onclick = () => {
        confirmDialog.close();
        origin?.focus();
      };
      $("#confirm-report-row").onclick = () => {
        confirmDialog.close();
        apply();
      };
      $("#cancel-report-row").focus();
    }, changeReportCustomer = function(select) {
      const row = select.closest("[data-report-row]"), previous = row.dataset.entry, next = select.value;
      select.value = previous;
      selectReportRow(row.dataset.reportRow);
      if (next === previous) return;
      const customer = state2.masters.customers.find((c) => c.id === next && c.active);
      if (next && (!customer || reportRows().some((other) => other !== row && other.dataset.entry === next))) {
        showError("report-error", new Error(customer ? "\u540C\u3058\u53D6\u5F15\u5148\u306F1\u3064\u306E\u5165\u529B\u884C\u306B\u307E\u3068\u3081\u3066\u304F\u3060\u3055\u3044\u3002" : "\u3053\u306E\u53D6\u5F15\u5148\u306F\u73FE\u5728\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
        return;
      }
      const apply = () => {
        if (next && reportRows().some((other) => other !== row && other.dataset.entry === next)) {
          showError("report-error", new Error("\u540C\u3058\u53D6\u5F15\u5148\u306F1\u3064\u306E\u5165\u529B\u884C\u306B\u307E\u3068\u3081\u3066\u304F\u3060\u3055\u3044\u3002"));
          return;
        }
        const current = state2.masters.customers.find((c) => c.id === next && c.active);
        if (next && !current) {
          showError("report-error", new Error("\u3053\u306E\u53D6\u5F15\u5148\u306F\u73FE\u5728\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002\u5165\u529B\u4E2D\u306E\u5185\u5BB9\u306F\u6B8B\u3057\u3066\u3044\u307E\u3059\u3002"));
          return;
        }
        const fields2 = next ? measures(current, reportDefaults(state2, next), next + ":") : "";
        row.dataset.entry = next;
        select.value = next;
        const box = row.querySelector(".entry-fields");
        box.innerHTML = fields2;
        box.hidden = !next;
        enforceOther(box);
        reportDirty = true;
        $("#report-error").hidden = true;
        refreshReportChoices();
        select.focus();
      };
      if (previous) {
        const oldName = displayName(state2, "customers", previous);
        confirmReportRow({ title: "\u3053\u306E\u884C\u306E\u53D6\u5F15\u5148\u3092\u5909\u66F4\u3057\u307E\u3059\u304B\uFF1F", body: `${esc4(oldName)}\u306E\u5165\u529B\u5185\u5BB9\u3092\u7834\u68C4\u3057\u307E\u3059\u3002\u307B\u304B\u306E\u884C\u306E\u5165\u529B\u306F\u6B8B\u308A\u307E\u3059\u3002`, label: "\u7834\u68C4\u3057\u3066\u5909\u66F4", origin: select, apply });
      } else apply();
    }, removeReportRow = function(row) {
      selectReportRow(row.dataset.reportRow);
      const origin = row.querySelector("[data-remove-report-row]"), apply = () => {
        const rows = reportRows(), index = rows.indexOf(row);
        activeReportRowId = (rows[index + 1] ?? rows[index - 1])?.dataset.reportRow ?? null;
        row.remove();
        reportDirty = true;
        $("#report-error").hidden = true;
        refreshReportChoices();
        if (activeReportRowId) selectReportRow(activeReportRowId, { focusTab: true });
        else $("#add-report-row").focus();
      };
      if (row.dataset.entry) confirmReportRow({ title: "\u3053\u306E\u5165\u529B\u884C\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F", body: `${esc4(displayName(state2, "customers", row.dataset.entry))}\u306E\u672A\u4FDD\u5B58\u306E\u5165\u529B\u3092\u524A\u9664\u3057\u307E\u3059\u3002\u307B\u304B\u306E\u884C\u3084\u4FDD\u5B58\u6E08\u307F\u306E\u8A18\u9332\u306F\u5909\u308F\u308A\u307E\u305B\u3093\u3002`, label: "\u3053\u306E\u884C\u3092\u524A\u9664", origin, apply });
      else apply();
    }, validateReportRows = function() {
      const rows = reportRows(), ids = rows.map((row) => row.querySelector("[data-report-customer]").value);
      let message = "", invalid3 = -1;
      if (!rows.length) message = "\u300C\uFF0B \u8FFD\u52A0\u300D\u304B\u3089\u5165\u529B\u3059\u308B\u53D6\u5F15\u5148\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      else if ((invalid3 = ids.findIndex((id) => !id)) >= 0) message = "\u672A\u9078\u629E\u306E\u30BF\u30D6\u304C\u3042\u308A\u307E\u3059\u3002\u53D6\u5F15\u5148\u3092\u9078\u629E\u3059\u308B\u304B\u3001\u305D\u306E\u5165\u529B\u884C\u3092\u524A\u9664\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      else if ((invalid3 = ids.findIndex((id, index) => ids.indexOf(id) !== index)) >= 0) message = "\u540C\u3058\u53D6\u5F15\u5148\u306F1\u3064\u306E\u5165\u529B\u884C\u306B\u307E\u3068\u3081\u3066\u304F\u3060\u3055\u3044\u3002";
      else if ((invalid3 = rows.findIndex((row, index) => row.dataset.entry !== ids[index])) >= 0) message = "\u53D6\u5F15\u5148\u3092\u9078\u3073\u76F4\u3057\u3066\u304B\u3089\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      if (message) {
        if (invalid3 >= 0) selectReportRow(rows[invalid3].dataset.reportRow);
        showError("report-error", new Error(message));
        if (invalid3 >= 0) rows[invalid3].querySelector("[data-report-customer]").focus();
        return false;
      }
      return true;
    }, validateReportForm = function(form) {
      if (!validateReportRows()) return false;
      const invalid3 = [...form.elements].find((el) => el.willValidate && !el.validity.valid);
      if (!invalid3) return true;
      const row = invalid3.closest("[data-report-row]");
      if (row) selectReportRow(row.dataset.reportRow);
      invalid3.focus();
      invalid3.reportValidity();
      return false;
    }, readMeasures = function(form, prefix) {
      const value = (n) => form.elements.namedItem(prefix + n)?.value ?? "";
      const other = form.querySelector(`[data-use-other="${prefix}"]`)?.checked;
      return { combustibleKg: value("combustibleKg"), noncombustibleKg: value("noncombustibleKg"), combustibleRate: value("combustibleRate"), noncombustibleRate: value("noncombustibleRate"), otherFee: other ? value("otherFee") : "", otherItem: other ? value("otherItem") : "", categoryNotes: { combustible: value("notes:combustible"), noncombustible: value("notes:noncombustible") } };
    }, recordName = function(r) {
      return displayName(state2, "customers", r.customerId, r.customerName);
    }, personName = function(r, key) {
      return displayName(state2, "members", r[key + "Id"], r[key]);
    }, itemText = function(r) {
      return Object.keys(CATEGORIES).filter((k) => r.itemIds[k]).map((k) => `${CATEGORIES[k]}: ${displayName(state2, "items", r.itemIds[k], r.itemNames[k])}`).join(" / ");
    }, noteText = function(r) {
      const values = Object.values(reportNotes(r)).filter(Boolean);
      return values.length ? "\u5099\u8003: " + values.join(" / ") : "";
    }, reportNotesHTML = function(r) {
      return `<p class="card-meta report-notes">${esc4(noteText(r))}</p>${itemText(r) ? `<p class="card-meta">\u4EE5\u524D\u306E\u51E6\u5206\u7269\u54C1: ${esc4(itemText(r))}</p>` : ""}`;
    }, quantities = function(r) {
      const weight = (k) => {
        const kg = r[k + "Kg"], rate = r[k + "Rate"];
        return `<div><small>${CATEGORIES[k]}</small><strong>${amount(kg)}${kg !== null ? " kg" : ""} <span class="record-rate" data-record-rate="${k}" aria-label="${CATEGORIES[k]}\u306E\u4FDD\u5B58\u5358\u4FA1 ${rate === null || rate === void 0 ? "\u672A\u8A2D\u5B9A" : amount(rate) + " \u5186/kg"}">\uFF08${amount(rate)} \u5186/kg\uFF09</span></strong></div>`;
      };
      return `<div class="report-info">${weight("combustible")}${weight("noncombustible")}<div><small>\u305D\u306E\u4ED6</small><strong>${amount(r.otherFee)}${r.otherFee !== null ? " \u5186" : ""}</strong></div></div>`;
    }, renderBrowse = function() {
      const month2 = $("#browse-month").value, query = $("#browse-search").value.trim().toLowerCase();
      const records = state2.records.filter((r) => r.deleted === (browseTab === "trash") && (!month2 || r.date.startsWith(month2)) && [recordName(r), noteText(r), itemText(r), personName(r, "createdBy"), personName(r, "lastEditedBy")].join(" ").toLowerCase().includes(query)).sort((a, b) => b.date.localeCompare(a.date) || String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
      $("#browse-list").innerHTML = records.map((r) => `<article class="record-card"><p class="card-meta record-date">${r.date}${r.deleted ? " \xB7 \u524A\u9664\u6E08\u307F" : ""}</p><div class="record-card-heading"><h2>${esc4(recordName(r))}</h2><button class="button secondary" data-detail="${esc4(r.id)}" aria-label="${esc4(recordName(r))} ${r.date}\u306E\u8A73\u7D30">\u8A73\u7D30</button></div>${quantities(r)}${r.deleted ? `<div class="trash-restore"><button class="button secondary" data-record-action="restore" data-id="${esc4(r.id)}" data-version="${r.version}" ${storageFailed ? "disabled" : ""}>\u5FA9\u65E7</button></div>` : ""}</article>`).join("") || '<div class="empty-state">\u3053\u306E\u671F\u9593\u30FB\u6761\u4EF6\u306E\u8A18\u9332\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>';
    }, historyHTML = function(e) {
      const labels = { create: "\u4F5C\u6210", update: "\u7DE8\u96C6", delete: "\u524A\u9664", restore: "\u5FA9\u5143" };
      const r = e.after;
      const summary = (x) => x ? `${x.date} ${recordName(x)}
\u53EF\u71C3 ${amount(x.combustibleKg)} kg / \u5358\u4FA1 ${amount(x.combustibleRate)} \u5186
\u4E0D\u71C3 ${amount(x.noncombustibleKg)} kg / \u5358\u4FA1 ${amount(x.noncombustibleRate)} \u5186
\u305D\u306E\u4ED6 ${amount(x.otherFee)} \u5186
${noteText(x)}
${itemText(x)}
${x.deleted ? "\u524A\u9664\u6E08\u307F" : "\u6709\u52B9"}` : "\u306A\u3057";
      return `<article class="history-event"><div class="history-event-head"><span class="event-action ${e.action === "delete" ? "delete" : ""}">${labels[e.action]}</span>${esc4(historyActor(e))}<time>${esc4(historyTime(e))}</time></div><h3>${esc4(recordName(r))} \xB7 ${r.date}</h3><details><summary>\u5909\u66F4\u524D\u5F8C\u3092\u78BA\u8A8D</summary><pre>\u5909\u66F4\u524D
${esc4(summary(e.before))}

\u5909\u66F4\u5F8C
${esc4(summary(e.after))}</pre></details></article>`;
    }, summaryCharge = function(value) {
      return value === null ? "\u2014" : `${reportMoney(value)}\u5186`;
    }, summaryCategoryCharge = function(line2) {
      return line2.entered ? summaryCharge(line2.amount) : "0\u5186";
    }, summaryTotalCharge = function(charges) {
      return charges.entered ? summaryCharge(charges.total) : "0\u5186";
    }, summaryProduct = function(line2) {
      if (!line2.entered) return '<span aria-label="\u5BFE\u8C61\u306E\u8A18\u9332\u306A\u3057\u30010\u5186">0</span>';
      return line2.groups.map((group, index) => {
        const known = group.quantity === null ? null : reportMoney(group.quantity), weight = group.missingWeight ? known === null ? "\u2014" : `(${known}\uFF0B\u2014)` : known ?? "\u2014", rate = group.rate === null ? "\u2014" : reportMoney(group.rate);
        return `<span class="summary-product-term" data-summary-product-term aria-label="${index ? "\u52A0\u7B97\u3001" : ""}\u91CD\u91CF ${esc4(weight)} kg \xD7 ${line2.currentSourceReference ? "\u53C2\u7167\u5358\u4FA1\uFF08\u73FE\u5728\u306E\u30B7\u30FC\u30C8\uFF09" : "\u4FDD\u5B58\u5358\u4FA1"} ${esc4(rate)} \u5186/kg">${index ? "\uFF0B" : ""}${esc4(weight)}\xD7${esc4(rate)}</span>`;
      }).join("");
    }, summaryEquationCells = function(charges, record = false) {
      const attribute = record ? "data-summary-record-amount" : "data-summary-amount";
      return ["combustible", "noncombustible", "other"].map((key, index) => `${index ? '<td class="summary-record-operator" aria-hidden="true">\uFF0B</td>' : ""}<td ${attribute}="${key}" title="${CATEGORIES[key]}\u306E\u91D1\u984D ${summaryCategoryCharge(charges[key])}">${key === "other" ? summaryCategoryCharge(charges[key]) : summaryProduct(charges[key])}</td>`).join("") + `<td class="summary-record-operator" aria-hidden="true">\uFF1D</td><td class="summary-equation-result"${record ? " data-summary-record-total" : ""}>${record ? summaryTotalCharge(charges) : `<output data-summary-total>${summaryTotalCharge(charges)}</output>`}</td>`;
    }, summaryDetailsId = function(customerId) {
      return "summary-details-" + Array.from(customerId, (c) => c.codePointAt(0).toString(16)).join("-");
    }, summaryRecordDetails = function(group, panelId, periodLabel) {
      const rows = group.records.map((row) => {
        const parts = ["combustible", "noncombustible", "other"].map((key, index) => `<div class="summary-total-part" data-summary-record-amount="${key}" aria-label="${CATEGORIES[key]}\u306E\u91D1\u984D ${summaryCategoryCharge(row.charges[key])}">${index ? '<span class="summary-total-plus" aria-hidden="true">\uFF0B</span>' : ""}${key === "other" ? summaryCategoryCharge(row.charges[key]) : summaryProduct(row.charges[key])}</div>`).join("");
        return `<div class="summary-total-grid summary-day-grid" data-summary-record="${esc4(row.recordId)}"><div class="summary-total-heading"><time datetime="${esc4(row.date)}" aria-label="${esc4(row.date)}" title="${esc4(row.date)}">${Number(row.date.slice(5, 7))}/${Number(row.date.slice(8, 10))}</time></div>${parts}<div class="summary-equation-result"><span aria-hidden="true">\uFF1D </span><output data-summary-record-total>${summaryTotalCharge(row.charges)}</output></div></div>`;
      }).join("");
      return `<div id="${panelId}" class="summary-record-details" data-summary-record-details aria-label="${esc4(group.name)} ${esc4(periodLabel)}\u306E\u8A18\u9332\u306E\u8A73\u7D30" hidden>${rows}</div>`;
    }, summaryEquation = function(group, panelId, periodLabel) {
      const parts = ["combustible", "noncombustible", "other"].map((key, index) => `<div class="summary-total-part" data-summary-amount="${key}" aria-label="${CATEGORIES[key]}\u306E\u91D1\u984D ${summaryCategoryCharge(group.charges[key])}">${index ? '<span class="summary-total-plus" aria-hidden="true">\uFF0B</span>' : ""}${key === "other" ? summaryCategoryCharge(group.charges[key]) : summaryProduct(group.charges[key])}</div>`).join("");
      return `<div class="summary-equation" role="region" aria-label="${esc4(group.name)} ${esc4(periodLabel)}\u306E\u4FDD\u5B58\u91CD\u91CF\u3068${group.currentSourceReference ? "\u53C2\u7167\u5358\u4FA1\uFF08\u65E7\u8A18\u9332\u306F\u73FE\u5728\u306E\u30B7\u30FC\u30C8\uFF09" : "\u4FDD\u5B58\u5358\u4FA1"}\u306B\u3088\u308B\u8A08\u7B97" tabindex="0"><div class="summary-total summary-total-grid" aria-label="\u5BFE\u8C61\u671F\u9593\u306E\u5408\u8A08"><div class="summary-total-heading">\u7DCF\u8A08</div>${parts}<div class="summary-equation-result"><span aria-hidden="true">\uFF1D </span><output data-summary-total aria-label="\u7DCF\u8A08\u3001\u5186">${summaryTotalCharge(group.charges)}</output></div></div><div class="summary-record-table" hidden>${summaryRecordDetails(group, panelId, periodLabel)}</div></div>`;
    }, toggleSummaryDetails = function(button) {
      const panel = document2.getElementById(button.getAttribute("aria-controls"));
      if (!panel) return;
      panel.hidden = !panel.hidden;
      const table = panel.closest(".summary-record-table");
      if (table) table.hidden = panel.hidden;
      button.setAttribute("aria-expanded", String(!panel.hidden));
    }, summaryRateLabel = function(line2) {
      if (!line2.entered) return "\u2014";
      const rates = line2.rates;
      return rates.length > 1 ? "\u8907\u6570\u5358\u4FA1" : line2.missingRate ? "\u2014" : rates.length ? `${amount(rates[0])}\u5186/kg` : "\u2014";
    }, renderSummary = function() {
      try {
        const labels = summaryPeriodLabels(period, $("#period-value").value);
        $("#period-display").textContent = labels.label;
        $("#period-era").textContent = `\uFF08${labels.era}\uFF09`;
        if (lightweight) {
          $("#summary-list").innerHTML = '<div class="info-note" role="status">\u7AEF\u672B\u5185\u306E\u5831\u544A\u306F\u5168\u4F53\u96C6\u8A08\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u5168\u4F53\u96C6\u8A08\u306E\u53D6\u5F97\u306F\u672A\u63A5\u7D9A\u3067\u3059\u3002</div>';
          return;
        }
        const reference = adapter?.referenceView?.(), calculationState = reference?.state ?? state2;
        const data = summarize(calculationState, { period, value: $("#period-value").value });
        $("#summary-list").innerHTML = data.map((x) => {
          const applied = reference?.applied.filter((entry2) => x.records.some((row) => row.recordId === entry2.recordId)) ?? [];
          x.currentSourceReference = applied.length > 0;
          for (const category of ["combustible", "noncombustible"]) {
            x.charges[category].currentSourceReference = applied.some((entry2) => entry2.category === category);
            for (const row of x.records) row.charges[category].currentSourceReference = applied.some((entry2) => entry2.recordId === row.recordId && entry2.category === category);
          }
          const charges = x.charges, panelId = summaryDetailsId(x.customerId), weight = (key) => {
            const line2 = charges[key];
            return `<div data-summary-category="${key}"><dt>${CATEGORIES[key]}</dt><dd class="summary-weight-rate"><span class="summary-weight">${line2.missingWeight || line2.quantity === null ? "\u2014" : esc4(line2.quantity)}</span>${line2.missingWeight || line2.quantity === null ? "" : " <small>kg</small>"}<span class="summary-saved-rate">${summaryRateLabel(line2)}</span></dd></div>`;
          };
          return `<article class="summary-card" data-summary-customer="${esc4(x.customerId)}"><div class="summary-card-heading"><h2>${esc4(x.name)}</h2><button type="button" class="button secondary" data-summary-details aria-expanded="false" aria-controls="${panelId}" aria-label="${esc4(x.name)}\u306E\u8A18\u9332\u306E\u8A73\u7D30">\u8A73\u7D30</button></div><p class="card-meta">${x.count}\u4EF6\u306E\u8A18\u9332${reference?.applied.some((row) => calculationState.records.some((record) => record.id === row.recordId && record.customerId === x.customerId)) ? " \xB7 \u65E7\u8A18\u9332\u306F\u73FE\u5728\u306E\u30B7\u30FC\u30C8\u5358\u4FA1\u306B\u3088\u308B\u53C2\u8003\u8A08\u7B97\uFF08\u904E\u53BB\u5358\u4FA1\u306F\u672A\u78BA\u8A8D\uFF09" : ""}</p><dl class="summary-values">${weight("combustible")}${weight("noncombustible")}<div data-summary-category="other"><dt>\u305D\u306E\u4ED6</dt><dd>${!charges.other.entered ? "0" : charges.other.amount === null ? "\u2014" : reportMoney(charges.other.amount)}${charges.other.entered && charges.other.amount === null ? "" : " <small>\u5186</small>"}</dd></div></dl>${summaryEquation(x, panelId, labels.label)}</article>`;
        }).join("") || '<div class="empty-state">\u3053\u306E\u671F\u9593\u306E\u8A18\u9332\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>';
      } catch (e) {
        $("#period-display").textContent = "\u671F\u9593\u3092\u9078\u629E";
        $("#period-era").textContent = "";
        $("#summary-list").innerHTML = `<div class="info-note">${esc4(e.message)}</div>`;
      }
    }, masterSummary = function(m, type) {
      if (type === "items") return "\u767B\u9332\u3055\u308C\u305F\u51E6\u5206\u7269\u54C1";
      if (type === "members") return "\u5831\u544A\u30FB\u64CD\u4F5C\u306E\u5C65\u6B74\u306B\u8A18\u9332\u3059\u308B\u5229\u7528\u8005";
      return Object.keys(CATEGORIES).map((k) => `${CATEGORIES[k]} ${amount(m.rates[k])}${k === "other" ? "\u5186" : "\u5186/kg"}`).join(" \xB7 ");
    }, customerRoute = function(id, section = "") {
      return `settings/customers/${encodeURIComponent(id)}${section ? "/" + section : ""}`;
    }, settingsBack = function(route, label) {
      return `<button type="button" class="settings-back" data-settings-route="${esc4(route)}">\u2039 ${esc4(label)}</button>`;
    }, renderMasterSelectionActions = function() {
      const box = $("#master-selection-actions");
      box.hidden = !masterSelectionMode || !!selectedCustomerId;
      if (box.hidden) {
        box.innerHTML = "";
        return;
      }
      const m = state2.masters[masterType].find((x) => x.id === selectedMasterId && (x.active || $("#show-inactive").checked));
      if (!m) selectedMasterId = null;
      const disabled = !m || storageFailed ? "disabled" : "";
      box.innerHTML = `<button class="button secondary danger-text" id="master-delete" ${m ? `data-toggle-master="${esc4(m.id)}" data-version="${m.version}"` : ""} ${disabled}>${m && !m.active ? "\u5FA9\u5143" : "\u524A\u9664"}</button><button class="button secondary" id="master-copy" ${m ? `data-copy-master="${esc4(m.id)}"` : ""} ${disabled}>\u8907\u88FD</button>`;
      box.setAttribute("aria-label", m ? `${displayName(state2, masterType, m.id)}\u3078\u306E\u64CD\u4F5C` : "\u5BFE\u8C61\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
    }, compactMasterRow = function(m) {
      const name = esc4(displayName(state2, masterType, m.id)), rowClass = { members: "master-member", customers: "master-customer", items: "master-item" }[masterType];
      const details = `<div class="card-actions"><button class="button secondary" ${masterType === "members" ? `data-member-detail="${esc4(m.id)}"` : masterType === "items" ? `data-item-detail="${esc4(m.id)}"` : `data-settings-route="${esc4(customerRoute(m.id))}" data-open-customer="${esc4(m.id)}"`} aria-label="${name}\u306E\u8A73\u7D30">\u8A73\u7D30</button></div>`;
      return `<article data-master-id="${esc4(m.id)}" class="master-card master-compact ${rowClass} ${m.active ? "" : "inactive"} ${selectedMasterId === m.id && masterSelectionMode ? "is-selected" : ""}">${masterSelectionMode ? `<label class="master-choice"><span class="master-name" title="${name}">${name}</span><input type="radio" name="masterSelection" data-master-select="${esc4(m.id)}" aria-label="${name}\u3092\u9078\u629E" ${selectedMasterId === m.id ? "checked" : ""}></label>` : `<h2 title="${name}">${name}</h2>${masterReorderMode ? "" : details}`}</article>`;
    }, resetMasterSelection = function() {
      masterSelectionMode = false;
      selectedMasterId = null;
    }, renderCustomerDialog = function() {
      if (currentPage !== "settings" || !selectedCustomerId) return;
      if (dialog.open && modalContext?.kind === "master") return;
      const selected = state2.masters.customers.find((c) => c.id === selectedCustomerId);
      if (!dialogOrigin) dialogOrigin = { attribute: "data-open-customer", value: selectedCustomerId };
      if (!selected) {
        showDialog(`${head("\u53D6\u5F15\u5148\u306E\u8A73\u7D30")}<div class="dialog-body"><p class="info-note">\u3053\u306E\u53D6\u5F15\u5148\u306F\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\u53D6\u5F15\u5148\u4E00\u89A7\u306B\u623B\u3063\u3066\u304F\u3060\u3055\u3044\u3002</p></div><div class="dialog-foot"><button class="button secondary" data-close-dialog>\u9589\u3058\u308B</button></div>`, { kind: "customer-missing" });
        return;
      }
      const name = esc4(displayName(state2, "customers", selected.id));
      if (customerSection === "prices") {
        if (priceContext?.id === selected.id && (priceDirty || pending) && $("#price-form")) return;
        priceContext = { id: selected.id, version: selected.version, snapshot: clone(selected) };
        showDialog(`${head("\u5024\u6BB5", name)}<form id="price-form"><div class="dialog-body customer-prices">${settingsBack(customerRoute(selected.id), "\u53D6\u5F15\u5148\u306E\u8A73\u7D30\u306B\u623B\u308B")}<p class="form-note">\u3053\u306E\u53D6\u5F15\u5148\u306E\u521D\u671F\u5024\u3067\u3059\u3002\u7A7A\u6B04\u306E\u5834\u5408\u306E\u307F\u3001\u51E6\u5206\u7269\u54C1\u306E\u5171\u901A\u5024\u3092\u4F7F\u3044\u307E\u3059\u3002\u5831\u544A\u6642\u306B\u4ECA\u56DE\u3060\u3051\u5909\u66F4\u3067\u304D\u307E\u3059\u3002\u904E\u53BB\u306E\u8A18\u9332\u306F\u66F8\u304D\u63DB\u3048\u307E\u305B\u3093\u3002</p>${errorHTML("price-error")}${Object.keys(CATEGORIES).map((k) => `<div class="setting-category"><h3>${CATEGORIES[k]}</h3>${numeric("rate:" + k, k === "other" ? "\u521D\u671F\u91D1\u984D" : "\u521D\u671F\u5358\u4FA1", selected.rates[k], k === "other" ? "\u5186" : "\u5186/kg\u30FB\u4EEE\u4ED5\u69D8")}</div>`).join("")}${sessionAttribution()}<p class="form-note">\u81EA\u7531\u5165\u529B\u3002\u7A7A\u6B04\u30680\u3092\u533A\u5225\u3057\u307E\u3059\u3002\u7A0E\u30FB\u8ACB\u6C42\u8A08\u7B97\u306F\u672A\u5B9F\u88C5\u3067\u3059\u3002</p></div><div class="dialog-foot price-actions"><button type="button" class="button secondary" data-settings-route="${esc4(customerRoute(selected.id))}">\u30AD\u30E3\u30F3\u30BB\u30EB</button><button type="button" class="button primary" id="save-prices">\u5024\u6BB5\u3092\u4FDD\u5B58</button></div></form>`, { kind: "customer-prices", id: selected.id, version: selected.version });
      } else {
        priceContext = null;
        if (dialog.open && modalContext?.kind === "customer-detail" && modalContext.id === selected.id && modalContext.version === selected.version) return;
        showMasterPanel("customers", selected.id, false);
      }
    }, reorderDirty = function() {
      return !!masterReorderMode && !!masterReorder?.getDirty();
    }, finishMasterReorder = function(render = true) {
      masterReorderMode = false;
      reorderContext = null;
      const controller = masterReorder;
      masterReorder = null;
      controller?.destroy();
      if (render) renderSettings();
    }, startMasterReorder = function() {
      if (storageFailed || pending || masterReorderMode) return;
      resetMasterSelection();
      masterReorderMode = true;
      reorderContext = { type: masterType, revision: state2.masterRevision, allIds: state2.masters[masterType].map((m) => m.id), visibleIds: state2.masters[masterType].filter((m) => m.active || $("#show-inactive").checked).map((m) => m.id), draggedId: null };
      $("#master-reorder-error").hidden = true;
      renderSettings();
      masterReorder = installMasterReorder({ container: $("#settings-list"), getRevision: () => state2.masterRevision, viewportInsets: { top: 10, bottom: 85 }, onDraftChange: ({ draggedId }) => {
        if (reorderContext) reorderContext.draggedId = draggedId;
      }, onError: (error) => showError("master-reorder-error", error), onStatusChange: (status) => {
        if (!masterReorderMode) return;
        if (!status.enabled) {
          finishMasterReorder();
          return;
        }
        $("#save-master-reorder").disabled = storageFailed || pending || status.dragging || !status.dirty;
      } });
      masterReorder.setEnabled(true);
    }, renderIssuerPanel = function() {
      const panel = $("#issuer-settings-panel");
      try {
        const config2 = invoiceSettings?.getSettings() ?? {}, value = config2.issuer ?? {}, banks = config2.bankAccounts ?? [], tax = config2.tax ?? {};
        panel.innerHTML = `<section class="other-settings-group"><div class="other-settings-heading"><h2>\u4F1A\u793E\u60C5\u5831</h2><button type="button" class="button secondary" data-invoice-settings="issuer">\u5909\u66F4</button></div><dl class="issuer-summary">${Object.entries({ tradeName: "\u4F1A\u793E\u540D\u30FB\u5C4B\u53F7", legalName: "\u6CD5\u4EBA\u540D\u30FB\u6C0F\u540D", postalCode: "\u90F5\u4FBF\u756A\u53F7", address: "\u4F4F\u6240", registrationNumber: "\u9069\u683C\u8ACB\u6C42\u66F8\u767A\u884C\u4E8B\u696D\u8005\u306E\u767B\u9332\u756A\u53F7" }).map(([key, label]) => `<div><dt>${label}</dt><dd>${esc4(value[key] || "\u30FC")}</dd></div>`).join("")}</dl></section><section class="other-settings-group"><div class="other-settings-heading"><h2>\u9280\u884C\u60C5\u5831</h2><button type="button" class="button secondary" data-invoice-settings="bank">\u5909\u66F4</button></div><dl class="issuer-summary">${banks.length ? banks.map((bank, i) => `<div><dt>\u632F\u8FBC\u5148${i + 1}</dt><dd>${esc4([bank.bankName, bank.branchName, { ordinary: "\u666E\u901A", checking: "\u5F53\u5EA7", savings: "\u8CAF\u84C4" }[bank.accountType], bank.accountNumber, bank.accountHolder].filter(Boolean).join(" ") || "\u30FC")}</dd></div>`).join("") : "<div><dd>\u30FC</dd></div>"}</dl><p class="form-note">${adapter ? "\u767B\u9332\u30E1\u30F3\u30D0\u30FC\u3067\u5171\u6709\u3059\u308B\u8ACB\u6C42\u66F8\u7528\u306E\u60C5\u5831\u3067\u3059\u3002" : "\u5B9F\u969B\u306E\u9280\u884C\u60C5\u5831\u306F\u5165\u529B\u3057\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002"}</p></section><section class="other-settings-group"><div class="other-settings-heading"><h2>\u7A0E\u7387</h2><button type="button" class="button secondary" data-invoice-settings="tax">\u5909\u66F4</button></div><dl class="issuer-summary"><div><dt>\u7A0E\u7387</dt><dd>${tax.rate !== null && tax.rate !== void 0 && tax.rate !== "" ? esc4(tax.rate) + "%" : "\u30FC"}</dd></div><div><dt>\u4FA1\u683C\u306E\u6271\u3044</dt><dd>${esc4({ exclusive: "\u7A0E\u629C", inclusive: "\u7A0E\u8FBC" }[tax.priceMode] || "\u30FC")}</dd></div><div><dt>\u7AEF\u6570\u51E6\u7406</dt><dd>${esc4({ floor: "\u5207\u308A\u6368\u3066", round: "\u56DB\u6368\u4E94\u5165", ceil: "\u5207\u308A\u4E0A\u3052" }[tax.rounding] || "\u30FC")}</dd></div></dl><p class="form-note">\u7A0E\u6761\u4EF6\u306F\u8A2D\u5B9A\u306E\u8A18\u9332\u306E\u307F\u3067\u3059\u3002\u904E\u53BB\u5831\u544A\u306B\u63A8\u6E2C\u3067\u9069\u7528\u305B\u305A\u3001\u7A0E\u984D\u30FB\u6B63\u5F0F\u306A\u8ACB\u6C42\u984D\u306E\u8A08\u7B97\u306F\u307E\u3060\u884C\u3044\u307E\u305B\u3093\u3002</p></section><section class="other-settings-group"><div class="other-settings-heading"><h2>Google\u30A2\u30AB\u30A6\u30F3\u30C8</h2><button type="button" class="button secondary" id="open-google-account">\u30ED\u30B0\u30A4\u30F3\u753B\u9762\u3078</button></div><p class="form-note">Google\u30A2\u30AB\u30A6\u30F3\u30C8\u306E\u78BA\u8A8D\u306B\u9032\u307F\u307E\u3059\u3002\u30B7\u30FC\u30C8\u306E\u95B2\u89A7\u306F\u30B5\u30FC\u30D0\u30FC\u3067\u767B\u9332\u30E1\u30F3\u30D0\u30FC\u3092\u78BA\u8A8D\u3057\u307E\u3059\u3002${lightweight ? "\u5831\u544A\u306F\u7AEF\u672B\u5185\u306B\u4FDD\u5B58\u3057\u3001\u96C6\u7D04\u5F8C\u306B\u9001\u4FE1\u3057\u307E\u3059\u3002\u8A2D\u5B9A\u306F\u660E\u793A\u4FDD\u5B58\u6642\u306B\u9001\u4FE1\u3057\u307E\u3059\u3002" : adapter ? "\u5831\u544A\u3068\u8A2D\u5B9A\u306F\u5171\u6709\u30C7\u30FC\u30BF\u3078\u4FDD\u5B58\u3057\u307E\u3059\u3002" : "\u5831\u544A\u30FB\u8A2D\u5B9A\u306E\u4FDD\u5B58\u306F\u307E\u3060\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u5185\u3067\u3059\u3002"}</p></section>`;
      } catch (error) {
        panel.innerHTML = `<p class="form-error">${esc4(error.message)}</p>`;
      }
    }, renderSettings = function() {
      if (masterReorderMode && masterReorder) return;
      const issuer = ["settings/other", "settings/issuer"].includes(currentRoute);
      $("#issuer-settings-tab").classList.toggle("active", issuer);
      $("#issuer-settings-panel").hidden = !issuer;
      if (issuer) {
        $$("[data-master-type]").forEach((b) => b.classList.remove("active"));
        $(".settings-toolbar").hidden = true;
        $("#settings-list").hidden = true;
        $("#settings-history").closest("details").hidden = true;
        renderIssuerPanel();
        return;
      }
      $("#settings-list").hidden = false;
      $("#settings-history").closest("details").hidden = false;
      $("#settings-tabs").hidden = false;
      $(".settings-toolbar").hidden = false;
      $("#settings-list-note").hidden = false;
      $("#reorder-masters").hidden = masterSelectionMode || masterReorderMode;
      $("#cancel-master-reorder").hidden = !masterReorderMode;
      $("#save-master-reorder").hidden = !masterReorderMode;
      $("#save-master-reorder").disabled = !reorderDirty() || storageFailed;
      $("#master-reorder-help").hidden = !masterReorderMode;
      $("#show-inactive").disabled = masterReorderMode;
      $("#select-masters").hidden = masterReorderMode;
      $("#select-masters").textContent = masterSelectionMode ? "\u30AD\u30E3\u30F3\u30BB\u30EB" : "\u9078\u629E";
      $("#select-masters").setAttribute("aria-pressed", String(masterSelectionMode));
      $("#new-master").hidden = masterSelectionMode || masterReorderMode;
      $("#show-inactive-label").textContent = "\u524A\u9664\u6E08\u307F\u3082\u8868\u793A";
      renderMasterSelectionActions();
      $$("[data-master-type]").forEach((b) => b.classList.toggle("active", b.dataset.masterType === masterType));
      const items = state2.masters[masterType].filter((x) => x.active || $("#show-inactive").checked);
      $("#settings-list").innerHTML = items.map(compactMasterRow).join("") || '<div class="empty-state">\u3053\u306E\u30EA\u30B9\u30C8\u306B\u9805\u76EE\u306F\u3042\u308A\u307E\u305B\u3093\u3002</div>';
      renderCustomerDialog();
      $("#settings-history").innerHTML = state2.settingsHistory.filter((e) => ["deactivate", "reactivate"].includes(e.action) || e.provenance?.origin === "direct-sheet-sync").reverse().map(settingsHistoryHTML).join("") || '<p class="card-meta">\u524A\u9664\u5C65\u6B74\u306F\u3042\u308A\u307E\u305B\u3093\u3002</p>';
    }, settingsHistorySummary = function(type, m) {
      if (!m) return "\u306A\u3057";
      const lines = [`\u540D\u79F0: ${m.name}`, `\u72B6\u614B: ${m.active ? "\u6709\u52B9" : "\u524A\u9664\u6E08\u307F"}`];
      if (type === "members") {
        const p = m.profile ?? {};
        for (const [key, label] of [["birthDate", "\u751F\u5E74\u6708\u65E5"], ["age", "\u5E74\u9F62\uFF08\u4EE5\u524D\u306E\u8A18\u9332\uFF09"], ["gender", "\u6027\u5225"], ["license", "\u514D\u8A31"], ["other", "\u305D\u306E\u4ED6"]]) if (p[key] !== void 0 && p[key] !== null && p[key] !== "") lines.push(`${label}: ${p[key]}`);
      }
      if (type === "customers") {
        for (const [key, label] of [["invoicePostalCode", "\u90F5\u4FBF\u756A\u53F7"], ["invoiceAddress", "\u4F4F\u6240"]]) if (m[key]) lines.push(`${label}: ${m[key]}`);
        for (const key of Object.keys(CATEGORIES)) lines.push(`${CATEGORIES[key]}\u306E\u521D\u671F${key === "other" ? "\u91D1\u984D" : "\u5358\u4FA1"}: ${amount(m.rates?.[key])} ${key === "other" ? "\u5186" : "\u5186/kg"}`);
      }
      if (type === "items" && m.category) {
        lines.push(`\u533A\u5206: ${CATEGORIES[m.category] ?? "\u30FC"}`, `\u5171\u901A\u306E\u521D\u671F${m.category === "other" ? "\u91D1\u984D" : "\u5358\u4FA1"}: ${amount(m.defaultRate)} ${m.category === "other" ? "\u5186" : "\u5186/kg"}`);
      }
      return lines.join("\n");
    }, settingsHistoryHTML = function(e) {
      const m = state2.masters[e.type]?.find((x) => x.id === e.masterId), latest = state2.settingsHistory.filter((x) => x.type === e.type && x.masterId === e.masterId && ["deactivate", "reactivate"].includes(x.action)).at(-1);
      const canRestore = e.action === "deactivate" && m && !m.active && latest === e && !storageFailed;
      const restore = e.action === "deactivate" ? `<button class="button secondary" data-restore-master-history="${esc4(e.masterId)}" data-master-kind="${e.type}" data-version="${m?.version ?? 0}" ${canRestore ? "" : "disabled"}>${m?.active ? "\u5FA9\u65E7\u6E08\u307F" : latest !== e ? "\u5F8C\u306E\u5C65\u6B74\u3042\u308A" : "\u5FA9\u65E7"}</button>` : "";
      return `<article class="history-event"><div class="history-event-head"><span class="event-action">${{ deactivate: "\u524A\u9664", reactivate: "\u5FA9\u5143", update: "\u7DE8\u96C6", create: "\u4F5C\u6210" }[e.action]}</span>${restore}</div><h3>${titles[e.type]} \xB7 ${esc4(displayName(state2, e.type, e.masterId, e.after.name))}</h3><p>${esc4(historyActor(e))} / ${esc4(historyTime(e))}</p><details><summary>\u5909\u66F4\u524D\u5F8C\u3092\u78BA\u8A8D</summary><pre>\u5909\u66F4\u524D: ${esc4(settingsHistorySummary(e.type, e.before))}
\u5909\u66F4\u5F8C: ${esc4(settingsHistorySummary(e.type, e.after))}</pre></details></article>`;
    }, focusItemSettingsAction = function(id) {
      setTimeout(() => {
        if (currentPage === "settings" && masterType === "items" && !dialog.open && !confirmDialog.open) $(id)?.focus();
      }, 0);
    }, renderSecondary = function({ outputAuthority } = {}) {
      renderSessionIdentity();
      renderBrowse();
      renderSettings();
      renderSummary();
      if (adapter && currentPage !== "output") {
        invoiceOutput?.invalidate?.();
        staleViews.add("output");
      } else if (outputAuthority) return invoiceOutput?.refreshPreparedSnapshot?.(outputAuthority);
      else return invoiceOutput?.refresh();
    }, switchPage = function(route) {
      const changed = currentRoute !== route;
      if (changed) {
        if (masterReorderMode) finishMasterReorder(false);
        resetMasterSelection();
        modalContext = null;
        priceContext = null;
        modalDirty = false;
        priceDirty = false;
      }
      const parts = String(route || "report").split("/");
      let page = parts[0];
      if (!pages[page]) {
        page = "report";
        route = "report";
      }
      currentPage = page;
      document2.body.dataset.page = page;
      currentRoute = route;
      selectedCustomerId = null;
      customerSection = null;
      Object.keys(pages).forEach((p) => $(`#${p}-section`).hidden = p !== page);
      $$("[data-nav]").forEach((b) => {
        b.classList.toggle("active", b.dataset.nav === page);
        if (b.dataset.nav === page) b.setAttribute("aria-current", "page");
        else b.removeAttribute("aria-current");
      });
      $("#breadcrumb-current").textContent = pages[page][0];
      if (page === "settings") {
        masterType = titles[parts[1]] ? parts[1] : "members";
        try {
          selectedCustomerId = masterType === "customers" && parts[2] ? decodeURIComponent(parts[2]) : null;
        } catch {
          selectedCustomerId = null;
        }
        customerSection = selectedCustomerId && parts[3] === "prices" ? "prices" : null;
        renderSettings();
      } else priceContext = null;
      if (!selectedCustomerId && (dialog.open || dialogOrigin)) dismissDialog();
      sheetConnection?.setPage(page, parts[1] === "sheet" ? "sheet" : void 0);
      if (adapter && page === "output" && changed && invoiceOutput) {
        void invoiceOutput.refresh();
        staleViews.delete("output");
      }
      if (staleViews.has(page)) {
        if (page === "summary") renderSummary();
        if (page === "report" && !reportDirty) renderReport();
        if (page === "output") void invoiceOutput?.refresh();
        if (page !== "report" || !reportDirty) staleViews.delete(page);
      }
      browseSync?.setContext({ browse: page === "browse", visible: document2.visibilityState !== "hidden", authorized: activated && !root2?.hidden });
    }, rememberDialogOrigin = function(button) {
      if (dialog.open) return;
      const attribute = ["data-open-customer", "data-member-detail", "data-item-detail", "data-detail", "data-edit-master", "data-copy-master"].find((a) => button.hasAttribute(a));
      dialogOrigin = { element: button, ...attribute ? { attribute, value: button.getAttribute(attribute) } : { id: button.id } };
    }, dismissDialog = function() {
      if (dialog.open) dialog.close();
      modalContext = null;
      modalDirty = false;
      $("#dialog-content").replaceChildren();
      dialog.classList.remove("customer-popup");
      const origin = dialogOrigin;
      dialogOrigin = null;
      let target = origin?.element?.isConnected ? origin.element : origin?.attribute ? $$(`[${origin.attribute}]`).find((el) => el.getAttribute(origin.attribute) === origin.value) : origin?.id ? document2.getElementById(origin.id) : null;
      if (target?.closest("section[hidden]")) target = null;
      (target ?? (currentPage === "settings" ? $("#new-master") : document2.querySelector(`[data-nav="${currentPage}"]`)))?.focus();
    }, requestDialogClose = function() {
      if (pending) return;
      if (currentPage === "settings" && selectedCustomerId) return navigate("settings/customers");
      discard(dismissDialog);
    }, discard = function(then) {
      if (pending || invoiceSettings?.isBusy()) return;
      if (!reportDirty && !modalDirty && !priceDirty && !reorderDirty() && !invoiceSettings?.isDirty()) {
        invoiceSettings?.close();
        then();
        return;
      }
      $("#confirm-content").innerHTML = `<div class="dialog-head"><h2 id="confirm-title">\u672A\u4FDD\u5B58\u306E\u5165\u529B\u3092\u7834\u68C4\u3057\u307E\u3059\u304B\uFF1F</h2></div><div class="dialog-body"><p class="confirm-text">\u5165\u529B\u4E2D\u306E\u5185\u5BB9\u306F\u4FDD\u5B58\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u7D9A\u3051\u308B\u5834\u5408\u306F\u5165\u529B\u753B\u9762\u3078\u623B\u308C\u307E\u3059\u3002</p></div><div class="dialog-foot"><button class="button secondary" id="keep-draft">\u5165\u529B\u3092\u7D9A\u3051\u308B</button><button class="button danger" id="discard-draft">\u7834\u68C4\u3057\u3066\u9032\u3080</button></div>`;
      confirmDialog.showModal();
      $("#keep-draft").onclick = () => confirmDialog.close();
      $("#discard-draft").onclick = () => {
        confirmDialog.close();
        modalDirty = false;
        reportDirty = false;
        priceDirty = false;
        if (masterReorderMode) finishMasterReorder(false);
        invoiceSettings?.close({ discard: true });
        if (dialog.open) dialog.close();
        renderReport();
        then();
      };
      $("#keep-draft").focus();
    }, navigate = function(route) {
      discard(() => {
        if (currentRoute === route) return;
        priceContext = null;
        location2.hash = route;
        switchPage(route);
      });
    }, head = function(title, subtitle = "") {
      return `<div class="dialog-head"><div><h2 id="dialog-title">${title}</h2><p>${subtitle}</p></div><button class="close-button" data-close-dialog aria-label="\u9589\u3058\u308B">\xD7</button></div>`;
    }, showDialog = function(html, context) {
      modalContext = context;
      modalDirty = false;
      dialog.classList.toggle("customer-popup", context.kind.startsWith("customer-") || context.kind === "master" && context.type === "customers");
      $("#dialog-content").innerHTML = html;
      if (!dialog.open) dialog.showModal();
      $("#dialog-content").scrollTop = 0;
      $("#dialog-content").focus();
    }, showDetail = function(id) {
      const r = state2.records.find((r2) => r2.id === id);
      if (!r) return toast("\u8A18\u9332\u304C\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u3059\u3002");
      showDialog(`${head("\u8A18\u9332\u306E\u8A73\u7D30", r.deleted ? "\u524A\u9664\u6E08\u307F" : "")}<div class="dialog-body"><h3 class="detail-title">${esc4(recordName(r))}</h3><p>${r.date}</p>${quantities(r)}${reportNotesHTML(r)}<dl class="detail-meta"><div><dt>\u5F53\u56DE\u306E\u53EF\u71C3\u5358\u4FA1</dt><dd>${amount(r.combustibleRate)} \u5186/kg</dd></div><div><dt>\u5F53\u56DE\u306E\u4E0D\u71C3\u5358\u4FA1</dt><dd>${amount(r.noncombustibleRate)} \u5186/kg</dd></div><div><dt>\u4F5C\u6210\u8005</dt><dd>${esc4(personName(r, "createdBy"))}<br>${time(r.createdAt)} JST</dd></div><div><dt>${r.deleted ? "\u524A\u9664\u8005" : "\u6700\u7D42\u7DE8\u96C6\u8005"}</dt><dd>${esc4(personName(r, "lastEditedBy"))}<br>${time(r.updatedAt)} JST</dd></div></dl>${r.priceSource === "legacy-unknown" ? '<p class="price-unknown">\u3053\u306E\u8A18\u9332\u306E\u5358\u4FA1\u306F\u4E0D\u660E\u306E\u307E\u307E\u4FDD\u6301\u3057\u3066\u3044\u307E\u3059\u3002\u73FE\u5728\u306E\u8A2D\u5B9A\u3067\u88DC\u5B8C\u3057\u3066\u3044\u307E\u305B\u3093\u3002</p>' : ""}<h3>\u3053\u306E\u8A18\u9332\u306E\u5909\u66F4\u5C65\u6B74</h3>${state2.history.filter((e) => e.recordId === r.id).reverse().map(historyHTML).join("")}</div><div class="dialog-foot">${r.deleted ? `<button class="button secondary" data-close-dialog>\u9589\u3058\u308B</button><button class="button primary" data-record-action="restore" data-id="${esc4(r.id)}" data-version="${r.version}" ${storageFailed ? "disabled" : ""}>\u3053\u306E\u8A18\u9332\u3092\u5FA9\u5143</button>` : `<button class="button secondary danger-text" data-record-action="delete" data-id="${esc4(r.id)}" data-version="${r.version}">\u524A\u9664</button><button class="button primary" data-edit-record="${esc4(r.id)}">\u7DE8\u96C6\u3059\u308B</button>`}</div>`, { kind: "detail", id, version: r.version });
    }, showEdit = function(id) {
      const r = state2.records.find((r2) => r2.id === id && !r2.deleted);
      if (!r) return toast("\u8A18\u9332\u304C\u5909\u66F4\u3055\u308C\u3066\u3044\u307E\u3059\u3002");
      const c = state2.masters.customers.find((c2) => c2.id === r.customerId);
      showDialog(`${head("\u8A18\u9332\u3092\u7DE8\u96C6", "\u4F5C\u6210\u8005\u306F\u5909\u66F4\u3057\u307E\u305B\u3093")}<form id="edit-form"><div class="dialog-body">${errorHTML("edit-error")}<div id="conflict-panel" hidden></div><div class="form-grid"><label class="field"><span>\u56DE\u53CE\u65E5</span><input type="date" name="date" value="${r.date}" required></label><label class="field"><span>\u53D6\u5F15\u5148</span><input value="${esc4(recordName(r))}" readonly></label></div>${measures(c, r, "", true)}<div class="form-grid">${sessionAttribution()}</div><p class="form-note">\u8A2D\u5B9A\u306E\u73FE\u5728\u5024\u3067\u904E\u53BB\u306E\u5358\u4FA1\u3092\u4E0A\u66F8\u304D\u3057\u307E\u305B\u3093\u3002\u4FDD\u5B58\u3059\u308B\u306E\u306F\u3053\u306E\u8A18\u9332\u3060\u3051\u3067\u3059\u3002</p></div><div class="dialog-foot"><button type="button" class="button secondary" data-close-dialog>\u30AD\u30E3\u30F3\u30BB\u30EB</button><button type="button" class="button primary" id="save-edit">\u5909\u66F4\u3092\u4FDD\u5B58</button></div></form>`, { kind: "edit", id, version: r.version, record: clone(r), masterRevision: state2.masterRevision });
      enforceOther($("#edit-form"));
    }, showMemberDetail = function(id) {
      showMasterPanel("members", id, false);
    }, showItemDetail = function(id) {
      showMasterPanel("items", id, false);
    }, showMasterPanel = function(type, id, editing = false) {
      const m = state2.masters[type].find((x) => x.id === id);
      if (!m) return toast("\u5BFE\u8C61\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002");
      const formId = editing ? "master-form" : "master-view", ro = editing ? "" : 'readonly tabindex="-1"', disabled = editing ? "" : "disabled", name = displayName(state2, type, id);
      const input = (field, label, value, { kind = "text", max = 120, unit = "", min = "", maxValue = "" } = {}) => `<label class="field"><span>${label}${unit ? ` <small>${unit}</small>` : ""}</span><input name="${field}" type="${editing ? kind : "text"}" value="${esc4(value ?? "")}" maxlength="${max}" ${min !== "" ? `min="${min}"` : ""} ${maxValue ? `max="${maxValue}"` : ""} ${kind === "number" ? 'step="any" inputmode="decimal"' : ""} placeholder="\u30FC" ${ro}></label>`;
      const textarea = (field, label, value, max) => `<label class="field full"><span>${label}</span><textarea name="${field}" rows="3" maxlength="${max}" placeholder="\u30FC" ${ro}>${esc4(value ?? "")}</textarea></label>`;
      let fields2 = "";
      if (type === "members") {
        const profile = m.profile ?? {};
        fields2 = `<div class="form-grid member-profile-fields">${input("profileBirthDate", "\u751F\u5E74\u6708\u65E5", profile.birthDate, { kind: "date", min: "0001-01-01", maxValue: localDate() })}<label class="field"><span>\u6027\u5225</span><select name="profileGender" ${disabled}><option value="">\u30FC</option>${["\u7537", "\u5973", "\u30FC"].map((value) => `<option value="${value}" ${profile.gender === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>${textarea("profileLicense", "\u514D\u8A31", profile.license, 1e3)}${textarea("profileOther", "\u305D\u306E\u4ED6", profile.other, 500)}</div>`;
      } else if (type === "customers") {
        fields2 = `<div class="form-grid customer-info-fields">${input("invoicePostalCode", "\u90F5\u4FBF\u756A\u53F7", m.invoicePostalCode, { max: 16 })}${textarea("invoiceAddress", "\u4F4F\u6240", m.invoiceAddress, 90)}</div><h3>\u5024\u6BB5</h3><div class="form-grid customer-rate-fields">${Object.keys(CATEGORIES).map((k) => input("rate:" + k, CATEGORIES[k], m.rates[k], { kind: "number", min: 0, maxValue: "1000000000", unit: k === "other" ? "\u5186" : "\u5186/kg" })).join("")}</div>`;
      } else {
        const category = commonRateCategory(m);
        fields2 = category ? input("defaultRate", category === "other" ? "\u5171\u901A\u306E\u521D\u671F\u91D1\u984D" : "\u5171\u901A\u306E\u521D\u671F\u5358\u4FA1", m.defaultRate, { kind: "number", min: 0, maxValue: "1000000000", unit: category === "other" ? "\u5186" : "\u5186/kg" }) : "";
      }
      const context = editing ? { kind: "master", type, id, version: m.version, draft: clone(m) } : { kind: type === "customers" ? "customer-detail" : type === "members" ? "member-detail" : "item-detail", id, version: m.version };
      showDialog(`<form id="${formId}" class="master-detail-form ${editing ? "is-edit" : "is-view"}"><div class="dialog-head"><h2 id="dialog-title" aria-label="${esc4(name)}"><input class="detail-name" aria-label="\u540D\u79F0" name="name" value="${esc4(editing ? m.name : name)}" maxlength="120" required ${ro}></h2><button type="button" class="close-button" data-close-dialog aria-label="\u9589\u3058\u308B">\xD7</button></div><div class="dialog-body ${type === "members" ? "member-profile" : ""}">${errorHTML("master-error")}${fields2}</div><div class="dialog-foot">${editing ? '<button type="button" class="button secondary" data-cancel-master>\u30AD\u30E3\u30F3\u30BB\u30EB</button><button type="button" class="button primary" id="save-master">\u4FDD\u5B58</button>' : `<button type="button" class="button secondary danger-text" data-toggle-master="${esc4(id)}" data-version="${m.version}">${m.active ? "\u524A\u9664" : "\u5FA9\u65E7"}</button><button type="button" class="button primary" data-edit-master="${esc4(id)}">\u5909\u66F4</button>`}</div></form>`, context);
    }, cancelMasterEdit = function() {
      const ctx = modalContext;
      if (ctx?.kind !== "master" || !ctx.id) return requestDialogClose();
      discard(() => {
        modalContext = null;
        showMasterPanel(ctx.type, ctx.id, false);
      });
    }, memberProfileFields = function(m) {
      const p = m.profile ?? {};
      return `<div class="form-grid member-profile-fields"><label class="field"><span>\u751F\u5E74\u6708\u65E5</span><input type="date" name="profileBirthDate" min="0001-01-01" max="${localDate()}" value="${esc4(p.birthDate ?? "")}"></label><label class="field"><span>\u6027\u5225</span><select name="profileGender"><option value="">\u672A\u9078\u629E</option>${["\u7537", "\u5973", "\u30FC"].map((value) => `<option value="${value}" ${p.gender === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="field full"><span>\u514D\u8A31</span><textarea name="profileLicense" rows="3" maxlength="1000" placeholder="\u7A2E\u985E\u30FB\u8CC7\u683C\u540D">${esc4(p.license ?? "")}</textarea></label><label class="field full"><span>\u305D\u306E\u4ED6</span><textarea name="profileOther" rows="3" maxlength="500" placeholder="\u4EFB\u610F\u306E\u77ED\u3044\u30E1\u30E2">${esc4(p.other ?? "")}</textarea></label></div>`;
    }, showMaster = function(id = null, duplicate = false) {
      if (id && !duplicate) return showMasterPanel(masterType, id, true);
      const old = id ? state2.masters[masterType].find((x) => x.id === id) : null;
      const m = old ? masterDraft(state2, masterType, id, { duplicate }) : { name: "", enabled: { combustible: true, noncombustible: true, other: true }, rates: { combustible: null, noncombustible: null, other: null }, itemIds: [] };
      const extra = masterType === "customers" ? `<label class="field"><span>\u90F5\u4FBF\u756A\u53F7</span><input name="invoicePostalCode" value="${esc4(m.invoicePostalCode ?? "")}" maxlength="16" autocomplete="off"></label><label class="field"><span>\u4F4F\u6240</span><textarea name="invoiceAddress" rows="3" maxlength="90">${esc4(m.invoiceAddress ?? "")}</textarea><small>3\u884C\u4EE5\u5185</small></label><h3>\u5024\u6BB5</h3>${Object.keys(CATEGORIES).map((k) => numeric("rate:" + k, CATEGORIES[k], m.rates[k], k === "other" ? "\u5186" : "\u5186/kg")).join("")}<p class="form-note">\u7A7A\u6B04\u306E\u5834\u5408\u306E\u307F\u51E6\u5206\u7269\u54C1\u306E\u5171\u901A\u5024\u3092\u4F7F\u3044\u307E\u3059\u30020\u306F\u305D\u306E\u307E\u307E\u4F7F\u3044\u307E\u3059\u3002\u904E\u53BB\u306E\u5831\u544A\u306F\u5909\u3048\u307E\u305B\u3093\u3002</p>` : masterType === "items" ? `${!duplicate && old && commonRateCategory(old) ? numeric("defaultRate", old.category === "other" ? "\u5171\u901A\u306E\u521D\u671F\u91D1\u984D" : "\u5171\u901A\u306E\u521D\u671F\u5358\u4FA1", m.defaultRate, old.category === "other" ? "\u5186" : "\u5186/kg") + '<p class="form-note">\u4EFB\u610F\u3002\u53D6\u5F15\u5148\u306E\u5024\u6BB5\u304C\u672A\u8A2D\u5B9A\u306E\u5834\u5408\u3060\u3051\u4F7F\u3044\u307E\u3059\u30020\u3068\u7A7A\u6B04\u3092\u533A\u5225\u3057\u307E\u3059\u3002</p>' : '<p class="form-note">\u51E6\u5206\u7269\u54C1\u306E\u540D\u79F0\u3092\u767B\u9332\u3057\u307E\u3059\u3002\u7D30\u304B\u3044\u5185\u5BB9\u306F\u5831\u544A\u306E\u5099\u8003\u3067\u88DC\u3044\u307E\u3059\u3002</p>'}` : memberProfileFields(m);
      showDialog(`${head(`${titles[masterType]}\u3092${duplicate ? "\u8907\u88FD" : old ? "\u7DE8\u96C6" : "\u8FFD\u52A0"}`, duplicate ? "\u540D\u79F0\u3092\u5165\u529B\u3057\u3066\u65B0\u3057\u3044\u9805\u76EE\u3092\u4F5C\u6210\u3057\u307E\u3059\u3002\u904E\u53BB\u306E\u8A18\u9332\u306F\u8907\u88FD\u3057\u307E\u305B\u3093\u3002" : "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u3060\u3051\u306E\u8A2D\u5B9A")}<form id="master-form"><div class="dialog-body">${errorHTML("master-error")}<label class="field"><span class="field-label">\u540D\u79F0<span class="required">\u5FC5\u9808</span></span><input name="name" value="${esc4(m.name)}" maxlength="120" required placeholder="\u65B0\u3057\u3044\u540D\u79F0"></label>${extra}<div class="category-block">${sessionAttribution()}</div></div><div class="dialog-foot"><button type="button" class="button secondary" data-close-dialog>\u30AD\u30E3\u30F3\u30BB\u30EB</button><button type="button" class="button primary" id="save-master">${old && !duplicate ? "\u4FDD\u5B58" : "\u8FFD\u52A0\u3059\u308B"}</button></div></form>`, { kind: "master", type: masterType, id: duplicate ? null : id, version: duplicate ? null : old?.version, draft: clone(m) });
    }, operationConfirm = function({ title, body, label, operation, onSuccess }) {
      if (storageFailed) return toast("\u4FDD\u5B58\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002");
      $("#confirm-content").innerHTML = `<div class="dialog-head"><h2 id="confirm-title">${title}</h2></div><form id="operation-form"><div class="dialog-body">${errorHTML("operation-error")}<p class="confirm-text">${body}</p>${sessionAttribution("\u64CD\u4F5C\u3059\u308B\u4EBA")}</div><div class="dialog-foot"><button class="button secondary" type="button" id="cancel-operation">\u30AD\u30E3\u30F3\u30BB\u30EB</button><button class="button primary" id="confirm-operation">${label}</button></div></form>`;
      confirmDialog.showModal();
      $("#cancel-operation").onclick = () => {
        if (!pending) confirmDialog.close();
      };
      $("#operation-form").onsubmit = async (e) => {
        e.preventDefault();
        if (pending || !e.currentTarget.reportValidity()) return;
        await saving($("#confirm-operation"), "operation-error", async () => {
          await mutate(operation);
          confirmDialog.close();
          if (dialog.open) dialog.close();
          modalDirty = false;
          onSuccess?.();
          toast(`${label}\u64CD\u4F5C\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002\u5C65\u6B74\u306F\u6B8B\u3063\u3066\u3044\u307E\u3059\u3002`);
        });
      };
      $("#cancel-operation").focus();
    }, setPeriod = function(next) {
      period = next;
      $$("[data-period]").forEach((b) => b.classList.toggle("active", b.dataset.period === next));
      const el = $("#period-value");
      el.type = next === "day" ? "date" : next === "month" ? "month" : "number";
      if (next === "year") {
        el.min = "1";
        el.max = "9999";
        el.step = "1";
      }
      el.value = next === "day" ? localDate() : next === "month" ? localDate().slice(0, 7) : localDate().slice(0, 4);
      $("#period-label").textContent = next === "day" ? "\u5BFE\u8C61\u65E5" : next === "month" ? "\u5BFE\u8C61\u5E74\u6708" : "\u5BFE\u8C61\u5E74\uFF081\u301C12\u6708\uFF09";
      renderSummary();
    }, activate = function() {
      if (disposed) return;
      if (activated) {
        browseSync?.setContext({ browse: currentPage === "browse", visible: document2.visibilityState !== "hidden", authorized: true }, { alreadyFresh: true });
        return;
      }
      activated = true;
      browseSync?.setContext({ browse: currentPage === "browse", visible: document2.visibilityState !== "hidden", authorized: true }, { alreadyFresh: true });
      assistDispose = (services.installInputAssist ?? installInputAssist)({ doc: document2, win: window2 });
      updatesControl = (services.startUpdates ?? startUpdates)({ doc: document2, win: window2, guard: discard, canReload: () => !suspendedDraft && !reportDirty && !modalDirty && !priceDirty && !reorderDirty() && !masterReorder?.dragging && !pending && !invoiceSettings?.isDirty() && !invoiceSettings?.isBusy() });
    }, dispose = function() {
      if (disposed) return;
      disposed = true;
      offAuth?.();
      browseSync?.dispose();
      transferPanel?.dispose?.();
      suspendedModals.dispose();
      lifecycle.abort();
      assistDispose?.();
      updatesControl?.dispose?.();
      invoiceSettings?.dispose?.();
      invoiceOutput?.destroy?.();
      clearTimeout(toastTimer);
    }, showRecovery = function(error, { reauthenticate = false } = {}) {
      document2.dispatchEvent(new window2.CustomEvent("routenote-connection-error", { detail: { message: error.message, retry: reveal, reauthenticate } }));
    }, conceal = function() {
      if (!adapter || disposed) return;
      visibilityEpoch++;
      adapter.invalidateReads();
      suspendedDraft = reportDirty || modalDirty || priceDirty || reorderDirty() || invoiceSettings?.isDirty() || suspendedDraft;
      browseSync?.setContext({ visible: false, authorized: false });
      suspendedModals.suspend();
      if (root2) {
        root2.hidden = true;
        root2.inert = true;
      }
    }, reveal = function({ expose = true } = {}) {
      if (!adapter || disposed || !activated && expose || document2.visibilityState === "hidden") return Promise.resolve();
      if (revealPending) {
        revealQueued = true;
        return revealPending;
      }
      const generation = visibilityEpoch;
      if (expose) document2.dispatchEvent(new window2.CustomEvent("routenote-connection-loading"));
      revealPending = (async () => {
        try {
          await adapter.refresh({ fresh: true });
          if (generation !== visibilityEpoch || disposed || document2.visibilityState === "hidden") return;
          const nextKey = adapter.snapshotKey();
          if (suspendedDraft && !pending && confirmedSnapshotKey !== nextKey) draftConflict = true;
          confirmedSnapshotKey = nextKey;
          state2 = adapter.read();
          if (!reportDirty && !pending) renderReport();
          if (!modalDirty && !priceDirty && !invoiceSettings?.isDirty()) {
            const output = await renderSecondary({ outputAuthority: currentPage === "output" && !lightweight ? adapter.preparedAuthority() : void 0 });
            if (output?.error && output.error.code !== "BILLING_NOT_READY") throw output.error;
          } else invoiceOutput?.invalidate?.();
          if (generation !== visibilityEpoch || disposed || document2.visibilityState === "hidden") return;
          adapter.read();
          for (const page of ["summary", "settings", "output"]) staleViews.add(page);
          if (draftConflict) {
            $("#global-error").hidden = false;
            $("#global-error").textContent = "\u7DE8\u96C6\u4E2D\u306B\u5171\u6709\u30C7\u30FC\u30BF\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002\u5165\u529B\u306F\u4FDD\u6301\u3057\u3066\u3044\u307E\u3059\u3002\u4FDD\u5B58\u305B\u305A\u3001\u5165\u529B\u3092\u63A7\u3048\u3066\u304B\u3089\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u5909\u66F4\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
          }
          if (expose && root2) {
            root2.hidden = false;
            root2.inert = false;
          }
          if (expose) suspendedModals.resume();
          else revealPrepared = true;
          suspendedDraft = false;
          browseSync?.setContext({ browse: currentPage === "browse", visible: true, authorized: expose }, { alreadyFresh: true });
          if (expose) document2.dispatchEvent(new window2.CustomEvent("routenote-connection-restored"));
        } catch (error) {
          if (generation !== visibilityEpoch) return;
          conceal();
          if (expose) showRecovery(error);
          else throw error;
        }
      })().finally(() => {
        revealPending = null;
        const again = revealQueued && generation !== visibilityEpoch;
        revealQueued = false;
        if (again && !disposed && document2.visibilityState !== "hidden") return reveal({ expose });
      });
      return revealPending;
    };
    const $ = (s) => document2.querySelector(s), $$ = (s) => [...document2.querySelectorAll(s)];
    const esc4 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const amount = (v) => v === null || v === void 0 || v === "" ? "\u30FC" : new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 6 }).format(Number(v));
    const time = (v) => v === null || v === void 0 || v === "" ? "\u30FC" : new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
    const pages = { report: ["\u5831\u544A", "\uFF0B"], browse: ["\u95B2\u89A7\u30FB\u7DE8\u96C6", "\u25A4"], ...lightweight ? { aggregate: ["\u96C6\u7D04", "\u25A6"] } : {}, summary: ["\u96C6\u8A08", "\u25A5"], output: ["\u51FA\u529B", "\u21E7"], settings: ["\u8A2D\u5B9A", "\u2699"] };
    const titles = { customers: "\u53D6\u5F15\u5148", members: "\u30E1\u30F3\u30D0\u30FC", items: "\u51E6\u5206\u7269\u54C1" };
    let sheetConnection, state2, storageFailed = false, pending = false, reportDirty = false, modalDirty = false, currentPage = "report", currentRoute = "report", selectedCustomerId = null, customerSection = null, priceDirty = false, priceContext = null, browseTab = "list", masterType = "members", masterSelectionMode = false, selectedMasterId = null, period = "month", modalContext = null, dialogOrigin = null, toastTimer;
    const IS_CALCULATION_SAMPLE = !adapter && new URLSearchParams(location2.search).get("example") === "calculation";
    const APP_STORAGE_KEY = IS_CALCULATION_SAMPLE ? STORAGE_KEY_V3 + ":calculation-v1" : STORAGE_KEY_V3;
    const ISSUER_STORAGE_KEY = IS_CALCULATION_SAMPLE ? INVOICE_SETTINGS_KEY + ":calculation-v1" : INVOICE_SETTINGS_KEY;
    let calculationDraftOffered = false;
    let masterReorder = null, masterReorderMode = false, reorderContext = null;
    const dialog = $("#main-dialog"), confirmDialog = $("#confirm-dialog"), sessionDialog = $("#demo-session-dialog");
    const authenticatedMember = () => {
      const actor = adapter.actor();
      return { id: actor.memberId, name: actor.displayName };
    };
    const demoSession = adapter ? { current: authenticatedMember, require: authenticatedMember, storageAvailable: true, select() {
      throw Error("\u30ED\u30B0\u30A4\u30F3\u3057\u305F\u5229\u7528\u8005\u304C\u64CD\u4F5C\u3057\u307E\u3059\u3002");
    } } : createDemoSession({ getStorage: () => window2.sessionStorage });
    async function mutate(operation, { render = true } = {}) {
      if (adapter) {
        if (draftConflict) throw Error("\u7DE8\u96C6\u4E2D\u306B\u5171\u6709\u30C7\u30FC\u30BF\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002\u5165\u529B\u3092\u63A7\u3048\u3066\u304B\u3089\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u3001\u5909\u66F4\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        const result = await adapter.mutate(operation);
        confirmedSnapshotKey = adapter.snapshotKey();
        state2 = result.state;
        if (!result.projectionCurrent) {
          $("#global-error").hidden = false;
          $("#global-error").textContent = "\u4FDD\u5B58\u306F\u5B8C\u4E86\u3057\u307E\u3057\u305F\u304C\u3001\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u306E\u96C6\u8A08\u53CD\u6620\u306F\u672A\u78BA\u8A8D\u3067\u3059\u3002";
        }
        if (render) renderSecondary();
        transferPanel?.refresh?.();
        return result;
      }
      const perform = () => {
        if (storageFailed) throw new Error("\u4FDD\u5B58\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002");
        let fresh;
        try {
          fresh = read();
          if (!fresh) throw new Error("\u4FDD\u5B58\u30C7\u30FC\u30BF\u304C\u6D88\u53BB\u3055\u308C\u307E\u3057\u305F\u3002\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        } catch (e) {
          fail4(e);
          throw e;
        }
        state2 = fresh;
        const actor = demoSession.require(fresh);
        const result = operation(fresh, actor.id);
        try {
          localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(result.state));
        } catch (e) {
          fail4(e);
          throw new Error("\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5165\u529B\u3092\u6B8B\u3057\u3066\u3044\u307E\u3059\u3002");
        }
        state2 = result.state;
        if (render) renderSecondary();
        return result;
      };
      return navigator.locks?.request ? navigator.locks.request(`${APP_STORAGE_KEY}:mutation`, perform) : perform();
    }
    listen($("#demo-session-form"), "submit", (e) => {
      e.preventDefault();
      if (pending || !e.currentTarget.reportValidity()) return;
      try {
        const fresh = read();
        if (!fresh) throw new Error("\u4FDD\u5B58\u30C7\u30FC\u30BF\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        state2 = fresh;
        demoSession.select(state2, $("#demo-session-member").value);
        sessionDialog.close();
        renderSessionIdentity();
      } catch (error) {
        showError("demo-session-error", error);
      }
    });
    listen($("#cancel-demo-session"), "click", () => {
      if (!pending && demoSession.current(state2)) sessionDialog.close();
    });
    listen(sessionDialog, "cancel", (e) => {
      if (pending || !demoSession.current(state2)) e.preventDefault();
    });
    let reportRowSequence = 0, activeReportRowId = null, reportTabsObserver = null;
    listen(window2, "resize", layoutReportTabs);
    const historyActor = (e) => e.provenance?.origin === "direct-sheet-sync" ? e.provenance.sourceKind === "private-auth-roster" ? "\u30E1\u30F3\u30D0\u30FC\u540D\u7C3F\u3092\u540C\u671F\uFF08\u7DE8\u96C6\u8005\u4E0D\u660E\uFF09" : "\u30B7\u30FC\u30C8\u3067\u5909\u66F4\uFF08\u7DE8\u96C6\u8005\u4E0D\u660E\uFF09" : displayName(state2, "members", e.actorId, e.actor);
    const historyTime = (e) => e.timestamp == null ? "\u7DE8\u96C6\u65E5\u6642\u4E0D\u660E" : time(e.timestamp) + " JST";
    async function saveMasterReorder() {
      if (!masterReorderMode || !masterReorder || masterReorder.dragging) return;
      const controller = masterReorder, ctx = reorderContext, draft = controller.getOrder(), visible = new Set(ctx.visibleIds);
      let i = 0;
      const complete = ctx.allIds.map((id) => visible.has(id) ? draft[i++] : id);
      await saving($("#save-master-reorder"), "master-reorder-error", async () => {
        controller.setBusy(true);
        try {
          await mutate((s, actor) => mutations.reorderMasters(s, ctx.type, complete, ctx.revision, actor, ctx.draggedId ?? draft[0]), { render: false });
          finishMasterReorder(false);
          renderSecondary();
          if (!reportDirty) renderReport();
          toast("\u4E26\u3073\u9806\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002");
        } finally {
          controller.setBusy(false);
        }
      });
      if (masterReorderMode) $("#save-master-reorder").disabled = !masterReorder.getDirty() || storageFailed;
    }
    listen($("#settings-help-toggle"), "click", () => {
      const help = $("#settings-list-note");
      help.open = !help.open;
      $("#settings-help-toggle").setAttribute("aria-expanded", String(help.open));
    });
    listen($("#settings-list-note"), "toggle", () => $("#settings-help-toggle").setAttribute("aria-expanded", String($("#settings-list-note").open)));
    async function saving(button, errorId, fn) {
      if (pending || storageFailed) return;
      pending = true;
      const label = button.textContent, controls = $$("input,select,textarea,button").map((el) => [el, el.disabled]);
      controls.forEach(([el]) => el.disabled = true);
      button.textContent = "\u4FDD\u5B58\u4E2D\u2026";
      try {
        await fn();
      } catch (e) {
        if (errorId === "report-error" && e.customerId) {
          const row = reportRows().find((row2) => row2.dataset.entry === e.customerId);
          if (row) selectReportRow(row.dataset.reportRow);
        }
        showError(errorId, e);
        if (adapter) appendWorkspaceRecovery({ element: $("#" + errorId), adapter, reload: () => location2.reload() });
      } finally {
        pending = false;
        controls.forEach(([el, disabled]) => {
          if (el.isConnected) el.disabled = disabled;
        });
        if (button.isConnected) button.textContent = label;
        ensureDemoSession();
      }
    }
    let explicitDetailSave = false;
    const detailEditing = (el) => el?.closest?.("#master-form,#price-form,#edit-form");
    listen(document2, "keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229 && (e.target.matches?.("#report-form [data-single-line-note]") || detailEditing(e.target) && e.target.tagName !== "TEXTAREA")) e.preventDefault();
    }, true);
    listen(document2, "input", (e) => {
      const measure = e.target.closest("[data-measure-category]");
      if (measure) refreshMeasureTotal(measure);
      if (e.target.closest("#report-form")) reportDirty = true;
      if (e.target.closest("#edit-form,#master-form")) modalDirty = true;
      if (e.target.closest("#price-form")) priceDirty = true;
    });
    listen(document2, "change", (e) => {
      const el = e.target;
      if (el.matches("[data-report-customer]")) changeReportCustomer(el);
      if (el.matches("[data-use-other]")) {
        const box = el.parentElement.nextElementSibling;
        box.hidden = !el.checked;
        enforceOther(box.parentElement);
        if (el.closest("#report-form")) reportDirty = true;
        else modalDirty = true;
      }
      const measure = el.closest("[data-measure-category]");
      if (measure) refreshMeasureTotal(measure);
      if (el.id === "browse-month") renderBrowse();
      if (el.id === "period-value") renderSummary();
      if (el.matches("[data-master-select]")) {
        selectedMasterId = el.dataset.masterSelect;
        $$(".master-compact").forEach((row) => row.classList.toggle("is-selected", row.querySelector("[data-master-select]")?.checked ?? false));
        renderMasterSelectionActions();
      }
      if (el.id === "show-inactive") renderSettings();
    });
    listen($("#browse-search"), "input", renderBrowse);
    listen(document2, "keydown", (e) => {
      const tab = e.target.closest("[data-report-tab]");
      if (!tab || pending || e.altKey || e.ctrlKey || e.metaKey) return;
      const tabs = $$("#report-tabs [data-report-tab]"), index = tabs.indexOf(tab);
      let next;
      if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      else return;
      e.preventDefault();
      selectReportRow(tabs[next].dataset.reportTab, { focusTab: true });
    });
    listen(document2, "click", async (e) => {
      const b = e.target.closest("button");
      if (!b || pending || b.disabled) return;
      if (["save-master", "save-edit", "save-prices"].includes(b.id)) {
        explicitDetailSave = true;
        try {
          b.form.requestSubmit();
        } finally {
          explicitDetailSave = false;
        }
        return;
      }
      if (b.hasAttribute("data-report-tab")) return selectReportRow(b.dataset.reportTab, { focusTab: true });
      if (b.id === "add-report-row") {
        $("#report-rows").insertAdjacentHTML("beforeend", reportRowHTML());
        activeReportRowId = reportRows().at(-1).dataset.reportRow;
        reportDirty = true;
        refreshReportChoices();
        reportRows().at(-1).querySelector("[data-report-customer]").focus();
        return;
      }
      if (b.hasAttribute("data-remove-report-row")) return removeReportRow(b.closest("[data-report-row]"));
      if (b.matches("[data-open-customer],[data-member-detail],[data-item-detail],[data-detail],[data-edit-master],[data-copy-master],#new-master,#master-copy")) rememberDialogOrigin(b);
      if (b.id === "open-sheet-from-session") {
        sessionDialog.close();
        return navigate("browse/sheet");
      }
      if (b.id === "open-google-account") return discard(() => location2.assign("./auth-qa.html"));
      if (b.id === "change-demo-user") return discard(() => {
        priceContext = null;
        renderSettings();
        showDemoSession();
      });
      if (b.dataset.nav) return navigate(b.dataset.nav);
      if (b.dataset.browse) {
        browseTab = b.dataset.browse;
        $$("[data-browse]").forEach((x) => x.classList.toggle("active", x === b));
        renderBrowse();
        return;
      }
      if (b.hasAttribute("data-summary-details")) return toggleSummaryDetails(b);
      if (b.dataset.period) return setPeriod(b.dataset.period);
      if (b.dataset.masterType) return navigate("settings/" + b.dataset.masterType);
      if (b.dataset.settingsRoute) return navigate(b.dataset.settingsRoute);
      if (b.id === "reorder-masters") return startMasterReorder();
      if (b.id === "cancel-master-reorder") {
        masterReorder?.cancel();
        return;
      }
      if (b.id === "save-master-reorder") return saveMasterReorder();
      if (b.id === "select-masters") {
        masterSelectionMode = !masterSelectionMode;
        selectedMasterId = null;
        renderSettings();
        return;
      }
      if (b.dataset.memberDetail) return showMemberDetail(b.dataset.memberDetail);
      if (b.dataset.itemDetail) return showItemDetail(b.dataset.itemDetail);
      if (b.id === "new-master") return showMaster();
      if (b.dataset.editMaster) return showMaster(b.dataset.editMaster);
      if (b.dataset.copyMaster) return showMaster(b.dataset.copyMaster, true);
      if (b.dataset.detail) return showDetail(b.dataset.detail);
      if (b.dataset.editRecord) return showEdit(b.dataset.editRecord);
      if (b.hasAttribute("data-cancel-master")) return cancelMasterEdit();
      if (b.hasAttribute("data-close-dialog")) return requestDialogClose();
      if (b.dataset.restoreMasterHistory) {
        const id = b.dataset.restoreMasterHistory, type = b.dataset.masterKind, m = state2.masters[type]?.find((x) => x.id === id), v = Number(b.dataset.version);
        if (!m || m.active) return toast("\u3053\u306E\u9805\u76EE\u306F\u65E2\u306B\u5FA9\u65E7\u3055\u308C\u3066\u3044\u307E\u3059\u3002");
        return operationConfirm({ title: `\u3053\u306E${titles[type]}\u3092\u5FA9\u65E7\u3057\u307E\u3059\u304B\uFF1F`, body: `${esc4(m.name)}<br>\u5143\u306E\u5185\u5BB9\u3067\u9078\u629E\u80A2\u306B\u623B\u3057\u307E\u3059\u3002\u904E\u53BB\u306E\u8A18\u9332\u30FB\u5358\u4FA1\u30FB\u524A\u9664\u5C65\u6B74\u306F\u4FDD\u6301\u3057\u307E\u3059\u3002`, label: "\u5FA9\u65E7\u3059\u308B", operation: (s, a) => mutations.setMasterActive(s, type, id, v, true, a), onSuccess: () => {
          resetMasterSelection();
          renderSettings();
          if (!reportDirty) renderReport();
        } });
      }
      if (b.dataset.toggleMaster) {
        const id = b.dataset.toggleMaster, type = masterType, m = state2.masters[type].find((x) => x.id === id), v = Number(b.dataset.version);
        return operationConfirm({ title: m.active ? "\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F" : "\u5FA9\u65E7\u3057\u307E\u3059\u304B\uFF1F", body: `${esc4(m.name)}<br>${m.active ? "\u524A\u9664\u5C65\u6B74\u304B\u3089\u5FA9\u65E7\u3067\u304D\u307E\u3059\u3002\u904E\u53BB\u306E\u8A18\u9332\u306F\u6B8B\u308A\u3001\u65B0\u898F\u5165\u529B\u306E\u9078\u629E\u80A2\u304B\u3089\u5916\u308C\u307E\u3059\u3002" : "\u65B0\u3057\u3044\u5165\u529B\u306E\u9078\u629E\u80A2\u306B\u623B\u3057\u307E\u3059\u3002"}`, label: m.active ? "\u524A\u9664\u3059\u308B" : "\u5FA9\u5143\u3059\u308B", operation: (s, a) => mutations.setMasterActive(s, type, id, v, !m.active, a), onSuccess: () => {
          resetMasterSelection();
          renderSettings();
          if (type === "items") focusItemSettingsAction("#select-masters");
          if (!reportDirty) renderReport();
        } });
      }
      if (b.dataset.recordAction) {
        const action = b.dataset.recordAction, id = b.dataset.id, v = Number(b.dataset.version), r = state2.records.find((x) => x.id === id);
        return operationConfirm({ title: action === "delete" ? "\u3053\u306E\u8A18\u9332\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F" : "\u3053\u306E\u8A18\u9332\u3092\u5FA9\u5143\u3057\u307E\u3059\u304B\uFF1F", body: `${esc4(recordName(r))} \xB7 ${r.date}<br>${action === "delete" ? "\u524A\u9664\u524D\u306E\u5185\u5BB9\u30FB\u524A\u9664\u8005\u30FB\u65E5\u6642\u3092\u6B8B\u3057\u3001\u524A\u9664\u6E08\u307F\u304B\u3089\u5FA9\u5143\u3067\u304D\u307E\u3059\u3002" : "\u540C\u3058\u65E5\u30FB\u53D6\u5F15\u5148\u306E\u6709\u52B9\u306A\u8A18\u9332\u304C\u3042\u308B\u5834\u5408\u306F\u5FA9\u5143\u3092\u6B62\u3081\u307E\u3059\u3002\u524A\u9664\u5C65\u6B74\u306F\u6D88\u3057\u307E\u305B\u3093\u3002"}`, label: action === "delete" ? "\u524A\u9664\u3059\u308B" : "\u5FA9\u5143\u3059\u308B", operation: (s, a) => (action === "delete" ? mutations.deleteRecord : mutations.restoreRecord)(s, id, v, a) });
      }
    });
    listen(document2, "submit", async (e) => {
      const form = e.target;
      if (form.id === "master-view") {
        e.preventDefault();
        return;
      }
      if (!["report-form", "edit-form", "master-form", "price-form"].includes(form.id)) return;
      e.preventDefault();
      if (form.id !== "report-form" && !explicitDetailSave) return;
      if (pending || (form.id === "report-form" ? !validateReportForm(form) : !form.reportValidity())) return;
      const fd = new FormData(form);
      if (form.id === "price-form") {
        const ctx = priceContext, input = { ...clone(ctx.snapshot), rates: Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, fd.get("rate:" + k)])) };
        await saving($("#save-prices"), "price-error", async () => {
          await mutate((s, actor) => mutations.saveMaster(s, "customers", input, { id: ctx.id, expectedVersion: ctx.version, actorId: actor }));
          priceDirty = false;
          priceContext = null;
          renderSettings();
          if (!reportDirty) renderReport();
          toast("\u3053\u306E\u53D6\u5F15\u5148\u306E\u5024\u6BB5\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002\u904E\u53BB\u306E\u5831\u544A\u306F\u5909\u3048\u3066\u3044\u307E\u305B\u3093\u3002");
        });
      } else if (form.id === "report-form") {
        const input = { date: fd.get("date"), masterRevision: Number(form.dataset.masterRevision), rows: reportRows().map((row) => ({ customerId: row.dataset.entry, ...readMeasures(form, row.dataset.entry + ":") })) };
        await saving($("#save-report"), "report-error", async () => {
          const r = await mutate((s, actor) => mutations.createRecords(s, { ...input, createdById: actor }, actor));
          reportDirty = false;
          renderReport();
          toast(`${r.record.count}\u4EF6\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002\u5229\u7528\u8005\u3092\u4F5C\u6210\u8005\u3068\u3057\u3066\u8A18\u9332\u3057\u307E\u3057\u305F\u3002`);
        });
      } else if (form.id === "edit-form") {
        const ctx = modalContext, input = { ...readMeasures(form, ""), date: fd.get("date"), customerId: ctx.record.customerId, masterRevision: ctx.masterRevision };
        await saving($("#save-edit"), "edit-error", async () => {
          try {
            await mutate((s, actor) => mutations.updateRecord(s, ctx.id, ctx.version, input, actor));
            modalDirty = false;
            dismissDialog();
            toast("\u5909\u66F4\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002\u8A2D\u5B9A\u306E\u5358\u4FA1\u306F\u5909\u3048\u3066\u3044\u307E\u305B\u3093\u3002");
          } catch (error) {
            if (error instanceof ConflictError) {
              const panel = $("#conflict-panel");
              panel.hidden = false;
              panel.className = "conflict-panel";
              panel.innerHTML = "<h3>\u66F4\u65B0\u304C\u91CD\u306A\u308A\u307E\u3057\u305F\u3002\u4FDD\u5B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002</h3><p>\u4E0B\u66F8\u304D\u306F\u30D5\u30A9\u30FC\u30E0\u306B\u6B8B\u3057\u3066\u3044\u307E\u3059\u3002\u5165\u529B\u3092\u63A7\u3048\u3001\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u3066\u6700\u65B0\u306E\u8A18\u9332\u30FB\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u81EA\u52D5\u4E0A\u66F8\u304D\u306F\u3057\u307E\u305B\u3093\u3002</p>";
            }
            throw error;
          }
        });
      } else {
        const ctx = modalContext, input = { ...clone(ctx.draft), name: fd.get("name"), ...ctx.type === "customers" ? { invoicePostalCode: fd.get("invoicePostalCode"), invoiceAddress: fd.get("invoiceAddress"), rates: Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, fd.get("rate:" + k)])) } : {}, ...ctx.type === "items" && fd.has("defaultRate") ? { defaultRate: fd.get("defaultRate") } : {}, ...ctx.type === "members" ? { profile: { ...clone(ctx.draft.profile ?? {}), birthDate: fd.get("profileBirthDate"), gender: fd.get("profileGender"), license: fd.get("profileLicense"), other: fd.get("profileOther") } } : {} };
        await saving($("#save-master"), "master-error", async () => {
          const saved = await mutate((s, actor) => mutations.saveMaster(s, ctx.type, input, { id: ctx.id, expectedVersion: ctx.version, actorId: actor }));
          modalDirty = false;
          dialog.close();
          modalContext = null;
          resetMasterSelection();
          renderSettings();
          if (ctx.type === "customers") {
            const route = customerRoute(saved.master.id);
            location2.hash = route;
            switchPage(route);
          } else if (ctx.type === "members") showMemberDetail(saved.master.id);
          else showItemDetail(saved.master.id);
          if (!reportDirty) renderReport();
        });
      }
    });
    listen(dialog, "cancel", (e) => {
      e.preventDefault();
      requestDialogClose();
    });
    listen(confirmDialog, "cancel", (e) => {
      if (pending) e.preventDefault();
    });
    listen(window2, "beforeunload", (e) => {
      if (suspendedDraft || reportDirty || modalDirty || priceDirty || reorderDirty() || pending || invoiceSettings?.isDirty() || invoiceSettings?.isBusy()) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    listen(window2, "hashchange", () => {
      const next = location2.hash.slice(1);
      if (next === currentRoute) return;
      if (reportDirty || modalDirty || priceDirty || reorderDirty() || invoiceSettings?.isDirty()) {
        history.replaceState(null, "", "#" + currentRoute);
        discard(() => {
          location2.hash = next;
          switchPage(next);
        });
      } else switchPage(next);
    });
    listen(window2, "storage", (e) => {
      if (adapter) return;
      if (e.key !== APP_STORAGE_KEY && e.key !== null) return;
      try {
        const next = read();
        if (!next) throw new Error("\u5225\u306E\u64CD\u4F5C\u3067\u4FDD\u5B58\u30C7\u30FC\u30BF\u304C\u6D88\u3048\u307E\u3057\u305F\u3002");
        state2 = next;
        renderSecondary();
        if (!reportDirty && !pending) renderReport();
        toast("\u5225\u306E\u753B\u9762\u306E\u66F4\u65B0\u3092\u8AAD\u307F\u8FBC\u307F\u307E\u3057\u305F\u3002\u5165\u529B\u4E2D\u306E\u5185\u5BB9\u306F\u305D\u306E\u307E\u307E\u3067\u3059\u3002");
        ensureDemoSession();
      } catch (error) {
        fail4(error);
      }
    });
    sheetConnection = adapter ? { setPage() {
    } } : (services.installSheetConnection ?? installSheetConnection)({ doc: document2 });
    if (lightweight) {
      transferPanel = services.installReportTransferPanel?.({ doc: document2, adapter, onSaved: async () => {
        await adapter.refresh();
        state2 = adapter.read();
        renderSecondary();
        if (!reportDirty && !pending) renderReport();
      }, onError: (error) => toast(error.message) });
      if (!document2.getElementById("aggregate-section")) {
        const section = document2.createElement("section");
        section.id = "aggregate-section";
        section.hidden = true;
        section.textContent = "\u96C6\u7D04\u6A5F\u80FD\u306F\u672A\u63A5\u7D9A\u3067\u3059\u3002";
        document2.getElementById("main-content").append(section);
      }
    }
    const appReady = new Promise((resolve, reject) => {
      initialize(async () => {
        try {
          $("#calculation-sample-banner").hidden = !IS_CALCULATION_SAMPLE;
          for (const selector of ["#desktop-nav", "#mobile-nav"]) $(selector).innerHTML = Object.entries(pages).map(([key, [label, icon]]) => `<button class="${selector === "#desktop-nav" ? "nav-item" : ""}" data-nav="${key}"><span aria-hidden="true">${navIcon(key)}</span>${label}</button>`).join("");
          $("#browse-month").value = localDate().slice(0, 7);
          renderReport();
          setPeriod("month");
          renderSecondary();
          switchPage(location2.hash.slice(1));
          invoiceSettings = (services.installInvoiceSettings ?? installInvoiceSettings)({ doc: document2, storageKey: ISSUER_STORAGE_KEY, ...adapter ? { store: { ...adapter.invoiceSettingsStore, ...Object.fromEntries(["saveIssuer", "saveBankAccounts", "saveTax"].map((method) => [method, async (...args) => {
            if (draftConflict) throw Error("\u7DE8\u96C6\u4E2D\u306B\u5171\u6709\u30C7\u30FC\u30BF\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002\u5165\u529B\u3092\u63A7\u3048\u3066\u304B\u3089\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
            return adapter.invoiceSettingsStore[method](...args);
          }])) }, onSaveError: (element) => appendWorkspaceRecovery({ element, adapter, reload: () => location2.reload() }) } : {}, onChange: () => renderIssuerPanel() });
          renderSettings();
          invoiceOutput = (lightweight ? services.installLightweightInvoiceOutput ?? (() => {
            throw Object.assign(Error("\u8ACB\u6C42\u53D6\u5F97\u306E\u63A5\u7D9A\u304C\u672A\u5B8C\u4E86\u3067\u3059\u3002"), { code: "BILLING_NOT_CONNECTED" });
          }) : services.installInvoiceOutput ?? installInvoiceOutput)({ doc: document2, getState: () => adapter?.referenceView?.().state ?? state2, getInvoiceSettings: () => invoiceSettings.getSettings(), storageKey: ISSUER_STORAGE_KEY, ...services.invoiceSealStore ? { sealStore: services.invoiceSealStore } : {}, ...adapter ? { coordinatedRestoration: true, prepareInitialOutput: () => {
            state2 = adapter.read();
            adapter.assertBillingReady();
            return adapter.snapshotKey();
          }, validateOutput: async (expected) => {
            await adapter.refresh();
            state2 = adapter.read();
            adapter.assertBillingReady();
            const key = adapter.snapshotKey();
            if (expected !== void 0 && key !== expected) throw Error("\u4F5C\u6210\u4E2D\u306B\u8A18\u9332\u3084\u8A2D\u5B9A\u304C\u5909\u66F4\u3055\u308C\u307E\u3057\u305F\u3002\u4F5C\u308A\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
            return key;
          } } : {} });
          ensureDemoSession();
          try {
            await invoiceOutput.ready;
          } catch (error) {
            throw markStartupFailure(error, "OUTPUT");
          }
          if (storageFailed) throw Object.assign(new Error("\u4FDD\u5B58\u6E08\u307F\u30C7\u30FC\u30BF\u306E\u78BA\u8A8D\u304C\u5B8C\u4E86\u3057\u307E\u305B\u3093\u3067\u3057\u305F\u3002"), { code: "startup-storage" });
          resolve();
        } catch (error) {
          reject(markStartupFailure(error, "UI"));
        }
      });
    });
    await appReady;
    if (adapter) {
      confirmedSnapshotKey = adapter.snapshotKey();
      ownerUid = services.currentAccountUid?.() ?? null;
    }
    if (adapter) {
      const sidebar = $(".sidebar-note");
      if (sidebar) {
        for (const node of sidebar.childNodes) if (node.nodeType === 3 && node.textContent.includes("\u3053\u306E\u30D6\u30E9\u30A6\u30B6")) node.textContent = "\u5171\u6709\u30C7\u30FC\u30BF\u3078\u4FDD\u5B58";
        const note2 = sidebar.querySelector("p");
        if (note2) note2.textContent = "\u30ED\u30B0\u30A4\u30F3\u3057\u305F\u767B\u9332\u30E1\u30F3\u30D0\u30FC\u3067\u5229\u7528\u3057\u307E\u3059\u3002";
      }
      const about = $$(".about-card > p");
      const explanations = ["Google\u8A8D\u8A3C\u3068\u767B\u9332\u30E1\u30F3\u30D0\u30FC\u7167\u5408\u3092\u901A\u904E\u3057\u305F\u5229\u7528\u8005\u304C\u5171\u6709\u8A18\u9332\u3092\u64CD\u4F5C\u3057\u307E\u3059\u3002\u64CD\u4F5C\u62C5\u5F53\u8005\u306F\u30ED\u30B0\u30A4\u30F3\u60C5\u5831\u304B\u3089\u78BA\u8A8D\u3057\u3001\u30B5\u30FC\u30D0\u30FC\u3067\u6A29\u9650\u3092\u691C\u8A3C\u3057\u307E\u3059\u3002", "\u5831\u544A\u30FB\u8A2D\u5B9A\u306F\u8A8D\u8A3C\u4ED8\u304D\u3067\u5171\u6709\u4FDD\u5B58\u3057\u307E\u3059\u3002\u4EE5\u524D\u306E\u30D6\u30E9\u30A6\u30B6\u5185\u30C7\u30FC\u30BF\u306F\u81EA\u52D5\u30B3\u30D4\u30FC\u30FB\u79FB\u884C\u30FB\u524A\u9664\u3057\u307E\u305B\u3093\u3002\u53C2\u8003\u5E33\u7968\u3068\u6B63\u5F0F\u306A\u8ACB\u6C42\u8A08\u7B97\u306F\u533A\u5225\u3057\u307E\u3059\u3002", "\u7BA1\u7406\u8005\u306B\u3088\u308B\u5225\u9014\u30B7\u30FC\u30C8\u76F4\u63A5\u7DE8\u96C6\u306F\u7DAD\u6301\u3057\u307E\u3059\u3002\u4FDD\u5B58\u6642\u306F\u7248\u3068\u5143\u30C7\u30FC\u30BF\u306E\u4E00\u81F4\u3092\u78BA\u8A8D\u3057\u3001\u7AF6\u5408\u3092\u81EA\u52D5\u4E0A\u66F8\u304D\u3057\u307E\u305B\u3093\u3002", "\u8D77\u52D5\u30FB\u5171\u6709\u30C7\u30FC\u30BF\u5229\u7528\u306B\u306F\u30AA\u30F3\u30E9\u30A4\u30F3\u63A5\u7D9A\u304C\u5FC5\u8981\u3067\u3059\u3002\u672A\u78BA\u8A8D\u306E\u4FDD\u5B58\u306F\u7D50\u679C\u3092\u78BA\u8A8D\u3059\u308B\u307E\u3067\u518D\u767B\u9332\u3057\u307E\u305B\u3093\u3002\u9001\u4FE1\u5F85\u3061\u306E\u81EA\u52D5\u30AD\u30E5\u30FC\u306F\u3042\u308A\u307E\u305B\u3093\u3002", "\u65E7\u30D6\u30E9\u30A6\u30B6\u4FDD\u5B58\u306F\u660E\u793A\u7684\u306A\u30ED\u30FC\u30AB\u30EB\u30E2\u30FC\u30C9\u306B\u6B8B\u3057\u307E\u3059\u3002\u5171\u6709\u8A18\u9332\u3068\u306E\u81EA\u52D5\u7D71\u5408\u306F\u884C\u3044\u307E\u305B\u3093\u3002"];
      explanations.forEach((text3, i) => {
        if (about[i]) about[i].textContent = text3;
      });
      if (about.at(-1)) about.at(-1).textContent = "\u5831\u544A\u30FB\u8A2D\u5B9A\u306F\u5171\u6709\u30C7\u30FC\u30BF\u3078\u4FDD\u5B58\u3057\u307E\u3059\u3002";
      for (const selector of ["#browse-source", "#sheet-ledger-panel", "#change-demo-user", "#open-sheet-from-session"]) $(selector)?.remove();
      const note = $("#browse-local > .form-note");
      if (note) note.textContent = lightweight ? "\u3053\u306E\u7AEF\u672B\u306B\u4FDD\u6301\u3057\u305F\u672C\u4EBA\u306E\u5831\u544A\u3067\u3059\u3002\u5168\u4F53\u306E\u8A18\u9332\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002" : "\u5171\u6709\u3055\u308C\u305F\u8A18\u9332\u306E\u78BA\u8A8D\u3001\u8A02\u6B63\u3001\u5FA9\u5143\u304C\u3067\u304D\u307E\u3059\u3002";
      if (lightweight) {
        const sidebar2 = $(".sidebar-note");
        if (sidebar2) sidebar2.textContent = "\u7AEF\u672B\u306B\u4FDD\u5B58\u3002\u96C6\u7D04\u5F8C\u306E\u9001\u4FE1\u64CD\u4F5C\u3067\u5171\u6709\u3057\u307E\u3059\u3002";
        if (about[1]) about[1].textContent = "\u5831\u544A\u306F\u7AEF\u672B\u5185\u3067\u4F5C\u6210\u30FB\u7DE8\u96C6\u3057\u3001\u96C6\u7D04\u5F8C\u306B\u9001\u4FE1\u3057\u307E\u3059\u3002\u8A2D\u5B9A\u306F\u4FDD\u6301\u6E08\u307F\u306E\u57FA\u672C\u60C5\u5831\u3092\u7DE8\u96C6\u3057\u3001\u4FDD\u5B58\u6642\u306B\u9001\u4FE1\u3057\u307E\u3059\u3002";
        if (about[0]) about[0].textContent = "Google\u30A2\u30AB\u30A6\u30F3\u30C8\u5225\u306B\u7AEF\u672B\u5185\u306E\u5831\u544A\u3092\u4FDD\u6301\u3057\u307E\u3059\u3002\u5171\u6709\u64CD\u4F5C\u306E\u6A29\u9650\u306F\u9001\u4FE1\u6642\u306B\u78BA\u8A8D\u3057\u307E\u3059\u3002";
        if (about.at(-1)) about.at(-1).textContent = "\u5831\u544A\u306F\u3053\u306E\u7AEF\u672B\u306B\u4FDD\u5B58\u3057\u3001\u96C6\u7D04\u5F8C\u306B\u9001\u4FE1\u3057\u307E\u3059\u3002\u7AEF\u672B\u5185\u306E\u8A18\u9332\u306F\u5168\u4F53\u96C6\u8A08\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002";
      }
      if (!lightweight) browseSync = (services.createBrowseRecordSync ?? createBrowseRecordSync)({ adapter, checkChanges: services.checkWorkspaceChanges, isEditing: () => modalDirty || dialog.open || confirmDialog.open || priceDirty || invoiceSettings?.isDirty(), isSaving: () => pending || invoiceSettings?.isBusy(), onApplied: (next) => {
        state2 = next;
        for (const page of ["report", "summary", "settings", "output"]) staleViews.add(page);
        renderBrowse();
        renderSessionIdentity();
      }, onConfirmed: () => {
        if (note) note.textContent = "\u5171\u6709\u3055\u308C\u305F\u8A18\u9332\u306E\u78BA\u8A8D\u3001\u8A02\u6B63\u3001\u5FA9\u5143\u304C\u3067\u304D\u307E\u3059\u3002";
      }, onError: (error) => {
        if (["LOGIN_REQUIRED", "UNAUTHENTICATED", "FORBIDDEN", "WORKSPACE_MEMBERSHIP_SYNC_REQUIRED"].includes(error.code)) {
          conceal();
          showRecovery(error);
        } else if (note) note.textContent = "\u6700\u65B0\u306E\u8A18\u9332\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u5165\u529B\u3068\u8868\u793A\u4E2D\u306E\u5185\u5BB9\u3092\u4FDD\u6301\u3057\u3066\u518D\u78BA\u8A8D\u3057\u307E\u3059\u3002";
      } });
      listen(document2, "visibilitychange", () => {
        if (document2.visibilityState === "hidden") conceal();
        else if (activated) void reveal();
      });
      offAuth = adapter.subscribeInvalidation(() => {
        conceal();
        const nextUid = services.currentAccountUid?.();
        if (nextUid && ownerUid && nextUid !== ownerUid) {
          dispose();
          root2?.replaceChildren();
          for (const d of document2.querySelectorAll("dialog")) {
            if (d.open) d.close();
            d.replaceChildren();
          }
        }
        showRecovery(Error("\u30ED\u30B0\u30A4\u30F3\u72B6\u614B\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u30ED\u30B0\u30A4\u30F3\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002"), { reauthenticate: true });
      });
      listen(window2, "pagehide", conceal);
      listen(window2, "pageshow", (event) => {
        if (event.persisted && activated) void reveal();
      });
    }
    if (!adapter) activate();
    return { activate, dispose, reveal, completeReveal() {
      if (revealPrepared) {
        revealPrepared = false;
        suspendedModals.resume();
      }
    }, isDisposed: () => disposed, getState: () => clone(state2) };
  } catch (error) {
    lifecycle.abort();
    assistDispose?.();
    updatesControl?.dispose?.();
    invoiceSettings?.dispose?.();
    invoiceOutput?.destroy?.();
    throw error;
  }
}

// src/lightweight-invoice-output.js
var failure = (code, message) => Object.assign(new Error(message), { code });
var sameIds = (a, b) => Array.isArray(a) && a.length === b.length && new Set(a).size === a.length && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
var number2 = (value) => value === null || typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e9 && /^\d+(?:\.\d{1,6})?$/.test(String(value));
var plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function validateBillingSnapshot(value, request, identity2) {
  if (value?.ok !== true || value.schemaVersion !== 1 || value.requestId !== request.requestId || value.uid !== identity2.uid || value.month !== request.month || !sameIds(value.customerIds, request.customerIds) || value.complete !== true || !Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.sourceFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceFingerprint) || !plain(value.state) || !Array.isArray(value.state.records) || value.recordCount !== value.state.records.length || !Array.isArray(value.state.masters?.customers)) throw failure("INVALID_BILLING_SNAPSHOT", "\u8ACB\u6C42\u5BFE\u8C61\u306E\u5168\u4EF6\u53D6\u5F97\u3068\u5BFE\u8C61\u7BC4\u56F2\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
  const customers = value.state.masters.customers;
  if (new Set(customers.map((c) => c.id)).size !== customers.length || customers.some((c) => typeof c.id !== "string" || typeof c.name !== "string" || !c.name) || request.customerIds.some((id) => !customers.some((c) => c.id === id))) throw failure("INVALID_BILLING_SNAPSHOT", "\u8ACB\u6C42\u5148\u306E\u4E00\u81F4\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
  const ids = /* @__PURE__ */ new Set();
  for (const row of value.state.records) {
    if (!plain(row) || typeof row.id !== "string" || !row.id || ids.has(row.id) || !request.customerIds.includes(row.customerId) || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || row.date.slice(0, 7) !== request.month || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date || typeof row.deleted !== "boolean" || ["combustibleKg", "noncombustibleKg", "combustibleRate", "noncombustibleRate", "otherFee"].some((k) => !number2(row[k])) || typeof row.otherItem !== "string" || row.otherItem.length > 500) throw failure("INVALID_BILLING_SNAPSHOT", "\u8ACB\u6C42\u660E\u7D30\u304C\u5BFE\u8C61\u7BC4\u56F2\u5916\u3001\u91CD\u8907\u3001\u307E\u305F\u306F\u4E0D\u6B63\u3067\u3059\u3002");
    if (row.categoryNotes !== void 0 && (!plain(row.categoryNotes) || Object.keys(row.categoryNotes).some((k) => !["combustible", "noncombustible", "other"].includes(k)) || Object.values(row.categoryNotes).some((v) => typeof v !== "string" || v.length > 500))) throw failure("INVALID_BILLING_SNAPSHOT", "\u5099\u8003\u306E\u5F62\u5F0F\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
    for (const field of ["itemIds", "itemNames"]) if (row[field] !== void 0 && (!plain(row[field]) || Object.values(row[field]).some((v) => typeof v !== "string"))) throw failure("INVALID_BILLING_SNAPSHOT", "\u54C1\u76EE\u306E\u5F62\u5F0F\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
    ids.add(row.id);
  }
  const reference = value.state.referenceCalculation;
  if (reference !== void 0 && (!plain(reference) || reference.basis !== "current-source-sheet" || !Array.isArray(reference.applied) || reference.applied.some((entry2) => !plain(entry2) || !ids.has(entry2.recordId)))) throw failure("INVALID_BILLING_SNAPSHOT", "\u53C2\u8003\u8A08\u7B97\u306E\u51FA\u6240\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
  validateInvoiceSettings(value.invoiceSettings);
  return structuredClone(value);
}
var SCALE2 = 1000000n;
var PRODUCT_SCALE2 = SCALE2 * SCALE2;
var fixed2 = (value, scale) => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * scale + BigInt(fraction.padEnd(String(scale).length - 1, "0"));
};
var decimal3 = (value) => {
  const tail = (value % PRODUCT_SCALE2).toString().padStart(12, "0").replace(/0+$/, "");
  return `${value / PRODUCT_SCALE2}${tail ? "." + tail : ""}`;
};
var formatted = (value) => value === null ? "\u7B97\u51FA\u4E0D\u53EF" : value.replace(/^(\d+)(.*)$/, (_, n, tail) => n.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + tail);
function calculateLightweightTax(view, settings3) {
  const saved = validateInvoiceSettings(settings3).tax, tax = { rate: saved.rate === "" ? "10" : saved.rate, rounding: saved.rounding === "" ? "floor" : saved.rounding, priceMode: saved.priceMode };
  const blockedReason = view.currentSourceReference ? "current-source-reference" : view.recordedCharges === null ? "missing-charges" : !tax.priceMode ? "price-mode-unset" : null;
  const blocked = (reason) => ({ tax, subtotal: null, amount: null, gross: null, blockedReason: reason });
  if (blockedReason) return blocked(blockedReason);
  const source = fixed2(view.recordedCharges, PRODUCT_SCALE2), rate = fixed2(tax.rate, SCALE2), denominator = PRODUCT_SCALE2 * (100n * SCALE2 + (tax.priceMode === "inclusive" ? rate : 0n)), numerator = source * rate;
  let amount = numerator / denominator;
  const remainder = numerator % denominator;
  if (tax.rounding === "ceil" && remainder > 0n || tax.rounding === "round" && remainder * 2n >= denominator) amount++;
  const scaledTax = amount * PRODUCT_SCALE2;
  if (tax.priceMode === "inclusive" && scaledTax > source) return blocked("tax-exceeds-gross");
  return { tax, subtotal: decimal3(tax.priceMode === "inclusive" ? source - scaledTax : source), amount: String(amount), gross: decimal3(tax.priceMode === "inclusive" ? source : source + scaledTax), blockedReason: null };
}
function buildLightweightBillingDocument(snapshot, { month: month2, customerIds, issueDate = localDate(), includeMonthlyDetail = true, seal = null }) {
  const documents = customerIds.map((customerId) => {
    const view = { ...buildInvoicePreview(snapshot.state, { month: month2, customerId, issueDate, includeMonthlyDetail }, snapshot.invoiceSettings), seal: validateCanonicalSeal(seal) };
    const totals = calculateLightweightTax(view, snapshot.invoiceSettings), document2 = buildInvoiceDocument(view);
    for (const page of document2.pages) for (const cell of page.cells) {
      const replacements = { "tax-net": formatted(totals.subtotal), "tax-value": formatted(totals.amount), "tax-inclusive": formatted(totals.gross), "total-bottom": formatted(totals.gross), "tax-label": `\u6D88\u8CBB\u7A0E\u984D\uFF08${totals.tax.rate}%\uFF09`, "draft-note": view.currentSourceReference ? "\u53C2\u8003\uFF1A\u73FE\u5728\u306E\u30B7\u30FC\u30C8\u5358\u4FA1\u3002\u904E\u53BB\u5358\u4FA1\u672A\u78BA\u8A8D\u3002\u6B63\u5F0F\u8ACB\u6C42\u30FB\u632F\u8FBC\u306B\u306F\u4F7F\u7528\u4E0D\u53EF\u3002" : "\u78BA\u8A8D\u7528\uFF1A\u63A1\u756A\u306F\u672A\u8A2D\u5B9A\u3002\u5165\u529B\u4E0D\u8DB3\u30FB\u7A0E\u8FBC\uFF0F\u7A0E\u629C\u672A\u8A2D\u5B9A\u6642\u306F\u7B97\u51FA\u4E0D\u53EF\u3002\u6B63\u5F0F\u8ACB\u6C42\u306B\u306F\u4F7F\u7528\u4E0D\u53EF\u3002", "detail-amount-note": "\u53C2\u8003\u91D1\u984D\u306F\u4FDD\u5B58\u6599\u91D1\u306E\u5408\u7B97\u3002\u7A0E\u8FBC\uFF0F\u7A0E\u629C\u306F\u8A2D\u5B9A\u306B\u5F93\u3044\u3001\u7A0E\u306E\u52A0\u7B97\u30FB\u63A7\u9664\u524D\u3002" };
      if (Object.hasOwn(replacements, cell.key)) cell.text = replacements[cell.key];
    }
    return { view, totals, document: document2 };
  });
  return { documents, document: { geometry: INVOICE_GEOMETRY, pages: documents.flatMap((item) => item.document.pages), notes: documents.flatMap((item) => item.document.notes) } };
}
async function createLightweightInvoicePDF(document2, doc = globalThis.document, assertCurrent = () => {
}) {
  assertCurrent();
  if (!document2.pages.length) throw failure("NO_INVOICE_PAGES", "\u51FA\u529B\u3059\u308B\u30DA\u30FC\u30B8\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
  await doc.fonts?.ready;
  assertCurrent();
  const win = doc.defaultView, pages = [];
  for (let i = 0; i < document2.pages.length; i++) {
    assertCurrent();
    const image = new win.Image();
    let canvas;
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(failure("PDF_IMAGE_FAILED", "PDF\u753B\u50CF\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3002"));
        image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(invoicePageSVG(document2, i));
      });
      assertCurrent();
      canvas = doc.createElement("canvas");
      canvas.width = Math.round(INVOICE_GEOMETRY.pixelWidth * 2);
      canvas.height = Math.round(INVOICE_GEOMETRY.pixelHeight * 2);
      const context = canvas.getContext("2d");
      if (!context) throw failure("PDF_UNAVAILABLE", "PDF\u51FA\u529B\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.97));
      if (!blob) throw failure("PDF_IMAGE_FAILED", "PDF\u753B\u50CF\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3002");
      const jpeg = new Uint8Array(await blob.arrayBuffer());
      assertCurrent();
      pages.push({ jpeg, width: canvas.width, height: canvas.height });
    } finally {
      if (canvas) canvas.width = canvas.height = 1;
      image.onload = image.onerror = null;
      image.removeAttribute?.("src");
    }
  }
  assertCurrent();
  return new win.Blob([jpegPagesToPDF(pages)], { type: "application/pdf" });
}
function installLightweightInvoiceOutput({ doc = globalThis.document, host = doc.querySelector("#output-section"), getMasters, getIdentity, requestBilling, sealStore, loadSeal = () => loadDefaultInvoiceSeal(doc), createPDF = createLightweightInvoicePDF } = {}) {
  if (!host) throw failure("OUTPUT_HOST_REQUIRED", "\u51FA\u529B\u753B\u9762\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
  const win = doc.defaultView, life = new win.AbortController();
  let disposed = false, busy = false, generation = 0, readyDocument = null, acceptedIdentity = null, url = null;
  const element = (tag, text3) => {
    const node = doc.createElement(tag);
    if (text3) node.textContent = text3;
    return node;
  };
  const title = element("h1", "\u51FA\u529B"), controls = element("div"), monthLabel = element("label", "\u5BFE\u8C61\u6708"), month2 = element("input");
  month2.type = "month";
  month2.value = localDate().slice(0, 7);
  month2.id = "lightweight-invoice-month";
  monthLabel.append(month2);
  const dateLabel = element("label", "\u767A\u884C\u65E5\uFF08\u78BA\u8A8D\u7528\uFF09"), date = element("input");
  date.type = "date";
  date.value = localDate();
  dateLabel.append(date);
  const customers = element("fieldset");
  customers.append(element("legend", "\u5BFE\u8C61\u306E\u53D6\u5F15\u5148\uFF08\u8907\u6570\u9078\u629E\uFF09"));
  const output = element("button", "\u51FA\u529B");
  output.type = "button";
  output.id = "lightweight-invoice-output";
  output.className = "button primary";
  const download = element("button", "PDF\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9");
  download.className = "button secondary";
  download.type = "button";
  download.disabled = true;
  const detailLabel = element("label"), detail = element("input");
  detail.type = "checkbox";
  detail.checked = true;
  detailLabel.append(detail, doc.createTextNode("\u6708\u9593\u56DE\u53CE\u660E\u7D30\u3082\u542B\u3081\u308B"));
  const status = element("p", "\u5BFE\u8C61\u6708\u30FB\u53D6\u5F15\u5148\u3092\u9078\u3073\u3001\u51FA\u529B\u6642\u306B\u5BFE\u8C61\u5168\u4EF6\u3092\u4E00\u62EC\u53D6\u5F97\u3057\u307E\u3059\u3002\u7AEF\u672B\u5185\u306E\u76F4\u8FD110\u4EF6\u306F\u8ACB\u6C42\u306B\u4F7F\u7528\u3057\u307E\u305B\u3093\u3002");
  status.setAttribute("role", "status");
  const guide = element("p", "\u7A0E\u7387\u672A\u8A2D\u5B9A\u306F10%\u3001\u7AEF\u6570\u51E6\u7406\u672A\u8A2D\u5B9A\u306F\u5207\u308A\u6368\u3066\u3002\u7A0E\u8FBC\uFF0F\u7A0E\u629C\u306E\u9078\u629E\u304C\u5FC5\u8981\u3067\u3059\u3002\u7A0E\u984D\u306F\u8ACB\u6C42\u66F8\u30FB\u7A0E\u7387\u3054\u3068\u306B1\u56DE\u4E38\u3081\u307E\u3059\u3002\u63A1\u756A\u306F\u672A\u8A2D\u5B9A\u3067\u6B63\u5F0F\u8ACB\u6C42\u306B\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002PDF\u306F\u753B\u50CF\u5F62\u5F0F\u3067\u3059\u3002");
  controls.className = "form-grid";
  monthLabel.className = "field";
  dateLabel.className = "field";
  customers.className = "about-card";
  customers.style.gridColumn = "1 / -1";
  customers.style.display = "grid";
  customers.style.gridTemplateColumns = "repeat(auto-fit,minmax(180px,1fr))";
  customers.style.gap = "8px";
  detailLabel.className = "check-label";
  detailLabel.style.gridColumn = "1 / -1";
  const preview = element("div");
  preview.id = "lightweight-invoice-preview";
  controls.append(monthLabel, dateLabel, customers, detailLabel, output, download);
  host.replaceChildren(title, controls, status, guide, preview);
  function revoke() {
    if (url) {
      win.URL.revokeObjectURL(url);
      url = null;
    }
  }
  function invalidate() {
    generation++;
    readyDocument = null;
    acceptedIdentity = null;
    preview.replaceChildren();
    download.disabled = true;
    revoke();
  }
  function refresh() {
    invalidate();
    customers.querySelectorAll("label").forEach((node) => node.remove());
    for (const customer of getMasters().customers.filter((value) => value.active)) {
      const label = element("label"), input = element("input");
      label.className = "check-label";
      input.type = "checkbox";
      input.name = "lightweight-invoice-customer";
      input.value = customer.id;
      label.append(input, doc.createTextNode(customer.name));
      customers.append(label);
    }
  }
  function identity2() {
    const current = getIdentity();
    if (!current?.uid || !Number.isSafeInteger(current.epoch)) throw failure("LOGIN_REQUIRED", "\u30ED\u30B0\u30A4\u30F3\u72B6\u614B\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    return { ...current };
  }
  function assertCurrent(expected, epoch) {
    const current = identity2();
    if (disposed || generation !== epoch || current.uid !== expected.uid || current.epoch !== expected.epoch) throw failure("BILLING_CONTEXT_CHANGED", "\u30A2\u30AB\u30A6\u30F3\u30C8\u307E\u305F\u306F\u51FA\u529B\u6761\u4EF6\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002\u518D\u53D6\u5F97\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  }
  const setBusy = (value) => {
    busy = value;
    output.disabled = value;
    download.disabled = value || !readyDocument;
  };
  async function run() {
    if (disposed || busy) return;
    invalidate();
    const epoch = generation;
    setBusy(true);
    try {
      const expected = identity2(), selected = [...customers.querySelectorAll("input:checked")].map((input) => input.value);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month2.value) || month2.value.startsWith("0000") || !selected.length || selected.length > 100) throw failure("BAD_SELECTION", "\u5BFE\u8C61\u6708\u3068\u53D6\u5F15\u5148\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      if (typeof requestBilling !== "function") throw failure("BILLING_NOT_CONNECTED", "\u8ACB\u6C42\u5BFE\u8C61\u306E\u53D6\u5F97\u306F\u672A\u63A5\u7D9A\u3067\u3059\u3002\u7AEF\u672B\u5185\u306E\u5831\u544A\u3092\u4EE3\u7528\u3057\u307E\u305B\u3093\u3002");
      const request = { schemaVersion: 1, kind: "billing", requestId: globalThis.crypto.randomUUID(), month: month2.value, customerIds: selected };
      const options = { month: month2.value, customerIds: selected, issueDate: date.value, includeMonthlyDetail: detail.checked };
      status.textContent = "\u9078\u629E\u3057\u305F\u6708\u30FB\u53D6\u5F15\u5148\u306E\u5168\u4EF6\u3092\u78BA\u8A8D\u3057\u3066\u3044\u307E\u3059\u2026";
      const response = await requestBilling(request);
      assertCurrent(expected, epoch);
      const snapshot = validateBillingSnapshot(response, request, expected);
      const savedSeal = sealStore ? await sealStore.load() : null;
      assertCurrent(expected, epoch);
      const seal = validateCanonicalSeal(savedSeal ?? await loadSeal());
      assertCurrent(expected, epoch);
      const result = buildLightweightBillingDocument(snapshot, { ...options, seal });
      assertCurrent(expected, epoch);
      readyDocument = result.document;
      acceptedIdentity = { expected, epoch };
      preview.innerHTML = result.document.pages.map((_, i) => `<article class="invoice-paper">${invoicePageSVG(result.document, i)}</article>`).join("");
      status.textContent = `${selected.length}\u793E\u30FB${snapshot.recordCount}\u4EF6\u306E\u5BFE\u8C61\u53D6\u5F97\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002\u78BA\u8A8D\u7528\u898B\u672C\u3067\u3059\u3002`;
    } catch (error) {
      invalidate();
      if (!disposed) status.textContent = error.message || "\u8ACB\u6C42\u5BFE\u8C61\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002";
    } finally {
      setBusy(false);
    }
  }
  async function savePDF() {
    if (disposed || busy || !readyDocument || !acceptedIdentity) return;
    const { expected, epoch } = acceptedIdentity;
    setBusy(true);
    try {
      assertCurrent(expected, epoch);
      const blob = await createPDF(readyDocument, doc, () => assertCurrent(expected, epoch));
      assertCurrent(expected, epoch);
      revoke();
      url = win.URL.createObjectURL(blob);
      const link = element("a");
      link.href = url;
      link.download = `\u8ACB\u6C42\u66F8\u78BA\u8A8D\u7528_${month2.value}.pdf`;
      host.append(link);
      link.click();
      link.remove();
      status.textContent = "\u78BA\u8A8D\u7528PDF\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F\u3002\u6B63\u5F0F\u8ACB\u6C42\u306B\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002";
    } catch (error) {
      invalidate();
      if (!disposed) status.textContent = error.message || "PDF\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002";
    } finally {
      setBusy(false);
    }
  }
  controls.addEventListener("change", () => {
    invalidate();
    status.textContent = "\u51FA\u529B\u6761\u4EF6\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002\u51FA\u529B\u30DC\u30BF\u30F3\u3067\u518D\u53D6\u5F97\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
  }, { signal: life.signal });
  output.addEventListener("click", run, { signal: life.signal });
  download.addEventListener("click", savePDF, { signal: life.signal });
  win.addEventListener("pagehide", invalidate, { signal: life.signal });
  refresh();
  return { ready: Promise.resolve(), refresh, invalidate, destroy() {
    disposed = true;
    invalidate();
    life.abort();
  }, run, savePDF };
}

// src/account-seal-store.js
function createAccountSealStore({ identity: identity2, indexedDB, createStore = createSealStore } = {}) {
  const uid2 = identity2.currentUid();
  if (!uid2) throw Error("Google\u30ED\u30B0\u30A4\u30F3\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  let epoch = 0, disposed = false, observed = uid2;
  const off = identity2.subscribe((next) => {
    if (next !== observed) {
      observed = next;
      epoch++;
    }
  });
  const initial = epoch;
  function guard() {
    if (disposed || epoch !== initial || identity2.currentUid() !== uid2) throw Object.assign(Error("\u30ED\u30B0\u30A4\u30F3\u72B6\u614B\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002"), { code: "LOGIN_REQUIRED" });
  }
  const store = createStore(indexedDB, { key: "account:" + uid2, guard });
  return { ...Object.fromEntries(["load", "save", "remove"].map((method) => [method, async (...args) => {
    guard();
    const result = await store[method](...args);
    guard();
    return result;
  }])), dispose() {
    disposed = true;
    off?.();
  } };
}

// src/lightweight-entry.js
var issue2 = (code, message = code) => Object.assign(new Error(message), { code });
function createLightweightBilling({ identity: identity2, transport, timeoutMs = 12e4 }) {
  let epoch = 0, disposed = false, controller = null, observed = identity2.currentUid();
  const off = identity2.subscribe((uid2) => {
    if (uid2 !== observed) {
      observed = uid2;
      epoch++;
      controller?.abort();
    }
  });
  return {
    async request(request) {
      if (disposed || !identity2.currentUid()) throw issue2("LOGIN_REQUIRED");
      const { month: month2, customerIds } = request ?? {};
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month2) || !Array.isArray(customerIds) || !customerIds.length || customerIds.length > 100 || customerIds.some((id) => typeof id !== "string" || !id) || new Set(customerIds).size !== customerIds.length) throw issue2("BAD_REQUEST");
      if (!transport) throw issue2("BILLING_NOT_CONNECTED", "\u8ACB\u6C42\u5BFE\u8C61\u306E\u53D6\u5F97\u304C\u672A\u63A5\u7D9A\u3067\u3059\u3002\u7AEF\u672B\u5185\u306E\u5831\u544A\u3092\u4EE3\u7528\u3057\u3066\u51FA\u529B\u3057\u307E\u305B\u3093\u3002");
      if (controller) throw issue2("BUSY");
      const uid2 = identity2.currentUid(), generation = epoch, current = new AbortController();
      controller = current;
      let timer;
      const interrupted = new Promise((_, reject) => {
        current.signal.addEventListener("abort", () => reject(issue2("BILLING_INTERRUPTED")), { once: true });
        timer = setTimeout(() => current.abort(), timeoutMs);
      });
      try {
        const value = await Promise.race([transport(structuredClone(request), { signal: current.signal }), interrupted]);
        if (disposed || generation !== epoch || uid2 !== identity2.currentUid()) throw issue2("LOGIN_REQUIRED");
        return value;
      } finally {
        clearTimeout(timer);
        if (controller === current) controller = null;
      }
    },
    dispose() {
      disposed = true;
      epoch++;
      controller?.abort();
      off?.();
    }
  };
}
function createLightweightEntry({ doc = globalThis.document, identityFactory = async () => (await Promise.resolve().then(() => (init_firebase_driver(), firebase_driver_exports))).googleApiIdentity(), initialBasics, settingsTransport, billingTransport, services = {}, startApp = startOriginalApp } = {}) {
  let pending = null, app2 = null;
  return async () => {
    if (app2 && !app2.isDisposed?.()) return app2;
    if (pending) return pending;
    app2?.dispose?.();
    app2 = null;
    pending = (async () => {
      const identity2 = await identityFactory();
      const adapter = createLocalWorkspaceAdapter({ identity: identity2, storage: doc.defaultView.localStorage, locks: doc.defaultView.navigator.locks, initialBasics, settingsTransport });
      const billing = createLightweightBilling({ identity: identity2, transport: billingTransport });
      let sealStore;
      try {
        sealStore = services.invoiceSealStore ?? createAccountSealStore({ identity: identity2, indexedDB: doc.defaultView.indexedDB });
        const original = await startApp({ doc, adapter, services: { ...services, currentAccountUid: () => identity2.currentUid(), installLightweightInvoiceOutput: services.installLightweightInvoiceOutput ?? (() => installLightweightInvoiceOutput({ doc, getMasters: () => adapter.read().masters, getIdentity: () => adapter.currentIdentity(), requestBilling: (request) => billing.request(request), sealStore })) } });
        let disposed = false;
        return app2 = { ...original, adapter, billing, isDisposed: () => disposed || original.isDisposed?.(), dispose() {
          if (disposed) return;
          disposed = true;
          original.dispose?.();
          billing.dispose();
          sealStore.dispose?.();
          adapter.dispose();
        } };
      } catch (error) {
        billing.dispose();
        sealStore?.dispose?.();
        adapter.dispose();
        throw error;
      }
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}

// src/vendor/qrcode-generator.js
var qrcode = function(typeNumber, errorCorrectionLevel) {
  const PAD0 = 236;
  const PAD1 = 17;
  let _typeNumber = typeNumber;
  const _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
  let _modules = null;
  let _moduleCount = 0;
  let _dataCache = null;
  const _dataList = [];
  const _this = {};
  const makeImpl = function(test, maskPattern) {
    _moduleCount = _typeNumber * 4 + 17;
    _modules = (function(moduleCount) {
      const modules = new Array(moduleCount);
      for (let row = 0; row < moduleCount; row += 1) {
        modules[row] = new Array(moduleCount);
        for (let col = 0; col < moduleCount; col += 1) {
          modules[row][col] = null;
        }
      }
      return modules;
    })(_moduleCount);
    setupPositionProbePattern(0, 0);
    setupPositionProbePattern(_moduleCount - 7, 0);
    setupPositionProbePattern(0, _moduleCount - 7);
    setupPositionAdjustPattern();
    setupTimingPattern();
    setupTypeInfo(test, maskPattern);
    if (_typeNumber >= 7) {
      setupTypeNumber(test);
    }
    if (_dataCache == null) {
      _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
    }
    mapData(_dataCache, maskPattern);
  };
  const setupPositionProbePattern = function(row, col) {
    for (let r = -1; r <= 7; r += 1) {
      if (row + r <= -1 || _moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c += 1) {
        if (col + c <= -1 || _moduleCount <= col + c) continue;
        if (0 <= r && r <= 6 && (c == 0 || c == 6) || 0 <= c && c <= 6 && (r == 0 || r == 6) || 2 <= r && r <= 4 && 2 <= c && c <= 4) {
          _modules[row + r][col + c] = true;
        } else {
          _modules[row + r][col + c] = false;
        }
      }
    }
  };
  const getBestMaskPattern = function() {
    let minLostPoint = 0;
    let pattern = 0;
    for (let i = 0; i < 8; i += 1) {
      makeImpl(true, i);
      const lostPoint = QRUtil.getLostPoint(_this);
      if (i == 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint;
        pattern = i;
      }
    }
    return pattern;
  };
  const setupTimingPattern = function() {
    for (let r = 8; r < _moduleCount - 8; r += 1) {
      if (_modules[r][6] != null) {
        continue;
      }
      _modules[r][6] = r % 2 == 0;
    }
    for (let c = 8; c < _moduleCount - 8; c += 1) {
      if (_modules[6][c] != null) {
        continue;
      }
      _modules[6][c] = c % 2 == 0;
    }
  };
  const setupPositionAdjustPattern = function() {
    const pos = QRUtil.getPatternPosition(_typeNumber);
    for (let i = 0; i < pos.length; i += 1) {
      for (let j = 0; j < pos.length; j += 1) {
        const row = pos[i];
        const col = pos[j];
        if (_modules[row][col] != null) {
          continue;
        }
        for (let r = -2; r <= 2; r += 1) {
          for (let c = -2; c <= 2; c += 1) {
            if (r == -2 || r == 2 || c == -2 || c == 2 || r == 0 && c == 0) {
              _modules[row + r][col + c] = true;
            } else {
              _modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  };
  const setupTypeNumber = function(test) {
    const bits = QRUtil.getBCHTypeNumber(_typeNumber);
    for (let i = 0; i < 18; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
    }
    for (let i = 0; i < 18; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  };
  const setupTypeInfo = function(test, maskPattern) {
    const data = _errorCorrectionLevel << 3 | maskPattern;
    const bits = QRUtil.getBCHTypeInfo(data);
    for (let i = 0; i < 15; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      if (i < 6) {
        _modules[i][8] = mod;
      } else if (i < 8) {
        _modules[i + 1][8] = mod;
      } else {
        _modules[_moduleCount - 15 + i][8] = mod;
      }
    }
    for (let i = 0; i < 15; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      if (i < 8) {
        _modules[8][_moduleCount - i - 1] = mod;
      } else if (i < 9) {
        _modules[8][15 - i - 1 + 1] = mod;
      } else {
        _modules[8][15 - i - 1] = mod;
      }
    }
    _modules[_moduleCount - 8][8] = !test;
  };
  const mapData = function(data, maskPattern) {
    let inc = -1;
    let row = _moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    const maskFunc = QRUtil.getMaskFunction(maskPattern);
    for (let col = _moduleCount - 1; col > 0; col -= 2) {
      if (col == 6) col -= 1;
      while (true) {
        for (let c = 0; c < 2; c += 1) {
          if (_modules[row][col - c] == null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = (data[byteIndex] >>> bitIndex & 1) == 1;
            }
            const mask = maskFunc(row, col - c);
            if (mask) {
              dark = !dark;
            }
            _modules[row][col - c] = dark;
            bitIndex -= 1;
            if (bitIndex == -1) {
              byteIndex += 1;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || _moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  };
  const createBytes = function(buffer, rsBlocks) {
    let offset = 0;
    let maxDcCount = 0;
    let maxEcCount = 0;
    const dcdata = new Array(rsBlocks.length);
    const ecdata = new Array(rsBlocks.length);
    for (let r = 0; r < rsBlocks.length; r += 1) {
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);
      dcdata[r] = new Array(dcCount);
      for (let i = 0; i < dcdata[r].length; i += 1) {
        dcdata[r][i] = 255 & buffer.getBuffer()[i + offset];
      }
      offset += dcCount;
      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      const rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);
      const modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (let i = 0; i < ecdata[r].length; i += 1) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
      }
    }
    let totalCodeCount = 0;
    for (let i = 0; i < rsBlocks.length; i += 1) {
      totalCodeCount += rsBlocks[i].totalCount;
    }
    const data = new Array(totalCodeCount);
    let index = 0;
    for (let i = 0; i < maxDcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < dcdata[r].length) {
          data[index] = dcdata[r][i];
          index += 1;
        }
      }
    }
    for (let i = 0; i < maxEcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < ecdata[r].length) {
          data[index] = ecdata[r][i];
          index += 1;
        }
      }
    }
    return data;
  };
  const createData = function(typeNumber2, errorCorrectionLevel2, dataList) {
    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, errorCorrectionLevel2);
    const buffer = qrBitBuffer();
    for (let i = 0; i < dataList.length; i += 1) {
      const data = dataList[i];
      buffer.put(data.getMode(), 4);
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
      data.write(buffer);
    }
    let totalDataCount = 0;
    for (let i = 0; i < rsBlocks.length; i += 1) {
      totalDataCount += rsBlocks[i].dataCount;
    }
    if (buffer.getLengthInBits() > totalDataCount * 8) {
      throw "code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")";
    }
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
      buffer.put(0, 4);
    }
    while (buffer.getLengthInBits() % 8 != 0) {
      buffer.putBit(false);
    }
    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) {
        break;
      }
      buffer.put(PAD0, 8);
      if (buffer.getLengthInBits() >= totalDataCount * 8) {
        break;
      }
      buffer.put(PAD1, 8);
    }
    return createBytes(buffer, rsBlocks);
  };
  _this.addData = function(data, mode) {
    mode = mode || "Byte";
    let newData = null;
    switch (mode) {
      case "Numeric":
        newData = qrNumber(data);
        break;
      case "Alphanumeric":
        newData = qrAlphaNum(data);
        break;
      case "Byte":
        newData = qr8BitByte(data);
        break;
      case "Kanji":
        newData = qrKanji(data);
        break;
      default:
        throw "mode:" + mode;
    }
    _dataList.push(newData);
    _dataCache = null;
  };
  _this.isDark = function(row, col) {
    if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
      throw row + "," + col;
    }
    return _modules[row][col];
  };
  _this.getModuleCount = function() {
    return _moduleCount;
  };
  _this.make = function() {
    if (_typeNumber < 1) {
      let typeNumber2 = 1;
      for (; typeNumber2 < 40; typeNumber2++) {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, _errorCorrectionLevel);
        const buffer = qrBitBuffer();
        for (let i = 0; i < _dataList.length; i++) {
          const data = _dataList[i];
          buffer.put(data.getMode(), 4);
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
          data.write(buffer);
        }
        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) {
          totalDataCount += rsBlocks[i].dataCount;
        }
        if (buffer.getLengthInBits() <= totalDataCount * 8) {
          break;
        }
      }
      _typeNumber = typeNumber2;
    }
    makeImpl(false, getBestMaskPattern());
  };
  _this.createTableTag = function(cellSize, margin) {
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    let qrHtml = "";
    qrHtml += '<table style="';
    qrHtml += " border-width: 0px; border-style: none;";
    qrHtml += " border-collapse: collapse;";
    qrHtml += " padding: 0px; margin: " + margin + "px;";
    qrHtml += '">';
    qrHtml += "<tbody>";
    for (let r = 0; r < _this.getModuleCount(); r += 1) {
      qrHtml += "<tr>";
      for (let c = 0; c < _this.getModuleCount(); c += 1) {
        qrHtml += '<td style="';
        qrHtml += " border-width: 0px; border-style: none;";
        qrHtml += " border-collapse: collapse;";
        qrHtml += " padding: 0px; margin: 0px;";
        qrHtml += " width: " + cellSize + "px;";
        qrHtml += " height: " + cellSize + "px;";
        qrHtml += " background-color: ";
        qrHtml += _this.isDark(r, c) ? "#000000" : "#ffffff";
        qrHtml += ";";
        qrHtml += '"/>';
      }
      qrHtml += "</tr>";
    }
    qrHtml += "</tbody>";
    qrHtml += "</table>";
    return qrHtml;
  };
  _this.createSvgTag = function(cellSize, margin, alt, title) {
    let opts = {};
    if (typeof arguments[0] == "object") {
      opts = arguments[0];
      cellSize = opts.cellSize;
      margin = opts.margin;
      alt = opts.alt;
      title = opts.title;
    }
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    alt = typeof alt === "string" ? { text: alt } : alt || {};
    alt.text = alt.text || null;
    alt.id = alt.text ? alt.id || "qrcode-description" : null;
    title = typeof title === "string" ? { text: title } : title || {};
    title.text = title.text || null;
    title.id = title.text ? title.id || "qrcode-title" : null;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    let c, mc, r, mr, qrSvg2 = "", rect;
    rect = "l" + cellSize + ",0 0," + cellSize + " -" + cellSize + ",0 0,-" + cellSize + "z ";
    qrSvg2 += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
    qrSvg2 += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : "";
    qrSvg2 += ' viewBox="0 0 ' + size + " " + size + '" ';
    qrSvg2 += ' preserveAspectRatio="xMinYMin meet"';
    qrSvg2 += title.text || alt.text ? ' role="img" aria-labelledby="' + escapeXml([title.id, alt.id].join(" ").trim()) + '"' : "";
    qrSvg2 += ">";
    qrSvg2 += title.text ? '<title id="' + escapeXml(title.id) + '">' + escapeXml(title.text) + "</title>" : "";
    qrSvg2 += alt.text ? '<description id="' + escapeXml(alt.id) + '">' + escapeXml(alt.text) + "</description>" : "";
    qrSvg2 += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
    qrSvg2 += '<path d="';
    for (r = 0; r < _this.getModuleCount(); r += 1) {
      mr = r * cellSize + margin;
      for (c = 0; c < _this.getModuleCount(); c += 1) {
        if (_this.isDark(r, c)) {
          mc = c * cellSize + margin;
          qrSvg2 += "M" + mc + "," + mr + rect;
        }
      }
    }
    qrSvg2 += '" stroke="transparent" fill="black"/>';
    qrSvg2 += "</svg>";
    return qrSvg2;
  };
  _this.createDataURL = function(cellSize, margin) {
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;
    return createDataURL(size, size, function(x, y) {
      if (min <= x && x < max && min <= y && y < max) {
        const c = Math.floor((x - min) / cellSize);
        const r = Math.floor((y - min) / cellSize);
        return _this.isDark(r, c) ? 0 : 1;
      } else {
        return 1;
      }
    });
  };
  _this.createImgTag = function(cellSize, margin, alt) {
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    let img = "";
    img += "<img";
    img += ' src="';
    img += _this.createDataURL(cellSize, margin);
    img += '"';
    img += ' width="';
    img += size;
    img += '"';
    img += ' height="';
    img += size;
    img += '"';
    if (alt) {
      img += ' alt="';
      img += escapeXml(alt);
      img += '"';
    }
    img += "/>";
    return img;
  };
  const escapeXml = function(s) {
    let escaped = "";
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charAt(i);
      switch (c) {
        case "<":
          escaped += "&lt;";
          break;
        case ">":
          escaped += "&gt;";
          break;
        case "&":
          escaped += "&amp;";
          break;
        case '"':
          escaped += "&quot;";
          break;
        default:
          escaped += c;
          break;
      }
    }
    return escaped;
  };
  const _createHalfASCII = function(margin) {
    const cellSize = 1;
    margin = typeof margin == "undefined" ? cellSize * 2 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;
    let y, x, r1, r2, p;
    const blocks = {
      "\u2588\u2588": "\u2588",
      "\u2588 ": "\u2580",
      " \u2588": "\u2584",
      "  ": " "
    };
    const blocksLastLineNoMargin = {
      "\u2588\u2588": "\u2580",
      "\u2588 ": "\u2580",
      " \u2588": " ",
      "  ": " "
    };
    let ascii = "";
    for (y = 0; y < size; y += 2) {
      r1 = Math.floor((y - min) / cellSize);
      r2 = Math.floor((y + 1 - min) / cellSize);
      for (x = 0; x < size; x += 1) {
        p = "\u2588";
        if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
          p = " ";
        }
        if (min <= x && x < max && min <= y + 1 && y + 1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
          p += " ";
        } else {
          p += "\u2588";
        }
        ascii += margin < 1 && y + 1 >= max ? blocksLastLineNoMargin[p] : blocks[p];
      }
      ascii += "\n";
    }
    if (size % 2 && margin > 0) {
      return ascii.substring(0, ascii.length - size - 1) + Array(size + 1).join("\u2580");
    }
    return ascii.substring(0, ascii.length - 1);
  };
  _this.createASCII = function(cellSize, margin) {
    cellSize = cellSize || 1;
    if (cellSize < 2) {
      return _createHalfASCII(margin);
    }
    cellSize -= 1;
    margin = typeof margin == "undefined" ? cellSize * 2 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;
    let y, x, r, p;
    const white = Array(cellSize + 1).join("\u2588\u2588");
    const black = Array(cellSize + 1).join("  ");
    let ascii = "";
    let line2 = "";
    for (y = 0; y < size; y += 1) {
      r = Math.floor((y - min) / cellSize);
      line2 = "";
      for (x = 0; x < size; x += 1) {
        p = 1;
        if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
          p = 0;
        }
        line2 += p ? white : black;
      }
      for (r = 0; r < cellSize; r += 1) {
        ascii += line2 + "\n";
      }
    }
    return ascii.substring(0, ascii.length - 1);
  };
  _this.renderTo2dContext = function(context, cellSize) {
    cellSize = cellSize || 2;
    const length = _this.getModuleCount();
    for (let row = 0; row < length; row++) {
      for (let col = 0; col < length; col++) {
        context.fillStyle = _this.isDark(row, col) ? "black" : "white";
        context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  };
  return _this;
};
qrcode.stringToBytes = function(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    bytes.push(c & 255);
  }
  return bytes;
};
qrcode.createStringToBytes = function(unicodeData, numChars) {
  const unicodeMap = (function() {
    const bin = base64DecodeInputStream(unicodeData);
    const read = function() {
      const b = bin.read();
      if (b == -1) throw "eof";
      return b;
    };
    let count = 0;
    const unicodeMap2 = {};
    while (true) {
      const b0 = bin.read();
      if (b0 == -1) break;
      const b1 = read();
      const b2 = read();
      const b3 = read();
      const k = String.fromCharCode(b0 << 8 | b1);
      const v = b2 << 8 | b3;
      unicodeMap2[k] = v;
      count += 1;
    }
    if (count != numChars) {
      throw count + " != " + numChars;
    }
    return unicodeMap2;
  })();
  const unknownChar = "?".charCodeAt(0);
  return function(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);
      if (c < 128) {
        bytes.push(c);
      } else {
        const b = unicodeMap[s.charAt(i)];
        if (typeof b == "number") {
          if ((b & 255) == b) {
            bytes.push(b);
          } else {
            bytes.push(b >>> 8);
            bytes.push(b & 255);
          }
        } else {
          bytes.push(unknownChar);
        }
      }
    }
    return bytes;
  };
};
var QRMode = {
  MODE_NUMBER: 1 << 0,
  MODE_ALPHA_NUM: 1 << 1,
  MODE_8BIT_BYTE: 1 << 2,
  MODE_KANJI: 1 << 3
};
var QRErrorCorrectionLevel = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2
};
var QRMaskPattern = {
  PATTERN000: 0,
  PATTERN001: 1,
  PATTERN010: 2,
  PATTERN011: 3,
  PATTERN100: 4,
  PATTERN101: 5,
  PATTERN110: 6,
  PATTERN111: 7
};
var QRUtil = (function() {
  const PATTERN_POSITION_TABLE = [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70],
    [6, 26, 50, 74],
    [6, 30, 54, 78],
    [6, 30, 56, 82],
    [6, 30, 58, 86],
    [6, 34, 62, 90],
    [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98],
    [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114],
    [6, 34, 62, 90, 118],
    [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130],
    [6, 30, 56, 82, 108, 134],
    [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142],
    [6, 34, 62, 90, 118, 146],
    [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158],
    [6, 32, 58, 84, 110, 136, 162],
    [6, 26, 54, 82, 110, 138, 166],
    [6, 30, 58, 86, 114, 142, 170]
  ];
  const G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
  const G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
  const G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
  const _this = {};
  const getBCHDigit = function(data) {
    let digit = 0;
    while (data != 0) {
      digit += 1;
      data >>>= 1;
    }
    return digit;
  };
  _this.getBCHTypeInfo = function(data) {
    let d = data << 10;
    while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
      d ^= G15 << getBCHDigit(d) - getBCHDigit(G15);
    }
    return (data << 10 | d) ^ G15_MASK;
  };
  _this.getBCHTypeNumber = function(data) {
    let d = data << 12;
    while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
      d ^= G18 << getBCHDigit(d) - getBCHDigit(G18);
    }
    return data << 12 | d;
  };
  _this.getPatternPosition = function(typeNumber) {
    return PATTERN_POSITION_TABLE[typeNumber - 1];
  };
  _this.getMaskFunction = function(maskPattern) {
    switch (maskPattern) {
      case QRMaskPattern.PATTERN000:
        return function(i, j) {
          return (i + j) % 2 == 0;
        };
      case QRMaskPattern.PATTERN001:
        return function(i, j) {
          return i % 2 == 0;
        };
      case QRMaskPattern.PATTERN010:
        return function(i, j) {
          return j % 3 == 0;
        };
      case QRMaskPattern.PATTERN011:
        return function(i, j) {
          return (i + j) % 3 == 0;
        };
      case QRMaskPattern.PATTERN100:
        return function(i, j) {
          return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
        };
      case QRMaskPattern.PATTERN101:
        return function(i, j) {
          return i * j % 2 + i * j % 3 == 0;
        };
      case QRMaskPattern.PATTERN110:
        return function(i, j) {
          return (i * j % 2 + i * j % 3) % 2 == 0;
        };
      case QRMaskPattern.PATTERN111:
        return function(i, j) {
          return (i * j % 3 + (i + j) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + maskPattern;
    }
  };
  _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
    let a = qrPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i += 1) {
      a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
    }
    return a;
  };
  _this.getLengthInBits = function(mode, type) {
    if (1 <= type && type < 10) {
      switch (mode) {
        case QRMode.MODE_NUMBER:
          return 10;
        case QRMode.MODE_ALPHA_NUM:
          return 9;
        case QRMode.MODE_8BIT_BYTE:
          return 8;
        case QRMode.MODE_KANJI:
          return 8;
        default:
          throw "mode:" + mode;
      }
    } else if (type < 27) {
      switch (mode) {
        case QRMode.MODE_NUMBER:
          return 12;
        case QRMode.MODE_ALPHA_NUM:
          return 11;
        case QRMode.MODE_8BIT_BYTE:
          return 16;
        case QRMode.MODE_KANJI:
          return 10;
        default:
          throw "mode:" + mode;
      }
    } else if (type < 41) {
      switch (mode) {
        case QRMode.MODE_NUMBER:
          return 14;
        case QRMode.MODE_ALPHA_NUM:
          return 13;
        case QRMode.MODE_8BIT_BYTE:
          return 16;
        case QRMode.MODE_KANJI:
          return 12;
        default:
          throw "mode:" + mode;
      }
    } else {
      throw "type:" + type;
    }
  };
  _this.getLostPoint = function(qrcode2) {
    const moduleCount = qrcode2.getModuleCount();
    let lostPoint = 0;
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        let sameCount = 0;
        const dark = qrcode2.isDark(row, col);
        for (let r = -1; r <= 1; r += 1) {
          if (row + r < 0 || moduleCount <= row + r) {
            continue;
          }
          for (let c = -1; c <= 1; c += 1) {
            if (col + c < 0 || moduleCount <= col + c) {
              continue;
            }
            if (r == 0 && c == 0) {
              continue;
            }
            if (dark == qrcode2.isDark(row + r, col + c)) {
              sameCount += 1;
            }
          }
        }
        if (sameCount > 5) {
          lostPoint += 3 + sameCount - 5;
        }
      }
    }
    ;
    for (let row = 0; row < moduleCount - 1; row += 1) {
      for (let col = 0; col < moduleCount - 1; col += 1) {
        let count = 0;
        if (qrcode2.isDark(row, col)) count += 1;
        if (qrcode2.isDark(row + 1, col)) count += 1;
        if (qrcode2.isDark(row, col + 1)) count += 1;
        if (qrcode2.isDark(row + 1, col + 1)) count += 1;
        if (count == 0 || count == 4) {
          lostPoint += 3;
        }
      }
    }
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount - 6; col += 1) {
        if (qrcode2.isDark(row, col) && !qrcode2.isDark(row, col + 1) && qrcode2.isDark(row, col + 2) && qrcode2.isDark(row, col + 3) && qrcode2.isDark(row, col + 4) && !qrcode2.isDark(row, col + 5) && qrcode2.isDark(row, col + 6)) {
          lostPoint += 40;
        }
      }
    }
    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount - 6; row += 1) {
        if (qrcode2.isDark(row, col) && !qrcode2.isDark(row + 1, col) && qrcode2.isDark(row + 2, col) && qrcode2.isDark(row + 3, col) && qrcode2.isDark(row + 4, col) && !qrcode2.isDark(row + 5, col) && qrcode2.isDark(row + 6, col)) {
          lostPoint += 40;
        }
      }
    }
    let darkCount = 0;
    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount; row += 1) {
        if (qrcode2.isDark(row, col)) {
          darkCount += 1;
        }
      }
    }
    const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
    lostPoint += ratio * 10;
    return lostPoint;
  };
  return _this;
})();
var QRMath = (function() {
  const EXP_TABLE = new Array(256);
  const LOG_TABLE = new Array(256);
  for (let i = 0; i < 8; i += 1) {
    EXP_TABLE[i] = 1 << i;
  }
  for (let i = 8; i < 256; i += 1) {
    EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i += 1) {
    LOG_TABLE[EXP_TABLE[i]] = i;
  }
  const _this = {};
  _this.glog = function(n) {
    if (n < 1) {
      throw "glog(" + n + ")";
    }
    return LOG_TABLE[n];
  };
  _this.gexp = function(n) {
    while (n < 0) {
      n += 255;
    }
    while (n >= 256) {
      n -= 255;
    }
    return EXP_TABLE[n];
  };
  return _this;
})();
var qrPolynomial = function(num2, shift) {
  if (typeof num2.length == "undefined") {
    throw num2.length + "/" + shift;
  }
  const _num = (function() {
    let offset = 0;
    while (offset < num2.length && num2[offset] == 0) {
      offset += 1;
    }
    const _num2 = new Array(num2.length - offset + shift);
    for (let i = 0; i < num2.length - offset; i += 1) {
      _num2[i] = num2[i + offset];
    }
    return _num2;
  })();
  const _this = {};
  _this.getAt = function(index) {
    return _num[index];
  };
  _this.getLength = function() {
    return _num.length;
  };
  _this.multiply = function(e) {
    const num3 = new Array(_this.getLength() + e.getLength() - 1);
    for (let i = 0; i < _this.getLength(); i += 1) {
      for (let j = 0; j < e.getLength(); j += 1) {
        num3[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j)));
      }
    }
    return qrPolynomial(num3, 0);
  };
  _this.mod = function(e) {
    if (_this.getLength() - e.getLength() < 0) {
      return _this;
    }
    const ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));
    const num3 = new Array(_this.getLength());
    for (let i = 0; i < _this.getLength(); i += 1) {
      num3[i] = _this.getAt(i);
    }
    for (let i = 0; i < e.getLength(); i += 1) {
      num3[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio);
    }
    return qrPolynomial(num3, 0).mod(e);
  };
  return _this;
};
var QRRSBlock = (function() {
  const RS_BLOCK_TABLE = [
    // L
    // M
    // Q
    // H
    // 1
    [1, 26, 19],
    [1, 26, 16],
    [1, 26, 13],
    [1, 26, 9],
    // 2
    [1, 44, 34],
    [1, 44, 28],
    [1, 44, 22],
    [1, 44, 16],
    // 3
    [1, 70, 55],
    [1, 70, 44],
    [2, 35, 17],
    [2, 35, 13],
    // 4
    [1, 100, 80],
    [2, 50, 32],
    [2, 50, 24],
    [4, 25, 9],
    // 5
    [1, 134, 108],
    [2, 67, 43],
    [2, 33, 15, 2, 34, 16],
    [2, 33, 11, 2, 34, 12],
    // 6
    [2, 86, 68],
    [4, 43, 27],
    [4, 43, 19],
    [4, 43, 15],
    // 7
    [2, 98, 78],
    [4, 49, 31],
    [2, 32, 14, 4, 33, 15],
    [4, 39, 13, 1, 40, 14],
    // 8
    [2, 121, 97],
    [2, 60, 38, 2, 61, 39],
    [4, 40, 18, 2, 41, 19],
    [4, 40, 14, 2, 41, 15],
    // 9
    [2, 146, 116],
    [3, 58, 36, 2, 59, 37],
    [4, 36, 16, 4, 37, 17],
    [4, 36, 12, 4, 37, 13],
    // 10
    [2, 86, 68, 2, 87, 69],
    [4, 69, 43, 1, 70, 44],
    [6, 43, 19, 2, 44, 20],
    [6, 43, 15, 2, 44, 16],
    // 11
    [4, 101, 81],
    [1, 80, 50, 4, 81, 51],
    [4, 50, 22, 4, 51, 23],
    [3, 36, 12, 8, 37, 13],
    // 12
    [2, 116, 92, 2, 117, 93],
    [6, 58, 36, 2, 59, 37],
    [4, 46, 20, 6, 47, 21],
    [7, 42, 14, 4, 43, 15],
    // 13
    [4, 133, 107],
    [8, 59, 37, 1, 60, 38],
    [8, 44, 20, 4, 45, 21],
    [12, 33, 11, 4, 34, 12],
    // 14
    [3, 145, 115, 1, 146, 116],
    [4, 64, 40, 5, 65, 41],
    [11, 36, 16, 5, 37, 17],
    [11, 36, 12, 5, 37, 13],
    // 15
    [5, 109, 87, 1, 110, 88],
    [5, 65, 41, 5, 66, 42],
    [5, 54, 24, 7, 55, 25],
    [11, 36, 12, 7, 37, 13],
    // 16
    [5, 122, 98, 1, 123, 99],
    [7, 73, 45, 3, 74, 46],
    [15, 43, 19, 2, 44, 20],
    [3, 45, 15, 13, 46, 16],
    // 17
    [1, 135, 107, 5, 136, 108],
    [10, 74, 46, 1, 75, 47],
    [1, 50, 22, 15, 51, 23],
    [2, 42, 14, 17, 43, 15],
    // 18
    [5, 150, 120, 1, 151, 121],
    [9, 69, 43, 4, 70, 44],
    [17, 50, 22, 1, 51, 23],
    [2, 42, 14, 19, 43, 15],
    // 19
    [3, 141, 113, 4, 142, 114],
    [3, 70, 44, 11, 71, 45],
    [17, 47, 21, 4, 48, 22],
    [9, 39, 13, 16, 40, 14],
    // 20
    [3, 135, 107, 5, 136, 108],
    [3, 67, 41, 13, 68, 42],
    [15, 54, 24, 5, 55, 25],
    [15, 43, 15, 10, 44, 16],
    // 21
    [4, 144, 116, 4, 145, 117],
    [17, 68, 42],
    [17, 50, 22, 6, 51, 23],
    [19, 46, 16, 6, 47, 17],
    // 22
    [2, 139, 111, 7, 140, 112],
    [17, 74, 46],
    [7, 54, 24, 16, 55, 25],
    [34, 37, 13],
    // 23
    [4, 151, 121, 5, 152, 122],
    [4, 75, 47, 14, 76, 48],
    [11, 54, 24, 14, 55, 25],
    [16, 45, 15, 14, 46, 16],
    // 24
    [6, 147, 117, 4, 148, 118],
    [6, 73, 45, 14, 74, 46],
    [11, 54, 24, 16, 55, 25],
    [30, 46, 16, 2, 47, 17],
    // 25
    [8, 132, 106, 4, 133, 107],
    [8, 75, 47, 13, 76, 48],
    [7, 54, 24, 22, 55, 25],
    [22, 45, 15, 13, 46, 16],
    // 26
    [10, 142, 114, 2, 143, 115],
    [19, 74, 46, 4, 75, 47],
    [28, 50, 22, 6, 51, 23],
    [33, 46, 16, 4, 47, 17],
    // 27
    [8, 152, 122, 4, 153, 123],
    [22, 73, 45, 3, 74, 46],
    [8, 53, 23, 26, 54, 24],
    [12, 45, 15, 28, 46, 16],
    // 28
    [3, 147, 117, 10, 148, 118],
    [3, 73, 45, 23, 74, 46],
    [4, 54, 24, 31, 55, 25],
    [11, 45, 15, 31, 46, 16],
    // 29
    [7, 146, 116, 7, 147, 117],
    [21, 73, 45, 7, 74, 46],
    [1, 53, 23, 37, 54, 24],
    [19, 45, 15, 26, 46, 16],
    // 30
    [5, 145, 115, 10, 146, 116],
    [19, 75, 47, 10, 76, 48],
    [15, 54, 24, 25, 55, 25],
    [23, 45, 15, 25, 46, 16],
    // 31
    [13, 145, 115, 3, 146, 116],
    [2, 74, 46, 29, 75, 47],
    [42, 54, 24, 1, 55, 25],
    [23, 45, 15, 28, 46, 16],
    // 32
    [17, 145, 115],
    [10, 74, 46, 23, 75, 47],
    [10, 54, 24, 35, 55, 25],
    [19, 45, 15, 35, 46, 16],
    // 33
    [17, 145, 115, 1, 146, 116],
    [14, 74, 46, 21, 75, 47],
    [29, 54, 24, 19, 55, 25],
    [11, 45, 15, 46, 46, 16],
    // 34
    [13, 145, 115, 6, 146, 116],
    [14, 74, 46, 23, 75, 47],
    [44, 54, 24, 7, 55, 25],
    [59, 46, 16, 1, 47, 17],
    // 35
    [12, 151, 121, 7, 152, 122],
    [12, 75, 47, 26, 76, 48],
    [39, 54, 24, 14, 55, 25],
    [22, 45, 15, 41, 46, 16],
    // 36
    [6, 151, 121, 14, 152, 122],
    [6, 75, 47, 34, 76, 48],
    [46, 54, 24, 10, 55, 25],
    [2, 45, 15, 64, 46, 16],
    // 37
    [17, 152, 122, 4, 153, 123],
    [29, 74, 46, 14, 75, 47],
    [49, 54, 24, 10, 55, 25],
    [24, 45, 15, 46, 46, 16],
    // 38
    [4, 152, 122, 18, 153, 123],
    [13, 74, 46, 32, 75, 47],
    [48, 54, 24, 14, 55, 25],
    [42, 45, 15, 32, 46, 16],
    // 39
    [20, 147, 117, 4, 148, 118],
    [40, 75, 47, 7, 76, 48],
    [43, 54, 24, 22, 55, 25],
    [10, 45, 15, 67, 46, 16],
    // 40
    [19, 148, 118, 6, 149, 119],
    [18, 75, 47, 31, 76, 48],
    [34, 54, 24, 34, 55, 25],
    [20, 45, 15, 61, 46, 16]
  ];
  const qrRSBlock = function(totalCount, dataCount) {
    const _this2 = {};
    _this2.totalCount = totalCount;
    _this2.dataCount = dataCount;
    return _this2;
  };
  const _this = {};
  const getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
    switch (errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default:
        return void 0;
    }
  };
  _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
    const rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
    if (typeof rsBlock == "undefined") {
      throw "bad rs block @ typeNumber:" + typeNumber + "/errorCorrectionLevel:" + errorCorrectionLevel;
    }
    const length = rsBlock.length / 3;
    const list = [];
    for (let i = 0; i < length; i += 1) {
      const count = rsBlock[i * 3 + 0];
      const totalCount = rsBlock[i * 3 + 1];
      const dataCount = rsBlock[i * 3 + 2];
      for (let j = 0; j < count; j += 1) {
        list.push(qrRSBlock(totalCount, dataCount));
      }
    }
    return list;
  };
  return _this;
})();
var qrBitBuffer = function() {
  const _buffer = [];
  let _length = 0;
  const _this = {};
  _this.getBuffer = function() {
    return _buffer;
  };
  _this.getAt = function(index) {
    const bufIndex = Math.floor(index / 8);
    return (_buffer[bufIndex] >>> 7 - index % 8 & 1) == 1;
  };
  _this.put = function(num2, length) {
    for (let i = 0; i < length; i += 1) {
      _this.putBit((num2 >>> length - i - 1 & 1) == 1);
    }
  };
  _this.getLengthInBits = function() {
    return _length;
  };
  _this.putBit = function(bit) {
    const bufIndex = Math.floor(_length / 8);
    if (_buffer.length <= bufIndex) {
      _buffer.push(0);
    }
    if (bit) {
      _buffer[bufIndex] |= 128 >>> _length % 8;
    }
    _length += 1;
  };
  return _this;
};
var qrNumber = function(data) {
  const _mode = QRMode.MODE_NUMBER;
  const _data = data;
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return _data.length;
  };
  _this.write = function(buffer) {
    const data2 = _data;
    let i = 0;
    while (i + 2 < data2.length) {
      buffer.put(strToNum(data2.substring(i, i + 3)), 10);
      i += 3;
    }
    if (i < data2.length) {
      if (data2.length - i == 1) {
        buffer.put(strToNum(data2.substring(i, i + 1)), 4);
      } else if (data2.length - i == 2) {
        buffer.put(strToNum(data2.substring(i, i + 2)), 7);
      }
    }
  };
  const strToNum = function(s) {
    let num2 = 0;
    for (let i = 0; i < s.length; i += 1) {
      num2 = num2 * 10 + chatToNum(s.charAt(i));
    }
    return num2;
  };
  const chatToNum = function(c) {
    if ("0" <= c && c <= "9") {
      return c.charCodeAt(0) - "0".charCodeAt(0);
    }
    throw "illegal char :" + c;
  };
  return _this;
};
var qrAlphaNum = function(data) {
  const _mode = QRMode.MODE_ALPHA_NUM;
  const _data = data;
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return _data.length;
  };
  _this.write = function(buffer) {
    const s = _data;
    let i = 0;
    while (i + 1 < s.length) {
      buffer.put(
        getCode(s.charAt(i)) * 45 + getCode(s.charAt(i + 1)),
        11
      );
      i += 2;
    }
    if (i < s.length) {
      buffer.put(getCode(s.charAt(i)), 6);
    }
  };
  const getCode = function(c) {
    if ("0" <= c && c <= "9") {
      return c.charCodeAt(0) - "0".charCodeAt(0);
    } else if ("A" <= c && c <= "Z") {
      return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
    } else {
      switch (c) {
        case " ":
          return 36;
        case "$":
          return 37;
        case "%":
          return 38;
        case "*":
          return 39;
        case "+":
          return 40;
        case "-":
          return 41;
        case ".":
          return 42;
        case "/":
          return 43;
        case ":":
          return 44;
        default:
          throw "illegal char :" + c;
      }
    }
  };
  return _this;
};
var qr8BitByte = function(data) {
  const _mode = QRMode.MODE_8BIT_BYTE;
  const _data = data;
  const _bytes = qrcode.stringToBytes(data);
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return _bytes.length;
  };
  _this.write = function(buffer) {
    for (let i = 0; i < _bytes.length; i += 1) {
      buffer.put(_bytes[i], 8);
    }
  };
  return _this;
};
var qrKanji = function(data) {
  const _mode = QRMode.MODE_KANJI;
  const _data = data;
  const stringToBytes2 = qrcode.stringToBytes;
  !(function(c, code) {
    const test = stringToBytes2(c);
    if (test.length != 2 || (test[0] << 8 | test[1]) != code) {
      throw "sjis not supported.";
    }
  })("\u53CB", 38726);
  const _bytes = stringToBytes2(data);
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return ~~(_bytes.length / 2);
  };
  _this.write = function(buffer) {
    const data2 = _bytes;
    let i = 0;
    while (i + 1 < data2.length) {
      let c = (255 & data2[i]) << 8 | 255 & data2[i + 1];
      if (33088 <= c && c <= 40956) {
        c -= 33088;
      } else if (57408 <= c && c <= 60351) {
        c -= 49472;
      } else {
        throw "illegal char at " + (i + 1) + "/" + c;
      }
      c = (c >>> 8 & 255) * 192 + (c & 255);
      buffer.put(c, 13);
      i += 2;
    }
    if (i < data2.length) {
      throw "illegal char at " + (i + 1);
    }
  };
  return _this;
};
var byteArrayOutputStream = function() {
  const _bytes = [];
  const _this = {};
  _this.writeByte = function(b) {
    _bytes.push(b & 255);
  };
  _this.writeShort = function(i) {
    _this.writeByte(i);
    _this.writeByte(i >>> 8);
  };
  _this.writeBytes = function(b, off, len) {
    off = off || 0;
    len = len || b.length;
    for (let i = 0; i < len; i += 1) {
      _this.writeByte(b[i + off]);
    }
  };
  _this.writeString = function(s) {
    for (let i = 0; i < s.length; i += 1) {
      _this.writeByte(s.charCodeAt(i));
    }
  };
  _this.toByteArray = function() {
    return _bytes;
  };
  _this.toString = function() {
    let s = "";
    s += "[";
    for (let i = 0; i < _bytes.length; i += 1) {
      if (i > 0) {
        s += ",";
      }
      s += _bytes[i];
    }
    s += "]";
    return s;
  };
  return _this;
};
var base64EncodeOutputStream = function() {
  let _buffer = 0;
  let _buflen = 0;
  let _length = 0;
  let _base64 = "";
  const _this = {};
  const writeEncoded = function(b) {
    _base64 += String.fromCharCode(encode2(b & 63));
  };
  const encode2 = function(n) {
    if (n < 0) {
      throw "n:" + n;
    } else if (n < 26) {
      return 65 + n;
    } else if (n < 52) {
      return 97 + (n - 26);
    } else if (n < 62) {
      return 48 + (n - 52);
    } else if (n == 62) {
      return 43;
    } else if (n == 63) {
      return 47;
    } else {
      throw "n:" + n;
    }
  };
  _this.writeByte = function(n) {
    _buffer = _buffer << 8 | n & 255;
    _buflen += 8;
    _length += 1;
    while (_buflen >= 6) {
      writeEncoded(_buffer >>> _buflen - 6);
      _buflen -= 6;
    }
  };
  _this.flush = function() {
    if (_buflen > 0) {
      writeEncoded(_buffer << 6 - _buflen);
      _buffer = 0;
      _buflen = 0;
    }
    if (_length % 3 != 0) {
      const padlen = 3 - _length % 3;
      for (let i = 0; i < padlen; i += 1) {
        _base64 += "=";
      }
    }
  };
  _this.toString = function() {
    return _base64;
  };
  return _this;
};
var base64DecodeInputStream = function(str2) {
  const _str = str2;
  let _pos = 0;
  let _buffer = 0;
  let _buflen = 0;
  const _this = {};
  _this.read = function() {
    while (_buflen < 8) {
      if (_pos >= _str.length) {
        if (_buflen == 0) {
          return -1;
        }
        throw "unexpected end of file./" + _buflen;
      }
      const c = _str.charAt(_pos);
      _pos += 1;
      if (c == "=") {
        _buflen = 0;
        return -1;
      } else if (c.match(/^\s$/)) {
        continue;
      }
      _buffer = _buffer << 6 | decode(c.charCodeAt(0));
      _buflen += 6;
    }
    const n = _buffer >>> _buflen - 8 & 255;
    _buflen -= 8;
    return n;
  };
  const decode = function(c) {
    if (65 <= c && c <= 90) {
      return c - 65;
    } else if (97 <= c && c <= 122) {
      return c - 97 + 26;
    } else if (48 <= c && c <= 57) {
      return c - 48 + 52;
    } else if (c == 43) {
      return 62;
    } else if (c == 47) {
      return 63;
    } else {
      throw "c:" + c;
    }
  };
  return _this;
};
var gifImage = function(width, height) {
  const _width = width;
  const _height = height;
  const _data = new Array(width * height);
  const _this = {};
  _this.setPixel = function(x, y, pixel) {
    _data[y * _width + x] = pixel;
  };
  _this.write = function(out) {
    out.writeString("GIF87a");
    out.writeShort(_width);
    out.writeShort(_height);
    out.writeByte(128);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(255);
    out.writeByte(255);
    out.writeByte(255);
    out.writeString(",");
    out.writeShort(0);
    out.writeShort(0);
    out.writeShort(_width);
    out.writeShort(_height);
    out.writeByte(0);
    const lzwMinCodeSize = 2;
    const raster = getLZWRaster(lzwMinCodeSize);
    out.writeByte(lzwMinCodeSize);
    let offset = 0;
    while (raster.length - offset > 255) {
      out.writeByte(255);
      out.writeBytes(raster, offset, 255);
      offset += 255;
    }
    out.writeByte(raster.length - offset);
    out.writeBytes(raster, offset, raster.length - offset);
    out.writeByte(0);
    out.writeString(";");
  };
  const bitOutputStream = function(out) {
    const _out = out;
    let _bitLength = 0;
    let _bitBuffer = 0;
    const _this2 = {};
    _this2.write = function(data, length) {
      if (data >>> length != 0) {
        throw "length over";
      }
      while (_bitLength + length >= 8) {
        _out.writeByte(255 & (data << _bitLength | _bitBuffer));
        length -= 8 - _bitLength;
        data >>>= 8 - _bitLength;
        _bitBuffer = 0;
        _bitLength = 0;
      }
      _bitBuffer = data << _bitLength | _bitBuffer;
      _bitLength = _bitLength + length;
    };
    _this2.flush = function() {
      if (_bitLength > 0) {
        _out.writeByte(_bitBuffer);
      }
    };
    return _this2;
  };
  const getLZWRaster = function(lzwMinCodeSize) {
    const clearCode = 1 << lzwMinCodeSize;
    const endCode = (1 << lzwMinCodeSize) + 1;
    let bitLength = lzwMinCodeSize + 1;
    const table = lzwTable();
    for (let i = 0; i < clearCode; i += 1) {
      table.add(String.fromCharCode(i));
    }
    table.add(String.fromCharCode(clearCode));
    table.add(String.fromCharCode(endCode));
    const byteOut = byteArrayOutputStream();
    const bitOut = bitOutputStream(byteOut);
    bitOut.write(clearCode, bitLength);
    let dataIndex = 0;
    let s = String.fromCharCode(_data[dataIndex]);
    dataIndex += 1;
    while (dataIndex < _data.length) {
      const c = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;
      if (table.contains(s + c)) {
        s = s + c;
      } else {
        bitOut.write(table.indexOf(s), bitLength);
        if (table.size() < 4095) {
          if (table.size() == 1 << bitLength) {
            bitLength += 1;
          }
          table.add(s + c);
        }
        s = c;
      }
    }
    bitOut.write(table.indexOf(s), bitLength);
    bitOut.write(endCode, bitLength);
    bitOut.flush();
    return byteOut.toByteArray();
  };
  const lzwTable = function() {
    const _map = {};
    let _size = 0;
    const _this2 = {};
    _this2.add = function(key) {
      if (_this2.contains(key)) {
        throw "dup key:" + key;
      }
      _map[key] = _size;
      _size += 1;
    };
    _this2.size = function() {
      return _size;
    };
    _this2.indexOf = function(key) {
      return _map[key];
    };
    _this2.contains = function(key) {
      return typeof _map[key] != "undefined";
    };
    return _this2;
  };
  return _this;
};
var createDataURL = function(width, height, getPixel) {
  const gif = gifImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      gif.setPixel(x, y, getPixel(x, y));
    }
  }
  const b = byteArrayOutputStream();
  gif.write(b);
  const base64 = base64EncodeOutputStream();
  const bytes = b.toByteArray();
  for (let i = 0; i < bytes.length; i += 1) {
    base64.writeByte(bytes[i]);
  }
  base64.flush();
  return "data:image/gif;base64," + base64;
};
var qrcode_generator_default = qrcode;
var stringToBytes = qrcode.stringToBytes;

// src/vendor/jsqr.js
var module = { exports: {} };
var exports = module.exports;
(function webpackUniversalModuleDefinition(root2, factory) {
  if (typeof exports === "object" && typeof module === "object")
    module.exports = factory();
  else if (typeof define === "function" && define.amd)
    define([], factory);
  else if (typeof exports === "object")
    exports["jsQR"] = factory();
  else
    root2["jsQR"] = factory();
})(typeof self !== "undefined" ? self : void 0, function() {
  return (
    /******/
    (function(modules) {
      var installedModules = {};
      function __webpack_require__(moduleId) {
        if (installedModules[moduleId]) {
          return installedModules[moduleId].exports;
        }
        var module2 = installedModules[moduleId] = {
          /******/
          i: moduleId,
          /******/
          l: false,
          /******/
          exports: {}
          /******/
        };
        modules[moduleId].call(module2.exports, module2, module2.exports, __webpack_require__);
        module2.l = true;
        return module2.exports;
      }
      __webpack_require__.m = modules;
      __webpack_require__.c = installedModules;
      __webpack_require__.d = function(exports2, name, getter) {
        if (!__webpack_require__.o(exports2, name)) {
          Object.defineProperty(exports2, name, {
            /******/
            configurable: false,
            /******/
            enumerable: true,
            /******/
            get: getter
            /******/
          });
        }
      };
      __webpack_require__.n = function(module2) {
        var getter = module2 && module2.__esModule ? (
          /******/
          function getDefault() {
            return module2["default"];
          }
        ) : (
          /******/
          function getModuleExports() {
            return module2;
          }
        );
        __webpack_require__.d(getter, "a", getter);
        return getter;
      };
      __webpack_require__.o = function(object2, property) {
        return Object.prototype.hasOwnProperty.call(object2, property);
      };
      __webpack_require__.p = "";
      return __webpack_require__(__webpack_require__.s = 3);
    })([
      /* 0 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var BitMatrix = (
          /** @class */
          (function() {
            function BitMatrix2(data, width) {
              this.width = width;
              this.height = data.length / width;
              this.data = data;
            }
            BitMatrix2.createEmpty = function(width, height) {
              return new BitMatrix2(new Uint8ClampedArray(width * height), width);
            };
            BitMatrix2.prototype.get = function(x, y) {
              if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                return false;
              }
              return !!this.data[y * this.width + x];
            };
            BitMatrix2.prototype.set = function(x, y, v) {
              this.data[y * this.width + x] = v ? 1 : 0;
            };
            BitMatrix2.prototype.setRegion = function(left, top, width, height, v) {
              for (var y = top; y < top + height; y++) {
                for (var x = left; x < left + width; x++) {
                  this.set(x, y, !!v);
                }
              }
            };
            return BitMatrix2;
          })()
        );
        exports2.BitMatrix = BitMatrix;
      }),
      /* 1 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var GenericGFPoly_1 = __webpack_require__(2);
        function addOrSubtractGF(a, b) {
          return a ^ b;
        }
        exports2.addOrSubtractGF = addOrSubtractGF;
        var GenericGF = (
          /** @class */
          (function() {
            function GenericGF2(primitive, size, genBase) {
              this.primitive = primitive;
              this.size = size;
              this.generatorBase = genBase;
              this.expTable = new Array(this.size);
              this.logTable = new Array(this.size);
              var x = 1;
              for (var i = 0; i < this.size; i++) {
                this.expTable[i] = x;
                x = x * 2;
                if (x >= this.size) {
                  x = (x ^ this.primitive) & this.size - 1;
                }
              }
              for (var i = 0; i < this.size - 1; i++) {
                this.logTable[this.expTable[i]] = i;
              }
              this.zero = new GenericGFPoly_1.default(this, Uint8ClampedArray.from([0]));
              this.one = new GenericGFPoly_1.default(this, Uint8ClampedArray.from([1]));
            }
            GenericGF2.prototype.multiply = function(a, b) {
              if (a === 0 || b === 0) {
                return 0;
              }
              return this.expTable[(this.logTable[a] + this.logTable[b]) % (this.size - 1)];
            };
            GenericGF2.prototype.inverse = function(a) {
              if (a === 0) {
                throw new Error("Can't invert 0");
              }
              return this.expTable[this.size - this.logTable[a] - 1];
            };
            GenericGF2.prototype.buildMonomial = function(degree, coefficient) {
              if (degree < 0) {
                throw new Error("Invalid monomial degree less than 0");
              }
              if (coefficient === 0) {
                return this.zero;
              }
              var coefficients = new Uint8ClampedArray(degree + 1);
              coefficients[0] = coefficient;
              return new GenericGFPoly_1.default(this, coefficients);
            };
            GenericGF2.prototype.log = function(a) {
              if (a === 0) {
                throw new Error("Can't take log(0)");
              }
              return this.logTable[a];
            };
            GenericGF2.prototype.exp = function(a) {
              return this.expTable[a];
            };
            return GenericGF2;
          })()
        );
        exports2.default = GenericGF;
      }),
      /* 2 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var GenericGF_1 = __webpack_require__(1);
        var GenericGFPoly = (
          /** @class */
          (function() {
            function GenericGFPoly2(field, coefficients) {
              if (coefficients.length === 0) {
                throw new Error("No coefficients.");
              }
              this.field = field;
              var coefficientsLength = coefficients.length;
              if (coefficientsLength > 1 && coefficients[0] === 0) {
                var firstNonZero = 1;
                while (firstNonZero < coefficientsLength && coefficients[firstNonZero] === 0) {
                  firstNonZero++;
                }
                if (firstNonZero === coefficientsLength) {
                  this.coefficients = field.zero.coefficients;
                } else {
                  this.coefficients = new Uint8ClampedArray(coefficientsLength - firstNonZero);
                  for (var i = 0; i < this.coefficients.length; i++) {
                    this.coefficients[i] = coefficients[firstNonZero + i];
                  }
                }
              } else {
                this.coefficients = coefficients;
              }
            }
            GenericGFPoly2.prototype.degree = function() {
              return this.coefficients.length - 1;
            };
            GenericGFPoly2.prototype.isZero = function() {
              return this.coefficients[0] === 0;
            };
            GenericGFPoly2.prototype.getCoefficient = function(degree) {
              return this.coefficients[this.coefficients.length - 1 - degree];
            };
            GenericGFPoly2.prototype.addOrSubtract = function(other) {
              var _a;
              if (this.isZero()) {
                return other;
              }
              if (other.isZero()) {
                return this;
              }
              var smallerCoefficients = this.coefficients;
              var largerCoefficients = other.coefficients;
              if (smallerCoefficients.length > largerCoefficients.length) {
                _a = [largerCoefficients, smallerCoefficients], smallerCoefficients = _a[0], largerCoefficients = _a[1];
              }
              var sumDiff = new Uint8ClampedArray(largerCoefficients.length);
              var lengthDiff = largerCoefficients.length - smallerCoefficients.length;
              for (var i = 0; i < lengthDiff; i++) {
                sumDiff[i] = largerCoefficients[i];
              }
              for (var i = lengthDiff; i < largerCoefficients.length; i++) {
                sumDiff[i] = GenericGF_1.addOrSubtractGF(smallerCoefficients[i - lengthDiff], largerCoefficients[i]);
              }
              return new GenericGFPoly2(this.field, sumDiff);
            };
            GenericGFPoly2.prototype.multiply = function(scalar) {
              if (scalar === 0) {
                return this.field.zero;
              }
              if (scalar === 1) {
                return this;
              }
              var size = this.coefficients.length;
              var product = new Uint8ClampedArray(size);
              for (var i = 0; i < size; i++) {
                product[i] = this.field.multiply(this.coefficients[i], scalar);
              }
              return new GenericGFPoly2(this.field, product);
            };
            GenericGFPoly2.prototype.multiplyPoly = function(other) {
              if (this.isZero() || other.isZero()) {
                return this.field.zero;
              }
              var aCoefficients = this.coefficients;
              var aLength = aCoefficients.length;
              var bCoefficients = other.coefficients;
              var bLength = bCoefficients.length;
              var product = new Uint8ClampedArray(aLength + bLength - 1);
              for (var i = 0; i < aLength; i++) {
                var aCoeff = aCoefficients[i];
                for (var j = 0; j < bLength; j++) {
                  product[i + j] = GenericGF_1.addOrSubtractGF(product[i + j], this.field.multiply(aCoeff, bCoefficients[j]));
                }
              }
              return new GenericGFPoly2(this.field, product);
            };
            GenericGFPoly2.prototype.multiplyByMonomial = function(degree, coefficient) {
              if (degree < 0) {
                throw new Error("Invalid degree less than 0");
              }
              if (coefficient === 0) {
                return this.field.zero;
              }
              var size = this.coefficients.length;
              var product = new Uint8ClampedArray(size + degree);
              for (var i = 0; i < size; i++) {
                product[i] = this.field.multiply(this.coefficients[i], coefficient);
              }
              return new GenericGFPoly2(this.field, product);
            };
            GenericGFPoly2.prototype.evaluateAt = function(a) {
              var result = 0;
              if (a === 0) {
                return this.getCoefficient(0);
              }
              var size = this.coefficients.length;
              if (a === 1) {
                this.coefficients.forEach(function(coefficient) {
                  result = GenericGF_1.addOrSubtractGF(result, coefficient);
                });
                return result;
              }
              result = this.coefficients[0];
              for (var i = 1; i < size; i++) {
                result = GenericGF_1.addOrSubtractGF(this.field.multiply(a, result), this.coefficients[i]);
              }
              return result;
            };
            return GenericGFPoly2;
          })()
        );
        exports2.default = GenericGFPoly;
      }),
      /* 3 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var binarizer_1 = __webpack_require__(4);
        var decoder_1 = __webpack_require__(5);
        var extractor_1 = __webpack_require__(11);
        var locator_1 = __webpack_require__(12);
        function scan(matrix) {
          var locations = locator_1.locate(matrix);
          if (!locations) {
            return null;
          }
          for (var _i = 0, locations_1 = locations; _i < locations_1.length; _i++) {
            var location_1 = locations_1[_i];
            var extracted = extractor_1.extract(matrix, location_1);
            var decoded = decoder_1.decode(extracted.matrix);
            if (decoded) {
              return {
                binaryData: decoded.bytes,
                data: decoded.text,
                chunks: decoded.chunks,
                version: decoded.version,
                location: {
                  topRightCorner: extracted.mappingFunction(location_1.dimension, 0),
                  topLeftCorner: extracted.mappingFunction(0, 0),
                  bottomRightCorner: extracted.mappingFunction(location_1.dimension, location_1.dimension),
                  bottomLeftCorner: extracted.mappingFunction(0, location_1.dimension),
                  topRightFinderPattern: location_1.topRight,
                  topLeftFinderPattern: location_1.topLeft,
                  bottomLeftFinderPattern: location_1.bottomLeft,
                  bottomRightAlignmentPattern: location_1.alignmentPattern
                }
              };
            }
          }
          return null;
        }
        var defaultOptions = {
          inversionAttempts: "attemptBoth"
        };
        function jsQR(data, width, height, providedOptions) {
          if (providedOptions === void 0) {
            providedOptions = {};
          }
          var options = defaultOptions;
          Object.keys(options || {}).forEach(function(opt) {
            options[opt] = providedOptions[opt] || options[opt];
          });
          var shouldInvert = options.inversionAttempts === "attemptBoth" || options.inversionAttempts === "invertFirst";
          var tryInvertedFirst = options.inversionAttempts === "onlyInvert" || options.inversionAttempts === "invertFirst";
          var _a = binarizer_1.binarize(data, width, height, shouldInvert), binarized = _a.binarized, inverted = _a.inverted;
          var result = scan(tryInvertedFirst ? inverted : binarized);
          if (!result && (options.inversionAttempts === "attemptBoth" || options.inversionAttempts === "invertFirst")) {
            result = scan(tryInvertedFirst ? binarized : inverted);
          }
          return result;
        }
        jsQR.default = jsQR;
        exports2.default = jsQR;
      }),
      /* 4 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var BitMatrix_1 = __webpack_require__(0);
        var REGION_SIZE = 8;
        var MIN_DYNAMIC_RANGE = 24;
        function numBetween(value, min, max) {
          return value < min ? min : value > max ? max : value;
        }
        var Matrix = (
          /** @class */
          (function() {
            function Matrix2(width, height) {
              this.width = width;
              this.data = new Uint8ClampedArray(width * height);
            }
            Matrix2.prototype.get = function(x, y) {
              return this.data[y * this.width + x];
            };
            Matrix2.prototype.set = function(x, y, value) {
              this.data[y * this.width + x] = value;
            };
            return Matrix2;
          })()
        );
        function binarize(data, width, height, returnInverted) {
          if (data.length !== width * height * 4) {
            throw new Error("Malformed data passed to binarizer.");
          }
          var greyscalePixels = new Matrix(width, height);
          for (var x = 0; x < width; x++) {
            for (var y = 0; y < height; y++) {
              var r = data[(y * width + x) * 4 + 0];
              var g = data[(y * width + x) * 4 + 1];
              var b = data[(y * width + x) * 4 + 2];
              greyscalePixels.set(x, y, 0.2126 * r + 0.7152 * g + 0.0722 * b);
            }
          }
          var horizontalRegionCount = Math.ceil(width / REGION_SIZE);
          var verticalRegionCount = Math.ceil(height / REGION_SIZE);
          var blackPoints = new Matrix(horizontalRegionCount, verticalRegionCount);
          for (var verticalRegion = 0; verticalRegion < verticalRegionCount; verticalRegion++) {
            for (var hortizontalRegion = 0; hortizontalRegion < horizontalRegionCount; hortizontalRegion++) {
              var sum2 = 0;
              var min = Infinity;
              var max = 0;
              for (var y = 0; y < REGION_SIZE; y++) {
                for (var x = 0; x < REGION_SIZE; x++) {
                  var pixelLumosity = greyscalePixels.get(hortizontalRegion * REGION_SIZE + x, verticalRegion * REGION_SIZE + y);
                  sum2 += pixelLumosity;
                  min = Math.min(min, pixelLumosity);
                  max = Math.max(max, pixelLumosity);
                }
              }
              var average = sum2 / Math.pow(REGION_SIZE, 2);
              if (max - min <= MIN_DYNAMIC_RANGE) {
                average = min / 2;
                if (verticalRegion > 0 && hortizontalRegion > 0) {
                  var averageNeighborBlackPoint = (blackPoints.get(hortizontalRegion, verticalRegion - 1) + 2 * blackPoints.get(hortizontalRegion - 1, verticalRegion) + blackPoints.get(hortizontalRegion - 1, verticalRegion - 1)) / 4;
                  if (min < averageNeighborBlackPoint) {
                    average = averageNeighborBlackPoint;
                  }
                }
              }
              blackPoints.set(hortizontalRegion, verticalRegion, average);
            }
          }
          var binarized = BitMatrix_1.BitMatrix.createEmpty(width, height);
          var inverted = null;
          if (returnInverted) {
            inverted = BitMatrix_1.BitMatrix.createEmpty(width, height);
          }
          for (var verticalRegion = 0; verticalRegion < verticalRegionCount; verticalRegion++) {
            for (var hortizontalRegion = 0; hortizontalRegion < horizontalRegionCount; hortizontalRegion++) {
              var left = numBetween(hortizontalRegion, 2, horizontalRegionCount - 3);
              var top_1 = numBetween(verticalRegion, 2, verticalRegionCount - 3);
              var sum2 = 0;
              for (var xRegion = -2; xRegion <= 2; xRegion++) {
                for (var yRegion = -2; yRegion <= 2; yRegion++) {
                  sum2 += blackPoints.get(left + xRegion, top_1 + yRegion);
                }
              }
              var threshold = sum2 / 25;
              for (var xRegion = 0; xRegion < REGION_SIZE; xRegion++) {
                for (var yRegion = 0; yRegion < REGION_SIZE; yRegion++) {
                  var x = hortizontalRegion * REGION_SIZE + xRegion;
                  var y = verticalRegion * REGION_SIZE + yRegion;
                  var lum = greyscalePixels.get(x, y);
                  binarized.set(x, y, lum <= threshold);
                  if (returnInverted) {
                    inverted.set(x, y, !(lum <= threshold));
                  }
                }
              }
            }
          }
          if (returnInverted) {
            return { binarized, inverted };
          }
          return { binarized };
        }
        exports2.binarize = binarize;
      }),
      /* 5 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var BitMatrix_1 = __webpack_require__(0);
        var decodeData_1 = __webpack_require__(6);
        var reedsolomon_1 = __webpack_require__(9);
        var version_1 = __webpack_require__(10);
        function numBitsDiffering(x, y) {
          var z = x ^ y;
          var bitCount = 0;
          while (z) {
            bitCount++;
            z &= z - 1;
          }
          return bitCount;
        }
        function pushBit(bit, byte) {
          return byte << 1 | bit;
        }
        var FORMAT_INFO_TABLE = [
          { bits: 21522, formatInfo: { errorCorrectionLevel: 1, dataMask: 0 } },
          { bits: 20773, formatInfo: { errorCorrectionLevel: 1, dataMask: 1 } },
          { bits: 24188, formatInfo: { errorCorrectionLevel: 1, dataMask: 2 } },
          { bits: 23371, formatInfo: { errorCorrectionLevel: 1, dataMask: 3 } },
          { bits: 17913, formatInfo: { errorCorrectionLevel: 1, dataMask: 4 } },
          { bits: 16590, formatInfo: { errorCorrectionLevel: 1, dataMask: 5 } },
          { bits: 20375, formatInfo: { errorCorrectionLevel: 1, dataMask: 6 } },
          { bits: 19104, formatInfo: { errorCorrectionLevel: 1, dataMask: 7 } },
          { bits: 30660, formatInfo: { errorCorrectionLevel: 0, dataMask: 0 } },
          { bits: 29427, formatInfo: { errorCorrectionLevel: 0, dataMask: 1 } },
          { bits: 32170, formatInfo: { errorCorrectionLevel: 0, dataMask: 2 } },
          { bits: 30877, formatInfo: { errorCorrectionLevel: 0, dataMask: 3 } },
          { bits: 26159, formatInfo: { errorCorrectionLevel: 0, dataMask: 4 } },
          { bits: 25368, formatInfo: { errorCorrectionLevel: 0, dataMask: 5 } },
          { bits: 27713, formatInfo: { errorCorrectionLevel: 0, dataMask: 6 } },
          { bits: 26998, formatInfo: { errorCorrectionLevel: 0, dataMask: 7 } },
          { bits: 5769, formatInfo: { errorCorrectionLevel: 3, dataMask: 0 } },
          { bits: 5054, formatInfo: { errorCorrectionLevel: 3, dataMask: 1 } },
          { bits: 7399, formatInfo: { errorCorrectionLevel: 3, dataMask: 2 } },
          { bits: 6608, formatInfo: { errorCorrectionLevel: 3, dataMask: 3 } },
          { bits: 1890, formatInfo: { errorCorrectionLevel: 3, dataMask: 4 } },
          { bits: 597, formatInfo: { errorCorrectionLevel: 3, dataMask: 5 } },
          { bits: 3340, formatInfo: { errorCorrectionLevel: 3, dataMask: 6 } },
          { bits: 2107, formatInfo: { errorCorrectionLevel: 3, dataMask: 7 } },
          { bits: 13663, formatInfo: { errorCorrectionLevel: 2, dataMask: 0 } },
          { bits: 12392, formatInfo: { errorCorrectionLevel: 2, dataMask: 1 } },
          { bits: 16177, formatInfo: { errorCorrectionLevel: 2, dataMask: 2 } },
          { bits: 14854, formatInfo: { errorCorrectionLevel: 2, dataMask: 3 } },
          { bits: 9396, formatInfo: { errorCorrectionLevel: 2, dataMask: 4 } },
          { bits: 8579, formatInfo: { errorCorrectionLevel: 2, dataMask: 5 } },
          { bits: 11994, formatInfo: { errorCorrectionLevel: 2, dataMask: 6 } },
          { bits: 11245, formatInfo: { errorCorrectionLevel: 2, dataMask: 7 } }
        ];
        var DATA_MASKS = [
          function(p) {
            return (p.y + p.x) % 2 === 0;
          },
          function(p) {
            return p.y % 2 === 0;
          },
          function(p) {
            return p.x % 3 === 0;
          },
          function(p) {
            return (p.y + p.x) % 3 === 0;
          },
          function(p) {
            return (Math.floor(p.y / 2) + Math.floor(p.x / 3)) % 2 === 0;
          },
          function(p) {
            return p.x * p.y % 2 + p.x * p.y % 3 === 0;
          },
          function(p) {
            return (p.y * p.x % 2 + p.y * p.x % 3) % 2 === 0;
          },
          function(p) {
            return ((p.y + p.x) % 2 + p.y * p.x % 3) % 2 === 0;
          }
        ];
        function buildFunctionPatternMask(version) {
          var dimension = 17 + 4 * version.versionNumber;
          var matrix = BitMatrix_1.BitMatrix.createEmpty(dimension, dimension);
          matrix.setRegion(0, 0, 9, 9, true);
          matrix.setRegion(dimension - 8, 0, 8, 9, true);
          matrix.setRegion(0, dimension - 8, 9, 8, true);
          for (var _i = 0, _a = version.alignmentPatternCenters; _i < _a.length; _i++) {
            var x = _a[_i];
            for (var _b = 0, _c = version.alignmentPatternCenters; _b < _c.length; _b++) {
              var y = _c[_b];
              if (!(x === 6 && y === 6 || x === 6 && y === dimension - 7 || x === dimension - 7 && y === 6)) {
                matrix.setRegion(x - 2, y - 2, 5, 5, true);
              }
            }
          }
          matrix.setRegion(6, 9, 1, dimension - 17, true);
          matrix.setRegion(9, 6, dimension - 17, 1, true);
          if (version.versionNumber > 6) {
            matrix.setRegion(dimension - 11, 0, 3, 6, true);
            matrix.setRegion(0, dimension - 11, 6, 3, true);
          }
          return matrix;
        }
        function readCodewords(matrix, version, formatInfo) {
          var dataMask = DATA_MASKS[formatInfo.dataMask];
          var dimension = matrix.height;
          var functionPatternMask = buildFunctionPatternMask(version);
          var codewords = [];
          var currentByte = 0;
          var bitsRead = 0;
          var readingUp = true;
          for (var columnIndex = dimension - 1; columnIndex > 0; columnIndex -= 2) {
            if (columnIndex === 6) {
              columnIndex--;
            }
            for (var i = 0; i < dimension; i++) {
              var y = readingUp ? dimension - 1 - i : i;
              for (var columnOffset = 0; columnOffset < 2; columnOffset++) {
                var x = columnIndex - columnOffset;
                if (!functionPatternMask.get(x, y)) {
                  bitsRead++;
                  var bit = matrix.get(x, y);
                  if (dataMask({ y, x })) {
                    bit = !bit;
                  }
                  currentByte = pushBit(bit, currentByte);
                  if (bitsRead === 8) {
                    codewords.push(currentByte);
                    bitsRead = 0;
                    currentByte = 0;
                  }
                }
              }
            }
            readingUp = !readingUp;
          }
          return codewords;
        }
        function readVersion(matrix) {
          var dimension = matrix.height;
          var provisionalVersion = Math.floor((dimension - 17) / 4);
          if (provisionalVersion <= 6) {
            return version_1.VERSIONS[provisionalVersion - 1];
          }
          var topRightVersionBits = 0;
          for (var y = 5; y >= 0; y--) {
            for (var x = dimension - 9; x >= dimension - 11; x--) {
              topRightVersionBits = pushBit(matrix.get(x, y), topRightVersionBits);
            }
          }
          var bottomLeftVersionBits = 0;
          for (var x = 5; x >= 0; x--) {
            for (var y = dimension - 9; y >= dimension - 11; y--) {
              bottomLeftVersionBits = pushBit(matrix.get(x, y), bottomLeftVersionBits);
            }
          }
          var bestDifference = Infinity;
          var bestVersion;
          for (var _i = 0, VERSIONS_1 = version_1.VERSIONS; _i < VERSIONS_1.length; _i++) {
            var version = VERSIONS_1[_i];
            if (version.infoBits === topRightVersionBits || version.infoBits === bottomLeftVersionBits) {
              return version;
            }
            var difference = numBitsDiffering(topRightVersionBits, version.infoBits);
            if (difference < bestDifference) {
              bestVersion = version;
              bestDifference = difference;
            }
            difference = numBitsDiffering(bottomLeftVersionBits, version.infoBits);
            if (difference < bestDifference) {
              bestVersion = version;
              bestDifference = difference;
            }
          }
          if (bestDifference <= 3) {
            return bestVersion;
          }
        }
        function readFormatInformation(matrix) {
          var topLeftFormatInfoBits = 0;
          for (var x = 0; x <= 8; x++) {
            if (x !== 6) {
              topLeftFormatInfoBits = pushBit(matrix.get(x, 8), topLeftFormatInfoBits);
            }
          }
          for (var y = 7; y >= 0; y--) {
            if (y !== 6) {
              topLeftFormatInfoBits = pushBit(matrix.get(8, y), topLeftFormatInfoBits);
            }
          }
          var dimension = matrix.height;
          var topRightBottomRightFormatInfoBits = 0;
          for (var y = dimension - 1; y >= dimension - 7; y--) {
            topRightBottomRightFormatInfoBits = pushBit(matrix.get(8, y), topRightBottomRightFormatInfoBits);
          }
          for (var x = dimension - 8; x < dimension; x++) {
            topRightBottomRightFormatInfoBits = pushBit(matrix.get(x, 8), topRightBottomRightFormatInfoBits);
          }
          var bestDifference = Infinity;
          var bestFormatInfo = null;
          for (var _i = 0, FORMAT_INFO_TABLE_1 = FORMAT_INFO_TABLE; _i < FORMAT_INFO_TABLE_1.length; _i++) {
            var _a = FORMAT_INFO_TABLE_1[_i], bits = _a.bits, formatInfo = _a.formatInfo;
            if (bits === topLeftFormatInfoBits || bits === topRightBottomRightFormatInfoBits) {
              return formatInfo;
            }
            var difference = numBitsDiffering(topLeftFormatInfoBits, bits);
            if (difference < bestDifference) {
              bestFormatInfo = formatInfo;
              bestDifference = difference;
            }
            if (topLeftFormatInfoBits !== topRightBottomRightFormatInfoBits) {
              difference = numBitsDiffering(topRightBottomRightFormatInfoBits, bits);
              if (difference < bestDifference) {
                bestFormatInfo = formatInfo;
                bestDifference = difference;
              }
            }
          }
          if (bestDifference <= 3) {
            return bestFormatInfo;
          }
          return null;
        }
        function getDataBlocks(codewords, version, ecLevel) {
          var ecInfo = version.errorCorrectionLevels[ecLevel];
          var dataBlocks = [];
          var totalCodewords = 0;
          ecInfo.ecBlocks.forEach(function(block) {
            for (var i2 = 0; i2 < block.numBlocks; i2++) {
              dataBlocks.push({ numDataCodewords: block.dataCodewordsPerBlock, codewords: [] });
              totalCodewords += block.dataCodewordsPerBlock + ecInfo.ecCodewordsPerBlock;
            }
          });
          if (codewords.length < totalCodewords) {
            return null;
          }
          codewords = codewords.slice(0, totalCodewords);
          var shortBlockSize = ecInfo.ecBlocks[0].dataCodewordsPerBlock;
          for (var i = 0; i < shortBlockSize; i++) {
            for (var _i = 0, dataBlocks_1 = dataBlocks; _i < dataBlocks_1.length; _i++) {
              var dataBlock = dataBlocks_1[_i];
              dataBlock.codewords.push(codewords.shift());
            }
          }
          if (ecInfo.ecBlocks.length > 1) {
            var smallBlockCount = ecInfo.ecBlocks[0].numBlocks;
            var largeBlockCount = ecInfo.ecBlocks[1].numBlocks;
            for (var i = 0; i < largeBlockCount; i++) {
              dataBlocks[smallBlockCount + i].codewords.push(codewords.shift());
            }
          }
          while (codewords.length > 0) {
            for (var _a = 0, dataBlocks_2 = dataBlocks; _a < dataBlocks_2.length; _a++) {
              var dataBlock = dataBlocks_2[_a];
              dataBlock.codewords.push(codewords.shift());
            }
          }
          return dataBlocks;
        }
        function decodeMatrix(matrix) {
          var version = readVersion(matrix);
          if (!version) {
            return null;
          }
          var formatInfo = readFormatInformation(matrix);
          if (!formatInfo) {
            return null;
          }
          var codewords = readCodewords(matrix, version, formatInfo);
          var dataBlocks = getDataBlocks(codewords, version, formatInfo.errorCorrectionLevel);
          if (!dataBlocks) {
            return null;
          }
          var totalBytes = dataBlocks.reduce(function(a, b) {
            return a + b.numDataCodewords;
          }, 0);
          var resultBytes = new Uint8ClampedArray(totalBytes);
          var resultIndex = 0;
          for (var _i = 0, dataBlocks_3 = dataBlocks; _i < dataBlocks_3.length; _i++) {
            var dataBlock = dataBlocks_3[_i];
            var correctedBytes = reedsolomon_1.decode(dataBlock.codewords, dataBlock.codewords.length - dataBlock.numDataCodewords);
            if (!correctedBytes) {
              return null;
            }
            for (var i = 0; i < dataBlock.numDataCodewords; i++) {
              resultBytes[resultIndex++] = correctedBytes[i];
            }
          }
          try {
            return decodeData_1.decode(resultBytes, version.versionNumber);
          } catch (_a) {
            return null;
          }
        }
        function decode(matrix) {
          if (matrix == null) {
            return null;
          }
          var result = decodeMatrix(matrix);
          if (result) {
            return result;
          }
          for (var x = 0; x < matrix.width; x++) {
            for (var y = x + 1; y < matrix.height; y++) {
              if (matrix.get(x, y) !== matrix.get(y, x)) {
                matrix.set(x, y, !matrix.get(x, y));
                matrix.set(y, x, !matrix.get(y, x));
              }
            }
          }
          return decodeMatrix(matrix);
        }
        exports2.decode = decode;
      }),
      /* 6 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var BitStream_1 = __webpack_require__(7);
        var shiftJISTable_1 = __webpack_require__(8);
        var Mode;
        (function(Mode2) {
          Mode2["Numeric"] = "numeric";
          Mode2["Alphanumeric"] = "alphanumeric";
          Mode2["Byte"] = "byte";
          Mode2["Kanji"] = "kanji";
          Mode2["ECI"] = "eci";
        })(Mode = exports2.Mode || (exports2.Mode = {}));
        var ModeByte;
        (function(ModeByte2) {
          ModeByte2[ModeByte2["Terminator"] = 0] = "Terminator";
          ModeByte2[ModeByte2["Numeric"] = 1] = "Numeric";
          ModeByte2[ModeByte2["Alphanumeric"] = 2] = "Alphanumeric";
          ModeByte2[ModeByte2["Byte"] = 4] = "Byte";
          ModeByte2[ModeByte2["Kanji"] = 8] = "Kanji";
          ModeByte2[ModeByte2["ECI"] = 7] = "ECI";
        })(ModeByte || (ModeByte = {}));
        function decodeNumeric(stream, size) {
          var bytes = [];
          var text3 = "";
          var characterCountSize = [10, 12, 14][size];
          var length = stream.readBits(characterCountSize);
          while (length >= 3) {
            var num2 = stream.readBits(10);
            if (num2 >= 1e3) {
              throw new Error("Invalid numeric value above 999");
            }
            var a = Math.floor(num2 / 100);
            var b = Math.floor(num2 / 10) % 10;
            var c = num2 % 10;
            bytes.push(48 + a, 48 + b, 48 + c);
            text3 += a.toString() + b.toString() + c.toString();
            length -= 3;
          }
          if (length === 2) {
            var num2 = stream.readBits(7);
            if (num2 >= 100) {
              throw new Error("Invalid numeric value above 99");
            }
            var a = Math.floor(num2 / 10);
            var b = num2 % 10;
            bytes.push(48 + a, 48 + b);
            text3 += a.toString() + b.toString();
          } else if (length === 1) {
            var num2 = stream.readBits(4);
            if (num2 >= 10) {
              throw new Error("Invalid numeric value above 9");
            }
            bytes.push(48 + num2);
            text3 += num2.toString();
          }
          return { bytes, text: text3 };
        }
        var AlphanumericCharacterCodes = [
          "0",
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "A",
          "B",
          "C",
          "D",
          "E",
          "F",
          "G",
          "H",
          "I",
          "J",
          "K",
          "L",
          "M",
          "N",
          "O",
          "P",
          "Q",
          "R",
          "S",
          "T",
          "U",
          "V",
          "W",
          "X",
          "Y",
          "Z",
          " ",
          "$",
          "%",
          "*",
          "+",
          "-",
          ".",
          "/",
          ":"
        ];
        function decodeAlphanumeric(stream, size) {
          var bytes = [];
          var text3 = "";
          var characterCountSize = [9, 11, 13][size];
          var length = stream.readBits(characterCountSize);
          while (length >= 2) {
            var v = stream.readBits(11);
            var a = Math.floor(v / 45);
            var b = v % 45;
            bytes.push(AlphanumericCharacterCodes[a].charCodeAt(0), AlphanumericCharacterCodes[b].charCodeAt(0));
            text3 += AlphanumericCharacterCodes[a] + AlphanumericCharacterCodes[b];
            length -= 2;
          }
          if (length === 1) {
            var a = stream.readBits(6);
            bytes.push(AlphanumericCharacterCodes[a].charCodeAt(0));
            text3 += AlphanumericCharacterCodes[a];
          }
          return { bytes, text: text3 };
        }
        function decodeByte(stream, size) {
          var bytes = [];
          var text3 = "";
          var characterCountSize = [8, 16, 16][size];
          var length = stream.readBits(characterCountSize);
          for (var i = 0; i < length; i++) {
            var b = stream.readBits(8);
            bytes.push(b);
          }
          try {
            text3 += decodeURIComponent(bytes.map(function(b2) {
              return "%" + ("0" + b2.toString(16)).substr(-2);
            }).join(""));
          } catch (_a) {
          }
          return { bytes, text: text3 };
        }
        function decodeKanji(stream, size) {
          var bytes = [];
          var text3 = "";
          var characterCountSize = [8, 10, 12][size];
          var length = stream.readBits(characterCountSize);
          for (var i = 0; i < length; i++) {
            var k = stream.readBits(13);
            var c = Math.floor(k / 192) << 8 | k % 192;
            if (c < 7936) {
              c += 33088;
            } else {
              c += 49472;
            }
            bytes.push(c >> 8, c & 255);
            text3 += String.fromCharCode(shiftJISTable_1.shiftJISTable[c]);
          }
          return { bytes, text: text3 };
        }
        function decode(data, version) {
          var _a, _b, _c, _d;
          var stream = new BitStream_1.BitStream(data);
          var size = version <= 9 ? 0 : version <= 26 ? 1 : 2;
          var result = {
            text: "",
            bytes: [],
            chunks: [],
            version
          };
          while (stream.available() >= 4) {
            var mode = stream.readBits(4);
            if (mode === ModeByte.Terminator) {
              return result;
            } else if (mode === ModeByte.ECI) {
              if (stream.readBits(1) === 0) {
                result.chunks.push({
                  type: Mode.ECI,
                  assignmentNumber: stream.readBits(7)
                });
              } else if (stream.readBits(1) === 0) {
                result.chunks.push({
                  type: Mode.ECI,
                  assignmentNumber: stream.readBits(14)
                });
              } else if (stream.readBits(1) === 0) {
                result.chunks.push({
                  type: Mode.ECI,
                  assignmentNumber: stream.readBits(21)
                });
              } else {
                result.chunks.push({
                  type: Mode.ECI,
                  assignmentNumber: -1
                });
              }
            } else if (mode === ModeByte.Numeric) {
              var numericResult = decodeNumeric(stream, size);
              result.text += numericResult.text;
              (_a = result.bytes).push.apply(_a, numericResult.bytes);
              result.chunks.push({
                type: Mode.Numeric,
                text: numericResult.text
              });
            } else if (mode === ModeByte.Alphanumeric) {
              var alphanumericResult = decodeAlphanumeric(stream, size);
              result.text += alphanumericResult.text;
              (_b = result.bytes).push.apply(_b, alphanumericResult.bytes);
              result.chunks.push({
                type: Mode.Alphanumeric,
                text: alphanumericResult.text
              });
            } else if (mode === ModeByte.Byte) {
              var byteResult = decodeByte(stream, size);
              result.text += byteResult.text;
              (_c = result.bytes).push.apply(_c, byteResult.bytes);
              result.chunks.push({
                type: Mode.Byte,
                bytes: byteResult.bytes,
                text: byteResult.text
              });
            } else if (mode === ModeByte.Kanji) {
              var kanjiResult = decodeKanji(stream, size);
              result.text += kanjiResult.text;
              (_d = result.bytes).push.apply(_d, kanjiResult.bytes);
              result.chunks.push({
                type: Mode.Kanji,
                bytes: kanjiResult.bytes,
                text: kanjiResult.text
              });
            }
          }
          if (stream.available() === 0 || stream.readBits(stream.available()) === 0) {
            return result;
          }
        }
        exports2.decode = decode;
      }),
      /* 7 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var BitStream = (
          /** @class */
          (function() {
            function BitStream2(bytes) {
              this.byteOffset = 0;
              this.bitOffset = 0;
              this.bytes = bytes;
            }
            BitStream2.prototype.readBits = function(numBits) {
              if (numBits < 1 || numBits > 32 || numBits > this.available()) {
                throw new Error("Cannot read " + numBits.toString() + " bits");
              }
              var result = 0;
              if (this.bitOffset > 0) {
                var bitsLeft = 8 - this.bitOffset;
                var toRead = numBits < bitsLeft ? numBits : bitsLeft;
                var bitsToNotRead = bitsLeft - toRead;
                var mask = 255 >> 8 - toRead << bitsToNotRead;
                result = (this.bytes[this.byteOffset] & mask) >> bitsToNotRead;
                numBits -= toRead;
                this.bitOffset += toRead;
                if (this.bitOffset === 8) {
                  this.bitOffset = 0;
                  this.byteOffset++;
                }
              }
              if (numBits > 0) {
                while (numBits >= 8) {
                  result = result << 8 | this.bytes[this.byteOffset] & 255;
                  this.byteOffset++;
                  numBits -= 8;
                }
                if (numBits > 0) {
                  var bitsToNotRead = 8 - numBits;
                  var mask = 255 >> bitsToNotRead << bitsToNotRead;
                  result = result << numBits | (this.bytes[this.byteOffset] & mask) >> bitsToNotRead;
                  this.bitOffset += numBits;
                }
              }
              return result;
            };
            BitStream2.prototype.available = function() {
              return 8 * (this.bytes.length - this.byteOffset) - this.bitOffset;
            };
            return BitStream2;
          })()
        );
        exports2.BitStream = BitStream;
      }),
      /* 8 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        exports2.shiftJISTable = {
          32: 32,
          33: 33,
          34: 34,
          35: 35,
          36: 36,
          37: 37,
          38: 38,
          39: 39,
          40: 40,
          41: 41,
          42: 42,
          43: 43,
          44: 44,
          45: 45,
          46: 46,
          47: 47,
          48: 48,
          49: 49,
          50: 50,
          51: 51,
          52: 52,
          53: 53,
          54: 54,
          55: 55,
          56: 56,
          57: 57,
          58: 58,
          59: 59,
          60: 60,
          61: 61,
          62: 62,
          63: 63,
          64: 64,
          65: 65,
          66: 66,
          67: 67,
          68: 68,
          69: 69,
          70: 70,
          71: 71,
          72: 72,
          73: 73,
          74: 74,
          75: 75,
          76: 76,
          77: 77,
          78: 78,
          79: 79,
          80: 80,
          81: 81,
          82: 82,
          83: 83,
          84: 84,
          85: 85,
          86: 86,
          87: 87,
          88: 88,
          89: 89,
          90: 90,
          91: 91,
          92: 165,
          93: 93,
          94: 94,
          95: 95,
          96: 96,
          97: 97,
          98: 98,
          99: 99,
          100: 100,
          101: 101,
          102: 102,
          103: 103,
          104: 104,
          105: 105,
          106: 106,
          107: 107,
          108: 108,
          109: 109,
          110: 110,
          111: 111,
          112: 112,
          113: 113,
          114: 114,
          115: 115,
          116: 116,
          117: 117,
          118: 118,
          119: 119,
          120: 120,
          121: 121,
          122: 122,
          123: 123,
          124: 124,
          125: 125,
          126: 8254,
          33088: 12288,
          33089: 12289,
          33090: 12290,
          33091: 65292,
          33092: 65294,
          33093: 12539,
          33094: 65306,
          33095: 65307,
          33096: 65311,
          33097: 65281,
          33098: 12443,
          33099: 12444,
          33100: 180,
          33101: 65344,
          33102: 168,
          33103: 65342,
          33104: 65507,
          33105: 65343,
          33106: 12541,
          33107: 12542,
          33108: 12445,
          33109: 12446,
          33110: 12291,
          33111: 20189,
          33112: 12293,
          33113: 12294,
          33114: 12295,
          33115: 12540,
          33116: 8213,
          33117: 8208,
          33118: 65295,
          33119: 92,
          33120: 12316,
          33121: 8214,
          33122: 65372,
          33123: 8230,
          33124: 8229,
          33125: 8216,
          33126: 8217,
          33127: 8220,
          33128: 8221,
          33129: 65288,
          33130: 65289,
          33131: 12308,
          33132: 12309,
          33133: 65339,
          33134: 65341,
          33135: 65371,
          33136: 65373,
          33137: 12296,
          33138: 12297,
          33139: 12298,
          33140: 12299,
          33141: 12300,
          33142: 12301,
          33143: 12302,
          33144: 12303,
          33145: 12304,
          33146: 12305,
          33147: 65291,
          33148: 8722,
          33149: 177,
          33150: 215,
          33152: 247,
          33153: 65309,
          33154: 8800,
          33155: 65308,
          33156: 65310,
          33157: 8806,
          33158: 8807,
          33159: 8734,
          33160: 8756,
          33161: 9794,
          33162: 9792,
          33163: 176,
          33164: 8242,
          33165: 8243,
          33166: 8451,
          33167: 65509,
          33168: 65284,
          33169: 162,
          33170: 163,
          33171: 65285,
          33172: 65283,
          33173: 65286,
          33174: 65290,
          33175: 65312,
          33176: 167,
          33177: 9734,
          33178: 9733,
          33179: 9675,
          33180: 9679,
          33181: 9678,
          33182: 9671,
          33183: 9670,
          33184: 9633,
          33185: 9632,
          33186: 9651,
          33187: 9650,
          33188: 9661,
          33189: 9660,
          33190: 8251,
          33191: 12306,
          33192: 8594,
          33193: 8592,
          33194: 8593,
          33195: 8595,
          33196: 12307,
          33208: 8712,
          33209: 8715,
          33210: 8838,
          33211: 8839,
          33212: 8834,
          33213: 8835,
          33214: 8746,
          33215: 8745,
          33224: 8743,
          33225: 8744,
          33226: 172,
          33227: 8658,
          33228: 8660,
          33229: 8704,
          33230: 8707,
          33242: 8736,
          33243: 8869,
          33244: 8978,
          33245: 8706,
          33246: 8711,
          33247: 8801,
          33248: 8786,
          33249: 8810,
          33250: 8811,
          33251: 8730,
          33252: 8765,
          33253: 8733,
          33254: 8757,
          33255: 8747,
          33256: 8748,
          33264: 8491,
          33265: 8240,
          33266: 9839,
          33267: 9837,
          33268: 9834,
          33269: 8224,
          33270: 8225,
          33271: 182,
          33276: 9711,
          33359: 65296,
          33360: 65297,
          33361: 65298,
          33362: 65299,
          33363: 65300,
          33364: 65301,
          33365: 65302,
          33366: 65303,
          33367: 65304,
          33368: 65305,
          33376: 65313,
          33377: 65314,
          33378: 65315,
          33379: 65316,
          33380: 65317,
          33381: 65318,
          33382: 65319,
          33383: 65320,
          33384: 65321,
          33385: 65322,
          33386: 65323,
          33387: 65324,
          33388: 65325,
          33389: 65326,
          33390: 65327,
          33391: 65328,
          33392: 65329,
          33393: 65330,
          33394: 65331,
          33395: 65332,
          33396: 65333,
          33397: 65334,
          33398: 65335,
          33399: 65336,
          33400: 65337,
          33401: 65338,
          33409: 65345,
          33410: 65346,
          33411: 65347,
          33412: 65348,
          33413: 65349,
          33414: 65350,
          33415: 65351,
          33416: 65352,
          33417: 65353,
          33418: 65354,
          33419: 65355,
          33420: 65356,
          33421: 65357,
          33422: 65358,
          33423: 65359,
          33424: 65360,
          33425: 65361,
          33426: 65362,
          33427: 65363,
          33428: 65364,
          33429: 65365,
          33430: 65366,
          33431: 65367,
          33432: 65368,
          33433: 65369,
          33434: 65370,
          33439: 12353,
          33440: 12354,
          33441: 12355,
          33442: 12356,
          33443: 12357,
          33444: 12358,
          33445: 12359,
          33446: 12360,
          33447: 12361,
          33448: 12362,
          33449: 12363,
          33450: 12364,
          33451: 12365,
          33452: 12366,
          33453: 12367,
          33454: 12368,
          33455: 12369,
          33456: 12370,
          33457: 12371,
          33458: 12372,
          33459: 12373,
          33460: 12374,
          33461: 12375,
          33462: 12376,
          33463: 12377,
          33464: 12378,
          33465: 12379,
          33466: 12380,
          33467: 12381,
          33468: 12382,
          33469: 12383,
          33470: 12384,
          33471: 12385,
          33472: 12386,
          33473: 12387,
          33474: 12388,
          33475: 12389,
          33476: 12390,
          33477: 12391,
          33478: 12392,
          33479: 12393,
          33480: 12394,
          33481: 12395,
          33482: 12396,
          33483: 12397,
          33484: 12398,
          33485: 12399,
          33486: 12400,
          33487: 12401,
          33488: 12402,
          33489: 12403,
          33490: 12404,
          33491: 12405,
          33492: 12406,
          33493: 12407,
          33494: 12408,
          33495: 12409,
          33496: 12410,
          33497: 12411,
          33498: 12412,
          33499: 12413,
          33500: 12414,
          33501: 12415,
          33502: 12416,
          33503: 12417,
          33504: 12418,
          33505: 12419,
          33506: 12420,
          33507: 12421,
          33508: 12422,
          33509: 12423,
          33510: 12424,
          33511: 12425,
          33512: 12426,
          33513: 12427,
          33514: 12428,
          33515: 12429,
          33516: 12430,
          33517: 12431,
          33518: 12432,
          33519: 12433,
          33520: 12434,
          33521: 12435,
          33600: 12449,
          33601: 12450,
          33602: 12451,
          33603: 12452,
          33604: 12453,
          33605: 12454,
          33606: 12455,
          33607: 12456,
          33608: 12457,
          33609: 12458,
          33610: 12459,
          33611: 12460,
          33612: 12461,
          33613: 12462,
          33614: 12463,
          33615: 12464,
          33616: 12465,
          33617: 12466,
          33618: 12467,
          33619: 12468,
          33620: 12469,
          33621: 12470,
          33622: 12471,
          33623: 12472,
          33624: 12473,
          33625: 12474,
          33626: 12475,
          33627: 12476,
          33628: 12477,
          33629: 12478,
          33630: 12479,
          33631: 12480,
          33632: 12481,
          33633: 12482,
          33634: 12483,
          33635: 12484,
          33636: 12485,
          33637: 12486,
          33638: 12487,
          33639: 12488,
          33640: 12489,
          33641: 12490,
          33642: 12491,
          33643: 12492,
          33644: 12493,
          33645: 12494,
          33646: 12495,
          33647: 12496,
          33648: 12497,
          33649: 12498,
          33650: 12499,
          33651: 12500,
          33652: 12501,
          33653: 12502,
          33654: 12503,
          33655: 12504,
          33656: 12505,
          33657: 12506,
          33658: 12507,
          33659: 12508,
          33660: 12509,
          33661: 12510,
          33662: 12511,
          33664: 12512,
          33665: 12513,
          33666: 12514,
          33667: 12515,
          33668: 12516,
          33669: 12517,
          33670: 12518,
          33671: 12519,
          33672: 12520,
          33673: 12521,
          33674: 12522,
          33675: 12523,
          33676: 12524,
          33677: 12525,
          33678: 12526,
          33679: 12527,
          33680: 12528,
          33681: 12529,
          33682: 12530,
          33683: 12531,
          33684: 12532,
          33685: 12533,
          33686: 12534,
          33695: 913,
          33696: 914,
          33697: 915,
          33698: 916,
          33699: 917,
          33700: 918,
          33701: 919,
          33702: 920,
          33703: 921,
          33704: 922,
          33705: 923,
          33706: 924,
          33707: 925,
          33708: 926,
          33709: 927,
          33710: 928,
          33711: 929,
          33712: 931,
          33713: 932,
          33714: 933,
          33715: 934,
          33716: 935,
          33717: 936,
          33718: 937,
          33727: 945,
          33728: 946,
          33729: 947,
          33730: 948,
          33731: 949,
          33732: 950,
          33733: 951,
          33734: 952,
          33735: 953,
          33736: 954,
          33737: 955,
          33738: 956,
          33739: 957,
          33740: 958,
          33741: 959,
          33742: 960,
          33743: 961,
          33744: 963,
          33745: 964,
          33746: 965,
          33747: 966,
          33748: 967,
          33749: 968,
          33750: 969,
          33856: 1040,
          33857: 1041,
          33858: 1042,
          33859: 1043,
          33860: 1044,
          33861: 1045,
          33862: 1025,
          33863: 1046,
          33864: 1047,
          33865: 1048,
          33866: 1049,
          33867: 1050,
          33868: 1051,
          33869: 1052,
          33870: 1053,
          33871: 1054,
          33872: 1055,
          33873: 1056,
          33874: 1057,
          33875: 1058,
          33876: 1059,
          33877: 1060,
          33878: 1061,
          33879: 1062,
          33880: 1063,
          33881: 1064,
          33882: 1065,
          33883: 1066,
          33884: 1067,
          33885: 1068,
          33886: 1069,
          33887: 1070,
          33888: 1071,
          33904: 1072,
          33905: 1073,
          33906: 1074,
          33907: 1075,
          33908: 1076,
          33909: 1077,
          33910: 1105,
          33911: 1078,
          33912: 1079,
          33913: 1080,
          33914: 1081,
          33915: 1082,
          33916: 1083,
          33917: 1084,
          33918: 1085,
          33920: 1086,
          33921: 1087,
          33922: 1088,
          33923: 1089,
          33924: 1090,
          33925: 1091,
          33926: 1092,
          33927: 1093,
          33928: 1094,
          33929: 1095,
          33930: 1096,
          33931: 1097,
          33932: 1098,
          33933: 1099,
          33934: 1100,
          33935: 1101,
          33936: 1102,
          33937: 1103,
          33951: 9472,
          33952: 9474,
          33953: 9484,
          33954: 9488,
          33955: 9496,
          33956: 9492,
          33957: 9500,
          33958: 9516,
          33959: 9508,
          33960: 9524,
          33961: 9532,
          33962: 9473,
          33963: 9475,
          33964: 9487,
          33965: 9491,
          33966: 9499,
          33967: 9495,
          33968: 9507,
          33969: 9523,
          33970: 9515,
          33971: 9531,
          33972: 9547,
          33973: 9504,
          33974: 9519,
          33975: 9512,
          33976: 9527,
          33977: 9535,
          33978: 9501,
          33979: 9520,
          33980: 9509,
          33981: 9528,
          33982: 9538,
          34975: 20124,
          34976: 21782,
          34977: 23043,
          34978: 38463,
          34979: 21696,
          34980: 24859,
          34981: 25384,
          34982: 23030,
          34983: 36898,
          34984: 33909,
          34985: 33564,
          34986: 31312,
          34987: 24746,
          34988: 25569,
          34989: 28197,
          34990: 26093,
          34991: 33894,
          34992: 33446,
          34993: 39925,
          34994: 26771,
          34995: 22311,
          34996: 26017,
          34997: 25201,
          34998: 23451,
          34999: 22992,
          35e3: 34427,
          35001: 39156,
          35002: 32098,
          35003: 32190,
          35004: 39822,
          35005: 25110,
          35006: 31903,
          35007: 34999,
          35008: 23433,
          35009: 24245,
          35010: 25353,
          35011: 26263,
          35012: 26696,
          35013: 38343,
          35014: 38797,
          35015: 26447,
          35016: 20197,
          35017: 20234,
          35018: 20301,
          35019: 20381,
          35020: 20553,
          35021: 22258,
          35022: 22839,
          35023: 22996,
          35024: 23041,
          35025: 23561,
          35026: 24799,
          35027: 24847,
          35028: 24944,
          35029: 26131,
          35030: 26885,
          35031: 28858,
          35032: 30031,
          35033: 30064,
          35034: 31227,
          35035: 32173,
          35036: 32239,
          35037: 32963,
          35038: 33806,
          35039: 34915,
          35040: 35586,
          35041: 36949,
          35042: 36986,
          35043: 21307,
          35044: 20117,
          35045: 20133,
          35046: 22495,
          35047: 32946,
          35048: 37057,
          35049: 30959,
          35050: 19968,
          35051: 22769,
          35052: 28322,
          35053: 36920,
          35054: 31282,
          35055: 33576,
          35056: 33419,
          35057: 39983,
          35058: 20801,
          35059: 21360,
          35060: 21693,
          35061: 21729,
          35062: 22240,
          35063: 23035,
          35064: 24341,
          35065: 39154,
          35066: 28139,
          35067: 32996,
          35068: 34093,
          35136: 38498,
          35137: 38512,
          35138: 38560,
          35139: 38907,
          35140: 21515,
          35141: 21491,
          35142: 23431,
          35143: 28879,
          35144: 32701,
          35145: 36802,
          35146: 38632,
          35147: 21359,
          35148: 40284,
          35149: 31418,
          35150: 19985,
          35151: 30867,
          35152: 33276,
          35153: 28198,
          35154: 22040,
          35155: 21764,
          35156: 27421,
          35157: 34074,
          35158: 39995,
          35159: 23013,
          35160: 21417,
          35161: 28006,
          35162: 29916,
          35163: 38287,
          35164: 22082,
          35165: 20113,
          35166: 36939,
          35167: 38642,
          35168: 33615,
          35169: 39180,
          35170: 21473,
          35171: 21942,
          35172: 23344,
          35173: 24433,
          35174: 26144,
          35175: 26355,
          35176: 26628,
          35177: 27704,
          35178: 27891,
          35179: 27945,
          35180: 29787,
          35181: 30408,
          35182: 31310,
          35183: 38964,
          35184: 33521,
          35185: 34907,
          35186: 35424,
          35187: 37613,
          35188: 28082,
          35189: 30123,
          35190: 30410,
          35191: 39365,
          35192: 24742,
          35193: 35585,
          35194: 36234,
          35195: 38322,
          35196: 27022,
          35197: 21421,
          35198: 20870,
          35200: 22290,
          35201: 22576,
          35202: 22852,
          35203: 23476,
          35204: 24310,
          35205: 24616,
          35206: 25513,
          35207: 25588,
          35208: 27839,
          35209: 28436,
          35210: 28814,
          35211: 28948,
          35212: 29017,
          35213: 29141,
          35214: 29503,
          35215: 32257,
          35216: 33398,
          35217: 33489,
          35218: 34199,
          35219: 36960,
          35220: 37467,
          35221: 40219,
          35222: 22633,
          35223: 26044,
          35224: 27738,
          35225: 29989,
          35226: 20985,
          35227: 22830,
          35228: 22885,
          35229: 24448,
          35230: 24540,
          35231: 25276,
          35232: 26106,
          35233: 27178,
          35234: 27431,
          35235: 27572,
          35236: 29579,
          35237: 32705,
          35238: 35158,
          35239: 40236,
          35240: 40206,
          35241: 40644,
          35242: 23713,
          35243: 27798,
          35244: 33659,
          35245: 20740,
          35246: 23627,
          35247: 25014,
          35248: 33222,
          35249: 26742,
          35250: 29281,
          35251: 20057,
          35252: 20474,
          35253: 21368,
          35254: 24681,
          35255: 28201,
          35256: 31311,
          35257: 38899,
          35258: 19979,
          35259: 21270,
          35260: 20206,
          35261: 20309,
          35262: 20285,
          35263: 20385,
          35264: 20339,
          35265: 21152,
          35266: 21487,
          35267: 22025,
          35268: 22799,
          35269: 23233,
          35270: 23478,
          35271: 23521,
          35272: 31185,
          35273: 26247,
          35274: 26524,
          35275: 26550,
          35276: 27468,
          35277: 27827,
          35278: 28779,
          35279: 29634,
          35280: 31117,
          35281: 31166,
          35282: 31292,
          35283: 31623,
          35284: 33457,
          35285: 33499,
          35286: 33540,
          35287: 33655,
          35288: 33775,
          35289: 33747,
          35290: 34662,
          35291: 35506,
          35292: 22057,
          35293: 36008,
          35294: 36838,
          35295: 36942,
          35296: 38686,
          35297: 34442,
          35298: 20420,
          35299: 23784,
          35300: 25105,
          35301: 29273,
          35302: 30011,
          35303: 33253,
          35304: 33469,
          35305: 34558,
          35306: 36032,
          35307: 38597,
          35308: 39187,
          35309: 39381,
          35310: 20171,
          35311: 20250,
          35312: 35299,
          35313: 22238,
          35314: 22602,
          35315: 22730,
          35316: 24315,
          35317: 24555,
          35318: 24618,
          35319: 24724,
          35320: 24674,
          35321: 25040,
          35322: 25106,
          35323: 25296,
          35324: 25913,
          35392: 39745,
          35393: 26214,
          35394: 26800,
          35395: 28023,
          35396: 28784,
          35397: 30028,
          35398: 30342,
          35399: 32117,
          35400: 33445,
          35401: 34809,
          35402: 38283,
          35403: 38542,
          35404: 35997,
          35405: 20977,
          35406: 21182,
          35407: 22806,
          35408: 21683,
          35409: 23475,
          35410: 23830,
          35411: 24936,
          35412: 27010,
          35413: 28079,
          35414: 30861,
          35415: 33995,
          35416: 34903,
          35417: 35442,
          35418: 37799,
          35419: 39608,
          35420: 28012,
          35421: 39336,
          35422: 34521,
          35423: 22435,
          35424: 26623,
          35425: 34510,
          35426: 37390,
          35427: 21123,
          35428: 22151,
          35429: 21508,
          35430: 24275,
          35431: 25313,
          35432: 25785,
          35433: 26684,
          35434: 26680,
          35435: 27579,
          35436: 29554,
          35437: 30906,
          35438: 31339,
          35439: 35226,
          35440: 35282,
          35441: 36203,
          35442: 36611,
          35443: 37101,
          35444: 38307,
          35445: 38548,
          35446: 38761,
          35447: 23398,
          35448: 23731,
          35449: 27005,
          35450: 38989,
          35451: 38990,
          35452: 25499,
          35453: 31520,
          35454: 27179,
          35456: 27263,
          35457: 26806,
          35458: 39949,
          35459: 28511,
          35460: 21106,
          35461: 21917,
          35462: 24688,
          35463: 25324,
          35464: 27963,
          35465: 28167,
          35466: 28369,
          35467: 33883,
          35468: 35088,
          35469: 36676,
          35470: 19988,
          35471: 39993,
          35472: 21494,
          35473: 26907,
          35474: 27194,
          35475: 38788,
          35476: 26666,
          35477: 20828,
          35478: 31427,
          35479: 33970,
          35480: 37340,
          35481: 37772,
          35482: 22107,
          35483: 40232,
          35484: 26658,
          35485: 33541,
          35486: 33841,
          35487: 31909,
          35488: 21e3,
          35489: 33477,
          35490: 29926,
          35491: 20094,
          35492: 20355,
          35493: 20896,
          35494: 23506,
          35495: 21002,
          35496: 21208,
          35497: 21223,
          35498: 24059,
          35499: 21914,
          35500: 22570,
          35501: 23014,
          35502: 23436,
          35503: 23448,
          35504: 23515,
          35505: 24178,
          35506: 24185,
          35507: 24739,
          35508: 24863,
          35509: 24931,
          35510: 25022,
          35511: 25563,
          35512: 25954,
          35513: 26577,
          35514: 26707,
          35515: 26874,
          35516: 27454,
          35517: 27475,
          35518: 27735,
          35519: 28450,
          35520: 28567,
          35521: 28485,
          35522: 29872,
          35523: 29976,
          35524: 30435,
          35525: 30475,
          35526: 31487,
          35527: 31649,
          35528: 31777,
          35529: 32233,
          35530: 32566,
          35531: 32752,
          35532: 32925,
          35533: 33382,
          35534: 33694,
          35535: 35251,
          35536: 35532,
          35537: 36011,
          35538: 36996,
          35539: 37969,
          35540: 38291,
          35541: 38289,
          35542: 38306,
          35543: 38501,
          35544: 38867,
          35545: 39208,
          35546: 33304,
          35547: 20024,
          35548: 21547,
          35549: 23736,
          35550: 24012,
          35551: 29609,
          35552: 30284,
          35553: 30524,
          35554: 23721,
          35555: 32747,
          35556: 36107,
          35557: 38593,
          35558: 38929,
          35559: 38996,
          35560: 39e3,
          35561: 20225,
          35562: 20238,
          35563: 21361,
          35564: 21916,
          35565: 22120,
          35566: 22522,
          35567: 22855,
          35568: 23305,
          35569: 23492,
          35570: 23696,
          35571: 24076,
          35572: 24190,
          35573: 24524,
          35574: 25582,
          35575: 26426,
          35576: 26071,
          35577: 26082,
          35578: 26399,
          35579: 26827,
          35580: 26820,
          35648: 27231,
          35649: 24112,
          35650: 27589,
          35651: 27671,
          35652: 27773,
          35653: 30079,
          35654: 31048,
          35655: 23395,
          35656: 31232,
          35657: 32e3,
          35658: 24509,
          35659: 35215,
          35660: 35352,
          35661: 36020,
          35662: 36215,
          35663: 36556,
          35664: 36637,
          35665: 39138,
          35666: 39438,
          35667: 39740,
          35668: 20096,
          35669: 20605,
          35670: 20736,
          35671: 22931,
          35672: 23452,
          35673: 25135,
          35674: 25216,
          35675: 25836,
          35676: 27450,
          35677: 29344,
          35678: 30097,
          35679: 31047,
          35680: 32681,
          35681: 34811,
          35682: 35516,
          35683: 35696,
          35684: 25516,
          35685: 33738,
          35686: 38816,
          35687: 21513,
          35688: 21507,
          35689: 21931,
          35690: 26708,
          35691: 27224,
          35692: 35440,
          35693: 30759,
          35694: 26485,
          35695: 40653,
          35696: 21364,
          35697: 23458,
          35698: 33050,
          35699: 34384,
          35700: 36870,
          35701: 19992,
          35702: 20037,
          35703: 20167,
          35704: 20241,
          35705: 21450,
          35706: 21560,
          35707: 23470,
          35708: 24339,
          35709: 24613,
          35710: 25937,
          35712: 26429,
          35713: 27714,
          35714: 27762,
          35715: 27875,
          35716: 28792,
          35717: 29699,
          35718: 31350,
          35719: 31406,
          35720: 31496,
          35721: 32026,
          35722: 31998,
          35723: 32102,
          35724: 26087,
          35725: 29275,
          35726: 21435,
          35727: 23621,
          35728: 24040,
          35729: 25298,
          35730: 25312,
          35731: 25369,
          35732: 28192,
          35733: 34394,
          35734: 35377,
          35735: 36317,
          35736: 37624,
          35737: 28417,
          35738: 31142,
          35739: 39770,
          35740: 20136,
          35741: 20139,
          35742: 20140,
          35743: 20379,
          35744: 20384,
          35745: 20689,
          35746: 20807,
          35747: 31478,
          35748: 20849,
          35749: 20982,
          35750: 21332,
          35751: 21281,
          35752: 21375,
          35753: 21483,
          35754: 21932,
          35755: 22659,
          35756: 23777,
          35757: 24375,
          35758: 24394,
          35759: 24623,
          35760: 24656,
          35761: 24685,
          35762: 25375,
          35763: 25945,
          35764: 27211,
          35765: 27841,
          35766: 29378,
          35767: 29421,
          35768: 30703,
          35769: 33016,
          35770: 33029,
          35771: 33288,
          35772: 34126,
          35773: 37111,
          35774: 37857,
          35775: 38911,
          35776: 39255,
          35777: 39514,
          35778: 20208,
          35779: 20957,
          35780: 23597,
          35781: 26241,
          35782: 26989,
          35783: 23616,
          35784: 26354,
          35785: 26997,
          35786: 29577,
          35787: 26704,
          35788: 31873,
          35789: 20677,
          35790: 21220,
          35791: 22343,
          35792: 24062,
          35793: 37670,
          35794: 26020,
          35795: 27427,
          35796: 27453,
          35797: 29748,
          35798: 31105,
          35799: 31165,
          35800: 31563,
          35801: 32202,
          35802: 33465,
          35803: 33740,
          35804: 34943,
          35805: 35167,
          35806: 35641,
          35807: 36817,
          35808: 37329,
          35809: 21535,
          35810: 37504,
          35811: 20061,
          35812: 20534,
          35813: 21477,
          35814: 21306,
          35815: 29399,
          35816: 29590,
          35817: 30697,
          35818: 33510,
          35819: 36527,
          35820: 39366,
          35821: 39368,
          35822: 39378,
          35823: 20855,
          35824: 24858,
          35825: 34398,
          35826: 21936,
          35827: 31354,
          35828: 20598,
          35829: 23507,
          35830: 36935,
          35831: 38533,
          35832: 20018,
          35833: 27355,
          35834: 37351,
          35835: 23633,
          35836: 23624,
          35904: 25496,
          35905: 31391,
          35906: 27795,
          35907: 38772,
          35908: 36705,
          35909: 31402,
          35910: 29066,
          35911: 38536,
          35912: 31874,
          35913: 26647,
          35914: 32368,
          35915: 26705,
          35916: 37740,
          35917: 21234,
          35918: 21531,
          35919: 34219,
          35920: 35347,
          35921: 32676,
          35922: 36557,
          35923: 37089,
          35924: 21350,
          35925: 34952,
          35926: 31041,
          35927: 20418,
          35928: 20670,
          35929: 21009,
          35930: 20804,
          35931: 21843,
          35932: 22317,
          35933: 29674,
          35934: 22411,
          35935: 22865,
          35936: 24418,
          35937: 24452,
          35938: 24693,
          35939: 24950,
          35940: 24935,
          35941: 25001,
          35942: 25522,
          35943: 25658,
          35944: 25964,
          35945: 26223,
          35946: 26690,
          35947: 28179,
          35948: 30054,
          35949: 31293,
          35950: 31995,
          35951: 32076,
          35952: 32153,
          35953: 32331,
          35954: 32619,
          35955: 33550,
          35956: 33610,
          35957: 34509,
          35958: 35336,
          35959: 35427,
          35960: 35686,
          35961: 36605,
          35962: 38938,
          35963: 40335,
          35964: 33464,
          35965: 36814,
          35966: 39912,
          35968: 21127,
          35969: 25119,
          35970: 25731,
          35971: 28608,
          35972: 38553,
          35973: 26689,
          35974: 20625,
          35975: 27424,
          35976: 27770,
          35977: 28500,
          35978: 31348,
          35979: 32080,
          35980: 34880,
          35981: 35363,
          35982: 26376,
          35983: 20214,
          35984: 20537,
          35985: 20518,
          35986: 20581,
          35987: 20860,
          35988: 21048,
          35989: 21091,
          35990: 21927,
          35991: 22287,
          35992: 22533,
          35993: 23244,
          35994: 24314,
          35995: 25010,
          35996: 25080,
          35997: 25331,
          35998: 25458,
          35999: 26908,
          36e3: 27177,
          36001: 29309,
          36002: 29356,
          36003: 29486,
          36004: 30740,
          36005: 30831,
          36006: 32121,
          36007: 30476,
          36008: 32937,
          36009: 35211,
          36010: 35609,
          36011: 36066,
          36012: 36562,
          36013: 36963,
          36014: 37749,
          36015: 38522,
          36016: 38997,
          36017: 39443,
          36018: 40568,
          36019: 20803,
          36020: 21407,
          36021: 21427,
          36022: 24187,
          36023: 24358,
          36024: 28187,
          36025: 28304,
          36026: 29572,
          36027: 29694,
          36028: 32067,
          36029: 33335,
          36030: 35328,
          36031: 35578,
          36032: 38480,
          36033: 20046,
          36034: 20491,
          36035: 21476,
          36036: 21628,
          36037: 22266,
          36038: 22993,
          36039: 23396,
          36040: 24049,
          36041: 24235,
          36042: 24359,
          36043: 25144,
          36044: 25925,
          36045: 26543,
          36046: 28246,
          36047: 29392,
          36048: 31946,
          36049: 34996,
          36050: 32929,
          36051: 32993,
          36052: 33776,
          36053: 34382,
          36054: 35463,
          36055: 36328,
          36056: 37431,
          36057: 38599,
          36058: 39015,
          36059: 40723,
          36060: 20116,
          36061: 20114,
          36062: 20237,
          36063: 21320,
          36064: 21577,
          36065: 21566,
          36066: 23087,
          36067: 24460,
          36068: 24481,
          36069: 24735,
          36070: 26791,
          36071: 27278,
          36072: 29786,
          36073: 30849,
          36074: 35486,
          36075: 35492,
          36076: 35703,
          36077: 37264,
          36078: 20062,
          36079: 39881,
          36080: 20132,
          36081: 20348,
          36082: 20399,
          36083: 20505,
          36084: 20502,
          36085: 20809,
          36086: 20844,
          36087: 21151,
          36088: 21177,
          36089: 21246,
          36090: 21402,
          36091: 21475,
          36092: 21521,
          36160: 21518,
          36161: 21897,
          36162: 22353,
          36163: 22434,
          36164: 22909,
          36165: 23380,
          36166: 23389,
          36167: 23439,
          36168: 24037,
          36169: 24039,
          36170: 24055,
          36171: 24184,
          36172: 24195,
          36173: 24218,
          36174: 24247,
          36175: 24344,
          36176: 24658,
          36177: 24908,
          36178: 25239,
          36179: 25304,
          36180: 25511,
          36181: 25915,
          36182: 26114,
          36183: 26179,
          36184: 26356,
          36185: 26477,
          36186: 26657,
          36187: 26775,
          36188: 27083,
          36189: 27743,
          36190: 27946,
          36191: 28009,
          36192: 28207,
          36193: 28317,
          36194: 30002,
          36195: 30343,
          36196: 30828,
          36197: 31295,
          36198: 31968,
          36199: 32005,
          36200: 32024,
          36201: 32094,
          36202: 32177,
          36203: 32789,
          36204: 32771,
          36205: 32943,
          36206: 32945,
          36207: 33108,
          36208: 33167,
          36209: 33322,
          36210: 33618,
          36211: 34892,
          36212: 34913,
          36213: 35611,
          36214: 36002,
          36215: 36092,
          36216: 37066,
          36217: 37237,
          36218: 37489,
          36219: 30783,
          36220: 37628,
          36221: 38308,
          36222: 38477,
          36224: 38917,
          36225: 39321,
          36226: 39640,
          36227: 40251,
          36228: 21083,
          36229: 21163,
          36230: 21495,
          36231: 21512,
          36232: 22741,
          36233: 25335,
          36234: 28640,
          36235: 35946,
          36236: 36703,
          36237: 40633,
          36238: 20811,
          36239: 21051,
          36240: 21578,
          36241: 22269,
          36242: 31296,
          36243: 37239,
          36244: 40288,
          36245: 40658,
          36246: 29508,
          36247: 28425,
          36248: 33136,
          36249: 29969,
          36250: 24573,
          36251: 24794,
          36252: 39592,
          36253: 29403,
          36254: 36796,
          36255: 27492,
          36256: 38915,
          36257: 20170,
          36258: 22256,
          36259: 22372,
          36260: 22718,
          36261: 23130,
          36262: 24680,
          36263: 25031,
          36264: 26127,
          36265: 26118,
          36266: 26681,
          36267: 26801,
          36268: 28151,
          36269: 30165,
          36270: 32058,
          36271: 33390,
          36272: 39746,
          36273: 20123,
          36274: 20304,
          36275: 21449,
          36276: 21766,
          36277: 23919,
          36278: 24038,
          36279: 24046,
          36280: 26619,
          36281: 27801,
          36282: 29811,
          36283: 30722,
          36284: 35408,
          36285: 37782,
          36286: 35039,
          36287: 22352,
          36288: 24231,
          36289: 25387,
          36290: 20661,
          36291: 20652,
          36292: 20877,
          36293: 26368,
          36294: 21705,
          36295: 22622,
          36296: 22971,
          36297: 23472,
          36298: 24425,
          36299: 25165,
          36300: 25505,
          36301: 26685,
          36302: 27507,
          36303: 28168,
          36304: 28797,
          36305: 37319,
          36306: 29312,
          36307: 30741,
          36308: 30758,
          36309: 31085,
          36310: 25998,
          36311: 32048,
          36312: 33756,
          36313: 35009,
          36314: 36617,
          36315: 38555,
          36316: 21092,
          36317: 22312,
          36318: 26448,
          36319: 32618,
          36320: 36001,
          36321: 20916,
          36322: 22338,
          36323: 38442,
          36324: 22586,
          36325: 27018,
          36326: 32948,
          36327: 21682,
          36328: 23822,
          36329: 22524,
          36330: 30869,
          36331: 40442,
          36332: 20316,
          36333: 21066,
          36334: 21643,
          36335: 25662,
          36336: 26152,
          36337: 26388,
          36338: 26613,
          36339: 31364,
          36340: 31574,
          36341: 32034,
          36342: 37679,
          36343: 26716,
          36344: 39853,
          36345: 31545,
          36346: 21273,
          36347: 20874,
          36348: 21047,
          36416: 23519,
          36417: 25334,
          36418: 25774,
          36419: 25830,
          36420: 26413,
          36421: 27578,
          36422: 34217,
          36423: 38609,
          36424: 30352,
          36425: 39894,
          36426: 25420,
          36427: 37638,
          36428: 39851,
          36429: 30399,
          36430: 26194,
          36431: 19977,
          36432: 20632,
          36433: 21442,
          36434: 23665,
          36435: 24808,
          36436: 25746,
          36437: 25955,
          36438: 26719,
          36439: 29158,
          36440: 29642,
          36441: 29987,
          36442: 31639,
          36443: 32386,
          36444: 34453,
          36445: 35715,
          36446: 36059,
          36447: 37240,
          36448: 39184,
          36449: 26028,
          36450: 26283,
          36451: 27531,
          36452: 20181,
          36453: 20180,
          36454: 20282,
          36455: 20351,
          36456: 21050,
          36457: 21496,
          36458: 21490,
          36459: 21987,
          36460: 22235,
          36461: 22763,
          36462: 22987,
          36463: 22985,
          36464: 23039,
          36465: 23376,
          36466: 23629,
          36467: 24066,
          36468: 24107,
          36469: 24535,
          36470: 24605,
          36471: 25351,
          36472: 25903,
          36473: 23388,
          36474: 26031,
          36475: 26045,
          36476: 26088,
          36477: 26525,
          36478: 27490,
          36480: 27515,
          36481: 27663,
          36482: 29509,
          36483: 31049,
          36484: 31169,
          36485: 31992,
          36486: 32025,
          36487: 32043,
          36488: 32930,
          36489: 33026,
          36490: 33267,
          36491: 35222,
          36492: 35422,
          36493: 35433,
          36494: 35430,
          36495: 35468,
          36496: 35566,
          36497: 36039,
          36498: 36060,
          36499: 38604,
          36500: 39164,
          36501: 27503,
          36502: 20107,
          36503: 20284,
          36504: 20365,
          36505: 20816,
          36506: 23383,
          36507: 23546,
          36508: 24904,
          36509: 25345,
          36510: 26178,
          36511: 27425,
          36512: 28363,
          36513: 27835,
          36514: 29246,
          36515: 29885,
          36516: 30164,
          36517: 30913,
          36518: 31034,
          36519: 32780,
          36520: 32819,
          36521: 33258,
          36522: 33940,
          36523: 36766,
          36524: 27728,
          36525: 40575,
          36526: 24335,
          36527: 35672,
          36528: 40235,
          36529: 31482,
          36530: 36600,
          36531: 23437,
          36532: 38635,
          36533: 19971,
          36534: 21489,
          36535: 22519,
          36536: 22833,
          36537: 23241,
          36538: 23460,
          36539: 24713,
          36540: 28287,
          36541: 28422,
          36542: 30142,
          36543: 36074,
          36544: 23455,
          36545: 34048,
          36546: 31712,
          36547: 20594,
          36548: 26612,
          36549: 33437,
          36550: 23649,
          36551: 34122,
          36552: 32286,
          36553: 33294,
          36554: 20889,
          36555: 23556,
          36556: 25448,
          36557: 36198,
          36558: 26012,
          36559: 29038,
          36560: 31038,
          36561: 32023,
          36562: 32773,
          36563: 35613,
          36564: 36554,
          36565: 36974,
          36566: 34503,
          36567: 37034,
          36568: 20511,
          36569: 21242,
          36570: 23610,
          36571: 26451,
          36572: 28796,
          36573: 29237,
          36574: 37196,
          36575: 37320,
          36576: 37675,
          36577: 33509,
          36578: 23490,
          36579: 24369,
          36580: 24825,
          36581: 20027,
          36582: 21462,
          36583: 23432,
          36584: 25163,
          36585: 26417,
          36586: 27530,
          36587: 29417,
          36588: 29664,
          36589: 31278,
          36590: 33131,
          36591: 36259,
          36592: 37202,
          36593: 39318,
          36594: 20754,
          36595: 21463,
          36596: 21610,
          36597: 23551,
          36598: 25480,
          36599: 27193,
          36600: 32172,
          36601: 38656,
          36602: 22234,
          36603: 21454,
          36604: 21608,
          36672: 23447,
          36673: 23601,
          36674: 24030,
          36675: 20462,
          36676: 24833,
          36677: 25342,
          36678: 27954,
          36679: 31168,
          36680: 31179,
          36681: 32066,
          36682: 32333,
          36683: 32722,
          36684: 33261,
          36685: 33311,
          36686: 33936,
          36687: 34886,
          36688: 35186,
          36689: 35728,
          36690: 36468,
          36691: 36655,
          36692: 36913,
          36693: 37195,
          36694: 37228,
          36695: 38598,
          36696: 37276,
          36697: 20160,
          36698: 20303,
          36699: 20805,
          36700: 21313,
          36701: 24467,
          36702: 25102,
          36703: 26580,
          36704: 27713,
          36705: 28171,
          36706: 29539,
          36707: 32294,
          36708: 37325,
          36709: 37507,
          36710: 21460,
          36711: 22809,
          36712: 23487,
          36713: 28113,
          36714: 31069,
          36715: 32302,
          36716: 31899,
          36717: 22654,
          36718: 29087,
          36719: 20986,
          36720: 34899,
          36721: 36848,
          36722: 20426,
          36723: 23803,
          36724: 26149,
          36725: 30636,
          36726: 31459,
          36727: 33308,
          36728: 39423,
          36729: 20934,
          36730: 24490,
          36731: 26092,
          36732: 26991,
          36733: 27529,
          36734: 28147,
          36736: 28310,
          36737: 28516,
          36738: 30462,
          36739: 32020,
          36740: 24033,
          36741: 36981,
          36742: 37255,
          36743: 38918,
          36744: 20966,
          36745: 21021,
          36746: 25152,
          36747: 26257,
          36748: 26329,
          36749: 28186,
          36750: 24246,
          36751: 32210,
          36752: 32626,
          36753: 26360,
          36754: 34223,
          36755: 34295,
          36756: 35576,
          36757: 21161,
          36758: 21465,
          36759: 22899,
          36760: 24207,
          36761: 24464,
          36762: 24661,
          36763: 37604,
          36764: 38500,
          36765: 20663,
          36766: 20767,
          36767: 21213,
          36768: 21280,
          36769: 21319,
          36770: 21484,
          36771: 21736,
          36772: 21830,
          36773: 21809,
          36774: 22039,
          36775: 22888,
          36776: 22974,
          36777: 23100,
          36778: 23477,
          36779: 23558,
          36780: 23567,
          36781: 23569,
          36782: 23578,
          36783: 24196,
          36784: 24202,
          36785: 24288,
          36786: 24432,
          36787: 25215,
          36788: 25220,
          36789: 25307,
          36790: 25484,
          36791: 25463,
          36792: 26119,
          36793: 26124,
          36794: 26157,
          36795: 26230,
          36796: 26494,
          36797: 26786,
          36798: 27167,
          36799: 27189,
          36800: 27836,
          36801: 28040,
          36802: 28169,
          36803: 28248,
          36804: 28988,
          36805: 28966,
          36806: 29031,
          36807: 30151,
          36808: 30465,
          36809: 30813,
          36810: 30977,
          36811: 31077,
          36812: 31216,
          36813: 31456,
          36814: 31505,
          36815: 31911,
          36816: 32057,
          36817: 32918,
          36818: 33750,
          36819: 33931,
          36820: 34121,
          36821: 34909,
          36822: 35059,
          36823: 35359,
          36824: 35388,
          36825: 35412,
          36826: 35443,
          36827: 35937,
          36828: 36062,
          36829: 37284,
          36830: 37478,
          36831: 37758,
          36832: 37912,
          36833: 38556,
          36834: 38808,
          36835: 19978,
          36836: 19976,
          36837: 19998,
          36838: 20055,
          36839: 20887,
          36840: 21104,
          36841: 22478,
          36842: 22580,
          36843: 22732,
          36844: 23330,
          36845: 24120,
          36846: 24773,
          36847: 25854,
          36848: 26465,
          36849: 26454,
          36850: 27972,
          36851: 29366,
          36852: 30067,
          36853: 31331,
          36854: 33976,
          36855: 35698,
          36856: 37304,
          36857: 37664,
          36858: 22065,
          36859: 22516,
          36860: 39166,
          36928: 25325,
          36929: 26893,
          36930: 27542,
          36931: 29165,
          36932: 32340,
          36933: 32887,
          36934: 33394,
          36935: 35302,
          36936: 39135,
          36937: 34645,
          36938: 36785,
          36939: 23611,
          36940: 20280,
          36941: 20449,
          36942: 20405,
          36943: 21767,
          36944: 23072,
          36945: 23517,
          36946: 23529,
          36947: 24515,
          36948: 24910,
          36949: 25391,
          36950: 26032,
          36951: 26187,
          36952: 26862,
          36953: 27035,
          36954: 28024,
          36955: 28145,
          36956: 30003,
          36957: 30137,
          36958: 30495,
          36959: 31070,
          36960: 31206,
          36961: 32051,
          36962: 33251,
          36963: 33455,
          36964: 34218,
          36965: 35242,
          36966: 35386,
          36967: 36523,
          36968: 36763,
          36969: 36914,
          36970: 37341,
          36971: 38663,
          36972: 20154,
          36973: 20161,
          36974: 20995,
          36975: 22645,
          36976: 22764,
          36977: 23563,
          36978: 29978,
          36979: 23613,
          36980: 33102,
          36981: 35338,
          36982: 36805,
          36983: 38499,
          36984: 38765,
          36985: 31525,
          36986: 35535,
          36987: 38920,
          36988: 37218,
          36989: 22259,
          36990: 21416,
          36992: 36887,
          36993: 21561,
          36994: 22402,
          36995: 24101,
          36996: 25512,
          36997: 27700,
          36998: 28810,
          36999: 30561,
          37e3: 31883,
          37001: 32736,
          37002: 34928,
          37003: 36930,
          37004: 37204,
          37005: 37648,
          37006: 37656,
          37007: 38543,
          37008: 29790,
          37009: 39620,
          37010: 23815,
          37011: 23913,
          37012: 25968,
          37013: 26530,
          37014: 36264,
          37015: 38619,
          37016: 25454,
          37017: 26441,
          37018: 26905,
          37019: 33733,
          37020: 38935,
          37021: 38592,
          37022: 35070,
          37023: 28548,
          37024: 25722,
          37025: 23544,
          37026: 19990,
          37027: 28716,
          37028: 30045,
          37029: 26159,
          37030: 20932,
          37031: 21046,
          37032: 21218,
          37033: 22995,
          37034: 24449,
          37035: 24615,
          37036: 25104,
          37037: 25919,
          37038: 25972,
          37039: 26143,
          37040: 26228,
          37041: 26866,
          37042: 26646,
          37043: 27491,
          37044: 28165,
          37045: 29298,
          37046: 29983,
          37047: 30427,
          37048: 31934,
          37049: 32854,
          37050: 22768,
          37051: 35069,
          37052: 35199,
          37053: 35488,
          37054: 35475,
          37055: 35531,
          37056: 36893,
          37057: 37266,
          37058: 38738,
          37059: 38745,
          37060: 25993,
          37061: 31246,
          37062: 33030,
          37063: 38587,
          37064: 24109,
          37065: 24796,
          37066: 25114,
          37067: 26021,
          37068: 26132,
          37069: 26512,
          37070: 30707,
          37071: 31309,
          37072: 31821,
          37073: 32318,
          37074: 33034,
          37075: 36012,
          37076: 36196,
          37077: 36321,
          37078: 36447,
          37079: 30889,
          37080: 20999,
          37081: 25305,
          37082: 25509,
          37083: 25666,
          37084: 25240,
          37085: 35373,
          37086: 31363,
          37087: 31680,
          37088: 35500,
          37089: 38634,
          37090: 32118,
          37091: 33292,
          37092: 34633,
          37093: 20185,
          37094: 20808,
          37095: 21315,
          37096: 21344,
          37097: 23459,
          37098: 23554,
          37099: 23574,
          37100: 24029,
          37101: 25126,
          37102: 25159,
          37103: 25776,
          37104: 26643,
          37105: 26676,
          37106: 27849,
          37107: 27973,
          37108: 27927,
          37109: 26579,
          37110: 28508,
          37111: 29006,
          37112: 29053,
          37113: 26059,
          37114: 31359,
          37115: 31661,
          37116: 32218,
          37184: 32330,
          37185: 32680,
          37186: 33146,
          37187: 33307,
          37188: 33337,
          37189: 34214,
          37190: 35438,
          37191: 36046,
          37192: 36341,
          37193: 36984,
          37194: 36983,
          37195: 37549,
          37196: 37521,
          37197: 38275,
          37198: 39854,
          37199: 21069,
          37200: 21892,
          37201: 28472,
          37202: 28982,
          37203: 20840,
          37204: 31109,
          37205: 32341,
          37206: 33203,
          37207: 31950,
          37208: 22092,
          37209: 22609,
          37210: 23720,
          37211: 25514,
          37212: 26366,
          37213: 26365,
          37214: 26970,
          37215: 29401,
          37216: 30095,
          37217: 30094,
          37218: 30990,
          37219: 31062,
          37220: 31199,
          37221: 31895,
          37222: 32032,
          37223: 32068,
          37224: 34311,
          37225: 35380,
          37226: 38459,
          37227: 36961,
          37228: 40736,
          37229: 20711,
          37230: 21109,
          37231: 21452,
          37232: 21474,
          37233: 20489,
          37234: 21930,
          37235: 22766,
          37236: 22863,
          37237: 29245,
          37238: 23435,
          37239: 23652,
          37240: 21277,
          37241: 24803,
          37242: 24819,
          37243: 25436,
          37244: 25475,
          37245: 25407,
          37246: 25531,
          37248: 25805,
          37249: 26089,
          37250: 26361,
          37251: 24035,
          37252: 27085,
          37253: 27133,
          37254: 28437,
          37255: 29157,
          37256: 20105,
          37257: 30185,
          37258: 30456,
          37259: 31379,
          37260: 31967,
          37261: 32207,
          37262: 32156,
          37263: 32865,
          37264: 33609,
          37265: 33624,
          37266: 33900,
          37267: 33980,
          37268: 34299,
          37269: 35013,
          37270: 36208,
          37271: 36865,
          37272: 36973,
          37273: 37783,
          37274: 38684,
          37275: 39442,
          37276: 20687,
          37277: 22679,
          37278: 24974,
          37279: 33235,
          37280: 34101,
          37281: 36104,
          37282: 36896,
          37283: 20419,
          37284: 20596,
          37285: 21063,
          37286: 21363,
          37287: 24687,
          37288: 25417,
          37289: 26463,
          37290: 28204,
          37291: 36275,
          37292: 36895,
          37293: 20439,
          37294: 23646,
          37295: 36042,
          37296: 26063,
          37297: 32154,
          37298: 21330,
          37299: 34966,
          37300: 20854,
          37301: 25539,
          37302: 23384,
          37303: 23403,
          37304: 23562,
          37305: 25613,
          37306: 26449,
          37307: 36956,
          37308: 20182,
          37309: 22810,
          37310: 22826,
          37311: 27760,
          37312: 35409,
          37313: 21822,
          37314: 22549,
          37315: 22949,
          37316: 24816,
          37317: 25171,
          37318: 26561,
          37319: 33333,
          37320: 26965,
          37321: 38464,
          37322: 39364,
          37323: 39464,
          37324: 20307,
          37325: 22534,
          37326: 23550,
          37327: 32784,
          37328: 23729,
          37329: 24111,
          37330: 24453,
          37331: 24608,
          37332: 24907,
          37333: 25140,
          37334: 26367,
          37335: 27888,
          37336: 28382,
          37337: 32974,
          37338: 33151,
          37339: 33492,
          37340: 34955,
          37341: 36024,
          37342: 36864,
          37343: 36910,
          37344: 38538,
          37345: 40667,
          37346: 39899,
          37347: 20195,
          37348: 21488,
          37349: 22823,
          37350: 31532,
          37351: 37261,
          37352: 38988,
          37353: 40441,
          37354: 28381,
          37355: 28711,
          37356: 21331,
          37357: 21828,
          37358: 23429,
          37359: 25176,
          37360: 25246,
          37361: 25299,
          37362: 27810,
          37363: 28655,
          37364: 29730,
          37365: 35351,
          37366: 37944,
          37367: 28609,
          37368: 35582,
          37369: 33592,
          37370: 20967,
          37371: 34552,
          37372: 21482,
          37440: 21481,
          37441: 20294,
          37442: 36948,
          37443: 36784,
          37444: 22890,
          37445: 33073,
          37446: 24061,
          37447: 31466,
          37448: 36799,
          37449: 26842,
          37450: 35895,
          37451: 29432,
          37452: 40008,
          37453: 27197,
          37454: 35504,
          37455: 20025,
          37456: 21336,
          37457: 22022,
          37458: 22374,
          37459: 25285,
          37460: 25506,
          37461: 26086,
          37462: 27470,
          37463: 28129,
          37464: 28251,
          37465: 28845,
          37466: 30701,
          37467: 31471,
          37468: 31658,
          37469: 32187,
          37470: 32829,
          37471: 32966,
          37472: 34507,
          37473: 35477,
          37474: 37723,
          37475: 22243,
          37476: 22727,
          37477: 24382,
          37478: 26029,
          37479: 26262,
          37480: 27264,
          37481: 27573,
          37482: 30007,
          37483: 35527,
          37484: 20516,
          37485: 30693,
          37486: 22320,
          37487: 24347,
          37488: 24677,
          37489: 26234,
          37490: 27744,
          37491: 30196,
          37492: 31258,
          37493: 32622,
          37494: 33268,
          37495: 34584,
          37496: 36933,
          37497: 39347,
          37498: 31689,
          37499: 30044,
          37500: 31481,
          37501: 31569,
          37502: 33988,
          37504: 36880,
          37505: 31209,
          37506: 31378,
          37507: 33590,
          37508: 23265,
          37509: 30528,
          37510: 20013,
          37511: 20210,
          37512: 23449,
          37513: 24544,
          37514: 25277,
          37515: 26172,
          37516: 26609,
          37517: 27880,
          37518: 34411,
          37519: 34935,
          37520: 35387,
          37521: 37198,
          37522: 37619,
          37523: 39376,
          37524: 27159,
          37525: 28710,
          37526: 29482,
          37527: 33511,
          37528: 33879,
          37529: 36015,
          37530: 19969,
          37531: 20806,
          37532: 20939,
          37533: 21899,
          37534: 23541,
          37535: 24086,
          37536: 24115,
          37537: 24193,
          37538: 24340,
          37539: 24373,
          37540: 24427,
          37541: 24500,
          37542: 25074,
          37543: 25361,
          37544: 26274,
          37545: 26397,
          37546: 28526,
          37547: 29266,
          37548: 30010,
          37549: 30522,
          37550: 32884,
          37551: 33081,
          37552: 33144,
          37553: 34678,
          37554: 35519,
          37555: 35548,
          37556: 36229,
          37557: 36339,
          37558: 37530,
          37559: 38263,
          37560: 38914,
          37561: 40165,
          37562: 21189,
          37563: 25431,
          37564: 30452,
          37565: 26389,
          37566: 27784,
          37567: 29645,
          37568: 36035,
          37569: 37806,
          37570: 38515,
          37571: 27941,
          37572: 22684,
          37573: 26894,
          37574: 27084,
          37575: 36861,
          37576: 37786,
          37577: 30171,
          37578: 36890,
          37579: 22618,
          37580: 26626,
          37581: 25524,
          37582: 27131,
          37583: 20291,
          37584: 28460,
          37585: 26584,
          37586: 36795,
          37587: 34086,
          37588: 32180,
          37589: 37716,
          37590: 26943,
          37591: 28528,
          37592: 22378,
          37593: 22775,
          37594: 23340,
          37595: 32044,
          37596: 29226,
          37597: 21514,
          37598: 37347,
          37599: 40372,
          37600: 20141,
          37601: 20302,
          37602: 20572,
          37603: 20597,
          37604: 21059,
          37605: 35998,
          37606: 21576,
          37607: 22564,
          37608: 23450,
          37609: 24093,
          37610: 24213,
          37611: 24237,
          37612: 24311,
          37613: 24351,
          37614: 24716,
          37615: 25269,
          37616: 25402,
          37617: 25552,
          37618: 26799,
          37619: 27712,
          37620: 30855,
          37621: 31118,
          37622: 31243,
          37623: 32224,
          37624: 33351,
          37625: 35330,
          37626: 35558,
          37627: 36420,
          37628: 36883,
          37696: 37048,
          37697: 37165,
          37698: 37336,
          37699: 40718,
          37700: 27877,
          37701: 25688,
          37702: 25826,
          37703: 25973,
          37704: 28404,
          37705: 30340,
          37706: 31515,
          37707: 36969,
          37708: 37841,
          37709: 28346,
          37710: 21746,
          37711: 24505,
          37712: 25764,
          37713: 36685,
          37714: 36845,
          37715: 37444,
          37716: 20856,
          37717: 22635,
          37718: 22825,
          37719: 23637,
          37720: 24215,
          37721: 28155,
          37722: 32399,
          37723: 29980,
          37724: 36028,
          37725: 36578,
          37726: 39003,
          37727: 28857,
          37728: 20253,
          37729: 27583,
          37730: 28593,
          37731: 3e4,
          37732: 38651,
          37733: 20814,
          37734: 21520,
          37735: 22581,
          37736: 22615,
          37737: 22956,
          37738: 23648,
          37739: 24466,
          37740: 26007,
          37741: 26460,
          37742: 28193,
          37743: 30331,
          37744: 33759,
          37745: 36077,
          37746: 36884,
          37747: 37117,
          37748: 37709,
          37749: 30757,
          37750: 30778,
          37751: 21162,
          37752: 24230,
          37753: 22303,
          37754: 22900,
          37755: 24594,
          37756: 20498,
          37757: 20826,
          37758: 20908,
          37760: 20941,
          37761: 20992,
          37762: 21776,
          37763: 22612,
          37764: 22616,
          37765: 22871,
          37766: 23445,
          37767: 23798,
          37768: 23947,
          37769: 24764,
          37770: 25237,
          37771: 25645,
          37772: 26481,
          37773: 26691,
          37774: 26812,
          37775: 26847,
          37776: 30423,
          37777: 28120,
          37778: 28271,
          37779: 28059,
          37780: 28783,
          37781: 29128,
          37782: 24403,
          37783: 30168,
          37784: 31095,
          37785: 31561,
          37786: 31572,
          37787: 31570,
          37788: 31958,
          37789: 32113,
          37790: 21040,
          37791: 33891,
          37792: 34153,
          37793: 34276,
          37794: 35342,
          37795: 35588,
          37796: 35910,
          37797: 36367,
          37798: 36867,
          37799: 36879,
          37800: 37913,
          37801: 38518,
          37802: 38957,
          37803: 39472,
          37804: 38360,
          37805: 20685,
          37806: 21205,
          37807: 21516,
          37808: 22530,
          37809: 23566,
          37810: 24999,
          37811: 25758,
          37812: 27934,
          37813: 30643,
          37814: 31461,
          37815: 33012,
          37816: 33796,
          37817: 36947,
          37818: 37509,
          37819: 23776,
          37820: 40199,
          37821: 21311,
          37822: 24471,
          37823: 24499,
          37824: 28060,
          37825: 29305,
          37826: 30563,
          37827: 31167,
          37828: 31716,
          37829: 27602,
          37830: 29420,
          37831: 35501,
          37832: 26627,
          37833: 27233,
          37834: 20984,
          37835: 31361,
          37836: 26932,
          37837: 23626,
          37838: 40182,
          37839: 33515,
          37840: 23493,
          37841: 37193,
          37842: 28702,
          37843: 22136,
          37844: 23663,
          37845: 24775,
          37846: 25958,
          37847: 27788,
          37848: 35930,
          37849: 36929,
          37850: 38931,
          37851: 21585,
          37852: 26311,
          37853: 37389,
          37854: 22856,
          37855: 37027,
          37856: 20869,
          37857: 20045,
          37858: 20970,
          37859: 34201,
          37860: 35598,
          37861: 28760,
          37862: 25466,
          37863: 37707,
          37864: 26978,
          37865: 39348,
          37866: 32260,
          37867: 30071,
          37868: 21335,
          37869: 26976,
          37870: 36575,
          37871: 38627,
          37872: 27741,
          37873: 20108,
          37874: 23612,
          37875: 24336,
          37876: 36841,
          37877: 21250,
          37878: 36049,
          37879: 32905,
          37880: 34425,
          37881: 24319,
          37882: 26085,
          37883: 20083,
          37884: 20837,
          37952: 22914,
          37953: 23615,
          37954: 38894,
          37955: 20219,
          37956: 22922,
          37957: 24525,
          37958: 35469,
          37959: 28641,
          37960: 31152,
          37961: 31074,
          37962: 23527,
          37963: 33905,
          37964: 29483,
          37965: 29105,
          37966: 24180,
          37967: 24565,
          37968: 25467,
          37969: 25754,
          37970: 29123,
          37971: 31896,
          37972: 20035,
          37973: 24316,
          37974: 20043,
          37975: 22492,
          37976: 22178,
          37977: 24745,
          37978: 28611,
          37979: 32013,
          37980: 33021,
          37981: 33075,
          37982: 33215,
          37983: 36786,
          37984: 35223,
          37985: 34468,
          37986: 24052,
          37987: 25226,
          37988: 25773,
          37989: 35207,
          37990: 26487,
          37991: 27874,
          37992: 27966,
          37993: 29750,
          37994: 30772,
          37995: 23110,
          37996: 32629,
          37997: 33453,
          37998: 39340,
          37999: 20467,
          38e3: 24259,
          38001: 25309,
          38002: 25490,
          38003: 25943,
          38004: 26479,
          38005: 30403,
          38006: 29260,
          38007: 32972,
          38008: 32954,
          38009: 36649,
          38010: 37197,
          38011: 20493,
          38012: 22521,
          38013: 23186,
          38014: 26757,
          38016: 26995,
          38017: 29028,
          38018: 29437,
          38019: 36023,
          38020: 22770,
          38021: 36064,
          38022: 38506,
          38023: 36889,
          38024: 34687,
          38025: 31204,
          38026: 30695,
          38027: 33833,
          38028: 20271,
          38029: 21093,
          38030: 21338,
          38031: 25293,
          38032: 26575,
          38033: 27850,
          38034: 30333,
          38035: 31636,
          38036: 31893,
          38037: 33334,
          38038: 34180,
          38039: 36843,
          38040: 26333,
          38041: 28448,
          38042: 29190,
          38043: 32283,
          38044: 33707,
          38045: 39361,
          38046: 40614,
          38047: 20989,
          38048: 31665,
          38049: 30834,
          38050: 31672,
          38051: 32903,
          38052: 31560,
          38053: 27368,
          38054: 24161,
          38055: 32908,
          38056: 30033,
          38057: 30048,
          38058: 20843,
          38059: 37474,
          38060: 28300,
          38061: 30330,
          38062: 37271,
          38063: 39658,
          38064: 20240,
          38065: 32624,
          38066: 25244,
          38067: 31567,
          38068: 38309,
          38069: 40169,
          38070: 22138,
          38071: 22617,
          38072: 34532,
          38073: 38588,
          38074: 20276,
          38075: 21028,
          38076: 21322,
          38077: 21453,
          38078: 21467,
          38079: 24070,
          38080: 25644,
          38081: 26001,
          38082: 26495,
          38083: 27710,
          38084: 27726,
          38085: 29256,
          38086: 29359,
          38087: 29677,
          38088: 30036,
          38089: 32321,
          38090: 33324,
          38091: 34281,
          38092: 36009,
          38093: 31684,
          38094: 37318,
          38095: 29033,
          38096: 38930,
          38097: 39151,
          38098: 25405,
          38099: 26217,
          38100: 30058,
          38101: 30436,
          38102: 30928,
          38103: 34115,
          38104: 34542,
          38105: 21290,
          38106: 21329,
          38107: 21542,
          38108: 22915,
          38109: 24199,
          38110: 24444,
          38111: 24754,
          38112: 25161,
          38113: 25209,
          38114: 25259,
          38115: 26e3,
          38116: 27604,
          38117: 27852,
          38118: 30130,
          38119: 30382,
          38120: 30865,
          38121: 31192,
          38122: 32203,
          38123: 32631,
          38124: 32933,
          38125: 34987,
          38126: 35513,
          38127: 36027,
          38128: 36991,
          38129: 38750,
          38130: 39131,
          38131: 27147,
          38132: 31800,
          38133: 20633,
          38134: 23614,
          38135: 24494,
          38136: 26503,
          38137: 27608,
          38138: 29749,
          38139: 30473,
          38140: 32654,
          38208: 40763,
          38209: 26570,
          38210: 31255,
          38211: 21305,
          38212: 30091,
          38213: 39661,
          38214: 24422,
          38215: 33181,
          38216: 33777,
          38217: 32920,
          38218: 24380,
          38219: 24517,
          38220: 30050,
          38221: 31558,
          38222: 36924,
          38223: 26727,
          38224: 23019,
          38225: 23195,
          38226: 32016,
          38227: 30334,
          38228: 35628,
          38229: 20469,
          38230: 24426,
          38231: 27161,
          38232: 27703,
          38233: 28418,
          38234: 29922,
          38235: 31080,
          38236: 34920,
          38237: 35413,
          38238: 35961,
          38239: 24287,
          38240: 25551,
          38241: 30149,
          38242: 31186,
          38243: 33495,
          38244: 37672,
          38245: 37618,
          38246: 33948,
          38247: 34541,
          38248: 39981,
          38249: 21697,
          38250: 24428,
          38251: 25996,
          38252: 27996,
          38253: 28693,
          38254: 36007,
          38255: 36051,
          38256: 38971,
          38257: 25935,
          38258: 29942,
          38259: 19981,
          38260: 20184,
          38261: 22496,
          38262: 22827,
          38263: 23142,
          38264: 23500,
          38265: 20904,
          38266: 24067,
          38267: 24220,
          38268: 24598,
          38269: 25206,
          38270: 25975,
          38272: 26023,
          38273: 26222,
          38274: 28014,
          38275: 29238,
          38276: 31526,
          38277: 33104,
          38278: 33178,
          38279: 33433,
          38280: 35676,
          38281: 36e3,
          38282: 36070,
          38283: 36212,
          38284: 38428,
          38285: 38468,
          38286: 20398,
          38287: 25771,
          38288: 27494,
          38289: 33310,
          38290: 33889,
          38291: 34154,
          38292: 37096,
          38293: 23553,
          38294: 26963,
          38295: 39080,
          38296: 33914,
          38297: 34135,
          38298: 20239,
          38299: 21103,
          38300: 24489,
          38301: 24133,
          38302: 26381,
          38303: 31119,
          38304: 33145,
          38305: 35079,
          38306: 35206,
          38307: 28149,
          38308: 24343,
          38309: 25173,
          38310: 27832,
          38311: 20175,
          38312: 29289,
          38313: 39826,
          38314: 20998,
          38315: 21563,
          38316: 22132,
          38317: 22707,
          38318: 24996,
          38319: 25198,
          38320: 28954,
          38321: 22894,
          38322: 31881,
          38323: 31966,
          38324: 32027,
          38325: 38640,
          38326: 25991,
          38327: 32862,
          38328: 19993,
          38329: 20341,
          38330: 20853,
          38331: 22592,
          38332: 24163,
          38333: 24179,
          38334: 24330,
          38335: 26564,
          38336: 20006,
          38337: 34109,
          38338: 38281,
          38339: 38491,
          38340: 31859,
          38341: 38913,
          38342: 20731,
          38343: 22721,
          38344: 30294,
          38345: 30887,
          38346: 21029,
          38347: 30629,
          38348: 34065,
          38349: 31622,
          38350: 20559,
          38351: 22793,
          38352: 29255,
          38353: 31687,
          38354: 32232,
          38355: 36794,
          38356: 36820,
          38357: 36941,
          38358: 20415,
          38359: 21193,
          38360: 23081,
          38361: 24321,
          38362: 38829,
          38363: 20445,
          38364: 33303,
          38365: 37610,
          38366: 22275,
          38367: 25429,
          38368: 27497,
          38369: 29995,
          38370: 35036,
          38371: 36628,
          38372: 31298,
          38373: 21215,
          38374: 22675,
          38375: 24917,
          38376: 25098,
          38377: 26286,
          38378: 27597,
          38379: 31807,
          38380: 33769,
          38381: 20515,
          38382: 20472,
          38383: 21253,
          38384: 21574,
          38385: 22577,
          38386: 22857,
          38387: 23453,
          38388: 23792,
          38389: 23791,
          38390: 23849,
          38391: 24214,
          38392: 25265,
          38393: 25447,
          38394: 25918,
          38395: 26041,
          38396: 26379,
          38464: 27861,
          38465: 27873,
          38466: 28921,
          38467: 30770,
          38468: 32299,
          38469: 32990,
          38470: 33459,
          38471: 33804,
          38472: 34028,
          38473: 34562,
          38474: 35090,
          38475: 35370,
          38476: 35914,
          38477: 37030,
          38478: 37586,
          38479: 39165,
          38480: 40179,
          38481: 40300,
          38482: 20047,
          38483: 20129,
          38484: 20621,
          38485: 21078,
          38486: 22346,
          38487: 22952,
          38488: 24125,
          38489: 24536,
          38490: 24537,
          38491: 25151,
          38492: 26292,
          38493: 26395,
          38494: 26576,
          38495: 26834,
          38496: 20882,
          38497: 32033,
          38498: 32938,
          38499: 33192,
          38500: 35584,
          38501: 35980,
          38502: 36031,
          38503: 37502,
          38504: 38450,
          38505: 21536,
          38506: 38956,
          38507: 21271,
          38508: 20693,
          38509: 21340,
          38510: 22696,
          38511: 25778,
          38512: 26420,
          38513: 29287,
          38514: 30566,
          38515: 31302,
          38516: 37350,
          38517: 21187,
          38518: 27809,
          38519: 27526,
          38520: 22528,
          38521: 24140,
          38522: 22868,
          38523: 26412,
          38524: 32763,
          38525: 20961,
          38526: 30406,
          38528: 25705,
          38529: 30952,
          38530: 39764,
          38531: 40635,
          38532: 22475,
          38533: 22969,
          38534: 26151,
          38535: 26522,
          38536: 27598,
          38537: 21737,
          38538: 27097,
          38539: 24149,
          38540: 33180,
          38541: 26517,
          38542: 39850,
          38543: 26622,
          38544: 40018,
          38545: 26717,
          38546: 20134,
          38547: 20451,
          38548: 21448,
          38549: 25273,
          38550: 26411,
          38551: 27819,
          38552: 36804,
          38553: 20397,
          38554: 32365,
          38555: 40639,
          38556: 19975,
          38557: 24930,
          38558: 28288,
          38559: 28459,
          38560: 34067,
          38561: 21619,
          38562: 26410,
          38563: 39749,
          38564: 24051,
          38565: 31637,
          38566: 23724,
          38567: 23494,
          38568: 34588,
          38569: 28234,
          38570: 34001,
          38571: 31252,
          38572: 33032,
          38573: 22937,
          38574: 31885,
          38575: 27665,
          38576: 30496,
          38577: 21209,
          38578: 22818,
          38579: 28961,
          38580: 29279,
          38581: 30683,
          38582: 38695,
          38583: 40289,
          38584: 26891,
          38585: 23167,
          38586: 23064,
          38587: 20901,
          38588: 21517,
          38589: 21629,
          38590: 26126,
          38591: 30431,
          38592: 36855,
          38593: 37528,
          38594: 40180,
          38595: 23018,
          38596: 29277,
          38597: 28357,
          38598: 20813,
          38599: 26825,
          38600: 32191,
          38601: 32236,
          38602: 38754,
          38603: 40634,
          38604: 25720,
          38605: 27169,
          38606: 33538,
          38607: 22916,
          38608: 23391,
          38609: 27611,
          38610: 29467,
          38611: 30450,
          38612: 32178,
          38613: 32791,
          38614: 33945,
          38615: 20786,
          38616: 26408,
          38617: 40665,
          38618: 30446,
          38619: 26466,
          38620: 21247,
          38621: 39173,
          38622: 23588,
          38623: 25147,
          38624: 31870,
          38625: 36016,
          38626: 21839,
          38627: 24758,
          38628: 32011,
          38629: 38272,
          38630: 21249,
          38631: 20063,
          38632: 20918,
          38633: 22812,
          38634: 29242,
          38635: 32822,
          38636: 37326,
          38637: 24357,
          38638: 30690,
          38639: 21380,
          38640: 24441,
          38641: 32004,
          38642: 34220,
          38643: 35379,
          38644: 36493,
          38645: 38742,
          38646: 26611,
          38647: 34222,
          38648: 37971,
          38649: 24841,
          38650: 24840,
          38651: 27833,
          38652: 30290,
          38720: 35565,
          38721: 36664,
          38722: 21807,
          38723: 20305,
          38724: 20778,
          38725: 21191,
          38726: 21451,
          38727: 23461,
          38728: 24189,
          38729: 24736,
          38730: 24962,
          38731: 25558,
          38732: 26377,
          38733: 26586,
          38734: 28263,
          38735: 28044,
          38736: 29494,
          38737: 29495,
          38738: 30001,
          38739: 31056,
          38740: 35029,
          38741: 35480,
          38742: 36938,
          38743: 37009,
          38744: 37109,
          38745: 38596,
          38746: 34701,
          38747: 22805,
          38748: 20104,
          38749: 20313,
          38750: 19982,
          38751: 35465,
          38752: 36671,
          38753: 38928,
          38754: 20653,
          38755: 24188,
          38756: 22934,
          38757: 23481,
          38758: 24248,
          38759: 25562,
          38760: 25594,
          38761: 25793,
          38762: 26332,
          38763: 26954,
          38764: 27096,
          38765: 27915,
          38766: 28342,
          38767: 29076,
          38768: 29992,
          38769: 31407,
          38770: 32650,
          38771: 32768,
          38772: 33865,
          38773: 33993,
          38774: 35201,
          38775: 35617,
          38776: 36362,
          38777: 36965,
          38778: 38525,
          38779: 39178,
          38780: 24958,
          38781: 25233,
          38782: 27442,
          38784: 27779,
          38785: 28020,
          38786: 32716,
          38787: 32764,
          38788: 28096,
          38789: 32645,
          38790: 34746,
          38791: 35064,
          38792: 26469,
          38793: 33713,
          38794: 38972,
          38795: 38647,
          38796: 27931,
          38797: 32097,
          38798: 33853,
          38799: 37226,
          38800: 20081,
          38801: 21365,
          38802: 23888,
          38803: 27396,
          38804: 28651,
          38805: 34253,
          38806: 34349,
          38807: 35239,
          38808: 21033,
          38809: 21519,
          38810: 23653,
          38811: 26446,
          38812: 26792,
          38813: 29702,
          38814: 29827,
          38815: 30178,
          38816: 35023,
          38817: 35041,
          38818: 37324,
          38819: 38626,
          38820: 38520,
          38821: 24459,
          38822: 29575,
          38823: 31435,
          38824: 33870,
          38825: 25504,
          38826: 30053,
          38827: 21129,
          38828: 27969,
          38829: 28316,
          38830: 29705,
          38831: 30041,
          38832: 30827,
          38833: 31890,
          38834: 38534,
          38835: 31452,
          38836: 40845,
          38837: 20406,
          38838: 24942,
          38839: 26053,
          38840: 34396,
          38841: 20102,
          38842: 20142,
          38843: 20698,
          38844: 20001,
          38845: 20940,
          38846: 23534,
          38847: 26009,
          38848: 26753,
          38849: 28092,
          38850: 29471,
          38851: 30274,
          38852: 30637,
          38853: 31260,
          38854: 31975,
          38855: 33391,
          38856: 35538,
          38857: 36988,
          38858: 37327,
          38859: 38517,
          38860: 38936,
          38861: 21147,
          38862: 32209,
          38863: 20523,
          38864: 21400,
          38865: 26519,
          38866: 28107,
          38867: 29136,
          38868: 29747,
          38869: 33256,
          38870: 36650,
          38871: 38563,
          38872: 40023,
          38873: 40607,
          38874: 29792,
          38875: 22593,
          38876: 28057,
          38877: 32047,
          38878: 39006,
          38879: 20196,
          38880: 20278,
          38881: 20363,
          38882: 20919,
          38883: 21169,
          38884: 23994,
          38885: 24604,
          38886: 29618,
          38887: 31036,
          38888: 33491,
          38889: 37428,
          38890: 38583,
          38891: 38646,
          38892: 38666,
          38893: 40599,
          38894: 40802,
          38895: 26278,
          38896: 27508,
          38897: 21015,
          38898: 21155,
          38899: 28872,
          38900: 35010,
          38901: 24265,
          38902: 24651,
          38903: 24976,
          38904: 28451,
          38905: 29001,
          38906: 31806,
          38907: 32244,
          38908: 32879,
          38976: 34030,
          38977: 36899,
          38978: 37676,
          38979: 21570,
          38980: 39791,
          38981: 27347,
          38982: 28809,
          38983: 36034,
          38984: 36335,
          38985: 38706,
          38986: 21172,
          38987: 23105,
          38988: 24266,
          38989: 24324,
          38990: 26391,
          38991: 27004,
          38992: 27028,
          38993: 28010,
          38994: 28431,
          38995: 29282,
          38996: 29436,
          38997: 31725,
          38998: 32769,
          38999: 32894,
          39e3: 34635,
          39001: 37070,
          39002: 20845,
          39003: 40595,
          39004: 31108,
          39005: 32907,
          39006: 37682,
          39007: 35542,
          39008: 20525,
          39009: 21644,
          39010: 35441,
          39011: 27498,
          39012: 36036,
          39013: 33031,
          39014: 24785,
          39015: 26528,
          39016: 40434,
          39017: 20121,
          39018: 20120,
          39019: 39952,
          39020: 35435,
          39021: 34241,
          39022: 34152,
          39023: 26880,
          39024: 28286,
          39025: 30871,
          39026: 33109,
          39071: 24332,
          39072: 19984,
          39073: 19989,
          39074: 20010,
          39075: 20017,
          39076: 20022,
          39077: 20028,
          39078: 20031,
          39079: 20034,
          39080: 20054,
          39081: 20056,
          39082: 20098,
          39083: 20101,
          39084: 35947,
          39085: 20106,
          39086: 33298,
          39087: 24333,
          39088: 20110,
          39089: 20126,
          39090: 20127,
          39091: 20128,
          39092: 20130,
          39093: 20144,
          39094: 20147,
          39095: 20150,
          39096: 20174,
          39097: 20173,
          39098: 20164,
          39099: 20166,
          39100: 20162,
          39101: 20183,
          39102: 20190,
          39103: 20205,
          39104: 20191,
          39105: 20215,
          39106: 20233,
          39107: 20314,
          39108: 20272,
          39109: 20315,
          39110: 20317,
          39111: 20311,
          39112: 20295,
          39113: 20342,
          39114: 20360,
          39115: 20367,
          39116: 20376,
          39117: 20347,
          39118: 20329,
          39119: 20336,
          39120: 20369,
          39121: 20335,
          39122: 20358,
          39123: 20374,
          39124: 20760,
          39125: 20436,
          39126: 20447,
          39127: 20430,
          39128: 20440,
          39129: 20443,
          39130: 20433,
          39131: 20442,
          39132: 20432,
          39133: 20452,
          39134: 20453,
          39135: 20506,
          39136: 20520,
          39137: 20500,
          39138: 20522,
          39139: 20517,
          39140: 20485,
          39141: 20252,
          39142: 20470,
          39143: 20513,
          39144: 20521,
          39145: 20524,
          39146: 20478,
          39147: 20463,
          39148: 20497,
          39149: 20486,
          39150: 20547,
          39151: 20551,
          39152: 26371,
          39153: 20565,
          39154: 20560,
          39155: 20552,
          39156: 20570,
          39157: 20566,
          39158: 20588,
          39159: 20600,
          39160: 20608,
          39161: 20634,
          39162: 20613,
          39163: 20660,
          39164: 20658,
          39232: 20681,
          39233: 20682,
          39234: 20659,
          39235: 20674,
          39236: 20694,
          39237: 20702,
          39238: 20709,
          39239: 20717,
          39240: 20707,
          39241: 20718,
          39242: 20729,
          39243: 20725,
          39244: 20745,
          39245: 20737,
          39246: 20738,
          39247: 20758,
          39248: 20757,
          39249: 20756,
          39250: 20762,
          39251: 20769,
          39252: 20794,
          39253: 20791,
          39254: 20796,
          39255: 20795,
          39256: 20799,
          39257: 20800,
          39258: 20818,
          39259: 20812,
          39260: 20820,
          39261: 20834,
          39262: 31480,
          39263: 20841,
          39264: 20842,
          39265: 20846,
          39266: 20864,
          39267: 20866,
          39268: 22232,
          39269: 20876,
          39270: 20873,
          39271: 20879,
          39272: 20881,
          39273: 20883,
          39274: 20885,
          39275: 20886,
          39276: 20900,
          39277: 20902,
          39278: 20898,
          39279: 20905,
          39280: 20906,
          39281: 20907,
          39282: 20915,
          39283: 20913,
          39284: 20914,
          39285: 20912,
          39286: 20917,
          39287: 20925,
          39288: 20933,
          39289: 20937,
          39290: 20955,
          39291: 20960,
          39292: 34389,
          39293: 20969,
          39294: 20973,
          39296: 20976,
          39297: 20981,
          39298: 20990,
          39299: 20996,
          39300: 21003,
          39301: 21012,
          39302: 21006,
          39303: 21031,
          39304: 21034,
          39305: 21038,
          39306: 21043,
          39307: 21049,
          39308: 21071,
          39309: 21060,
          39310: 21067,
          39311: 21068,
          39312: 21086,
          39313: 21076,
          39314: 21098,
          39315: 21108,
          39316: 21097,
          39317: 21107,
          39318: 21119,
          39319: 21117,
          39320: 21133,
          39321: 21140,
          39322: 21138,
          39323: 21105,
          39324: 21128,
          39325: 21137,
          39326: 36776,
          39327: 36775,
          39328: 21164,
          39329: 21165,
          39330: 21180,
          39331: 21173,
          39332: 21185,
          39333: 21197,
          39334: 21207,
          39335: 21214,
          39336: 21219,
          39337: 21222,
          39338: 39149,
          39339: 21216,
          39340: 21235,
          39341: 21237,
          39342: 21240,
          39343: 21241,
          39344: 21254,
          39345: 21256,
          39346: 30008,
          39347: 21261,
          39348: 21264,
          39349: 21263,
          39350: 21269,
          39351: 21274,
          39352: 21283,
          39353: 21295,
          39354: 21297,
          39355: 21299,
          39356: 21304,
          39357: 21312,
          39358: 21318,
          39359: 21317,
          39360: 19991,
          39361: 21321,
          39362: 21325,
          39363: 20950,
          39364: 21342,
          39365: 21353,
          39366: 21358,
          39367: 22808,
          39368: 21371,
          39369: 21367,
          39370: 21378,
          39371: 21398,
          39372: 21408,
          39373: 21414,
          39374: 21413,
          39375: 21422,
          39376: 21424,
          39377: 21430,
          39378: 21443,
          39379: 31762,
          39380: 38617,
          39381: 21471,
          39382: 26364,
          39383: 29166,
          39384: 21486,
          39385: 21480,
          39386: 21485,
          39387: 21498,
          39388: 21505,
          39389: 21565,
          39390: 21568,
          39391: 21548,
          39392: 21549,
          39393: 21564,
          39394: 21550,
          39395: 21558,
          39396: 21545,
          39397: 21533,
          39398: 21582,
          39399: 21647,
          39400: 21621,
          39401: 21646,
          39402: 21599,
          39403: 21617,
          39404: 21623,
          39405: 21616,
          39406: 21650,
          39407: 21627,
          39408: 21632,
          39409: 21622,
          39410: 21636,
          39411: 21648,
          39412: 21638,
          39413: 21703,
          39414: 21666,
          39415: 21688,
          39416: 21669,
          39417: 21676,
          39418: 21700,
          39419: 21704,
          39420: 21672,
          39488: 21675,
          39489: 21698,
          39490: 21668,
          39491: 21694,
          39492: 21692,
          39493: 21720,
          39494: 21733,
          39495: 21734,
          39496: 21775,
          39497: 21780,
          39498: 21757,
          39499: 21742,
          39500: 21741,
          39501: 21754,
          39502: 21730,
          39503: 21817,
          39504: 21824,
          39505: 21859,
          39506: 21836,
          39507: 21806,
          39508: 21852,
          39509: 21829,
          39510: 21846,
          39511: 21847,
          39512: 21816,
          39513: 21811,
          39514: 21853,
          39515: 21913,
          39516: 21888,
          39517: 21679,
          39518: 21898,
          39519: 21919,
          39520: 21883,
          39521: 21886,
          39522: 21912,
          39523: 21918,
          39524: 21934,
          39525: 21884,
          39526: 21891,
          39527: 21929,
          39528: 21895,
          39529: 21928,
          39530: 21978,
          39531: 21957,
          39532: 21983,
          39533: 21956,
          39534: 21980,
          39535: 21988,
          39536: 21972,
          39537: 22036,
          39538: 22007,
          39539: 22038,
          39540: 22014,
          39541: 22013,
          39542: 22043,
          39543: 22009,
          39544: 22094,
          39545: 22096,
          39546: 29151,
          39547: 22068,
          39548: 22070,
          39549: 22066,
          39550: 22072,
          39552: 22123,
          39553: 22116,
          39554: 22063,
          39555: 22124,
          39556: 22122,
          39557: 22150,
          39558: 22144,
          39559: 22154,
          39560: 22176,
          39561: 22164,
          39562: 22159,
          39563: 22181,
          39564: 22190,
          39565: 22198,
          39566: 22196,
          39567: 22210,
          39568: 22204,
          39569: 22209,
          39570: 22211,
          39571: 22208,
          39572: 22216,
          39573: 22222,
          39574: 22225,
          39575: 22227,
          39576: 22231,
          39577: 22254,
          39578: 22265,
          39579: 22272,
          39580: 22271,
          39581: 22276,
          39582: 22281,
          39583: 22280,
          39584: 22283,
          39585: 22285,
          39586: 22291,
          39587: 22296,
          39588: 22294,
          39589: 21959,
          39590: 22300,
          39591: 22310,
          39592: 22327,
          39593: 22328,
          39594: 22350,
          39595: 22331,
          39596: 22336,
          39597: 22351,
          39598: 22377,
          39599: 22464,
          39600: 22408,
          39601: 22369,
          39602: 22399,
          39603: 22409,
          39604: 22419,
          39605: 22432,
          39606: 22451,
          39607: 22436,
          39608: 22442,
          39609: 22448,
          39610: 22467,
          39611: 22470,
          39612: 22484,
          39613: 22482,
          39614: 22483,
          39615: 22538,
          39616: 22486,
          39617: 22499,
          39618: 22539,
          39619: 22553,
          39620: 22557,
          39621: 22642,
          39622: 22561,
          39623: 22626,
          39624: 22603,
          39625: 22640,
          39626: 27584,
          39627: 22610,
          39628: 22589,
          39629: 22649,
          39630: 22661,
          39631: 22713,
          39632: 22687,
          39633: 22699,
          39634: 22714,
          39635: 22750,
          39636: 22715,
          39637: 22712,
          39638: 22702,
          39639: 22725,
          39640: 22739,
          39641: 22737,
          39642: 22743,
          39643: 22745,
          39644: 22744,
          39645: 22757,
          39646: 22748,
          39647: 22756,
          39648: 22751,
          39649: 22767,
          39650: 22778,
          39651: 22777,
          39652: 22779,
          39653: 22780,
          39654: 22781,
          39655: 22786,
          39656: 22794,
          39657: 22800,
          39658: 22811,
          39659: 26790,
          39660: 22821,
          39661: 22828,
          39662: 22829,
          39663: 22834,
          39664: 22840,
          39665: 22846,
          39666: 31442,
          39667: 22869,
          39668: 22864,
          39669: 22862,
          39670: 22874,
          39671: 22872,
          39672: 22882,
          39673: 22880,
          39674: 22887,
          39675: 22892,
          39676: 22889,
          39744: 22904,
          39745: 22913,
          39746: 22941,
          39747: 20318,
          39748: 20395,
          39749: 22947,
          39750: 22962,
          39751: 22982,
          39752: 23016,
          39753: 23004,
          39754: 22925,
          39755: 23001,
          39756: 23002,
          39757: 23077,
          39758: 23071,
          39759: 23057,
          39760: 23068,
          39761: 23049,
          39762: 23066,
          39763: 23104,
          39764: 23148,
          39765: 23113,
          39766: 23093,
          39767: 23094,
          39768: 23138,
          39769: 23146,
          39770: 23194,
          39771: 23228,
          39772: 23230,
          39773: 23243,
          39774: 23234,
          39775: 23229,
          39776: 23267,
          39777: 23255,
          39778: 23270,
          39779: 23273,
          39780: 23254,
          39781: 23290,
          39782: 23291,
          39783: 23308,
          39784: 23307,
          39785: 23318,
          39786: 23346,
          39787: 23248,
          39788: 23338,
          39789: 23350,
          39790: 23358,
          39791: 23363,
          39792: 23365,
          39793: 23360,
          39794: 23377,
          39795: 23381,
          39796: 23386,
          39797: 23387,
          39798: 23397,
          39799: 23401,
          39800: 23408,
          39801: 23411,
          39802: 23413,
          39803: 23416,
          39804: 25992,
          39805: 23418,
          39806: 23424,
          39808: 23427,
          39809: 23462,
          39810: 23480,
          39811: 23491,
          39812: 23495,
          39813: 23497,
          39814: 23508,
          39815: 23504,
          39816: 23524,
          39817: 23526,
          39818: 23522,
          39819: 23518,
          39820: 23525,
          39821: 23531,
          39822: 23536,
          39823: 23542,
          39824: 23539,
          39825: 23557,
          39826: 23559,
          39827: 23560,
          39828: 23565,
          39829: 23571,
          39830: 23584,
          39831: 23586,
          39832: 23592,
          39833: 23608,
          39834: 23609,
          39835: 23617,
          39836: 23622,
          39837: 23630,
          39838: 23635,
          39839: 23632,
          39840: 23631,
          39841: 23409,
          39842: 23660,
          39843: 23662,
          39844: 20066,
          39845: 23670,
          39846: 23673,
          39847: 23692,
          39848: 23697,
          39849: 23700,
          39850: 22939,
          39851: 23723,
          39852: 23739,
          39853: 23734,
          39854: 23740,
          39855: 23735,
          39856: 23749,
          39857: 23742,
          39858: 23751,
          39859: 23769,
          39860: 23785,
          39861: 23805,
          39862: 23802,
          39863: 23789,
          39864: 23948,
          39865: 23786,
          39866: 23819,
          39867: 23829,
          39868: 23831,
          39869: 23900,
          39870: 23839,
          39871: 23835,
          39872: 23825,
          39873: 23828,
          39874: 23842,
          39875: 23834,
          39876: 23833,
          39877: 23832,
          39878: 23884,
          39879: 23890,
          39880: 23886,
          39881: 23883,
          39882: 23916,
          39883: 23923,
          39884: 23926,
          39885: 23943,
          39886: 23940,
          39887: 23938,
          39888: 23970,
          39889: 23965,
          39890: 23980,
          39891: 23982,
          39892: 23997,
          39893: 23952,
          39894: 23991,
          39895: 23996,
          39896: 24009,
          39897: 24013,
          39898: 24019,
          39899: 24018,
          39900: 24022,
          39901: 24027,
          39902: 24043,
          39903: 24050,
          39904: 24053,
          39905: 24075,
          39906: 24090,
          39907: 24089,
          39908: 24081,
          39909: 24091,
          39910: 24118,
          39911: 24119,
          39912: 24132,
          39913: 24131,
          39914: 24128,
          39915: 24142,
          39916: 24151,
          39917: 24148,
          39918: 24159,
          39919: 24162,
          39920: 24164,
          39921: 24135,
          39922: 24181,
          39923: 24182,
          39924: 24186,
          39925: 40636,
          39926: 24191,
          39927: 24224,
          39928: 24257,
          39929: 24258,
          39930: 24264,
          39931: 24272,
          39932: 24271,
          4e4: 24278,
          40001: 24291,
          40002: 24285,
          40003: 24282,
          40004: 24283,
          40005: 24290,
          40006: 24289,
          40007: 24296,
          40008: 24297,
          40009: 24300,
          40010: 24305,
          40011: 24307,
          40012: 24304,
          40013: 24308,
          40014: 24312,
          40015: 24318,
          40016: 24323,
          40017: 24329,
          40018: 24413,
          40019: 24412,
          40020: 24331,
          40021: 24337,
          40022: 24342,
          40023: 24361,
          40024: 24365,
          40025: 24376,
          40026: 24385,
          40027: 24392,
          40028: 24396,
          40029: 24398,
          40030: 24367,
          40031: 24401,
          40032: 24406,
          40033: 24407,
          40034: 24409,
          40035: 24417,
          40036: 24429,
          40037: 24435,
          40038: 24439,
          40039: 24451,
          40040: 24450,
          40041: 24447,
          40042: 24458,
          40043: 24456,
          40044: 24465,
          40045: 24455,
          40046: 24478,
          40047: 24473,
          40048: 24472,
          40049: 24480,
          40050: 24488,
          40051: 24493,
          40052: 24508,
          40053: 24534,
          40054: 24571,
          40055: 24548,
          40056: 24568,
          40057: 24561,
          40058: 24541,
          40059: 24755,
          40060: 24575,
          40061: 24609,
          40062: 24672,
          40064: 24601,
          40065: 24592,
          40066: 24617,
          40067: 24590,
          40068: 24625,
          40069: 24603,
          40070: 24597,
          40071: 24619,
          40072: 24614,
          40073: 24591,
          40074: 24634,
          40075: 24666,
          40076: 24641,
          40077: 24682,
          40078: 24695,
          40079: 24671,
          40080: 24650,
          40081: 24646,
          40082: 24653,
          40083: 24675,
          40084: 24643,
          40085: 24676,
          40086: 24642,
          40087: 24684,
          40088: 24683,
          40089: 24665,
          40090: 24705,
          40091: 24717,
          40092: 24807,
          40093: 24707,
          40094: 24730,
          40095: 24708,
          40096: 24731,
          40097: 24726,
          40098: 24727,
          40099: 24722,
          40100: 24743,
          40101: 24715,
          40102: 24801,
          40103: 24760,
          40104: 24800,
          40105: 24787,
          40106: 24756,
          40107: 24560,
          40108: 24765,
          40109: 24774,
          40110: 24757,
          40111: 24792,
          40112: 24909,
          40113: 24853,
          40114: 24838,
          40115: 24822,
          40116: 24823,
          40117: 24832,
          40118: 24820,
          40119: 24826,
          40120: 24835,
          40121: 24865,
          40122: 24827,
          40123: 24817,
          40124: 24845,
          40125: 24846,
          40126: 24903,
          40127: 24894,
          40128: 24872,
          40129: 24871,
          40130: 24906,
          40131: 24895,
          40132: 24892,
          40133: 24876,
          40134: 24884,
          40135: 24893,
          40136: 24898,
          40137: 24900,
          40138: 24947,
          40139: 24951,
          40140: 24920,
          40141: 24921,
          40142: 24922,
          40143: 24939,
          40144: 24948,
          40145: 24943,
          40146: 24933,
          40147: 24945,
          40148: 24927,
          40149: 24925,
          40150: 24915,
          40151: 24949,
          40152: 24985,
          40153: 24982,
          40154: 24967,
          40155: 25004,
          40156: 24980,
          40157: 24986,
          40158: 24970,
          40159: 24977,
          40160: 25003,
          40161: 25006,
          40162: 25036,
          40163: 25034,
          40164: 25033,
          40165: 25079,
          40166: 25032,
          40167: 25027,
          40168: 25030,
          40169: 25018,
          40170: 25035,
          40171: 32633,
          40172: 25037,
          40173: 25062,
          40174: 25059,
          40175: 25078,
          40176: 25082,
          40177: 25076,
          40178: 25087,
          40179: 25085,
          40180: 25084,
          40181: 25086,
          40182: 25088,
          40183: 25096,
          40184: 25097,
          40185: 25101,
          40186: 25100,
          40187: 25108,
          40188: 25115,
          40256: 25118,
          40257: 25121,
          40258: 25130,
          40259: 25134,
          40260: 25136,
          40261: 25138,
          40262: 25139,
          40263: 25153,
          40264: 25166,
          40265: 25182,
          40266: 25187,
          40267: 25179,
          40268: 25184,
          40269: 25192,
          40270: 25212,
          40271: 25218,
          40272: 25225,
          40273: 25214,
          40274: 25234,
          40275: 25235,
          40276: 25238,
          40277: 25300,
          40278: 25219,
          40279: 25236,
          40280: 25303,
          40281: 25297,
          40282: 25275,
          40283: 25295,
          40284: 25343,
          40285: 25286,
          40286: 25812,
          40287: 25288,
          40288: 25308,
          40289: 25292,
          40290: 25290,
          40291: 25282,
          40292: 25287,
          40293: 25243,
          40294: 25289,
          40295: 25356,
          40296: 25326,
          40297: 25329,
          40298: 25383,
          40299: 25346,
          40300: 25352,
          40301: 25327,
          40302: 25333,
          40303: 25424,
          40304: 25406,
          40305: 25421,
          40306: 25628,
          40307: 25423,
          40308: 25494,
          40309: 25486,
          40310: 25472,
          40311: 25515,
          40312: 25462,
          40313: 25507,
          40314: 25487,
          40315: 25481,
          40316: 25503,
          40317: 25525,
          40318: 25451,
          40320: 25449,
          40321: 25534,
          40322: 25577,
          40323: 25536,
          40324: 25542,
          40325: 25571,
          40326: 25545,
          40327: 25554,
          40328: 25590,
          40329: 25540,
          40330: 25622,
          40331: 25652,
          40332: 25606,
          40333: 25619,
          40334: 25638,
          40335: 25654,
          40336: 25885,
          40337: 25623,
          40338: 25640,
          40339: 25615,
          40340: 25703,
          40341: 25711,
          40342: 25718,
          40343: 25678,
          40344: 25898,
          40345: 25749,
          40346: 25747,
          40347: 25765,
          40348: 25769,
          40349: 25736,
          40350: 25788,
          40351: 25818,
          40352: 25810,
          40353: 25797,
          40354: 25799,
          40355: 25787,
          40356: 25816,
          40357: 25794,
          40358: 25841,
          40359: 25831,
          40360: 33289,
          40361: 25824,
          40362: 25825,
          40363: 25260,
          40364: 25827,
          40365: 25839,
          40366: 25900,
          40367: 25846,
          40368: 25844,
          40369: 25842,
          40370: 25850,
          40371: 25856,
          40372: 25853,
          40373: 25880,
          40374: 25884,
          40375: 25861,
          40376: 25892,
          40377: 25891,
          40378: 25899,
          40379: 25908,
          40380: 25909,
          40381: 25911,
          40382: 25910,
          40383: 25912,
          40384: 30027,
          40385: 25928,
          40386: 25942,
          40387: 25941,
          40388: 25933,
          40389: 25944,
          40390: 25950,
          40391: 25949,
          40392: 25970,
          40393: 25976,
          40394: 25986,
          40395: 25987,
          40396: 35722,
          40397: 26011,
          40398: 26015,
          40399: 26027,
          40400: 26039,
          40401: 26051,
          40402: 26054,
          40403: 26049,
          40404: 26052,
          40405: 26060,
          40406: 26066,
          40407: 26075,
          40408: 26073,
          40409: 26080,
          40410: 26081,
          40411: 26097,
          40412: 26482,
          40413: 26122,
          40414: 26115,
          40415: 26107,
          40416: 26483,
          40417: 26165,
          40418: 26166,
          40419: 26164,
          40420: 26140,
          40421: 26191,
          40422: 26180,
          40423: 26185,
          40424: 26177,
          40425: 26206,
          40426: 26205,
          40427: 26212,
          40428: 26215,
          40429: 26216,
          40430: 26207,
          40431: 26210,
          40432: 26224,
          40433: 26243,
          40434: 26248,
          40435: 26254,
          40436: 26249,
          40437: 26244,
          40438: 26264,
          40439: 26269,
          40440: 26305,
          40441: 26297,
          40442: 26313,
          40443: 26302,
          40444: 26300,
          40512: 26308,
          40513: 26296,
          40514: 26326,
          40515: 26330,
          40516: 26336,
          40517: 26175,
          40518: 26342,
          40519: 26345,
          40520: 26352,
          40521: 26357,
          40522: 26359,
          40523: 26383,
          40524: 26390,
          40525: 26398,
          40526: 26406,
          40527: 26407,
          40528: 38712,
          40529: 26414,
          40530: 26431,
          40531: 26422,
          40532: 26433,
          40533: 26424,
          40534: 26423,
          40535: 26438,
          40536: 26462,
          40537: 26464,
          40538: 26457,
          40539: 26467,
          40540: 26468,
          40541: 26505,
          40542: 26480,
          40543: 26537,
          40544: 26492,
          40545: 26474,
          40546: 26508,
          40547: 26507,
          40548: 26534,
          40549: 26529,
          40550: 26501,
          40551: 26551,
          40552: 26607,
          40553: 26548,
          40554: 26604,
          40555: 26547,
          40556: 26601,
          40557: 26552,
          40558: 26596,
          40559: 26590,
          40560: 26589,
          40561: 26594,
          40562: 26606,
          40563: 26553,
          40564: 26574,
          40565: 26566,
          40566: 26599,
          40567: 27292,
          40568: 26654,
          40569: 26694,
          40570: 26665,
          40571: 26688,
          40572: 26701,
          40573: 26674,
          40574: 26702,
          40576: 26803,
          40577: 26667,
          40578: 26713,
          40579: 26723,
          40580: 26743,
          40581: 26751,
          40582: 26783,
          40583: 26767,
          40584: 26797,
          40585: 26772,
          40586: 26781,
          40587: 26779,
          40588: 26755,
          40589: 27310,
          40590: 26809,
          40591: 26740,
          40592: 26805,
          40593: 26784,
          40594: 26810,
          40595: 26895,
          40596: 26765,
          40597: 26750,
          40598: 26881,
          40599: 26826,
          40600: 26888,
          40601: 26840,
          40602: 26914,
          40603: 26918,
          40604: 26849,
          40605: 26892,
          40606: 26829,
          40607: 26836,
          40608: 26855,
          40609: 26837,
          40610: 26934,
          40611: 26898,
          40612: 26884,
          40613: 26839,
          40614: 26851,
          40615: 26917,
          40616: 26873,
          40617: 26848,
          40618: 26863,
          40619: 26920,
          40620: 26922,
          40621: 26906,
          40622: 26915,
          40623: 26913,
          40624: 26822,
          40625: 27001,
          40626: 26999,
          40627: 26972,
          40628: 27e3,
          40629: 26987,
          40630: 26964,
          40631: 27006,
          40632: 26990,
          40633: 26937,
          40634: 26996,
          40635: 26941,
          40636: 26969,
          40637: 26928,
          40638: 26977,
          40639: 26974,
          40640: 26973,
          40641: 27009,
          40642: 26986,
          40643: 27058,
          40644: 27054,
          40645: 27088,
          40646: 27071,
          40647: 27073,
          40648: 27091,
          40649: 27070,
          40650: 27086,
          40651: 23528,
          40652: 27082,
          40653: 27101,
          40654: 27067,
          40655: 27075,
          40656: 27047,
          40657: 27182,
          40658: 27025,
          40659: 27040,
          40660: 27036,
          40661: 27029,
          40662: 27060,
          40663: 27102,
          40664: 27112,
          40665: 27138,
          40666: 27163,
          40667: 27135,
          40668: 27402,
          40669: 27129,
          40670: 27122,
          40671: 27111,
          40672: 27141,
          40673: 27057,
          40674: 27166,
          40675: 27117,
          40676: 27156,
          40677: 27115,
          40678: 27146,
          40679: 27154,
          40680: 27329,
          40681: 27171,
          40682: 27155,
          40683: 27204,
          40684: 27148,
          40685: 27250,
          40686: 27190,
          40687: 27256,
          40688: 27207,
          40689: 27234,
          40690: 27225,
          40691: 27238,
          40692: 27208,
          40693: 27192,
          40694: 27170,
          40695: 27280,
          40696: 27277,
          40697: 27296,
          40698: 27268,
          40699: 27298,
          40700: 27299,
          40768: 27287,
          40769: 34327,
          40770: 27323,
          40771: 27331,
          40772: 27330,
          40773: 27320,
          40774: 27315,
          40775: 27308,
          40776: 27358,
          40777: 27345,
          40778: 27359,
          40779: 27306,
          40780: 27354,
          40781: 27370,
          40782: 27387,
          40783: 27397,
          40784: 34326,
          40785: 27386,
          40786: 27410,
          40787: 27414,
          40788: 39729,
          40789: 27423,
          40790: 27448,
          40791: 27447,
          40792: 30428,
          40793: 27449,
          40794: 39150,
          40795: 27463,
          40796: 27459,
          40797: 27465,
          40798: 27472,
          40799: 27481,
          40800: 27476,
          40801: 27483,
          40802: 27487,
          40803: 27489,
          40804: 27512,
          40805: 27513,
          40806: 27519,
          40807: 27520,
          40808: 27524,
          40809: 27523,
          40810: 27533,
          40811: 27544,
          40812: 27541,
          40813: 27550,
          40814: 27556,
          40815: 27562,
          40816: 27563,
          40817: 27567,
          40818: 27570,
          40819: 27569,
          40820: 27571,
          40821: 27575,
          40822: 27580,
          40823: 27590,
          40824: 27595,
          40825: 27603,
          40826: 27615,
          40827: 27628,
          40828: 27627,
          40829: 27635,
          40830: 27631,
          40832: 40638,
          40833: 27656,
          40834: 27667,
          40835: 27668,
          40836: 27675,
          40837: 27684,
          40838: 27683,
          40839: 27742,
          40840: 27733,
          40841: 27746,
          40842: 27754,
          40843: 27778,
          40844: 27789,
          40845: 27802,
          40846: 27777,
          40847: 27803,
          40848: 27774,
          40849: 27752,
          40850: 27763,
          40851: 27794,
          40852: 27792,
          40853: 27844,
          40854: 27889,
          40855: 27859,
          40856: 27837,
          40857: 27863,
          40858: 27845,
          40859: 27869,
          40860: 27822,
          40861: 27825,
          40862: 27838,
          40863: 27834,
          40864: 27867,
          40865: 27887,
          40866: 27865,
          40867: 27882,
          40868: 27935,
          40869: 34893,
          40870: 27958,
          40871: 27947,
          40872: 27965,
          40873: 27960,
          40874: 27929,
          40875: 27957,
          40876: 27955,
          40877: 27922,
          40878: 27916,
          40879: 28003,
          40880: 28051,
          40881: 28004,
          40882: 27994,
          40883: 28025,
          40884: 27993,
          40885: 28046,
          40886: 28053,
          40887: 28644,
          40888: 28037,
          40889: 28153,
          40890: 28181,
          40891: 28170,
          40892: 28085,
          40893: 28103,
          40894: 28134,
          40895: 28088,
          40896: 28102,
          40897: 28140,
          40898: 28126,
          40899: 28108,
          40900: 28136,
          40901: 28114,
          40902: 28101,
          40903: 28154,
          40904: 28121,
          40905: 28132,
          40906: 28117,
          40907: 28138,
          40908: 28142,
          40909: 28205,
          40910: 28270,
          40911: 28206,
          40912: 28185,
          40913: 28274,
          40914: 28255,
          40915: 28222,
          40916: 28195,
          40917: 28267,
          40918: 28203,
          40919: 28278,
          40920: 28237,
          40921: 28191,
          40922: 28227,
          40923: 28218,
          40924: 28238,
          40925: 28196,
          40926: 28415,
          40927: 28189,
          40928: 28216,
          40929: 28290,
          40930: 28330,
          40931: 28312,
          40932: 28361,
          40933: 28343,
          40934: 28371,
          40935: 28349,
          40936: 28335,
          40937: 28356,
          40938: 28338,
          40939: 28372,
          40940: 28373,
          40941: 28303,
          40942: 28325,
          40943: 28354,
          40944: 28319,
          40945: 28481,
          40946: 28433,
          40947: 28748,
          40948: 28396,
          40949: 28408,
          40950: 28414,
          40951: 28479,
          40952: 28402,
          40953: 28465,
          40954: 28399,
          40955: 28466,
          40956: 28364,
          161: 65377,
          162: 65378,
          163: 65379,
          164: 65380,
          165: 65381,
          166: 65382,
          167: 65383,
          168: 65384,
          169: 65385,
          170: 65386,
          171: 65387,
          172: 65388,
          173: 65389,
          174: 65390,
          175: 65391,
          176: 65392,
          177: 65393,
          178: 65394,
          179: 65395,
          180: 65396,
          181: 65397,
          182: 65398,
          183: 65399,
          184: 65400,
          185: 65401,
          186: 65402,
          187: 65403,
          188: 65404,
          189: 65405,
          190: 65406,
          191: 65407,
          192: 65408,
          193: 65409,
          194: 65410,
          195: 65411,
          196: 65412,
          197: 65413,
          198: 65414,
          199: 65415,
          200: 65416,
          201: 65417,
          202: 65418,
          203: 65419,
          204: 65420,
          205: 65421,
          206: 65422,
          207: 65423,
          208: 65424,
          209: 65425,
          210: 65426,
          211: 65427,
          212: 65428,
          213: 65429,
          214: 65430,
          215: 65431,
          216: 65432,
          217: 65433,
          218: 65434,
          219: 65435,
          220: 65436,
          221: 65437,
          222: 65438,
          223: 65439,
          57408: 28478,
          57409: 28435,
          57410: 28407,
          57411: 28550,
          57412: 28538,
          57413: 28536,
          57414: 28545,
          57415: 28544,
          57416: 28527,
          57417: 28507,
          57418: 28659,
          57419: 28525,
          57420: 28546,
          57421: 28540,
          57422: 28504,
          57423: 28558,
          57424: 28561,
          57425: 28610,
          57426: 28518,
          57427: 28595,
          57428: 28579,
          57429: 28577,
          57430: 28580,
          57431: 28601,
          57432: 28614,
          57433: 28586,
          57434: 28639,
          57435: 28629,
          57436: 28652,
          57437: 28628,
          57438: 28632,
          57439: 28657,
          57440: 28654,
          57441: 28635,
          57442: 28681,
          57443: 28683,
          57444: 28666,
          57445: 28689,
          57446: 28673,
          57447: 28687,
          57448: 28670,
          57449: 28699,
          57450: 28698,
          57451: 28532,
          57452: 28701,
          57453: 28696,
          57454: 28703,
          57455: 28720,
          57456: 28734,
          57457: 28722,
          57458: 28753,
          57459: 28771,
          57460: 28825,
          57461: 28818,
          57462: 28847,
          57463: 28913,
          57464: 28844,
          57465: 28856,
          57466: 28851,
          57467: 28846,
          57468: 28895,
          57469: 28875,
          57470: 28893,
          57472: 28889,
          57473: 28937,
          57474: 28925,
          57475: 28956,
          57476: 28953,
          57477: 29029,
          57478: 29013,
          57479: 29064,
          57480: 29030,
          57481: 29026,
          57482: 29004,
          57483: 29014,
          57484: 29036,
          57485: 29071,
          57486: 29179,
          57487: 29060,
          57488: 29077,
          57489: 29096,
          57490: 29100,
          57491: 29143,
          57492: 29113,
          57493: 29118,
          57494: 29138,
          57495: 29129,
          57496: 29140,
          57497: 29134,
          57498: 29152,
          57499: 29164,
          57500: 29159,
          57501: 29173,
          57502: 29180,
          57503: 29177,
          57504: 29183,
          57505: 29197,
          57506: 29200,
          57507: 29211,
          57508: 29224,
          57509: 29229,
          57510: 29228,
          57511: 29232,
          57512: 29234,
          57513: 29243,
          57514: 29244,
          57515: 29247,
          57516: 29248,
          57517: 29254,
          57518: 29259,
          57519: 29272,
          57520: 29300,
          57521: 29310,
          57522: 29314,
          57523: 29313,
          57524: 29319,
          57525: 29330,
          57526: 29334,
          57527: 29346,
          57528: 29351,
          57529: 29369,
          57530: 29362,
          57531: 29379,
          57532: 29382,
          57533: 29380,
          57534: 29390,
          57535: 29394,
          57536: 29410,
          57537: 29408,
          57538: 29409,
          57539: 29433,
          57540: 29431,
          57541: 20495,
          57542: 29463,
          57543: 29450,
          57544: 29468,
          57545: 29462,
          57546: 29469,
          57547: 29492,
          57548: 29487,
          57549: 29481,
          57550: 29477,
          57551: 29502,
          57552: 29518,
          57553: 29519,
          57554: 40664,
          57555: 29527,
          57556: 29546,
          57557: 29544,
          57558: 29552,
          57559: 29560,
          57560: 29557,
          57561: 29563,
          57562: 29562,
          57563: 29640,
          57564: 29619,
          57565: 29646,
          57566: 29627,
          57567: 29632,
          57568: 29669,
          57569: 29678,
          57570: 29662,
          57571: 29858,
          57572: 29701,
          57573: 29807,
          57574: 29733,
          57575: 29688,
          57576: 29746,
          57577: 29754,
          57578: 29781,
          57579: 29759,
          57580: 29791,
          57581: 29785,
          57582: 29761,
          57583: 29788,
          57584: 29801,
          57585: 29808,
          57586: 29795,
          57587: 29802,
          57588: 29814,
          57589: 29822,
          57590: 29835,
          57591: 29854,
          57592: 29863,
          57593: 29898,
          57594: 29903,
          57595: 29908,
          57596: 29681,
          57664: 29920,
          57665: 29923,
          57666: 29927,
          57667: 29929,
          57668: 29934,
          57669: 29938,
          57670: 29936,
          57671: 29937,
          57672: 29944,
          57673: 29943,
          57674: 29956,
          57675: 29955,
          57676: 29957,
          57677: 29964,
          57678: 29966,
          57679: 29965,
          57680: 29973,
          57681: 29971,
          57682: 29982,
          57683: 29990,
          57684: 29996,
          57685: 30012,
          57686: 30020,
          57687: 30029,
          57688: 30026,
          57689: 30025,
          57690: 30043,
          57691: 30022,
          57692: 30042,
          57693: 30057,
          57694: 30052,
          57695: 30055,
          57696: 30059,
          57697: 30061,
          57698: 30072,
          57699: 30070,
          57700: 30086,
          57701: 30087,
          57702: 30068,
          57703: 30090,
          57704: 30089,
          57705: 30082,
          57706: 30100,
          57707: 30106,
          57708: 30109,
          57709: 30117,
          57710: 30115,
          57711: 30146,
          57712: 30131,
          57713: 30147,
          57714: 30133,
          57715: 30141,
          57716: 30136,
          57717: 30140,
          57718: 30129,
          57719: 30157,
          57720: 30154,
          57721: 30162,
          57722: 30169,
          57723: 30179,
          57724: 30174,
          57725: 30206,
          57726: 30207,
          57728: 30204,
          57729: 30209,
          57730: 30192,
          57731: 30202,
          57732: 30194,
          57733: 30195,
          57734: 30219,
          57735: 30221,
          57736: 30217,
          57737: 30239,
          57738: 30247,
          57739: 30240,
          57740: 30241,
          57741: 30242,
          57742: 30244,
          57743: 30260,
          57744: 30256,
          57745: 30267,
          57746: 30279,
          57747: 30280,
          57748: 30278,
          57749: 30300,
          57750: 30296,
          57751: 30305,
          57752: 30306,
          57753: 30312,
          57754: 30313,
          57755: 30314,
          57756: 30311,
          57757: 30316,
          57758: 30320,
          57759: 30322,
          57760: 30326,
          57761: 30328,
          57762: 30332,
          57763: 30336,
          57764: 30339,
          57765: 30344,
          57766: 30347,
          57767: 30350,
          57768: 30358,
          57769: 30355,
          57770: 30361,
          57771: 30362,
          57772: 30384,
          57773: 30388,
          57774: 30392,
          57775: 30393,
          57776: 30394,
          57777: 30402,
          57778: 30413,
          57779: 30422,
          57780: 30418,
          57781: 30430,
          57782: 30433,
          57783: 30437,
          57784: 30439,
          57785: 30442,
          57786: 34351,
          57787: 30459,
          57788: 30472,
          57789: 30471,
          57790: 30468,
          57791: 30505,
          57792: 30500,
          57793: 30494,
          57794: 30501,
          57795: 30502,
          57796: 30491,
          57797: 30519,
          57798: 30520,
          57799: 30535,
          57800: 30554,
          57801: 30568,
          57802: 30571,
          57803: 30555,
          57804: 30565,
          57805: 30591,
          57806: 30590,
          57807: 30585,
          57808: 30606,
          57809: 30603,
          57810: 30609,
          57811: 30624,
          57812: 30622,
          57813: 30640,
          57814: 30646,
          57815: 30649,
          57816: 30655,
          57817: 30652,
          57818: 30653,
          57819: 30651,
          57820: 30663,
          57821: 30669,
          57822: 30679,
          57823: 30682,
          57824: 30684,
          57825: 30691,
          57826: 30702,
          57827: 30716,
          57828: 30732,
          57829: 30738,
          57830: 31014,
          57831: 30752,
          57832: 31018,
          57833: 30789,
          57834: 30862,
          57835: 30836,
          57836: 30854,
          57837: 30844,
          57838: 30874,
          57839: 30860,
          57840: 30883,
          57841: 30901,
          57842: 30890,
          57843: 30895,
          57844: 30929,
          57845: 30918,
          57846: 30923,
          57847: 30932,
          57848: 30910,
          57849: 30908,
          57850: 30917,
          57851: 30922,
          57852: 30956,
          57920: 30951,
          57921: 30938,
          57922: 30973,
          57923: 30964,
          57924: 30983,
          57925: 30994,
          57926: 30993,
          57927: 31001,
          57928: 31020,
          57929: 31019,
          57930: 31040,
          57931: 31072,
          57932: 31063,
          57933: 31071,
          57934: 31066,
          57935: 31061,
          57936: 31059,
          57937: 31098,
          57938: 31103,
          57939: 31114,
          57940: 31133,
          57941: 31143,
          57942: 40779,
          57943: 31146,
          57944: 31150,
          57945: 31155,
          57946: 31161,
          57947: 31162,
          57948: 31177,
          57949: 31189,
          57950: 31207,
          57951: 31212,
          57952: 31201,
          57953: 31203,
          57954: 31240,
          57955: 31245,
          57956: 31256,
          57957: 31257,
          57958: 31264,
          57959: 31263,
          57960: 31104,
          57961: 31281,
          57962: 31291,
          57963: 31294,
          57964: 31287,
          57965: 31299,
          57966: 31319,
          57967: 31305,
          57968: 31329,
          57969: 31330,
          57970: 31337,
          57971: 40861,
          57972: 31344,
          57973: 31353,
          57974: 31357,
          57975: 31368,
          57976: 31383,
          57977: 31381,
          57978: 31384,
          57979: 31382,
          57980: 31401,
          57981: 31432,
          57982: 31408,
          57984: 31414,
          57985: 31429,
          57986: 31428,
          57987: 31423,
          57988: 36995,
          57989: 31431,
          57990: 31434,
          57991: 31437,
          57992: 31439,
          57993: 31445,
          57994: 31443,
          57995: 31449,
          57996: 31450,
          57997: 31453,
          57998: 31457,
          57999: 31458,
          58e3: 31462,
          58001: 31469,
          58002: 31472,
          58003: 31490,
          58004: 31503,
          58005: 31498,
          58006: 31494,
          58007: 31539,
          58008: 31512,
          58009: 31513,
          58010: 31518,
          58011: 31541,
          58012: 31528,
          58013: 31542,
          58014: 31568,
          58015: 31610,
          58016: 31492,
          58017: 31565,
          58018: 31499,
          58019: 31564,
          58020: 31557,
          58021: 31605,
          58022: 31589,
          58023: 31604,
          58024: 31591,
          58025: 31600,
          58026: 31601,
          58027: 31596,
          58028: 31598,
          58029: 31645,
          58030: 31640,
          58031: 31647,
          58032: 31629,
          58033: 31644,
          58034: 31642,
          58035: 31627,
          58036: 31634,
          58037: 31631,
          58038: 31581,
          58039: 31641,
          58040: 31691,
          58041: 31681,
          58042: 31692,
          58043: 31695,
          58044: 31668,
          58045: 31686,
          58046: 31709,
          58047: 31721,
          58048: 31761,
          58049: 31764,
          58050: 31718,
          58051: 31717,
          58052: 31840,
          58053: 31744,
          58054: 31751,
          58055: 31763,
          58056: 31731,
          58057: 31735,
          58058: 31767,
          58059: 31757,
          58060: 31734,
          58061: 31779,
          58062: 31783,
          58063: 31786,
          58064: 31775,
          58065: 31799,
          58066: 31787,
          58067: 31805,
          58068: 31820,
          58069: 31811,
          58070: 31828,
          58071: 31823,
          58072: 31808,
          58073: 31824,
          58074: 31832,
          58075: 31839,
          58076: 31844,
          58077: 31830,
          58078: 31845,
          58079: 31852,
          58080: 31861,
          58081: 31875,
          58082: 31888,
          58083: 31908,
          58084: 31917,
          58085: 31906,
          58086: 31915,
          58087: 31905,
          58088: 31912,
          58089: 31923,
          58090: 31922,
          58091: 31921,
          58092: 31918,
          58093: 31929,
          58094: 31933,
          58095: 31936,
          58096: 31941,
          58097: 31938,
          58098: 31960,
          58099: 31954,
          58100: 31964,
          58101: 31970,
          58102: 39739,
          58103: 31983,
          58104: 31986,
          58105: 31988,
          58106: 31990,
          58107: 31994,
          58108: 32006,
          58176: 32002,
          58177: 32028,
          58178: 32021,
          58179: 32010,
          58180: 32069,
          58181: 32075,
          58182: 32046,
          58183: 32050,
          58184: 32063,
          58185: 32053,
          58186: 32070,
          58187: 32115,
          58188: 32086,
          58189: 32078,
          58190: 32114,
          58191: 32104,
          58192: 32110,
          58193: 32079,
          58194: 32099,
          58195: 32147,
          58196: 32137,
          58197: 32091,
          58198: 32143,
          58199: 32125,
          58200: 32155,
          58201: 32186,
          58202: 32174,
          58203: 32163,
          58204: 32181,
          58205: 32199,
          58206: 32189,
          58207: 32171,
          58208: 32317,
          58209: 32162,
          58210: 32175,
          58211: 32220,
          58212: 32184,
          58213: 32159,
          58214: 32176,
          58215: 32216,
          58216: 32221,
          58217: 32228,
          58218: 32222,
          58219: 32251,
          58220: 32242,
          58221: 32225,
          58222: 32261,
          58223: 32266,
          58224: 32291,
          58225: 32289,
          58226: 32274,
          58227: 32305,
          58228: 32287,
          58229: 32265,
          58230: 32267,
          58231: 32290,
          58232: 32326,
          58233: 32358,
          58234: 32315,
          58235: 32309,
          58236: 32313,
          58237: 32323,
          58238: 32311,
          58240: 32306,
          58241: 32314,
          58242: 32359,
          58243: 32349,
          58244: 32342,
          58245: 32350,
          58246: 32345,
          58247: 32346,
          58248: 32377,
          58249: 32362,
          58250: 32361,
          58251: 32380,
          58252: 32379,
          58253: 32387,
          58254: 32213,
          58255: 32381,
          58256: 36782,
          58257: 32383,
          58258: 32392,
          58259: 32393,
          58260: 32396,
          58261: 32402,
          58262: 32400,
          58263: 32403,
          58264: 32404,
          58265: 32406,
          58266: 32398,
          58267: 32411,
          58268: 32412,
          58269: 32568,
          58270: 32570,
          58271: 32581,
          58272: 32588,
          58273: 32589,
          58274: 32590,
          58275: 32592,
          58276: 32593,
          58277: 32597,
          58278: 32596,
          58279: 32600,
          58280: 32607,
          58281: 32608,
          58282: 32616,
          58283: 32617,
          58284: 32615,
          58285: 32632,
          58286: 32642,
          58287: 32646,
          58288: 32643,
          58289: 32648,
          58290: 32647,
          58291: 32652,
          58292: 32660,
          58293: 32670,
          58294: 32669,
          58295: 32666,
          58296: 32675,
          58297: 32687,
          58298: 32690,
          58299: 32697,
          58300: 32686,
          58301: 32694,
          58302: 32696,
          58303: 35697,
          58304: 32709,
          58305: 32710,
          58306: 32714,
          58307: 32725,
          58308: 32724,
          58309: 32737,
          58310: 32742,
          58311: 32745,
          58312: 32755,
          58313: 32761,
          58314: 39132,
          58315: 32774,
          58316: 32772,
          58317: 32779,
          58318: 32786,
          58319: 32792,
          58320: 32793,
          58321: 32796,
          58322: 32801,
          58323: 32808,
          58324: 32831,
          58325: 32827,
          58326: 32842,
          58327: 32838,
          58328: 32850,
          58329: 32856,
          58330: 32858,
          58331: 32863,
          58332: 32866,
          58333: 32872,
          58334: 32883,
          58335: 32882,
          58336: 32880,
          58337: 32886,
          58338: 32889,
          58339: 32893,
          58340: 32895,
          58341: 32900,
          58342: 32902,
          58343: 32901,
          58344: 32923,
          58345: 32915,
          58346: 32922,
          58347: 32941,
          58348: 20880,
          58349: 32940,
          58350: 32987,
          58351: 32997,
          58352: 32985,
          58353: 32989,
          58354: 32964,
          58355: 32986,
          58356: 32982,
          58357: 33033,
          58358: 33007,
          58359: 33009,
          58360: 33051,
          58361: 33065,
          58362: 33059,
          58363: 33071,
          58364: 33099,
          58432: 38539,
          58433: 33094,
          58434: 33086,
          58435: 33107,
          58436: 33105,
          58437: 33020,
          58438: 33137,
          58439: 33134,
          58440: 33125,
          58441: 33126,
          58442: 33140,
          58443: 33155,
          58444: 33160,
          58445: 33162,
          58446: 33152,
          58447: 33154,
          58448: 33184,
          58449: 33173,
          58450: 33188,
          58451: 33187,
          58452: 33119,
          58453: 33171,
          58454: 33193,
          58455: 33200,
          58456: 33205,
          58457: 33214,
          58458: 33208,
          58459: 33213,
          58460: 33216,
          58461: 33218,
          58462: 33210,
          58463: 33225,
          58464: 33229,
          58465: 33233,
          58466: 33241,
          58467: 33240,
          58468: 33224,
          58469: 33242,
          58470: 33247,
          58471: 33248,
          58472: 33255,
          58473: 33274,
          58474: 33275,
          58475: 33278,
          58476: 33281,
          58477: 33282,
          58478: 33285,
          58479: 33287,
          58480: 33290,
          58481: 33293,
          58482: 33296,
          58483: 33302,
          58484: 33321,
          58485: 33323,
          58486: 33336,
          58487: 33331,
          58488: 33344,
          58489: 33369,
          58490: 33368,
          58491: 33373,
          58492: 33370,
          58493: 33375,
          58494: 33380,
          58496: 33378,
          58497: 33384,
          58498: 33386,
          58499: 33387,
          58500: 33326,
          58501: 33393,
          58502: 33399,
          58503: 33400,
          58504: 33406,
          58505: 33421,
          58506: 33426,
          58507: 33451,
          58508: 33439,
          58509: 33467,
          58510: 33452,
          58511: 33505,
          58512: 33507,
          58513: 33503,
          58514: 33490,
          58515: 33524,
          58516: 33523,
          58517: 33530,
          58518: 33683,
          58519: 33539,
          58520: 33531,
          58521: 33529,
          58522: 33502,
          58523: 33542,
          58524: 33500,
          58525: 33545,
          58526: 33497,
          58527: 33589,
          58528: 33588,
          58529: 33558,
          58530: 33586,
          58531: 33585,
          58532: 33600,
          58533: 33593,
          58534: 33616,
          58535: 33605,
          58536: 33583,
          58537: 33579,
          58538: 33559,
          58539: 33560,
          58540: 33669,
          58541: 33690,
          58542: 33706,
          58543: 33695,
          58544: 33698,
          58545: 33686,
          58546: 33571,
          58547: 33678,
          58548: 33671,
          58549: 33674,
          58550: 33660,
          58551: 33717,
          58552: 33651,
          58553: 33653,
          58554: 33696,
          58555: 33673,
          58556: 33704,
          58557: 33780,
          58558: 33811,
          58559: 33771,
          58560: 33742,
          58561: 33789,
          58562: 33795,
          58563: 33752,
          58564: 33803,
          58565: 33729,
          58566: 33783,
          58567: 33799,
          58568: 33760,
          58569: 33778,
          58570: 33805,
          58571: 33826,
          58572: 33824,
          58573: 33725,
          58574: 33848,
          58575: 34054,
          58576: 33787,
          58577: 33901,
          58578: 33834,
          58579: 33852,
          58580: 34138,
          58581: 33924,
          58582: 33911,
          58583: 33899,
          58584: 33965,
          58585: 33902,
          58586: 33922,
          58587: 33897,
          58588: 33862,
          58589: 33836,
          58590: 33903,
          58591: 33913,
          58592: 33845,
          58593: 33994,
          58594: 33890,
          58595: 33977,
          58596: 33983,
          58597: 33951,
          58598: 34009,
          58599: 33997,
          58600: 33979,
          58601: 34010,
          58602: 34e3,
          58603: 33985,
          58604: 33990,
          58605: 34006,
          58606: 33953,
          58607: 34081,
          58608: 34047,
          58609: 34036,
          58610: 34071,
          58611: 34072,
          58612: 34092,
          58613: 34079,
          58614: 34069,
          58615: 34068,
          58616: 34044,
          58617: 34112,
          58618: 34147,
          58619: 34136,
          58620: 34120,
          58688: 34113,
          58689: 34306,
          58690: 34123,
          58691: 34133,
          58692: 34176,
          58693: 34212,
          58694: 34184,
          58695: 34193,
          58696: 34186,
          58697: 34216,
          58698: 34157,
          58699: 34196,
          58700: 34203,
          58701: 34282,
          58702: 34183,
          58703: 34204,
          58704: 34167,
          58705: 34174,
          58706: 34192,
          58707: 34249,
          58708: 34234,
          58709: 34255,
          58710: 34233,
          58711: 34256,
          58712: 34261,
          58713: 34269,
          58714: 34277,
          58715: 34268,
          58716: 34297,
          58717: 34314,
          58718: 34323,
          58719: 34315,
          58720: 34302,
          58721: 34298,
          58722: 34310,
          58723: 34338,
          58724: 34330,
          58725: 34352,
          58726: 34367,
          58727: 34381,
          58728: 20053,
          58729: 34388,
          58730: 34399,
          58731: 34407,
          58732: 34417,
          58733: 34451,
          58734: 34467,
          58735: 34473,
          58736: 34474,
          58737: 34443,
          58738: 34444,
          58739: 34486,
          58740: 34479,
          58741: 34500,
          58742: 34502,
          58743: 34480,
          58744: 34505,
          58745: 34851,
          58746: 34475,
          58747: 34516,
          58748: 34526,
          58749: 34537,
          58750: 34540,
          58752: 34527,
          58753: 34523,
          58754: 34543,
          58755: 34578,
          58756: 34566,
          58757: 34568,
          58758: 34560,
          58759: 34563,
          58760: 34555,
          58761: 34577,
          58762: 34569,
          58763: 34573,
          58764: 34553,
          58765: 34570,
          58766: 34612,
          58767: 34623,
          58768: 34615,
          58769: 34619,
          58770: 34597,
          58771: 34601,
          58772: 34586,
          58773: 34656,
          58774: 34655,
          58775: 34680,
          58776: 34636,
          58777: 34638,
          58778: 34676,
          58779: 34647,
          58780: 34664,
          58781: 34670,
          58782: 34649,
          58783: 34643,
          58784: 34659,
          58785: 34666,
          58786: 34821,
          58787: 34722,
          58788: 34719,
          58789: 34690,
          58790: 34735,
          58791: 34763,
          58792: 34749,
          58793: 34752,
          58794: 34768,
          58795: 38614,
          58796: 34731,
          58797: 34756,
          58798: 34739,
          58799: 34759,
          58800: 34758,
          58801: 34747,
          58802: 34799,
          58803: 34802,
          58804: 34784,
          58805: 34831,
          58806: 34829,
          58807: 34814,
          58808: 34806,
          58809: 34807,
          58810: 34830,
          58811: 34770,
          58812: 34833,
          58813: 34838,
          58814: 34837,
          58815: 34850,
          58816: 34849,
          58817: 34865,
          58818: 34870,
          58819: 34873,
          58820: 34855,
          58821: 34875,
          58822: 34884,
          58823: 34882,
          58824: 34898,
          58825: 34905,
          58826: 34910,
          58827: 34914,
          58828: 34923,
          58829: 34945,
          58830: 34942,
          58831: 34974,
          58832: 34933,
          58833: 34941,
          58834: 34997,
          58835: 34930,
          58836: 34946,
          58837: 34967,
          58838: 34962,
          58839: 34990,
          58840: 34969,
          58841: 34978,
          58842: 34957,
          58843: 34980,
          58844: 34992,
          58845: 35007,
          58846: 34993,
          58847: 35011,
          58848: 35012,
          58849: 35028,
          58850: 35032,
          58851: 35033,
          58852: 35037,
          58853: 35065,
          58854: 35074,
          58855: 35068,
          58856: 35060,
          58857: 35048,
          58858: 35058,
          58859: 35076,
          58860: 35084,
          58861: 35082,
          58862: 35091,
          58863: 35139,
          58864: 35102,
          58865: 35109,
          58866: 35114,
          58867: 35115,
          58868: 35137,
          58869: 35140,
          58870: 35131,
          58871: 35126,
          58872: 35128,
          58873: 35148,
          58874: 35101,
          58875: 35168,
          58876: 35166,
          58944: 35174,
          58945: 35172,
          58946: 35181,
          58947: 35178,
          58948: 35183,
          58949: 35188,
          58950: 35191,
          58951: 35198,
          58952: 35203,
          58953: 35208,
          58954: 35210,
          58955: 35219,
          58956: 35224,
          58957: 35233,
          58958: 35241,
          58959: 35238,
          58960: 35244,
          58961: 35247,
          58962: 35250,
          58963: 35258,
          58964: 35261,
          58965: 35263,
          58966: 35264,
          58967: 35290,
          58968: 35292,
          58969: 35293,
          58970: 35303,
          58971: 35316,
          58972: 35320,
          58973: 35331,
          58974: 35350,
          58975: 35344,
          58976: 35340,
          58977: 35355,
          58978: 35357,
          58979: 35365,
          58980: 35382,
          58981: 35393,
          58982: 35419,
          58983: 35410,
          58984: 35398,
          58985: 35400,
          58986: 35452,
          58987: 35437,
          58988: 35436,
          58989: 35426,
          58990: 35461,
          58991: 35458,
          58992: 35460,
          58993: 35496,
          58994: 35489,
          58995: 35473,
          58996: 35493,
          58997: 35494,
          58998: 35482,
          58999: 35491,
          59e3: 35524,
          59001: 35533,
          59002: 35522,
          59003: 35546,
          59004: 35563,
          59005: 35571,
          59006: 35559,
          59008: 35556,
          59009: 35569,
          59010: 35604,
          59011: 35552,
          59012: 35554,
          59013: 35575,
          59014: 35550,
          59015: 35547,
          59016: 35596,
          59017: 35591,
          59018: 35610,
          59019: 35553,
          59020: 35606,
          59021: 35600,
          59022: 35607,
          59023: 35616,
          59024: 35635,
          59025: 38827,
          59026: 35622,
          59027: 35627,
          59028: 35646,
          59029: 35624,
          59030: 35649,
          59031: 35660,
          59032: 35663,
          59033: 35662,
          59034: 35657,
          59035: 35670,
          59036: 35675,
          59037: 35674,
          59038: 35691,
          59039: 35679,
          59040: 35692,
          59041: 35695,
          59042: 35700,
          59043: 35709,
          59044: 35712,
          59045: 35724,
          59046: 35726,
          59047: 35730,
          59048: 35731,
          59049: 35734,
          59050: 35737,
          59051: 35738,
          59052: 35898,
          59053: 35905,
          59054: 35903,
          59055: 35912,
          59056: 35916,
          59057: 35918,
          59058: 35920,
          59059: 35925,
          59060: 35938,
          59061: 35948,
          59062: 35960,
          59063: 35962,
          59064: 35970,
          59065: 35977,
          59066: 35973,
          59067: 35978,
          59068: 35981,
          59069: 35982,
          59070: 35988,
          59071: 35964,
          59072: 35992,
          59073: 25117,
          59074: 36013,
          59075: 36010,
          59076: 36029,
          59077: 36018,
          59078: 36019,
          59079: 36014,
          59080: 36022,
          59081: 36040,
          59082: 36033,
          59083: 36068,
          59084: 36067,
          59085: 36058,
          59086: 36093,
          59087: 36090,
          59088: 36091,
          59089: 36100,
          59090: 36101,
          59091: 36106,
          59092: 36103,
          59093: 36111,
          59094: 36109,
          59095: 36112,
          59096: 40782,
          59097: 36115,
          59098: 36045,
          59099: 36116,
          59100: 36118,
          59101: 36199,
          59102: 36205,
          59103: 36209,
          59104: 36211,
          59105: 36225,
          59106: 36249,
          59107: 36290,
          59108: 36286,
          59109: 36282,
          59110: 36303,
          59111: 36314,
          59112: 36310,
          59113: 36300,
          59114: 36315,
          59115: 36299,
          59116: 36330,
          59117: 36331,
          59118: 36319,
          59119: 36323,
          59120: 36348,
          59121: 36360,
          59122: 36361,
          59123: 36351,
          59124: 36381,
          59125: 36382,
          59126: 36368,
          59127: 36383,
          59128: 36418,
          59129: 36405,
          59130: 36400,
          59131: 36404,
          59132: 36426,
          59200: 36423,
          59201: 36425,
          59202: 36428,
          59203: 36432,
          59204: 36424,
          59205: 36441,
          59206: 36452,
          59207: 36448,
          59208: 36394,
          59209: 36451,
          59210: 36437,
          59211: 36470,
          59212: 36466,
          59213: 36476,
          59214: 36481,
          59215: 36487,
          59216: 36485,
          59217: 36484,
          59218: 36491,
          59219: 36490,
          59220: 36499,
          59221: 36497,
          59222: 36500,
          59223: 36505,
          59224: 36522,
          59225: 36513,
          59226: 36524,
          59227: 36528,
          59228: 36550,
          59229: 36529,
          59230: 36542,
          59231: 36549,
          59232: 36552,
          59233: 36555,
          59234: 36571,
          59235: 36579,
          59236: 36604,
          59237: 36603,
          59238: 36587,
          59239: 36606,
          59240: 36618,
          59241: 36613,
          59242: 36629,
          59243: 36626,
          59244: 36633,
          59245: 36627,
          59246: 36636,
          59247: 36639,
          59248: 36635,
          59249: 36620,
          59250: 36646,
          59251: 36659,
          59252: 36667,
          59253: 36665,
          59254: 36677,
          59255: 36674,
          59256: 36670,
          59257: 36684,
          59258: 36681,
          59259: 36678,
          59260: 36686,
          59261: 36695,
          59262: 36700,
          59264: 36706,
          59265: 36707,
          59266: 36708,
          59267: 36764,
          59268: 36767,
          59269: 36771,
          59270: 36781,
          59271: 36783,
          59272: 36791,
          59273: 36826,
          59274: 36837,
          59275: 36834,
          59276: 36842,
          59277: 36847,
          59278: 36999,
          59279: 36852,
          59280: 36869,
          59281: 36857,
          59282: 36858,
          59283: 36881,
          59284: 36885,
          59285: 36897,
          59286: 36877,
          59287: 36894,
          59288: 36886,
          59289: 36875,
          59290: 36903,
          59291: 36918,
          59292: 36917,
          59293: 36921,
          59294: 36856,
          59295: 36943,
          59296: 36944,
          59297: 36945,
          59298: 36946,
          59299: 36878,
          59300: 36937,
          59301: 36926,
          59302: 36950,
          59303: 36952,
          59304: 36958,
          59305: 36968,
          59306: 36975,
          59307: 36982,
          59308: 38568,
          59309: 36978,
          59310: 36994,
          59311: 36989,
          59312: 36993,
          59313: 36992,
          59314: 37002,
          59315: 37001,
          59316: 37007,
          59317: 37032,
          59318: 37039,
          59319: 37041,
          59320: 37045,
          59321: 37090,
          59322: 37092,
          59323: 25160,
          59324: 37083,
          59325: 37122,
          59326: 37138,
          59327: 37145,
          59328: 37170,
          59329: 37168,
          59330: 37194,
          59331: 37206,
          59332: 37208,
          59333: 37219,
          59334: 37221,
          59335: 37225,
          59336: 37235,
          59337: 37234,
          59338: 37259,
          59339: 37257,
          59340: 37250,
          59341: 37282,
          59342: 37291,
          59343: 37295,
          59344: 37290,
          59345: 37301,
          59346: 37300,
          59347: 37306,
          59348: 37312,
          59349: 37313,
          59350: 37321,
          59351: 37323,
          59352: 37328,
          59353: 37334,
          59354: 37343,
          59355: 37345,
          59356: 37339,
          59357: 37372,
          59358: 37365,
          59359: 37366,
          59360: 37406,
          59361: 37375,
          59362: 37396,
          59363: 37420,
          59364: 37397,
          59365: 37393,
          59366: 37470,
          59367: 37463,
          59368: 37445,
          59369: 37449,
          59370: 37476,
          59371: 37448,
          59372: 37525,
          59373: 37439,
          59374: 37451,
          59375: 37456,
          59376: 37532,
          59377: 37526,
          59378: 37523,
          59379: 37531,
          59380: 37466,
          59381: 37583,
          59382: 37561,
          59383: 37559,
          59384: 37609,
          59385: 37647,
          59386: 37626,
          59387: 37700,
          59388: 37678,
          59456: 37657,
          59457: 37666,
          59458: 37658,
          59459: 37667,
          59460: 37690,
          59461: 37685,
          59462: 37691,
          59463: 37724,
          59464: 37728,
          59465: 37756,
          59466: 37742,
          59467: 37718,
          59468: 37808,
          59469: 37804,
          59470: 37805,
          59471: 37780,
          59472: 37817,
          59473: 37846,
          59474: 37847,
          59475: 37864,
          59476: 37861,
          59477: 37848,
          59478: 37827,
          59479: 37853,
          59480: 37840,
          59481: 37832,
          59482: 37860,
          59483: 37914,
          59484: 37908,
          59485: 37907,
          59486: 37891,
          59487: 37895,
          59488: 37904,
          59489: 37942,
          59490: 37931,
          59491: 37941,
          59492: 37921,
          59493: 37946,
          59494: 37953,
          59495: 37970,
          59496: 37956,
          59497: 37979,
          59498: 37984,
          59499: 37986,
          59500: 37982,
          59501: 37994,
          59502: 37417,
          59503: 38e3,
          59504: 38005,
          59505: 38007,
          59506: 38013,
          59507: 37978,
          59508: 38012,
          59509: 38014,
          59510: 38017,
          59511: 38015,
          59512: 38274,
          59513: 38279,
          59514: 38282,
          59515: 38292,
          59516: 38294,
          59517: 38296,
          59518: 38297,
          59520: 38304,
          59521: 38312,
          59522: 38311,
          59523: 38317,
          59524: 38332,
          59525: 38331,
          59526: 38329,
          59527: 38334,
          59528: 38346,
          59529: 28662,
          59530: 38339,
          59531: 38349,
          59532: 38348,
          59533: 38357,
          59534: 38356,
          59535: 38358,
          59536: 38364,
          59537: 38369,
          59538: 38373,
          59539: 38370,
          59540: 38433,
          59541: 38440,
          59542: 38446,
          59543: 38447,
          59544: 38466,
          59545: 38476,
          59546: 38479,
          59547: 38475,
          59548: 38519,
          59549: 38492,
          59550: 38494,
          59551: 38493,
          59552: 38495,
          59553: 38502,
          59554: 38514,
          59555: 38508,
          59556: 38541,
          59557: 38552,
          59558: 38549,
          59559: 38551,
          59560: 38570,
          59561: 38567,
          59562: 38577,
          59563: 38578,
          59564: 38576,
          59565: 38580,
          59566: 38582,
          59567: 38584,
          59568: 38585,
          59569: 38606,
          59570: 38603,
          59571: 38601,
          59572: 38605,
          59573: 35149,
          59574: 38620,
          59575: 38669,
          59576: 38613,
          59577: 38649,
          59578: 38660,
          59579: 38662,
          59580: 38664,
          59581: 38675,
          59582: 38670,
          59583: 38673,
          59584: 38671,
          59585: 38678,
          59586: 38681,
          59587: 38692,
          59588: 38698,
          59589: 38704,
          59590: 38713,
          59591: 38717,
          59592: 38718,
          59593: 38724,
          59594: 38726,
          59595: 38728,
          59596: 38722,
          59597: 38729,
          59598: 38748,
          59599: 38752,
          59600: 38756,
          59601: 38758,
          59602: 38760,
          59603: 21202,
          59604: 38763,
          59605: 38769,
          59606: 38777,
          59607: 38789,
          59608: 38780,
          59609: 38785,
          59610: 38778,
          59611: 38790,
          59612: 38795,
          59613: 38799,
          59614: 38800,
          59615: 38812,
          59616: 38824,
          59617: 38822,
          59618: 38819,
          59619: 38835,
          59620: 38836,
          59621: 38851,
          59622: 38854,
          59623: 38856,
          59624: 38859,
          59625: 38876,
          59626: 38893,
          59627: 40783,
          59628: 38898,
          59629: 31455,
          59630: 38902,
          59631: 38901,
          59632: 38927,
          59633: 38924,
          59634: 38968,
          59635: 38948,
          59636: 38945,
          59637: 38967,
          59638: 38973,
          59639: 38982,
          59640: 38991,
          59641: 38987,
          59642: 39019,
          59643: 39023,
          59644: 39024,
          59712: 39025,
          59713: 39028,
          59714: 39027,
          59715: 39082,
          59716: 39087,
          59717: 39089,
          59718: 39094,
          59719: 39108,
          59720: 39107,
          59721: 39110,
          59722: 39145,
          59723: 39147,
          59724: 39171,
          59725: 39177,
          59726: 39186,
          59727: 39188,
          59728: 39192,
          59729: 39201,
          59730: 39197,
          59731: 39198,
          59732: 39204,
          59733: 39200,
          59734: 39212,
          59735: 39214,
          59736: 39229,
          59737: 39230,
          59738: 39234,
          59739: 39241,
          59740: 39237,
          59741: 39248,
          59742: 39243,
          59743: 39249,
          59744: 39250,
          59745: 39244,
          59746: 39253,
          59747: 39319,
          59748: 39320,
          59749: 39333,
          59750: 39341,
          59751: 39342,
          59752: 39356,
          59753: 39391,
          59754: 39387,
          59755: 39389,
          59756: 39384,
          59757: 39377,
          59758: 39405,
          59759: 39406,
          59760: 39409,
          59761: 39410,
          59762: 39419,
          59763: 39416,
          59764: 39425,
          59765: 39439,
          59766: 39429,
          59767: 39394,
          59768: 39449,
          59769: 39467,
          59770: 39479,
          59771: 39493,
          59772: 39490,
          59773: 39488,
          59774: 39491,
          59776: 39486,
          59777: 39509,
          59778: 39501,
          59779: 39515,
          59780: 39511,
          59781: 39519,
          59782: 39522,
          59783: 39525,
          59784: 39524,
          59785: 39529,
          59786: 39531,
          59787: 39530,
          59788: 39597,
          59789: 39600,
          59790: 39612,
          59791: 39616,
          59792: 39631,
          59793: 39633,
          59794: 39635,
          59795: 39636,
          59796: 39646,
          59797: 39647,
          59798: 39650,
          59799: 39651,
          59800: 39654,
          59801: 39663,
          59802: 39659,
          59803: 39662,
          59804: 39668,
          59805: 39665,
          59806: 39671,
          59807: 39675,
          59808: 39686,
          59809: 39704,
          59810: 39706,
          59811: 39711,
          59812: 39714,
          59813: 39715,
          59814: 39717,
          59815: 39719,
          59816: 39720,
          59817: 39721,
          59818: 39722,
          59819: 39726,
          59820: 39727,
          59821: 39730,
          59822: 39748,
          59823: 39747,
          59824: 39759,
          59825: 39757,
          59826: 39758,
          59827: 39761,
          59828: 39768,
          59829: 39796,
          59830: 39827,
          59831: 39811,
          59832: 39825,
          59833: 39830,
          59834: 39831,
          59835: 39839,
          59836: 39840,
          59837: 39848,
          59838: 39860,
          59839: 39872,
          59840: 39882,
          59841: 39865,
          59842: 39878,
          59843: 39887,
          59844: 39889,
          59845: 39890,
          59846: 39907,
          59847: 39906,
          59848: 39908,
          59849: 39892,
          59850: 39905,
          59851: 39994,
          59852: 39922,
          59853: 39921,
          59854: 39920,
          59855: 39957,
          59856: 39956,
          59857: 39945,
          59858: 39955,
          59859: 39948,
          59860: 39942,
          59861: 39944,
          59862: 39954,
          59863: 39946,
          59864: 39940,
          59865: 39982,
          59866: 39963,
          59867: 39973,
          59868: 39972,
          59869: 39969,
          59870: 39984,
          59871: 40007,
          59872: 39986,
          59873: 40006,
          59874: 39998,
          59875: 40026,
          59876: 40032,
          59877: 40039,
          59878: 40054,
          59879: 40056,
          59880: 40167,
          59881: 40172,
          59882: 40176,
          59883: 40201,
          59884: 40200,
          59885: 40171,
          59886: 40195,
          59887: 40198,
          59888: 40234,
          59889: 40230,
          59890: 40367,
          59891: 40227,
          59892: 40223,
          59893: 40260,
          59894: 40213,
          59895: 40210,
          59896: 40257,
          59897: 40255,
          59898: 40254,
          59899: 40262,
          59900: 40264,
          59968: 40285,
          59969: 40286,
          59970: 40292,
          59971: 40273,
          59972: 40272,
          59973: 40281,
          59974: 40306,
          59975: 40329,
          59976: 40327,
          59977: 40363,
          59978: 40303,
          59979: 40314,
          59980: 40346,
          59981: 40356,
          59982: 40361,
          59983: 40370,
          59984: 40388,
          59985: 40385,
          59986: 40379,
          59987: 40376,
          59988: 40378,
          59989: 40390,
          59990: 40399,
          59991: 40386,
          59992: 40409,
          59993: 40403,
          59994: 40440,
          59995: 40422,
          59996: 40429,
          59997: 40431,
          59998: 40445,
          59999: 40474,
          6e4: 40475,
          60001: 40478,
          60002: 40565,
          60003: 40569,
          60004: 40573,
          60005: 40577,
          60006: 40584,
          60007: 40587,
          60008: 40588,
          60009: 40594,
          60010: 40597,
          60011: 40593,
          60012: 40605,
          60013: 40613,
          60014: 40617,
          60015: 40632,
          60016: 40618,
          60017: 40621,
          60018: 38753,
          60019: 40652,
          60020: 40654,
          60021: 40655,
          60022: 40656,
          60023: 40660,
          60024: 40668,
          60025: 40670,
          60026: 40669,
          60027: 40672,
          60028: 40677,
          60029: 40680,
          60030: 40687,
          60032: 40692,
          60033: 40694,
          60034: 40695,
          60035: 40697,
          60036: 40699,
          60037: 40700,
          60038: 40701,
          60039: 40711,
          60040: 40712,
          60041: 30391,
          60042: 40725,
          60043: 40737,
          60044: 40748,
          60045: 40766,
          60046: 40778,
          60047: 40786,
          60048: 40788,
          60049: 40803,
          60050: 40799,
          60051: 40800,
          60052: 40801,
          60053: 40806,
          60054: 40807,
          60055: 40812,
          60056: 40810,
          60057: 40823,
          60058: 40818,
          60059: 40822,
          60060: 40853,
          60061: 40860,
          60062: 40864,
          60063: 22575,
          60064: 27079,
          60065: 36953,
          60066: 29796,
          60067: 20956,
          60068: 29081
        };
      }),
      /* 9 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var GenericGF_1 = __webpack_require__(1);
        var GenericGFPoly_1 = __webpack_require__(2);
        function runEuclideanAlgorithm(field, a, b, R) {
          var _a;
          if (a.degree() < b.degree()) {
            _a = [b, a], a = _a[0], b = _a[1];
          }
          var rLast = a;
          var r = b;
          var tLast = field.zero;
          var t = field.one;
          while (r.degree() >= R / 2) {
            var rLastLast = rLast;
            var tLastLast = tLast;
            rLast = r;
            tLast = t;
            if (rLast.isZero()) {
              return null;
            }
            r = rLastLast;
            var q = field.zero;
            var denominatorLeadingTerm = rLast.getCoefficient(rLast.degree());
            var dltInverse = field.inverse(denominatorLeadingTerm);
            while (r.degree() >= rLast.degree() && !r.isZero()) {
              var degreeDiff = r.degree() - rLast.degree();
              var scale = field.multiply(r.getCoefficient(r.degree()), dltInverse);
              q = q.addOrSubtract(field.buildMonomial(degreeDiff, scale));
              r = r.addOrSubtract(rLast.multiplyByMonomial(degreeDiff, scale));
            }
            t = q.multiplyPoly(tLast).addOrSubtract(tLastLast);
            if (r.degree() >= rLast.degree()) {
              return null;
            }
          }
          var sigmaTildeAtZero = t.getCoefficient(0);
          if (sigmaTildeAtZero === 0) {
            return null;
          }
          var inverse = field.inverse(sigmaTildeAtZero);
          return [t.multiply(inverse), r.multiply(inverse)];
        }
        function findErrorLocations(field, errorLocator) {
          var numErrors = errorLocator.degree();
          if (numErrors === 1) {
            return [errorLocator.getCoefficient(1)];
          }
          var result = new Array(numErrors);
          var errorCount = 0;
          for (var i = 1; i < field.size && errorCount < numErrors; i++) {
            if (errorLocator.evaluateAt(i) === 0) {
              result[errorCount] = field.inverse(i);
              errorCount++;
            }
          }
          if (errorCount !== numErrors) {
            return null;
          }
          return result;
        }
        function findErrorMagnitudes(field, errorEvaluator, errorLocations) {
          var s = errorLocations.length;
          var result = new Array(s);
          for (var i = 0; i < s; i++) {
            var xiInverse = field.inverse(errorLocations[i]);
            var denominator = 1;
            for (var j = 0; j < s; j++) {
              if (i !== j) {
                denominator = field.multiply(denominator, GenericGF_1.addOrSubtractGF(1, field.multiply(errorLocations[j], xiInverse)));
              }
            }
            result[i] = field.multiply(errorEvaluator.evaluateAt(xiInverse), field.inverse(denominator));
            if (field.generatorBase !== 0) {
              result[i] = field.multiply(result[i], xiInverse);
            }
          }
          return result;
        }
        function decode(bytes, twoS) {
          var outputBytes = new Uint8ClampedArray(bytes.length);
          outputBytes.set(bytes);
          var field = new GenericGF_1.default(285, 256, 0);
          var poly = new GenericGFPoly_1.default(field, outputBytes);
          var syndromeCoefficients = new Uint8ClampedArray(twoS);
          var error = false;
          for (var s = 0; s < twoS; s++) {
            var evaluation = poly.evaluateAt(field.exp(s + field.generatorBase));
            syndromeCoefficients[syndromeCoefficients.length - 1 - s] = evaluation;
            if (evaluation !== 0) {
              error = true;
            }
          }
          if (!error) {
            return outputBytes;
          }
          var syndrome = new GenericGFPoly_1.default(field, syndromeCoefficients);
          var sigmaOmega = runEuclideanAlgorithm(field, field.buildMonomial(twoS, 1), syndrome, twoS);
          if (sigmaOmega === null) {
            return null;
          }
          var errorLocations = findErrorLocations(field, sigmaOmega[0]);
          if (errorLocations == null) {
            return null;
          }
          var errorMagnitudes = findErrorMagnitudes(field, sigmaOmega[1], errorLocations);
          for (var i = 0; i < errorLocations.length; i++) {
            var position = outputBytes.length - 1 - field.log(errorLocations[i]);
            if (position < 0) {
              return null;
            }
            outputBytes[position] = GenericGF_1.addOrSubtractGF(outputBytes[position], errorMagnitudes[i]);
          }
          return outputBytes;
        }
        exports2.decode = decode;
      }),
      /* 10 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        exports2.VERSIONS = [
          {
            infoBits: null,
            versionNumber: 1,
            alignmentPatternCenters: [],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 7,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 19 }]
              },
              {
                ecCodewordsPerBlock: 10,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 16 }]
              },
              {
                ecCodewordsPerBlock: 13,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 13 }]
              },
              {
                ecCodewordsPerBlock: 17,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 9 }]
              }
            ]
          },
          {
            infoBits: null,
            versionNumber: 2,
            alignmentPatternCenters: [6, 18],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 10,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 34 }]
              },
              {
                ecCodewordsPerBlock: 16,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 28 }]
              },
              {
                ecCodewordsPerBlock: 22,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 22 }]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 16 }]
              }
            ]
          },
          {
            infoBits: null,
            versionNumber: 3,
            alignmentPatternCenters: [6, 22],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 15,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 55 }]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 44 }]
              },
              {
                ecCodewordsPerBlock: 18,
                ecBlocks: [{ numBlocks: 2, dataCodewordsPerBlock: 17 }]
              },
              {
                ecCodewordsPerBlock: 22,
                ecBlocks: [{ numBlocks: 2, dataCodewordsPerBlock: 13 }]
              }
            ]
          },
          {
            infoBits: null,
            versionNumber: 4,
            alignmentPatternCenters: [6, 26],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 20,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 80 }]
              },
              {
                ecCodewordsPerBlock: 18,
                ecBlocks: [{ numBlocks: 2, dataCodewordsPerBlock: 32 }]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [{ numBlocks: 2, dataCodewordsPerBlock: 24 }]
              },
              {
                ecCodewordsPerBlock: 16,
                ecBlocks: [{ numBlocks: 4, dataCodewordsPerBlock: 9 }]
              }
            ]
          },
          {
            infoBits: null,
            versionNumber: 5,
            alignmentPatternCenters: [6, 30],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [{ numBlocks: 1, dataCodewordsPerBlock: 108 }]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [{ numBlocks: 2, dataCodewordsPerBlock: 43 }]
              },
              {
                ecCodewordsPerBlock: 18,
                ecBlocks: [
                  { numBlocks: 2, dataCodewordsPerBlock: 15 },
                  { numBlocks: 2, dataCodewordsPerBlock: 16 }
                ]
              },
              {
                ecCodewordsPerBlock: 22,
                ecBlocks: [
                  { numBlocks: 2, dataCodewordsPerBlock: 11 },
                  { numBlocks: 2, dataCodewordsPerBlock: 12 }
                ]
              }
            ]
          },
          {
            infoBits: null,
            versionNumber: 6,
            alignmentPatternCenters: [6, 34],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 18,
                ecBlocks: [{ numBlocks: 2, dataCodewordsPerBlock: 68 }]
              },
              {
                ecCodewordsPerBlock: 16,
                ecBlocks: [{ numBlocks: 4, dataCodewordsPerBlock: 27 }]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [{ numBlocks: 4, dataCodewordsPerBlock: 19 }]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [{ numBlocks: 4, dataCodewordsPerBlock: 15 }]
              }
            ]
          },
          {
            infoBits: 31892,
            versionNumber: 7,
            alignmentPatternCenters: [6, 22, 38],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 20,
                ecBlocks: [{ numBlocks: 2, dataCodewordsPerBlock: 78 }]
              },
              {
                ecCodewordsPerBlock: 18,
                ecBlocks: [{ numBlocks: 4, dataCodewordsPerBlock: 31 }]
              },
              {
                ecCodewordsPerBlock: 18,
                ecBlocks: [
                  { numBlocks: 2, dataCodewordsPerBlock: 14 },
                  { numBlocks: 4, dataCodewordsPerBlock: 15 }
                ]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 13 },
                  { numBlocks: 1, dataCodewordsPerBlock: 14 }
                ]
              }
            ]
          },
          {
            infoBits: 34236,
            versionNumber: 8,
            alignmentPatternCenters: [6, 24, 42],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [{ numBlocks: 2, dataCodewordsPerBlock: 97 }]
              },
              {
                ecCodewordsPerBlock: 22,
                ecBlocks: [
                  { numBlocks: 2, dataCodewordsPerBlock: 38 },
                  { numBlocks: 2, dataCodewordsPerBlock: 39 }
                ]
              },
              {
                ecCodewordsPerBlock: 22,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 18 },
                  { numBlocks: 2, dataCodewordsPerBlock: 19 }
                ]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 14 },
                  { numBlocks: 2, dataCodewordsPerBlock: 15 }
                ]
              }
            ]
          },
          {
            infoBits: 39577,
            versionNumber: 9,
            alignmentPatternCenters: [6, 26, 46],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [{ numBlocks: 2, dataCodewordsPerBlock: 116 }]
              },
              {
                ecCodewordsPerBlock: 22,
                ecBlocks: [
                  { numBlocks: 3, dataCodewordsPerBlock: 36 },
                  { numBlocks: 2, dataCodewordsPerBlock: 37 }
                ]
              },
              {
                ecCodewordsPerBlock: 20,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 16 },
                  { numBlocks: 4, dataCodewordsPerBlock: 17 }
                ]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 12 },
                  { numBlocks: 4, dataCodewordsPerBlock: 13 }
                ]
              }
            ]
          },
          {
            infoBits: 42195,
            versionNumber: 10,
            alignmentPatternCenters: [6, 28, 50],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 18,
                ecBlocks: [
                  { numBlocks: 2, dataCodewordsPerBlock: 68 },
                  { numBlocks: 2, dataCodewordsPerBlock: 69 }
                ]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 43 },
                  { numBlocks: 1, dataCodewordsPerBlock: 44 }
                ]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [
                  { numBlocks: 6, dataCodewordsPerBlock: 19 },
                  { numBlocks: 2, dataCodewordsPerBlock: 20 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 6, dataCodewordsPerBlock: 15 },
                  { numBlocks: 2, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 48118,
            versionNumber: 11,
            alignmentPatternCenters: [6, 30, 54],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 20,
                ecBlocks: [{ numBlocks: 4, dataCodewordsPerBlock: 81 }]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 1, dataCodewordsPerBlock: 50 },
                  { numBlocks: 4, dataCodewordsPerBlock: 51 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 22 },
                  { numBlocks: 4, dataCodewordsPerBlock: 23 }
                ]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [
                  { numBlocks: 3, dataCodewordsPerBlock: 12 },
                  { numBlocks: 8, dataCodewordsPerBlock: 13 }
                ]
              }
            ]
          },
          {
            infoBits: 51042,
            versionNumber: 12,
            alignmentPatternCenters: [6, 32, 58],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [
                  { numBlocks: 2, dataCodewordsPerBlock: 92 },
                  { numBlocks: 2, dataCodewordsPerBlock: 93 }
                ]
              },
              {
                ecCodewordsPerBlock: 22,
                ecBlocks: [
                  { numBlocks: 6, dataCodewordsPerBlock: 36 },
                  { numBlocks: 2, dataCodewordsPerBlock: 37 }
                ]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 20 },
                  { numBlocks: 6, dataCodewordsPerBlock: 21 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 7, dataCodewordsPerBlock: 14 },
                  { numBlocks: 4, dataCodewordsPerBlock: 15 }
                ]
              }
            ]
          },
          {
            infoBits: 55367,
            versionNumber: 13,
            alignmentPatternCenters: [6, 34, 62],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [{ numBlocks: 4, dataCodewordsPerBlock: 107 }]
              },
              {
                ecCodewordsPerBlock: 22,
                ecBlocks: [
                  { numBlocks: 8, dataCodewordsPerBlock: 37 },
                  { numBlocks: 1, dataCodewordsPerBlock: 38 }
                ]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [
                  { numBlocks: 8, dataCodewordsPerBlock: 20 },
                  { numBlocks: 4, dataCodewordsPerBlock: 21 }
                ]
              },
              {
                ecCodewordsPerBlock: 22,
                ecBlocks: [
                  { numBlocks: 12, dataCodewordsPerBlock: 11 },
                  { numBlocks: 4, dataCodewordsPerBlock: 12 }
                ]
              }
            ]
          },
          {
            infoBits: 58893,
            versionNumber: 14,
            alignmentPatternCenters: [6, 26, 46, 66],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 3, dataCodewordsPerBlock: 115 },
                  { numBlocks: 1, dataCodewordsPerBlock: 116 }
                ]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 40 },
                  { numBlocks: 5, dataCodewordsPerBlock: 41 }
                ]
              },
              {
                ecCodewordsPerBlock: 20,
                ecBlocks: [
                  { numBlocks: 11, dataCodewordsPerBlock: 16 },
                  { numBlocks: 5, dataCodewordsPerBlock: 17 }
                ]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [
                  { numBlocks: 11, dataCodewordsPerBlock: 12 },
                  { numBlocks: 5, dataCodewordsPerBlock: 13 }
                ]
              }
            ]
          },
          {
            infoBits: 63784,
            versionNumber: 15,
            alignmentPatternCenters: [6, 26, 48, 70],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 22,
                ecBlocks: [
                  { numBlocks: 5, dataCodewordsPerBlock: 87 },
                  { numBlocks: 1, dataCodewordsPerBlock: 88 }
                ]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [
                  { numBlocks: 5, dataCodewordsPerBlock: 41 },
                  { numBlocks: 5, dataCodewordsPerBlock: 42 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 5, dataCodewordsPerBlock: 24 },
                  { numBlocks: 7, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [
                  { numBlocks: 11, dataCodewordsPerBlock: 12 },
                  { numBlocks: 7, dataCodewordsPerBlock: 13 }
                ]
              }
            ]
          },
          {
            infoBits: 68472,
            versionNumber: 16,
            alignmentPatternCenters: [6, 26, 50, 74],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [
                  { numBlocks: 5, dataCodewordsPerBlock: 98 },
                  { numBlocks: 1, dataCodewordsPerBlock: 99 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 7, dataCodewordsPerBlock: 45 },
                  { numBlocks: 3, dataCodewordsPerBlock: 46 }
                ]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [
                  { numBlocks: 15, dataCodewordsPerBlock: 19 },
                  { numBlocks: 2, dataCodewordsPerBlock: 20 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 3, dataCodewordsPerBlock: 15 },
                  { numBlocks: 13, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 70749,
            versionNumber: 17,
            alignmentPatternCenters: [6, 30, 54, 78],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 1, dataCodewordsPerBlock: 107 },
                  { numBlocks: 5, dataCodewordsPerBlock: 108 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 10, dataCodewordsPerBlock: 46 },
                  { numBlocks: 1, dataCodewordsPerBlock: 47 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 1, dataCodewordsPerBlock: 22 },
                  { numBlocks: 15, dataCodewordsPerBlock: 23 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 2, dataCodewordsPerBlock: 14 },
                  { numBlocks: 17, dataCodewordsPerBlock: 15 }
                ]
              }
            ]
          },
          {
            infoBits: 76311,
            versionNumber: 18,
            alignmentPatternCenters: [6, 30, 56, 82],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 5, dataCodewordsPerBlock: 120 },
                  { numBlocks: 1, dataCodewordsPerBlock: 121 }
                ]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [
                  { numBlocks: 9, dataCodewordsPerBlock: 43 },
                  { numBlocks: 4, dataCodewordsPerBlock: 44 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 17, dataCodewordsPerBlock: 22 },
                  { numBlocks: 1, dataCodewordsPerBlock: 23 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 2, dataCodewordsPerBlock: 14 },
                  { numBlocks: 19, dataCodewordsPerBlock: 15 }
                ]
              }
            ]
          },
          {
            infoBits: 79154,
            versionNumber: 19,
            alignmentPatternCenters: [6, 30, 58, 86],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 3, dataCodewordsPerBlock: 113 },
                  { numBlocks: 4, dataCodewordsPerBlock: 114 }
                ]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [
                  { numBlocks: 3, dataCodewordsPerBlock: 44 },
                  { numBlocks: 11, dataCodewordsPerBlock: 45 }
                ]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [
                  { numBlocks: 17, dataCodewordsPerBlock: 21 },
                  { numBlocks: 4, dataCodewordsPerBlock: 22 }
                ]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [
                  { numBlocks: 9, dataCodewordsPerBlock: 13 },
                  { numBlocks: 16, dataCodewordsPerBlock: 14 }
                ]
              }
            ]
          },
          {
            infoBits: 84390,
            versionNumber: 20,
            alignmentPatternCenters: [6, 34, 62, 90],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 3, dataCodewordsPerBlock: 107 },
                  { numBlocks: 5, dataCodewordsPerBlock: 108 }
                ]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [
                  { numBlocks: 3, dataCodewordsPerBlock: 41 },
                  { numBlocks: 13, dataCodewordsPerBlock: 42 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 15, dataCodewordsPerBlock: 24 },
                  { numBlocks: 5, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 15, dataCodewordsPerBlock: 15 },
                  { numBlocks: 10, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 87683,
            versionNumber: 21,
            alignmentPatternCenters: [6, 28, 50, 72, 94],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 116 },
                  { numBlocks: 4, dataCodewordsPerBlock: 117 }
                ]
              },
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [{ numBlocks: 17, dataCodewordsPerBlock: 42 }]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 17, dataCodewordsPerBlock: 22 },
                  { numBlocks: 6, dataCodewordsPerBlock: 23 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 19, dataCodewordsPerBlock: 16 },
                  { numBlocks: 6, dataCodewordsPerBlock: 17 }
                ]
              }
            ]
          },
          {
            infoBits: 92361,
            versionNumber: 22,
            alignmentPatternCenters: [6, 26, 50, 74, 98],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 2, dataCodewordsPerBlock: 111 },
                  { numBlocks: 7, dataCodewordsPerBlock: 112 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [{ numBlocks: 17, dataCodewordsPerBlock: 46 }]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 7, dataCodewordsPerBlock: 24 },
                  { numBlocks: 16, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 24,
                ecBlocks: [{ numBlocks: 34, dataCodewordsPerBlock: 13 }]
              }
            ]
          },
          {
            infoBits: 96236,
            versionNumber: 23,
            alignmentPatternCenters: [6, 30, 54, 74, 102],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 121 },
                  { numBlocks: 5, dataCodewordsPerBlock: 122 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 47 },
                  { numBlocks: 14, dataCodewordsPerBlock: 48 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 11, dataCodewordsPerBlock: 24 },
                  { numBlocks: 14, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 16, dataCodewordsPerBlock: 15 },
                  { numBlocks: 14, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 102084,
            versionNumber: 24,
            alignmentPatternCenters: [6, 28, 54, 80, 106],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 6, dataCodewordsPerBlock: 117 },
                  { numBlocks: 4, dataCodewordsPerBlock: 118 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 6, dataCodewordsPerBlock: 45 },
                  { numBlocks: 14, dataCodewordsPerBlock: 46 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 11, dataCodewordsPerBlock: 24 },
                  { numBlocks: 16, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 30, dataCodewordsPerBlock: 16 },
                  { numBlocks: 2, dataCodewordsPerBlock: 17 }
                ]
              }
            ]
          },
          {
            infoBits: 102881,
            versionNumber: 25,
            alignmentPatternCenters: [6, 32, 58, 84, 110],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 26,
                ecBlocks: [
                  { numBlocks: 8, dataCodewordsPerBlock: 106 },
                  { numBlocks: 4, dataCodewordsPerBlock: 107 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 8, dataCodewordsPerBlock: 47 },
                  { numBlocks: 13, dataCodewordsPerBlock: 48 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 7, dataCodewordsPerBlock: 24 },
                  { numBlocks: 22, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 22, dataCodewordsPerBlock: 15 },
                  { numBlocks: 13, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 110507,
            versionNumber: 26,
            alignmentPatternCenters: [6, 30, 58, 86, 114],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 10, dataCodewordsPerBlock: 114 },
                  { numBlocks: 2, dataCodewordsPerBlock: 115 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 19, dataCodewordsPerBlock: 46 },
                  { numBlocks: 4, dataCodewordsPerBlock: 47 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 28, dataCodewordsPerBlock: 22 },
                  { numBlocks: 6, dataCodewordsPerBlock: 23 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 33, dataCodewordsPerBlock: 16 },
                  { numBlocks: 4, dataCodewordsPerBlock: 17 }
                ]
              }
            ]
          },
          {
            infoBits: 110734,
            versionNumber: 27,
            alignmentPatternCenters: [6, 34, 62, 90, 118],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 8, dataCodewordsPerBlock: 122 },
                  { numBlocks: 4, dataCodewordsPerBlock: 123 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 22, dataCodewordsPerBlock: 45 },
                  { numBlocks: 3, dataCodewordsPerBlock: 46 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 8, dataCodewordsPerBlock: 23 },
                  { numBlocks: 26, dataCodewordsPerBlock: 24 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 12, dataCodewordsPerBlock: 15 },
                  { numBlocks: 28, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 117786,
            versionNumber: 28,
            alignmentPatternCenters: [6, 26, 50, 74, 98, 122],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 3, dataCodewordsPerBlock: 117 },
                  { numBlocks: 10, dataCodewordsPerBlock: 118 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 3, dataCodewordsPerBlock: 45 },
                  { numBlocks: 23, dataCodewordsPerBlock: 46 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 24 },
                  { numBlocks: 31, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 11, dataCodewordsPerBlock: 15 },
                  { numBlocks: 31, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 119615,
            versionNumber: 29,
            alignmentPatternCenters: [6, 30, 54, 78, 102, 126],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 7, dataCodewordsPerBlock: 116 },
                  { numBlocks: 7, dataCodewordsPerBlock: 117 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 21, dataCodewordsPerBlock: 45 },
                  { numBlocks: 7, dataCodewordsPerBlock: 46 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 1, dataCodewordsPerBlock: 23 },
                  { numBlocks: 37, dataCodewordsPerBlock: 24 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 19, dataCodewordsPerBlock: 15 },
                  { numBlocks: 26, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 126325,
            versionNumber: 30,
            alignmentPatternCenters: [6, 26, 52, 78, 104, 130],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 5, dataCodewordsPerBlock: 115 },
                  { numBlocks: 10, dataCodewordsPerBlock: 116 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 19, dataCodewordsPerBlock: 47 },
                  { numBlocks: 10, dataCodewordsPerBlock: 48 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 15, dataCodewordsPerBlock: 24 },
                  { numBlocks: 25, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 23, dataCodewordsPerBlock: 15 },
                  { numBlocks: 25, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 127568,
            versionNumber: 31,
            alignmentPatternCenters: [6, 30, 56, 82, 108, 134],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 13, dataCodewordsPerBlock: 115 },
                  { numBlocks: 3, dataCodewordsPerBlock: 116 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 2, dataCodewordsPerBlock: 46 },
                  { numBlocks: 29, dataCodewordsPerBlock: 47 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 42, dataCodewordsPerBlock: 24 },
                  { numBlocks: 1, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 23, dataCodewordsPerBlock: 15 },
                  { numBlocks: 28, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 133589,
            versionNumber: 32,
            alignmentPatternCenters: [6, 34, 60, 86, 112, 138],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [{ numBlocks: 17, dataCodewordsPerBlock: 115 }]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 10, dataCodewordsPerBlock: 46 },
                  { numBlocks: 23, dataCodewordsPerBlock: 47 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 10, dataCodewordsPerBlock: 24 },
                  { numBlocks: 35, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 19, dataCodewordsPerBlock: 15 },
                  { numBlocks: 35, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 136944,
            versionNumber: 33,
            alignmentPatternCenters: [6, 30, 58, 86, 114, 142],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 17, dataCodewordsPerBlock: 115 },
                  { numBlocks: 1, dataCodewordsPerBlock: 116 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 14, dataCodewordsPerBlock: 46 },
                  { numBlocks: 21, dataCodewordsPerBlock: 47 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 29, dataCodewordsPerBlock: 24 },
                  { numBlocks: 19, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 11, dataCodewordsPerBlock: 15 },
                  { numBlocks: 46, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 141498,
            versionNumber: 34,
            alignmentPatternCenters: [6, 34, 62, 90, 118, 146],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 13, dataCodewordsPerBlock: 115 },
                  { numBlocks: 6, dataCodewordsPerBlock: 116 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 14, dataCodewordsPerBlock: 46 },
                  { numBlocks: 23, dataCodewordsPerBlock: 47 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 44, dataCodewordsPerBlock: 24 },
                  { numBlocks: 7, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 59, dataCodewordsPerBlock: 16 },
                  { numBlocks: 1, dataCodewordsPerBlock: 17 }
                ]
              }
            ]
          },
          {
            infoBits: 145311,
            versionNumber: 35,
            alignmentPatternCenters: [6, 30, 54, 78, 102, 126, 150],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 12, dataCodewordsPerBlock: 121 },
                  { numBlocks: 7, dataCodewordsPerBlock: 122 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 12, dataCodewordsPerBlock: 47 },
                  { numBlocks: 26, dataCodewordsPerBlock: 48 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 39, dataCodewordsPerBlock: 24 },
                  { numBlocks: 14, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 22, dataCodewordsPerBlock: 15 },
                  { numBlocks: 41, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 150283,
            versionNumber: 36,
            alignmentPatternCenters: [6, 24, 50, 76, 102, 128, 154],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 6, dataCodewordsPerBlock: 121 },
                  { numBlocks: 14, dataCodewordsPerBlock: 122 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 6, dataCodewordsPerBlock: 47 },
                  { numBlocks: 34, dataCodewordsPerBlock: 48 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 46, dataCodewordsPerBlock: 24 },
                  { numBlocks: 10, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 2, dataCodewordsPerBlock: 15 },
                  { numBlocks: 64, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 152622,
            versionNumber: 37,
            alignmentPatternCenters: [6, 28, 54, 80, 106, 132, 158],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 17, dataCodewordsPerBlock: 122 },
                  { numBlocks: 4, dataCodewordsPerBlock: 123 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 29, dataCodewordsPerBlock: 46 },
                  { numBlocks: 14, dataCodewordsPerBlock: 47 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 49, dataCodewordsPerBlock: 24 },
                  { numBlocks: 10, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 24, dataCodewordsPerBlock: 15 },
                  { numBlocks: 46, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 158308,
            versionNumber: 38,
            alignmentPatternCenters: [6, 32, 58, 84, 110, 136, 162],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 4, dataCodewordsPerBlock: 122 },
                  { numBlocks: 18, dataCodewordsPerBlock: 123 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 13, dataCodewordsPerBlock: 46 },
                  { numBlocks: 32, dataCodewordsPerBlock: 47 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 48, dataCodewordsPerBlock: 24 },
                  { numBlocks: 14, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 42, dataCodewordsPerBlock: 15 },
                  { numBlocks: 32, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 161089,
            versionNumber: 39,
            alignmentPatternCenters: [6, 26, 54, 82, 110, 138, 166],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 20, dataCodewordsPerBlock: 117 },
                  { numBlocks: 4, dataCodewordsPerBlock: 118 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 40, dataCodewordsPerBlock: 47 },
                  { numBlocks: 7, dataCodewordsPerBlock: 48 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 43, dataCodewordsPerBlock: 24 },
                  { numBlocks: 22, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 10, dataCodewordsPerBlock: 15 },
                  { numBlocks: 67, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          },
          {
            infoBits: 167017,
            versionNumber: 40,
            alignmentPatternCenters: [6, 30, 58, 86, 114, 142, 170],
            errorCorrectionLevels: [
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 19, dataCodewordsPerBlock: 118 },
                  { numBlocks: 6, dataCodewordsPerBlock: 119 }
                ]
              },
              {
                ecCodewordsPerBlock: 28,
                ecBlocks: [
                  { numBlocks: 18, dataCodewordsPerBlock: 47 },
                  { numBlocks: 31, dataCodewordsPerBlock: 48 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 34, dataCodewordsPerBlock: 24 },
                  { numBlocks: 34, dataCodewordsPerBlock: 25 }
                ]
              },
              {
                ecCodewordsPerBlock: 30,
                ecBlocks: [
                  { numBlocks: 20, dataCodewordsPerBlock: 15 },
                  { numBlocks: 61, dataCodewordsPerBlock: 16 }
                ]
              }
            ]
          }
        ];
      }),
      /* 11 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var BitMatrix_1 = __webpack_require__(0);
        function squareToQuadrilateral(p1, p2, p3, p4) {
          var dx3 = p1.x - p2.x + p3.x - p4.x;
          var dy3 = p1.y - p2.y + p3.y - p4.y;
          if (dx3 === 0 && dy3 === 0) {
            return {
              a11: p2.x - p1.x,
              a12: p2.y - p1.y,
              a13: 0,
              a21: p3.x - p2.x,
              a22: p3.y - p2.y,
              a23: 0,
              a31: p1.x,
              a32: p1.y,
              a33: 1
            };
          } else {
            var dx1 = p2.x - p3.x;
            var dx2 = p4.x - p3.x;
            var dy1 = p2.y - p3.y;
            var dy2 = p4.y - p3.y;
            var denominator = dx1 * dy2 - dx2 * dy1;
            var a13 = (dx3 * dy2 - dx2 * dy3) / denominator;
            var a23 = (dx1 * dy3 - dx3 * dy1) / denominator;
            return {
              a11: p2.x - p1.x + a13 * p2.x,
              a12: p2.y - p1.y + a13 * p2.y,
              a13,
              a21: p4.x - p1.x + a23 * p4.x,
              a22: p4.y - p1.y + a23 * p4.y,
              a23,
              a31: p1.x,
              a32: p1.y,
              a33: 1
            };
          }
        }
        function quadrilateralToSquare(p1, p2, p3, p4) {
          var sToQ = squareToQuadrilateral(p1, p2, p3, p4);
          return {
            a11: sToQ.a22 * sToQ.a33 - sToQ.a23 * sToQ.a32,
            a12: sToQ.a13 * sToQ.a32 - sToQ.a12 * sToQ.a33,
            a13: sToQ.a12 * sToQ.a23 - sToQ.a13 * sToQ.a22,
            a21: sToQ.a23 * sToQ.a31 - sToQ.a21 * sToQ.a33,
            a22: sToQ.a11 * sToQ.a33 - sToQ.a13 * sToQ.a31,
            a23: sToQ.a13 * sToQ.a21 - sToQ.a11 * sToQ.a23,
            a31: sToQ.a21 * sToQ.a32 - sToQ.a22 * sToQ.a31,
            a32: sToQ.a12 * sToQ.a31 - sToQ.a11 * sToQ.a32,
            a33: sToQ.a11 * sToQ.a22 - sToQ.a12 * sToQ.a21
          };
        }
        function times(a, b) {
          return {
            a11: a.a11 * b.a11 + a.a21 * b.a12 + a.a31 * b.a13,
            a12: a.a12 * b.a11 + a.a22 * b.a12 + a.a32 * b.a13,
            a13: a.a13 * b.a11 + a.a23 * b.a12 + a.a33 * b.a13,
            a21: a.a11 * b.a21 + a.a21 * b.a22 + a.a31 * b.a23,
            a22: a.a12 * b.a21 + a.a22 * b.a22 + a.a32 * b.a23,
            a23: a.a13 * b.a21 + a.a23 * b.a22 + a.a33 * b.a23,
            a31: a.a11 * b.a31 + a.a21 * b.a32 + a.a31 * b.a33,
            a32: a.a12 * b.a31 + a.a22 * b.a32 + a.a32 * b.a33,
            a33: a.a13 * b.a31 + a.a23 * b.a32 + a.a33 * b.a33
          };
        }
        function extract(image, location2) {
          var qToS = quadrilateralToSquare({ x: 3.5, y: 3.5 }, { x: location2.dimension - 3.5, y: 3.5 }, { x: location2.dimension - 6.5, y: location2.dimension - 6.5 }, { x: 3.5, y: location2.dimension - 3.5 });
          var sToQ = squareToQuadrilateral(location2.topLeft, location2.topRight, location2.alignmentPattern, location2.bottomLeft);
          var transform = times(sToQ, qToS);
          var matrix = BitMatrix_1.BitMatrix.createEmpty(location2.dimension, location2.dimension);
          var mappingFunction = function(x2, y2) {
            var denominator = transform.a13 * x2 + transform.a23 * y2 + transform.a33;
            return {
              x: (transform.a11 * x2 + transform.a21 * y2 + transform.a31) / denominator,
              y: (transform.a12 * x2 + transform.a22 * y2 + transform.a32) / denominator
            };
          };
          for (var y = 0; y < location2.dimension; y++) {
            for (var x = 0; x < location2.dimension; x++) {
              var xValue = x + 0.5;
              var yValue = y + 0.5;
              var sourcePixel = mappingFunction(xValue, yValue);
              matrix.set(x, y, image.get(Math.floor(sourcePixel.x), Math.floor(sourcePixel.y)));
            }
          }
          return {
            matrix,
            mappingFunction
          };
        }
        exports2.extract = extract;
      }),
      /* 12 */
      /***/
      (function(module2, exports2, __webpack_require__) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var MAX_FINDERPATTERNS_TO_SEARCH = 4;
        var MIN_QUAD_RATIO = 0.5;
        var MAX_QUAD_RATIO = 1.5;
        var distance = function(a, b) {
          return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
        };
        function sum2(values) {
          return values.reduce(function(a, b) {
            return a + b;
          });
        }
        function reorderFinderPatterns(pattern1, pattern2, pattern3) {
          var _a, _b, _c, _d;
          var oneTwoDistance = distance(pattern1, pattern2);
          var twoThreeDistance = distance(pattern2, pattern3);
          var oneThreeDistance = distance(pattern1, pattern3);
          var bottomLeft;
          var topLeft;
          var topRight;
          if (twoThreeDistance >= oneTwoDistance && twoThreeDistance >= oneThreeDistance) {
            _a = [pattern2, pattern1, pattern3], bottomLeft = _a[0], topLeft = _a[1], topRight = _a[2];
          } else if (oneThreeDistance >= twoThreeDistance && oneThreeDistance >= oneTwoDistance) {
            _b = [pattern1, pattern2, pattern3], bottomLeft = _b[0], topLeft = _b[1], topRight = _b[2];
          } else {
            _c = [pattern1, pattern3, pattern2], bottomLeft = _c[0], topLeft = _c[1], topRight = _c[2];
          }
          if ((topRight.x - topLeft.x) * (bottomLeft.y - topLeft.y) - (topRight.y - topLeft.y) * (bottomLeft.x - topLeft.x) < 0) {
            _d = [topRight, bottomLeft], bottomLeft = _d[0], topRight = _d[1];
          }
          return { bottomLeft, topLeft, topRight };
        }
        function computeDimension(topLeft, topRight, bottomLeft, matrix) {
          var moduleSize = (sum2(countBlackWhiteRun(topLeft, bottomLeft, matrix, 5)) / 7 + // Divide by 7 since the ratio is 1:1:3:1:1
          sum2(countBlackWhiteRun(topLeft, topRight, matrix, 5)) / 7 + sum2(countBlackWhiteRun(bottomLeft, topLeft, matrix, 5)) / 7 + sum2(countBlackWhiteRun(topRight, topLeft, matrix, 5)) / 7) / 4;
          if (moduleSize < 1) {
            throw new Error("Invalid module size");
          }
          var topDimension = Math.round(distance(topLeft, topRight) / moduleSize);
          var sideDimension = Math.round(distance(topLeft, bottomLeft) / moduleSize);
          var dimension = Math.floor((topDimension + sideDimension) / 2) + 7;
          switch (dimension % 4) {
            case 0:
              dimension++;
              break;
            case 2:
              dimension--;
              break;
          }
          return { dimension, moduleSize };
        }
        function countBlackWhiteRunTowardsPoint(origin, end, matrix, length) {
          var switchPoints = [{ x: Math.floor(origin.x), y: Math.floor(origin.y) }];
          var steep = Math.abs(end.y - origin.y) > Math.abs(end.x - origin.x);
          var fromX;
          var fromY;
          var toX;
          var toY;
          if (steep) {
            fromX = Math.floor(origin.y);
            fromY = Math.floor(origin.x);
            toX = Math.floor(end.y);
            toY = Math.floor(end.x);
          } else {
            fromX = Math.floor(origin.x);
            fromY = Math.floor(origin.y);
            toX = Math.floor(end.x);
            toY = Math.floor(end.y);
          }
          var dx = Math.abs(toX - fromX);
          var dy = Math.abs(toY - fromY);
          var error = Math.floor(-dx / 2);
          var xStep = fromX < toX ? 1 : -1;
          var yStep = fromY < toY ? 1 : -1;
          var currentPixel = true;
          for (var x = fromX, y = fromY; x !== toX + xStep; x += xStep) {
            var realX = steep ? y : x;
            var realY = steep ? x : y;
            if (matrix.get(realX, realY) !== currentPixel) {
              currentPixel = !currentPixel;
              switchPoints.push({ x: realX, y: realY });
              if (switchPoints.length === length + 1) {
                break;
              }
            }
            error += dy;
            if (error > 0) {
              if (y === toY) {
                break;
              }
              y += yStep;
              error -= dx;
            }
          }
          var distances = [];
          for (var i = 0; i < length; i++) {
            if (switchPoints[i] && switchPoints[i + 1]) {
              distances.push(distance(switchPoints[i], switchPoints[i + 1]));
            } else {
              distances.push(0);
            }
          }
          return distances;
        }
        function countBlackWhiteRun(origin, end, matrix, length) {
          var _a;
          var rise = end.y - origin.y;
          var run = end.x - origin.x;
          var towardsEnd = countBlackWhiteRunTowardsPoint(origin, end, matrix, Math.ceil(length / 2));
          var awayFromEnd = countBlackWhiteRunTowardsPoint(origin, { x: origin.x - run, y: origin.y - rise }, matrix, Math.ceil(length / 2));
          var middleValue = towardsEnd.shift() + awayFromEnd.shift() - 1;
          return (_a = awayFromEnd.concat(middleValue)).concat.apply(_a, towardsEnd);
        }
        function scoreBlackWhiteRun(sequence, ratios) {
          var averageSize = sum2(sequence) / sum2(ratios);
          var error = 0;
          ratios.forEach(function(ratio, i) {
            error += Math.pow(sequence[i] - ratio * averageSize, 2);
          });
          return { averageSize, error };
        }
        function scorePattern(point, ratios, matrix) {
          try {
            var horizontalRun = countBlackWhiteRun(point, { x: -1, y: point.y }, matrix, ratios.length);
            var verticalRun = countBlackWhiteRun(point, { x: point.x, y: -1 }, matrix, ratios.length);
            var topLeftPoint = {
              x: Math.max(0, point.x - point.y) - 1,
              y: Math.max(0, point.y - point.x) - 1
            };
            var topLeftBottomRightRun = countBlackWhiteRun(point, topLeftPoint, matrix, ratios.length);
            var bottomLeftPoint = {
              x: Math.min(matrix.width, point.x + point.y) + 1,
              y: Math.min(matrix.height, point.y + point.x) + 1
            };
            var bottomLeftTopRightRun = countBlackWhiteRun(point, bottomLeftPoint, matrix, ratios.length);
            var horzError = scoreBlackWhiteRun(horizontalRun, ratios);
            var vertError = scoreBlackWhiteRun(verticalRun, ratios);
            var diagDownError = scoreBlackWhiteRun(topLeftBottomRightRun, ratios);
            var diagUpError = scoreBlackWhiteRun(bottomLeftTopRightRun, ratios);
            var ratioError = Math.sqrt(horzError.error * horzError.error + vertError.error * vertError.error + diagDownError.error * diagDownError.error + diagUpError.error * diagUpError.error);
            var avgSize = (horzError.averageSize + vertError.averageSize + diagDownError.averageSize + diagUpError.averageSize) / 4;
            var sizeError = (Math.pow(horzError.averageSize - avgSize, 2) + Math.pow(vertError.averageSize - avgSize, 2) + Math.pow(diagDownError.averageSize - avgSize, 2) + Math.pow(diagUpError.averageSize - avgSize, 2)) / avgSize;
            return ratioError + sizeError;
          } catch (_a) {
            return Infinity;
          }
        }
        function recenterLocation(matrix, p) {
          var leftX = Math.round(p.x);
          while (matrix.get(leftX, Math.round(p.y))) {
            leftX--;
          }
          var rightX = Math.round(p.x);
          while (matrix.get(rightX, Math.round(p.y))) {
            rightX++;
          }
          var x = (leftX + rightX) / 2;
          var topY = Math.round(p.y);
          while (matrix.get(Math.round(x), topY)) {
            topY--;
          }
          var bottomY = Math.round(p.y);
          while (matrix.get(Math.round(x), bottomY)) {
            bottomY++;
          }
          var y = (topY + bottomY) / 2;
          return { x, y };
        }
        function locate(matrix) {
          var finderPatternQuads = [];
          var activeFinderPatternQuads = [];
          var alignmentPatternQuads = [];
          var activeAlignmentPatternQuads = [];
          var _loop_1 = function(y2) {
            var length_1 = 0;
            var lastBit = false;
            var scans = [0, 0, 0, 0, 0];
            var _loop_2 = function(x2) {
              var v = matrix.get(x2, y2);
              if (v === lastBit) {
                length_1++;
              } else {
                scans = [scans[1], scans[2], scans[3], scans[4], length_1];
                length_1 = 1;
                lastBit = v;
                var averageFinderPatternBlocksize = sum2(scans) / 7;
                var validFinderPattern = Math.abs(scans[0] - averageFinderPatternBlocksize) < averageFinderPatternBlocksize && Math.abs(scans[1] - averageFinderPatternBlocksize) < averageFinderPatternBlocksize && Math.abs(scans[2] - 3 * averageFinderPatternBlocksize) < 3 * averageFinderPatternBlocksize && Math.abs(scans[3] - averageFinderPatternBlocksize) < averageFinderPatternBlocksize && Math.abs(scans[4] - averageFinderPatternBlocksize) < averageFinderPatternBlocksize && !v;
                var averageAlignmentPatternBlocksize = sum2(scans.slice(-3)) / 3;
                var validAlignmentPattern = Math.abs(scans[2] - averageAlignmentPatternBlocksize) < averageAlignmentPatternBlocksize && Math.abs(scans[3] - averageAlignmentPatternBlocksize) < averageAlignmentPatternBlocksize && Math.abs(scans[4] - averageAlignmentPatternBlocksize) < averageAlignmentPatternBlocksize && v;
                if (validFinderPattern) {
                  var endX_1 = x2 - scans[3] - scans[4];
                  var startX_1 = endX_1 - scans[2];
                  var line2 = { startX: startX_1, endX: endX_1, y: y2 };
                  var matchingQuads = activeFinderPatternQuads.filter(function(q) {
                    return startX_1 >= q.bottom.startX && startX_1 <= q.bottom.endX || endX_1 >= q.bottom.startX && startX_1 <= q.bottom.endX || startX_1 <= q.bottom.startX && endX_1 >= q.bottom.endX && (scans[2] / (q.bottom.endX - q.bottom.startX) < MAX_QUAD_RATIO && scans[2] / (q.bottom.endX - q.bottom.startX) > MIN_QUAD_RATIO);
                  });
                  if (matchingQuads.length > 0) {
                    matchingQuads[0].bottom = line2;
                  } else {
                    activeFinderPatternQuads.push({ top: line2, bottom: line2 });
                  }
                }
                if (validAlignmentPattern) {
                  var endX_2 = x2 - scans[4];
                  var startX_2 = endX_2 - scans[3];
                  var line2 = { startX: startX_2, y: y2, endX: endX_2 };
                  var matchingQuads = activeAlignmentPatternQuads.filter(function(q) {
                    return startX_2 >= q.bottom.startX && startX_2 <= q.bottom.endX || endX_2 >= q.bottom.startX && startX_2 <= q.bottom.endX || startX_2 <= q.bottom.startX && endX_2 >= q.bottom.endX && (scans[2] / (q.bottom.endX - q.bottom.startX) < MAX_QUAD_RATIO && scans[2] / (q.bottom.endX - q.bottom.startX) > MIN_QUAD_RATIO);
                  });
                  if (matchingQuads.length > 0) {
                    matchingQuads[0].bottom = line2;
                  } else {
                    activeAlignmentPatternQuads.push({ top: line2, bottom: line2 });
                  }
                }
              }
            };
            for (var x = -1; x <= matrix.width; x++) {
              _loop_2(x);
            }
            finderPatternQuads.push.apply(finderPatternQuads, activeFinderPatternQuads.filter(function(q) {
              return q.bottom.y !== y2 && q.bottom.y - q.top.y >= 2;
            }));
            activeFinderPatternQuads = activeFinderPatternQuads.filter(function(q) {
              return q.bottom.y === y2;
            });
            alignmentPatternQuads.push.apply(alignmentPatternQuads, activeAlignmentPatternQuads.filter(function(q) {
              return q.bottom.y !== y2;
            }));
            activeAlignmentPatternQuads = activeAlignmentPatternQuads.filter(function(q) {
              return q.bottom.y === y2;
            });
          };
          for (var y = 0; y <= matrix.height; y++) {
            _loop_1(y);
          }
          finderPatternQuads.push.apply(finderPatternQuads, activeFinderPatternQuads.filter(function(q) {
            return q.bottom.y - q.top.y >= 2;
          }));
          alignmentPatternQuads.push.apply(alignmentPatternQuads, activeAlignmentPatternQuads);
          var finderPatternGroups = finderPatternQuads.filter(function(q) {
            return q.bottom.y - q.top.y >= 2;
          }).map(function(q) {
            var x = (q.top.startX + q.top.endX + q.bottom.startX + q.bottom.endX) / 4;
            var y2 = (q.top.y + q.bottom.y + 1) / 2;
            if (!matrix.get(Math.round(x), Math.round(y2))) {
              return;
            }
            var lengths = [q.top.endX - q.top.startX, q.bottom.endX - q.bottom.startX, q.bottom.y - q.top.y + 1];
            var size = sum2(lengths) / lengths.length;
            var score = scorePattern({ x: Math.round(x), y: Math.round(y2) }, [1, 1, 3, 1, 1], matrix);
            return { score, x, y: y2, size };
          }).filter(function(q) {
            return !!q;
          }).sort(function(a, b) {
            return a.score - b.score;
          }).map(function(point, i, finderPatterns) {
            if (i > MAX_FINDERPATTERNS_TO_SEARCH) {
              return null;
            }
            var otherPoints = finderPatterns.filter(function(p, ii) {
              return i !== ii;
            }).map(function(p) {
              return { x: p.x, y: p.y, score: p.score + Math.pow(p.size - point.size, 2) / point.size, size: p.size };
            }).sort(function(a, b) {
              return a.score - b.score;
            });
            if (otherPoints.length < 2) {
              return null;
            }
            var score = point.score + otherPoints[0].score + otherPoints[1].score;
            return { points: [point].concat(otherPoints.slice(0, 2)), score };
          }).filter(function(q) {
            return !!q;
          }).sort(function(a, b) {
            return a.score - b.score;
          });
          if (finderPatternGroups.length === 0) {
            return null;
          }
          var _a = reorderFinderPatterns(finderPatternGroups[0].points[0], finderPatternGroups[0].points[1], finderPatternGroups[0].points[2]), topRight = _a.topRight, topLeft = _a.topLeft, bottomLeft = _a.bottomLeft;
          var alignment = findAlignmentPattern(matrix, alignmentPatternQuads, topRight, topLeft, bottomLeft);
          var result = [];
          if (alignment) {
            result.push({
              alignmentPattern: { x: alignment.alignmentPattern.x, y: alignment.alignmentPattern.y },
              bottomLeft: { x: bottomLeft.x, y: bottomLeft.y },
              dimension: alignment.dimension,
              topLeft: { x: topLeft.x, y: topLeft.y },
              topRight: { x: topRight.x, y: topRight.y }
            });
          }
          var midTopRight = recenterLocation(matrix, topRight);
          var midTopLeft = recenterLocation(matrix, topLeft);
          var midBottomLeft = recenterLocation(matrix, bottomLeft);
          var centeredAlignment = findAlignmentPattern(matrix, alignmentPatternQuads, midTopRight, midTopLeft, midBottomLeft);
          if (centeredAlignment) {
            result.push({
              alignmentPattern: { x: centeredAlignment.alignmentPattern.x, y: centeredAlignment.alignmentPattern.y },
              bottomLeft: { x: midBottomLeft.x, y: midBottomLeft.y },
              topLeft: { x: midTopLeft.x, y: midTopLeft.y },
              topRight: { x: midTopRight.x, y: midTopRight.y },
              dimension: centeredAlignment.dimension
            });
          }
          if (result.length === 0) {
            return null;
          }
          return result;
        }
        exports2.locate = locate;
        function findAlignmentPattern(matrix, alignmentPatternQuads, topRight, topLeft, bottomLeft) {
          var _a;
          var dimension;
          var moduleSize;
          try {
            _a = computeDimension(topLeft, topRight, bottomLeft, matrix), dimension = _a.dimension, moduleSize = _a.moduleSize;
          } catch (e) {
            return null;
          }
          var bottomRightFinderPattern = {
            x: topRight.x - topLeft.x + bottomLeft.x,
            y: topRight.y - topLeft.y + bottomLeft.y
          };
          var modulesBetweenFinderPatterns = (distance(topLeft, bottomLeft) + distance(topLeft, topRight)) / 2 / moduleSize;
          var correctionToTopLeft = 1 - 3 / modulesBetweenFinderPatterns;
          var expectedAlignmentPattern = {
            x: topLeft.x + correctionToTopLeft * (bottomRightFinderPattern.x - topLeft.x),
            y: topLeft.y + correctionToTopLeft * (bottomRightFinderPattern.y - topLeft.y)
          };
          var alignmentPatterns = alignmentPatternQuads.map(function(q) {
            var x = (q.top.startX + q.top.endX + q.bottom.startX + q.bottom.endX) / 4;
            var y = (q.top.y + q.bottom.y + 1) / 2;
            if (!matrix.get(Math.floor(x), Math.floor(y))) {
              return;
            }
            var lengths = [q.top.endX - q.top.startX, q.bottom.endX - q.bottom.startX, q.bottom.y - q.top.y + 1];
            var size = sum2(lengths) / lengths.length;
            var sizeScore = scorePattern({ x: Math.floor(x), y: Math.floor(y) }, [1, 1, 1], matrix);
            var score = sizeScore + distance({ x, y }, expectedAlignmentPattern);
            return { x, y, score };
          }).filter(function(v) {
            return !!v;
          }).sort(function(a, b) {
            return a.score - b.score;
          });
          var alignmentPattern = modulesBetweenFinderPatterns >= 15 && alignmentPatterns.length ? alignmentPatterns[0] : expectedAlignmentPattern;
          return { alignmentPattern, dimension };
        }
      })
      /******/
    ])["default"]
  );
});
var jsqr_default = module.exports;

// src/qr-images.js
var CHUNK = 1200;
var MAX_PARTS = 64;
var digest = async (text3) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text3)))].map((x) => x.toString(16).padStart(2, "0")).join("");
async function splitQrTransfer(text3) {
  if (typeof text3 !== "string" || !text3 || !/^[\x20-\x7e]+$/.test(text3) || text3.length > CHUNK * MAX_PARTS) throw Error("QR\u306E\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\u3002\u5185\u5BB9\u306F\u7701\u7565\u305B\u305A\u4FDD\u6301\u3057\u3066\u3044\u307E\u3059\u3002");
  const hash2 = await digest(text3), count = Math.ceil(text3.length / CHUNK);
  return Array.from({ length: count }, (_, i) => "RNQR1:" + hash2 + ":" + (i + 1) + ":" + count + ":" + text3.slice(i * CHUNK, (i + 1) * CHUNK));
}
function createQrMatrix(text3) {
  const qr = qrcode_generator_default(0, "M");
  qr.addData(text3, "Byte");
  qr.make();
  return { size: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
}
function qrSvg(doc, text3) {
  const m = createQrMatrix(text3), size = m.size + 8, ns = "http://www.w3.org/2000/svg", svg = doc.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 " + size + " " + size);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "\u5831\u544A\u3092\u5FA9\u5143\u3059\u308BQR\u30B3\u30FC\u30C9");
  svg.setAttribute("width", "100%");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.style.maxWidth = "600px";
  svg.style.maxHeight = "42dvh";
  svg.style.display = "block";
  svg.style.margin = "0 auto";
  const bg = doc.createElementNS(ns, "rect");
  for (const [k, v] of Object.entries({ width: size, height: size, fill: "#fff" })) bg.setAttribute(k, String(v));
  svg.append(bg);
  let d = "";
  for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) if (m.dark(r, c)) d += "M" + (c + 4) + " " + (r + 4) + "h1v1h-1z";
  const path = doc.createElementNS(ns, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "#000");
  svg.append(path);
  return svg;
}
function createQrCollector() {
  const groups = /* @__PURE__ */ new Map();
  return { async accept(text3) {
    if (typeof text3 !== "string") throw Error("QR\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002");
    if (text3.startsWith("ROUTENOTE1:")) return { complete: true, text: text3 };
    const m = text3.match(/^RNQR1:([a-f0-9]{64}):(\d{1,2}):(\d{1,2}):([\x20-\x7e]+)$/);
    if (!m) throw Error("RouteNote\u306E\u5831\u544AQR\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002");
    const [, hash2, i, n, part] = m, index = Number(i), count = Number(n);
    if (count < 1 || count > MAX_PARTS || index < 1 || index > count || part.length > CHUNK) throw Error("\u5206\u5272QR\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059\u3002");
    if (!groups.has(hash2)) {
      if (groups.size >= 8) throw Error("\u8AAD\u307F\u8FBC\u307F\u9014\u4E2D\u306E\u5831\u544A\u304C\u591A\u3059\u304E\u307E\u3059\u3002");
      groups.set(hash2, { count, parts: /* @__PURE__ */ new Map() });
    }
    const g = groups.get(hash2);
    if (g.count !== count || g.parts.has(index) && g.parts.get(index) !== part) throw Error("\u540C\u3058QR\u756A\u53F7\u306E\u5185\u5BB9\u304C\u7570\u306A\u308A\u307E\u3059\u3002");
    g.parts.set(index, part);
    if (g.parts.size < count) return { complete: false, received: g.parts.size, count };
    const joined = Array.from({ length: count }, (_, k) => g.parts.get(k + 1)).join("");
    if (await digest(joined) !== hash2) throw Error("QR\u5168\u4F53\u306E\u4E00\u81F4\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
    groups.delete(hash2);
    return { complete: true, text: joined };
  }, clear() {
    groups.clear();
  } };
}
function decodeQrPixels(pixels, width, height) {
  const r = jsqr_default(pixels, width, height, { inversionAttempts: "attemptBoth" });
  if (!r?.data) throw Error("QR\u3092\u691C\u51FA\u3067\u304D\u307E\u305B\u3093\u3002QR\u5168\u4F53\u304C\u9BAE\u660E\u306A\u753B\u50CF\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002");
  return r.data;
}
async function decodeQrImage(file, { doc = globalThis.document, createBitmap = globalThis.createImageBitmap } = {}) {
  if (!file || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 20 * 1024 * 1024) throw Error("20MB\u4EE5\u5185\u306EPNG\u30FBJPEG\u30FBWebP\u30FBGIF\u753B\u50CF\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002");
  if (typeof createBitmap !== "function") throw Error("\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u3067\u306FQR\u753B\u50CF\u8AAD\u307F\u8FBC\u307F\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002");
  const b = await createBitmap(file);
  try {
    if (!b.width || !b.height || b.width * b.height > 5e7) throw Error("\u753B\u50CF\u304C\u5927\u304D\u3059\u304E\u307E\u3059\u3002");
    const scale = Math.min(1, 2400 / Math.max(b.width, b.height)), canvas = doc.createElement("canvas");
    canvas.width = Math.round(b.width * scale);
    canvas.height = Math.round(b.height * scale);
    const c = canvas.getContext("2d", { willReadFrequently: true });
    if (!c) throw Error("\u753B\u50CF\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002");
    c.drawImage(b, 0, 0, canvas.width, canvas.height);
    const p = c.getImageData(0, 0, canvas.width, canvas.height);
    return decodeQrPixels(p.data, p.width, p.height);
  } finally {
    b.close?.();
  }
}

// src/aggregation-queue.js
var clone3 = (x) => structuredClone(x);
var issue3 = (c, m) => new ReportError(c, m);
var canonical = (x) => Array.isArray(x) ? x.map(canonical) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canonical(x[k])])) : x;
var hash = async (x) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical(x)))))].map((v) => v.toString(16).padStart(2, "0")).join("");
function createAggregationQueue({ uid: uid2, storage = globalThis.localStorage, locks = globalThis.navigator?.locks, currentUid = () => uid2, transport = null, prepareRequest = null, operationId = () => crypto.randomUUID() } = {}) {
  if (typeof uid2 !== "string" || !uid2 || uid2.length > 200) throw issue3("INVALID_UID", "\u30ED\u30B0\u30A4\u30F3\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const key = "routenote-aggregation-v1:" + encodeURIComponent(uid2);
  const check = () => {
    if (currentUid() !== uid2) throw issue3("LOGIN_REQUIRED", "\u30ED\u30B0\u30A4\u30F3\u72B6\u614B\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002");
  };
  function read() {
    check();
    const raw = storage.getItem(key);
    if (raw === null) return { raw, revision: 0, reports: [], pending: null, receipts: [] };
    try {
      const s = JSON.parse(raw);
      if (s.schemaVersion !== 1 || s.uid !== uid2 || !Number.isSafeInteger(s.revision) || s.revision < 1 || !Array.isArray(s.reports) || s.reports.length > 20 || !Array.isArray(s.receipts) || s.receipts.length > 1e3) throw Error();
      const reports2 = s.reports.map(normalizeReportBatch);
      if (new Set(reports2.map((x) => x.reportId)).size !== reports2.length) throw Error();
      if (s.pending !== null && (!s.pending.operationId || !s.pending.requestHash || !Array.isArray(s.pending.reports))) throw Error();
      return { ...s, raw, reports: reports2 };
    } catch {
      throw issue3("INVALID_STORAGE", "\u96C6\u7D04\u30C7\u30FC\u30BF\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u5143\u306E\u5185\u5BB9\u306F\u5909\u66F4\u3057\u307E\u305B\u3093\u3002");
    }
  }
  async function locked(fn) {
    check();
    if (!locks?.request) throw issue3("LOCK_UNAVAILABLE", "\u4FDD\u5B58\u7AF6\u5408\u3092\u9632\u6B62\u3067\u304D\u306A\u3044\u305F\u3081\u505C\u6B62\u3057\u307E\u3057\u305F\u3002");
    return locks.request(key, { mode: "exclusive" }, () => {
      check();
      return fn(read());
    });
  }
  function save(s, next) {
    check();
    if (storage.getItem(key) !== s.raw) throw issue3("STORAGE_CONFLICT", "\u5225\u753B\u9762\u3067\u96C6\u7D04\u304C\u5909\u66F4\u3055\u308C\u307E\u3057\u305F\u3002");
    const raw = JSON.stringify({ schemaVersion: 1, uid: uid2, revision: s.revision + 1, reports: next.reports, pending: next.pending, receipts: next.receipts });
    storage.setItem(key, raw);
    if (storage.getItem(key) !== raw) throw issue3("WRITE_UNCERTAIN", "\u4FDD\u5B58\u7D50\u679C\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
    return read();
  }
  function writable(s) {
    if (s.pending) throw issue3("OPERATION_UNKNOWN", "\u9001\u4FE1\u7D50\u679C\u304C\u672A\u78BA\u8A8D\u3067\u3059\u3002\u518D\u9001\u3084\u5185\u5BB9\u5909\u66F4\u306F\u305B\u305A\u7D50\u679C\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  }
  return {
    read,
    async add(value, { confirmRevision = false } = {}) {
      const incoming = normalizeReportBatch(value);
      return locked((s) => {
        writable(s);
        const c = compareReportBatches(s.reports.find((r) => r.reportId === incoming.reportId), incoming);
        if (c.status === "noop") return { ...s, status: "noop" };
        if (["stale", "conflict"].includes(c.status)) throw issue3("REVISION_CONFLICT", "\u53E4\u3044\u7248\u3001\u307E\u305F\u306F\u540C\u3058\u7248\u3067\u5185\u5BB9\u304C\u7570\u306A\u308B\u305F\u3081\u96C6\u7D04\u3057\u307E\u305B\u3093\u3002");
        if (c.status === "review" && !confirmRevision) return c;
        const reports2 = s.reports.filter((r) => r.reportId !== incoming.reportId);
        reports2.push(incoming);
        if (reports2.length > 20 || reports2.reduce((n, r) => n + r.entries.length, 0) > 100 || new TextEncoder().encode(JSON.stringify(reports2)).length > 4e5) throw issue3("QUEUE_LIMIT", "\u4E00\u5EA6\u306E\u96C6\u7D04\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\u3002");
        return { ...save(s, { ...s, reports: reports2 }), status: "saved" };
      });
    },
    async remove(id) {
      return locked((s) => {
        writable(s);
        return save(s, { ...s, reports: s.reports.filter((r) => r.reportId !== id) });
      });
    },
    async send() {
      if (typeof transport !== "function" || typeof prepareRequest !== "function") throw issue3("TRANSPORT_NOT_CONFIGURED", "\u78BA\u8A8D\u7528\u753B\u9762\u306F\u5B9F\u30B7\u30FC\u30C8\u3078\u306E\u9001\u4FE1\u3092\u63A5\u7D9A\u3057\u3066\u3044\u307E\u305B\u3093\u3002");
      let request;
      await locked(async (s) => {
        writable(s);
        if (!s.reports.length) throw issue3("EMPTY_QUEUE", "\u9001\u4FE1\u3059\u308B\u5831\u544A\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
        if (s.receipts.length >= 1e3) throw issue3("RECEIPT_LIMIT", "\u9001\u4FE1\u5C65\u6B74\u306E\u4E0A\u9650\u3067\u3059\u3002\u5C65\u6B74\u3092\u4FDD\u5168\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        const reports2 = s.reports.map(normalizeReportBatch), importContext = await prepareRequest(clone3(reports2));
        if (!Array.isArray(importContext) || importContext.length !== reports2.length || new Set(importContext.map((c) => c.reportId)).size !== reports2.length || reports2.some((r) => !importContext.some((c) => c.reportId === r.reportId && /^[a-f0-9]{64}$/.test(c.payloadHash) && Number.isSafeInteger(c.masterRevision) && c.masterRevision >= 0 && Object.hasOwn(c, "base")))) throw issue3("IMPORT_CONTEXT_REQUIRED", "\u7248\u3068\u5BFE\u5FDC\u60C5\u5831\u304C\u63C3\u3063\u3066\u3044\u306A\u3044\u305F\u3081\u9001\u4FE1\u3057\u307E\u305B\u3093\u3002");
        request = { schemaVersion: 1, operationId: operationId(), requestHash: await hash({ reports: reports2, importContext }), reports: reports2, importContext };
        save(s, { ...s, pending: request });
      });
      let response;
      try {
        check();
        response = await transport(clone3(request));
      } catch {
        throw issue3("OPERATION_UNKNOWN", "\u9001\u4FE1\u7D50\u679C\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u518D\u9001\u305B\u305A\u7D50\u679C\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      }
      return locked((s) => {
        if (!s.pending || s.pending.operationId !== request.operationId || s.pending.requestHash !== request.requestHash) throw issue3("OPERATION_UNKNOWN", "\u9001\u4FE1\u4E2D\u306B\u72B6\u614B\u304C\u5909\u308F\u308A\u307E\u3057\u305F\u3002");
        const a = response?.accepted, exact = Array.isArray(a) && a.length === request.reports.length && new Set(a.map((x) => x.reportId)).size === a.length && request.reports.every((r) => a.some((x) => x.reportId === r.reportId && x.revision === r.revision));
        if (response?.ok !== true || response.committed !== true || response.operationId !== request.operationId || response.requestHash !== request.requestHash || !exact) throw issue3("OPERATION_UNKNOWN", "\u5168\u5831\u544A\u306E\u4FDD\u5B58\u5B8C\u4E86\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002");
        return save(s, { reports: [], pending: null, receipts: [...s.receipts, { operationId: request.operationId, requestHash: request.requestHash, accepted: clone3(a), mappings: clone3(response.mappings ?? []) }] });
      });
    }
  };
}

// src/report-transfer-panel.js
function installReportTransferPanel({ doc, adapter, onSaved = () => {
}, transport = null, prepareRequest = null, decodeImage = decodeQrImage } = {}) {
  const uid2 = adapter.currentUid(), win = doc.defaultView, life = new win.AbortController(), store = adapter.localReportStore, collector = createQrCollector();
  const queue = createAggregationQueue({ uid: uid2, currentUid: () => adapter.currentUid(), storage: win.localStorage, locks: win.navigator.locks, transport, prepareRequest });
  let busy = false, disposed = false, generation = 0;
  const node = (tag, text3, cls) => {
    const n = doc.createElement(tag);
    if (text3 !== void 0) n.textContent = text3;
    if (cls) n.className = cls;
    return n;
  };
  const section = node("section");
  section.id = "aggregate-section";
  section.hidden = true;
  section.append(node("h1", "\u96C6\u7D04"), node("p", "QR\u753B\u50CF\u306E\u8AAD\u307F\u8FBC\u307F\u3068\u96C6\u7D04\u306F\u7AEF\u672B\u5185\u3067\u884C\u3044\u307E\u3059\u3002\u9001\u4FE1\u64CD\u4F5C\u307E\u3067\u30B7\u30FC\u30C8\u306B\u306F\u9001\u308A\u307E\u305B\u3093\u3002", "form-note"));
  const error = node("p", void 0, "form-error");
  error.hidden = true;
  error.setAttribute("role", "alert");
  const status = node("p", "", "form-note");
  status.setAttribute("role", "status");
  async function action(fn) {
    if (busy || disposed) return;
    busy = true;
    error.hidden = true;
    try {
      await fn();
    } catch (e) {
      error.textContent = e.message || "\u5B8C\u4E86\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5185\u5BB9\u306F\u4FDD\u6301\u3057\u3066\u3044\u307E\u3059\u3002";
      error.hidden = false;
    } finally {
      busy = false;
    }
  }
  const button = (text3, fn, cls = "button secondary") => {
    const b = node("button", text3, cls);
    b.type = "button";
    b.addEventListener("click", () => void action(fn), { signal: life.signal });
    return b;
  };
  const imageLabel = node("label", "QR\u753B\u50CF\u3092\u8AAD\u307F\u8FBC\u3080", "field"), images = node("input");
  images.type = "file";
  images.accept = "image/png,image/jpeg,image/webp,image/gif";
  images.multiple = true;
  images.setAttribute("aria-label", "\u5831\u544AQR\u306E\u753B\u50CF\u3092\u8AAD\u307F\u8FBC\u3080");
  imageLabel.append(images);
  const idForm = node("form"), idLabel = node("label", "\u5831\u544AID\u304B\u3089\u7AEF\u672B\u5185\u3092\u691C\u7D22", "field"), idInput = node("input"), search = node("button", "\u691C\u7D22", "button secondary");
  idInput.maxLength = 36;
  idInput.required = true;
  idInput.autocomplete = "off";
  search.type = "submit";
  idLabel.append(idInput);
  idForm.append(idLabel, search);
  const imports = node("div", void 0, "card-list"), locals = node("div", void 0, "card-list"), queued = node("div", void 0, "card-list");
  const send = button("\u307E\u3068\u3081\u3066\u9001\u4FE1", async () => {
    await queue.send();
    status.textContent = "\u5168\u5831\u544A\u306E\u4FDD\u5B58\u5B8C\u4E86\u3092\u78BA\u8A8D\u3057\u307E\u3057\u305F\u3002";
    refresh();
  }, "button primary");
  section.append(error, imageLabel, node("p", "\u753B\u50CF\u306F\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u3057\u307E\u305B\u3093\u3002\u5206\u5272QR\u306F\u5168\u756A\u53F7\u304C\u63C3\u3063\u3066\u304B\u3089\u5FA9\u5143\u3057\u307E\u3059\u3002ID\u691C\u7D22\u306F\u3053\u306E\u7AEF\u672B\u306B\u6B8B\u308B\u5831\u544A\u3060\u3051\u304C\u5BFE\u8C61\u3067\u3059\u3002", "form-note"), idForm, status, imports, node("h2", "\u3053\u306E\u7AEF\u672B\u306E\u5831\u544A\uFF08\u76F4\u8FD110\u4EF6\uFF09"), locals, node("h2", "\u9001\u4FE1\u3059\u308B\u5831\u544A"), queued, send);
  const dialog = node("dialog"), head = node("div", void 0, "dialog-head"), title = node("h2", "\u5831\u544AQR"), body = node("div", void 0, "dialog-body"), foot = node("div", void 0, "dialog-foot");
  title.id = "report-qr-title";
  dialog.setAttribute("aria-labelledby", title.id);
  head.append(title);
  foot.append(button("\u9589\u3058\u308B", () => dialog.close()));
  dialog.append(head, body, foot);
  doc.getElementById("browse-section").after(section);
  doc.getElementById("google-app-root").append(dialog);
  function card(r) {
    const c = node("article", void 0, "record-card");
    c.append(node("h3", r.entries.map((e) => e.date).filter((d, i, a) => a.indexOf(d) === i).join("\u30FB")), node("p", r.reportId + " / \u7B2C" + r.revision + "\u7248 / " + r.entries.length + "\u660E\u7D30", "form-note"), node("p", r.entries.map((e) => e.customerName).join("\u3001")), node("p", (r.declaredActor.name || "\u6C0F\u540D\u306A\u3057") + "\uFF08\u7533\u544A\u60C5\u5831\uFF09", "form-note"));
    return c;
  }
  async function showQr(r) {
    const g = ++generation, parts = await splitQrTransfer(await encodeReportTransfer(r));
    if (disposed || g !== generation) return;
    let i = 0;
    const paint = () => {
      body.replaceChildren(node("p", "ID: " + r.reportId), node("p", "\u7B2C" + r.revision + "\u7248 \xB7 QR " + (i + 1) + "/" + parts.length), qrSvg(doc, parts[i]), node("p", "\u5185\u5BB9\u5165\u308AQR\u3067\u3059\u3002\u5171\u6709\u5148\u3092\u78BA\u8A8D\u3057\u3001ID\u3068QR\u5168\u4F53\u3092\u4E00\u7DD2\u306B\u4FDD\u7BA1\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "form-note"));
      if (parts.length > 1) {
        const controls = node("div", void 0, "dialog-foot"), prev = button("\u524D\u306EQR", () => {
          i--;
          paint();
        }), next = button("\u6B21\u306EQR", () => {
          i++;
          paint();
        });
        prev.disabled = i === 0;
        next.disabled = i === parts.length - 1;
        controls.append(prev, next);
        body.append(controls, node("p", "\u5168\u756A\u53F7\u30921\u679A\u305A\u3064\u30B9\u30AF\u30EA\u30FC\u30F3\u30B7\u30E7\u30C3\u30C8\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "form-note"));
      }
    };
    paint();
    dialog.showModal();
  }
  function revisionReview(host, r, fn, label) {
    const box = node("div", void 0, "conflict-panel");
    box.append(node("p", "\u540C\u3058ID\u306E\u65B0\u7248\u3067\u3059\u3002\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u7F6E\u304D\u63DB\u3048\u3066\u304F\u3060\u3055\u3044\u3002"), node("pre", JSON.stringify(r.entries, null, 2)), button(label, async () => {
      await fn();
      box.remove();
      await onSaved();
      refresh();
    }));
    host.append(box);
  }
  async function add(r, host) {
    const result = await queue.add(r);
    if (result.status === "review") {
      revisionReview(host, r, () => queue.add(r, { confirmRevision: true }), "\u65B0\u7248\u3067\u96C6\u7D04\u3092\u7F6E\u304D\u63DB\u3048\u308B");
      return;
    }
    status.textContent = result.status === "noop" ? "\u540C\u3058\u5831\u544A\u306F\u96C6\u7D04\u6E08\u307F\u3067\u3059\u3002" : "\u96C6\u7D04\u3078\u8FFD\u52A0\u3057\u307E\u3057\u305F\u3002\u307E\u3060\u30B7\u30FC\u30C8\u306B\u306F\u9001\u4FE1\u3057\u3066\u3044\u307E\u305B\u3093\u3002";
    refresh();
  }
  function showImport(r) {
    const host = card(r);
    host.append(node("p", "QR\u306E\u4F5C\u6210\u8005\u306F\u672A\u78BA\u8A8D\u3067\u3059\u3002QR\u3084ID\u3060\u3051\u3067\u5171\u6709\u30C7\u30FC\u30BF\u306E\u66F4\u65B0\u6A29\u9650\u306F\u5F97\u3089\u308C\u307E\u305B\u3093\u3002", "form-note"), button("\u96C6\u7D04\u3078\u8FFD\u52A0", () => add(r, host)), button("QR\u3068ID\u3092\u8868\u793A", () => showQr(r)));
    if (r.declaredActor.uid === uid2) host.append(button("\u7AEF\u672B\u306B\u5FA9\u5143\u3057\u3066\u7DE8\u96C6", async () => {
      const before = store.prepareImport(r), result = await store.save(r, { expectedRaw: before.expectedRaw });
      if (result.status === "review") {
        revisionReview(host, r, () => store.save(r, { expectedRaw: result.expectedRaw, confirmRevision: true }), "\u65B0\u7248\u3092\u7AEF\u672B\u306B\u5FA9\u5143\u3059\u308B");
        return;
      }
      await onSaved();
      status.textContent = "\u7AEF\u672B\u306B\u5FA9\u5143\u3057\u307E\u3057\u305F\u3002\u95B2\u89A7\u30FB\u7DE8\u96C6\u304B\u3089\u958B\u3051\u307E\u3059\u3002";
      refresh();
    }));
    else host.append(node("p", "\u5225\u306E\u5229\u7528\u8005\u306E\u5831\u544A\u3068\u3057\u3066\u96C6\u7D04\u3067\u304D\u307E\u3059\u3002\u672C\u4EBA\u306E\u7DE8\u96C6\u4E00\u89A7\u3078\u306F\u5FA9\u5143\u3057\u307E\u305B\u3093\u3002", "form-note"));
    imports.append(host);
  }
  images.addEventListener("change", () => void action(async () => {
    const files = [...images.files];
    if (files.length > 64) throw Error("\u4E00\u5EA6\u306B64\u679A\u307E\u3067\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002");
    for (const file of files) {
      const part = await collector.accept(await decodeImage(file, { doc }));
      if (part.complete) {
        showImport((await decodeReportTransfer(part.text)).report);
        status.textContent = "\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u96C6\u7D04\u30FB\u5FA9\u5143\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002";
      } else status.textContent = "\u5206\u5272QR " + part.received + "/" + part.count + " \u3092\u53D7\u3051\u53D6\u308A\u307E\u3057\u305F\u3002";
    }
    images.value = "";
  }), { signal: life.signal });
  idForm.addEventListener("submit", (e) => {
    e.preventDefault();
    void action(async () => {
      const r = store.read().reports.find((r2) => r2.reportId === idInput.value.trim());
      if (!r) throw Error("\u3053\u306E\u7AEF\u672B\u306B\u305D\u306EID\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u5185\u5BB9\u5165\u308AQR\u304B\u3089\u5FA9\u5143\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u672A\u9001\u4FE1\u306EID\u3060\u3051\u3067\u306F\u4ED6\u7AEF\u672B\u306E\u5185\u5BB9\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3002");
      showImport(r);
    });
  }, { signal: life.signal });
  function refresh() {
    if (disposed) return;
    locals.replaceChildren();
    for (const r of store.read().reports) {
      const host = card(r);
      host.append(button("QR\u3068ID\u3092\u8868\u793A", () => showQr(r)), button("\u96C6\u7D04\u3078\u8FFD\u52A0", () => add(r, host)));
      locals.append(host);
    }
    if (!locals.childNodes.length) locals.append(node("p", "\u4FDD\u5B58\u3057\u305F\u5831\u544A\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002", "empty-state"));
    const s = queue.read();
    queued.replaceChildren();
    for (const r of s.reports) {
      const host = card(r), remove = button("\u96C6\u7D04\u304B\u3089\u5916\u3059", async () => {
        await queue.remove(r.reportId);
        refresh();
      });
      remove.disabled = !!s.pending;
      host.append(remove);
      queued.append(host);
    }
    if (!s.reports.length) queued.append(node("p", "QR\u307E\u305F\u306F\u7AEF\u672B\u306E\u5831\u544A\u3092\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "empty-state"));
    send.disabled = !s.reports.length || !!s.pending || !transport;
    if (s.pending) queued.prepend(node("p", "\u9001\u4FE1\u7D50\u679C\u304C\u672A\u78BA\u8A8D\u3067\u3059\u3002\u5831\u544A\u3092\u4FDD\u6301\u3057\u3066\u3044\u307E\u3059\u3002\u518D\u9001\u305B\u305A\u7D50\u679C\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "form-error"));
    else if (!transport) queued.append(node("p", "\u78BA\u8A8D\u7528\u753B\u9762\u3067\u306F\u5B9F\u30B7\u30FC\u30C8\u3078\u306E\u9001\u4FE1\u3092\u63A5\u7D9A\u3057\u3066\u3044\u307E\u305B\u3093\u3002", "form-note"));
  }
  refresh();
  return { refresh, queue, dispose() {
    disposed = true;
    generation++;
    life.abort();
    collector.clear();
    if (dialog.open) dialog.close();
    dialog.remove();
    section.remove();
  } };
}

// src/review-entry.js
var UID = "routenote-public-review-20261112";
var identity = { currentUid: () => UID, subscribe: () => () => {
} };
var state = createSampleState();
state.records = [];
state.history = [];
for (const [i, c] of state.masters.customers.entries()) {
  c.name = "\u78BA\u8A8D\u7528\u53D6\u5F15\u5148 " + (i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26));
  c.invoiceAddress = "\u67B6\u7A7A\u306E\u4F4F\u6240\uFF08\u78BA\u8A8D\u7528\uFF09";
}
for (const [i, m] of state.masters.members.entries()) m.name = "\u78BA\u8A8D\u7528\u62C5\u5F53 " + (i + 1);
var settings2 = emptyInvoiceSettings();
settings2.issuer.tradeName = "\u78BA\u8A8D\u7528\u306E\u67B6\u7A7A\u4F1A\u793E";
settings2.tax = { rate: "10", priceMode: "exclusive", rounding: "floor" };
var basics = { schemaVersion: 1, uid: UID, actor: { memberId: state.masters.members[0].id, displayName: state.masters.members[0].name, role: "admin" }, state, invoiceSettings: settings2 };
var fixture = createSampleState();
var month = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
fixture.masters = structuredClone(state.masters);
fixture.records = fixture.records.map((r, i) => ({ ...r, date: month + "-" + String(i + 1).padStart(2, "0"), customerName: state.masters.customers.find((c) => c.id === r.customerId)?.name ?? "\u78BA\u8A8D\u7528\u53D6\u5F15\u5148", createdBy: state.masters.members[0].name, createdById: state.masters.members[0].id, lastEditedBy: state.masters.members[0].name, lastEditedById: state.masters.members[0].id, combustibleRate: 10, noncombustibleRate: 20, priceSource: "configured-default" }));
var root = document.getElementById("google-app-root");
var entry = document.getElementById("google-entry");
var notice = document.createElement("p");
notice.id = "review-build-notice";
notice.className = "info-note";
notice.setAttribute("role", "note");
notice.textContent = "\u8EFD\u91CF\u5316\u7248\u306E\u78BA\u8A8D\u7528\u3067\u3059\u3002\u67B6\u7A7A\u30C7\u30FC\u30BF\u306E\u307F\u3002\u5B9F\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u306B\u306F\u63A5\u7D9A\u30FB\u9001\u4FE1\u3057\u307E\u305B\u3093\u3002\u5831\u544A\u30FB\u7DE8\u96C6\u30FBQR\u30FB\u96C6\u7D04\u306F\u3053\u306E\u7AEF\u672B\u3067\u8A66\u305B\u307E\u3059\u3002\u8ACB\u6C42\u51FA\u529B\u3068\u8A2D\u5B9A\u4FDD\u5B58\u306F\u78BA\u8A8D\u7528\u306E\u6A21\u64EC\u51E6\u7406\u3067\u3059\u3002";
root.prepend(notice);
var app;
var load = createLightweightEntry({
  doc: document,
  identityFactory: async () => identity,
  initialBasics: basics,
  settingsTransport: async (request) => ({ ok: true, operationId: request.operationId, basics: { state: { ...state, masters: request.masters, masterRevision: request.expectedMasterRevision + 1 }, invoiceSettings: request.invoiceSettings } }),
  billingTransport: async (request) => {
    const invoiceState = structuredClone(fixture);
    invoiceState.records = invoiceState.records.filter((r) => r.date.startsWith(request.month) && request.customerIds.includes(r.customerId));
    return { ok: true, schemaVersion: 1, requestId: request.requestId, uid: UID, month: request.month, customerIds: request.customerIds, complete: true, revision: 1, sourceFingerprint: "a".repeat(64), state: invoiceState, recordCount: invoiceState.records.length, invoiceSettings: app?.adapter.invoiceSettingsStore.getSettings() ?? settings2 };
  },
  services: { installReportTransferPanel, invoiceSealStore: { load: async () => null, dispose() {
  } }, startUpdates: () => ({ dispose() {
  } }) }
});
try {
  app = await load();
  entry.hidden = true;
  root.hidden = false;
  root.inert = false;
  app.activate();
  document.title = "RouteNote | \u8EFD\u91CF\u5316\u7248\u306E\u78BA\u8A8D";
  document.querySelectorAll("#open-google-account").forEach((b) => {
    b.disabled = true;
    b.title = "\u78BA\u8A8D\u7248\u3067\u306FGoogle\u30A2\u30AB\u30A6\u30F3\u30C8\u306B\u63A5\u7D9A\u3057\u307E\u305B\u3093\u3002";
  });
} catch (error) {
  entry.hidden = false;
  entry.textContent = "\u78BA\u8A8D\u7248\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u4FDD\u5B58\u5185\u5BB9\u306F\u524A\u9664\u3057\u3066\u3044\u307E\u305B\u3093\u3002" + error.message;
}
document.addEventListener("click", (event) => {
  if (event.target.closest("#open-google-account")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    document.getElementById("review-build-notice").textContent = "\u78BA\u8A8D\u7248\u3067\u306FGoogle\u30A2\u30AB\u30A6\u30F3\u30C8\u306B\u63A5\u7D9A\u3057\u307E\u305B\u3093\u3002\u67B6\u7A7A\u30C7\u30FC\u30BF\u306E\u307F\u3067\u64CD\u4F5C\u3092\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002";
  }
}, true);
document.getElementById("check-update")?.addEventListener("click", () => location.reload());
