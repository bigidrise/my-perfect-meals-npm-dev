export function athleteIngredientMapper(ingredient: any): UniversalIngredient {
  let name = ingredient.name || ingredient.item || '';
  const quantity = parseFloat(ingredient.quantity || ingredient.amount || '0');
  let unit = ingredient.unit || '';
  let notes = ingredient.notes || '';

  // Strip descriptors and add to notes
  const descriptors = ['grilled', 'baked', 'lean', 'fresh', 'cooked', 'organic'];
  const foundDescriptors: string[] = [];

  for (const desc of descriptors) {
    const regex = new RegExp(`\\b${desc}\\b`, 'gi');
    if (regex.test(name)) {
      foundDescriptors.push(desc);
      name = name.replace(regex, '').trim();
    }
  }

  // Normalize chicken variations to "Chicken breast"
  if (name.toLowerCase().includes('chicken')) {
    name = 'Chicken breast';
  }

  // Add descriptors to notes if any were found
  if (foundDescriptors.length > 0) {
    notes = notes ? `${notes}, ${foundDescriptors.join(', ')}` : foundDescriptors.join(', ');
  }

  return {
    name,
    quantity,
    unit: unit.toLowerCase(),
    notes
  };
}