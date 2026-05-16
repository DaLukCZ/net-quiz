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
- **Tmavý režim**

> Otázky vznikly částečně pomocí AI analýzou prezentací a externích zdrojů. Nejsou dokončené a nemusí být zcela správné. Nelze zaručit shodu s oficiálními testy.

## Stažení z GitHubu

Stáhnout si tento projekt můžeš dvěma způsoby:

1. Klonuj repozitář:
   ```bash
   git clone https://github.com/DaLukCZ/net-quiz.git
   ```
2. Nebo stáhni ZIP přes tlačítko **Code → Download ZIP** na GitHubu.

Po stažení rozbal složku a otevři `net-quiz`.

## Spuštění

1. **Stáhni Python** → https://www.python.org/downloads/
   - Při instalaci zaškrtni **"Add Python to PATH"**
   - Restartuj počítač

2. **Přejdi do složky** `net-quiz` a **dvojklikem otevři `NetQuiz.bat`**

3. V prohlížeči (Chrome, Firefox, Edge) otevři: **`http://localhost:8000/net-quiz/`**

4. Hotovo! 🎉


### Stále problém?

- Ověř, že v terminálu běží server pomocí `python -m http.server 8000`.
- Vymaž cache v prohlížeči nebo otevři stránku v anonymním okně.
- Pokud nic nepomáhá, vrať se k této sekci a ověř krok za krokem.

## Soubory s otázkami

| Soubor | Předmět | Kolik otázek? |
|--------|---------|--------|
| `json/site.json` | Počítačové sítě | 702 |
| `json/weby.json` | Webové technologie | 5 |

### Chceš přidat vlastní předmět?

V aplikaci klikni na **Výběr předmětu → Nový předmět** a nahraj svůj JSON soubor.  
Nebo si stáhni šablonu přímo z aplikace.

## ❓ Problémy?

**Otevírám `http://localhost:8000`, ale nic se neukáže**
- Zkus refreshnout stránku (F5)
- Zkontroluj, že v příkazovém řádku běží server (mělo by být vidět "Serving HTTP...")
- Zkus jinou adresu: `http://127.0.0.1:8000`

**Chyba "Connection refused" nebo "Server not responding"**
- Zkontroluj, že `NetQuiz.bat` běží v pozadí (měl by být otevřený terminál)
- Zkus port 8001 místo 8000: `python -m http.server 8001`

**Python není nainstalován**
- Stáhni z https://www.python.org/downloads/
- **DŮLEŽITÉ:** Při instalaci zaškrtni "Add Python to PATH"
- Restartuj počítač
- Spusť `NetQuiz.bat` znovu

**Otázky se nenačítají**
- Zavři prohlížeč a otevři novou kartu
- Zkus Ctrl+Shift+Delete (vymazat cache)

## Podpora

Chceš-li projekt podpořit, pošli pár korun: **2081256014/3030**

## O projektu

- **Autor:** Šmachy - DaLuk
- **Verze:** 0.5
- **Poslední aktualizace:** 16.5.2026
