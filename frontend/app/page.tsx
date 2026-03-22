"use client";

// Force client-side only rendering
import dynamic from 'next/dynamic';
const HomeContent = dynamic(() => import('./HomeContent'), { ssr: false });

export default function Home() {
  return <HomeContent />;
}
