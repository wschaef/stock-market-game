**Stock Market Game (Börsenspiel) – Complete Rules & Card Deck**

This file is the rules source for the digital game. The **Digital rules** section is authoritative for software. The card list matches the table deck.

## Digital rules (authoritative)

These replace physical-board ambiguities for the browser port.

- **Players:** 2–4, hotseat, clockwise. **Turn order is randomized** when the game starts; the first seat in that order takes the opening turn. Each seat is **human** or **AI** (Aggressive / Middle / Defensive). AI is deterministic (no LLM) and may take any legal action a human can. Setup defaults to **4 seats**: 1 human, AI Defensive, AI Aggressive, AI Middle.
- **Money:** integer dollars. Each player starts with **$1,000**. Note denominations are unused on screen.
- **Action cards:** Standard, +100, and Multiplier. Dealt to hands and mixed into the draw pile (defaults **9 per player**, capped by leftover Actions after dealing).
- **Risk cards:** Only in the draw pile mix (defaults **3 per player**). Leftover cards after dealing/pile construction are unused.
- **Pile size:** On the start menu, choose **Risk cards** and **Other cards** (Action cards in the pile). Changing player count resets both to the defaults for that seat count.
- **Finite deck:** When a card is **played** (Action from hand or Risk from the draw), it goes to the **discard pile**. It does **not** return to the draw pile.
- **Turn choice:** **Draw** or **Trade only**.
  - **Draw:** reveal the top card **to the current player**. If **Action**, add it to the hand (now 5) and **must play one** card. If **Risk**, play it immediately, then the player **may** buy and/or sell. If the draw pile is empty, Draw is not allowed (Trade only).
- **Hidden hands:** Other seats’ unplayed cards stay face-down. A drawn Action is private until played; a drawn Risk is public.
  - **Trade only:** no draw; buy and/or sell at current prices.
- **No trade after an Action play.** Trading is allowed only on a Trade-only turn or after a Risk. This is the core of the game.
- **`[?]`:** the current player selects which company gets that effect. The named company on the card is already fixed, so each pick is one of the **other** companies not yet used on that card. Standard and multiplier cards have one `[?]`. **+100** cards have three: assign **−10**, **−20**, and **−30** to the three other companies (each once).
- **Prices** are integers. After each company’s effect:
  - If **target > 250** (split): new price = **floor(target / 2)**; **each shareholder’s** shares of that company **double**. Repeat until price ≤ 250. **250** is legal (no split).
  - If **target < 10** (wipeout): all player shares of that company are **lost** (no cash); price resets to **100**. **10** is legal (no wipeout).
  - Otherwise the price becomes the target.
- Multiplier **1/2** uses integer **floor**, then the split/wipeout checks.
- Effects on a card apply **per company independently**. Risk cards that omit a company treat it as **+0**.
- **Trading:** share supply is unlimited. Cannot sell more than you hold or spend more cash than you have.
- **End:** when the draw pile is empty, the current player finishes their turn (play Action / optional trade after Risk or Trade-only). Then the game ends and score  
  `net worth = sum(shares[company] × price[company]) + cash`. Highest wins; ties allowed.

---

  


**Components**

  


- **1 Stock Market Board:** Tracks stock prices from 0 to 250 (Start value: 100).
- **4 Companies:** Commerzbank, Bayer, BMW AG, BP.
- **4 Stock Markers:** 1 per company.
- **Stock Certificates:** 40 shares per company.
- **Game Money ($):** Cash notes in $1,000, $5,000, $10,000, $50,000, $100,000 denominations.
- **63 Cards:** 15 Risk Cards, 8 Multiplier Cards, 8 +100 Cards, 32 Standard Action Cards.

**Game Rules**

  


**Objective**

The player with the highest total net worth (Cash + Stock Values) at the end of the game wins.

  


**Setup**

  


1. Set all 4 stock markers on the board to the starting value of **100**.
2. Give each player **$1,000** starting capital and **4 Action Cards** as their starting hand.
3. **Form the Draw Pile:** For each player in the game, mix **9 Action Cards** and **3 Risk Cards** together. Place this combined deck face-down in the center. (With 4 players there are only 32 Action cards left after dealing hands, so the pile takes all remaining Actions — slightly above a pure 25% Risk mix.)

**Turn Mechanics**

On your turn, choose **one** of the following three options:

  


1. **Draw an Action Card & Play:** Draw 1 card from the pile (if it is an Action Card). Choose 1 of your now 5 hand cards, play it face-up, and adjust stock prices accordingly.
2. **Draw a Risk Card (Immediate Play):** Draw 1 card from the pile. If it is a **Risk Card**, it must be **played immediately** to adjust stock prices. Afterwards, you may optionally buy or sell stocks.
3. **Trade Only:** Do not draw any card. Instead, buy stocks from the bank, sell stocks to the bank, or both at current board prices.

**Game End & Scoring**

The game ends immediately when the draw pile is completely empty.

  


$$\text{Total Net Worth} = (\text{Total Stocks} \times \text{Final Stock Price}) + \text{Cash (\$)}$$

**Card Deck List (Copy-Paste Ready)**

  


### 1. Risk Cards (15 Cards)

- **Card 1**
    

  - **Values:** Commerzbank +40 | Bayer +20 | BMW AG -20 | BP -20
  - **Text:** The domestic economy shows encouraging trends. However, the export economy suffers from exchange rate changes. Currency significantly revalued.
- **Card 2**
    

  - **Values:** Commerzbank +50 | Bayer +80 | BMW AG +20 | BP -20
  - **Text:** Inflation among trading partner countries shows clear upward trends. Threat of uncontrollable inflation compared to foreign markets.
- **Card 3**
    

  - **Values:** Commerzbank +40 | Bayer +50 | BP -90 | BMW AG -90
  - **Text:** Consequences of manifold international power crises. Events of unpredictable magnitude with completely uncertain outcomes.
- **Card 4**
    

  - **Values:** Commerzbank -50 | Bayer +20 | BP +10 | BMW AG +60
  - **Text:** The value of the $ falls against all major currencies. Export goods become slightly more expensive. Sales rise for companies in the export region.
- **Card 5**
    

  - **Values:** Commerzbank -30 | Bayer -20 | BMW AG -20 | BP -30
  - **Text:** Public sector borrowing increases sharply. Credit institutions tighten loan terms for industrial companies, making profit reinvestment harder.
- **Card 6**
    

  - **Values:** Commerzbank +40 | Bayer +60 | BMW AG +20 | BP -70
  - **Text:** Recent economic figures show no signs of recovery.
- **Card 7**
    

  - **Values:** Commerzbank +60 | Bayer +60 | BMW AG +40 | BP -20
  - **Text:** Domestic companies benefit from tax relief. Generates solid earnings and satisfying dividends.
- **Card 8**
    

  - **Values:** BP +80 | Bayer +80 | BMW AG +60 | Commerzbank -60
  - **Text:** Bayer presents a groundbreaking new development for the automotive industry to the public.
- **Card 9**
    

  - **Values:** Commerzbank +80 | BP +50 | Bayer +50 | BMW AG +50
  - **Text:** BMW announces the expansion of its location network in Europe.
- **Card 10**
    

  - **Values:** Commerzbank -10 | BP -10 | Bayer +50 | BMW AG -80
  - **Text:** During an industry crisis, double taxation on shares for an automotive company is halted.
- **Card 11**
    

  - **Values:** Commerzbank -20 | Bayer -50
  - **Text:** The value of the $ rises against all major trading partner currencies, making export goods more expensive for foreign markets.
- **Card 12**
    

  - **Values:** Commerzbank +80 | Bayer +80
  - **Text:** Commerzbank announces a capital increase with highly favorable subscription rights.
- **Card 13**
    

  - **Values:** Commerzbank -50 | Bayer -90 | BP +60 | BMW AG -60
  - **Text:** Oil-exporting countries decide on a significant price increase.
- **Card 14**
    

  - **Values:** BP +90 | Bayer +90 | BMW AG +90 | Commerzbank +90
  - **Text:** A peace treaty is finally signed in a severe military conflict.
- **Card 15**
    

  - **Values:** Commerzbank -80 | Bayer -80 | BP -80 | BMW AG -80
  - **Text:** Increasing capacity utilization with low returns. Operational changes lead to an unproductive investment period.

### 2. Multiplier Cards (8 Cards)

- **Commerzbank**
    

  - `2x Commerzbank` / `1/2 [?]`
  - `1/2 Commerzbank` / `2x [?]`
- **Bayer**
    

  - `2x Bayer` / `1/2 [?]`
  - `1/2 Bayer` / `2x [?]`
- **BMW AG**
    

  - `2x BMW AG` / `1/2 [?]`
  - `1/2 BMW AG` / `2x [?]`
- **BP**
    

  - `2x BP` / `1/2 [?]`
  - `1/2 BP` / `2x [?]`

### 3. +100 Action Cards (8 Cards)

Two identical copies per company.

- **Commerzbank** (×2)
    

  - `+100 Commerzbank` | `−10 [?]` | `−20 [?]` | `−30 [?]`
- **Bayer** (×2)
    

  - `+100 Bayer` | `−10 [?]` | `−20 [?]` | `−30 [?]`
- **BMW AG** (×2)
    

  - `+100 BMW AG` | `−10 [?]` | `−20 [?]` | `−30 [?]`
- **BP** (×2)
    

  - `+100 BP` | `−10 [?]` | `−20 [?]` | `−30 [?]`

Assign −10, −20, and −30 to the three companies that are **not** the named +100 target (each company once).

### 4. Standard Action Cards (32 Cards)

**Explicit Positive Cards (**`+`**)**

  


- **Commerzbank:**
    

  - `+30 Commerzbank` / `-60 [?]`
  - `+40 Commerzbank` / `-50 [?]`
  - `+50 Commerzbank` / `-40 [?]`
  - `+60 Commerzbank` / `-30 [?]`
- **Bayer:**
    

  - `+30 Bayer` / `-60 [?]`
  - `+40 Bayer` / `-50 [?]`
  - `+50 Bayer` / `-40 [?]`
  - `+60 Bayer` / `-30 [?]`
- **BMW AG:**
    

  - `+30 BMW AG` / `-60 [?]`
  - `+40 BMW AG` / `-50 [?]`
  - `+50 BMW AG` / `-40 [?]`
  - `+60 BMW AG` / `-30 [?]`
- **BP:**
    

  - `+30 BP` / `-60 [?]`
  - `+40 BP` / `-50 [?]`
  - `+50 BP` / `-40 [?]`
  - `+60 BP` / `-30 [?]`

**Explicit Negative Cards (**`-`**)**

  


- **Commerzbank:**
    

  - `-30 Commerzbank` / `+60 [?]`
  - `-40 Commerzbank` / `+50 [?]`
  - `-50 Commerzbank` / `+40 [?]`
  - `-60 Commerzbank` / `+30 [?]`
- **Bayer:**
    

  - `-30 Bayer` / `+60 [?]`
  - `-40 Bayer` / `+50 [?]`
  - `-50 Bayer` / `+40 [?]`
  - `-60 Bayer` / `+30 [?]`
- **BMW AG:**
    

  - `-30 BMW AG` / `+60 [?]`
  - `-40 BMW AG` / `+50 [?]`
  - `-50 BMW AG` / `+40 [?]`
  - `-60 BMW AG` / `+30 [?]`
- **BP:**
    

  - `-30 BP` / `+60 [?]`
  - `-40 BP` / `+50 [?]`
  - `-50 BP` / `+40 [?]`
  - `-60 BP` / `+30 [?]`

