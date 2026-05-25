import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'hex',
  title: { en: 'Hex', nl: 'Hex' },
  preferredOrientation: 'landscape',
  description: {
    en: 'Claim hexes and connect your two opposite edges. 2 players on a rhombus board; 3 players on a hexagonal board. Cannot end in a draw (2-player only).',
    nl: 'Claim zeshoeken en verbind je twee tegenoverliggende randen. 2 spelers op een ruitvormig bord; 3 spelers op een zeshoekig bord. Kan niet in gelijkspel eindigen (alleen bij 2 spelers).',
  },
  minPlayers: 2,
  maxPlayers: 3,
  rules: {
    en: {
      title: 'Hex',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            '2 players: Connect your two opposite edges of the rhombus board with an unbroken chain of your own hexagons. Player 1 (red) links the top and bottom edges; Player 2 (blue) links the left and right edges.',
            '3 players: The board is a regular hexagon. Each player owns two opposite sides (shown in their colour). Be the first to connect your two sides with an unbroken chain.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'On your turn, tap any empty hexagon to claim it in your colour.',
            'Hexagons count as connected if they share a side.',
            'The first player to form a chain from one of their edges to their opposite edge wins.',
            '2 players: the game can never end in a draw. 3 players: a draw is theoretically possible but extremely rare in practice.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'The centre of the board is powerful — controlling it makes it much easier to build your chain.',
          ],
        },
      ],
    },
    nl: {
      title: 'Hex',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            '2 spelers: Verbind jouw twee tegenoverliggende randen van het ruitvormige bord met een aaneengesloten ketting van jouw zeshoekjes. Speler 1 (rood) verbindt boven en onder; speler 2 (blauw) verbindt links en rechts.',
            '3 spelers: Het bord is een regelmatige zeshoek. Elke speler bezit twee tegenoverliggende zijden (in zijn kleur). De eerste die zijn twee zijden verbindt met een aaneengesloten ketting wint.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Tik op een leeg vakje om het in jouw kleur te claimen.',
            'Vakjes zijn verbonden als ze een zijde delen.',
            'De eerste speler die een ketting vormt van de ene rand naar zijn tegenoverliggende rand wint.',
            '2 spelers: gelijkspel is onmogelijk. 3 spelers: gelijkspel is theoretisch mogelijk maar extreem zeldzaam.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Het midden van het bord is waardevol — wie het midden beheerst, bouwt veel makkelijker een ketting.',
          ],
        },
      ],
    },
  },
}

export default meta
