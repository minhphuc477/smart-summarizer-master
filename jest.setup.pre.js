// Ensure Supabase is mocked before any modules import it
jest.mock('@/lib/supabase', () => {
  // Chainable query builder imitation
  const makeQueryBuilder = () => {
    const qb = {
      select: () => qb,
      eq: () => qb,
      order: () => qb,
      single: async () => ({ data: null, error: null }),
      insert: () => qb,
      update: () => qb,
      delete: () => qb,
      in: () => qb,
      limit: () => qb,
      range: () => qb,
    };
    return qb;
  };

  // Realtime channel mock supporting .on(...).on(...).subscribe(cb?) pattern
  const makeChannel = () => {
    const handlers = [];
    const channel = {
      on: (type, filter, cb) => {
        // Support calling .on(eventConfig, callback) or .on(type, filter, cb)
        if (typeof filter === 'function' && !cb) {
          handlers.push({ type, cb: filter });
        } else if (cb) {
          handlers.push({ type, filter, cb });
        }
        return channel;
      },
      subscribe: (statusCb) => {
        if (statusCb) statusCb('SUBSCRIBED');
        return 'SUBSCRIBED';
      },
      track: () => undefined,
      presenceState: () => ({}),
      send: () => ({ status: 'ok' }),
    };
    return channel;
  };

  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'test-user', email: 'test@example.com' } } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signInWithOAuth: async () => undefined,
      signOut: async () => undefined,
      getUser: async () => ({ data: { user: { id: 'test-user', email: 'test@example.com', user_metadata: {} } }, error: null }),
    },
    from: () => makeQueryBuilder(),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    rpc: async () => ({ data: [], error: null }),
    channel: () => makeChannel(),
    removeChannel: () => undefined,
  };

  return { supabase };
});

// Stub NotificationCenter to keep tests focused (it relies on realtime)
jest.mock('@/components/NotificationCenter', () => () => null);
