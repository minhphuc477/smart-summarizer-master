import HomeClient from '../components/HomeClient';

// Prevent static generation for this dynamic page
export const dynamic = 'force-dynamic';

export default function Home() {
  // Server component, render client wrapper
  return <HomeClient />;
}
