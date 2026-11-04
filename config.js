// Public values only: the publishable key names the project and grants nothing, RLS does the protecting.
// The real Turnstile site key allows only mylandings.net. Local servers get Cloudflare's published test key,
// whose dummy token the real secret in Supabase refuses: signing in by e-mail code works on mylandings.net only.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
window.MYLANDINGS_CONFIG = Object.freeze({
  supabaseUrl: 'https://bgxzlirvbuxjjawqkkyw.supabase.co',
  publishableKey: 'sb_publishable_GwxgaPeqA6JpsjtxWOC5cg__qzxJqIy',
  turnstileSiteKey: LOCAL_HOSTS.includes(location.hostname)
    ? '1x00000000000000000000AA' // Cloudflare test key: always passes, visible widget
    : '0x4AAAAAAFulxpbPiy4nWWpv', // public by design, its secret key lives in Supabase only
});
