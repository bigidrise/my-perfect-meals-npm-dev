# Mealgen V2 Deployment Checklist

## Environment Configuration

### Core Flags
- `MEALGEN_V2=true` - Enable the V2 generation system
- `STRICT_FAIL_CLOSED=true` - Enforce strict validation (default)
- `IMAGE_DEFER_DEFAULT=true` - Defer image generation by default
- `VARIETY_BACKEND=redis|memory` - Choose variety bank backend

### Variety Banking
- `VARIETY_REDIS_URL=redis://host:6379` - Redis URL (if using redis backend)

### Rate Limiting
- `RL_WINDOW_MS=60000` - Rate limit window (1 minute)
- `RL_MAX_REQ=30` - Max requests per window per user

### Cost Controls
- `COST_WINDOW_MS=60000` - Cost guard window
- `COST_MAX_CALLS_PER_USER=60` - Max calls per user per window
- `COST_MAX_CALLS_GLOBAL=1000` - Global call limit per window

### Admin Access
- `ADMIN_KEY=***` - Secret key for QA dashboard access
- `QA_DASHBOARD=true` - Enable QA monitoring endpoints

## Security Considerations

1. **Admin Endpoints**: QA dashboard requires `x-admin-key` header
2. **CORS**: Lock origins to app domain only
3. **Rate Limiting**: Automatic abuse protection
4. **Cost Guards**: Budget enforcement at user and global levels

## Observability

### Telemetry Endpoint
- `/admin/api/wmc2/telemetry` - Live system metrics
- Requires admin authentication
- Auto-refreshes every 5 seconds

### Key Metrics
- `plans` - Total plans generated
- `items` - Total meal items created
- `avgItems` - Average items per plan
- `avgMs` - Average generation time
- `errors` - Total error count
- `lastErrors` - Recent error history with codes

### Log Monitoring
- `dupesPrevented` - Variety bank effectiveness
- `violationsFixed` - Safety system performance
- `onboardingHash` - User preference tracking
- Generation timings and error codes

## Testing

### Unit Tests
```bash
npm test server/tests/mealgen.strict.spec.ts
```

### End-to-End Tests
```bash
npm run cypress
# Run client/cypress/e2e/ai_meal_creator.cy.ts
```

### Manual Testing Checklist
1. Generate 1-day plan with dietary restrictions
2. Verify no allergen violations
3. Test regeneration functionality
4. Check variety bank duplicate prevention
5. Validate cost guard limits
6. Monitor QA dashboard metrics

## Rollout Strategy

### Phase 1: Internal Testing
- Enable for internal users only
- Monitor error rates and performance
- Tune `MAX_TRIES` and dietary rule packs

### Phase 2: Gradual Rollout
- Enable on AI Meal Creator first
- Expand to Weekly Meal Calendar
- Roll out to Holiday Feast Generator
- Apply to all meal generation endpoints

### Phase 3: Full Production
- Enable for all users
- Monitor cost and performance metrics
- Scale variety bank to Redis if needed

## Troubleshooting

### Common Error Codes
- `budget:user` - User exceeded call limit
- `budget:global` - Global rate limit hit
- `diet:kosher_pork` - Kosher violation detected
- `diet:halal_alcohol` - Halal violation detected
- `diet:low_fodmap` - High-FODMAP ingredient found
- `kcal_high` - Calories exceed target range
- `schema:` - JSON schema validation failed

### Performance Tuning
- Adjust `MEALGEN_MAX_TRIES` for reliability vs speed
- Scale variety bank to Redis for persistence
- Monitor telemetry for optimization opportunities