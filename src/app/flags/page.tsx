import type { Metadata } from "next";
import { FlagsPage } from "@/components/demo/pages/flags-page";

export const metadata: Metadata = { title: "Flags · SistemSaya Flags" };

export default function Page() {
  return <FlagsPage />;
}
