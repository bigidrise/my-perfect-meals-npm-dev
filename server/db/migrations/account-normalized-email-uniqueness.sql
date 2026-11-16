-- Manual approval only. No startup import. Never merge/delete rows to make this pass.
-- Must be run after duplicate identities are separately investigated and resolved.
-- Whitespace matches ECMAScript trim, including NBSP and the Unicode space separators.
CREATE OR REPLACE FUNCTION mpm_normalized_email(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(btrim(value, E' \t\n\r\f' || chr(11) ||
    U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'));
$$;
-- This deliberately fails if a preexisting normalized collision remains.
CREATE UNIQUE INDEX IF NOT EXISTS users_normalized_email_unique
  ON users (mpm_normalized_email(email));
