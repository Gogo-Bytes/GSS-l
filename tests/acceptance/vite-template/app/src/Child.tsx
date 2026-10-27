export default function Child({ className }: { className: string }) {
  return <h1 data-testid="title" className={className}>External GSS consumer</h1>
}
