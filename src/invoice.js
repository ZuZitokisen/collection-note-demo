import { localDate } from './model.js';
import { reportNotes } from './domain.js';

// Reference: the source workbook's 請求書 layout, inspected read-only.
// No source customer, issuer, contact, price, or bank information is embedded.
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const SCALE = 1_000_000n;
const PRODUCT_SCALE = SCALE * SCALE;
function fixed(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) return null;
  const [whole, fraction = ''] = value.toFixed(6).split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
}
function decimal(value, scale = PRODUCT_SCALE) {
  const digits = String(scale).length - 1;
  const fraction = (value % scale).toString().padStart(digits, '0').replace(/0+$/, '');
  return `${value / scale}${fraction ? `.${fraction}` : ''}`;
}
function number(value) {
  if (value === null) return '算出不可';
  const [whole, fraction] = String(value).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
}
function monthInfo(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.slice(0, 4) === '0000') throw new Error('対象年月を選択してください。');
  const [year, mm] = month.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const last = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm - 1];
  return { month, label: `${year}年${mm}月`, endDate: `${year}年${mm}月${last}日`, start: `${month}-01`, end: `${month}-${last}` };
}
function categoryLine(records, category, title) {
  let kg = 0n, known = 0n, entered = 0, missing = 0, quantities = 0;
  const rates = new Set();
  const details = [];
  for (const r of records) {
    const quantity = fixed(r[`${category}Kg`]), rate = fixed(r[`${category}Rate`]);
    const note = reportNotes(r)[category];
    const relevant = quantity !== null || Boolean(note || r.itemIds?.[category] || r.itemNames?.[category]);
    if (!relevant) continue;
    if (note) details.push({ date: r.date, text: note });
    entered++;
    if (quantity !== null) { kg += quantity; quantities++; }
    if (rate !== null) rates.add(decimal(rate, SCALE));
    if (quantity === null || rate === null) missing++;
    else known += quantity * rate;
  }
  return { category, title, quantity: quantities ? decimal(kg, SCALE) : null, unit: 'kg', rates: [...rates], known, amount: entered && !missing ? decimal(known) : null, entered, missing, details };
}

export function buildInvoicePreview(state, { month = localDate().slice(0, 7), customerId } = {}) {
  const dates = monthInfo(month);
  const customers = state.masters.customers;
  const customer = customers.find(c => c.id === customerId) || (customerId === undefined ? customers.find(c => state.records.some(r => !r.deleted && r.customerId === c.id && r.date >= dates.start && r.date <= dates.end)) || customers[0] : null);
  const records = customer ? state.records.filter(r => !r.deleted && r.customerId === customer.id && r.date >= dates.start && r.date <= dates.end).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)) : [];
  const combustible = categoryLine(records, 'combustible', '可燃物処分料');
  const noncombustible = categoryLine(records, 'noncombustible', '不燃物処分料');
  const otherRecords = records.filter(r => fixed(r.otherFee) !== null || reportNotes(r).other || r.itemIds?.other || r.itemNames?.other);
  let otherKnown = 0n, otherMissing = 0;
  for (const r of otherRecords) {
    const fee = fixed(r.otherFee);
    if (fee === null) otherMissing++;
    else otherKnown += fee * SCALE;
  }
  const missing = combustible.missing + noncombustible.missing + otherMissing;
  const hasCharges = combustible.entered + noncombustible.entered + otherRecords.length > 0;
  const known = combustible.known + noncombustible.known + otherKnown;
  const other = { title: '粗大ごみ・その他', amount: otherRecords.length && !otherMissing ? decimal(otherKnown) : null, entered: otherRecords.length, missing: otherMissing, details: otherRecords.map(r => ({ date: r.date, text: reportNotes(r).other || r.itemNames?.other || '備考未入力', amount: fixed(r.otherFee) === null ? null : decimal(fixed(r.otherFee), SCALE) })) };
  // Remove BigInt internals from the exported view model. All money is exact
  // decimal text, without applying an unconfirmed production rounding policy.
  const publicLine = ({ known: _known, ...line }) => line;
  return { ...dates, customer: customer ? { id: customer.id, name: customer.name, active: customer.active } : null, count: records.length, lines: [publicLine(combustible), publicLine(noncombustible)], other, missing, knownCharges: hasCharges ? decimal(known) : null, recordedCharges: hasCharges && !missing ? decimal(known) : null, legacyUnknown: records.filter(r => r.priceSource === 'legacy-unknown').length };
}

function lineHTML(line) {
  const rate = !line.entered ? '未入力' : line.missing ? '不明・未入力あり' : line.rates.length === 1 ? number(line.rates[0]) : '記録ごとに異なる';
  const price = !line.entered ? '対象の入力なし' : line.missing ? '算出不可' : number(line.amount);
  const notes = line.details.map(item => `<span>${esc(item.date.slice(8))}日: ${esc(item.text)}</span>`).join('<br>');
  const status = line.missing ? `${line.missing}件の重量・単価が不明` : line.entered ? '記録時の単価で参考計算' : '0円とは扱いません';
  const remarks = notes ? notes + (line.missing ? `<br>${status}` : '') : status;
  return `<tr><th scope="row">${line.title}</th><td class="invoice-number">${line.quantity === null ? '未入力' : number(line.quantity)}</td><td>${line.unit}</td><td class="invoice-number">${rate}</td><td class="invoice-number">${price}</td><td class="invoice-report-notes">${remarks}</td></tr>`;
}
function previewHTML(view) {
  if (!view.customer) return '<div class="empty-state">出力する取引先がありません。設定で架空の取引先を追加してください。</div>';
  const subtotal = view.recordedCharges === null ? '算出不可' : `${number(view.recordedCharges)} 円`;
  const otherNote = view.other.details.length ? view.other.details.map(item => `<span>${esc(item.date.slice(8))}日: ${esc(item.text)}${item.amount === null ? '（金額未入力）' : ''}</span>`).join('') : '対象の入力なし';
  return `<article class="invoice-paper" aria-label="請求書の架空プレビュー">
    <div class="invoice-sample">SAMPLE <span>架空データ・確認用 / 請求には使用できません</span></div>
    <h2>御 請 求 書 <small>プレビュー</small></h2>
    <div class="invoice-parties">
      <div class="invoice-recipient"><p>〒［郵便番号 未設定］<br>［宛先住所 未設定］</p><h3>${esc(view.customer.name)}${view.customer.active ? '' : '（利用停止）'}　御中</h3><p>毎度格別のお引き立てを賜り、厚く御礼申し上げます。<br>以下は、保存済みの架空記録による参考表示です。</p></div>
      <dl class="invoice-issuer"><div><dt>請求番号</dt><dd>未発行（プレビュー）</dd></div><div><dt>請求日（見本）</dt><dd>${view.endDate}</dd></div><div><dt>発行者</dt><dd>サンプル回収サービス（架空）</dd></div><div><dt>所在地</dt><dd>未設定</dd></div><div><dt>TEL</dt><dd>未設定</dd></div><div><dt>登録番号</dt><dd>未設定</dd></div></dl>
    </div>
    <p class="invoice-period">対象期間: ${view.label}分 · 有効な記録 ${view.count}件</p>
    <div class="invoice-top-total"><span>記録料金の小計（参考）<small>基本料・税を含みません</small></span><strong data-invoice-total="top">${subtotal}</strong></div>
    ${view.missing ? `<p class="invoice-warning">重量・単価・金額の不明または未入力が${view.missing}項目あります。小計は算出できません。入力済み部分のみの参考額: ${number(view.knownCharges)} 円。</p>` : ''}
    ${!view.count ? '<p class="invoice-warning">この年月・取引先の記録はありません。金額を0円で補完していません。</p>' : ''}
    <div class="invoice-table-wrap"><table class="invoice-table"><caption>品名・内訳</caption><thead><tr><th scope="col">品名・内訳</th><th scope="col">数量</th><th scope="col">単位</th><th scope="col">単価(円)</th><th scope="col">金額(円)</th><th scope="col">備考</th></tr></thead><tbody>
      <tr><th scope="row">特別清掃運搬料・処理手数料（基本料）</th><td>—</td><td>式</td><td>未設定</td><td>未設定</td><td>月額固定基本料・計算対象外</td></tr>
      ${view.lines.map(lineHTML).join('')}
      <tr><th scope="row">粗大ごみ・その他</th><td>${view.other.entered ? '1' : '—'}</td><td>式</td><td>${view.other.entered ? '記録金額の合算' : '未入力'}</td><td class="invoice-number">${view.other.entered ? number(view.other.amount) : '対象の入力なし'}</td><td class="invoice-other-notes">${otherNote}</td></tr>
    </tbody></table></div>
    <div class="invoice-bottom"><p>参考額は「各回の重量 × 各回の保存単価」と、記録済みのその他料金の合算です。現在の設定単価による上書きや円単位への丸めはしていません。${view.legacyUnknown ? '<br>旧版記録の不明な単価は補完していません。' : ''}</p><dl class="invoice-totals"><div><dt>小計（記録料金・参考）</dt><dd data-invoice-total="bottom">${subtotal}</dd></div><div><dt>基本料</dt><dd>未設定</dd></div><div><dt>消費税等</dt><dd>未設定・未計算</dd></div><div class="invoice-grand-total"><dt>合計金額（ご請求額）</dt><dd>未確定</dd></div></dl></div>
    <section class="invoice-bank"><h3>振込先情報</h3><p>金融機関・支店・口座種別・口座番号・口座名義: 未設定</p><p>これは請求書の見本です。振込先の指定や支払依頼ではありません。</p></section>
    <footer class="invoice-footnotes"><p>基本料、税率・税込／税別、端数処理、発行者、振込先、採番ルールは未設定です。正式発行・外部送信・元スプレッドシートへの書き込みは行いません。</p><p>元スプレッドシート「請求書」の項目構成を参考にしています。</p></footer>
  </article>`;
}

export function renderInvoiceOutput(state, selection = {}) {
  const view = buildInvoicePreview(state, selection);
  const options = state.masters.customers.map(c => `<option value="${esc(c.id)}" ${c.id === view.customer?.id ? 'selected' : ''}>${esc(c.name)}${c.active ? '' : '（利用停止）'}</option>`).join('');
  return `<div class="section-heading"><div><p class="eyebrow">OUTPUT</p><h1>出力</h1><p class="subheading">元の「請求書」に沿った、確認用プレビュー。</p></div><span class="page-chip">架空データのみ</span></div>
    <div class="invoice-controls"><label class="field"><span>対象年月</span><input type="month" id="invoice-month" min="0001-01" max="9999-12" value="${view.month}" required></label><label class="field"><span>取引先</span><select id="invoice-customer" ${options ? '' : 'disabled'}>${options || '<option value="">取引先なし</option>'}</select></label><button type="button" class="button primary" id="invoice-print" ${view.count ? '' : 'disabled'}>見本を印刷 / PDF</button></div>
    <p class="invoice-guide">このブラウザに保存した架空記録だけを表示します。PDFに保存する場合は、印刷画面で保存先を選んでください。</p><p id="invoice-error" class="form-error" role="alert" hidden></p>
    <div id="invoice-preview" aria-live="polite">${previewHTML(view)}</div>`;
}

export function installInvoiceOutput({ doc = document, getState, print = () => doc.defaultView.print() }) {
  const host = doc.querySelector('#output-section');
  if (!host) throw new Error('出力画面が見つかりません。');
  const win = doc.defaultView;
  const printMedia = win.matchMedia?.('print');
  let selection = {}, disposed = false;
  function refresh() {
    if (disposed) return;
    const view = buildInvoicePreview(getState(), selection);
    selection = { month: view.month, customerId: view.customer?.id };
    host.innerHTML = renderInvoiceOutput(getState(), selection);
  }
  function showError(message) {
    const error = host.querySelector('#invoice-error');
    error.textContent = message;
    error.hidden = false;
    host.querySelector('#invoice-print').disabled = true;
    host.querySelector('#invoice-preview').innerHTML = '<div class="empty-state">対象年月を選び直すと、プレビューを表示します。</div>';
  }
  const change = event => {
    if (!['invoice-month', 'invoice-customer'].includes(event.target.id)) return;
    const focusId = event.target.id;
    const next = { month: host.querySelector('#invoice-month').value, customerId: host.querySelector('#invoice-customer').value };
    try { buildInvoicePreview(getState(), next); selection = next; refresh(); host.querySelector(`#${focusId}`).focus(); }
    catch (error) { showError(error.message); }
  };
  const click = event => {
    const button = event.target.closest('#invoice-print');
    if (!button || button.disabled) return;
    try {
      // Rebuild immediately before printing so a prior preview cannot become a
      // stale financial-looking document after a local record change.
      refresh();
      if (!buildInvoicePreview(getState(), selection).count) return;
      doc.body.classList.add('invoice-printing');
      // Safari may return before its print sheet closes. Keep the print-only
      // layout until afterprint / print media exit rather than using finally.
      print();
    } catch { finishPrint(); showError('印刷画面を開けませんでした。ブラウザの印刷メニューもお試しください。'); }
  };
  function finishPrint() { doc.body.classList.remove('invoice-printing'); }
  function beforePrint() {
    if (host.hidden || !host.querySelector('.invoice-paper')) { finishPrint(); return; }
    try { refresh(); doc.body.classList.toggle('invoice-printing', buildInvoicePreview(getState(), selection).count > 0); }
    catch { finishPrint(); }
  }
  const printMediaChange = event => { if (!event.matches) finishPrint(); };
  host.addEventListener('change', change);
  host.addEventListener('click', click);
  win.addEventListener('beforeprint', beforePrint);
  win.addEventListener('afterprint', finishPrint);
  printMedia?.addEventListener('change', printMediaChange);
  refresh();
  return { refresh, destroy() { disposed = true; host.removeEventListener('change', change); host.removeEventListener('click', click); win.removeEventListener('beforeprint', beforePrint); win.removeEventListener('afterprint', finishPrint); printMedia?.removeEventListener('change', printMediaChange); finishPrint(); } };
}
