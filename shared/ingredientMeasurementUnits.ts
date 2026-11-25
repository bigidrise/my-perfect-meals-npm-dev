/** Shared literal measurement aliases; no nutrition or safety authority. */
export function ingredientMeasurementUnit(value: string): string {
  const unit = value.toLowerCase().trim();
  const aliases: Record<string, string> = {
    grams: "g", gram: "g", gramo: "g", gramos: "g",
    ounces: "oz", ounce: "oz", onza: "oz", onzas: "oz",
    pounds: "lb", pound: "lb", lbs: "lb", libra: "lb", libras: "lb",
    cups: "cup", taza: "cup", tazas: "cup",
    tablespoons: "tbsp", tablespoon: "tbsp", cucharada: "tbsp", cucharadas: "tbsp",
    teaspoons: "tsp", teaspoon: "tsp", cucharadita: "tsp", cucharaditas: "tsp",
    milliliters: "ml", milliliter: "ml", mililitro: "ml", mililitros: "ml",
    kilograms: "kg", kilogram: "kg", kilogramo: "kg", kilogramos: "kg",
    liters: "l", liter: "l", litres: "l", litre: "l", litro: "l", litros: "l",
    "fluid ounce": "fl oz", "fluid ounces": "fl oz",
    "onza líquida": "fl oz", "onzas líquidas": "fl oz",
    "onza liquida": "fl oz", "onzas liquidas": "fl oz",
    unidad: "each", unidades: "each", huevo: "egg", huevos: "eggs",
    grande: "large", grandes: "large",
    mediano: "medium", medianos: "medium", mediana: "medium", medianas: "medium",
    pequeno: "small", pequenos: "small", pequena: "small", pequenas: "small",
    pequeño: "small", pequeños: "small", pequeña: "small", pequeñas: "small",
    diente: "clove", dientes: "cloves",
    entero: "whole", entera: "whole", enteros: "whole", enteras: "whole",
    pieza: "piece", piezas: "pieces",
  };
  return Object.prototype.hasOwnProperty.call(aliases, unit) ? aliases[unit] : unit;
}
