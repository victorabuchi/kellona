import { cookies } from 'next/headers';
import { isTheme, THEME_COOKIE, type Theme } from './theme-constants';

// Light unless the person chose dark or "follow the system".
export async function readTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : 'light';
}
