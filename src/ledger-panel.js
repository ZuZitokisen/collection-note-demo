/**
 * Read-only ledger presentation. No Firebase, network, storage, or local-record imports.
 * readPage({ signal }) must return the complete ledger.read envelope, not a local demo list.
 * The host owns authentication and must revoke setAuthorization(false) on session changes.
 */

const AUTH_CODES = new Set(['LOGIN_REQUIRED', 'UNAUTHENTICATED', 'FORBIDDEN', 'AUTH_UNAVAILABLE']);
const ERROR_MESSAGES = Object.freeze({
  LOGIN_REQUIRED: 'Googleログインを確認してから、もう一度開いてください。',
  UNAUTHENTICATED: 'Googleログインを確認してから、もう一度開いてください。',
  FORBIDDEN: 'このスプレッドシートを閲覧する権限を確認できませんでした。',
  AUTH_UNAVAILABLE: '閲覧権限を確認できませんでした。接続を確認して、もう一度開いてください。',
  SOURCE_CHANGED: 'スプレッドシートの形式が変更されています。管理者に確認してください。',
  SOURCE_LIMIT: '取得できる行数の上限を超えています。管理者に確認してください。',
  INVALID_RESPONSE: 'スプレッドシートの応答を確認できませんでした。もう一度読み込んでください。',
  TIMEOUT: '読み込みに時間がかかっています。接続を確認して、もう一度読み込んでください。',
});
const DEFAULT_ERROR = '読み込めませんでした。接続を確認して、もう一度読み込んでください。';
const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 10 });

function failure(code) {
  const error = new Error(ERROR_MESSAGES[code] || DEFAULT_ERROR);
  error.code = code;
  return error;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validNumber(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

/** Defensive projection: never carry source row indexes or arbitrary metadata into view state. */
export function normalizeLedgerResponse(response) {
  if (response?.ok === false) throw failure(typeof response.error === 'string' ? response.error : 'INVALID_RESPONSE');
  if (response?.ok !== true || response.readOnly !== true || response.writeSupported !== false ||
      !Array.isArray(response.records) || !Array.isArray(response.issues)) throw failure('INVALID_RESPONSE');
  if (response.records.length + response.issues.length > 9999) throw failure('SOURCE_LIMIT');
  const records = [];
  let omittedCount = response.issues.length;
  for (const row of response.records) {
    if (!row || row.readOnly !== true || !validDate(row.date) || typeof row.customerName !== 'string' ||
        !row.customerName.trim() || typeof row.otherItem !== 'string' ||
        !validNumber(row.combustibleKg) || !validNumber(row.noncombustibleKg) || !validNumber(row.otherFee)) {
      omittedCount += 1;
      continue;
    }
    records.push({
      date: row.date,
      customerName: row.customerName,
      combustibleKg: row.combustibleKg,
      noncombustibleKg: row.noncombustibleKg,
      otherItem: row.otherItem,
      otherFee: row.otherFee,
    });
  }
  return { records, omittedCount };
}

export function formatLedgerNumber(value, unit) {
  return value === null ? '—' : `${numberFormat.format(value)}${unit === '円' ? '' : ' '}${unit}`;
}

/**
 * @param {{host: HTMLElement, readPage: (request: {signal: AbortSignal}) => Promise<object>, pageSize?: number, timeoutMs?: number}} options
 * @returns {{show: Function, hide: Function, setAuthorization: Function, refresh: Function, dispose: Function, getState: Function}}
 */
export function installLedgerPanel({ host, readPage, pageSize = 30, timeoutMs = 30000 } = {}) {
  if (!host?.ownerDocument || typeof host.replaceChildren !== 'function') throw new TypeError('host is required');
  if (typeof readPage !== 'function') throw new TypeError('readPage is required');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new RangeError('pageSize must be 1–100');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new RangeError('timeoutMs must be 1–30000');
  const document = host.ownerDocument;
  const view = document.defaultView;
  const listeners = [];
  let disposed = false;
  let visible = false;
  let authorized = false;
  let status = 'locked';
  let records = [];
  let omittedCount = 0;
  let month = '';
  let page = 0;
  let sequence = 0;
  let controller = null;
  let pending = null;
  let resumeRequired = false;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (text, action) => {
    const node = element('button', 'rn-ledger-button', text);
    node.type = 'button';
    node.dataset.action = action;
    return node;
  };
  const on = (node, name, callback) => {
    node.addEventListener(name, callback);
    listeners.push(() => node.removeEventListener(name, callback));
  };

  const root = element('section', 'rn-ledger');
  root.setAttribute('aria-label', 'スプレッドシート・閲覧のみ');
  const heading = element('div', 'rn-ledger-heading');
  const titleGroup = element('div', 'rn-ledger-title-group');
  titleGroup.append(element('p', 'rn-ledger-eyebrow', 'SHEET LEDGER'), element('h2', 'rn-ledger-title', 'スプレッドシート・閲覧のみ'));
  const badge = element('span', 'rn-ledger-badge', '閲覧のみ');
  heading.append(titleGroup, badge);
  const notice = element('p', 'rn-ledger-notice', 'ここに表示するのはスプレッドシートのデータです。報告・設定の保存先は引き続きこのブラウザ内です。スプレッドシートへの書き込みは行いません。');
  const toolbar = element('div', 'rn-ledger-toolbar');
  const monthLabel = element('label', 'rn-ledger-month-label');
  const monthSelect = element('select', 'rn-ledger-month');
  monthSelect.setAttribute('aria-label', '取得したデータの対象月');
  monthLabel.append(element('span', '', '対象月'), monthSelect);
  const refreshButton = button('再読込', 'refresh');
  toolbar.append(monthLabel, refreshButton);
  const message = element('p', 'rn-ledger-status');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const warning = element('p', 'rn-ledger-warning');
  warning.hidden = true;
  const list = element('div', 'rn-ledger-list');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', '取得した回収記録');
  const pagination = element('nav', 'rn-ledger-pagination');
  pagination.setAttribute('aria-label', '取得したデータのページ');
  const previousButton = button('前へ', 'previous');
  const nextButton = button('次へ', 'next');
  const pageText = element('span', 'rn-ledger-page');
  pagination.append(previousButton, pageText, nextButton);
  const retryButton = button('もう一度読み込む', 'retry');
  const footnote = element('p', 'rn-ledger-footnote', '取得したデータを月別・ページ別に表示します。重量の単価や合計金額は計算しません。空欄と0は区別しています。');
  root.append(heading, notice, toolbar, message, retryButton, warning, list, pagination, footnote);
  host.replaceChildren(root);
  host.hidden = true;

  function filteredRecords() {
    return month ? records.filter(row => row.date.slice(0, 7) === month) : records;
  }

  function syncControls() {
    const loading = status === 'loading';
    root.setAttribute('aria-busy', String(loading));
    root.dataset.state = status;
    refreshButton.disabled = !authorized || loading;
    refreshButton.textContent = loading ? '読込中…' : '再読込';
    monthSelect.disabled = !authorized || loading || records.length === 0;
    retryButton.hidden = status !== 'error' || !authorized;
    pagination.hidden = !['ready', 'empty'].includes(status) || filteredRecords().length <= pageSize;
    previousButton.disabled = page === 0 || loading;
    nextButton.disabled = (page + 1) * pageSize >= filteredRecords().length || loading;
  }

  function resetMonths() {
    monthSelect.replaceChildren();
    const all = element('option', '', 'すべての月');
    all.value = '';
    monthSelect.append(all);
    const months = [...new Set(records.map(row => row.date.slice(0, 7)))].sort().reverse();
    for (const item of months) {
      const option = element('option', '', `${item.slice(0, 4)}年${Number(item.slice(5))}月`);
      option.value = item;
      monthSelect.append(option);
    }
    if (month && !months.includes(month)) month = '';
    monthSelect.value = month;
  }

  function clearSensitive() {
    sequence += 1;
    controller?.abort();
    controller = null;
    pending = null;
    records = [];
    omittedCount = 0;
    page = 0;
    month = '';
    list.replaceChildren();
    warning.textContent = '';
    warning.hidden = true;
    pageText.textContent = '';
    message.textContent = '';
    resetMonths();
  }

  function metric(label, value) {
    const item = element('div', 'rn-ledger-metric');
    item.append(element('dt', '', label), element('dd', '', value));
    return item;
  }

  function renderRows() {
    const filtered = filteredRecords();
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.max(0, Math.min(page, pageCount - 1));
    const fragment = document.createDocumentFragment();
    const start = page * pageSize;
    for (const row of filtered.slice(start, start + pageSize)) {
      const card = element('article', 'rn-ledger-card');
      card.setAttribute('role', 'listitem');
      const date = element('time', 'rn-ledger-date', row.date.replaceAll('-', '/'));
      date.dateTime = row.date;
      const customer = element('h3', 'rn-ledger-customer', row.customerName);
      const metrics = element('dl', 'rn-ledger-metrics');
      metrics.append(metric('可燃', formatLedgerNumber(row.combustibleKg, 'kg')), metric('不燃', formatLedgerNumber(row.noncombustibleKg, 'kg')));
      const other = element('dl', 'rn-ledger-other');
      other.append(metric('備考', row.otherItem || '—'), metric('その他', formatLedgerNumber(row.otherFee, '円')));
      card.append(date, customer, metrics, other);
      fragment.append(card);
    }
    list.replaceChildren(fragment);
    status = filtered.length ? 'ready' : 'empty';
    message.textContent = filtered.length
      ? `取得したデータ ${filtered.length}件中 ${start + 1}〜${Math.min(start + pageSize, filtered.length)}件を表示`
      : '表示できる記録はありません。';
    pageText.textContent = `${page + 1} / ${pageCount}`;
    warning.hidden = omittedCount === 0;
    warning.textContent = omittedCount ? `形式を確認できなかった ${omittedCount}件は表示していません。管理者に確認してください。` : '';
    syncControls();
  }

  function showLocked(text = 'Googleログインと閲覧権限を確認してから開いてください。') {
    status = 'locked';
    message.textContent = text;
    syncControls();
  }

  function refresh() {
    if (disposed || !visible || !authorized || document.visibilityState === 'hidden') return Promise.resolve(false);
    if (status === 'loading' && pending) return pending;
    const selectedMonth = month;
    clearSensitive();
    month = selectedMonth;
    resumeRequired = false;
    status = 'loading';
    message.textContent = 'スプレッドシートを読み込んでいます…';
    syncControls();
    const ticket = sequence;
    const currentController = new AbortController();
    controller = currentController;
    const current = () => !disposed && visible && authorized && ticket === sequence && !currentController.signal.aborted;
    let timer;
    let abortListener;
    const interrupted = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(failure('TIMEOUT')), timeoutMs);
      abortListener = () => reject(failure('ABORTED'));
      currentController.signal.addEventListener('abort', abortListener, { once: true });
    });
    // Defer invocation so synchronous throws and synchronous repeated clicks use the same pending task.
    const request = Promise.resolve().then(() => current() ? readPage({ signal: currentController.signal }) : null);
    pending = Promise.race([request, interrupted]).then(response => {
      if (!current()) return false;
      const normalized = normalizeLedgerResponse(response);
      records = normalized.records;
      omittedCount = normalized.omittedCount;
      resetMonths();
      renderRows();
      return true;
    }).catch(error => {
      if (!current()) return false;
      const code = typeof error?.code === 'string' ? error.code : '';
      clearSensitive();
      if (AUTH_CODES.has(code)) {
        authorized = false;
        showLocked(ERROR_MESSAGES[code]);
      } else {
        status = 'error';
        message.textContent = ERROR_MESSAGES[code] || DEFAULT_ERROR;
        syncControls();
      }
      return false;
    }).finally(() => {
      clearTimeout(timer);
      currentController.signal.removeEventListener('abort', abortListener);
      if (ticket === sequence) {
        controller = null;
        pending = null;
        syncControls();
      }
    });
    return pending;
  }

  function suspend() {
    if (disposed) return;
    clearSensitive();
    resumeRequired = true;
    if (authorized) {
      status = 'idle';
      message.textContent = '画面が非表示になったため、表示を消去しました。再読込で確認できます。';
      syncControls();
    } else showLocked();
  }

  on(refreshButton, 'click', refresh);
  on(retryButton, 'click', refresh);
  on(monthSelect, 'change', () => {
    if (!authorized || status === 'loading') return;
    month = monthSelect.value;
    page = 0;
    renderRows();
  });
  on(previousButton, 'click', () => {
    if (!authorized || status !== 'ready' || page === 0) return;
    page -= 1;
    renderRows();
  });
  on(nextButton, 'click', () => {
    if (!authorized || status !== 'ready' || (page + 1) * pageSize >= filteredRecords().length) return;
    page += 1;
    renderRows();
  });
  on(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') suspend(); });
  if (view) on(view, 'pagehide', suspend);
  showLocked();

  return Object.freeze({
    show() {
      if (disposed) return Promise.resolve(false);
      const changed = !visible;
      visible = true;
      host.hidden = false;
      if (!authorized) { showLocked(); return Promise.resolve(false); }
      return changed || resumeRequired ? refresh() : pending || Promise.resolve(status === 'ready' || status === 'empty');
    },
    hide() {
      if (disposed) return;
      visible = false;
      host.hidden = true;
      suspend();
    },
    setAuthorization(value) {
      if (disposed) return Promise.resolve(false);
      if (value !== true) {
        authorized = false;
        clearSensitive();
        showLocked();
        return Promise.resolve(false);
      }
      if (authorized) return pending || Promise.resolve(status === 'ready' || status === 'empty');
      clearSensitive();
      authorized = true;
      status = 'idle';
      message.textContent = '再読込するとスプレッドシートを表示します。';
      syncControls();
      return visible ? refresh() : Promise.resolve(false);
    },
    refresh,
    getState() {
      return Object.freeze({ visible, authorized, status, month, page: page + 1, rowCount: records.length, filteredCount: filteredRecords().length });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      visible = false;
      authorized = false;
      clearSensitive();
      listeners.splice(0).forEach(remove => remove());
      root.remove();
      host.hidden = true;
    },
  });
}
