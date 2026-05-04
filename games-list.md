Here are ten that fit the brief — calm visuals, one-tablet local play, and enough depth that "git gud" is a real thing.

**1. Dots and Boxes**
The one you just named. Versus, turn-based, 2 players. Trivial rules, deceptively deep — the long-chain / double-cross strategy is the kind of thing a 9-year-old eventually figures out and gets annoyed they didn't see sooner. Scales by grid size for difficulty.

**2. Hex**
Two players, each owning two opposite edges of a rhombus-shaped hex grid. Take turns claiming a hex; first to connect their two edges with an unbroken chain wins. Famously cannot end in a draw (provable). Visually almost nothing — just colored hexes — but tactically rich. Pie rule fixes the first-player advantage on small boards.

**3. Quoridor**
Each player has a pawn that needs to reach the opposite side of a 9×9 board. On your turn you either move one square *or* place a wall segment that blocks movement (with the constraint that you can never fully wall someone off). Spatial-strategic, very calm, plays in 5–10 min. Excellent for two players.

**4. Pipopipette / Sprouts**
Sprouts is the gem here. Start with a few dots. On your turn, draw a curve connecting two dots (or a dot to itself) without crossing any existing line, then place a new dot on that line. A dot "dies" when it has three lines touching it. Last player who can move wins. Topological, weirdly meditative, and famously hard to analyze — even mathematicians don't have it solved.

**5. Pico Park-style cooperative platformer (your own minimal version)**
Two characters on screen, each controlled by half the tablet. Levels designed so neither can finish alone — one stands on a button while the other crosses, one boosts the other up. Co-op only, no winner. The "shared experience" payload is huge: it forces communication. Build five hand-designed levels, not procedural ones.

**6. Hanabi (co-op card game)**
The whole table is trying to play numbered cards in ascending order across colored suits — but you hold your hand *facing outward*, so you can see everyone else's cards but not your own. On your turn you can play, discard, or spend a clue token to give a teammate one piece of true information about their hand. Pure co-op, pure information puzzle, no graphics needed beyond colored numbers. Well-loved among adults too. Pass the tablet so each player sees their hand only when it's their turn.

**7. Nim / Subtraction games**
A pile (or several piles) of tokens. On your turn, take 1–3 (or whatever rule). Whoever takes the last one wins (or loses, depending on variant). Sounds trivial, but multi-pile Nim has a beautiful XOR-based optimal strategy — a great "moment" when an older kid notices the pattern. Visually: literally just dots in piles. Great quick filler.

**8. Order and Chaos (or Connect-style variant)**
On a 6×6 grid, both players can place either an X or an O on any empty square. **Order** wins by getting five-in-a-row of either symbol; **Chaos** wins by filling the board without any five-in-a-row. Asymmetric goals from the same move set — kids find this fascinating because "I can place your symbol" breaks the mental model they had from tic-tac-toe.

**9. Codenames Duet (2-player co-op word association)**
A 5×5 grid of words. You and your partner each see a different "key card" showing which words are your agents, which are neutral, and which is the assassin. You alternate giving one-word clues plus a number, trying to lead each other to the right words while avoiding the assassin. Pass the tablet to switch roles each turn. Co-op, language-based, scales beautifully with kid age — younger kids play with simpler word lists. Word lists are the only "content" you need to ship.

**10. Tsuro-style path-laying**
Each player has a pawn on the edge of the board. On your turn you place a tile with curved paths in front of your pawn; your pawn then follows whatever path it lands on, possibly for several tiles. Last pawn still on the board wins (you lose by going off the edge). Calm visuals (just lines on tiles), 2-4 players, plays in 10 minutes. Works perfectly pass-and-play because the board state is fully visible to everyone.

**11. Checkers (Draughts)**
Pure pass-and-play classic. Visually minimal — 8×8 board, two colors, that's it. The mandatory-capture rule and forced multi-jumps create real "I should have seen that" moments for kids. Worth noting there are two main variants: **English/American checkers** (8×8, men only move forward, kings move one square) and **International draughts** (10×10, men can capture backwards, flying kings) — the international version is meaningfully deeper and stays interesting longer. Given you're in the Netherlands, international draughts is also the local default and probably the version your kids will encounter at school. Build that one.

**12. Chess**
The obvious deep cut. Implementation isn't trivial, though — you'll want to use an existing engine rather than writing move generation from scratch. **chess.js** for rules/move validation and **chessground** (the board UI from Lichess) are the standard combo for the web. For an opponent or hint mode, **Stockfish** compiles to WebAssembly and runs entirely in the browser — strong enough that you can dial it down to "kid-friendly" levels. Skip the AI entirely if you only want pass-and-play; rules + legal-move highlighting is enough and ships in a day. Visually clean if you pick a flat, low-contrast piece set rather than the gaudy 3D ones.

**13. Backgammon**
The interesting one of the three because it adds *dice* — meaning the strategy/luck balance keeps younger kids competitive against older ones in a way pure chess doesn't. Two pawns rolling, race-and-block dynamics, the doubling cube adds a whole second strategic layer once the kids are ready. Implementation is moderate — bearing-off rules and the bar/re-entry logic have edge cases worth testing carefully. Visually: a board, 30 checkers, two dice. Calm.

A practical note across all three: **don't build the engines yourself.** For chess use chess.js. For checkers, there are smaller libraries (or it's simple enough to write from scratch — ~200 lines for rules + move generation). For backgammon, you can write the rules yourself in an afternoon; the trickier part is a decent AI if you want one, and **gnubg** weights are public if you ever want a strong opponent (probably overkill for family play).

**14. Set**
A real-time pattern-recognition card game. Cards have four features (shape, color, number, shading), each with three values. A "set" is three cards where every feature is either all-the-same or all-different across the three. Twelve cards on the table — first player to spot a valid set claims it. Concurrent, no turns. Great for mixed ages because kids often spot sets faster than adults.

**15. Tic-Tac-Toe**
Two players alternate placing X or O on a 3×3 grid; first to get three in a row (horizontal, vertical, or diagonal) wins. Solved game — perfect play always draws — so it's mostly a teaching game for very young kids before they graduate to deeper grid games.

**16. Four in a Row (Connect Four)**
Two players drop colored discs into a 7-column, 6-row vertical grid; pieces fall to the lowest empty slot in the chosen column. First to line up four of their color in any direction wins. Also technically solved (first player wins with perfect play from the center column), but the optimal strategy isn't intuitive, so it stays genuinely fun for kids and most adults.
Spot 3-tuples of cards showing the right pattern.
