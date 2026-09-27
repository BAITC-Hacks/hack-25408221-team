# Frontend Code Review - Lightweight Fixes & Dead Code Removal Plan

## Summary of Findings

The codebase is a Next.js 15 (React 19) application with:
- **84 UI components** in `components/ui/` (mostly shadcn/ui)
- **6 form tabs** for application flow
- **Admin dashboard** with applicant management
- **Video interview** with WebSocket + WebRTC
- **AuthContext** for client-side auth state

---

## 🔴 Critical Bugs (Fix First)

| # | Location | Issue |
|---|----------|-------|
| 1 | `app/apply/form/page.tsx:96` | `showErrors={Object.keys(formErrors).length > 0}` passes `true` to **ALL tabs** when ANY tab has errors - shows false validation errors on untouched tabs |
| 2 | `contexts/AuthContext.tsx:58-65` | `clearAuthData()` removes `userPhone`, `program`, `videoSubmitted` - **never set anywhere** |
| 3 | `contexts/AuthContext.tsx:88-93` | Duplicate localStorage writes: `userId`, `userName`, `userEmail` stored separately AND in `USER_KEY` JSON |
| 4 | `hooks/use-auth-guard.ts:11-17` | Uses localStorage directly instead of AuthContext; removes keys that don't exist |
| 5 | `app/api/recording/[sessionId]/route.ts:18,32` | **Token in URL query param** - leaks in server logs, browser history, referrer headers |
| 6 | `lib/api.ts:70-74` | `api.login`/`register` don't validate token expiry before storing |
| 7 | `hooks/use-interview-call.ts:307-318` | `checkMediaPermissions()` creates MediaStream tracks just to stop them - wasteful |

---

## 🟡 Dead Code / Unused Imports (Delete)

| # | Location | What to Remove |
|---|----------|----------------|
| 1 | `lib/auth.ts:50-66` | `getTimeUntilExpiry()` - **never used** |
| 2 | `contexts/AuthContext.tsx:58-65` | Remove `userPhone`, `program`, `videoSubmitted` from `clearAuthData()` and `logout()` |
| 3 | `contexts/AuthContext.tsx:90-92` | Remove redundant `localStorage.setItem("userId"/"userName"/"userEmail")` |
| 4 | `hooks/use-auth-guard.ts:13-15` | Remove `userName`, `userEmail` removal |
| 5 | `components/application-sidebar.tsx:30` | Hardcoded deadline `2026-05-30` → move to env/config |
| 6 | `hooks/use-interview-call.ts:9` | `TOTAL_QUESTIONS = 6` - hardcoded, should come from server |
| 7 | `lib/feature-flags.ts` | **Entire file** - imported nowhere |
| 8 | `components/form-tabs/certificate.tsx:13-27` | State variables `fatherIncomeCert`, `motherIncomeCert`, `guardianIncomeCert` - **never used** |
| 9 | `components/ui/` | **~35 unused shadcn components** (accordion, avatar, hover-card, slider, navigation-menu, menubar, context-menu, popover, scroll-area, radio-group, input-otp, sonner, chart, aspect-ratio, collapsible, resizable, carousel, toggle, toggle-group) |

---

## 🟢 Lightweight Improvements

| # | Location | Change |
|---|----------|--------|
| 1 | `app/apply/form/page.tsx` | Fix `showErrors` to only show for **current active tab** |
| 2 | `lib/api.ts` | Remove `credentials: "include"` from `createSession` (uses Bearer token) |
| 3 | `app/api/recording/[sessionId]/route.ts` | Move token to **Authorization header** instead of URL |
| 4 | `components/form-tabs/personal-info.tsx:185-198` | Citizenship "dropdown" is just a button - add real dropdown or remove |
| 5 | `components/app-header.tsx:21` | Add `suppressHydrationWarning` to dropdown for SSR |
| 6 | `hooks/use-interview-call.ts:381` | `ws.send({ type: "recording_started" })` - add comment explaining purpose |
| 7 | `lib/api.ts:53-67` | `fetchApiRaw` missing `Content-Type` header |
| 8 | `package.json` | Remove unused `@radix-ui/*` dependencies (saves ~2MB) |

---

## 📦 Large Components to Split (Future Work)

| Component | Lines | Recommendation |
|-----------|-------|----------------|
| `app/admin/applicant/[id]/page.tsx` | 1395 | Split into tabs: `PersonalInfoTab`, `AnswersTab`, `EvaluationTab`, `TranscriptTab`, `RecordingTab`, `AnalysisTab` + `RecordingModal`, `Sidebar` |
| `app/admin/page.tsx` | 684 | Extract `ApplicantTable`, `StatsCards`, `Filters`, `RecordingModal` |
| `hooks/use-interview-call.ts` | 525 | Extract `useMediaCapture`, `useWebSocket`, `useRecording`, `useTimer` |

---

## ✅ Unused package.json Dependencies (Safe to Remove)

```json
// These @radix-ui packages are NOT imported anywhere in app code:
"@radix-ui/react-accordion": "1.2.12",
"@radix-ui/react-alert-dialog": "1.1.15",  // only used internally in alert-dialog.tsx
"@radix-ui/react-aspect-ratio": "1.1.8",
"@radix-ui/react-avatar": "1.1.11",
"@radix-ui/react-collapsible": "1.1.12",
"@radix-ui/react-context-menu": "2.2.16",
"@radix-ui/react-hover-card": "1.1.15",
"@radix-ui/react-menubar": "1.1.16",
"@radix-ui/react-navigation-menu": "1.2.14",
"@radix-ui/react-popover": "1.1.15",
"@radix-ui/react-radio-group": "1.3.8",
"@radix-ui/react-scroll-area": "1.2.10",
"@radix-ui/react-slider": "1.3.6",
"@radix-ui/react-toggle": "1.1.10",
"@radix-ui/react-toggle-group": "1.1.11",
"@radix-ui/react-tooltip": "1.2.8",
// Also unused:
"embla-carousel-react": "8.6.0",
"input-otp": "1.4.2",
"recharts": "2.15.0",
"vaul": "^1.1.2",  // only used in sidebar.tsx internally
"cmdk": "1.1.1",   // only used in command.tsx internally
"react-day-picker": "9.13.2",  // only used in calendar.tsx internally
```

---

## Implementation Order

1. **Phase 1 - Critical Bugs** (30 min): Fix #1-7 above
2. **Phase 2 - Dead Code Removal** (15 min): Delete unused functions, state, localStorage keys
3. **Phase 3 - Unused Dependencies** (10 min): Remove 25+ packages from package.json, delete corresponding UI component files
4. **Phase 4 - UX Fixes** (20 min): Fix showErrors, citizenship dropdown, token-in-URL
5. **Phase 5 - Verify** (5 min): Run `npm run build` and `npm run lint`

---

## Questions Before Implementation

1. **Do you want me to delete the unused UI component files** (e.g., `components/ui/accordion.tsx`, `components/ui/avatar.tsx`, etc.) or just remove them from package.json?
2. **Should I split the large admin components** now, or just do the lightweight fixes?
3. **The `feature-flags.ts` file** - is this intended for future use or can it be deleted?
4. **Citizenship dropdown** in personal-info - should I implement a real Select component or keep as display-only?