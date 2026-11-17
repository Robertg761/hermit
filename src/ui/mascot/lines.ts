/** Shellby's lines, by event. One is picked at random so repeat plays feel alive. */
export type ShellbyEvent =
  | 'welcome'
  | 'error'
  | 'solved'
  | 'solvedClean'
  | 'lessonComplete'
  | 'outOfHearts'
  | 'protected'
  | 'hint'
  | 'streakLost'
  | 'hatTrick'
  | 'combo';

export const shellbyLines: Record<ShellbyEvent, readonly string[]> = {
  welcome: [
    "Oh. A visitor. Fine. Let's learn some terminal.",
    "Welcome to my shell. Mind the hermit.",
    "I've been waiting in here for hours. Type something.",
    "Ready when you are. I'm not going anywhere. Literally.",
  ],
  error: [
    "That didn't work. I felt it in my shell.",
    'Close. Well, not really. Try again.',
    "The terminal said no. I'd listen to it.",
    'Read the red text. It is trying to help you.',
    'Bold move. Wrong, but bold.',
  ],
  solved: [
    "Correct. Don't let it go to your head.",
    "Nice. I'll allow it.",
    'Yes! Okay, I am calm. I am a calm crab.',
    "That's the one.",
  ],
  solvedClean: [
    'First try? Who taught you that?',
    "Flawless. I'm almost proud.",
    'No hints, no mistakes. Show-off.',
    "Clean. Like a freshly vacated shell.",
  ],
  lessonComplete: [
    'Not bad. My shell is slightly less ashamed of you.',
    'Lesson done. Go stretch your claws.',
    'You did it. I knew you would. I mostly knew.',
    "That's a whole lesson. Look at you, terminal person.",
  ],
  outOfHearts: [
    'Out of hearts. I found some spares under a rock.',
    "Oof. Refill on the house. Don't tell anyone.",
    'Three strikes. Even crabs get do-overs.',
  ],
  protected: [
    "Hey! That file was important. I put it back. That's a heart.",
    'You deleted the one thing I said not to. Restored. Heart gone.',
    "That file was protected. I've reset things. Please be gentle.",
  ],
  hint: [
    "Fine, here's a hint. Don't tell anyone.",
    'A small nudge, from a small crab.',
    "Hint time. I'm not judging. Much.",
  ],
  streakLost: [
    'Your streak is 0. Even my shell has more commitment.',
    'Welcome back. Your streak missed you. I did not.',
    'Day one again. That is fine. Probably.',
  ],
  combo: [
    "{n} in a row. Who taught you this? Oh right. Me.",
    '{n} in a row! My claws are clapping.',
    "{n} in a row. I'd high-five you, but, claws.",
    '{n} straight. Is this a terminal or a talent show?',
  ],
  hatTrick: ['Okay, show-off.', 'Three lessons in a row? Calm down.', "Someone's on a roll."],
};

export const pickLine = (event: ShellbyEvent, random: () => number = Math.random): string => {
  const lines = shellbyLines[event];
  return lines[Math.floor(random() * lines.length)] ?? lines[0] ?? '';
};

/** What Shellby says when you find each easter egg. */
export const EGG_LINES: Readonly<Record<string, { readonly text: string; readonly mood: 'idle' | 'happy' | 'sad' | 'smug' }>> = {
  nuke: { text: '*faints* ... I am fine. Nice try. This is a simulation.', mood: 'sad' },
  editor: { text: 'Everyone gets stuck in an editor once. Now you know the way out.', mood: 'smug' },
  fetch: { text: "That's me! Best-looking crab on any operating system.", mood: 'happy' },
  sl: { text: 'Typo or tourist? Either way, enjoy the crab.', mood: 'smug' },
  cowsay: { text: 'Cows are overrated. Crabs say it better.', mood: 'smug' },
  fortune: { text: 'My fortunes are 100% accurate. Mostly.', mood: 'idle' },
  sandwich: { text: 'sudo works on crabs too, apparently.', mood: 'smug' },
  exit: { text: "Nope. You're staying. We have terminal to learn.", mood: 'smug' },
};

/** A nudge toward one secret the learner hasn't found yet. */
export const SECRET_HINTS: Readonly<Record<string, string>> = {
  nuke: 'Try the most famous terrible command. As admin.',
  editor: 'Open a text editor from the terminal.',
  fetch: 'Linux people love to show off their system info.',
  sl: 'What happens if you type ls backwards?',
  cowsay: 'An old program makes a cow say things.',
  fortune: 'Ask the terminal about your future.',
  sandwich: 'Ask the computer to make you a sandwich. Politely, or not.',
  exit: 'Try to leave.',
};
