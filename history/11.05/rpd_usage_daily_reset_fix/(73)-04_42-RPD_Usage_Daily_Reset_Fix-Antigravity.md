User request: "rpd usage in registry must reset evey day"

### Objective Reconstruction
The goal was to ensure that the Requests Per Day (RPD) usage tracking in the Model Registry resets to zero at the start of every calendar day.

### Strategic Reasoning
1.  **Passive Daily Reset**: Instead of relying on a complex external cron job, I implemented a passive check within the `trackModelUsage` function. This function runs on every successful model request.
2.  **Date Validation**: The system now compares the current server date (UTC) against the `last_reset_date` stored for the model. 
3.  **Batch Reset**: If a date mismatch is detected (indicating the first request of a new day), the system performs a batch update to reset `usage_today` to 0 for all models and synchronizes their `last_reset_date` to today.
4.  **Graceful Fallback**: The logic is wrapped in a try/catch block to ensure that even if the reset or tracking fails, it doesn't crash the main routing flow, while still logging a warning for admins.

### Detailed Blueprint
1.  **`src/lib/bot/chainRouter.ts`**:
    -   Converted `trackModelUsage` to an `async` function.
    -   Added a Supabase check for the `last_reset_date`.
    -   Implemented a conditional batch update to wipe usage and refresh the reset timestamp.
    -   Ensured the `increment_model_usage` RPC is called only after the potential reset.

### Operational Trace
-   **Modified**: `src/lib/bot/chainRouter.ts` - Integrated the daily reset logic into the usage tracking pipeline.

### Status Assessment
RPD usage will now reliably reset at the start of every day (UTC). The very first model request of the day will trigger the reset for all models in the database.

### Next Recommendation
Verify the server's timezone settings if you want the reset to happen at a specific local time instead of UTC.
