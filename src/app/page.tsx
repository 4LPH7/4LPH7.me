import { About } from "@/components/site/About";
import { Contact } from "@/components/site/Contact";
import { Education } from "@/components/site/Education";
import { Hero } from "@/components/site/Hero";
import { Projects } from "@/components/site/Projects";
import { RevealOnScroll } from "@/components/site/RevealOnScroll";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteMenu } from "@/components/site/SiteMenu";
import { Skills } from "@/components/site/Skills";
import { Stats } from "@/components/site/Stats";

export default function HomePage() {
  return (
    <>
      <SiteMenu />
      <RevealOnScroll />
      <main id="main" className="site">
        <Hero />
        <About />
        <Projects />
        <Education />
        <Skills />
        <Stats />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
