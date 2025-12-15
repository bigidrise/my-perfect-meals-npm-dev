# 🟣 My Perfect Meals – Official Deployment Workflow

**Selective File Promotion System**
**Dev → Staging → Production**

## 1. Purpose

To ensure safe, controlled deployments without accidental propagation of dev breakage.
This workflow replaces GitHub branching and full-project pushes with precise, surgical deployment steps.

---

## 2. Environment Roles

### **Dev (Replit IDE / npm run dev)**

* Can break freely
* Used for experimentation, feature building, and debugging
* Not directly connected to staging or production
* No constraints

### **Staging (my-perfect-meals-staging)**

* Receives only selected, approved file changes
* Used to test builds on devices
* Must stay clean and stable
* Mirrors production behavior

### **Production (my-perfect-meals)**

* Receives only staging-approved files
* Must remain bulletproof at all times
* Never receives untested or experimental code

---

## 3. Promotion Rules

### **Rule 1 — Dev NEVER pushes entire project to staging**

Only specific changed files move forward.

### **Rule 2 — Architect must track changed files**

For every promotion, Architect lists exactly which files changed.

### **Rule 3 — Staging promotion command**

```
replit deploy --push <file1> <file2> <file3>
```

### **Rule 4 — Production promotion command**

```
replit deploy --push <file1> <file2> <file3> --environment production
```

### **Rule 5 — Staging is always updated BEFORE production**

Production only gets files staging has validated.

### **Rule 6 — No GitHub branches**

No merges, no branch sync, no full-commit promotions.

---

## 4. Deployment Process

### **Step 1 — Dev Work**

Modify files, test locally, make changes freely.

### **Step 2 — List Changes**

Architect runs a diff and reports exactly which files changed.

### **Step 3 — Promote to Staging**

Architect generates selective promotion command.
User runs command.

### **Step 4 — Test Staging**

Test on mobile, browser, and Capacitor shell.
Confirm everything works.

### **Step 5 — Promote to Production**

Architect generates production promotion command using *the same file list*.
User runs command.

---

## 5. Notes

* This system prevents accidental breaking of production
* Only intended updates move forward
* Changes are traceable, reversible, and fully controlled
* Ideal for a solo developer + AI Architect workflow
* Matches the needs of My Perfect Meals perfectly
