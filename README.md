# stock-market-game

Prototype of a game to learn the stock market (Börsenspiel hotseat).

Rules: [docs/game-rules.md](docs/game-rules.md) (digital rulings are authoritative).

## Play it locally

```bash
npm install
npm test
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

## Play it on the web (GitHub Pages)

The first deploy **fails until Pages is enabled**. That is a repo setting, not a code bug.

1. Open [Settings → Pages](https://github.com/wschaef/stock-market-game/settings/pages)
2. **Build and deployment → Source** → **GitHub Actions**
3. Actions → **Deploy GitHub Pages** → **Run workflow** (or re-run the failed job)

The site URL is then: https://wschaef.github.io/stock-market-game/
