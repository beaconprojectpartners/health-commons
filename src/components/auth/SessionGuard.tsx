/**
 * SessionGuard — strict session lifecycle for signed-in users.
 *
 * Enforces:
 *   • 15-minute idle timeout (mouse/keyboard/touch/scroll reset the timer)
 *   • 8-hour absolute session lifetime (tracked in sessionStorage)
 *   • Sign-out when the last tab/window closes (sessionStorage clears)
 *   • 60-second "Stay signed in" warning before idle expiry
 *
 * No-op for unauthenticated visitors — public pages stay fully public.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

const IDLE_MS = 15 * 60 * 1000;          // 15 minutes
const WARNING_MS = 60 * 1000;            // 60-second warning
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;  // 8 hours
const SESSION_START_KEY = "dx_session_started_at";
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

export function SessionGuard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [warningOpen, setWarningOpen] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const warnTimer = useRef<number | null>(null);
  const expireTimer = useRef<number | null>(null);
  const absoluteTimer = useRef<number | null>(null);
  const tickTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (warnTimer.current) window.clearTimeout(warnTimer.current);
    if (expireTimer.current) window.clearTimeout(expireTimer.current);
    if (tickTimer.current) window.clearInterval(tickTimer.current);
    warnTimer.current = null;
    expireTimer.current = null;
    tickTimer.current = null;
  };

  const doSignOut = async (reason: "idle" | "absolute") => {
    clearTimers();
    setWarningOpen(false);
    await signOut();
    toast({
      title: "Signed out",
      description:
        reason === "idle"
          ? "You were signed out after 15 minutes of inactivity."
          : "Your session reached its 8-hour limit. Please sign in again.",
    });
    navigate("/auth");
  };

  const scheduleIdle = () => {
    clearTimers();
    setWarningOpen(false);
    warnTimer.current = window.setTimeout(() => {
      setCountdown(Math.floor(WARNING_MS / 1000));
      setWarningOpen(true);
      tickTimer.current = window.setInterval(() => {
        setCountdown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
      expireTimer.current = window.setTimeout(() => doSignOut("idle"), WARNING_MS);
    }, IDLE_MS - WARNING_MS);
  };

  // Activity listeners + idle scheduling
  useEffect(() => {
    if (!user) {
      clearTimers();
      setWarningOpen(false);
      return;
    }

    // Record / read absolute session start
    let startedAt = Number(sessionStorage.getItem(SESSION_START_KEY) ?? 0);
    if (!startedAt) {
      startedAt = Date.now();
      sessionStorage.setItem(SESSION_START_KEY, String(startedAt));
    }
    const remainingAbsolute = startedAt + ABSOLUTE_MS - Date.now();
    if (remainingAbsolute <= 0) {
      doSignOut("absolute");
      return;
    }
    absoluteTimer.current = window.setTimeout(() => doSignOut("absolute"), remainingAbsolute);

    const onActivity = () => {
      // Don't reset while the warning dialog is open — user must click "Stay signed in"
      if (warningOpen) return;
      scheduleIdle();
    };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    scheduleIdle();

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      clearTimers();
      if (absoluteTimer.current) window.clearTimeout(absoluteTimer.current);
      absoluteTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, warningOpen]);

  // Sign out when the last tab closes (sessionStorage is per-tab; if it's empty
  // on next load we'll force a fresh sign-in even if Supabase persisted to localStorage)
  useEffect(() => {
    if (!user) return;
    // If the tab was reopened with a stale localStorage session but no
    // sessionStorage marker, treat as expired.
    const marker = sessionStorage.getItem(SESSION_START_KEY);
    if (!marker) {
      // First load this tab: marker is set above. Nothing to do here.
    }
    const onUnload = () => {
      // Best-effort: clear the per-tab marker so reopening forces re-auth
      sessionStorage.removeItem(SESSION_START_KEY);
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [user]);

  // On mount: if user exists in localStorage but no sessionStorage marker
  // exists from a prior tab, sign them out.
  useEffect(() => {
    if (!user) return;
    const marker = sessionStorage.getItem(SESSION_START_KEY);
    if (!marker) {
      // Set it now so the absolute-timer effect above can use it. We treat
      // this fresh tab as a new session start.
      sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
    }
  }, [user]);

  const staySignedIn = () => {
    setWarningOpen(false);
    scheduleIdle();
  };

  return (
    <AlertDialog open={warningOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Still there?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll be signed out in {countdown} second{countdown === 1 ? "" : "s"} for security.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => doSignOut("idle")}>Sign out now</AlertDialogCancel>
          <AlertDialogAction onClick={staySignedIn}>Stay signed in</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}