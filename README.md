# Guess the Country

A personal, endless "guess the country" game for the browser and Android. Each round gives you one clue about a country and you work out the rest, then rank it against four other countries.

No accounts, no backend, no ads. Everything runs offline and your scores stay on your device.

## How a round works

1. You get one clue: the **name**, the **flag** or the **capital** of a random country.
2. You answer the remaining parts:
   - **Name** (typed, with autocomplete) and **capital** (searchable dropdown)
   - **Flag** (pick from about 24 flags, mostly from the same region so you cannot guess by elimination)
   - **Continent**
   - **Population**, **GDP per capita** and **land area**: four other countries are shown in order, and you drag your country into the right slot
3. Click **Check answers**. Right answers go green, wrong ones red, and the correct order is revealed.
4. A **Fun facts** panel opens for the country with 5 facts (history, geography, culture, modern times, and an India connection or a "did you know?"). Use the arrows to read them all.

Each correct part is 1 point (6 per question).

## Game modes

- **Daily challenge**: one question a day, the same country for everyone on a given date, new one at midnight (device time). Tracks your streak: play on consecutive days to grow it, miss a day and it resets.
- **Classic**: choose 10, 20 or 30 questions, finish with a score, and enter 3-letter arcade-style initials for the leaderboard.
- **Leaderboards** for 10, 20 and 30 questions, plus a daily tab with streaks.
- **Stats**: accuracy by question type and region, easiest and hardest countries, score trend and history, filterable by player.
- **Settings**: sound effects, mellow generated background music, which clues can start a round, and JSON export/import of your data.

## Play it

Needs only Python (or any static file server).

```bash
python -m http.server 8123
```

Then open <http://localhost:8123>. On Windows you can double-click `play.bat`.

### Android APK

Grab `GuessTheCountry.apk` from the [latest release](../../releases/latest), copy it to your phone and open it (allow "Install unknown apps" if asked).

To build it yourself you need JDK 21 and the Android SDK (platform 35 and build-tools 35.0.0), then:

```bash
cd android-app
npm install
build-apk.bat   # Windows; adjust JAVA_HOME inside if your JDK lives elsewhere
```

The app is the same web game wrapped with [Capacitor](https://capacitorjs.com/).

## Data

197 countries: the UN member and observer states plus Taiwan, Palestine, Kosovo and Hong Kong. Vatican City is left out because its numbers do not suit ranking questions.

| What | Source |
| --- | --- |
| Names, capitals, regions | [mledoze/countries](https://github.com/mledoze/countries) |
| Population, land area, GDP per capita (latest available year) | [World Bank Open Data](https://data.worldbank.org/) |
| Flags | [flagcdn.com](https://flagcdn.com/) |

A few values the World Bank lacks (for example Taiwan and North Korea) were filled in by hand and are approximate. Regenerate the data and flags with:

```bash
python tools/build_data.py
```

Transcontinental countries (Russia, Türkiye, Kazakhstan, Egypt, Georgia, Armenia, Azerbaijan, Cyprus) accept either of their continents.

### About the fun facts

The 985 facts in `data/facts*.js` were written by an AI assistant from memory and reviewed for obvious errors, but **they were not checked against sources**. Treat them as trivia, not as references, and open an issue or edit the file if you spot a mistake. The format is one line per fact: `['h', "text"]` where the letter is the type (`h` history, `g` geography, `c` culture, `m` modern times, `i` India connection, `x` did you know).

## Project layout

```
index.html        single-page app shell
css/              theme and layout (mobile friendly)
js/game.js        round generation, ranking picks, daily seed
js/ui.js          screens, drag and drop, dialogs
js/storage.js     localStorage: scores, settings, daily streak
js/stats.js       leaderboard and stats maths
js/audio.js       sound effects and generated music (Web Audio)
data/             countries.js and facts1-6.js
flags/, fonts/    bundled assets so the game works offline
tools/            build_data.py
android-app/      Capacitor project that produces the APK
```

## Licence

Code is released under the [MIT licence](LICENSE). Data and flags come from the sources above and keep their own licences (World Bank data is CC BY 4.0, mledoze/countries is ODbL).
