import type { Metadata } from "next";
import { ClientsPage } from "@/components/demo/pages/clients-page";

export const metadata: Metadata = { title: "Clients · SistemSaya Flags" };

export default function Page() {
  return <ClientsPage />;
}
