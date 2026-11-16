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
  | 'hatTrick';

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
    "Out of hearts. Let's try that whole lesson again.",
    'Oof. Back to the start, no waiting.',
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
  hatTrick: ['Okay, show-off.', 'Three lessons in a row? Calm down.', "Someone's on a roll."],
};

export const pickLine = (event: ShellbyEvent, random: () => number = Math.random): string => {
  const lines = shellbyLines[event];
  return lines[Math.floor(random() * lines.length)] ?? lines[0] ?? '';
};
