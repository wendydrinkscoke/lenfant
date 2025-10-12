import { useSearchParams } from "react-router-dom";
import { Button } from "./ui/button";
import AttachmentForm from "./attachment-form";
import { CognitoAuthGate } from "./cognito-auth-gate";

export default function CreateAttachmentContent() {
  const [searchParams] = useSearchParams();
  const loginHint = searchParams.get("login_hint") ?? undefined;

  return (
    <CognitoAuthGate loginHint={loginHint}>
      {({ user, signOut }) => (
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-4xl p-6">
            <div className="mb-6 flex items-center justify-between rounded-lg border bg-card p-3">
              <div className="flex items-center gap-3">
                {user?.picture && (
                  <img
                    src={user.picture || "/placeholder.svg"}
                    alt={user?.name || "User"}
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <div>
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>

            <AttachmentForm />
          </div>
        </div>
      )}
    </CognitoAuthGate>
  );
}
