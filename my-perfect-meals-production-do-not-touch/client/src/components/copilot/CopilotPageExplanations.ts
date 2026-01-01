export interface PageExplanation {
  pageId: string;
  title: string;
  description: string;
  spokenText: string;
  autoClose: boolean;
}

export const PAGE_EXPLANATIONS: Record<string, PageExplanation> = {
  "/my-biometrics": {
    pageId: "my-biometrics",
    title: "My Biometrics",
    description:
      "Your daily control panel. Scan food labels with MacroScan, log meals instantly, add extra macros when needed, and track calories, weight, and water over time.",
    spokenText:
      "My Biometrics is your tracking and review center. Your daily macro targets live at the top of this page and stay persistent until you recalculate them in the Macro Calculator. You can log packaged foods using MacroScan by taking a photo of a nutrition label, review the AI-read values, and add them to your day. This page also shows your daily, weekly, and monthly macro totals, your weight trends over time, and your daily water intake. Use Biometrics to monitor progress, not to fix gaps — adjustments happen inside the meal builders.",
    autoClose: true,
  },

  "/dashboard": {
    pageId: "dashboard",
    title: "Dashboard",
    description:
      "Your home base. Jump into meal planning, cravings, tracking, and lifestyle tools from one place.",
    spokenText:
      "Dashboard — this is your home base. From here you can plan your meals, track your macros, or create food based on what you’re actually in the mood for. You don’t need to be precise — just tell the app what you want, and it’ll build it. Anytime you want a quick explanation on a page, tap Copilot and hit Listen.",
    autoClose: true,
  },

  "/craving-creator": {
    pageId: "craving-creator",
    title: "Craving Creator",
    description:
      "Create healthier versions of the foods you crave — so you never have to ignore cravings again.",
    spokenText:
    "Craving something but can’t come up with a healthy option? That’s exactly what Craving Creator is for. Just tell me what you’re in the mood for — sweet, crunchy, creamy, whatever sounds good. Add any dietary preferences or restrictions you have, like dairy-free or gluten-free. Pick how many servings you want, then press Create. I’ll handle the rest and build you a healthier version that fits your goals without going overboard. You eat what you want, stay on track, and move on with your day. Simple as that.",
    autoClose: true,
  },

  "/craving-desserts": {
    pageId: "craving-desserts",
    title: "Dessert Creator",
    description:
      "Create healthier versions of the desserts you love — without ignoring cravings or overdoing portions.",
    spokenText:
    "Looking for a healthier dessert but don’t have any good options? Dessert Creator handles that. First, pick the type of dessert you want — cake, pie, cookies, brownies, frozen treats, or just hit surprise me. If you already know what you’re craving, tell me in your own words — key lime, chocolate peanut butter, bakery-style, whatever sounds good. If you don’t, leave it blank — I’ve got you. Next, choose how many servings you want so portions stay realistic and on point. If you have any dietary needs — low sugar, gluten-free, high protein — add those too. Then tap create, and I’ll build a healthier dessert that actually satisfies you. No guilt. No guessing. You’re good to go.",
    autoClose: true,
  },

  "/craving-creator-landing": {
    pageId: "craving-creator-landing",
    title: "Craving Creator Hub",
    description:
      "Choose from three options: Creator for custom AI-generated cravings, Premades for ready-made craving recipes, or Dessert Creator for healthy desserts like pies, cakes, cookies, and more.",
    spokenText:
    "Craving something but can’t come up with a healthy option? That’s what Craving Creator is for. Tell it what you’re craving, set your servings, add any dietary requirements, and tap create. It builds a healthier version that fits your goals.",
     autoClose: true,
  },

  "/craving-presets": {
    pageId: "craving-presets",
    title: "Craving Premades",
    description:
      "Browse ready-made AI-created craving meals you can use instantly, without starting from scratch.",
    spokenText:
      "Craving Premades. This is where you grab ready-made craving meals without having to build anything from scratch. Start by choosing how many servings you’re making and your rounding preference so portions stay realistic. Then scroll through the premade options and tap any meal that looks good. Inside, you’ll see ingredients, nutrition info, and cooking instructions. From there, you can send everything straight to your master shopping list, log the macros, or do both in one tap. Simple, fast, and you’re back to living your life.",
    autoClose: true,
  },

  "/fridge-rescue": {
    pageId: "fridge-rescue",
    title: "Fridge Rescue",
    description:
    "Turn the ingredients you already have into real meals, without extra shopping.",
        spokenText:
        "Fridge Rescue. You ever come home tired, open the fridge, and stare at food with no clue what to make? That’s not a willpower problem — that’s an idea problem, and everybody hits it. You already have food, you’re just stuck in the same rotations. This fixes that. Type or speak the ingredients you have at home, tap generate, and I’ll give you three real meals using what’s already there. No grocery run. No guessing. Problem solved.",
      autoClose: true,
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
    "Trying to make healthier meals for your kids without overthinking it? That’s exactly what Kids Meals is for. These meals are designed for ages five to twelve. Pick your servings, choose your rounding — tenth, half, or whole — and tap any meal to open the picture. From there you can view the ingredients, see the cooking instructions, and send everything you need straight to the shopping list.",
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
      "Socializing Hub. In this feature, you have two ways to find healthy meals. Use Restaurant Guide when you already know where you’re eating — just tell me the restaurant and what you want. Or use Find Healthy Options to search by zip code and see what’s around you. Tap whichever one you need.",
    autoClose: true,
  },

  "/social-hub/restaurant-guide": {
    pageId: "social-hub/restaurant-guide",
    title: "Restaurant Guide",
    description:
      "Find healthy meals at any restaurant. Enter the restaurant name and what you want to eat, and the app will return three smart, goal-friendly options.",
    spokenText:
      "Love eating out but never know how to order off the menu without blowing your nutrition? That’s exactly what Restaurant Guide is for. Just type what you’re in the mood for, enter the restaurant name and a nearby zip code, and I’ll give you three healthier options that fit your goals. You’ll also get simple tips on how to order it smarter when you’re there. No guessing, no stress — just order and enjoy.",
    autoClose: true,
  },

  "/social-hub/find": {
    pageId: "social-hub/find",
    title: "Find Meals Near Me",
    description:
    "Find healthy places to eat near you. Enter what you’re craving and your zip code, and the app returns nearby restaurants with smart meal options that fit your goals.",
    spokenText:
      "Eating out while staying on track can be a guessing game when you don’t know what’s around you. Find Meals Near Me fixes that. Just tell me what you’re craving and enter your zip code, and I’ll show you three nearby restaurants with healthier meal options from each one. You pick what sounds good, order smarter, and keep moving forward.",
    autoClose: true,
  },

  "/alcohol-hub": {
    pageId: "alcohol-hub",
    title: "Spirits & Lifestyle Hub",
    description:
      "Your complete alcohol and lifestyle guide. Explore wine, beer, and bourbon pairings, healthy low-calorie mixers, full meal-pairing suggestions, and a structured weaning-off system to help you drink smarter.",
    spokenText:
      "Spirits & Lifestyle Hub. This is your full guide to drinking smarter. Inside you’ll find wine, beer, and bourbon pairings, along with low-calorie mixers and mocktail options. You can also use the meal-pairing tool to match the best drink for what you’re eating. And if you’re cutting back, the weaning-off system helps you taper slowly and stay in control. Choose the section you want to explore and I’ll guide you through it.",
    autoClose: true,
  },

  "/alcohol/lean-and-social": {
    pageId: "alcohol/lean-and-social",
    title: "Lean & Social",
    description:
      "Smart strategies for eating well at parties, BBQs, and social events. Learn how to stay on track without feeling restricted, overwhelmed, or out of place.",
    spokenText:
      "Lean & Social. This feature gives you simple strategies to stay in control when you're at parties, BBQs, or any social event. I’ll show you what to choose, how to portion it, and how to enjoy yourself without blowing your progress. Tap any section to get started.",
    autoClose: true,
  },

  "/wine-pairing": {
    pageId: "wine-pairing",
    title: "Wine Pairing",
    description:
      "Find the best wine to match your meal. Browse by wine type or by the style of food you’re eating.",
    spokenText:
      "Wine Pairing. Start by selecting your meal type, cuisine style, main ingredient, occasion, or price range. I’ll recommend wines that match your selection and help you choose the best fit.",
    autoClose: true,
  },

  "/beer-pairing": {
    pageId: "beer-pairing",
    title: "Beer Pairing",
    description:
      "Find the best beer to go with your food. Browse by beer style or meal type.",
    spokenText:
      "Beer Pairing. Choose from meal type, cuisine, main ingredient, occasion, price, flavor bias, or alcohol range. I’ll narrow down the best beers that pair with your meal based on the options you select.",
    autoClose: true,
  },

  "/bourbon-spirits": {
    pageId: "bourbon-spirits",
    title: "Bourbon & Spirits",
    description:
      "Pair bourbon and spirits with your meal for a sophisticated dining experience.",
    spokenText:
      "Bourbon & Spirits Pairing. Select your meal type, cuisine style, main ingredient, occasion, or price range, and I’ll suggest the spirits that match those flavors best.",
    autoClose: true,
  },

  "/mocktails-low-cal-mixers": {
    pageId: "mocktails",
    title: "Mocktails",
    description:
      "Delicious alcohol-free drinks and low-calorie mixers for any occasion.",
    spokenText:
      "Mocktails. Browse refreshing alcohol-free drinks and low-calorie mixers. Tap any drink to see the ingredients, how to make it, and what you need to add to your shopping list.",
    autoClose: true,
  },

  "/meal-pairing-ai": {
    pageId: "meal-pairing",
    title: "Meal Pairing",
    description:
      "AI-powered suggestions for food and drink combinations that go perfectly together.",
    spokenText:
      "Meal Pairing. Build the perfect pairing by choosing your drink category, picking a specific drink, selecting your meal style, and setting your cooking time. I’ll match everything together so your flavors line up the right way.",
    autoClose: true,
  },

  "/alcohol-log": {
    pageId: "alcohol-log",
    title: "Alcohol Log",
    description:
      "Track your drinks with simple entries. Log what you drink, how much, and when, and follow your trends over time.",
    spokenText:
      "Alcohol Log. Enter the drink you had, how many ounces, and the date you had it. I’ll save the entry and show your 7-day, 30-day, and 90-day drinking trends along with your recent entries and a visual chart of your last 30 days.",
    autoClose: true,
  },

  "/weaning-off-tool": {
    pageId: "weaning-off-tool",
    title: "Weaning Off Tool",
    description:
      "A structured system to help you gradually reduce your alcohol intake at your own pace.",
    spokenText:
      "Weaning-Off Tools. Start by entering your average drinks per day and per week, then choose your pace — gentle, standard, or custom — and generate your plan. You’ll see your weekly targets, your progress, and how many drinks you went over. You can pause the plan anytime, and I’ll keep your schedule updated as the weekly goals step down.",
    autoClose: true,
  },

  "/planner": {
    pageId: "planner",
    title: "Planner",
    description:
      "Your complete meal-planning command center. Choose from all the meal builders — Weekly, Diabetic, GLP-1, Anti-Inflammatory, and Beachbody — and build the exact nutrition plan that fits your goals and your lifestyle.",
    spokenText:
      "Planner Page. Here you can choose from every meal builder we offer. Use the Weekly Meal Builder to plan your entire week, or pick the Diabetic, GLP-1, Anti-Inflammatory, or Beachbody builders to tailor your meals to your specific goal. Tap the builder you need and I’ll walk you through how to create your day.",
    autoClose: true,
  },

  "/lifestyle": {
    pageId: "lifestyle-landing",
    title: "Lifestyle",
    description:
      "Your all-in-one lifestyle toolbox. Explore cravings, use what’s already in your fridge, find healthy options when you’re out, get kid-friendly meals, and make smarter drink choices — all from one place.",
    spokenText:
      "Lifestyle Hub. Everything you need to navigate real life is right here. You can create healthy versions of your cravings, turn whatever you have in your fridge into meals, find smart options when you’re eating out, pick meals for kids or toddlers, and explore smarter drink choices in the Spirits and Lifestyle Hub. Choose what you need and I’ll walk you through it.",
    autoClose: true,
  },

  "/procare-cover": {
    pageId: "procare-cover",
    title: "Procare",
    description:
      "Your professional-grade support center. Access the Supplement Hub for performance and health optimization, and connect with your trainer or physician through the ProCare tools for personalized guidance and expert-driven nutrition setups.",
    spokenText:
      "ProCare. This is your professional support center. Here you can access the Supplement Hub for targeted health and performance supplements, or connect with your trainer or physician through the ProCare tools to get expert guidance built around your goals. Select the option you need and I’ll walk you through it.",
    autoClose: true,
  },

  "/macro-counter": {
    pageId: "macro-counter",
    title: "Macro Calculator",
    description:
      "Set your daily macro targets based on your goals. Choose your goal, pick your body type, enter your stats, select your activity level, and set your current weight. The calculator generates your daily protein, carb, and fat targets to guide your nutrition every day.",
    spokenText:
      "Macro Calculator. Start by choosing your goal and your body type, then enter your stats — gender, age, height, weight, and activity level. You’ll also set your weight here for the biometrics page. Once everything’s filled in, I’ll calculate your daily protein, carbs, and fat targets so you know exactly what to hit each day.",
    autoClose: true,
  },
  "/shopping-list-v2": {
    pageId: "shopping-list-v2",
    title: "Master Shopping List",
    description:
      "Add items, check them off, or create a list for your next grocery run.",
    spokenText:
      'The Master Shopping list. You can enter barcode, add by voice or bulk add for multiple items. Group items by aisle and exclude pantry staples. Use the "Add Other Items" feature, to add your non- food items like household, personal care, pets, pharmacy and other miscellaneous items by brand and units. Send to your preferred delivery service or check off the items as you shop.',
    autoClose: true,
  },
  "/get-inspiration": {
    pageId: "get-inspiration",
    title: "Get Inspiration",
    description:
      "Get your daily motivational quotes and free your mind by speaking or typing your thoughts into the journal. A simple space to reset, reflect, and stay inspired.",
    spokenText:
      "Get Inspiration. Here you can tap Get New Inspiration for a fresh motivational quote, or use the journal to speak or type your thoughts when you need to clear your mind. Remember this, Free your mind and the rest will follow! ",
    autoClose: true,
  },

  "/weekly-meal-board": {
    pageId: "weekly-meal-board",
    title: "Weekly Meal Builder",
    description:
      "Review and manage your entire week of meals in one place. See each day’s breakfast, lunch, dinner, and snacks at a glance, make quick edits, swap meals, or jump into any builder to adjust your plan.",
    spokenText:
      "Weekly Meal Board. Here you can view your entire week of meals at a glance. Tap any day to open it, make changes, swap meals, or jump into the meal builders to update your plan. Check the bottom of the screen for your remaining macros — tap the Guide button for details.",
    autoClose: true,
  },

  "/diabetic-hub": {
    pageId: "diabetic-hub",
    title: "Diabetic Hub",
    description:
      "Your diabetic control center. Set your doctor or coach guardrails, log your blood sugar with fasting or meal timing, track your 7-day trends, and access the diabetic meal builder.",
    spokenText:
      "Diabetic Hub — your control center for managing blood sugar. Set your doctor or coach guardrails, log your readings with fasting or meal timing, and check your 7-day trend to stay on track. When you’re ready, tap the button below to build your diabetic meals.",
    autoClose: true,
  },

  "/diabetic-menu-builder": {
    pageId: "weekly-meal-board",
    title: "Diabetic Meal Builder",
    description:
      "Build carb-conscious meals that help you stay on track with your daily blood sugar goals.",
    spokenText:
      "Diabetic Meal Builder — designed to help you create carb-conscious meals that support healthy blood sugar levels throughout the day. Here you’ll build your meals for the day using the AI Meal Creator or the AI Premades. Choose your meals, pick how you want them prepared, adjust servings, and generate your breakfast, lunch, dinner, and snacks. At the top, pick how many days you want to build — you can duplicate the same day across the week or customize each day differently. When you're done, you can send a single day to your Macro Table, or send everything to your shopping list for easy grocery planning. Check the bottom of the screen for your remaining macros — tap the Guide button for details.",
    autoClose: true,
  },

  "/glp1-hub": {
    pageId: "glp1-hub",
    title: "Glp1 Hub",
    description:
      "Your GLP-1 support hub. Track your weekly injection dose, timing, and injection site with saved history, set your guardrails, and move into the GLP-1 meal builder.",
    spokenText:
      "GLP-1 Hub — your space for tracking and managing your weekly injections. Enter your dose, day, time, and injection site, and I’ll save your history so you can monitor your progress. Set your doctor or coach guardrails, and when you’re ready, head to the GLP-1 Meal Builder.",
    autoClose: true,
  },

  "/glp1-meal-builder": {
    pageId: "weekly-meal-board",
    title: "Glp1 Meal Builder",
    description:
      "Build balanced, appetite-friendly meals that support your GLP-1 routine and help you stay consistent.",
    spokenText:
      "GLP-1 Meal Builder — created to support your appetite-friendly, balanced-nutrition routine while you're on GLP-1 medications. Here you’ll build your meals for the day using the AI Meal Creator or the AI Premades. Choose your meals, pick how you want them prepared, adjust servings, and generate your breakfast, lunch, dinner, and snacks. At the top, pick how many days you want to build — you can duplicate the same day across the week or customize each day differently. When you're done, you can send a single day to your Macro Table, or send everything to your shopping list for easy grocery planning. Check the bottom of the screen for your remaining macros — tap the Guide button for details.",
    autoClose: true,
  },

  "/anti-inflammatory-menu-builder": {
    pageId: "anti-inflammatory-menu-builder",
    title: "Anti-Inflammatory Meal Builder",
    description:
      "Create anti-inflammatory meals for the day with AI tools that keep your choices clean, simple, and inflammation-friendly.",
    spokenText:
      "Anti-Inflammatory Meal Builder — designed to help you create meals that reduce inflammation and keep your nutrition clean and consistent. Here you’ll build your meals for the day using the AI Meal Creator or the AI Premades. Choose your meals, pick how you want them prepared, adjust servings, and generate your breakfast, lunch, dinner, and snacks. At the top, pick how many days you want to build — you can duplicate the same day across the week or customize each day differently. When you're done, you can send a single day to your Macro Table, or send everything to your shopping list for easy grocery planning. Check the bottom of the screen for your remaining macros — tap the Guide button for details. ",
    autoClose: true,
  },

  "/beach-body-meal-board": {
    pageId: "beach-body-meal-board",
    title: "Beach Body Meal Builder",
    description:
      "Build fast, lean meals designed to get you event-ready—perfect for summer cuts, weddings, or any deadline.",
    spokenText:
      "Beachbody Meal Builder — perfect for getting event-ready fast. Whether you're prepping for summer, a wedding, or a big moment, this builder helps you create clean, lean meals that support rapid results. Here you’ll build your meals for the day using the AI Meal Creator or the AI Premades. Choose your meals, pick how you want them prepared, adjust servings, and generate your breakfast, lunch, dinner, and snacks. At the top, pick how many days you want to build — you can duplicate the same day across the week or customize each day differently. When you're done, you can send a single day to your Macro Table, or send everything to your shopping list for easy grocery planning. Check the bottom of the screen for your remaining macros — tap the Guide button for details. ",
    autoClose: true,
  },

  "/care-team": {
    pageId: "care-team",
    title: "Care Team & Pro Care",
    description:
      "Connect with your personal care network. Invite trainers, physicians, or coaches by email, assign their role, or join someone’s team using their access code. ",
    spokenText:
      "Care Team and ProAccess. Here you can invite your trainer, physician, coach, patient or client by email and assign their role, or join someone’s team using their access code. Once the connection is made, you’ll both appear on each other’s Active Care Team, and you can manage your list of people who support your goals. Choose the option you need to get started. ",
    autoClose: true,
  },
};

export function getPageExplanation(pathname: string): PageExplanation | null {
  return PAGE_EXPLANATIONS[pathname] || null;
}

export function hasPageExplanation(pathname: string): boolean {
  return pathname in PAGE_EXPLANATIONS;
}
