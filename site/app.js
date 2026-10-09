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
    st_h: 'Diğer marketlerde de bu günler mi?',
    st_p: 'Aynı sayım, veri deposundaki diğer marketler için. Hedef günler burada da Gürmar kuralı (ayın 1, 14, 15, 16\'sı ve bayramlar), böylece kuralın başka bir markette ne kadar tuttuğu görülüyor. Bir market seçin. Haftalık broşür yapan zincirlerde fiyatlar ayın gününe değil haftanın gününe bağlı olabilir; ikinci grafik ve tablo, fiyat değişimlerinin haftanın hangi gününe ne kadar düştüğünü gösteriyor.',
    st_pick: 'Market',
    st_meta: (s) => `${s.days} gün veri (${s.first} – ${s.last}), günde ortalama ${s.products_median.toLocaleString('tr-TR')} ürün karşılaştırılabildi.`,
    st_chart_dow: 'Fiyat değişimlerinin haftanın günlerine dağılımı (%)',
    st_dow_changes: 'Değişimlerin payı', st_dow_days: 'Günlerin payı',
    st_dow_rate: (r) => `O gün ürünlerin ortalama %${r}'inin fiyatı değişti`,
    st_dow_note: 'Mavi çubuklar toplanınca %100: tüm fiyat değişimlerinin yüzde kaçı o güne düştü. Gri çubuk, o günün verideki günlere oranı; değişimler günlere eşit dağılsaydı mavi gri kadar olurdu. Ayın günü grafiğindeki oran başka bir ölçü: o gün ürünlerin yüzde kaçının fiyatı değişti. Örneğin bir markette Cumartesi oranı %2 ise, ortalama bir Cumartesi ürünlerin %2\'sinin fiyatı değişiyor; bu oranlar haftanın yedi günü için toplanınca haftada ürünlerin yaklaşık yüzde kaçının fiyat değiştirdiği çıkar.',
    st_dow_table_h: 'Tüm marketler: fiyat değişimlerinin haftanın günlerine dağılımı',
    st_dow_top2: 'En yoğun iki gün',
    weekdays: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    st_table_h: 'Tüm marketler: Gürmar kuralı ne kadar yakalıyor?',
    st_cols: ['Market', 'Gün', 'Hedef günlerin payı', 'Değişimlerin payı', 'Hatanın (TL) payı', 'Kat', 'Değişim/gün: hedef / diğer', 'En çok değişen ayın günü', 'En çok değişen hafta günü'],
    st_note: 'Değişim tanımı yukarıdakiyle aynı. Kat = değişimlerin payı ÷ hedef günlerin payı; 1 civarı, kuralın o markette rastgele gün seçmekten farksız olduğu anlamına gelir. Ürünler burada adla eşleştirildi (çoğu markette ürün kimliği yok), bu yüzden Gürmar rakamları yukarıdakilerden biraz farklı. Yalnızca en az 30 karşılaştırılabilir günü olan marketler var. Ayın her günü market başına yalnızca birkaç kez gözlendiği için tek günlük zirveler (ör. tek seferlik toplu zam) gürültülü olabilir. Tablolarda satıra tıklayınca market seçilir.',
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
    feat_h: 'Değişkenler',
    feat_p: 'Modelin kullandığı 50 sayısal ve 2 kategorik değişken. T günü tahmini için hepsi T−1 gününün sonunda bilinen bilgiyle hesaplanır; takvim değişkenleri T gününün tarihinden gelir (önceden bilinir). "Normal fiyat" (R): kampanya ayıklanmış fiyat; %0,5\'ten büyük bir düşüş 21 gün kalıcı olana kadar kampanya sayılır, sonra yeni normal fiyat olur. Kazıma boşlukları en fazla 3 gün önceki fiyatla doldurulur.',
    feat_cols: ['Değişken', 'Nasıl hesaplanıyor'],
    features: [
      ['Fiyat gecikmeleri', [
        ['price_lag_1', 'Dünkü normal fiyat (R, T−1). Aynı zamanda "dünün fiyatı" tahmini ve yüzde değişimin tabanı.'],
        ['price_lag_7 / 15 / 30', '7, 15 ve 30 gün önceki normal fiyat.'],
      ]],
      ['Takvim', [
        ['dow_sin / dow_cos', 'Haftanın günü, sinüs/kosinüs ile döngüsel kodlanmış (2π·gün/7).'],
        ['month_sin / month_cos', 'Ay, döngüsel kodlanmış (2π·ay/12).'],
        ['dom_sin / dom_cos', 'Ayın günü, döngüsel kodlanmış (2π·gün/31).'],
        ['is_1st / is_15th / is_16th', 'Ayın 1\'i, 15\'i, 16\'sı mı (0/1).'],
        ['is_month_end', 'Ayın son günü mü (0/1).'],
        ['days_to_month_end', 'Ay sonuna kalan gün sayısı.'],
        ['is_holiday', '2026 resmi ve dini bayram günü mü (arife dahil, 0/1).'],
      ]],
      ['Dolar/TL', [
        ['usd_try_rate', 'T−1 sonunda bilinen son USD/TRY kapanışı (Yahoo Finance).'],
        ['usd_try_rate_change', 'Son günlük USD/TRY yüzde değişimi.'],
        ['usd_try_change_7d / 30d', 'USD/TRY\'nin 7 ve 30 gün önceye göre yüzde değişimi.'],
      ]],
      ['Petrol', [
        ['brent_try', 'Brent petrol fiyatı TL cinsinden (Brent USD × USD/TRY), T−1 itibarıyla.'],
        ['brent_try_change_7d / 30d', 'TL Brent\'in 7 ve 30 gün önceye göre yüzde değişimi.'],
      ]],
      ['TÜİK', [
        ['tuik_food_mom_last', 'Son açıklanan TÜİK gıda TÜFE aylık değişimi (%). Açıklamanın ertesi gününden itibaren kullanılır.'],
        ['tuik_headline_mom_last', 'Son açıklanan genel TÜFE aylık değişimi (%).'],
        ['tuik_food_3m_cum', 'Son üç açıklamanın gıda TÜFE değişimlerinin bileşik toplamı (%).'],
        ['days_since_tuik_release', 'Son TÜİK açıklamasından beri geçen gün.'],
      ]],
      ['Fiyat geçmişi', [
        ['price_7d_mean / price_7d_std', 'Normal fiyatın son 7 gündeki ortalaması ve standart sapması.'],
        ['price_30d_mean', 'Normal fiyatın son 30 gündeki ortalaması.'],
        ['price_momentum_7d', 'Son 7 gündeki fiyat değişimi: R(T−1) / R(T−8) − 1.'],
        ['ratio_lag1_mean30', 'Dünkü fiyatın 30 günlük ortalamaya oranı − 1.'],
        ['days_since_change', 'Normal fiyatın son değiştiği günden (%0,5\'ten büyük) beri geçen gün.'],
        ['n_changes_30d / 60d', 'Son 30 ve 60 gündeki normal fiyat değişimi sayısı.'],
        ['last_change_size', 'En son normal fiyat değişiminin büyüklüğü (%).'],
      ]],
      ['Kampanya', [
        ['shelf_price_lag1', 'Dün rafta görünen fiyat (kampanya dahil).'],
        ['shelf_to_base_lag1', 'Raf fiyatı / normal fiyat − 1 (negatifse indirim var).'],
        ['on_sale_lag1', 'Ürün dün kampanyada mıydı (0/1).'],
        ['sale_depth_lag1', 'Dünkü kampanya indiriminin derinliği (%).'],
        ['days_in_sale_lag1', 'Süren kampanyanın kaçıncı günü.'],
        ['n_sale_days_60d', 'Son 60 günde kampanyada geçen gün sayısı.'],
      ]],
      ['Birim fiyat', [
        ['log_unit_price_lag1', 'Ürün adından okunan paket büyüklüğüyle hesaplanan kg/litre/adet başına fiyatın logaritması.'],
        ['rel_unit_price_lag1', 'Aynı kategori ve birimdeki ürünlerin o günkü medyan birim fiyatına göre fark (log): ürün kategorisine göre pahalı mı ucuz mu.'],
      ]],
      ['Mağaza geneli', [
        ['store_reprice_share_1d / 7d', 'Dün (ve son 7 günde ortalama) mağazadaki ürünlerin normal fiyatı değişenlerin payı.'],
        ['cat_reprice_share_1d / 7d', 'Aynı payın ürünün kendi COICOP kategorisi içindeki değeri.'],
      ]],
      ['Web enflasyon endeksi', [
        ['web_cat_infl_30d', 'Ürünün kategorisindeki normal fiyatların ortalama log değişiminin son 30 gündeki toplamı: kazınan verilerden kurulan kategori enflasyonu.'],
        ['web_store_infl_30d', 'Aynı endeksin mağaza geneli; kategoriler TÜİK 2026 sepet ağırlıklarıyla ağırlıklandırılır.'],
      ]],
      ['Kategorik', [
        ['coicop', 'Ürünün COICOP harcama grubu (01 gıda, 05 ev eşyası, 09 eğlence, 13 kişisel bakım).'],
        ['unit_basis', 'Birim fiyatın tabanı: TL/kg, TL/litre, TL/adet ya da yok.'],
      ]],
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
    st_h: 'Do other supermarkets change prices on the same days?',
    st_p: 'The same count for the other supermarkets in the data repository. Target days are still the Gürmar rule (1st, 14th, 15th, 16th of the month and holidays), so you can see how well the rule carries over to another chain. Pick a supermarket. Chains with weekly flyers may change prices by day of week rather than day of month; the second chart and table show how much of all price changes fall on each weekday.',
    st_pick: 'Supermarket',
    st_meta: (s) => `${s.days} days of data (${s.first} – ${s.last}), ${s.products_median.toLocaleString('en-US')} comparable products per day (median).`,
    st_chart_dow: 'How price changes spread over the week (%)',
    st_dow_changes: 'Share of changes', st_dow_days: 'Share of days',
    st_dow_rate: (r) => `On that day ${r} % of products changed price on average`,
    st_dow_note: 'The blue bars add up to 100 %: the share of all price changes that fell on that weekday. The grey bar is that weekday\'s share of the observed days; if changes were spread evenly, blue would match grey. The rate in the day-of-month chart is a different measure: the share of products whose price changed that day. If a chain\'s Saturday rate is 2 %, then on an average Saturday 2 % of its products change price; adding the seven weekday rates gives roughly the share of products that change price in a week.',
    st_dow_table_h: 'All supermarkets: how price changes spread over the week',
    st_dow_top2: 'Two busiest days',
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    st_table_h: 'All supermarkets: how much does the Gürmar rule catch?',
    st_cols: ['Supermarket', 'Days', 'Share of target days', 'Share of changes', 'Share of error (TRY)', 'Lift', 'Changes/day: target / other', 'Top day of month', 'Top weekday'],
    st_note: 'Same change definition as above. Lift = share of changes ÷ share of target days; around 1 means the rule does no better than picking days at random for that chain. Products are matched by name here (most chains have no product ID), so the Gürmar figures differ slightly from the ones above. Only supermarkets with at least 30 comparable days are shown. Each day of month is seen only a few times per chain, so single-day peaks (e.g. a one-off price hike across the store) can be noise. Click a row in either table to select that supermarket.',
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
    feat_h: 'Features',
    feat_p: 'The 50 numeric and 2 categorical features the model uses. For a forecast for day T, all are computed from information known at the end of day T−1; calendar features come from day T\'s date (known in advance). "Regular price" (R): the price with sales filtered out; a drop of more than 0.5 % counts as a sale until it has lasted 21 days, then it becomes the new regular price. Scrape gaps are filled with the last price for at most 3 days.',
    feat_cols: ['Feature', 'How it is computed'],
    features: [
      ['Price lags', [
        ['price_lag_1', 'Yesterday\'s regular price (R, T−1). Also the "yesterday\'s price" forecast and the base of the percentage change.'],
        ['price_lag_7 / 15 / 30', 'Regular price 7, 15 and 30 days earlier.'],
      ]],
      ['Calendar', [
        ['dow_sin / dow_cos', 'Day of week, cyclically encoded with sine/cosine (2π·day/7).'],
        ['month_sin / month_cos', 'Month, cyclically encoded (2π·month/12).'],
        ['dom_sin / dom_cos', 'Day of month, cyclically encoded (2π·day/31).'],
        ['is_1st / is_15th / is_16th', 'Is it the 1st, 15th or 16th of the month (0/1).'],
        ['is_month_end', 'Is it the last day of the month (0/1).'],
        ['days_to_month_end', 'Days left until month end.'],
        ['is_holiday', '2026 public or religious holiday, eve included (0/1).'],
      ]],
      ['USD/TRY', [
        ['usd_try_rate', 'Last USD/TRY close known at the end of T−1 (Yahoo Finance).'],
        ['usd_try_rate_change', 'Latest daily USD/TRY percentage change.'],
        ['usd_try_change_7d / 30d', 'USD/TRY percentage change vs. 7 and 30 days earlier.'],
      ]],
      ['Oil', [
        ['brent_try', 'Brent oil price in TRY (Brent USD × USD/TRY), as of T−1.'],
        ['brent_try_change_7d / 30d', 'Percentage change of Brent in TRY vs. 7 and 30 days earlier.'],
      ]],
      ['TÜİK', [
        ['tuik_food_mom_last', 'Latest released TÜİK food CPI monthly change (%). Usable from the day after the release.'],
        ['tuik_headline_mom_last', 'Latest released headline CPI monthly change (%).'],
        ['tuik_food_3m_cum', 'Compounded food CPI change over the last three releases (%).'],
        ['days_since_tuik_release', 'Days since the latest TÜİK release.'],
      ]],
      ['Price history', [
        ['price_7d_mean / price_7d_std', 'Mean and standard deviation of the regular price over the last 7 days.'],
        ['price_30d_mean', 'Mean regular price over the last 30 days.'],
        ['price_momentum_7d', 'Price change over the last 7 days: R(T−1) / R(T−8) − 1.'],
        ['ratio_lag1_mean30', 'Yesterday\'s price divided by the 30-day mean, minus 1.'],
        ['days_since_change', 'Days since the regular price last changed (by more than 0.5 %).'],
        ['n_changes_30d / 60d', 'Number of regular price changes in the last 30 and 60 days.'],
        ['last_change_size', 'Size of the most recent regular price change (%).'],
      ]],
      ['Sales', [
        ['shelf_price_lag1', 'Yesterday\'s shelf price (sales included).'],
        ['shelf_to_base_lag1', 'Shelf price / regular price − 1 (negative means a discount).'],
        ['on_sale_lag1', 'Was the product on sale yesterday (0/1).'],
        ['sale_depth_lag1', 'Depth of yesterday\'s sale discount (%).'],
        ['days_in_sale_lag1', 'Day number within the running sale.'],
        ['n_sale_days_60d', 'Days on sale in the last 60 days.'],
      ]],
      ['Unit price', [
        ['log_unit_price_lag1', 'Log price per kg / litre / piece, using the pack size parsed from the product name.'],
        ['rel_unit_price_lag1', 'Log difference from the median unit price of products in the same category and unit that day: is the product expensive or cheap for its category.'],
      ]],
      ['Store-wide', [
        ['store_reprice_share_1d / 7d', 'Share of the store\'s products whose regular price changed yesterday (and its 7-day average).'],
        ['cat_reprice_share_1d / 7d', 'The same share within the product\'s own COICOP category.'],
      ]],
      ['Web inflation index', [
        ['web_cat_infl_30d', 'Mean log change of regular prices in the product\'s category, summed over the last 30 days: category inflation built from the scraped data.'],
        ['web_store_infl_30d', 'Store-wide version of the same index; categories weighted by TÜİK 2026 basket weights.'],
      ]],
      ['Categorical', [
        ['coicop', 'The product\'s COICOP group (01 food, 05 household, 09 recreation, 13 personal care).'],
        ['unit_basis', 'Base of the unit price: TRY/kg, TRY/litre, TRY/piece or none.'],
      ]],
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
let markets = null, market = null, stDomChart = null, stDowChart = null;

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
  $('#feat-table').innerHTML = `<thead><tr><th>${t('feat_cols')[0]}</th><th class="l">${t('feat_cols')[1]}</th></tr></thead><tbody>`
    + t('features').map(([g, rows]) => `<tr class="grp"><td colspan="2">${g}</td></tr>`
      + rows.map(([f, d]) => `<tr><td><code>${f}</code></td><td class="l d">${d}</td></tr>`).join('')).join('')
    + '</tbody>';
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

const share = (x) => (!Number.isFinite(x) ? '–' : lang === 'tr' ? `%${fmt(100 * x, 0)}` : `${fmt(100 * x, 0)} %`);
const perDay = (n, d) => (d ? fmt(n / d, 0) : '–');

// target-day vs. other-day totals ({target, other}: {days, changes, persistence_abs_err_try}) -> tile values
function ruleStats(c) {
  const err = (k) => c[k].persistence_abs_err_try;
  const days = c.target.days / (c.target.days + c.other.days), changes = c.target.changes / (c.target.changes + c.other.changes);
  return { days, changes, err: err('target') / (err('target') + err('other')), lift: changes / days,
           avg: `${perDay(c.target.changes, c.target.days)} <small>/ ${perDay(c.other.changes, c.other.days)}</small>` };
}

const ruleTiles = (s) => [[share(s.days), 'td_k_days'], [share(s.changes), 'td_k_changes'], [s.avg, 'td_k_avg'], [share(s.err), 'td_k_err']]
  .map(([v, k]) => `<div class="card"><div class="tile-v">${v}</div><p class="hint">${t(k)}</p></div>`).join('');

function renderTargetDays() {
  const c = summary.calendar;
  $('#td-tiles').innerHTML = ruleTiles(ruleStats(c));

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

const isTarget = (d) => [1, 14, 15, 16].includes(d);
const rate = (d) => 100 * d.changes / d.products;

const barOptions = (title, tooltip) => ({
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    title: { display: true, text: title, align: 'start', color: css('--text'), font: { size: 14, weight: '600' } },
    legend: { position: 'top', align: 'start', labels: { boxWidth: 12, boxHeight: 12 } },
    tooltip,
  },
  scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: css('--border') } } },
});
const barStyle = (ds) => ({ ...ds, borderRadius: 3, borderSkipped: 'bottom' });

// bars of change rate (%); items: [{label, rate, target}], target days blue
function rateChart(canvas, items, title) {
  canvas.ariaLabel = `${title}: ` + items.map((d) => `${d.label}: ${fmt(d.rate, 1)}`).join(', ');
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: items.map((d) => d.label),
      datasets: [
        { label: t('td_target'), data: items.map((d) => (d.target ? d.rate : null)), backgroundColor: css('--series-1') },
        { label: t('td_other'), data: items.map((d) => (d.target ? null : d.rate)), backgroundColor: css('--neutral') },
      ].map((ds) => barStyle({ ...ds, grouped: false })),
    },
    options: barOptions(title, { filter: (x) => x.parsed.y != null, callbacks: { label: (x) => `${x.dataset.label}: ${fmt(x.parsed.y, 2)} %` } }),
  });
}

// per weekday: share of all changes vs. share of observed days (each sums to 100), rate in the tooltip
function weekdayShares(m) {
  const rows = m.by_weekday, C = rows.reduce((s, d) => s + d.changes, 0), D = rows.reduce((s, d) => s + d.days, 0);
  return rows.map((d) => ({ key: d.key, label: t('weekdays')[d.key], changes: 100 * d.changes / C, days: 100 * d.days / D, rate: rate(d) }));
}

function weekdayChart(canvas, items, title) {
  canvas.ariaLabel = `${title}: ` + items.map((d) => `${d.label}: ${fmt(d.changes, 0)} / ${fmt(d.days, 0)}`).join(', ');
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: items.map((d) => d.label),
      datasets: [
        { label: t('st_dow_changes'), data: items.map((d) => d.changes), backgroundColor: css('--series-1') },
        { label: t('st_dow_days'), data: items.map((d) => d.days), backgroundColor: css('--neutral') },
      ].map(barStyle),
    },
    options: barOptions(title, { callbacks: {
      label: (x) => `${x.dataset.label}: ${fmt(x.parsed.y, 1)} %`,
      footer: (xs) => t('st_dow_rate')(fmt(items[xs[0].dataIndex].rate, 2)),
    } }),
  });
}

function renderDomChart() {
  domChart?.destroy();
  domChart = rateChart($('#chart-dom'), summary.calendar.by_day_of_month.map((d) => ({ label: d.day, rate: rate(d), target: isTarget(d.day) })), t('td_chart'));
}

// ── other supermarkets: the same count under the Gürmar rule ───────────────

const marketName = (s) => ({ Gurmar: 'Gürmar' }[s] || s.charAt(0).toUpperCase() + s.slice(1));
const topKey = (rows) => rows.reduce((a, b) => (rate(b) > rate(a) ? b : a)).key;

function renderStores() {
  if (!markets) { $('#stores').hidden = true; return; }
  const sel = $('#store-select');
  sel.innerHTML = markets.map((m) => `<option value="${esc(m.store)}"${m === market ? ' selected' : ''}>${esc(marketName(m.store))}</option>`).join('');
  const rows = markets.map((m) => {
    const s = ruleStats(m);
    return `<tr data-store="${esc(m.store)}"${m === market ? ' class="model"' : ''}><td class="l">${esc(marketName(m.store))}</td><td>${fmt(m.days, 0)}</td>
      <td>${share(s.days)}</td><td>${share(s.changes)}</td><td>${share(s.err)}</td><td>${fmt(s.lift, 1)}</td><td>${s.avg}</td>
      <td>${topKey(m.by_day_of_month)}</td><td>${t('weekdays')[topKey(m.by_weekday)]}</td></tr>`;
  });
  $('#st-table').innerHTML = `<thead><tr>${t('st_cols').map((h, i) => `<th${i ? '' : ' class="l"'}>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>`;
  $('#st-meta').textContent = t('st_meta')(market);
  $('#st-tiles').innerHTML = ruleTiles(ruleStats(market));

  // weekday shares per store: cell shade grows with the share; the two busiest weekdays are bold
  const dowRows = markets.map((m) => {
    const w = weekdayShares(m), byKey = Object.fromEntries(w.map((d) => [d.key, d]));
    const top2 = [...w].sort((a, b) => b.changes - a.changes).slice(0, 2);
    const cells = [0, 1, 2, 3, 4, 5, 6].map((k) => {
      const d = byKey[k];
      if (!d) return '<td>–</td>';
      const bold = top2.includes(d) ? ' class="hi"' : '';
      return `<td${bold} style="background: color-mix(in srgb, var(--series-1) ${Math.min(60, Math.round(d.changes * 1.2))}%, transparent)">${share(d.changes / 100)}</td>`;
    }).join('');
    return `<tr data-store="${esc(m.store)}"${m === market ? ' class="model"' : ''}><td class="l">${esc(marketName(m.store))}</td>${cells}
      <td>${share((top2[0].changes + (top2[1]?.changes ?? 0)) / 100)} <small class="muted">(${top2.map((d) => d.label).join(' + ')})</small></td></tr>`;
  });
  $('#st-dow-table').innerHTML = `<thead><tr><th class="l">${t('st_cols')[0]}</th>${t('weekdays').map((d) => `<th>${d}</th>`).join('')}<th>${t('st_dow_top2')}</th></tr></thead><tbody>${dowRows.join('')}</tbody>`;
}

function renderStoreCharts() {
  if (!markets) return;
  stDomChart?.destroy();
  stDowChart?.destroy();
  const title = `${marketName(market.store)}: `;
  stDomChart = rateChart($('#chart-st-dom'), market.by_day_of_month.map((d) => ({ label: d.key, rate: rate(d), target: isTarget(d.key) })), title + t('td_chart'));
  stDowChart = weekdayChart($('#chart-st-dow'), weekdayShares(market), title + t('st_chart_dow'));
}

function selectMarket(name) {
  market = markets.find((m) => m.store === name) || market;
  store.set('market', market.store);
  renderStores();
  renderStoreCharts();
}

$('#store-select').addEventListener('change', (e) => selectMarket(e.target.value));
['#st-table', '#st-dow-table'].forEach((id) => $(id).addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-store]');
  if (tr) selectMarket(tr.dataset.store);
}));

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
  renderStoreCharts();
  renderProduct();
}

function renderAll() {
  renderStatic();
  if (!summary) return;
  renderTiles();
  renderResultsTable();
  renderTargetDays();
  renderStores();
  renderCatFilter();
  renderList();
  $('#generated').textContent = t('generated')(summary.generated, summary.data_end);
  renderCharts();
}

async function boot() {
  renderStatic();
  const get = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); });
  // stores.json is optional: without it the supermarket section is hidden
  const [s, pr, st] = await Promise.all([get('data/summary.json'), get('data/products.json'), get('data/stores.json').catch(() => null)]);
  markets = st?.stores ?? null;
  market = markets && (markets.find((m) => m.store === store.get('market')) || markets.find((m) => m.store !== 'Gurmar') || markets[0]);
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
