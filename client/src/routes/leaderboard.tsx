import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function LeaderboardPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getLeaderboard();
      setLeaderboard(data.leaderboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-muted-foreground">Please log in to view the leaderboard</p>
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate({ to: "/" })}>
            ← Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">🏆 Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">
                {error}
              </div>
            )}

            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : leaderboard.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-white"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-muted-foreground w-8">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                      </span>
                      <div>
                        <p className="font-semibold">{entry.username}</p>
                        <p className="text-sm text-muted-foreground">Balance: ${entry.balance.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        ${entry.totalWinnings.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">total winnings</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
});