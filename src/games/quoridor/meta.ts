import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'quoridor',
  title: 'Quoridor',
  description:
    'Race your pawn to the opposite side of a 9×9 board. Each turn: move one square or place a wall to block your opponent — but you can never fully wall someone off. Spatial and strategic, 5–10 min, two players.',
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      title: 'Quoridor',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Be the first to move your pawn to any square on the opposite side of the 9×9 board.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'On your turn, either move your pawn or place a wall — not both.',
            'Moving: tap any highlighted square next to your pawn (up, down, left, or right) to move there.',
            'Jumping: if your opponent is directly next to you and the square behind them is open, you can jump straight over them.',
            'Placing a wall: switch to wall mode, then tap a gap between cells. Each wall spans two cells and blocks movement across it. You start with 10 walls.',
            'You can never place a wall that cuts off all paths to the goal for either player.',
            'The first pawn to reach the far row wins.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            "Save a few walls for the endgame — a well-placed wall near your opponent's goal can cost them several turns.",
          ],
        },
      ],
    },
    nl: {
      title: 'Quoridor',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Wees de eerste die zijn pion naar een vakje aan de overkant van het 9×9-bord verplaatst.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Kies elke beurt: beweeg je pion of plaats een muur — niet allebei.',
            'Bewegen: tik op een gemarkeerd vakje naast je pion (omhoog, omlaag, links of rechts).',
            'Springen: staat je tegenstander direct naast jou en is het vakje achter hem vrij? Dan mag je er recht overheen springen.',
            'Muur plaatsen: schakel naar murmodus en tik op een spleet tussen vakjes. Een muur beslaat twee vakjes en blokkeert beweging erover. Je begint met 10 muren.',
            'Je mag nooit een muur plaatsen die alle routes naar het doel afsluit voor een van de spelers.',
            'De pion die als eerste de overkant bereikt, wint.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Bewaar een paar muren voor het einde — een muur vlak voor het doel van je tegenstander kan hem meerdere beurten kosten.',
          ],
        },
      ],
    },
  },
}

export default meta
