export interface PageExplanation {
  pageId: string;
  title: string;
  description: string;
  spokenText: string;
  autoClose: boolean;
}

export const PAGE_EXPLANATIONS: Record<string, metricPageExplanation> = {
  "/my-biometrics": {
    pageId: "my-biometrics",
    title: "My Biometrics",
    description:
      "Use My Biometrics to set your daily macros, log meals and photos, track calories and body weight over time, and monitor your daily water intake.",
    spokenText:
      "This is your Biometrics page. When you send your macros here from the macro calculator, they become your total daily targets. Everything you log on this page is tracked against those numbers for the day. You can add meals or macros manually, or bring them in from meal cards or photo logs. Once they appear, just tap add to include them in today’s totals. You can also delete or reset entries anytime. We track your calories for today, the past seven days, and up to thirty days, so you can see how your intake changes over time and spot trends easily. You can also log your body weight and view progress across one month, three months, six months, or up to a full year. At the bottom of the page, you’ll find your water log, where you can track your daily hydration throughout the day.",
    autoClose: true,
  },

  "/craving-creator": {
    pageId: "craving-creator",
    title: "Craving Creator",
    description:
      "Use Craving Creator to describe what you’re in the mood for and get a personalized recipe that fits your taste, preferences, and lifestyle.",
    spokenText:
      "Craving Creator. Describe what you're craving. For example, say I want something sweet, crunchy, lowfat, low sugar, no gluten or I want a creamy shake, or something tangy and refreshing. Select your servings, press Create, and enjoy your personalized meal. You NEVER have to ignore your cravings again!",
    autoClose: true,
  },

  "/craving-desserts": {
    pageId: "craving-desserts",
    title: "Dessert Creator",
    description:
      "Use Dessert Creator to build a dessert by choosing the type, flavor, texture, servings, and any dietary needs.",
    spokenText:
      "Dessert Creator lets you turn a sweet idea into a dessert made just for you. Start by choosing what kind of dessert you want, like cake, pie, cookies, smoothies, frozen treats, or let us surprise you. Pick the flavors or textures you’re in the mood for, choose how many servings you need, and add any dietary requirements if you have them. When you’re ready, tap create and enjoy a dessert that fits exactly what you were craving.",
    autoClose: true,
  },

  "/craving-creator-landing": {
    pageId: "craving-creator-landing",
    title: "Craving Creator Hub",
    description:
      "Choose how you want to satisfy a craving with custom creations, ready-made recipes, or healthier dessert options.",
    spokenText:
      "Welcome to the Craving Creator Hub. From here, you’ve got three ways to go. Choose Craving Creator to build a custom craving using AI, Craving Premades to browse ready-made craving recipes, or Dessert Creator to make healthier desserts like cakes, cookies, brownies, and more. Pick the option that fits your mood and let’s get started.",
    autoClose: true,
  },

  "/craving-presets": {
    pageId: "craving-presets",
    title: "Craving Premades",
    description:
      "Browse ready-made craving meals and desserts, view nutrition details, and take action with just a tap.",
    spokenText:
      "Craving Premades gives you a collection of ready-made craving meals to choose from. Start by selecting how many servings you’re preparing and your preferred measurement style, then browse through the options. Tap any image to see ingredients, nutrition information, and cooking instructions. From there, you can send ingredients to your master shopping list, log your macros, or do both.",
    autoClose: true,
  },

  "/fridge-rescue": {
    pageId: "fridge-rescue",
    title: "Fridge Rescue",
    description:
      "Turn the ingredients you already have into simple, personalized meal ideas.",
    spokenText:
      "Fridge Rescue turns the ingredients you already have into real meal ideas. Just type or say what’s in your fridge, tap generate, and you’ll get three personalized meals built from what you have on hand. It’s an easy way to cook without extra shopping.",
    autoClose: true,
  },

  "/healthy-kids-meals": {
    pageId: "healthy-kids-meals",
    title: "Healthy Kids Meals Hub",
    description:
      "Browse healthy, kid-friendly meals designed for children ages five to twelve.",
    spokenText:
      "Healthy Kids Meals is a collection of balanced, kid-friendly meals made for ages five to twelve. Tap any meal to see ingredients and cooking instructions, and send what you need straight to your shopping list with one tap.",
    autoClose: true,
  },

  "/kids-meals": {
    pageId: "kids-meals",
    title: "Kids Meals",
    description:
      "Choose meals designed for kids or toddlers, with simple ingredients you can send to your shopping list.",
    spokenText:
      "Kids Meals gives you meal options designed for children ages four to twelve. Start by picking your number of servings and your rounding preference, then tap any meal to open it. You can view the ingredients, see the cooking instructions, and send everything you need straight to your shopping list.",
    autoClose: true,
  },

  "/toddler-meals": {
    pageId: "toddler-meals",
    title: "Toddler Meals",
    description:
      "Browse soft, simple meals designed for toddlers, with easy ingredients you can send to your shopping list.",
    spokenText:
      "Toddler Meals offers gentle, finger-friendly meal options made for little ones. Choose your number of servings and rounding preference, then tap any meal to open it. You’ll see the ingredients, simple cooking instructions, and can send everything you need straight to your shopping list.",
    autoClose: true,
  },

  "/social-hub": {
    pageId: "social-hub",
    title: "Socializing Hub",
    description:
      "Navigate dining out and social eating. Choose Restaurant Guide or Find a Meals Near Me.",
    spokenText:
      "Socializing Hub. In this feature, you have two ways to find healthy meals. Use Restaurant Guide when you already know where you’re eating — just tell me the restaurant and what you want. Or use Find Meals Near Me to search by zip code and see what’s around you. Tap whichever one you need.",
    autoClose: true,
  },

  "/social-hub/restaurant-guide": {
    pageId: "social-hub/restaurant-guide",
    title: "Restaurant Guide",
    description:
      "Find healthier meal options at restaurants based on what you want to eat.",
    spokenText:
      "Restaurant Guide helps you make better choices when eating out. Just describe what you’re craving, enter the restaurant name and a nearby zip code, and you’ll see meal options that match your goals and work where you’re eating.",
    autoClose: true,
  },

  "/social-hub/find": {
    pageId: "social-hub/find",
    title: "Find Meals Near Me",
    description:
      "Discover healthy meals near you. Enter what your craving and your zip code, and the app will return three nearby restaurants with two meal options for you to choose from.",
    spokenText:
      "Find Meals Near Me. Tell me what you’re craving and your zip code, and I’ll show you nearby restaurants with two healthy meal options from each, along with simple guidance on how to order off the menu.",
    autoClose: true,
  },

  "/alcohol-hub": {
    pageId: "alcohol-hub",
    title: "Spirits & Lifestyle Hub",
    description:
      "A guide to smarter drinking with pairings, mixers, meal matches, and tools to help you cut back.",
    spokenText:
      "Spirits and Lifestyle Hub helps you drink smarter without overthinking it. Here you can explore wine, beer, and bourbon pairings, find lower calorie mixers and mocktail ideas, match drinks to meals, or use the weaning off tools if you’re cutting back. Choose what you want to explore and I’ll guide you from there.",
    autoClose: true,
  },

  "/alcohol/lean-and-social": {
    pageId: "alcohol/lean-and-social",
    title: "Lean & Social",
    description:
      "Tips and strategies for eating well at parties, BBQs, and social events without feeling restricted.",
    spokenText:
      "Lean and Social helps you stay on track when food choices get tricky. Whether you’re at a party, a BBQ, or a social event, you’ll find simple strategies to help you choose smarter portions, enjoy what’s available, and still feel confident in your decisions. Tap a section to get started and I’ll walk you through it.",
    autoClose: true,
  },

  "/wine-pairing": {
    pageId: "wine-pairing",
    title: "Wine Pairing",
    description:
      "Find wines that pair well with your meal based on food style, occasion, or preference.",
    spokenText:
      "Wine Pairing helps you find the right wine to match what you’re eating. Choose things like your meal type, cuisine style, main ingredient, occasion, or price range, and I’ll recommend wines that fit your selection and complement your meal.",
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
      "This is the Planner page, where you can choose from all of our meal builders in one place. Use the Weekly Meal Builder to plan out your week, or select the Diabetic, GLP-1, Anti-Inflammatory, or Beachbody builders to focus on a specific goal. Tap the builder you want and I’ll guide you step by step through creating your plan.",
    autoClose: true,
  },

  "/lifestyle": {
    pageId: "lifestyle-landing",
    title: "Lifestyle",
    description:
      "Your central hub for everyday food, lifestyle, and real-life eating decisions.",
    spokenText:
    "Welcome to the Lifestyle Hub, where everything comes together for real life. From here you can enjoy your cravings in a healthier way, turn what’s in your fridge into meals, find smarter options when eating out, choose meals for kids or toddlers, and explore drink choices in the Spirits and Lifestyle Hub. This space is here to help you enjoy food, social time, and nights out without stress, guilt, or overthinking — so explore what you need and enjoy yourself.",
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
      "Calculate your daily protein, carb, and fat targets based on your goals and activity level.",
    spokenText:
      "The Macro Calculator helps you set clear daily nutrition targets. Start by choosing your goal and body type, then enter your stats like age, height, weight, and activity level. You’ll also set your current weight for biometrics. Once everything’s filled in, I’ll calculate your daily protein, carbs, and fats so you know exactly what to aim for each day.",
    autoClose: true,
  },
  "/shopping-list-v2": {
    pageId: "shopping-list-v2",
    title: "Master Shopping List",
    description:
      "Create, manage, and check off items for your grocery trips and everyday shopping.",
    spokenText:
      "The Master Shopping List helps you organize everything you need in one place. You can add items by barcode, voice, or bulk entry, group them by aisle, and exclude pantry staples. Use Add Other Items for non food needs like household, personal care, pets, or pharmacy items, then check things off as you shop or send your list to a delivery service.",
    autoClose: true,
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
      "Build meals across one or multiple days using structured or conversational meal tools guided by your goals.",
    spokenText:
      "All meal builders work the same way, with guardrails based on the board you’re using. When building meals, you have three options. Use the AI Meal Creator if you want to pick specific ingredients using the meal picker. Use Create With Chef if you’d rather describe what you want and let the Chef build it for you. For snacks, you’ll also describe what you want and the Chef will create it. Choose how many days you want to build, create breakfast, lunch, dinner, and snacks, adjust servings, then send meals to your macro table or ingredients to your shopping list.",
    autoClose: true,
  },

  "/diabetic-hub": {
    pageId: "diabetic-hub",
    title: "Diabetic Hub",
    description:
      "Your control center for managing blood sugar with clinician-style guardrails and daily glucose tracking.",
    spokenText:
      "The Diabetic Hub is your control center for managing blood sugar day to day. Here you can set and save doctor or coach guardrails like fasting ranges, pre meal maximums, daily carb limits, fiber minimums, glycemic index caps, and meal frequency. You can log glucose readings with context like fasting, pre meal, or post meal, view your most recent reading, and track seven day trends. When you’re ready to build meals, use the button at the bottom to jump into the diabetic meal builder.",
    autoClose: true,
  },

  "/diabetic-menu-builder": {
    pageId: "weekly-meal-board",
    title: "Diabetic Meal Builder",
    description:
      "Build meals that support balanced blood sugar using diabetic-specific guardrails.",
    spokenText:
      "The Diabetic Meal Builder uses the same meal-building tools with guardrails designed for blood sugar support. Use the AI Meal Creator to pick ingredients with the meal picker, or use Create With Chef to describe your meals and snacks. Build one or multiple days, adjust servings, and send meals to your macro table or shopping list while staying within diabetic-friendly targets.",
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
    description: "Create portion-aware meals designed to support GLP-1 goals.",
    spokenText:
      "The GLP-1 Meal Builder follows the same process with guardrails designed for portion control and satiety. Use the AI Meal Creator if you want to select ingredients, or use Create With Chef to describe your meals and snacks. Portions are guided automatically, and you can send meals to your macro table or shopping list when finished.",
    autoClose: true,
  },

  "/anti-inflammatory-menu-builder": {
    pageId: "anti-inflammatory-menu-builder",
    title: "Anti-Inflammatory Meal Builder",
    description: "Build meals focused on inflammation-friendly ingredients.",
    spokenText:
      "The Anti-Inflammatory Meal Builder uses the same tools with guardrails focused on inflammation-friendly choices. Build meals using the AI Meal Creator with the meal picker, or describe your meals and snacks using Create With Chef. Adjust servings, plan your days, and send meals to your macro table or shopping list.",
    autoClose: true,
  },

  "/beach-body-meal-board": {
    pageId: "beach-body-meal-board",
    title: "Beach Body Meal Builder",
    description:
      "Create structured meals designed for performance and body composition.",
    spokenText:
      "The Beachbody Meal Builder uses the same meal-building flow with performance-focused guardrails. Choose the AI Meal Creator to select ingredients, or use Create With Chef to describe meals and snacks. Build one or multiple days, adjust portions, and send meals to your macro table or shopping list.",
    autoClose: true,
  },

  "/care-team": {
    pageId: "care-team",
    title: "Care Team & Pro Care",
    description:
      "Connect with trainers, physicians, or coaches to build and manage your personal care team.",
    spokenText:
      "Care Team and ProAccess lets you connect with the people who support your goals. You can invite a trainer, physician, coach, patient, or client by email and assign their role, or join someone’s team using an access code. Once connected, you’ll appear on each other’s active care team and can manage your support network anytime. Choose the option you need to get started.",
    autoClose: true,
  },

  "/pro/clients": {
    pageId: "pro-clients",
    title: "Pro Portal",
    description:
      "Your professional portal for managing clients and accessing their care dashboards.",
    spokenText:
      "The Pro Portal is where you manage your clients and care relationships. From here, you can add a new client, accept an invitation, or open an existing client profile. Once a client is connected, tap Open to access their dashboard, where you'll set targets, apply protocols, and guide their nutrition plan.",
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

  "/pro/clients/:id/diabetic-builder": {
    pageId: "procare-diabetic-builder",
    title: "ProCare Diabetic Meal Builder",
    description:
      "Build diabetic-friendly meals for your client using clinician-defined guardrails.",
    spokenText:
      "This diabetic meal builder is used under ProCare to create meals using the guardrails set by a coach or physician. As a professional, this is where you build meals for your client based on the targets, protocols, and guidelines you’ve already defined, using either the AI Meal Creator to pick ingredients with the meal picker or Create With Chef to describe meals and snacks and let the Chef build them. You can build one or multiple days, adjust servings, and generate breakfast, lunch, dinner, and snacks, then send a full day to biometrics to log macros, send ingredients to the shopping list, or do both. If you’re the client, this is where you build your meals using your coach’s guidelines, following the targets shown at the bottom of the screen, creating your day with the AI Meal Creator or Create With Chef, and saving your meals to biometrics and your shopping list.",
    autoClose: true,
  },

  "/pro/clients/:id/glp1-builder": {
    pageId: "procare-glp1-builder",
    title: "ProCare GLP-1 Meal Builder",
    description:
      "Create GLP-1–aligned meals for your client using appetite-aware guardrails.",
    spokenText:
      "The GLP-1 meal builder is used under ProCare to create meals using the guardrails set by a coach or physician. As a professional, this is where you build meals for your client based on the targets, protocols, and guidelines you’ve already defined, using either the AI Meal Creator to pick ingredients with the meal picker or Create With Chef to describe meals and snacks and let the Chef build them. You can build one or multiple days, adjust servings, and generate breakfast, lunch, dinner, and snacks, then send a full day to biometrics to log macros, send ingredients to the shopping list, or do both. If you’re the client, this is where you build your meals using your coach’s guidelines, following the targets shown at the bottom of the screen, creating your day with the AI Meal Creator or Create With Chef, and saving your meals to biometrics and your shopping list.",
    autoClose: true,
  },

  "/pro/clients/:id/anti-inflammatory-builder": {
    pageId: "procare-anti-inflammatory-builder",
    title: "ProCare Anti-Inflammatory Meal Builder",
    description:
      "Build inflammation-conscious meals for your client using targeted guardrails.",
    spokenText:
      "This anti-inflammatory meal builder is used under ProCare to create meals using the guardrails set by a coach or physician. As a professional, this is where you build meals for your client based on the targets, protocols, and guidelines you’ve already defined, using either the AI Meal Creator to pick ingredients with the meal picker or Create With Chef to describe meals and snacks and let the Chef build them. You can build one or multiple days, adjust servings, and generate breakfast, lunch, dinner, and snacks, then send a full day to biometrics to log macros, send ingredients to the shopping list, or do both. If you’re the client, this is where you build your meals using your coach’s guidelines, following the targets shown at the bottom of the screen, creating your day with the AI Meal Creator or Create With Chef, and saving your meals to biometrics and your shopping list.",
    autoClose: true,
  },

  "/pro/clients/:id/performance-competition-builder": {
    pageId: "procare-performance-competition-builder",
    title: "ProCare Performance & Competition Meal Builder",
    description:
      "Create precision-based performance meals for your client using competition-level guardrails.",
    spokenText:
      "The performance and competition meal builder is used under ProCare to create meals using the guardrails set by a coach or physician. As a professional, this is where you build meals for your client based on the targets, protocols, and guidelines you’ve already defined, using either the AI Meal Creator to pick ingredients with the meal picker or Create With Chef to describe meals and snacks and let the Chef build them. You can build one or multiple days, adjust servings, and generate breakfast, lunch, dinner, and snacks, then send a full day to biometrics to log macros, send ingredients to the shopping list, or do both. If you’re the client, this is where you build your meals using your coach’s guidelines, following the targets shown at the bottom of the screen, creating your day with the AI Meal Creator or Create With Chef, and saving your meals to biometrics and your shopping list.",
    autoClose: true,
  },

  "/pro/clients/:id/general-nutrition-builder": {
    pageId: "procare-general-nutrition-builder",
    title: "ProCare General Nutrition Meal Builder",
    description:
      "Build balanced, everyday meals for your client using flexible nutrition guardrails.",
    spokenText:
      "This general nutrition meal builder is used under ProCare to create meals using the guardrails set by a coach or physician. As a professional, this is where you build meals for your client based on the targets, protocols, and guidelines you’ve already defined, using either the AI Meal Creator to pick ingredients with the meal picker or Create With Chef to describe meals and snacks and let the Chef build them. You can build one or multiple days, adjust servings, and generate breakfast, lunch, dinner, and snacks, then send a full day to biometrics to log macros, send ingredients to the shopping list, or do both. If you’re the client, this is where you build your meals using your coach’s guidelines, following the targets shown at the bottom of the screen, creating your day with the AI Meal Creator or Create With Chef, and saving your meals to biometrics and your shopping list.",
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

export function hasPageExplanation(pathname: string): boolean {
  return getPageExplanation(pathname) !== null;
}
