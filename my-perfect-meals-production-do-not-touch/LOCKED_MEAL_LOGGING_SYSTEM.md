# LOCKED MEAL LOGGING SYSTEM - DO NOT MODIFY

## CRITICAL WARNING
The meal logging system is now LOCKED and PROTECTED. Any modifications to these components will break the working functionality that has been extensively tested and validated.

## PROTECTED COMPONENTS

### Backend Files - DO NOT TOUCH
- `server/routes/mealLogs.ts` - Complete CRUD operations with user authentication
- `server/routes/mealSummarize.ts` - AI-powered meal summarization
- `shared/schema.ts` (mealLogs table) - Database schema with proper indexing
- `server/storage.ts` (meal log operations) - Data persistence layer

### Frontend Files - DO NOT TOUCH  
- `client/src/pages/log-meals.tsx` - Main meal logging interface with all features
- `client/src/pages/MealJournalPage.tsx` - Complete meal history with calendar/list views
- `client/src/hooks/useMealLogsInfinite.ts` - Infinite scroll pagination system
- `client/src/components/MealJournalCalendar.tsx` - Calendar view component
- `client/src/lib/exportMealLogsCsv.ts` - CSV export functionality

### Key Features LOCKED
1. **Smart Time Parsing** - Recognizes "8:30 AM", "8am", "13:05", "at 7 pm"
2. **Auto-Summarization** - Condenses text over 120 characters automatically
3. **Database Persistence** - PostgreSQL with proper user authentication
4. **Infinite Scroll** - Efficient pagination for large meal datasets
5. **Time-Based Filtering** - 6 months, 1 year, 2 years, all time
6. **Calendar View** - Visual meal count indicators with month navigation
7. **CSV Export** - Complete meal history download with proper formatting
8. **Protected Deletion** - Only "Clear Today" functionality, historical data protected
9. **Chronological Sorting** - Meals sorted by actual eating time, not logging time
10. **Navigation Flow** - Dashboard → Log Meals → Meal Journal → Log Meals

### Database Schema LOCKED
```sql
CREATE TABLE meal_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  meal_time TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_meal_logs_user_time ON meal_logs(user_id, meal_time);
CREATE INDEX idx_meal_logs_user_created ON meal_logs(user_id, created_at);
```

### API Endpoints LOCKED
- `GET /api/meal-logs` - Retrieve meals with pagination and filtering
- `POST /api/meal-logs` - Create new meal with time parsing
- `DELETE /api/meal-logs/today` - Clear today's meals only
- `POST /api/meal-summarize` - AI-powered meal description summarization

## TESTING VALIDATION
✅ Database persistence working
✅ Time parsing functioning for all formats
✅ Auto-summarization active
✅ CSV export generating proper files
✅ Calendar view displaying meal counts
✅ Navigation flow working correctly
✅ Infinite scroll loading efficiently
✅ Protected deletion preserving history

## DO NOT MODIFY WARNING
This system has been extensively tested and is working perfectly. Any changes to these components risk breaking:
- Data persistence
- Time parsing accuracy
- Meal history integrity
- CSV export functionality
- Calendar visualization
- Navigation flow

If modifications are absolutely necessary, create NEW components rather than modifying these locked files.

## Lock Date: January 2025
## Status: PERMANENTLY PROTECTED