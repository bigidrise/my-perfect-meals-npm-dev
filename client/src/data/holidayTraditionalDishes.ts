export type DishCategory = "appetizer" | "main" | "side" | "dessert";

export interface TraditionalDish {
  name: string;
  category: DishCategory;
}

export interface HolidayData {
  popular: string[];
  appetizers: TraditionalDish[];
  mains: TraditionalDish[];
  sides: TraditionalDish[];
  desserts: TraditionalDish[];
}

export const HOLIDAY_DISHES: Record<string, HolidayData> = {
  thanksgiving: {
    popular: ["Roast Turkey", "Mashed Potatoes", "Green Bean Casserole", "Pumpkin Pie"],
    appetizers: [
      { name: "Deviled Eggs", category: "appetizer" },
      { name: "Stuffed Mushrooms", category: "appetizer" },
      { name: "Cranberry Brie Bites", category: "appetizer" },
      { name: "Butternut Squash Soup", category: "appetizer" },
    ],
    mains: [
      { name: "Roast Turkey", category: "main" },
      { name: "Herb-Glazed Turkey Breast", category: "main" },
      { name: "Honey-Baked Ham", category: "main" },
      { name: "Pot Roast", category: "main" },
    ],
    sides: [
      { name: "Mashed Potatoes", category: "side" },
      { name: "Stuffing / Dressing", category: "side" },
      { name: "Green Bean Casserole", category: "side" },
      { name: "Sweet Potato Casserole", category: "side" },
      { name: "Cranberry Sauce", category: "side" },
      { name: "Corn Bread", category: "side" },
      { name: "Dinner Rolls", category: "side" },
      { name: "Candied Yams", category: "side" },
      { name: "Roasted Brussels Sprouts", category: "side" },
      { name: "Mac and Cheese", category: "side" },
      { name: "Gravy", category: "side" },
    ],
    desserts: [
      { name: "Pumpkin Pie", category: "dessert" },
      { name: "Pecan Pie", category: "dessert" },
      { name: "Apple Pie", category: "dessert" },
      { name: "Sweet Potato Pie", category: "dessert" },
      { name: "Banana Pudding", category: "dessert" },
    ],
  },
  christmas: {
    popular: ["Honey Glazed Ham", "Mashed Potatoes", "Green Bean Casserole", "Sweet Potato Pie"],
    appetizers: [
      { name: "Shrimp Cocktail", category: "appetizer" },
      { name: "Brie with Cranberry", category: "appetizer" },
      { name: "Smoked Salmon Crostini", category: "appetizer" },
      { name: "Spinach Artichoke Dip", category: "appetizer" },
    ],
    mains: [
      { name: "Honey Glazed Ham", category: "main" },
      { name: "Prime Rib", category: "main" },
      { name: "Roast Turkey", category: "main" },
      { name: "Beef Wellington", category: "main" },
      { name: "Crown Roast of Pork", category: "main" },
      { name: "Lamb Roast", category: "main" },
    ],
    sides: [
      { name: "Mashed Potatoes", category: "side" },
      { name: "Green Bean Casserole", category: "side" },
      { name: "Stuffing / Dressing", category: "side" },
      { name: "Cranberry Sauce", category: "side" },
      { name: "Roasted Root Vegetables", category: "side" },
      { name: "Mac and Cheese", category: "side" },
      { name: "Collard Greens", category: "side" },
      { name: "Yorkshire Pudding", category: "side" },
      { name: "Dinner Rolls", category: "side" },
      { name: "Sweet Potato Casserole", category: "side" },
    ],
    desserts: [
      { name: "Sweet Potato Pie", category: "dessert" },
      { name: "Yule Log Cake", category: "dessert" },
      { name: "Christmas Cookies", category: "dessert" },
      { name: "Eggnog Cheesecake", category: "dessert" },
      { name: "Pecan Pie", category: "dessert" },
      { name: "Gingerbread Cake", category: "dessert" },
      { name: "Peppermint Brownies", category: "dessert" },
    ],
  },
  kwanzaa: {
    popular: ["Jerk Chicken", "Jollof Rice", "Collard Greens", "Sweet Potato Pie"],
    appetizers: [
      { name: "Plantain Chips and Dip", category: "appetizer" },
      { name: "Akara (Bean Fritters)", category: "appetizer" },
      { name: "Groundnut Soup", category: "appetizer" },
    ],
    mains: [
      { name: "Jerk Chicken", category: "main" },
      { name: "Oxtail Stew", category: "main" },
      { name: "Grilled Tilapia", category: "main" },
      { name: "Goat Curry", category: "main" },
    ],
    sides: [
      { name: "Jollof Rice", category: "side" },
      { name: "Collard Greens", category: "side" },
      { name: "Fried Plantains", category: "side" },
      { name: "Black-Eyed Peas", category: "side" },
      { name: "Cornbread", category: "side" },
      { name: "Fufu", category: "side" },
    ],
    desserts: [
      { name: "Sweet Potato Pie", category: "dessert" },
      { name: "Coconut Cake", category: "dessert" },
      { name: "Bread Pudding", category: "dessert" },
      { name: "Mandazi (Fried Dough)", category: "dessert" },
    ],
  },
  hanukkah: {
    popular: ["Potato Latkes", "Brisket", "Sufganiyot", "Kugel"],
    appetizers: [
      { name: "Matzo Ball Soup", category: "appetizer" },
      { name: "Gefilte Fish", category: "appetizer" },
      { name: "Chopped Liver", category: "appetizer" },
    ],
    mains: [
      { name: "Brisket", category: "main" },
      { name: "Roasted Chicken", category: "main" },
      { name: "Stuffed Cabbage", category: "main" },
      { name: "Beef Short Ribs", category: "main" },
    ],
    sides: [
      { name: "Potato Latkes", category: "side" },
      { name: "Kugel (Noodle Pudding)", category: "side" },
      { name: "Roasted Potatoes", category: "side" },
      { name: "Tzimmes", category: "side" },
      { name: "Applesauce", category: "side" },
      { name: "Challah Bread", category: "side" },
    ],
    desserts: [
      { name: "Sufganiyot (Jelly Donuts)", category: "dessert" },
      { name: "Rugelach", category: "dessert" },
      { name: "Honey Cake", category: "dessert" },
      { name: "Apple Cake", category: "dessert" },
    ],
  },
  eid: {
    popular: ["Biryani", "Lamb Curry", "Samosas", "Sheer Khurma"],
    appetizers: [
      { name: "Samosas", category: "appetizer" },
      { name: "Kebabs", category: "appetizer" },
      { name: "Harira Soup", category: "appetizer" },
      { name: "Hummus and Pita", category: "appetizer" },
    ],
    mains: [
      { name: "Biryani", category: "main" },
      { name: "Lamb Roast", category: "main" },
      { name: "Lamb Curry", category: "main" },
      { name: "Chicken Tikka Masala", category: "main" },
      { name: "Whole Roasted Lamb", category: "main" },
    ],
    sides: [
      { name: "Basmati Rice", category: "side" },
      { name: "Naan Bread", category: "side" },
      { name: "Raita", category: "side" },
      { name: "Chana Masala", category: "side" },
      { name: "Roasted Vegetables", category: "side" },
    ],
    desserts: [
      { name: "Sheer Khurma", category: "dessert" },
      { name: "Baklava", category: "dessert" },
      { name: "Gulab Jamun", category: "dessert" },
      { name: "Kunafa", category: "dessert" },
      { name: "Rice Pudding", category: "dessert" },
    ],
  },
  passover: {
    popular: ["Brisket", "Matzo Ball Soup", "Charoset", "Flourless Chocolate Cake"],
    appetizers: [
      { name: "Matzo Ball Soup", category: "appetizer" },
      { name: "Gefilte Fish with Horseradish", category: "appetizer" },
      { name: "Chopped Liver", category: "appetizer" },
    ],
    mains: [
      { name: "Brisket", category: "main" },
      { name: "Roasted Chicken", category: "main" },
      { name: "Lamb Shank", category: "main" },
      { name: "Herb-Crusted Salmon", category: "main" },
    ],
    sides: [
      { name: "Tzimmes", category: "side" },
      { name: "Potato Kugel", category: "side" },
      { name: "Charoset", category: "side" },
      { name: "Roasted Asparagus", category: "side" },
      { name: "Matzo Brei", category: "side" },
      { name: "Roasted Potatoes", category: "side" },
    ],
    desserts: [
      { name: "Flourless Chocolate Cake", category: "dessert" },
      { name: "Macaroons", category: "dessert" },
      { name: "Almond Cake", category: "dessert" },
      { name: "Fruit Compote", category: "dessert" },
    ],
  },
  "new-years": {
    popular: ["Black-Eyed Peas", "Collard Greens", "Pork Tenderloin", "Champagne Cake"],
    appetizers: [
      { name: "Shrimp Cocktail", category: "appetizer" },
      { name: "Caviar and Blini", category: "appetizer" },
      { name: "Oysters on the Half Shell", category: "appetizer" },
      { name: "Stuffed Mushrooms", category: "appetizer" },
    ],
    mains: [
      { name: "Pork Tenderloin", category: "main" },
      { name: "Beef Tenderloin", category: "main" },
      { name: "Champagne-Braised Shrimp", category: "main" },
      { name: "Roasted Salmon", category: "main" },
      { name: "Rack of Lamb", category: "main" },
    ],
    sides: [
      { name: "Black-Eyed Peas", category: "side" },
      { name: "Collard Greens", category: "side" },
      { name: "Cornbread", category: "side" },
      { name: "Hoppin' John", category: "side" },
      { name: "Roasted Fingerling Potatoes", category: "side" },
      { name: "Pomegranate Salad", category: "side" },
    ],
    desserts: [
      { name: "Champagne Cake", category: "dessert" },
      { name: "Midnight Chocolate Cake", category: "dessert" },
      { name: "Crème Brûlée", category: "dessert" },
      { name: "New Year's Cookies", category: "dessert" },
    ],
  },
  "fourth-of-july": {
    popular: ["BBQ Ribs", "Grilled Burgers", "Corn on the Cob", "Apple Pie"],
    appetizers: [
      { name: "Deviled Eggs", category: "appetizer" },
      { name: "Caprese Skewers", category: "appetizer" },
      { name: "Guacamole and Chips", category: "appetizer" },
      { name: "Watermelon Feta Salad", category: "appetizer" },
    ],
    mains: [
      { name: "BBQ Ribs", category: "main" },
      { name: "Grilled Burgers", category: "main" },
      { name: "Pulled Pork", category: "main" },
      { name: "Grilled Chicken", category: "main" },
      { name: "Hot Dogs", category: "main" },
      { name: "Grilled Salmon", category: "main" },
    ],
    sides: [
      { name: "Corn on the Cob", category: "side" },
      { name: "Potato Salad", category: "side" },
      { name: "Coleslaw", category: "side" },
      { name: "Baked Beans", category: "side" },
      { name: "Macaroni Salad", category: "side" },
      { name: "Grilled Vegetables", category: "side" },
      { name: "Watermelon Slices", category: "side" },
    ],
    desserts: [
      { name: "Apple Pie", category: "dessert" },
      { name: "Strawberry Shortcake", category: "dessert" },
      { name: "Red White and Blue Cake", category: "dessert" },
      { name: "Vanilla Ice Cream", category: "dessert" },
      { name: "Fruit Popsicles", category: "dessert" },
    ],
  },
};

export function getHolidayKey(event: string): string {
  return event.toLowerCase().replace(/[''\s]+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function getHolidayDishes(event: string): HolidayData | null {
  const key = getHolidayKey(event);
  return HOLIDAY_DISHES[key] || null;
}

export function getAllDishes(event: string): TraditionalDish[] {
  const data = getHolidayDishes(event);
  if (!data) return [];
  return [
    ...(data.appetizers || []),
    ...(data.mains || []),
    ...(data.sides || []),
    ...(data.desserts || []),
  ];
}

export function getPopularDishes(event: string): TraditionalDish[] {
  const data = getHolidayDishes(event);
  if (!data) return [];
  const all = getAllDishes(event);
  return all.filter((d) => data.popular.includes(d.name));
}
