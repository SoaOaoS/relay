import Link from 'next/link'
import { Zap, Globe, Search, Phone, FileText, ArrowRight, Check } from 'lucide-react'

const features = [
  { icon: Globe, title: 'Web Search', desc: 'Search the live web and read any page in real time.' },
  { icon: Search, title: 'GitHub & Code', desc: 'Browse repos, read code, review PRs across GitHub.' },
  { icon: FileText, title: 'File Operations', desc: 'Read, write, and edit files in your workspace.' },
  { icon: Phone, title: 'AI Phone Calls', desc: 'Relay calls businesses for you — asks, negotiates, reports back.' },
  { icon: Zap, title: 'Tool Calling', desc: 'The AI decides which tools to use and chains them together.' },
  { icon: ArrowRight, title: 'Task Automation', desc: 'Research, summarize, compare, plan — end to end.' },
]

const plans = [
  { name: 'Free', price: 0, messages: '20', calls: '0', tools: 'Basic chat', popular: false },
  { name: 'Pro', price: 29, messages: '500', calls: '5', tools: 'All tools + MCP', popular: true },
  { name: 'Unlimited', price: 99, messages: '∞', calls: '50', tools: 'Everything', popular: false },
]

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/50 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-semibold text-lg">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" fill="white" />
            </div>
            Relay
          </div>
          <div className="flex items-center gap-6">
            <Link href="/auth" className="text-sm text-zinc-400 hover:text-white transition">Sign in</Link>
            <Link href="/auth" className="text-sm font-medium text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition border border-white/10">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="glow absolute inset-0 h-[600px] pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 pt-32 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Powered by Ollama — open, private, self-hostable
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
            The AI assistant<br />that actually <span className="italic font-serif">does things</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Not just chat. Relay searches the web, browses GitHub, edits files, makes phone calls, and executes real tasks — all from one conversation.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/auth" className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white px-6 py-3 rounded-xl font-medium transition shadow-lg shadow-indigo-500/25">
              Start free <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#features" className="text-zinc-400 hover:text-white px-6 py-3 rounded-xl border border-zinc-800 hover:border-zinc-700 transition">See features</a>
          </div>
        </div>
      </section>

      {/* Demo */}
      <section className="relative max-w-3xl mx-auto px-6 pb-24 w-full">
        <div className="rounded-2xl border border-zinc-800 bg-[#111113] overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <span className="text-xs text-zinc-500 ml-2">Relay Dashboard</span>
          </div>
          <div className="p-6 space-y-4 text-sm">
            <div className="flex justify-end">
              <div className="bg-indigo-500 text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-md">
                Find the best noise-cancelling headphones under $200 and call the store to check stock
              </div>
            </div>
            <div className="flex justify-start gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5 text-white" fill="white" />
              </div>
              <div className="space-y-2">
                <div className="bg-zinc-800 text-zinc-100 px-4 py-2.5 rounded-2xl rounded-bl-md max-w-md">
                  Top pick: <span className="text-indigo-400 font-medium">Sony WH-1000XM5</span> — $199 at FNAC.
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-500">
                    <Globe className="w-3 h-3" /> Searched 12 reviews
                  </div>
                </div>
                <div className="bg-zinc-800 text-zinc-100 px-4 py-2.5 rounded-2xl rounded-bl-md max-w-md">
                  Calling FNAC Montparnasse now.
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-500">
                    <Phone className="w-3 h-3" /> Call placed · Waiting for answer
                  </div>
                </div>
                <div className="bg-zinc-800 text-zinc-100 px-4 py-2.5 rounded-2xl rounded-bl-md max-w-md">
                  ✅ 3 in stock. Reserved one under your name. Total: $199.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">One assistant. Infinite capabilities.</h2>
          <p className="text-zinc-400 max-w-lg mx-auto">Relay uses AI tool-calling to decide what to do, then does it — across the web, your files, and the phone network.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="group p-6 rounded-2xl border border-zinc-800 bg-[#111113] hover:border-zinc-700 hover:bg-[#16161a] transition">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-indigo-500/10 transition">
                <f.icon className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple pricing</h2>
          <p className="text-zinc-400">Start free. Upgrade when you need more.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.name} className={`relative p-8 rounded-2xl border ${p.popular ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-zinc-800 bg-[#111113]'}`}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}
              <h3 className="font-semibold text-lg mb-1">{p.name}</h3>
              <div className="text-4xl font-bold mb-1">${p.price}<span className="text-base font-normal text-zinc-500">/mo</span></div>
              <p className="text-sm text-zinc-500 mb-6">{p.messages} messages · {p.calls} calls</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2.5 text-sm text-zinc-300"><Check className="w-4 h-4 text-emerald-400 shrink-0" />{p.tools}</li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-300"><Check className="w-4 h-4 text-emerald-400 shrink-0" />{p.calls} phone calls/mo</li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-300"><Check className="w-4 h-4 text-emerald-400 shrink-0" />Conversation history</li>
              </ul>
              <Link href="/auth" className={`block text-center py-2.5 rounded-xl font-medium text-sm transition ${p.popular ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500' : 'border border-zinc-700 text-white hover:bg-white/5'}`}>
                {p.price === 0 ? 'Get started' : 'Subscribe'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Stop chatting. Start doing.</h2>
        <p className="text-zinc-400 mb-8">Free to start. No credit card required.</p>
        <Link href="/auth" className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white px-8 py-3.5 rounded-xl font-medium transition shadow-lg shadow-indigo-500/25">
          Try Relay free <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" fill="white" />
            </div>
            Relay
          </div>
          <p className="text-xs text-zinc-600">© 2026 Relay. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}