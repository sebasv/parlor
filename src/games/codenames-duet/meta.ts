import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'codenames-duet',
  title: 'Codenames Duet',
  preferredOrientation: 'landscape',
  description:
    'Co-op word game. Two players share a 5x5 grid but each hold a secret key card showing which words are agents, neutral, or dangerous. Take turns giving one-word clues to help your partner find the right words — without hitting the assassin.',
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      title: 'Codenames Duet',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Work together to find all the secret agents on the 5x5 word grid — in 9 turns or fewer.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'Each player secretly sees which words are agents (green), neutral, or assassins — your key cards are different.',
            'The spymaster gives a one-word clue and a number: "Ocean, 2" means two words relate to "Ocean".',
            'Tap "Done — pass to partner" and hand the tablet over.',
            'The guesser taps words they think match the clue. Each tap reveals its colour.',
            'Tapping a neutral word ends your guessing immediately. Tapping an assassin loses the game right away.',
            'After guessing, roles swap and the other player becomes spymaster.',
            'Find all agents before the 9 turns run out to win.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Keep your clues clear — your partner cannot see your key card, so be specific.',
          ],
        },
      ],
    },
    nl: {
      title: 'Codenames Duet',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Werk samen om alle geheime agenten op het 5x5 woordenraster te vinden — in 9 beurten of minder.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Elke speler ziet in het geheim welke woorden agenten (groen), neutraal of moordenaars zijn — jullie kaarten zijn verschillend.',
            'De spionbaas geeft een tip van één woord en een getal: "Zee, 2" betekent dat twee woorden bij "Zee" horen.',
            'Tik op "Klaar — geef door aan partner" en geef het tablet door.',
            'De rader tikt woorden aan die bij de tip passen. Elke tik laat de kleur zien.',
            'Een neutraal woord aantippen stopt het raden meteen. Een moordenaar aantippen betekent direct verliezen.',
            'Na het raden wisselen de rollen en wordt de andere speler spionbaas.',
            'Vind alle agenten voordat de 9 beurten op zijn om te winnen.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Geef duidelijke tips — jouw partner ziet jouw kaart niet, dus wees zo specifiek mogelijk.',
          ],
        },
      ],
    },
  },
}

export default meta
