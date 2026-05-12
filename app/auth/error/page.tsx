import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl text-card-foreground">
                Authentication Error
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {params?.error ? (
                <p className="text-sm text-muted-foreground">
                  Error: {params.error}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  An unspecified error occurred during authentication.
                </p>
              )}
              <Button asChild className="w-full">
                <Link href="/auth/login">Try again</Link>
              </Button>
              <Button variant="ghost" asChild className="w-full">
                <Link href="/">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
