import { Workspace } from '@/components/workspace';
import { notFound } from 'next/navigation';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ page?: string[] }>;
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { page } = await params;
  const view = page?.join('/') || 'overview';
  if (
    ![
      'overview',
      'invoices',
      'review',
      'vendors',
      'replay',
      'wallets',
      'memory',
      'activity',
      'settings',
      'settings/integrations',
    ].includes(view)
  )
    notFound();
  return <Workspace view={view} initialInvoice={(await searchParams).invoice} />;
}
