import type { Metadata } from "next";
import { AuditPage } from "@/components/demo/pages/audit-page";

export const metadata: Metadata = { title: "Audit log · SistemSaya Flags" };

export default function Page() {
  return <AuditPage />;
}
