import { ScuApp } from "@/components/scu-app";

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  return <ScuApp route={`/${slug.join("/")}`} />;
}
