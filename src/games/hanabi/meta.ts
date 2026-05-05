import type { GameMeta } from '../../lib/game'

const meta: GameMeta = {
  id: 'hanabi',
  title: 'Hanabi',
  preferredOrientation: 'landscape',
  description:
    "Co-op fireworks card game. Play numbered cards in order across five colored suits — but you hold your hand facing outward, so you see everyone else's cards but never your own.",
  minPlayers: 2,
  maxPlayers: 5,
  rules: {
    en: {
      title: 'Hanabi',
      sections: [
        {
          heading: 'Goal',
          paragraphs: [
            'Work together to build five fireworks displays — one per colour — by playing cards 1 through 5 in order. The higher your total score, the better.',
          ],
        },
        {
          heading: 'The twist',
          paragraphs: [
            "You hold your cards facing away from you. You can see everyone else's cards, but not your own. You must rely on clues from your teammates to know what to play.",
          ],
        },
        {
          heading: 'Passing the tablet',
          paragraphs: [
            "After each turn a handoff screen appears. The active player passes the tablet to the next player, who taps Ready only when they are the only one looking. This keeps each player's hand secret.",
          ],
        },
        {
          heading: 'On your turn, do one of these',
          bullets: [
            'Play a card: choose a card from your hand and play it. If it is the next number in its colour, it goes on the fireworks pile. If not, it is discarded and you lose one fuse token.',
            'Give a clue: spend one clue token to tell another player about all their cards of one colour or one number.',
            'Discard a card: discard one card to gain back one clue token.',
          ],
        },
        {
          heading: 'Game end',
          bullets: [
            'You win if you complete all five suits (score 25).',
            'The game also ends if all three fuse tokens are spent or the deck runs out.',
            'Your score is the total of the highest card played in each colour.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Clues reveal all matching cards at once. If a teammate says "your 1s", remember every card they point to is a 1 — and use that information before discarding.',
          ],
        },
      ],
    },
    nl: {
      title: 'Hanabi',
      sections: [
        {
          heading: 'Doel',
          paragraphs: [
            'Werk samen om vijf vuurwerkshows te bouwen — één per kleur — door kaarten 1 tot en met 5 op volgorde te spelen. Hoe hoger je eindscore, hoe beter.',
          ],
        },
        {
          heading: 'De bijzonderheid',
          paragraphs: [
            'Je houdt je kaarten met de voorkant van je af, richting de andere spelers. Je ziet de kaarten van iedereen behalve die van jezelf. Je hebt aanwijzingen van je medespelers nodig om te weten wat je kunt spelen.',
          ],
        },
        {
          heading: 'Tablet doorgeven',
          paragraphs: [
            'Na elke beurt verschijnt een overdrachtscherm. De actieve speler geeft de tablet door aan de volgende speler, die pas op Klaar tikt als alleen hij of zij naar het scherm kijkt. Zo blijft ieders hand geheim.',
          ],
        },
        {
          heading: 'Kies elke beurt één actie',
          bullets: [
            'Kaart spelen: kies een kaart uit je hand. Is het het juiste volgende getal in die kleur? Dan gaat hij op de vuurwerkstapel. Zo niet, dan wordt de kaart weggegooid en verlies je een lontstok.',
            'Aanwijzing geven: geef een aanwijzingssteen uit om een andere speler te vertellen welke kaarten één bepaalde kleur of één bepaald getal hebben.',
            'Kaart weggooien: gooi een kaart weg om een aanwijzingssteen terug te krijgen.',
          ],
        },
        {
          heading: 'Einde van het spel',
          bullets: [
            'Je wint als alle vijf kleuren compleet zijn (score 25).',
            'Het spel eindigt ook als alle drie de lontstokken op zijn of de stapel leeg is.',
            'Je score is de som van de hoogste gespeelde kaart per kleur.',
          ],
        },
        {
          heading: 'Tip',
          paragraphs: [
            'Een aanwijzing geldt voor alle kaarten tegelijk. Als een medespeler zegt "jouw 1-en", zijn al die kaarten een 1 — gebruik die info voordat je iets weggooit.',
          ],
        },
      ],
    },
  },
}

export default meta
