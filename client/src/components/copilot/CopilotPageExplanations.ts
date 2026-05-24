export interface PageExplanation {
  pageId: string;
  title: string;
  description: string;
  spokenText: string;
  autoClose: boolean;
  // Guest-specific marketing copy, used when in guest mode for onboarding/sales
  guestSpokenText?: string;
  guestDescription?: string;
}

export const PAGE_EXPLANATIONS: Record<string, PageExplanation> = {
  "/dashboard": {
    pageId: "dashboard",
    title: "Dashboard",
    description:
      "Your home base. Access meal planning, tracking, cravings, and lifestyle tools from one place.",
    spokenText:
      "Welcome to My Perfect Meals. I am Chef Copilot, your coach in your pocket, here to guide you whenever you need help, and you can turn me on or off at any time using the Auto toggle in the Copilot bar. You are on your dashboard, your home base and control center for everything in the app, where you can access your meal planner, shopping list, nutrition tools, inspiration, and other key resources all in one place. In the top right corner, you’ll see the Hub, which is where you manage your account, switch meal builders, adjust settings, and explore the App Library, the brain of the app where you can learn how everything works and get guidance whenever you need it. Create a Dish is where you can freely explore and generate meals. When generating meals, you can be broad or specific, but the more detail you provide, the more accurate and tailored your results will be. If you stay too vague, you may not get exactly what you’re looking for, so adding details about ingredients, style, or goals will improve your outcome, and if you want even more control, you can use the Keep It Simple option to limit extra ingredients and keep meals focused on exactly what you asked for. Recipe Scan is also right on your dashboard — tap it to bring in any food idea from the world around you. You have four ways to use it: choose a screenshot or saved photo from your gallery, open your camera to capture something live, speak a meal description out loud, or just type it in. After you bring in your idea, you get a quick settings screen where you can choose your servings, how aggressively you want it adapted, your protein level, prep style, and cuisine before it generates. The result comes back as a preview and saves to your Favorites under My Inspirations only when you confirm it. My Perfect Meals is powered by Emotion AI, our conversational meal creation system that allows you to describe what you want and receive personalized meals based on your preferences. The system also supports specialty diets like vegan, vegetarian, pescatarian, and more, treating them as built-in guardrails, so your meals automatically respect your dietary choices without you needing to repeat them. To protect you, we use Safety Guard with Allergy Protection, a two-layer system designed to prevent meals from being created with unsafe ingredients. For weight management, Starch Guard helps control high-glycemic carbs like rice, pasta, and potatoes, giving you one or two starch-based meals per day and then shifting toward fibrous carbs once you have reached that limit. If you are using the Diabetic Hub, Glucose Guard adjusts your meals based on your most recent glucose readings to help keep you within a safer range. Your Nutrition Budget tracks your daily protein, starchy carbs, and fiber, showing you what is left as you add meals so you can stay on track without overthinking. Your Palate Preferences let you customize flavor, including spice level, seasoning intensity, and overall taste profile, so your meals match your preferences without changing your macros. When you are ready, start by setting your targets in the Macro Calculator. From there I will guide you step by step through building meals, planning your days, and using the app effectively. You can use the app with Copilot on or off, your choice, and if anything, ever feels confusing or not right, just scroll to the bottom of this card and tap Contact Support, because we read everything and we are here to help.",
    autoClose: true,
  },

  "/my-biometrics": {
    pageId: "my-biometrics",
    title: "My Biometrics",
    description:
      "Your daily feedback center. Track macro consistency, body metrics, hydration, and progress trends while logging meals instantly with MacroScan or Just Describe It.",

    spokenText:
      "My Biometrics is your daily feedback and progress center, where everything you are doing inside the app comes together in one place. At the top, you will see your current macro targets, which are set from the Macro Calculator and remain active until you, your coach, or your physician updates them. As you move through the page, you can quickly log foods using MacroScan by scanning a nutrition label, or use Just Describe It to estimate meals by simply explaining what you ate. This page also tracks your macro consistency over time, helping you see how closely your eating habits align with your targets across daily, weekly, and monthly views. You will also find calorie totals, body measurements, body composition estimates, clinical lab values, and hydration tracking. Your body fat percentage is estimated using the U.S. Navy Body Fat Formula, which uses measurements like waist, neck, height, and hips to provide a consistent progress reference over time, though you can also enter more advanced readings from external devices if available. This page is not designed to build meals. It is designed to help you monitor patterns, identify trends, improve consistency, and better understand how your nutrition choices are affecting your body and overall progress.",
    autoClose: true,
    guestDescription:
      "Your personal progress lens. This is where meals, macros, hydration, and body trends turn into real feedback.",

    guestSpokenText:
      "This is your Biometrics page, and this is where your nutrition starts turning into real data and real feedback. Most people eat every day without ever truly understanding what is helping them progress and what is holding them back. Here, you can see your protein, carbs, fats, calories, hydration, and body trends all in one place. You can scan food labels with MacroScan, describe meals using Just Describe It, and watch your macro consistency patterns develop over time across daily, weekly, and monthly views. This is not about perfection. It is about awareness, consistency, and understanding your habits. Subscribers unlock deeper tracking tools like weight trends, hydration monitoring, body composition tracking, and long term macro consistency insights that help close the loop between your nutrition and your results. You have now completed your first full loop of the Guest Experience. Nicely done. Head back to the Guest Experience and you will now find Fridge Rescue and Craving Creator unlocked and ready to explore. Go have fun with them. I will be here when you are ready for the next step.",
  },

  "/craving-creator": {
    pageId: "craving-creator-studio",
    title: "Craving Creator",
    description:
      "Create healthier versions of the foods you crave, and add them directly to your meal plan.",
    spokenText:
      "Craving Creator is for those moments when you want something specific but still want it to fit your goals. Just tell me what you are craving, sweet, crunchy, creamy, or anything else, add any preferences or restrictions, choose your servings, and tap Create. Instead of giving you just one option, I will now generate three different meal choices based on your request, so you can pick the one that fits you best. Every option is built to respect your system, including specialty diets like vegan, vegetarian, and other dietary preferences, along with SafetyGuard for allergy protection, Starch Guard for managing high-glycemic carbs, and GlucoseGuard if you are using the Diabetic Hub. You can keep it simple or be detailed with your request, but the more specific you are, the more tailored your results will be, and if you want tighter control, use the Keep It Simple option to limit extra ingredients and keep the meal focused on exactly what you asked for. Once you find something you like, you can add it directly to your day. You can also use the Flavor Preference toggle to switch between Personal, which uses your saved palate preferences, or Neutral for lighter seasoning when cooking for others. And if you want to go hands-free, just tap the Chef and talk your way through it.",
    autoClose: true,
    guestDescription:
      "We redesign cravings. Stay satisfied, stay on plan, without giving up what you love.",
    guestSpokenText:
      "This is Craving Creator, and this is how you stay on plan without feeling deprived. Most diets tell you to ignore your cravings. I don’t work that way. I redesign them. Craving something sweet? Tell me. Something crunchy, creamy, salty, tell me. I’ll build a healthier version that actually satisfies you, with ingredients, instructions, and real nutrition. When you find one you like, add it straight to today’s breakfast, lunch, dinner, or snacks. This feature is free for you to explore, no pass required. Play around, experiment, and see how cravings can fit into a real plan without derailing your progress. This is the kind of thing that makes people realize this app actually gets them.",
  },

  "/craving-desserts": {
    pageId: "dessert-creator-studio",
    title: "Dessert Creator",
    description:
      "Create healthier desserts, from everyday cravings to special-occasion treats, without restriction or guilt.",
    spokenText:
      "Dessert Creator is where cravings don’t get judged, they get redesigned. Start by choosing the kind of dessert you want, then pick a flavor direction and how many people you’re serving. Add any dietary preferences if needed, then tap Create. I’ll build you a dessert that actually feels like a dessert, one you can enjoy. If you're diabetic, GlucoseGuard adjusts the dessert based on your latest glucose reading. Use the Flavor Preference toggle to switch between Personal or Neutral seasoning when serving others. Pro tip, you can go hands-free here. Tap the Chef, and just talk your way through it.",
    autoClose: true,
  },

  "/craving-creator-landing": {
    pageId: "craving-creator-landing",
    title: "Cravings, Sushi & Desserts Hub",
    description:
      "The original craving-based experience. Create custom cravings, explore ready-made favorites, or build healthier desserts, all from one place.",
    spokenText:
      "Welcome to the Craving Creator Hub, this is where it all began. This is the original experience, built around what you actually feel like eating. You can use the Craving Creator to turn any craving into a healthier meal that fits your goals, browse Premades for ready-to-go favorites, or head into the Dessert Creator for healthier takes on things like cookies, cakes, and pies. Pick where you want to start, and I’ll guide you from there.",
    autoClose: true,
  },

  "/lifestyle/create-a-dish": {
    pageId: "create-a-dish",
    title: "Create a Dish",
    description:
      "Design a custom meal from scratch, describe exactly what you want, choose your cook method, servings, and notes, and I'll build it with full ingredients, nutrition, and instructions.",
    spokenText:
      "Create a Dish is your blank canvas. This is where you build something from scratch, no templates, no limits. Just describe the meal you want in the dish field, be as specific or as open as you like. Mention the cuisine, the protein, how you want it cooked, or even how it should feel. You can choose your cook method, set your servings, and add any notes like 'make it low sodium' or 'easy cleanup.' When you tap Create, I'll build your meal with full ingredients, nutrition info, and step-by-step instructions. Your SafetyGuard and allergy protections are always active, so nothing unsafe will be included. If you're managing your weight, Starch Guard monitors starchy carbs and can substitute them with fibrous alternatives when needed. GlucoseGuard adjusts the meal automatically if you're diabetic and have a recent glucose reading. Use the Flavor toggle to switch between your personal palate preferences or a neutral profile when cooking for others. Once your dish is ready, you can add it to your meal plan, send ingredients to your shopping list, save it to your favorites, or share the recipe. One thing worth understanding about how starchy carbs are managed, the timing is intentional. Think of your body like a business. During the day it is open, running operations, and can put those carbs to work. At night it shifts into clean, repair, and reset mode. Sending starchy carbs in late can interfere with that recovery process. That is why Starch Guard concentrates them earlier in the day when possible, not as a restriction, but as a strategy you can adjust based on your training schedule and lifestyle. Tap Create to get started.",
    autoClose: true,
  },

  "/lifestyle/athlete-beverage-creator": {
    pageId: "athlete-beverage-creator",
    title: "Athletes Beverage Creator",
    description:
      "Performance drinks built for athletes, clean, functional, and tuned to your training phase. No dyes, no fillers. Every drink respects your dietary profile.",
    spokenText:
      "Welcome to the Athletes Beverage Creator. This system is built for serious performance, for UFC fighters, NBA players, endurance athletes, and anyone who trains hard and eats clean. Every drink is designed around your training phase. Pre-workout drinks focus on energy and mental focus. Intra-workout drinks prioritize hydration and endurance. Post-workout drinks are built for recovery and rebuilding muscle. Ingredients are chosen for function, covering protein timing, electrolytes, creatine support, and clean energy. No artificial dyes, no fillers, nothing your body does not need. Your dietary profile always travels with you here too. If you are vegan, anti-inflammatory, or have any food restrictions, this system respects all of that automatically. The same guardrails that protect every meal in this app are active here too. Select your training phase, your goal, and your preferred drink format, then tap Build Performance Drink.",
    autoClose: true,
  },

  "/lifestyle/beverage-creator": {
    pageId: "beverage-creator",
    title: "Beverage Creator",
    description:
      "Create personalized healthy beverages, smoothies, protein shakes, cocktails, mocktails, coffee drinks, tea drinks, milkshakes, frozen drinks, and hydration drinks, tailored to your nutrition goals.",
    spokenText:
      "Welcome to the Beverage Creator, this is where you build drinks that actually fit your plan. Pick a category, smoothies, protein shakes, cocktails, mocktails, coffee drinks, tea drinks, milkshakes, frozen drinks, or hydration drinks, then tell me what you're in the mood for, or tap Surprise Me and let me pick. I'll create a custom beverage with full nutrition info, ingredients, and instructions. Every drink respects your SafetyGuard settings, allergies, and dietary preferences. If you're diabetic, GlucoseGuard adjusts sugar content based on your latest reading. You can save favorites, add drinks to your meal plan, or send ingredients straight to your shopping list. Flavor Preference lets you switch between personal and neutral taste when making drinks for others.",
    autoClose: true,
  },

  "/lifestyle/chef-pairings": {
    pageId: "chef-pairings",
    title: "Chef Pairings",
    description:
      "Find the perfect wine, beer, and spirits to pair with any meal. Powered by AI sommelier expertise.",
    spokenText:
      "Welcome to Chef Pairings, your personal sommelier, beer expert, and spirits guide all in one place. Just type what you're eating, steak, salmon, pizza, tacos, whatever you're having, and I'll recommend wines, beers, and spirits that pair perfectly with your food. Each recommendation includes why it works, calorie info, and health notes for anyone watching sugar or calories. If you find a pairing you love, tap the heart to save it to your favorites. Your SafetyGuard and allergy protections are active here too, so everything stays safe.",
    autoClose: true,
  },

  "/lifestyle/pairings-hub": {
    pageId: "pairings-hub",
    title: "Pairings Hub",
    description:
      "Your drink intelligence center, AI pairings, wine list translation, and a plan to reduce drinking.",
    spokenText:
      "Welcome to the Pairings Hub, your complete drink intelligence center. You have three tools here. Drink Pairings finds the perfect wine, beer, or spirits for any meal, or helps you discover new drinks similar to ones you already love. Wine List Translator lets you paste any restaurant wine list and get plain-English explanations with flavor profiles and a best-choice recommendation. And if you want to cut back, the Reduce Drinking Plan creates a personalized, evidence-based plan at your own pace. Tap any card to get started.",
    autoClose: true,
  },

  "/lifestyle/pairings-ai": {
    pageId: "pairings-ai",
    title: "Drink Pairings",
    description:
      "Find the perfect drink for any meal, or discover new drinks similar to ones you love.",
    spokenText:
      "Welcome to Drink Pairings, your personal sommelier, beer expert, and spirits guide. You have two modes. Pair food with drinks, just type what you're eating and I'll recommend wines, beers, and spirits that pair perfectly, with science-based explanations of why each works. Or use Find similar drinks, enter a drink you already love and I'll find others with similar flavor profiles. Every recommendation includes flavor notes, serving tips, and alternatives. Your SafetyGuard, allergy protections, and glucose guard are all active here.",
    autoClose: true,
  },

  "/lifestyle/wine-list-helper": {
    pageId: "wine-list-helper",
    title: "Wine List Translator",
    description:
      "Paste a restaurant wine list and get plain-English explanations, flavor profiles, and a best-choice pick.",
    spokenText:
      "Welcome to the Wine List Translator. Next time you're at a restaurant and the wine list looks intimidating, just snap a photo or type the wines in here. I'll explain each one in plain English, what it tastes like, what foods it pairs with, and why. I'll also pick the best choice for your meal if you tell me what you're eating. Each wine gets a flavor profile breakdown so you know exactly what to expect before you order.",
    autoClose: true,
  },

  "/lifestyle/reduce-drinking-plan": {
    pageId: "reduce-drinking-plan",
    title: "Reduce Drinking Plan",
    description:
      "Create a personalized, evidence-based plan to reduce your drinking at your own pace.",
    spokenText:
      "Welcome to the Reduce Drinking Plan. This tool creates a personalized plan to help you cut back on drinking at whatever pace feels right for you. Just enter how much you currently drink, how many days a week, and choose your reduction pace, gentle, standard, or custom. I'll generate a week-by-week plan with clear targets, harm reduction tips backed by research, and any medical flags to be aware of. This is private, judgment-free, and based on evidence-based approaches.",
    autoClose: true,
  },

  "/fridge-rescue": {
    pageId: "fridge-rescue-studio",
    title: "Fridge Rescue",
    description:
      "Turn the ingredients you already have into real meals, and add them directly to today’s plan.",
    spokenText:
      "Fridge Rescue is built for real life. If you want, you can type what you have. Or you can go hands-free, tap the Chef and just tell me what's in your fridge. I'll ask a couple of quick questions if needed, then turn what you already have into real meals you can actually eat. Each meal comes with ingredients, instructions, and nutrition. If you like one, you can add it directly to today's plan, log the macros, or send ingredients to your shopping list. If you're diabetic, GlucoseGuard adjusts meals based on your latest glucose reading. Use the Flavor Preference toggle to switch between Personal or Neutral seasoning when cooking for others. Pro tip, you can go hands-free here. Tap the Chef and just talk. One thing worth understanding about how starchy carbs are managed, the timing is intentional. Think of your body like a business. During the day it is open, running operations, and can put those carbs to work. At night it shifts into clean, repair, and reset mode. Sending starchy carbs in late can interfere with that recovery process. That is why Starch Guard concentrates them earlier in the day when possible, not as a restriction, but as a strategy you can adjust based on your training schedule and lifestyle.",
    autoClose: true,
    guestDescription:
      "Life happens. We adapt. Use what you have and turn it into something real.",
    guestSpokenText:
      "This is Fridge Rescue, and this is what happens when life doesn’t go according to plan. You’ve got random ingredients at home, no time to shop, and no idea what to make. Sound familiar? Just tell me what you’ve got, chicken, eggs, leftover rice, whatever, and I’ll turn it into a real meal with ingredients, instructions, and nutrition. No grocery run. No guessing. No wasted food. This feature is free for you to explore, no pass required. Play around, see what’s possible. When you find something you like, you can add it to your meal plan, and watch how it connects back to your day. This is one of those features that makes people go ‘oh wow, I didn’t know it could do that.’ So go ahead, rescue your fridge.",
  },

  "/social-hub": {
    pageId: "social-hub",
    title: "Socializing Hub",
    description:
      "Navigate dining out and social eating. Choose Restaurant Guide or Lean Social.",
    spokenText:
      "Socializing Hub. In this feature, you have two ways to find healthy meals. Use Restaurant Guide when you already know where you’re eating, just tell me the restaurant, and what you want. Or use Find Healthy Options to search by zip code, and see what’s around you. Tap whichever one you need.",
    autoClose: true,
  },

  "/social-hub/restaurant-guide": {
    pageId: "social-hub/restaurant-guide",
    title: "Restaurant Guide",
    description:
      "Find healthy meals at any restaurant. Enter the restaurant name and what you want to eat, and the app will return three smart, goal-friendly options.",
    spokenText:
      "      Sometimes you already know where you want to eat, or at least what kind of place you are looking for, but the problem is not the restaurant; it is knowing how to order so that you enjoy your meal without the guilt. Restaurant Guide fixes that. Just tell me where you want to eat, or what type of food you are in the mood for, and enter your location, and the system will find that restaurant or similar options nearby. From there, you will get three meal choices adjusted to your goals, along with simple guidance on how to order them, so they fit your plan. Each option appears as a meal card, where you can review the meal, see estimated macros, and understand how it fits into your day before you decide. Everything is filtered through your onboarding, dietary preferences, and SafetyGuard, so your allergies and restrictions are handled automatically. When you choose a meal, you can log it directly to your Biometrics with one tap, keeping your day accurate without extra effort. You are not guessing what to order anymore; you already know what works before you even get to the table, so you can enjoy your meal and stay on track without overthinking it.",
    autoClose: true,
  },

  "/social-hub/find": {
    pageId: "social-hub/find",
    title: "Find Meals Near Me",
    description:
      "Find healthy places to eat near you. Enter what you're craving and your zip code, and the app returns nearby restaurants with smart meal options that fit your goals.",
    spokenText:
      "When you are out, on the road, or in a new area, staying on track becomes a guessing game. Find Meals Near Me fixes that. I am finding restaurants that fit your dietary preferences — and that includes both dedicated spots and places where you can confidently order meals that match your diet. Just tell me what type of food you are looking for and enter your location, and the system will find nearby restaurants that work for how you eat. From there, you will get three restaurant options, and for each, you will see smarter meal choices and simple guidance on how to order them, so they fit your goals. Each option appears as a meal card, where you can review the meal, see estimated macros, and understand how it fits into your day before you decide. Everything is filtered through your onboarding, dietary preferences, and SafetyGuard, so your allergies and restrictions are handled automatically. When you choose a meal, you can log it directly to your Biometrics, keeping your day accurate without extra effort. You are not guessing, you are not stressed, you are just finding food, ordering smarter, and staying on track wherever you are.",
    autoClose: true,
  },

  "/social-hub/fast-food": {
    pageId: "social-hub/fast-food",
    title: "Fast Food Guide",
    description:
      "Find the smartest meal choices at fast food restaurants. Tell me where you're going and what you want, and I'll return three goal-friendly options with full nutrition details.",
    spokenText:
      "Welcome to the Fast Food Guide. Look, fast food happens. Road trips, busy schedules, kids, late nights — sometimes the drive-through is just the reality. That does not mean you have to blow your plan. Tell me which fast food restaurant you're heading to and what you're in the mood for, and I'll find three meal options that actually make sense for your goals. And here is what makes this different — your dietary preferences are fully honored here, every single time. If you are vegan, every option will be plant-based. If you are keto, I stay low carb. If you are gluten-free, I avoid it. Kosher, halal, vegetarian, pescatarian — whatever your protocol, the Fast Food Guide respects it automatically, the same way every other feature in this app does. Your SafetyGuard allergy protections are active here too, so nothing unsafe will ever come back to you. You'll see estimated macros, a smart ordering tip, and enough detail to feel confident at the counter. When you find something that works, log it to your Biometrics with one tap. Fast food is not the enemy. Ordering without a plan is. I've got you covered.",
    autoClose: true,
  },

  "/lifestyle/my-perfect-gatherings": {
    pageId: "lifestyle/my-perfect-gatherings",
    title: "My Perfect Gatherings",
    description:
      "Plan full multi-course meals for holidays, camping, tailgates, and group events — with AI-generated courses that feel chef-designed, not random.",
    spokenText:
      "Welcome to My Perfect Gatherings. This is where meal planning meets real life. Think of it as a personal chef who designs the entire meal around what you are actually doing and who you are doing it with. You pick the situation, a holiday like Thanksgiving or Hanukkah, a camping trip, a tailgate, or a family gathering, and then set the details: how many people you are feeding and how many courses you want. From there, I build each course individually, appetizer, main, sides, dessert, so every dish feels intentional, balanced, and connected to the same occasion. Nothing random, nothing repeated. Each course knows what the others are. And one thing worth knowing: your dietary preferences travel with you into every single course. If you are vegan, every course will be plant-based. If you are keto, gluten-free, kosher, halal, or anything else, your protocol is enforced across your full gathering automatically. You do not need to remind me. It is already built in. You can even pin specific dishes to a course, paste in a family recipe, or let me build the entire meal from scratch. When it is ready, every course appears as a full meal card with ingredients, instructions, and nutrition. You can add any course to your meal plan, save favorites, or share the full gathering. This is not a meal generator. This is how you eat when it matters.",
    autoClose: true,
  },

  "/wine-pairing": {
    pageId: "wine-pairing",
    title: "Wine Pairing",
    description:
      "Find wines that pair well with your meal based on food style, occasion, or preference.",
    spokenText:
      "Wine Pairing helps you find the right wine to match what you’re eating. Choose things like your meal type, cuisine style, main ingredient, occasion, or price range, and I’ll recommend wines that fit your selection, and complement your meal.",
    autoClose: true,
  },

  "/beer-pairing": {
    pageId: "beer-pairing",
    title: "Beer Pairing",
    description: "Discover beers that pair well with your meal or food style.",
    spokenText:
      "Beer Pairing makes it easy to find a beer that works with your food. Select options like meal type, cuisine, main ingredient, flavor preference, alcohol range, or price, and I’ll narrow down beers that pair well with what you’re eating.",
    autoClose: true,
  },

  "/bourbon-spirits": {
    pageId: "bourbon-spirits",
    title: "Bourbon & Spirits",
    description:
      "Match bourbon and spirits to your meal for balanced flavor pairings.",
    spokenText:
      "Bourbon and Spirits Pairing helps you match bold flavors the right way. Choose your meal type, cuisine style, main ingredient, occasion, or price range, and I’ll suggest bourbons or spirits that complement your food.",
    autoClose: true,
  },

  "/meal-pairing-ai": {
    pageId: "meal-pairing",
    title: "Meal Pairing",
    description:
      "AI-powered food and drink pairings designed to work well together.",
    spokenText:
      "Meal Pairing helps you bring food and drinks together the right way. Choose your drink category, pick a specific drink, select your meal style, and set your cooking time, and I’ll match everything so the flavors line up naturally.",
    autoClose: true,
  },

  "/weaning-off-tool": {
    pageId: "weaning-off-tool",
    title: "Weaning Off Tool",
    description: "A guided plan to help you gradually reduce alcohol intake.",
    spokenText:
      "The Weaning Off Tool helps you cut back at your own pace. Enter your average drinks per day and per week, choose a gentle, standard, or custom pace, and generate your plan. You’ll see weekly targets, track your progress, pause anytime, and watch your drinking goals come to fruition over time.",
    autoClose: true,
  },

  "/builders": {
    pageId: "builders",
    title: "Meal Builders",
    description:
      "Your central hub for building meal plans that match your goals, schedule, and lifestyle.",
    spokenText:
      "This is your Meal Builders page, this is where everything comes together. Inside, you’ll find your assigned meal builder, the one designed specifically for your goals. Whether that’s weekly planning, diabetic support, GLP-1, anti-inflammatory, or another focus, this is where you build your meals day by day. Tap your builder to get started, and I’ll walk you through each step as you go, from choosing meals, to dialing in portions, and staying on track. This is where planning turns into action, let’s go.",
    autoClose: true,
  },

  "/lifestyle": {
    pageId: "lifestyle-landing",
    title: "Lifestyle",
    description:
      "Your central hub for everyday food, lifestyle, and real-life eating decisions.",
    spokenText:
      "Welcome to the Lifestyle Hub, where everything comes together for real life and real food decisions. From here, you can enjoy your cravings in a smarter way through the Craving Hub with the Craving Creator, Dessert Creator, and Sushi Creator, explore the Beverage Creator Hub with smoothies, cocktails, mocktails, coffee drinks, and the Athlete Beverage Creator for pre workout, intra workout, and post workout performance drinks, and navigate the Spirit, Beer and Wine Pairing Hub with pairings, a Wine List Translator, and a Reduce Drinking tool. You can use Fridge Rescue to turn what you already have into meals, explore the Socializing Hub with Restaurant Guide, Fast Food Guide, and Find Meals Near Me for better choices when eating out, and access the Fast Food Hub for structured, smarter fast food options that align with your goals and preferences. You can also take advantage of My Perfect Gathering for holidays, camping, and tailgating. At the center of everything is Create a Dish inside Chef’s Kitchen, where meals are built around your goals, preferences, culture, and what is going on with your body, guiding you through how to prepare food that actually works for you, and for creators, you can build your own Signature Kitchen and bring your brand into the system.",
    autoClose: true,
  },

  "/more": {
    pageId: "more",
    title: "More",
    description:
      "Your hub for favorites, shared meal boards, and expert-guided nutrition tools.",
    spokenText:
      "This is your More page, your hub for everything extra inside the app. From here, you can switch workspaces or choose to become a provider if you want to coach or guide others, access your Favorites where all your saved meals are organized and ready to reuse, and manage your ProCare and ProCare Connect settings. If you are connected to a trainer or doctor, they can view or update your Meal Board based on the level of access you have given them, while every change is tracked, so you always know what was updated and who made it. You can also disconnect from a provider at any time directly from this page without needing to go through them, giving you full control, privacy, and flexibility while continuing to use the app normally.",
    autoClose: true,
  },

  "/macro-counter": {
    pageId: "macro-counter",
    title: "Macro Calculator",
    description:
      "Calculate personalized daily protein, carb, and fat targets using your goals, activity level, body composition, and key metabolic factors. Choose your Starch Meal Strategy to control how you manage starchy carbs throughout the day.",
    spokenText:
      "The Macro Calculator is where we assess the key markers needed to build your nutrition plan correctly. This is where your body stats and lifestyle factors come together, including your goal, commitment level, activity level, gender, age, height, weight, body composition, and any metabolic or hormonal conditions that affect how your body processes food. All these inputs are used to calculate personalized daily targets for protein, starchy carbs, fibrous carbs, and fat, which are then carried over and displayed on your Biometrics page as your daily reference. This is also where we control your carbohydrate strategy because fibrous carbs like vegetables are left open to support fat loss and digestion, while starchy carbs like rice, pasta, and potatoes are managed through the Starch system. You will choose either One Starch Meal, where all starchy carbs are concentrated into a single meal, or Flex Split, which spreads them across two meals for more flexibility, and that choice directly controls how your meals are built. If anything changes, you do not have to start over; you can simply adjust your inputs and use the update banner to instantly recalculate your targets. This is not just a calculator; it is the basis of your entire nutrition plan, making sure everything that follows is built around how your body works.",
    autoClose: true,
    guestDescription:
      "This is where your plan becomes yours, personalized nutrition targets based on your body, not generic calorie counting.",
    guestSpokenText:
      "Hey, I’m Chef Coplit, your personal guide inside My Perfect Meals. This is your Macro Calculator, and this is where your plan becomes yours. Most apps just count calories. I don’t. I calculate daily targets for protein, starchy carbs, fibrous carbs, and fat based on how your body actually works, your age, activity level, goals, and factors like hormone changes, insulin resistance, or stress. Here’s the key: fibrous carbs like vegetables are unlimited and help with weight loss. Starchy carbs like rice, pasta, and potatoes need to be managed, and that’s what the Starch Strategy is for. Choose One Starch Meal for appetite control, or Flex Split for flexibility on active days. Pro tip: eat starchy carbs earlier in the day, you’ll metabolize sugars better, and sleep better at night. Once you save your numbers, everything you build in this app is built around you, not a generic template. This is the foundation. When you’re done, the Weekly Meal Builder unlocks, and you’ll see exactly how these numbers turn into real meals you actually want to eat. Take your time. Get these numbers right. Then let’s build.",
  },
  "/shopping-list-v2": {
    pageId: "shopping-list-v2",
    title: "Master Shopping List",
    description:
      "Create, manage, and check off items for your grocery trips. Send just today’s meals or choose specific days — shop for exactly what you need, not the whole week.",
    spokenText:
      "The Master Shopping List helps you organize everything you need in one place. You can add items by barcode, voice, or bulk entry, group them by aisle, and exclude pantry staples. Use Add Other Items for non food needs like household, personal care, pets, or pharmacy items, then check things off as you shop, or send your list to a delivery service. Here is something important to know about how meals get sent here. At the bottom of every meal builder, you will see a shopping bar. Tap Send This Day to send only the meals from the day you are currently viewing. Or tap Choose Days to open a multi-select panel where you can check one or more specific days you want to shop for. This means you can shop just for today, just for the weekend, or any combination you choose, instead of always sending the entire week. This helps you avoid overbuying, keeps your produce fresh, and gives you a shorter, smarter list every trip. Your list also syncs to your account automatically, so it is the same on every device. If you’re exploring as a guest, this is where you see how meals turn into real shopping, and when you’re ready, head back to the Guest Experience to keep exploring, or try Fridge Rescue and Craving Creator.",
    autoClose: true,
    guestDescription:
      "Planning turns into action here. Send today’s meals or choose specific days — shop for exactly what you need.",
    guestSpokenText:
      "This is your Shopping List, and this is where planning turns into action. Most people build meal plans, then guess what to buy. I don’t let that happen. Every meal you create in this app gets sent directly here, and I automatically organize everything by aisle, so you’re not wandering around the store. You can add items by voice, use bulk add to drop in multiple items at once, search by brand name, exclude pantry staples you already have, and use Add Other Items for non-food needs like household supplies, personal care, pets, or pharmacy. Check things off as you shop, or send the list to your delivery service. One important thing to know: at the bottom of every meal builder, you will see a shopping bar with two options. Tap Send This Day to send just today’s meals. Or tap Choose Days to pick exactly which days you want to shop for. No more sending the whole week when you only need two days of groceries. This is how meal planning works in the real world, and it’s one of the reasons subscribers love this app. For now, explore what’s here. When you build a meal and send it to shopping, you’ll see exactly how the system comes together.",
  },
  "/get-inspiration": {
    pageId: "get-inspiration",
    title: "Get Inspiration",
    description:
      "Find daily inspiration and a simple space to reflect, reset, and clear your mind.",
    spokenText:
      "Get Inspiration is a place to reset and refocus. You can tap for a new motivational quote anytime, or use the journal to speak or type your thoughts when you need to clear your head. Take a moment for yourself, always remember this, free your mind, and the rest will follow.",
    autoClose: true,
  },

  "/weekly-meal-board": {
    pageId: "weekly-meal-board",
    title: "Weekly Meal Builder",
    description:
      "Build meals across one or multiple days guided by your goals. Each meal slot has a My Favorites button — tap the red star to instantly reuse any saved meal with macros updated automatically. Taste Memory is active — the more you save, the more the app learns your preferences. Use the 'How builders work' button on this page to watch a quick video tutorial on how to use this builder.",
    spokenText:
      "Welcome to the Weekly Meal Builder. This meal builder is recommended when you do not have specific medical or specialized dietary needs, giving you a flexible system to build meals in any cuisine or style based on your goals and preferences. No matter which builder you’re using, each one is designed for a different purpose, but they all follow the same core system, allowing you to create meals in any cuisine or style you want using a flexible Meal 1, Meal 2, Meal 3 structure, with the ability to add more meals based on how you eat. At the top of the screen, you will see your daily nutrition targets, which come from the Macro Calculator and serve as your baseline for the day. At the bottom, you will see your Nutrition Budget, a real time view of what you have remaining for protein, starchy carbs, and fiber as you add meals, helping you stay on track without overthinking. Just below the top section is your daily starch indicator, which shows how many starchy meals you have available based on the strategy you set in the Macro Calculator. Green means you still have starch meals available, and orange means you have already used them. Starch Guard is your built-in weight management system. It limits high glycemic carbs like rice, pasta, and potatoes, and when you have used your starch meals, it steps in and helps you substitute with fibrous carb options or lets the Chef choose for you. To start building, tap Create with Chef, our multilingual, multi-cuisine AI meal creator, and describe what you want. You can keep it simple or be detailed, but the more specific you are about cuisine, protein, carbs, and preferences, the more tailored your results will be. If you want tighter control, use the Keep It Simple option to limit extra ingredients and keep the meal focused on exactly what you asked for. Each result appears as a meal card. This is where you review the meal, see macros, ingredients, and step by step instructions, and control what happens next, whether that is adding it to your day, replacing it, or generating something new. In addition to meals, every builder includes a Snack Creator, which allows you to create healthier versions of snacks based on what you are craving, so you can include snacks in your plan without working against your goals. As you build your day, you can duplicate it across the rest of the week to save time, which makes it easier to stay consistent without starting over. You can also remove meals and rebuild at any time before logging. When you create your first meal, the Shopping List button will appear so you can begin organizing your ingredients. When you are ready, you can send meals to your Shopping List or log them to Biometrics. One important note, once meals are logged to Biometrics, they cannot be removed from that page, so it is best to log meals individually instead of logging your entire day at once, especially if you plan to make changes. This is the Weekly Meal Builder. Use it to create meals the way you eat, adjust as needed, and connect everything through Biometrics and your Shopping List to see the system work. If you are a guest, building at least one meal here unlocks Fridge Rescue and Craving Creator, so focus on creating a meal you would eat and adding it to your day. One thing worth understanding about how starchy carbs are managed, the timing is intentional. Think of your body like a business. During the day it is open, running operations, and can put those carbs to work. At night it shifts into clean, repair, and reset mode. Sending starchy carbs in late can interfere with that recovery process. That is why Starch Guard concentrates them earlier in the day when possible, not as a restriction, but as a strategy you can adjust based on your training schedule and lifestyle.",
    autoClose: true,
    guestDescription:
      "Structure beats willpower. This pass counts, build the full day.",
    guestSpokenText:
      "Alright, this is your Weekly Meal Builder, and this is where your plan becomes real. Most apps give you a list of recipes, and hope you figure it out. I don’t work that way. Here, you’ll build complete meal days, breakfast, lunch, dinner, and snacks, in any cuisine, any style, any dietary need. The more specific you are, the better the result: ‘Mediterranean lunch, 50 grams of protein, low fat’ works just as well as ‘surprise me.’ As a guest, you have a limited number of meal day passes. When you enter this page without an active session, you’ll use one of those passes, but once you’re in, you have 24 hours to build, explore, come back, and build more. That’s the deal: structure beats willpower, and this is where you prove it. Take your time. Build a full day. Make it something you’d actually eat. Then send it to your shopping list, and see how everything connects.",
  },

  "/diabetic-hub": {
    pageId: "diabetic-hub",
    title: "Diabetic Hub",
    description:
      "Your control center for managing blood sugar with GlucoseGuard™ protection, clinician-style guardrails, and daily glucose tracking.",
    spokenText:
      "The Diabetic Hub is your control center for managing blood sugar day to day. Here you can set and save doctor or coach guardrails like fasting ranges, pre meal maximums, daily carb limits, fiber minimums, glycemic index caps, and meal frequency. You can log glucose readings with context like fasting, pre meal, or post meal, view your most recent reading, and track seven day trends. GlucoseGuard, your blood sugar protection system, reads your latest glucose log and automatically adjusts meal generation to match your current state. When your glucose is low, meals include more carbs to stabilize. When elevated, meals go lower carb to help bring you back into range. When you're ready to build meals, use the button at the bottom to jump into the diabetic meal builder.",
    autoClose: true,
  },

  "/diabetic-menu-builder": {
    pageId: "weekly-meal-board",
    title: "Diabetic Meal Builder",
    description:
      "Build meals that support balanced blood sugar with GlucoseGuard™ protection. Each meal slot has a My Favorites button — tap the red star to instantly reuse any saved meal with macros updated automatically. Use the 'How builders work' button on this page to watch a quick video tutorial on how to use this builder.",
    spokenText:
      "Welcome to the Diabetic Meal Builder. This builder is recommended when your onboarding indicates a need for blood sugar management, giving you a system designed to help you stay stable while still eating in a way that fits your lifestyle. Each builder serves a different purpose, but they all follow the same core system, allowing you to create meals in any cuisine or style using a flexible Meal 1, Meal 2, Meal 3 structure, with the ability to add more meals based on how you eat. At the top of the screen, you will see your daily nutrition targets, which come from the Macro Calculator and serve as your baseline for the day. At the bottom, you will see your Nutrition Budget, a real time view of what you have remaining for protein, starchy carbs, and fiber as you add meals. Just below the top section is your daily starch indicator, which shows how many starchy meals you have available based on your starch strategy, with green meaning you still have meals available and orange meaning you have already used them. Starch Guard is your built-in weight management system. It limits high glycemic carbs like rice, pasta, and potatoes, and when you have used your starch meals, it steps in and helps you substitute with fibrous carb options or lets the Chef choose for you. When you tap Create with Chef, you can describe any meal you want in any cuisine or style. You can keep it simple or be detailed, and the more specific you are, the more tailored your results will be. If you want tighter control, use the Keep It Simple option to limit extra ingredients and keep the meal focused on exactly what you asked for. Each result appears as a meal card, where you can review the meal, see macros, ingredients, and step by step instructions, and decide whether to add it to your day, replace it, or generate something new. This builder also includes GlucoseGuard, which adjusts your meals based on your most recent glucose reading. If your glucose is low, the system increases carbs to help stabilize. If your glucose is elevated, it reduces carbs to help bring you back into range. If you are in range, it keeps your meals balanced. SafetyGuard protects you from allergens and respects your dietary preferences automatically. Every builder also includes a Snack Creator, allowing you to generate healthier versions of snacks, so you can stay on plan throughout the day. As you build your day, you can duplicate it across the rest of the week to stay consistent or remove meals and rebuild at any time before logging. When you create your first meal, the Shopping List button will appear so you can begin organizing your ingredients. When you are ready, you can send meals to your Shopping List or log them to Biometrics. One important note, once meals are logged to Biometrics, they cannot be removed from that page, so it is best to log meals individually instead of logging your entire day at once, especially if you plan to make changes. Use the Diabetic Meal Builder to stay consistent, stay in range, and build meals that support your health without sacrificing flexibility. One thing worth understanding about starchy carb timing, it is intentional. Think of your body like a business. During the day it is open, running operations, and can put those carbs to work. At night it shifts into clean, repair, and reset mode. Sending starchy carbs in late can interfere with that recovery process and may affect overnight glucose stability. That is why Starch Guard concentrates them earlier in the day when possible, supporting steadier energy and glucose through the night. One more thing worth knowing. If you have other conditions beyond blood sugar management, like cardiac disease, kidney disease, thyroid concerns, or oncology support, you can activate those clinical protocols on top of this builder at the same time. Go to Edit Profile, scroll to the Clinical Support section, and tap every condition that applies to you. You can select more than one, and all of them activate together. Every meal you create here will follow all of your active clinical rules simultaneously. Your full health picture is what drives your meals, not just one condition at a time.",
    autoClose: true,
  },

  "/glp1-hub": {
    pageId: "glp1-hub",
    title: "Glp1 Hub",
    description:
      "Your GLP-1 support hub for shot tracking, guardrails, and meal readiness.",
    spokenText:
      "The GLP-1 Hub is your support center for managing care alongside GLP-1 use. Here you can review how the app supports your care, track your GLP-1 shots by dosage and injection site, and set doctor-style guardrails using quick start presets like intro/ up-titration, maintenance, refeed/ strength focus. For custom goals you can adjust targets for meal volume, protein minimums, fat limits, fiber minimums, hydration goals, meals per day, digestion support, and limits on carbonation or alcohol, then save those guardrails. When everything is set, use the button at the bottom to move into the GLP-1 meal builder.",
    autoClose: true,
  },

  "/glp1-meal-builder": {
    pageId: "weekly-meal-board",
    title: "Glp1 Meal Builder",
    description:
      "Create portion-aware meals designed to support GLP-1 goals. Each meal slot has a My Favorites button — tap the red star to instantly reuse any saved meal with macros updated automatically. Taste Memory is active — the more you save, the more the app learns your preferences. Use the 'How builders work' button on this page to watch a quick video tutorial on how to use this builder.",
    spokenText:
      "Welcome to the GLP-1 Meal Builder. This builder is recommended when your onboarding indicates GLP-1 use or goals related to appetite control, giving you a system designed to support satiety, portion control, steady energy, and protein prioritization. Each builder serves a different purpose, but they all follow the same core system, allowing you to create meals in any cuisine or style using a flexible Meal 1, Meal 2, Meal 3 structure, with the ability to add more meals based on how you eat. At the top of the screen, you will see your daily nutrition targets, which come from the Macro Calculator and serve as your baseline for the day. At the bottom, you will see your Nutrition Budget, a real time view of what you have remaining for protein, starchy carbs, and fiber as you add meals. Just below the top section is your daily starch indicator, which shows how many starchy meals you have available based on your starch strategy, with green meaning you still have meals available and orange meaning you have already used them. Starch Guard is your built-in weight management system. It limits high glycemic carbs like rice, pasta, and potatoes, and when you have used your starch meals, it steps in and helps you substitute with fibrous carb options or you can let the Chef choose for you. To start building, tap Create with Chef, our multilingual, multi-cuisine AI meal creator, and describe what you want. You can keep it simple or be detailed, and the more specific you are about portion size, protein goals, fat levels, and food texture, the more tailored your results will be. If you want tighter control, use the Keep It Simple option to limit extra ingredients and keep meals lighter and easier tolerant. Each result appears as a meal card, where you can review the meal, see macros, ingredients, and step by step instructions, and decide whether to add it to your day, replace it, or generate something new. Every meal is built to stay aligned with GLP-1 friendly guardrails, focusing on protein, manageable portions, and foods that support comfort and consistency without feeling restrictive. Every builder also includes a Snack Creator, allowing you to generate healthier versions of snacks, so you can stay on plan throughout the day. As you build your day, you can plan one day or a full week, duplicate days to stay consistent, or remove meals and rebuild at any time before logging. When you create your first meal, the Shopping List button will appear so you can begin organizing your ingredients. When you are ready, you can send meals to your Shopping List or log them to Biometrics. One important note, once meals are logged to Biometrics, they cannot be removed from that page, so it is best to log meals individually instead of logging your entire day at once, especially if you plan to make changes. SafetyGuard protects you from allergens and respects your dietary preferences automatically. Use the GLP-1 Meal Builder to create meals that work with your appetite, not against it, while keeping your nutrition consistent and sustainable. One thing worth understanding about starchy carb timing, it is intentional. Think of your body like a business. During the day it is open, running operations, and can put those carbs to work. At night it shifts into clean, repair, and reset mode. Sending starchy carbs in late can interfere with that recovery process. Concentrating them earlier also supports satiety when you need it most, during active hours. That is why Starch Guard manages their timing, not as a restriction, but as a strategy you can adjust based on your schedule and goals. One more thing worth knowing. If you have other conditions alongside GLP-1 use, like cardiac disease, kidney disease, thyroid concerns, or oncology support, you can activate those clinical protocols on top of this builder at the same time. Go to Edit Profile, scroll to the Clinical Support section, and tap every condition that applies to you. You can select more than one, and all of them activate together. Every meal you create here will follow all of your active clinical rules simultaneously. Your full health picture is what drives your meals, not just one condition at a time.",

    autoClose: true,
  },

  "/anti-inflammatory-menu-builder": {
    pageId: "anti-inflammatory-menu-builder",
    title: "Anti-Inflammatory Meal Builder",
    description:
      "Build meals focused on inflammation-friendly ingredients. Each meal slot has a My Favorites button — tap the red star to instantly reuse any saved meal with macros updated automatically. Taste Memory is active — the more you save, the more the app learns your preferences. Use the 'How builders work' button on this page to watch a quick video tutorial on how to use this builder.",
    spokenText:
      "Welcome to the Anti-Inflammatory Meal Builder. This builder is recommended when your onboarding indicates a need to reduce inflammation or support specific health conditions, giving you a system designed to improve recovery, energy, and long-term health while still allowing flexibility in how you eat. Each builder serves a different purpose, but they all follow the same core system, allowing you to create meals in any cuisine or style using a flexible Meal 1, Meal 2, Meal 3 structure, with the ability to add more meals based on how you eat. At the top of the screen, you will see your daily nutrition targets, which come from the Macro Calculator and serve as your baseline for the day. At the bottom, you will see your Nutrition Budget, a real time view of what you have remaining for protein, starchy carbs, and fiber as you add meals. Just below the top section is your daily starch indicator, which shows how many starchy meals you have available based on your starch strategy, with green meaning you still have meals available and orange meaning you have already used them. Starch Guard is your built-in weight management system. It limits high glycemic carbs like rice, pasta, and potatoes, and when you have used your starch meals, it steps in and helps you substitute with fibrous carb options or you can let the Chef choose for you. To start building, tap Create with Chef, our multilingual, multi-cuisine AI meal creator, and describe what you want. You can use Keep It Simple or be detailed, and the more specific you are about ingredients, inflammation triggers, or foods you want to avoid, the more tailored your results will be. If you want tighter control, use the Keep It Simple option to limit extra ingredients and keep meals focused on exactly what you asked for. Each result appears as a meal card, where you can review the meal, see macros, ingredients, and step by step instructions, and decide whether to add it to your day, replace it, or generate something new. This builder also includes advanced protocol support, including renal support, cardiac support, liver support, and oncology support, allowing meals to be adjusted based on more specific health needs while still following anti-inflammatory principles. Every builder also includes a Snack Creator, allowing you to generate healthier versions of snacks, so you can stay on plan throughout the day. As you build your day, you can plan one day or a full week, duplicate days to stay consistent, or remove meals and rebuild at any time before logging. When you create your first meal, the Shopping List button will appear so you can begin organizing your ingredients. When you are ready, you can send meals to your Shopping List or log them to Biometrics. One important note, once meals are logged to Biometrics, they cannot be removed from that page, so it is best to log meals individually instead of logging your entire day at once, especially if you plan to make changes. SafetyGuard protects you from allergens and respects your dietary preferences automatically. Use the Anti-Inflammatory Meal Builder to create meals that support your body, reduce stress on your system, and help you feel and perform better over time. One thing worth understanding about starchy carb timing, it is intentional. Think of your body like a business. During the day it is open, running operations, and can put those carbs to work. At night it shifts into clean, repair, and reset mode. Sending starchy carbs in late can interfere with that recovery process. Concentrating them earlier gives your body more room to repair overnight, which matters especially when reducing inflammation is your goal. This is a strategy, not a restriction. One more thing worth knowing. If you have other conditions alongside inflammation concerns, like cardiac disease, kidney disease, thyroid support, or oncology support, you can activate those clinical protocols on top of this builder at the same time. Go to Edit Profile, scroll to the Clinical Support section, and tap every condition that applies to you. You can select more than one, and all of them activate together. Every meal you create here will follow all of your active clinical rules simultaneously. Your full health picture is what drives your meals, not just one condition at a time.",

    autoClose: true,
  },

  "/beach-body-meal-board": {
    pageId: "beach-body-meal-board",
    title: "Beach Body Meal Builder",
    description:
      "Create structured meals designed for performance and body composition. Each meal slot has a My Favorites button — tap the red star to instantly reuse any saved meal with macros updated automatically. Taste Memory is active — the more you save, the more the app learns your preferences. Use the 'How builders work' button on this page to watch a quick video tutorial on how to use this builder.",
    spokenText:
      "Welcome to the Beach Body Meal Builder. This builder is recommended when your goal is to lean out, tighten up, and improve body composition, giving you a structured system designed to support fat loss, muscle tone, and performance while keeping meals realistic and sustainable. Each builder serves a different purpose, but they all follow the same core system, allowing you to create meals in any cuisine or style using a flexible Meal 1, Meal 2, Meal 3 structure, with the ability to add more meals based on how you eat. At the top of the screen, you will see your daily nutrition targets, which come from the Macro Calculator and serve as your baseline for the day. At the bottom, you will see your Nutrition Budget, a real time view of what you have remaining for protein, starchy carbs, and fiber as you add meals. Just below the top section is your daily starch indicator, which shows how many starchy meals you have available based on your starch strategy, with green meaning you still have meals available and orange meaning you have already used them. Starch Guard is your built in weight management system. It limits high glycemic carbs like rice, pasta, and potatoes, and when you have used your starch meals, it steps in and helps you substitute with fibrous carb options or lets the system choose for you. This builder also uses a structured baseline to guide your meals, typically around 30 grams of protein per meal, 25 grams of starchy carbs per meal, and about two cups of fibrous carbs, with adjustments made automatically based on your Macro Calculator targets. To start building, tap Create with Chef and describe what you want. You can keep your request simple or be very detailed, and the more specific you are about protein, carbs, and food choices, the more tailored your results will be. If you want tighter control, use the Keep It Simple feature to limit extra ingredients and keep meals focused, consistent, and easier to follow. Each result appears as a meal card, where you can review the meal, see macros, ingredients, and step by step instructions, and decide whether to add it to your day, replace it, or generate something new. Every builder also includes a Snack Creator, allowing you to create healthier versions of snacks so you can stay on plan without working against your goals. As you build your day, you can plan one day or a full week, duplicate days to stay consistent, or remove meals and rebuild at any time before logging. When you create your first meal, the Shopping List button will appear so you can begin organizing your ingredients. When you are ready, you can send meals to your Shopping List or log them to Biometrics. One important note, once meals are logged to Biometrics, they cannot be removed from that page, so it is best to log meals individually instead of logging your entire day at once, especially if you plan to make changes. SafetyGuard protects you from allergens and respects your dietary preferences automatically. Use the Beach Body Meal Builder to stay consistent, stay structured, and build meals that move your physique in the direction you want. One thing worth understanding about how starchy carbs are managed, the timing is intentional. Think of your body like a business. During the day it is open, running operations, and can put those carbs to work. At night it shifts into clean, repair, and reset mode. Sending starchy carbs in late can interfere with that recovery process. That is why Starch Guard concentrates them earlier in the day when possible, not as a restriction, but as a strategy you can adjust based on your training schedule and lifestyle.",

    autoClose: true,
  },

  "/care-team": {
    pageId: "care-team",
    title: "Care Team & Pro Care",
    description:
      "Connect with trainers, physicians, or coaches to build and manage your personal care team.",
    spokenText:
      "Care Team and ProAccess lets you connect with the people who support your goals. You can invite a trainer, physician, coach, patient, or client by email and assign their role, or join someone else’s team using an access code. Once connected, you’ll appear on each other’s active care team, making it easy to collaborate, share progress, and manage support in one place. When you’re connected to a professional, they can view and edit your weekly Meal Board directly, based on the permissions you set. You control what they can see and change, and you can update or revoke access at any time. Choose the option that fits what you want to do and get started.",
    autoClose: true,
  },

  "/pro/clients": {
    pageId: "pro-clients",
    title: "Pro Portal",
    description:
      "Your professional portal for managing clients and accessing their care dashboards.",
    spokenText:
      "The Pro Portal is where you manage your clients and care relationships. To add a new client, enter their name, then select your profession from the dropdown. Your profession determines which dashboard you’ll use, trainers go to the Trainer Dashboard with performance and competition builders, while clinical roles like doctors, nurse practitioners, physician assistants, dietitians, nutritionists, and registered nurses go to the Clinician Dashboard with diabetic, GLP-1, and anti-inflammatory builders. Once you’ve selected your profession and added the client, tap Open to access your professional dashboard, where you’ll set targets, apply protocols, and guide their nutrition plan.",
    autoClose: true,
  },

  "/pro/clients/:id": {
    pageId: "pro-client-dashboard",
    title: "Client Dashboard",
    description:
      "Set client targets, apply protocols, and guide meal generation from one dashboard.",
    spokenText:
      "The Client Dashboard is where you set and manage everything for your client. Here you can set macro targets and send them directly to the client's biometrics, apply focus options like high protein, carb cycling, or anti inflammatory protocols, and define carb directives such as starchy and fibrous carb targets. You can save these parameters, add coach or physician notes, and then move into the appropriate meal builders to generate meals that follow the guardrails you've set.",
    autoClose: true,
  },

  "/pro/clients/:id/trainer": {
    pageId: "pro-trainer-dashboard",
    title: "Trainer Dashboard",
    description:
      "Set macro targets, choose the Starch Game Plan, assign meal builders, and guide performance nutrition for your client.",
    spokenText:
      "Welcome to the Trainer Dashboard. This is your client control center, where you set everything that drives their nutrition. Start with macro targets, protein, starchy carbs, fibrous carbs, and fat. Then choose the Starch Game Plan. One Starch Meal concentrates all starchy carbs into a single meal for appetite control and fat loss. Flex Split divides starchy carbs across two meals for more flexibility. Remember, fibrous carbs like vegetables are always unlimited. You can also view and edit your client’s weekly Meal Board directly, add meals, remove items, or repeat a day’s meals across the week. Every change is tracked so the client always knows who updated their plan. When you’re ready, assign a meal builder, General Nutrition for balanced everyday meals, or Performance and Competition for athletes and high-output clients. Finally, use the builder shortcuts to jump directly into meal generation for your client.",
    autoClose: true,
  },

  "/profile/edit-step-1": {
    pageId: "edit-profile-step-1",
    title: "Edit Profile, Personal Info",
    description:
      "Update your name and email. This is the foundation of your profile.",
    spokenText:
      "This is where you update your personal information, your name and email. These details help personalize your experience and keep your account secure. Make any changes you need, then continue to the next step.",
    autoClose: true,
  },

  "/profile/edit-step-2": {
    pageId: "edit-profile-step-2",
    title: "Edit Profile, Goals & Activity",
    description:
      "Set your fitness goal and activity level. These shape how your nutrition targets are calculated.",
    spokenText:
      "This step is about your goals and activity level. Your fitness goal, whether that's weight loss, muscle gain, maintenance, or endurance, combined with how active you are, directly shapes your daily nutrition targets. Choose what fits your current lifestyle, and we'll build around that.",
    autoClose: true,
  },

  "/profile/edit-step-3": {
    pageId: "edit-profile-step-3",
    title: "Edit Profile, Allergy & Safety",
    description:
      "Configure your allergies and SafetyGuard protection. Your Safety PIN protects these settings.",
    spokenText:
      "This is where you set up SafetyGuard, Allergy Protection, My Perfect Meals' built-in two-layer safety system designed to prevent meals from being created with ingredients you've marked as unsafe. The first layer is established during onboarding and profile setup, where your allergies and restrictions are saved and hard-wired into the meal generator so unsafe ingredients are blocked before a meal can even be generated. The second layer operates inside the meal builders themselves, meaning that even if an unsafe ingredient is typed or requested directly, the builder will still block it from being included. On top of these protections, SafetyGuard includes a controlled override system that requires your Safety PIN and applies to one meal only, automatically turning protection back on afterward so no other meals are affected and nothing can be disabled accidentally or globally.",
    autoClose: true,
  },

  "/profile/edit-step-4": {
    pageId: "edit-profile-step-4",
    title: "Edit Profile, Review & Save",
    description: "Review your changes and save your updated profile.",
    spokenText:
      "This is your final review. Take a moment to double-check everything, your name, goals, activity level, dietary restrictions, and allergies. When you're ready, save your changes and they'll take effect immediately across the app.",
    autoClose: true,
  },

  "/pro/clients/:id/diabetic-builder": {
    pageId: "procare-diabetic-builder",
    title: "ProCare Diabetic Meal Builder",
    description:
      "Build diabetic-friendly meals for your client using clinician-defined guardrails.",
    spokenText:
      "Welcome to the ProCare Diabetic Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for your client using the targets, protocols, and clinical guidelines you’ve already defined. Use Create with Chef to describe meals and snacks, or the A.I. Meal Creator to guide ingredient-level choices. You can plan one day or multiple days, structure each day as needed, and stay flexible while remaining inside the approved medical framework. Build breakfast, lunch, dinner, and snacks by adjusting the meals themselves, not traditional serving math. Prep options help control preparation methods and dial in targets like protein so meals remain compliant. If you’re a client, this is where you build meals using your coach’s or physician’s settings, follow the targets shown at the bottom of the screen as you create your day. As you build, focus on protein and carbs, those drive energy, glucose response, and daily control. Calories and fats still matter, but they play a supporting role. When you’re finished, save your day to Biometrics, send ingredients to the shopping list, or do both. When you’re ready, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/pro/clients/:id/glp1-builder": {
    pageId: "procare-glp1-builder",
    title: "ProCare GLP-1 Meal Builder",
    description:
      "Create GLP-1–aligned meals for your client using appetite-aware guardrails.",
    spokenText:
      "Welcome to the ProCare GLP-1 Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for a client using the targets, protocols, and clinical guidelines you’ve already defined. Use Create with Chef to describe meals and snacks, or the A.I. Meal Creator to guide ingredient-level choices. Choose how many days you want to plan and how each day should be structured, allowing flexibility while staying aligned with GLP-1 goals like satiety, protein prioritization, and meal consistency. Build breakfast, lunch, dinner, and snacks by adjusting the meals themselves, not traditional serving manipulation. Prep options help control preparation and dial in targets like protein to support fullness and adherence. If you’re a client, follow the targets shown at the bottom of the screen as you create your day using Create with Chef. As you build, focus on protein and carbs, those drive satiety, energy stability, and lean tissue support. Calories and fats still matter, but they play a supporting role. When you’re finished, save your day to Biometrics, send ingredients to the shopping list, or do both. When you’re ready, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/pro/clients/:id/anti-inflammatory-builder": {
    pageId: "procare-anti-inflammatory-builder",
    title: "ProCare Anti-Inflammatory Meal Builder",
    description:
      "Build inflammation-conscious meals for your client using targeted guardrails.",
    spokenText:
      "Welcome to the ProCare Anti-Inflammatory Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for a client using the targets, protocols, and clinical guidelines you’ve already defined. Use Create with Chef to describe meals and snacks, or the A.I. Meal Creator to guide ingredient-level choices. Choose how many days you want to plan and how each day should be structured, allowing flexibility while staying aligned with anti-inflammatory goals like nutrient quality, food variety, and consistency. Build breakfast, lunch, dinner, and snacks by adjusting the meals themselves, not traditional serving manipulation. Prep options help control preparation methods and support anti-inflammatory strategies like ingredient selection and protein targets. If you’re a client, follow the targets shown at the bottom of the screen as you create your day using Create with Chef. As you build, focus on protein and carbs, those drive recovery, energy stability, and tissue repair. Calories and fats still matter, but they play a supporting role. When you’re finished, save your day to Biometrics, send ingredients to the shopping list, or do both. When you’re ready, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/performance-competition-builder": {
    pageId: "performance-competition-builder-athlete",
    title: "Performance & Competition Meal Builder",
    description:
      "Build precision performance meals for training and competition. Each meal slot has a My Favorites button — tap the red star to instantly reuse any saved meal with macros updated automatically. Taste Memory is active — the more you save, the more the app learns your preferences. Use the 'How builders work' button on this page to watch a quick video tutorial on how to use this builder.",
    spokenText:
      "Welcome to the Performance and Competition Meal Builder. This builder is designed for athletes who are in training, preparing competition, or following a structured performance plan, and it is typically used within ProCare by a coach or professional to guide your nutrition. While you may not be building everything yourself, this is the system being used to structure your meals based on your training demands and goals. Each builder serves a different purpose, but they all follow the same core system, allowing meals to be built using a flexible Meal 1, Meal 2, Meal 3 structure, with the ability to add more meals based on your schedule and training needs. At the top of the screen, you will see your daily nutrition targets, which come from the Macro Calculator and serve as your baseline. At the bottom, you will see your Nutrition Budget, showing what remains for protein, starchy carbs, and fiber as meals are added. Just below the top section is your daily starch indicator, which reflects your starch strategy, with green meaning meals available and orange meaning they have been used. Starch Guard is your built-in weight management system. It limits high glycemic carbs like rice, pasta, and potatoes, and when starch meals are used, it shifts the focus toward fibrous carb options or allows the system to adjust. To build meals, your coach or provider uses Create with Chef to describe exactly what is needed, including cuisine, protein levels, carb structure, and timing around training. Requests can be simple or highly detailed, and for tighter control, the Keep It Simple feature can be used to limit extra ingredients and keep meals precise and consistent. Each result appears as a meal card, where meals can be reviewed, including macros, ingredients, and step by step instructions, and then adjusted, replaced, or added to your day. Every builder also includes a Snack Creator, allowing structured snack options that support performance without disrupting the plan. As meals are built, the focus stays on protein and carbohydrates, since they drive energy availability, recovery, and performance output, while fats are adjusted around those priorities. Days can be structured around training, duplicated for consistency, or adjusted as needed before logging. When meals are created, the Shopping List becomes available to organize ingredients, and once ready, meals can be logged to Biometrics or finalized. One important note, once meals are logged to Biometrics, they cannot be removed from that page, so adjustments should be made before logging, or meals should be logged individually if changes are expected. SafetyGuard protects against allergens and respects all dietary preferences automatically. Use the Performance and Competition Meal Builder as a structured system to support high level training, recovery, and results, whether you are working directly with a coach or following a guided plan.",
    autoClose: true,
  },

  "/pro/performance-competition-builder": {
    pageId: "pro-performance-competition-builder-standalone",
    title: "Performance & Competition Meal Builder",
    description:
      "Build precision performance meals for training and competition. Each meal slot has a My Favorites button — tap the red star to instantly reuse any saved meal with macros updated automatically.",
    spokenText:
      "Welcome to the Performance and Competition Meal Builder. This builder is designed for athletes who are in training, preparing competition, or following a structured performance plan, and it is typically used within ProCare by a coach or professional to guide your nutrition. While you may not be building everything yourself, this is the system being used to structure your meals based on your training demands and goals. Each builder serves a different purpose, but they all follow the same core system, allowing meals to be built using a flexible Meal 1, Meal 2, Meal 3 structure, with the ability to add more meals based on your schedule and training needs. At the top of the screen, you will see your daily nutrition targets, which come from the Macro Calculator and serve as your baseline. At the bottom, you will see your Nutrition Budget, showing what remains for protein, starchy carbs, and fiber as meals are added. Just below the top section is your daily starch indicator, which reflects your starch strategy, with green meaning meals available and orange meaning they have been used. Starch Guard is your built-in weight management system. It limits high glycemic carbs like rice, pasta, and potatoes, and when starch meals are used, it shifts the focus toward fibrous carb options or allows the system to adjust. To build meals, your coach or provider uses Create with Chef to describe exactly what is needed, including cuisine, protein levels, carb structure, and timing around training. Requests can be simple or highly detailed, and for tighter control, the Keep It Simple feature can be used to limit extra ingredients and keep meals precise and consistent. Each result appears as a meal card, where meals can be reviewed, including macros, ingredients, and step by step instructions, and then adjusted, replaced, or added to your day. Every builder also includes a Snack Creator, allowing structured snack options that support performance without disrupting the plan. As meals are built, the focus stays on protein and carbohydrates, since they drive energy availability, recovery, and performance output, while fats are adjusted around those priorities. Days can be structured around training, duplicated for consistency, or adjusted as needed before logging. When meals are created, the Shopping List becomes available to organize ingredients, and once ready, meals can be logged to Biometrics or finalized. One important note, once meals are logged to Biometrics, they cannot be removed from that page, so adjustments should be made before logging, or meals should be logged individually if changes are expected. SafetyGuard protects against allergens and respects all dietary preferences automatically. Use the Performance and Competition Meal Builder as a structured system to support high level training, recovery, and results, whether you are working directly with a coach or following a guided plan.",
    autoClose: true,
  },

  "/pro/general-nutrition-builder": {
    pageId: "pro-general-nutrition-builder-standalone",
    title: "General Nutrition Meal Builder",
    description:
      "Build balanced, everyday meals for sustainable nutrition. Each meal slot has a My Favorites button — tap the red star to instantly reuse any saved meal with macros updated automatically. Taste Memory is active — the more you save, the more the app learns your preferences. Use the 'How builders work' button on this page to watch a quick video tutorial on how to use this builder.",
    spokenText:
      "Welcome to the General Nutrition Meal Builder. This builder is used within ProCare as you go to system for every day, sustainable nutrition, designed for individuals who do not require a specialty or medical based approach, but still want structure, consistency, and results. While it works the same way as the Weekly Meal Builder, this version is typically guided by a coach or professional to help you stay aligned with your goals. Each builder serves a different purpose, but they all follow the same core system, allowing you to create meals in any cuisine or style using a flexible Meal 1, Meal 2, Meal 3 structure, with the ability to add more meals based on how you eat. At the top of the screen, you will see your daily nutrition targets, which come from the Macro Calculator and serve as your baseline for the day. At the bottom, you will see your Nutrition Budget, a real time view of what you have remaining for protein, starchy carbs, and fiber as meals are added. Just below the top section is your daily starch indicator, which reflects your starch strategy, with green meaning meals available and orange meaning they have been used. Starch Guard is your built-in weight management system. It limits high glycemic carbs like rice, pasta, and potatoes, and when starch meals are used, it shifts the focus toward fibrous carb options or allows the system to adjust. To build meals, tap Create with Chef and describe what you want. You can keep your request simple or be detailed, and the more specific you are about protein, carbs, and food preferences, the more tailored your results will be. If you want tighter control, use the Keep It Simple feature to limit extra ingredients and keep meals consistent and easy to follow. Each result appears as a meal card, where you can review the meal, see macros, ingredients, and step by step instructions, and decide whether to add it to your day, replace it, or generate something new. Every builder also includes a Snack Creator, allowing you to create healthier snack options that fit your plan. As you build your day, you can plan one day or a full week, duplicate days to stay consistent, or remove meals and rebuild at any time before logging. When you create your first meal, the Shopping List button will appear so you can begin organizing your ingredients. When you are ready, you can send meals to your Shopping List or log them to Biometrics. One important note, once meals are logged to Biometrics, they cannot be removed from that page, so it is best to log meals individually instead of logging your entire day at once, especially if you plan to make changes. SafetyGuard protects you from allergens and respects your dietary preferences automatically. Use the General Nutrition Meal Builder as your foundation for consistent, sustainable eating, whether you are following guidance from a coach or building habits that last long term.",
    autoClose: true,
  },

  "/pro/clients/:id/performance-competition-builder": {
    pageId: "procare-performance-competition-builder",
    title: "ProCare Performance & Competition Meal Builder",
    description:
      "Create precision-based performance meals for your client using competition-level guardrails. The starch indicator shows daily starch meal status, green means slots available, orange means they're covered for the day.",
    spokenText:
      "Welcome to the Performance and Competition Meal Builder. This builder is designed for athletes who are in training, preparing competition, or following a structured performance plan, and it is typically used within ProCare by a coach or professional to guide your nutrition. While you may not be building everything yourself, this is the system being used to structure your meals based on your training demands and goals. Each builder serves a different purpose, but they all follow the same core system, allowing meals to be built using a flexible Meal 1, Meal 2, Meal 3 structure, with the ability to add more meals based on your schedule and training needs. At the top of the screen, you will see your daily nutrition targets, which come from the Macro Calculator and serve as your baseline. At the bottom, you will see your Nutrition Budget, showing what remains for protein, starchy carbs, and fiber as meals are added. Just below the top section is your daily starch indicator, which reflects your starch strategy, with green meaning meals available and orange meaning they have been used. Starch Guard is your built-in weight management system. It limits high glycemic carbs like rice, pasta, and potatoes, and when starch meals are used, it shifts the focus toward fibrous carb options or allows the system to adjust. To build meals, your coach or provider uses Create with Chef to describe exactly what is needed, including cuisine, protein levels, carb structure, and timing around training. Requests can be simple or highly detailed, and for tighter control, the Keep It Simple feature can be used to limit extra ingredients and keep meals precise and consistent. Each result appears as a meal card, where meals can be reviewed, including macros, ingredients, and step by step instructions, and then adjusted, replaced, or added to your day. Every builder also includes a Snack Creator, allowing structured snack options that support performance without disrupting the plan. As meals are built, the focus stays on protein and carbohydrates, since they drive energy availability, recovery, and performance output, while fats are adjusted around those priorities. Days can be structured around training, duplicated for consistency, or adjusted as needed before logging. When meals are created, the Shopping List becomes available to organize ingredients, and once ready, meals can be logged to Biometrics or finalized. One important note, once meals are logged to Biometrics, they cannot be removed from that page, so adjustments should be made before logging, or meals should be logged individually if changes are expected. SafetyGuard protects against allergens and respects all dietary preferences automatically. Use the Performance and Competition Meal Builder as a structured system to support high level training, recovery, and results, whether you are working directly with a coach or following a guided plan.",
    autoClose: true,
  },

  "/pro/clients/:id/general-nutrition-builder": {
    pageId: "procare-general-nutrition-builder",
    title: "ProCare General Nutrition Meal Builder",
    description:
      "Build balanced, everyday meals for your client using flexible nutrition guardrails. The starch indicator shows daily starch meal status, green means slots available, orange means they're covered for the day.",
    spokenText:
      "Welcome to the ProCare General Nutrition Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for a client using the nutrition targets, protocols, and guidelines you’ve already defined. Use Create with Chef to describe meals and snacks, or the AI Meal Creator to guide ingredient-level choices. Choose how many days you want to plan and how each day should be structured, allowing flexibility while staying aligned with the overall nutrition framework. Pay attention to the starch indicator, green means starch slots available, orange means they're covered for today. Remember, fibrous carbs like vegetables are unlimited and should be encouraged, while starchy carbs are managed using the Starch Game Plan set in the Trainer Dashboard, either One Starch Meal or Flex Split. As you build, focus on protein and carbs, those drive energy, recovery, and nutritional balance. When you’re finished, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/pro/clients/:clientId/board/:program": {
    pageId: "pro-board-viewer",
    title: "Shared Meal Board",
    description:
      "View and edit your client's or patient's Shared Meal Board. Changes are permission-controlled and tracked by who made them.",
    spokenText:
      "This is the Shared Meal Board. You're viewing your client's or patient's Meal Board directly. Use the day tabs to navigate between days, and you'll see meals organized by slot, breakfast, lunch, dinner, and snacks. If you have edit permissions, you can remove meals or copy an entire day's plan across the whole week. Every change you make is saved directly to their board and tracked, they'll always know who updated their plan last. The amber banner at the top confirms you're editing their board, not your own. Your access level depends on the permissions the client has granted you.",
    autoClose: true,
  },

  "/select-builder": {
    pageId: "select-builder",
    title: "Meal Builder Exchange",
    description:
      "Switch meal boards as your needs change, whether you're graduating from ProCare, following a medical plan, or simplifying long-term.",
    spokenText:
      "Meal Builder Exchange is where you switch Meal Builders when your medical needs, goals, or coaching situation changes. If a clinician updates your care, like a new Diabetes diagnosis, or a change in status, you can switch to the appropriate clinical builder, so your meals follow the right rules automatically. If you’re working with a coach or trainer in ProCare, you may be placed into a specific program-based builder for a limited phase. When that program ends, you can continue independently by switching out of the coaching-only builder, while keeping a builder that fits your lifestyle. If you’re on General Nutrition, you can stay there long-term, or switch to Weekly Meal Builder, they’re built to feel the same for everyday use. Clinical builders like Diabetes can also stay active even after you stop working with a clinician, because the app is designed to help you maintain results long after professional care ends.",
    autoClose: true,
  },

  "/privacy": {
    pageId: "privacy",
    title: "Privacy & Security",
    description:
      "Manage your privacy settings, data preferences, and account security options.",
    spokenText:
      "This is your Privacy and Security page. Here you can review how your data is handled, manage your privacy preferences, and control what information is stored. My Perfect Meals takes your privacy seriously, your health data, meal plans, and personal information are protected and never sold to third parties. You can also find information about how to request your data or delete your account if needed.",
    autoClose: true,
  },

  "/pricing": {
    pageId: "pricing",
    title: "Subscription",
    description:
      "View your current plan, explore upgrade options, and manage your billing.",
    spokenText:
      "This is your Subscription page. Here you can see your current plan, explore what's included at each tier, and manage your billing. My Perfect Meals offers flexible plans to fit your needs, from individual meal planning to family options and professional coaching support. If you need to change your plan or update payment information, you can do it right here.",
    autoClose: true,
  },

  "/learn": {
    pageId: "learn",
    title: "App Library",
    description:
      "Learn how the app works, discover Taste Memory and how the app personalizes over time, and explore Copilot walkthroughs.",
    spokenText:
      "Welcome to the App Library. This is the brain of My Perfect Meals, where every system in the app is explained in a way that helps you understand how everything works together. If something ever feels unclear or you want to know why the app is guiding you a certain way, this is where you come to find the answer. A great place to start is the first topic, Why My Perfect Meals Exists, which walks you through the thinking behind the app and why it was built differently. From there, you can explore topics like Starch Guard and how it manages high glycemic carbs, SafetyGuard and how allergy protection works, GlucoseGuard for blood sugar control, the Nutrition Budget and how it tracks what you have left in your day, Keep It Simple for tighter ingredient control, Palate Preferences for dialing in flavor, the Culture Intelligence System and how your food culture shapes every meal and drink the app creates for you, ProCare for working with coaches and professionals, and more. One topic I especially want you to find is Taste Memory, which explains how the app learns your preferences over time and uses them to personalize every meal it generates for you. The more you save and log, the more the app starts to feel like it already knows what you want before you ask. Every section includes both a Read and Listen option, so you can either go through it at your own pace, or have it narrated to you, making it easy to learn without stopping what you are doing. This is not a page about tracking food. This is where you learn why the system works, so you can trust it and use it with confidence.",
    autoClose: true,
  },

  "/founders": {
    pageId: "founders",
    title: "About My Perfect Meals",
    description:
      "Meet the founders and learn about the mission behind My Perfect Meals.",
    spokenText:
      "This is our About page. Here you'll learn about the people behind My Perfect Meals and why we built this app. Our mission is simple: help you understand where your calories come from and make healthy eating practical, not complicated. We believe nutrition should be personalized, accessible, and based on real science, not fads or restrictions. Thank you for being part of our community.",
    autoClose: true,
  },

  "/terms": {
    pageId: "terms",
    title: "Terms of Service",
    description: "Review the terms and conditions for using My Perfect Meals.",
    spokenText:
      "This is our Terms of Service page. Here you can review the legal terms and conditions that govern your use of My Perfect Meals. This includes information about your rights as a user, our responsibilities as a service provider, and the guidelines for using the app. If you have questions about any of the terms, you can always reach out to our support team.",
    autoClose: true,
  },

  "/guest-builder": {
    pageId: "guest-builder",
    title: "MPM Guest Experience",
    description:
      "Try our AI-powered meal planning tools, no account required. Find your macros, create meals, rescue your fridge, or satisfy a craving.",
    spokenText:
      "Hey, welcome to the My Perfect Meals Guest Experience, I’m really glad you’re here. Before we start, let me introduce myself. I’m Chef Copilot, your personal guide inside this app. You’ll find me in the bottom navigation bar, look for the Chef button in the center of the bottom navigation. Anytime you’re on any page and want to know what it does, or how to use it, just tap the Chef button, then hit Listen, and I’ll explain exactly what you’re looking at and what to do next. If you turn Auto on inside the Copilot panel, I’ll automatically explain each page as you move through the app. If Auto is off, I stay quiet until you ask. You’re always in control. Now, let’s talk about what you’re here to do. This is a guided preview of how the app works, and I’ll walk you through it step by step, so you actually get the full experience instead of guessing where to start. As a guest, you’ll begin with the Macro Calculator to set your personal numbers, that’s the foundation for everything else in the app. You may notice that some features, like the Weekly Meal Builder, Fridge Rescue, and Craving Creator, aren’t fully open yet, and that’s intentional. Once you finish your macros and build your first meals, those tools unlock so you can see how everything connects. Guest Mode gives you a few meal day passes to try the real workflow, setting your numbers, building meals, and seeing how meals, biometrics, and shopping all work together, without needing an account. Remember, I’m always here in the bottom navigation bar under Guide if you need me. Let’s start by setting your macros, and take it from there.",
    autoClose: false,
  },
  "/lifestyle/chefs-kitchen": {
    pageId: "chefs-kitchen-studio",
    title: "Chef’s Kitchen",
    description:
      "A creative, hands-on cooking experience where you build a dish from idea to plate with step-by-step guidance.",
    spokenText:
      "Hey, welcome to my kitchen. Come on in. This is where we stop worrying about labels, rules, or perfect diets and just have fun with food. You bring the idea, the craving, or even just the mood, and we'll build something real together. I'll walk you through it step by step: what you're making, how you want to cook it, how many people you're cooking for and how much time you want to spend. And here's the signature move, you can do this hands-free. Tap the floating Chef and just talk. I'll guide you step by step and cook the meal with you.",
    autoClose: true,
  },

  "/lifestyle/sushi-creator": {
    pageId: "sushi-creator",
    title: "Sushi Creator",
    description:
      "Build healthier sushi rolls, bowls, and Japanese-inspired dishes tailored to your nutrition goals and dietary profile.",
    spokenText:
      "Welcome to the Sushi Creator. This is where you build healthier versions of the sushi and Japanese dishes you love. Whether you are craving a classic roll, a poke bowl, or something more creative, just describe what you want and the system takes care of the rest. Every creation is built around your nutrition goals, so macros, calories, and protein are all part of the equation. Your dietary profile travels with you here, so allergies, restrictions, and health settings are all respected automatically. If you have saved a food culture in your profile, it will guide the ingredient choices and cooking style the app uses. You can adjust your servings, save anything you enjoy, and add it straight to your meal plan or shopping list. Just describe your craving, set your servings, and tap Create.",
    autoClose: true,
  },

  "/sushi-creator": {
    pageId: "sushi-creator-alt",
    title: "Sushi Creator",
    description:
      "Build healthier sushi rolls, bowls, and Japanese-inspired dishes tailored to your nutrition goals and dietary profile.",
    spokenText:
      "Welcome to the Sushi Creator. This is where you build healthier versions of the sushi and Japanese dishes you love. Whether you are craving a classic roll, a poke bowl, or something more creative, just describe what you want and the system takes care of the rest. Every creation is built around your nutrition goals, so macros, calories, and protein are all part of the equation. Your dietary profile travels with you here, so allergies, restrictions, and health settings are all respected automatically. If you have saved a food culture in your profile, it will guide the ingredient choices and cooking style the app uses. You can adjust your servings, save anything you enjoy, and add it straight to your meal plan or shopping list. Just describe your craving, set your servings, and tap Create.",
    autoClose: true,
  },

  "/kitchens": {
    pageId: "kitchen-network-hub",
    title: "The Kitchen Network",
    description:
      "Discover Signature Kitchens built by real chefs and culinary creators. Every kitchen extends a chef's actual style into personalized meals — shaped by their flavors and techniques, adapted to your health goals.",
    spokenText:
      "Welcome to The Kitchen Network. This is where culinary identity meets adaptive personalization inside My Perfect Meals. Signature Kitchens are branded culinary spaces built by real chefs, coaches, and food creators — people whose culinary voice is now embedded into the platform. When you cook inside a Signature Kitchen, every meal you generate is shaped by that chef's actual style — their flavors, their techniques, their philosophy — adapted to your dietary needs and health goals at the same time. You can browse the available kitchens, explore a chef's signature library, and generate personalized dishes in their voice. Your health protocols are always respected, no matter whose kitchen you are cooking in — allergies, dietary restrictions, and clinical guidelines travel with you everywhere in the platform. If you are a chef or culinary creator, tap Start Here to take the Inside the Kitchen Network walkthrough — a guided experience that shows you exactly how Signature Kitchens work, how chef identity scales digitally, and how to open your own.",
    autoClose: true,
  },

  "/kitchen/:slug": {
    pageId: "signature-kitchen",
    title: "Signature Kitchen",
    description:
      "You are inside a Signature Kitchen. Browse the chef's library, explore their collections, and generate personalized meals in their culinary style.",
    spokenText:
      "You are now inside a Signature Kitchen. This is a branded culinary space built around a real chef's identity — their dishes, their techniques, their flavor philosophy. You can browse the chef's signature library to explore the dishes and recipes that define their style. If you see collections, those are curated groupings the chef has organized around themes, occasions, or ingredients. When you are ready to create, tap Create With Chef to generate a personalized meal in this kitchen's style. The platform will honor your dietary restrictions, allergies, and health protocols automatically — the chef's style influences the flavor and technique, while your personal settings keep everything safe and relevant to your goals.",
    autoClose: true,
  },

  "/recipe-scan": {
    pageId: "recipe-scan",
    title: "Recipe Scan",
    description:
      "Scan any meal idea — camera, voice, or text — and we'll personalize it for you.",
    spokenText:
      "Recipe Scan is one of the most powerful tools in the app. Here is how it works now. You see food somewhere — a TikTok, an Instagram save, a Pinterest board, a cookbook, a restaurant menu — and instead of bookmarking it and forgetting it, you bring it directly into My Perfect Meals. You have four ways to capture it: Choose Photo lets you pick any screenshot or saved image from your gallery. Camera opens your device live so you can point it at anything in front of you. Speak lets you describe the meal out loud. Type lets you paste or write a description. After you bring in your idea, the app takes you to a quick settings screen before generating anything. Here you choose your servings — from just yourself up to a meal prep batch of six. You pick an adaptation style: Authentic keeps it close to the original, Balanced personalizes it to your profile, and Healthier pushes the nutrition hard. You set your protein level — standard, high protein, or athlete. You choose whether you want original prep or a simplified easy prep version. And you can switch the cuisine entirely if you want, say, a Thai version of an Italian dish. Once you tap Generate, the system runs your idea through the full meal generation pipeline — the same engine that powers every creator in the app — applying your complete nutritional profile, allergies, dietary identity, medical conditions, and everything from your onboarding on top of your chosen settings. The result comes back as a preview. You see the full meal card with macros, ingredients, and protocol tags before anything is saved. If you like it, tap Save to My Inspirations and it goes to your Favorites. If you want to adjust something, tap Regenerate, change one setting, and generate again. Nothing saves until you decide it is right.",
    autoClose: true,
  },
};

export function getPageExplanation(pathname: string): PageExplanation | null {
  // First try exact match
  if (PAGE_EXPLANATIONS[pathname]) {
    return PAGE_EXPLANATIONS[pathname];
  }

  // Try pattern matching for dynamic routes (e.g., /pro/clients/:id)
  for (const [pattern, explanation] of Object.entries(PAGE_EXPLANATIONS)) {
    if (pattern.includes(":")) {
      // Convert pattern to regex: /pro/clients/:id -> /pro/clients/[^/]+
      // But ensure exact match: /pro/clients/:id should NOT match /pro/clients/:id/something
      const regexPattern = pattern.replace(/:[\w]+/g, "[^/]+");
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(pathname)) {
        return explanation;
      }
    }
  }

  return null;
}

/**
 * Get page explanation with guest-specific marketing copy when in guest mode.
 * This returns a modified explanation with guestSpokenText and guestDescription
 * replacing the default text when available.
 *
 * IMPORTANT: Guest Experience = Guided, Coach-Led Marketing Experience
 *, Copilot is the voice, coaching philosophy, and closer
 *, Guest copilots teach, coach, and sell the value in real time
 *, Tone = calm, confident, coach-led (not tooltip-y)
 */
export function getGuestPageExplanation(
  pathname: string,
  isGuest: boolean,
): PageExplanation | null {
  // Path aliases for routes that have multiple names
  const pathAliases: Record<string, string> = {
    "/shopping-list": "/shopping-list-v2",
  };

  const normalizedPath = pathAliases[pathname] || pathname;
  const base = getPageExplanation(normalizedPath);
  if (!base) return null;

  // If not in guest mode, return the standard explanation
  if (!isGuest) return base;

  // If guest-specific copy exists, use it
  if (base.guestSpokenText || base.guestDescription) {
    return {
      ...base,
      spokenText: base.guestSpokenText || base.spokenText,
      description: base.guestDescription || base.description,
    };
  }

  return base;
}

export function hasPageExplanation(pathname: string): boolean {
  return getPageExplanation(pathname) !== null;
}

const BUILDER_ROUTES = [
  "/weekly-meal-board",
  "/diabetic-menu-builder",
  "/glp1-meal-builder",
  "/anti-inflammatory-menu-builder",
  "/beach-body-meal-board",
  "/pro/clients/:id/diabetic-builder",
  "/pro/clients/:id/glp1-builder",
  "/pro/clients/:id/anti-inflammatory-builder",
  "/pro/clients/:id/performance-competition-builder",
  "/pro/clients/:id/general-nutrition-builder",
];

const MACRO_ASTERISK_EXPLANATION =
  " Protein and Carbs are marked with an asterisk because they're your primary focus macros and have the biggest impact on energy, performance, and body composition.";

export function isBuilderRoute(pathname: string): boolean {
  for (const pattern of BUILDER_ROUTES) {
    if (pattern.includes(":")) {
      const regexPattern = pattern.replace(/:[\w]+/g, "[^/]+");
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(pathname)) return true;
    } else if (pathname === pattern) {
      return true;
    }
  }
  return false;
}

export function getPageExplanationWithAsterisk(
  pathname: string,
): PageExplanation | null {
  const base = getPageExplanation(pathname);
  if (!base) return null;

  if (isBuilderRoute(pathname)) {
    return {
      ...base,
      description: base.description + MACRO_ASTERISK_EXPLANATION,
      spokenText: base.spokenText + MACRO_ASTERISK_EXPLANATION,
    };
  }

  return base;
}
