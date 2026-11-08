import { parseCategory, type CategoryRef } from './categories';
import { indexPhrases, type Phrase } from './phrases';

// D22 brand list. Each row is a category and its brands as cleaned words; `_` joins the
// words of one brand and a leading `^` means the brand only counts as the merchant's first
// word (for names that are also common words). "H&M" style names are written `hnm`.
// Leave a name out when it could mean something else: an unmatched entry is "Other".

const BRAND_ROWS: readonly (readonly [string, string])[] = [
  [
    'groceries/supermarket',
    'migros migrosjet macrocenter carrefoursa carrefour a101 ^bim ^sok ^file',
  ],
  ['groceries/supermarket', 'hakmar kim_market metro_market ^bizim_toptan onur_market tarim_kredi'],
  ['groceries/supermarket', 'happy_center altunbilekler ekomini mopas ^kipa rossmann_market'],
  ['groceries/online', 'getir getirbuyuk getiryemek_market banabi istegelsin'],
  ['eating-out/delivery', 'yemeksepeti getiryemek trendyolyemek trendyol_yemek migros_yemek'],
  ['eating-out/fast-food', 'mcdonalds burger_king burgerking kfc popeyes dominos pizza_hut'],
  ['eating-out/fast-food', 'little_caesars papa_johns sbarro arbys subway ^tavuk_dunyasi'],
  ['eating-out/fast-food', 'komagene bereket_doner usta_donerci baydoner dominos_pizza'],
  ['eating-out/cafe', 'starbucks kahve_dunyasi caribou gloria_jeans espressolab'],
  ['eating-out/cafe', '^mado simit_sarayi tchibo_kafe kronotrop petra_roasting'],
  ['eating-out/restaurant', 'nusret big_chefs bigchefs midpoint kofteci_yusuf hd_iskender'],
  ['eating-out/restaurant', 'sultanahmet_koftecisi tarihi_sultanahmet ocakbasi_kebap'],
  ['transport/fuel', 'opet shell petrol_ofisi po_petrol ^po ^bp aytemiz total_enerji'],
  ['transport/fuel', 'totalenergies lukoil kadoil alpet moil sunpet turkiye_petrolleri tp_petrol'],
  ['transport/public-transport', 'istanbulkart metro_istanbul belbim iett izban ego_genel'],
  ['transport/public-transport', 'marmaray ankarakart kentkart bursaray'],
  ['transport/taxi', 'uber bitaksi itaksi bolt_taxi'],
  ['transport/parking', 'ispark otopark_ispark'],
  ['bills/electricity', 'enerjisa ck_enerji ck_bogazici aydem gediz_elektrik uludag_elektrik'],
  ['bills/electricity', 'osmangazi_elektrik yesilirmak_elektrik baskent_elektrik'],
  ['bills/gas', 'igdas baskentgaz izmirgaz enerya aksa_dogalgaz bursagaz'],
  ['bills/water', 'iski ^aski izsu buski ^asat'],
  ['bills/internet', 'superonline turknet kablonet millenicom ttnet tt_net'],
  ['bills/phone', 'turkcell vodafone turk_telekom bimcell pttcell'],
  ['subscriptions/video', 'netflix exxen blutv ^gain mubi ^tod disney disneyplus hbomax'],
  ['subscriptions/video', 'google_youtube youtube amazon_prime prime_video digiturk beinconnect'],
  ['subscriptions/video', 'tivibu ^tabii puhutv crunchyroll'],
  ['subscriptions/music', 'spotify deezer ^tidal fizy apple_music'],
  ['subscriptions/apps', 'openai chatgpt adobe dropbox canva ^notion github anthropic'],
  ['subscriptions/apps', 'google_one apple_bill icloud microsoft_365 office_365 duolingo'],
  ['subscriptions/apps', 'evernote nordvpn expressvpn grammarly linkedin_premium'],
  ['subscriptions/fitness', 'macfit marsathletic mars_athletic fitness_first'],
  ['shopping/online', 'trendyol hepsiburada n11 amazon gittigidiyor aliexpress temu shein'],
  ['shopping/online', 'ciceksepeti pazarama etsy ebay morhipo'],
  ['shopping/clothing', 'zara hnm ^mango bershka pull_bear stradivarius oysho massimo_dutti'],
  ['shopping/clothing', 'lc_waikiki lcw defacto koton mavi_jeans colins ^flo ayakkabi_dunyasi'],
  ['shopping/clothing', 'boyner beymen vakko ^network ipekyol ^twist ^adl nike adidas ^puma'],
  ['shopping/clothing', 'decathlon skechers new_balance intersport sportive tommy_hilfiger'],
  ['shopping/clothing', 'lacoste levis ^gap hotic ^desa derimod penti cna kigili altinyildiz'],
  ['shopping/electronics', 'mediamarkt media_markt teknosa vatan_bilgisayar vatan_computer'],
  ['shopping/electronics', 'apple_store samsung_store arcelik vestel ^beko bosch_home'],
  ['shopping/electronics', 'xiaomi_store dyson kliksa incehesap itopya'],
  ['shopping/home', 'ikea koctas bauhaus tekzen english_home madame_coco ^karaca'],
  ['shopping/home', 'dogtas istikbal bellona kelebek_mobilya evidea jysk pasabahce'],
  ['shopping/home', 'gratis_ev watsons_ev'],
  ['shopping', '^gratis watsons sephora rossmann mac_cosmetics yves_rocher flormar golden_rose'],
  ['shopping', '^kiko atasun_aksesuar swarovski pandora_store toyzz_shop lego_store'],
  ['health/pharmacy', 'eczacibasi_eczane'],
  ['health/hospital', 'acibadem medical_park memorial_hastanesi liv_hospital florence_nightingale'],
  ['health/hospital', 'medicana medipol_hastane dunyagoz'],
  ['health/optical', 'atasun_optik atasun optik_dunyasi'],
  ['entertainment/cinema', 'cinemaximum paribu_cineverse cineverse cinemapink cinetech'],
  ['entertainment/events', 'biletix passo biletinial mobilet'],
  ['entertainment/games', '^steam steamgames playstation sony_playstation xbox nintendo'],
  ['entertainment/games', 'epic_games epicgames riot_games ^blizzard google_play'],
  ['travel/flights', 'turkish_airlines thy ^pegasus sunexpress anadolujet ajet'],
  ['travel/flights', 'lufthansa wizz_air ryanair easyjet emirates qatar_airways'],
  ['travel/hotels', 'booking_com bookingcom ^booking airbnb etstur ets_tur jolly_tur tatilsepeti'],
  ['travel/hotels', 'tatilbudur hilton marriott hotels_com otelz'],
  ['travel/intercity', 'obilet enuygun metro_turizm kamil_koc pamukkale_turizm tcdd'],
  ['travel/car-rental', 'avis hertz europcar budget_rent garenta enterprise_rent'],
  ['education/books', 'kitapyurdu idefix bkm_kitap dnr remzi_kitabevi nezih_kitap'],
  ['education/courses', 'udemy coursera babbel masterclass bilgi_kurs'],
];

/** One row's brands as phrases, with `_` and `^` read. */
function rowPhrases(path: string, brands: string): Phrase<CategoryRef>[] {
  const value = parseCategory(path);
  if (!value) throw new Error(`Unknown category in brand list: ${path}`);
  return brands
    .split(' ')
    .filter(Boolean)
    .map((brand) => ({
      words: brand.replace(/^\^/, '').split('_'),
      leadingOnly: brand.startsWith('^'),
      value,
    }));
}

export const BRAND_PHRASES: readonly Phrase<CategoryRef>[] = BRAND_ROWS.flatMap(([path, brands]) =>
  rowPhrases(path, brands),
);

export const BRAND_INDEX = indexPhrases(BRAND_PHRASES);
