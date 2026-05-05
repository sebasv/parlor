import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'hex',
  title: 'Hex',
  description:
    'Two players claim hexes on an 11×11 rhombus grid. First to connect your two opposite edges wins. Cannot end in a draw.',
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      title: 'Hex',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Connect your two edges of the board with an unbroken chain of your own hexagons. Player 1 (red) links the top and bottom edges. Player 2 (blue) links the left and right edges.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'The board is an 11×11 grid of hexagons. Each player owns one pair of opposite edges, shown in their color.',
            'On your turn, tap any empty hexagon to claim it in your color.',
            'Hexagons count as connected if they share a side.',
            'The first player to form a chain from one of their edges to the other wins.',
            'The game can never end in a draw.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'The center of the board is powerful — controlling it makes it much easier to build your chain.',
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
            'Verbind jouw twee randen van het bord met een aaneengesloten ketting van jouw zeshoekjes. Speler 1 (rood) verbindt boven en onder. Speler 2 (blauw) verbindt links en rechts.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Het bord heeft 11×11 zeshoekige vakjes. Elke speler bezit één paar tegenoverliggende randen, aangeduid in zijn kleur.',
            'Tik op een leeg vakje om het in jouw kleur te claimen.',
            'Vakjes zijn verbonden als ze een zijde delen.',
            'De eerste speler die een ketting vormt van de ene rand naar de andere wint.',
            'Het spel kan nooit eindigen in een gelijkspel.',
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
