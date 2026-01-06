export interface PageExplanation {
  pageId: string;
  title: string;
  description: string;
  spokenText: string;
  autoClose: boolean;
}

export const PAGE_EXPLANATIONS: Record<string, PageExplanation> = {
  "/dashboard": {
    pageId: "dashboard",
    title: "Dashboard",
    description:
      "Your home base. Access meal planning, tracking, cravings, and lifestyle tools from one place.",
    spokenText:
      "Welcome to My Perfect Meals. Before we get started, let me explain Copilot—our app concierge. Copilot is your built-in guide. Anytime you’re on a page and want a quick explanation, tap the Copilot button at the bottom and hit Listen. In Copilot, if Auto is on, it will automatically open and explain each page as you move through the app. If Auto is off, Copilot stays quiet until you open it and press Listen. You can also close Copilot anytime using the X. This is your dashboard—your home base. From here, you can plan meals, track macros, handle cravings, and manage your lifestyle tools. When it comes to designing your meals, you don’t have to be precise—however, the more specific you are, the better the results. For example, you can say, ‘Make me a Mediterranean lunch,’ or you can say, ‘Make me a Mediterranean lunch served hot, with 50 grams of protein, 25 grams of starchy carbs, low gluten, and low fat.’ Either way, the app will build the meal exactly the way you want. Any culture, cuisine or dietary need in the world. From American, Asian, Indian and Nigerian cuisines to Keto, Pescetarian, Vegan or vegetarian, just tell the chef what you want and let him cook. To get started, the first thing you’ll want to do is open the Macro Calculator and set your daily targets. Once that’s done, I’ll guide you through building your meals",
    autoClose: true,
  },

  "/my-biometrics": {
    pageId: "my-biometrics",
    title: "My Biometrics",
    description:
      "Your daily control panel. Scan food labels with MacroScan, log meals instantly, add extra macros when needed, and track calories, weight, and water over time.",
    spokenText:
      "My Biometrics is your tracking and review center. Your daily macro targets live at the top of this page and stay persistent until you recalculate them in the Macro Calculator. You can log packaged foods using MacroScan by taking a photo of a nutrition label, review the AI-read values, and add them to your day. This page also shows your daily, weekly, and monthly macro totals, your weight trends over time, and your daily water intake. Use Biometrics to monitor progress, not plan your meals — it's where everything comes together so you can see how you're doing.",
    autoClose: true,
  },

  "/craving-creator": {
    pageId: "craving-creator",
    title: "Craving Creator",
    description:
      "Create healthier versions of the foods you crave — and add them directly to your meal plan.",
    spokenText:
      "Craving Creator is for those moments when you want something specific, but still want it to fit your goals. Just tell me what you’re craving — sweet, crunchy, creamy, or anything else. Add any preferences or restrictions, like dairy-free or gluten-free, choose how many servings you want, and tap Create. I’ll build a balanced version of that craving with ingredients, nutrition, and instructions. When you find a meal you like, you can add it straight to today’s breakfast, lunch, dinner, or snacks, log the macros, or save it for later. You eat what you want — and still stay on track.",
    autoClose: true,
  },

  "/craving-desserts": {
    pageId: "craving-desserts",
    title: "Dessert Creator",
    description:
    "Create healthier desserts — from everyday cravings to special-occasion treats — without restriction or guilt.",
    spokenText:
    "Dessert Creator is for people who love dessert — not people who want to pretend they don’t.  Start by choosing the kind of dessert you want, whether that’s cake, pie, cookies, brownies, frozen treats, or just hit Surprise Me. Cakes can be anything from a simple slice to a layered celebration or even a wedding-style cake.  Next, pick a flavor direction like chocolate, vanilla, fruit, or spice. If you have something specific in mind — like lemon naked cake, chocolate peanut butter, bakery-style, or rustic wedding cake — just type it in. If not, leave it blank and I’ll handle it.  Then choose how many people you’re serving. This keeps portions realistic, whether it’s just for you, your family, or a bigger event. Add any dietary preferences if needed, then tap Create.  I’ll build you a dessert that actually feels like a dessert — one you can enjoy — without turning it into a cheat-day disaster.",
    autoClose: true,
  },

  "/craving-creator-landing": {
    pageId: "craving-creator-landing",
    title: "Craving Creator Hub",
    description:
      "Choose from three options: Creator for custom AI-generated cravings, Premades for ready-made craving recipes, or Dessert Creator for healthy desserts like pies, cakes, cookies, and more.",
    spokenText:
      "Craving something but can't come up with a healthy option? That's what Craving Creator is for. Tell it what you're craving, set your servings, add any dietary requirements, and tap create. It builds a healthier version that fits your goals.",
    autoClose: true,
  },

  "/craving-presets": {
    pageId: "craving-presets",
    title: "Craving Premades",
    description:
      "Browse ready-made AI craving meals you can use instantly — and add straight to your daily meal plan.",
    spokenText:
      "Craving Presets is where you grab ready-made meals without starting from scratch. Ch0ose how many servings you’re making and your rounding preference so portions stay realistic. Then scroll through the premade meals and tap any one that looks good. Inside each meal, you’ll see ingredients, nutrition, and instructions. From there, you can log the macros, send the ingredients to your shopping list, or add that meal directly to today’s breakfast, lunch, dinner, or snacks. It’s the fastest way to pick a meal and drop it straight into your plan.",
    autoClose: true,
  },

  "/fridge-rescue": {
    pageId: "fridge-rescue",
    title: "Fridge Rescue",
    description:
      "Turn the ingredients you already have into real meals — and add them directly to today’s plan.",
    spokenText:
      "Fridge Rescue is for those nights when you’ve got food at home, but no ideas. Type or speak the ingredients you already have, then tap Generate. I’ll create real meals using what’s in your fridge — no grocery run, no guessing. Each meal comes with ingredients, instructions, and nutrition. If you like one, you can add it directly to today’s breakfast, lunch, dinner, or snacks, log the macros, or send ingredients to your shopping list. It turns what you already have into an actual plan.",
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
      "Trying to make healthier meals for your kids without overthinking it? That's exactly what Kids Meals is for. These meals are designed for ages five to twelve. Pick your servings, choose your rounding — tenth, half, or whole — and tap any meal to open the picture. From there you can view the ingredients, see the cooking instructions, and send everything you need straight to the shopping list.",
    autoClose: true,
  },

  "/toddler-meals": {
    pageId: "toddler-meals",
    title: "Toddler Meals",
    description:
      "Simple, soft, and finger-friendly meals for toddlers. Tap a picture to view ingredients and instructions, and send ingredients to your shopping list instantly.",
    spokenText:
      "Trying to figure out what to feed a toddler who grazes all day? Toddler Meals are built for little ones with softer textures and finger-friendly foods. Pick your servings, choose your rounding, and tap any meal to open the picture. You'll see the ingredients, the simple cooking instructions, and you can send everything you need directly to the shopping list.",
    autoClose: true,
  },

  "/social-hub": {
    pageId: "social-hub",
    title: "Socializing Hub",
    description:
      "Navigate dining out and social eating. Choose Restaurant Guide or Lean Social.",
    spokenText:
      "Socializing Hub. In this feature, you have two ways to find healthy meals. Use Restaurant Guide when you already know where you're eating — just tell me the restaurant and what you want. Or use Find Healthy Options to search by zip code and see what's around you. Tap whichever one you need.",
    autoClose: true,
  },

  "/social-hub/restaurant-guide": {
    pageId: "social-hub/restaurant-guide",
    title: "Restaurant Guide",
    description:
      "Find healthy meals at any restaurant. Enter the restaurant name and what you want to eat, and the app will return three smart, goal-friendly options.",
    spokenText:
      "Love eating out but never knowing how to order off the menu without blowing your nutrition? That’s exactly what Restaurant Guide is for. Just tell me what you’re in the mood for, enter the restaurant name and a nearby zip code, and I’ll give you three smarter meal options that fit your goals — plus simple tips on how to order it better when you’re there. If you decide to eat one of these meals, you can add it straight to your macros with one tap, so your day stays accurate without any guessing. No stress, no overthinking — just order, enjoy, and stay on track.",
    autoClose: true,
  },

  "/social-hub/find": {
    pageId: "social-hub/find",
    title: "Find Meals Near Me",
    description:
      "Find healthy places to eat near you. Enter what you're craving and your zip code, and the app returns nearby restaurants with smart meal options that fit your goals.",
    spokenText:
      "Eating out while trying to stay on track can feel like a guessing game when you don’t know what’s around you. Find Meals Near Me fixes that. Just tell me what you’re craving and enter your zip code, and I’ll show you nearby restaurants with smarter meal options from each one. When you choose a meal, you can log it directly to your macros so everything stays accurate for the day. You pick what sounds good, order smarter, track it easily, and keep moving forward.",
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
      "This is your Planner — this is where everything comes together. Inside this page, you’ll see your meal builder — the one designed for your goals. Whether that’s weekly planning, diabetic support, GLP-1, anti-inflammatory, or another focus, this is where you build your meals day by day. Open your builder and start creating your meals. I’ll walk you through each step as you go, from choosing meals to dialing in portions and staying on track. This is where planning turns into action — let’s get started.",
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
      "Calculate personalized daily protein, carb, and fat targets using your goals, activity level, body composition, and key metabolic factors. Choose your Starch Meal Strategy to control how you manage starchy carbs throughout the day.",
    spokenText:
      "The Macro Calculator helps set personalized daily nutrition targets based on how your body actually works — not just calories. Start by choosing your goal, body type, and activity level, then enter your age, height, weight, and current weight for biometrics. You can also factor in important metabolic considerations like hormone changes, insulin resistance, or high stress, which can influence how your body responds to protein, carbs, and fat. I’ll calculate clear daily targets for protein, starchy carbs, fibrous carbs, and fat — giving you numbers that make sense for you. Here's something important to understand: fibrous carbs like vegetables are unlimited and actually help with weight loss, while starchy carbs like rice, pasta, and potatoes need to be managed. That's why we include a Starch Meal Strategy. You can choose One Starch Meal, which concentrates all your starchy carbs into a single meal — this is the default and works best for appetite control and fat loss. Or you can choose Flex Split, which divides your starch allowance across two meals if that fits your lifestyle better. Once your targets and strategy are set, head to the planner and start building meals that align with those goals.",
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
      "Build meals across one or multiple days using structured or conversational meal tools guided by your goals. The starch indicator shows your daily starch meal status — green means slots available, orange means all used, red means over limit.",
    spokenText:
      "Welcome to your Meal Builder. This is where everything comes together. No matter which builder you’re using, they all work the same way — you’re creating healthy meals in any cuisine or style you want, as long as you tell the Chef what you’re looking for. Start by tapping Create with Chef, our multilingual, multi-cuisine, A.I. Meal Creator, and describe your meal — breakfast, lunch, dinner, or snacks — and be as specific as you like with cuisine, protein amount, carbs, and preferences. The more detail you give, the better the result. You can plan up to a full week at a time, build each day differently, or duplicate days to save time. As you build, focus on protein and carbs — those are the most important drivers of energy and results. When you’re done, you can send meals straight to your shopping list, log the day to your biometrics, or make changes anytime. This is your builder — open it up and start creating meals your way.",
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
      "Build meals that support balanced blood sugar using diabetic-specific guardrails. The starch indicator helps you manage starchy carbs — green means slots available, orange means all used, red means over limit.",
    spokenText:
      "Welcome to the Diabetic Meal Builder. This builder works just like the others, but it’s designed specifically to support blood-sugar control and consistency throughout the day. Start by tapping Create with Chef, our multilingual, multi-cuisine, A.I. Meal Creator, and describe what you want — any cuisine, any style — and be as specific as you like with protein, carbs, and food choices. The Chef will build meals that stay within diabetic-friendly guardrails without feeling restrictive. You can plan a single day or build out an entire week, adjust each day differently, or duplicate days to save time. Build breakfast, lunch, dinner, and snacks in a way that keeps your energy steady and your numbers predictable. As you build, focus on protein and carbs — those matter most for blood-sugar balance. When you’re finished, send your day to biometrics, add ingredients to your shopping list, or make changes anytime. Open your builder and start planning meals that work with your body, not against it.",
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
    description: "Create portion-aware meals designed to support GLP-1 goals. The starch indicator shows your daily starch meal status — green means slots available, orange means all used, red means over limit.",
    spokenText:
      "Welcome to the Diabetic Meal Builder. This builder works just like the others, but it’s designed specifically to support blood-sugar control and consistency throughout the day. Start by tapping Create with Chef, our multilingual, multi-cuisine, A.I. Meal Creator, and describe what you want — any cuisine, any style — and be as specific as you like with protein, carbs, and food choices. The Chef will build meals that stay within diabetic-friendly guardrails without feeling restrictive. You can plan a single day or build out an entire week, adjust each day differently, or duplicate days to save time. Build breakfast, lunch, dinner, and snacks in a way that keeps your energy steady and your numbers predictable. As you build, focus on protein and carbs — those matter most for blood-sugar balance. When you’re finished, send your day to biometrics, add ingredients to your shopping list, or make changes anytime. Open your builder and start planning meals that work with your body, not against it.",

    autoClose: true,
  },

  "/anti-inflammatory-menu-builder": {
    pageId: "anti-inflammatory-menu-builder",
    title: "Anti-Inflammatory Meal Builder",
    description: "Build meals focused on inflammation-friendly ingredients. The starch indicator shows your daily starch meal status — green means slots available, orange means all used, red means over limit.",
    spokenText:
      "Welcome to the Anti-Inflammatory Meal Builder. This builder is designed to help reduce inflammation while still supporting energy, recovery, and long-term health. Start by tapping Create with Chef, our multilingual, multi-cuisine, A.I. Meal Creator, and describe what you want — any cuisine, any style — and include details like protein, carbs, or ingredients you prefer to avoid. The Chef will build meals using anti-inflammatory guardrails without sacrificing flavor or variety. You can plan one day or build out a full week, adjust weekdays and weekends differently, or duplicate days to save time. Build breakfast, lunch, dinner, and snacks in a way that keeps meals balanced and easy to follow. As you build, focus on protein and carbs — those are the most important drivers for energy and recovery. When you’re done, send your day to biometrics, add ingredients to your shopping list, or make changes anytime. Open your builder and start creating meals that help your body feel and perform better.",

    autoClose: true,
  },

  "/beach-body-meal-board": {
    pageId: "beach-body-meal-board",
    title: "Beach Body Meal Builder",
    description:
      "Create structured meals designed for performance and body composition. The starch indicator shows your daily starch meal status — green means slots available, orange means all used, red means over limit.",
    spokenText:
      "Welcome to the Beach Body Meal Builder. This builder is designed for leaning out, tightening up, and dialing in your physique while keeping meals realistic and sustainable. Start by tapping Create with Chef, our multilingual, multi-cuisine, A.I. Meal Creator, and describe what you want — any cuisine, any style — and include details like protein targets, carb levels, or foods you want to limit. The Chef will build meals that support fat loss, muscle tone, and performance without overcomplicating things. You can plan one day or build out a full week, keep weekdays structured, and loosen things slightly on weekends if you choose. Build breakfast, lunch, dinner, and snacks by adjusting the meals themselves instead of traditional serving math. As you build, prioritize protein and carbs — those drive energy, training output, and physique changes. When you’re done, send your day to biometrics, add ingredients to your shopping list, or make tweaks anytime. Open your builder and start creating meals that move your body where you want it to go.",

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
      "The Pro Portal is where you manage your clients and care relationships. To add a new client, enter their name, then select your profession from the dropdown. Your profession determines which dashboard you'll use: trainers go to the Trainer Dashboard with performance and competition builders, while clinical roles like doctors, nurse practitioners, physician assistants, dietitians, nutritionists, and registered nurses go to the Clinician Dashboard with diabetic, GLP-1, and anti-inflammatory builders. Once you've selected your profession and added the client, tap Open to access your professional dashboard, where you'll set targets, apply protocols, and guide their nutrition plan.",
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
      "Welcome to the ProCare Diabetic Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where everything comes together. Using the targets, protocols, and clinical guidelines you’ve already defined, you can build meals for your client by tapping Create with Chef to describe meals and snacks, or by using the A.I. Meal Creator to guide ingredient-level choices. You can plan one day or multiple days, structure each day as needed, and allow flexibility while staying inside the approved medical framework. Build breakfast, lunch, dinner, and snacks by adjusting the meals themselves, not traditional serving math. Prep options help control preparation methods and dial in targets like protein so meals remain compliant with diabetic guidelines. If you’re a client, this is where you build meals using your coach’s or physician’s settings. Follow the targets shown at the bottom of the screen and create your day using Create with Chef, our multilingual, multi-cuisine, Ai Meal Creator. As you build, focus on protein and carbs — those are the primary drivers of energy, glucose response, and daily control. Calories and fats still matter, but they play a supporting role. When you’re finished, you can save your day to Biometrics, send ingredients to the shopping list, or do both. When you’re ready, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/pro/clients/:id/glp1-builder": {
    pageId: "procare-glp1-builder",
    title: "ProCare GLP-1 Meal Builder",
    description:
      "Create GLP-1–aligned meals for your client using appetite-aware guardrails.",
    spokenText:
      "Welcome to the ProCare GLP-1 Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for a client using the targets, protocols, and clinical guidelines you’ve already defined. You can use Create with Chef to describe meals and snacks, or the A.I. Meal Creator to guide ingredient-level choices. From there, choose how many days you want to plan and decide how each day should be structured, allowing flexibility while staying aligned with GLP-1 goals like satiety, protein prioritization, and meal consistency. Build each day with breakfast, lunch, dinner, and snacks by adjusting the meals themselves rather than traditional serving manipulation. Prep options help control how foods are prepared and dial in targets such as protein to support fullness, adherence, and metabolic response. If you’re a client, this is where you build meals using your coach’s or physician’s settings. Follow the targets shown at the bottom of the screen and create your day using Create with Chef, our multilingual, multi-cuisine, Ai Meal Creator. As you build, focus on protein and carbs — those are the primary drivers of satiety, energy stability, and lean tissue preservation. Calories and fats still matter, but they play a supporting role. When you’re finished, you can save your day to Biometrics, send ingredients to the shopping list, or do both. When you’re ready, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/pro/clients/:id/anti-inflammatory-builder": {
    pageId: "procare-anti-inflammatory-builder",
    title: "ProCare Anti-Inflammatory Meal Builder",
    description:
      "Build inflammation-conscious meals for your client using targeted guardrails.",
    spokenText:
      "Welcome to the ProCare Anti-Inflammatory Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for a client using the targets, protocols, and clinical guidelines you’ve already defined. You can use Create with Chef to describe meals and snacks, or the A.I. Meal Creator to guide ingredient-level choices. From there, choose how many days you want to plan and decide how each day should be structured, allowing flexibility while staying aligned with anti-inflammatory goals like nutrient quality, food variety, and consistency. Build each day with breakfast, lunch, dinner, and snacks by adjusting the meals themselves rather than traditional serving manipulation. Prep options help control how foods are prepared and support anti-inflammatory strategies such as cooking methods, ingredient selection, and protein targets. If you’re a client, this is where you build meals using your coach’s or physician’s settings. Follow the targets shown at the bottom of the screen and create your day using Create with Chef our multilingual, multi-cuisine, AI Meal Creator. As you build, focus on protein and carbs — those are the primary drivers of recovery, energy stability, and tissue repair. Calories and fats still matter, but they play a supporting role. When you’re finished, you can save your day to Biometrics, send ingredients to the shopping list, or do both. When you’re ready, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/pro/clients/:id/performance-competition-builder": {
    pageId: "procare-performance-competition-builder",
    title: "ProCare Performance & Competition Meal Builder",
    description:
      "Create precision-based performance meals for your client using competition-level guardrails. The starch indicator shows daily starch meal status — green means slots available, orange means all used, red means over limit.",
    spokenText:
      "Welcome to the ProCare Performance and Competition Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for a client using the targets, protocols, and performance guidelines you’ve already defined. You can use Create with Chef to describe meals and snacks, or the A.I.Meal Creator to guide ingredient-level choices. From there, choose how many days you want to plan and decide how each day should be structured, allowing flexibility while staying aligned with training demands, competition schedules, and recovery needs. Build each day with breakfast, lunch, dinner, and snacks by adjusting the meals themselves rather than traditional serving manipulation. Prep options help dial in details like protein amounts and preparation methods to support performance output, recovery, and body composition. If you’re a client, this is where you build meals using your coach’s or physician’s settings. Follow the targets shown at the bottom of the screen and create your day using Create with Chef our multilingual, multi-cuisine, AI Meal Creator. As you build, focus on protein and carbs — those are the primary drivers of energy availability, recovery, and competitive performance. Calories and fats still matter, but they play a supporting role. When you’re finished, you can save your day to Biometrics, send ingredients to the shopping list, or do both. When you’re ready, tap Save Day to Biometrics to lock everything in.",
    autoClose: true,
  },

  "/pro/clients/:id/general-nutrition-builder": {
    pageId: "procare-general-nutrition-builder",
    title: "ProCare General Nutrition Meal Builder",
    description:
      "Build balanced, everyday meals for your client using flexible nutrition guardrails. The starch indicator shows daily starch meal status — green means slots available, orange means all used, red means over limit.",
    spokenText:
      "Welcome to the ProCare General Nutrition Meal Builder. This builder is used to create meals within the guardrails set by a coach or physician. If you’re a professional, this is where you build meals for a client using the nutrition targets, protocols, and guidelines you’ve already defined. You can use Create with Chef to describe meals and snacks, or the A.I. Meal Creator to guide ingredient-level choices. From there, choose how many days you want to plan and decide how each day should be structured, allowing flexibility while staying aligned with the overall nutrition framework. Build each day with breakfast, lunch, dinner, and snacks by adjusting the meals themselves rather than traditional serving manipulation. Prep options help dial in details like protein amounts and preparation methods so meals stay practical, balanced, and consistent.If you’re a client, this is where you build meals using your coach’s or physician’s settings. Follow the targets shown at the bottom of the screen and create your day using Create with Chef, our multilingual, multi-cuisine, AI Meal Creator. As you build, focus on protein and carbs — those are the primary drivers of energy, recovery, and nutritional balance. Calories and fats still matter, but they play a supporting role. When you’re finished, you can save your day to Biometrics, send ingredients to the shopping list, or do both. When you’re ready, tap Save Day to Biometrics to lock everything in.”",
    autoClose: true,
  },

  "/select-builder": {
    pageId: "select-builder",
    title: "Choose How You'll Continue",
    description:
      "Switch meal boards as your needs change — whether you're graduating from ProCare, following a medical plan, or simplifying long-term.",
    spokenText:
      "This page is for choosing how you'll continue with My Perfect Meals. You're already a member — this is about switching your meal board as your needs evolve. If you've finished working with a coach or clinician, most people transition to the Weekly Meal Builder for long-term balance. If your health needs have changed — like starting a GLP-1 medication or managing diabetes — select the board that supports that condition. All options continue at nineteen ninety-nine per month, and you keep your history, meals, macros, and preferences. Just pick the board that fits your next chapter and tap Continue.",
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
      "Welcome to the App Library. This is your go-to resource for understanding how My Perfect Meals works and the nutrition science behind it. You'll find informative articles on topics like fiber and vegetables, meal planning basics, and the difference between tracking calories versus macros. There's also an interactive food comparison tool that shows you how fat content changes how much food you get per hundred calories. The Copilot Walkthroughs section explains how to use each feature — just tap any topic to read more. This is where the app teaches you the why, not just the how.",
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
    description:
      "Review the terms and conditions for using My Perfect Meals.",
    spokenText:
      "This is our Terms of Service page. Here you can review the legal terms and conditions that govern your use of My Perfect Meals. This includes information about your rights as a user, our responsibilities as a service provider, and the guidelines for using the app. If you have questions about any of the terms, you can always reach out to our support team.",
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
