"use client";

/**
 * useFormAutoSave — saves React Hook Form state to sessionStorage on every
 * change, restores it on mount, and exposes a clearSaved() to call after
 * successful submission.
 *
 * Usage:
 *   const { clearSaved } = useFormAutoSave(form, "pet_add_draft");
 *
 *   const onSubmit = async (data) => {
 *     await saveToSupabase(data);
 *     clearSaved();       // ← clear draft after success
 *     router.push("/...");
 *   };
 *
 * Notes:
 *   - Uses sessionStorage so drafts don't persist across browser sessions.
 *   - Safe to use with any UseFormReturn type — generic implementation.
 *   - Silently ignores storage errors (private browsing, quota exceeded).
 */
import { useEffect, useCallback } from "react";
import type { UseFormReturn, FieldValues, DefaultValues } from "react-hook-form";

export function useFormAutoSave<T extends FieldValues>(
  form: UseFormReturn<T>,
  storageKey: string
): { clearSaved: () => void } {
  const { watch, reset } = form;

  // ── Restore saved values on mount ────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as DefaultValues<T>;
        reset(parsed, { keepDefaultValues: false });
      }
    } catch {
      // Ignore parse errors / SSR
    }
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save on every change ──────────────────────────────────────────────────
  useEffect(() => {
    const subscription = watch((values) => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(values));
      } catch {
        // Ignore quota / privacy errors
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, storageKey]);

  // ── Clear draft after successful submit ───────────────────────────────────
  const clearSaved = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  }, [storageKey]);

  return { clearSaved };
}
