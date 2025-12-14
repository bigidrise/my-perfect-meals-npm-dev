type Doc = { id: string; domain: "app"|"nutrition"|"mindset"; title: string; text: string; route?: string };

const KB: Doc[] = [
  // App navigation and features
  { 
    id:"app-1", 
    domain:"app", 
    title:"FitBrain Rush", 
    text:"FitBrain Rush is a 7-question timed trivia game that teaches nutrition, fitness, and mindset with explanations and Daily Mindset Challenges. It's designed to be addictive and educational.", 
    route:"/fitbrain-rush" 
  },
  { 
    id:"app-2", 
    domain:"app", 
    title:"Shopping List", 
    text:"Your Shopping List stores grocery items and quantities. You can add items by voice or text. Smart consolidation groups similar items.", 
    route:"/shopping-list" 
  },
  { 
    id:"app-3", 
    domain:"app", 
    title:"Meal Calendar", 
    text:"Weekly Meal Calendar shows your planned meals for the week. You can generate meal plans, view recipes, and create shopping lists from your meals.", 
    route:"/weekly-meal-calendar" 
  },
  { 
    id:"app-4", 
    domain:"app", 
    title:"Craving Creator", 
    text:"Craving Creator helps you build meals from what you're craving. Input your cravings and get personalized meal suggestions that satisfy your desires while meeting your nutrition goals.", 
    route:"/craving-creator" 
  },
  { 
    id:"app-5", 
    domain:"app", 
    title:"Meal Logging", 
    text:"Log your meals to track nutrition and build eating patterns. The meal journal helps you understand your habits and progress toward your goals.", 
    route:"/log-meals" 
  },
  { 
    id:"app-6", 
    domain:"app", 
    title:"Water Tracking", 
    text:"Track your daily water intake to stay hydrated. Set goals and get reminders to drink water throughout the day.", 
    route:"/log-water" 
  },

  // Nutrition knowledge
  { 
    id:"nut-1", 
    domain:"nutrition", 
    title:"Protein Basics", 
    text:"Most adults training regularly do well at ~0.7–1.0 g protein per lb bodyweight/day, split 25–40g per meal. Good sources include lean meats, fish, eggs, dairy, legumes, and protein powder." 
  },
  { 
    id:"nut-2", 
    domain:"nutrition", 
    title:"Meal Timing", 
    text:"Eat protein within 2 hours post-workout for recovery. Space meals 3-4 hours apart for stable energy. Don't stress perfect timing - consistency matters more than perfection." 
  },
  { 
    id:"nut-3", 
    domain:"nutrition", 
    title:"Hydration", 
    text:"Aim for 8-10 glasses of water daily, more if you're active. Thirst is a late indicator - drink regularly throughout the day. Clear urine usually indicates good hydration." 
  },
  { 
    id:"nut-4", 
    domain:"nutrition", 
    title:"Portion Control", 
    text:"Use your hand as a guide: palm-sized protein, cupped hand of carbs, thumb-sized fats, fist-sized vegetables. Adjust based on your goals and hunger levels." 
  },

  // Mindset and habits
  { 
    id:"mind-1", 
    domain:"mindset", 
    title:"Habit Stacking", 
    text:"Attach a tiny action to a reliable daily cue (after coffee → drink a glass of water). Start small - 2 minutes or less. Identity-based habits work: 'I'm the kind of person who...'" 
  },
  { 
    id:"mind-2", 
    domain:"mindset", 
    title:"Progressive Overload", 
    text:"Gradually increase difficulty over time to keep adapting. In nutrition: add one serving of vegetables. In fitness: add 5 lbs or 1 rep. In habits: extend by 1 minute. Recovery and sleep are part of progress." 
  },
  { 
    id:"mind-3", 
    domain:"mindset", 
    title:"Consistency Over Perfection", 
    text:"Aim for 80% adherence rather than 100% perfection. Missing one day doesn't matter - missing two days starts a pattern. Get back on track immediately after a slip." 
  },
  { 
    id:"mind-4", 
    domain:"mindset", 
    title:"Environment Design", 
    text:"Make good choices easier and bad choices harder. Keep healthy snacks visible, hide junk food. Prep meals in advance. Set up your gym clothes the night before." 
  },
  { 
    id:"mind-5", 
    domain:"mindset", 
    title:"Focus and Attention", 
    text:"Single-task when possible. Use time blocks for focused work. Take breaks every 25-50 minutes. Batch similar tasks together. Turn off notifications during deep work." 
  },
];

function score(query: string, doc: Doc): number {
  const queryLower = query.toLowerCase();
  const contentLower = (doc.title + " " + doc.text).toLowerCase();
  
  let score = 0;
  
  // Exact keyword matches (high value)
  const keywords = {
    'protein': 3,
    'fitbrain': 3,
    'trivia': 3,
    'game': 2,
    'shopping': 3,
    'list': 2,
    'meal': 2,
    'calendar': 2,
    'craving': 3,
    'water': 2,
    'habit': 3,
    'focus': 2,
    'mindset': 2,
    'nutrition': 2,
    'log': 2,
    'track': 2,
    'challenge': 2
  };
  
  for (const [keyword, weight] of Object.entries(keywords)) {
    if (queryLower.includes(keyword) && contentLower.includes(keyword)) {
      score += weight;
    }
  }
  
  // Navigation intent detection
  const navWords = ['open', 'go', 'take', 'navigate', 'show', 'view'];
  if (navWords.some(word => queryLower.includes(word)) && doc.route) {
    score += 2;
  }
  
  // Action intent detection
  const actionWords = ['add', 'create', 'start', 'begin', 'make'];
  if (actionWords.some(word => queryLower.includes(word))) {
    score += 1;
  }
  
  return score;
}

export function retrieve(query: string, k = 3): Doc[] {
  return [...KB]
    .map(doc => ({ doc, score: score(query, doc) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(item => item.doc);
}