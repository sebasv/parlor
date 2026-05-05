import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'tsuro',
  title: 'Tsuro',
  description:
    'Place tiles to guide your pawn along winding paths. Fall off the board and you lose. Last pawn standing wins. 2–4 players, 10 minutes.',
  minPlayers: 2,
  maxPlayers: 4,
  rules: {
    en: {
      title: 'Tsuro',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Be the last pawn on the board. Place tiles to steer your pawn — but watch out, a bad tile can send you off the edge.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'Each turn you receive one tile. The tile shows curved paths connecting the eight edges of the square.',
            'Tap "Rotate 90°" to turn the tile the way you want.',
            'Tap "Place tile" to put it in the space directly in front of your pawn.',
            'Your pawn follows the path on the new tile and may keep moving through already-placed tiles.',
            'If your pawn reaches the edge of the board, it falls off and you are out.',
            'If two pawns end up in the same spot, both are out.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Look ahead: trace where the path leads before you place the tile. A tile that looks safe for you might also send an opponent off the board.',
          ],
        },
      ],
    },
    nl: {
      title: 'Tsuro',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Wees de laatste pion op het bord. Leg tegels om je pion te sturen — maar pas op, een verkeerde tegel kan je over de rand sturen.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Elke beurt ontvang je één tegel. Op de tegel staan gebogen paden die de acht randen van het vierkant verbinden.',
            'Tik op "Draai 90°" om de tegel te draaien zoals jij wilt.',
            'Tik op "Leg tegel" om hem neer te leggen op het vakje recht voor jouw pion.',
            'Je pion volgt het pad op de nieuwe tegel en kan doorlopen over al gelegde tegels.',
            'Komt je pion aan de rand van het bord? Dan valt hij af en ben je uitgeschakeld.',
            'Eindigen twee pionnen op dezelfde plek? Dan vallen ze allebei af.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Denk vooruit: volg het pad met je ogen voordat je de tegel legt. Een tegel die voor jou veilig lijkt, kan een tegenstander ook van het bord sturen.',
          ],
        },
      ],
    },
  },
}

export default meta
