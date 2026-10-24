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
