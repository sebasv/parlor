import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'checkers',
  title: 'Checkers',
  description:
    'International Draughts (10×10): flying kings, mandatory captures, and men that capture in both directions. The Dutch standard.',
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      title: 'Checkers (International Draughts)',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            "Capture all of your opponent's pieces, or leave them with no legal move. This is International Draughts on a 10×10 board — the standard used in the Netherlands.",
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'Each player starts with 20 pieces on the dark squares. Light moves first.',
            'Men move one square diagonally forward, but capture diagonally in either direction — forward or backward.',
            'If you can capture, you must. If multiple captures are possible, you must take the one that captures the most pieces.',
            "Capturing jumps over the opponent's piece to an empty square behind it. Chain captures continue in one turn.",
            'Reach the far back row to promote your man to a king (dam). Kings slide any number of squares diagonally and capture from a distance.',
            'You lose if all your pieces are captured or you have no moves left.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Protect your back row as long as you can — as long as your opponent cannot promote, your kings stay safe.',
          ],
        },
      ],
    },
    nl: {
      title: 'Dammen (Internationaal Dammen)',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Sla alle stukken van je tegenstander, of zorg dat hij geen zet meer kan doen. Dit is Internationaal Dammen op een bord van 10×10 vakjes.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Elke speler begint met 20 schijven op de donkere vakjes. Wit begint.',
            'Gewone schijven bewegen één vakje diagonaal naar voren, maar slaan in beide richtingen — ook naar achteren.',
            'Als je kunt slaan, moet je slaan. Als er meerdere mogelijkheden zijn, moet je de reeks kiezen waarbij je de meeste schijven slaat.',
            'Slaan doe je door over de schijf van je tegenstander te springen naar een leeg vakje erachter. Je mag daarna direct doorslaan als het kan.',
            'Bereik de achterste rij van je tegenstander om een dam te worden. Een dam mag zo ver diagonaal schuiven als hij wil en slaat ook van afstand.',
            'Je verliest als al je schijven geslagen zijn of als je geen enkele zet meer kunt doen.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Houd je achterste rij zo lang mogelijk bezet — zolang je tegenstander niet kan dammen, staan jouw dammen veilig.',
          ],
        },
      ],
    },
  },
}

export default meta
