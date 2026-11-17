import { redirect } from 'next/navigation';

/**
 * The workflows index lives at /dashboard/workflows (unified dashboard
 * navigation, session history panel). This route exists only so the
 * bare /workflows path lands somewhere sensible instead of 404ing —
 * the four workflow implementations stay at /workflows/<name>.
 */
export default function Page() {
  redirect('/dashboard/workflows');
}
