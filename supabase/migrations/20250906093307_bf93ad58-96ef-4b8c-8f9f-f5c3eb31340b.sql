-- PHASE 3: Apply the Final RLS Policy Set
-- This will fix the wallet display issue by adding missing policies

-- 1. CHATS TABLE - Allow users to manage their own chats
CREATE POLICY "chats_owner_all"
  ON public.chats
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. MESSAGES TABLE - Allow users to manage their own messages  
CREATE POLICY "messages_owner_all"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. WEBHOOK_EVENTS TABLE - Service role can insert (for idempotency)
CREATE POLICY "webhook_events_service_insert"
  ON public.webhook_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 4. WALLETS TABLE - User can select own, service role can update
CREATE POLICY "wallets_service_update"
  ON public.wallets
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "wallets_service_insert"
  ON public.wallets
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 5. TRANSACTIONS TABLE - Service role can insert
CREATE POLICY "transactions_service_insert"
  ON public.transactions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 6. PROFILES TABLE - User can select/update own
CREATE POLICY "profiles_user_insert"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 7. RATE_LIMITS TABLE - Service role operations
CREATE POLICY "rate_limits_service_insert"
  ON public.rate_limits
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "rate_limits_service_update"
  ON public.rate_limits
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 8. IDEMPOTENCY_KEYS TABLE - Service role operations
CREATE POLICY "idempotency_keys_service_insert"
  ON public.idempotency_keys
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 9. OPS_LOGS TABLE - Service role operations
CREATE POLICY "ops_logs_service_insert"
  ON public.ops_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);