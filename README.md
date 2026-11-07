# Kde jsem přistál / Where I've landed

Interaktivní mapa letišť a SLZ ploch v ČR s odškrtáváním, kde jsem přistál.

## Nasazení na GitHub Pages
1. Vytvoř repozitář (např. `Landings`) a nahraj sem všechny soubory z této složky.
2. Settings → Pages → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)`.
3. Aplikace poběží na `https://<user>.github.io/Landings/`.

## Na telefon
iPhone: Safari → Sdílet → Přidat na plochu. Android: Chrome → menu → Přidat na plochu / Instalovat.

Data: seznam letišť a ploch SLZ z VFR příručky ŘLP ČR (aim.rlp.cz, WEF 03 SEP 2026), souřadnice OurAirports (CC0). Aktualizace: porovnat seznam s aktuální VFR příručkou po každém AIRAC cyklu. ## Synchronizace mezi zařízeními
Záznamy se ukládají do `data/landings.json` v tomto repozitáři. Na každém zařízení jednou klepni na **GitHub sync** a vlož fine-grained token (jen tento repozitář, Contents: Read and write). Bez tokenu aplikace data jen zobrazí (čtení), změny zůstanou v zařízení. Synchronizace proběhne při otevření, po každé změně a po návratu do aplikace; ručně tlačítkem ⟳.

## Země
Tlačítko „🌍 Země“ na mapě otevře výběr zemí. Výchozí je domovská země (domeček ⌂ v panelu), poprvé se odhadne z jazyka prohlížeče; když nejde, zobrazí se Česko a nenásilný proužek nabídne výběr. Letiště jsou po zemích v `data/countries/XX.json` (seznam a počty v `data/countries/index.json`) a stahují se až po výběru země. Česká letiště (`CZ.json`) jsou ručně vedený seznam podle VFR příručky, ostatní z databáze OurAirports (public domain, https://ourairports.com/data/) a u malých ploch můžou být neúplná. Výběr zemí si pamatuje každé zařízení zvlášť; přistání, fotky a značky se synchronizují vždy.

## Dráhy a frekvence + měsíční aktualizace
V okně letiště je sekce „Dráhy a frekvence“ (jen informativní) ze souboru dané země (u Česka `data/countries/CZ.json`).
Soubory v `data/countries/` vytváří `node tools/update-airports.mjs` z dat OurAirports. Když stažení selže, vrátí prázdná data nebo některé zemi ubude víc než 20 % letišť či údajů, skript skončí chybou a nic nezapíše.
GitHub Action `.github/workflows/update-airports.yml` ho spouští automaticky 2. den v měsíci a změny sám commitne; ručně: Actions → Update airfield data → Run workflow.

