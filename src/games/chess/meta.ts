import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'chess',
  title: 'Chess',
  preferredOrientation: 'landscape',
  description: 'Classic two-player chess with legal-move highlighting. Pass and play.',
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      title: 'Chess',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            "Trap the other player's king so it cannot escape — that's checkmate, and you win.",
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'White goes first. Players take turns — pass the tablet after each move.',
            'Tap any of your pieces to see where it can move (blue dots appear).',
            'Tap a blue dot to move there. Capturing an enemy piece removes it.',
            'Each piece moves differently — tap it to find out how.',
            "If your king is in danger, you're in check. You must get out of check on your next move.",
            'When a pawn reaches the far end of the board it automatically becomes a queen.',
            'If the current player has no legal moves and is not in check, the game is a draw (stalemate).',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: ['Protect your king early and try to control the centre of the board.'],
        },
      ],
    },
    nl: {
      title: 'Schaken',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Zet de koning van de andere speler vast zodat hij nergens naartoe kan — dat is schaakmat, en jij wint.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Wit begint. Spelers wisselen om beurten — geef het tablet door na elke zet.',
            'Tik op een van jouw stukken om te zien waar het naartoe kan (blauwe stippen verschijnen).',
            'Tik op een blauwe stip om daarheen te gaan. Je slaat een vijandelijk stuk door erop te gaan staan.',
            'Elk stuk beweegt anders — tik erop om te ontdekken hoe.',
            'Als jouw koning in gevaar is, sta je in schaak. Je moet dat gevaar de volgende beurt oplossen.',
            'Als een pion het einde van het bord bereikt, wordt hij automatisch een dame.',
            'Als je geen zet kunt doen terwijl je niet in schaak staat, is het gelijkspel (pat).',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Bescherm je koning vroeg in het spel en probeer het midden van het bord te beheersen.',
          ],
        },
      ],
    },
  },
}

export default meta
