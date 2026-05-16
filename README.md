# NetQuiz

Kvízové rozhraní v prohlížeči pro opakování látky z vysoké školy. Aktuálně pokrývá počítačové sítě, připraveno na rozšíření o další předměty.

## Funkce

- **Kvíz** — náhodný výběr otázek s nastavením obtížnosti, kategorie a počtu
- **Procházení** — otázky seřazené po kategoriích, styl autoškoly, volná navigace
- **Adaptivní učení** — SRS algoritmus zaměřený na slabá místa
- **Záložky** — hvězdičkování otázek, kvíz jen ze záložkovaných
- **Více předmětů** — přepínání mezi předměty, podpora vlastních JSON souborů
- **Studijní materiály** — prohlížeč PDF přímo v aplikaci, nahrání vlastního PDF
- **Statistiky** — přehled pokroku, kategorie, historická skóre
- **Editor otázek** — přidávání a úprava otázek přímo v aplikaci
- **Klávesové zkratky** — 1–4 výběr, Enter potvrdit, B hvězdička, ←/→ navigace
- **Tmavý režim**

> Otázky vznikly částečně pomocí AI analýzou prezentací a externích zdrojů. Nejsou dokončené a nemusí být zcela správné. Nelze zaručit shodu s oficiálními testy.

## Spuštění

```bash
python -m http.server 8000
```

Pak otevři `http://localhost:8000`.

> `index.html` neotvírej přes `file://` — prohlížeč zablokuje načítání JSON souborů.

## Soubory s otázkami

| Soubor | Předmět | Otázek |
|--------|---------|--------|
| `site.json` | Počítačové sítě | 702 |
| `weby.json` | Webové technologie | 5 |

Vlastní předmět lze přidat přes **Výběr předmětu → Nový předmět** (nahrání JSON nebo stažení šablony).

## Podpora

Chceš-li projekt podpořit, pošli pár korun: `2081256014/3030`

## O projektu

- **Autor:** Šmachy - DaLuk
- **Verze:** 0.4
- **Poslední aktualizace:** 16.5.2026
