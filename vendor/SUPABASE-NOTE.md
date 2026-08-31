# supabase.js

The official `@supabase/supabase-js` v2 browser build, vendored rather than
loaded from a CDN.

**Why vendored.** Every other page on this site loads no third-party script at
all, which is the property that keeps it simple to reason about for children's
privacy. Pulling this from a CDN would add another company to that list on
every page it appeared. Vendoring keeps the count at one: the club pages talk
to Supabase, and to nothing else.

Downloaded from `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js`.
To update it, fetch that URL again and check the site still signs in.
