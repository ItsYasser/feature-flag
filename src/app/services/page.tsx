import type { Metadata } from "next";
import { ServicesPage } from "@/components/demo/pages/services-page";

export const metadata: Metadata = { title: "Services · SistemSaya Flags" };

export default function Page() {
  return <ServicesPage />;
}
