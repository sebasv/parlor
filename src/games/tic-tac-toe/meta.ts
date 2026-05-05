import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'tic-tac-toe',
  title: 'Tic-Tac-Toe',
  description:
    'Two players take turns marking X or O on a 3x3 grid. First to get three in a row wins.',
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Get three of your marks in a row — across, down, or diagonal — before your opponent does.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'Player 1 is X, Player 2 is O.',
            'Take turns tapping any empty square to place your mark.',
            'The first player to line up three in a row wins.',
            'If all nine squares are filled and nobody has three in a row, the game is a draw.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: ['The centre square is the most powerful spot — grab it first if you can.'],
        },
      ],
    },
    nl: {
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Zet drie van jouw tekens op een rij — horizontaal, verticaal of diagonaal — voordat je tegenstander dat doet.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Speler 1 is het kruis (X), speler 2 is het rondje (O).',
            'Speel om beurten: tik op een leeg vakje om jouw teken te plaatsen.',
            'Wie als eerste drie op een rij heeft, wint.',
            'Zijn alle negen vakjes vol en heeft niemand drie op een rij? Dan is het gelijkspel.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: ['Het middelste vakje is het sterkste — pak het als je kunt.'],
        },
      ],
    },
  },
}

export default meta
