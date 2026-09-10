# Angielski B1-B2 - codzienna dawka

Prosta strona do codziennej nauki angielskiego na poziomie B1-B2. Działa na telefonie
(można ją dodać do ekranu głównego jak zwykłą aplikację), nie wymaga konta ani internetu
po pierwszym otwarciu. Cały postęp zapisuje się lokalnie w przeglądarce.

## Co jest w środku

Codziennie dostajesz jedną lekcję złożoną z czterech części:

1. **Nowe słowa** (domyślnie 5) - słowo, wymowa (IPA), tłumaczenie, przykładowe zdanie
   z tłumaczeniem i typowe kolokacje. Tłumaczenie jest domyślnie zasłonięte, żeby najpierw
   spróbować przypomnieć sobie znaczenie. Przycisk głośnika czyta słowo na głos.
2. **Poprawna forma wypowiedzi** - jeden wzorzec zdania (uprzejma prośba, mail, spotkanie,
   negocjacje, tryby warunkowe, pytania zależne...) z gotowymi konstrukcjami, przykładami,
   ostrzeżeniem o typowym błędzie i krótkim zadaniem do napisania. Do zadania jest
   wzorcowa odpowiedź, a Twój tekst zapisuje się automatycznie.
3. **Typowy błąd** - dwie kalki z polskiego albo false friends na dziś, z wyjaśnieniem.
4. **Quiz dnia** - kilka pytań z dzisiejszego materiału (tłumaczenie, uzupełnianie luki,
   wybór poprawnej wersji zdania). Ukończenie quizu zamyka dzień i podbija serię.

Pozostałe zakładki:

- **Powtórki** - system pudełek (spaced repetition). Nowe słowo wraca dzień po nauce,
  a potem po 2, 4, 8, 16, 32 i 60 dniach. Słowo, którego nie pamiętasz, wraca do pudełka
  pierwszego i pojawia się nazajutrz.
- **Zwroty** - wszystkie wzorce wypowiedzi z filtrowaniem po kategorii, do przejrzenia
  przed rozmową albo przed napisaniem maila.
- **Błędy** - pełna lista typowych błędów Polaków plus ćwiczenie "wybierz poprawną wersję".
- **Postęp** - seria dni, liczba poznanych słów, rozkład powtórek, wyszukiwarka Twoich słów,
  liczba słów dziennie, kopia zapasowa postępu (JSON) i czyszczenie danych.

Baza zawiera 200 słów i zwrotów, 39 wzorców wypowiedzi i 59 typowych błędów. Przy pięciu
słowach dziennie to około 40 dni nauki bez powtarzania materiału.

## Jak otworzyć na telefonie

Najprościej przez GitHub Pages:

1. W repozytorium wejdź w **Settings → Pages**.
2. W sekcji *Build and deployment* wybierz **Source: Deploy from a branch**.
3. Jako gałąź wskaż tę, na której są te pliki (np. `claude/english-learning-page-83ki8u`
   albo `main` po scaleniu), katalog `/ (root)`, i zapisz.
4. Po chwili GitHub poda adres w postaci `https://<nazwa-uzytkownika>.github.io/Kurs-angielskiego/`.
   Otwórz go w telefonie.

Dodanie do ekranu głównego:

- **Android (Chrome)**: menu ⋮ → *Dodaj do ekranu głównego*.
- **iPhone (Safari)**: przycisk *Udostępnij* → *Do ekranu początkowego*.

Po dodaniu strona otwiera się na pełnym ekranie i działa offline.

## Uruchomienie lokalnie

```bash
python3 -m http.server 8000
# potem otwórz http://localhost:8000
```

Serwer jest potrzebny tylko po to, żeby zadziałał tryb offline (service worker);
sam plik `index.html` otwarty z dysku również działa.

## Jak dodać własne słowa

Wszystkie treści siedzą w trzech plikach z danymi i nie wymagają żadnego budowania:

- `js/data/words.js` - słownictwo,
- `js/data/patterns.js` - wzorce wypowiedzi,
- `js/data/mistakes.js` - typowe błędy.

Nowe słowo to jeden wpis na końcu tablicy:

```js
{w:"to ramp up", ipa:"/ræmp ʌp/", pos:"v", tag:"biznes", pl:"zwiększać (produkcję)",
 ex:"We are ramping up production before Christmas.",
 exPl:"Zwiększamy produkcję przed świętami.",
 coll:"ramp up production · ramp up capacity"}
```

Po zmianie liczby słów aplikacja przetasuje kolejność od nowa (poznane słowa i powtórki
zostają). Jeśli edytujesz pliki, podnieś numer wersji w `sw.js` (`CACHE`), żeby telefon
pobrał świeżą paczkę zamiast wersji z pamięci.

## Struktura

```
index.html                 szkielet strony i dolna nawigacja
css/style.css              styl (tryb jasny i ciemny, układ pod telefon)
js/app.js                  logika: lekcja dnia, quiz, powtórki, postęp
js/data/words.js           200 słów i zwrotów B1-B2
js/data/patterns.js        39 wzorców poprawnej wypowiedzi
js/data/mistakes.js        59 typowych błędów Polaków
manifest.webmanifest       dane aplikacji (nazwa, ikony, kolory)
sw.js                      service worker - tryb offline
icons/                     ikony aplikacji
```

## Prywatność

Nie ma serwera, kont ani analityki. Postęp (seria, powtórki, Twoje odpowiedzi na zadania)
jest zapisany wyłącznie w `localStorage` tej jednej przeglądarki. Wyczyszczenie danych
strony usuwa postęp - warto wcześniej zrobić kopię zapasową z zakładki *Postęp*.
