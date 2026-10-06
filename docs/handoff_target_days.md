# Handoff: Hedef gün seçimi — hangi günlerde tahmin yapmalı? (tüm mağazalar)

> Bu metin, yeni bir oturuma olduğu gibi verilmek üzere yazıldı. Önceki konuşmayı görmeden çalışabilmen için gereken
> her şey burada. Pilot projenin kodu ve raporu: https://github.com/vinnipukh/InflationForecasting (README,
> `docs/decisions_and_lessons.md`, `docs/upstream_data_review.md`). Ham veri: https://github.com/urazkagangunes/InflationResearchStudy

## 1. Bağlam

Türk süpermarketlerinin internet sitelerinden günlük kazınan fiyatlarla, ürün ürün **ertesi günün normal (kampanya
ayıklanmış) fiyatını** tahmin ediyoruz. Rakip: persistence, yani "yarının fiyatı = dünün fiyatı". Bu çok güçlü bir
baseline, çünkü ürünlerin büyük çoğunluğunun fiyatı çoğu gün değişmiyor.

Pilot tek mağazada (Gürmar, 21 Şubat – 4 Ekim 2026, ~7.300 ürün segmenti) yapıldı. Model bir **LightGBM hurdle**:
sınıflandırıcı "yarın fiyat değişir mi?", L1 regresör "ne kadar?" diyor; olasılık eşiği geçilmezse tahmin "değişmez".

**Hedef gün kuralı:** Model yalnızca belirli günlerde tahmin yapıyor, diğer günlerde dünün fiyatı kullanılıyor. Şu anki
kural ("data days"): **ayın 1, 14, 15, 16'sı + resmi/dini bayramlar** (2026: 1 Ocak, Ramazan Bayramı 19–22 Mart,
23 Nisan, 1 Mayıs, 19 Mayıs, Kurban Bayramı 26–30 Mayıs, 15 Temmuz, 30 Ağustos, 28–29 Ekim). Bundan önceki kural
("spec days") ayın 1'i, 15'i, son günü + bayramlardı.

Pilot sonucu, hedef günlerde persistence'a göre MAE (TL) farkı:

| Blok | Test | Persistence MAE | Model MAE | Fark | Hedef gün sayısı |
|---|---|---|---|---|---|
| B1 | 5 Nis – 4 May | 2,675 | 2,500 | −6,5 % | 5 |
| B2 | 1–17 Eyl | 4,970 | 3,791 | −23,7 % | 4 |
| B3 (holdout) | 18 Eyl – 4 Eki | 0,927 | 0,859 | −7,3 % | **1** |

Spec days → data days geçişi kazancı artırdı: B2 +18,9 → +23,7 %, B3 −50,8 → +7,3 %.

**Kritik bulgu — takvim kapısı kazancı küçültüyor.** Aynı test satırları üzerinden sistem MAE'si (tüm test günleri),
persistence'a göre:

| Blok | Persistence | Hurdle **her gün** | Hurdle **sadece hedef günlerde** (pilot) |
|---|---|---|---|
| B1 | 1,835 | 1,710 (+6,8 %) | 1,805 (+1,6 %) |
| B2 | 3,976 | 3,312 (+16,7 %) | 3,699 (+7,0 %) |
| B3 | 1,146 | 0,732 (+36,1 %) | 1,143 (+0,3 %) |

Hurdle modelinin kendi olasılık eşiği zaten bir kapı. Ama bu kazancın ne kadarının **gerçek fiyat değişimi** tahmini
olduğu belirsiz (Bölüm 6, ilk madde): hedef dışı günlerde nedensel tanımla 10.013, gerçek tanımla 2.565 "değişim"
var; aradaki fark, kalıcı çıkan indirimlerde nedensel ve geriye dönük normal fiyatın 21 güne kadar ayrışmasından geliyor
ve model bunu kampanya özelliklerinden öğrenebiliyor. B3'ün +36 %'sı ayrıca veri sonundaki etiket sorunuyla (Eylül
başından beri tam %50 indirimde kalan ürünler kalıcı indirim sayılıyor) şişmiş olabilir.

## 2. Gürmar'da fiyatlar ne zaman değişiyor (ölçüldü)

**Tanım (bunu kullan):** Bir ürünün normal fiyatı bir önceki takvim gününe göre %0,5'ten fazla değiştiyse bu **bir
değişim** sayılır, tutarı ne olursa olsun (1 TL → 10 TL de tek değişim). **İki gün de gözlenmiş olmalı** (aradaki boş
günlerde birikmiş değişimler yanlış güne yazılmasın); scraper kesintisi dışarıda.

| Ayın günü | 1 | 2 | 3 | 8 | 14 | 15 | 16 | 24 | 25 | 30 |
|---|---|---|---|---|---|---|---|---|---|---|
| Ürün başına değişim oranı | **9,34 %** | 0,73 | 1,47 | 1,52 | 1,18 | 1,55 | 2,03 | 0,97 | 1,22 | **0,04 %** |

- Hedef günler günlerin **%17**'si; gerçek fiyat değişimlerinin **%47**'si ve persistence hatasının (TL) **%58**'i
  bu günlerde. Hedef günde ortalama 121 değişim, diğer günlerde 28.
- Ay sonu değişimleri ayın 1'inde görünüyor (30'unda %0,04).
- Ay ay (değişim sayısı): Mart 1'i 780, Nisan 1'i 31 (!), Eylül 1'i 311, Ekim 1'i 497. Ay başı etkisi aydan aya çok
  oynuyor.

## 3. Mevcut kural neden yetersiz

0. **Kapı kazancı küçültüyor** (Bölüm 1'deki tablo): model her gün çalışınca sistem MAE'si üç blokta da daha iyi.
   Kuralın varlık sebebi sorgulanmalı.
1. **Kapsama düşük:** Değişimlerin yarısından fazlası (%53) hedef günlerin dışında. En çok değişim olan 19 gün
   değişimlerin %64'ünü taşıyor; bizim 19 hedef günümüz %47'sini.
2. **Bayramlar neredeyse işe yaramıyor:** Ramazan Bayramı'nda günde 0–9 değişim, 23 Nisan'da 26, 30 Ağustos'ta 1.
   Toplam bayram katkısı 44 değişim. Bayramları kurala koymanın gerekçesi veriyle desteklenmiyor.
3. **Kaçan günler:** 2–4'ü, 8'i, 24–25'i ortalamanın üstünde. Gürmar'da kampanyalar ayın 1'inde veya 23–24'ünde
   başlıyor (kampanya bitişleri de normal fiyat değişimine dönüşebiliyor).
4. **Kural geriye dönük seçildi (sızıntı riski):** Ayın günü oranları test dönemleri dahil **tüm veriden**
   hesaplanıp kural öyle seçildi. Yeni çalışmada kural **yalnızca eğitim penceresinden** türetilmeli ve sonraki bir
   dönemde test edilmeli.
5. **Değerlendirme zayıf:** B3'te tek hedef gün var. Sonuçlar birkaç güne dayanıyor; anlamlılık testi yok.
6. **Tek mağaza:** Kural Gürmar'a özgü olabilir. Diğer mağazaların fiyat takvimi (haftalık broşür, haftanın günü vb.)
   farklı olabilir.

## 4. Görev

Upstream repodaki (InflationResearchStudy) neredeyse tüm market mağazaları için **"hangi günlerde tahmin yapmalıyım?"**
sorusunu verilerle cevapla ve hedef gün seçimini kuraldan **akıllı ve nedensel (causal) bir seçime** taşı.

Araştırma soruları:

1. Her mağazada fiyat değişimleri takvime nasıl dağılıyor: ayın günü, haftanın günü, ay başı/ay ortası, bayramlar,
   kampanya döngüleri?
2. Mağazalar arasında ortak bir desen var mı, yoksa her mağazanın kendi takvimi mi var? Kategoriye göre (gıda, temizlik,
   kişisel bakım) fark var mı?
3. Hangi seçim yöntemi, **gelecek** dönemde değişimlerin ve persistence hatasının en büyük kısmını en az günle
   yakalıyor?
4. **Önce bunu cevapla:** Hedef gün kapısı gerçekten gerekli mi? Bölüm 1'deki tabloya göre hurdle modelini her gün
   çalıştırmak kapıdan daha iyi. Hedef dışı günlerdeki kazancı ayrıştır: (a) gerçek normal fiyat değişimi yakalanan
   satırlar (Bölüm 2 tanımı), (b) yalnızca nedensel/geriye dönük ayrışmasından gelen satırlar (kampanya bitişleri,
   kalıcı indirimler), (c) B3 sonu etiket sorunu. Kazanç çoğunlukla (b) ve (c) ise kapı yine gerekli ve hedef tanımı
   ayrıca düzeltilmeli; (a) ise "akıllı tahmin" takvim yerine modelin eşiği olabilir. Takvim kapısı, model eşiği ve
   ikisinin birleşimini (ör. hedef günlerde düşük eşik, diğer günlerde yüksek eşik) aynı protokolle karşılaştır.

Denenecek seçim yöntemleri (basitten karmaşığa):

- **Sabit takvim kuralı:** ayın günü oranı > eşik ya da ilk k gün; eğitim penceresinden seçilir.
- **Haftanın günü + ayın günü** birleşik kural (haftalık broşür yapan zincirler için).
- **Mağaza bazında öğrenilen kural**, az veride mağazalar arası havuzlama veya küçültme (shrinkage / hiyerarşik
  tahmin) ile.
- **Öğrenilen kapı:** "yarın bu mağazada değişim oranı yüksek mi?" diye gün düzeyinde bir sınıflandırıcı (takvim,
  dünkü/geçen haftaki değişim oranı, bayram, kampanya başlangıcı sinyalleri). Eşik, sistem MAE'sini optimize edecek
  şekilde eğitim verisinde seçilir.
- **Kategori/ürün düzeyinde kapı** (mağaza düzeyi yetmiyorsa).

## 5. Değerlendirme protokolü

- **Nedensel:** Kural/kapı yalnızca t'ye kadar bilinen veriyle seçilir. Rolling-origin (ör. her ay başı yeni origin),
  seçim eğitim penceresinde, değerlendirme sonraki pencerede.
- **Ana metrik:** Sistem MAE'si (seçilen günlerde model, diğer günlerde persistence, tüm test günleri üzerinden) ve
  persistence'a göre % fark.
- **Yardımcı metrikler:** seçilen günlerin payı vs. yakalanan değişimlerin payı (lift/kapsama eğrisi), yakalanan
  persistence hatası payı (TL), aydan aya kararlılık.
- **Baseline'lar:** (a) hiç kapı yok, model her gün (kendi eşiğiyle); (b) pilot kuralı 1/14/15/16 + bayram;
  (c) eski spec days 1/15/son gün + bayram; (d) sadece ayın 1'i.
- **Sistem MAE'sini iki hedefle raporla:** modelin nedensel hedefi (pilotla kıyas için) ve geriye dönük normal fiyat
  (gerçek değişim). İkisi ayrışıyorsa kazancın kaynağı etiket artefaktıdır.
- Mümkünse günlük kayıp farkları üzerinde Diebold–Mariano (HLN düzeltmeli) veya ürün/gün kümelenmiş standart hatalı
  panel testi.
- Mağaza başına veri 2–4 ay olduğu için ayın her günü yalnızca 2–4 kez gözleniyor. Belirsizliği raporla (bootstrap
  aralıkları), tek bir aya dayanan "kural"lara güvenme.

## 6. Bilinen tuzaklar

- **İki farklı "değişim" tanımı farklı sonuç veriyor.** Modelin hedefi, bugünkü normal fiyatı dünün **nedensel**
  normal fiyatıyla karşılaştırıyor (bir düşüş 21 güne kadar kampanya sayılıyor). Bu tanımla sayınca kampanya bitişleri
  rastgele günlere "değişim" olarak düşüyor ve hedef günlerin payı %47'den %24'e iniyor. Takvim analizinde Bölüm 2'deki
  tanımı (geriye dönük normal fiyat, ardışık gözlenen günler) kullan; modelin hedefindeki gürültüyü ayrıca not et.
- **Boş günler:** Scraper'ın atladığı günlerden sonraki ilk gün, birikmiş değişimleri taşır. Gürmar'da 23 ve 25 Şubat,
  7 Mart, 30 Nisan, 5 Mayıs eksik. 1 Mayıs bu yüzden sayılamadı. Ardışık gün şartı şart.
- **Scraper arızası:** Gürmar'da 6 Mayıs – 17 Ağustos arası sayfalama hatası. Günde ~5.100 satır ama yalnızca 275
  farklı ürün, her biri ~19 kez tekrarlanıyor (çoğu alfabenin başından, muhtemelen her kategorinin ilk sayfası). Diğer
  mağazalarda da aynı hatayı ara: satır sayısı normal, farklı ürün sayısı düşükse arıza var.
- **Arıza sonrası burn-in:** Gürmar 18–31 Ağustos'ta nedensel tanımla günde %8–10 sahte "değişim" görünüyor (kampanya
  durumu yeniden kuruluyor). Geriye dönük tanımla sorun yok, ama nedensel özelliklerde var.
- **Kampanya filtresi:** V şeklinde, 35 günlük pencere; ham veride indirim ayrı kolon değil (Hapeloglu'nun Haziran
  sonrası şeması hariç). Her mağazaya aynı filtre uygulanmalı; kampanya döngüsü (ör. ayın 1'i ve 23–24'ü) ile normal
  fiyat değişimini karıştırma.
- **Ürün kimliği:** Çoğu mağazada ID yok, sadece ürün adı var. İsim değişiklikleri ve paket boyu değişimleri (420 g ↔
  210 g) sahte fiyat sıçraması yaratır. Kesinlik öncelikli eşleştirme yap, emin olmadığın eşleşmeyi bağlama.
- **Upstream veri sorunları** (`docs/upstream_data_review.md`): fiyat biçimleri (`"₺295,00"`, `"2.499,00 TL"`,
  `"34,99 ₺"`, `74.95`), başlık kayması (`price`/`Price`/`Fiyat`), beş farklı dosya adı tarih biçimi (Kim'de yıl yok:
  `products3-14.csv`), Hapeloglu'da `.tsv` kopyaları, HappyCenter'da ad/fiyat kayması, büyük harfli adlar.
- **Windows'ta clone:** Upstream repoda ters eğik çizgili dosya adları var (`Datas\taxi_prices_9-5.csv`), normal
  checkout patlıyor. Çözüm: `git clone --depth 1 --filter=blob:none --no-checkout <url> <dir>`, ardından
  `git sparse-checkout set InflationItems/Datas/Markets` ve `git -c core.protectNTFS=false checkout`.

## 7. Mağaza kapsamı (5 Ekim 2026 itibarıyla)

| Mağaza | Gün | Aralık | Not |
|---|---|---|---|
| Gurmar | 223 | 02-21 → 10-04 | pilot; arıza 05-06 → 08-17 |
| Marketzade | 107 | 02-24 → 06-10 | |
| Hapeloglu | 98 | 02-24 → 06-02 | Haziran'dan itibaren zengin şema (regular_price, is_discounted, ...) |
| Baskent | 96 | 02-24 → 06-01 | |
| Basdas | 93 | 02-21 → 05-31 | |
| Migros | 92 | 02-24 → 05-26 | |
| Kim | 86 | 02-23 → 05-26 | bir 7 günlük boşluk |
| Kale | 81 | 03-01 → 05-26 | |
| CarrefourSA | 80 | 02-23 → 05-18 | |
| Arden | 75 | 03-02 → 05-28 | |
| Macrocenter | 70 | 02-20 → 05-19 | |
| A101 | 68 | 03-13 → 05-29 | |

Mart'ta duranlar (SozSanal, BizimMarket, Ideal, sok_market, HappyCenter, sehzade, Sariyer, Cagri, Mopas) ve seyrek
olanlar (Onur, Tarım Kredi) bu analize uygun değil. Repoyu güncel haliyle tekrar kontrol et; kapsam değişmiş olabilir.

## 8. Teslimatlar

1. **Mağaza × gün analizi:** her mağaza için ayın günü ve haftanın günü değişim oranları (Bölüm 2 tanımıyla),
   ısı haritası, belirsizlik aralıklarıyla.
2. **Önerilen hedef gün seçimi** (mağaza bazında ve/veya ortak): kural ya da kapı, gerekçesiyle.
3. **Karşılaştırma tablosu:** Bölüm 5'teki baseline'lara göre sistem MAE'si, kapsama ve kararlılık; önce Gürmar'da
   (pilot sonuçlarıyla kıyas), sonra diğer mağazalarda.
4. **Yeniden kullanılabilir fonksiyon:** ör. `select_target_days(panel, train_end) -> set[date]` ve değişim sayımı
   fonksiyonu; testleri veya küçük bir doğrulama kontrolüyle.
5. **Kısa rapor (Markdown):** ne bulundu, ne işe yaramadı, sınırlamalar. Rakamları tablo olarak ver.

## 9. Kısıtlar

- Pilotun modeli ve özellikleri dondurulmuş kabul edilir; bu çalışmanın konusu **sadece hedef gün seçimi**. Model
  değişikliği gerekiyorsa ayrıca öner, sessizce yapma.
- Hiçbir seçim test dönemini görmemeli. Hiperparametre ve eşik seçimi yalnızca eğitim pencerelerinde.
- Ham veriyi değiştirme; tüm temizlik kodda ve tekrarlanabilir olsun.
- Belirsiz bir veri sorunu görürsen (ör. bir mağazada yeni bir scraper arızası) tahminle düzeltme; raporla ve sor.
