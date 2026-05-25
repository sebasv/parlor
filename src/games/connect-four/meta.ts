import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'connect-four',
  title: { en: 'Connect Four', nl: 'Vier op een rij' },
  preferredOrientation: 'portrait',
  description: {
    en: 'Drop coloured discs into a 7-column grid. First to line up four in a row — horizontally, vertically, or diagonally — wins.',
    nl: 'Laat gekleurde schijven in een raster van 7 kolommen vallen. Wie als eerste vier op een rij krijgt — horizontaal, verticaal of diagonaal — wint.',
  },
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Be the first to line up four of your discs in a row — across, up-down, or diagonal.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'Player 1 is red, Player 2 is yellow.',
            'Take turns tapping a column to drop your disc in. It falls to the lowest empty slot.',
            'Build a line of four discs in any direction to win.',
            'If all 42 slots are filled with no winner, the game is a draw.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'The middle column is the most connected — controlling it gives you more ways to win.',
          ],
        },
      ],
    },
    nl: {
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Leg als eerste vier van jouw schijven op een rij — horizontaal, verticaal of diagonaal.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Speler 1 speelt rood, speler 2 speelt geel.',
            'Speel om beurten: tik op een kolom om jouw schijf te laten vallen. Die belandt op de laagste lege plek.',
            'Vier schijven op een rij in welke richting dan ook — jij wint!',
            'Zijn alle 42 plekken vol zonder winnaar? Dan is het gelijkspel.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'De middelste kolom geeft je de meeste mogelijkheden — probeer die te veroveren.',
          ],
        },
      ],
    },
  },
}

export default meta
