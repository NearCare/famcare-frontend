# PostHog analytics

FamCare uses PostHog for authenticated product analytics.

## Production setup

1. Create a PostHog project in the US region.
2. Copy its public Project API Key (`phc_...`).
3. Add `NEXT_PUBLIC_POSTHOG_KEY` to the production deployment environment.
4. Ensure it is available while the frontend is being built.
5. Trigger a new production deploy.
6. Log in and confirm that PostHog **Activity** receives events.
7. In **Persons**, confirm the Distinct ID equals the FamCare database user ID.

Do not send food messages, health values, phone numbers, Razorpay IDs, or
payment amounts to PostHog. Payment truth remains in the backend database and
Razorpay.

## Recommended funnels

### Visitor to activated user

1. `landing_page_viewed`
2. `landing_cta_clicked` where `action = get_started`
3. `otp_requested`
4. `login_succeeded`
5. `home_v2_viewed`

Use a 7-day conversion window and count by unique users.

### Free user to paid subscription

1. `billing_entry_clicked`
2. `billing_page_viewed`
3. `subscription_checkout_started`
4. `subscription_checkout_opened`
5. `subscription_payment_verified`
6. `subscription_checkout_confirmed`

Break down by `source`, `plan_key`, and `checkout_kind`. Use a 7-day window.
`subscription_payment_verified` means the browser callback signature passed;
`subscription_checkout_confirmed` means backend state was confirmed.

### Parent-care activation

1. `home_v2_viewed`
2. `family_member_add_started`
3. `family_member_added`
4. `family_reminders_opened`
5. `family_food_reminder_updated`

Use a 14-day window and count by unique users.

### Nutrition-target activation

1. `calorie_target_entry_clicked`
2. `calorie_calculator_viewed`
3. `calorie_target_calculated`
4. `calorie_goal_saved`

Break down by `source` and `target_type`.

### AI Coach engagement

1. `health_assistant_opened`
2. `suggested_prompt_clicked` or `chat_message_sent`
3. `health_assistant_feedback_submitted`

Create separate trends for positive and negative feedback using the `rating`
property.

### Yesterday-log recovery

1. `yesterday_backfill_started`
2. `yesterday_backfill_estimated`
3. `yesterday_backfill_completed`

Track `yesterday_backfill_estimate_failed` and
`yesterday_backfill_failed` as failure trends beside this funnel.

## Useful dashboards

- **Acquisition:** landing views, CTA conversion, OTP requests, successful logins.
- **Activation:** Home V2 views, family members added, targets saved, first
  medicine added, first AI Coach message.
- **Engagement:** weekly active identified users, Stats views, Health Assistant
  messages, log views, medication actions.
- **Revenue:** billing entries, checkout starts, checkout opens, verified
  payments, confirmed subscriptions, checkout failures and dismissals.
- **Retention:** weekly retention with `home_v2_viewed` as the returning event.
