/** @jest-environment jsdom */
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));
jest.mock('wouter', () => ({ useLocation: () => ['/', jest.fn()] }));
jest.mock('framer-motion', () => ({
  motion: { div: ({ children, ...rest }: any) => {
    const React = require('react');
    return React.createElement('div', rest, children);
  } },
  AnimatePresence: ({ children }: any) => children,
}));
jest.mock('@/components/MealRefinementSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/lib/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: new (require('@tanstack/react-query').QueryClient)({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
}));
const mockAddItem = jest.fn();
const mockAddItems = jest.fn();
jest.mock('@/stores/shoppingListStore', () => ({
  useShoppingListStore: (selector: any) => selector({ addItems: mockAddItems, addItem: mockAddItem }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'catalog-test-account' } }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) =>
    key === 'findProduct.addToList' ? 'Add to List' : key === 'findProduct.added' ? 'Added' : key }),
}));
jest.mock('@/components/ui/pill-button', () => ({
  PillButton: ({ children, active: _active, variant: _variant, ...props }: any) => {
    const React = require('react');
    return React.createElement('button', props, children);
  },
}));

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { get, post } from '@/lib/api';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import GroceryStoreCoachSheet from '@/components/shopping/GroceryStoreCoachSheet';
import { classifyIngredient } from '@/utils/ingredientClassifier';

const productName = 'Peanut Butter & Co Smooth Operator Creamy Peanut Butter · UPC 0851087000014';
const analysis = {
  analysisMethod: 'by_name', productName, barcode: '0851087000014',
  alignmentGrade: 'A', gradeUnavailable: true, verdictLevel: 'caution',
  verdict: 'Check the current label.', overallSummary: 'Compare the current ingredients and serving size.',
  betterAlternatives: [], ingredientConsiderations: ['Check the current label.'],
  educationalFooter: 'Not a verified label scan. Check the current label.',
  extractedIngredients: [], highRiskFindings: [], scoreCards: [], outcomeCards: [],
  ingredientDecoder: [], mayNotAlignWith: [], betterFor: [], householdNotes: [],
  profileFactorsUsed: ['Low-carb diet'], whatMattersMost: [], fallbackUsed: false,
};
let savedRows: any[] = [];
const renderCoach = () => render(
  <QueryClientProvider client={queryClient}>
    <GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />
  </QueryClientProvider>,
);

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  queryClient.clear();
  savedRows = [];
  (get as jest.Mock).mockResolvedValue({ items: [] });
  (post as jest.Mock).mockImplementation(async (path: string) => {
    if (path !== '/api/biometrics/ingredient-scan-by-name') throw new Error(`Unexpected POST ${path}`);
    return { ok: true, result: analysis };
  });
  (apiRequest as jest.Mock).mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
    if (path !== '/api/saved-groceries') throw new Error(`Unexpected request ${path}`);
    if (options?.method === 'POST') {
      const item = { id: 'saved-peanut-butter', productKey: 'upc::0851087000014', ...JSON.parse(options.body!) };
      savedRows.push(item);
      return { item, created: true };
    }
    return { items: [...savedRows] };
  });
});

test('by-name Add keeps the exact brand, variant and UPC without claiming verified package evidence or inserting duplicates', async () => {
  renderCoach();
  fireEvent.click(screen.getByTestId('tab-find-product'));
  fireEvent.change(screen.getByTestId('input-find-product'), { target: { value: 'peanut butter' } });
  await act(async () => {
    fireEvent.click(screen.getByTestId('button-product-search'));
  });
  const add = await screen.findByRole('button', { name: 'ingredientSheet.addNamedToList' });
  expect(post).toHaveBeenCalledWith('/api/biometrics/ingredient-scan-by-name', { productName: 'peanut butter' });
  expect(screen.getByText('Check the current label.')).toBeInTheDocument();
  fireEvent.click(add);
  expect(mockAddItems).toHaveBeenCalledWith([expect.objectContaining({
    name: productName,
    quantity: 1,
    unit: '',
    sourceMeals: ['findProduct.tabFindProduct'],
  })]);
  fireEvent.click(add);
  expect(mockAddItems).toHaveBeenCalledTimes(1);
  expect(mockAddItem).not.toHaveBeenCalled();
  expect(analysis.extractedIngredients).toEqual([]);
  expect(analysis.gradeUnavailable).toBe(true);
});

test('by-name Save retains exact identity and unverified analysis, and retrieves it after reopening without adding to the list', async () => {
  const view = renderCoach();
  fireEvent.click(screen.getByTestId('tab-find-product'));
  fireEvent.change(screen.getByTestId('input-find-product'), { target: { value: 'peanut butter' } });
  await act(async () => { fireEvent.click(screen.getByTestId('button-product-search')); });
  fireEvent.click(await screen.findByRole('button', { name: 'ingredientSheet.saveToGroceries' }));
  await screen.findByRole('button', { name: 'ingredientSheet.simple.removeSaved' });
  const saveCall = (apiRequest as jest.Mock).mock.calls.find(([path, options]) =>
    path === '/api/saved-groceries' && options?.method === 'POST');
  expect(saveCall).toBeDefined();
  expect(JSON.parse(saveCall![1].body)).toEqual(expect.objectContaining({
    productName,
    barcode: '0851087000014',
    source: 'grocery-coach',
    productMeta: expect.objectContaining({
      analysisSnapshot: expect.objectContaining(analysis),
      analysisMethod: 'by_name',
      evidenceStatus: 'unverified',
      verificationMessage: analysis.educationalFooter,
    }),
  }));
  expect(savedRows).toHaveLength(1);
  expect(savedRows[0].productMeta.ingredients).toBeUndefined();
  view.unmount();
  queryClient.clear();
  renderCoach();
  fireEvent.click(screen.getByTestId('tab-find-product'));
  await screen.findByRole('button', { name: 'ingredientSheet.simple.removeSaved' });
  expect(apiRequest).toHaveBeenCalledWith('/api/saved-groceries');
  expect(savedRows[0].productMeta.analysisSnapshot).toEqual(analysis);
  expect((apiRequest as jest.Mock).mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(mockAddItems).not.toHaveBeenCalled();
  expect(mockAddItem).not.toHaveBeenCalled();
});

test('different UPC variants remain distinct through shopping-list hydration keys', () => {
  const one = classifyIngredient('Peanut Butter & Co Smooth Operator · UPC 0851087000014');
  const two = classifyIngredient('Peanut Butter & Co Smooth Operator · UPC 0851087000311');
  expect(one.normalizedName).not.toBe(two.normalizedName);
});