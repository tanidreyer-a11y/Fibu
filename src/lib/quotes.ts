// Original lines written in Fibu's own voice — no fabricated attributions.
export const DAILY_QUOTES: string[] = [
  "The only workout you regret is the one you skipped.",
  "Progress is a rep you almost didn't do.",
  "Show up. The plan can be figured out once you're here.",
  "You don't need to feel ready. You need to start the first set.",
  "Every heavy day was a light day once.",
  "Consistency beats intensity, but today you can have both.",
  "Nobody remembers the sets that felt easy.",
  "Small weight, more reps, same discipline — it all counts.",
  "The bar doesn't care how you feel. Neither should you.",
  "One more rep than last time. That's the whole game.",
  "Rest is part of the program, not a break from it.",
  "You're not behind. You're exactly where rep one is.",
  "Strong is built in the sets nobody's watching.",
  "The hardest part is putting your shoes on. You've done that.",
  "Today's floor is last month's ceiling.",
  "You've never regretted a workout once it was done.",
  "Form first, ego later.",
  "A short session beats a skipped one, every time.",
  "The body adapts to what you keep asking of it.",
  "Come as you are. Leave a little stronger.",
  "There's no such thing as a wasted warm-up set.",
  "Discomfort now is just strength that hasn't arrived yet.",
  "You already decided to do this. Now just do the first set.",
  "Track it, trust it, repeat it.",
  "The weight goes up because you kept showing up when it didn't.",
  "You're allowed to have an average day and still show up.",
  "Nobody's split is perfect. Logged and imperfect beats planned and skipped.",
  "Every rep is a vote for who you're becoming.",
  "The gym doesn't care what day it feels like. Go anyway.",
  "You're one workout closer than you were yesterday.",
];

function hashDate(date: Date): number {
  const key = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  let h = 0;
  const str = String(key);
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getDailyQuote(date: Date = new Date()): string {
  const idx = hashDate(date) % DAILY_QUOTES.length;
  return DAILY_QUOTES[idx];
}
