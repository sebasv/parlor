import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'dots-and-boxes',
  title: 'Dots and Boxes',
  description:
    'Draw lines between dots to claim boxes. Claim the 4th side of a box and take another turn. Most boxes wins. Deceptively deep — the chain strategy will sneak up on you.',
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      title: 'Dots and Boxes',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Claim more boxes than your opponent. The player with the most boxes when the grid is full wins.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'On your turn, tap any gap between two dots to draw a line there.',
            'If your line completes all four sides of a box, you claim it and get another turn straight away.',
            'You can claim several boxes in one turn if your line closes multiple boxes.',
            'The game ends when every line has been drawn.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Try not to draw the third side of a box — that hands your opponent an easy claim.',
          ],
        },
      ],
    },
    nl: {
      title: 'Stippen en Vakjes',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Veroveer meer vakjes dan je tegenstander. Wie de meeste vakjes heeft als het raster vol is, wint.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Tik op een ruimte tussen twee stippen om daar een lijn te tekenen.',
            'Sluit jij de vierde kant van een vakje? Dan claim jij het en mag je meteen nog een beurt spelen.',
            'Je kunt meerdere vakjes in één beurt veroveren als jouw lijn er meer dan één afsluit.',
            'Het spel eindigt zodra alle lijnen getekend zijn.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Teken niet zomaar de derde lijn van een vakje — dan geef je je tegenstander een makkelijk cadeautje.',
          ],
        },
      ],
    },
  },
}

export default meta
