import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'backgammon',
  title: 'Backgammon',
  preferredOrientation: 'landscape',
  description:
    'Classic race-and-block game for two. Roll dice, move checkers, hit blots, bear off. First to clear all 15 checkers wins.',
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      title: 'Backgammon',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Move all 15 of your checkers around the board and off before your opponent does.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'The board sets itself up automatically — just start playing.',
            'Tap "Roll dice" to roll. Move your checkers the number of pips shown on each die.',
            'Tap a checker to select it, then tap its destination. Each die counts as one move.',
            'If you land alone on a point, the opponent can hit you and send you to the bar.',
            'If you have a checker on the bar, you must bring it back onto the board first.',
            'Once all your checkers are in your home area, start bearing them off the board.',
            'If you have no legal moves left, tap "No legal moves" to pass your turn.',
            'First to bear off all 15 checkers wins.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: ['Try to land on points in pairs — a lone checker can be sent to the bar.'],
        },
      ],
    },
    nl: {
      title: 'Backgammon',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Beweeg alle 15 jouw schijven om het bord en speel ze uit voordat je tegenstander dat doet.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Het bord wordt automatisch opgezet — je kunt meteen beginnen.',
            'Tik op "Gooi dobbelstenen" om te gooien. Beweeg je schijven het aantal ogen op de dobbelstenen.',
            'Tik op een schijf om hem te selecteren, tik dan op de bestemming. Elke dobbelsteen telt als één beweging.',
            'Als je alleen op een veld landt, kan de tegenstander je raken en naar de balk sturen.',
            'Als je een schijf op de balk hebt, moet je die eerst terugbrengen op het bord.',
            'Zodra al je schijven in jouw thuisgebied zijn, kun je ze uitspelen.',
            'Als je geen zetten meer kunt doen, tik je op "Geen zetten mogelijk" om te passen.',
            'Wie als eerste alle 15 schijven uitspeelt, wint.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Probeer met twee schijven op een veld te staan — een eenzame schijf kan naar de balk worden geslagen.',
          ],
        },
      ],
    },
  },
}

export default meta
