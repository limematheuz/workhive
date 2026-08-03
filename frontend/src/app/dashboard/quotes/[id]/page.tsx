import { redirect } from "next/navigation";

type QuoteDetailPageProps = {
    params: Promise<{ id: string }>;
};

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
    const { id } = await params;
    redirect(`/dashboard/quotes?quote=${encodeURIComponent(id)}`);
}
