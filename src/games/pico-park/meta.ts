import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'pico-park',
  title: 'Two Together',
  preferredOrientation: 'landscape',
  description:
    'Co-op platformer for two. Neither player can finish alone — work together to open doors and boost each other up.',
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      title: 'Two Together',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Both players must reach the goal tile together. You cannot finish the level alone.',
          ],
        },
        {
          heading: 'Controls',
          bullets: [
            'Player 1 uses the LEFT half of the screen: left arrow, right arrow, and jump.',
            'Player 2 uses the RIGHT half of the screen: same layout.',
            'Both players can move at the same time — no need to take turns.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'Pressure plate + door: one player stands on the plate to open a door so the other can pass through.',
            "Stand on partner's head: jump onto your partner's head to reach higher platforms.",
            'There are 3 levels. Each one introduces a new challenge that needs both of you.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Talk to each other — tell your partner what you see and what you need them to do.',
          ],
        },
      ],
    },
    nl: {
      title: 'Two Together',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Beide spelers moeten samen de doel-tegel bereiken. Je kunt het level niet alleen uitspelen.',
          ],
        },
        {
          heading: 'Besturing',
          bullets: [
            'Speler 1 gebruikt de LINKER helft van het scherm: pijl links, pijl rechts en springen.',
            'Speler 2 gebruikt de RECHTER helft van het scherm: zelfde indeling.',
            'Beide spelers kunnen tegelijk bewegen — je hoeft niet om beurten te spelen.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Drukplaat en deur: één speler staat op de drukplaat om een deur te openen zodat de ander erdoor kan.',
            'Op het hoofd klimmen: spring op het hoofd van je partner om hogere platforms te bereiken.',
            'Er zijn 3 levels. Elk level heeft een nieuwe uitdaging waarvoor jullie samenwerken.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: ['Praat met elkaar — vertel je partner wat je ziet en wat je nodig hebt.'],
        },
      ],
    },
  },
}

export default meta
