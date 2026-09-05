import { acceptInvitation } from "@/app/accept-invite/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/context";
import { productBrand } from "@/modules/platform/brand";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const parameters = await searchParams;
  const token = parameters.token ?? "";
  await requireAuthenticatedUser(`/accept-invite?token=${encodeURIComponent(token)}`);

  return (
    <main id="negosu-accept-invitation-page" className="grid min-h-dvh place-items-center bg-slate-50 p-5">
      <Card id="negosu-accept-invitation-card" elevation="md" className="w-full max-w-md p-6">
        <p className="text-sm font-bold text-brand-primary-strong">Staff invitation</p>
        <h1 className="mt-2 text-3xl font-black">Join this business on {productBrand.name}</h1>
        <p className="mt-2 text-sm text-zinc-600">Accepting adds your signed-in account with the role and branch access chosen by the business owner.</p>
        <FormMessage error={parameters.error} />
        <form id="negosu-accept-invitation-form" action={acceptInvitation} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <SubmitButton id="negosu-accept-invitation-button" pendingText="Accepting…">Accept invitation</SubmitButton>
        </form>
      </Card>
    </main>
  );
}
