export interface ProTipSection {
  heading: string;
  text: string;
}

export const PRO_TIP_SECTIONS: ProTipSection[] = [
  {
    heading: "Four ways to fill any meal slot",
    text: "Every meal slot in your builder gives you four options. The gold Cook with Chef button has a chef hat — tap it to tell the AI exactly what you want and it builds the meal for you. The gold Snack Creator button works the same way but is designed just for snacks. The red Favorites button has a white star — tap it and every meal you have ever saved appears in one list with a photo and name, so you can drop any of them straight into the slot without rebuilding from scratch. And the purple Describe It button has a plus sign — use it when you already ate something and just want to log it. Describe what you had, even if it was a restaurant meal with no exact macros, and the app will add it to your builder as a record of what you actually ate.",
  },
  {
    heading: "Be specific and your results get sharper",
    text: "Don't just say chicken or rice. Tell the builder exactly what you want and how you want it. For example, say 40 grams of protein from grilled chicken breast, 30 grams of starchy carbs from sweet potato, and 15 grams of fats from avocado. You can also guide flavor, seasoning, cooking style, and portion size. The clearer your instructions, the tighter and more accurate your meals will be.",
  },
  {
    heading: "Starch timing is controlled for a reason",
    text: "Your body builds and recovers best when nutrients are delivered at the right time, which is why starch is structured throughout your day instead of randomly placed. If you've ever felt low energy during the day but wired at night, or struggled with cravings later on, this is often part of the reason.",
  },
  {
    heading: "Use Keep It Simple for cleaner meals",
    text: "The builder will naturally try to enhance meals with additional flavors and ingredients. If you prefer simpler meals, use the Keep It Simple option to keep things clean and minimal. Use this builder like a coach would guide you — be intentional, be detailed, and let the system do the work.",
  },
  {
    heading: "The app learns you over time",
    text: "Here is something most people do not realize — the more you use the app and save meals, the smarter it gets about you specifically. The system tracks your patterns behind the scenes: the proteins you keep choosing, the cuisines you gravitate toward, the cooking styles that show up in your history, and whether you tend to prefer quick prep or more involved recipes. That profile is called your Taste Memory, and it gets quietly applied every time a new meal is generated for you. You do not have to do anything to set it up. The longer you use the app, the more it starts to feel like it already knows what you want before you ask.",
  },
  {
    heading: "Add macros to biometrics only after you eat",
    text: "This is important for keeping your data accurate. When you finish eating a meal, open that meal card and tap Add to Macros. That logs only what you actually ate. Do not use a whole-day save before you have eaten — if you plan five meals but only eat three, all five get recorded as consumed and there is no way to remove them from your history. Your biometric totals are meant to reflect reality, not your plan. Log each meal individually the moment you finish it and your tracking will always be honest.",
  },
];

export const PRO_TIP_SCRIPT = PRO_TIP_SECTIONS.map(
  (s) => `${s.heading}. ${s.text}`
).join("\n\n");
