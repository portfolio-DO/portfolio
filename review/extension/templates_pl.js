// templates_pl.js — Polska biblioteka szablonów odpowiedzi na recenzje
// 90+ profesjonalnych szablonów w języku polskim
// Dostęp: FREE (pierwsze 10) | PREMIUM (wszystkie)

const POLISH_TEMPLATES = [

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Pozytywne recenzje (positive)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_pos_001', category: 'positive', tone: 'warm', length: 'short',
    premium: false, // FREE
    title: 'Krótkie podziękowanie',
    body: 'Dziękujemy serdecznie za miłą opinię! Bardzo cieszy nas, że spełniliśmy Państwa oczekiwania — zapraszamy ponownie!\n\nZespół [NAZWA FIRMY]'
  },
  {
    id: 'pl_pos_002', category: 'positive', tone: 'warm', length: 'medium',
    premium: false, // FREE
    title: 'Podziękowanie z zaproszeniem',
    body: 'Dziękujemy za Państwa opinię — naprawdę nas cieszy! Staramy się każdego dnia zapewniać jak najlepszą obsługę i wiedzieć, że nam to wychodzi, daje nam ogromną motywację.\n\nCieszymy się na ponowne spotkanie!\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },
  {
    id: 'pl_pos_003', category: 'positive', tone: 'professional', length: 'short',
    premium: true,
    title: 'Formalne podziękowanie',
    body: 'Szanowna/y [IMIĘ KLIENTA],\n\ndziękujemy za poświęcony czas i pozytywną ocenę. Cieszymy się, że mógł/mogła Pan/Pani skorzystać z naszych usług i zapraszamy ponownie.\n\nZ wyrazami szacunku,\n[WŁAŚCICIEL]\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_pos_004', category: 'positive', tone: 'casual', length: 'short',
    premium: true,
    title: 'Luźna reakcja na 5 gwiazdek',
    body: 'Wow, dziękujemy! 🙏 Taka opinia to najlepsza motywacja dla całego naszego zespołu. Już nie możemy się doczekać kolejnej wizyty!'
  },
  {
    id: 'pl_pos_005', category: 'positive', tone: 'warm', length: 'long',
    premium: true,
    title: 'Szczegółowe podziękowanie',
    body: 'Serdecznie dziękujemy za tak wspaniałą opinię! Cały nasz zespół ciężko pracuje każdego dnia, żeby każda wizyta była wyjątkowa — i bardzo miło jest wiedzieć, że nam to wychodzi.\n\nPrzekaże/m Państwa słowa naszemu zespołowi — z pewnością sprawi to im dużo radości. Mamy nadzieję, że wkrótce znów będziemy mieli przyjemność Państwa gościć!\n\nCiepłe pozdrowienia,\n[WŁAŚCICIEL]\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_pos_006', category: 'positive', tone: 'friendly', length: 'short',
    premium: true,
    title: 'Radosna reakcja',
    body: 'To naprawdę miłe słyszeć! Dziękujemy z całego serca — opinie takie jak Twoja są dla nas najlepszą nagrodą. Do zobaczenia wkrótce! 😊'
  },
  {
    id: 'pl_pos_007', category: 'positive', tone: 'professional', length: 'medium',
    premium: true,
    title: 'Podziękowanie z opisem wartości',
    body: 'Dziękujemy za wysoką ocenę i czas poświęcony na wystawienie opinii. Jakość i satysfakcja klienta to fundamenty naszej działalności — bardzo cieszy nas, że to widać.\n\nBędziemy nadal pracować z zaangażowaniem. Serdecznie zapraszamy!\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_pos_008', category: 'positive', tone: 'warm', length: 'short',
    premium: true,
    title: 'Polecenie znajomym',
    body: 'Bardzo dziękujemy za miłe słowa! Jeśli polecą nas Państwo znajomym, będziemy niezmiernie wdzięczni — to dla nas najpiękniejsza reklama. Zapraszamy ponownie!'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Entuzjastyczne opinie (enthusiastic)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_enth_001', category: 'enthusiastic', tone: 'warm', length: 'medium',
    premium: false, // FREE
    title: 'Odpowiedź na entuzjazm',
    body: 'Takie słowa to dla nas absolutna radość! Dziękujemy za entuzjazm — napędza nas to do jeszcze cięższej pracy. Wiemy, że mamy jeszcze dużo do zrobienia, ale opinie takie jak ta pokazują nam, że jesteśmy na dobrej drodze.\n\nDo zobaczenia!\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_enth_002', category: 'enthusiastic', tone: 'casual', length: 'short',
    premium: true,
    title: 'Energia za energię',
    body: 'Jesteś niesamowity/a! 🌟 Twój entuzjazm dosłownie rozjaśnił nam dzień. Dziękujemy i nie możemy się już doczekać Twojej kolejnej wizyty!'
  },
  {
    id: 'pl_enth_003', category: 'enthusiastic', tone: 'professional', length: 'medium',
    premium: true,
    title: 'Profesjonalna odpowiedź na 5*',
    body: 'Z ogromną przyjemnością odczytaliśmy Państwa recenzję. Tak entuzjastyczna ocena jest dla nas wyjątkowym wyróżnieniem i zobowiązaniem do dalszego utrzymywania wysokich standardów.\n\nDziękujemy i serdecznie zapraszamy!\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Neutralne recenzje (neutral)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_neu_001', category: 'neutral', tone: 'professional', length: 'medium',
    premium: false, // FREE
    title: 'Odpowiedź na neutralną ocenę',
    body: 'Dziękujemy za poświęcony czas i wystawioną opinię. Widzimy, że Państwa doświadczenie mogło być lepsze — stale pracujemy nad poprawą naszych usług i mamy nadzieję, że kolejna wizyta w pełni spełni Państwa oczekiwania.\n\nZapraszamy ponownie!\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_neu_002', category: 'neutral', tone: 'warm', length: 'medium',
    premium: true,
    title: 'Ciepła odpowiedź na 3 gwiazdki',
    body: 'Dziękujemy za szczerą opinię — takie informacje zwrotne pomagają nam się rozwijać. Przykro nam, że wizyta nie była idealna. Chętnie dowiemy się więcej o tym, co moglibyśmy poprawić — prosimy o kontakt pod [EMAIL/TELEFON].\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },
  {
    id: 'pl_neu_003', category: 'neutral', tone: 'professional', length: 'long',
    premium: true,
    title: 'Szczegółowa odpowiedź neutralna',
    body: 'Szanowna/y [IMIĘ KLIENTA],\n\ndziękujemy za wystawienie opinii. Rozumiemy, że Państwa oczekiwania nie zostały w pełni spełnione i traktujemy to bardzo poważnie.\n\nNa co dzień dokładamy wszelkich starań, aby każda wizyta była wyjątkowa. Bylibyśmy wdzięczni za więcej szczegółów dotyczących Państwa doświadczenia — pomoże nam to w konkretnych usprawnieniach.\n\nProszę o kontakt: [EMAIL/TELEFON]\n\nZ wyrazami szacunku,\n[WŁAŚCICIEL]\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Negatywne / Skargi (negative)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_neg_001', category: 'negative', tone: 'apologetic', length: 'medium',
    premium: false, // FREE
    title: 'Ogólne przeprosiny',
    body: 'Bardzo przepraszamy za nieprzyjemne doświadczenie. To zdecydowanie nie jest standard, który chcemy prezentować. Prosimy o bezpośredni kontakt pod [EMAIL/TELEFON] — chcemy wyjaśnić sytuację i wszystko naprawić.\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },
  {
    id: 'pl_neg_002', category: 'negative', tone: 'professional', length: 'long',
    premium: false, // FREE
    title: 'Formalne przeprosiny z wyjaśnieniem',
    body: 'Szanowna/y Kliencie,\n\ndziękujemy za wystawienie opinii, mimo że doświadczenie nie spełniło Państwa oczekiwań. Przepraszamy — to, co Pani/Pan opisuje, jest dla nas nieakceptowalne.\n\nAnalizujemy sytuację i wdrażamy działania naprawcze. Bardzo prosimy o kontakt pod [EMAIL/TELEFON], abyśmy mogli to osobiście wyjaśnić i zaproponować rekompensatę.\n\nZ wyrazami szacunku,\n[WŁAŚCICIEL]\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_neg_003', category: 'negative', tone: 'warm', length: 'medium',
    premium: true,
    title: 'Empatyczna odpowiedź na skargę',
    body: 'Bardzo nam przykro, że Państwa wizyta nie przebiegła zgodnie z oczekiwaniami. Rozumiemy frustrację i przepraszamy szczerze.\n\nZależy nam na każdym Kliencie i chcemy tę sytuację naprawić. Proszę napisać do nas na [EMAIL] lub zadzwonić pod [TELEFON] — zajmiemy się tym osobiście.\n\n[WŁAŚCICIEL]'
  },
  {
    id: 'pl_neg_004', category: 'negative', tone: 'firm_polite', length: 'medium',
    premium: true,
    title: 'Stanowcza, ale uprzejma odpowiedź',
    body: 'Dziękujemy za opinię. Bierzemy pod uwagę każdą informację zwrotną, nawet jeśli jest krytyczna. Opisana sytuacja jest dla nas sygnałem do działania.\n\nProsimy o kontakt bezpośredni — chcemy poznać wszystkie szczegóły i odpowiednio zareagować. Nasz adres e-mail to [EMAIL].\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_neg_005', category: 'negative', tone: 'apologetic', length: 'short',
    premium: true,
    title: 'Krótkie przeprosiny',
    body: 'Przepraszamy za to doświadczenie — naprawdę nam przykro. Prosimy o kontakt pod [EMAIL/TELEFON], chcemy to naprawić.\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_neg_006', category: 'negative', tone: 'professional', length: 'medium',
    premium: true,
    title: 'Odpowiedź na niską ocenę z prośbą o szczegóły',
    body: 'Bardzo nam przykro z powodu negatywnego doświadczenia. Zależy nam na wyjaśnieniu tej sytuacji, ale potrzebujemy więcej informacji, aby to zrobić rzetelnie.\n\nCzy mogą Państwo skontaktować się z nami bezpośrednio? E-mail: [EMAIL] | Tel: [TELEFON]. Zajmiemy się tym priorytetowo.\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },
  {
    id: 'pl_neg_007', category: 'negative', tone: 'apologetic', length: 'long',
    premium: true,
    title: 'Głębokie przeprosiny za obsługę',
    body: 'Szanowna/y [IMIĘ KLIENTA],\n\nprzeczytałem/am Państwa opinię z dużą uwagą i chcę powiedzieć wprost: przepraszam. To, co Państwo opisali, nie powinno było się zdarzyć.\n\nPodjęliśmy już wewnętrzne działania, żeby taka sytuacja się nie powtórzyła. Zależy mi, żeby naprawić Państwa doświadczenie — proszę napisać lub zadzwonić, a osobiście zajmę się Państwa sprawą.\n\nE-mail: [EMAIL] | Tel: [TELEFON]\n\nZ wyrazami szacunku,\n[WŁAŚCICIEL]\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Przeprosiny za obsługę (apologies_service)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_apo_001', category: 'apologies_service', tone: 'apologetic', length: 'medium',
    premium: false, // FREE
    title: 'Przeprosiny za obsługę',
    body: 'Przepraszamy za poziom obsługi, który Pani/Pan doświadczył/a. Standardy, jakie stawiamy naszym pracownikom, są wysokie — i przykro nam, że tym razem nie zostały dotrzymane.\n\nSprawa zostanie wyjaśniona wewnętrznie. Prosimy o kontakt pod [EMAIL/TELEFON].\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },
  {
    id: 'pl_apo_002', category: 'apologies_service', tone: 'professional', length: 'long',
    premium: true,
    title: 'Formalne przeprosiny za obsługę',
    body: 'Szanowna/y Kliencie,\n\ndziękujemy za szczerą opinię dotyczącą obsługi. To, co Pani/Pan opisuje, jest dla nas bardzo niepokojące — traktujemy profesjonalizm jako fundament naszej działalności.\n\nPrzeprowadzimy rozmowy z odpowiednim personelem i podejmiemy stosowne kroki. Prosimy o kontakt — chcielibyśmy zaproponować Państwu rekompensatę za niedogodności.\n\nE-mail: [EMAIL]\nTelefon: [TELEFON]\n\nZ poważaniem,\n[WŁAŚCICIEL]\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_apo_003', category: 'apologies_service', tone: 'warm', length: 'medium',
    premium: true,
    title: 'Ciepłe przeprosiny za czas oczekiwania',
    body: 'Bardzo przepraszamy za długi czas oczekiwania — doskonale rozumiemy, jak frustrujące to jest. Pracujemy nad usprawnieniem naszych procesów, żeby uniknąć takich sytuacji w przyszłości.\n\nMamy nadzieję, że dadzą nam Państwo szansę na poprawę. Zapraszamy ponownie!\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_apo_004', category: 'apologies_service', tone: 'apologetic', length: 'short',
    premium: true,
    title: 'Szybkie przeprosiny',
    body: 'Przepraszamy szczerze — masz rację i rozumiemy Twoje niezadowolenie. Robimy wszystko, żeby to poprawić. Zapraszamy do kontaktu: [EMAIL].'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Prośba o kontakt (contact_request)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_con_001', category: 'contact_request', tone: 'professional', length: 'medium',
    premium: false, // FREE
    title: 'Zaproszenie do kontaktu',
    body: 'Dziękujemy za opinię. Zależy nam na wyjaśnieniu tej sytuacji i znalezieniu rozwiązania. Prosimy o kontakt bezpośredni:\n\n📧 [EMAIL]\n📞 [TELEFON]\n\nCzekamy na wiadomość!\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },
  {
    id: 'pl_con_002', category: 'contact_request', tone: 'warm', length: 'short',
    premium: true,
    title: 'Krótkie zaproszenie do kontaktu',
    body: 'Bardzo zależy nam na wyjaśnieniu tej sytuacji. Czy mogą Państwo napisać do nas na [EMAIL]? Zajmiemy się tym jak najszybciej.\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_con_003', category: 'contact_request', tone: 'professional', length: 'long',
    premium: true,
    title: 'Formalne zaproszenie do dialogu',
    body: 'Szanowna/y [IMIĘ KLIENTA],\n\ndziękujemy za czas poświęcony na wystawienie opinii. Rozumiemy Państwa zastrzeżenia i chcielibyśmy je omówić bezpośrednio.\n\nProsimy o kontakt, abyśmy mogli wspólnie znaleźć satysfakcjonujące rozwiązanie:\n\n📧 [EMAIL]\n📞 [TELEFON]\n🕒 Godziny kontaktu: Pon–Pt, 9:00–17:00\n\nZ wyrazami szacunku,\n[WŁAŚCICIEL]\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Krótkie jednozdaniowe odpowiedzi (one_liner)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_one_001', category: 'one_liner', tone: 'warm', length: 'short',
    premium: true,
    title: 'Jedno zdanie – podziękowanie',
    body: 'Dziękujemy serdecznie — takie opinie dają nam skrzydła! 🙏'
  },
  {
    id: 'pl_one_002', category: 'one_liner', tone: 'casual', length: 'short',
    premium: true,
    title: 'Jedno zdanie – zaproszenie',
    body: 'Cieszmy się, że Ci się podobało — do zobaczenia wkrótce! 😊'
  },
  {
    id: 'pl_one_003', category: 'one_liner', tone: 'professional', length: 'short',
    premium: true,
    title: 'Jedno zdanie – formalne',
    body: 'Dziękujemy za pozytywną ocenę — cieszymy się na kolejne spotkanie.'
  },
  {
    id: 'pl_one_004', category: 'one_liner', tone: 'apologetic', length: 'short',
    premium: true,
    title: 'Jedno zdanie – przeprosiny',
    body: 'Przepraszamy za niedogodności — skontaktujemy się z Państwem jak najszybciej.'
  },
  {
    id: 'pl_one_005', category: 'one_liner', tone: 'casual', length: 'short',
    premium: true,
    title: 'Jedno zdanie – energia',
    body: 'Dzięki za tę opinię — napędza nas do działania! 🚀'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Długie profesjonalne (long_professional)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_long_001', category: 'long_professional', tone: 'professional', length: 'long',
    premium: true,
    title: 'Kompleksowa odpowiedź biznesowa',
    body: 'Szanowna/y [IMIĘ KLIENTA],\n\ndziękujemy za poświęcenie czasu na wystawienie szczegółowej opinii. Każda informacja zwrotna jest dla nas cennym źródłem wiedzy o tym, co robimy dobrze i co możemy poprawić.\n\n[NAZWA FIRMY] od [ROK ZAŁOŻENIA] stawia na jakość i satysfakcję Klientów jako najważniejsze wartości. Opisane przez Państwa doświadczenie traktujemy priorytetowo i podjęliśmy już odpowiednie kroki wewnętrznie.\n\nChętnie porozmawiamy o szczegółach i znajdziemy rozwiązanie satysfakcjonujące obie strony. Prosimy o kontakt:\n📧 [EMAIL] | 📞 [TELEFON]\n\nZ wyrazami szacunku,\n[WŁAŚCICIEL]\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_long_002', category: 'long_professional', tone: 'warm', length: 'long',
    premium: true,
    title: 'Długa ciepła odpowiedź na pozytyw',
    body: 'Bardzo serdecznie dziękujemy za tę piękną opinię! Pisać takie słowa to coś, co wprawia nas w naprawdę dobry nastrój — i to nie tylko właściciela, ale cały zespół.\n\nWiedziemy, że za każdą wizytą Klienta stoją prawdziwi ludzie, którzy każdego dnia dają z siebie wszystko. Wasze opinie to najlepsza forma docenienia ich pracy.\n\nMamy nadzieję, że wróciną Państwo do nas przy kolejnej okazji — a może nawet polecą nas komuś bliskim? To dla nas największa nagroda.\n\nDo zobaczenia i serdeczne pozdrowienia,\n[WŁAŚCICIEL] i cały Zespół\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_long_003', category: 'long_professional', tone: 'apologetic', length: 'long',
    premium: true,
    title: 'Szczegółowa odpowiedź na poważną skargę',
    body: 'Szanowna/y [IMIĘ KLIENTA],\n\nuważnie przeczytałem/am Pańską/Pani opinię i chcę powiedzieć wprost: bardzo mi przykro. To, co Pani/Pan opisuje, nie powinno było mieć miejsca.\n\nNatychmiast przeprowadziłem/am rozmowę z moim zespołem i podjęliśmy konkretne kroki, żeby taka sytuacja się nie powtórzyła. Nie są to puste słowa — traktuję tę sprawę osobiście.\n\nZależy mi, żeby wynagrodzić Państwu to doświadczenie. Proszę skontaktować się ze mną bezpośrednio:\n📧 [EMAIL] | 📞 [TELEFON]\n\nZ wyrazami szacunku i przeprosinami,\n[WŁAŚCICIEL]\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: E-commerce (ecommerce)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_eco_001', category: 'ecommerce', tone: 'professional', length: 'medium',
    premium: true,
    title: 'Odpowiedź na opię o sklepie online',
    body: 'Dziękujemy za zakupy w [NAZWA FIRMY] i za wystawienie opinii! Cieszymy się, że zamówienie dotarło sprawnie i zgodnie z oczekiwaniami.\n\nZapraszamy do kolejnych zakupów — stale poszerzamy naszą ofertę!\n\nZespół [NAZWA FIRMY]'
  },
  {
    id: 'pl_eco_002', category: 'ecommerce', tone: 'apologetic', length: 'medium',
    premium: true,
    title: 'Przeprosiny za opóźnioną dostawę',
    body: 'Bardzo przepraszamy za opóźnienie w dostawie — rozumiemy, jak frustrujące jest czekanie dłużej niż zakładano.\n\nProsimy o podanie numeru zamówienia w wiadomości na [EMAIL], a niezwłocznie sprawdzimy status paczki i zaproponujemy rekompensatę.\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_eco_003', category: 'ecommerce', tone: 'professional', length: 'long',
    premium: true,
    title: 'Odpowiedź na reklamację produktu',
    body: 'Szanowna/y [IMIĘ KLIENTA],\n\ndziękujemy za poinformowanie nas o problemie z produktem. Reklamacje traktujemy priorytetowo — Państwa satysfakcja jest dla nas najważniejsza.\n\nProsimy o przesłanie:\n• Zdjęcia wadliwego produktu\n• Numeru zamówienia\n• Opisu problemu\n\nna adres: [EMAIL]\n\nOdpiszemy w ciągu 24 godzin i zaproponujemy wymianę lub zwrot.\n\nZ poważaniem,\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_eco_004', category: 'ecommerce', tone: 'warm', length: 'short',
    premium: true,
    title: 'Podziękowanie za stałego klienta',
    body: 'To ogromna radość widzieć, że wracają Państwo do nas! Dziękujemy za zaufanie i lojalność — cenimy każdego stałego Klienta. Zapraszamy po więcej! 🛍️\n\nZespół [NAZWA FIRMY]'
  },
  {
    id: 'pl_eco_005', category: 'ecommerce', tone: 'apologetic', length: 'medium',
    premium: true,
    title: 'Przeprosiny za błędne zamówienie',
    body: 'Przepraszamy za pomyłkę w realizacji zamówienia — to po naszej stronie i bardzo nam przykro.\n\nProsimy o kontakt na [EMAIL] z numerem zamówienia. Wyślemy właściwy produkt priorytetowo i na nasz koszt. Dziękujemy za cierpliwość.\n\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Restauracje i usługi (restaurant_service)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_res_001', category: 'restaurant_service', tone: 'warm', length: 'medium',
    premium: false, // FREE
    title: 'Podziękowanie za wizytę w restauracji',
    body: 'Bardzo dziękujemy za miłą opinię! Cieszymy się, że jedzenie i obsługa spełniły Państwa oczekiwania — gotujemy i pracujemy z prawdziwą pasją.\n\nCzekamy na kolejną wizytę! Zapraszamy!\n\nZespół [NAZWA FIRMY]'
  },
  {
    id: 'pl_res_002', category: 'restaurant_service', tone: 'apologetic', length: 'medium',
    premium: true,
    title: 'Przeprosiny za jakość jedzenia',
    body: 'Przepraszamy, że posiłek nie spełnił Państwa oczekiwań — zależy nam na jakości każdego dania i bardzo nam przykro, że tym razem nam się to nie udało.\n\nProsimy o kontakt pod [EMAIL/TELEFON] — chętnie zaprosimy Państwa na kolację naszym kosztem, żeby pokazać, na co nas naprawdę stać.\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },
  {
    id: 'pl_res_003', category: 'restaurant_service', tone: 'professional', length: 'medium',
    premium: true,
    title: 'Odpowiedź na uwagi do obsługi w restauracji',
    body: 'Dziękujemy za wystawienie opinii. Standardy obsługi to dla nas absolutny priorytet i przykro nam, że nie zostały spełnione podczas Państwa wizyty.\n\nRozmowa z personelem już miała miejsce. Prosimy o kontakt pod [EMAIL] — chcemy zaproponować wizytę w specjalnych warunkach jako wyraz przeprosin.\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },
  {
    id: 'pl_res_004', category: 'restaurant_service', tone: 'casual', length: 'short',
    premium: true,
    title: 'Luźna odpowiedź restauracyjna',
    body: 'Tak miło! Dzięki za wizytę i za te słowa — przekażemy je kuchni, bo na pewno ich ucieszą 👨‍🍳 Do następnego razu!'
  },
  {
    id: 'pl_res_005', category: 'restaurant_service', tone: 'warm', length: 'long',
    premium: true,
    title: 'Szczegółowa odpowiedź restauracyjna',
    body: 'Bardzo dziękujemy za tę opinię! Każda wizyta w [NAZWA FIRMY] to dla nas okazja do podzielenia się pasją do jedzenia i gościnności. Naprawdę cieszymy się, że ta wizyta przypadła Państwu do gustu.\n\nNasz kucharz i personel sali pracują każdego dnia, żeby każdy gość czuł się wyjątkowo — wiadomość, że im się to udało, sprawia nam ogromną radość.\n\nCzekamy na kolejną okazję, by Państwa ugościć!\n\nSerdecznie,\n[WŁAŚCICIEL]\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_res_006', category: 'restaurant_service', tone: 'apologetic', length: 'medium',
    premium: true,
    title: 'Przeprosiny za czas oczekiwania (restauracja)',
    body: 'Przepraszamy za długi czas oczekiwania podczas Państwa wizyty — rozumiemy, jak bardzo może to popsuć nastrój, szczególnie gdy jest się głodnym 😊\n\nPracujemy nad usprawnieniem organizacji, żeby do takich sytuacji dochodziło jak najrzadziej. Mamy nadzieję, że dadzą nam Państwo jeszcze jedną szansę!\n\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Follow-up / Budowanie relacji (followup)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_fol_001', category: 'followup', tone: 'warm', length: 'medium',
    premium: true,
    title: 'Zachęta do powrotu',
    body: 'Dziękujemy za tę opinię — miło nam wiedzieć, że czas spędzony u nas zapisał się w pamięci. Chętnie znowu Państwa gościmy!\n\nWarto również zaobserwować nas na [SOCIAL MEDIA] — regularnie informujemy tam o nowościach i promocjach.\n\nDo zobaczenia!\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_fol_002', category: 'followup', tone: 'casual', length: 'short',
    premium: true,
    title: 'Luźne zaproszenie do powrotu',
    body: 'Hej, dzięki za miłe słowa! 😊 Czekamy na Ciebie z nowościami — wpadaj do nas niebawem!'
  },
  {
    id: 'pl_fol_003', category: 'followup', tone: 'professional', length: 'medium',
    premium: true,
    title: 'Formalne zaproszenie do współpracy',
    body: 'Dziękujemy za pozytywną ocenę i dotychczasową współpracę. Cenimy zaufanie, jakim Państwo nas obdarzają i zobowiązujemy się do dalszego utrzymywania wysokich standardów.\n\nZapraszamy do śledzenia naszej oferty — regularnie pojawiają się nowe usługi i promocje dostępne dla stałych Klientów.\n\nZ wyrazami szacunku,\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_fol_004', category: 'followup', tone: 'warm', length: 'long',
    premium: true,
    title: 'Budowanie lojalności – długa wersja',
    body: 'Bardzo dziękujemy za tę recenzję i za Pańską/Pani lojalność! Klienci tacy jak Państwo są powodem, dla którego robimy to, co robimy.\n\nChcemy, żeby każda kolejna wizyta była lepsza od poprzedniej — to nieustanne dążenie do doskonałości jest wbudowane w nasze DNA.\n\nJeśli macie Państwo sugestie, jak możemy się poprawić, bardzo prosimy o kontakt — każda opinia jest dla nas bezcenna.\n\n📧 [EMAIL] | 📞 [TELEFON]\n\nDo zobaczenia wkrótce i serdeczne pozdrowienia,\n[WŁAŚCICIEL] i cały Zespół\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Odpowiedzi na fałszywe / niesprawiedliwe recenzje
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_fake_001', category: 'fake_review', tone: 'firm_polite', length: 'medium',
    premium: true,
    title: 'Brak danych o wizycie',
    body: 'Dziękujemy za opinię. Przejrzeliśmy nasze zapisy i niestety nie możemy odnaleźć wizyty odpowiadającej opisanej sytuacji.\n\nChętnie wyjaśnimy tę sprawę bezpośrednio — prosimy o kontakt na [EMAIL]. Zawsze jesteśmy otwarci na rzeczowy dialog.\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_fake_002', category: 'fake_review', tone: 'professional', length: 'long',
    premium: true,
    title: 'Merytoryczna odpowiedź na nieprawdziwe zarzuty',
    body: 'Dziękujemy za wystawienie opinii. Pragniemy jednak odnieść się do kilku kwestii, które nie są zgodne z naszą dokumentacją i zasadami działania.\n\nNie jesteśmy w stanie zidentyfikować wizyty opisanej w recenzji. [NAZWA FIRMY] działa zgodnie z [STOSOWNYMI PRZEPISAMI/STANDARDAMI] i nie ma wśród naszych zapisów przypadku opisanego w tej recenzji.\n\nJeśli naprawdę doszło do nieprawidłowości, serdecznie zapraszamy do bezpośredniego kontaktu, abyśmy mogli sprawę wyjaśnić rzetelnie.\n\n📧 [EMAIL]\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Jakość produktu (product_quality)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_pq_001', category: 'product_quality', tone: 'apologetic', length: 'medium',
    premium: true,
    title: 'Przeprosiny za jakość produktu',
    body: 'Przepraszamy, że produkt nie spełnił Państwa oczekiwań — przykro nam to słyszeć, bo pracujemy nad jakością każdego dnia.\n\nProsimy o kontakt z numerem zamówienia na [EMAIL] — wymienimy produkt lub zwrócimy pieniądze bez żadnych pytań.\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_pq_002', category: 'product_quality', tone: 'professional', length: 'medium',
    premium: true,
    title: 'Formalna odpowiedź na reklamację jakości',
    body: 'Szanowna/y Kliencie, dziękujemy za poinformowanie nas o problemie z jakością. Każda reklamacja jest dla nas sygnałem do analizy naszych procesów.\n\nProsimy o przesłanie szczegółów na [EMAIL]. Gwarantujemy szybką i profesjonalną obsługę reklamacji.\n\nZ wyrazami szacunku,\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Cena i wartość (price_value)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_pv_001', category: 'price_value', tone: 'professional', length: 'medium',
    premium: true,
    title: 'Odpowiedź na zarzut o cenie',
    body: 'Dziękujemy za szczerą opinię dotyczącą cen. Rozumiemy, że cena jest ważnym czynnikiem przy wyborze usługodawcy.\n\nNasze ceny odzwierciedlają jakość materiałów, doświadczenie zespołu oraz [INNE WARTOŚCI]. Staramy się oferować jak najlepszy stosunek jakości do ceny.\n\nJeśli mają Państwo pytania odnośnie wyceny, chętnie porozmawiamy: [EMAIL/TELEFON].\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_pv_002', category: 'price_value', tone: 'warm', length: 'short',
    premium: true,
    title: 'Krótka odpowiedź o wartości',
    body: 'Dziękujemy za szczerość. Zdajemy sobie sprawę, że nie jesteśmy najtańsi — ale dbamy o to, żeby każda złotówka była warta swojej ceny. Zapraszamy do kontaktu, jeśli chcą Państwo porozmawiać o możliwościach.\n\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Czystość i higiena (cleanliness)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_cl_001', category: 'cleanliness', tone: 'apologetic', length: 'medium',
    premium: true,
    title: 'Przeprosiny za czystość',
    body: 'Przepraszamy — czystość i higiena to dla nas absolutny priorytet i przykro nam, że tym razem nie sprostaliśmy Państwa (i naszym własnym) standardom.\n\nPodjęliśmy już działania naprawcze i zaostrzyliśmy procedury. Prosimy o kontakt pod [EMAIL] — chcemy pokazać Państwu, że wyciągnęliśmy wnioski.\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Szybkość obsługi (speed)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_sp_001', category: 'speed', tone: 'apologetic', length: 'medium',
    premium: true,
    title: 'Przeprosiny za wolną obsługę',
    body: 'Przepraszamy za długi czas oczekiwania — doskonale rozumiemy, jak cenny jest Państwa czas.\n\nW [DATE] mieliśmy wyjątkowo duże obłożenie, ale to nie jest usprawiedliwienie. Wdrożyliśmy zmiany organizacyjne, żeby podobna sytuacja nie miała miejsca.\n\nMamy nadzieję na kolejne spotkanie!\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_sp_002', category: 'speed', tone: 'firm_polite', length: 'short',
    premium: true,
    title: 'Krótkie odniesienie do czasu obsługi',
    body: 'Doceniamy opinię. Czas obsługi to obszar, w którym stale się doskonalimy. Przepraszamy za niedogodności i zapraszamy ponownie — pracujemy ciężko nad poprawą.\n\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Dostawy (delivery)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_del_001', category: 'delivery', tone: 'apologetic', length: 'medium',
    premium: true,
    title: 'Przeprosiny za opóźnienie dostawy',
    body: 'Przepraszamy za opóźnienie — to nie jest standard, który staramy się utrzymywać. Prosimy o podanie numeru zamówienia na [EMAIL], a zbadamy sprawę i zaproponujemy rekompensatę.\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_del_002', category: 'delivery', tone: 'professional', length: 'medium',
    premium: true,
    title: 'Formalna odpowiedź na reklamację dostawy',
    body: 'Szanowna/y Kliencie,\n\ndziękujemy za poinformowanie nas o problemie z dostawą. Prosimy o przesłanie numeru zamówienia na [EMAIL] — niezwłocznie wyjaśnimy sytuację z przewoźnikiem i zaproponujemy rozwiązanie.\n\nZ wyrazami szacunku,\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // KATEGORIA: Opakowanie (packaging)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_pak_001', category: 'packaging', tone: 'apologetic', length: 'medium',
    premium: true,
    title: 'Przeprosiny za opakowanie',
    body: 'Przepraszamy za problemy z opakowaniem — rozumiemy, że to frustrujące, kiedy zamówienie dochodzi w złym stanie.\n\nProsimy o przesłanie zdjęć na [EMAIL] z numerem zamówienia. Wyślemy nowy produkt lub zwrócimy środki.\n\n[NAZWA FIRMY]'
  },

  // ═══════════════════════════════════════════════════════════════
  // DODATKOWE – RÓŻNE TONY I STYLE
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'pl_misc_001', category: 'positive', tone: 'casual', length: 'medium',
    premium: true,
    title: 'Super-luźna odpowiedź',
    body: 'No i ekstra! 🎉 Dzięki wielkie — takie opinie to dla nas czysta przyjemność. Powiedz znajomym, zapraszamy wszystkich!\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_misc_002', category: 'positive', tone: 'professional', length: 'short',
    premium: true,
    title: 'Zwięzłe profesjonalne podziękowanie',
    body: 'Dziękujemy za pozytywną ocenę. Cieszymy się, że spełniliśmy Państwa oczekiwania i zapraszamy ponownie.\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_misc_003', category: 'negative', tone: 'firm_polite', length: 'medium',
    premium: true,
    title: 'Stanowcza, uprzejma odpowiedź',
    body: 'Dziękujemy za opinię. Przeanalizujemy opisaną sytuację i podejmiemy stosowne działania. Zależy nam, żeby każdy Klient był zadowolony — prosimy o kontakt pod [EMAIL], abyśmy mogli sprawę wyjaśnić.\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_misc_004', category: 'neutral', tone: 'casual', length: 'short',
    premium: true,
    title: 'Luźna odpowiedź na neutralną opinię',
    body: 'Dzięki za opinię! Rozumiemy, że nie wszystko było idealne — pracujemy nad tym. Mamy nadzieję, że następnym razem w pełni trafisz w nasze możliwości. Zapraszamy! 🙂'
  },
  {
    id: 'pl_misc_005', category: 'positive', tone: 'warm', length: 'medium',
    premium: true,
    title: 'Podziękowanie z podziękowaniem zespołu',
    body: 'Dziękujemy za tę wspaniałą opinię! Przekazaliśmy ją naszemu zespołowi — wywołała szeroki uśmiech na twarzach wszystkich 😊\n\nTo właśnie dla takich chwil robimy to, co robimy. Do zobaczenia!\n\n[WŁAŚCICIEL] i Zespół, [NAZWA FIRMY]'
  },
  {
    id: 'pl_misc_006', category: 'negative', tone: 'apologetic', length: 'medium',
    premium: true,
    title: 'Przeprosiny z konkretnym działaniem',
    body: 'Przepraszamy za to doświadczenie. Nie tylko nam przykro — podjęliśmy już konkretne działania: [DZIAŁANIE].\n\nZależy nam, żeby to naprawić. Proszę napisać na [EMAIL] — zajmę się tym osobiście.\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },
  {
    id: 'pl_misc_007', category: 'followup', tone: 'professional', length: 'short',
    premium: true,
    title: 'Krótkie zaproszenie do stałej współpracy',
    body: 'Cieszymy się z Państwa pozytywnej oceny i zapraszamy do długoterminowej współpracy. Stałych Klientów traktujemy wyjątkowo — prosimy pytać o specjalne warunki.\n\n[NAZWA FIRMY]'
  },
  {
    id: 'pl_misc_008', category: 'enthusiastic', tone: 'warm', length: 'medium',
    premium: true,
    title: 'Odpowiedź na wzruszającą opinię',
    body: 'Taka opinia naprawdę nam bardzo miło — to jeden z tych momentów, dla których warto wstawać rano do pracy. Dziękujemy z całego serca!\n\nMamy nadzieję, że wrócą Państwo do nas przy każdej okazji — a jeśli macie pytania lub sugestie, zawsze jesteśmy dostępni pod [EMAIL].\n\n[WŁAŚCICIEL], [NAZWA FIRMY]'
  },
  {
    id: 'pl_misc_009', category: 'contact_request', tone: 'casual', length: 'short',
    premium: true,
    title: 'Nieformalny kontakt',
    body: 'Hej! Chętnie porozmawiamy o tym osobiście — napisz do nas na [EMAIL] albo zadzwoń pod [TELEFON]. Zajmiemy się tym szybko! 🤝'
  },
  {
    id: 'pl_misc_010', category: 'long_professional', tone: 'professional', length: 'long',
    premium: true,
    title: 'Premium – pełna profesjonalna odpowiedź',
    body: 'Szanowna/y [IMIĘ KLIENTA],\n\nw imieniu całego zespołu [NAZWA FIRMY] dziękujemy za poświęcenie czasu na wystawienie opinii. Każda informacja zwrotna — zarówno pozytywna, jak i krytyczna — jest dla nas nieoceniona.\n\nNa bieżąco analizujemy opinie naszych Klientów i wdrażamy usprawnienia. Chcielibyśmy omówić Państwa doświadczenie bardziej szczegółowo, aby lepiej zrozumieć, co możemy ulepszyć lub co warto zachować.\n\nProsimy o kontakt:\n📧 [EMAIL]\n📞 [TELEFON]\n🕒 Dostępni: Pon–Pt 9:00–18:00\n\nŁączymy wyrazy szacunku i zapraszamy do dalszej współpracy,\n[WŁAŚCICIEL]\n[NAZWA FIRMY]'
  }
];

// Which template IDs are free (max 10 on free plan)
const FREE_TEMPLATE_IDS = POLISH_TEMPLATES
  .filter(t => !t.premium)
  .map(t => t.id);

// Category keyword matching for Polish text
const PL_CATEGORY_KEYWORDS = {
  positive:          ['świetnie','super','polecam','rewelacja','doskonale','perfekcyjnie','wspaniale','brawo','pięknie','cudownie','fajnie','bardzo dobrze','zadowolony','zadowolona','5 gwiazdek'],
  enthusiastic:      ['niesamowite','absolutnie','najlepsze','zachwycony','zachwycona','wow','ekstra','fantastycznie','genialnie','mistrzostwo'],
  neutral:           ['przeciętnie','mogło być lepiej','w porządku','nic specjalnego','normalnie','3 gwiazdki','poprawnie'],
  negative:          ['rozczarowany','rozczarowana','słaba','słaby','kiepski','okropny','straszny','fatalne','skandal','niedopuszczalne','do niczego','nie polecam','żenada','zawód'],
  apologies_service: ['obsługa','personel','pracownik','kelner','kasjer','nieprzyjemny','niegrzeczny','chamski','arogancki','ignorowali','ignorował'],
  contact_request:   ['kontakt','zadzwoń','napisz','wyjaśnienie','rozmowa','rozwiązanie'],
  one_liner:         [],
  long_professional: [],
  ecommerce:         ['zamówienie','dostawa','paczka','sklep internetowy','allegro','zakup online','produkt','wysyłka'],
  restaurant_service:['restauracja','jedzenie','danie','menu','stolik','rezerwacja','smak','kuchnia','posiłek','kelner'],
  followup:          ['wrócimy','wracam','polecam znajomym','następnym razem','regularnie'],
  fake_review:       ['nieprawda','kłamstwo','nigdy','brak wizyty','nie byłem','nie byłam','fałszywa'],
  product_quality:   ['jakość produktu','wadliwy','uszkodzony','zepsuty','niedziałający','reklamacja'],
  price_value:       ['cena','drogi','droga','za dużo','kosztowny','opłaca','warto','stosunek ceny'],
  cleanliness:       ['brudno','czystość','higiena','nieschludnie','nieczysto','brudy'],
  speed:             ['czekałem','czekałam','długo','powoli','czas oczekiwania','za wolno','kolejka'],
  delivery:          ['dostawa','kurier','opóźnienie','nie doszło','zaginęło','śledzenie'],
  packaging:         ['opakowanie','zniszczone','połamane','rozbite','zmiażdżone']
};

if (typeof module !== 'undefined') {
  module.exports = { POLISH_TEMPLATES, FREE_TEMPLATE_IDS, PL_CATEGORY_KEYWORDS };
}
