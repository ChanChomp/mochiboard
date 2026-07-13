import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "mochiboard | Dashboard",
  description: "A polished dashboard homepage for mochiboard with planning, wellness, and budgeting summaries.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="grid gap-8 xl:grid-cols-[280px_1fr]">
          <aside className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="mb-10">
              <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-700">
                mochiboard
              </span>
              <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
                Hello, adventurer.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Keep your day in view with planning, wellness, and budget check-ins built to feel calm and focused.
              </p>
            </div>

            <nav className="space-y-2 text-sm font-medium text-slate-700">
              <a className="block rounded-3xl px-4 py-3 transition hover:bg-slate-100 hover:text-slate-900" href="#planner">
                Planner
              </a>
              <a className="block rounded-3xl px-4 py-3 transition hover:bg-slate-100 hover:text-slate-900" href="#wellness">
                Health & Fitness
              </a>
              <a className="block rounded-3xl px-4 py-3 transition hover:bg-slate-100 hover:text-slate-900" href="#finances">
                Finances
              </a>
              <a className="block rounded-3xl px-4 py-3 transition hover:bg-slate-100 hover:text-slate-900" href="#notes">
                Notes
              </a>
            </nav>

            <div className="mt-10 rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 text-slate-100 shadow-[0_18px_60px_rgba(15,23,42,0.14)]">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Today’s focus</p>
              <p className="mt-4 text-lg font-semibold leading-7">Launch your routines</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Check your planner, review sleep, and set a weekly budget for a smoother week.
              </p>
            </div>
          </aside>

          <main className="space-y-8">
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-600">Dashboard</p>
                  <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    Your week at a glance
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                    Built for people who want a calm, modern overview of plans, wellness, and money without clutter.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl bg-slate-100 px-4 py-4 text-center">
                    <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Focus</span>
                    <span className="mt-2 block text-2xl font-semibold text-slate-950">3</span>
                  </div>
                  <div className="rounded-3xl bg-slate-100 px-4 py-4 text-center">
                    <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Events</span>
                    <span className="mt-2 block text-2xl font-semibold text-slate-950">8</span>
                  </div>
                  <div className="rounded-3xl bg-slate-100 px-4 py-4 text-center">
                    <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Savings</span>
                    <span className="mt-2 block text-2xl font-semibold text-slate-950">$1.8k</span>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-3">
              <section id="planner" className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Planner</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">Today’s schedule</h2>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                    4 events
                  </span>
                </div>

                <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, index) => (
                    <div key={day} className={`min-w-[64px] rounded-3xl border px-3 py-2 text-center text-sm ${index === 2 ? 'border-indigo-600 bg-indigo-600/10 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                      <p className="font-semibold">{day}</p>
                      <p className="mt-1 text-xs">{['14', '15', '16', '17', '18'][index]}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Project check-in</p>
                    <p className="mt-1 text-sm text-slate-600">10:00 AM · Review goals and next steps.</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Workout</p>
                    <p className="mt-1 text-sm text-slate-600">12:30 PM · Strength routine + stretch.</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Budget review</p>
                    <p className="mt-1 text-sm text-slate-600">4:00 PM · Weekly forecasting session.</p>
                  </div>
                </div>
              </section>

              <section id="wellness" className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Health & Fitness</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">Wellness summary</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">
                    On track
                  </span>
                </div>

                <div className="mt-6 grid gap-4">
                  <div className="rounded-3xl bg-slate-50 p-5">
                    <p className="text-sm font-medium text-slate-900">Sleep</p>
                    <div className="mt-3 flex items-end gap-3">
                      <p className="text-3xl font-semibold text-slate-950">7.8h</p>
                      <p className="text-sm text-slate-500">goal 8h</p>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-2 w-[98%] rounded-full bg-indigo-600" />
                    </div>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-5">
                    <p className="text-sm font-medium text-slate-900">Steps</p>
                    <div className="mt-3 flex items-end gap-3">
                      <p className="text-3xl font-semibold text-slate-950">9.2k</p>
                      <p className="text-sm text-slate-500">goal 10k</p>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-2 w-[92%] rounded-full bg-emerald-500" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl bg-slate-50 p-5">
                      <p className="text-sm font-medium text-slate-900">Water</p>
                      <p className="mt-3 text-3xl font-semibold text-slate-950">1.8L</p>
                      <p className="mt-2 text-sm text-slate-500">Goal 2L</p>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-5">
                      <p className="text-sm font-medium text-slate-900">Mindful</p>
                      <p className="mt-3 text-3xl font-semibold text-slate-950">18m</p>
                      <p className="mt-2 text-sm text-slate-500">Goal 20m</p>
                    </div>
                  </div>
                </div>
              </section>

              <section id="finances" className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Finances</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">Budget snapshot</h2>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
                    Monthly
                  </span>
                </div>

                <div className="mt-6 space-y-5">
                  <div className="rounded-3xl bg-slate-50 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Available balance</p>
                        <p className="mt-2 text-3xl font-semibold text-slate-950">$4,250</p>
                      </div>
                      <span className="rounded-2xl bg-slate-900/5 px-3 py-2 text-sm font-semibold text-slate-950">
                        +12.4%
                      </span>
                    </div>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-5">
                    <p className="text-sm font-medium text-slate-900">Spending categories</p>
                    <div className="mt-5 space-y-4">
                      {[
                        { label: 'Housing', amount: '$1,200', pct: '48%' },
                        { label: 'Food', amount: '$420', pct: '19%' },
                        { label: 'Savings', amount: '$520', pct: '21%' },
                      ].map((item) => (
                        <div key={item.label} className="space-y-2">
                          <div className="flex items-center justify-between text-sm text-slate-700">
                            <span>{item.label}</span>
                            <span>{item.amount}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div className={`h-2 rounded-full ${item.label === 'Housing' ? 'bg-indigo-600 w-[48%]' : item.label === 'Food' ? 'bg-emerald-500 w-[19%]' : 'bg-amber-500 w-[21%]'}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
