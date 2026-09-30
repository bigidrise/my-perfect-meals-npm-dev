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
const mockAddItem = jest.fn();
jest.mock('@/stores/shoppingListStore', () => ({
  useShoppingListStore: (selector: any) => selector({ addItems: jest.fn(), addItem: mockAddItem }),
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
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { get, post } from '@/lib/api';
import GroceryStoreCoachSheet from '@/components/shopping/GroceryStoreCoachSheet';
import { classifyIngredient } from '@/utils/ingredientClassifier';

beforeEach(() => {
  localStorage.clear();
  mockAddItem.mockClear();
  (get as jest.Mock).mockResolvedValue({ items: [] });
  (post as jest.Mock).mockResolvedValue({
    advice: [],
    profileUsed: ['Low-carb diet'],
    catalogMatches: [{
      productKey: 'open_food_facts:0851087000014',
      brand: 'Peanut Butter & Co',
      name: 'Smooth Operator Creamy Peanut Butter',
      barcode: '0851087000014',
      source: 'Open Food Facts',
      sourceRecordId: '0851087000014',
      evidenceStatus: 'needs_verification',
      recommendationStatus: 'profile_matched_pick',
      needsProfileReview: false,
      policyUnresolved: true,
      verificationMessage: 'Recommendation based on available catalog facts, not a physical-package guarantee.',
      profileInsight: 'Compare its catalog carbohydrates with your day.',
    }],
    catalogSearchAvailable: true,
  });
});

test('catalog Add puts the exact branded Profile-Matched Pick on the shopping list without changing its package status', async () => {
  render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);
  fireEvent.click(screen.getByTestId('tab-find-product'));
  fireEvent.change(screen.getByTestId('input-find-product'), { target: { value: 'peanut butter' } });
  await act(async () => {
    fireEvent.click(screen.getByTestId('button-product-search'));
  });
  const card = await screen.findByTestId('catalog-product-match');
  expect(within(card).getByText('Profile-Matched Pick · check current label')).toBeInTheDocument();
  const add = within(card).getByRole('button', { name: 'Add to List' });
  fireEvent.click(add);
  expect(mockAddItem).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Peanut Butter & Co Smooth Operator Creamy Peanut Butter · UPC 0851087000014',
    quantity: 1,
    unit: '',
    category: 'Other',
  }));
  await waitFor(() => expect(within(card).getByRole('button', { name: 'Added' })).toBeDisabled());
  expect(mockAddItem).toHaveBeenCalledTimes(1);
});

test('catalog Save keeps exact brand, variant, UPC, and review evidence in Saved Groceries without adding to list', async () => {
  const productKey = 'upc::0851087000014';
  (post as jest.Mock).mockImplementation(async (path: string, body: any) => {
    if (path === '/api/saved-groceries') return { item: { productKey }, created: true };
    return {
      advice: [], profileUsed: ['Low-carb diet'], catalogSearchAvailable: true,
      catalogMatches: [{
        productKey: 'open_food_facts:0851087000014',
        brand: 'Peanut Butter & Co', name: 'Smooth Operator Creamy Peanut Butter',
        barcode: '0851087000014', source: 'Open Food Facts', sourceRecordId: '0851087000014',
        catalogDate: '2026-09-30T00:00:00Z',
        ingredients: 'Peanuts, salt', nutrition: [{ statement: 'Carbohydrates: 12 g', source: 'open_food_facts' }],
        evidenceStatus: 'needs_verification', recommendationStatus: 'profile_matched_pick',
        verificationMessage: 'Check the current label.',
      }],
    };
  });
  render(<GroceryStoreCoachSheet open={true} onOpenChange={jest.fn()} />);
  fireEvent.click(screen.getByTestId('tab-find-product'));
  fireEvent.change(screen.getByTestId('input-find-product'), { target: { value: 'peanut butter' } });
  await act(async () => { fireEvent.click(screen.getByTestId('button-product-search')); });
  const card = await screen.findByTestId('catalog-product-match');
  fireEvent.click(within(card).getByRole('button', { name: 'Save to Groceries' }));
  await waitFor(() => expect(within(card).getByRole('button', { name: 'findProduct.saved' })).toBeDisabled());
  expect(post).toHaveBeenCalledWith('/api/saved-groceries', expect.objectContaining({
    productName: 'Smooth Operator Creamy Peanut Butter',
    brand: 'Peanut Butter & Co',
    barcode: '0851087000014',
    category: 'peanut butter',
    source: 'grocery-coach',
    productMeta: expect.objectContaining({
      ingredients: ['Peanuts, salt'],
      evidenceStatus: 'needs_verification',
      recommendationStatus: 'profile_matched_pick',
      verificationMessage: 'Check the current label.',
      sourceRecordId: '0851087000014',
    }),
  }));
  expect(mockAddItem).not.toHaveBeenCalled();
});

test('different UPC variants remain distinct through shopping-list hydration keys', () => {
  const one = classifyIngredient('Peanut Butter & Co Smooth Operator · UPC 0851087000014');
  const two = classifyIngredient('Peanut Butter & Co Smooth Operator · UPC 0851087000311');
  expect(one.normalizedName).not.toBe(two.normalizedName);
});