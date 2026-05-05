import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'set',
  title: 'Set',
  description:
    'Real-time pattern recognition. Spot three cards where every feature is all-same or all-different. First to claim a valid set earns a point.',
  minPlayers: 2,
  maxPlayers: 6,
  rules: {
    en: {
      title: 'Set',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Find a "set" of 3 cards before the other players. Score the most points to win.',
          ],
        },
        {
          heading: 'What is a set?',
          paragraphs: [
            'Three cards form a set when, for every feature (shape, colour, number, shading), all three cards are either all the same or all different. There are no exceptions.',
          ],
          bullets: [
            'Shape: circle, square, or triangle.',
            'Colour: red, green, or purple.',
            'Number: 1, 2, or 3 symbols.',
            'Shading: solid, striped, or open.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'Twelve cards are shown face-up.',
            'Everyone looks at the same cards at the same time — no turns.',
            'When you spot a set, tap your claim button.',
            'You have 10 seconds to tap exactly 3 cards, then tap Confirm.',
            'Correct set: +1 point and those cards are replaced.',
            'Wrong set: −1 point. The cards stay and everyone keeps looking.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Start by checking one feature at a time. If all three cards have different colours, check whether the other features are also all-same or all-different.',
          ],
        },
      ],
    },
    nl: {
      title: 'Set',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Vind een "set" van 3 kaarten eerder dan de andere spelers. Wie de meeste punten scoort, wint.',
          ],
        },
        {
          heading: 'Wat is een set?',
          paragraphs: [
            'Drie kaarten vormen een set als voor elke eigenschap (vorm, kleur, aantal, arcering) geldt: alle drie hetzelfde of alle drie verschillend.',
          ],
          bullets: [
            'Vorm: cirkel, vierkant of driehoek.',
            'Kleur: rood, groen of paars.',
            'Aantal: 1, 2 of 3 symbolen.',
            'Arcering: gevuld, gestreept of leeg.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Twaalf kaarten liggen zichtbaar op tafel.',
            'Iedereen kijkt tegelijk naar dezelfde kaarten — er zijn geen beurten.',
            'Zie je een set? Tik dan op jouw claimknop.',
            'Je hebt 10 seconden om precies 3 kaarten aan te tikken en op Bevestig te drukken.',
            'Goede set: +1 punt, de kaarten worden vervangen.',
            'Foute set: −1 punt. De kaarten blijven liggen.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Begin met één eigenschap tegelijk. Als drie kaarten allemaal een andere kleur hebben, controleer dan of de andere eigenschappen ook kloppen.',
          ],
        },
      ],
    },
  },
}

export default meta
