import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const features = [
  {
    title: "Automated Forensics Pipeline",
    description:
      "Upload memory dumps and get structured plugin output without manually chaining Volatility commands.",
  },
  {
    title: "Multi-Method Malware Detection",
    description:
      "Correlate behavior rules, hashes, threat intel, and entropy signals in one workspace.",
  },
  {
    title: "Steganography Signal Detection",
    description:
      "Surface hidden payload indicators and suspicious embedding patterns across files quickly.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen w-full bg-gray-950 text-white overflow-hidden">
      <div className="absolute inset-0 tech-radial-layer pointer-events-none" />
      <div className="absolute inset-0 tech-grid-layer pointer-events-none" />
      <div className="absolute inset-0 tech-scanline-layer pointer-events-none" />
      <div className="absolute inset-0 tech-orb-layer pointer-events-none" />
      <div className="absolute inset-0 tech-scanline-layer-horizontal pointer-events-none" />
      <div className="absolute inset-0 tech-scanline-layer-diagonal pointer-events-none" />
      <div className="absolute inset-0 tech-pulse-layer pointer-events-none" />
      <div className="absolute inset-0 tech-pulse-layer-alt pointer-events-none" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <section className="px-6 md:px-12 pt-16 md:pt-24 pb-10 md:pb-14">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-400/70 font-mono mb-4">
              Digital Forensic Intelligence
            </p>
            <h1 className="text-4xl md:text-6xl font-bold text-cyan-400 tracking-wide leading-tight">
              ForensIQ
            </h1>
            <p className="mt-5 text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Investigate memory artifacts, monitor threats, and preserve forensic records in a secure and persistent workflow.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/signup"
                className="px-6 py-3 rounded-lg bg-cyan-400 text-gray-950 font-semibold hover:bg-cyan-300 transition-colors"
              >
                Create Account
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 rounded-lg border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/10 transition-colors"
              >
                Login
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6 md:px-12 pb-14 md:pb-20">
          <div className="max-w-6xl mx-auto grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="p-5 md:p-6 rounded-xl border border-gray-800 bg-gray-900/75 backdrop-blur-xl hover:border-cyan-500/40 transition-colors"
              >
                <h2 className="text-lg font-semibold text-cyan-300 mb-2">{feature.title}</h2>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
