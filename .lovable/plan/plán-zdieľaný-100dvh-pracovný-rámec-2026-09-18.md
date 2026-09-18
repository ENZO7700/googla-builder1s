# Plán: Zdieľaný 100dvh pracovný rámec

## Rozsah
- Vytvoriť spoločný layout pre pracovné sekcie s pevnou hlavičkou, obsahom s vlastným rolovaním a voliteľnou spodnou lištou.
- Ako ďalšiu sekciu naň preniesť Generátor kódu a Analyzátor vrátane Blueprintu bez zmeny ich funkcií.
- Zachovať nulové vonkajšie medzery, plnú dostupnú výšku a viditeľné tlačidlá na počítači aj mobile.

## Technické detaily
- Komponent bude poskytovať jednotné oblasti header/content/footer a `min-h-0`/`overflow-hidden` pravidlá.
- Existujúce vnútorné formuláre zostanú samostatne rolovateľné; akcie ostanú ukotvené.
- Overiť zobrazenie a rolovanie na desktopovom aj mobilnom rozmere.
