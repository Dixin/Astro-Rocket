export const prerender = false;

import type { APIRoute } from 'astro';
import membersConfig from '@/config/members.config';
import { clearSession } from '@/lib/members/session';

/** POST, not GET, so a link or a prefetch cannot sign someone out. */
export const POST: APIRoute = ({ cookies, redirect }) => {
  clearSession(cookies);
  return redirect(`${membersConfig.prefix}/login?signedout=1`, 303);
};
