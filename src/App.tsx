import { useEffect, useRef, useState } from "react";
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
  DISTANCE_CLUBS,
  caddiePlan,
  isTeeTargetReachable,
  caddieDecision,
  adaptiveCaddieDecision,
  isValidGolfShotContext,
  clubSummary,
  clubDisplayLabel,
  convertMetres,
  formatDate,
  personalisedRecommendation,
  roundTotal,
  roundHandicapIndex,
  seedData,
  startOfWeek,
} from "./domain";
import type {
  AppData,
  ClubName,
  FocusCategory,
  HoleShot,
  RoundHole,
  RoundCategory,
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
  mergeAppData,
  loadLocalData,
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
  const [authReady, setAuthReady] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [dataReady, setDataReady] = useState(false);
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
        setSession(authSession);
        if (event === "SIGNED_OUT") {
          setData(null);
          setDataReady(false);
        }
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!authReady || !session) return;
    let cancelled = false;
    (async () => {
      const cloudData = await loadCloudData(session);
      if (!cancelled) {
        const localData = loadLocalData();
        setData(mergeAppData(localData, cloudData) || seedData());
        setDataReady(true);
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
    if (!data || !dataReady || !session) return;
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
  const currentHandicap = data?.handicapHistory.at(-1)?.index;
  const archivedRounds =
    data?.rounds.filter((round) => round.status === "archived") || [];
  const latestRound = archivedRounds.at(-1);
  const rec = personalisedRecommendation(
    data?.rounds || [],
    data?.readings || [],
  );
  if (!authReady)
    return <div className="loading">Connecting your notebook...</div>;
  if (cloudError && !session && !data)
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
  if (isCloudConfigured && !session && !data) return <AuthScreen />;
  if (!data) return <div className="loading">Loading your notebook...</div>;
  const updateData = (change: (current: AppData) => AppData) =>
    setData((current) => (current ? change(current) : current));
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
          sessionDate: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setDistanceInput("");
    distanceRef.current?.focus();
  };

  const startRound = () => {
    const unfinished = data.rounds.find((round) => round.status === "in-progress") ||
      (roundDraft?.status === "in-progress" ? roundDraft : undefined);
    const next = unfinished
      ? unfinished.courseId || unfinished.courseName?.toLowerCase().includes("hermanus")
        ? { ...unfinished, courseId: unfinished.courseId || "hermanus-golf-club", handicapIndex: roundHandicapIndex(data.handicapHistory.at(-1)?.index, unfinished.handicapIndex) }
        : { ...unfinished, handicapIndex: roundHandicapIndex(data.handicapHistory.at(-1)?.index, unfinished.handicapIndex) }
      : {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      courseName: data.homeCourseName || "Hermanus Golf Club",
      courseId: data.homeCourseId || "hermanus-golf-club",
      overallNote: "",
      status: "in-progress" as const,
      holes: [],
      loop: data.lastRoundLoop || "east",
      loopId: data.lastRoundLoop || "east",
      roundLength: data.lastRoundLength || 9,
      tee: data.preferredTee || "white",
      teeId: data.preferredTee || "white",
      handicapIndex: roundHandicapIndex(data.handicapHistory.at(-1)?.index),
        };
    setRoundDraft(next);
    updateData((current) => ({ ...current, rounds: current.rounds.some((round) => round.id === next.id) ? current.rounds.map((round) => round.id === next.id ? next : round) : [...current.rounds, next] }));
    const resuming = Boolean(unfinished && !roundSetupOpen);
    setRoundSetupOpen(!resuming);
    setRoundHasStarted(resuming);
    setScreen("round");
  };
  const persistRoundDraft = (next: AppData["rounds"][number]) => {
    setRoundDraft(next);
    updateData((current) => ({ ...current, rounds: current.rounds.some((round) => round.id === next.id) ? current.rounds.map((round) => round.id === next.id ? next : round) : [...current.rounds, next] }));
  };
  const saveHole = (submittedHole?: RoundHole) => {
    if (!roundDraft) return null;
    const sequence = HERMANUS_LOOPS[roundDraft.loop || "east"].slice(
      0,
      roundDraft.roundLength || 9,
    );
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
    const updated = { ...roundDraft, holes };
    updateData((current) => ({
      ...current,
      rounds: current.rounds.some((round) => round.id === updated.id)
        ? current.rounds.map((round) =>
            round.id === updated.id ? updated : round,
          )
        : [...current.rounds, updated],
    }));
    persistRoundDraft(updated);
    setRoundNotice("Saved");
    return updated;
  };
  const archiveRound = (source = roundDraft) => {
    if (!source) return;
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
  const togglePracticeSession = (index: number) =>
    updateData((current) => {
      const complete = [...(current.weeklyPlan.practiceSessionsComplete || [])];
      while (complete.length <= index) complete.push(false);
      complete[index] = !complete[index];
      return {
        ...current,
        weeklyPlan: {
          ...current.weeklyPlan,
          practiceSessionsComplete: complete,
        },
      };
    });
  const toggleRoundSession = (index: number) =>
    updateData((current) => {
      const complete = [...(current.weeklyPlan.roundsComplete || [])];
      while (complete.length <= index) complete.push(false);
      complete[index] = !complete[index];
      return {
        ...current,
        weeklyPlan: { ...current.weeklyPlan, roundsComplete: complete },
      };
    });
  const screenTitle =
    screen === "settings"
      ? "Settings"
      : navItems.find((item) => item.id === screen)?.label || "Today";
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GOLF TRACKER</p>
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
            units="metres"
            setUnits={() => undefined}
          />
        )}
        {screen === "round" && (
          <RoundMode
            readings={data.readings}
            bag={data.bag}
            draft={roundDraft}
            setDraft={persistRoundDraft}
            notice={roundNotice}
            setNotice={setRoundNotice}
            startRound={startRound}
            saveHole={saveHole}
            archiveRound={archiveRound}
            exitRound={() => setScreen("today")}
            setupOpen={roundSetupOpen}
            setSetupOpen={setRoundSetupOpen}
            hasStarted={roundHasStarted}
            setHasStarted={setRoundHasStarted}
            weather={roundWeather}
          />
        )}
        {screen === "progress" && (
          <Progress data={data} recommendation={rec} updatePlan={updatePlan} focusRoundId={completedRoundId} latestHandicap={currentHandicap} updateRound={(round) => updateData((current) => ({ ...current, rounds: current.rounds.map((item) => item.id === round.id ? round : item) }))} />
        )}
        {screen === "settings" && (
          <Settings data={data} updateData={updateData} />
        )}
      </main>
      <nav className="bottom-nav">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={screen === id ? "active" : ""}
            onClick={() => {
              if (id === "round" && !roundHasStarted) setRoundSetupOpen(true);
              setScreen(id);
            }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

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

  const signUp = async () => {
    if (!supabase) return;
    setBusy(true);
    setNotice("");
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    setNotice(
      error ? error.message : "Check your email to confirm your account.",
    );
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <span className="tag">GOLF TRACKER</span>
        <h2>Sign in to your distances.</h2>
        <p>
          Use the same account on your phone and computer. Your rows are
          protected by Supabase RLS.
        </p>
        <form onSubmit={signIn}>
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
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="primary-button" disabled={busy}>
            {busy ? "Connecting..." : "Sign in"}
          </button>
        </form>
        <button className="text-button" onClick={signUp} disabled={busy}>
          Create account
        </button>
        {notice && <p className="notice">{notice}</p>}
      </div>
    </div>
  );
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
      "Standard range session",
      "Record carry, playable and severe-miss outcomes.",
    ],
    ["Putting session", "Work on pace and first-putt distance control."],
    ["Short-game session", "Build touch around the green."],
    ["Approach distance session", "Calibrate your scoring irons."],
    ["Course-management session", "Play a round and record decisions."],
  ];
  const practiceFocus = Array.from({ length: practiceCount }, (_, index) => [
    `practiceSession:${index}`,
    rec.priorities[index]?.drill ||
      fallbackPractice[index % fallbackPractice.length][0],
    rec.priorities[index]?.evidence ||
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
                <small>{priority.evidence}</small>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="panel weekly">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THIS WEEK</span>
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
  const bag = data.bag?.length ? data.bag : CLUBS;
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
              {bag.map((club) => (
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
  units,
  setUnits,
}: {
  readings: AppData["readings"];
  units: "metres" | "yards";
  setUnits: (units: "metres" | "yards") => void;
}) {
  const [expandedClub, setExpandedClub] = useState<ClubName | null>(null);
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
        {DISTANCE_CLUBS.map((club) => {
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

function ClubFormPanel({ readings }: { readings: AppData["readings"] }) {
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
          <p className="chart-caption">
            Recent form across logged range shots.
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
}: {
  data: AppData;
  updateData: (change: (current: AppData) => AppData) => void;
}) {
  const [handicapInput, setHandicapInput] = useState("");
  const [customClub, setCustomClub] = useState("");
  const [editingBag, setEditingBag] = useState(false);
  const [settingsEditor, setSettingsEditor] = useState<
    "course" | "tee" | "handicap" | null
  >(null);
  const bag = data.bag || [...CLUBS, "Putter"];
  const available = [...new Set([...CLUBS, "5W", "Putter", "2i", "3i", "4i"])];
  const toggleClub = (club: string) =>
    updateData((current) => ({
      ...current,
      bag: (current.bag || bag).includes(club)
        ? (current.bag || bag).filter((item) => item !== club)
        : [...(current.bag || bag), club],
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
          date: new Date().toISOString().slice(0, 10),
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
      bag: [...(current.bag || bag), club],
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
            <strong>{data.homeCourseName || "Hermanus Golf Club"}</strong>
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
                String(data.handicapHistory.at(-1)?.index ?? ""),
              );
              setSettingsEditor("handicap");
            }}
          >
            <span>Handicap</span>
            <strong>{data.handicapHistory.at(-1)?.index ?? "No index"}</strong>
            <ChevronRight size={16} />
          </button>
        </div>
      </section>
      <section className="settings-group">
        <span className="eyebrow">WEEKLY PLAN</span>
        <div className="panel settings-panel">
          <label className="settings-field">
            Rounds per week
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
            Practice sessions per week
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
              {bag.map(clubDisplayLabel).join(" · ")}
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
              </>
            )}
            {settingsEditor === "tee" && (
              <>
                <h3>Preferred tees</h3>
                {(["white", "yellow", "red"] as const).map((tee) => (
                  <button
                    key={tee}
                    onClick={() => {
                      updateData((current) => ({
                        ...current,
                        preferredTee: tee,
                      }));
                      setSettingsEditor(null);
                    }}
                  >
                    {tee[0].toUpperCase() + tee.slice(1)}
                  </button>
                ))}
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
    round.holes.reduce((sum, hole) => sum + holePar(hole.holeNumber), 0)
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
  const [insightsTab, setInsightsTab] = useState<
    "overview" | "clubs" | "rounds"
  >("overview");
  const archived = data.rounds
    .filter((round) => round.status === "archived")
    .sort((a, b) => a.date.localeCompare(b.date));
  const recent = archived.slice(-6);
  const completed = [
    data.weeklyPlan.practiceAComplete,
    data.weeklyPlan.practiceBComplete,
    ...((data.practiceFrequency?.practiceSessionsPerWeek ?? 2) >= 3
      ? [data.weeklyPlan.practiceCComplete]
      : []),
    data.weeklyPlan.roundComplete,
  ].filter(Boolean).length;
  const scores = recent.map((round) => round.totalScore || roundTotal(round));
  const holes = recent.flatMap((round) => round.holes);
  const categories: FocusCategory[] = [
    "Tee shot",
    "Approach",
    "Short game",
    "Putting",
    "Course management",
  ];
  const shotPhaseCategory: Record<ShotPhase, FocusCategory> = {
    tee: "Tee shot",
    approach: "Approach",
    "short-game": "Short game",
    putting: "Putting",
  };
  const tagCategory: Record<RoundCategory, FocusCategory> = {
    drive: "Tee shot",
    wood: "Tee shot",
    iron: "Approach",
    chip: "Short game",
    putt: "Putting",
  };
  const structuredCategoriesForHole = (hole: RoundHole) => {
    const tagged = (hole.tags || [])
      .filter((tag) => tag.type === "went-wrong")
      .map((tag) => tagCategory[tag.category]);
    const shot = (hole.shots || [])
      .filter((item) => item.outcome === "bad")
      .map((item) => shotPhaseCategory[item.phase]);
    return [...new Set([...tagged, ...shot])];
  };
  const categoryStats = categories.map((category) => {
    const items = holes.filter((hole) => {
      const structured = structuredCategoriesForHole(hole);
      return structured.length
        ? structured.includes(category)
        : hole.focusCategory === category;
    });
    const troubleItems = items.filter(
      (hole) =>
        hole.wentWrong.trim() ||
        (hole.tags || []).some((tag) => tag.type === "went-wrong") ||
        (hole.shots || []).some((shot) => shot.outcome === "bad"),
    );
    return {
      category,
      average: troubleItems.length
        ? troubleItems.reduce((sum, hole) => sum + hole.score, 0) / troubleItems.length
        : 0,
      count: troubleItems.length,
      trouble: troubleItems.length,
    };
  });
  const rankedCategoryStats = [
    ...categoryStats.filter((item) => item.count).sort((a, b) =>
      b.trouble - a.trouble || b.average - a.average,
    ),
    ...categoryStats.filter((item) => !item.count),
  ];
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
  const previous = scores.length > 1 ? scores.at(-2) : undefined;
  const scoreDelta =
    latest !== undefined && previous !== undefined
      ? latest - previous
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
          <strong>{latest ?? "—"}</strong>
          <span>
            {scoreDelta === undefined
              ? "First round logged"
              : `${scoreDelta > 0 ? "+" : ""}${scoreDelta} vs previous round`}
          </span>
        </div>
        <div className="hero-chart">
          <MiniLineChart values={scores} />
        </div>
      </section>
      <section className="panel handicap-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HANDICAP INDEX</span>
            <h3>{data.handicapHistory.at(-1)?.index ?? "—"} current index</h3>
          </div>
          <span className="count-pill">{handicapValues.length} updates</span>
        </div>
        <MiniLineChart values={handicapValues} />
      </section>
      <ClubFormPanel readings={data.readings} />
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
      <section className="panel insights-form-map">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FORM MAP</span>
            <h3>Where shots cost you</h3>
          </div>
          <Target size={22} />
        </div>
        <div className="form-list">
          {rankedCategoryStats.map((item, index) => (
            <div className={`form-row ${item.count ? "has-data" : "no-data"}`} key={item.category}>
              <div>
                <strong>{item.category}</strong>
                <small>
                  {item.count
                    ? `${item.trouble} trouble hole${item.trouble === 1 ? "" : "s"} · ${item.average.toFixed(1)} avg`
                    : "No data yet"}
                </small>
              </div>
              {item.count > 0 && index === 0 && <span className="form-leak-label">Biggest leak</span>}
              {item.count > 0 && index > 0 && <span className="form-rank">#{index + 1}</span>}
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
  const [scores, setScores] = useState(() => round.holes.map((hole) => hole.score));
  const [handicap, setHandicap] = useState<number | "">(roundHandicapIndex(latestHandicap, round.handicapIndex) ?? "");
  const score = round.totalScore || roundTotal(round);
  const par = round.holes.reduce(
    (total, hole) => total + holePar(hole.holeNumber),
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
          {round.loop ? loopLabel(round.loop) : "Round"}
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
          <strong>{round.handicapIndex ?? "—"}</strong>
        </div>
      </section>
      <button className="text-button" onClick={() => {
        if (editing) {
          const holes = round.holes.map((hole, index) => ({ ...hole, score: Math.max(1, Number(scores[index]) || holePar(hole.holeNumber)) }));
          const edited = { ...round, holes, handicapIndex: handicap === "" ? undefined : Number(handicap), status: "archived" as const };
          onSave({ ...edited, totalScore: roundTotal(edited) });
        }
        setEditing(!editing);
      }}>{editing ? "Save edits" : "Edit Round"}</button>
      {editing && <div className="panel"><label>Handicap index<input type="number" step="0.1" value={handicap} onChange={(event) => setHandicap(event.target.value === "" ? "" : Number(event.target.value))} /></label>{round.holes.map((hole, index) => <label key={hole.holeNumber}>Hole {hole.holeNumber}<input type="number" min="1" max="15" value={scores[index] || ""} onChange={(event) => setScores((current) => current.map((score, item) => item === index ? Number(event.target.value) : score))} /></label>)}</div>}
      {issues.length > 0 && (
        <section className="panel">
          <span className="eyebrow">ROUND FEEDBACK</span>
          <h3>Main leaks</h3>
          <p>{Array.from(new Set(issues)).join(" · ")}</p>
        </section>
      )}
      <ArchivedScorecard round={round} />
    </div>
  );
}

function ArchivedScorecard({ round }: { round: AppData["rounds"][number] }) {
  const orderedHoles = [...round.holes].sort(
    (a, b) => a.holeNumber - b.holeNumber,
  );
  return (
    <section className="scorecard">
      <div className="scorecard-heading">
        <div>
          <span className="eyebrow">SCORECARD</span>
          <h3>
            {loopLabel(round.loop || "east")} · {round.tee || "white"} tees
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
          return (
            <div className="scorecard-row" key={hole.holeNumber}>
              <span className="scorecard-hole">{hole.holeNumber}</span>
              <span>{holePar(hole.holeNumber)}</span>
              <strong
                className={
                  hole.score < holePar(hole.holeNumber)
                    ? "under"
                    : hole.score > holePar(hole.holeNumber)
                      ? "over"
                      : "even"
                }
              >
                {hole.score}
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
            onChange={(event) => update({ courseName: event.target.value })}
          >
            <option>Hermanus Golf Club</option>
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
              {[9, 18, 27].map((count) => (
                <option key={count} value={count}>
                  {count} holes
                </option>
              ))}
            </select>
          </label>
          <label>
            Tees
            <select
              value={draft.tee || "white"}
              onChange={(event) =>
                update({
                  tee: event.target.value as "white" | "yellow" | "red",
                })
              }
            >
              <option value="white">White tees</option>
              <option value="yellow">Yellow tees</option>
              <option value="red">Red tees</option>
            </select>
          </label>
        </div>
        <label>
          Starting loop
          <select
            value={loop}
            onChange={(event) =>
              update({ loop: event.target.value as typeof loop })
            }
          >
            {(["east", "north", "south"] as const).map((item) => (
              <option key={item} value={item}>
                {loopLabel(item, length as 9 | 18 | 27)}
              </option>
            ))}
          </select>
        </label>
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
  const [nextShotStatus, setNextShotStatus] = useState("");
  const [teePositionStatus, setTeePositionStatus] = useState("");
  const [showAdaptiveWhy, setShowAdaptiveWhy] = useState(false);
  const latestPosition = useRef<Awaited<ReturnType<typeof getCurrentPosition>> | null>(null);
  useEffect(() => watchPosition((position) => { latestPosition.current = position; }), []);
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
  const importedTeeOrigin = getHoleTeeOrigin(courseId, holeNumber, draft.tee || "white");
  const teeOrigin = currentHole.teeOrigin || importedTeeOrigin;
  const teePlan = caddiePlan(readings, holePar(holeNumber), holeDistance(holeNumber, draft.tee || "white"));
  const courseHole = getCourse(courseId)?.holes.find((hole) => hole.number === holeNumber);
  const teeTarget = (() => {
    if (!teeOrigin || !courseHole) return getTeeTarget(courseId, holeNumber, draft.tee || "white");
    if (holePar(holeNumber) === 3) return getTeeTarget(courseId, holeNumber, draft.tee || "white");
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
  const teeWind = teeOrigin && teeTarget && weather
    ? calculateShotWind(weather, bearingBetween(teeOrigin, teeTarget.position))
    : undefined;
  const teeAdjustment = teeWind && teeTarget
    ? calculateWindAdjustedDistance(distanceBetweenMeters(teeOrigin!, teeTarget.position), teeWind)
    : undefined;
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
      updateHole({ latestShotContext: context });
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
        <span>Par {holePar(holeNumber)}</span>
        <span>{holeDistance(holeNumber, draft.tee || "white")}m</span>
        <small>
          {completed}/{length}
        </small>
      </div>
      <div className="compact-caddie-row">
        <Caddie
          readings={readings}
          par={holePar(holeNumber)}
          distance={holeDistance(holeNumber, draft.tee || "white")}
          teeOrigin={teeOrigin}
          teeWind={teeWind}
          teePlayingDistance={teeAdjustment?.effectiveDistanceM}
          teeTargetName={teeTarget?.name}
          teeTargetDistance={teeTarget ? Math.round(distanceBetweenMeters(teeOrigin!, teeTarget.position)) : undefined}
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
                  {adjustment && adjustment.appliedComponent !== "none" && isValidGolfShotContext(currentHole.latestShotContext!.distanceToTargetM, holeDistance(holeNumber, draft.tee || "white"), currentHole.latestShotContext!.position.accuracyM) ? (
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
            {(["fairway", "rough", "bunker", "recovery"] as const).map((lie) => (
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
                {lie[0].toUpperCase() + lie.slice(1)}
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
          holeDistance(holeNumber, draft.tee || "white"),
          currentHole.latestShotContext.position.accuracyM,
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
            <strong>{adaptive.status === "recovery-required" ? "Play back to safety" : "No suitable club"}</strong>
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
                      (currentHole.score || holePar(holeNumber)) - 1,
                    ),
                  })
                }
              >
                −
              </button>
              <strong>{currentHole.score || holePar(holeNumber)}</strong>
              <button
                type="button"
                aria-label="Increase score"
                onClick={() =>
                  updateHole({
                    score: Math.min(
                      15,
                      (currentHole.score || holePar(holeNumber)) + 1,
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
          teeDefault={teePlan?.tee.club}
          defaultClub={currentHole.latestShotContext?.lie ? (() => {
            const wind = calculateShotWind(weather, currentHole.latestShotContext!.shotBearingDeg);
            const adjustment = calculateWindAdjustedDistance(currentHole.latestShotContext!.distanceToTargetM, wind);
            return adaptiveCaddieDecision(readings, bag, currentHole.latestShotContext!.distanceToTargetM, adjustment?.effectiveDistanceM || currentHole.latestShotContext!.distanceToTargetM, currentHole.latestShotContext!.lie, holeDistance(holeNumber, draft.tee || "white"), currentHole.latestShotContext!.position.accuracyM).recommendedClub;
          })() : undefined}
          putting={currentHole.focusCategory === "Putting"}
          par={holePar(holeNumber)}
        />
      </section>
      <button
        className="primary-button save-hole"
        onClick={() => {
          const saved = saveHole({ ...currentHole, score: currentHole.score > 0 ? currentHole.score : holePar(holeNumber) });
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
      <div className="hole-strip">
        {holes.map((hole, i) => (
          <button
            key={hole}
            className={i === index ? "active" : ""}
            onClick={() => setActiveHole(i)}
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
  par,
  distance,
  teeOrigin,
  teeWind,
  teePlayingDistance,
  teeTargetName,
  teeTargetDistance,
  teePositionStatus,
  onCaptureTeeOrigin,
}: {
  readings: AppData["readings"];
  par: number;
  distance: number;
  teeOrigin?: { latitude: number; longitude: number; accuracyM?: number };
  teeWind?: ReturnType<typeof calculateShotWind>;
  teePlayingDistance?: number;
  teeTargetName?: string;
  teeTargetDistance?: number;
  teePositionStatus?: string;
  onCaptureTeeOrigin?: () => Promise<void>;
}) {
  const [showDecision, setShowDecision] = useState(false);
  const plan = caddiePlan(readings, par, teePlayingDistance || distance);
  const decision = caddieDecision(readings, par, teePlayingDistance || distance);
  if (!plan) return null;
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
      <b>{clubDisplayLabel(plan.tee.club)}</b>
      {teeOrigin && teeWind && teeWind.label && (
        <small className="caddie-weather">{teeWind.label}</small>
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
              <span className="eyebrow">WHY {clubDisplayLabel(decision.primaryClub || plan.tee.club)}?</span>
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
              {decision.primaryClub
                ? `${decision.primaryClub} off the tee`
                : "Selected club"}
            </h3>
            <p className="caddie-why">
              {decision.reasons.find(
                (reason) => reason.key === "risk-comparison",
              )?.value ||
                (decision.reasons.length
                  ? "Selected from your available carry and risk data."
                  : "Limited personal data for this club.")}
            </p>
            <p className="caddie-inline-metrics">
              {decision.reasons
                .filter((reason) =>
                  [
                    "primary-carry",
                    "primary-range",
                    "primary-playable",
                    "primary-severe",
                  ].includes(reason.key),
                )
                .map((reason) =>
                    reason.key === "primary-carry"
                      ? `${reason.value} carry`
                      : reason.key === "primary-range"
                        ? reason.value
                      : reason.key === "primary-playable"
                      ? `${reason.value} playable`
                      : `${reason.value} severe`,
                )
                .join(" · ")}
            </p>
            {teeTargetName && teeTargetDistance !== undefined && (
              <div className="caddie-conditions">
                <span className="eyebrow">TARGET</span>
                <b>{teeTargetName} · {teeTargetDistance}m</b>
              </div>
            )}
            {teePlayingDistance !== undefined && (
              <div className="caddie-conditions">
                <span className="eyebrow">PLAYS</span>
                <b>~{Math.round(teePlayingDistance)}m</b>
              </div>
            )}
            {teeWind?.label && (
              <div className="caddie-conditions">
                <span className="eyebrow">WIND</span>
                <b>{teeWind.label}</b>
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
  teeDefault,
  defaultClub,
  putting,
  par,
}: {
  bag?: ClubName[];
  shots: HoleShot[];
  setShots: (shots: HoleShot[]) => void;
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
        "Good direction",
        "Good distance",
        "Up-and-down",
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
    putting: {
      good: ["Good read", "Good speed", "Holed putt", "Good lag"],
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
      putting: putting ? "Putter" : undefined,
    };
    const additions = Object.entries(desired).filter(([phase, club]) => club && !shots.some((shot) => shot.phase === phase));
    if (additions.length) setShots([...shots, ...additions.map(([phase, club]) => ({ id: crypto.randomUUID(), phase: phase as ShotPhase, club: club as string }))]);
  }, [teeDefault, defaultClub, putting, shots, setShots]);
  const toggle = (phase: ShotPhase, club: string) => {
    setActivePhase(phase);
    refocusSelector();
    const existing = shots.find((shot) => shot.phase === phase);
    if (existing?.club === club)
      return setShots(shots.filter((shot) => shot.id !== existing.id));
    setShots([
      ...shots.filter((shot) => shot.phase !== phase),
      { id: crypto.randomUUID(), phase, club },
    ]);
  };
  const setOutcome = (
    phase: ShotPhase,
    outcome: "good" | "bad",
    note: string,
  ) => {
    refocusSelector();
    setShots(
      shots.map((shot) => {
        if (shot.phase !== phase) return shot;
        const current =
          shot.outcomes ||
          (shot.note
            ? [{ outcome: shot.outcome || "bad", note: shot.note }]
            : []);
        const selected = current.some(
          (item) => item.outcome === outcome && item.note === note,
        );
        const outcomes = selected
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
  };
  return (
    <div className="shot-groups">
      <p className="shot-help">
        Add only the important clubs. Every section is optional.
      </p>
      {groups.map((group) => {
        const shot = shots.find((item) => item.phase === group.phase);
        return (
          <div className="shot-group" key={group.phase} ref={activePhase === group.phase ? activeGroupRef : undefined}>
            <button
              type="button"
              className={`shot-group-heading ${activePhase === group.phase ? "open" : ""}`}
              onClick={() => {
                setActivePhase(activePhase === group.phase ? null : group.phase);
                refocusSelector();
              }}
            >
              <strong>{group.label}</strong>
              {shot && <span>{shot.club}</span>}
              <small>
                {activePhase === group.phase ? "Close" : shot ? "Edit" : "Add"}
              </small>
            </button>
            {activePhase === group.phase && (
              <div className="shot-clubs">
                {group.clubs.map((club) => (
                  <button
                    type="button"
                    key={club}
                    className={shot?.club === club ? "selected" : ""}
                    onClick={() => toggle(group.phase, club)}
                  >
                    {club}
                  </button>
                ))}
              </div>
            )}
            {shot && activePhase === group.phase && (
              <div className="shot-outcomes">
                {outcomeOptions[group.phase].good.map((note) => (
                  <button
                    type="button"
                    key={note}
                    className={
                      (
                        shot.outcomes ||
                        (shot.note
                          ? [
                              {
                                outcome: shot.outcome || "bad",
                                note: shot.note,
                              },
                            ]
                          : [])
                      ).some(
                        (item) => item.outcome === "good" && item.note === note,
                      )
                        ? "selected good"
                        : ""
                    }
                    onClick={() => setOutcome(group.phase, "good", note)}
                  >
                    ✓ {note}
                  </button>
                ))}
                {outcomeOptions[group.phase].bad.map((note) => (
                  <button
                    type="button"
                    key={note}
                    className={
                      (
                        shot.outcomes ||
                        (shot.note
                          ? [
                              {
                                outcome: shot.outcome || "bad",
                                note: shot.note,
                              },
                            ]
                          : [])
                      ).some(
                        (item) => item.outcome === "bad" && item.note === note,
                      )
                        ? "selected bad"
                        : ""
                    }
                    onClick={() => setOutcome(group.phase, "bad", note)}
                  >
                    × {note}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;
