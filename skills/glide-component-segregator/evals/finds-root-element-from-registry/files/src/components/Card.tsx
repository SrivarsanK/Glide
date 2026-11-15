export function Card({ title }: { title: string }) {
  return (
    <article className="rounded-xl border bg-white p-4 md:p-8 hover:bg-slate-50">
      <h3 className="text-lg font-semibold">{title}</h3>
    </article>
  )
}
