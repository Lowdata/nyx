import LandingNav from '@/components/landing/LandingNav';
import LandingHero from '@/components/landing/LandingHero';
import HowItWorks from '@/components/landing/HowItWorks';
import WorldSection from '@/components/landing/WorldSection';
import AirdropTeaser from '@/components/landing/AirdropTeaser';
import Footer from '@/components/Footer';

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <LandingHero />
        <WorldSection />
        <HowItWorks />
        <AirdropTeaser />
      </main>
      <Footer />
    </>
  );
}
