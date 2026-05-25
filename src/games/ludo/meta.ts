import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'ludo',
  title: { en: 'Ludo', nl: 'Ludo' },
  description: {
    en: 'Classic race game for 2–4 players. Roll a 6 to release a pawn, race around the board, and be first to bring all four pawns home.',
    nl: 'Klassiek racespel voor 2–4 spelers. Gooi een 6 om een pion vrij te krijgen, race over het bord en breng als eerste al je vier pionnen thuis.',
  },
  minPlayers: 2,
  maxPlayers: 4,
  preferredOrientation: 'landscape',
  rules: {
    en: {
      title: 'Ludo',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Be the first player to move all four of your pawns from the starting yard to the home column in the centre.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'On your turn, tap "Roll" to roll the die.',
            'Roll a 6 to release one pawn from your yard onto your start square. Rolling a 6 also gives you an extra roll.',
            'With any other number, move one of your pawns already on the board forward that many squares.',
            "If you land on an opponent's pawn, it is captured and sent back to their yard.",
            'When your pawn reaches the coloured home column, move it down towards the centre. You need the exact number to reach the final home square.',
            'Three 6s in a row forfeit your turn.',
          ],
        },
        {
          heading: 'Winning',
          paragraphs: ['The first player to get all four pawns into the home square wins.'],
        },
      ],
    },
    nl: {
      title: 'Ludo',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Breng als eerste speler al jouw vier pionnen vanuit de startput naar de thuiskolom in het midden.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Tik op "Roll" om de dobbelsteen te gooien.',
            'Gooi een 6 om een pion uit de put op jouw startvakje te zetten. Met een 6 mag je ook nog een keer gooien.',
            'Bij een ander getal beweeg je een pion die al op het bord staat dat aantal vakjes vooruit.',
            'Land je op een pion van een tegenstander? Die gaat terug naar zijn startput.',
            'Zodra jouw pion de gekleurde thuiskolom bereikt, beweeg je hem richting het midden. Je hebt het exacte getal nodig om op het laatste thuisvakje te landen.',
            'Drie keer achter elkaar een 6 gooien? Dan ben je jouw beurt kwijt.',
          ],
        },
        {
          heading: 'Winnen',
          paragraphs: ['De eerste speler die alle vier pionnen thuis heeft, wint het spel.'],
        },
      ],
    },
  },
}

export default meta
