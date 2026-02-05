export interface PageExplanation {
  pageId: string;
  title: string;
  description: string;
  spokenText: string;
  autoClose: boolean;
  // Guest-specific marketing copy - used when in guest mode for onboarding/sales
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
      "Welcome to My Perfect Meals. I’m Chef Copilot — your coach in your pocket — here to guide you through the app hands-free or whenever you need help, and you can turn me on or off using the Auto toggle in the Copilot bar. You’re on your dashboard, your home base for accessing meal tools, planning features, and app resources, with buttons that take you to things like your planner, shopping list, nutrition utilities, inspiration, and reference information. Tap the gear icon in the top-right to manage your account, switch meal builders, adjust settings, and review app information. Chef Studio is where you can freely explore, experiment, and generate meals, and when you’re building, starting broad works great, but the more specific you are, the more tailored your results will be. My Perfect Meals is powered by Emotion AI — our conversational meal creation system that lets you describe what you want and get personalized results. It also includes SafetyGuard — Allergy Protection — our two-layer system that helps prevent meals from being generated with ingredients you've marked as unsafe. And for diabetic users, GlucoseGuard adjusts meal generation based on your latest glucose reading — helping keep blood sugar in check automatically. Your Palate Preferences let you customize seasoning and flavor — spice tolerance, seasoning intensity, and flavor style — so every meal fits your taste without changing your macros. When you’re ready, set your targets in the Macro Calculator, and from there I’ll guide you step by step through meals, boards, and tools, with Copilot on or off — your call.",
    autoClose: true,
  },

  "/my-biometrics": {
    pageId: "my-biometrics",
    title: "My Biometrics",
    description:
      "Your daily control panel. Scan food labels with MacroScan, log meals instantly, add extra macros when needed, and track calories, weight, and water over time.",
    spokenText:
      "My Biometrics is your tracking and review center. Your daily macro targets live at the top of this page, and stay persistent until you recalculate them in the Macro Calculator. You can log packaged foods using MacroScan by taking a photo of a nutrition label, review the AI-read values, and add them to your day. This page also shows your daily, weekly, and monthly macro totals, your weight trends over time, and your daily water intake. Use Biometrics to monitor progress, not plan your meals — it’s where everything comes together, so you can see how you’re doing. For guests, Biometrics is where you review what you’ve built, and once your meals are set, this page helps you understand how everything connects.",
    autoClose: true,
    guestDescription:
      "This is where food turns into numbers, and numbers turn into feedback. Your personal progress lens.",
    guestSpokenText:
      "This is your Biometrics page — and this is where food turns into data. Most people eat without ever knowing what’s actually working. Here, you’ll see exactly how your meals add up — protein, carbs, fat, calories — all in one place. You can scan packaged food labels, log meals you’ve built, and watch your weekly and monthly trends unfold. This isn’t just tracking — it’s feedback. It’s the difference between hoping your plan works, and actually knowing it does. For subscribers, this page becomes your personal progress lens — weight trends, water intake, macro consistency over time. It’s where the system closes the loop. You’ve made it through your first full loop of the Guest Suite — nicely done. Head back to the Guest Suite now, and you’ll find Fridge Rescue and Craving Creator unlocked and waiting for you. Those are free to explore, so go play with them. I’ll be here when you’re ready.",
  },

  "/craving-creator": {
    pageId: "craving-creator-studio",
    title: "Craving Creator",
    description:
      "Create healthier versions of the foods you crave — and add them directly to your meal plan.",
    spokenText:
      "Craving Creator is for those moments when you want something specific, but still want it to fit your goals. Just tell me what you’re craving — sweet, crunchy, creamy, or anything else. Add any preferences or restrictions, choose how many servings you want, and tap Create. I’ll build a balanced version of that craving with ingredients, nutrition, and instructions. When you find a meal you like, you can add it straight to today's plan. If you're diabetic, GlucoseGuard adjusts your meal based on your latest glucose reading. Use the Flavor Preference toggle to switch between Personal — using your saved palate preferences — or Neutral for light seasoning when cooking for others. Pro tip — you can go hands-free here. Tap the Chef, and just talk your way through it.",
    autoClose: true,
    guestDescription:
      "We redesign cravings. Stay satisfied, stay on plan — without giving up what you love.",
    guestSpokenText:
      "This is Craving Creator — and this is how you stay on plan without feeling deprived. Most diets tell you to ignore your cravings. I don’t work that way. I redesign them. Craving something sweet? Tell me. Something crunchy, creamy, salty — tell me. I’ll build a healthier version that actually satisfies you, with ingredients, instructions, and real nutrition. When you find one you like, add it straight to today’s breakfast, lunch, dinner, or snacks. This feature is free for you to explore — no pass required. Play around, experiment, and see how cravings can fit into a real plan without derailing your progress. This is the kind of thing that makes people realize this app actually gets them.",
  },

  "/craving-desserts": {
    pageId: "dessert-creator-studio",
    title: "Dessert Creator",
    description:
      "Create healthier desserts — from everyday cravings to special-occasion treats — without restriction or guilt.",
    spokenText:
      "Dessert Creator is where cravings don’t get judged — they get redesigned. Start by choosing the kind of dessert you want, then pick a flavor direction and how many people you’re serving. Add any dietary preferences if needed, then tap Create. I’ll build you a dessert that actually feels like a dessert — one you can enjoy. If you're diabetic, GlucoseGuard adjusts the dessert based on your latest glucose reading. Use the Flavor Preference toggle to switch between Personal or Neutral seasoning when serving others. Pro tip — you can go hands-free here. Tap the Chef, and just talk your way through it.",
    autoClose: true,
  },

  "/craving-creator-landing": {
    pageId: "craving-creator-landing",
    title: "Craving Creator Hub",
    description:
      "The original craving-based experience. Create custom cravings, explore ready-made favorites, or build healthier desserts — all from one place.",
    spokenText:
      "Welcome to the Craving Creator Hub — this is where it all began. This is the original experience, built around what you actually feel like eating. You can use the Craving Creator to turn any craving into a healthier meal that fits your goals, browse Premades for ready-to-go favorites, or head into the Dessert Creator for healthier takes on things like cookies, cakes, and pies. Pick where you want to start, and I’ll guide you from there.",
    autoClose: true,
  },

  "/craving-presets": {
    pageId: "craving-presets",
    title: "Craving Premades",
    description:
      "Browse ready-made AI craving meals you can use instantly — and add straight to your daily meal plan.",
    spokenText:
      "Craving Presets is where you grab ready-made meals without starting from scratch. Ch0ose how many servings you’re making, and your rounding preference, so portions stay realistic. Then scroll through the premade meals and tap any one that looks good. Inside each meal, you’ll see ingredients, nutrition, and instructions. From there, you can log the macros, send the ingredients to your shopping list, or add that meal directly to today’s breakfast, lunch, dinner, or snacks. It’s the fastest way to pick a meal, and drop it straight into your plan.",
    autoClose: true,
  },

  "/fridge-rescue": {
    pageId: "fridge-rescue-studio",
    title: "Fridge Rescue",
    description:
      "Turn the ingredients you already have into real meals — and add them directly to today’s plan.",
    spokenText:
      "Fridge Rescue is built for real life. If you want, you can type what you have. Or you can go hands-free — tap the Chef and just tell me what's in your fridge. I'll ask a couple of quick questions if needed, then turn what you already have into real meals you can actually eat. Each meal comes with ingredients, instructions, and nutrition. If you like one, you can add it directly to today's plan, log the macros, or send ingredients to your shopping list. If you're diabetic, GlucoseGuard adjusts meals based on your latest glucose reading. Use the Flavor Preference toggle to switch between Personal or Neutral seasoning when cooking for others. Pro tip — you can go hands-free here. Tap the Chef and just talk.",
    autoClose: true,
    guestDescription:
      "Life happens. We adapt. Use what you have and turn it into something real.",
    guestSpokenText:
      "This is Fridge Rescue — and this is what happens when life doesn’t go according to plan. You’ve got random ingredients at home, no time to shop, and no idea what to make. Sound familiar? Just tell me what you’ve got — chicken, eggs, leftover rice, whatever — and I’ll turn it into a real meal with ingredients, instructions, and nutrition. No grocery run. No guessing. No wasted food. This feature is free for you to explore — no pass required. Play around, see what’s possible. When you find something you like, you can add it to your meal plan, and watch how it connects back to your day. This is one of those features that makes people go ‘oh wow, I didn’t know it could do that.’ So go ahead — rescue your fridge.",
  },

  "/healthy-kids-meals": {
    pageId: "healthy-kids-meals",
    title: "Healthy Kids Meals Hub",
    description:
      "Healthy, kid-friendly meals for ages 5–12. Tap any picture to see ingredients and cooking instructions, and send ingredients to your shopping list with one tap.",
    spokenText:
      "Healthy Kids Meals. These meals are designed for kids ages four to twelve. Tap any picture to see the ingredients and cooking instructions, and you can send ingredients straight to your shopping list.",
    autoClose: true,
  },

  "/kids-meals": {
    pageId: "kids-meals",
    title: "Kids Meals",
    description:
      "Choose between Kids Meals for ages 5–12 or Toddler Meals for little ones. Both include easy ingredient lists you can send to your shopping list.",
    spokenText:
      "Trying to make healthier meals for your kids without overthinking it? That’s exactly what Kids Meals is for. These meals are designed for ages five to twelve. Pick your servings, choose your rounding — tenth, half, or whole — and tap any meal to open the picture. From there, you can view the ingredients, see the cooking instructions, and send everything you need straight to the shopping list.",
    autoClose: true,
  },

  "/toddler-meals": {
    pageId: "toddler-meals",
    title: "Toddler Meals",
    description:
      "Simple, soft, and finger-friendly meals for toddlers. Tap a picture to view ingredients and instructions, and send ingredients to your shopping list instantly.",
    spokenText:
      "Trying to figure out what to feed a toddler who grazes all day? Toddler Meals are built for little ones with softer textures and finger-friendly foods. Pick your servings, choose your rounding, and tap any meal to open the picture. You’ll see the ingredients, the simple cooking instructions, and you can send everything you need directly to the shopping list.",
    autoClose: true,
  },

  "/social-hub": {
    pageId: "social-hub",
    title: "Socializing Hub",
    description:
      "Navigate dining out and social eating. Choose Restaurant Guide or Lean Social.",
    spokenText:
      "Socializing Hub. In this feature, you have two ways to find healthy meals. Use Restaurant Guide when you already know where you’re eating — just tell me the restaurant, and what you want. Or use Find Healthy Options to search by zip code, and see what’s around you. Tap whichever one you need.",
    autoClose: true,
  },

  "/social-hub/restaurant-guide": {
    pageId: "social-hub/restaurant-guide",
    title: "Restaurant Guide",
    description:
      "Find healthy meals at any restaurant. Enter the restaurant name and what you want to eat, and the app will return three smart, goal-friendly options.",
    spokenText:
      "Love eating out but never knowing how to order off the menu without blowing your nutrition? That’s exactly what Restaurant Guide is for. Just tell me what you’re in the mood for, enter the restaurant name and a nearby zip code, and I’ll give you three smarter meal options that fit your goals — plus simple tips on how to order it better when you’re there. If you decide to eat one of these meals, you can add it straight to your macros with one tap, so your day stays accurate, without any guessing. No stress, no overthinking — just order, enjoy, and stay on track.",
    autoClose: true,
  },

  "/social-hub/find": {
    pageId: "social-hub/find",
    title: "Find Meals Near Me",
    description:
      "Find healthy places to eat near you. Enter what you're craving and your zip code, and the app returns nearby restaurants with smart meal options that fit your goals.",
    spokenText:
      "Eating out while trying to stay on track can feel like a guessing game when you don’t know what’s around you. Find Meals Near Me fixes that. Just tell me what you’re craving, and enter your zip code, and I’ll show you nearby restaurants with smarter meal options from each one. When you choose a meal, you can log it directly to your macros, so everything stays accurate for the day. You pick what sounds good, order smarter, track it easily, and keep moving forward.",
    autoClose: true,
  },

  "/alcohol-hub": {
    pageId: "alcohol-hub",
    title: "Spirits & Lifestyle Hub",
    description:
      "A guide to smarter drinking with pairings, mixers, meal matches, and tools to help you cut back.",
    spokenText:
      "Spirits and Lifestyle Hub helps you drink smarter without overthinking it. Here, you can explore wine, beer, and bourbon pairings, find lower calorie mixers and mocktail ideas, match drinks to meals, or use the weaning off tools if you’re cutting back. Choose what you want to explore, and I’ll guide you from there.",
    autoClose: true,
  },

  "/alcohol/lean-and-social": {
    pageId: "alcohol/lean-and-social",
    title: "Lean & Social",
    description:
      "Tips and strategies for eating well at parties, BBQs, and social events without feeling restricted.",
    spokenText:
      "Lean and Social helps you stay on track when food choices get tricky. Whether you’re at a party, a BBQ, or a social event, you’ll find simple strategies to help you choose smarter portions, enjoy what’s available, and still feel confident in your decisions. Tap a section to get started, and I’ll walk you through it.",
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

  "/mocktails-low-cal-mixers": {
    pageId: "mocktails",
    title: "Mocktails",
    description:
      "Alcohol-free drinks and low-calorie mixers for lighter options.",
    spokenText:
      "Mocktails gives you refreshing alcohol-free drinks and lower calorie mixer options. Tap any drink to see the ingredients, how to make it, and quickly add what you need to your shopping list.",
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

  "/alcohol-log": {
    pageId: "alcohol-log",
    title: "Alcohol Log",
    description: "Log your drinks and track alcohol trends over time.",
    spokenText:
      "Alcohol Log lets you keep track of what you drink and when. Enter the drink, the amount, and the date, and I’ll track your activity across seven, thirty, and ninety days, along with recent entries and a visual look at your last month.",
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

  "/planner": {
    pageId: "planner",
    title: "Planner",
    description:
      "Your central hub for building meal plans that match your goals, schedule, and lifestyle.",
    spokenText:
      "This is your Planner — this is where everything comes together. Inside this page, you’ll see your meal builder — the one designed for your goals. Whether that’s weekly planning, diabetic support, GLP-1, anti-inflammatory, or another focus, this is where you build your meals day by day. Open your builder, and start creating your meals. I’ll walk you through each step as you go — from choosing meals, to dialing in portions, and staying on track. This is where planning turns into action — let’s get started.",
    autoClose: true,
  },

  "/lifestyle": {
    pageId: "lifestyle-landing",
    title: "Lifestyle",
    description:
      "Your central hub for everyday food, lifestyle, and real-life eating decisions.",
    spokenText:
      "Welcome to the Lifestyle Hub, where everything comes together for real life. From here, you can enjoy your cravings in a healthier way, turn what’s in your fridge into meals, find smarter options when eating out, choose meals for kids or toddlers, and explore drink choices in the Spirits and Lifestyle Hub. You can also jump right into our signature feature, Chef’s Kitchen, where you can create custom meals, experiment with ideas, and have Chef guide you every step of the way.",
    autoClose: true,
  },

  "/procare-cover": {
    pageId: "procare-cover",
    title: "Procare",
    description:
      "Your professional support center for supplements and expert-guided nutrition tools.",
    spokenText:
      "ProCare is your professional support center. From here, you can access the Supplement Hub for health and performance support, or connect with your trainer or physician using the ProCare tools for personalized guidance. Choose the option you need and I’ll walk you through it.",
    autoClose: true,
  },

  "/macro-counter": {
    pageId: "macro-counter",
    title: "Macro Calculator",
    description:
      "Calculate personalized daily protein, carb, and fat targets using your goals, activity level, body composition, and key metabolic factors. Choose your Starch Meal Strategy to control how you manage starchy carbs throughout the day.",
    spokenText:
      "The Macro Calculator sets personalized daily nutrition targets based on how your body actually works — not just calories. Start by choosing your goal, body type, and activity level, then enter your age, height, and weight. You can also factor in things like hormone changes, insulin resistance, or high stress, which influence how your body responds to protein, carbs, and fat. I’ll calculate clear daily targets for protein, starchy carbs, fibrous carbs, and fat — numbers that make sense for you. Here’s what matters most: fibrous carbs like vegetables are unlimited and help with weight loss, while starchy carbs like rice, pasta, and potatoes need to be managed. In the Starch section, you’ll choose One Starch Meal — where all starchy carbs go into a single meal — or Flex Split, which divides them across two meals for flexibility. This choice is saved automatically and controls how your meals are built. Pro tip: eat starchy carbs earlier in the day — it helps with appetite control and better sleep. Once your targets are set, head to the Planner and start building meals. If you’re using Guest Mode, save your macros, then go straight to the Weekly Meal Builder to unlock the next features.",
    autoClose: true,
    guestDescription:
      "This is where your plan becomes yours — personalized nutrition targets based on your body, not generic calorie counting.",
    guestSpokenText:
      "Hey — I’m Chef Coplit, your personal guide inside My Perfect Meals. This is your Macro Calculator — and this is where your plan becomes yours. Most apps just count calories. I don’t. I calculate daily targets for protein, starchy carbs, fibrous carbs, and fat based on how your body actually works — your age, activity level, goals, and factors like hormone changes, insulin resistance, or stress. Here’s the key: fibrous carbs like vegetables are unlimited and help with weight loss. Starchy carbs like rice, pasta, and potatoes need to be managed — and that’s what the Starch Strategy is for. Choose One Starch Meal for appetite control, or Flex Split for flexibility on active days. Pro tip: eat starchy carbs earlier in the day — you’ll metabolize sugars better, and sleep better at night. Once you save your numbers, everything you build in this app is built around you — not a generic template. This is the foundation. When you’re done, the Weekly Meal Builder unlocks, and you’ll see exactly how these numbers turn into real meals you actually want to eat. Take your time. Get these numbers right. Then let’s build.",
  },
  "/shopping-list-v2": {
    pageId: "shopping-list-v2",
    title: "Master Shopping List",
    description:
      "Create, manage, and check off items for your grocery trips and everyday shopping.",
    spokenText:
      "The Master Shopping List helps you organize everything you need in one place. You can add items by barcode, voice, or bulk entry, group them by aisle, and exclude pantry staples. Use Add Other Items for non food needs like household, personal care, pets, or pharmacy items, then check things off as you shop, or send your list to a delivery service. If you’re exploring as a guest, this is where you see how meals turn into real shopping, and when you’re ready, head back to the Guest Suite to keep exploring, or try Fridge Rescue and Craving Creator.",
    autoClose: true,
    guestDescription:
      "Planning turns into action here. This is real-world execution — shopping made simple.",
    guestSpokenText:
      "This is your Shopping List — and this is where planning turns into action. Most people build meal plans, then guess what to buy. I don’t let that happen. Every meal you create in this app gets sent directly here — and I automatically organize everything by aisle, so you’re not wandering around the store. You can add items by voice, use bulk add to drop in multiple items at once, search by brand name, exclude pantry staples you already have, and use Add Other Items for non-food needs like household supplies, personal care, pets, or pharmacy. Check things off as you shop, or send the list to your delivery service. This is how meal planning works in the real world — and it’s one of the reasons subscribers love this app. For now, explore what’s here. When you build a meal and send it to shopping, you’ll see exactly how the system comes together.",
  },
  "/get-inspiration": {
    pageId: "get-inspiration",
    title: "Get Inspiration",
    description:
      "Find daily inspiration and a simple space to reflect, reset, and clear your mind.",
    spokenText:
      "Get Inspiration is a place to reset and refocus. You can tap for a new motivational quote anytime, or use the journal to speak or type your thoughts when you need to clear your head. Take a moment for yourself, always remember this - free your mind, and the rest will follow.",
    autoClose: true,
  },

  "/weekly-meal-board": {
    pageId: "weekly-meal-board",
    title: "Weekly Meal Builder",
    description:
      "Build meals across one or multiple days using structured or conversational meal tools guided by your goals. The starch indicator shows your daily starch meal status — green means slots available, orange means they're covered for the day.",
    spokenText:
      "Welcome to your Meal Builder. This is where everything comes together. No matter which builder you’re using, they all work the same way — you’re creating healthy meals in any cuisine or style you want. At the very top of the screen, you'll see your Nutrition Budget — a real-time view of your remaining protein, starchy carbs, and fiber for the day. As you add meals, it updates automatically, helping you make smarter choices without overthinking. Below that, you'll see your daily starch indicator, which shows how many starchy meals you have available, based on the starch strategy you set in the Macro Calculator. Green means you still have starch meals available, orange means you've covered them for the day. Start by tapping Create with Chef, our multilingual, multi-cuisine, A.I. Meal Creator, and describe your meal — breakfast, lunch, dinner, or snacks — and be as specific as you like with cuisine, protein amount, carbs, and preferences. The more detail you give, the better the result. You can plan up to a full week at a time, build each day differently, or duplicate days to save time. As you build, focus on protein and carbs — those are the most important drivers of energy and results. When you’re done, you can send meals straight to your shopping list, log the day to your biometrics, or make changes anytime. This is your builder — open it up, and start creating meals your way. Build your meals here, then send them to Biometrics or the Shopping List — this is how you see the system work end to end. If you’re a guest, building at least one meal here unlocks Fridge Rescue and Craving Creator, so focus on creating a meal you’d actually eat, and adding it to your day.",
    autoClose: true,
    guestDescription:
      "Structure beats willpower. This pass counts — build the full day.",
    guestSpokenText:
      "Alright — this is your Weekly Meal Builder, and this is where your plan becomes real. Most apps give you a list of recipes, and hope you figure it out. I don’t work that way. Here, you’ll build complete meal days — breakfast, lunch, dinner, and snacks — in any cuisine, any style, any dietary need. The more specific you are, the better the result: ‘Mediterranean lunch, 50 grams of protein, low fat’ works just as well as ‘surprise me.’ As a guest, you have a limited number of meal day passes. When you enter this page without an active session, you’ll use one of those passes — but once you’re in, you have 24 hours to build, explore, come back, and build more. That’s the deal: structure beats willpower, and this is where you prove it. Take your time. Build a full day. Make it something you’d actually eat. Then send it to your shopping list, and see how everything connects.",
  },

  "/diabetic-hub": {
    pageId: "diabetic-hub",
    title: "Diabetic Hub",
    description:
      "Your control center for managing blood sugar with GlucoseGuard™ protection, clinician-style guardrails, and daily glucose tracking.",
    spokenText:
      "The Diabetic Hub is your control center for managing blood sugar day to day. Here you can set and save doctor or coach guardrails like fasting ranges, pre meal maximums, daily carb limits, fiber minimums, glycemic index caps, and meal frequency. You can log glucose readings with context like fasting, pre meal, or post meal, view your most recent reading, and track seven day trends. GlucoseGuard — your blood sugar protection system — reads your latest glucose log and automatically adjusts meal generation to match your current state. When your glucose is low, meals include more carbs to stabilize. When elevated, meals go lower carb to help bring you back into range. When you're ready to build meals, use the button at the bottom to jump into the diabetic meal builder.",
    autoClose: true,
  },

  "/diabetic-menu-builder": {
    pageId: "weekly-meal-board",
    title: "Diabetic Meal Builder",
    description:
      "Build meals that support balanced blood sugar with GlucoseGuard™ protection. The starch indicator helps you manage starchy carbs — green means slots available, orange means they're covered for the day.",
    spokenText:
      "Welcome to the Diabetic Meal Builder. This builder supports steady blood-sugar control throughout the day. At the top, your starch indicator shows starchy carb meals — green means available, orange means covered. Tap Create with Chef to describe what you want — any cuisine, any style. When you open it, you'll see a GlucoseGuard indicator showing your latest glucose reading. Here's what it means — if your glucose is low, the AI adds more carbs to help stabilize. If elevated, it goes lower carb to bring you back into range. If in range, it keeps things balanced. That's GlucoseGuard adjusting meals to your current blood sugar automatically. SafetyGuard protects you from allergens. Build your day, then save to biometrics or add to your shopping list.",
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
      "Create portion-aware meals designed to support GLP-1 goals. The starch indicator shows your daily starch meal status — green means slots available, orange means they're covered for the day.",
    spokenText:
      "Welcome to the GLP-1 Meal Builder. This builder works like the others, but it’s designed to support GLP-1 goals like satiety, portion control, steady energy, and protein prioritization. At the top of the screen, you’ll see your daily starch indicator, based on the starch strategy you set in the Macro Calculator — green means starch meals available, orange means used. Start by tapping Create with Chef, our multilingual, multi-cuisine A.I. Meal Creator, and describe what you want — any cuisine, any style — with details like protein goals, lighter portions, lower fat, or gentler foods if needed. The Chef will build meals that stay aligned with GLP-1-friendly guardrails without feeling restrictive. You can plan one day or a full week, adjust days as needed, or duplicate days to save time. Build breakfast, lunch, dinner, and snacks in a way that keeps meals simple, satisfying, and consistent. As you build, focus on protein and carbs — those are the primary drivers of satiety, energy stability, and lean tissue support. When you’re finished, send your day to biometrics, add ingredients to your shopping list, or make changes anytime. SafetyGuard protects you from allergens. Open your builder and start creating meals that work with your appetite, not against it.",

    autoClose: true,
  },

  "/anti-inflammatory-menu-builder": {
    pageId: "anti-inflammatory-menu-builder",
    title: "Anti-Inflammatory Meal Builder",
    description:
      "Build meals focused on inflammation-friendly ingredients. The starch indicator shows your daily starch meal status — green means slots available, orange means they're covered for the day.",
    spokenText:
      "Welcome to the Anti-Inflammatory Meal Builder. This builder is designed to help reduce inflammation while supporting energy, recovery, and long-term health. At the top of the screen, you’ll see your daily starch indicator, based on the starch strategy you set in the Macro Calculator — green means starch meals available, orange means used. Start by tapping Create with Chef, our multilingual, multi-cuisine A.I. Meal Creator, and describe what you want — any cuisine, any style — with details like protein, carbs, or ingredients you prefer to avoid. The Chef will build meals using anti-inflammatory guardrails without sacrificing flavor or variety. You can plan one day or a full week, adjust weekdays and weekends differently, or duplicate days to save time. Build breakfast, lunch, dinner, and snacks in a way that keeps meals balanced and easy to follow. As you build, focus on protein and carbs — those are the most important drivers for energy and recovery. When you’re finished, send your day to biometrics, add ingredients to your shopping list, or make changes anytime. SafetyGuard protects you from allergens. Open your builder and start creating meals that help your body feel and perform better.",

    autoClose: true,
  },

  "/beach-body-meal-board": {
    pageId: "beach-body-meal-board",
    title: "Beach Body Meal Builder",
    description:
      "Create structured meals designed for performance and body composition. The starch indicator shows your daily starch meal status — green means slots available, orange means they're covered for the day.",
    spokenText:
      "Welcome to the Beach Body Meal Builder. This builder is designed for leaning out, tightening up, and dialing in your physique while keeping meals realistic and sustainable. At the top of the screen, you’ll see your daily starch indicator, based on the starch strategy you set in the Macro Calculator — green means starch meals available, orange means used. Start by tapping Create with Chef, our multilingual, multi-cuisine A.I. Meal Creator, and describe what you want — any cuisine, any style — with details like protein targets, carb levels, or foods you want to limit. The Chef will build meals that support fat loss, muscle tone, and performance without overcomplicating things. You can plan one day or a full week, keep weekdays structured, and loosen things slightly on weekends if you choose. Build breakfast, lunch, dinner, and snacks by adjusting the meals themselves instead of traditional serving math. As you build, prioritize protein and carbs — those drive energy, training output, and physique changes. When you’re finished, send your day to biometrics, add ingredients to your shopping list, or make tweaks anytime. SafetyGuard protects you from allergens. Open your builder and start creating meals that move your body where you want it to go.",

    autoClose: true,
  },

  "/care-team": {
    pageId: "care-team",
    title: "Care Team & Pro Care",
    description:
      "Connect with trainers, physicians, or coaches to build and manage your personal care team.",
    spokenText:
      "Care Team and ProAccess lets you connect with the people who support your goals. You can invite a trainer, physician, coach, patient, or client by email and assign their role, or join someone else’s team using an access code. Once connected, you’ll appear on each other’s active care team, making it easy to collaborate, share progress, and manage support in one place. You can update or manage your care team at any time, so choose the option that fits what you want to do and get started.",
    autoClose: true,
  },

  "/pro/clients": {
    pageId: "pro-clients",
    title: "Pro Portal",
    description:
      "Your professional portal for managing clients and accessing their care dashboards.",
    spokenText:
      "The Pro Portal is where you manage your clients and care relationships. To add a new client, enter their name, then select your profession from the dropdown. Your profession determines which dashboard you’ll use — trainers go to the Trainer Dashboard with performance and competition builders, while clinical roles like doctors, nurse practitioners, physician assistants, dietitians, nutritionists, and registered nurses go to the Clinician Dashboard with diabetic, GLP-1, and anti-inflammatory builders. Once you’ve selected your profession and added the client, tap Open to access your professional dashboard, where you’ll set targets, apply protocols, and guide their nutrition plan.",
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
      "Welcome to the Trainer Dashboard. This is your client control center, where you set everything that drives their nutrition. Start with macro targets — protein, starchy carbs, fibrous carbs, and fat. Then choose the Starch Game Plan. One Starch Meal concentrates all starchy carbs into a single meal for appetite control and fat loss. Flex Split divides starchy carbs across two meals for more flexibility. Remember, fibrous carbs like vegetables are always unlimited. When you’re ready, assign a meal builder — General Nutrition for balanced everyday meals, or Performance and Competition for athletes and high-output clients. Finally, use the builder shortcuts to jump directly into meal generation for your client.",
    autoClose: true,
  },

  "/profile/edit-step-1": {
    pageId: "edit-profile-step-1",
    title: "Edit Profile — Personal Info",
    description:
      "Update your name and email. This is the foundation of your profile.",
    spokenText:
      "This is where you update your personal information — your name and email. These details help personalize your experience and keep your account secure. Make any changes you need, then continue to the next step.",
    autoClose: true,
  },

  "/profile/edit-step-2": {
    pageId: "edit-profile-step-2",
    title: "Edit Profile — Goals & Activity",
    description:
      "Set your fitness goal and activity level. These shape how your nutrition targets are calculated.",
    spokenText:
      "This step is about your goals and activity level. Your fitness goal — whether that's weight loss, muscle gain, maintenance, or endurance — combined with how active you are, directly shapes your daily nutrition targets. Choose what fits your current lifestyle, and we'll build around that.",
    autoClose: true,
  },

  "/profile/edit-step-3": {
    pageId: "edit-profile-step-3",
    title: "Edit Profile — Allergy & Safety",
    description:
      "Configure your allergies and SafetyGuard protection. Your Safety PIN protects these settings.",
    spokenText:
      "This is where you set up SafetyGuard — Allergy Protection — My Perfect Meals' built-in two-layer safety system designed to prevent meals from being created with ingredients you've marked as unsafe. The first layer is established during onboarding and profile setup, where your allergies and restrictions are saved and hard-wired into the meal generator so unsafe ingredients are blocked before a meal can even be generated. The second layer operates inside the meal builders themselves, meaning that even if an unsafe ingredient is typed or requested directly, the builder will still block it from being included. On top of these protections, SafetyGuard includes a controlled override system that requires your Safety PIN and applies to one meal only, automatically turning protection back on afterward so no other meals are affected and nothing can be disabled accidentally or globally.",
    autoClose: true,
  },

  "/profile/edit-step-4": {
    pageId: "edit-profile-step-4",
    title: "Edit Profile — Review & Save",
    description:
      "Review your changes and save your updated profile.",
    spokenText:
      "This is your final review. Take a moment to double-check everything — your name, goals, activity level, dietary restrictions, and allergies. When you're ready, save your changes and they'll take effect immediately across the app.",
    autoClose: true,
  },

  "/pro/clients/:id/diabetic-builder": {
    pageId: "procare-diabetic-builder",
    title: "ProCare Diabetic Meal Builder",
    description:
      "Build diabetic-friendly meals for your client using clinician-defined guardrails.",
    spokenText:
      "Welcome to the ProCare Diabetic Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for your client using the targets, protocols, and clinical guidelines you’ve already defined. Use Create with Chef to describe meals and snacks, or the A.I. Meal Creator to guide ingredient-level choices. You can plan one day or multiple days, structure each day as needed, and stay flexible while remaining inside the approved medical framework. Build breakfast, lunch, dinner, and snacks by adjusting the meals themselves, not traditional serving math. Prep options help control preparation methods and dial in targets like protein so meals remain compliant. If you’re a client, this is where you build meals using your coach’s or physician’s settings — follow the targets shown at the bottom of the screen as you create your day. As you build, focus on protein and carbs — those drive energy, glucose response, and daily control. Calories and fats still matter, but they play a supporting role. When you’re finished, save your day to Biometrics, send ingredients to the shopping list, or do both. When you’re ready, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/pro/clients/:id/glp1-builder": {
    pageId: "procare-glp1-builder",
    title: "ProCare GLP-1 Meal Builder",
    description:
      "Create GLP-1–aligned meals for your client using appetite-aware guardrails.",
    spokenText:
      "Welcome to the ProCare GLP-1 Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for a client using the targets, protocols, and clinical guidelines you’ve already defined. Use Create with Chef to describe meals and snacks, or the A.I. Meal Creator to guide ingredient-level choices. Choose how many days you want to plan and how each day should be structured, allowing flexibility while staying aligned with GLP-1 goals like satiety, protein prioritization, and meal consistency. Build breakfast, lunch, dinner, and snacks by adjusting the meals themselves, not traditional serving manipulation. Prep options help control preparation and dial in targets like protein to support fullness and adherence. If you’re a client, follow the targets shown at the bottom of the screen as you create your day using Create with Chef. As you build, focus on protein and carbs — those drive satiety, energy stability, and lean tissue support. Calories and fats still matter, but they play a supporting role. When you’re finished, save your day to Biometrics, send ingredients to the shopping list, or do both. When you’re ready, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/pro/clients/:id/anti-inflammatory-builder": {
    pageId: "procare-anti-inflammatory-builder",
    title: "ProCare Anti-Inflammatory Meal Builder",
    description:
      "Build inflammation-conscious meals for your client using targeted guardrails.",
    spokenText:
      "Welcome to the ProCare Anti-Inflammatory Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for a client using the targets, protocols, and clinical guidelines you’ve already defined. Use Create with Chef to describe meals and snacks, or the A.I. Meal Creator to guide ingredient-level choices. Choose how many days you want to plan and how each day should be structured, allowing flexibility while staying aligned with anti-inflammatory goals like nutrient quality, food variety, and consistency. Build breakfast, lunch, dinner, and snacks by adjusting the meals themselves, not traditional serving manipulation. Prep options help control preparation methods and support anti-inflammatory strategies like ingredient selection and protein targets. If you’re a client, follow the targets shown at the bottom of the screen as you create your day using Create with Chef. As you build, focus on protein and carbs — those drive recovery, energy stability, and tissue repair. Calories and fats still matter, but they play a supporting role. When you’re finished, save your day to Biometrics, send ingredients to the shopping list, or do both. When you’re ready, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/pro/clients/:id/performance-competition-builder": {
    pageId: "procare-performance-competition-builder",
    title: "ProCare Performance & Competition Meal Builder",
    description:
      "Create precision-based performance meals for your client using competition-level guardrails. The starch indicator shows daily starch meal status — green means slots available, orange means they're covered for the day.",
    spokenText:
      "Welcome to the ProCare Performance and Competition Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for a client using the targets, protocols, and performance guidelines you’ve already defined. Use Create with Chef to describe meals and snacks, or the AI Meal Creator to guide ingredient-level choices. Choose how many days you want to plan and how each day should be structured, allowing flexibility while staying aligned with training demands, competition schedules, and recovery needs. Pay attention to the starch indicator — green means starch slots available, orange means they're covered for today. Remember, fibrous carbs like vegetables are unlimited and should be encouraged, while starchy carbs are managed using the Starch Game Plan set in the Trainer Dashboard — either One Starch Meal or Flex Split. As you build, focus on protein and carbs — those drive energy availability, recovery, and competitive performance. When you’re finished, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/pro/clients/:id/general-nutrition-builder": {
    pageId: "procare-general-nutrition-builder",
    title: "ProCare General Nutrition Meal Builder",
    description:
      "Build balanced, everyday meals for your client using flexible nutrition guardrails. The starch indicator shows daily starch meal status — green means slots available, orange means they're covered for the day.",
    spokenText:
      "Welcome to the ProCare General Nutrition Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for a client using the nutrition targets, protocols, and guidelines you’ve already defined. Use Create with Chef to describe meals and snacks, or the AI Meal Creator to guide ingredient-level choices. Choose how many days you want to plan and how each day should be structured, allowing flexibility while staying aligned with the overall nutrition framework. Pay attention to the starch indicator — green means starch slots available, orange means they're covered for today. Remember, fibrous carbs like vegetables are unlimited and should be encouraged, while starchy carbs are managed using the Starch Game Plan set in the Trainer Dashboard — either One Starch Meal or Flex Split. As you build, focus on protein and carbs — those drive energy, recovery, and nutritional balance. When you’re finished, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/select-builder": {
    pageId: "select-builder",
    title: "Meal Builder Exchange",
    description:
      "Switch meal boards as your needs change — whether you're graduating from ProCare, following a medical plan, or simplifying long-term.",
    spokenText:
      "Meal Builder Exchange is where you switch Meal Builders when your medical needs, goals, or coaching situation changes. If a clinician updates your care — like a new Diabetes diagnosis, or a change in status — you can switch to the appropriate clinical builder, so your meals follow the right rules automatically. If you’re working with a coach or trainer in ProCare, you may be placed into a specific program-based builder for a limited phase. When that program ends, you can continue independently by switching out of the coaching-only builder, while keeping a builder that fits your lifestyle. If you’re on General Nutrition, you can stay there long-term, or switch to Weekly Meal Builder — they’re built to feel the same for everyday use. Clinical builders like Diabetes can also stay active even after you stop working with a clinician, because the app is designed to help you maintain results long after professional care ends.",
    autoClose: true,
  },

  "/privacy": {
    pageId: "privacy",
    title: "Privacy & Security",
    description:
      "Manage your privacy settings, data preferences, and account security options.",
    spokenText:
      "This is your Privacy and Security page. Here you can review how your data is handled, manage your privacy preferences, and control what information is stored. My Perfect Meals takes your privacy seriously — your health data, meal plans, and personal information are protected and never sold to third parties. You can also find information about how to request your data or delete your account if needed.",
    autoClose: true,
  },

  "/pricing": {
    pageId: "pricing",
    title: "Subscription",
    description:
      "View your current plan, explore upgrade options, and manage your billing.",
    spokenText:
      "This is your Subscription page. Here you can see your current plan, explore what's included at each tier, and manage your billing. My Perfect Meals offers flexible plans to fit your needs — from individual meal planning to family options and professional coaching support. If you need to change your plan or update payment information, you can do it right here.",
    autoClose: true,
  },

  "/learn": {
    pageId: "learn",
    title: "App Library",
    description:
      "Learn how the app works, understand nutrition basics, and explore Copilot walkthroughs.",
    spokenText:
      "Welcome to the App Library. This is your go-to resource for understanding how My Perfect Meals works and the nutrition science behind it. You'll find informative articles on topics like fiber and vegetables, meal planning basics, and the difference between tracking calories versus macros. There's also an interactive food comparison tool that shows you how fat content changes how much food you get per hundred calories. The Copilot Walkthroughs section explains how to use each feature — just tap any topic to read more. And now with Palate Preferences, you can customize how your meals are seasoned — spice tolerance, seasoning intensity, and flavor style — without affecting your macros. This is where the app teaches you the why, not just the how.",
    autoClose: true,
  },

  "/founders": {
    pageId: "founders",
    title: "About My Perfect Meals",
    description:
      "Meet the founders and learn about the mission behind My Perfect Meals.",
    spokenText:
      "This is our About page. Here you'll learn about the people behind My Perfect Meals and why we built this app. Our mission is simple: help you understand where your calories come from and make healthy eating practical, not complicated. We believe nutrition should be personalized, accessible, and based on real science — not fads or restrictions. Thank you for being part of our community.",
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
    title: "MPM Guest Suite",
    description:
      "Try our AI-powered meal planning tools — no account required. Find your macros, create meals, rescue your fridge, or satisfy a craving.",
    spokenText:
      "Hey, welcome to the My Perfect Meals Guest Suite — I’m really glad you’re here. Before we start, let me introduce myself. I’m Chef Copilot, your personal guide inside this app. You’ll find me in the bottom navigation bar — look for the Chef button in the center of the bottom navigation. Anytime you’re on any page and want to know what it does, or how to use it, just tap the Chef button, then hit Listen, and I’ll explain exactly what you’re looking at and what to do next. If you turn Auto on inside the Copilot panel, I’ll automatically explain each page as you move through the app. If Auto is off, I stay quiet until you ask. You’re always in control. Now, let’s talk about what you’re here to do. This is a guided preview of how the app works, and I’ll walk you through it step by step, so you actually get the full experience instead of guessing where to start. As a guest, you’ll begin with the Macro Calculator to set your personal numbers — that’s the foundation for everything else in the app. You may notice that some features, like the Weekly Meal Builder, Fridge Rescue, and Craving Creator, aren’t fully open yet — and that’s intentional. Once you finish your macros and build your first meals, those tools unlock so you can see how everything connects. Guest Mode gives you a few meal day passes to try the real workflow — setting your numbers, building meals, and seeing how meals, biometrics, and shopping all work together — without needing an account. Remember, I’m always here in the bottom navigation bar under Guide if you need me. Let’s start by setting your macros, and take it from there.",
    autoClose: false,
  },
  "/lifestyle/chefs-kitchen": {
    pageId: "chefs-kitchen-studio",
    title: "Chef’s Kitchen",
    description:
      "A creative, hands-on cooking experience where you build a dish from idea to plate with step-by-step guidance.",
    spokenText:
      "Hey—welcome to my kitchen. Come on in. This is where we stop worrying about labels, rules, or perfect diets and just have fun with food. You bring the idea, the craving, or even just the mood—and we'll build something real together. I'll walk you through it step by step: what you're making, how you want to cook it, how many people you're cooking for and how much time you want to spend. And here's the signature move — you can do this hands-free. Tap the floating Chef and just talk. I'll guide you step by step and cook the meal with you.",
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
 * IMPORTANT: Guest Suite = Guided, Coach-Led Marketing Experience
 * - Copilot is the voice, coaching philosophy, and closer
 * - Guest copilots teach, coach, and sell the value in real time
 * - Tone = calm, confident, coach-led (not tooltip-y)
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
