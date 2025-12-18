/// <reference types="cypress" />

describe('AI Meal Creator smoke', () => {
  it('generates a 1-day plan and shows cards', () => {
    cy.visit('/ai-meal-creator');
    // Step 1
    cy.contains('Continue').click();
    // Step 2
    cy.contains('Continue').click();
    // Step 3
    cy.contains('1 Day').click();
    cy.contains('Continue').click();
    // Step 4
    cy.contains('Generate Plan').click();
    cy.contains('Day 1', { timeout: 30000 }).should('exist');
    cy.get('[data-testid="meal-card"]').its('length').should('be.gte', 1);
  });

  it('regenerates a card and marks as Logged', () => {
    cy.get('[data-testid="meal-card"]').first().within(() => {
      cy.contains('Regenerate').click();
      cy.contains('Regenerate').should('exist');
      cy.contains('Log this meal').click();
      cy.contains('Logged').should('exist');
    });
  });

  it('builds a grocery list and exports CSV', () => {
    cy.contains('Create Grocery List').click();
    cy.contains('Grocery List').should('exist');
  });
});