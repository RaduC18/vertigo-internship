import { useEffect, useState, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function ProfilePage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getProfile(activePage, resolvedPage);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [activePage, resolvedPage]);

  useEffect(() => {
    if (isAuthenticated) loadProfile();
  }, [loadProfile, isAuthenticated]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isAuthenticated) loadProfile();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadProfile, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-muted-foreground">Please log in to view your profile</p>
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate({ to: "/" })}>
            ← Back
          </Button>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">👤 {user?.username}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="font-bold text-green-600 text-xl">${user?.balance ?? 1000}</p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Active Bets */}
        <Card>
          <CardHeader>
            <CardTitle>Active Bets ({profile?.activeBets?.total ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile?.activeBets?.data?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No active bets</p>
            ) : (
              profile?.activeBets?.data?.map((bet: any) => (
                <div
                  key={bet.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-white cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate({ to: `/markets/${bet.marketId}` })}
                >
                  <div>
                    <p className="font-medium">{bet.marketTitle}</p>
                    <p className="text-sm text-muted-foreground">Outcome: {bet.outcomeTitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${bet.amount.toFixed(2)}</p>
                    <p className="text-sm text-blue-600">{bet.odds}% odds</p>
                  </div>
                </div>
              ))
            )}
            {profile?.activeBets?.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <Button variant="outline" onClick={() => setActivePage((p) => p - 1)} disabled={activePage === 1}>
                  Previous
                </Button>
                <span className="text-sm">{activePage} / {profile?.activeBets?.totalPages}</span>
                <Button variant="outline" onClick={() => setActivePage((p) => p + 1)} disabled={activePage === profile?.activeBets?.totalPages}>
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resolved Bets */}
        <Card>
          <CardHeader>
            <CardTitle>Resolved Bets ({profile?.resolvedBets?.total ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile?.resolvedBets?.data?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No resolved bets</p>
            ) : (
              profile?.resolvedBets?.data?.map((bet: any) => (
                <div
                  key={bet.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-white cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate({ to: `/markets/${bet.marketId}` })}
                >
                  <div>
                    <p className="font-medium">{bet.marketTitle}</p>
                    <p className="text-sm text-muted-foreground">Outcome: {bet.outcomeTitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${bet.amount.toFixed(2)}</p>
                    <Badge variant={bet.won ? "default" : "secondary"}>
                      {bet.won ? "✅ Won" : "❌ Lost"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
            {profile?.resolvedBets?.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <Button variant="outline" onClick={() => setResolvedPage((p) => p - 1)} disabled={resolvedPage === 1}>
                  Previous
                </Button>
                <span className="text-sm">{resolvedPage} / {profile?.resolvedBets?.totalPages}</span>
                <Button variant="outline" onClick={() => setResolvedPage((p) => p + 1)} disabled={resolvedPage === profile?.resolvedBets?.totalPages}>
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Key */}
        <Card>
          <CardHeader>
            <CardTitle>🔑 API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Folosește acest API key pentru a plasa pariuri programatic. Trimite header-ul: <code className="bg-gray-100 px-1 rounded">Authorization: ApiKey YOUR_KEY</code>
            </p>
            {apiKey && (
              <div className="p-3 bg-gray-100 rounded-lg font-mono text-sm break-all">
                {apiKey}
              </div>
            )}
            <Button
              onClick={async () => {
                try {
                  setIsGenerating(true);
                  const result = await api.generateApiKey();
                  setApiKey(result.apiKey);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to generate API key");
                } finally {
                  setIsGenerating(false);
                }
              }}
              disabled={isGenerating}
              variant="outline"
            >
              {isGenerating ? "Generating..." : apiKey ? "Regenerate API Key" : "Generate API Key"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});