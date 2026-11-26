import { useState, type FormEvent } from "react";
import { me, signIn, signUp, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** A library belongs to an account, so the shell starts here. */
export function SignIn({ onDone }: { onDone: (user: Me) => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "in") await signIn(email, password);
      else await signUp(email, password, name || email.split("@")[0]!);
      const user = await me();
      if (user) onDone(user);
      else setError("Signed in, but the session could not be read.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-screen place-items-center bg-background">
      <Card className="w-[340px]">
        <CardHeader className="pb-4">
          <CardTitle className="type-title">
            {mode === "in" ? "Sign in to Curio" : "Create your library"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "up" ? (
              <Input
                placeholder="Name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            ) : null}
            <Input
              type="email"
              required
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              required
              minLength={8}
              placeholder="Password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? <p className="type-caption text-destructive">{error}</p> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
            </Button>
            <p className="type-caption text-center">
              {mode === "in" ? "No account yet? " : "Already have one? "}
              <button
                type="button"
                className="text-foreground underline underline-offset-4"
                onClick={() => setMode(mode === "in" ? "up" : "in")}
              >
                {mode === "in" ? "Create one" : "Sign in"}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
