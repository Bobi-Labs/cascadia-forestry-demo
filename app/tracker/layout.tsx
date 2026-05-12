import type { Metadata } from "next";
import { TrackerAuthWrapper } from "./tracker-auth-wrapper";

export const metadata: Metadata = {
  title: "Work Tracker — Cascadia & Ramos",
  description: "Project management tracker for Cascadia & Ramos forestry platform development",
};

export default function TrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <TrackerAuthWrapper>{children}</TrackerAuthWrapper>
    </div>
  );
}
