import { CATALOG, PROVIDERS } from "@/lib/catalog";
import { StatusDashboard } from "@/components/status-dashboard";

export default function Home() {
  return <StatusDashboard providers={PROVIDERS} services={CATALOG} />;
}
