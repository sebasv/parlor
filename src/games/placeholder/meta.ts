import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'placeholder',
  title: 'Placeholder',
  description: 'Hello-world game used to verify the shell wiring.',
  minPlayers: 1,
  maxPlayers: 8,
  rules: {
    en: {
      title: 'Placeholder',
      sections: [
        {
          heading: 'Goal',
          paragraphs: ['This is a sample rules screen. Real games replace it with their own.'],
        },
        {
          heading: 'How to play',
          bullets: [
            'Tap "Start game" to enter the game.',
            'Tap "Back to picker" inside the game to exit.',
          ],
        },
      ],
    },
    nl: {
      title: 'Placeholder',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Dit is een voorbeeld-uitlegscherm. Echte spellen vervangen dit door hun eigen tekst.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Tik op "Start spel" om te beginnen.',
            'Tik op "Back to picker" in het spel om terug te gaan.',
          ],
        },
      ],
    },
  },
}

export default meta
