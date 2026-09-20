# Plán: Zjednotenie zostávajúcich pracovných sekcií

## Rozsah
- Presunúť Integrácie, hlavný Chat/Workspace a Live Sandbox pod spoločný systém plnej výšky.
- Zachovať existujúce funkcie, dialógy, chatové ovládanie, ZIP editor aj maximalizovaný náhľad.
- Zjednotiť pevné hlavičky, samostatne rolovateľný obsah a ukotvené spodné akcie bez vonkajších medzier.
- Ponechať bočný panel, systémový monitor a Nastavenia ako podporné panely, ale zabezpečiť ich plnú výšku a vlastné rolovanie.

## Technické detaily
- Použiť `WorkspaceLayout` aj pre Integrácie a hlavný Chat; Live Sandbox napojiť na rovnakú štruktúru hlavičky/obsahu vrátane fullscreen režimu.
- Akcie, ktoré majú zostať stále dostupné, presunúť do hlavičky alebo pevnej spodnej oblasti; obsah bude mať `min-h-0` a vlastné `overflow` pravidlá.
- Zachovať všetky existujúce callbacky, stavy, navigáciu a spracovanie súborov bez zmeny logiky.
- Overiť desktop 1280×900 a mobil 420×786: výšku, rolovanie, klávesové ovládanie a viditeľnosť akcií.
