import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'order-and-chaos',
  title: { en: 'Order and Chaos', nl: 'Orde en Chaos' },
  preferredOrientation: 'landscape',
  description: {
    en: 'On a 6x6 grid, both players may place either X or O each turn. Order wins with five-in-a-row; Chaos wins by filling the board without one.',
    nl: 'Op een 6×6 rooster mogen beide spelers elke beurt een X of een O plaatsen. Order wint met vijf op een rij; Chaos wint als het bord vol raakt zonder rij van vijf.',
  },
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Player 1 is Order and wants five matching symbols in a row. Player 2 is Chaos and wants to fill the board without that ever happening.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'Both players share the same 6x6 board.',
            'On your turn, tap an empty square, choose X or O, then tap Confirm.',
            'Either player can place either symbol — choose wisely!',
            'Order wins the moment five identical symbols appear in a row (across, down, or diagonal).',
            'Chaos wins if the board fills up completely with no five-in-a-row.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Order: try to build threats in multiple directions at once. Chaos: spread symbols to break up any lines.',
          ],
        },
      ],
    },
    nl: {
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Speler 1 is Orde en wil vijf gelijke tekens op een rij. Speler 2 is Chaos en wil het bord vol krijgen zónder dat dat lukt.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Beide spelers spelen op hetzelfde 6x6-bord.',
            'Tik in jouw beurt op een leeg vakje, kies X of O, en tik op Bevestigen.',
            'Beide spelers mogen elk teken plaatsen — kies slim!',
            'Orde wint zodra er vijf gelijke tekens op een rij staan (horizontaal, verticaal of diagonaal).',
            'Chaos wint als het bord helemaal vol is zonder vijf op een rij.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Orde: bouw dreigingen in meerdere richtingen tegelijk. Chaos: wissel tekens af om lange rijen te breken.',
          ],
        },
      ],
    },
  },
}

export default meta
