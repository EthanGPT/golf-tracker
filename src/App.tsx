import { Fragment, useEffect, useRef, useState } from "react";
import {
  Activity,
  Archive,
  Check,
  ChevronRight,
  CircleDot,
  Gauge,
  History,
  Home,
  Plus,
  Save,
  Settings2,
  Target,
} from "lucide-react";
import "./App.css";
import {
  CLUBS,
  DEFAULT_BAG,
  DISTANCE_CLUBS,
  caddiePlan,
  isTeeTargetReachable,
  adaptiveCaddieDecision,
  resolveTeeDecision,
  isValidGolfShotContext,
  clubSummary,
  clubDisplayLabel,
  convertMetres,
  formatDate,
  formatShortDate,
  localDateString,
  personalisedRecommendation,
  roundTotal,
  roundHandicapIndex,
  currentHandicapIndex,
  roundTroubleDetailsByCategory,
  roundTroubleByCategory,
  shotLearningInsights,
  enrichShotWithContext,
  recentCategoryTroubleStats,
  ensurePuttingShot,
  appendHoleShot,
  updateHoleShot,
  seedData,
  startOfWeek,
} from "./domain";
import type {
  AppData,
  ClubName,
  FocusCategory,
  HoleShot,
  RoundHole,
  Screen,
  ShotPhase,
} from "./domain";
import { loadCloudData, saveCloudData } from "./cloudStorage";
import { isCloudConfigured, supabase } from "./supabase";
import {
  calculateShotWind,
  calculateWindAdjustedDistance,
  formatShotWind,
  getCourseWeather,
} from "./weather";
import type { WeatherContext } from "./weather";
import {
  bearingBetween,
  distanceBetweenMeters,
  getCurrentPosition,
  watchPosition,
  LocationError,
  TEE_ORIGIN_ACCURACY,
} from "./geo";
import {
  isSyncPending,
  loadLocalData,
  clearArchivedRoundDraft,
  ROUND_DRAFT_KEY,
  markSyncPending,
  saveLocalData,
} from "./localRepository";
import type { Session } from "@supabase/supabase-js";
import {
  HERMANUS_LOOPS,
  getCourse,
  generateTeeLandingCandidates,
  selectReachableTeeLandingCandidate,
  getHoleTeeOrigin,
  getTeeTarget,
  getHoleTarget,
  holeDistance,
  holePar,
  loopLabel,
} from "./course";
import {
  fetchAndCacheCourseGeometry,
  GOLFTRAXX_HERMANUS_PROVIDER_VERSION,
  readCachedCourse,
} from "./courseIngestion";

const navItems: Array<{ id: Screen; label: string; icon: typeof Home }> = [
  { id: "today", label: "Home", icon: Home },
  { id: "range", label: "Range", icon: Target },
  { id: "distances", label: "Distances", icon: Gauge },
  { id: "round", label: "Round", icon: CircleDot },
  { id: "progress", label: "Insights", icon: Activity },
];
const categories: FocusCategory[] = [
  "Tee shot",
  "Approach",
  "Short game",
  "Putting",
  "Course management",
];
const emptyHole = (holeNumber: number): RoundHole => ({
  holeNumber,
  score: 0,
  focusCategory: "Approach" as FocusCategory,
  wentRight: "",
  wentWrong: "",
});
function App() {
  const [data, setData] = useState<AppData | null>(() => loadLocalData());
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const guestModeRef = useRef(false);
  const [authReady, setAuthReady] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [guide, setGuide] = useState<"range" | "round" | null>(null);
  const rangeGuideSeenRef = useRef(false);
  const roundGuideSeenRef = useRef(false);
  const cloudReadySessionRef = useRef<string | null>(null);
  const [screen, setScreen] = useState<Screen>(
    () =>
      (localStorage.getItem("golf-tracker-screen") as Screen) || "distances",
  );
  const [selectedClub, setSelectedClub] = useState<ClubName>("7i");
  const [distanceInput, setDistanceInput] = useState("");
  const [playableInput, setPlayableInput] = useState(true);
  const [severeMissInput, setSevereMissInput] = useState(false);
  const distanceRef = useRef<HTMLInputElement>(null);
  const [roundDraft, setRoundDraft] = useState<
    AppData["rounds"][number] | null
  >(() => {
    try {
      const saved = localStorage.getItem("golf-tracker-round-draft");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [roundNotice, setRoundNotice] = useState("");
  const [roundSetupOpen, setRoundSetupOpen] = useState(true);
  const [roundHasStarted, setRoundHasStarted] = useState(false);
  const [roundWeather, setRoundWeather] = useState<WeatherContext>();
  const [completedRoundId, setCompletedRoundId] = useState<string | null>(null);
  const [, setGeometryVersion] = useState(0);
  useEffect(() => {
    localStorage.setItem("golf-tracker-screen", screen);
  }, [screen]);
  useEffect(() => {
    if (roundDraft)
      localStorage.setItem(
        "golf-tracker-round-draft",
        JSON.stringify(roundDraft),
      );
    else localStorage.removeItem("golf-tracker-round-draft");
  }, [roundDraft]);
  useEffect(() => {
    const courseId = roundDraft?.courseId || "hermanus-golf-club";
    if (screen !== "round" || !roundDraft) return;
    const course = getCourse(courseId);
    if (!course) return;
    let cancelled = false;
    getCourseWeather(course.id, course).then((weather) => {
      if (!cancelled) setRoundWeather(weather);
    });
    return () => {
      cancelled = true;
    };
  }, [screen, roundDraft?.courseId]);
  useEffect(() => {
    const courseId = roundDraft?.courseId || "hermanus-golf-club";
    const cached = readCachedCourse(courseId);
    const cacheComplete = cached?.providerVersion === GOLFTRAXX_HERMANUS_PROVIDER_VERSION && cached?.geometryCoverage?.greenCentres === cached?.geometryCoverage?.expectedHoles;
    if (screen !== "round" || !roundDraft || cacheComplete) return;
    const course = getCourse(courseId);
    if (!course) return;
    let cancelled = false;
    fetchAndCacheCourseGeometry({
      externalId: course.id,
      name: course.name,
      latitude: course.latitude,
      longitude: course.longitude,
      tees: course.tees.map((tee) => ({ id: tee.id, name: tee.name, colour: tee.colour })),
      holes: course.holes.map((hole) => ({
        number: hole.number,
        par: hole.par,
        distancesM: Object.fromEntries(hole.teeBoxes.map((tee) => [tee.teeId, tee.distanceM])),
      })),
    })
      .then(() => {
        if (!cancelled) setGeometryVersion((version) => version + 1);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [screen, roundDraft?.courseId]);
  useEffect(() => {
    if (!supabase) {
      setCloudError("Supabase is not configured in this deployment.");
      setAuthReady(true);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data: auth }) => {
        setSession(auth.session);
        setAuthReady(true);
      })
      .catch((error) => {
        setCloudError(
          error instanceof Error
            ? error.message
            : "Could not connect to Supabase.",
        );
        setAuthReady(true);
      });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, authSession) => {
        if (guestModeRef.current) return;
        if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
        setSession(authSession);
        if (event === "SIGNED_OUT" && !guestModeRef.current) {
          setCloudError("");
          setData(null);
          setDataReady(false);
        }
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!authReady || !session) return;
    // Do not allow data from a previous session (or pre-cloud local state) to
    // be written while this session's authoritative snapshot is loading.
    cloudReadySessionRef.current = null;
    setDataReady(false);
    let cancelled = false;
    (async () => {
      const cloudData = await loadCloudData(session);
      if (!cancelled) {
        // A browser's local data is not attributable to this account. Never
        // merge it into a signed-in user's cloud snapshot: that can leak a
        // previous guest or account's rounds into a different account.
        const authoritativeData = cloudData || seedData();
        saveLocalData(authoritativeData);
        if (cloudData) {
          clearArchivedRoundDraft(cloudData);
          try {
            const rawDraft = localStorage.getItem(ROUND_DRAFT_KEY);
            const draft = rawDraft ? JSON.parse(rawDraft) as { id?: string } : null;
            if (draft?.id && cloudData.rounds.some((round) => round.id === draft.id && round.status === "archived")) {
              setRoundDraft(null);
            }
          } catch {
            setRoundDraft(null);
          }
        }
        if (!cloudData) localStorage.removeItem(ROUND_DRAFT_KEY);
        setData(authoritativeData);
        cloudReadySessionRef.current = session.user.id;
        setDataReady(true);
        setShowOnboarding(localStorage.getItem(`golf-tracker-onboarding-${session.user.id}`) !== "complete");
      }
    })().catch((error) => {
      if (!cancelled)
        setCloudError(
          error instanceof Error
            ? error.message
            : "Could not load your Supabase data.",
        );
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, session]);
  useEffect(() => {
    if (guestMode || !data || !dataReady || !session || cloudReadySessionRef.current !== session.user.id) return;
    saveCloudData(session, data)
      .then(() => markSyncPending(false))
      .catch((error) => {
        markSyncPending(true);
        setCloudError(
          error instanceof Error
            ? error.message
            : "Could not save to Supabase.",
        );
      });
  }, [data, dataReady, session]);
  useEffect(() => {
    if (data) {
      saveLocalData(data);
      if (!session) markSyncPending(true);
    }
  }, [data, session]);
  useEffect(() => {
    if (!authReady || session || data || isCloudConfigured) return;
    setData(seedData());
    setDataReady(true);
  }, [authReady, session, data]);
  useEffect(() => {
    const retry = () => {
      if (navigator.onLine && isSyncPending())
        setData((current) => (current ? { ...current } : current));
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);
  const currentHandicap = data ? currentHandicapIndex(data.handicapHistory) : undefined;
  const archivedRounds =
    data?.rounds.filter((round) => round.status === "archived") || [];
  const latestRound = archivedRounds.at(-1);
  const rec = personalisedRecommendation(
    data?.rounds || [],
    data?.readings || [],
  );
  if (!authReady)
    return <div className="loading">Connecting your notebook...</div>;
  if (!supabase && cloudError && !session && !data)
    return (
      <div className="loading">
        {cloudError}
        <br />
        <small>
          Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the GitHub Actions
          secrets.
        </small>
      </div>
    );
  if (passwordRecovery && supabase)
    return <PasswordRecovery onComplete={() => setPasswordRecovery(false)} />;
  if (session && !dataReady)
    return <div className="loading">Loading your account...</div>;
  if (isCloudConfigured && !session && !guestMode) return <AuthScreen onGuest={() => { guestModeRef.current = true; setGuestMode(true); setSession(null); const guestData = seedData(); guestData.readings = []; guestData.rounds = []; guestData.handicapHistory = []; localStorage.removeItem("golf-tracker-round-draft"); saveLocalData(guestData); setData(guestData); setDataReady(true); setShowOnboarding(true); void supabase?.auth.signOut(); }} />;
  if (!data) return <div className="loading">Loading your notebook...</div>;
  if ((session || guestMode) && showOnboarding)
    return (
      <Onboarding
        data={data}
        updateData={(change) => setData((current) => (current ? change(current) : current))}
        finish={() => {
          if (session) localStorage.setItem(`golf-tracker-onboarding-${session.user.id}`, "complete");
          setShowOnboarding(false);
          setScreen("today");
        }}
      />
    );
  const updateData = (change: (current: AppData) => AppData) =>
    setData((current) => (current ? change(current) : current));
  const showGuide = (kind: "range" | "round") => {
    if (kind === "range" && rangeGuideSeenRef.current) return;
    if (kind === "round" && roundGuideSeenRef.current) return;
    const hasArchivedRound = data.rounds.some((round) => round.status === "archived");
    const shouldShow = (kind === "range" && data.readings.filter((reading) => reading.playable !== false && !reading.severeMiss).length === 0) || (kind === "round" && !hasArchivedRound);
    if (shouldShow) {
      if (kind === "range") rangeGuideSeenRef.current = true;
      if (kind === "round") roundGuideSeenRef.current = true;
      setGuide(kind);
    }
  };
  const dismissGuide = () => {
    setGuide(null);
  };
  const addReading = () => {
    const value = Number(distanceInput);
    if (!value || value <= 0) return;
    updateData((current) => ({
      ...current,
      readings: [
        ...current.readings,
        {
          id: crypto.randomUUID(),
          club: selectedClub,
          distanceMetres: Math.round(value),
          mishit: false,
          playable: playableInput,
          severeMiss: severeMissInput,
          sessionDate: localDateString(),
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setDistanceInput("");
    distanceRef.current?.focus();
  };

  const startRound = () => {
    const resumable = data.rounds
      .filter((round) => round.status === "in-progress" && round.holes.some((hole) => hole.score > 0))
      .sort((a, b) => {
        const active = (round: AppData["rounds"][number]) => round.archivedAt || round.date;
        return active(b).localeCompare(active(a)) || b.id.localeCompare(a.id);
      });
    const draftResumable = roundDraft?.status === "in-progress" &&
      roundDraft.holes.some((hole) => hole.score > 0) &&
      !data.rounds.some((round) => round.id === roundDraft.id && round.status === "archived")
      ? roundDraft
      : undefined;
    const unfinished = resumable[0] || draftResumable;
    const next = unfinished
      ? unfinished.courseId || unfinished.courseName?.toLowerCase().includes("hermanus")
        ? { ...unfinished, courseId: unfinished.courseId || "hermanus-golf-club", handicapIndex: roundHandicapIndex(currentHandicap, unfinished.handicapIndex) }
        : { ...unfinished, handicapIndex: roundHandicapIndex(currentHandicap, unfinished.handicapIndex) }
      : {
      id: crypto.randomUUID(),
      date: localDateString(),
      courseName: data.rounds.filter((round) => round.status === "archived").at(-1)?.courseName || data.homeCourseName || "Hermanus Golf Club",
      courseId: data.rounds.filter((round) => round.status === "archived").at(-1)?.courseId || data.homeCourseId || "hermanus-golf-club",
      overallNote: "",
      status: "in-progress" as const,
      holes: [],
      loop: data.lastRoundLoop || "east",
      loopId: data.lastRoundLoop || "east",
      roundLength: data.lastRoundLength || 9,
      tee: data.rounds.filter((round) => round.status === "archived").at(-1)?.tee || data.preferredTee || "white",
      teeId: data.rounds.filter((round) => round.status === "archived").at(-1)?.tee || data.preferredTee || "white",
      handicapIndex: roundHandicapIndex(currentHandicap),
        };
    setRoundDraft(next);
    const resuming = Boolean(unfinished && !roundSetupOpen);
    setRoundSetupOpen(!resuming);
    setRoundHasStarted(resuming);
    setScreen("round");
  };
  const persistRoundDraft = (next: AppData["rounds"][number]) => {
    setRoundDraft(next);
  };
  const saveHole = (submittedHole?: RoundHole) => {
    if (!roundDraft) return null;
    const sequence = roundDraft.courseId && roundDraft.courseId !== "hermanus-golf-club"
      ? (getCourse(roundDraft.courseId)?.holes.map((hole) => hole.number) || []).slice(0, roundDraft.roundLength || 9)
      : HERMANUS_LOOPS[roundDraft.loop || "east"].slice(0, roundDraft.roundLength || 9);
    const holeNumber =
      submittedHole?.holeNumber ||
      sequence[Math.min(roundDraft.holes.length, sequence.length - 1)];
    const existing = roundDraft.holes.find(
      (hole) => hole.holeNumber === holeNumber,
    );
    const hole = submittedHole || existing || emptyHole(holeNumber);
    if (!hole.score) {
      setRoundNotice("Add a score before saving this hole.");
      return null;
    }
    const holes = existing
      ? roundDraft.holes.map((item) =>
          item.holeNumber === holeNumber ? hole : item,
        )
      : [...roundDraft.holes, hole];
    const updated = { ...roundDraft, holes, status: "in-progress" as const };
    const archived = data.rounds.find((round) => round.id === updated.id && round.status === "archived");
    if (archived) {
      setRoundDraft(null);
      setRoundNotice("This round is archived. Start a new round.");
      return null;
    }
    updateData((current) => ({
      ...current,
      rounds: current.rounds.some((round) => round.id === updated.id)
        ? current.rounds.map((round) => round.id === updated.id && round.status !== "archived" ? updated : round)
        : [...current.rounds, updated],
    }));
    persistRoundDraft(updated);
    setRoundNotice("Saved");
    return updated;
  };
  const exitRound = () => {
    if (!roundDraft || !roundDraft.holes.some((hole) => hole.score > 0)) {
      setRoundDraft(null);
      setRoundSetupOpen(true);
      setRoundHasStarted(false);
      updateData((current) => ({
        ...current,
        rounds: current.rounds.filter((round) =>
          round.status !== "in-progress" || round.holes.some((hole) => hole.score > 0),
        ),
      }));
    }
    setScreen("today");
  };
  const archiveRound = (source = roundDraft) => {
    if (!source) return;
    if (data.rounds.some((round) => round.id === source.id && round.status === "archived")) {
      setRoundDraft(null);
      setRoundSetupOpen(true);
      setRoundHasStarted(false);
      return;
    }
    const updated = {
      ...source,
      status: "archived" as const,
      totalScore: roundTotal(source),
      archivedAt: new Date().toISOString(),
    };
    updateData((current) => ({
      ...current,
      rounds: current.rounds.some((round) => round.id === updated.id) ? current.rounds.map((round) => round.id === updated.id ? updated : round) : [...current.rounds, updated],
      weeklyPlan:
        current.weeklyPlan.weekStart === startOfWeek()
          ? { ...current.weeklyPlan, roundComplete: true }
          : {
              weekStart: startOfWeek(),
              practiceAComplete: false,
              practiceBComplete: false,
              practiceCComplete: false,
              roundComplete: true,
            },
      weeklyHistory:
        current.weeklyPlan.weekStart === startOfWeek()
          ? current.weeklyHistory
          : [...(current.weeklyHistory || []), current.weeklyPlan],
    }));
    setRoundDraft(null);
    setRoundSetupOpen(true);
    setRoundHasStarted(false);
    setRoundNotice("Round archived");
    setCompletedRoundId(updated.id);
    setScreen("progress");
  };
  const updatePlan = (
    key:
      | "practiceAComplete"
      | "practiceBComplete"
      | "practiceCComplete"
      | "roundComplete",
  ) =>
    updateData((current) => {
      const week = startOfWeek();
      const history = current.weeklyHistory || [];
      const plan =
        current.weeklyPlan.weekStart === week
          ? current.weeklyPlan
          : {
              weekStart: week,
              practiceAComplete: false,
              practiceBComplete: false,
              practiceCComplete: false,
              roundComplete: false,
            };
      const completed = { ...plan, [key]: !plan[key] };
      const practiceCount =
        current.practiceFrequency?.practiceSessionsPerWeek ?? 2;
      const finished =
        completed.practiceAComplete &&
        completed.practiceBComplete &&
        (practiceCount < 3 || completed.practiceCComplete) &&
        completed.roundComplete;
      return finished
        ? {
            ...current,
            weeklyHistory: [...history, completed],
            weeklyPlan: {
              weekStart: week,
              practiceAComplete: false,
              practiceBComplete: false,
              practiceCComplete: false,
              roundComplete: false,
            },
          }
        : {
            ...current,
            weeklyHistory:
              current.weeklyPlan.weekStart === week
                ? history
                : [...history, current.weeklyPlan],
            weeklyPlan: completed,
          };
    });
  const finishWeeklyPlanIfComplete = (current: AppData, plan: AppData["weeklyPlan"]) => {
    const practiceCount = current.practiceFrequency?.practiceSessionsPerWeek ?? 2;
    const roundsCount = current.practiceFrequency?.roundsPerWeek ?? 1;
    const practices = Array.from({ length: practiceCount }, (_, index) => plan.practiceSessionsComplete?.[index] ?? (index === 0 ? plan.practiceAComplete : index === 1 ? plan.practiceBComplete : index === 2 ? plan.practiceCComplete : false));
    const rounds = Array.from({ length: roundsCount }, (_, index) => plan.roundsComplete?.[index] ?? (index === 0 ? plan.roundComplete : false));
    if (!practices.every(Boolean) || !rounds.every(Boolean)) return { ...current, weeklyPlan: plan };
    return {
      ...current,
      weeklyHistory: [...(current.weeklyHistory || []), plan],
      weeklyPlan: { weekStart: startOfWeek(), practiceAComplete: false, practiceBComplete: false, practiceCComplete: false, roundComplete: false, practiceSessionsComplete: [], roundsComplete: [] },
    };
  };
  const togglePracticeSession = (index: number) =>
    updateData((current) => {
      const complete = [...(current.weeklyPlan.practiceSessionsComplete || [])];
      while (complete.length <= index) complete.push(false);
      complete[index] = !complete[index];
      return finishWeeklyPlanIfComplete(current, { ...current.weeklyPlan, practiceSessionsComplete: complete });
    });
  const toggleRoundSession = (index: number) =>
    updateData((current) => {
      const complete = [...(current.weeklyPlan.roundsComplete || [])];
      while (complete.length <= index) complete.push(false);
      complete[index] = !complete[index];
      return finishWeeklyPlanIfComplete(current, { ...current.weeklyPlan, roundsComplete: complete });
    });
  const screenTitle =
    screen === "settings"
      ? "Settings"
      : navItems.find((item) => item.id === screen)?.label || "Today";
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">MYCADDY</p>
          <h1>{screenTitle}</h1>
        </div>
        <button
          className="icon-button"
          title="Backup and restore"
          onClick={() => setScreen("settings")}
        >
          <Settings2 size={20} />
        </button>
      </header>
      <main className="main-content">
        {screen === "today" && (
          <Today
            data={data}
            currentHandicap={currentHandicap}
            latestRound={latestRound}
            recommendation={rec}
            go={setScreen}
            startRound={startRound}
            updatePlan={updatePlan}
            togglePracticeSession={togglePracticeSession}
            toggleRoundSession={toggleRoundSession}
          />
        )}
        {screen === "range" && (
          <Range
            data={data}
            units="metres"
            setUnits={() => undefined}
            selectedClub={selectedClub}
            setSelectedClub={setSelectedClub}
            distanceInput={distanceInput}
            setDistanceInput={setDistanceInput}
            distanceRef={distanceRef}
            addReading={addReading}
            playableInput={playableInput}
            setPlayableInput={setPlayableInput}
            severeMissInput={severeMissInput}
            setSevereMissInput={setSevereMissInput}
          />
        )}
        {screen === "distances" && (
          <Distances
            readings={data.readings}
            bag={data.bag}
            units="metres"
            setUnits={() => undefined}
          />
        )}
        {screen === "round" && (
          <RoundMode
            readings={data.readings}
            rounds={data.rounds.filter((round) => round.status === "archived")}
            bag={data.bag}
            draft={roundDraft}
            setDraft={persistRoundDraft}
            notice={roundNotice}
            setNotice={setRoundNotice}
            startRound={startRound}
            saveHole={saveHole}
            archiveRound={archiveRound}
            exitRound={exitRound}
            setupOpen={roundSetupOpen}
            setSetupOpen={setRoundSetupOpen}
            hasStarted={roundHasStarted}
            setHasStarted={setRoundHasStarted}
            weather={roundWeather}
          />
        )}
        {screen === "progress" && (
          <Progress data={data} recommendation={rec} updatePlan={updatePlan} focusRoundId={completedRoundId} latestHandicap={currentHandicap} updateRound={(round) => updateData((current) => ({ ...current, rounds: current.rounds.map((item) => item.id === round.id ? round : item), handicapHistory: round.handicapIndex != null && current.handicapHistory.at(-1)?.index !== round.handicapIndex ? [...current.handicapHistory, { id: crypto.randomUUID(), date: localDateString(), index: round.handicapIndex }] : current.handicapHistory }))} />
        )}
        {screen === "settings" && (
          <Settings data={data} updateData={updateData} signOut={() => { guestModeRef.current = false; setGuestMode(false); setCloudError(""); setSession(null); setData(null); setDataReady(false); setShowOnboarding(false); void supabase?.auth.signOut(); }} />
        )}
      </main>
      <nav className="bottom-nav">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={screen === id ? "active" : ""}
            onClick={() => {
              if (id === "round" && !roundHasStarted) setRoundSetupOpen(true);
              if (id === "range" || id === "distances") showGuide("range");
              if (id === "round") showGuide("round");
              setScreen(id);
            }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {guide && <CoachGuide kind={guide} dismiss={dismissGuide} />}
    </div>
  );
}

function CoachGuide({ kind, dismiss }: { kind: "range" | "round"; dismiss: () => void }) {
  const range = kind === "range";
  const roundSteps = <><div><b>1</b><span>MyCaddy tells you the best club for this specific hole</span></div><div><b>2</b><span>Tap Next Shot at your ball and confirm the lie</span></div><div><b>3</b><span>MyCaddy adjusts for wind and your data, then gives you the next club</span></div><div><b>4</b><span>Repeat, enter your score, and save the hole</span></div></>;
  return <div className="guide-overlay" onClick={dismiss}>
    <div className="guide-card" onClick={(event) => event.stopPropagation()}>
      <span className="guide-kicker">{range ? "START HERE" : "ON-COURSE CADDIE"}</span>
      <h2>{range ? "Build your club numbers" : "Play with your data"}</h2>
      <div className="guide-steps">{range ? <><div><b>1</b><span>Enter the carry distance</span></div><div><b>2</b><span>Mark playable or severe miss (OB)</span></div><div><b>3</b><span>Build at least five usable shots for better tips</span></div></> : roundSteps}</div>
      <div className="guide-demo"><span className="guide-cursor">↗</span><strong>{range ? "Tap Range" : "Tap Next Shot"}</strong><small>{range ? "Your distances power every recommendation" : "MyCaddy handles the decision at the ball"}</small></div>
      <button className="primary-button" onClick={dismiss}>Got it</button>
    </div>
  </div>;
}

function AuthScreen({ onGuest }: { onGuest: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [signupSent, setSignupSent] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setNotice("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) setNotice(error.message);
  };

  const signUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (password !== confirmPassword) { setNotice("Passwords do not match."); return; }
    setBusy(true);
    setNotice("");
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setNotice(error.message);
    else setSignupSent(true);
  };

  const sendResetEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setNotice("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    setBusy(false);
    setNotice(error ? error.message : "Check your email for a password reset link.");
  };

  const [mode, setMode] = useState<"landing" | "auth">("landing");
  const [authMode, setAuthMode] = useState<"signIn" | "signUp" | "reset">("signIn");
  if (mode === "landing") return (
    <div className="landing-screen">
      <div className="landing-main">
        <div className="landing-copy">
          <span className="tag">MYCADDY</span>
          <h1>Your personal golf caddie, powered by your data.</h1>
          <p>MyCaddy learns your game and recommends the right shot, hole by hole.</p>
          <button className="primary-button landing-cta" onClick={() => { setAuthMode("signUp"); setMode("auth"); }}>Get started <ChevronRight size={17} /></button>
          <button className="landing-login" onClick={() => { setAuthMode("signIn"); setMode("auth"); }}>Already have an account? <strong>Sign in</strong></button>
        </div>
        <div className="landing-preview" aria-label="MyCaddy tee recommendation preview">
          <div className="preview-top"><span>HOLE 4</span><span>PAR 4</span><strong>362m</strong></div>
          <div className="preview-label">TEE</div>
          <div className="preview-club"><strong>3 WOOD</strong><span>BEST CLUB</span></div>
          <div className="preview-divider" />
          <div className="preview-data-grid">
            <div><span>YOUR CARRY</span><strong>214m</strong></div>
            <div><span>PLAYABLE RATE</span><strong>82%</strong></div>
            <div><span>SEVERE MISS %</span><strong>12%</strong></div>
            <div><span>WIND ADJUSTMENT</span><strong>+8m</strong></div>
          </div>
          <div className="preview-foot"><span className="preview-dot" />Recommendation built from your game data</div>
        </div>
      </div>
      <div className="landing-proof"><span>Know your distances</span><span>Plan every hole</span><span>Learn from every round</span></div>
    </div>
  );
  if (signupSent) return (
    <div className="auth-screen">
      <div className="auth-card">
        <span className="tag">MYCADDY</span>
        <h2>Account created.</h2>
        <p>Check your email and click the confirmation link to continue to onboarding.</p>
        <button className="primary-button" onClick={() => { setSignupSent(false); setAuthMode("signIn"); }}>Back to sign in</button>
        <p className="notice">Confirmation sent to {email}</p>
      </div>
    </div>
  );
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <button className="back-link" onClick={() => setMode("landing")}>← Back</button>
        <span className="tag">MYCADDY</span>
        <h2>{resetMode ? "Reset your password." : authMode === "signUp" ? "Create your account." : "Bring your game data with you."}</h2>
        <p>{resetMode ? "Enter your email and we’ll send you a secure reset link." : authMode === "signUp" ? "Use an email and password to sync your distances, rounds, and progress." : "Sign in to keep your distances, rounds, and progress synced across devices."}</p>
        <form onSubmit={resetMode ? sendResetEmail : authMode === "signUp" ? signUp : signIn}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {!resetMode && <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>}
          {authMode === "signUp" && <label>
            Confirm password
            <input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </label>}
          <button className="primary-button" disabled={busy}>
            {busy ? "Please wait..." : resetMode ? "Send reset link" : authMode === "signUp" ? "Create account" : "Sign in"}
          </button>
        </form>
        {!resetMode && <>
          {authMode === "signIn" && <button className="text-button" onClick={() => setAuthMode("signUp")} disabled={busy}>Need an account? Create one</button>}
          {authMode === "signUp" && <button className="text-button" onClick={() => setAuthMode("signIn")} disabled={busy}>Already have an account? Sign in</button>}
          {authMode === "signIn" && <button className="text-button" onClick={() => setResetMode(true)} disabled={busy}>Forgot password?</button>}
          <button className="guest-button" onClick={onGuest} disabled={busy}>Try without an account</button>
        </>}
        {resetMode && <button className="text-button" onClick={() => setResetMode(false)} disabled={busy}>Back to sign in</button>}
        {notice && <p className="notice">{notice}</p>}
      </div>
    </div>
  );
}

function PasswordRecovery({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (password.length < 6 || password !== confirmation) {
      setNotice(password.length < 6 ? "Use at least 6 characters." : "Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setNotice(error.message);
    else { setNotice("Password updated."); setTimeout(onComplete, 700); }
  };
  return <div className="auth-screen"><div className="auth-card">
    <span className="tag">MYCADDY</span><h2>Choose a new password.</h2>
    <p>Set a new password for your account.</p>
    <form onSubmit={updatePassword}>
      <label>New password<input type="password" minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label>Confirm password<input type="password" minLength={6} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
      <button className="primary-button" disabled={busy}>{busy ? "Updating..." : "Update password"}</button>
    </form>
    {notice && <p className="notice">{notice}</p>}
  </div></div>;
}

function Onboarding({
  data,
  updateData,
  finish,
}: {
  data: AppData;
  updateData: (change: (current: AppData) => AppData) => void;
  finish: () => void;
}) {
  const [step, setStep] = useState(0);
  const [handicap, setHandicap] = useState(String(currentHandicapIndex(data.handicapHistory) ?? ""));
  const [preferredTee, setPreferredTee] = useState(data.preferredTee || "white");
  const [practicePeriod, setPracticePeriod] = useState<"week" | "month">(data.practicePeriod || "week");
  const [knowsDistances, setKnowsDistances] = useState<boolean | null>(null);
  const [homeClub, setHomeClub] = useState(data.homeCourseName || "");
  const [customClub, setCustomClub] = useState("");
  const [distanceInputs, setDistanceInputs] = useState<Record<string, string>>({});
  const onboardingCourseId = homeClub.toLowerCase().replace(/\s+/g, "-");
  const teeOptions = getCourse(onboardingCourseId)?.tees.map((tee) => tee.id) || ["white"];
  const baseClubs = [...new Set([...CLUBS, "5W", "Putter", "2i", "3i", "4i"])] as ClubName[];
  const bag = data.bag || baseClubs;
  const onboardingClubOrder = ["Dr", "3W", "4W-Hybrid", "5W", "2i", "3i", "4i", "5i", "6i", "7i", "8i", "9i", "PW", "SW", "Putter"];
  const orderedBag = [...bag].sort((a, b) => {
    const ai = onboardingClubOrder.indexOf(a);
    const bi = onboardingClubOrder.indexOf(b);
    return (ai < 0 ? onboardingClubOrder.length : ai) - (bi < 0 ? onboardingClubOrder.length : bi);
  });
  useEffect(() => {
    const normalizedBag = [...new Set([...(data.bag || []), ...baseClubs])];
    if (!data.bag || normalizedBag.length !== data.bag.length) updateData((current) => ({ ...current, bag: normalizedBag }));
  }, []);
  const setFrequency = (key: "roundsPerWeek" | "practiceSessionsPerWeek", value: number) => updateData((current) => ({ ...current, practiceFrequency: { roundsPerWeek: current.practiceFrequency?.roundsPerWeek ?? 1, practiceSessionsPerWeek: current.practiceFrequency?.practiceSessionsPerWeek ?? 2, [key]: value } }));
  const saveHandicap = () => {
    const value = Number(handicap);
    if (Number.isFinite(value) && value >= 0 && value <= 54)
      updateData((current) => ({ ...current, handicapHistory: [...current.handicapHistory, { id: crypto.randomUUID(), date: localDateString(), index: value }] }));
  };
  const toggleClub = (club: ClubName) => updateData((current) => ({ ...current, bag: (current.bag || bag).includes(club) ? (current.bag || bag).filter((item) => item !== club) : [...(current.bag || bag), club] }));
  const next = () => {
    if (step === 0 && homeClub) updateData((current) => ({ ...current, homeCourseId: homeClub.toLowerCase().replace(/\s+/g, "-"), homeCourseName: homeClub }));
    if (step === 2) saveHandicap();
    if (step === 3) updateData((current) => ({ ...current, practicePeriod }));
    if (step === 4 && knowsDistances === true) return setStep(5);
    if (step === 4) return finish();
    if (step === 5) {
      updateData((current) => ({ ...current, readings: [...current.readings, ...Object.entries(distanceInputs).filter(([, value]) => /^\d+(\.\d+)?$/.test(value)).map(([club, value]) => ({ id: crypto.randomUUID(), club, distanceMetres: Math.round(Number(value)), mishit: false, playable: true, severeMiss: false, sessionDate: localDateString(), createdAt: new Date().toISOString() }))] }));
      return finish();
    }
    if (step === 1) updateData((current) => ({ ...current, preferredTee }));
    setStep((current) => current + 1);
  };
  const totalSteps = 5;
  return <div className="onboarding-screen">
    <div className="onboarding-top"><span className="tag">MYCADDY</span><span>{step + 1} / {totalSteps}</span></div>
    <div className="onboarding-progress"><i style={{ width: `${((step + 1) / totalSteps) * 100}%` }} /></div>
    {step === 0 && <div className="onboarding-step"><span className="eyebrow">FIRST, YOUR HOME BASE</span><h1>Where do you<br /><em>play most?</em></h1><p>Choose your home club, or skip this for now and add it later in Settings.</p><label className="search-field"><span>HOME CLUB</span><select className="club-select" value={homeClub} onChange={(event) => setHomeClub(event.target.value)}><option value="">Choose a Club</option><option value="Hermanus Golf Club">Hermanus Golf Club</option><option value="Arabella Golf Club">Arabella Golf Club</option><option value="Hartford Golf Club">Hartford Golf Club</option><option value="Zimbali Lakes">Zimbali Lakes</option><option value="Simbithi Country Club">Simbithi Country Club</option></select></label><button className="skip-link" onClick={() => { setHomeClub(""); updateData((current) => ({ ...current, homeCourseId: undefined, homeCourseName: undefined })); setStep(1); }}>Skip for now</button></div>}
    {step === 1 && <div className="onboarding-step"><span className="eyebrow">YOUR PREFERENCE</span><h1>Which tees do you<br /><em>usually play?</em></h1><p>We’ll use this for round setup and hole strategy.</p><div className="tee-choices">{teeOptions.map((tee) => <button key={tee} className={preferredTee === tee ? "selected" : ""} onClick={() => setPreferredTee(tee)}><span className={`tee-dot ${tee}`} />{tee[0].toUpperCase() + tee.slice(1)}{preferredTee === tee && <Check size={17} />}</button>)}</div></div>}
    {step === 2 && <div className="onboarding-step"><span className="eyebrow">YOUR STARTING POINT</span><h1>What’s your<br /><em>handicap index?</em></h1><p>This helps us put your practice and progress in context.</p><label className="big-input"><input autoFocus type="text" inputMode="decimal" pattern="[0-9.]*" value={handicap} onChange={(event) => setHandicap(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="16.5" /><span>INDEX</span></label><button className="skip-link" onClick={() => { setHandicap(""); setStep(3); }}>I don’t know it yet</button></div>}
    {step === 3 && <div className="onboarding-step"><span className="eyebrow">YOUR RHYTHM</span><h1>How do you want<br /><em>to play?</em></h1><p>Keep it realistic. MyCaddy works just as well for occasional golfers as it does for regulars.</p><div className="period-toggle"><button className={practicePeriod === "week" ? "selected" : ""} onClick={() => setPracticePeriod("week")}>Per week</button><button className={practicePeriod === "month" ? "selected" : ""} onClick={() => setPracticePeriod("month")}>Per month</button></div><div className="onboarding-card"><span>Rounds {practicePeriod === "week" ? "per week" : "per month"}</span><input className="onboarding-number" type="text" inputMode="numeric" pattern="[0-9]*" value={data.practiceFrequency?.roundsPerWeek ?? 1} onChange={(event) => setFrequency("roundsPerWeek", Math.max(0, Math.min(practicePeriod === "week" ? 7 : 20, Number(event.target.value.replace(/[^0-9]/g, "")) || 0)))} /></div><div className="onboarding-card"><span>Practice sessions {practicePeriod === "week" ? "per week" : "per month"}</span><input className="onboarding-number" type="text" inputMode="numeric" pattern="[0-9]*" value={data.practiceFrequency?.practiceSessionsPerWeek ?? 2} onChange={(event) => setFrequency("practiceSessionsPerWeek", Math.max(0, Math.min(practicePeriod === "week" ? 14 : 40, Number(event.target.value.replace(/[^0-9]/g, "")) || 0)))} /></div></div>}
    {step === 4 && <div className="onboarding-step"><span className="eyebrow">MAKE IT PERSONAL</span><h1>What’s in<br /><em>your bag?</em></h1><p>Start with the clubs you carry. Tap to remove or add individual clubs.</p><div className="onboarding-bag">{orderedBag.map((club) => <button key={club} className="selected" onClick={() => toggleClub(club)}>{clubDisplayLabel(club)}<Check size={14} /></button>)}</div><div className="add-club-row"><input value={customClub} placeholder="Add any club" onChange={(event) => setCustomClub(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const club = customClub.trim(); if (club) { updateData((current) => ({ ...current, bag: [...new Set([...(current.bag || []), club])] })); setCustomClub(""); } } }} /><button onClick={() => { const club = customClub.trim(); if (club) { updateData((current) => ({ ...current, bag: [...new Set([...(current.bag || []), club])] })); setCustomClub(""); } }}>Add club</button></div><div className="distance-question"><strong>Do you know your club distances?</strong><div><button className={knowsDistances === true ? "selected" : ""} onClick={() => { setKnowsDistances(true); updateData((current) => ({ ...current, preferredTee })); setStep(5); }}>Yes, let’s add them</button><button className={knowsDistances === false ? "selected" : ""} onClick={() => { setKnowsDistances(false); updateData((current) => ({ ...current, preferredTee })); finish(); }}>Not yet</button></div></div></div>}
    {step === 5 && <div className="onboarding-step distance-onboarding-step"><span className="unit-badge">METRES</span><span className="eyebrow">YOUR NUMBERS</span><h1>What does each<br /><em>club carry?</em></h1><p>Enter your typical carry in metres. You can fill in the rest later.</p><div className="distance-entry-list">{orderedBag.filter((club) => club !== "Putter").map((club) => <label key={club}><span>{clubDisplayLabel(club)}</span><input type="text" inputMode="decimal" pattern="[0-9.]*" placeholder="—" value={distanceInputs[club] || ""} onChange={(event) => setDistanceInputs((current) => ({ ...current, [club]: event.target.value.replace(/[^0-9.]/g, "") }))} /></label>)}</div></div>}
    <div className="onboarding-footer"><button className="primary-button" onClick={next}>{step === 5 ? "Save distances" : step === 4 && knowsDistances === true ? "Add distances" : step === 4 ? "Open my tracker" : "Continue"} <ChevronRight size={17} /></button>{step > 0 && <button className="back-link" onClick={() => setStep((current) => current - 1)}>Back</button>}</div>
  </div>;
}

function Today({
  data,
  currentHandicap,
  latestRound,
  recommendation: rec,
  go,
  startRound,
  updatePlan,
  togglePracticeSession,
  toggleRoundSession,
}: {
  data: AppData;
  currentHandicap?: number;
  latestRound?: AppData["rounds"][number];
  recommendation: ReturnType<typeof personalisedRecommendation>;
  go: (screen: Screen) => void;
  startRound: () => void;
  updatePlan: (
    key:
      | "practiceAComplete"
      | "practiceBComplete"
      | "practiceCComplete"
      | "roundComplete",
  ) => void;
  togglePracticeSession: (index: number) => void;
  toggleRoundSession: (index: number) => void;
}) {
  const practiceCount = data.practiceFrequency?.practiceSessionsPerWeek ?? 2;
  const week = [
    ...Array.from(
      { length: practiceCount },
      (_, index) =>
        data.weeklyPlan.practiceSessionsComplete?.[index] ??
        (index === 0
          ? data.weeklyPlan.practiceAComplete
          : index === 1
            ? data.weeklyPlan.practiceBComplete
            : index === 2
              ? data.weeklyPlan.practiceCComplete
              : false),
    ),
    ...Array.from(
      { length: data.practiceFrequency?.roundsPerWeek ?? 1 },
      (_, index) =>
        data.weeklyPlan.roundsComplete?.[index] ??
        (index === 0 ? data.weeklyPlan.roundComplete : false),
    ),
  ].filter(Boolean).length;
  const fallbackPractice = [
    [
      data.readings.length === 0 ? "Hit the range" : "Standard range session",
      data.readings.length === 0 ? "Record carry, playable and severe-miss outcomes." : "Record carry, playable and severe-miss outcomes.",
    ],
    ["Putting session", "Work on pace and first-putt distance control."],
    ["Short-game session", "Build touch around the green."],
    ["Approach distance session", "Calibrate your scoring irons."],
    ["Course-management session", "Play a round and record decisions."],
  ];
  const distinctPriorities = rec.priorities.filter((priority, index, priorities) =>
    priorities.findIndex((candidate) => candidate.phaseLabel === priority.phaseLabel) === index,
  );
  const priorityRotation = distinctPriorities.length ? (data.weeklyHistory?.length || 0) % distinctPriorities.length : 0;
  const weeklyPriorities = distinctPriorities.length
    ? [...distinctPriorities.slice(priorityRotation), ...distinctPriorities.slice(0, priorityRotation)]
    : distinctPriorities;
  const practiceFocus = Array.from({ length: practiceCount }, (_, index) => [
    `practiceSession:${index}`,
    weeklyPriorities[index]
      ? `${weeklyPriorities[index].drill} · ${weeklyPriorities[index].clubGroup}`
      :
      fallbackPractice[index % fallbackPractice.length][0],
    weeklyPriorities[index]
      ? `${weeklyPriorities[index].phaseLabel} · ${weeklyPriorities[index].evidence}`
      :
      fallbackPractice[index % fallbackPractice.length][1],
  ]);
  return (
    <div className="stack fade-in today-screen">
      <section className="intro">
        <span className="eyebrow">PRACTICE FOCUS</span>
        <h2>{rec.priorities[0]?.drill || rec.text}</h2>
        <p>{rec.evidence}</p>
      </section>
      <div className="quick-grid">
        <button onClick={() => go("distances")}>
          <Gauge />
          <span>View distances</span>
          <ChevronRight />
        </button>
        <button onClick={() => go("range")}>
          <Target />
          <span>Start range session</span>
          <ChevronRight />
        </button>
        <button onClick={startRound}>
          <CircleDot />
          <span>Start a round</span>
          <ChevronRight />
        </button>
      </div>
      <section className="metric-grid">
        <div className="metric">
          <span>Handicap index</span>
          <strong>{currentHandicap ?? "No data"}</strong>
        </div>
        <div className="metric">
          <span>Latest round</span>
          <strong>{latestRound?.totalScore ?? "No round"}</strong>
          {latestRound && <small className="round-length-tag">{latestRound.holes.filter((hole) => hole.score > 0).length || latestRound.holes.length} holes</small>}
        </div>
        <div className="metric">
          <span>This week</span>
          <strong>
            {week}{" "}
            <small>
              of{" "}
              {(data.practiceFrequency?.practiceSessionsPerWeek ?? 2) +
                (data.practiceFrequency?.roundsPerWeek ?? 1)}
            </small>
          </strong>
        </div>
      </section>
      <section className="panel feedback today-feedback">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LATEST FEEDBACK</span>
            <h3>{rec.text}</h3>
          </div>
          <Activity size={22} />
        </div>
        <p>
          {rec.evidence ||
            "Complete a nine-hole round with a quick note on each hole to unlock evidence-based feedback."}
        </p>
        {rec.priorities.length > 0 && (
          <div className="priority-list">
            {rec.priorities.slice(0, 3).map((priority) => (
              <div className="priority-item" key={priority.key}>
              <strong>{priority.drill}</strong>
              <small>{priority.clubGroup} · {priority.phaseLabel} · {priority.evidence}</small>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="panel weekly">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{data.practicePeriod === "month" ? "THIS MONTH" : "THIS WEEK"}</span>
            <h3>
              {week} of{" "}
              {(data.practiceFrequency?.practiceSessionsPerWeek ?? 2) +
                (data.practiceFrequency?.roundsPerWeek ?? 1)}{" "}
              completed
            </h3>
          </div>
          <History size={22} />
        </div>
        {[
          ...practiceFocus,
          ...Array.from(
            { length: data.practiceFrequency?.roundsPerWeek ?? 1 },
            (_, index) => [
              `roundSession:${index}`,
              `Round ${index + 1}`,
              "Play and reflect",
            ],
          ),
        ].map(([key, title, detail]) => (
          <label className="plan-item" key={key}>
            <input
              type="checkbox"
              checked={
                key.startsWith("practiceSession:")
                  ? Boolean(
                      data.weeklyPlan.practiceSessionsComplete?.[
                        Number(key.split(":")[1])
                      ],
                    )
                  : key.startsWith("roundSession:")
                    ? Boolean(
                        data.weeklyPlan.roundsComplete?.[
                          Number(key.split(":")[1])
                        ],
                      )
                    : Boolean(
                        data.weeklyPlan[key as keyof typeof data.weeklyPlan],
                      )
              }
              onChange={() =>
                key.startsWith("practiceSession:")
                  ? togglePracticeSession(Number(key.split(":")[1]))
                  : key.startsWith("roundSession:")
                    ? toggleRoundSession(Number(key.split(":")[1]))
                    : updatePlan(
                        key as
                          | "practiceAComplete"
                          | "practiceBComplete"
                          | "practiceCComplete"
                          | "roundComplete",
                      )
              }
            />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </label>
        ))}
      </section>
    </div>
  );
}

function Range({
  data,
  units,
  setUnits,
  selectedClub,
  setSelectedClub,
  distanceInput,
  setDistanceInput,
  distanceRef,
  addReading,
  playableInput,
  setPlayableInput,
  severeMissInput,
  setSevereMissInput,
}: {
  data: AppData;
  units: "metres" | "yards";
  setUnits: (units: "metres" | "yards") => void;
  selectedClub: ClubName;
  setSelectedClub: (club: ClubName) => void;
  distanceInput: string;
  setDistanceInput: (value: string) => void;
  distanceRef: React.RefObject<HTMLInputElement | null>;
  addReading: () => void;
  playableInput: boolean;
  setPlayableInput: (value: boolean) => void;
  severeMissInput: boolean;
  setSevereMissInput: (value: boolean) => void;
}) {
  const [clubPickerOpen, setClubPickerOpen] = useState(false);
  const summary = clubSummary(data.readings, selectedClub);
  const bag = data.bag?.length ? data.bag : DEFAULT_BAG;
  const rangeOrder = ["Dr", "3W", "5W", "4W-Hybrid", "2i", "3i", "4i", "5i", "6i", "7i", "8i", "9i", "PW", "SW"];
  const orderedBag = [...bag].filter((club) => club !== "Putter").sort((a, b) => {
    const ai = rangeOrder.indexOf(a);
    const bi = rangeOrder.indexOf(b);
    return (ai < 0 ? rangeOrder.length : ai) - (bi < 0 ? rangeOrder.length : bi);
  });
  return (
    <div className="stack fade-in range-screen">
      <section className="screen-lead">
        <span className="eyebrow">RANGE SESSION</span>
        <h2>Log the shot, keep moving.</h2>
      </section>
      <div className="unit-toggle">
        <button
          className={units === "metres" ? "selected" : ""}
          onClick={() => setUnits("metres")}
        >
          Metres
        </button>
        <button
          className={units === "yards" ? "selected" : ""}
          onClick={() => setUnits("yards")}
        >
          Yards
        </button>
      </div>
      <button
        className="club-picker-trigger"
        onClick={() => setClubPickerOpen(true)}
        aria-label="Choose club"
      >
        Club{" "}
        <strong>{selectedClub === "4W-Hybrid" ? "4H" : selectedClub}</strong>
        <span>▾</span>
      </button>
      {clubPickerOpen && (
        <div
          className="club-picker-backdrop"
          onClick={() => setClubPickerOpen(false)}
        >
          <section
            className="club-picker-sheet"
            role="dialog"
            aria-label="Choose club"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="section-heading">
              <h3>Choose club</h3>
              <button
                className="text-button"
                onClick={() => setClubPickerOpen(false)}
              >
                Done
              </button>
            </div>
            <div className="bag-picker-grid">
              {orderedBag.map((club) => (
                <button
                  key={club}
                  className={selectedClub === club ? "selected" : ""}
                  onClick={() => {
                    setSelectedClub(club);
                    setClubPickerOpen(false);
                    setTimeout(() => distanceRef.current?.focus(), 0);
                  }}
                >
                  {club === "4W-Hybrid" ? "4H" : club}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      <section className="entry-panel">
        <div className="selected-carry">
          <span>
            {selectedClub === "4W-Hybrid" ? "4H" : selectedClub} · typical carry
          </span>
          <strong>
            {summary.typical
              ? `${convertMetres(summary.typical, units)} ${units === "metres" ? "m" : "yd"}`
              : "No estimate"}
          </strong>
          <small>
            <>
              {summary.playablePercentage ?? 0}% playable ·{" "}
              {summary.severeMissPercentage ?? 0}% severe miss
            </>{" "}
            ·{" "}
            {summary.usableCount < 5
              ? "early estimate"
              : `${summary.usableCount} usable readings`}
          </small>
        </div>
        <div className="range-log-row">
          <label className="distance-label">Distance</label>
          <input
            ref={distanceRef}
            inputMode="decimal"
            value={distanceInput}
            onChange={(event) => setDistanceInput(event.target.value)}
            placeholder=""
            aria-label="Distance"
            onKeyDown={(event) => event.key === "Enter" && addReading()}
          />
          <button
            className={`range-toggle playable-toggle ${playableInput ? "yes" : "no"}`}
            aria-label={`Playable: ${playableInput ? "yes" : "no"}. Tap to change.`}
            onClick={() => setPlayableInput(!playableInput)}
          >
            {playableInput ? "Playable: Yes" : "Playable: No"}
          </button>
          <button
            className={`range-toggle severe-toggle ${severeMissInput ? "yes" : "no"}`}
            aria-label={`Severe miss: ${severeMissInput ? "yes" : "no"}. Tap to change.`}
            onClick={() => setSevereMissInput(!severeMissInput)}
          >
            {severeMissInput ? "Severe miss: Yes" : "Severe miss: No"}
          </button>
          <button className="primary-button" onClick={addReading}>
            <Plus size={18} />
            Save
          </button>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{selectedClub} READINGS</span>
            <h3>
              {summary.usableCount
                ? `${convertMetres(summary.min!, units)}–${convertMetres(summary.max!, units)} ${units === "metres" ? "m" : "yd"}`
                : "No readings yet"}
            </h3>
          </div>
          <span className="count-pill">
            {summary.playablePercentage ?? 0}% playable
          </span>
        </div>
        <div className="reading-list">
          {summary.readings.slice(0, 8).map((reading) => (
            <div className="reading" key={reading.id}>
              <span>
                {convertMetres(reading.distanceMetres, units)}{" "}
                {units === "metres" ? "m" : "yd"}{" "}
                {reading.playable === false && <em>not playable</em>}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Distances({
  readings,
  bag,
  units,
  setUnits,
}: {
  readings: AppData["readings"];
  bag?: ClubName[];
  units: "metres" | "yards";
  setUnits: (units: "metres" | "yards") => void;
}) {
  const [expandedClub, setExpandedClub] = useState<ClubName | null>(null);
  const distanceOrder = ["Dr", "3W", "5W", "4W-Hybrid", "2i", "3i", "4i", "5i", "6i", "7i", "8i", "9i", "PW", "AW", "GW", "SW", "Putter"];
  const clubs = [...(bag?.length ? bag : DEFAULT_BAG)].filter((club) => club !== "Putter").sort((a, b) => {
    const ai = distanceOrder.indexOf(a);
    const bi = distanceOrder.indexOf(b);
    return (ai < 0 ? distanceOrder.length : ai) - (bi < 0 ? distanceOrder.length : bi);
  });
  return (
    <div className="stack distances-screen fade-in">
      <div className="sticky-tools">
        <div>
          <span className="eyebrow">ON-COURSE QUICK REFERENCE</span>
          <h2>My distances</h2>
        </div>
        <div className="unit-toggle">
          <button
            className={units === "metres" ? "selected" : ""}
            onClick={() => setUnits("metres")}
          >
            m
          </button>
          <button
            className={units === "yards" ? "selected" : ""}
            onClick={() => setUnits("yards")}
          >
            yd
          </button>
        </div>
      </div>
      <div className="distance-legend">
        <span>✓ Playable</span>
        <span>⚠ Severe</span>
      </div>
      <div className="distance-board">
        {clubs.map((club) => {
          const summary = clubSummary(readings, club);
          return (
            <button
              className={`distance-card ${expandedClub === club ? "expanded" : ""}`}
              key={club}
              onClick={() =>
                setExpandedClub(expandedClub === club ? null : club)
              }
            >
              <strong>{clubDisplayLabel(club)}</strong>
              {summary.typical ? (
                <>
                  <b>
                    {convertMetres(summary.typical, units)}{" "}
                    <small>{units === "metres" ? "m" : "yd"}</small>
                  </b>
                  <span>
                    {convertMetres(summary.min!, units)}–
                    {convertMetres(summary.max!, units)}{" "}
                    {units === "metres" ? "m" : "yd"}
                  </span>
                  <span className="distance-reliability">
                    <span className="playable-mark">
                      ✓ {summary.playablePercentage ?? 0}%
                    </span>
                    <span
                      className={
                        (summary.severeMissPercentage || 0) > 0
                          ? "severe-mark warning"
                          : "severe-mark"
                      }
                    >
                      ⚠ {summary.severeMissPercentage ?? 0}%
                    </span>
                  </span>
                  {expandedClub === club && (
                    <small className="distance-detail">
                      {summary.usableCount} shots ·{" "}
                      {summary.playablePercentage ?? 0}% playable ·{" "}
                      {summary.severeMissPercentage ?? 0}% severe
                    </small>
                  )}
                </>
              ) : (
                <span className="empty">No readings yet</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniLineChart({ values }: { values: number[] }) {
  if (!values.length)
    return (
      <div className="chart-empty">Complete a round to see your trend.</div>
    );
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const points = values
    .map(
      (value, index) =>
        `${values.length === 1 ? 50 : (index / (values.length - 1)) * 100},${100 - ((value - min) / (max - min || 1)) * 80 - 10}`,
    )
    .join(" ");
  return (
    <svg
      className="mini-chart"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label="Round score trend"
    >
      <path className="chart-gridline" d="M0 25H100M0 50H100M0 75H100" />
      <polyline points={points} />
      <circle
        cx={points.split(" ").at(-1)?.split(",")[0]}
        cy={points.split(" ").at(-1)?.split(",")[1]}
        r="2.4"
      />
    </svg>
  );
}

function ClubFormPanel({ readings, rounds }: { readings: AppData["readings"]; rounds: AppData["rounds"] }) {
  const clubs = DISTANCE_CLUBS.filter((club) =>
    readings.some((reading) => reading.club === club),
  );
  const [selectedClub, setSelectedClub] = useState<ClubName>(clubs[0] || "7i");
  const club = clubs.includes(selectedClub) ? selectedClub : clubs[0];
  const clubReadings = club
    ? readings
        .filter((reading) => reading.club === club)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];
  const carryTrend = clubReadings.map(
    (_, index) =>
      clubReadings
        .slice(0, index + 1)
        .reduce((sum, reading) => sum + reading.distanceMetres, 0) /
      (index + 1),
  );
  const playableTrend = clubReadings.map(
    (_, index) =>
      (clubReadings
        .slice(0, index + 1)
        .filter((reading) => reading.playable !== false).length /
        (index + 1)) *
      100,
  );
  const severeMissTrend = clubReadings.map(
    (_, index) =>
      (clubReadings
        .slice(0, index + 1)
        .filter((reading) => reading.severeMiss === true).length /
        (index + 1)) *
      100,
  );
  const average = carryTrend.at(-1);
  const change = carryTrend.length > 1 ? average! - carryTrend[0] : undefined;
  const sortedRounds = rounds.slice().sort((a, b) => a.date.localeCompare(b.date));
  const issueNotes = (source: AppData["rounds"]) => source.flatMap((round) => round.holes.flatMap((hole) => (hole.shots || [])
    .filter((shot) => shot.club === club && (shot.outcome === "bad" || (shot.outcomes || []).some((outcome) => outcome.outcome === "bad")))
    .flatMap((shot) => shot.outcomes?.filter((outcome) => outcome.outcome === "bad").map((outcome) => outcome.note) || (shot.note ? [shot.note] : []))));
  const allIssueNotes = issueNotes(sortedRounds);
  const recentRoundCount = Math.ceil(sortedRounds.length / 2);
  const recentIssueNotes = issueNotes(sortedRounds.slice(-recentRoundCount));
  const previousIssueNotes = issueNotes(sortedRounds.slice(0, -recentRoundCount));
  const strongestIssue = [...new Set(allIssueNotes)].map((note) => ({ note, count: allIssueNotes.filter((item) => item === note).length, recent: recentIssueNotes.filter((item) => item === note).length, previous: previousIssueNotes.filter((item) => item === note).length })).sort((a, b) => b.count - a.count)[0];
  const issueDirection = strongestIssue ? strongestIssue.recent < strongestIssue.previous ? "Improving" : strongestIssue.recent > strongestIssue.previous ? "Getting worse" : "Stable" : undefined;
  return (
    <section className="panel club-form-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CLUB CONTROL</span>
          <h3>How your form is moving</h3>
        </div>
        <Gauge size={22} />
      </div>
      {clubs.length ? (
        <>
          <label className="insights-club-select">
            Club
            <select
              value={club}
              onChange={(event) => setSelectedClub(event.target.value)}
            >
              {clubs.map((item) => (
                <option key={item} value={item}>
                  {item === "4W-Hybrid" ? "4H" : item}
                </option>
              ))}
            </select>
          </label>
          <div className="club-health-heading">
            <strong>{clubDisplayLabel(club)}</strong>
            <small>{clubReadings.length} logged shots</small>
          </div>
          <div className="club-health">
            <div className="club-health-carry">
              <span>Carry</span>
              <div className="club-health-value">
                <strong>{Math.round(average!)}m</strong>
                <small>
                  {change === undefined
                    ? "—"
                    : `${change > 0 ? "+" : ""}${Math.round(change)}m change`}
                </small>
              </div>
              <MiniLineChart values={carryTrend} />
            </div>
            <div className="club-health-row">
              <span>Playable</span>
              <b>{Math.round(playableTrend.at(-1) || 0)}%</b>
              <i>
                <em style={{ width: `${playableTrend.at(-1) || 0}%` }} />
              </i>
            </div>
            <div className="club-health-row risk">
              <span>Severe miss</span>
              <b>{Math.round(severeMissTrend.at(-1) || 0)}%</b>
              <i>
                <em style={{ width: `${severeMissTrend.at(-1) || 0}%` }} />
              </i>
            </div>
          </div>
          <div className="club-round-evidence"><span className="eyebrow">AREA TO IMPROVE</span>{strongestIssue ? <><strong>{strongestIssue.count} {strongestIssue.note} on {clubDisplayLabel(club)}</strong><small>{issueDirection}</small></> : <small>No club-linked issues recorded for {clubDisplayLabel(club)} yet.</small>}</div>
          <p className="chart-caption">
            Range carry and reliability from logged shots.
          </p>
        </>
      ) : (
        <p>Log range shots to see your club form trend.</p>
      )}
    </section>
  );
}

export function LegacyClubFormPanel({
  readings,
}: {
  readings: AppData["readings"];
}) {
  const clubs = DISTANCE_CLUBS.filter((club) =>
    readings.some((reading) => reading.club === club),
  );
  const [selectedClub, setSelectedClub] = useState<ClubName>(clubs[0] || "7i");
  const club = clubs.includes(selectedClub) ? selectedClub : clubs[0];
  const points = club
    ? readings
        .filter((reading) => reading.club === club)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((reading) => reading.distanceMetres)
    : [];
  const recent = points.at(-1);
  const change = points.length > 1 ? recent! - points[0] : undefined;
  return (
    <section className="panel club-form-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CLUB CONTROL</span>
          <h3>How your form is moving</h3>
        </div>
        <Gauge size={22} />
      </div>
      {clubs.length ? (
        <>
          <div
            className="club-selector"
            role="tablist"
            aria-label="Select club"
          >
            {clubs.map((item) => (
              <button
                key={item}
                className={item === club ? "selected" : ""}
                onClick={() => setSelectedClub(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="club-trend-summary">
            <div>
              <span>Latest carry</span>
              <strong>{recent} m</strong>
            </div>
            <div>
              <span>Trend</span>
              <strong
                className={change !== undefined && change < 0 ? "down" : ""}
              >
                {change === undefined
                  ? "—"
                  : `${change > 0 ? "+" : ""}${change} m`}
              </strong>
            </div>
            <small>{points.length} shots · newest readings on the right</small>
          </div>
          <div className="club-trend-chart">
            <MiniLineChart values={points} />
          </div>
          <p className="chart-caption">
            Use the trend to see whether contact and carry are becoming more
            repeatable. Miss and playable rates live in My distances.
          </p>
        </>
      ) : (
        <p>Log range shots to see your club form trend.</p>
      )}
    </section>
  );
}

function Settings({
  data,
  updateData,
  signOut,
}: {
  data: AppData;
  updateData: (change: (current: AppData) => AppData) => void;
  signOut: () => void;
}) {
  const [handicapInput, setHandicapInput] = useState("");
  const [customClub, setCustomClub] = useState("");
  const [editingBag, setEditingBag] = useState(false);
  const [settingsEditor, setSettingsEditor] = useState<
    "course" | "tee" | "handicap" | null
  >(null);
  const bag = data.bag?.length ? data.bag : DEFAULT_BAG;
  const available = [...new Set([...CLUBS, "5W", "Putter", "2i", "3i", "4i"])];
  const bagOrder = ["Dr", "3W", "5W", "4W-Hybrid", "2i", "3i", "4i", "5i", "6i", "7i", "8i", "9i", "PW", "AW", "GW", "SW", "Putter"];
  const orderedBag = [...bag].sort((a, b) => {
    const ai = bagOrder.indexOf(a);
    const bi = bagOrder.indexOf(b);
    return (ai < 0 ? bagOrder.length : ai) - (bi < 0 ? bagOrder.length : bi);
  });
  const preferredTees = data.homeCourseId
    ? getCourse(data.homeCourseId)?.tees || []
    : ["yellow", "white", "blue", "red"].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), shortName: id[0].toUpperCase() + id.slice(1), colour: id }));
  const toggleClub = (club: string) =>
    updateData((current) => ({
      ...current,
      bag: (current.bag?.length ? current.bag : bag).includes(club)
        ? (current.bag?.length ? current.bag : bag).filter((item) => item !== club)
        : [...(current.bag?.length ? current.bag : bag), club],
    }));
  const updateFrequency = (
    key: "roundsPerWeek" | "practiceSessionsPerWeek",
    value: number,
  ) =>
    updateData((current) => ({
      ...current,
      practiceFrequency: {
        roundsPerWeek: current.practiceFrequency?.roundsPerWeek ?? 1,
        practiceSessionsPerWeek:
          current.practiceFrequency?.practiceSessionsPerWeek ?? 2,
        [key]: value,
      },
    }));
  const saveHandicap = () => {
    const index = Number(handicapInput);
    if (!Number.isFinite(index) || index < 0 || index > 54) return;
    updateData((current) => ({
      ...current,
      handicapHistory: [
        ...current.handicapHistory,
        {
          id: crypto.randomUUID(),
          date: localDateString(),
          index,
        },
      ],
    }));
    setHandicapInput("");
  };
  const addCustomClub = () => {
    const club = customClub.trim();
    if (!club || bag.includes(club)) return;
    updateData((current) => ({
      ...current,
      bag: [...(current.bag?.length ? current.bag : bag), club],
    }));
    setCustomClub("");
  };
  return (
    <div className="stack fade-in compact-settings">
      <section className="screen-lead compact-settings-heading">
        <span className="eyebrow">SETTINGS</span>
        <h2>Golf</h2>
      </section>
      <section className="settings-group">
        <span className="eyebrow">GOLF</span>
        <div className="panel settings-panel compact-preferences">
          <button
            className="settings-preference-row"
            onClick={() => setSettingsEditor("course")}
          >
            <span>Home course</span>
            <strong>{data.homeCourseName || "Not set"}</strong>
            <ChevronRight size={16} />
          </button>
          <button
            className="settings-preference-row"
            onClick={() => setSettingsEditor("tee")}
          >
            <span>Preferred tees</span>
            <strong>
              {data.preferredTee === "yellow"
                ? "Yellow"
                : data.preferredTee === "red"
                  ? "Red"
                  : "White"}
            </strong>
            <ChevronRight size={16} />
          </button>
          <button
            className="settings-preference-row"
            onClick={() => {
              setHandicapInput(
                String(currentHandicapIndex(data.handicapHistory) ?? ""),
              );
              setSettingsEditor("handicap");
            }}
          >
            <span>Handicap</span>
            <strong>{currentHandicapIndex(data.handicapHistory) ?? "No index"}</strong>
            <ChevronRight size={16} />
          </button>
        </div>
      </section>
      <section className="settings-group">
        <span className="eyebrow">{data.practicePeriod === "month" ? "MONTHLY PLAN" : "WEEKLY PLAN"}</span>
        <div className="panel settings-panel">
          <label className="settings-field">
            Rounds per {data.practicePeriod === "month" ? "month" : "week"}
            <span className="stepper">
              <button
                onClick={() =>
                  updateFrequency(
                    "roundsPerWeek",
                    Math.max(
                      0,
                      (data.practiceFrequency?.roundsPerWeek ?? 1) - 1,
                    ),
                  )
                }
              >
                −
              </button>
              <b>{data.practiceFrequency?.roundsPerWeek ?? 1}</b>
              <button
                onClick={() =>
                  updateFrequency(
                    "roundsPerWeek",
                    Math.min(
                      7,
                      (data.practiceFrequency?.roundsPerWeek ?? 1) + 1,
                    ),
                  )
                }
              >
                +
              </button>
            </span>
          </label>
          <label className="settings-field">
            Practice sessions per {data.practicePeriod === "month" ? "month" : "week"}
            <span className="stepper">
              <button
                onClick={() =>
                  updateFrequency(
                    "practiceSessionsPerWeek",
                    Math.max(
                      0,
                      (data.practiceFrequency?.practiceSessionsPerWeek ?? 2) -
                        1,
                    ),
                  )
                }
              >
                −
              </button>
              <b>{data.practiceFrequency?.practiceSessionsPerWeek ?? 2}</b>
              <button
                onClick={() =>
                  updateFrequency(
                    "practiceSessionsPerWeek",
                    Math.min(
                      14,
                      (data.practiceFrequency?.practiceSessionsPerWeek ?? 2) +
                        1,
                    ),
                  )
                }
              >
                +
              </button>
            </span>
          </label>
        </div>
      </section>
      <section className="settings-group">
        <span className="eyebrow">BAG</span>
        <div className="panel settings-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">GOLF BAG</span>
              <h3>Clubs you carry</h3>
            </div>
            <span className="count-pill">{bag.length} clubs</span>
          </div>
          <button
            className="settings-preference-row bag-edit-row"
            onClick={() => setEditingBag(!editingBag)}
          >
            <span>{editingBag ? "Done" : "Edit bag"}</span>
            <ChevronRight size={16} />
          </button>
          {!editingBag && (
            <p className="bag-summary">
              {orderedBag.map(clubDisplayLabel).join(" · ")}
            </p>
          )}
          {editingBag && (
            <div className="bag-grid">
              {available.map((club) => (
                <button
                  type="button"
                  key={club}
                  className={bag.includes(club) ? "selected" : ""}
                  onClick={() => toggleClub(club)}
                >
                  {club}
                </button>
              ))}
            </div>
          )}
          {editingBag && (
            <div className="settings-inline">
              <input
                value={customClub}
                placeholder="Add a club"
                onChange={(event) => setCustomClub(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addCustomClub()}
              />
              <button className="primary-button" onClick={addCustomClub}>
                Add club
              </button>
            </div>
          )}
        </div>
      </section>
      {supabase && (
        <section className="settings-group account-settings">
          <span className="eyebrow">ACCOUNT</span>
          <div className="panel settings-panel">
            <button className="signout-button" onClick={signOut}>Sign out</button>
            <p className="settings-help">Your account data is synced securely to Supabase.</p>
          </div>
        </section>
      )}
      {settingsEditor && (
        <div
          className="settings-sheet-overlay"
          onClick={() => setSettingsEditor(null)}
        >
          <div
            className="settings-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            {settingsEditor === "course" && (
              <>
                <h3>Home course</h3>
                <button
                  onClick={() => {
                    updateData((current) => ({
                      ...current,
                      homeCourseId: "hermanus-golf-club",
                      homeCourseName: "Hermanus Golf Club",
                    }));
                    setSettingsEditor(null);
                  }}
                >
                  Hermanus Golf Club
                </button>
                <button
                  onClick={() => {
                    updateData((current) => ({
                      ...current,
                      homeCourseId: "arabella-golf-club",
                      homeCourseName: "Arabella Golf Club",
                    }));
                    setSettingsEditor(null);
                  }}
                >
                  Arabella Golf Club
                </button>
                <button
                  onClick={() => {
                    updateData((current) => ({ ...current, homeCourseId: "hartford-golf-club", homeCourseName: "Hartford Golf Club" }));
                    setSettingsEditor(null);
                  }}
                >
                  Hartford Golf Club
                </button>
                {(["Zimbali Lakes", "Simbithi Country Club"] as const).map((courseName) => (
                  <button key={courseName} onClick={() => {
                    updateData((current) => ({ ...current, homeCourseId: courseName === "Zimbali Lakes" ? "zimbali-lakes" : "simbithi-country-club", homeCourseName: courseName }));
                    setSettingsEditor(null);
                  }}>{courseName}</button>
                ))}
              </>
            )}
            {settingsEditor === "tee" && (
              <>
                <h3>Preferred tees</h3>
                <div className="tee-choices settings-tee-choices">
                  {preferredTees.map((tee) => (
                    <button
                      key={tee.id}
                      className={data.preferredTee === tee.id ? "selected" : ""}
                      onClick={() => {
                        updateData((current) => ({ ...current, preferredTee: tee.id }));
                        setSettingsEditor(null);
                      }}
                    >
                      <span className={`tee-dot ${tee.colour || tee.id}`} />
                      {tee.name}
                      {data.preferredTee === tee.id && <Check size={17} />}
                    </button>
                  ))}
                </div>
              </>
            )}
            {settingsEditor === "handicap" && (
              <>
                <h3>Handicap index</h3>
                <input
                  type="number"
                  min="0"
                  max="54"
                  step="0.1"
                  value={handicapInput}
                  onChange={(event) => setHandicapInput(event.target.value)}
                />
                <div>
                  <button onClick={() => setSettingsEditor(null)}>
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => {
                      saveHandicap();
                      setSettingsEditor(null);
                    }}
                  >
                    Save
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function roundScoreToPar(round: AppData["rounds"][number]) {
  return (
    (round.totalScore || roundTotal(round)) -
    round.holes.reduce((sum, hole) => sum + holePar(hole.holeNumber, round.courseId), 0)
  );
}

function formatScoreToPar(value: number) {
  return value === 0 ? "E" : `${value > 0 ? "+" : ""}${value}`;
}

function Progress({
  data,
  recommendation: rec,
  updatePlan,
  focusRoundId,
  latestHandicap,
  updateRound,
}: {
  data: AppData;
  recommendation: ReturnType<typeof personalisedRecommendation>;
  updatePlan: (
    key:
      | "practiceAComplete"
      | "practiceBComplete"
      | "practiceCComplete"
      | "roundComplete",
  ) => void;
  focusRoundId?: string | null;
  updateRound: (round: AppData["rounds"][number]) => void;
  latestHandicap?: number;
}) {
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(focusRoundId || null);
  const [expandedBreakdownId, setExpandedBreakdownId] = useState<string | null>(null);
  const [insightsTab, setInsightsTab] = useState<
    "overview" | "clubs" | "rounds"
  >("overview");
  const archived = data.rounds
    .filter((round) => round.status === "archived")
    .sort((a, b) => a.date.localeCompare(b.date));
  const recent = archived.slice(-6);
  const learningInsights = shotLearningInsights(archived);
  const completed = [
    data.weeklyPlan.practiceAComplete,
    data.weeklyPlan.practiceBComplete,
    ...((data.practiceFrequency?.practiceSessionsPerWeek ?? 2) >= 3
      ? [data.weeklyPlan.practiceCComplete]
      : []),
    data.weeklyPlan.roundComplete,
  ].filter(Boolean).length;
  const scores = recent.map((round) => {
    const playedHoles = round.holes.filter((hole) => hole.score > 0).length || round.holes.length;
    const score = round.totalScore || roundTotal(round);
    const par = round.holes.reduce((sum, hole) => sum + holePar(hole.holeNumber, round.courseId), 0);
    return playedHoles ? score - par : 0;
  });
  const recentCategoryStats = recentCategoryTroubleStats(data.rounds, holePar);
  const clubStats = DISTANCE_CLUBS.map((club) => {
    const readings = data.readings.filter((reading) => reading.club === club);
    const usable = readings.filter((reading) => !reading.severeMiss);
    const distances = usable.map((reading) => reading.distanceMetres);
    const average = distances.length
      ? distances.reduce((sum, value) => sum + value, 0) / distances.length
      : 0;
    const dispersion = distances.length
      ? Math.max(...distances) - Math.min(...distances)
      : 0;
    return {
      club,
      count: readings.length,
      average,
      dispersion,
      playable: readings.length
        ? Math.round(
            (readings.filter((reading) => reading.playable !== false).length /
              readings.length) *
              100,
          )
        : 0,
      severe: readings.length
        ? Math.round(
            (readings.filter((reading) => reading.severeMiss === true).length /
              readings.length) *
              100,
          )
        : 0,
    };
  }).filter((item) => item.count);
  const maxDispersion = Math.max(
    ...clubStats.map((item) => item.dispersion),
    1,
  );
  const handicapValues = data.handicapHistory
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8)
    .map((item) => item.index);
  const latest = scores.at(-1);
  const latestRound = recent.at(-1);
  const latestScore = latestRound ? latestRound.totalScore || roundTotal(latestRound) : undefined;
  const latestHoles = latestRound ? latestRound.holes.filter((hole) => hole.score > 0).length || latestRound.holes.length : 0;
  const latestPar = latestRound ? latestRound.holes.reduce((sum, hole) => sum + holePar(hole.holeNumber, latestRound.courseId), 0) : 0;
  const previous = scores.length > 1 ? scores.at(-2) : undefined;
  const previousRound = recent.length > 1 ? recent.at(-2) : undefined;
  const comparableScore = (score: number, round: AppData["rounds"][number], otherRound: AppData["rounds"][number]) => {
    const holes = round.holes.filter((hole) => hole.score > 0).length || round.holes.length;
    const otherHoles = otherRound.holes.filter((hole) => hole.score > 0).length || otherRound.holes.length;
    return holes !== otherHoles && holes ? (score / holes) * 18 : score;
  };
  const scoreDelta =
    latest !== undefined && previous !== undefined && latestRound && previousRound
      ? comparableScore(latest, latestRound, previousRound) - comparableScore(previous, previousRound, latestRound)
      : undefined;
  const selectedRound = selectedRoundId
    ? archived.find((round) => round.id === selectedRoundId)
    : undefined;
  if (selectedRound)
    return (
      <RoundDetail
        round={selectedRound}
        onBack={() => setSelectedRoundId(null)}
        onSave={updateRound}
        latestHandicap={latestHandicap}
      />
    );
  return (
    <div className={`stack fade-in insights-screen insights-${insightsTab}`}>
      <div
        className="insights-tabs"
        role="tablist"
        aria-label="Insights sections"
      >
        <button
          className={insightsTab === "overview" ? "selected" : ""}
          onClick={() => setInsightsTab("overview")}
        >
          Overview
        </button>
        <button
          className={insightsTab === "clubs" ? "selected" : ""}
          onClick={() => setInsightsTab("clubs")}
        >
          Clubs
        </button>
        <button
          className={insightsTab === "rounds" ? "selected" : ""}
          onClick={() => setInsightsTab("rounds")}
        >
          Rounds
        </button>
      </div>
      <section className="analytics-hero">
        <div>
          <span className="eyebrow">ROUND TREND</span>
          <strong>{latestScore !== undefined ? latestScore : "—"}</strong>
          {latestRound ? <span>{formatScoreToPar(latestScore! - latestPar)} · {latestHoles} holes</span> : <span>No rounds logged</span>}
        </div>
        <div className="hero-chart">
          <MiniLineChart values={scores} />
        </div>
        <div className="analytics-hero-compare">
          <span className="eyebrow">CHANGE</span>
          <strong>{scoreDelta === undefined ? "—" : `${scoreDelta > 0 ? "+" : ""}${Math.round(scoreDelta)}`}</strong>
          <span>{scoreDelta === undefined ? "First round" : "vs previous round"}</span>
        </div>
      </section>
      <section className="panel handicap-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HANDICAP INDEX</span>
            <h3>{currentHandicapIndex(data.handicapHistory) ?? "—"} current index</h3>
          </div>
          <span className="count-pill">{handicapValues.length} updates</span>
        </div>
        <MiniLineChart values={handicapValues} />
      </section>
      <ClubFormPanel readings={data.readings} rounds={archived} />
      <section className="legacy-club-control panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CLUB CONTROL</span>
            <h3>Distance & dispersion</h3>
          </div>
          <Gauge size={22} />
        </div>
        {clubStats.length ? (
          <div className="club-analytics">
            {clubStats.map((item) => (
              <div className="club-analytics-row" key={item.club}>
                <div className="club-label">
                  <strong>{item.club}</strong>
                  <small>
                    {Math.round(item.average)} m avg · {item.dispersion} m
                    spread
                  </small>
                </div>
                <div className="club-stat">
                  <span>
                    Playable <b>{item.playable}%</b>
                  </span>
                  <i>
                    <em style={{ width: `${item.playable}%` }} />
                  </i>
                </div>
                <div className="club-stat">
                  <span>
                    Severe miss <b>{item.severe}%</b>
                  </span>
                  <i className="risk">
                    <em style={{ width: `${item.severe || 2}%` }} />
                  </i>
                </div>
                <div className="dispersion-track">
                  <span
                    style={{
                      width: `${(item.dispersion / maxDispersion) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>Log range shots to see carry, dispersion, and playable rates.</p>
        )}
      </section>
      <section className="panel round-breakdown-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ROUND BREAKDOWN</span>
            <h3>Issues in your recent rounds</h3>
          </div>
        </div>
        <div className="round-breakdown-table">
          <div className="round-breakdown-row round-breakdown-header"><span>Score</span><span>Date</span><span>Tee</span><span>App</span><span>Short</span><span>Put</span></div>
          {recent.slice().reverse().map((round) => {
            const holesPlayed = round.holes.filter((hole) => hole.score > 0).length || round.holes.length;
            const troubleCounts = roundTroubleByCategory(round);
            const troubleDetails = roundTroubleDetailsByCategory(round);
            const detail = (category: keyof typeof troubleDetails) => troubleDetails[category].length ? troubleDetails[category].map((item) => `H${item.holeNumber}: ${item.detail}`).join(" · ") : "—";
            return <Fragment key={round.id}><button type="button" className="round-breakdown-row" onClick={() => setExpandedBreakdownId(expandedBreakdownId === round.id ? null : round.id)}><span>{formatScoreToPar(roundScoreToPar(round))}</span><span className="round-breakdown-date">{formatShortDate(round.date)}</span><span>{troubleCounts["Tee shot"]}/{holesPlayed}</span><span>{troubleCounts.Approach}/{holesPlayed}</span><span>{troubleCounts["Short game"]}/{holesPlayed}</span><span>{troubleCounts.Putting}/{holesPlayed}</span></button>{expandedBreakdownId === round.id && <div className="round-breakdown-detail"><div><strong>Tee</strong><span>{detail("Tee shot")}</span></div><div><strong>Approach</strong><span>{detail("Approach")}</span></div><div><strong>Short game</strong><span>{detail("Short game")}</span></div><div><strong>Putting</strong><span>{detail("Putting")}</span></div></div>}</Fragment>;
          })}
        </div>
      </section>
      {learningInsights.length > 0 && (
        <section className="panel round-learning-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LEARNED FROM YOUR ROUNDS</span>
              <h3>Patterns worth keeping</h3>
            </div>
          </div>
          <div className="round-learning-list">
            {learningInsights.map((insight) => (
              <div key={insight.key}>
                <strong>{insight.text}</strong>
                <small>{insight.evidence}</small>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="panel insights-form-map">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FORM MAP</span>
            <h3>Where shots cost you</h3>
          </div>
          <Target size={22} />
        </div>
        <div className="form-list">
          {recentCategoryStats.map((item) => (
              <div className={`form-row ${item.observationCount ? "has-data" : "no-data"}`} key={item.category}>
              <div>
                <strong>{item.category}</strong>
                <small>
                  {!item.observationCount ? "No data yet" : `${Math.round(item.troubleRate)}% trouble rate · ${item.averageWhenItHappens > 0 ? "+" : ""}${item.averageWhenItHappens.toFixed(1)} avg when it happens`}
                </small>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel weekly progress-weekly insights-weekly">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THIS WEEK</span>
            <h3>
              {completed} of{" "}
              {(data.practiceFrequency?.practiceSessionsPerWeek ?? 2) +
                (data.practiceFrequency?.roundsPerWeek ?? 1)}{" "}
              completed
            </h3>
          </div>
          <History size={22} />
        </div>
        {[
          [
            "practiceAComplete",
            rec.priorities[0]?.drill || "Play a round",
            rec.priorities[0]?.evidence ||
              "Record specific clubs and outcomes so your caddie can find your priorities",
          ],
          [
            "practiceBComplete",
            rec.priorities[1]?.drill || "Record distances at the range",
            rec.priorities[1]?.evidence ||
              "Build reliable club distances for better on-course decisions",
          ],
          ...((data.practiceFrequency?.practiceSessionsPerWeek ?? 2) >= 3
            ? [
                [
                  "practiceCComplete",
                  rec.priorities[2]?.drill || "Choose another focus",
                  rec.priorities[2]?.evidence ||
                    "Use your next practice session to reinforce the next priority",
                ],
              ]
            : []),
          ["roundComplete", "Round complete", "Play and reflect"],
        ].map(([key, title, detail]) => (
          <label className="plan-item" key={key}>
            <input
              type="checkbox"
              checked={
                data.weeklyPlan[key as keyof typeof data.weeklyPlan] as boolean
              }
              onChange={() =>
                updatePlan(
                  key as
                    | "practiceAComplete"
                    | "practiceBComplete"
                    | "practiceCComplete"
                    | "roundComplete",
                )
              }
            />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </label>
        ))}
      </section>
      <section className="panel insights-history">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ROUND JOURNAL</span>
            <h3>{archived.length} archived rounds</h3>
          </div>
          <Archive size={22} />
        </div>
        {archived.length ? (
          archived
            .slice()
            .reverse()
            .map((round) => (
              <div
                className={`journal-row round-row ${selectedRoundId === round.id ? "selected" : ""}`}
                key={round.id}
                onClick={() =>
                  setSelectedRoundId(
                    selectedRoundId === round.id ? null : round.id,
                  )
                }
                role="button"
                tabIndex={0}
                onKeyDown={(event) =>
                  event.key === "Enter" &&
                  setSelectedRoundId(
                    selectedRoundId === round.id ? null : round.id,
                  )
                }
              >
                <div>
                  <strong>{formatDate(round.date)}</strong>
                  <span>{round.courseName || "Local round"}</span>
                  <small className="round-length-tag">{round.holes.filter((hole) => hole.score > 0).length || round.holes.length} holes</small>
                </div>
                <div className="round-score-summary">
                  <b>{round.totalScore || roundTotal(round)}</b>
                  <small
                    className={
                      roundScoreToPar(round) < 0
                        ? "under"
                        : roundScoreToPar(round) > 0
                          ? "over"
                          : "even"
                    }
                  >
                    {formatScoreToPar(roundScoreToPar(round))}
                  </small>
                </div>
              </div>
            ))
        ) : (
          <p>No archived rounds yet.</p>
        )}
        {selectedRoundId &&
          data.rounds.find((round) => round.id === selectedRoundId) && (
            <ArchivedScorecard
              round={data.rounds.find((round) => round.id === selectedRoundId)!}
            />
          )}
      </section>
    </div>
  );
}

function RoundDetail({
  round,
  onBack,
  onSave,
  latestHandicap,
}: {
  round: AppData["rounds"][number];
  onBack: () => void;
  onSave: (round: AppData["rounds"][number]) => void;
  latestHandicap?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [scores, setScores] = useState(() => round.holes.map((hole) => hole.score));
  const [handicap, setHandicap] = useState<number | "">(roundHandicapIndex(latestHandicap, round.handicapIndex) ?? "");
  const score = round.totalScore || roundTotal(round);
  const par = round.holes.reduce(
    (total, hole) => total + holePar(hole.holeNumber, round.courseId),
    0,
  );
  const issues = round.holes.flatMap((hole) =>
    (hole.tags || [])
      .filter((tag) => tag.type === "went-wrong")
      .map((tag) => tag.outcome),
  );
  return (
    <div className="stack fade-in round-detail-screen">
      <button className="text-button" onClick={onBack}>
        ← Back to Insights
      </button>
      <section className="screen-lead">
        <span className="eyebrow">ROUND DETAILS</span>
        <h2>{round.courseName}</h2>
        <p>
          {formatDate(round.date)} ·{" "}
          {round.courseId === "hermanus-golf-club" && round.loop ? loopLabel(round.loop) : `${round.holes.length} holes`}
        </p>
      </section>
      <section className="detail-score">
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div>
          <span>Score to par</span>
          <strong>
            {par ? `${score - par > 0 ? "+" : ""}${score - par}` : "—"}
          </strong>
        </div>
        <div>
          <span>Handicap</span>
          <strong>{round.handicapIndex ?? latestHandicap ?? "—"}</strong>
        </div>
      </section>
      <button className={editing ? "edit-save-button" : "text-button"} onClick={() => {
        if (editing) {
          const holes = round.holes.map((hole, index) => ({ ...hole, score: Math.max(1, Number(scores[index]) || holePar(hole.holeNumber, round.courseId)) }));
          const edited = { ...round, holes, handicapIndex: handicap === "" ? undefined : Number(handicap), status: "archived" as const };
          onSave({ ...edited, totalScore: roundTotal(edited) });
        }
        setEditing(!editing);
      }}>{editing ? "Save edits" : "Edit Round"}</button>
      {editing && <div className="panel round-edit-panel"><strong className="round-edit-heading">Tap a score to edit it inline</strong><label className="edit-handicap-field">Handicap index<input type="number" step="0.1" value={handicap} onChange={(event) => setHandicap(event.target.value === "" ? "" : Number(event.target.value))} /></label></div>}
      {issues.length > 0 && (
        <section className="panel">
          <span className="eyebrow">ROUND FEEDBACK</span>
          <h3>Main leaks</h3>
          <p>{Array.from(new Set(issues)).join(" · ")}</p>
        </section>
      )}
      <ArchivedScorecard round={round} editingHole={editing ? selectedHole : null} onScoreChange={(holeNumber, value) => setScores((current) => current.map((score, index) => round.holes[index]?.holeNumber === holeNumber ? value : score))} onHoleTap={(holeNumber) => { setSelectedHole(holeNumber); setEditing(true); }} />
    </div>
  );
}

function ArchivedScorecard({ round, onHoleTap, editingHole, onScoreChange }: { round: AppData["rounds"][number]; onHoleTap?: (holeNumber: number) => void; editingHole?: number | null; onScoreChange?: (holeNumber: number, score: number) => void }) {
  const orderedHoles = [...round.holes].sort(
    (a, b) => a.holeNumber - b.holeNumber,
  );
  return (
    <section className="scorecard">
      <div className="scorecard-heading">
        <div>
          <span className="eyebrow">SCORECARD</span>
          <h3>
            {round.courseId === "hermanus-golf-club" ? `${loopLabel(round.loop || "east")} · ` : ""}{round.tee || "white"} tees
          </h3>
        </div>
        <strong>{round.totalScore || roundTotal(round)}</strong>
      </div>
      <div className="scorecard-table">
        <div className="scorecard-row scorecard-label">
          <span>Hole</span>
          <span>Par</span>
          <span>Score</span>
          <span>Feedback</span>
        </div>
        {orderedHoles.map((hole) => {
          const right = [
            ...(hole.tags || [])
              .filter((tag) => tag.type === "went-right")
              .map((tag) => tag.outcome),
            hole.wentRight,
          ].filter(Boolean);
          const wrong = [
            ...(hole.tags || [])
              .filter((tag) => tag.type === "went-wrong")
              .map((tag) => tag.outcome),
            hole.wentWrong,
          ].filter(Boolean);
          const shotFeedback = (hole.shots || [])
            .filter((shot) => shot.outcome)
            .map(
              (shot) =>
                `${shot.phase === "short-game" ? "Short game" : shot.phase[0].toUpperCase() + shot.phase.slice(1)}: ${shot.club} (${shot.outcome === "good" ? "went well" : "needs work"})`,
            );
              const relative = hole.score - holePar(hole.holeNumber, round.courseId);
          const scoreClass = relative <= -2 ? "eagle" : relative === -1 ? "birdie" : relative === 0 ? "even" : relative === 1 ? "bogey" : "double-bogey";
          return (
            <div className="scorecard-row" key={hole.holeNumber} role={onHoleTap ? "button" : undefined} tabIndex={onHoleTap ? 0 : undefined} onClick={() => onHoleTap?.(hole.holeNumber)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onHoleTap?.(hole.holeNumber); }}>
              <span className="scorecard-hole">{hole.holeNumber}</span>
              <span>{holePar(hole.holeNumber, round.courseId)}</span>
              <strong className={`scorecard-score ${scoreClass}`} title={relative < 0 ? (relative === -1 ? "Birdie" : "Eagle or better") : relative > 0 ? (relative === 1 ? "Bogey" : "Double bogey or worse") : "Par"}>
                {editingHole === hole.holeNumber ? <input className="inline-score-input" type="number" min="1" max="15" value={hole.score} onChange={(event) => onScoreChange?.(hole.holeNumber, Number(event.target.value))} onClick={(event) => event.stopPropagation()} /> : <span>{hole.score}</span>}
              </strong>
              <div className="scorecard-feedback">
                {right.length > 0 && (
                  <small className="right">
                    ✓ {Array.from(new Set(right)).join(", ")}
                  </small>
                )}
                {wrong.length > 0 && (
                  <small className="wrong">
                    × {Array.from(new Set(wrong)).join(", ")}
                  </small>
                )}
                {shotFeedback.map((item) => (
                  <small
                    key={item}
                    className={item.includes("needs work") ? "wrong" : "right"}
                  >
                    • {item}
                  </small>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RoundSetup({
  draft,
  setDraft,
  startRound,
  exitRound,
}: {
  draft: AppData["rounds"][number];
  setDraft: (round: AppData["rounds"][number]) => void;
  startRound: () => void;
  exitRound: () => void;
}) {
  const loop = draft.loop || "east";
  const length = draft.roundLength || 9;
  const selectedCourse = getCourse(draft.courseId || "hermanus-golf-club");
  const update = (patch: Partial<typeof draft>) =>
    setDraft({ ...draft, ...patch });
  return (
    <div className="stack fade-in round-screen round-setup-screen">
      <div className="round-actions">
        <button type="button" className="text-button" onClick={exitRound}>
          ← Home
        </button>
      </div>
      <section className="round-setup round-setup-primary">
        <span className="eyebrow">ROUND SETUP</span>
        <h2>Set up your round</h2>
        <p className="muted">
          Choose the course, tees and number of holes before you start.
        </p>
        <label>
          Course
          <select
            value={draft.courseName}
            onChange={(event) => {
              const courseName = event.target.value;
              update({
                courseName,
                courseId: courseName === "Arabella Golf Club" ? "arabella-golf-club" : courseName === "Hartford Golf Club" ? "hartford-golf-club" : courseName === "Zimbali Lakes" ? "zimbali-lakes" : courseName === "Simbithi Country Club" ? "simbithi-country-club" : "hermanus-golf-club",
                tee: courseName === "Simbithi Country Club" ? "blue" : "white",
                roundLength: courseName === "Hartford Golf Club" ? 9 : draft.roundLength,
              });
            }}
          >
            <option>Hermanus Golf Club</option>
            <option>Arabella Golf Club</option>
            <option>Hartford Golf Club</option>
            <option>Zimbali Lakes</option>
            <option>Simbithi Country Club</option>
          </select>
        </label>
        <div className="setup-grid">
          <label>
            Holes
            <select
              value={length}
              onChange={(event) =>
                update({
                  roundLength: Number(event.target.value) as 9 | 18 | 27,
                })
              }
            >
              {[9, 18, 27].filter((count) => count <= (selectedCourse?.holes.length || 18)).map((count) => (
                <option key={count} value={count}>
                  {count} holes
                </option>
              ))}
            </select>
          </label>
          <label>
            Tees
            <select
              value={draft.tee || selectedCourse?.tees[0]?.id || "white"}
              onChange={(event) =>
                update({
                  tee: event.target.value as "white" | "yellow" | "red",
                })
              }
            >
              {(selectedCourse?.tees || []).map((tee) => <option key={tee.id} value={tee.id}>{tee.name} tees</option>)}
            </select>
          </label>
        </div>
        {selectedCourse?.loops && <label>
          Starting loop
          <select
            value={loop}
            onChange={(event) => update({ loop: event.target.value as typeof loop })}
          >
            {(["east", "north", "south"] as const).map((item) => (
              <option key={item} value={item}>{loopLabel(item, length as 9 | 18 | 27)}</option>
            ))}
          </select>
        </label>}
        <button
          className="primary-button start-round-button"
          onClick={startRound}
        >
          {draft.holes.some((hole) => hole.score > 0) ? "Resume round →" : "Start round →"}
        </button>
        <button
          type="button"
          className="text-button exit-round-button"
          onClick={exitRound}
        >
          Exit round
        </button>
      </section>
    </div>
  );
}

function RoundMode({
  readings,
  rounds,
  bag,
  draft,
  setDraft,
  notice,
  startRound,
  saveHole,
  archiveRound,
  exitRound,
  setupOpen,
  setSetupOpen,
  hasStarted,
  setHasStarted,
  weather,
}: {
  readings: AppData["readings"];
  rounds: AppData["rounds"];
  bag?: ClubName[];
  draft: AppData["rounds"][number] | null;
  setDraft: (round: AppData["rounds"][number]) => void;
  notice: string;
  setNotice: (notice: string) => void;
  startRound: () => void;
  saveHole: (hole?: RoundHole) => AppData["rounds"][number] | null;
  archiveRound: (round?: AppData["rounds"][number] | null) => void;
  exitRound: () => void;
  setupOpen: boolean;
  setSetupOpen: (open: boolean) => void;
  hasStarted: boolean;
  setHasStarted: (started: boolean) => void;
  weather?: WeatherContext;
}) {
  const [activeHole, setActiveHole] = useState(0);
  const holeStripRef = useRef<HTMLDivElement | null>(null);
  const holeButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [nextShotStatus, setNextShotStatus] = useState("");
  const [teePositionStatus, setTeePositionStatus] = useState("");
  const [showAdaptiveWhy, setShowAdaptiveWhy] = useState(false);
  const latestPosition = useRef<Awaited<ReturnType<typeof getCurrentPosition>> | null>(null);
  useEffect(() => {
    const stop = watchPosition((position) => { latestPosition.current = position; });
    return stop;
  }, []);
  useEffect(() => {
    if (draft) setActiveHole(Math.max(0, draft.currentHoleIndex || 0));
  }, [draft?.id]);
  useEffect(() => {
    if (!draft) return;
    const sequence = draft.courseId === "hermanus-golf-club"
      ? HERMANUS_LOOPS[draft.loop || "east"].slice(0, draft.roundLength || 9)
      : (getCourse(draft.courseId || "hermanus-golf-club")?.holes.map((hole) => hole.number) || []).slice(0, draft.roundLength || 9);
    holeButtonRefs.current[sequence[Math.min(activeHole, sequence.length - 1)]]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeHole, draft?.loop, draft?.roundLength]);
  if (!draft)
    return (
      <div className="empty-state fade-in">
        <CircleDot size={34} />
        <h2>Start a round</h2>
        <p>Choose your course, tees and holes to get started.</p>
        <button className="primary-button" onClick={startRound}>
          Continue to setup
        </button>
      </div>
    );
  if (setupOpen || !hasStarted)
    return (
      <RoundSetup
        draft={draft}
        startRound={() => {
          setHasStarted(true);
          setSetupOpen(false);
        }}
        setDraft={setDraft}
        exitRound={exitRound}
      />
    );
  const loop = draft.loop || "east";
  const length = draft.roundLength || 9;
  const holes = HERMANUS_LOOPS[loop].slice(0, length);
  const index = Math.min(activeHole, holes.length - 1);
  const holeNumber = holes[index];
  const currentHole =
    draft.holes.find((hole) => hole.holeNumber === holeNumber) ||
    emptyHole(holeNumber);
  const completed = draft.holes.filter((hole) => hole.score > 0).length;
  const courseId = draft.courseId || "hermanus-golf-club";
  const selectedHolePar = holePar(holeNumber, courseId);
  const importedTeeOrigin = getHoleTeeOrigin(courseId, holeNumber, draft.tee || "white");
  const teeOrigin = currentHole.teeOrigin || importedTeeOrigin;
  const teePlan = caddiePlan(readings, selectedHolePar, holeDistance(holeNumber, draft.tee || "white", courseId));
  const courseHole = getCourse(courseId)?.holes.find((hole) => hole.number === holeNumber);
  const teeTarget = (() => {
    if (!teeOrigin || !courseHole) return getTeeTarget(courseId, holeNumber, draft.tee || "white");
    if (selectedHolePar === 3) return getTeeTarget(courseId, holeNumber, draft.tee || "white");
    const candidates = generateTeeLandingCandidates({
      teeOrigin,
      centreline: courseHole.centreline,
      hazards: courseHole.hazards,
      greenCentre: courseHole.green?.centre,
      maxDistanceM: (teePlan?.tee.carry || 0) + 30,
    });
    const carry = teePlan?.tee.carry;
    if (!carry || !candidates.length) return undefined;
    const effectiveDistance = (candidate: (typeof candidates)[number]) => {
      const wind = weather ? calculateShotWind(weather, candidate.bearingDeg) : undefined;
      return calculateWindAdjustedDistance(candidate.distanceFromTeeM, wind)?.effectiveDistanceM || candidate.distanceFromTeeM;
    };
    const fitCandidates = candidates.filter((candidate) =>
      isTeeTargetReachable(readings, teePlan!.tee.club, effectiveDistance(candidate)),
    );
    const selected = selectReachableTeeLandingCandidate(
      fitCandidates,
      carry,
      effectiveDistance,
      Number.POSITIVE_INFINITY,
    );
    const reachable = selected;
    return reachable
      ? {
          position: reachable.candidate.position,
          targetType: "target" as const,
          name: "Fairway target",
        }
      : undefined;
  })();
  const windTarget = teeTarget || getTeeTarget(courseId, holeNumber, draft.tee || "white");
  const teeWind = teeOrigin && windTarget && weather
    ? calculateShotWind(weather, bearingBetween(teeOrigin, windTarget.position))
    : undefined;
  const teeAdjustment = teeWind && teeTarget
    ? calculateWindAdjustedDistance(distanceBetweenMeters(teeOrigin!, teeTarget.position), teeWind)
    : undefined;
  const teeDecision = resolveTeeDecision(
    readings,
    selectedHolePar,
    selectedHolePar === 3
      ? teeAdjustment?.effectiveDistanceM || holeDistance(holeNumber, draft.tee || "white", courseId)
      : teeTarget
        ? calculateWindAdjustedDistance(distanceBetweenMeters(teeOrigin!, teeTarget.position), teeWind)?.effectiveDistanceM || distanceBetweenMeters(teeOrigin!, teeTarget.position)
        : holeDistance(holeNumber, draft.tee || "white", courseId),
    rounds,
    { courseId, holeNumber, tee: draft.tee || "white" },
  );
  const updateHole = (patch: Partial<typeof currentHole>) =>
    setDraft({
      ...draft,
      currentHoleIndex: index,
      holes: [
        ...draft.holes.filter((hole) => hole.holeNumber !== holeNumber),
        { ...currentHole, ...patch },
      ].sort(
        (a, b) => holes.indexOf(a.holeNumber) - holes.indexOf(b.holeNumber),
      ),
    });
  const captureNextShot = async () => {
    const target = getHoleTarget(
      draft.courseId || "hermanus-golf-club",
      holeNumber,
    );
    if (!target) {
      setNextShotStatus("Green location not mapped for this hole yet.");
      return;
    }
    setNextShotStatus("Getting location…");
    try {
      const cached = latestPosition.current;
      const position = cached && Date.now() - Date.parse(cached.capturedAt) < 15000 && (cached.accuracyM || Infinity) <= 30 ? cached : await getCurrentPosition();
      const context = {
        holeNumber,
        position,
        targetPosition: target.position,
        targetType: target.targetType,
        distanceToTargetM: Math.round(
          distanceBetweenMeters(position, target.position),
        ),
        shotBearingDeg: Math.round(bearingBetween(position, target.position)),
        capturedAt: position.capturedAt,
      };
      const teeShot = currentHole.shots?.filter((shot) => shot.phase === "tee").at(-1);
      const teeStartPosition: { latitude: number; longitude: number; accuracyM?: number; capturedAt: string } | undefined = teeOrigin
        ? { latitude: teeOrigin.latitude, longitude: teeOrigin.longitude, accuracyM: "accuracyM" in teeOrigin && typeof teeOrigin.accuracyM === "number" ? teeOrigin.accuracyM : undefined, capturedAt: "capturedAt" in teeOrigin && typeof teeOrigin.capturedAt === "string" ? teeOrigin.capturedAt : new Date().toISOString() }
        : undefined;
      const teeStartContext = !currentHole.latestShotContext && teeShot && teeOrigin
        ? {
            position: teeStartPosition!,
            distanceToTargetM: Math.round(distanceBetweenMeters(teeStartPosition!, target.position)),
            lie: "tee" as const,
          }
        : undefined;
      const previousPosition = currentHole.latestShotContext?.position || teeStartContext?.position;
      const travelDistance = previousPosition ? distanceBetweenMeters(previousPosition, position) : 0;
      const previousAccuracy = currentHole.latestShotContext?.position.accuracyM;
      const validTravel = previousPosition && travelDistance >= 5 && isValidGolfShotContext(
        travelDistance,
        holeDistance(holeNumber, draft.tee || "white", courseId),
        Math.max(previousAccuracy ?? 0, position.accuracyM ?? 0),
      );
      const shots = currentHole.shots?.map((shot, shotIndex, allShots) =>
        shotIndex === allShots.length - 1 && validTravel
          ? enrichShotWithContext(
              shot,
              {
                position: currentHole.latestShotContext?.position || teeStartContext!.position,
                distanceToTargetM: currentHole.latestShotContext?.distanceToTargetM || teeStartContext!.distanceToTargetM,
                lie: currentHole.latestShotContext?.lie || teeStartContext?.lie,
              },
              context,
              Math.round(travelDistance),
            )
          : shotIndex === allShots.length - 1 && currentHole.latestShotContext
            ? enrichShotWithContext(shot, currentHole.latestShotContext, context)
          : shot,
      );
      updateHole({ latestShotContext: context, ...(shots ? { shots } : {}) });
      setNextShotStatus("");
    } catch (error) {
      const kind = error instanceof LocationError ? error.kind : "unavailable";
      setNextShotStatus(
        kind === "denied"
          ? "Location permission needed"
          : kind === "timeout"
            ? "Couldn’t get location. Try again."
            : "Couldn’t get location. Try again.",
      );
    }
  };
  return (
    <div className="stack fade-in round-screen">
      <div className="round-actions">
        <button
          type="button"
          className="text-button"
          onClick={() => setSetupOpen(true)}
        >
          ← Setup
        </button>
      </div>
      <div className="compact-hole-header">
        <strong>Hole {holeNumber}</strong>
        <span>Par {selectedHolePar}</span>
        <span>{holeDistance(holeNumber, draft.tee || "white", courseId)}m</span>
        <small>
          {completed}/{length}
        </small>
      </div>
      <div className="compact-caddie-row">
          <Caddie
            readings={readings}
            teeWind={teeWind}
          teeTargetName={teeTarget?.name}
          teeTargetDistance={teeTarget ? Math.round(distanceBetweenMeters(teeOrigin!, teeTarget.position)) : undefined}
          teeDecision={teeDecision}
          teePositionStatus={teePositionStatus}
          onCaptureTeeOrigin={async () => {
            setTeePositionStatus("Getting tee position…");
            try {
              const position = await getCurrentPosition();
              updateHole({
                teeOrigin: {
                  latitude: position.latitude,
                  longitude: position.longitude,
                  accuracyM: position.accuracyM,
                  capturedAt: position.capturedAt,
                  source: "live-gps",
                },
                teeOriginObservations: position.accuracyM !== undefined && position.accuracyM <= TEE_ORIGIN_ACCURACY.usableM
                  ? [...(currentHole.teeOriginObservations || []), { courseId: draft.courseId || "hermanus-golf-club", holeNumber, tee: draft.tee || "white", latitude: position.latitude, longitude: position.longitude, accuracyM: position.accuracyM, capturedAt: position.capturedAt, source: "live-gps" }]
                : currentHole.teeOriginObservations,
              });
              setTeePositionStatus("Tee position refined");
            } catch {
              setTeePositionStatus("Couldn’t refine tee position. Using mapped tee.");
            }
          }}
        />
      </div>
      <div className="next-shot-row">
        <button type="button" className="text-button" onClick={captureNextShot}>
          Next Shot
        </button>
        {currentHole.latestShotContext && (
          <span className="next-shot-context">
            <span>{currentHole.latestShotContext.distanceToTargetM}m to centre</span>
            {(() => {
              const wind = calculateShotWind(
                weather,
                currentHole.latestShotContext!.shotBearingDeg,
              );
              const windText = wind ? formatShotWind(wind) : "";
              const adjustment = calculateWindAdjustedDistance(
                currentHole.latestShotContext!.distanceToTargetM,
                wind,
              );
              return (
                <>
                  {windText ? <small>{windText}</small> : null}
                  {currentHole.latestShotContext.lie !== "recovery" && adjustment && adjustment.appliedComponent !== "none" && isValidGolfShotContext(currentHole.latestShotContext!.distanceToTargetM, holeDistance(holeNumber, draft.tee || "white", courseId), currentHole.latestShotContext!.position.accuracyM) ? (
                    <small>Plays ~{Math.round(adjustment.effectiveDistanceM)}m</small>
                  ) : null}
                </>
              );
            })()}
            {currentHole.latestShotContext.position.accuracyM &&
            currentHole.latestShotContext.position.accuracyM > 20
              ? ` · GPS ±${Math.round(currentHole.latestShotContext.position.accuracyM)}m`
              : ""}
          </span>
        )}
        {nextShotStatus && <small>{nextShotStatus}</small>}
      </div>
      {currentHole.latestShotContext && (
        <div className="shot-lie-selector" aria-label="Shot lie">
          <span className="eyebrow">LIE</span>
          <div className="shot-lie-chips">
            {(["fairway", "rough", "bunker", "green", "recovery"] as const).map((lie) => (
              <button
                key={lie}
                type="button"
                className={currentHole.latestShotContext?.lie === lie ? "active" : ""}
                aria-pressed={currentHole.latestShotContext?.lie === lie}
                onClick={() =>
                  updateHole({
                    latestShotContext: { ...currentHole.latestShotContext!, lie },
                  })
                }
              >
                {lie === "recovery" ? "Trouble" : lie[0].toUpperCase() + lie.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}
      {currentHole.latestShotContext && currentHole.latestShotContext.lie && (() => {
        const wind = calculateShotWind(weather, currentHole.latestShotContext!.shotBearingDeg);
        const adjustment = calculateWindAdjustedDistance(currentHole.latestShotContext!.distanceToTargetM, wind);
        const adaptive = adaptiveCaddieDecision(
          readings,
          bag,
          currentHole.latestShotContext!.distanceToTargetM,
          adjustment?.effectiveDistanceM || currentHole.latestShotContext!.distanceToTargetM,
          currentHole.latestShotContext.lie,
          holeDistance(holeNumber, draft.tee || "white", courseId),
          currentHole.latestShotContext.position.accuracyM,
          rounds,
          { courseId, holeNumber, tee: draft.tee || "white" },
        );
        return adaptive.recommendedClub ? (
          <button type="button" className="adaptive-caddie compact-panel" onClick={() => setShowAdaptiveWhy(!showAdaptiveWhy)}>
            <span className="eyebrow">{adaptive.status === "invalid-location" ? "CADDIE · LOCATION CHECK" : "CADDIE · NEXT SHOT"}</span>
            <strong>{clubDisplayLabel(adaptive.recommendedClub)}</strong>
            {adaptive.status === "invalid-location" && <small>You're currently outside the playable hole area. Safe fallback.</small>}
            <small>
              {adaptive.reasons
                .filter((reason) => ["adaptive-carry", "adaptive-playable"].includes(reason.key))
                .map((reason) => reason.value)
                .join(" · ")}
            </small>
            <span>{adaptive.reasons.find((reason) => reason.key === "adaptive-fit")?.value}</span>
            {showAdaptiveWhy && <small className="adaptive-caddie-why">{adaptive.reasons.map((reason) => reason.value).filter(Boolean).join(" · ")}</small>}
          </button>
        ) : (
          <section className="adaptive-caddie compact-panel">
            <span className="eyebrow">CADDIE · NEXT SHOT</span>
            <strong>{adaptive.status === "recovery-required" ? "Recovery shot · play back to safety" : "No suitable club"}</strong>
            {adaptive.status === "recovery-required" && <small>{adaptive.reasons[0]?.value}</small>}
          </section>
        );
      })()}
      <section className="hole-form">
        <label>
          Score
          <div className="score-entry">
            <div className="score-stepper">
              <button
                type="button"
                aria-label="Decrease score"
                onClick={() =>
                  updateHole({
                    score: Math.max(
                      1,
                      (currentHole.score || selectedHolePar) - 1,
                    ),
                  })
                }
              >
                −
              </button>
              <strong>{currentHole.score || selectedHolePar}</strong>
              <button
                type="button"
                aria-label="Increase score"
                onClick={() =>
                  updateHole({
                    score: Math.min(
                      15,
                      (currentHole.score || selectedHolePar) + 1,
                    ),
                  })
                }
              >
                +
              </button>
            </div>
          </div>
        </label>
        <label>
          Main area
          <select
            value={currentHole.focusCategory}
            onChange={(event) =>
              updateHole({ focusCategory: event.target.value as FocusCategory })
            }
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <ShotGroups
          bag={bag}
          shots={currentHole.shots || []}
          setShots={(shots) => updateHole({ shots })}
          onOutcome={(phase, note, selected) => {
            if (selected && ((phase === "tee" && note === "Hit green") || (phase === "approach" && note === "Hit green") || (phase === "short-game" && note === "Good chip on"))) updateHole({ onGreen: true });
          }}
          teeDefault={teeDecision?.club}
          defaultClub={currentHole.latestShotContext?.lie ? (() => {
            const wind = calculateShotWind(weather, currentHole.latestShotContext!.shotBearingDeg);
            const adjustment = calculateWindAdjustedDistance(currentHole.latestShotContext!.distanceToTargetM, wind);
              return adaptiveCaddieDecision(readings, bag, currentHole.latestShotContext!.distanceToTargetM, adjustment?.effectiveDistanceM || currentHole.latestShotContext!.distanceToTargetM, currentHole.latestShotContext!.lie, holeDistance(holeNumber, draft.tee || "white", courseId), currentHole.latestShotContext!.position.accuracyM, rounds, { courseId, holeNumber, tee: draft.tee || "white" }).recommendedClub;
          })() : undefined}
          putting={currentHole.onGreen === true}
          par={selectedHolePar}
        />
      </section>
      <button
        className="primary-button save-hole"
        onClick={() => {
          const saved = saveHole({ ...currentHole, score: currentHole.score > 0 ? currentHole.score : selectedHolePar });
          if (!saved) return;
          if (saved.holes.filter((hole) => hole.score > 0).length >= length) archiveRound(saved);
          else {
            setActiveHole(Math.min(index + 1, holes.length - 1));
          }
        }}
      >
        <Save size={18} />
        {completed >= length - 1 ? "Finish round" : "Save hole →"}
      </button>
      {notice && (
        <p className="notice">
          <Check size={16} />
          {notice}
        </p>
      )}
      <div className="hole-strip" ref={holeStripRef}>
        {holes.map((hole, i) => (
          <button
            key={hole}
            ref={(element) => { holeButtonRefs.current[hole] = element; }}
            className={i === index ? "active" : ""}
            onClick={() => { setActiveHole(i); setDraft({ ...draft, currentHoleIndex: i }); }}
          >
            {hole}
          </button>
        ))}
      </div>
    </div>
  );
}

function Caddie({
  readings,
  teeWind,
  teeTargetName,
  teeTargetDistance,
  teeDecision,
  teePositionStatus,
  onCaptureTeeOrigin,
}: {
  readings: AppData["readings"];
  teeWind?: ReturnType<typeof calculateShotWind>;
  teeTargetName?: string;
  teeTargetDistance?: number;
  teeDecision?: ReturnType<typeof resolveTeeDecision>;
  teePositionStatus?: string;
  onCaptureTeeOrigin?: () => Promise<void>;
}) {
  const [showDecision, setShowDecision] = useState(false);
  const plan = teeDecision?.plan;
  const decision = teeDecision?.explanation;
  const usableReadingCount = readings.filter((reading) => reading.playable !== false && !reading.severeMiss).length;
  if (!plan || !teeDecision) {
    const earlyClubs = [...new Set(readings.map((reading) => reading.club))]
      .map((club) => ({ club, summary: clubSummary(readings, club) }))
      .filter((item) => item.summary.typical !== undefined)
      .sort((a, b) => Math.abs((a.summary.typical || 0) - (teeTargetDistance || 0)) - Math.abs((b.summary.typical || 0) - (teeTargetDistance || 0)));
    const earlyClub = earlyClubs[0];
    if (!earlyClub) return <section className="caddie caddie-empty"><span className="caddie-title">TEE CADDIE</span><span className="eyebrow">BUILD YOUR CLUB DATA</span><b>Hit the range first</b><small>Record a club carry to unlock an early recommendation.</small></section>;
    return <section className="caddie caddie-early"><span className="caddie-title">TEE CADDIE</span><span className="eyebrow">EARLY RECOMMENDATION</span><b>{clubDisplayLabel(earlyClub.club)}</b><small>{Math.round(earlyClub.summary.typical!)}m carry · limited personal data</small>{teeWind && <small className="caddie-weather">{teeWind.label || `${Math.round(teeWind.windSpeedKmh)} km/h wind`} · wind-adjusted</small>}</section>;
  }
  return (
    <section
      className="caddie"
      role="button"
      tabIndex={0}
      onClick={() => setShowDecision(true)}
      onKeyDown={(event) => event.key === "Enter" && setShowDecision(true)}
    >
      <span className="caddie-title">TEE CADDIE</span>
      <span className="eyebrow">BEST TEE CLUB</span>
      <b>{clubDisplayLabel(teeDecision.club)}</b>
      {teeTargetName && teeTargetDistance !== undefined && (
        <small>{teeTargetName} · {teeTargetDistance}m</small>
      )}
      {decision?.reasons.find((reason) => reason.key === "primary-playable")?.value && (
        <small>{decision.reasons.find((reason) => reason.key === "primary-playable")?.value} playable</small>
      )}
      {teeWind && (
        <small className="caddie-weather">
          {teeWind.label || `${Math.round(teeWind.windSpeedKmh)} km/h wind`}
        </small>
      )}
      {showDecision && decision && (
        <div
          className="caddie-sheet-overlay"
          onClick={(event) => {
            event.stopPropagation();
            setShowDecision(false);
          }}
        >
          <div
            className="caddie-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="caddie-sheet-heading">
              <span className="eyebrow">WHY {clubDisplayLabel(teeDecision.club)}?</span>
              <button
                type="button"
                className="caddie-close"
                aria-label="Close"
                onClick={() => setShowDecision(false)}
              >
                ×
              </button>
            </div>
            <h3>
              {teeDecision.club
                ? `${teeDecision.club} off the tee`
                : "Selected club"}
            </h3>
            {usableReadingCount > 0 && usableReadingCount < 5 && <small className="caddie-confidence">Limited data · {usableReadingCount} usable reading{usableReadingCount === 1 ? "" : "s"}</small>}
            <p className="caddie-why">
              {decision.reasons.find(
                (reason) => reason.key === "risk-comparison",
              )?.value ||
                (decision.reasons.length
                  ? "Selected from your available carry and risk data."
                  : "Limited personal data for this club.")}
            </p>
            {teeWind && (
              <div className="caddie-conditions">
                <span className="eyebrow">WIND</span>
                <b>{teeWind.label || `${Math.round(teeWind.windSpeedKmh)} km/h wind`}</b>
              </div>
            )}
            {onCaptureTeeOrigin && (
              <div className="caddie-refine-action">
                <button type="button" className="text-button" onClick={(event) => { event.stopPropagation(); void onCaptureTeeOrigin(); }}>
                  Refine tee position with GPS
                </button>
                {teePositionStatus && <small>{teePositionStatus}</small>}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ShotGroups({
  bag,
  shots,
  setShots,
  onOutcome,
  teeDefault,
  defaultClub,
  putting,
  par,
}: {
  bag?: ClubName[];
  shots: HoleShot[];
  setShots: (shots: HoleShot[]) => void;
  onOutcome?: (phase: ShotPhase, note: string, selected: boolean) => void;
  teeDefault?: ClubName;
  defaultClub?: ClubName;
  putting?: boolean;
  par?: number;
}) {
  const [activePhase, setActivePhase] = useState<ShotPhase | null>(null);
  const activeGroupRef = useRef<HTMLDivElement | null>(null);
  const refocusSelector = () => {
    window.setTimeout(() => {
      activeGroupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };
  const outcomeOptions: Record<ShotPhase, { good: string[]; bad: string[] }> = {
    tee: {
      good: par === 3 ? ["Hit green", "Good distance", "Good direction", "Good contact", "Fairway found", "Good decision"] : ["Fairway found", "Good contact", "Good distance", "Good decision"],
      bad: [
        "Slice",
        "Hook",
        "Missed left",
        "Missed right",
        "Top",
        "Poor contact",
        "Bad decision",
        ...(par === 3 ? ["Too short", "Too long", "Left", "Right", "Poor contact", "Top"] : []),
      ],
    },
    approach: {
      good: ["Hit green", "Good contact", "Good distance", "Good direction"],
      bad: [
        "Short",
        "Long",
        "Left",
        "Right",
        "Fat",
        "Thin",
        "Topped",
        "Wrong club",
      ],
    },
    "short-game": {
      good: [
        "Good chip on",
        "Chip in",
        "Good direction",
        "Good distance",
        "Good recovery",
      ],
      bad: [
        "Chunked",
        "Thinned",
        "Too short",
        "Too long",
        "Poor direction",
        "Poor lie",
      ],
    },
    recovery: { good: [], bad: [] },
    putting: {
      good: ["Good read", "Good speed", "1 putt", "2 putt", "Good lag"],
      bad: [
        "Bad read",
        "Too short",
        "Too long",
        "Pushed",
        "Pulled",
        "Three-putt",
        "Missed short putt",
      ],
    },
  };
  const clubs = bag || [...CLUBS, "Putter"];
  const groups: Array<{ phase: ShotPhase; label: string; clubs: string[] }> = [
    {
      phase: "tee",
      label: "Tee club",
      clubs: clubs.filter((club) => !["PW", "SW", "Putter"].includes(club)),
    },
    {
      phase: "approach",
      label: "Approach",
      clubs: clubs.filter((club) => club !== "Putter"),
    },
    {
      phase: "short-game",
      label: "Short game",
      clubs: clubs.filter(
        (club) =>
          ["PW", "SW"].includes(club) ||
          ![
            "Dr",
            "3W",
            "4W-Hybrid",
            "5W",
            "6i",
            "7i",
            "8i",
            "9i",
            "Putter",
          ].includes(club),
      ),
    },
    {
      phase: "putting",
      label: "Putting",
      clubs: clubs.filter((club) => club === "Putter"),
    },
  ];
  useEffect(() => {
    const desired: Partial<Record<ShotPhase, ClubName | undefined>> = {
      tee: teeDefault,
      approach: defaultClub && !["PW", "SW"].includes(defaultClub) ? defaultClub : undefined,
      "short-game": defaultClub && ["PW", "SW"].includes(defaultClub) ? defaultClub : undefined,
      putting: undefined,
    };
    const additions = Object.entries(desired).filter(([phase, club]) => club && !shots.some((shot) => shot.phase === phase));
    let nextShots = additions.length
      ? [...shots, ...additions.map(([phase, club]) => ({ id: crypto.randomUUID(), phase: phase as ShotPhase, club: club as string }))]
      : shots;
    if (putting) nextShots = ensurePuttingShot(nextShots);
    if (nextShots !== shots) setShots(nextShots);
    if (putting) setActivePhase("putting");
  }, [teeDefault, defaultClub, putting, shots, setShots]);
  const toggle = (shotId: string, phase: ShotPhase, club: string) => {
    setActivePhase(phase);
    refocusSelector();
    const existing = shots.find((shot) => shot.id === shotId);
    if (!existing) return;
    if (existing.club === club)
      return setShots(shots.filter((shot) => shot.id !== shotId));
    setShots(updateHoleShot(shots, shotId, { club }));
  };
  const addShot = (phase: ShotPhase, club?: ClubName) => {
    setActivePhase(phase);
    refocusSelector();
    const nextShots = appendHoleShot(shots, phase, phase === "putting" ? "Putter" : club);
    setShots(nextShots);
  };
  const setOutcome = (
    shotId: string,
    phase: ShotPhase,
    outcome: "good" | "bad",
    note: string,
  ) => {
    refocusSelector();
    const existing = shots.find((shot) => shot.id === shotId);
    const existingOutcomes = existing?.outcomes || (existing?.note ? [{ outcome: existing.outcome || "bad", note: existing.note }] : []);
    const selected = existingOutcomes.some((item) => item.outcome === outcome && item.note === note);
    setShots(
      shots.map((shot) => {
        if (shot.id !== shotId) return shot;
        const current =
          shot.outcomes ||
          (shot.note
            ? [{ outcome: shot.outcome || "bad", note: shot.note }]
            : []);
        const currentSelected = current.some(
          (item) => item.outcome === outcome && item.note === note,
        );
        const outcomes = currentSelected
          ? current.filter(
              (item) => !(item.outcome === outcome && item.note === note),
            )
          : [...current, { outcome, note }];
        return {
          ...shot,
          outcomes,
          outcome: outcomes[0]?.outcome,
          note: outcomes[0]?.note,
        };
      }),
    );
    onOutcome?.(phase, note, !selected);
  };
  return (
    <div className="shot-groups">
      <p className="shot-help">
        Add only the important clubs. Every section is optional.
      </p>
      {groups.map((group) => {
        const groupShots = shots.filter((item) => item.phase === group.phase);
        return (
          <div className="shot-group" key={group.phase} ref={activePhase === group.phase ? activeGroupRef : undefined}>
            <div className={`shot-group-heading ${activePhase === group.phase ? "open" : ""}`} onClick={() => { if (group.phase === "putting" && !groupShots.length) addShot("putting", "Putter"); setActivePhase(activePhase === group.phase ? null : group.phase); refocusSelector(); }}>
              <button type="button" className="shot-group-toggle" onClick={(event) => { event.stopPropagation(); if (group.phase === "putting" && !groupShots.length) addShot("putting", "Putter"); setActivePhase(activePhase === group.phase ? null : group.phase); refocusSelector(); }}>
                <strong>{group.label}</strong>
                {groupShots.length > 0 && group.phase !== "putting" && <span>{groupShots.map((shot) => shot.club || "Choose club").join(" · ")}</span>}
              </button>
              <div className="shot-group-actions">
                {!['tee'].includes(group.phase) && <button type="button" className="shot-add-button" aria-label={`Add ${group.label} shot`} onClick={(event) => { event.stopPropagation(); if (activePhase !== group.phase) { setActivePhase(group.phase); refocusSelector(); } else { addShot(group.phase, group.phase === "putting" ? "Putter" : undefined); } }}>+</button>}
                <button type="button" className="shot-group-edit" onClick={(event) => { event.stopPropagation(); setActivePhase(activePhase === group.phase ? null : group.phase); refocusSelector(); }}>
                  {activePhase === group.phase ? "Close" : groupShots.length ? "Edit" : "Add"}
                </button>
              </div>
            </div>
            {activePhase === group.phase && (
              <div className="shot-clubs">
                {groupShots.map((shot, shotIndex) => group.phase !== "putting" ? (
                  <Fragment key={shot.id}>
                  <div className="shot-entry">
                    <small>{groupShots.length > 1 ? `${group.label} ${shotIndex + 1}` : group.label}</small>
                    <div>
                      {group.clubs.map((club) => (
                        <button
                          type="button"
                          key={club}
                          className={shot.club === club ? "selected" : ""}
                          onClick={() => toggle(shot.id, group.phase, club)}
                        >
                          {club}
                        </button>
                      ))}
                    </div>
                  </div>
                  {shot.club && (
                    <div className="shot-outcomes">
                      <small>{groupShots.length > 1 ? `${group.label} ${shotIndex + 1}` : group.label} outcomes</small>
                      {outcomeOptions[group.phase].good.concat(outcomeOptions[group.phase].bad).map((note) => {
                        const outcome = outcomeOptions[group.phase].good.includes(note) ? "good" : "bad";
                        const selected = (shot.outcomes || (shot.note ? [{ outcome: shot.outcome || "bad", note: shot.note }] : [])).some((item) => item.outcome === outcome && item.note === note);
                        return <button type="button" key={note} className={selected ? `selected ${outcome}` : ""} onClick={() => setOutcome(shot.id, group.phase, outcome, note)}>{outcome === "good" ? "✓" : "×"} {note}</button>;
                      })}
                    </div>
                  )}
                  </Fragment>
                ) : null)}
                {!groupShots.length && group.phase !== "putting" && (
                  <div className="shot-first-club-choice">
                    {group.clubs.map((club) => <button type="button" key={club} onClick={(event) => { event.stopPropagation(); addShot(group.phase, club); }}>{club}</button>)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;
