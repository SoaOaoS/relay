import Link from 'next/link'
import { Bot, Phone, Globe, FileText, Search, Zap, Check, MessageSquare, Calendar } from 'lucide-react'

const features = [
  { icon: MessageSquare, title: 'Smart Chat', desc: 'Ask anything. Relay researches, writes, analyzes, and gets things done.' },
  { icon: Globe, title: 'Web Search & Fetch', desc: 'Search the web, read articles, gather information in real time.' },
  { icon: Search, title: 'GitHub & Code', desc: 'Browse repos, read code, review PRs, understand any project.' },
  { icon: FileText, title: 'File & Document Help', desc: 'Read, write, edit documents, scripts, and any text files.' },
  { icon: Phone, title: 'AI Phone Calls', desc: 'Relay calls people for you — takes notes, asks questions, reports back.' },
  { icon: Calendar, title: 'Task Automation', desc: 'Research, summarize, translate, compare, plan — just ask.' },
]

const plans = [
  { name: 'Free', price: '$0', messages: '20 messages/mo', calls: 'No calls', popular: false },
  { name: 'Pro', price: '$29', messages: '500 messages/mo', calls: '5 calls/mo', popular: true },
  { name: 'Unlimited', price: '$99', messages: 'Unlimited', calls: '50 calls/mo', popular: false },
]

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Bot className="w-6 h-6 text-blue-600" />
            Relay
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link href="/auth" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">Get Started</Link>
          </div>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <Zap className="w-4 h-4" />
          AI Assistant + Phone Calls
        </div>
        <h1 className="text-5xl font-bold tracking-tight max-w-2xl mb-6">
          Your personal AI assistant<br />
          <span className="text-blue-600">that actually does things</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mb-8">
          Relay researches the web, browses GitHub, edits files, makes phone calls,
          and gets stuff done. One conversation, infinite possibilities.
        </p>
        <Link href="/auth" className="bg-blue-600 text-white px-8 py-3 rounded-xl text-lg font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-200">
          Try Relay — Free
        </Link>
      </section>

      <section className="border-t py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="border rounded-xl p-6 hover:shadow-md transition">
                <f.icon className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Simple pricing</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div key={p.name} className={`border-2 rounded-xl p-6 ${p.popular ? 'border-blue-600 shadow-lg shadow-blue-100 relative' : ''}`}>
                {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Most popular</span>}
                <h3 className="font-bold text-xl mb-1">{p.name}</h3>
                <div className="text-3xl font-bold mb-4">{p.price}<span className="text-base font-normal text-muted-foreground">/mo</span></div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-600" />{p.messages}</li>
                  <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-600" />{p.calls}</li>
                </ul>
                <Link href="/auth" className={`block text-center py-2.5 rounded-lg font-medium transition ${p.popular ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border hover:bg-gray-50'}`}>
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-8 px-4 text-center text-sm text-muted-foreground">
        Relay — Your personal AI assistant
      </footer>
    </div>
  )
}
