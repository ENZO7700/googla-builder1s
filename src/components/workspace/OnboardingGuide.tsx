import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Rocket, Plug, MessageSquareCode, UploadCloud, ArrowRight, CheckCircle2, Terminal } from 'lucide-react';
import { useState } from 'react';

interface OnboardingGuideProps {
  onNavigate: (view: string) => void;
}

const steps = [
  {
    id: 'connect',
    title: '1. Pripojenie prostredia',
    description: 'Najprv prepoj wpBOX so svojím WordPressom alebo GitHubom. Získaš tým prístup k REST API a možnostiam okamžitého nasadenia.',
    icon: <Plug size={24} className="text-blue-500" />,
    color: 'bg-blue-500/10 border-blue-500/20',
    targetView: 'connectors',
    buttonText: 'Prejsť do Integrácií'
  },
  {
    id: 'build',
    title: '2. Generovanie a Vývoj',
    description: 'Použi Workspace chat. Vyber si model (napr. Codestral) a vygeneruj kód, FSE Blueprinty alebo analyzuj logy.',
    icon: <MessageSquareCode size={24} className="text-purple-500" />,
    color: 'bg-purple-500/10 border-purple-500/20',
    targetView: 'tasks',
    buttonText: 'Otvor Workspace'
  },
  {
    id: 'deploy',
    title: '3. Náhľad a Nasadenie',
    description: 'Vygenerovaný HTML alebo React kód si pozri v Náhľade. Jedným klikom ho pošli ako Draft rovno do WordPressu.',
    icon: <UploadCloud size={24} className="text-emerald-500" />,
    color: 'bg-emerald-500/10 border-emerald-500/20',
    targetView: 'wordpress',
    buttonText: 'Správa WordPress'
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1
    }
  }
} satisfies Variants;

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', bounce: 0.4 } }
} satisfies Variants;

export default function OnboardingGuide({ onNavigate }: OnboardingGuideProps) {
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide bg-background/50 relative">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 py-12 lg:py-20 relative z-10">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16 space-y-4"
        >
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
            transition={{ type: "spring", delay: 0.2, duration: 0.8 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 shadow-xl shadow-primary/20 mb-4"
          >
            <Rocket size={32} className="text-white" />
          </motion.div>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Vitaj v <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">wpBOX Elite</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tvoja nová cloudová základňa pre vývoj, analýzu a nasadzovanie WordPress projektov. 
            Nasleduj tieto tri kroky k tvojmu prvému AI deployu.
          </p>
        </motion.div>

        {/* Steps Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              variants={itemVariants}
              onMouseEnter={() => setHoveredStep(step.id)}
              onMouseLeave={() => setHoveredStep(null)}
              className={`relative overflow-hidden rounded-3xl border bg-card/80 backdrop-blur-xl transition-all duration-500 ${
                hoveredStep === step.id ? 'border-primary/50 shadow-2xl shadow-primary/10 -translate-y-2' : 'border-border shadow-md'
              }`}
            >
              {/* Card Highlight */}
              <div className={`absolute top-0 left-0 w-full h-1 transition-all duration-500 ${
                hoveredStep === step.id ? 'bg-gradient-to-r from-primary to-purple-500 opacity-100' : 'opacity-0'
              }`} />

              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${step.color} transition-transform duration-500 ${hoveredStep === step.id ? 'scale-110 rotate-3' : ''}`}>
                    {step.icon}
                  </div>
                  <span className="text-6xl font-black text-muted/20 absolute top-4 right-4 pointer-events-none select-none">
                    {index + 1}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Simulated CLI graphic */}
                <div className="h-16 rounded-lg bg-zinc-950 border border-zinc-800 p-3 flex flex-col justify-center overflow-hidden">
                  <div className="flex gap-1.5 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="font-mono text-[10px] text-zinc-400 truncate flex items-center gap-2">
                    <Terminal size={10} className="text-primary" />
                    {index === 0 && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>$ connect wp --host larsenevans</motion.span>}
                    {index === 1 && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>$ ai generate --type blueprint</motion.span>}
                    {index === 2 && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>$ deploy page --target prod</motion.span>}
                  </div>
                </div>

                <button
                  onClick={() => onNavigate(step.targetView)}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-300 ${
                    hoveredStep === step.id 
                      ? 'bg-foreground text-background shadow-lg' 
                      : 'bg-muted text-foreground hover:bg-accent'
                  }`}
                >
                  {step.buttonText} <ArrowRight size={16} className={hoveredStep === step.id ? 'animate-bounce-x' : ''} />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom checklist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="mt-20 text-center"
        >
          <div className="inline-flex items-center gap-6 px-8 py-4 rounded-full bg-card/50 border border-border backdrop-blur-sm">
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 size={16} className="text-success" /> Mistral API Aktívne</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 size={16} className="text-success" /> Error Boundaries On</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 size={16} className="text-success" /> E2E Stabilita</span>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
