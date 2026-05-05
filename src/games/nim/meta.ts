import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'nim',
  title: 'Nim',
  preferredOrientation: 'landscape',
  description:
    'Three piles of tokens. On your turn, take any number from one pile. Take the last token to win. The XOR strategy is hiding in plain sight.',
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      sections: [
        {
          heading: 'Goal',
          paragraphs: ['Take the very last token from the table to win.'],
        },
        {
          heading: 'How to play',
          bullets: [
            'There are three piles with 3, 5, and 7 tokens.',
            'On your turn, tap tokens in one pile to mark how many you want. Then tap Take.',
            'You must take at least one token, but you can take as many as you like — from one pile only.',
            'The player who takes the last token wins.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Try to leave your opponent in a position where every pile has the same number of tokens.',
          ],
        },
      ],
    },
    nl: {
      sections: [
        {
          heading: 'Doel',
          paragraphs: ['Pak als laatste het allerlaatste speelstuk van tafel om te winnen.'],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Er zijn drie stapels met 3, 5 en 7 stukken.',
            'Tik in jouw beurt op stukken in één stapel om aan te geven hoeveel je pakt. Tik daarna op Nemen.',
            'Je moet minimaal één stuk pakken, maar je mag er zoveel nemen als je wilt — alleen uit één stapel.',
            'Wie het laatste stuk pakt, wint.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Probeer je tegenstander op te zadelen met stapels die allemaal even groot zijn.',
          ],
        },
      ],
    },
  },
}

export default meta
