# Ask Chef guided choice — Development review

## Approved scope

Conversational instructions and source-verified knowledge only. No new model call,
automatic retry, feature, navigation destination, access rule or setup authority.
The existing response-purpose, goal, consent and safety validators are unchanged.

## Intended behavior

- Uncertain new member with no goal: briefly distinguish planning a day of meals,
  making one dish and exploring Lifestyle. No premature feature action.
- Meal planning with an unresolved method: distinguish My Perfect Menu's suggested
  ideas from creating meals with Chef inside a Meal Builder.
- Suggested ideas: recommend the existing My Perfect Menu entry page.
- Create meals directly in slots: recommend the existing Meal Builders entry page.
  The member still follows its eligibility/setup flow to their builder.
- One chosen dish: recommend Create a Dish without an orientation interview.
- Relevant history and corrections settle choices; do not restart answered
  questions. Keep pre-navigation guidance short and stop after useful confirmed
  instructions without a scripted closing.

## Verified workflow knowledge

My Perfect Menu uses Breakfast/Lunch/Dinner/Snack, three text-based ideas,
Choose This, date/slot selection, creation/placement and builder navigation.
Performance chooses date/slot first. Create With Chef is inside a builder and
works from its day/slot controls; it is not the separate Create a Dish feature.

Evidence: client/src/pages/MyPerfectMenu.tsx,
client/src/components/MealPlanDestinationPicker.tsx,
client/src/pages/pro/GeneralNutritionBuilder.tsx,
client/src/components/CreateWithChefModal.tsx.

## Lifestyle navigation gap

The landing page exists at /lifestyle, with /emotion-ai as a legacy alias.
Its visible categories include dish creation, cravings, beverages, pairings,
Fridge Rescue and Away From Home. Some pairing experiences remain Coming Soon.
Individual feature access and availability still apply.

Neither landing-page route is an approved Ask Chef destination. Chef can explain
Lifestyle and its existing app entry, but cannot supply a landing-page button,
manufacture pending navigation or silently substitute another creator.
No navigation registry change is included; founder review is required for any
future proposal.

Evidence: client/src/pages/LifestyleLandingPage.tsx,
client/src/components/Router.tsx, shared/coaching/navigation.ts.

## Verification boundary

Mocked fixtures check delivered instructions, multi-turn context, selected
responses, pending/confirmed actions, unavailable destinations and care precedence.
They do not prove that a live model independently makes the intended choices.
Exact onboarding and Macro Calculator completion are not supplied to Chef by
this change. Live testing remains paused pending founder approval.
