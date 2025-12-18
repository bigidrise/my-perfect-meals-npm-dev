#!/usr/bin/env node

/**
 * Route Validation Script
 * 
 * This script prevents navigation 404 errors by:
 * 1. Scanning all pages for setLocation() calls
 * 2. Checking if those routes exist in the Router component
 * 3. Reporting missing routes that need to be added
 * 
 * Run with: node scripts/validate-routes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAGES_DIR = path.join(__dirname, '../client/src/pages');
const ROUTER_FILE = path.join(__dirname, '../client/src/components/Router.tsx');

// Extract routes from setLocation calls in all page files
function extractRoutesFromPages() {
  const routes = new Set();
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Find setLocation calls
        const locationMatches = content.matchAll(/setLocation\(['"`]([^'"`]+)['"`]\)/g);
        for (const match of locationMatches) {
          const route = match[1];
          // Skip dynamic routes and root
          if (route !== '/' && !route.includes('${')) {
            routes.add(route);
          }
        }
      }
    });
  }
  
  scanDirectory(PAGES_DIR);
  return Array.from(routes);
}

// Extract defined routes from Router component
function extractDefinedRoutes() {
  if (!fs.existsSync(ROUTER_FILE)) {
    console.error('Router.tsx not found');
    return [];
  }
  
  const routerContent = fs.readFileSync(ROUTER_FILE, 'utf-8');
  const routeMatches = routerContent.matchAll(/<Route\s+path=['"`]([^'"`]+)['"`]/g);
  
  const definedRoutes = [];
  for (const match of routeMatches) {
    definedRoutes.push(match[1]);
  }
  
  return definedRoutes;
}

// Main validation function
function validateRoutes() {
  console.log('🔍 Scanning for route usage in pages...');
  const usedRoutes = extractRoutesFromPages();
  
  console.log('📋 Extracting defined routes from Router...');
  const definedRoutes = extractDefinedRoutes();
  
  console.log('\n📊 Route Analysis:');
  console.log(`Found ${usedRoutes.length} unique routes used in pages`);
  console.log(`Found ${definedRoutes.length} routes defined in Router`);
  
  // Find missing routes
  const missingRoutes = usedRoutes.filter(route => !definedRoutes.includes(route));
  
  if (missingRoutes.length === 0) {
    console.log('\n✅ All routes are properly defined!');
  } else {
    console.log('\n❌ Missing routes found:');
    missingRoutes.forEach(route => {
      console.log(`   - ${route}`);
    });
    
    console.log('\n🔧 Add these routes to client/src/components/Router.tsx:');
    missingRoutes.forEach(route => {
      const componentName = route.split('/').pop().split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join('');
      console.log(`   <Route path="${route}" component={${componentName}} />`);
    });
  }
  
  // Find unused routes (optional)
  const unusedRoutes = definedRoutes.filter(route => 
    route !== '/' && !usedRoutes.includes(route)
  );
  
  if (unusedRoutes.length > 0) {
    console.log('\n⚠️ Potentially unused routes:');
    unusedRoutes.forEach(route => {
      console.log(`   - ${route}`);
    });
  }
  
  return missingRoutes.length === 0;
}

// Run validation
const isValid = validateRoutes();
process.exit(isValid ? 0 : 1);