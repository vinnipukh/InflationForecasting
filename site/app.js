// Gürmar forecast site: plain JS, no build step. Data comes from data/*.json (python -m src.site_export).

const I18N = {
  tr: {
    brand: 'Gürmar Fiyat Tahminleri',
    title: 'Gürmar Fiyat Tahminleri',
    h1: 'Yarın bu ürün kaç lira olacak?',
    lead: 'Bir süpermarketin (Gürmar) internet sitesinden her gün toplanan fiyatlarla, ürün ürün ertesi günün normal fiyatını tahmin eden bir model. Rakip, en zor yenilen tahmin: "yarın da bugünkü fiyat".',
    cmp_h: 'Persistence baseline ile karşılaştırma',
    cmp_p: (n, d) => `Modelin tahmin yaptığı hedef günlerde (ayın 1, 14, 15, 16'sı ve bayramlar), her test bloğunda LightGBM hurdle modeli ile persistence baseline (yarının fiyatı = dünün normal fiyatı). ${n} ürün, ${d} gün veri.`,
    lower_better: 'Düşük olan daha iyi.',
    r2r_hint: 'Yüksek olan daha iyi. Fiyat değişiminin açıklanan varyansı; persistence ≈ 0.',
    r2p_hint: 'Yüksek olan daha iyi. Dünün fiyatı fiyat seviyesini zaten açıkladığı için ikisi de ≈ 1; asıl bilgi R² (getiri).',
    results_h: 'Sonuçlar',
    results_p: 'Hedef günlerde, blok blok. Gri: persistence baseline. Mavi: LightGBM hurdle modeli.',
    results_note: 'Sistem görünümü: model yalnızca hedef günlerde, diğer günlerde dünün fiyatı kullanılır; tüm test günleri üzerinden. B3 son ayrılmış test (holdout) bloğu; model seçiminde kullanılmadı.',
    dummy: 'Persistence (dünün fiyatı)',
    dummy_short: 'Persistence',
    model: 'LightGBM hurdle',
    col_block: 'Blok', col_period: 'Test dönemi', col_model: 'Model', col_rows: 'Satır', col_mae: 'MAE (TL)', col_mape: 'MAPE %',
    col_rmse: 'RMSE', col_r2: 'R² (getiri)', col_r2p: 'R² (fiyat)', col_da: 'Yön doğruluğu %', col_sys: 'Sistem MAE (tüm günler)',
    explorer_h: 'Ürün gezgini',
    explorer_p: 'Bir ürün seçin: normal fiyat (kampanyalar ayıklanmış) ve modelin hedef günlerdeki tahminleri. Tahmin noktası, o gün için bir önceki günün bilgisiyle yapılan tahmindir. Dolu nokta: model fiyat değişimi bekliyor; boş nokta: "değişmez" tahmini. Mavi bantlar B1/B2/B3 test dönemleri, gri bant ön işlemede çıkarılan dönem (scraper arızası: yalnızca 275 ürün çekildi, verisi olanlar da kullanılmadı); gölgesiz günler eğitim verisi. Liste, tahmini olan ve fiyat geçmişi en uzun ürünlerden başlar.',
    search_ph: 'Ürün ara…', search_label: 'Ürün ara', cat_label: 'Kategori', skip: 'İçeriğe atla',
    loading: 'Veriler yükleniyor…', load_error: 'Veriler yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.', retry: 'Tekrar dene',
    better: 'persistence\'tan iyi', worse: 'persistence\'tan kötü',
    chart_sr: (m, parts) => `${m}, persistence ve model: ${parts}`,
    product_sr: (n, k) => `${n}: normal fiyat geçmişi ve ${k} hedef gün tahmini; değerler aşağıdaki tabloda.`,
    all_cats: 'Tüm kategoriler',
    only_changes: 'Sadece değişim tahmin edilenler',
    regular: 'Normal fiyat', forecast: 'Model tahmini', band_outage: 'Ön işlemede çıkarıldı',
    p_date: 'Tarih', p_block: 'Blok', p_base: 'Dünkü fiyat', p_pred: 'Tahmin', p_actual: 'Gerçek', p_err: 'Model hatası', p_dummy_err: 'Persistence hatası',
    no_preds: 'Bu ürün için test bloklarında hedef gün tahmini yok.',
    n_products: (n, total) => `${n.toLocaleString('tr-TR')} / ${total.toLocaleString('tr-TR')} ürün`,
    meta: (p) => `${p.cat} · ${p.id}`,
    td_h: 'Neden sadece belirli günlerde tahmin?',
    td_p: 'Model her gün tahmin yapmıyor. Yalnızca ayın 1, 14, 15, 16\'sında ve resmi/dini bayramlarda çalışıyor, diğer günlerde dünün fiyatını kullanıyor. Sebebi, Gürmar\'da fiyatların çoğunlukla bu günlerde değişmesi. Aşağıdaki sayılar, normal fiyatı bir önceki güne göre değişen ürün sayısı. Değişimin tutarı önemli değil: 1 TL\'den 10 TL\'ye çıkan bir ürün de bir değişim sayılır.',
    td_k_days: 'Hedef günlerin tüm günlere oranı',
    td_k_changes: 'Fiyat değişimlerinin hedef günlere düşen payı',
    td_k_avg: 'Günde ortalama fiyat değişimi: hedef günler / diğer günler',
    td_k_err: 'Dünün fiyatıyla yapılan toplam hatanın (TL) hedef günlere düşen payı',
    td_chart: 'Ayın gününe göre fiyat değişim oranı (%)',
    td_target: 'Hedef gün (1, 14, 15, 16)', td_other: 'Diğer günler',
    td_table_h: 'Ay ay fiyat değişimi sayısı',
    td_cols: ['Ay', 'Ayın 1\'i', '14\'ü', '15\'i', '16\'sı', 'Bayram/tatil', 'Hedef günler toplam', 'Diğer günler toplam', 'Diğer gün sayısı'],
    td_total: 'Toplam',
    td_note: 'Değişim: normal fiyatın (kampanyalar ayıklanmış) bir önceki güne göre %0,5\'ten fazla oynaması; iki günün de gözlenmiş olması gerekir. Haziran–Temmuz ile Mayıs ve Ağustos\'un bir kısmı scraper kesintisinde kalıyor. 1 Mayıs, 30 Nisan\'da veri olmadığı için sayılamadı. "–": o gün veri yok. Grafikte bayramlar "diğer günler" içinde.',
    td_why: 'Bu neden işe yarıyor? Diğer günlerde fiyat neredeyse hiç değişmiyor. Orada "dünün fiyatı" zaten neredeyse kusursuz; model tahmin yapsa ancak gereksiz değişimler öngörüp hata ekleyebilir. Hedef günlerde değişim olasılığı birkaç kat yüksek, bu yüzden modelin "yarın fiyat değişir" sinyali eşiği geçebiliyor. Tahmini bu günlere sınırlamak modeli en çok işe yaradığı yerde kullanmak demek. Ay sonunu da içeren ilk gün kümesine göre MAE iyileşmesi B2\'de %18,9\'dan %23,7\'ye, B3\'te −%50,8\'den +%7,3\'e çıktı.',
    method_h: 'Nasıl çalışıyor?',
    method: [
      ['Hedef', 'Ertesi günün normal fiyatı. Kampanya indirimleri ayıklanır: bir fiyat düşüşü 21 güne kadar kampanya sayılır, sonra yeni normal fiyat olur.'],
      ['Hedef günler', 'Fiyatlar çoğunlukla ayın 1\'inde (%9,2 değişim oranı) ve 14–16\'sında değişir; ay sonunda neredeyse hiç değişmez. Model ayın 1, 14, 15, 16\'sında ve resmi/dini bayramlarda tahmin yapar, diğer günlerde dünün fiyatı kullanılır.'],
      ['Model', 'LightGBM "hurdle": bir sınıflandırıcı "yarın fiyat değişir mi?" diye sorar, bir regresör değişimin büyüklüğünü tahmin eder. Olasılık eşiği geçilmezse tahmin "değişmez" olur.'],
      ['Girdiler', '50 değişken, hepsi bir önceki günün sonunda bilinen: fiyat gecikmeleri, son değişimden beri geçen gün, değişim sayıları, kampanya durumu, birim fiyat, takvim, dolar/TL, Brent, TÜİK gıda TÜFE.'],
      ['Değerlendirme', 'Genişleyen pencereli üç blok (B1 Nisan, B2 Eylül başı, B3 Eylül sonu). Hiperparametreler yalnızca B1 eğitim penceresinde ayarlandı. Sızıntı testi: T gününden sonraki fiyatlar karıştırılınca hiçbir değişken değişmiyor.'],
      ['Veri', 'Gürmar\'ın internet sitesinden günlük kazınan fiyatlar (Şubat–Ekim 2026). Kaynak: InflationResearchStudy reposu.'],
    ],
    caveats_h: 'Dikkat edilmesi gerekenler',
    caveats: [
      'Hedef gün sayısı az: B1\'de 5, B2\'de 4, B3\'te yalnızca 1 gün (1 Ekim). B3 sonucu tek güne dayanıyor.',
      '6 Mayıs – 17 Ağustos arasında kazıyıcı arızası: her gün yalnızca 275 ürün tekrar tekrar geldi. Bu dönem eğitim ve testten çıkarıldı.',
      'İyileşmenin istatistiksel anlamlılığı (Diebold–Mariano testi) henüz yapılmadı.',
      'Verinin sonuna yakın bazı ürünler Eylül başından beri tam %50 indirimde; kampanya filtresi bunları kalıcı indirim sayıyor, yani etiketler yanlış olabilir.',
      'Bu bir araştırma projesidir; fiyat garantisi veya yatırım tavsiyesi değildir.',
    ],
    footer: 'Kod ve ayrıntılı rapor: <a href="https://github.com/vinnipukh/InflationForecasting">github.com/vinnipukh/InflationForecasting</a> · Veri: <a href="https://github.com/urazkagangunes/InflationResearchStudy">InflationResearchStudy</a>',
    generated: (d, end) => `Veri son günü: ${end} · Sayfa verisi üretildi: ${d}`,
    theme_to_dark: 'Koyu temaya geç', theme_to_light: 'Açık temaya geç',
    cats: { '01': 'Gıda ve alkolsüz içecekler', '05': 'Ev eşyası ve bakım', '09': 'Eğlence ve kültür', '13': 'Kişisel bakım', 'unknown': 'Diğer' },
  },
  en: {
    brand: 'Gürmar Price Forecasts',
    title: 'Gürmar Price Forecasts',
    h1: 'What will this product cost tomorrow?',
    lead: 'A model that forecasts tomorrow\'s regular price, product by product, from prices scraped daily from one Turkish supermarket\'s website (Gürmar). The opponent is the forecast that is hardest to beat: "tomorrow\'s price = today\'s price".',
    cmp_h: 'Comparison with the persistence baseline',
    cmp_p: (n, d) => `On the target days the model forecasts (1st, 14th, 15th, 16th of the month and holidays), per test block: LightGBM hurdle model vs. the persistence baseline (tomorrow's price = yesterday's regular price). ${n} products, ${d} days of data.`,
    lower_better: 'Lower is better.',
    r2r_hint: 'Higher is better. Explained variance of the price change; persistence ≈ 0.',
    r2p_hint: 'Higher is better. Yesterday\'s price already explains the price level, so both are ≈ 1; R² (return) is the informative one.',
    results_h: 'Results',
    results_p: 'Target days, per block. Grey: persistence baseline. Blue: LightGBM hurdle model.',
    results_note: 'System view: model on target days, yesterday\'s price on every other day, over all test days. B3 is the final holdout block; it was not used for model selection.',
    dummy: 'Persistence (yesterday\'s price)',
    dummy_short: 'Persistence',
    model: 'LightGBM hurdle',
    col_block: 'Block', col_period: 'Test period', col_model: 'Model', col_rows: 'Rows', col_mae: 'MAE (TRY)', col_mape: 'MAPE %',
    col_rmse: 'RMSE', col_r2: 'R² (return)', col_r2p: 'R² (price)', col_da: 'Direction acc. %', col_sys: 'System MAE (all days)',
    explorer_h: 'Product explorer',
    explorer_p: 'Pick a product: regular price (sales filtered out) and the model\'s forecasts on target days. Each forecast point is made with information up to the previous day. Filled point: the model expects a price change; hollow point: a "no change" forecast. Blue bands are the B1/B2/B3 test periods, the grey band was dropped at preprocessing (scraper outage: only 275 products were scraped, and even their data was not used); unshaded days are training data. The list starts with products that have forecasts and the longest price history.',
    search_ph: 'Search products…', search_label: 'Search products', cat_label: 'Category', skip: 'Skip to content',
    loading: 'Loading data…', load_error: 'Data could not be loaded. Check your connection and try again.', retry: 'Try again',
    better: 'better than persistence', worse: 'worse than persistence',
    chart_sr: (m, parts) => `${m}, persistence vs. model: ${parts}`,
    product_sr: (n, k) => `${n}: regular price history and ${k} target-day forecasts; values in the table below.`,
    all_cats: 'All categories',
    only_changes: 'Only predicted changes',
    regular: 'Regular price', forecast: 'Model forecast', band_outage: 'Dropped at preprocessing',
    p_date: 'Date', p_block: 'Block', p_base: 'Yesterday', p_pred: 'Forecast', p_actual: 'Actual', p_err: 'Model error', p_dummy_err: 'Persistence error',
    no_preds: 'No target-day forecasts for this product in the test blocks.',
    n_products: (n, total) => `${n.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} products`,
    meta: (p) => `${p.cat} · ${p.id}`,
    td_h: 'Why forecast only on certain days?',
    td_p: 'The model does not forecast every day. It runs only on the 1st, 14th, 15th and 16th of the month and on public/religious holidays, and uses yesterday\'s price on every other day. The reason: at Gürmar, prices mostly change on these days. The numbers below count products whose regular price changed from the previous day. The size of the change does not matter: a product going from 1 TRY to 10 TRY counts as one change.',
    td_k_days: 'Share of all days that are target days',
    td_k_changes: 'Share of price changes that fall on target days',
    td_k_avg: 'Average price changes per day: target days / other days',
    td_k_err: 'Share of the total error (TRY) of yesterday\'s price that falls on target days',
    td_chart: 'Price-change rate by day of month (%)',
    td_target: 'Target day (1, 14, 15, 16)', td_other: 'Other days',
    td_table_h: 'Price changes per month',
    td_cols: ['Month', '1st', '14th', '15th', '16th', 'Holidays', 'Target days total', 'Other days total', 'Number of other days'],
    td_total: 'Total',
    td_note: 'Change: the regular price (sales filtered out) moved by more than 0.5 % from the previous day; both days must be observed. June–July and parts of May and August fall in the scraper outage. May 1 could not be counted because April 30 has no data. "–": no data that day. In the chart, holidays are part of "other days".',
    td_why: 'Why does this work? On other days prices hardly ever change. There, "yesterday\'s price" is already almost perfect; a model forecasting there could only add error by predicting changes that do not happen. On target days a change is several times more likely, so the model\'s "price changes tomorrow" signal can clear its threshold. Restricting forecasts to these days uses the model where it helps most. Compared with the first day set, which included month end, the MAE gain went from 18.9 % to 23.7 % in B2 and from −50.8 % to +7.3 % in B3.',
    method_h: 'How it works',
    method: [
      ['Target', 'Tomorrow\'s regular price. Sales are filtered out: a price drop counts as a sale for up to 21 days, then becomes the new regular price.'],
      ['Target days', 'Prices mostly change on the 1st of the month (9.2 % change rate) and on the 14th–16th, almost never at month end. The model forecasts on the 1st, 14th, 15th, 16th and on public/religious holidays; every other day uses yesterday\'s price.'],
      ['Model', 'LightGBM "hurdle": a classifier asks "does the price change tomorrow?", a regressor predicts the size. Below the probability threshold the forecast is "no change".'],
      ['Inputs', '50 features, all known at the end of the previous day: price lags, days since last change, change counts, sale state, unit price, calendar, USD/TRY, Brent, TÜİK food CPI.'],
      ['Evaluation', 'Three expanding-window blocks (B1 April, B2 early September, B3 late September). Hyperparameters tuned on B1\'s training window only. Leakage test: scrambling prices after day T changes no feature.'],
      ['Data', 'Prices scraped daily from Gürmar\'s website (Feb–Oct 2026). Source: the InflationResearchStudy repository.'],
    ],
    caveats_h: 'Caveats',
    caveats: [
      'Few target days: 5 in B1, 4 in B2, only 1 in B3 (Oct 1). The B3 result rests on a single day.',
      'Scraper outage 6 May – 17 Aug: only 275 products repeated every day. This period is excluded from training and testing.',
      'Statistical significance of the gain (Diebold–Mariano test) is not done yet.',
      'Some products near the end of the data have been exactly 50 % off since early September; the sale filter treats these as permanent cuts, so their labels may be wrong.',
      'This is a research project, not a price guarantee or investment advice.',
    ],
    footer: 'Code and full report: <a href="https://github.com/vinnipukh/InflationForecasting">github.com/vinnipukh/InflationForecasting</a> · Data: <a href="https://github.com/urazkagangunes/InflationResearchStudy">InflationResearchStudy</a>',
    generated: (d, end) => `Last data day: ${end} · Page data generated: ${d}`,
    theme_to_dark: 'Switch to dark theme', theme_to_light: 'Switch to light theme',
    cats: { '01': 'Food & non-alcoholic beverages', '05': 'Household goods & maintenance', '09': 'Recreation & culture', '13': 'Personal care', 'unknown': 'Other' },
  },
};

const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

let lang = store.get('lang') || ((navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en');
let summary = null, products = null, dates = null, selected = null;
let metricCharts = [], productChart = null, domChart = null;

const $ = (s) => document.querySelector(s);
const t = (k) => I18N[lang][k];
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmt = (x, d = 2) => x == null ? '–' : x.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x, d = 1) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x), d) + ' %';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isDark = () => document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === 'dark'
  : matchMedia('(prefers-color-scheme: dark)').matches;

// ── theme & language ────────────────────────────────────────────────────────

function renderThemeButton() {
  const btn = $('#theme-btn');
  btn.innerHTML = isDark() ? ICON_SUN : ICON_MOON;
  btn.setAttribute('aria-label', t(isDark() ? 'theme_to_light' : 'theme_to_dark'));
  btn.title = btn.getAttribute('aria-label');
}

$('#theme-btn').addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
  renderThemeButton();
  renderCharts();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { renderThemeButton(); renderCharts(); });

document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang;
  store.set('lang', lang);
  renderAll();
}));

function renderStatic() {
  document.documentElement.lang = lang;
  document.title = t('title');
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $('#method-cols').innerHTML = t('method').map(([h, p]) => `<div class="card"><h3>${h}</h3><p>${p}</p></div>`).join('');
  $('#caveats-list').innerHTML = t('caveats').map((c) => `<li>${c}</li>`).join('');
  renderThemeButton();
}

// ── results ─────────────────────────────────────────────────────────────────

// [summary key, label key, decimals, higher is better, hint key]
const METRICS = [
  ['MAE', 'col_mae', 3, false, 'lower_better'],
  ['MAPE_%', 'col_mape', 3, false, 'lower_better'],
  ['R2_return', 'col_r2', 3, true, 'r2r_hint'],
  ['R2_price', 'col_r2p', 4, true, 'r2p_hint'],
];

function renderTiles() {
  $('#cmp-p').textContent = t('cmp_p')(fmt(summary.n_products, 0), fmt(summary.n_days, 0));
  $('#tiles').innerHTML = METRICS.map(([key, label, d, higher, hint]) => {
    const rows = summary.blocks.map((b) => {
      const base = b.dummy[key], model = b.model[key];
      const better = higher ? model > base : model < base;
      return `<tr><td class="l">${b.block}</td><td>${fmt(base, d)}</td><td class="${model === base ? '' : better ? 'good' : 'bad'}">${fmt(model, d)}${model === base ? '' : `<span class="sr-only"> (${t(better ? 'better' : 'worse')})</span>`}</td></tr>`;
    }).join('');
    return `<div class="card"><h3>${t(label)}</h3><p class="hint">${t(hint)}</p>
      <table><thead><tr><th class="l">${t('col_block')}</th><th>${t('dummy_short')}</th><th>Model</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
}

// ── target days: how often prices change on the days the model forecasts ───

const share = (x) => (lang === 'tr' ? `%${fmt(100 * x, 0)}` : `${fmt(100 * x, 0)} %`);

function renderTargetDays() {
  const c = summary.calendar;
  const all = c.target.changes + c.other.changes;
  $('#td-tiles').innerHTML = [
    [share(c.target.days / (c.target.days + c.other.days)), 'td_k_days'],
    [share(c.target.changes / all), 'td_k_changes'],
    [`${fmt(c.target.changes / c.target.days, 0)} <small>/ ${fmt(c.other.changes / c.other.days, 0)}</small>`, 'td_k_avg'],
    [share(c.target.persistence_abs_err_try / (c.target.persistence_abs_err_try + c.other.persistence_abs_err_try)), 'td_k_err'],
  ].map(([v, k]) => `<div class="card"><div class="tile-v">${v}</div><p class="hint">${t(k)}</p></div>`).join('');

  const kinds = ['1', '14', '15', '16', 'holiday'];
  const cell = (v, cls = '') => `<td${cls ? ` class="${cls}"` : ''}>${v == null ? '–' : fmt(v, 0)}</td>`;
  // null when the month has no target day in the data (shown as "–", not 0)
  const targetSum = (r) => (kinds.some((k) => r[k] != null) ? kinds.reduce((s, k) => s + (r[k] ?? 0), 0) : null);
  const monthName = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric' });
  const rows = c.months.map((r) => `<tr><td class="l">${monthName(r.month)}</td>${kinds.map((k) => cell(r[k])).join('')}
    ${cell(targetSum(r), 'hi')}${cell(r.other)}${cell(r.other_days)}</tr>`);
  const tot = Object.fromEntries([...kinds, 'other', 'other_days'].map((k) => [k, c.months.reduce((s, r) => s + (r[k] ?? 0), 0)]));
  rows.push(`<tr class="model"><td class="l">${t('td_total')}</td>${kinds.map((k) => cell(tot[k])).join('')}
    ${cell(targetSum(tot), 'hi')}${cell(tot.other)}${cell(tot.other_days)}</tr>`);
  $('#td-table').innerHTML = `<thead><tr>${t('td_cols').map((h, i) => `<th${i ? '' : ' class="l"'}>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>`;
}

function renderDomChart() {
  const c = summary.calendar, isTarget = (d) => [1, 14, 15, 16].includes(d);
  const rate = (d) => 100 * d.changes / d.products;
  domChart?.destroy();
  const canvas = $('#chart-dom');
  canvas.ariaLabel = `${t('td_chart')}: ` + c.by_day_of_month.map((d) => `${d.day}: ${fmt(rate(d), 1)}`).join(', ');
  domChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: c.by_day_of_month.map((d) => d.day),
      datasets: [
        { label: t('td_target'), data: c.by_day_of_month.map((d) => (isTarget(d.day) ? rate(d) : null)), backgroundColor: css('--series-1') },
        { label: t('td_other'), data: c.by_day_of_month.map((d) => (isTarget(d.day) ? null : rate(d))), backgroundColor: css('--neutral') },
      ].map((ds) => ({ ...ds, grouped: false, borderRadius: 3, borderSkipped: 'bottom' })),
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: { display: true, text: t('td_chart'), align: 'start', color: css('--text'), font: { size: 14, weight: '600' } },
        legend: { position: 'top', align: 'start', labels: { boxWidth: 12, boxHeight: 12 } },
        tooltip: { filter: (x) => x.parsed.y != null, callbacks: { label: (x) => `${x.dataset.label}: ${fmt(x.parsed.y, 2)} %` } },
      },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: css('--border') } } },
    },
  });
}

function renderResultsTable() {
  const head = ['col_block', 'col_period', 'col_model', 'col_rows', 'col_mae', 'col_mape', 'col_rmse', 'col_r2', 'col_r2p', 'col_da', 'col_sys']
    .map((k, i) => `<th${i < 3 ? ' class="l"' : ''}>${t(k)}</th>`).join('');
  const rows = summary.blocks.flatMap((b) => [['dummy', b.dummy, b.system.dummy_MAE], ['model', b.model, b.system.model_MAE]].map(([kind, m, sys], i) =>
    `<tr class="${kind}">
      <td>${i === 0 ? b.block : ''}</td><td class="l">${i === 0 ? `${b.test_start} → ${b.test_end}` : ''}</td><td class="l">${t(kind)}</td>
      <td>${fmt(m.rows, 0)}</td><td>${fmt(m.MAE, 3)}</td><td>${fmt(m['MAPE_%'], 3)}</td><td>${fmt(m.RMSE, 3)}</td>
      <td>${fmt(m.R2_return, 3)}</td><td>${fmt(m.R2_price, 4)}</td><td>${fmt(m['DA_%'], 2)}</td><td>${fmt(sys, 3)}</td></tr>`));
  $('#results-table').innerHTML = `<thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody>`;
}

function chartDefaults() {
  Chart.defaults.color = css('--text-2');
  Chart.defaults.borderColor = css('--border');
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) Chart.defaults.animation = false;
}

function renderMetricCharts() {
  metricCharts.forEach((c) => c.destroy());
  metricCharts = METRICS.slice(0, 3).map(([key, label, d]) => new Chart(Object.assign(document.getElementById('chart-' + key), {
    ariaLabel: t('chart_sr')(t(label), summary.blocks.map((b) => `${b.block} ${fmt(b.dummy[key], d)} / ${fmt(b.model[key], d)}`).join(', ')),
  }), {
    type: 'bar',
    data: {
      labels: summary.blocks.map((b) => b.block + (b.block === 'B3' ? ' (holdout)' : '')),
      datasets: [
        { label: t('dummy_short'), data: summary.blocks.map((b) => b.dummy[key]), backgroundColor: css('--neutral') },
        { label: t('model'), data: summary.blocks.map((b) => b.model[key]), backgroundColor: css('--series-1') },
      ].map((ds) => ({ ...ds, borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 40, borderColor: css('--surface'), borderWidth: 1 })),
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: { display: true, text: t(label), align: 'start', color: css('--text'), font: { size: 14, weight: '600' } },
        legend: { position: 'top', align: 'start', labels: { boxWidth: 12, boxHeight: 12 } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y, d)}` } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: css('--border') } },
      },
    },
  }));
}

// ── product explorer ────────────────────────────────────────────────────────

function expand(points) {
  // change points [[dayIndex, price|null], …] → one value per day
  const out = new Array(dates.length).fill(null);
  points.forEach(([i, v], k) => {
    const end = k + 1 < points.length ? points[k + 1][0] : dates.length;
    for (let j = i; j < end; j++) out[j] = v;
  });
  return out;
}

function filteredProducts() {
  const q = $('#search').value.trim().toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US');
  const cat = $('#cat-filter').value;
  const onlyChanges = $('#only-changes').checked;
  return products.filter((p) => (!cat || p.c === cat)
    && (!q || p.lname.includes(q))
    && (!onlyChanges || p.chg));
}

function renderCatFilter() {
  const cur = $('#cat-filter').value;
  const counts = {};
  products.forEach((p) => { counts[p.c] = (counts[p.c] || 0) + 1; });
  $('#cat-filter').innerHTML = `<option value="">${t('all_cats')}</option>` + Object.keys(counts).sort()
    .map((c) => `<option value="${c}">${t('cats')[c] || c} (${fmt(counts[c], 0)})</option>`).join('');
  $('#cat-filter').value = cur;
}

function renderList() {
  const list = filteredProducts();
  const shown = list.slice(0, 300);  // the rest are reachable through search
  const stop = shown.includes(selected) ? selected : shown[0];  // the list's single tab stop
  $('#product-list').innerHTML = shown.map((p) =>
    `<li role="option" tabindex="${p === stop ? 0 : -1}" data-id="${esc(p.id)}" aria-selected="${p === selected}">${esc(p.n)}<small>${esc(t('cats')[p.c] || p.c)}</small></li>`).join('');
  $('#list-count').textContent = t('n_products')(list.length, products.length);
}

function moveStop(li) {
  document.querySelectorAll('#product-list li[tabindex="0"]').forEach((x) => { x.tabIndex = -1; });
  li.tabIndex = 0;
  li.focus();
}

function selectProduct(p) {
  selected = p;
  document.querySelectorAll('#product-list li[data-id]').forEach((li) => li.setAttribute('aria-selected', String(li.dataset.id === p.id)));
  renderProduct();
  try { history.replaceState(null, '', '#p=' + encodeURIComponent(p.id)); } catch (e) {}
}

// shaded test periods (B1–B3) and the scraper outage behind the product chart; unshaded days are training data
const bandsPlugin = {
  id: 'bands',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea: a, scales: { x } } = chart;
    const half = Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0)) / 2;
    const bands = [[...summary.outage, css('--band-outage'), t('band_outage')],
      ...summary.blocks.map((b) => [b.test_start, b.test_end, css('--band-test'), `${b.block} test`])];
    ctx.save();
    ctx.font = `600 11px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const [start, end, color, label] of bands) {
      const i0 = dates.indexOf(start), i1 = dates.indexOf(end);
      if (i0 < 0 || i1 < 0) continue;
      const l = Math.max(a.left, x.getPixelForValue(i0) - half), r = Math.min(a.right, x.getPixelForValue(i1) + half);
      ctx.fillStyle = color;
      ctx.fillRect(l, a.top, r - l, a.bottom - a.top);
      ctx.fillStyle = css('--text-2');
      // too narrow: "B1 test" → "B1"; other labels are skipped rather than cut to a meaningless first word
      const text = ctx.measureText(label).width + 6 <= r - l ? label : label.endsWith(' test') ? label.split(' ')[0] : '';
      ctx.fillText(text, (l + r) / 2, a.top + 4);
    }
    ctx.restore();
  },
};

function renderProduct() {
  const p = selected;
  if (!p) return;
  $('#product-title').textContent = p.n;
  $('#product-meta').textContent = t('meta')({ cat: t('cats')[p.c] || p.c, id: p.id });

  const reg = expand(p.r);
  const fc = new Array(dates.length).fill(null), changed = new Set();
  p.p.forEach(([i, base, pred]) => { fc[i] = pred; if (Math.abs(pred / base - 1) > 0.005) changed.add(i); });
  const cur = lang === 'tr' ? 'TL' : 'TRY';
  const orange = css('--series-2'), surface = css('--surface');
  // point size from the on-screen distance to the nearest other forecast: consecutive target days (14th–16th)
  // shrink so they sit side by side instead of piling up; isolated points and wider charts keep the full size
  const fcIdx = p.p.map(([i]) => i).sort((a, b) => a - b);
  const gapDays = new Map(fcIdx.map((i, k) => [i, Math.min(i - (fcIdx[k - 1] ?? -Infinity), (fcIdx[k + 1] ?? Infinity) - i)]));
  const radius = (c) => {
    const x = c.chart.scales.x, g = gapDays.get(c.dataIndex);
    if (g == null || !x) return 7;
    const pxPerDay = Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0));
    return Math.max(2.5, Math.min(7, (g * pxPerDay) / 2 - 0.5));
  };

  productChart?.destroy();
  $('#product-chart').ariaLabel = t('product_sr')(p.n, p.p.length);
  productChart = new Chart($('#product-chart'), {
    plugins: [bandsPlugin],
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        { label: t('regular'), data: reg, borderColor: css('--series-1'), backgroundColor: css('--series-1'), stepped: true, borderWidth: 2, pointRadius: 0, order: 1 },
        // drawn on top (order 0); filled = predicted change, hollow = predicted "no change"
        { label: t('forecast'), data: fc, showLine: false, order: 0, pointStyle: 'circle',
          pointRadius: radius, pointHoverRadius: (c) => radius(c) + 2,
          pointBorderWidth: (c) => (radius(c) >= 5 ? 3 : 1.5), borderWidth: 3, pointBorderColor: orange, backgroundColor: orange,
          pointBackgroundColor: (c) => (changed.has(c.dataIndex) ? orange : surface) },
      ],
    },
    options: {
      maintainAspectRatio: false,
      spanGaps: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'start', labels: { boxWidth: 12, boxHeight: 12 } },
        tooltip: { filter: (c) => c.parsed.y != null, callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y)} ${cur}` } },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } },
        y: { title: { display: true, text: cur }, grace: '10%', grid: { color: css('--border') } },  // room for band labels
      },
    },
  });

  if (!p.p.length) { $('#pred-table').innerHTML = `<tbody><tr><td class="l muted">${t('no_preds')}</td></tr></tbody>`; return; }
  const head = ['p_date', 'p_block', 'p_base', 'p_pred', 'p_actual', 'p_err', 'p_dummy_err'].map((k, i) => `<th${i < 2 ? ' class="l"' : ''}>${t(k)}</th>`).join('');
  const rows = p.p.map(([i, base, pred, actual, block]) => {
    const em = Math.abs(pred - actual), ed = Math.abs(base - actual);
    const cls = em < ed - 1e-9 ? 'good' : em > ed + 1e-9 ? 'bad' : '';
    return `<tr><td class="l">${dates[i]}</td><td class="l">${block}</td><td>${fmt(base)}</td><td>${fmt(pred)}</td><td>${fmt(actual)}</td>
      <td class="${cls}">${fmt(em)}${cls ? `<span class="sr-only"> (${t(cls === 'good' ? 'better' : 'worse')})</span>` : ''}</td><td>${fmt(ed)}</td></tr>`;
  }).join('');
  $('#pred-table').innerHTML = `<thead><tr>${head}</tr></thead><tbody>${rows}</tbody>`;
}

$('#search').addEventListener('input', renderList);
$('#cat-filter').addEventListener('change', renderList);
$('#only-changes').addEventListener('change', renderList);
$('#product-list').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  moveStop(li);
  selectProduct(products.find((p) => p.id === li.dataset.id));
});
$('#product-list').addEventListener('keydown', (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
  const items = e.currentTarget.querySelectorAll('li[data-id]');
  const next = { ArrowDown: li.nextElementSibling, ArrowUp: li.previousElementSibling, Home: items[0], End: items[items.length - 1] }[e.key];
  if (next) { e.preventDefault(); moveStop(next); }
});

// ── boot ────────────────────────────────────────────────────────────────────

function renderCharts() {
  if (!summary || !window.Chart) return;
  chartDefaults();
  renderMetricCharts();
  renderDomChart();
  renderProduct();
}

function renderAll() {
  renderStatic();
  if (!summary) return;
  renderTiles();
  renderResultsTable();
  renderTargetDays();
  renderCatFilter();
  renderList();
  $('#generated').textContent = t('generated')(summary.generated, summary.data_end);
  renderCharts();
}

async function boot() {
  renderStatic();
  const get = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); });
  const [s, pr] = await Promise.all([get('data/summary.json'), get('data/products.json')]);
  summary = s;
  dates = pr.dates;
  products = pr.products;
  products.forEach((p) => {
    p.lname = p.n.toLocaleLowerCase('tr-TR');
    // observed days = length of the non-null runs in the change-point list
    p.obs = p.r.reduce((n, [i, v], k) => n + (v == null ? 0 : (p.r[k + 1]?.[0] ?? dates.length) - i), 0);
  });
  // forecasted products first, then the longest price history, then predicted changes; name order is the last
  // tie-break (export sorts by name)
  products.sort((a, b) => (b.p.length > 0) - (a.p.length > 0) || b.obs - a.obs || b.chg - a.chg);
  const fromHash = decodeURIComponent((location.hash.match(/p=([^&]+)/) || [])[1] || '');
  selected = products.find((p) => p.id === fromHash) || products.find((p) => p.chg) || products[0];
  renderAll();
}

function start() {
  $('#tiles').innerHTML = `<p class="note" role="status">${t('loading')}</p>`;
  boot().catch((e) => {
    console.error(e);
    $('#tiles').innerHTML = `<p class="note" role="alert">${t('load_error')} <button type="button" id="retry">${t('retry')}</button></p>`;
    $('#retry').addEventListener('click', start);
  });
}
start();
