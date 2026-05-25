import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'sprouts',
  title: { en: 'Sprouts', nl: 'Sprouts' },
  preferredOrientation: 'landscape',
  description: {
    en: 'Start with dots, draw curves connecting them, and place a new dot on each curve. A dot dies when it has 3 connections. Last player to move wins. Topological and meditative.',
    nl: 'Begin met stippen, teken curves die ze verbinden en zet een nieuwe stip op elke curve. Een stip sterft bij 3 verbindingen. Wie als laatste nog een zet kan doen, wint. Topologisch en meditatief.',
  },
  minPlayers: 2,
  maxPlayers: 2,
  rules: {
    en: {
      title: 'Sprouts',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Be the last player who can draw a valid line. The player who cannot move loses.',
          ],
        },
        {
          heading: 'How to play',
          bullets: [
            'The board starts with 3 dots.',
            'On your turn, draw a curve from one dot to another (or back to the same dot).',
            'The curve must not cross any existing line.',
            'A new dot is placed automatically at the middle of your curve.',
            'A dot is dead and cannot be used once it has 3 connections. Dead dots are shown in red.',
            'If you truly cannot draw any valid curve, tap "I can\'t move" — you lose and your opponent wins.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'The new dot in the middle of each curve starts with 2 connections already, so it only has room for 1 more. Keep this in mind when planning.',
          ],
        },
      ],
    },
    nl: {
      title: 'Sprouts',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Wees de laatste speler die een geldige lijn kan trekken. Wie geen zet meer kan doen, verliest.',
          ],
        },
        {
          heading: 'Spelen',
          bullets: [
            'Het bord begint met 3 punten.',
            'Teken in jouw beurt een lijn van het ene punt naar het andere (of terug naar hetzelfde punt).',
            'De lijn mag geen bestaande lijn kruisen.',
            'Er verschijnt automatisch een nieuw punt in het midden van jouw lijn.',
            'Een punt is dood als het 3 verbindingen heeft en kan dan niet meer gebruikt worden. Dode punten zijn rood.',
            'Als je echt geen geldige lijn meer kunt trekken, tik dan op "Ik kan niet meer" — je verliest en de ander wint.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Het nieuwe punt in het midden van een lijn heeft al 2 verbindingen, dus er is nog maar ruimte voor 1. Houd dat in de gaten bij het plannen.',
          ],
        },
      ],
    },
  },
}

export default meta
