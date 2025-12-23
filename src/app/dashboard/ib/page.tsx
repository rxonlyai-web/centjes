/**
 * IB Route - Redirect to Main Dashboard
 * 
 * The IB (Income Tax) overview is now the main dashboard at /dashboard.
 * This page redirects to /dashboard to maintain backward compatibility
 * for any bookmarked or shared links to /dashboard/ib.
 */

import { redirect } from 'next/navigation'

export default function IBRedirectPage() {
  redirect('/dashboard')
}
