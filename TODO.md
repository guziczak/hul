# TODO — Hul

## Założenia techniczne

- [ ] Zachować czysty, statyczny HTML, CSS i JavaScript.
- [ ] Bez Vite, TypeScriptu, bundlera, kompilacji, chunków i routera SPA.
- [ ] Każdy adres ma prowadzić do osobnego pliku `index.html` możliwego do odczytania bez JavaScriptu.
- [ ] Współdzielić CSS, JavaScript, fonty i obrazy między podstronami.
- [ ] Zachować obecny wygląd, animacje, responsywność i obsługę `prefers-reduced-motion`.
- [ ] Najpierw obsługiwać publikację pod `https://guziczak.github.io/hul/`, a po podpięciu domeny zaktualizować wszystkie adresy absolutne.

## Docelowa architektura

```text
/index.html
/realizacje/index.html
/realizacje/nazwa-projektu/index.html
/o-nas/index.html
/kontakt/index.html
/blog/index.html                 # dopiero gdy powstaną artykuły
```

- [ ] Ustalić ostateczne nazwy i adresy podstron.
- [ ] Zdecydować przed podziałem, czy uporządkować assety do katalogów `css/`, `js/`, `img/` i `fonts/`.
- [ ] Przygotować wspólny nagłówek, nawigację i stopkę dla wszystkich stron.
- [ ] Zachować na stronie głównej skróty najważniejszych sekcji i linki do pełnych podstron.
- [ ] Nie powielać całych bloków tekstu pomiędzy stroną główną a podstronami.

## Podstrony

### Realizacje

- [ ] Zbudować stronę zbiorczą realizacji.
- [ ] Przygotować szablon pojedynczej realizacji.
- [ ] Dla każdej realizacji zebrać: nazwę, lokalizację, zakres prac, użyte materiały, opis decyzji projektowych i zdjęcia.
- [ ] Dodać nawigację pomiędzy realizacjami oraz powrót do listy.

### O nas

- [ ] Rozwinąć historię manufaktury, sposób wyboru i sezonowania drewna oraz proces pracy.
- [ ] Przedstawić prawdziwy zespół i zakres odpowiedzialności poszczególnych osób.
- [ ] Dodać wiarygodne zdjęcia pracowni, ludzi i procesu produkcji.

### Kontakt

- [ ] Uzupełnić prawdziwy adres, telefon, e-mail, godziny kontaktu i linki społecznościowe.
- [ ] Opisać pierwszy krok współpracy i informacje potrzebne do przygotowania zapytania.
- [ ] Zdecydować, czy formularz jest potrzebny i gdzie będą bezpiecznie wysyłane jego dane.

### Blog

- [ ] Nie publikować pustej podstrony Blog.
- [ ] Uruchomić Blog dopiero po przygotowaniu co najmniej kilku wartościowych, eksperckich artykułów i planu dalszej publikacji.
- [ ] Nie tworzyć masowo stron wyłącznie pod frazy lub miasta bez unikalnej treści i rzeczywistych realizacji.

## SEO dla każdej strony

- [ ] Unikalne `<title>`, description i jeden właściwy H1.
- [ ] Poprawny canonical oraz Open Graph z absolutnymi adresami.
- [ ] Schema.org zgodne z prawdziwą i widoczną treścią danej strony.
- [ ] Logiczne linkowanie wewnętrzne; dla głębszych stron rozważyć breadcrumbs.
- [ ] Dodać `sitemap.xml`, gdy powstaną właściwe podstrony.
- [ ] Dodać własne `404.html` zwracane dla błędnych adresów.
- [ ] `robots.txt` konfigurować dopiero pod adresem głównym docelowej domeny; nie traktować `/hul/robots.txt` jako pliku dla całego hosta `guziczak.github.io`.
- [ ] Po wdrożeniu podpiąć domenę do Google Search Console i wysłać sitemapę.

## Dostępność i wydajność

- [ ] Zachować skip-link na każdej stronie.
- [ ] Zapewnić pełną obsługę nawigacji, menu i FAQ klawiaturą.
- [ ] Zachować alternatywne opisy oraz prawdziwe `width` i `height` mediów.
- [ ] Używać `srcset`, `sizes`, lazy loadingu i priorytetu dla obrazu LCP.
- [ ] Po ustabilizowaniu treści przetestować AVIF/WebP z JPEG jako fallbackiem.
- [ ] Nie uruchamiać automatycznych animacji i wideo przy `prefers-reduced-motion: reduce`.

## Mapa, prywatność i analityka

- [x] Dodać lokalny podgląd mapy salonu w DOMAR z pinezką i atrybucją OpenStreetMap.
- [x] Ładować interaktywną Mapę Google dopiero po osobnej zgodzie użytkownika.
- [x] Dodać banner oraz dostępne z klawiatury ustawienia kategorii „Analityka” i „Mapa Google”.
- [x] Zapewnić stały dostęp do zmiany i cofnięcia zgody w stopce.
- [ ] Utworzyć usługę GA4, wpisać prawdziwy identyfikator `G-…` w `script.js` i sprawdzić pomiar na domenie produkcyjnej.
- [ ] Przed uruchomieniem GA4 opublikować pełną politykę prywatności z prawdziwymi danymi administratora, podstawami przetwarzania, retencją i dostawcami.
- [ ] Po uruchomieniu GA4 zweryfikować w przeglądarce, że przed zgodą nie powstają cookies `_ga*` i nie są wysyłane żądania pomiarowe.

## Migracja i kontrola regresji

- [ ] Najpierw utworzyć podstrony, dopiero później zmienić działające linki kotwicowe na nowe adresy.
- [ ] Sprawdzić wszystkie ścieżki assetów również na podstronach zagnieżdżonych pod `/hul/`.
- [ ] Zweryfikować stronę z JavaScriptem i bez JavaScriptu.
- [ ] Przetestować szerokości co najmniej 320, 390, 768, 810, 1200, 1440 i 1920 px.
- [ ] Sprawdzić klawiaturę, focus, menu mobilne, FAQ, animacje i reduced motion.
- [ ] Sprawdzić brak 404, błędów konsoli, niedziałających linków i zasobów spoza właściwego hosta.
- [ ] Po wdrożeniu sprawdzić rzeczywiste adresy produkcyjne, canonicale, statusy HTTP i indeksowalność.
