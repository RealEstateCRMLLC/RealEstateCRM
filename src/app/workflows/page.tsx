import Link from 'next/link';

/**
 * Workflows hub.
 *
 * /workflows used to 404: the layout (with both AI assistants) existed
 * but no index page did. This hub gives the four guided workflows one
 * landing surface inside the shared layout instead of a dead end.
 */
const WORKFLOWS = [
  {
    href: '/workflows/foreclosure-intake',
    title: 'Foreclosure Intake',
    description: 'Capture Macomb County foreclosure notices exactly as published, prep the lead, and pass the human review gate before any Lofty sync.',
  },
  {
    href: '/workflows/listing-entry',
    title: 'Listing Entry',
    description: 'Property, pricing, remarks, and showing prep — assemble a complete listing record step by step.',
  },
  {
    href: '/workflows/marketing-media',
    title: 'Marketing Media',
    description: 'Generate and process the marketing media pipeline for listings and campaigns.',
  },
  {
    href: '/workflows/offer-draft',
    title: 'Offer Draft',
    description: 'Core offer details, terms, and supporting context — draft a structured offer without leaving the CRM.',
  },
];

export default function WorkflowsHubPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guided, multi-step processes for the repeatable work — each one saves as you go and keeps a human review gate before anything leaves the CRM.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {WORKFLOWS.map((workflow) => (
          <Link
            key={workflow.href}
            href={workflow.href}
            className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/40"
          >
            <h2 className="text-base font-semibold">{workflow.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>
            <span className="mt-3 inline-block text-xs font-semibold text-primary">Open workflow →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
