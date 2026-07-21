// Macro Calculator Guided Walkthrough Voice Scripts
// Uses the same 11L voice system as Chef's Kitchen and ProTip

export const MACRO_CALC_ENTRY =
  "Before we begin, here's what to know. This calculator builds your personalized daily nutrition plan — your calories, protein, carbs, and healthy fats — based on your body and your goals. You'll answer around 10 questions and it takes about 3 to 5 minutes. Grab a flexible tape measure if you have one, because we'll ask for your waist size — it's the most important measurement we take. Your current weight and height are all you need. When you're ready, tap Let's Get Started.";

export const MACRO_CALC_GOAL =
  "First, let's figure out what we're working toward together. Choose Lose Fat if your goal is to reduce body weight. Maintain Weight to hold where you are. Build Muscle if you're trying to add size and strength. Or Contest Prep — that's our competition protocol. If you tap that one, I'll walk you through exactly what it sets up before we move on.";

export const MACRO_CALC_COMMITMENT_LEVEL =
  "Next, tell me what level of structure fits you best. Flexible means your routine changes from day to day and you need targets with room for real life. Consistent means you can follow a plan when you commit and you're comfortable with more specific daily targets. Performance means you train or compete at a high level and need targets built around your training load and recovery. Pick whichever feels most like you.";

export const MACRO_CALC_BODY_TYPE =
  "Which description best matches your natural tendency? Naturally Lean means you've always been on the thinner side and struggle to gain weight. Naturally Athletic means you build muscle and lose fat fairly easily with training. Naturally Fuller Build means you gain body weight more readily and fat loss can take more effort. Combination Build is for those who share traits from more than one. Most people are a mix — just pick the one that fits you best right now.";

export const MACRO_CALC_UNITS =
  "Do you use imperial system, the U.S. standard, or metric system?";

export const MACRO_CALC_SEX = "What is your biological sex, male or female? This is used only for the metabolic formula — it affects how we calculate your calorie burn and protein targets.";

export const MACRO_CALC_AGE = "What's your age?";

export const MACRO_CALC_HEIGHT = "How tall are you?";

export const MACRO_CALC_WEIGHT = "What's your current weight?";

export const MACRO_CALC_WAIST =
  "Now we need your waist circumference. This is one of the most important measurements we take — your waist size tells us about body composition and where you tend to carry weight, which the scale alone can't provide. Wrap a soft tape measure around your midsection at the level of your belly button. If your ratio is higher than ideal, the system may recommend slightly fewer starchy carbs to support your metabolic health.";

export const MACRO_CALC_ACTIVITY =
  "How active are you? This is the biggest variable in your plan — it determines how many calories your body burns daily. Sedentary means mostly sitting. Light is 1 to 3 days of exercise per week. Moderate is 3 to 5 days. Very Active is 6 to 7 days. Extra Active means you're training twice a day.";

export const MACRO_CALC_SYNC_WEIGHT =
  "Sync weight to biometrics to keep an accurate log of your progress.";

export const MACRO_CALC_METABOLIC =
  "Before we lock these macros in, take a second to check Metabolic and Hormonal Considerations below. If things like menopause, thyroid conditions, or GLP-1 meds apply to you, tap that section to open it. You can make optional adjustments there, and I'll fine-tune your macros automatically.";

export const MACRO_CALC_RESULTS =
  "These are your current macros and your baseline going forward. They stay in place as long as your goal and progress stay the same. If progress stalls or your goal shifts — whether that's fat loss, muscle building, or maintenance — just rerun the Macro Calculator to reset your targets.";

export const MACRO_CALC_STARCH =
  "Starchy carbs are the biggest lever for controlling body weight, so we place them intentionally. Here is why timing matters. Think of your body like a business. During the day it is open, running operations, and can put those carbs to work. At night it shifts into clean, repair, and reset mode. Sending starchy carbs in late can interfere with that recovery process. That is why we concentrate starchy carbs earlier in the day when possible, not as a restriction, but as a strategy you can adjust based on your training schedule and lifestyle. Tap one of the buttons below to choose your approach. One Starch Meal puts all your carbs in one meal for appetite control. Flex Split divides them across two meals for more flexibility. Tap the one that fits your lifestyle, then we'll lock it in.";

// For the granular 1–6 starch meal count step (replaces the old one/flex binary in the guided flow)
export const MACRO_CALC_STARCH_COUNT =
  "Now let's set your daily starch count. This tells the system how many of your meals each day will include a primary starchy carbohydrate — think rice, sweet potato, oats, bread, pasta. One is the tightest approach, great for fat loss or metabolic control. Two to three is a balanced strategy that fits most lifestyles. Four to six is for athletes, high-volume training, or performance days where carb fueling is the priority. Your Performance Hub can automatically adjust this on heavy training versus rest days. Pick the number that fits your current phase, then tap Continue.";

// For the clinical context step — medication and hormone gate before the save step
export const MACRO_CALC_CLINICAL_CONTEXT =
  "Before we lock everything in, I want to ask one important question. Some medications and hormone therapies change how your body processes nutrition — things like GLP-1 medications, testosterone therapy, corticosteroids, or thyroid medication. If any of those apply to you, the nutrition engine adjusts your targets and meal recommendations accordingly. This isn't about medical advice — it's about making your prescription as accurate as possible. Answer yes if any of those apply, no if they don't, or unsure if you're not certain. Then tap Continue and we'll finalize your prescription.";

export const MACRO_CALC_BODY_COMPOSITION =
  "This part is completely optional. If you've had your body fat measured, by DEXA scan, BodPod, calipers, or even a smart scale, you can enter that here. It helps us fine-tune your starchy carb numbers based on where you are versus your goal. But if you haven't had it done, or you're not sure what your body fat is, that's totally fine. Most people skip this. Just tap Skip and we'll move on.";

export const MACRO_CALC_SAVE =
  "Perfect! Hit save and you're all set. Your macros are locked in. Let's head over to our meal builder";

export const MACRO_CALC_SAVE_CONTEST_PREP =
  "Your competition prep macros are locked in. Before you head to the meal builder, tap Apply below to activate Contest Prep mode across the whole app. That tells every single meal generator to match your competition standards: lean proteins, fibrous carbs, and clean preparations only. Once you hit Apply, you're locked in and ready to build.";

export const MACRO_CALC_CONTEST_PREP =
  "You're in Competition Prep mode. Here's what that means. I've set you up with a hard cut, a low-carb split, and a 30-gram starchy carb cap. But here's what makes this different from a regular cut. Contest Prep is a metabolic overlay. That means it doesn't just change your numbers. It tells every single meal generator in this app to give you lean protein sources, fibrous carbs, and competition-clean preparations. When you get to the save step, there's an Apply button that locks this mode in across the whole app. Tap Continue when you're ready.";

export const MACRO_CALC_DONE = "";

// Triggered when user opens the Metabolic & Hormonal Considerations dropdown
export const MACRO_CALC_METABOLIC_OPEN =
  "Go ahead and select any that apply to you. These are optional, but they help me fine-tune your macros more accurately. If menopause or hormone therapy applies to you, it means hormonal changes can affect how your body holds muscle, uses carbs, and stores fat, so we usually prioritize protein a bit more. If you have suspected insulin resistance, that means your body doesn't handle carbs as efficiently, so moderating carbs and emphasizing protein helps keep blood sugar steady. And if high stress or poor sleep applies, cortisol can mess with fat storage and recovery, so we adjust things to support your body through that. Just tap any that fit, and I'll handle the rest.";
